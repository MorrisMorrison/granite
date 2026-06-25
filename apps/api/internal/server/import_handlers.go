package server

import (
	"context"
	"encoding/json"
	"time"

	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	syncpkg "github.com/MorrisMorrison/granite/apps/api/internal/sync"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// importInput accepts a Granite export (the shape produced by handleExport). The
// version/user/exported_at fields are accepted but ignored — records load into the
// authenticated account, keeping their ids. Records are upserted last-write-wins by
// updated_at (so re-importing is idempotent), and ownership is enforced: you can't
// clobber another account's record that happens to share an id.
type importInput struct {
	Body struct {
		// Accepted but ignored — present in a real export envelope.
		Version    int    `json:"version,omitempty"`
		ExportedAt int64  `json:"exported_at,omitempty"`
		User       any    `json:"user,omitempty"`
		// The data we actually load.
		Exercises      []exerciseResponse `json:"exercises"`
		RoutineFolders []routine.Folder   `json:"routine_folders"`
		Routines       []routine.Routine  `json:"routines"`
		Workouts       []workout.Workout  `json:"workouts"`
		Bodyweight     []bodyweightRecord `json:"bodyweight"`
	}
}

type importOutput struct {
	Body struct {
		Imported struct {
			Exercises int `json:"exercises"`
			Folders   int `json:"folders"`
			Routines  int `json:"routines"`
			Workouts  int `json:"workouts"`
		} `json:"imported"`
	}
}

func (s *Server) handleImport(ctx context.Context, in *importInput) (*importOutput, error) {
	uid := userIDFromCtx(ctx)
	now := time.Now().UnixMilli()

	var changes []syncpkg.Change
	entityByID := map[string]string{}
	add := func(entity, id string, updatedAt int64, v any) error {
		if id == "" {
			return nil
		}
		data, err := json.Marshal(v)
		if err != nil {
			return err
		}
		if updatedAt == 0 {
			updatedAt = now
		}
		changes = append(changes, syncpkg.Change{Entity: entity, ID: id, UpdatedAt: updatedAt, Data: data})
		entityByID[id] = entity
		return nil
	}

	for _, e := range in.Body.Exercises {
		if e.IsBuiltin {
			continue // built-ins ship with every instance
		}
		if err := add(syncpkg.EntityExercise, e.ID, e.UpdatedAt, e); err != nil {
			return nil, toHumaErr(ctx, err)
		}
	}
	for _, f := range in.Body.RoutineFolders {
		if err := add(syncpkg.EntityRoutineFolder, f.ID, f.UpdatedAt, f); err != nil {
			return nil, toHumaErr(ctx, err)
		}
	}
	for _, r := range in.Body.Routines {
		if err := add(syncpkg.EntityRoutine, r.ID, r.UpdatedAt, r); err != nil {
			return nil, toHumaErr(ctx, err)
		}
	}
	for _, w := range in.Body.Workouts {
		if err := add(syncpkg.EntityWorkout, w.ID, w.UpdatedAt, w); err != nil {
			return nil, toHumaErr(ctx, err)
		}
	}
	for _, b := range in.Body.Bodyweight {
		if err := add(syncpkg.EntityBodyweight, b.ID, b.UpdatedAt, b); err != nil {
			return nil, toHumaErr(ctx, err)
		}
	}

	applied, err := s.sync.Push(ctx, uid, changes)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}

	out := &importOutput{}
	for _, id := range applied {
		switch entityByID[id] {
		case syncpkg.EntityExercise:
			out.Body.Imported.Exercises++
		case syncpkg.EntityRoutineFolder:
			out.Body.Imported.Folders++
		case syncpkg.EntityRoutine:
			out.Body.Imported.Routines++
		case syncpkg.EntityWorkout:
			out.Body.Imported.Workouts++
		}
	}
	return out, nil
}
