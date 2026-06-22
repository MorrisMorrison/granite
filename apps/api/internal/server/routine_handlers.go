package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
)

// registerRoutineRoutes wires the routine + routine-folder endpoints.
func (s *Server) registerRoutineRoutes(a huma.API) {
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
}

// --- Folders ----------------------------------------------------------------

type listFoldersOutput struct {
	Body struct {
		Folders []routine.Folder `json:"folders"`
	}
}

func (s *Server) handleListFolders(ctx context.Context, _ *struct{}) (*listFoldersOutput, error) {
	folders, err := s.routine.ListFolders(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &listFoldersOutput{}
	out.Body.Folders = folders
	if out.Body.Folders == nil {
		out.Body.Folders = []routine.Folder{}
	}
	return out, nil
}

type folderOutput struct {
	Body routine.Folder
}

type createFolderInput struct {
	Body routine.FolderInput
}

func (s *Server) handleCreateFolder(ctx context.Context, in *createFolderInput) (*folderOutput, error) {
	f, err := s.routine.CreateFolder(ctx, userIDFromCtx(ctx), in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &folderOutput{Body: f}, nil
}

type updateFolderInput struct {
	ID   string `path:"id"`
	Body routine.FolderInput
}

func (s *Server) handleUpdateFolder(ctx context.Context, in *updateFolderInput) (*folderOutput, error) {
	f, err := s.routine.UpdateFolder(ctx, userIDFromCtx(ctx), in.ID, in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &folderOutput{Body: f}, nil
}

type idPathInput struct {
	ID string `path:"id"`
}

func (s *Server) handleDeleteFolder(ctx context.Context, in *idPathInput) (*struct{}, error) {
	if err := s.routine.DeleteFolder(ctx, userIDFromCtx(ctx), in.ID); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}

// --- Routines ---------------------------------------------------------------

type listRoutinesOutput struct {
	Body struct {
		Routines []routine.Routine `json:"routines"`
	}
}

func (s *Server) handleListRoutines(ctx context.Context, _ *struct{}) (*listRoutinesOutput, error) {
	routines, err := s.routine.ListRoutines(ctx, userIDFromCtx(ctx))
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &listRoutinesOutput{}
	out.Body.Routines = routines
	if out.Body.Routines == nil {
		out.Body.Routines = []routine.Routine{}
	}
	return out, nil
}

type routineOutput struct {
	Body routine.Routine
}

func (s *Server) handleGetRoutine(ctx context.Context, in *idPathInput) (*routineOutput, error) {
	r, err := s.routine.Get(ctx, userIDFromCtx(ctx), in.ID)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &routineOutput{Body: r}, nil
}

type createRoutineInput struct {
	Body routine.RoutineInput
}

func (s *Server) handleCreateRoutine(ctx context.Context, in *createRoutineInput) (*routineOutput, error) {
	r, err := s.routine.Create(ctx, userIDFromCtx(ctx), in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &routineOutput{Body: r}, nil
}

type updateRoutineInput struct {
	ID   string `path:"id"`
	Body routine.RoutineInput
}

func (s *Server) handleUpdateRoutine(ctx context.Context, in *updateRoutineInput) (*routineOutput, error) {
	r, err := s.routine.Update(ctx, userIDFromCtx(ctx), in.ID, in.Body)
	if err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return &routineOutput{Body: r}, nil
}

func (s *Server) handleDeleteRoutine(ctx context.Context, in *idPathInput) (*struct{}, error) {
	if err := s.routine.Delete(ctx, userIDFromCtx(ctx), in.ID); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	return nil, nil
}
