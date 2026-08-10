import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const buildOnlyUrl = "postgresql://pizzalogs-build-only:invalid@localhost:5432/pizzalogs";

loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` does not connect to Postgres, so a non-secret placeholder
  // keeps generic Docker builds deterministic. start.sh fails closed before any
  // migration when Railway has not supplied the real DATABASE_URL.
  datasource: {
    url: process.env.DATABASE_URL ?? buildOnlyUrl,
  },
});
