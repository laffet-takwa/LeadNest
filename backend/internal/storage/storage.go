// Package storage provides access to the S3-compatible object storage that
// backs the deployment. The service speaks the S3 API, so the standard AWS
// SDK is used against a custom endpoint.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Config holds the settings needed to reach the object storage service.
type Config struct {
	// Endpoint is the base URL of the service.
	Endpoint string
	// Region is the region the service reports for its buckets.
	Region string
	// AccessKeyID and SecretAccessKey are the static credentials.
	AccessKeyID     string
	SecretAccessKey string
	// Bucket is the bucket objects are written to.
	Bucket string
	// ForcePathStyle selects path-style bucket addressing, which most
	// custom S3 endpoints require.
	ForcePathStyle bool
	// Timeout bounds a single storage request.
	Timeout time.Duration
}

// Object is a summary of a stored object.
type Object struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"last_modified"`
	ETag         string    `json:"etag"`
}

// Client is a handle on the object storage bucket.
type Client struct {
	api     *s3.Client
	presign *s3.PresignClient
	bucket  string
}

// New builds a client for the configured bucket.
func New(cfg Config) (*Client, error) {
	if cfg.Endpoint == "" {
		return nil, errors.New("storage: endpoint is required")
	}
	if cfg.Region == "" {
		return nil, errors.New("storage: region is required")
	}
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, errors.New("storage: access key id and secret access key are required")
	}
	if cfg.Bucket == "" {
		return nil, errors.New("storage: bucket is required")
	}

	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	api := s3.New(s3.Options{
		Region:       cfg.Region,
		BaseEndpoint: aws.String(cfg.Endpoint),
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		UsePathStyle: cfg.ForcePathStyle,
		// Checksums are opt-in on the wire so the service does not have to
		// understand the chunked trailer encoding.
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
		ResponseChecksumValidation: aws.ResponseChecksumValidationWhenRequired,
		Retryer:                    retry.NewStandard(),
		HTTPClient:                 &http.Client{Timeout: timeout},
	})

	return &Client{
		api:     api,
		presign: s3.NewPresignClient(api),
		bucket:  cfg.Bucket,
	}, nil
}

// Bucket returns the bucket the client writes to.
func (c *Client) Bucket() string {
	return c.bucket
}

// Ping verifies that the bucket is reachable.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.api.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(c.bucket)})
	if err != nil {
		return fmt.Errorf("head bucket %q: %w", c.bucket, err)
	}
	return nil
}

// EnsureBucket creates the bucket when it does not exist yet.
func (c *Client) EnsureBucket(ctx context.Context) error {
	err := c.Ping(ctx)
	if err == nil {
		return nil
	}
	_, createErr := c.api.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(c.bucket)})
	if createErr != nil {
		var owned *types.BucketAlreadyOwnedByYou
		var exists *types.BucketAlreadyExists
		if errors.As(createErr, &owned) || errors.As(createErr, &exists) {
			return nil
		}
		return fmt.Errorf("create bucket %q: %w", c.bucket, createErr)
	}
	return nil
}

// Put stores an object, replacing any object with the same key.
func (c *Client) Put(ctx context.Context, key string, body io.Reader, contentType string) error {
	key, err := normalizeKey(key)
	if err != nil {
		return err
	}
	in := &s3.PutObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
		Body:   body,
	}
	if contentType != "" {
		in.ContentType = aws.String(contentType)
	}
	if _, err := c.api.PutObject(ctx, in); err != nil {
		return fmt.Errorf("put object %q: %w", key, err)
	}
	return nil
}

// Get returns a reader over the stored object. The caller closes it.
func (c *Client) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	key, err := normalizeKey(key)
	if err != nil {
		return nil, err
	}
	out, err := c.api.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("get object %q: %w", key, err)
	}
	return out.Body, nil
}

// Delete removes an object. Deleting a missing object is not an error.
func (c *Client) Delete(ctx context.Context, key string) error {
	key, err := normalizeKey(key)
	if err != nil {
		return err
	}
	if _, err := c.api.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}); err != nil {
		return fmt.Errorf("delete object %q: %w", key, err)
	}
	return nil
}

// List returns the objects whose key starts with prefix.
func (c *Client) List(ctx context.Context, prefix string) ([]Object, error) {
	out := []Object{}
	paginator := s3.NewListObjectsV2Paginator(c.api, &s3.ListObjectsV2Input{
		Bucket: aws.String(c.bucket),
		Prefix: aws.String(prefix),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("list objects: %w", err)
		}
		for _, o := range page.Contents {
			out = append(out, Object{
				Key:          aws.ToString(o.Key),
				Size:         aws.ToInt64(o.Size),
				LastModified: aws.ToTime(o.LastModified),
				ETag:         strings.Trim(aws.ToString(o.ETag), `"`),
			})
		}
	}
	return out, nil
}

// PresignGet returns a temporary URL that grants read access to an object.
func (c *Client) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	key, err := normalizeKey(key)
	if err != nil {
		return "", err
	}
	req, err := c.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("presign get %q: %w", key, err)
	}
	return req.URL, nil
}

// PresignPut returns a temporary URL that grants write access to an object.
func (c *Client) PresignPut(ctx context.Context, key, contentType string, ttl time.Duration) (string, error) {
	key, err := normalizeKey(key)
	if err != nil {
		return "", err
	}
	in := &s3.PutObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}
	if contentType != "" {
		in.ContentType = aws.String(contentType)
	}
	req, err := c.presign.PresignPutObject(ctx, in, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("presign put %q: %w", key, err)
	}
	return req.URL, nil
}

// normalizeKey rejects keys that are empty or try to escape the bucket
// namespace.
func normalizeKey(key string) (string, error) {
	k := strings.TrimSpace(key)
	if k == "" {
		return "", errors.New("storage: object key is required")
	}
	if strings.HasPrefix(k, "/") {
		return "", fmt.Errorf("storage: object key %q must not start with a slash", key)
	}
	if strings.Contains(k, "..") {
		return "", fmt.Errorf("storage: object key %q must not contain %q", key, "..")
	}
	return k, nil
}
