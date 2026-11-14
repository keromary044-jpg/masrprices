import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).with_name("github_actions_updater.py")
SPEC = importlib.util.spec_from_file_location("masrprices_updater", SCRIPT)
UPDATER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(UPDATER)


class ExactMatchingTests(unittest.TestCase):
    def test_unique_unbranded_product_is_searchable(self):
        catalogs = {
            "books.json": {
                "products": [{"name": "كتاب ألف", "brand": ""}]
            }
        }
        candidates = UPDATER.build_search_candidates(catalogs)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][0], "كتاب ألف")
        self.assertEqual(candidates[0][1], "")

    def test_duplicate_unbranded_name_is_not_searchable(self):
        catalogs = {
            "books.json": {
                "products": [
                    {"name": "عنوان مكرر", "brand": ""},
                    {"name": "عنوان مكرر", "brand": ""}
                ]
            }
        }
        self.assertEqual(UPDATER.build_search_candidates(catalogs), [])

    def test_unique_unbranded_product_accepts_exact_provider_name(self):
        product = {"name": "كتاب ألف", "brand": ""}
        index = UPDATER.build_exact_index({"books.json": {"products": [product]}})
        accepted = UPDATER.apply_offer(
            index, "كتاب ألف", "دار النشر", 120, "متجر تجريبي",
            "https://example.com/book", "2026-11-15T00:00:00Z", "اختبار"
        )
        self.assertTrue(accepted)
        self.assertEqual(product["price"], 120)

    def test_ambiguous_unbranded_name_is_rejected(self):
        first = {"name": "عنوان مكرر", "brand": ""}
        second = {"name": "عنوان مكرر", "brand": "دار أخرى"}
        index = UPDATER.build_exact_index({
            "books.json": {"products": [first, second]}
        })
        accepted = UPDATER.apply_offer(
            index, "عنوان مكرر", "دار نشر", 120, "متجر تجريبي",
            "https://example.com/book", "2026-11-15T00:00:00Z", "اختبار"
        )
        self.assertFalse(accepted)
        self.assertNotIn("price", first)


if __name__ == "__main__":
    unittest.main()
