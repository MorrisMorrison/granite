-- +goose Up
-- Workouts: a logged session (workout → exercises → sets). Sets hold ACTUAL
-- performed values (weight/reps/...), unlike routine_sets which hold targets.
-- Workout carries sync metadata; child rows get theirs in the sync slice (Phase 3).
CREATE TABLE workouts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id TEXT REFERENCES routines(id) ON DELETE SET NULL,
    title      TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    start_time INTEGER NOT NULL,
    end_time   INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);
CREATE INDEX idx_workouts_user ON workouts (user_id);

CREATE TABLE workout_exercises (
    id             TEXT PRIMARY KEY,
    workout_id     TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id    TEXT NOT NULL REFERENCES exercises(id),
    order_index    INTEGER NOT NULL DEFAULT 0,
    notes          TEXT NOT NULL DEFAULT '',
    superset_group INTEGER,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises (workout_id);

CREATE TABLE workout_sets (
    id                  TEXT PRIMARY KEY,
    workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    order_index         INTEGER NOT NULL DEFAULT 0,
    set_type            TEXT NOT NULL DEFAULT 'normal',
    weight              REAL,
    reps                INTEGER,
    rpe                 REAL,
    duration            INTEGER,
    distance            REAL,
    is_completed        INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX idx_workout_sets_we ON workout_sets (workout_exercise_id);

-- +goose Down
DROP TABLE workout_sets;
DROP TABLE workout_exercises;
DROP TABLE workouts;
