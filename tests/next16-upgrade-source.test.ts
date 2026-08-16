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
assert.match(proxySource, /verifyAdminSessionToken\(cookie\)/);
assert.match(proxySource, /verifyAdminSecretValue\(header\)/);
assert.match(proxySource, /NextResponse\.redirect\(new URL\(["']\/admin\/login["']/);

assert.doesNotMatch(
  rootLayoutSource,
  /next\/font\/google/,
  "production builds must not depend on downloading Google Fonts",
);
assert.match(rootLayoutSource, /@fontsource\/cinzel\/latin-400\.css/);
assert.match(rootLayoutSource, /@fontsource\/cinzel\/latin-700\.css/);
assert.match(rootLayoutSource, /@fontsource\/rajdhani\/latin-300\.css/);
assert.match(rootLayoutSource, /@fontsource\/rajdhani\/latin-700\.css/);

for (const file of [
  "app/admin/actions.ts",
  "app/admin/login/actions.ts",
]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(source, /await cookies\(\)/, `${file} must use Next 16's async cookies API`);
}

console.log("next16-upgrade-source tests passed");
