package storage

import (
	"strings"
	"testing"
)

func TestNewRequiresFullConfiguration(t *testing.T) {
	valid := Config{
		Endpoint:        "https://storage.example.test",
		Region:          "us-east-2",
		AccessKeyID:     "key-id",
		SecretAccessKey: "secret-key",
		Bucket:          "leadnest",
	}

	cases := []struct {
		name   string
		mutate func(c *Config)
	}{
		{"missing endpoint", func(c *Config) { c.Endpoint = "" }},
		{"missing region", func(c *Config) { c.Region = "" }},
		{"missing access key", func(c *Config) { c.AccessKeyID = "" }},
		{"missing secret key", func(c *Config) { c.SecretAccessKey = "" }},
		{"missing bucket", func(c *Config) { c.Bucket = "" }},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := valid
			tc.mutate(&cfg)
			if _, err := New(cfg); err == nil {
				t.Fatal("expected an error")
			}
		})
	}

	client, err := New(valid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client.Bucket() != "leadnest" {
		t.Errorf("unexpected bucket: %q", client.Bucket())
	}
}

func TestNormalizeKey(t *testing.T) {
	valid := []struct {
		in   string
		want string
	}{
		{"file.txt", "file.txt"},
		{"  file.txt  ", "file.txt"},
		{"nested/path/file.txt", "nested/path/file.txt"},
	}
	for _, tc := range valid {
		got, err := normalizeKey(tc.in)
		if err != nil {
			t.Fatalf("unexpected error for %q: %v", tc.in, err)
		}
		if got != tc.want {
			t.Errorf("normalizeKey(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}

	invalid := []string{"", "   ", "/leading-slash.txt", "a/../b.txt"}
	for _, in := range invalid {
		if _, err := normalizeKey(in); err == nil {
			t.Errorf("expected %q to be rejected", in)
		}
	}
}

func TestNormalizeKeyErrorMentionsTheKey(t *testing.T) {
	_, err := normalizeKey("/etc/passwd")
	if err == nil {
		t.Fatal("expected an error")
	}
	if !strings.Contains(err.Error(), "slash") {
		t.Errorf("unexpected error message: %v", err)
	}
}
