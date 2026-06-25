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
// bodyweightRecord is the export/import shape for a weigh-in (bodyweight isn't in
// sqlc; handled with raw SQL).
type bodyweightRecord struct {
	ID         string  `json:"id"`
	Weight     float64 `json:"weight"`
	RecordedAt int64   `json:"recorded_at"`
	CreatedAt  int64   `json:"created_at"`
	UpdatedAt  int64   `json:"updated_at"`
}

type exportOutput struct {
	Body struct {
		Version        int                `json:"version"`
		ExportedAt     int64              `json:"exported_at"`
		User           userResponse       `json:"user"`
		Exercises      []exerciseResponse `json:"exercises"`
		RoutineFolders []routine.Folder   `json:"routine_folders"`
		Routines       []routine.Routine  `json:"routines"`
		Workouts       []workout.Workout  `json:"workouts"`
		Bodyweight     []bodyweightRecord `json:"bodyweight"`
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

	out.Body.Bodyweight = []bodyweightRecord{}
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, weight, recorded_at, created_at, updated_at FROM bodyweight WHERE user_id = ? AND deleted_at IS NULL ORDER BY recorded_at",
		uid)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	defer rows.Close()
	for rows.Next() {
		var r bodyweightRecord
		if err := rows.Scan(&r.ID, &r.Weight, &r.RecordedAt, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, toHumaErr(ctx, err)
		}
		out.Body.Bodyweight = append(out.Body.Bodyweight, r)
	}
	if err := rows.Err(); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return out, nil
}
