# ---- build stage ----
FROM golang:1.27-alpine AS build

WORKDIR /src

# Download dependencies first so the layer is cached across source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO is not needed: the pure-Go DNS resolver is used in the runtime image.
ENV CGO_ENABLED=0 GOOS=linux

# Build the API server, the migration runner and the storage diagnostic.
RUN go build -trimpath -ldflags "-s -w -X main.version=$(git describe --tags --always 2>/dev/null || echo dev)" \
        -o /out/api ./cmd/api \
 && go build -trimpath -ldflags "-s -w" \
        -o /out/migrate ./cmd/migrate \
 && go build -trimpath -ldflags "-s -w" \
        -o /out/storagecheck ./cmd/storagecheck

# ---- runtime stage ----
FROM alpine:3.20

# ca-certificates is required for outbound TLS to the AI provider.
RUN apk add --no-cache ca-certificates tzdata wget \
 && addgroup -S leadnest \
 && adduser -S -G leadnest leadnest

WORKDIR /app

COPY --from=build /out/api /app/api
COPY --from=build /out/migrate /app/migrate
COPY --from=build /out/storagecheck /app/storagecheck
COPY --from=build /src/migrations /app/migrations

# Run unprivileged.
USER leadnest

EXPOSE 8080

ENV SERVER_ADDR=:8080 \
    APP_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O - http://127.0.0.1:8080/health >/dev/null 2>&1 || exit 1

# CMD (not ENTRYPOINT) so that `command:` in docker-compose.yml replaces the
# default command, which is how the compose stack runs the migrations before
# starting the API.
CMD ["/app/api"]
