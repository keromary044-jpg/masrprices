CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  variant TEXT,
  unit TEXT,
  image_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  price_egp REAL NOT NULL CHECK(price_egp > 0),
  product_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  variant TEXT,
  region TEXT,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS offers_product_price_idx ON offers(product_id, price_egp);
CREATE INDEX IF NOT EXISTS offers_checked_idx ON offers(checked_at);
CREATE TABLE IF NOT EXISTS price_update_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  items_received INTEGER NOT NULL DEFAULT 0,
  items_accepted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);