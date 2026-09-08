import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const proxyPath = path.join(root, "proxy.ts");
const legacyMiddlewarePath = path.join(root, "middleware.ts");
const proxySource = fs.readFileSync(proxyPath, "utf8");
const rootLayoutSource = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");

assert.equal(fs.existsSync(legacyMiddlewarePath), false, "Next 16 must use proxy.ts instead of middleware.ts");
assert.match(proxySource, /export function proxy\(request: NextRequest\)/);
assert.match(proxySource, /matcher:\s*["']\/admin\/:path\*["']/);
assert.match(proxySource, /pathname === ["']\/admin\/login["']/);
assert.match(proxySource, /getSessionCookie\(request/);
assert.doesNotMatch(proxySource, /verifyAdminSecretValue|x-admin-secret/);
assert.match(proxySource, /NextResponse\.redirect\(new URL\(["']\/admin\/login["']/);

assert.doesNotMatch(
  rootLayoutSource,
  /next\/font\/google/,
  "production builds must not depend on downloading Google Fonts",
);
assert.match(rootLayoutSource, /next\/font\/local/);
for (const [family, weights] of [["cinzel", [400, 600, 700]], ["rajdhani", [300, 400, 500, 600, 700]]] as const) {
  for (const weight of weights) {
    const fontPath = `node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff2`;
    assert.ok(rootLayoutSource.includes(fontPath), `Keep the installed ${family} ${weight} font`);
    assert.ok(fs.existsSync(path.join(root, fontPath)), "Font assets must exist without a build-time download");
  }
}

const actionsSource = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
assert.match(actionsSource, /await headers\(\)/, "admin actions must use Next 16's async headers API");
assert.match(actionsSource, /hasTrustedAdminOrigin\(requestHeaders\)/);
assert.match(actionsSource, /getAdminSession\(requestHeaders\)/);
assert.equal(fs.existsSync(path.join(root, "app/admin/login/actions.ts")), false, "legacy secret login must remain removed");

console.log("next16-upgrade-source tests passed");
