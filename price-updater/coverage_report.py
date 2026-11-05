#!/usr/bin/env python3
"""Build a complete inventory of product price coverage across catalog JSON files."""
import json
from datetime import datetime, timedelta, timezone
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

def freshness_status(product, now=None, max_age_days=14):
    """Classify the displayed lowest offer by its own observation timestamp."""
    now = now or datetime.now(timezone.utc)
    offers = product.get("priceOffers")
    if isinstance(offers, list):
        candidates = []
        for offer in offers:
            if not isinstance(offer, dict):
                continue
            value = offer.get("priceEGP") or offer.get("price_egp") or offer.get("price")
            if not positive_price(value):
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
    if not has_price(product):
        return "missing"
    for key in ("priceCheckedAt", "checkedAt", "price_updated_at"):
        observed = parse_observed_time(product.get(key))
        if observed:
            return "fresh" if observed >= now - timedelta(days=max_age_days) else "stale"
    return "unknown"

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
        fresh = 0
        stale = 0
        unknown = 0
        for item in products:
            if not isinstance(item, dict):
                continue
            if has_price(item):
                priced += 1
                status = freshness_status(item)
                if status == "fresh":
                    fresh += 1
                elif status == "stale":
                    stale += 1
                else:
                    unknown += 1
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
        "definition": "A product counts as priced only when a positive numeric price or positive offer price exists. Freshness is measured from the lowest offer timestamp; fresh means no older than 14 days.",
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
