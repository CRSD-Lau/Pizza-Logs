import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type RootDirContext = {
  cwd: string;
  settings: { next?: { rootDir?: unknown } };
};

const pluginUtility = path.join(
  process.cwd(),
  "node_modules",
  "@next",
  "eslint-plugin-next",
  "dist",
  "utils",
  "get-root-dirs.js",
);
const pluginSource = fs.readFileSync(pluginUtility, "utf8");
const { getRootDirs } = require(pluginUtility) as {
  getRootDirs: (context: RootDirContext) => string[];
};

assert.equal(
  pluginSource.match(/_fastglob\.globSync/g)?.length,
  1,
  "The installed Next plugin still has one known fast-glob call site",
);
assert.match(
  pluginSource,
  /_fastglob\.globSync\)\(rootDir\.replace\(\/\\\\\/g, '\/'\), \{\s*onlyDirectories: true\s*\}\)/,
  "The compatibility surface remains globSync(pattern, { onlyDirectories: true })",
);

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "next-eslint-roots-"));
const fixtureGlob = fixture.replaceAll("\\", "/");
const relativeFixture = path.relative(process.cwd(), fixture).replaceAll("\\", "/");
const context = (rootDir?: unknown): RootDirContext => ({
  cwd: fixture,
  settings: rootDir === undefined ? {} : { next: { rootDir } },
});
const sorted = (values: string[]) => values.toSorted((left, right) => left.localeCompare(right));

