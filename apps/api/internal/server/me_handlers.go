package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// registerUserRoutes wires the current-user endpoints.
func (s *Server) registerUserRoutes(a huma.API) {
	huma.Register(a, huma.Operation{OperationID: "getMe", Method: http.MethodGet, Path: "/api/v1/me", Summary: "Get the current user", Tags: []string{"User"}, Security: bearerSecurity}, s.handleGetMe)
	huma.Register(a, huma.Operation{OperationID: "updateMe", Method: http.MethodPatch, Path: "/api/v1/me", Summary: "Update the current user", Tags: []string{"User"}, Security: bearerSecurity}, s.handleUpdateMe)
}

type meOutput struct {
	Body userResponse
}

func (s *Server) handleGetMe(ctx context.Context, _ *struct{}) (*meOutput, error) {
	user, err := s.auth.GetUser(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &meOutput{Body: toUserResponse(user)}, nil
}

type updateMeInput struct {
	Body struct {
		DisplayName *string `json:"display_name,omitempty"`
		Settings    any     `json:"settings,omitempty"`
	}
}

func (s *Server) handleUpdateMe(ctx context.Context, in *updateMeInput) (*meOutput, error) {
	var settings json.RawMessage
	if in.Body.Settings != nil {
		b, err := json.Marshal(in.Body.Settings)
		if err != nil {
			return nil, toHumaErr(ctx, err)
		}
		settings = b
	}
	user, err := s.auth.UpdateProfile(ctx, userIDFromCtx(ctx), in.Body.DisplayName, settings)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &meOutput{Body: toUserResponse(user)}, nil
}
