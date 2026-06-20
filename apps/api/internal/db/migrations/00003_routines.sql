-- +goose Up
-- Routines: a planned workout template (folders → routines → exercises → sets).
-- Routine/folder carry sync metadata; the child rows (routine_exercises,
-- routine_sets) are managed as part of their routine for now and gain their own
-- sync metadata in the sync slice (Phase 3).
CREATE TABLE routine_folders (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);
CREATE INDEX idx_routine_folders_user ON routine_folders (user_id);

CREATE TABLE routines (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id   TEXT REFERENCES routine_folders(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    notes       TEXT NOT NULL DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);
CREATE INDEX idx_routines_user ON routines (user_id);

CREATE TABLE routine_exercises (
    id             TEXT PRIMARY KEY,
    routine_id     TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id    TEXT NOT NULL REFERENCES exercises(id),
    order_index    INTEGER NOT NULL DEFAULT 0,
    notes          TEXT NOT NULL DEFAULT '',
    rest_seconds   INTEGER NOT NULL DEFAULT 0,
    superset_group INTEGER,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_routine_exercises_routine ON routine_exercises (routine_id);

CREATE TABLE routine_sets (
    id                  TEXT PRIMARY KEY,
    routine_exercise_id TEXT NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
    order_index         INTEGER NOT NULL DEFAULT 0,
    set_type            TEXT NOT NULL DEFAULT 'normal',
    target_weight       REAL,
    target_reps         INTEGER,
    target_rpe          REAL,
    target_duration     INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX idx_routine_sets_re ON routine_sets (routine_exercise_id);

-- +goose Down
DROP TABLE routine_sets;
DROP TABLE routine_exercises;
DROP TABLE routines;
DROP TABLE routine_folders;
