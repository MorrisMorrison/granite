-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
VALUES (?, ?, ?, ?, NULL, ?)
RETURNING *;

-- name: GetRefreshTokenByHash :one
SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1;

-- name: RevokeRefreshToken :execrows
UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?;

-- name: RevokeAllUserRefreshTokens :execrows
UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL;
