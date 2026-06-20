package apperr

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleErrorMapsTypedErrors(t *testing.T) {
	cases := []struct {
		err        *Error
		wantStatus int
		wantCode   Code
	}{
		{Validation("bad"), http.StatusBadRequest, CodeValidation},
		{Unauthorized("nope"), http.StatusUnauthorized, CodeUnauthorized},
		{Forbidden("no"), http.StatusForbidden, CodeForbidden},
		{NotFound("gone"), http.StatusNotFound, CodeNotFound},
		{Conflict("dupe"), http.StatusConflict, CodeConflict},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		HandleError(rec, req, tc.err)

		if rec.Code != tc.wantStatus {
			t.Errorf("%s: status = %d, want %d", tc.wantCode, rec.Code, tc.wantStatus)
		}
		var env struct {
			Error string `json:"error"`
			Code  Code   `json:"code"`
		}
		if err := json.NewDecoder(rec.Body).Decode(&env); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if env.Code != tc.wantCode {
			t.Errorf("code = %q, want %q", env.Code, tc.wantCode)
		}
	}
}

func TestHandleErrorWrapsAsTyped(t *testing.T) {
	wrapped := fmt.Errorf("context: %w", NotFound("missing"))
	rec := httptest.NewRecorder()
	HandleError(rec, httptest.NewRequest(http.MethodGet, "/", nil), wrapped)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestHandleErrorUnknownIs500(t *testing.T) {
	rec := httptest.NewRecorder()
	HandleError(rec, httptest.NewRequest(http.MethodGet, "/", nil), errors.New("boom"))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var env struct {
		Error string `json:"error"`
		Code  Code   `json:"code"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&env)
	if env.Code != CodeInternal {
		t.Errorf("code = %q, want %q", env.Code, CodeInternal)
	}
	if env.Error == "boom" {
		t.Error("internal cause leaked to client")
	}
}
