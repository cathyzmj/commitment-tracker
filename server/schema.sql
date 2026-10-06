-- One table for everything the server stores (sync documents, widget summaries).
-- Apply with:  npx wrangler d1 execute commitments --remote --file server/schema.sql
CREATE TABLE IF NOT EXISTS kv (
  store      TEXT    NOT NULL,
  key        TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  etag       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (store, key)
);
