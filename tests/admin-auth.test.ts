import assert from "node:assert/strict";
import { getAdminAuthConfiguration } from "../lib/admin-auth-config";
import { hasTrustedAdminOrigin } from "../lib/admin-request";

const names = ["ADMIN_SECRET", "ADMIN_AUTH_URL", "NODE_ENV", "ADMIN_COOKIE_SECURE"] as const;
const environment: Record<string, string | undefined> = process.env;
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
try {
  delete process.env.ADMIN_SECRET;
  process.env.ADMIN_AUTH_URL = "https://logs.example.test";
  assert.equal(getAdminAuthConfiguration(), null, "missing server key must fail closed");
  process.env.ADMIN_SECRET = "too-short";
  assert.equal(getAdminAuthConfiguration(), null);
  process.env.ADMIN_SECRET = "synthetic-auth-server-key-at-least-32-characters";
  delete process.env.ADMIN_AUTH_URL;
  assert.equal(getAdminAuthConfiguration(), null, "the origin must be explicitly configured");
  environment.NODE_ENV = "production";
  for (const origin of ["http://logs.example.test", "https://user:pass@logs.example.test", "https://logs.example.test/path", "https://logs.example.test?secret=x", "not-a-url"]) {
    process.env.ADMIN_AUTH_URL = origin;
    assert.equal(getAdminAuthConfiguration(), null, origin);
  }
  process.env.ADMIN_AUTH_URL = "https://logs.example.test";
  process.env.ADMIN_COOKIE_SECURE = "false";
  assert.equal(getAdminAuthConfiguration()?.secureCookies, true, "public HTTPS cannot disable secure cookies");
  assert.equal(hasTrustedAdminOrigin(new Headers({ origin: "https://logs.example.test" })), true);
  for (const origin of ["https://logs.example.test.evil.test", "http://logs.example.test", "null", "https://evil.test"]) {
    assert.equal(hasTrustedAdminOrigin(new Headers({ origin })), false);
  }
  assert.equal(hasTrustedAdminOrigin(new Headers()), false);
  process.env.ADMIN_AUTH_URL = "http://127.0.0.1:53075";
  delete process.env.ADMIN_COOKIE_SECURE;
  assert.equal(getAdminAuthConfiguration(), null, "production-mode HTTP needs an explicit loopback-only override");
  process.env.ADMIN_COOKIE_SECURE = "false";
  assert.equal(getAdminAuthConfiguration()?.secureCookies, false);
  process.env.ADMIN_AUTH_URL = "http://public.example.test";
  assert.equal(getAdminAuthConfiguration(), null, "the HTTP override must never permit public cleartext auth");
} finally {
  for (const name of names) {
    if (original[name] === undefined) delete environment[name];
    else environment[name] = original[name];
  }
}
