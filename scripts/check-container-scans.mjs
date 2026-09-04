import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
// Changing distribution requires reviewing the scanner's vendor advisory coverage.
// Missing EOSL is normal for a supported release; an unknown family is not a pass.
const REVIEWED_OS_FAMILIES = new Set(["alpine", "debian"]);
const RUNTIMES = {
  web: { type: "node-pkg", packages: ["next", "react", "@prisma/client"] },
  parser: { type: "python-pkg", packages: ["fastapi", "pydantic", "uvicorn"] },
};

export function validateContainerScan(service, scan, sbom, expectedImageId) {
  const runtime = RUNTIMES[service];
  const fail = reason => { throw new Error(`${service}: ${reason}`); };
  if (!runtime) fail("Unknown runtime service");
  if (typeof expectedImageId !== "string" || !SHA256.test(expectedImageId)) fail("Expected Docker image ID is required");
  if (scan?.SchemaVersion !== 2 || scan.ArtifactType !== "container_image"
    || typeof scan.ArtifactName !== "string" || !scan.ArtifactName
    || scan.Metadata?.ImageID !== expectedImageId
    || scan.Metadata?.ImageConfig?.os !== "linux") fail("Runtime scan does not identify the expected Linux image");
  const os = scan.Metadata.OS;
  if (!os || !REVIEWED_OS_FAMILIES.has(os.Family) || typeof os.Name !== "string" || !os.Name
    || (os.EOSL !== undefined && typeof os.EOSL !== "boolean")) fail("OS advisory coverage is absent or needs review");
  if (!Array.isArray(scan.Results) || !scan.Results.length) fail("Runtime scan results are absent");
  for (const result of scan.Results) {
    if (!result || typeof result.Target !== "string" || typeof result.Class !== "string" || typeof result.Type !== "string"
      || (result.Vulnerabilities !== undefined && !Array.isArray(result.Vulnerabilities))) fail("Malformed runtime scan result");
    for (const vulnerability of result.Vulnerabilities ?? []) {
      if (!vulnerability || typeof vulnerability.VulnerabilityID !== "string" || !vulnerability.VulnerabilityID
        || typeof vulnerability.PkgName !== "string" || !vulnerability.PkgName
        || !SEVERITIES.includes(vulnerability.Severity)) fail("Malformed vulnerability severity or identity");
    }
  }
  const packagesFor = (className, type) => {
    const results = scan.Results.filter(result => result.Class === className && result.Type === type);
    if (!results.length || results.some(result => !Array.isArray(result.Packages) || !result.Packages.length
      || result.Packages.some(pkg => !pkg || typeof pkg.Name !== "string" || !pkg.Name || typeof pkg.Version !== "string" || !pkg.Version))) {
      fail(`Incomplete ${type} package analysis; retain --list-all-pkgs`);
    }
    return results.flatMap(result => result.Packages);
  };
  const osPackages = packagesFor("os-pkgs", os.Family);
  const languagePackages = packagesFor("lang-pkgs", runtime.type);
  if (!runtime.packages.every(name => languagePackages.some(pkg => pkg.Name === name))) fail("Application dependencies are absent from language package analysis");

  const component = sbom?.metadata?.component;
  const imageIds = component?.properties?.filter(property => property.name === "aquasecurity:trivy:ImageID");
  if (sbom?.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components) || !sbom.components.length
    || component?.type !== "container" || component.name !== scan.ArtifactName
    || !Array.isArray(imageIds) || imageIds.length !== 1 || imageIds[0].value !== expectedImageId
    || !sbom.components.some(value => value.type === "operating-system" && value.name === os.Family && value.version === os.Name)) {
    fail("SBOM does not identify the scanned image and operating system");
  }
  const findings = Object.fromEntries(SEVERITIES.map(severity => [severity, 0]));
  for (const result of scan.Results) for (const vulnerability of result.Vulnerabilities ?? []) findings[vulnerability.Severity] += 1;
  const total = Object.values(findings).reduce((sum, count) => sum + count, 0);
  return {
    service, imageId: expectedImageId, os: `${os.Family} ${os.Name}`, findings, total,
    osPackages: osPackages.length, languagePackages: languagePackages.length,
    endOfLife: os.EOSL === true, failed: findings.CRITICAL > 0 || findings.HIGH > 0 || os.EOSL === true,
  };
}

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error("A container scan directory is required");
  const artifacts = [];
  for (const service of ["web", "parser"]) {
    const scan = JSON.parse(await fs.readFile(path.join(directory, `${service}.json`), "utf8"));
    const sbomPath = path.join(directory, `${service}.cdx.json`);
    const sbom = JSON.parse(await fs.readFile(sbomPath, "utf8"));
    // This ID is captured directly from docker inspect after the runtime build.
    const expectedImageId = (await fs.readFile(path.join(directory, `${service}.image-id`), "utf8")).trim();
    artifacts.push({ sbom, sbomPath, result: validateContainerScan(service, scan, sbom, expectedImageId) });
  }
  for (const { sbom, sbomPath, result } of artifacts) {
    console.log(JSON.stringify(result));
    sbom.metadata.authors = [{ name: "Neil Mitchell" }];
    sbom.metadata.properties ??= [];
    sbom.metadata.properties = sbom.metadata.properties.filter(value => value.name !== "lastModifiedBy");
    sbom.metadata.properties.push({ name: "lastModifiedBy", value: "Neil Mitchell" });
    await fs.writeFile(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);
  }
  if (artifacts.some(artifact => artifact.result.failed)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
