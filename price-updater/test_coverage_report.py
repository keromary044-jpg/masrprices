import json
import tempfile
import unittest
from pathlib import Path
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

if __name__ == "__main__":
    unittest.main()
