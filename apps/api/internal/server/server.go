// Package server wires the Granite HTTP API: router, middleware, and handlers.
package server

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
)

// Server holds the router and its dependencies.
type Server struct {
	router *chi.Mux
	auth   *auth.Service
	tokens *auth.TokenManager
	db     *sql.DB
}

// New constructs a Server. allowedOrigins is the CORS allow-list (typically the
// instance's public base URL).
func New(authSvc *auth.Service, tokens *auth.TokenManager, db *sql.DB, allowedOrigins []string) *Server {
	s := &Server{router: chi.NewRouter(), auth: authSvc, tokens: tokens, db: db}
	s.routes(allowedOrigins)
	return s
}

// Handler returns the root http.Handler.
func (s *Server) Handler() http.Handler { return s.router }

func (s *Server) routes(allowedOrigins []string) {
	r := s.router
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(secureHeaders)
	r.Use(requestLogger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
		MaxAge:         300,
	}))

	r.Get("/healthz", s.handleHealthz)
	r.Get("/readyz", s.handleReadyz)
	r.Get("/", s.handleRoot)

	r.Route("/api/v1", func(r chi.Router) {
		// Auth endpoints are rate-limited per IP to blunt brute-force / DoS.
		r.Group(func(r chi.Router) {
			r.Use(httprate.LimitByIP(30, time.Minute))
			r.Post("/auth/register", s.handleRegister)
			r.Post("/auth/login", s.handleLogin)
			r.Post("/auth/refresh", s.handleRefresh)
			r.Post("/auth/logout", s.handleLogout)
		})

		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Get("/me", s.handleGetMe)
			r.Patch("/me", s.handleUpdateMe)
		})
	})
}
