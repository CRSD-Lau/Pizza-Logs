import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".venv",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tools",
]);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(absolute));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(absolute);
  }

  return files;
}

function targetsIn(markdown) {
  const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, "");
  const targets = [];
  const inline = /!?\[[^\]]*\]\(([^)]+)\)/g;
  const reference = /^\[[^\]]+\]:\s*(\S+)/gm;

  for (const match of withoutCodeBlocks.matchAll(inline)) targets.push(match[1]);
  for (const match of withoutCodeBlocks.matchAll(reference)) targets.push(match[1]);
  return targets;
}

function localTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
  else target = target.split(/\s+["']/)[0];

  if (!target || target.startsWith("#")) return null;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) return null;

  const withoutFragment = target.split("#", 1)[0].split("?", 1)[0];
  if (!withoutFragment) return null;

  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

const failures = [];
const files = await markdownFiles(root);

for (const file of files) {
  const markdown = await readFile(file, "utf8");
  for (const rawTarget of targetsIn(markdown)) {
    const target = localTarget(rawTarget);
    if (!target) continue;

    const resolved = target.startsWith("/")
      ? path.resolve(root, `.${target}`)
      : path.resolve(path.dirname(file), target);

    try {
      await access(resolved);
    } catch {
      failures.push(`${path.relative(root, file)} -> ${rawTarget}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Broken local Markdown links:");
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation links passed (${files.length} Markdown files).`);
