#!/usr/bin/env python3
"""Fetch authorized JSON price feeds and update MasrPrices catalog JSON files."""
import json
import os
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "price-feeds.json"
ALLOWED_CATALOGS = {
    "phones.json", "books.json", "construction.json", "cars.json",
    "appliances.json", "groceries.json", "stationery.json", "clothing.json",
    "furniture.json", "personal-care.json", "sports.json", "electrical.json",
    "tools.json", "pets.json", "plants.json", "telecom.json", "travel.json",
    "stocks.json", "electronics.json", "spare-parts.json", "services.json",
    "medicines.json", "fuel.json", "baby-products.json"
}
MAX_BYTES = 5_000_000

def fail(message):
    print("ERROR: " + message, file=sys.stderr)
    return False

def get_json(url):
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "MasrPrices-GitHub-Updater/1.0"}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        final_url = response.geturl()
        if not final_url.startswith("https://"):
            raise ValueError("Feed redirected away from HTTPS")
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Feed exceeds 5 MB")
    return json.loads(raw.decode("utf-8"))

def valid_https(value):
    return isinstance(value, str) and value.startswith("https://") and len(value) < 1000

def main():
    if not CONFIG.exists():
        return 1 if fail("price-feeds.json is missing") else 0
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    feeds = config.get("sources", [])
    if not isinstance(feeds, list):
        return 1 if fail("'sources' must be a list") else 0
    if not feeds:
        print("No active authorized feeds configured. No catalog prices were changed.")
        return 0

    now = datetime.now(ZoneInfo("Africa/Cairo"))
    checked_at = now.strftime("%Y-%m-%d %H:%M Cairo")
    changed_files = {}
    accepted_total = 0
    failures = 0

    for source in feeds:
        if not isinstance(source, dict) or not source.get("active", True):
            continue
        name = str(source.get("name") or source.get("id") or "Unnamed source")
        catalog_file = source.get("catalog_file")
        feed_url = source.get("feed_url")
        if catalog_file not in ALLOWED_CATALOGS or not valid_https(feed_url):
            print(f"SKIP {name}: invalid catalog_file or non-HTTPS feed_url")
            failures += 1
            continue
        try:
            feed = get_json(feed_url)
            items = feed.get("items") if isinstance(feed, dict) else None
            if not isinstance(items, list) or not items or len(items) > 10000:
                raise ValueError("Feed must contain 1..10000 items")
            path = ROOT / catalog_file
            catalog = changed_files.get(catalog_file)
            if catalog is None:
                catalog = json.loads(path.read_text(encoding="utf-8"))
            products = catalog.get("products")
            if not isinstance(products, list):
                raise ValueError(f"{catalog_file} has no products array")
            by_id = {str(p.get("id")): p for p in products if isinstance(p, dict) and p.get("id")}
            accepted = 0
            for item in items:
                if not isinstance(item, dict):
                    continue
                product_id = str(item.get("product_id") or "").strip()
                try:
                    price = float(item.get("price_egp"))
                except (TypeError, ValueError):
                    continue
                product_url = item.get("product_url")
                store = str(item.get("store_name") or "").strip()
                source_label = str(item.get("source_name") or name).strip()
                if (not product_id or product_id not in by_id or price <= 0 or price > 100000000
                    or not valid_https(product_url) or not store or not source_label):
                    continue
                product = by_id[product_id]
                if "priceEGP" in product or catalog_file == "phones.json":
                    product["priceEGP"] = round(price, 2)
                    product["priceSource"] = source_label
                    product["priceCheckedAt"] = checked_at
                    product["priceStatus"] = "سعر مرصود آليًا من تغذية المصدر؛ تحقق من التوفر والنسخة"
                    product["priceOffers"] = [{
                        "merchant": store, "priceEGP": round(price, 2),
                        "variant": str(item.get("variant") or ""),
                        "source": product_url, "sourceLabel": source_label,
                        "checkedAt": checked_at
                    }]
                else:
                    product["price"] = round(price, 2)
                    product["merchant"] = store
                    product["source"] = product_url
                    product["checkedAt"] = checked_at
                    product["priceStatus"] = "سعر مرصود آليًا من تغذية المصدر؛ تحقق من التوفر"
                if item.get("region"):
                    product["region"] = str(item["region"])[:100]
                if item.get("unit"):
                    product["unit"] = str(item["unit"])[:100]
                accepted += 1
            if accepted == 0:
                raise ValueError("No feed item matched a catalog product ID")
            catalog["updatedAt"] = now.strftime("%Y-%m-%d")
            catalog["lastAutomaticUpdate"] = checked_at
            changed_files[catalog_file] = catalog
            accepted_total += accepted
            print(f"OK {name}: accepted {accepted} items into {catalog_file}")
        except Exception as exc:
            failures += 1
            print(f"FAILED {name}: {str(exc)[:300]}", file=sys.stderr)

    for filename, data in changed_files.items():
        (ROOT / filename).write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\\n",
            encoding="utf-8"
        )
    print(f"SUMMARY accepted={accepted_total} updated_files={len(changed_files)} failures={failures}")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write("## MasrPrices automatic price update\\n")
            summary.write(f"- Cairo time: {checked_at}\\n- Accepted records: {accepted_total}\\n")
            summary.write(f"- Updated files: {len(changed_files)}\\n- Failed feeds: {failures}\\n")
    return 1 if failures else 0

if __name__ == "__main__":
    raise SystemExit(main())
