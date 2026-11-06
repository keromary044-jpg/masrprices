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
    provider_labels = {"Prices by PriceLens", "Sama Link API", "API.SH — Jumia Egypt"}
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
    # The API supports offset pagination. Ten calls is a bounded daily
    # budget; adjust max_pages in price-feeds.json to fit the provider plan.
    max_pages = source.get("max_pages", MAX_PAGES)
    if not isinstance(max_pages, int) or max_pages < 1:
        raise ValueError("PriceLens max_pages must be a positive integer")
    max_pages = min(max_pages, MAX_PAGES)
    for page_number in range(max_pages):
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

def run_apish_jumia(source, catalogs, checked_at):
    """Fetch bounded Egypt Jumia search results and accept exact, buyable EGP matches."""
    secret_name = source.get("secret_env", "APISH_API_KEY")
    key = os.environ.get(secret_name, "").strip()
    if not key:
        print(f"PENDING {source['id']}: missing GitHub secret {secret_name}")
        return 0

    coverage = source.get("coverage", [])
    source_catalogs = {name: catalog for name, catalog in catalogs.items() if name in coverage}
    source_index = build_exact_index(source_catalogs)
    candidates = []
    seen = set()
    for filename in sorted(source_catalogs):
        for product in source_catalogs[filename].get("products", []):
            if not isinstance(product, dict):
                continue
            name = str(product.get("name") or product.get("title") or "").strip()
            brand = str(product.get("brand") or "").strip()
            key_pair = (normalize(name), normalize(brand))
            if name and brand and key_pair in source_index and len(source_index[key_pair]) == 1 and key_pair not in seen:
                seen.add(key_pair)
                candidates.append((name, brand))

    if not candidates:
        print(f"OK {source['id']}: no eligible catalog products")
        return 0

    max_calls = source.get("max_calls_per_run", 20)
    if not isinstance(max_calls, int) or max_calls < 1:
        raise ValueError("API.SH max_calls_per_run must be a positive integer")
    max_calls = min(max_calls, 30)

    # Rotate deterministically through the catalog to stay within the free monthly allowance.
    day_number = datetime.now(timezone.utc).date().toordinal()
    start = (day_number * max_calls) % len(candidates)
    selected = [candidates[(start + offset) % len(candidates)] for offset in range(min(max_calls, len(candidates)))]

    accepted = scanned = 0
    endpoint = source.get("endpoint", "https://api.api.sh/jumia/v1/search")
    if not valid_https(endpoint):
        raise ValueError("Invalid API.SH endpoint")
    headers = {"x-api-key": key}
    for name, brand in selected:
        params = urllib.parse.urlencode({
            "q": name, "country": "eg", "sort": "lowest-price", "page": 1
        })
        payload = get_json(endpoint + "?" + params, headers)
        if not isinstance(payload, dict) or payload.get("success") is False:
            raise ValueError("API.SH returned an unsuccessful Jumia response")
        if payload.get("country") not in (None, "eg", "EG"):
            raise ValueError("API.SH response is not for the Egypt storefront")
        products = payload.get("products")
        if not isinstance(products, list):
            raise ValueError("API.SH Jumia response has no products array")
        scanned += len(products)
        for item in products:
            if not isinstance(item, dict) or item.get("buyable") is not True:
                continue
            product_url = item.get("url")
            if not valid_https(product_url):
                continue
            host = urllib.parse.urlparse(product_url).hostname or ""
            if host.lower() not in ("www.jumia.com.eg", "jumia.com.eg"):
                continue
            # API.SH's country=eg storefront returns Egypt-local prices (EGP).
            accepted += apply_offer(
                source_index, item.get("name"), item.get("brand"),
                item.get("price"), "Jumia Egypt", product_url,
                payload.get("fetched_at") or checked_at, "API.SH — Jumia Egypt"
            )
    print(f"OK {source['id']}: matched {accepted} exact buyable Jumia Egypt offers from {scanned} results; searched {len(selected)} catalog products")
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


def run_open_prices(source, catalogs, checked_at):
    """Import Egypt/EGP community observations separately from retail offers."""
    endpoint = source.get("endpoint", "https://prices.openfoodfacts.org/api/v1").rstrip("/")
    if not valid_https(endpoint):
        raise ValueError("Invalid Open Prices endpoint")
    source_index = build_exact_index({
        name: catalog for name, catalog in catalogs.items()
        if name in source.get("coverage", ["groceries.json"])
    })
    accepted = scanned = 0
    max_pages = min(max(int(source.get("max_price_pages", 10)), 1), 10)
    max_age_days = min(max(int(source.get("observation_max_age_days", 30)), 1), 365)
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    for page_number in range(1, max_pages + 1):
        params = {
            "proof__location__osm_address_country_code": "eg",
            "currency": "EGP", "type": "PRODUCT", "size": 100,
            "page": page_number, "order_by": "-date"
        }
        payload = get_json(endpoint + "/prices?" + urllib.parse.urlencode(params))
        rows = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            raise ValueError("Open Prices prices response has no items array")
        scanned += len(rows)
        for row in rows:
            if not isinstance(row, dict) or row.get("currency") != "EGP" or row.get("type") != "PRODUCT":
                continue
            try:
                price = float(row.get("price"))
            except (TypeError, ValueError):
                continue
            if price <= 0 or price > 100_000_000 or row.get("price_per") not in (None, "", "UNIT"):
                continue
            observed_date = row.get("date")
            observed_at = parse_observed_time(observed_date)
            if not observed_at or observed_at < cutoff:
                continue
            product = row.get("product") or {}
            location = row.get("location") or {}
            country_code = str(location.get("osm_address_country_code") or "").upper()
            if country_code and country_code != "EG":
                continue
            name = row.get("product_name") or product.get("product_name")
            brand = product.get("brands") or product.get("brand")
            merchant = location.get("osm_name") or location.get("osm_display_name")
            if not name or not brand or not merchant:
                continue
            matches = source_index.get((normalize(name), normalize(brand)), [])
            if len(matches) != 1:
                continue
            _, catalog_product = matches[0]
            record_id = row.get("id")
            if not record_id:
                continue
            observation = {
                "id": int(record_id), "priceEGP": round(price, 2),
                "merchant": str(merchant).strip()[:120], "observedDate": observed_date,
                "source": endpoint + "/prices/" + str(int(record_id)),
                "sourceLabel": "Open Prices — رصد مجتمعي",
                "pricePer": row.get("price_per") or "UNIT",
                "productCode": product.get("code") or row.get("product_code") or ""
            }
            observations = catalog_product.get("communityPriceObservations")
            if not isinstance(observations, list):
                observations = []
            observations = [old for old in observations if not isinstance(old, dict) or old.get("id") != observation["id"]]
            observations.append(observation)
            observations.sort(key=lambda item: str(item.get("observedDate") or ""), reverse=True)
            catalog_product["communityPriceObservations"] = observations[:20]
            accepted += 1
        pages = payload.get("pages", page_number)
        if page_number >= pages or not rows:
            break
    print(f"OK {source.get('id', 'open-prices')}: stored {accepted} recent Egypt/EGP community observations from {scanned} price records; primary retail prices were not changed")
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
            elif adapter == "apish_jumia":
                accepted = run_apish_jumia(source, catalogs, checked_at)
            elif adapter == "open_prices":
                accepted = run_open_prices(source, catalogs, checked_at)
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
