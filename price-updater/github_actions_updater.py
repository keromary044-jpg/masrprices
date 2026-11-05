#!/usr/bin/env python3
"""Update MasrPrices only from authorized, authenticated provider APIs."""
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "price-feeds.json"
EXCLUDED_PRICE_CATALOGS = {
    # These need dedicated, separately authorized data integrations.
    "medicines.json", "stocks.json", "real-estate.json", "market-rates.json",
}
MAX_BYTES = 5_000_000
MAX_PAGES = 10

def normalize(value):
    value = unicodedata.normalize("NFKD", str(value or "").casefold())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", value)
    value = value.translate(str.maketrans({"أ":"ا","إ":"ا","آ":"ا","ى":"ي","ة":"ه"}))
    return re.sub(r"[^\w\u0600-\u06ff]+", " ", value).strip()

def valid_https(value):
    return isinstance(value, str) and value.startswith("https://") and len(value) < 1500

class HTTPSOnlyRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith("https://"):
            raise ValueError("Provider redirect must remain HTTPS")
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def get_json(url, headers=None):
    request = urllib.request.Request(
        url, headers={"Accept":"application/json","User-Agent":"MasrPrices-PriceUpdater/2.0", **(headers or {})}
    )
    opener = urllib.request.build_opener(HTTPSOnlyRedirectHandler())
    with opener.open(request, timeout=30) as response:
        if not response.geturl().startswith("https://"):
            raise ValueError("Provider redirected away from HTTPS")
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Provider response exceeds 5 MB")
    return json.loads(raw.decode("utf-8"))

def load_catalogs():
    catalogs = {}
    # Discover every top-level product catalog automatically so new sections
    # are not silently omitted from authorized feed matching.
    for path in sorted(ROOT.glob("*.json")):
        filename = path.name
        if filename in EXCLUDED_PRICE_CATALOGS or filename in {"price-feeds.json", "price-coverage-report.json", "phone-model-index.json", "seo-products.json"}:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data.get("products"), list):
                catalogs[filename] = data
        except (OSError, ValueError):
            continue
    return catalogs

def build_exact_index(catalogs, allowed_files=None):
    index = {}
    allowed = set(allowed_files or catalogs.keys())
    for filename, catalog in catalogs.items():
        if filename not in allowed:
            continue
        for product in catalog.get("products", []):
            if not isinstance(product, dict):
                continue
            name = normalize(product.get("name") or product.get("title"))
            brand = normalize(product.get("brand"))
            if name and brand:
                index.setdefault((name, brand), []).append((filename, product))
    return index

def apply_offer(index, name, brand, price, store, link, checked_at, source_label, variant=""):
    if not name or not brand or not store or not valid_https(link):
        return False
    try:
        price = float(price)
    except (TypeError, ValueError):
        return False
    if price <= 0 or price > 100_000_000:
        return False
    matches = index.get((normalize(name), normalize(brand)), [])
    if len(matches) != 1:
        return False

    filename, product = matches[0]
    offer = {
        "merchant": str(store).strip()[:120],
        "priceEGP": round(price, 2),
        "source": link,
        "sourceLabel": source_label,
        "checkedAt": checked_at,
        "variant": str(variant or "").strip()[:160]
    }
    offers = product.get("priceOffers")
    if not isinstance(offers, list):
        offers = []
    # Keep offers from other stores/providers; replace only the same exact listing URL.
    offers = [old for old in offers if not (
        isinstance(old, dict) and old.get("source") == link
    )]
    offers.append(offer)
    offers.sort(key=lambda row: float(row.get("priceEGP") or float("inf")))
    product["priceOffers"] = offers

    best = offers[0]
    if filename == "phones.json" or "priceEGP" in product:
        product["priceEGP"] = best["priceEGP"]
        product["priceSource"] = best.get("sourceLabel") or "مصدر سعر موثق"
        product["priceCheckedAt"] = best.get("checkedAt") or checked_at
    else:
        product["price"] = best["priceEGP"]
        product["merchant"] = best.get("merchant") or store
        product["source"] = best.get("source") or link
        product["checkedAt"] = best.get("checkedAt") or checked_at
    product["priceProvider"] = source_label
    product["priceStatus"] = "سعر مرصود من واجهة المصدر؛ تحقق من النسخة والتوفر عند الشراء"
    return True

