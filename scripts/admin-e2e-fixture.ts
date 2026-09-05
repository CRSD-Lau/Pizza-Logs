import { randomBytes } from "node:crypto";

const EMAIL = "pizza-admin-e2e@example.test";

async function main(): Promise<void> {
  // No dotenv or connection fallback: the caller must select its isolated DB.
  if (process.argv.length !== 2) throw new Error("Fixture arguments are not accepted.");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("An isolated DATABASE_URL is required.");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || !url.pathname || url.pathname === "/" || url.hash) {
    throw new Error("The fixture requires a loopback PostgreSQL database.");
  }
  // pg accepts connection overrides in URL parameters. Allow only the schema
  // setting used by the isolated CI stack, so a host override cannot escape it.
  if (Array.from(url.searchParams.keys()).some(key => key !== "schema")
    || url.searchParams.getAll("schema").length > 1) {
    throw new Error("Unexpected database connection parameters.");
  }
  const authURL = new URL(process.env.ADMIN_AUTH_URL ?? "");
  if (!["http:", "https:"].includes(authURL.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(authURL.hostname)) {
    throw new Error("The fixture requires a loopback authentication origin.");
  }

  // This child process is a test utility. Never enable Prisma query logging.
  const environment: Record<string, string | undefined> = process.env;
  environment.NODE_ENV = "test";
  const { getAdminDatabase } = await import("../lib/auth");
  const { operatorProvision, operatorRecover } = await import("../lib/admin-account-operator");
  const database = await getAdminDatabase();
  const password = `PizzaE2E!${randomBytes(24).toString("base64url")}`;
  try {
    const identity = await database.adminIdentity.findUnique({
      where: { id: 1 }, include: { user: { select: { email: true } } },
    });
    if (identity && identity.user.email !== EMAIL) {
      throw new Error("Refusing to modify a different administrator.");
    }
    if (identity) await operatorRecover({ email: EMAIL, password });
    else await operatorProvision({ email: EMAIL, password, name: "Synthetic Admin" });
  } finally {
    await database.$disconnect();
  }
  process.stdout.write(`${JSON.stringify({ email: EMAIL, password })}\n`);
}

main().catch(() => {
  // Do not expose connection details or existing identity information.
  process.stderr.write("Synthetic admin fixture failed. Check the isolated test configuration.\n");
  process.exitCode = 1;
});
