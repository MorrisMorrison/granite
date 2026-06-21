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
	tokens   *auth.TokenManager
	db       *sql.DB
	web      http.Handler
}

// New constructs a Server. allowedOrigins is the CORS allow-list.
func New(authSvc *auth.Service, exerciseSvc *exercise.Service, routineSvc *routine.Service, workoutSvc *workout.Service, tokens *auth.TokenManager, db *sql.DB, allowedOrigins []string) *Server {
	s := &Server{router: chi.NewRouter(), auth: authSvc, exercise: exerciseSvc, routine: routineSvc, workout: workoutSvc, tokens: tokens, db: db, web: webui.Handler()}
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

	// Rate-limit only the auth endpoints (brute-force / DoS defense).
	authLimiter := httprate.LimitByIP(30, time.Minute)
	r.Use(func(next http.Handler) http.Handler {
		limited := authLimiter(next)
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if strings.HasPrefix(req.URL.Path, "/api/v1/auth/") {
				limited.ServeHTTP(w, req)
				return
			}
			next.ServeHTTP(w, req)
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
	s.api.UseMiddleware(newAuthMiddleware(s.api, s.tokens))
}

func (s *Server) registerRoutes() {
	a := s.api

	// Auth
	huma.Register(a, huma.Operation{OperationID: "register", Method: http.MethodPost, Path: "/api/v1/auth/register", Summary: "Register a new account", Tags: []string{"Auth"}, DefaultStatus: http.StatusCreated}, s.handleRegister)
	huma.Register(a, huma.Operation{OperationID: "login", Method: http.MethodPost, Path: "/api/v1/auth/login", Summary: "Log in", Tags: []string{"Auth"}}, s.handleLogin)
	huma.Register(a, huma.Operation{OperationID: "refresh", Method: http.MethodPost, Path: "/api/v1/auth/refresh", Summary: "Rotate tokens", Tags: []string{"Auth"}}, s.handleRefresh)
	huma.Register(a, huma.Operation{OperationID: "logout", Method: http.MethodPost, Path: "/api/v1/auth/logout", Summary: "Log out", Tags: []string{"Auth"}, DefaultStatus: http.StatusNoContent}, s.handleLogout)

	// User
	huma.Register(a, huma.Operation{OperationID: "getMe", Method: http.MethodGet, Path: "/api/v1/me", Summary: "Get the current user", Tags: []string{"User"}, Security: bearerSecurity}, s.handleGetMe)
	huma.Register(a, huma.Operation{OperationID: "updateMe", Method: http.MethodPatch, Path: "/api/v1/me", Summary: "Update the current user", Tags: []string{"User"}, Security: bearerSecurity}, s.handleUpdateMe)

	// Exercises
	huma.Register(a, huma.Operation{OperationID: "listExercises", Method: http.MethodGet, Path: "/api/v1/exercises", Summary: "List exercises (yours + built-in)", Tags: []string{"Exercises"}, Security: bearerSecurity}, s.handleListExercises)
	huma.Register(a, huma.Operation{OperationID: "createExercise", Method: http.MethodPost, Path: "/api/v1/exercises", Summary: "Create a custom exercise", Tags: []string{"Exercises"}, Security: bearerSecurity, DefaultStatus: http.StatusCreated}, s.handleCreateExercise)
	huma.Register(a, huma.Operation{OperationID: "getExercise", Method: http.MethodGet, Path: "/api/v1/exercises/{id}", Summary: "Get an exercise", Tags: []string{"Exercises"}, Security: bearerSecurity}, s.handleGetExercise)
	huma.Register(a, huma.Operation{OperationID: "updateExercise", Method: http.MethodPatch, Path: "/api/v1/exercises/{id}", Summary: "Update a custom exercise", Tags: []string{"Exercises"}, Security: bearerSecurity}, s.handleUpdateExercise)
	huma.Register(a, huma.Operation{OperationID: "deleteExercise", Method: http.MethodDelete, Path: "/api/v1/exercises/{id}", Summary: "Delete a custom exercise", Tags: []string{"Exercises"}, Security: bearerSecurity, DefaultStatus: http.StatusNoContent}, s.handleDeleteExercise)

	// Routine folders
	huma.Register(a, huma.Operation{OperationID: "listRoutineFolders", Method: http.MethodGet, Path: "/api/v1/routine-folders", Summary: "List routine folders", Tags: []string{"Routines"}, Security: bearerSecurity}, s.handleListFolders)
	huma.Register(a, huma.Operation{OperationID: "createRoutineFolder", Method: http.MethodPost, Path: "/api/v1/routine-folders", Summary: "Create a routine folder", Tags: []string{"Routines"}, Security: bearerSecurity, DefaultStatus: http.StatusCreated}, s.handleCreateFolder)
	huma.Register(a, huma.Operation{OperationID: "updateRoutineFolder", Method: http.MethodPatch, Path: "/api/v1/routine-folders/{id}", Summary: "Update a routine folder", Tags: []string{"Routines"}, Security: bearerSecurity}, s.handleUpdateFolder)
	huma.Register(a, huma.Operation{OperationID: "deleteRoutineFolder", Method: http.MethodDelete, Path: "/api/v1/routine-folders/{id}", Summary: "Delete a routine folder", Tags: []string{"Routines"}, Security: bearerSecurity, DefaultStatus: http.StatusNoContent}, s.handleDeleteFolder)

	// Routines
	huma.Register(a, huma.Operation{OperationID: "listRoutines", Method: http.MethodGet, Path: "/api/v1/routines", Summary: "List routines (metadata)", Tags: []string{"Routines"}, Security: bearerSecurity}, s.handleListRoutines)
	huma.Register(a, huma.Operation{OperationID: "createRoutine", Method: http.MethodPost, Path: "/api/v1/routines", Summary: "Create a routine", Tags: []string{"Routines"}, Security: bearerSecurity, DefaultStatus: http.StatusCreated}, s.handleCreateRoutine)
	huma.Register(a, huma.Operation{OperationID: "getRoutine", Method: http.MethodGet, Path: "/api/v1/routines/{id}", Summary: "Get a routine (full)", Tags: []string{"Routines"}, Security: bearerSecurity}, s.handleGetRoutine)
	huma.Register(a, huma.Operation{OperationID: "updateRoutine", Method: http.MethodPatch, Path: "/api/v1/routines/{id}", Summary: "Update a routine", Tags: []string{"Routines"}, Security: bearerSecurity}, s.handleUpdateRoutine)
	huma.Register(a, huma.Operation{OperationID: "deleteRoutine", Method: http.MethodDelete, Path: "/api/v1/routines/{id}", Summary: "Delete a routine", Tags: []string{"Routines"}, Security: bearerSecurity, DefaultStatus: http.StatusNoContent}, s.handleDeleteRoutine)

	// Workouts
	huma.Register(a, huma.Operation{OperationID: "listWorkouts", Method: http.MethodGet, Path: "/api/v1/workouts", Summary: "List workouts (metadata)", Tags: []string{"Workouts"}, Security: bearerSecurity}, s.handleListWorkouts)
	huma.Register(a, huma.Operation{OperationID: "createWorkout", Method: http.MethodPost, Path: "/api/v1/workouts", Summary: "Log a workout", Tags: []string{"Workouts"}, Security: bearerSecurity, DefaultStatus: http.StatusCreated}, s.handleCreateWorkout)
	huma.Register(a, huma.Operation{OperationID: "getWorkout", Method: http.MethodGet, Path: "/api/v1/workouts/{id}", Summary: "Get a workout (full)", Tags: []string{"Workouts"}, Security: bearerSecurity}, s.handleGetWorkout)
	huma.Register(a, huma.Operation{OperationID: "updateWorkout", Method: http.MethodPatch, Path: "/api/v1/workouts/{id}", Summary: "Update a workout", Tags: []string{"Workouts"}, Security: bearerSecurity}, s.handleUpdateWorkout)
	huma.Register(a, huma.Operation{OperationID: "deleteWorkout", Method: http.MethodDelete, Path: "/api/v1/workouts/{id}", Summary: "Delete a workout", Tags: []string{"Workouts"}, Security: bearerSecurity, DefaultStatus: http.StatusNoContent}, s.handleDeleteWorkout)

	// Export
	huma.Register(a, huma.Operation{OperationID: "exportData", Method: http.MethodGet, Path: "/api/v1/export", Summary: "Export all of your data", Tags: []string{"Export"}, Security: bearerSecurity}, s.handleExport)
}
