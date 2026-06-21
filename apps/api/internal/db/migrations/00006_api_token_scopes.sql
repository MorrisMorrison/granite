-- +goose Up
-- API token scopes: gate writes behind a scope. Existing tokens keep full access
-- (read,write); new tokens default to read-only (writes are opt-in) — see
-- CreateAPIToken. Stored as a comma-separated list ("read" or "read,write").
ALTER TABLE api_tokens ADD COLUMN scopes TEXT NOT NULL DEFAULT 'read,write';

-- +goose Down
ALTER TABLE api_tokens DROP COLUMN scopes;
