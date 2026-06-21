-- Sync: changed-since reads (include soft-deleted for tombstones) + LWW upserts.

-- name: ChangedExercises :many
SELECT * FROM exercises WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at, id;

-- name: GetExerciseForSync :one
SELECT * FROM exercises WHERE id = ? LIMIT 1;

-- name: UpsertExercise :exec
INSERT INTO exercises (id, user_id, name, exercise_type, primary_muscle, secondary_muscles, equipment, instructions, is_archived, created_at, updated_at, deleted_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    name = excluded.name, exercise_type = excluded.exercise_type, primary_muscle = excluded.primary_muscle,
    secondary_muscles = excluded.secondary_muscles, equipment = excluded.equipment, instructions = excluded.instructions,
    is_archived = excluded.is_archived, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;

-- name: ChangedRoutineFolders :many
SELECT * FROM routine_folders WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at, id;

-- name: GetRoutineFolderForSync :one
SELECT * FROM routine_folders WHERE id = ? LIMIT 1;

-- name: UpsertRoutineFolder :exec
INSERT INTO routine_folders (id, user_id, name, order_index, created_at, updated_at, deleted_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    name = excluded.name, order_index = excluded.order_index, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;

-- name: ChangedRoutines :many
SELECT * FROM routines WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at, id;

-- name: GetRoutineForSync :one
SELECT * FROM routines WHERE id = ? LIMIT 1;

-- name: UpsertRoutine :exec
INSERT INTO routines (id, user_id, folder_id, title, notes, order_index, created_at, updated_at, deleted_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    folder_id = excluded.folder_id, title = excluded.title, notes = excluded.notes,
    order_index = excluded.order_index, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;

-- name: ChangedWorkouts :many
SELECT * FROM workouts WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at, id;

-- name: GetWorkoutForSync :one
SELECT * FROM workouts WHERE id = ? LIMIT 1;

-- name: UpsertWorkout :exec
INSERT INTO workouts (id, user_id, routine_id, title, notes, start_time, end_time, created_at, updated_at, deleted_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    routine_id = excluded.routine_id, title = excluded.title, notes = excluded.notes,
    start_time = excluded.start_time, end_time = excluded.end_time, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
