// Package server wires up the Granite HTTP API routes.
//
// At this scaffold stage it only exposes liveness/readiness probes and a
// placeholder landing page. Real routes (auth, sync, CRUD, MCP) arrive in
// Phase 1 — see docs/04-api-design.md.
package server

import "net/http"

// Server holds the HTTP routing for the Granite API.
type Server struct {
	mux *http.ServeMux
}

// New constructs a Server with all routes registered.
func New() *Server {
	s := &Server{mux: http.NewServeMux()}
	s.routes()
	return s
}

// Handler returns the root http.Handler for the server.
func (s *Server) Handler() http.Handler {
	return s.mux
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", handleHealthz)
	s.mux.HandleFunc("GET /readyz", handleReadyz)
	s.mux.HandleFunc("GET /{$}", handleRoot)
}

func writeJSON(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}

// handleHealthz is a liveness probe — the process is up.
func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, `{"status":"ok"}`)
}

// handleReadyz is a readiness probe — the service can serve traffic.
// Once a datastore is wired in (Phase 1) this will check it.
func handleReadyz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, `{"status":"ready"}`)
}

// handleRoot serves a placeholder landing page until the web app is embedded.
func handleRoot(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(placeholderHTML))
}

const placeholderHTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Granite</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.6">
<h1>🪨 Granite</h1>
<p>Open-source, self-hostable, offline-first workout tracker — under construction.</p>
<p><a href="https://github.com/MorrisMorrison/granite">github.com/MorrisMorrison/granite</a></p>
</body></html>
`
