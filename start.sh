#!/bin/sh
set -e

echo "[start] Running prisma db push..."
npx prisma db push --skip-generate

echo "[start] Starting Next.js server..."
exec node server.js
