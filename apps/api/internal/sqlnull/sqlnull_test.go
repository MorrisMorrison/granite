package sqlnull

import (
	"database/sql"
	"testing"
)

func TestString(t *testing.T) {
	if String(nil).Valid {
		t.Fatal("String(nil) should be NULL")
	}
	s := "hi"
	n := String(&s)
	if !n.Valid || n.String != "hi" {
		t.Fatalf("String(&s) = %+v", n)
	}
	if got := StringPtr(n); got == nil || *got != "hi" {
		t.Fatalf("StringPtr round-trip = %v", got)
	}
	if StringPtr(sql.NullString{}) != nil {
		t.Fatal("StringPtr(NULL) should be nil")
	}
}

func TestFloat64(t *testing.T) {
	if Float64(nil).Valid {
		t.Fatal("Float64(nil) should be NULL")
	}
	f := 12.5
	n := Float64(&f)
	if !n.Valid || n.Float64 != 12.5 {
		t.Fatalf("Float64(&f) = %+v", n)
	}
	if got := Float64Ptr(n); got == nil || *got != 12.5 {
		t.Fatalf("Float64Ptr round-trip = %v", got)
	}
	if Float64Ptr(sql.NullFloat64{}) != nil {
		t.Fatal("Float64Ptr(NULL) should be nil")
	}
}

func TestInt(t *testing.T) {
	if Int(nil).Valid {
		t.Fatal("Int(nil) should be NULL")
	}
	i := 7
	n := Int(&i)
	if !n.Valid || n.Int64 != 7 {
		t.Fatalf("Int(&i) = %+v", n)
	}
	if got := IntPtr(n); got == nil || *got != 7 {
		t.Fatalf("IntPtr round-trip = %v", got)
	}
	if IntPtr(sql.NullInt64{}) != nil {
		t.Fatal("IntPtr(NULL) should be nil")
	}
}

func TestInt64(t *testing.T) {
	if Int64(nil).Valid {
		t.Fatal("Int64(nil) should be NULL")
	}
	v := int64(99)
	n := Int64(&v)
	if !n.Valid || n.Int64 != 99 {
		t.Fatalf("Int64(&v) = %+v", n)
	}
	if got := Int64Ptr(n); got == nil || *got != 99 {
		t.Fatalf("Int64Ptr round-trip = %v", got)
	}
	if Int64Ptr(sql.NullInt64{}) != nil {
		t.Fatal("Int64Ptr(NULL) should be nil")
	}
}
