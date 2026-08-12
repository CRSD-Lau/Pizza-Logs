import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/production-smoke.yml", "utf8");

assert.match(workflow, /github\.event\.deployment_status\.state == 'success'/);
assert.match(workflow, /endsWith\(github\.event\.deployment\.environment, 'production'\)/);
assert.doesNotMatch(workflow, /github\.event\.deployment\.environment == 'production'/);
assert.match(workflow, /inputs\.base_url \|\| 'https:\/\/pizza-logs-production\.up\.railway\.app'/);
assert.doesNotMatch(workflow, /deployment_status\.environment_url/);

console.log("production smoke workflow tests passed");
