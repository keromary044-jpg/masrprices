import os
import unittest
from unittest.mock import patch
from github_actions_updater import normalize, apply_offer, run_pricelens, run_open_prices, expire_stale_offers
from coverage_report import freshness_status

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


    def test_multiple_store_offers_are_preserved_and_cheapest_selected(self):
        first = apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1500, "Store A", "https://a.example/item", "now", "Provider A")
        second = apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1300, "Store B", "https://b.example/item", "now", "Provider B")
        self.assertTrue(first)
        self.assertTrue(second)
        self.assertEqual(self.product["priceEGP"], 1300)
        self.assertEqual(len(self.product["priceOffers"]), 2)
        self.assertEqual(self.product["priceOffers"][0]["merchant"], "Store B")

    def test_same_listing_refresh_does_not_duplicate_offer(self):
        apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1500, "Store A", "https://a.example/item", "day 1", "Provider A")
        apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1400, "Store A", "https://a.example/item", "day 2", "Provider A")
        self.assertEqual(len(self.product["priceOffers"]), 1)
        self.assertEqual(self.product["priceEGP"], 1400)

    def test_partial_name_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج A56", "Samsung", 1234, "Store", "https://store.example/item", "now", "Test"))

    def test_unknown_brand_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Other", 1234, "Store", "https://store.example/item", "now", "Test"))

    def test_invalid_price_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", -1, "Store", "https://store.example/item", "now", "Test"))

    def test_non_https_link_is_rejected(self):
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1234, "Store", "http://store.example/item", "now", "Test"))


    @patch.dict(os.environ, {"PRICELENS_API_KEY": "test-key"})
    @patch("github_actions_updater.get_json")
    def test_pricelens_reads_multiple_pages_and_accepts_only_in_stock_exact_matches(self, mocked_get):
        product = {"id":"p2","name":"سامسونج جالاكسي A56","brand":"Samsung"}
        catalogs = {"phones.json":{"products":[product]}}
        first_page = {
            "currency":"EGP", "total":101,
            "deals":[{"in_stock":False} for _ in range(100)]
        }
        second_page = {
            "currency":"EGP", "total":101,
            "deals":[{
                "in_stock":True,
                "product":{"title_ar":"سامسونج جالاكسي A56","brand":"Samsung"},
                "price":1234,
                "retailer":"Store",
                "link":"https://store.example/item",
                "last_seen":"2026-11-05T10:00:00Z"
            }]
        }
        mocked_get.side_effect = [first_page, second_page]
        source = {
            "id":"pricelens-test",
            "endpoint":"https://pricelens.store/api/v1/partner/deals",
            "coverage":["phones.json"]
        }
        accepted = run_pricelens(source, catalogs, "fallback-time")
        self.assertEqual(accepted, 1)
        self.assertEqual(len(product["priceOffers"]), 1)
        self.assertEqual(product["priceOffers"][0]["checkedAt"], "2026-11-05T10:00:00Z")
        self.assertIn("offset=100", mocked_get.call_args_list[1].args[0])

    @patch.dict(os.environ, {"PRICELENS_API_KEY": "test-key"})
    @patch("github_actions_updater.get_json")
    def test_pricelens_pagination_is_bounded_by_provider_config_and_global_cap(self, mocked_get):
        mocked_get.side_effect = [
            {"currency":"EGP","total":10000,"deals":[{"in_stock":False} for _ in range(100)]}
            for _ in range(10)
        ]
        source = {
            "id":"pricelens-cap-test",
            "endpoint":"https://pricelens.store/api/v1/partner/deals",
            "coverage":["phones.json"],
            "max_pages":25
        }
        accepted = run_pricelens(source, {"phones.json":{"products":[]}}, "fallback")
        self.assertEqual(accepted, 0)
        self.assertEqual(mocked_get.call_count, 10)
        self.assertIn("offset=900", mocked_get.call_args_list[-1].args[0])

    def test_freshness_status_uses_the_lowest_offer_timestamp(self):
        from datetime import datetime, timezone
        product = {"priceOffers":[
            {"priceEGP":1200,"checkedAt":"2026-11-04T10:00:00Z"},
            {"priceEGP":1100,"checkedAt":"2026-10-01T10:00:00Z"}
        ]}
        self.assertEqual(
            freshness_status(product, now=datetime(2026,11,5,tzinfo=timezone.utc)),
            "stale"
        )

    def test_freshness_status_is_fresh_for_recent_lowest_offer(self):
        from datetime import datetime, timezone
        product = {"priceOffers":[
            {"priceEGP":1100,"checkedAt":"2026-11-04T10:00:00Z"}
        ]}
        self.assertEqual(
            freshness_status(product, now=datetime(2026,11,5,tzinfo=timezone.utc)),
            "fresh"
        )

    def test_freshness_status_marks_missing_timestamp_unknown(self):
        product = {"priceEGP":1200}
        self.assertEqual(freshness_status(product), "unknown")

    def test_expired_provider_offer_is_removed_and_provider_price_cleared(self):
        from datetime import datetime, timezone
        product = {
            "name":"سامسونج جالاكسي A56", "brand":"Samsung",
            "priceEGP":1234, "priceProvider":"Prices by PriceLens",
            "priceOffers":[{
                "merchant":"Store", "priceEGP":1234,
                "source":"https://store.example/item",
                "sourceLabel":"Prices by PriceLens",
                "checkedAt":"2026-10-01T10:00:00Z"
            }]
        }
        catalogs = {"phones.json":{"products":[product]}}
        expired, cleaned = expire_stale_offers(
            catalogs, now=datetime(2026,11,5,tzinfo=timezone.utc)
        )
        self.assertEqual((expired, cleaned), (1, 1))
        self.assertEqual(product["priceOffers"], [])
        self.assertNotIn("priceEGP", product)
        self.assertIn("غير متاح", product["priceStatus"])

    def test_recent_provider_offer_is_preserved(self):
        from datetime import datetime, timezone
        product = {
            "name":"سامسونج جالاكسي A56", "brand":"Samsung",
            "priceEGP":1234, "priceProvider":"Prices by PriceLens",
            "priceOffers":[{
                "merchant":"Store", "priceEGP":1234,
                "source":"https://store.example/item",
                "sourceLabel":"Prices by PriceLens",
                "checkedAt":"2026-11-04T10:00:00Z"
            }]
        }
        catalogs = {"phones.json":{"products":[product]}}
        expired, cleaned = expire_stale_offers(
            catalogs, now=datetime(2026,11,5,tzinfo=timezone.utc)
        )
        self.assertEqual((expired, cleaned), (0, 0))
        self.assertEqual(product["priceEGP"], 1234)

    def test_ambiguous_match_is_rejected(self):
        self.index[(normalize(self.product["name"]), normalize(self.product["brand"]))].append(("electronics.json", {"name":self.product["name"],"brand":"Samsung"}))
        self.assertFalse(apply_offer(self.index, "سامسونج جالاكسي A56", "Samsung", 1234, "Store", "https://store.example/item", "now", "Test"))


    @patch("github_actions_updater.get_json")
    def test_open_prices_uses_country_proof_filter_and_keeps_observations_separate(self, mocked_get):
        from datetime import datetime, timezone
        product = {"id":"g1","name":"لبن كامل الدسم","brand":"ExampleBrand","price":99}
        catalogs = {"groceries.json":{"products":[product]}}
        today = datetime.now(timezone.utc).date().isoformat()
        mocked_get.return_value = {
            "items":[{
                "id":321,"type":"PRODUCT","currency":"EGP","price_per":"UNIT",
                "price":45.5,"date":today,"product_name":"لبن كامل الدسم",
                "product":{"product_name":"لبن كامل الدسم","brands":"ExampleBrand","code":"1234567890123"},
                "location":{"id":10,"osm_name":"متجر تجريبي","osm_address_country_code":"EG"}
            }],"page":1,"pages":1,"size":100,"total":1
        }
        accepted = run_open_prices({
            "id":"open-prices-test","endpoint":"https://prices.openfoodfacts.org/api/v1",
            "coverage":["groceries.json"]
        }, catalogs, "test-run-time")
        self.assertEqual(accepted, 1)
        self.assertEqual(product["price"], 99)
        self.assertNotIn("priceOffers", product)
        self.assertEqual(product["communityPriceObservations"][0]["priceEGP"], 45.5)
        self.assertIn("/prices/321", product["communityPriceObservations"][0]["source"])
        requested_url = mocked_get.call_args.args[0]
        self.assertIn("proof__location__osm_address_country_code=eg", requested_url)
        self.assertIn("currency=EGP", requested_url)

    @patch("github_actions_updater.get_json")
    def test_open_prices_rejects_old_observations(self, mocked_get):
        from datetime import datetime, timezone, timedelta
        product = {"name":"لبن كامل الدسم","brand":"ExampleBrand","price":99}
        catalogs = {"groceries.json":{"products":[product]}}
        old_date = (datetime.now(timezone.utc).date() - timedelta(days=45)).isoformat()
        mocked_get.return_value = {
            "items":[{
                "id":322,"type":"PRODUCT","currency":"EGP","price":45,"date":old_date,
                "product":{"product_name":"لبن كامل الدسم","brands":"ExampleBrand"},
                "location":{"osm_name":"متجر تجريبي","osm_address_country_code":"EG"}
            }],"page":1,"pages":1
        }
        accepted = run_open_prices({
            "id":"open-prices-old-test","coverage":["groceries.json"],
            "endpoint":"https://prices.openfoodfacts.org/api/v1"
        }, catalogs, "test")
        self.assertEqual(accepted, 0)
        self.assertNotIn("communityPriceObservations", product)



if __name__ == "__main__":
    unittest.main()
