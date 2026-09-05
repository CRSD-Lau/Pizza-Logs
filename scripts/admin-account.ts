import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { config as loadEnv } from "dotenv";
import { operatorProvision, operatorRecover } from "../lib/admin-account-operator";

function hiddenPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || !process.stdout.isTTY) { reject(new Error("Run this command in an interactive terminal.")); return; }
    process.stdout.write(prompt);
    emitKeypressEvents(input);
    const previouslyRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    let value = "";
    const finish = (error?: Error) => {
      input.off("keypress", onKey);
      input.setRawMode(previouslyRaw);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onKey = (text: string | undefined, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") { finish(new Error("Cancelled.")); return; }
      if (key.name === "return" || key.name === "enter") { finish(); return; }
      if (key.name === "backspace") { value = Array.from(value).slice(0, -1).join(""); return; }
      if (!key.ctrl && text && !/[\x00-\x1f\x7f]/.test(text)) value += text;
    };
    input.on("keypress", onKey);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const action = args[0];
  if (args.length !== 1 || (action !== "provision" && action !== "recover")) {
    throw new Error("Usage: npx tsx scripts/admin-account.ts provision|recover. Never put credentials in command arguments.");
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("An interactive terminal is required; credentials are read privately.");
  loadEnv({ path: [".env.local", ".env"], quiet: true });
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const email = await terminal.question("Administrator email: ");
  if (action === "recover") {
    const confirmation = await terminal.question("This revokes all admin sessions and requires new MFA enrollment. Type RECOVER to continue: ");
    if (confirmation !== "RECOVER") { terminal.close(); throw new Error("Cancelled."); }
  }
  terminal.close();
  const password = await hiddenPassword("New password (hidden): ");
  const repeated = await hiddenPassword("Repeat password (hidden): ");
  if (password !== repeated) throw new Error("Passwords do not match.");
  if (action === "provision") await operatorProvision({ email, password });
  else await operatorRecover({ email, password });
  process.stdout.write("Administrator credentials saved. Sign in, enroll an authenticator, and save the recovery codes. Admin access remains locked until MFA is complete.\n");
}

main().catch((error: unknown) => {
  // Operator errors may come from the database driver; print only our known
  // action errors, never raw connection details or credential-bearing objects.
  const safe = error instanceof Error && /^(Configure |Enter |The password |Administrator name |An administrator |Unassigned |The email |The administrator credential |Run this |Cancelled\.|Usage: |An interactive |Passwords do not match\.)/.test(error.message);
  process.stderr.write(`${safe ? (error as Error).message : "Administrator operation failed. Check configuration and database connectivity privately."}\n`);
  process.exitCode = 1;
}).finally(async () => {
  const { getAdminDatabase } = await import("../lib/auth");
  try { await (await getAdminDatabase()).$disconnect(); } catch { /* Configuration may be absent. */ }
});
