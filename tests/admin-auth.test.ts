import assert from "node:assert/strict";
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  shouldUseSecureAdminCookie,
  verifyAdminSecretValue,
  verifyAdminSessionToken,
} from "../lib/admin-auth";

const originalSecret = process.env["ADMIN_SECRET"];
const originalNodeEnv = process.env["NODE_ENV"];
const originalCookieSecure = process.env["ADMIN_COOKIE_SECURE"];

function setEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

try {
  setEnvironment("ADMIN_SECRET", undefined);
  setEnvironment("NODE_ENV", "development");
  assert.equal(verifyAdminSecretValue("anything"), false, "missing secrets must fail closed everywhere");
  assert.equal(createAdminSessionToken(), null);

  setEnvironment("ADMIN_SECRET", "correct horse battery staple");
  assert.equal(verifyAdminSecretValue("correct horse battery staple"), true);
  assert.equal(verifyAdminSecretValue("wrong"), false);
  assert.equal(verifyAdminSecretValue(undefined), false);

  const issuedAt = 1_000_000;
  const token = createAdminSessionToken(issuedAt);
  assert.equal(typeof token, "string");
  assert.notEqual(token, process.env.ADMIN_SECRET, "the cookie token must not contain the reusable admin secret");
  assert.equal(verifyAdminSessionToken(token, issuedAt), true);
  assert.equal(verifyAdminSessionToken(token, issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS), false);
  assert.equal(verifyAdminSessionToken("wrong", issuedAt), false);
  assert.equal(verifyAdminSecretValue(token), false, "session tokens must not authenticate as raw secrets");

  setEnvironment("NODE_ENV", "production");
  setEnvironment("ADMIN_COOKIE_SECURE", undefined);
  assert.equal(shouldUseSecureAdminCookie(), true);
  setEnvironment("ADMIN_COOKIE_SECURE", "false");
  assert.equal(shouldUseSecureAdminCookie(), false);

  console.log("admin auth tests passed");
} finally {
  setEnvironment("ADMIN_SECRET", originalSecret);
  setEnvironment("NODE_ENV", originalNodeEnv);
  setEnvironment("ADMIN_COOKIE_SECURE", originalCookieSecure);
}
