FROM node:26-alpine AS base

# ── deps ──────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ── production dependencies (Prisma CLI runs migrations at startup) ──
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts

# ── builder ───────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
# Next imports the Prisma client while collecting route metadata. This non-secret
# build-only URL creates the adapter without opening a database connection.
ENV DATABASE_URL=postgresql://pizzalogs-build-only:invalid@localhost:5432/pizzalogs
RUN mkdir -p /app/public
RUN npm run build

# ── runner ────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid  1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Prisma 7's CLI is ESM and has production dependencies beyond @prisma/*.
# Copy the complete production dependency tree so migrate deploy is reliable.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["./start.sh"]
