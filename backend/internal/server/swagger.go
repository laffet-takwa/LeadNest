// Package server wires the HTTP router, middleware and module handlers.
//
// Swagger metadata for the LeadNest API lives in this file. The general API
// information below is written into docs/swagger.json; regenerate the
// documentation with:
//
//	make swagger
//
//	@title						LeadNest API
//	@version					1.0
//	@description				LeadNest is an AI-powered CRM for small businesses. This API manages companies, employees, customers, sales deals, follow-up tasks, activity timelines, dashboard analytics and AI-assisted drafting.
//	@description				All endpoints are prefixed with /api/v1. Authenticated endpoints require an `Authorization: Bearer <token>` header. Every query is scoped to the caller's company.
//	@termsOfService				https://example.com/terms
//	@contact.name				LeadNest API Support
//	@contact.email				api@leadnest.example
//	@license.name				MIT
//	@host						localhost:8080
//	@BasePath					/api/v1
//	@schemes					http https
//	@securityDefinitions.apikey	BearerAuth
//	@in							header
//	@name						Authorization
//	@description				JWT access token. Format: `Bearer <token>`
package server
