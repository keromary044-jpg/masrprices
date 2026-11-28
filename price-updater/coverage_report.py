#!/usr/bin/env python3
"""Build a complete inventory of product price coverage across catalog JSON files."""
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "price-coverage-report.json"
SKIP = {"price-feeds.json", "price-coverage-report.json", "phone-model-index.json", "seo-products.json"}


DETAIL_CATEGORY_MAP = {
    "الموبايلات": "phones.json",
    "الإلكترونيات والملحقات": "electronics.json",
    "الأجهزة المنزلية": "appliances.json",
    "الكتب": "books.json",
    "السيارات": "cars.json",
    "الطعام والبقالة": "groceries.json",
    "الأدوات": "tools.json",
    "مستلزمات الأطفال": "baby-products.json",
    "الملابس": "clothing.json",
    "الأثاث": "furniture.json",
    "العناية الشخصية": "personal-care.json",
    "الرياضة": "sports.json",
    "الزراعة والنباتات": "plants.json",
    "خدمات الاتصالات": "telecom.json",
}

def normalize_label(value):
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).casefold().split())

def is_duplicate_detail_product(product, primary_catalogs):
    """Avoid counting product-detail mirrors twice while retaining unmatched detail-only items."""
    category = re.sub(r"\s*\(\d+\)\s*$", "", str(product.get("category") or "")).strip()
    catalog_name = DETAIL_CATEGORY_MAP.get(category)
    if not catalog_name:
        return False
    slug = str(product.get("slug") or product.get("id") or "").strip()
    name = normalize_label(product.get("name") or product.get("title"))
    brand = normalize_label(product.get("brand"))
    for candidate in primary_catalogs.get(catalog_name, []):
        candidate_ids = {
            str(candidate.get(key) or "").strip()
            for key in ("id", "slug", "productId", "product_id", "sku")
        }
        if slug and slug in candidate_ids:
            return True
        candidate_name = normalize_label(candidate.get("name") or candidate.get("title"))
        candidate_brand = normalize_label(candidate.get("brand"))
        if name and name == candidate_name and (not brand or not candidate_brand or brand == candidate_brand):
            return True
    return False

def positive_price(value):
    if isinstance(value, dict):
        value = value.get("amount") or value.get("value")
    try:
        number = float(str(value).replace(",", "").replace("جنيه", "").replace("EGP", "").strip())
        return number > 0
    except (TypeError, ValueError):
        return False

def has_price(product):
    for key in ("priceEGP", "price", "price_egp", "lowestPrice", "lowest_price", "priceFrom", "priceTo", "priceMin", "priceMax", "minPrice", "maxPrice", "startingPrice"):
        if positive_price(product.get(key)):
            return True
    offers = product.get("priceOffers")
    return isinstance(offers, list) and any(
        isinstance(offer, dict) and positive_price(offer.get("priceEGP") or offer.get("price_egp") or offer.get("price"))
        for offer in offers
    )

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
            try:
                parsed = datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=ZoneInfo("Africa/Cairo"))
            except ValueError:
                return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo("Africa/Cairo"))
    return parsed.astimezone(timezone.utc)

def is_non_buyable_availability(value):
    """True when a recorded offer is explicitly unavailable or needs stock confirmation."""
    normalized = normalize_label(value).replace("-", "_").replace(" ", "_")
    blocked = {
        "out_of_stock", "sold_out", "unavailable", "not_available",
        "check_store", "needs_confirmation", "pending", "not_buyable",
    }
    return normalized in blocked or any(
        term in normalized for term in ("غير متوفر", "غير متاح", "نفد المخزون")
    )


def is_non_buyable_offer(offer, fallback_availability=None):
    availability = offer.get("availability") or fallback_availability
    return (
        is_non_buyable_availability(availability)
        or is_non_buyable_availability(offer.get("condition"))
    )


