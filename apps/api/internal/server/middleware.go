package server

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/MorrisMorrison/granite/apps/api/gate"
	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
)

type ctxKey string

const (
	userIDKey     ctxKey = "userID"
	authMethodKey ctxKey = "authMethod"
)

// Authentication methods recorded in the request context.
const (
	authMethodJWT      = "jwt"
	authMethodAPIToken = "apitoken"
)

// metaReadOnly marks an operation that uses a write HTTP method but doesn't
// mutate data, so read-only API tokens are still allowed (e.g. sync/pull).
const metaReadOnly = "readOnly"

// secureHeaders sets conservative security response headers.
func secureHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

// requestLogger logs each request via slog.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"dur_ms", time.Since(start).Milliseconds(),
		)
	})
}

// newAuthMiddleware is a huma middleware that enforces a Bearer access token for
// operations declaring Security, and injects the user id into the context.
func newAuthMiddleware(api huma.API, tokens *auth.TokenManager, svc *auth.Service, g gate.AccountGate) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		if len(ctx.Operation().Security) == 0 {
			next(ctx)
			return
		}
		const prefix = "Bearer "
		h := ctx.Header("Authorization")
		if !strings.HasPrefix(h, prefix) {
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "missing or malformed Authorization header")
			return
		}
		token := strings.TrimPrefix(h, prefix)
		if token == "" {
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "missing access token")
			return
		}
		var userID, method string
		canWrite := true // JWT sessions have full access
		if strings.HasPrefix(token, auth.APITokenPrefix) {
			id, scopes, err := svc.AuthenticateAPIToken(ctx.Context(), token)
			if err != nil {
				_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "invalid or expired API token")
				return
			}
			userID, method, canWrite = id, authMethodAPIToken, auth.ScopesAllowWrite(scopes)
		} else {
			id, err := tokens.ParseAccessToken(token)
			if err != nil {
				_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "invalid or expired access token")
				return
			}
			userID, method = id, authMethodJWT
		}
		// Read-only API tokens may not perform write operations.
		if !canWrite && isWriteOp(ctx.Operation()) {
			_ = huma.WriteErr(api, ctx, http.StatusForbidden, "this API token is read-only")
			return
		}
		// The account gate may forbid mutations (e.g. an external authorization
		// policy / entitlement). Reads — including sync/pull (readOnly) — stay open.
		if isWriteOp(ctx.Operation()) {
			ok, err := g.CanWrite(ctx.Context(), userID)
			if err != nil {
				_ = huma.WriteErr(api, ctx, http.StatusInternalServerError, "authorization check failed")
				return
			}
			if !ok {
				_ = huma.WriteErr(api, ctx, http.StatusForbidden, "writes are not permitted for this account")
				return
			}
		}
		next(huma.WithValue(huma.WithValue(ctx, userIDKey, userID), authMethodKey, method))
	}
}

// isWriteOp reports whether an operation mutates data. It's method-based (so new
// write endpoints are guarded by default); a non-mutating endpoint that uses a
// write method (e.g. sync/pull reads over POST) opts out by setting the
// readOnly metadata flag at registration, keeping the exception next to the route.
func isWriteOp(op *huma.Operation) bool {
	switch op.Method {
	case http.MethodPost, http.MethodPatch, http.MethodPut, http.MethodDelete:
		readOnly, _ := op.Metadata[metaReadOnly].(bool)
		return !readOnly
	default:
		return false
	}
}

func userIDFromCtx(ctx context.Context) string {
	id, _ := ctx.Value(userIDKey).(string)
	return id
}

func authMethodFromCtx(ctx context.Context) string {
	m, _ := ctx.Value(authMethodKey).(string)
	return m
}
