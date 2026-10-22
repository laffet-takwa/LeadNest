package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/response"
)

// rateLimiter is a simple per-client token bucket. It is intentionally
// in-process: a multi-instance deployment would swap this for a shared store.
type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64 // tokens per second
	burst   float64
}

type bucket struct {
	tokens float64
	last   time.Time
}

func newRateLimiter(rps float64, burst int) *rateLimiter {
	if rps <= 0 {
		rps = 100
	}
	if burst <= 0 {
		burst = int(rps)
	}
	return &rateLimiter{
		buckets: make(map[string]*bucket),
		rate:    rps,
		burst:   float64(burst),
	}
}

// allow consumes one token for key, reporting whether the request may proceed.
func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, ok := rl.buckets[key]
	if !ok {
		b = &bucket{tokens: rl.burst, last: now}
		rl.buckets[key] = b
	}
	elapsed := now.Sub(b.last).Seconds()
	b.last = now
	b.tokens += elapsed * rl.rate
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// cleanup drops buckets that have been full for longer than the TTL.
func (rl *rateLimiter) cleanup(ttl time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for k, b := range rl.buckets {
		if time.Since(b.last) > ttl {
			delete(rl.buckets, k)
		}
	}
}

// RateLimit rejects requests that exceed the configured request rate.
// It is applied to the whole router and is not tied to a specific route.
func RateLimit(rps float64, burst int) gin.HandlerFunc {
	rl := newRateLimiter(rps, burst)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rl.cleanup(10 * time.Minute)
		}
	}()
	return func(c *gin.Context) {
		key := c.ClientIP()
		if u := AuthUserFromContext(c); u != nil {
			key = u.UserID
		}
		if !rl.allow(key) {
			response.TooManyRequests(c, "rate limit exceeded, please retry later")
			c.Abort()
			return
		}
		c.Next()
	}
}
