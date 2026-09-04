import assert from "node:assert/strict";
import { readUpstreamText } from "../lib/upstream-response";

async function main() {
assert.equal(await readUpstreamText(new Response("hello"), 5), "hello");
await assert.rejects(readUpstreamText(new Response("hello", { headers: { "content-length": "100" } }), 5));
let cancelled = false;
const stream = new ReadableStream({
  start(controller) { controller.enqueue(new Uint8Array(8)); },
  cancel() { cancelled = true; },
});
await assert.rejects(readUpstreamText(new Response(stream), 5));
assert.equal(cancelled, true);
assert.equal(await readUpstreamText(new Response("你好"), 6), "你好");
await assert.rejects(readUpstreamText(new Response("你好"), 5));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
