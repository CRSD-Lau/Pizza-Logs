export type DeploymentInfo = {
  version: string;
  commitSha: string | null;
  commitShort: string | null;
  branch: string | null;
  deploymentId: string | null;
  environment: string;
  service: string | null;
};

type DeploymentEnvironment = Readonly<Record<string, string | undefined>>;

export function getDeploymentInfo(env: DeploymentEnvironment = process.env): DeploymentInfo {
  const commitSha = env.RAILWAY_GIT_COMMIT_SHA ?? env.GITHUB_SHA ?? null;

  return {
    version: env.APP_VERSION ?? env.npm_package_version ?? "0.1.0",
    commitSha,
    commitShort: commitSha?.slice(0, 7) ?? null,
    branch: env.RAILWAY_GIT_BRANCH ?? env.GITHUB_REF_NAME ?? null,
    deploymentId: env.RAILWAY_DEPLOYMENT_ID ?? null,
    environment: env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV ?? "unknown",
    service: env.RAILWAY_SERVICE_NAME ?? null,
  };
}
