import assert from "node:assert/strict";
import fs from "node:fs";

for (const removedPath of [
  "Pizza Logs HQ",
  "app/api/uploads/route.ts",
  "app/api/admin/import-items/route.ts",
  "animations/desktop",
  "animations/mobile",
  "animations/posters",
]) {
  assert.equal(fs.existsSync(removedPath), false, `${removedPath} must stay retired`);
}

for (const requiredPath of [
  "public/social-preview.jpg",
  "app/robots.ts",
  "app/sitemap.ts",
  "app/manifest.ts",
  "SECURITY.md",
  "PRIVACY.md",
  "LICENSE.LIST",
  "docs/security/threat-model.md",
  "parser/requirements.lock",
  "parser/requirements-dev.lock",
]) {
  assert.equal(fs.existsSync(requiredPath), true, `${requiredPath} must exist`);
}

const nextConfig = fs.readFileSync("next.config.ts", "utf8");
assert.match(nextConfig, /poweredByHeader:\s*false/);
assert.match(nextConfig, /Content-Security-Policy/);
assert.match(nextConfig, /Strict-Transport-Security/);
assert.doesNotMatch(nextConfig, /bodySizeLimit:\s*["']500mb/);

const workflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/pr-slack-notify.yml",
  ".github/workflows/production-smoke.yml",
].map(file => fs.readFileSync(file, "utf8")).join("\n");
assert.doesNotMatch(workflows, /uses:\s*[^\s]+@v\d+/i, "Actions must use immutable commit pins");
assert.match(workflows, /actions\/dependency-review-action@[0-9a-f]{40}/);
assert.match(workflows, /github\/codeql-action\/analyze@[0-9a-f]{40}/);

const parserSource = fs.readFileSync("parser/main.py", "utf8");
assert.doesNotMatch(parserSource, /@app\.post\(["']\/parse-path["']/);
assert.match(parserSource, /ENABLE_LEGACY_PARSER_ROUTES/);
assert.match(parserSource, /ENABLE_PARSER_DOCS/);

const parserDockerfile = fs.readFileSync("parser/Dockerfile", "utf8");
assert.match(parserDockerfile, /--require-hashes -r requirements\.lock/);
assert.match(parserDockerfile, /USER appuser/);

console.log("repository baseline tests passed");
