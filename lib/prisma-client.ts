import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a Prisma client");
  }

  const url = new URL(connectionString);
  const schema = url.searchParams.get("schema") ?? "public";
  if (!schema || /[\0"]/.test(schema) || Buffer.byteLength(schema) > 63) {
    throw new Error("DATABASE_URL schema must be at most 63 bytes and cannot contain null or double-quote characters");
  }
  // Prisma's schema option qualifies generated queries. Raw aggregate queries
  // also need the same search path on every pooled connection. PostgreSQL's
  // startup-options parser uses backslash escaping, before SQL identifier
  // quoting is interpreted by search_path; keep both boundaries explicit.
  const quotedSchema = `"${schema.replaceAll('"', '""')}"`;
  const startupSchema = quotedSchema.replace(/[\\\s]/g, character => `\\${character}`);
  const existingOptions = url.searchParams.get("options") || process.env.PGOPTIONS || "";
  url.searchParams.set("options", `${existingOptions} -c search_path=${startupSchema}`.trim());

  const adapter = new PrismaPg({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5_000,
    max: 10,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  }, { schema });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}
