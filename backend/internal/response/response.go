package response

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Standard API response envelopes.

type Success struct {
	Data interface{} `json:"data"`
}

type Error struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type ListMeta struct {
	Total      int64   `json:"total"`
	Limit      int     `json:"limit"`
	Offset     int     `json:"offset"`
	NextCursor *string `json:"next_cursor,omitempty"`
}

type ListResponse struct {
	Data interface{} `json:"data"`
	Meta ListMeta    `json:"meta"`
}

func JSON(c *gin.Context, status int, data interface{}) {
	c.JSON(status, Success{Data: data})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Success{Data: data})
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func ErrorResponse(c *gin.Context, status int, code, message string, details ...any) {
	body := ErrorBody{Code: code, Message: message}
	if len(details) > 0 {
		body.Details = details[0]
	}
	c.JSON(status, Error{Error: body})
}

func BadRequest(c *gin.Context, message string, details ...any) {
	body := ErrorBody{Code: "BAD_REQUEST", Message: message}
	if len(details) > 0 {
		body.Details = details[0]
	}
	c.JSON(http.StatusBadRequest, Error{Error: body})
}

func ValidationError(c *gin.Context, message string, details any) {
	body := ErrorBody{Code: "VALIDATION_ERROR", Message: message, Details: details}
	c.JSON(http.StatusUnprocessableEntity, Error{Error: body})
}

func Unauthorized(c *gin.Context, message string) {
	body := ErrorBody{Code: "UNAUTHORIZED", Message: message}
	c.JSON(http.StatusUnauthorized, Error{Error: body})
}

func Forbidden(c *gin.Context, message string) {
	body := ErrorBody{Code: "FORBIDDEN", Message: message}
	c.JSON(http.StatusForbidden, Error{Error: body})
}

func NotFound(c *gin.Context, message string) {
	body := ErrorBody{Code: "NOT_FOUND", Message: message}
	c.JSON(http.StatusNotFound, Error{Error: body})
}

func Conflict(c *gin.Context, message string) {
	body := ErrorBody{Code: "CONFLICT", Message: message}
	c.JSON(http.StatusConflict, Error{Error: body})
}

func TooManyRequests(c *gin.Context, message string) {
	body := ErrorBody{Code: "RATE_LIMITED", Message: message}
	c.JSON(http.StatusTooManyRequests, Error{Error: body})
}

func InternalError(c *gin.Context, message string) {
	body := ErrorBody{Code: "INTERNAL_ERROR", Message: message}
	c.JSON(http.StatusInternalServerError, Error{Error: body})
}

// InternalErrorf logs the underlying cause on the server and returns a
// generic message to the client. Internal details (SQL errors, stack traces,
// credentials) must never reach the response body.
func InternalErrorf(c *gin.Context, err error, message string) {
	slog.Error("request failed",
		slog.String("error", err.Error()),
		slog.String("method", c.Request.Method),
		slog.String("path", c.Request.URL.Path),
	)
	body := ErrorBody{Code: "INTERNAL_ERROR", Message: message}
	c.JSON(http.StatusInternalServerError, Error{Error: body})
}

func List(c *gin.Context, data interface{}, total int64, limit, offset int) {
	c.JSON(http.StatusOK, ListResponse{
		Data: data,
		Meta: ListMeta{Total: total, Limit: limit, Offset: offset},
	})
}
