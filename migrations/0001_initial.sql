-- MasrPrices D1 initial schema
-- Apply once to the D1 database bound to the Worker as DB.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  price_egp REAL NOT NULL CHECK(price_egp > 0),
  product_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','stale')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offers_product_status_price ON offers(product_id,status,price_egp);
CREATE INDEX IF NOT EXISTS idx_offers_checked_at ON offers(checked_at);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  offer_id INTEGER,
  store_name TEXT NOT NULL,
  price_egp REAL NOT NULL CHECK(price_egp > 0),
  source_name TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY(offer_id) REFERENCES offers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_time ON price_history(product_id,checked_at);

CREATE TRIGGER IF NOT EXISTS trg_verified_offer_price_history
AFTER INSERT ON offers
WHEN NEW.status = 'verified'
BEGIN
  INSERT INTO price_history(product_id,offer_id,store_name,price_egp,source_name,checked_at)
  VALUES(NEW.product_id,NEW.id,NEW.store_name,NEW.price_egp,NEW.source_name,NEW.checked_at);
END;

CREATE TABLE IF NOT EXISTS price_update_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  items_received INTEGER NOT NULL DEFAULT 0,
  items_accepted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS real_estate_listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  governorate TEXT NOT NULL,
  center TEXT NOT NULL,
  area TEXT NOT NULL,
  price REAL,
  price_negotiable INTEGER NOT NULL DEFAULT 0,
  area_m2 REAL,
  rooms INTEGER,
  bathrooms INTEGER,
  floor TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  photo_urls TEXT NOT NULL DEFAULT '[]',
  owner_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  submitter_hash TEXT NOT NULL,
  consent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_real_estate_status_date ON real_estate_listings(status,created_at);
CREATE INDEX IF NOT EXISTS idx_real_estate_submitter_date ON real_estate_listings(submitter_hash,created_at);
