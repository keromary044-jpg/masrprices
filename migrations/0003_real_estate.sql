CREATE TABLE IF NOT EXISTS real_estate_listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  governorate TEXT NOT NULL,
  center TEXT NOT NULL,
  area TEXT NOT NULL,
  price REAL,
  price_negotiable INTEGER NOT NULL DEFAULT 0 CHECK(price_negotiable IN (0,1)),
  area_m2 REAL,
  rooms INTEGER,
  bathrooms INTEGER,
  floor TEXT,
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
CREATE INDEX IF NOT EXISTS real_estate_status_created_idx ON real_estate_listings(status,created_at);
CREATE INDEX IF NOT EXISTS real_estate_location_idx ON real_estate_listings(governorate,center,status);
CREATE INDEX IF NOT EXISTS real_estate_submitter_idx ON real_estate_listings(submitter_hash,created_at);
CREATE TRIGGER IF NOT EXISTS real_estate_set_published_at
AFTER UPDATE OF status ON real_estate_listings
WHEN NEW.status='approved' AND OLD.status<>'approved'
BEGIN
  UPDATE real_estate_listings SET published_at=CURRENT_TIMESTAMP WHERE id=NEW.id;
END;