def parse_observed_time(value):
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = datetime.strptime(raw, "%Y-%m-%d %H:%M Cairo").replace(tzinfo=ZoneInfo("Africa/Cairo"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)

def expire_stale_offers(catalogs, now=None, max_age_days=14):
    """Remove provider offers older than the provider's 14-day freshness window."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=max_age_days)
    expired_count = 0
    changed_count = 0
    provider_labels = {"Prices by PriceLens", "Sama Link API"}
    for filename, catalog in catalogs.items():
        for product in catalog.get("products", []):
            if not isinstance(product, dict) or not isinstance(product.get("priceOffers"), list):
                continue
            offers = product["priceOffers"]
            fresh = []
            for offer in offers:
                if not isinstance(offer, dict):
                    expired_count += 1
                    continue
                observed = parse_observed_time(offer.get("checkedAt"))
                if offer.get("sourceLabel") in provider_labels and observed and observed < cutoff:
                    expired_count += 1
                    continue
                fresh.append(offer)
            if len(fresh) == len(offers):
                continue
            changed_count += 1
            product["priceOffers"] = fresh
            fresh.sort(key=lambda row: float(row.get("priceEGP") or float("inf")))
            if fresh:
                best = fresh[0]
                product["priceProvider"] = best.get("sourceLabel") or ""
                if filename == "phones.json" or "priceEGP" in product:
                    product["priceEGP"] = best["priceEGP"]
                    product["priceSource"] = best.get("sourceLabel") or "مصدر سعر موثق"
                    product["priceCheckedAt"] = best.get("checkedAt") or ""
                else:
                    product["price"] = best["priceEGP"]
                    product["merchant"] = best.get("merchant") or ""
                    product["source"] = best.get("source") or ""
                    product["checkedAt"] = best.get("checkedAt") or ""
            elif product.get("priceProvider") in provider_labels:
                product.pop("priceEGP", None)
                product.pop("priceSource", None)
                product.pop("priceCheckedAt", None)
                product.pop("price", None)
                product.pop("merchant", None)
                product.pop("source", None)
                product.pop("checkedAt", None)
                product.pop("priceProvider", None)
                product["priceStatus"] = "لا يوجد عرض حديث مؤكد؛ السعر غير متاح حالياً"
    return expired_count, changed_count

def run_pricelens(source, catalogs, checked_at):
    secret_name = source.get("secret_env", "PRICELENS_API_KEY")
    key = os.environ.get(secret_name, "").strip()
    if not key:
        print(f"PENDING {source['id']}: missing GitHub secret {secret_name}")
        return 0
    endpoint = source.get("endpoint")
    if not valid_https(endpoint):
        raise ValueError("Invalid PriceLens endpoint")
    source_index = build_exact_index({name: catalog for name, catalog in catalogs.items() if name in source.get("coverage", [])})
    accepted = 0
    scanned = 0
    page_limit = 100
    # The API supports offset pagination. Keep a conservative per-run cap so
    # the updater respects plan-specific daily request limits.
    for page_number in range(3):
        query = urllib.parse.urlencode({
            "min_discount": 1, "basis": "any", "max_age_hours": 24,
            "limit": page_limit, "offset": page_number * page_limit
        })
        payload = get_json(endpoint + "?" + query, {"Authorization":"Bearer " + key})
        if not isinstance(payload, dict) or payload.get("currency") != "EGP":
            raise ValueError("PriceLens response currency is missing or is not EGP")
        deals = payload.get("deals")
        if not isinstance(deals, list):
            raise ValueError("PriceLens response has no deals array")
        scanned += len(deals)
        for deal in deals:
            if not isinstance(deal, dict) or deal.get("in_stock") is not True:
                continue
            product = deal.get("product") or {}
            # Use the provider's actual observation time, not the workflow run time.
            observed_at = deal.get("last_seen") or checked_at
            accepted += apply_offer(
                source_index, product.get("title_ar") or product.get("title"),
                product.get("brand"), deal.get("price"), deal.get("retailer"),
                deal.get("link"), observed_at, "Prices by PriceLens"
            )
        total = payload.get("total")
        if len(deals) < page_limit or (isinstance(total, int) and scanned >= total):
            break
    print(f"OK {source['id']}: matched {accepted} exact product/store offers from {scanned} deals")
    return accepted

def bilingual(value):
    if isinstance(value, dict):
        return value.get("ar") or value.get("en") or ""
    return value or ""

def run_sama_link(source, catalogs, checked_at):
    secret_name = source.get("secret_env", "SAMA_LINK_API_KEY")
    key = os.environ.get(secret_name, "").strip()
    if not key:
        print(f"PENDING {source['id']}: missing GitHub secret {secret_name}")
        return 0
    endpoint = source.get("endpoint")
    if not valid_https(endpoint):
        raise ValueError("Invalid Sama Link endpoint")

    source_index = build_exact_index({name: catalog for name, catalog in catalogs.items() if name in source.get("coverage", [])})
    headers = {"Authorization": "Bearer " + key}
    cursor = None
    accepted = 0
    pages = 0
    details_read = 0
    max_details = 180
    while pages < MAX_PAGES and details_read < max_details:
        params = {"limit": "100"}
        if cursor:
            params["cursor"] = cursor
        payload = get_json(endpoint.rstrip("/") + "?" + urllib.parse.urlencode(params), headers)
        rows = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            raise ValueError("Sama Link response has no data array")

        for listed in rows:
            if details_read >= max_details:
                break
            if not isinstance(listed, dict):
                continue
            product_id = listed.get("id") or listed.get("handle")
            if not product_id:
                continue

            # The supported API returns live variant pricing on the individual product record.
            detail_url = endpoint.rstrip("/") + "/" + urllib.parse.quote(str(product_id), safe="")
            detail_payload = get_json(detail_url, headers)
            details_read += 1
            item = detail_payload.get("data") if isinstance(detail_payload, dict) else None
            if not isinstance(item, dict):
                continue

            title = bilingual(item.get("title") or item.get("name") or listed.get("title") or listed.get("name"))
            brand = bilingual(item.get("brand") or listed.get("brand"))
            product_url = bilingual(item.get("url"))
            if not valid_https(product_url):
                continue

            for variant in item.get("variants") or []:
                if not isinstance(variant, dict):
                    continue
                availability = variant.get("availability") or {}
                if availability.get("purchasable_online") is not True:
                    continue
                price_obj = variant.get("price") or {}
                if price_obj.get("currency_code") != "EGP":
                    continue
                sku = variant.get("sku") or variant.get("id") or ""
                accepted += apply_offer(
                    source_index, title, brand, price_obj.get("amount"),
                    "Sama Link", product_url, checked_at,
                    "Sama Link API", str(sku)
                )

        page = payload.get("page") or {}
        cursor = page.get("next_cursor") if page.get("has_more") else None
        pages += 1
        if not cursor:
            break
    print(f"OK {source['id']}: matched {accepted} purchasable EGP offers from {details_read} product details across {pages} pages")
    return accepted

def main():
    if not CONFIG.exists():
        print("ERROR: price-feeds.json is missing", file=sys.stderr)
        return 1
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    sources = config.get("sources", [])
    if not isinstance(sources, list):
        print("ERROR: 'sources' must be a list", file=sys.stderr)
        return 1
    now = datetime.now(ZoneInfo("Africa/Cairo"))
    checked_at = now.strftime("%Y-%m-%d %H:%M Cairo")
    catalogs = load_catalogs()
    index = build_exact_index(catalogs)
    original_catalogs = {name: json.dumps(data, ensure_ascii=False, sort_keys=True) for name, data in catalogs.items()}
    changed = set()
    accepted_total = 0
    failures = 0
    active_count = 0
    for source in sources:
        if not isinstance(source, dict) or not source.get("active", False):
            continue
        active_count += 1
        source_id = str(source.get("id") or "unnamed")
        try:
            adapter = source.get("adapter")
            if adapter == "pricelens":
                accepted = run_pricelens(source, catalogs, checked_at)
            elif adapter == "sama_link":
                accepted = run_sama_link(source, catalogs, checked_at)
            else:
                raise ValueError("Unsupported or unapproved adapter")
            accepted_total += accepted
        except Exception as exc:
            failures += 1
            print(f"FAILED {source_id}: {str(exc)[:300]}", file=sys.stderr)
    expired_offers, products_cleaned = expire_stale_offers(catalogs)
    if expired_offers:
        print(f"FRESHNESS expired_offers={expired_offers} products_cleaned={products_cleaned}")
    changed = {name for name, data in catalogs.items() if json.dumps(data, ensure_ascii=False, sort_keys=True) != original_catalogs[name]}
    for filename in changed:
        catalogs[filename]["updatedAt"] = now.strftime("%Y-%m-%d")
        catalogs[filename]["lastAutomaticUpdate"] = checked_at
        (ROOT / filename).write_text(json.dumps(catalogs[filename], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pending = sum(1 for s in sources if isinstance(s, dict) and not s.get("active", False))
    print(f"SUMMARY accepted={accepted_total} updated_files={len(changed)} active_sources={active_count} pending_sources={pending} failures={failures}")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write("## MasrPrices price source update\n")
            summary.write(f"- Cairo time: {checked_at}\n- Accepted exact matches: {accepted_total}\n")
            summary.write(f"- Updated catalog files: {len(changed)}\n- Active sources: {active_count}\n- Pending sources: {pending}\n- Failed sources: {failures}\n")
    return 1 if failures else 0

if __name__ == "__main__":
    raise SystemExit(main())
