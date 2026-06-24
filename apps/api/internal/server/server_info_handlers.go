package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// registerServerInfoRoutes wires the instance-info endpoint used by clients to
// detect a server reset (and reconcile their local cache).
func (s *Server) registerServerInfoRoutes(a huma.API) {
	huma.Register(a, huma.Operation{
		OperationID: "serverInfo",
		Method:      http.MethodGet,
		Path:        "/api/v1/server-info",
		Summary:     "Server instance info (lets clients detect a reset DB)",
		Tags:        []string{"Server"},
		Security:    bearerSecurity,
	}, s.handleServerInfo)
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
