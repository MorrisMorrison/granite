package server

import (
	"encoding/json"
	"net/http"
)

// writeJSON is used by the plain-chi health/static handlers (the huma API does
// its own serialization).
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}
