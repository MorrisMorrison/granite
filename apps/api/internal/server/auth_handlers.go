package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
)

// registerAuthRoutes wires the authentication endpoints.
func (s *Server) registerAuthRoutes(a huma.API) {
	huma.Register(a, huma.Operation{OperationID: "register", Method: http.MethodPost, Path: "/api/v1/auth/register", Summary: "Register a new account", Tags: []string{"Auth"}, DefaultStatus: http.StatusCreated}, s.handleRegister)
	huma.Register(a, huma.Operation{OperationID: "login", Method: http.MethodPost, Path: "/api/v1/auth/login", Summary: "Log in", Tags: []string{"Auth"}}, s.handleLogin)
	huma.Register(a, huma.Operation{OperationID: "refresh", Method: http.MethodPost, Path: "/api/v1/auth/refresh", Summary: "Rotate tokens", Tags: []string{"Auth"}}, s.handleRefresh)
	huma.Register(a, huma.Operation{OperationID: "logout", Method: http.MethodPost, Path: "/api/v1/auth/logout", Summary: "Log out", Tags: []string{"Auth"}, DefaultStatus: http.StatusNoContent}, s.handleLogout)
}

// userResponse is the API representation of a user (settings as arbitrary JSON).
type userResponse struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Settings    any    `json:"settings"`
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

func toUserResponse(u auth.User) userResponse {
	var settings any
	if len(u.Settings) > 0 {
		_ = json.Unmarshal(u.Settings, &settings)
	}
	return userResponse{
		ID:          u.ID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		Settings:    settings,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

type authOutput struct {
	Body struct {
		User    userResponse `json:"user"`
		Access  string       `json:"access"`
		Refresh string       `json:"refresh"`
	}
}

type registerInput struct {
	Body struct {
		Email       string `json:"email" format:"email"`
		Password    string `json:"password" minLength:"8" maxLength:"128"`
		DisplayName string `json:"display_name,omitempty"`
	}
}

func (s *Server) handleRegister(ctx context.Context, in *registerInput) (*authOutput, error) {
	user, pair, err := s.auth.Register(ctx, in.Body.Email, in.Body.Password, in.Body.DisplayName)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &authOutput{}
	out.Body.User, out.Body.Access, out.Body.Refresh = toUserResponse(user), pair.Access, pair.Refresh
	return out, nil
}

type loginInput struct {
	Body struct {
		Email    string `json:"email" format:"email"`
		Password string `json:"password"`
	}
}

func (s *Server) handleLogin(ctx context.Context, in *loginInput) (*authOutput, error) {
	user, pair, err := s.auth.Login(ctx, in.Body.Email, in.Body.Password)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &authOutput{}
	out.Body.User, out.Body.Access, out.Body.Refresh = toUserResponse(user), pair.Access, pair.Refresh
	return out, nil
}

type refreshInput struct {
	Body struct {
		Refresh string `json:"refresh"`
	}
}

type tokenOutput struct {
	Body struct {
		Access  string `json:"access"`
		Refresh string `json:"refresh"`
	}
}

func (s *Server) handleRefresh(ctx context.Context, in *refreshInput) (*tokenOutput, error) {
	pair, err := s.auth.Refresh(ctx, in.Body.Refresh)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &tokenOutput{}
	out.Body.Access, out.Body.Refresh = pair.Access, pair.Refresh
	return out, nil
}

func (s *Server) handleLogout(ctx context.Context, in *refreshInput) (*struct{}, error) {
	if err := s.auth.Logout(ctx, in.Body.Refresh); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}
