-- +goose Up
-- Standalone bodyweight log (weigh-ins), synced like the other entities. Weight is
-- stored in kg; recorded_at is the weigh-in time (epoch ms). Soft-deleted via
-- deleted_at for LWW tombstones.
CREATE TABLE bodyweight (
	id          TEXT PRIMARY KEY,
	user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	weight      REAL NOT NULL,
	recorded_at INTEGER NOT NULL,
	created_at  INTEGER NOT NULL,
	updated_at  INTEGER NOT NULL,
	deleted_at  INTEGER
);
CREATE INDEX idx_bodyweight_user_updated ON bodyweight(user_id, updated_at);

-- +goose Down
DROP TABLE bodyweight;
