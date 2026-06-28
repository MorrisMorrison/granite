// Package sync implements offline-first delta sync: clients pull changes since a
// cursor and push their local changes, reconciled last-write-wins by updated_at.
//
// The cursor is a per-user monotonic server_seq (assigned by DB triggers on every
// write — see migration 00009); pull is strict (> cursor). This is clock-independent
// and survives backdated writes (imports keep their old updated_at but get a fresh,
// higher seq), so incremental pull never skips them. Apply is still idempotent and
// last-write-wins by updated_at. Entities sync at aggregate granularity (a
// routine/workout travels with its children); per-child-record sync remains a
// future option noted in ADR-0008.
package sync

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/sqlnull"
)

// Entity identifiers, ordered by foreign-key dependency for push apply / pull return.
const (
	EntityExercise      = "exercise"
	EntityRoutineFolder = "routine_folder"
	EntityRoutine       = "routine"
	EntityWorkout       = "workout"
	EntityBodyweight    = "bodyweight"
)

var entityOrder = []string{
	EntityExercise,
	EntityRoutineFolder,
	EntityRoutine,
	EntityWorkout,
	EntityBodyweight,
}

// Change is one record's state in the sync stream.
type Change struct {
	Entity    string          `json:"entity"`
	ID        string          `json:"id"`
	UpdatedAt int64           `json:"updated_at"`
	Deleted   bool            `json:"deleted"`
	Data      json.RawMessage `json:"data"`
}

// Service implements pull/push over the user's syncable data.
type Service struct {
	db *sql.DB
	q  *sqlc.Queries
}

func NewService(db *sql.DB, q *sqlc.Queries) *Service {
	return &Service{db: db, q: q}
}

// Pull returns all of the user's changes with server_seq > since, in FK-dependency
// order, plus the new cursor (max server_seq seen, or since if nothing changed).
func (s *Service) Pull(ctx context.Context, userID string, since int64) ([]Change, int64, error) {
	var changes []Change
	cursor := since
	add := func(c Change, seq int64) {
		changes = append(changes, c)
		if seq > cursor {
			cursor = seq
		}
	}

	exs, err := s.q.ChangedExercises(ctx, sqlc.ChangedExercisesParams{UserID: sql.NullString{String: userID, Valid: true}, ServerSeq: since})
	if err != nil {
		return nil, since, err
	}
	for _, e := range exs {
		add(Change{Entity: EntityExercise, ID: e.ID, UpdatedAt: e.UpdatedAt, Deleted: e.DeletedAt.Valid, Data: mustJSON(exerciseData{
			Name: e.Name, ExerciseType: e.ExerciseType, PrimaryMuscle: e.PrimaryMuscle,
			SecondaryMuscles: json.RawMessage(e.SecondaryMuscles), Equipment: e.Equipment,
			Instructions: e.Instructions, IsArchived: e.IsArchived != 0, CreatedAt: e.CreatedAt,
		})}, e.ServerSeq)
	}

	folders, err := s.q.ChangedRoutineFolders(ctx, sqlc.ChangedRoutineFoldersParams{UserID: userID, ServerSeq: since})
	if err != nil {
		return nil, since, err
	}
	for _, f := range folders {
		add(Change{Entity: EntityRoutineFolder, ID: f.ID, UpdatedAt: f.UpdatedAt, Deleted: f.DeletedAt.Valid, Data: mustJSON(folderData{
			Name: f.Name, OrderIndex: f.OrderIndex, CreatedAt: f.CreatedAt,
		})}, f.ServerSeq)
	}

	routines, err := s.q.ChangedRoutines(ctx, sqlc.ChangedRoutinesParams{UserID: userID, ServerSeq: since})
	if err != nil {
		return nil, since, err
	}
	for _, r := range routines {
		d := routineData{FolderID: sqlnull.StringPtr(r.FolderID), Title: r.Title, Notes: r.Notes, OrderIndex: r.OrderIndex, CreatedAt: r.CreatedAt}
		if !r.DeletedAt.Valid {
			if d.Exercises, err = s.loadRoutineChildren(ctx, r.ID); err != nil {
				return nil, since, err
			}
		}
		add(Change{Entity: EntityRoutine, ID: r.ID, UpdatedAt: r.UpdatedAt, Deleted: r.DeletedAt.Valid, Data: mustJSON(d)}, r.ServerSeq)
	}

	workouts, err := s.q.ChangedWorkouts(ctx, sqlc.ChangedWorkoutsParams{UserID: userID, ServerSeq: since})
	if err != nil {
		return nil, since, err
	}
	for _, w := range workouts {
		d := workoutData{RoutineID: sqlnull.StringPtr(w.RoutineID), Title: w.Title, Notes: w.Notes, StartTime: w.StartTime, EndTime: sqlnull.Int64Ptr(w.EndTime), CreatedAt: w.CreatedAt}
		if !w.DeletedAt.Valid {
			if d.Exercises, err = s.loadWorkoutChildren(ctx, w.ID); err != nil {
				return nil, since, err
			}
		}
		add(Change{Entity: EntityWorkout, ID: w.ID, UpdatedAt: w.UpdatedAt, Deleted: w.DeletedAt.Valid, Data: mustJSON(d)}, w.ServerSeq)
	}

	// Bodyweight (raw SQL — not in sqlc; mirrors the entity pattern above).
	bwRows, err := s.db.QueryContext(ctx,
		`SELECT id, weight, recorded_at, created_at, updated_at, deleted_at, server_seq FROM bodyweight WHERE user_id = ? AND server_seq > ?`,
		userID, since)
	if err != nil {
		return nil, since, err
	}
	defer bwRows.Close()
	for bwRows.Next() {
		var id string
		var weight float64
		var recordedAt, createdAt, updatedAt, serverSeq int64
		var deletedAt sql.NullInt64
		if err := bwRows.Scan(&id, &weight, &recordedAt, &createdAt, &updatedAt, &deletedAt, &serverSeq); err != nil {
			return nil, since, err
		}
		add(Change{Entity: EntityBodyweight, ID: id, UpdatedAt: updatedAt, Deleted: deletedAt.Valid,
			Data: mustJSON(bodyweightData{Weight: weight, RecordedAt: recordedAt, CreatedAt: createdAt})}, serverSeq)
	}
	if err := bwRows.Err(); err != nil {
		return nil, since, err
	}

	if changes == nil {
		changes = []Change{}
	}
	return changes, cursor, nil
}

