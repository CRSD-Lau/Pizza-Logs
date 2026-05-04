import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = readFileSync(path.join(root, "app", "bosses", "page.tsx"), "utf8");

assert.match(source, /import \{ getRevealClassName, getRevealStyle \} from "@\/lib\/ui-animation"/);
assert.match(source, /raid\.bosses\.map\(\(b, index\) =>/);
assert.match(source, /className=\{getRevealClassName\(\{\s*boss: true,/);
assert.match(source, /style=\{getRevealStyle\(index,/);
assert.match(source, /hidden md:grid/);
assert.match(source, /md:hidden/);
assert.match(source, /grid-cols-3/);
assert.match(source, /overflow-hidden/);
assert.match(source, /min-w-0/);
assert.match(source, /aria-label=\{`\$\{b\.name\} boss summary`\}/);
assert.match(source, /group-hover:text-gold-light/);

console.log("bosses mobile source tests passed");
