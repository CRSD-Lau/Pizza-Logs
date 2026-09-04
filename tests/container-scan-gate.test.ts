import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateContainerScan } from "../scripts/check-container-scans.mjs";

const imageId = `sha256:${"a".repeat(64)}`;
const otherImageId = `sha256:${"b".repeat(64)}`;
type Result = {
  Target: string; Class: string; Type: string;
  Packages?: Array<{ Name: string; Version: string }>;
  Vulnerabilities?: Array<{ VulnerabilityID: string; PkgName: string; Severity?: string }>;
};
function fixture(service: "web" | "parser" = "web") {
  const scan = {
    SchemaVersion: 2, ArtifactType: "container_image", ArtifactName: `pizza-logs-${service}:ci`,
    Metadata: { ImageID: imageId, ImageConfig: { os: "linux" }, OS: { Family: "alpine", Name: "3.24.1", EOSL: false } },
    Results: [
      { Target: `pizza-logs-${service}:ci (alpine 3.24.1)`, Class: "os-pkgs", Type: "alpine", Packages: [{ Name: "musl", Version: "1.2.5-r0" }] },
      { Target: service === "web" ? "Node.js" : "Python", Class: "lang-pkgs", Type: service === "web" ? "node-pkg" : "python-pkg",
        Packages: (service === "web" ? ["next", "react", "@prisma/client"] : ["fastapi", "pydantic", "uvicorn"]).map(Name => ({ Name, Version: "1.0.0" })) },
    ] as Result[],
  };
  const sbom = {
    bomFormat: "CycloneDX",
    metadata: { component: { type: "container", name: scan.ArtifactName, properties: [{ name: "aquasecurity:trivy:ImageID", value: imageId }] } },
    components: [{ type: "operating-system", name: "alpine", version: "3.24.1" }],
  };
  return { scan, sbom };
}

test("complete zero-finding runtime scans pass for Node and Python", () => {
  for (const service of ["web", "parser"] as const) {
    const { scan, sbom } = fixture(service);
    // Trivy omits EOSL for supported images in real reports.
    Reflect.deleteProperty(scan.Metadata.OS, "EOSL");
    const result = validateContainerScan(service, scan, sbom, imageId);
    assert.equal(result.failed, false);
    assert.equal(result.total, 0);
    assert.equal(result.osPackages, 1);
    assert.equal(result.languagePackages, 3);
  }
});

test("an OS-only, empty-language or missing-application scan cannot pass", () => {
  for (const service of ["web", "parser"] as const) {
    const { scan, sbom } = fixture(service);
    const complete = structuredClone(scan);
    scan.Results = [scan.Results[0]];
    assert.throws(() => validateContainerScan(service, scan, sbom, imageId), /package analysis/);
    scan.Results = structuredClone(complete.Results);
    delete scan.Results[1].Packages;
    assert.throws(() => validateContainerScan(service, scan, sbom, imageId), /list-all-pkgs/);
    scan.Results[1].Packages = [];
    assert.throws(() => validateContainerScan(service, scan, sbom, imageId), /package analysis/);
    scan.Results[1].Packages = [{ Name: "unrelated-tool", Version: "1.0.0" }];
    assert.throws(() => validateContainerScan(service, scan, sbom, imageId), /Application dependencies/);
  }
});

test("scan and SBOM must identify the independently inspected image", () => {
  const { scan, sbom } = fixture();
  assert.throws(() => validateContainerScan("web", scan, sbom, ""), /Expected Docker image ID/);
  assert.throws(() => validateContainerScan("web", scan, sbom, otherImageId), /expected Linux image/);
  scan.ArtifactType = "filesystem";
  assert.throws(() => validateContainerScan("web", scan, sbom, imageId), /expected Linux image/);
  scan.ArtifactType = "container_image";
  sbom.metadata.component.properties[0].value = otherImageId;
  assert.throws(() => validateContainerScan("web", scan, sbom, imageId), /SBOM/);
  sbom.metadata.component.properties[0].value = imageId;
  sbom.metadata.component.name = "a-different-image:ci";
  assert.throws(() => validateContainerScan("web", scan, sbom, imageId), /SBOM/);
});