// Push applies a client's changes (LWW by updated_at, scoped to the user) and
// returns the ids that were applied. Changes are applied in FK-dependency order.
func (s *Service) Push(ctx context.Context, userID string, changes []Change) ([]string, error) {
	byEntity := map[string][]Change{}
	for _, c := range changes {
		byEntity[c.Entity] = append(byEntity[c.Entity], c)
	}
	applied := []string{}
	for _, entity := range entityOrder {
		for _, c := range byEntity[entity] {
			ok, err := s.apply(ctx, userID, c)
			if err != nil {
				return nil, err
			}
			if ok {
				applied = append(applied, c.ID)
			}
		}
	}
	return applied, nil
}

// CurrentSeq returns the user's latest server_seq — the cursor to resume a pull
// from after a push. Zero if the user has no synced rows yet.
func (s *Service) CurrentSeq(ctx context.Context, userID string) (int64, error) {
	var seq int64
	err := s.db.QueryRowContext(ctx,
		"SELECT COALESCE((SELECT last_seq FROM sync_state WHERE user_id = ?), 0)", userID).Scan(&seq)
	return seq, err
}

func (s *Service) apply(ctx context.Context, userID string, c Change) (bool, error) {
	switch c.Entity {
	case EntityExercise:
		return s.applyExercise(ctx, userID, c)
	case EntityRoutineFolder:
		return s.applyFolder(ctx, userID, c)
	case EntityRoutine:
		return s.applyRoutine(ctx, userID, c)
	case EntityWorkout:
		return s.applyWorkout(ctx, userID, c)
	case EntityBodyweight:
		return s.applyBodyweight(ctx, userID, c)
	default:
		return false, nil
	}
}

func deletedAt(c Change) sql.NullInt64 {
	if c.Deleted {
		return sql.NullInt64{Int64: c.UpdatedAt, Valid: true}
	}
	return sql.NullInt64{}
}
