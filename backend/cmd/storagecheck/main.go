// Command storagecheck verifies that the configured object storage service
// is reachable and that a full write, read and delete round trip works.
//
// Usage:
//
//	storagecheck
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/leadnest/backend/internal/config"
	"github.com/leadnest/backend/internal/storage"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "storage check failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if !cfg.Storage.Enabled() {
		return fmt.Errorf("object storage is not configured; set AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
	}

	fmt.Printf("endpoint   : %s\n", cfg.Storage.Endpoint)
	fmt.Printf("region     : %s\n", cfg.Storage.Region)
	fmt.Printf("bucket     : %s\n", cfg.Storage.Bucket)
	fmt.Printf("path style : %v\n", cfg.Storage.ForcePathStyle)

	client, err := storage.New(storage.Config{
		Endpoint:        cfg.Storage.Endpoint,
		Region:          cfg.Storage.Region,
		AccessKeyID:     cfg.Storage.AccessKeyID,
		SecretAccessKey: cfg.Storage.SecretAccessKey,
		Bucket:          cfg.Storage.Bucket,
		ForcePathStyle:  cfg.Storage.ForcePathStyle,
	})
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Ping(ctx); err != nil {
		return err
	}
	fmt.Println("bucket is reachable")

	key := "storagecheck.txt"
	payload := "leadnest storage check"
	if err := client.Put(ctx, key, strings.NewReader(payload), "text/plain"); err != nil {
		return err
	}
	fmt.Println("write succeeded")

	reader, err := client.Get(ctx, key)
	if err != nil {
		return err
	}
	body, err := io.ReadAll(reader)
	reader.Close()
	if err != nil {
		return err
	}
	if string(body) != payload {
		return fmt.Errorf("read returned %q, expected %q", string(body), payload)
	}
	fmt.Println("read succeeded")

	objects, err := client.List(ctx, "")
	if err != nil {
		return err
	}
	fmt.Printf("bucket holds %d object(s)\n", len(objects))

	url, err := client.PresignGet(ctx, key, 5*time.Minute)
	if err != nil {
		return err
	}
	fmt.Println("presigned url generated")

	if err := client.Delete(ctx, key); err != nil {
		return err
	}
	fmt.Println("delete succeeded")
	_ = url

	return nil
}
