package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// registerServerInfoRoutes wires the public identity check and the instance-info
// endpoint clients use to detect a server reset.
func (s *Server) registerServerInfoRoutes(a huma.API) {
	huma.Register(a, huma.Operation{
		OperationID: "serverInfo",
		Method:      http.MethodGet,
		Path:        "/api/v1/server-info",
		Summary:     "Server instance info (lets clients detect a reset DB)",
		Tags:        []string{"Server"},
		Security:    bearerSecurity,
	}, s.handleServerInfo)

	huma.Register(a, huma.Operation{
		OperationID: "info",
		Method:      http.MethodGet,
		Path:        "/api/v1/info",
		Summary:     "Public identity check (lets an app confirm it reached a Granite server)",
		Tags:        []string{"Server"},
	}, s.handleInfo)
}

type serverInfoOutput struct {
	Body struct {
		// Stable per-database id; changes when the server DB is reset/recreated.
		InstanceID string `json:"instance_id"`
	}
}

func (s *Server) handleServerInfo(ctx context.Context, _ *struct{}) (*serverInfoOutput, error) {
	var id string
	if err := s.db.QueryRowContext(ctx, "SELECT value FROM server_meta WHERE key = 'instance_id'").Scan(&id); err != nil {
		return nil, toHumaErr(ctx, err)
	}
	out := &serverInfoOutput{}
	out.Body.InstanceID = id
	return out, nil
}

// APIVersion is bumped when clients (the native apps) start relying on newer
// server behaviour; the app refuses servers below its minimum.
const APIVersion = 1

type infoOutput struct {
	Body struct {
		Name       string `json:"name"`
		APIVersion int    `json:"api_version"`
	}
}

func (s *Server) handleInfo(_ context.Context, _ *struct{}) (*infoOutput, error) {
	out := &infoOutput{}
	out.Body.Name = "granite"
	out.Body.APIVersion = APIVersion
	return out, nil
}
