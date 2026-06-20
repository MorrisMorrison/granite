-- +goose Up
-- Exercises: the first synced entity, so it carries the sync-metadata columns
-- (created_at, updated_at, deleted_at). user_id NULL = built-in library row.
CREATE TABLE exercises (
    id                TEXT PRIMARY KEY,
    user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    exercise_type     TEXT NOT NULL DEFAULT 'weight_reps',
    primary_muscle    TEXT NOT NULL DEFAULT '',
    secondary_muscles TEXT NOT NULL DEFAULT '[]',
    equipment         TEXT NOT NULL DEFAULT '',
    instructions      TEXT NOT NULL DEFAULT '',
    is_archived       INTEGER NOT NULL DEFAULT 0,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    deleted_at        INTEGER
);

CREATE INDEX idx_exercises_user_id ON exercises (user_id);

-- +goose Down
DROP TABLE exercises;
