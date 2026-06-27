// Package gate defines the authorization seam for account-creating and syncing
// actions. The default open-source build uses AllowAll (no restrictions); a
// deployment can inject a custom AccountGate to enforce its own policy — e.g. an
// invite allowlist, an SSO entitlement, or any external authorization check —
// without modifying the core server.
package gate

import "context"

// AccountGate decides whether account-level actions are permitted.
type AccountGate interface {
	// CanRegister reports whether a new account may be created for email.
	CanRegister(ctx context.Context, email string) (bool, error)
	// CanSync reports whether the given user may push or pull sync changes.
	CanSync(ctx context.Context, userID string) (bool, error)
}

// AllowAll permits every action. It is the default for the open-source build.
type AllowAll struct{}

// CanRegister always permits registration.
func (AllowAll) CanRegister(context.Context, string) (bool, error) { return true, nil }

// CanSync always permits sync.
func (AllowAll) CanSync(context.Context, string) (bool, error) { return true, nil }
