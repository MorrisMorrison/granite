package auth

import (
	"testing"
	"time"
)

func TestAccessTokenRoundTrip(t *testing.T) {
	m := NewTokenManager("secret")
	tok, err := m.GenerateAccessToken("user-1", time.Now())
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	sub, err := m.ParseAccessToken(tok)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if sub != "user-1" {
		t.Fatalf("subject = %q, want user-1", sub)
	}
}

func TestExpiredAccessTokenRejected(t *testing.T) {
	m := NewTokenManager("secret")
	tok, _ := m.GenerateAccessToken("user-1", time.Now().Add(-2*AccessTokenTTL))
	if _, err := m.ParseAccessToken(tok); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestWrongSecretRejected(t *testing.T) {
	tok, _ := NewTokenManager("secret-a").GenerateAccessToken("u", time.Now())
	if _, err := NewTokenManager("secret-b").ParseAccessToken(tok); err == nil {
		t.Fatal("expected token signed with a different secret to be rejected")
	}
}

func TestRefreshTokenUniqueAndHashed(t *testing.T) {
	a, _ := GenerateRefreshToken()
	b, _ := GenerateRefreshToken()
	if a == "" || a == b {
		t.Fatal("refresh tokens must be non-empty and unique")
	}
	if HashRefreshToken(a) == a {
		t.Fatal("stored hash must differ from the raw token")
	}
	if HashRefreshToken(a) != HashRefreshToken(a) {
		t.Fatal("hash must be deterministic")
	}
}
