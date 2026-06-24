-- +goose Up
-- Per-instance metadata. instance_id is generated once for a database; a fresh
-- (reset/wiped) DB re-runs this migration and gets a new id. Clients compare it
-- against their last-seen value and reset their local cache when it changes, so a
-- server reset doesn't leave them with orphaned/duplicate records.
CREATE TABLE server_meta (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
INSERT INTO server_meta (key, value) VALUES ('instance_id', lower(hex(randomblob(16))));

-- +goose Down
DROP TABLE server_meta;