try {
  for (const directory of [
    "apps/admin/deep",
    "apps/web",
    "apps/.hidden/nested",
    "packages/shared/src/deep",
    "services/api",
    "services/web",
    "vendor/next-eslint-glob/src/nested",
  ]) {
    fs.mkdirSync(path.join(fixture, directory), { recursive: true });
  }
  fs.writeFileSync(path.join(fixture, "apps", "README.md"), "not a directory");

  let junctionCreated = false;
  try {
    fs.symlinkSync(
      path.join(fixture, "packages", "shared"),
      path.join(fixture, "apps", "shared-link"),
      process.platform === "win32" ? "junction" : "dir",
    );
    junctionCreated = true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EACCES" && code !== "ENOTSUP") throw error;
  }

  assert.deepEqual(getRootDirs(context()), [fixture], "The default is ESLint's cwd without glob processing");

  assert.deepEqual(
    getRootDirs(context(`${fixtureGlob}/apps`)),
    [`${fixtureGlob}/apps`],
    "A static directory returns itself without descendants",
  );
  assert.deepEqual(
    getRootDirs(context(`${fixtureGlob}/apps/`)),
    [`${fixtureGlob}/apps/`],
    "A static trailing slash remains part of the returned path spelling",
  );
  assert.deepEqual(
    getRootDirs(context(`${relativeFixture}/apps`)),
    [`${relativeFixture}/apps`],
    "A relative configured directory remains relative",
  );
  assert.deepEqual(
    getRootDirs(context(`./${relativeFixture}/apps`)),
    [`./${relativeFixture}/apps`],
    "An explicit relative prefix remains intact",
  );

  const immediateDirectories = [
    `${fixtureGlob}/apps/admin`,
    ...(junctionCreated ? [`${fixtureGlob}/apps/shared-link`] : []),
    `${fixtureGlob}/apps/web`,
  ];
  assert.deepEqual(
    sorted(getRootDirs(context(`${fixtureGlob}/apps/*`))),
    sorted(immediateDirectories),
    "A single wildcard returns immediate non-dot directories, excluding the base and matching files",
  );

  const recursiveDirectories = [
    ...immediateDirectories,
    `${fixtureGlob}/apps/admin/deep`,
    ...(junctionCreated
      ? [`${fixtureGlob}/apps/shared-link/src`, `${fixtureGlob}/apps/shared-link/src/deep`]
      : []),
  ];
  assert.deepEqual(
    sorted(getRootDirs(context(`${fixtureGlob}/apps/**`))),
    sorted(recursiveDirectories),
    "A recursive wildcard excludes its base, includes descendants, and traverses directory links when supported",
  );
  assert.deepEqual(
    sorted(getRootDirs(context(`${fixtureGlob}/apps/**/*`))),
    sorted(recursiveDirectories),
    "The common recursive descendant spelling has the same directory set",
  );
  assert.deepEqual(
    sorted(getRootDirs(context(`${fixtureGlob}/apps/**/`))),
    sorted(recursiveDirectories),
    "A terminal recursive glob with a trailing slash also excludes its base",
  );

  if (junctionCreated) {
    assert.deepEqual(
      sorted(getRootDirs(context(`${relativeFixture}/apps/*`))),
      sorted([
        `${relativeFixture}/apps/admin`,
        `${relativeFixture}/apps/shared-link`,
        `${relativeFixture}/apps/web`,
      ]),
      "A dynamic relative pattern keeps relative junction and directory paths",
    );
    assert.deepEqual(
      sorted(getRootDirs(context(`./${relativeFixture}/apps/*`))),
      sorted([
        `./${relativeFixture}/apps/admin`,
        `./${relativeFixture}/apps/shared-link`,
        `./${relativeFixture}/apps/web`,
      ]),
      "A dynamic explicit-relative pattern keeps its prefix for junctions and directories",
    );
    assert.deepEqual(
      sorted(getRootDirs(context(`${fixtureGlob}/apps/shared-link/**`))),
      sorted([
        `${fixtureGlob}/apps/shared-link/src`,
        `${fixtureGlob}/apps/shared-link/src/deep`,
      ]),
      "A recursive junction-root pattern traverses descendants without including its base",
    );
  }

  assert.deepEqual(
    sorted(getRootDirs(context(`${fixtureGlob}/apps/{admin,web}`))),
    sorted([`${fixtureGlob}/apps/admin`, `${fixtureGlob}/apps/web`]),
    "Brace expansion resolves each requested directory",
  );
  assert.deepEqual(
    sorted(getRootDirs(context(`${fixtureGlob}/vendor/{next-eslint-glob,missing}/**`))),
    sorted([
      `${fixtureGlob}/vendor/next-eslint-glob/src`,
      `${fixtureGlob}/vendor/next-eslint-glob/src/nested`,
    ]),
    "A terminal recursive glob excludes every brace-expanded base while retaining descendants",
  );
  assert.deepEqual(
    getRootDirs(context(`${fixtureGlob}/apps/.*`)),
    [`${fixtureGlob}/apps/.hidden`],
    "Dot directories are returned only when explicitly matched",
  );

  assert.throws(
    () => getRootDirs(context("")),
    /Patterns must be a string \(non empty\)/,
    "The current consumer contract rejects an explicitly empty root pattern",
  );
  assert.deepEqual(getRootDirs(context(`${fixtureGlob}/missing`)), [], "A missing static root has no matches");
  assert.deepEqual(getRootDirs(context(`${fixtureGlob}/missing/*`)), [], "A missing glob has no matches");
  assert.deepEqual(getRootDirs(context(`${fixtureGlob}/apps/README.md`)), [], "onlyDirectories excludes static files");

  assert.deepEqual(
    sorted(getRootDirs(context([
      `${fixtureGlob}/packages/*`,
      `${fixtureGlob}/services/{api,web}`,
      42,
    ]))),
    sorted([
      `${fixtureGlob}/packages/shared`,
      `${fixtureGlob}/services/api`,
      `${fixtureGlob}/services/web`,
    ]),
    "Root arrays flatten string matches and ignore non-string entries",
  );

  if (junctionCreated) {
    assert.deepEqual(
      getRootDirs(context(`${fixtureGlob}/apps/shared-link`)),
      [`${fixtureGlob}/apps/shared-link`],
      "A configured directory link remains identified by its configured path",
    );
  }

  if (process.platform === "win32") {
    assert.deepEqual(
      getRootDirs(context(`${fixture}\\apps\\web`)),
      [`${fixtureGlob}/apps/web`],
      "Windows separators are normalized to forward slashes before matching",
    );
  }
} finally {
  const resolvedFixture = path.resolve(fixture);
  const resolvedTemp = path.resolve(os.tmpdir());
  const fixtureParentMatches = process.platform === "win32"
    ? path.dirname(resolvedFixture).toLowerCase() === resolvedTemp.toLowerCase()
    : path.dirname(resolvedFixture) === resolvedTemp;
  if (!fixtureParentMatches || !path.basename(resolvedFixture).startsWith("next-eslint-roots-")) {
    throw new Error(`Refusing to remove unexpected root-directory fixture: ${resolvedFixture}`);
  }
  fs.rmSync(fixture, { recursive: true, force: true });
}

console.log("Next ESLint root directory compatibility tests passed");
