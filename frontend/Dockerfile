# syntax=docker/dockerfile:1
# Production image for the LeadNest frontend.
#
#   docker build -t leadnest-frontend .
#   docker run --rm -p 8081:80 leadnest-frontend
#
# The container serves the built application and proxies /api to the backend.

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

# The API base URL is baked into the bundle at build time. It must be an
# absolute URL or a path served by the reverse proxy below.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O - http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
