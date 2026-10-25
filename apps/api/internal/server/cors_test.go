package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	syncpkg "github.com/MorrisMorrison/granite/apps/api/internal/sync"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// A server configured for one web origin, like production (GRANITE_BASE_URL).
func newOriginServer(t *testing.T, origin string) http.Handler {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "cors.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	q := sqlc.New(database)
	tokens := auth.NewTokenManager("test-secret")
	return New(auth.NewService(q, tokens, true), exercise.NewService(q), routine.NewService(database, q),
		workout.NewService(database, q), syncpkg.NewService(database, q), tokens, database, []string{origin}).Handler()
}

func preflight(h http.Handler, origin string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", origin)
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "authorization, content-type")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestCORSAllowsNativeAppOrigins(t *testing.T) {
	h := newOriginServer(t, "https://granite.example.com")
	for _, origin := range []string{"https://granite.example.com", "https://localhost", "capacitor://localhost"} {
		if got := preflight(h, origin).Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Errorf("origin %s: Access-Control-Allow-Origin = %q, want %q", origin, got, origin)
		}
		rec := preflight(h, origin)
		if allowed := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(strings.ToLower(allowed), "authorization") {
			t.Errorf("origin %s: Access-Control-Allow-Headers = %q, want it to include Authorization", origin, allowed)
		}
	}
}

func TestCORSRejectsOtherOrigins(t *testing.T) {
	h := newOriginServer(t, "https://granite.example.com")
	if got := preflight(h, "https://evil.example").Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("unexpected Access-Control-Allow-Origin %q for a foreign origin", got)
	}
}
