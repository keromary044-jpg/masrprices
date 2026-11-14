import unittest

from coverage_report import has_price


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


if __name__ == "__main__":
    unittest.main()
