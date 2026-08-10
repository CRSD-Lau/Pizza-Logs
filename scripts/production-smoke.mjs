const baseUrl = (process.env.PIZZA_LOGS_BASE_URL
  ?? "https://pizza-logs-production.up.railway.app").replace(/\/$/, "");

const checks = [
  { path: "/", status: 200, contains: "Pizza Logs" },
  { path: "/leaderboards", status: 200, contains: "Leaderboards" },
  { path: "/raids", status: 200, contains: "Raids" },
  { path: "/api/bosses", status: 200, json: true },
  { path: "/admin", status: 307, location: "/admin/login" },
  { path: "/uploads", status: 307, location: "/admin/uploads" },
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
    const body = await response.text();
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

    const ok = response.status === check.status
      && (!check.contains || body.includes(check.contains))
      && locationMatches
      && jsonMatches;

    console.log(`${ok ? "PASS" : "FAIL"} ${check.path} ${response.status}${location ? ` -> ${location}` : ""}`);
    failed ||= !ok;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${check.path} ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exit(1);
console.log(`Production smoke passed for ${baseUrl}`);
