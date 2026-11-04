#!/usr/bin/env python3
"""Update MasrPrices only from authorized, authenticated provider APIs."""
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "price-feeds.json"
ALLOWED_CATALOGS = {
    "phones.json", "books.json", "construction.json", "cars.json",
    "appliances.json", "groceries.json", "stationery.json", "clothing.json",
    "furniture.json", "personal-care.json", "sports.json", "electrical.json",
    "tools.json", "pets.json", "plants.json", "telecom.json", "travel.json",
    "stocks.json", "electronics.json", "spare-parts.json", "services.json",
    "baby-products.json"
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
    for filename in sorted(ALLOWED_CATALOGS):
        path = ROOT / filename
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data.get("products"), list):
                catalogs[filename] = data
        except (OSError, ValueError):
            continue
    return catalogs

def build_exact_index(catalogs):
    index = {}
    for filename, catalog in catalogs.items():
        for product in catalog.get("products", []):
            if not isinstance(product, dict):
                continue
            name = normalize(product.get("name") or product.get("title"))
            brand = normalize(product.get("brand"))
            if name and brand:
                index.setdefault((name, brand), []).append((filename, product))
    return index

def apply_offer(index, name, brand, price, store, link, checked_at, source_label):
    if not name or not brand or not valid_https(link):
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
    if filename == "phones.json" or "priceEGP" in product:
        product["priceEGP"] = round(price, 2)
        product["priceSource"] = source_label
        product["priceCheckedAt"] = checked_at
        product["priceStatus"] = "سعر مرصود من واجهة المصدر؛ تحقق من النسخة والتوفر عند الشراء"
        product["priceOffers"] = [{
            "merchant": store, "priceEGP": round(price, 2),
            "source": link, "sourceLabel": source_label, "checkedAt": checked_at
        }]
    else:
        product["price"] = round(price, 2)
        product["merchant"] = store
        product["source"] = link
        product["checkedAt"] = checked_at
        product["priceStatus"] = "سعر مرصود من واجهة المصدر؛ تحقق من التوفر عند الشراء"
    return True

def run_pricelens(source, index, checked_at):
    secret_name = source.get("secret_env", "PRICELENS_API_KEY")
    key = os.environ.get(secret_name, "").strip()
    if not key:
        print(f"PENDING {source['id']}: missing GitHub secret {secret_name}")
        return 0
    endpoint = source.get("endpoint")
    if not valid_https(endpoint):
        raise ValueError("Invalid PriceLens endpoint")
    query = urllib.parse.urlencode({"min_discount":1,"basis":"any","max_age_hours":24,"limit":100})
    payload = get_json(endpoint + "?" + query, {"Authorization":"Bearer " + key})
    deals = payload.get("deals") if isinstance(payload, dict) else None
    if not isinstance(deals, list):
        raise ValueError("PriceLens response has no deals array")
    accepted = 0
    for deal in deals:
        if not isinstance(deal, dict) or deal.get("in_stock") is not True:
            continue
        product = deal.get("product") or {}
        accepted += apply_offer(
            index, product.get("title_ar") or product.get("title"),
            product.get("brand"), deal.get("price"), deal.get("retailer"),
            deal.get("link"), checked_at, "PriceLens"
        )
    print(f"OK {source['id']}: matched {accepted} exact product/store offers from {len(deals)} deals")
    return accepted

def bilingual(value):
    if isinstance(value, dict):
        return value.get("ar") or value.get("en") or ""
    return value or ""

def run_sama_link(source, index, checked_at):
    secret_name = source.get("secret_env", "SAMA_LINK_API_KEY")
    key = os.environ.get(secret_name, "").strip()
    if not key:
        print(f"PENDING {source['id']}: missing GitHub secret {secret_name}")
        return 0
    endpoint = source.get("endpoint")
    if not valid_https(endpoint):
        raise ValueError("Invalid Sama Link endpoint")
    cursor = None
    accepted = 0
    pages = 0
    while pages < MAX_PAGES:
        params = {"limit":"100"}
        if cursor:
            params["cursor"] = cursor
        url = endpoint + "?" + urllib.parse.urlencode(params)
        payload = get_json(url, {"Authorization":"Bearer " + key})
        rows = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            raise ValueError("Sama Link response has no data array")
        for item in rows:
            if not isinstance(item, dict):
                continue
            title = bilingual(item.get("title") or item.get("name"))
            brand = bilingual(item.get("brand"))
            variants = item.get("variants") or []
            for variant in variants:
                if not isinstance(variant, dict):
                    continue
                availability = variant.get("availability") or {}
                if availability.get("purchasable_online") is not True:
                    continue
                price_obj = variant.get("price") or {}
                price = price_obj.get("amount")
                product_url = bilingual(item.get("url"))
                if not valid_https(product_url):
                    continue
                accepted += apply_offer(index, title, brand, price, "Sama Link", product_url, checked_at, "Sama Link API")
        page = payload.get("page") or {}
        cursor = page.get("next_cursor") if page.get("has_more") else None
        pages += 1
        if not cursor:
            break
    print(f"OK {source['id']}: matched {accepted} exact product/store offers across {pages} pages")
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
                accepted = run_pricelens(source, index, checked_at)
            elif adapter == "sama_link":
                accepted = run_sama_link(source, index, checked_at)
            else:
                raise ValueError("Unsupported or unapproved adapter")
            accepted_total += accepted
        except Exception as exc:
            failures += 1
            print(f"FAILED {source_id}: {str(exc)[:300]}", file=sys.stderr)
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
