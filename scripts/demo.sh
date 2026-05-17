#!/usr/bin/env bash
# Demo script for Loom video — run API + worker first: npm run dev:all
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"

echo "=== Health ==="
curl -s "$BASE/health" | jq .

echo ""
echo "=== Login organizer ==="
ORG_JSON=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@example.com","password":"password123"}')
echo "$ORG_JSON" | jq .
ORG_TOKEN=$(echo "$ORG_JSON" | jq -r .token)

echo ""
echo "=== Login customer ==="
CUST_JSON=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"password123"}')
echo "$CUST_JSON" | jq .
CUST_TOKEN=$(echo "$CUST_JSON" | jq -r .token)

echo ""
echo "=== Browse events (public) ==="
curl -s "$BASE/api/events" | jq .

EVENT_ID=$(curl -s "$BASE/api/events" | jq -r '.events[0].id')
echo "Using event id: $EVENT_ID"

echo ""
echo "=== Customer books 2 tickets (triggers background email) ==="
curl -s -X POST "$BASE/api/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -d "{\"eventId\":\"$EVENT_ID\",\"quantity\":2}" | jq .

echo ""
echo "=== Organizer updates event (triggers notifications) ==="
curl -s -X PATCH "$BASE/api/events/$EVENT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ORG_TOKEN" \
  -d '{"venue":"Convention Center Hall B — upgraded"}' | jq .

echo ""
echo "Check the WORKER terminal for [EMAIL] and [NOTIFICATION] logs."
