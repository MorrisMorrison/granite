-- +goose Up
-- Personal API tokens: long-lived, revocable bearer tokens for programmatic
-- access (MCP, scripts, third-party). The raw token is shown once on creation;
-- only its sha-256 hash is stored. Revoking a token deletes the row.
CREATE TABLE api_tokens (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL DEFAULT '',
    token_hash   TEXT NOT NULL UNIQUE,
    prefix       TEXT NOT NULL,
    last_used_at INTEGER,
    expires_at   INTEGER,
    created_at   INTEGER NOT NULL
);

CREATE INDEX idx_api_tokens_user_id ON api_tokens (user_id);

-- +goose Down
DROP TABLE api_tokens;
