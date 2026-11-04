import unittest
from github_actions_updater import normalize, apply_offer

class PriceUpdaterTests(unittest.TestCase):
    def setUp(self):
        self.product = {"id":"p1","name":"سامسونج جالاكسي A56","brand":"Samsung","price":100}
        self.index = {(normalize(self.product["name"]), normalize(self.product["brand"])):[("phones.json",self.product)]}

    def test_arabic_normalization(self):
        self.assertEqual(normalize("أَبْجَدِيَّة"), normalize("ابجديه"))

    def test_exact_unique_match_updates_price(self):
        ok = apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1234, "Store", "https://store.example/item", "2026-11-04 05:00 Cairo", "Test")
        self.assertTrue(ok)
        self.assertEqual(self.product["priceEGP"], 1234)

    def test_partial_name_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج A56", "Samsung", 1234, "Store", "https://store.example/item", "now", "Test"))

    def test_unknown_brand_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Other", 1234, "Store", "https://store.example/item", "now", "Test"))

    def test_invalid_price_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", -1, "Store", "https://store.example/item", "now", "Test"))

    def test_non_https_link_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1234, "Store", "http://store.example/item", "now", "Test"))

    def test_ambiguous_match_is_rejected(self):
        self.index[(normalize(self.product["name"]), normalize(self.product["brand"]))].append(("electronics.json", {"name":self.product["name"],"brand":"Samsung"}))
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1234, "Store", "https://store.example/item", "now", "Test"))

if __name__ == "__main__":
    unittest.main()