test("missing or unreviewed OS analysis fails and supported EOSL blocks release", () => {
  const { scan, sbom } = fixture();
  scan.Metadata.OS.Family = "unknown";
  assert.throws(() => validateContainerScan("web", scan, sbom, imageId), /OS advisory coverage/);
  scan.Metadata.OS.Family = "alpine";
  scan.Results[0].Type = "unknown";
  assert.throws(() => validateContainerScan("web", scan, sbom, imageId), /alpine package analysis/);
  scan.Results[0].Type = "alpine";
  scan.Metadata.OS.EOSL = true;
  assert.equal(validateContainerScan("web", scan, sbom, imageId).failed, true);
});

test("retain every severity and block unfixed High or Critical vulnerabilities", () => {
  const { scan, sbom } = fixture();
  const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
  scan.Results[0].Vulnerabilities = severities.map((Severity, index) => ({ VulnerabilityID: `TEST-${index}`, PkgName: "musl", Severity }));
  const result = validateContainerScan("web", scan, sbom, imageId);
  assert.equal(result.failed, true);
  assert.equal(result.total, 5);
  assert.deepEqual(result.findings, { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1, UNKNOWN: 1 });
  scan.Results[0].Vulnerabilities = scan.Results[0].Vulnerabilities.slice(2);
  assert.equal(validateContainerScan("web", scan, sbom, imageId).failed, false);
  delete scan.Results[0].Vulnerabilities[0].Severity;
  assert.throws(() => validateContainerScan("web", scan, sbom, imageId), /Malformed vulnerability/);
});

test("CLI fails the release gate and retains SBOM attribution for blocking findings", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pizza-scan-gate-"));
  const script = fileURLToPath(new URL("../scripts/check-container-scans.mjs", import.meta.url));
  const run = () => spawnSync(process.execPath, [script, directory], { encoding: "utf8" });
  try {
    for (const service of ["web", "parser"] as const) {
      const { scan, sbom } = fixture(service);
      await fs.writeFile(path.join(directory, `${service}.json`), JSON.stringify(scan));
      await fs.writeFile(path.join(directory, `${service}.cdx.json`), JSON.stringify(sbom));
      await fs.writeFile(path.join(directory, `${service}.image-id`), `${imageId}\n`);
    }
    const passing = run();
    assert.equal(passing.status, 0, passing.stderr);
    const { scan } = fixture("parser");
    scan.Results[1].Vulnerabilities = [{ VulnerabilityID: "TEST-HIGH", PkgName: "fastapi", Severity: "HIGH" }];
    await fs.writeFile(path.join(directory, "parser.json"), JSON.stringify(scan));
    const blocked = run();
    assert.equal(blocked.status, 1);
    const parserResult = blocked.stdout.trim().split("\n").map(line => JSON.parse(line)).find(result => result.service === "parser");
    assert.equal(parserResult.findings.HIGH, 1);
    assert.equal(parserResult.failed, true);
    const sbom = JSON.parse(await fs.readFile(path.join(directory, "parser.cdx.json"), "utf8"));
    assert.deepEqual(sbom.metadata.authors, [{ name: "Neil Mitchell" }]);
    assert.deepEqual(sbom.metadata.properties, [{ name: "lastModifiedBy", value: "Neil Mitchell" }]);
    await fs.unlink(path.join(directory, "parser.image-id"));
    const missingIdentity = run();
    assert.equal(missingIdentity.status, 1);
    assert.match(missingIdentity.stderr, /parser\.image-id/);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("pizza-scan-gate-"));
    await fs.rm(directory, { recursive: true });
  }
});
