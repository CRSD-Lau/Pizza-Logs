const baseUrl = (process.env.PIZZA_LOGS_BASE_URL
  ?? "https://pizza-logs-production.up.railway.app").replace(/\/$/, "");
const canonicalUrl = (process.env.PIZZA_LOGS_CANONICAL_URL ?? baseUrl).replace(/\/$/, "");

const securityHeaders = {
  "content-security-policy": ["default-src 'self'", "frame-ancestors 'none'"],
  "permissions-policy": ["camera=()", "microphone=()"],
  "referrer-policy": ["strict-origin-when-cross-origin"],
  "strict-transport-security": ["max-age=63072000"],
  "x-content-type-options": ["nosniff"],
  "x-frame-options": ["DENY"],
};

const checks = [
  {
    path: "/",
    status: 200,
    contains: ["Pizza Logs", "social-preview.jpg", "rel=\"canonical\"", "manifest.webmanifest"],
    headers: securityHeaders,
    absentHeaders: ["x-powered-by"],
  },
  { path: "/leaderboards", status: 200, contains: "Leaderboards" },
  { path: "/raids", status: 200, contains: "Raids" },
  { path: "/api/bosses", status: 200, json: true },
  { path: "/admin", status: 307, location: "/admin/login" },
  { path: "/uploads", status: 307, location: "/admin/uploads" },
  { path: "/api/uploads", status: 404 },
  { path: "/api/admin/import-items", status: 404 },
  { path: "/robots.txt", status: 200, contains: ["Disallow: /admin", "Sitemap:"] },
  { path: "/sitemap.xml", status: 200, contains: [canonicalUrl, "/leaderboards"] },
  { path: "/manifest.webmanifest", status: 200, contains: ["Pizza Logs", "#0a0c10", "icon-192.png", "icon-512.png", "icon-maskable-512.png"] },
  { path: "/social-preview.jpg", status: 200, contentType: "image/jpeg", binary: true, minBytes: 10_000 },
  { path: "/brand/icon-192.png?v=guild-1", status: 200, contentType: "image/png", binary: true, minBytes: 1_000 },
  { path: "/brand/icon-512.png?v=guild-1", status: 200, contentType: "image/png", binary: true, minBytes: 1_000 },
  { path: "/brand/icon-maskable-512.png?v=guild-1", status: 200, contentType: "image/png", binary: true, minBytes: 1_000 },
  { path: "/brand/apple-touch-icon.png?v=guild-1", status: 200, contentType: "image/png", binary: true, minBytes: 1_000 },
];

let failed = false;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "pizza-logs-production-smoke/1.0" },
    });
    const bodyBytes = await response.arrayBuffer();
    const body = check.binary ? "" : new TextDecoder().decode(bodyBytes);
    const location = response.headers.get("location");
    const locationMatches = !check.location
      || location === check.location
      || location === `${baseUrl}${check.location}`;
    let jsonMatches = true;

    if (check.json) {
      try {
        const value = JSON.parse(body);
        jsonMatches = Array.isArray(value) && value.length > 0;
      } catch {
        jsonMatches = false;
      }
    }

    const expectedContent = Array.isArray(check.contains) ? check.contains : [check.contains].filter(Boolean);
    const contentMatches = expectedContent.every(value => body.includes(value));
    const headersMatch = Object.entries(check.headers ?? {}).every(([name, values]) => {
      const actual = response.headers.get(name) ?? "";
      return values.every(value => actual.includes(value));
    });
    const absentHeadersMatch = (check.absentHeaders ?? []).every(name => !response.headers.has(name));
    const contentTypeMatches = !check.contentType
      || (response.headers.get("content-type") ?? "").startsWith(check.contentType);
    const sizeMatches = !check.minBytes || bodyBytes.byteLength >= check.minBytes;

    const ok = response.status === check.status
      && contentMatches
      && locationMatches
      && jsonMatches
      && headersMatch
      && absentHeadersMatch
      && contentTypeMatches
      && sizeMatches;

    console.log(`${ok ? "PASS" : "FAIL"} ${check.path} ${response.status}${location ? ` -> ${location}` : ""}`);
    failed ||= !ok;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${check.path} ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exit(1);
console.log(`Production smoke passed for ${baseUrl}`);
