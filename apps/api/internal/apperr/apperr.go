// Package apperr is the typed error taxonomy for the API. Services return typed
// errors; handlers call HandleError, which maps them to the JSON envelope
// {error, code, details} with the right HTTP status. Internal/unknown errors
// become a generic 500 (cause logged, never leaked to the client).
package apperr

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// Code is a stable, machine-readable error identifier clients can branch on.
type Code string

const (
	CodeValidation   Code = "validation"
	CodeUnauthorized Code = "unauthorized"
	CodeForbidden    Code = "forbidden"
	CodeNotFound     Code = "not_found"
	CodeConflict     Code = "conflict"
	CodeInternal     Code = "internal"
)

// Error is a typed application error carrying an HTTP status and a stable code.
type Error struct {
	Code    Code
	Status  int
	Message string
	Details map[string]any
	cause   error
}

func (e *Error) Error() string { return e.Message }
func (e *Error) Unwrap() error { return e.cause }

// WithDetails attaches structured details returned to the client.
func (e *Error) WithDetails(d map[string]any) *Error { e.Details = d; return e }

// Wrap attaches an underlying cause (not exposed to the client).
func (e *Error) Wrap(err error) *Error { e.cause = err; return e }

func newErr(code Code, status int, msg string) *Error {
	return &Error{Code: code, Status: status, Message: msg}
}

// Constructors for each error class.
func Validation(msg string) *Error   { return newErr(CodeValidation, http.StatusBadRequest, msg) }
func Unauthorized(msg string) *Error { return newErr(CodeUnauthorized, http.StatusUnauthorized, msg) }
func Forbidden(msg string) *Error    { return newErr(CodeForbidden, http.StatusForbidden, msg) }
func NotFound(msg string) *Error     { return newErr(CodeNotFound, http.StatusNotFound, msg) }
func Conflict(msg string) *Error     { return newErr(CodeConflict, http.StatusConflict, msg) }

type envelope struct {
	Error   string         `json:"error"`
	Code    Code           `json:"code"`
	Details map[string]any `json:"details,omitempty"`
}

// HandleError writes err as a JSON error response. Typed *Error values map to
// their status/code; anything else is logged and returned as a generic 500.
func HandleError(w http.ResponseWriter, r *http.Request, err error) {
	var ae *Error
	if errors.As(err, &ae) {
		write(w, ae.Status, envelope{Error: ae.Message, Code: ae.Code, Details: ae.Details})
		return
	}
	slog.ErrorContext(r.Context(), "unhandled error", "method", r.Method, "path", r.URL.Path, "err", err)
	write(w, http.StatusInternalServerError, envelope{Error: "internal server error", Code: CodeInternal})
}

func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
