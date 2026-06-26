-- +goose Up
-- Per-user monotonic sync cursor. Each synced row gets a server_seq from the
-- user's counter on every write; pull becomes `server_seq > cursor` instead of the
-- old `updated_at >= cursor`. This is clock-independent and survives backdated
-- writes (e.g. imports keep their old updated_at but get a fresh, higher seq), so
-- incremental pull no longer skips them.
--
-- server_seq is assigned by AFTER INSERT/UPDATE triggers rather than in app code,
-- so *every* write path (sync push, REST CRUD, import, MCP) gets a seq — none can
-- forget it. Triggers are guarded against re-entry (NEW.server_seq = OLD.server_seq)
-- so they're safe even if recursive_triggers is ever enabled.
ALTER TABLE exercises ADD COLUMN server_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routine_folders ADD COLUMN server_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routines ADD COLUMN server_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workouts ADD COLUMN server_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bodyweight ADD COLUMN server_seq INTEGER NOT NULL DEFAULT 0;

-- Seed existing rows from updated_at (monotonic enough, and > 0 so they pull after
-- the reset below); the per-user counter then continues above the max. Built-in
-- exercises (user_id NULL) aren't synced here.
UPDATE exercises SET server_seq = updated_at WHERE user_id IS NOT NULL;
UPDATE routine_folders SET server_seq = updated_at;
UPDATE routines SET server_seq = updated_at;
UPDATE workouts SET server_seq = updated_at;
UPDATE bodyweight SET server_seq = updated_at;

CREATE TABLE sync_state (
	user_id  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	last_seq INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sync_state (user_id, last_seq)
SELECT user_id, MAX(seq) FROM (
	SELECT user_id, server_seq AS seq FROM exercises WHERE user_id IS NOT NULL
	UNION ALL SELECT user_id, server_seq FROM routine_folders
	UNION ALL SELECT user_id, server_seq FROM routines
	UNION ALL SELECT user_id, server_seq FROM workouts
	UNION ALL SELECT user_id, server_seq FROM bodyweight
) GROUP BY user_id;

-- +goose StatementBegin
CREATE TRIGGER exercises_seq_insert AFTER INSERT ON exercises
WHEN NEW.user_id IS NOT NULL
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE exercises SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE TRIGGER exercises_seq_update AFTER UPDATE ON exercises
WHEN NEW.user_id IS NOT NULL AND NEW.server_seq = OLD.server_seq
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE exercises SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER routine_folders_seq_insert AFTER INSERT ON routine_folders
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE routine_folders SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE TRIGGER routine_folders_seq_update AFTER UPDATE ON routine_folders
WHEN NEW.server_seq = OLD.server_seq
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE routine_folders SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER routines_seq_insert AFTER INSERT ON routines
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE routines SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE TRIGGER routines_seq_update AFTER UPDATE ON routines
WHEN NEW.server_seq = OLD.server_seq
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE routines SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER workouts_seq_insert AFTER INSERT ON workouts
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE workouts SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE TRIGGER workouts_seq_update AFTER UPDATE ON workouts
WHEN NEW.server_seq = OLD.server_seq
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE workouts SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER bodyweight_seq_insert AFTER INSERT ON bodyweight
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE bodyweight SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE TRIGGER bodyweight_seq_update AFTER UPDATE ON bodyweight
WHEN NEW.server_seq = OLD.server_seq
BEGIN
	INSERT INTO sync_state (user_id, last_seq) VALUES (NEW.user_id, 1)
		ON CONFLICT(user_id) DO UPDATE SET last_seq = last_seq + 1;
	UPDATE bodyweight SET server_seq = (SELECT last_seq FROM sync_state WHERE user_id = NEW.user_id) WHERE id = NEW.id;
END;
-- +goose StatementEnd

-- Cursor semantics changed (timestamp → seq), so existing clients must re-pull once.
-- Rotating the instance id makes every client treat this as a server reset and
-- reconcile from cursor 0 (see migration 00007 + the client's reconcileServerInstance).
UPDATE server_meta SET value = lower(hex(randomblob(16))) WHERE key = 'instance_id';

-- +goose Down
DROP TRIGGER exercises_seq_insert;
DROP TRIGGER exercises_seq_update;
DROP TRIGGER routine_folders_seq_insert;
DROP TRIGGER routine_folders_seq_update;
DROP TRIGGER routines_seq_insert;
DROP TRIGGER routines_seq_update;
DROP TRIGGER workouts_seq_insert;
DROP TRIGGER workouts_seq_update;
DROP TRIGGER bodyweight_seq_insert;
DROP TRIGGER bodyweight_seq_update;
DROP TABLE sync_state;
ALTER TABLE exercises DROP COLUMN server_seq;
ALTER TABLE routine_folders DROP COLUMN server_seq;
ALTER TABLE routines DROP COLUMN server_seq;
ALTER TABLE workouts DROP COLUMN server_seq;
ALTER TABLE bodyweight DROP COLUMN server_seq;
