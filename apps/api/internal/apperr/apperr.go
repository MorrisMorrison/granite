// Package apperr is the typed error taxonomy for the API. Services return typed
// *Error values carrying an HTTP status and a stable, machine-readable code. The
// server's Huma adapter (internal/server.toHumaErr) maps them to the response
// status; there is no custom JSON envelope. Unknown errors become a generic 500
// (cause logged, never leaked to the client).
package apperr

import "net/http"

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
}

func (e *Error) Error() string { return e.Message }

func newErr(code Code, status int, msg string) *Error {
	return &Error{Code: code, Status: status, Message: msg}
}

// Constructors for each error class.
func Validation(msg string) *Error   { return newErr(CodeValidation, http.StatusBadRequest, msg) }
func Unauthorized(msg string) *Error { return newErr(CodeUnauthorized, http.StatusUnauthorized, msg) }
func Forbidden(msg string) *Error    { return newErr(CodeForbidden, http.StatusForbidden, msg) }
func NotFound(msg string) *Error     { return newErr(CodeNotFound, http.StatusNotFound, msg) }
func Conflict(msg string) *Error     { return newErr(CodeConflict, http.StatusConflict, msg) }
