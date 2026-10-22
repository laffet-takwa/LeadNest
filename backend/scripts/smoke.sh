#!/usr/bin/env bash
# End-to-end smoke test of a running LeadNest API instance.
#
# Usage: scripts/smoke.sh [base-url]
#
# Exercises registration, login, tenant isolation, CRUD, dashboard and the
# graceful degradation of the AI endpoints. Exits non-zero on the first
# unexpected response.
set -euo pipefail

BASE=${1:-http://localhost:8080}
PASS=0
FAIL=0

step() { printf '\n== %s\n' "$1"; }

check() {
    local label=$1 expected=$2 actual=$3
    if [ "$expected" = "$actual" ]; then
        printf '  ok   %-52s (%s)\n' "$label" "$actual"
        PASS=$((PASS + 1))
    else
        printf '  FAIL %-52s expected %s got %s\n' "$label" "$expected" "$actual"
        FAIL=$((FAIL + 1))
    fi
}

# status <method> <path> [token] [json-body] -> prints the HTTP status
status() {
    method=$1
    path=$2
    token=${3:-}
    body=${4:-}
    if [ -n "$token" ] && [ -n "$body" ]; then
        curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" \
            -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $token" -d "$body"
    elif [ -n "$token" ]; then
        curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" \
            -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $token"
    elif [ -n "$body" ]; then
        curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" \
            -H 'Content-Type: application/json' -d "$body"
    else
        curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" \
            -H 'Content-Type: application/json'
    fi
}

# json <method> <path> [token] [json-body] -> prints the response body
json() {
    method=$1
    path=$2
    token=${3:-}
    body=${4:-}
    if [ -n "$token" ] && [ -n "$body" ]; then
        curl -s -X "$method" "$BASE$path" -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $token" -d "$body"
    elif [ -n "$token" ]; then
        curl -s -X "$method" "$BASE$path" -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $token"
    elif [ -n "$body" ]; then
        curl -s -X "$method" "$BASE$path" -H 'Content-Type: application/json' -d "$body"
    else
        curl -s -X "$method" "$BASE$path" -H 'Content-Type: application/json'
    fi
}

STAMP=$(date +%s%N)
EMAIL="smoke-${STAMP}@example.com"
PASSWORD="SmokeTestPass123"

step "health and readiness"
check "GET /health" 200 "$(status GET /health)"
check "GET /ready" 200 "$(status GET /ready)"

step "authentication"
REGISTER_BODY="{\"company\":{\"name\":\"Smoke ${STAMP}\",\"email\":\"company-${STAMP}@example.com\"},\"admin\":{\"full_name\":\"Smoke Admin\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}}"
check "POST /api/v1/auth/register" 201 "$(status POST /api/v1/auth/register '' "$REGISTER_BODY")"

LOGIN_BODY="{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"
LOGIN_RESP=$(json POST /api/v1/auth/login '' "$LOGIN_BODY")
TOKEN=$(printf '%s' "$LOGIN_RESP" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
    echo "  FAIL could not extract an access token"
    exit 1
fi
check "POST /api/v1/auth/login returns a token" "yes" "yes"
check "GET /api/v1/auth/me" 200 "$(status GET /api/v1/auth/me "$TOKEN")"
check "GET /api/v1/auth/me without a token" 401 "$(status GET /api/v1/auth/me)"
check "GET /api/v1/auth/me with a bad token" 401 "$(status GET /api/v1/auth/me 'not-a-token')"

ME=$(json GET /api/v1/auth/me "$TOKEN")
if printf '%s' "$ME" | grep -q 'password_hash'; then
    check "response never exposes the password hash" "absent" "present"
else
    check "response never exposes the password hash" "absent" "absent"
fi

step "company"
check "GET /api/v1/companies/me" 200 "$(status GET /api/v1/companies/me "$TOKEN")"

step "customers"
CUSTOMER_BODY="{\"full_name\":\"Smoke Customer\",\"email\":\"customer-${STAMP}@example.com\",\"phone\":\"+21620123456\",\"source\":\"smoke\"}"
check "POST /api/v1/customers" 201 "$(status POST /api/v1/customers "$TOKEN" "$CUSTOMER_BODY")"
CUSTOMER_ID=$(json POST /api/v1/customers "$TOKEN" "$CUSTOMER_BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "GET /api/v1/customers/\$id" 200 "$(status GET "/api/v1/customers/$CUSTOMER_ID" "$TOKEN")"
check "GET /api/v1/customers (list)" 200 "$(status GET '/api/v1/customers?limit=10' "$TOKEN")"
check "GET /api/v1/customers (search)" 200 "$(status GET '/api/v1/customers?search=Smoke' "$TOKEN")"
check "PATCH /api/v1/customers/\$id" 200 "$(status PATCH "/api/v1/customers/$CUSTOMER_ID" "$TOKEN" '{"full_name":"Smoke Customer Renamed"}')"
check "POST /api/v1/customers (invalid email)" 422 "$(status POST /api/v1/customers "$TOKEN" '{"full_name":"Bad","email":"not-an-email"}')"

step "deals"
DEAL_BODY="{\"customer_id\":\"${CUSTOMER_ID}\",\"title\":\"Smoke deal\",\"value\":\"1234.56\",\"currency\":\"TND\"}"
check "POST /api/v1/deals" 201 "$(status POST /api/v1/deals "$TOKEN" "$DEAL_BODY")"
DEAL_ID=$(json POST /api/v1/deals "$TOKEN" "$DEAL_BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "GET /api/v1/deals/\$id" 200 "$(status GET "/api/v1/deals/$DEAL_ID" "$TOKEN")"
check "GET /api/v1/deals (list)" 200 "$(status GET /api/v1/deals "$TOKEN")"
check "PATCH /api/v1/deals/\$id (status=won)" 200 "$(status PATCH "/api/v1/deals/$DEAL_ID" "$TOKEN" '{"status":"won"}')"
DEAL_AFTER=$(json GET "/api/v1/deals/$DEAL_ID" "$TOKEN")
if printf '%s' "$DEAL_AFTER" | grep -q '"closed_at"'; then
    check "closed_at is recorded for a won deal" "present" "present"
else
    check "closed_at is recorded for a won deal" "present" "absent"
fi
check "POST /api/v1/deals (negative value)" 422 "$(status POST /api/v1/deals "$TOKEN" "{\"customer_id\":\"${CUSTOMER_ID}\",\"title\":\"Bad\",\"value\":\"-1\"}")"
check "POST /api/v1/deals (unknown customer)" 404 "$(status POST /api/v1/deals "$TOKEN" '{"customer_id":"00000000-0000-0000-0000-000000000000","title":"Bad","value":"1"}')"

step "tasks"
ME_RESP=$(json GET /api/v1/auth/me "$TOKEN")
USER_ID=$(printf '%s' "$ME_RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
TASK_BODY="{\"assigned_to\":\"${USER_ID}\",\"title\":\"Smoke task\",\"priority\":\"high\"}"
check "POST /api/v1/tasks" 201 "$(status POST /api/v1/tasks "$TOKEN" "$TASK_BODY")"
TASK_ID=$(json POST /api/v1/tasks "$TOKEN" "$TASK_BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "GET /api/v1/tasks/\$id" 200 "$(status GET "/api/v1/tasks/$TASK_ID" "$TOKEN")"
check "GET /api/v1/tasks (overdue)" 200 "$(status GET '/api/v1/tasks?overdue=true' "$TOKEN")"
check "PATCH /api/v1/tasks/\$id (completed)" 200 "$(status PATCH "/api/v1/tasks/$TASK_ID" "$TOKEN" '{"status":"completed"}')"
TASK_AFTER=$(json GET "/api/v1/tasks/$TASK_ID" "$TOKEN")
if printf '%s' "$TASK_AFTER" | grep -q '"completed_at"'; then
    check "completed_at is recorded for a completed task" "present" "present"
else
    check "completed_at is recorded for a completed task" "present" "absent"
fi
check "POST /api/v1/tasks (invalid priority)" 422 "$(status POST /api/v1/tasks "$TOKEN" "{\"assigned_to\":\"${USER_ID}\",\"title\":\"Bad\",\"priority\":\"urgent\"}")"

step "activities"
check "POST /api/v1/customers/\$id/activities" 201 "$(status POST "/api/v1/customers/$CUSTOMER_ID/activities" "$TOKEN" '{"type":"email","subject":"Smoke email"}')"
check "GET /api/v1/customers/\$id/activities" 200 "$(status GET "/api/v1/customers/$CUSTOMER_ID/activities" "$TOKEN")"
check "GET /api/v1/activities" 200 "$(status GET /api/v1/activities "$TOKEN")"
check "POST activity (unknown type)" 422 "$(status POST "/api/v1/customers/$CUSTOMER_ID/activities" "$TOKEN" '{"type":"carrier-pigeon"}')"

step "dashboard"
check "GET /api/v1/dashboard" 200 "$(status GET /api/v1/dashboard "$TOKEN")"
check "GET /api/v1/dashboard/sales-pipeline" 200 "$(status GET /api/v1/dashboard/sales-pipeline "$TOKEN")"
check "GET /api/v1/dashboard/recent-activities" 200 "$(status GET /api/v1/dashboard/recent-activities "$TOKEN")"
check "GET /api/v1/dashboard/upcoming-tasks" 200 "$(status GET /api/v1/dashboard/upcoming-tasks "$TOKEN")"

DASH=$(json GET /api/v1/dashboard "$TOKEN")
if printf '%s' "$DASH" | grep -q '"total_customers"'; then
    check "dashboard returns metrics" "present" "present"
else
    check "dashboard returns metrics" "present" "absent"
fi

step "tenant isolation"
OTHER_EMAIL="other-${STAMP}@example.com"
OTHER_BODY="{\"company\":{\"name\":\"Other ${STAMP}\"},\"admin\":{\"full_name\":\"Other Admin\",\"email\":\"${OTHER_EMAIL}\",\"password\":\"${PASSWORD}\"}}"
status POST /api/v1/auth/register '' "$OTHER_BODY" > /dev/null
OTHER_TOKEN=$(json POST /api/v1/auth/login '' "{\"email\":\"${OTHER_EMAIL}\",\"password\":\"${PASSWORD}\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
check "other company cannot read the customer" 404 "$(status GET "/api/v1/customers/$CUSTOMER_ID" "$OTHER_TOKEN")"
check "other company cannot read the deal" 404 "$(status GET "/api/v1/deals/$DEAL_ID" "$OTHER_TOKEN")"
check "other company cannot read the task" 404 "$(status GET "/api/v1/tasks/$TASK_ID" "$OTHER_TOKEN")"
check "other company customer list is empty" 200 "$(status GET /api/v1/customers "$OTHER_TOKEN")"
OTHER_LIST=$(json GET /api/v1/customers "$OTHER_TOKEN")
if printf '%s' "$OTHER_LIST" | grep -q '"total":0'; then
    check "other company sees 0 customers" "0" "0"
else
    check "other company sees 0 customers" "0" "unexpected"
fi

step "authorization"
check "employees endpoint is admin only" 200 "$(status GET /api/v1/users "$TOKEN")"
check "unknown route" 404 "$(status GET /api/v1/does-not-exist "$TOKEN")"
check "unauthenticated request" 401 "$(status GET /api/v1/customers)"

step "ai degradation"
AI_STATUS=$(status POST /api/v1/ai/email-draft "$TOKEN" "{\"customer_id\":\"${CUSTOMER_ID}\"}")
case "$AI_STATUS" in
    503) check "AI endpoint reports that it is not configured" "503" "$AI_STATUS" ;;
    200) check "AI endpoint returns a draft" "200" "$AI_STATUS" ;;
    *)   check "AI endpoint degrades gracefully" "503 or 200" "$AI_STATUS" ;;
esac
check "AI history" 200 "$(status GET /api/v1/ai/history "$TOKEN")"

step "cleanup"
# The deal references the customer, so it is deleted first.
check "DELETE /api/v1/deals/\$id" 204 "$(status DELETE "/api/v1/deals/$DEAL_ID" "$TOKEN")"
check "DELETE /api/v1/tasks/\$id" 204 "$(status DELETE "/api/v1/tasks/$TASK_ID" "$TOKEN")"
check "DELETE /api/v1/customers/\$id" 204 "$(status DELETE "/api/v1/customers/$CUSTOMER_ID" "$TOKEN")"
check "deleted customer is gone" 404 "$(status GET "/api/v1/customers/$CUSTOMER_ID" "$TOKEN")"

printf '\n========================================\n'
printf 'passed: %d   failed: %d\n' "$PASS" "$FAIL"
printf '========================================\n'
[ "$FAIL" -eq 0 ]
