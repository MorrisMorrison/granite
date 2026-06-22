package server

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// registerExportRoutes wires the "own your data" export + import endpoints
// (handleImport lives in import_handlers.go).
func (s *Server) registerExportRoutes(a huma.API) {
	huma.Register(a, huma.Operation{OperationID: "exportData", Method: http.MethodGet, Path: "/api/v1/export", Summary: "Export all of your data", Tags: []string{"Export"}, Security: bearerSecurity}, s.handleExport)
	huma.Register(a, huma.Operation{OperationID: "importData", Method: http.MethodPost, Path: "/api/v1/import", Summary: "Import a previously exported dump (upsert by id, idempotent)", Tags: []string{"Export"}, Security: bearerSecurity}, s.handleImport)
}

// exportOutput is a complete, re-importable dump of the user's data ("own your
// data"). Built-in exercises are excluded (they ship with every instance).
type exportOutput struct {
	Body struct {
		Version        int                `json:"version"`
		ExportedAt     int64              `json:"exported_at"`
		User           userResponse       `json:"user"`
		Exercises      []exerciseResponse `json:"exercises"`
		RoutineFolders []routine.Folder   `json:"routine_folders"`
		Routines       []routine.Routine  `json:"routines"`
		Workouts       []workout.Workout  `json:"workouts"`
	}
}

func (s *Server) handleExport(ctx context.Context, _ *struct{}) (*exportOutput, error) {
	uid := userIDFromCtx(ctx)

	user, err := s.auth.GetUser(ctx, uid)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	exs, err := s.exercise.List(ctx, uid)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	folders, err := s.routine.ListFolders(ctx, uid)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	routines, err := s.routine.ListFull(ctx, uid)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	workouts, err := s.workout.ListFull(ctx, uid)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}

	out := &exportOutput{}
	out.Body.Version = 1
	out.Body.ExportedAt = time.Now().UnixMilli()
	out.Body.User = toUserResponse(user)
	out.Body.Exercises = []exerciseResponse{}
	for _, e := range exs {
		if !e.IsBuiltin {
			out.Body.Exercises = append(out.Body.Exercises, toExerciseResponse(e))
		}
	}
	out.Body.RoutineFolders = folders
	if out.Body.RoutineFolders == nil {
		out.Body.RoutineFolders = []routine.Folder{}
	}
	out.Body.Routines = routines
	if out.Body.Routines == nil {
		out.Body.Routines = []routine.Routine{}
	}
	out.Body.Workouts = workouts
	if out.Body.Workouts == nil {
		out.Body.Workouts = []workout.Workout{}
	}
	return out, nil
}
