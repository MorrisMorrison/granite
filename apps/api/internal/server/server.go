// Package server wires the Granite HTTP API: a chi router for health/static +
// rate limiting, with a huma API (code-first OpenAPI) for the JSON endpoints.
package server

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	syncpkg "github.com/MorrisMorrison/granite/apps/api/internal/sync"
	"github.com/MorrisMorrison/granite/apps/api/internal/webui"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// bearerSecurity marks an operation as requiring a Bearer access token.
var bearerSecurity = []map[string][]string{{"bearer": {}}}

// Server holds the router, huma API, and dependencies.
type Server struct {
	router   *chi.Mux
	api      huma.API
	auth     *auth.Service
	exercise *exercise.Service
	routine  *routine.Service
	workout  *workout.Service
	sync     *syncpkg.Service
	tokens   *auth.TokenManager
	db       *sql.DB
	web      http.Handler
}

// New constructs a Server. allowedOrigins is the CORS allow-list.
func New(authSvc *auth.Service, exerciseSvc *exercise.Service, routineSvc *routine.Service, workoutSvc *workout.Service, syncSvc *syncpkg.Service, tokens *auth.TokenManager, db *sql.DB, allowedOrigins []string) *Server {
	s := &Server{router: chi.NewRouter(), auth: authSvc, exercise: exerciseSvc, routine: routineSvc, workout: workoutSvc, sync: syncSvc, tokens: tokens, db: db, web: webui.Handler()}
	s.setupRouter(allowedOrigins)
	s.setupAPI()
	s.registerRoutes()
	return s
}

// Handler returns the root http.Handler.
func (s *Server) Handler() http.Handler { return s.router }

// OpenAPIYAML returns the generated OpenAPI 3.1 document (the source of truth for
// the generated TypeScript client). Safe to call on a Server built with nil
// dependencies, since spec generation never invokes the handlers.
func (s *Server) OpenAPIYAML() ([]byte, error) {
	return s.api.OpenAPI().YAML()
}

func (s *Server) setupRouter(allowedOrigins []string) {
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

	// Per-IP rate limits: a strict bucket on the auth endpoints (brute-force defense)
	// and a generous bucket on the rest of the API (DoS / amplification defense — the
	// token-auth path hashes + hits the DB on every authenticated request).
	authLimiter := httprate.LimitByIP(30, time.Minute)
	apiLimiter := httprate.LimitByIP(600, time.Minute)
	r.Use(func(next http.Handler) http.Handler {
		limitedAuth := authLimiter(next)
		limitedAPI := apiLimiter(next)
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			switch {
			case strings.HasPrefix(req.URL.Path, "/api/v1/auth/"):
				limitedAuth.ServeHTTP(w, req)
			case strings.HasPrefix(req.URL.Path, "/api/v1/"):
				limitedAPI.ServeHTTP(w, req)
			default:
				next.ServeHTTP(w, req)
			}
		})
	})

	// Liveness/readiness on plain chi; everything else (the web app + its assets)
	// falls through to the embedded SPA handler.
	r.Get("/healthz", s.handleHealthz)
	r.Get("/readyz", s.handleReadyz)
	r.NotFound(s.handleNotFound)
}

func (s *Server) setupAPI() {
	cfg := huma.DefaultConfig("Granite API", "0.1.0")
	cfg.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		"bearer": {Type: "http", Scheme: "bearer", BearerFormat: "JWT"},
	}
	s.api = humachi.New(s.router, cfg)
	s.api.UseMiddleware(newAuthMiddleware(s.api, s.tokens, s.auth))
}

// registerRoutes wires every API operation. Each domain owns its own route table
// in its *_handlers.go file (registerXRoutes); this just calls them in order so
// server.go stays a thin wiring layer.
func (s *Server) registerRoutes() {
	a := s.api
	s.registerAuthRoutes(a)
	s.registerUserRoutes(a)
	s.registerTokenRoutes(a)
	s.registerExerciseRoutes(a)
	s.registerRoutineRoutes(a)
	s.registerWorkoutRoutes(a)
	s.registerSyncRoutes(a)
	s.registerExportRoutes(a)
	s.registerServerInfoRoutes(a)
}
