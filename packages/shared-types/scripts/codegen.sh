#!/usr/bin/env bash
# Generate TypeScript types from the FastAPI OpenAPI spec.
# Run this whenever the backend schema changes.
# 
# Usage:
#   bash scripts/codegen.sh [API_URL]
#
# The generated file is checked into git so the frontend can be built
# without running the backend (useful in CI).

set -euo pipefail

API_URL="${1:-http://localhost:8000}"
OUT="src/api.d.ts"

echo "🔄 Fetching OpenAPI spec from $API_URL/openapi.json ..."
npx openapi-typescript "$API_URL/openapi.json" \
  --output "$OUT" \
  --immutable \
  --path-params-as-types

echo "✅ Types written to packages/shared-types/$OUT"
