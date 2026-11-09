CREATE TABLE IF NOT EXISTS community_price_submissions (
 id TEXT PRIMARY KEY, product_name TEXT NOT NULL, category TEXT NOT NULL,
 store_name TEXT NOT NULL, price_egp REAL NOT NULL CHECK(price_egp > 0),
 unit TEXT NOT NULL DEFAULT '', product_url TEXT NOT NULL, proof_url TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', submitter_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_community_prices_status_date ON community_price_submissions(status,created_at);
CREATE INDEX IF NOT EXISTS idx_community_prices_submitter_date ON community_price_submissions(submitter_hash,created_at);