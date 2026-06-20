-- Folders ---------------------------------------------------------------------

-- name: ListRoutineFolders :many
SELECT * FROM routine_folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY order_index, name;

-- name: GetRoutineFolder :one
SELECT * FROM routine_folders WHERE id = ? AND deleted_at IS NULL LIMIT 1;

-- name: CreateRoutineFolder :one
INSERT INTO routine_folders (id, user_id, name, order_index, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?) RETURNING *;

-- name: UpdateRoutineFolder :one
UPDATE routine_folders SET name = ?, order_index = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL RETURNING *;

-- name: SoftDeleteRoutineFolder :execrows
UPDATE routine_folders SET deleted_at = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL;

-- Routines --------------------------------------------------------------------

-- name: ListRoutines :many
SELECT * FROM routines WHERE user_id = ? AND deleted_at IS NULL ORDER BY order_index, title;

-- name: GetRoutine :one
SELECT * FROM routines WHERE id = ? AND deleted_at IS NULL LIMIT 1;

-- name: CreateRoutine :one
INSERT INTO routines (id, user_id, folder_id, title, notes, order_index, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: UpdateRoutineMeta :one
UPDATE routines SET folder_id = ?, title = ?, notes = ?, order_index = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL RETURNING *;

-- name: SoftDeleteRoutine :execrows
UPDATE routines SET deleted_at = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL;

-- Routine exercises + sets (children, replaced wholesale on update) ------------

-- name: ListRoutineExercises :many
SELECT * FROM routine_exercises WHERE routine_id = ? ORDER BY order_index;

-- name: CreateRoutineExercise :one
INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, notes, rest_seconds, superset_group, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: DeleteRoutineExercisesByRoutine :exec
DELETE FROM routine_exercises WHERE routine_id = ?;

-- name: ListRoutineSetsForRoutine :many
SELECT rs.* FROM routine_sets rs
JOIN routine_exercises re ON rs.routine_exercise_id = re.id
WHERE re.routine_id = ? ORDER BY rs.order_index;

-- name: CreateRoutineSet :one
INSERT INTO routine_sets (id, routine_exercise_id, order_index, set_type, target_weight, target_reps, target_rpe, target_duration, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;
