package server

import (
	"encoding/json"
	"net/http"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
)

func (s *Server) handleGetMe(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.GetUser(r.Context(), userIDFromCtx(r.Context()))
	if err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName *string         `json:"display_name"`
		Settings    json.RawMessage `json:"settings"`
	}
	if err := decodeJSON(r, &req); err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	user, err := s.auth.UpdateProfile(r.Context(), userIDFromCtx(r.Context()), req.DisplayName, req.Settings)
	if err != nil {
		apperr.HandleError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, user)
}
