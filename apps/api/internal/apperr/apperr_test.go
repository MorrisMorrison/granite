package apperr

import (
	"net/http"
	"testing"
)

// TestConstructorTaxonomy locks the code+status each constructor yields.
func TestConstructorTaxonomy(t *testing.T) {
	cases := []struct {
		name       string
		err        *Error
		wantCode   Code
		wantStatus int
	}{
		{"Validation", Validation("bad"), CodeValidation, http.StatusBadRequest},
		{"Unauthorized", Unauthorized("nope"), CodeUnauthorized, http.StatusUnauthorized},
		{"Forbidden", Forbidden("no"), CodeForbidden, http.StatusForbidden},
		{"NotFound", NotFound("gone"), CodeNotFound, http.StatusNotFound},
		{"Conflict", Conflict("dupe"), CodeConflict, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.err.Code != tc.wantCode {
				t.Errorf("code = %q, want %q", tc.err.Code, tc.wantCode)
			}
			if tc.err.Status != tc.wantStatus {
				t.Errorf("status = %d, want %d", tc.err.Status, tc.wantStatus)
			}
		})
	}
}

func TestErrorReturnsMessage(t *testing.T) {
	if got := NotFound("missing").Error(); got != "missing" {
		t.Errorf("Error() = %q, want %q", got, "missing")
	}
}
