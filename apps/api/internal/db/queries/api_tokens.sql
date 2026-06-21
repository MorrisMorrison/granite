-- name: CreateApiToken :one
INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, scopes, expires_at, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListApiTokensByUser :many
SELECT * FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC;

-- name: GetApiTokenByHash :one
SELECT * FROM api_tokens WHERE token_hash = ? LIMIT 1;

-- name: DeleteApiToken :execrows
DELETE FROM api_tokens WHERE id = ? AND user_id = ?;

-- name: TouchApiToken :exec
UPDATE api_tokens SET last_used_at = ? WHERE id = ?;
