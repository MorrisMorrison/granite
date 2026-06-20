package server

import (
	"encoding/json"
	"net/http"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// decodeJSON reads a JSON body into dst, rejecting unknown fields and oversized
// payloads. A decode failure becomes a validation error.
func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return apperr.Validation("invalid request body")
	}
	return nil
}
