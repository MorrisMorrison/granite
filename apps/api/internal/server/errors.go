package server

import (
	"context"
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MorrisMorrison/granite/apps/api/internal/apperr"
)

// toHumaErr maps a typed apperr.Error to a huma error with the right status.
// Unknown errors are logged and returned as a generic 500 (cause never leaked).
func toHumaErr(ctx context.Context, err error) error {
	var ae *apperr.Error
	if errors.As(err, &ae) {
		return huma.NewError(ae.Status, ae.Message)
	}
	slog.ErrorContext(ctx, "unhandled error", "err", err)
	return huma.Error500InternalServerError("internal server error")
}
