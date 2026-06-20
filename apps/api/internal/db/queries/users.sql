-- name: CreateUser :one
INSERT INTO users (id, email, password_hash, display_name, settings, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ? LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ? LIMIT 1;

-- name: CountUsers :one
SELECT count(*) AS total FROM users;

-- name: UpdateUserProfile :one
UPDATE users
SET display_name = ?, settings = ?, updated_at = ?
WHERE id = ?
RETURNING *;
