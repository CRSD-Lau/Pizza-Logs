FROM node:22-alpine AS base

# ── deps ──────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ── builder ───────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
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
# Copy prisma CLI + engines so we can run db push on startup
COPY --from=builder /app/node_modules/.bin/prisma          ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma               ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma              ./node_modules/@prisma

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["./start.sh"]
