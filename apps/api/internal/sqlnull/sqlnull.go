// Package sqlnull converts between Go pointers and database/sql Null types.
//
// sqlc-generated params/rows use sql.NullString / sql.NullFloat64 / sql.NullInt64
// for nullable columns, while the domain/API layer uses plain pointers (nil == NULL).
// These helpers are the single home for that boundary conversion, which used to be
// copy-pasted into every persistence package.
package sqlnull

import "database/sql"

// String wraps a *string as a sql.NullString (nil → NULL).
func String(p *string) sql.NullString {
	if p == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *p, Valid: true}
}

// StringPtr unwraps a sql.NullString to a *string (NULL → nil).
func StringPtr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	v := n.String
	return &v
}

// Float64 wraps a *float64 as a sql.NullFloat64 (nil → NULL).
func Float64(p *float64) sql.NullFloat64 {
	if p == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *p, Valid: true}
}

// Float64Ptr unwraps a sql.NullFloat64 to a *float64 (NULL → nil).
func Float64Ptr(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	v := n.Float64
	return &v
}

// Int wraps a *int as a sql.NullInt64 (nil → NULL).
func Int(p *int) sql.NullInt64 {
	if p == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: int64(*p), Valid: true}
}

// IntPtr unwraps a sql.NullInt64 to a *int (NULL → nil).
func IntPtr(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

// Int64 wraps a *int64 as a sql.NullInt64 (nil → NULL).
func Int64(p *int64) sql.NullInt64 {
	if p == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *p, Valid: true}
}

// Int64Ptr unwraps a sql.NullInt64 to a *int64 (NULL → nil).
func Int64Ptr(n sql.NullInt64) *int64 {
	if !n.Valid {
		return nil
	}
	v := n.Int64
	return &v
}