def freshness_status(product, now=None, max_age_days=14, allow_generic_date=False):
    """Classify freshness using the lowest offer not explicitly marked unavailable."""
    now = now or datetime.now(timezone.utc)
    offers = product.get("priceOffers")
    if isinstance(offers, list):
        candidates = []
        positive_offer_count = 0
        for offer in offers:
            if not isinstance(offer, dict):
                continue
            value = offer.get("priceEGP") or offer.get("price_egp") or offer.get("price")
            if not positive_price(value):
                continue
            positive_offer_count += 1
            if is_non_buyable_offer(offer, product.get("priceAvailability")):
                continue
            try:
                amount = float(str(value).replace(",", "").replace("جنيه", "").replace("EGP", "").strip())
            except (TypeError, ValueError):
                continue
            observed = parse_observed_time(offer.get("checkedAt") or offer.get("observedAt") or offer.get("last_seen"))
            candidates.append((amount, observed))
        if candidates:
            lowest = min(amount for amount, _ in candidates)
            best_dates = [observed for amount, observed in candidates if amount == lowest and observed]
            if not best_dates:
                return "unknown"
            return "fresh" if max(best_dates) >= now - timedelta(days=max_age_days) else "stale"
        if positive_offer_count:
            # Keep the positive price in total coverage, but never call an unavailable
            # or unconfirmed offer fresh.
            return "stale"
    if not has_price(product):
        return "missing"
    if is_non_buyable_availability(product.get("priceAvailability")):
        return "stale"
    for key in (("priceCheckedAt", "checkedAt", "price_updated_at", "date") if allow_generic_date else ("priceCheckedAt", "checkedAt", "price_updated_at")):
        observed = parse_observed_time(product.get(key))
        if observed:
            return "fresh" if observed >= now - timedelta(days=max_age_days) else "stale"
    return "unknown"

def build_report():
    catalog_data = {}
    for path in sorted(ROOT.glob("*.json")):
        if path.name in SKIP:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(data, list):
            products = data
        elif isinstance(data, dict):
            products = data.get("products")
        else:
            products = None
        if isinstance(products, list):
            catalog_data[path.name] = [item for item in products if isinstance(item, dict)]

    primary_catalogs = {
        filename: products
        for filename, products in catalog_data.items()
        if filename != "products-data.json"
    }
    if "products-data.json" in catalog_data:
        catalog_data["products-data.json"] = [
            item for item in catalog_data["products-data.json"]
            if not is_duplicate_detail_product(item, primary_catalogs)
        ]

    categories = []
    missing = []
    for filename, products in sorted(catalog_data.items()):
        priced = 0
        fresh = 0
        stale = 0
        unknown = 0
        for item in products:
            if has_price(item):
                priced += 1
                status = freshness_status(item, allow_generic_date=filename == "products-data.json")
                if status == "fresh":
                    fresh += 1
                elif status == "stale":
                    stale += 1
                else:
                    unknown += 1
            else:
                missing.append({
                    "catalog": filename,
                    "id": str(item.get("id") or item.get("productId") or item.get("sku") or item.get("slug") or ""),
                    "name": str(item.get("name") or item.get("title") or ""),
                    "brand": str(item.get("brand") or ""),
                    "model": str(item.get("model") or ""),
                    "sku": str(item.get("sku") or ""),
                })
        total = len(products)
        categories.append({
            "catalog": filename,
            "total": total,
            "with_price": priced,
            "without_price": total - priced,
            "fresh_with_price": fresh,
            "stale_with_price": stale,
            "unknown_freshness": unknown,
            "freshness_percent_of_priced": round(fresh * 100 / priced, 2) if priced else 0,
            "fresh_coverage_percent": round(fresh * 100 / total, 2) if total else 0,
            "coverage_percent": round(priced * 100 / total, 2) if total else 0,
        })
    total_products = sum(row["total"] for row in categories)
    total_priced = sum(row["with_price"] for row in categories)
    total_fresh = sum(row["fresh_with_price"] for row in categories)
    total_stale = sum(row["stale_with_price"] for row in categories)
    total_unknown = sum(row["unknown_freshness"] for row in categories)
    now = datetime.now(ZoneInfo("Africa/Cairo")).strftime("%Y-%m-%d %H:%M Cairo")
    return {
        "generated_at": now,
        "currency": "EGP",
        "definition": "A product counts once across its category catalog and product-detail mirror. Freshness uses the lowest offer not explicitly marked unavailable or awaiting stock confirmation; unmatched detail-only products use their explicit date field. Positive out-of-stock prices remain in total price coverage but are never classified as fresh. Fresh means no older than 14 days.",
        "totals": {
            "products": total_products,
            "with_price": total_priced,
            "without_price": total_products - total_priced,
            "fresh_with_price": total_fresh,
            "stale_with_price": total_stale,
            "unknown_freshness": total_unknown,
            "freshness_percent_of_priced": round(total_fresh * 100 / total_priced, 2) if total_priced else 0,
            "fresh_coverage_percent": round(total_fresh * 100 / total_products, 2) if total_products else 0,
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
