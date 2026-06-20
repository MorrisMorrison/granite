package server

import (
	"net/http"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
)

type authResponse struct {
	User    auth.User `json:"user"`
	Access  string    `json:"access"`
	Refresh string    `json:"refresh"`
}

type tokenResponse struct {
	Access  string `json:"access"`
	Refresh string `json:"refresh"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	user, pair, err := s.auth.Register(r.Context(), req.Email, req.Password, req.DisplayName)
	if err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, authResponse{User: user, Access: pair.Access, Refresh: pair.Refresh})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	user, pair, err := s.auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, authResponse{User: user, Access: pair.Access, Refresh: pair.Refresh})
}

func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Refresh string `json:"refresh"`
	}
	if err := decodeJSON(r, &req); err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	pair, err := s.auth.Refresh(r.Context(), req.Refresh)
	if err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, tokenResponse{Access: pair.Access, Refresh: pair.Refresh})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Refresh string `json:"refresh"`
	}
	if err := decodeJSON(r, &req); err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	if err := s.auth.Logout(r.Context(), req.Refresh); err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
