-- MasrPrices automatic price-feed updater
ALTER TABLE offers ADD COLUMN source_id TEXT;

CREATE TABLE IF NOT EXISTS price_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  last_success_at TEXT,
  last_status TEXT,
  last_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS offers_source_status_idx ON offers(source_id,status);
CREATE INDEX IF NOT EXISTS price_sources_active_idx ON price_sources(active);
