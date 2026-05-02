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

# These migrations were previously applied via "db push" (no migration history).
# Mark them as applied so migrate deploy only runs the new ones.
for migration in \
  20260430210000_add_guild_roster_members \
  20260501120000_add_guild_roster_rank_professions_gearscore \
  20260501213536_add_sync_jobs; do
  node "$PRISMA_BIN" migrate resolve --applied "$migration" 2>/dev/null || true
done

node "$PRISMA_BIN" migrate deploy

echo "[start] Starting Next.js server..."
exec node server.js
