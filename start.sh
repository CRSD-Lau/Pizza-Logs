#!/bin/sh
set -e

echo "[start] Running prisma migrate deploy..."

# Run prisma CLI via its package source entry point.
# The .bin/prisma bundled script looks for a companion .wasm at __dirname
# which doesn't survive the multi-stage Docker copy. Running the source
# entry directly (node_modules/prisma/<bin-field>) loads wasm from
# node_modules/@prisma instead — which we do copy.
PRISMA_BIN=$(node -e "
  const pkg = require('./node_modules/prisma/package.json');
  const bin = pkg.bin;
  const rel = typeof bin === 'string' ? bin : (bin.prisma || bin['prisma']);
  console.log('./node_modules/prisma/' + rel);
")
echo "[start] prisma entry: $PRISMA_BIN"
node "$PRISMA_BIN" migrate deploy

echo "[start] Starting Next.js server..."
exec node server.js
