package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
)

// registerTokenRoutes wires the personal API-token endpoints.
func (s *Server) registerTokenRoutes(a huma.API) {
	huma.Register(a, huma.Operation{OperationID: "listApiTokens", Method: http.MethodGet, Path: "/api/v1/tokens", Summary: "List your API tokens", Tags: []string{"Tokens"}, Security: bearerSecurity}, s.handleListTokens)
	huma.Register(a, huma.Operation{OperationID: "createApiToken", Method: http.MethodPost, Path: "/api/v1/tokens", Summary: "Create an API token", Tags: []string{"Tokens"}, Security: bearerSecurity, DefaultStatus: http.StatusCreated}, s.handleCreateToken)
	huma.Register(a, huma.Operation{OperationID: "revokeApiToken", Method: http.MethodDelete, Path: "/api/v1/tokens/{id}", Summary: "Revoke an API token", Tags: []string{"Tokens"}, Security: bearerSecurity, DefaultStatus: http.StatusNoContent}, s.handleRevokeToken)
}

type listTokensOutput struct {
	Body struct {
		Tokens []auth.APIToken `json:"tokens"`
	}
}

func (s *Server) handleListTokens(ctx context.Context, _ *struct{}) (*listTokensOutput, error) {
	if err := requireInteractive(ctx); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	ts, err := s.auth.ListAPITokens(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &listTokensOutput{}
	out.Body.Tokens = ts
	if out.Body.Tokens == nil {
		out.Body.Tokens = []auth.APIToken{}
	}
	return out, nil
}

type createTokenInput struct {
	Body struct {
		Name      string   `json:"name" doc:"A label to identify the token."`
		Scopes    []string `json:"scopes,omitempty" doc:"Access scopes: omit for read-only, or [\"write\"] for read+write."`
		ExpiresAt *int64   `json:"expires_at,omitempty" doc:"Optional expiry (epoch ms); omit for no expiry."`
	}
}

// apiTokenOutput carries a single token. On creation the Token field holds the
// raw secret (shown exactly once); list/get never populate it.
type apiTokenOutput struct {
	Body auth.APIToken
}

func (s *Server) handleCreateToken(ctx context.Context, in *createTokenInput) (*apiTokenOutput, error) {
	if err := requireInteractive(ctx); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	t, err := s.auth.CreateAPIToken(ctx, userIDFromCtx(ctx), in.Body.Name, in.Body.Scopes, in.Body.ExpiresAt)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &apiTokenOutput{Body: t}, nil
}

func (s *Server) handleRevokeToken(ctx context.Context, in *idPathInput) (*struct{}, error) {
	if err := requireInteractive(ctx); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	if err := s.auth.RevokeAPIToken(ctx, userIDFromCtx(ctx), in.ID); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}

// requireInteractive rejects requests authenticated with an API token: all token
// management (create, list, revoke) must use an interactive (JWT) session, so a
// leaked token can't enumerate, mint, or revoke tokens.
func requireInteractive(ctx context.Context) error {
	if authMethodFromCtx(ctx) != authMethodJWT {
		return apperr.Forbidden("API tokens cannot manage API tokens; use an interactive session")
	}
	return nil
}
