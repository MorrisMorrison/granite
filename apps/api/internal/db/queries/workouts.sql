-- name: ListWorkouts :many
SELECT * FROM workouts WHERE user_id = ? AND deleted_at IS NULL ORDER BY start_time DESC;

-- name: GetWorkout :one
SELECT * FROM workouts WHERE id = ? AND deleted_at IS NULL LIMIT 1;

-- name: CreateWorkout :one
INSERT INTO workouts (id, user_id, routine_id, title, notes, start_time, end_time, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: UpdateWorkoutMeta :one
UPDATE workouts SET routine_id = ?, title = ?, notes = ?, start_time = ?, end_time = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL RETURNING *;

-- name: SoftDeleteWorkout :execrows
UPDATE workouts SET deleted_at = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND deleted_at IS NULL;

-- name: ListWorkoutExercises :many
SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY order_index;

-- name: CreateWorkoutExercise :one
INSERT INTO workout_exercises (id, workout_id, exercise_id, order_index, notes, superset_group, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: DeleteWorkoutExercisesByWorkout :exec
DELETE FROM workout_exercises WHERE workout_id = ?;

-- name: ListWorkoutSetsForWorkout :many
SELECT ws.* FROM workout_sets ws
JOIN workout_exercises we ON ws.workout_exercise_id = we.id
WHERE we.workout_id = ? ORDER BY ws.order_index;

-- name: CreateWorkoutSet :one
INSERT INTO workout_sets (id, workout_exercise_id, order_index, set_type, weight, reps, rpe, duration, distance, is_completed, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;
