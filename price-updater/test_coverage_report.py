import unittest
from datetime import datetime, timezone

from coverage_report import has_price, freshness_status, is_duplicate_detail_product


class CoverageReportTests(unittest.TestCase):
    def test_positive_price_fields(self):
        self.assertTrue(has_price({"priceEGP": 120}))
        self.assertTrue(has_price({"price": "1,250"}))
        self.assertTrue(has_price({"priceOffers": [{"priceEGP": 99}]}))

    def test_zero_or_missing_price_is_unpriced(self):
        self.assertFalse(has_price({}))
        self.assertFalse(has_price({"priceEGP": 0}))
        self.assertFalse(has_price({"price": "غير متاح"}))

    def test_price_from_and_price_to_ranges_count(self):
        self.assertTrue(has_price({"priceFrom": 125, "priceTo": 150}))
        self.assertTrue(has_price({"priceTo": 150}))

    def test_min_max_and_starting_price_ranges_count(self):
        self.assertTrue(has_price({"priceMin": 125, "priceMax": 150}))
        self.assertTrue(has_price({"startingPrice": 125}))

    def test_empty_or_zero_ranges_do_not_count(self):
        self.assertFalse(has_price({"priceFrom": 0, "priceTo": None}))
        self.assertFalse(has_price({"priceMin": "غير متاح", "priceMax": ""}))

    def test_detail_product_is_deduplicated_by_catalog_id(self):
        primary = {"phones.json": [{"id": "samsung-a07", "name": "Samsung Galaxy A07"}]}
        detail = {"slug": "samsung-a07", "name": "Samsung Galaxy A07", "category": "الموبايلات (9)"}
        self.assertTrue(is_duplicate_detail_product(detail, primary))

    def test_detail_product_is_deduplicated_by_exact_name(self):
        primary = {"books.json": [{"id": "book-1", "name": "كتاب تجريبي", "brand": ""}]}
        detail = {"slug": "book-detail", "name": "كتاب تجريبي", "category": "الكتب (90)"}
        self.assertTrue(is_duplicate_detail_product(detail, primary))

    def test_detail_only_product_is_retained(self):
        primary = {"tools.json": [{"id": "other-tool", "name": "مطرقة"}]}
        detail = {"slug": "tool-hacksaw-apt", "name": "منشار حديد يدوي APT مقاس 12 بوصة", "category": "الأدوات (21)"}
        self.assertFalse(is_duplicate_detail_product(detail, primary))

    def test_detail_date_is_used_only_for_unmatched_detail_products(self):
        now = datetime(2026, 11, 17, 0, 0, tzinfo=timezone.utc)
        product = {"price": 305, "date": "2026-11-15"}
        self.assertEqual(freshness_status(product, now=now, allow_generic_date=True), "fresh")
        self.assertEqual(freshness_status(product, now=now, allow_generic_date=False), "unknown")


if __name__ == "__main__":
    unittest.main()
