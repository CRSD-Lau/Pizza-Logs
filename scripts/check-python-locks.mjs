import fs from "node:fs";

function canonicalName(value) {
  return value.toLowerCase().replace(/[-_.]+/g, "-");
}

function pinnedPackages(path) {
  const packages = new Map();
  const text = fs.readFileSync(path, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-r ")) continue;

    const match = /^([a-z0-9_.-]+)(?:\[[^\]]+\])?==([^\s\\;]+)/i.exec(line);
    if (match) packages.set(canonicalName(match[1]), match[2]);
  }

  return packages;
}

function requirePins(manifestPath, lockPath) {
  const manifest = pinnedPackages(manifestPath);
  const lock = pinnedPackages(lockPath);

  for (const [name, version] of manifest) {
    if (lock.get(name) !== version) {
      throw new Error(`${lockPath} must lock ${name}==${version} from ${manifestPath}`);
    }
  }

  return lock;
}

const runtimeLock = requirePins("parser/requirements.txt", "parser/requirements.lock");
const developmentLock = requirePins("parser/requirements-dev.txt", "parser/requirements-dev.lock");

for (const [name, version] of runtimeLock) {
  if (developmentLock.get(name) !== version) {
    throw new Error(`parser/requirements-dev.lock must include runtime pin ${name}==${version}`);
  }
}

console.log(
  `Python lock consistency passed (${runtimeLock.size} runtime, ${developmentLock.size} development packages).`,
);
