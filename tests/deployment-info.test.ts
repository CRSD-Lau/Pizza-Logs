import assert from "node:assert/strict";
import { getDeploymentInfo } from "../lib/deployment-info";

const info = getDeploymentInfo({
  APP_VERSION: "2.0.0",
  RAILWAY_GIT_COMMIT_SHA: "1234567890abcdef",
  RAILWAY_GIT_BRANCH: "main",
  RAILWAY_DEPLOYMENT_ID: "deployment-123",
  RAILWAY_ENVIRONMENT_NAME: "production",
  RAILWAY_SERVICE_NAME: "web",
});

assert.deepEqual(info, {
  version: "2.0.0",
  commitSha: "1234567890abcdef",
  commitShort: "1234567",
  branch: "main",
  deploymentId: "deployment-123",
  environment: "production",
  service: "web",
});

assert.equal(getDeploymentInfo({ NODE_ENV: "test" }).environment, "test");
assert.equal(getDeploymentInfo({}).commitSha, null);

console.log("deployment-info tests passed");
