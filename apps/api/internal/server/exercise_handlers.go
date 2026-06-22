package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
)

// registerExerciseRoutes wires the exercise-library endpoints.
func (s *Server) registerExerciseRoutes(a huma.API) {
	huma.Register(a, huma.Operation{OperationID: "listExercises", Method: http.MethodGet, Path: "/api/v1/exercises", Summary: "List exercises (yours + built-in)", Tags: []string{"Exercises"}, Security: bearerSecurity}, s.handleListExercises)
	huma.Register(a, huma.Operation{OperationID: "createExercise", Method: http.MethodPost, Path: "/api/v1/exercises", Summary: "Create a custom exercise", Tags: []string{"Exercises"}, Security: bearerSecurity, DefaultStatus: http.StatusCreated}, s.handleCreateExercise)
	huma.Register(a, huma.Operation{OperationID: "getExercise", Method: http.MethodGet, Path: "/api/v1/exercises/{id}", Summary: "Get an exercise", Tags: []string{"Exercises"}, Security: bearerSecurity}, s.handleGetExercise)
	huma.Register(a, huma.Operation{OperationID: "updateExercise", Method: http.MethodPatch, Path: "/api/v1/exercises/{id}", Summary: "Update a custom exercise", Tags: []string{"Exercises"}, Security: bearerSecurity}, s.handleUpdateExercise)
	huma.Register(a, huma.Operation{OperationID: "deleteExercise", Method: http.MethodDelete, Path: "/api/v1/exercises/{id}", Summary: "Delete a custom exercise", Tags: []string{"Exercises"}, Security: bearerSecurity, DefaultStatus: http.StatusNoContent}, s.handleDeleteExercise)
}

// exerciseResponse is the API representation (secondary muscles as a string array).
type exerciseResponse struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	ExerciseType     string   `json:"exercise_type"`
	PrimaryMuscle    string   `json:"primary_muscle"`
	SecondaryMuscles []string `json:"secondary_muscles"`
	Equipment        string   `json:"equipment"`
	Instructions     string   `json:"instructions"`
	IsArchived       bool     `json:"is_archived"`
	IsBuiltin        bool     `json:"is_builtin"`
	CreatedAt        int64    `json:"created_at"`
	UpdatedAt        int64    `json:"updated_at"`
}

func toExerciseResponse(e exercise.Exercise) exerciseResponse {
	sec := []string{}
	if len(e.SecondaryMuscles) > 0 {
		_ = json.Unmarshal(e.SecondaryMuscles, &sec)
	}
	if sec == nil {
		sec = []string{}
	}
	return exerciseResponse{
		ID:               e.ID,
		Name:             e.Name,
		ExerciseType:     e.ExerciseType,
		PrimaryMuscle:    e.PrimaryMuscle,
		SecondaryMuscles: sec,
		Equipment:        e.Equipment,
		Instructions:     e.Instructions,
		IsArchived:       e.IsArchived,
		IsBuiltin:        e.IsBuiltin,
		CreatedAt:        e.CreatedAt,
		UpdatedAt:        e.UpdatedAt,
	}
}

type exerciseBody struct {
	Name             string   `json:"name" minLength:"1" maxLength:"200"`
	ExerciseType     string   `json:"exercise_type" enum:"weight_reps,reps_only,duration"`
	PrimaryMuscle    string   `json:"primary_muscle,omitempty"`
	SecondaryMuscles []string `json:"secondary_muscles,omitempty"`
	Equipment        string   `json:"equipment,omitempty"`
	Instructions     string   `json:"instructions,omitempty"`
	IsArchived       bool     `json:"is_archived,omitempty"`
}

func (b exerciseBody) toInput() exercise.Input {
	var sec json.RawMessage
	if b.SecondaryMuscles != nil {
		sec, _ = json.Marshal(b.SecondaryMuscles)
	}
	return exercise.Input{
		Name:             b.Name,
		ExerciseType:     b.ExerciseType,
		PrimaryMuscle:    b.PrimaryMuscle,
		SecondaryMuscles: sec,
		Equipment:        b.Equipment,
		Instructions:     b.Instructions,
		IsArchived:       b.IsArchived,
	}
}

type listExercisesOutput struct {
	Body struct {
		Exercises []exerciseResponse `json:"exercises"`
	}
}

func (s *Server) handleListExercises(ctx context.Context, _ *struct{}) (*listExercisesOutput, error) {
	list, err := s.exercise.List(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &listExercisesOutput{}
	out.Body.Exercises = make([]exerciseResponse, 0, len(list))
	for _, e := range list {
		out.Body.Exercises = append(out.Body.Exercises, toExerciseResponse(e))
	}
	return out, nil
}

type exerciseIDInput struct {
	ID string `path:"id"`
}

type exerciseOutput struct {
	Body exerciseResponse
}

func (s *Server) handleGetExercise(ctx context.Context, in *exerciseIDInput) (*exerciseOutput, error) {
	e, err := s.exercise.Get(ctx, userIDFromCtx(ctx), in.ID)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &exerciseOutput{Body: toExerciseResponse(e)}, nil
}

type createExerciseInput struct {
	Body exerciseBody
}

func (s *Server) handleCreateExercise(ctx context.Context, in *createExerciseInput) (*exerciseOutput, error) {
	e, err := s.exercise.Create(ctx, userIDFromCtx(ctx), in.Body.toInput())
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &exerciseOutput{Body: toExerciseResponse(e)}, nil
}

type updateExerciseInput struct {
	ID   string `path:"id"`
	Body exerciseBody
}

func (s *Server) handleUpdateExercise(ctx context.Context, in *updateExerciseInput) (*exerciseOutput, error) {
	e, err := s.exercise.Update(ctx, userIDFromCtx(ctx), in.ID, in.Body.toInput())
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &exerciseOutput{Body: toExerciseResponse(e)}, nil
}

func (s *Server) handleDeleteExercise(ctx context.Context, in *exerciseIDInput) (*struct{}, error) {
	if err := s.exercise.Delete(ctx, userIDFromCtx(ctx), in.ID); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}
