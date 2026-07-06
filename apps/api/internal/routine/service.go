// Package routine provides routine-folder and routine (nested template) use-cases.
package routine

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/sqlnull"
)

// Service implements routine + folder use-cases. Nested writes run in a tx.
type Service struct {
	db  *sql.DB
	q   *sqlc.Queries
	now func() time.Time
}

// NewService constructs a routine Service.
func NewService(db *sql.DB, q *sqlc.Queries) *Service {
	return &Service{db: db, q: q, now: time.Now}
}

var validSetTypes = map[string]bool{"normal": true, "warmup": true, "drop": true, "failure": true}

// --- Domain types -----------------------------------------------------------

type Folder struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	OrderIndex int    `json:"order_index"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}

type Set struct {
	ID             string   `json:"id"`
	OrderIndex     int      `json:"order_index"`
	SetType        string   `json:"set_type"`
	TargetWeight   *float64 `json:"target_weight"`
	TargetReps     *int     `json:"target_reps"`
	TargetRPE      *float64 `json:"target_rpe"`
	TargetDuration *int     `json:"target_duration"`
}

type Exercise struct {
	ID            string `json:"id"`
	ExerciseID    string `json:"exercise_id"`
	OrderIndex    int    `json:"order_index"`
	Notes         string `json:"notes"`
	RestSeconds   int    `json:"rest_seconds"`
	SupersetGroup *int   `json:"superset_group"`
	Sets          []Set  `json:"sets"`
}

type Routine struct {
	ID         string     `json:"id"`
	FolderID   *string    `json:"folder_id"`
	Title      string     `json:"title"`
	Notes      string     `json:"notes"`
	OrderIndex int        `json:"order_index"`
	Exercises  []Exercise `json:"exercises"`
	CreatedAt  int64      `json:"created_at"`
	UpdatedAt  int64      `json:"updated_at"`
}

// --- Inputs -----------------------------------------------------------------

type FolderInput struct {
	Name       string `json:"name"`
	OrderIndex int    `json:"order_index,omitempty"`
}

type SetInput struct {
	SetType        string   `json:"set_type,omitempty"`
	TargetWeight   *float64 `json:"target_weight,omitempty" minimum:"0"`
	TargetReps     *int     `json:"target_reps,omitempty" minimum:"0"`
	TargetRPE      *float64 `json:"target_rpe,omitempty" minimum:"0" maximum:"10"`
	TargetDuration *int     `json:"target_duration,omitempty" minimum:"0"`
}

type ExerciseInput struct {
	ExerciseID    string     `json:"exercise_id"`
	Notes         string     `json:"notes,omitempty"`
	RestSeconds   int        `json:"rest_seconds,omitempty" minimum:"0"`
	SupersetGroup *int       `json:"superset_group,omitempty"`
	Sets          []SetInput `json:"sets,omitempty"`
}

type RoutineInput struct {
	Title      string          `json:"title"`
	Notes      string          `json:"notes,omitempty"`
	FolderID   *string         `json:"folder_id,omitempty"`
	OrderIndex int             `json:"order_index,omitempty"`
	Exercises  []ExerciseInput `json:"exercises,omitempty"`
}

// --- Folders ----------------------------------------------------------------

func (s *Service) ListFolders(ctx context.Context, userID string) ([]Folder, error) {
	rows, err := s.q.ListRoutineFolders(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Folder, 0, len(rows))
	for _, r := range rows {
		out = append(out, toFolder(r))
	}
	return out, nil
}

func (s *Service) CreateFolder(ctx context.Context, userID string, in FolderInput) (Folder, error) {
	if strings.TrimSpace(in.Name) == "" {
		return Folder{}, apperr.Validation("folder name is required")
	}
	now := s.now().UnixMilli()
	f, err := s.q.CreateRoutineFolder(ctx, sqlc.CreateRoutineFolderParams{
		ID: uuid.NewString(), UserID: userID, Name: strings.TrimSpace(in.Name),
		OrderIndex: int64(in.OrderIndex), CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		return Folder{}, err
	}
	return toFolder(f), nil
}

func (s *Service) UpdateFolder(ctx context.Context, userID, id string, in FolderInput) (Folder, error) {
	if strings.TrimSpace(in.Name) == "" {
		return Folder{}, apperr.Validation("folder name is required")
	}
	f, err := s.q.UpdateRoutineFolder(ctx, sqlc.UpdateRoutineFolderParams{
		Name: strings.TrimSpace(in.Name), OrderIndex: int64(in.OrderIndex),
		UpdatedAt: s.now().UnixMilli(), ID: id, UserID: userID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Folder{}, apperr.NotFound("folder not found")
	}
	if err != nil {
		return Folder{}, err
	}
	return toFolder(f), nil
}

// DeleteFolder soft-deletes a folder and, in the same transaction, nulls the
// folder_id on the user's routines that pointed at it. Without this, those
// routines would keep a dangling reference to a folder that no longer lists,
// and a GET->PATCH of such a routine would fail validation ("unknown folder").
func (s *Service) DeleteFolder(ctx context.Context, userID, id string) error {
	now := s.now().UnixMilli()
	var deleted int64
	err := s.inTx(ctx, func(qtx *sqlc.Queries) error {
		rows, err := qtx.SoftDeleteRoutineFolder(ctx, sqlc.SoftDeleteRoutineFolderParams{
			DeletedAt: sql.NullInt64{Int64: now, Valid: true}, UpdatedAt: now, ID: id, UserID: userID,
		})
		if err != nil {
			return err
		}
		deleted = rows
		if rows == 0 {
			return nil
		}
		return qtx.ClearRoutinesFolder(ctx, sqlc.ClearRoutinesFolderParams{
			UpdatedAt: now, FolderID: sql.NullString{String: id, Valid: true}, UserID: userID,
		})
	})
	if err != nil {
		return err
	}
	if deleted == 0 {
		return apperr.NotFound("folder not found")
	}
	return nil
}

// --- Routines ---------------------------------------------------------------

// ListRoutines returns the user's routines (metadata only; use Get for the full
// nested form).
func (s *Service) ListRoutines(ctx context.Context, userID string) ([]Routine, error) {
	rows, err := s.q.ListRoutines(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Routine, 0, len(rows))
	for _, r := range rows {
		out = append(out, Routine{
			ID: r.ID, FolderID: sqlnull.StringPtr(r.FolderID), Title: r.Title, Notes: r.Notes,
			OrderIndex: int(r.OrderIndex), Exercises: []Exercise{},
			CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		})
	}
	return out, nil
}

// ListFull returns the user's routines with all nested exercises and sets (used by export).
func (s *Service) ListFull(ctx context.Context, userID string) ([]Routine, error) {
	rows, err := s.q.ListRoutines(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Routine, 0, len(rows))
	for _, r := range rows {
		full, err := s.loadNested(ctx, r)
		if err != nil {
			return nil, err
		}
		out = append(out, full)
	}
	return out, nil
}

// Get returns a routine with its exercises and sets.
func (s *Service) Get(ctx context.Context, userID, id string) (Routine, error) {
	r, err := s.q.GetRoutine(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return Routine{}, apperr.NotFound("routine not found")
	}
	if err != nil {
		return Routine{}, err
	}
	if r.UserID != userID {
		return Routine{}, apperr.NotFound("routine not found")
	}
	return s.loadNested(ctx, r)
}

// Create builds a routine with its exercises and sets in a transaction.
func (s *Service) Create(ctx context.Context, userID string, in RoutineInput) (Routine, error) {
	if err := s.validate(ctx, userID, in); err != nil {
		return Routine{}, err
	}
	now := s.now().UnixMilli()
	id := uuid.NewString()
	err := s.inTx(ctx, func(qtx *sqlc.Queries) error {
		if _, err := qtx.CreateRoutine(ctx, sqlc.CreateRoutineParams{
			ID: id, UserID: userID, FolderID: sqlnull.String(in.FolderID), Title: strings.TrimSpace(in.Title),
			Notes: in.Notes, OrderIndex: int64(in.OrderIndex), CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
		return insertChildren(ctx, qtx, id, in.Exercises, now)
	})
	if err != nil {
		return Routine{}, err
	}
	return s.Get(ctx, userID, id)
}

// Update replaces a routine's metadata and its children in a transaction.
func (s *Service) Update(ctx context.Context, userID, id string, in RoutineInput) (Routine, error) {
	if err := s.validate(ctx, userID, in); err != nil {
		return Routine{}, err
	}
	r, err := s.q.GetRoutine(ctx, id)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && r.UserID != userID) {
		return Routine{}, apperr.NotFound("routine not found")
	}
	if err != nil {
		return Routine{}, err
	}
	now := s.now().UnixMilli()
	err = s.inTx(ctx, func(qtx *sqlc.Queries) error {
		if _, err := qtx.UpdateRoutineMeta(ctx, sqlc.UpdateRoutineMetaParams{
			FolderID: sqlnull.String(in.FolderID), Title: strings.TrimSpace(in.Title), Notes: in.Notes,
			OrderIndex: int64(in.OrderIndex), UpdatedAt: now, ID: id, UserID: userID,
		}); err != nil {
			return err
		}
		if err := qtx.DeleteRoutineExercisesByRoutine(ctx, id); err != nil {
			return err
		}
		return insertChildren(ctx, qtx, id, in.Exercises, now)
	})
	if err != nil {
		return Routine{}, err
	}
	return s.Get(ctx, userID, id)
}

// Delete soft-deletes a routine.
func (s *Service) Delete(ctx context.Context, userID, id string) error {
	now := s.now().UnixMilli()
	rows, err := s.q.SoftDeleteRoutine(ctx, sqlc.SoftDeleteRoutineParams{
		DeletedAt: sql.NullInt64{Int64: now, Valid: true}, UpdatedAt: now, ID: id, UserID: userID,
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return apperr.NotFound("routine not found")
	}
	return nil
}

// --- helpers ----------------------------------------------------------------

func (s *Service) inTx(ctx context.Context, fn func(*sqlc.Queries) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := fn(s.q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit()
}

func insertChildren(ctx context.Context, qtx *sqlc.Queries, routineID string, exs []ExerciseInput, now int64) error {
	for ei, ex := range exs {
		reID := uuid.NewString()
		if _, err := qtx.CreateRoutineExercise(ctx, sqlc.CreateRoutineExerciseParams{
			ID: reID, RoutineID: routineID, ExerciseID: ex.ExerciseID, OrderIndex: int64(ei),
			Notes: ex.Notes, RestSeconds: int64(ex.RestSeconds), SupersetGroup: sqlnull.Int(ex.SupersetGroup),
			CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
		for si, st := range ex.Sets {
			setType := st.SetType
			if setType == "" {
				setType = "normal"
			}
			if _, err := qtx.CreateRoutineSet(ctx, sqlc.CreateRoutineSetParams{
				ID: uuid.NewString(), RoutineExerciseID: reID, OrderIndex: int64(si), SetType: setType,
				TargetWeight: sqlnull.Float64(st.TargetWeight), TargetReps: sqlnull.Int(st.TargetReps),
				TargetRpe: sqlnull.Float64(st.TargetRPE), TargetDuration: sqlnull.Int(st.TargetDuration),
				CreatedAt: now, UpdatedAt: now,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) loadNested(ctx context.Context, r sqlc.Routine) (Routine, error) {
	out := Routine{
		ID: r.ID, FolderID: sqlnull.StringPtr(r.FolderID), Title: r.Title, Notes: r.Notes,
		OrderIndex: int(r.OrderIndex), CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		Exercises: []Exercise{},
	}
	exs, err := s.q.ListRoutineExercises(ctx, r.ID)
	if err != nil {
		return Routine{}, err
	}
	sets, err := s.q.ListRoutineSetsForRoutine(ctx, r.ID)
	if err != nil {
		return Routine{}, err
	}
	byRE := map[string][]Set{}
	for _, st := range sets {
		byRE[st.RoutineExerciseID] = append(byRE[st.RoutineExerciseID], Set{
			ID: st.ID, OrderIndex: int(st.OrderIndex), SetType: st.SetType,
			TargetWeight: sqlnull.Float64Ptr(st.TargetWeight), TargetReps: sqlnull.IntPtr(st.TargetReps),
			TargetRPE: sqlnull.Float64Ptr(st.TargetRpe), TargetDuration: sqlnull.IntPtr(st.TargetDuration),
		})
	}
	for _, e := range exs {
		setsForE := byRE[e.ID]
		if setsForE == nil {
			setsForE = []Set{}
		}
		out.Exercises = append(out.Exercises, Exercise{
			ID: e.ID, ExerciseID: e.ExerciseID, OrderIndex: int(e.OrderIndex), Notes: e.Notes,
			RestSeconds: int(e.RestSeconds), SupersetGroup: sqlnull.IntPtr(e.SupersetGroup), Sets: setsForE,
		})
	}
	return out, nil
}

func (s *Service) validate(ctx context.Context, userID string, in RoutineInput) error {
	if strings.TrimSpace(in.Title) == "" {
		return apperr.Validation("routine title is required")
	}
	if in.FolderID != nil {
		f, err := s.q.GetRoutineFolder(ctx, *in.FolderID)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && f.UserID != userID) {
			return apperr.Validation("unknown folder")
		}
		if err != nil {
			return err
		}
	}
	for _, ex := range in.Exercises {
		e, err := s.q.GetExercise(ctx, ex.ExerciseID)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && e.UserID.Valid && e.UserID.String != userID) {
			return apperr.Validation("unknown exercise: " + ex.ExerciseID)
		}
		if err != nil {
			return err
		}
		for _, st := range ex.Sets {
			if st.SetType != "" && !validSetTypes[st.SetType] {
				return apperr.Validation("invalid set_type: " + st.SetType)
			}
		}
	}
	return nil
}

func toFolder(f sqlc.RoutineFolder) Folder {
	return Folder{ID: f.ID, Name: f.Name, OrderIndex: int(f.OrderIndex), CreatedAt: f.CreatedAt, UpdatedAt: f.UpdatedAt}
}
