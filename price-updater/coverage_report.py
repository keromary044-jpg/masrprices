#!/usr/bin/env python3
"""Build a complete inventory of product price coverage across catalog JSON files."""
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "price-coverage-report.json"
SKIP = {"price-feeds.json", "price-coverage-report.json", "phone-model-index.json", "seo-products.json"}

def positive_price(value):
    if isinstance(value, dict):
        value = value.get("amount") or value.get("value")
    try:
        number = float(str(value).replace(",", "").replace("جنيه", "").replace("EGP", "").strip())
        return number > 0
    except (TypeError, ValueError):
        return False

def has_price(product):
    for key in ("priceEGP", "price", "price_egp", "lowestPrice", "lowest_price"):
        if positive_price(product.get(key)):
            return True
    offers = product.get("priceOffers")
    return isinstance(offers, list) and any(
        isinstance(offer, dict) and positive_price(offer.get("priceEGP") or offer.get("price_egp") or offer.get("price"))
        for offer in offers
    )

def build_report():
    categories = []
    missing = []
    for path in sorted(ROOT.glob("*.json")):
        if path.name in SKIP:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        products = data.get("products") if isinstance(data, dict) else None
        if not isinstance(products, list):
            continue
        priced = 0
        for item in products:
            if not isinstance(item, dict):
                continue
            if has_price(item):
                priced += 1
            else:
                missing.append({
                    "catalog": path.name,
                    "id": str(item.get("id") or item.get("productId") or item.get("sku") or ""),
                    "name": str(item.get("name") or item.get("title") or ""),
                    "brand": str(item.get("brand") or ""),
                    "model": str(item.get("model") or ""),
                    "sku": str(item.get("sku") or ""),
                })
        total = sum(1 for item in products if isinstance(item, dict))
        categories.append({
            "catalog": path.name,
            "total": total,
            "with_price": priced,
            "without_price": total - priced,
            "coverage_percent": round(priced * 100 / total, 2) if total else 0,
        })
    total_products = sum(row["total"] for row in categories)
    total_priced = sum(row["with_price"] for row in categories)
    now = datetime.now(ZoneInfo("Africa/Cairo")).strftime("%Y-%m-%d %H:%M Cairo")
    return {
        "generated_at": now,
        "currency": "EGP",
        "definition": "A product counts as priced only when a positive numeric price or positive offer price exists; this does not certify that the price is current.",
        "totals": {
            "products": total_products,
            "with_price": total_priced,
            "without_price": total_products - total_priced,
            "coverage_percent": round(total_priced * 100 / total_products, 2) if total_products else 0,
        },
        "categories": categories,
        "missing_products": missing,
    }

if __name__ == "__main__":
    report = build_report()
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("PRICE_COVERAGE " + json.dumps(report["totals"], ensure_ascii=False))
    print("COVERAGE_CATALOGS " + str(len(report["categories"])))
