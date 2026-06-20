-- name: ListExercises :many
SELECT * FROM exercises
WHERE (user_id = ? OR user_id IS NULL) AND deleted_at IS NULL
ORDER BY name;

-- name: GetExercise :one
SELECT * FROM exercises
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: CreateExercise :one
INSERT INTO exercises (
    id, user_id, name, exercise_type, primary_muscle, secondary_muscles,
    equipment, instructions, is_archived, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateExercise :one
UPDATE exercises
SET name = ?, exercise_type = ?, primary_muscle = ?, secondary_muscles = ?,
    equipment = ?, instructions = ?, is_archived = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteExercise :execrows
UPDATE exercises
SET deleted_at = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL;

-- name: CountExercises :one
SELECT count(*) AS total FROM exercises;

-- name: CreateBuiltinExercise :exec
INSERT INTO exercises (
    id, user_id, name, exercise_type, primary_muscle, secondary_muscles,
    equipment, instructions, is_archived, created_at, updated_at
) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?);
