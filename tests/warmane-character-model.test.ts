import assert from "node:assert/strict";
import vm from "node:vm";
import { buildWarmaneModelViewerDocument } from "../components/players/WarmaneCharacterModel";
import type { ArmoryCharacterAppearance } from "../lib/warmane-armory";

const appearance: ArmoryCharacterAppearance = {
  modelId: "draeneifemale", skin: 0, hairStyle: 5, hairColor: 3, face: 7,
  facialHair: 0, faceColor: 0, earPiercing: 0, hornStyle: 0, tattoo: 0,
  classId: 2, items: [[1, 63931]],
};
const html = buildWarmaneModelViewerDocument(appearance);
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(script, "The actual sandbox startup script must be exercised");

function runViewer({ mode = 1, throws = false, canvas = true, loadedAt = 0 } = {}) {
  const messages: Array<{ status: string; reason?: string }> = [];
  const timers: Array<() => void> = [];
  let ticks = 0;
  class ModelViewer {
    static WOW = 0;
    static FLASH = 2;
    static Wow = { Types: { CHARACTER: 1 } };
    mode = mode;
    renderer = { zoom: { current: 0, target: 0 }, projMatrix: Array(16).fill(0) };
    method(name: string) { return name === "isLoaded" ? ticks >= loadedAt : null; }
    constructor(options: { aspect: number }) {
      assert.equal(options.aspect, 174 / 358);
      if (throws) throw new Error("Synthetic renderer failure");
    }
  }
  vm.runInNewContext(script!, {
    ModelViewer,
    $: () => ({}),
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 174, height: 358 }) }),
      querySelector: () => canvas ? { width: 174, height: 358 } : null,
    },
    parent: { postMessage: (message: { status: string; reason?: string }) => messages.push(message) },
    setTimeout: (callback: () => void) => timers.push(callback),
  });
  while (timers.length) {
    assert.ok(ticks++ < 50, "Viewer polling must be bounded");
    timers.shift()!();
  }
  return { messages, ticks };
}

assert.equal(runViewer().messages[0]?.status, "ready");
const slowGeometry = runViewer({ loadedAt: 16 });
assert.equal(slowGeometry.messages[0]?.status, "ready");
assert.equal(slowGeometry.ticks, 16, "A sized canvas must wait for the character model");
assert.equal(runViewer({ loadedAt: Infinity }).messages[0]?.status, "failed");
const unsupported = runViewer({ mode: 2 });
assert.equal(unsupported.messages[0]?.status, "failed");
assert.equal(unsupported.messages[0]?.reason, "webgl");
assert.equal(unsupported.ticks, 0, "An unsupported browser must not wait for an impossible canvas");
assert.equal(runViewer({ throws: true }).messages[0]?.status, "failed");
const missingCanvas = runViewer({ canvas: false });
assert.equal(missingCanvas.messages[0]?.status, "failed");
assert.equal(missingCanvas.ticks, 40, "A stalled renderer stops polling");
assert.doesNotMatch(buildWarmaneModelViewerDocument({ ...appearance, modelId: "</script><script>bad()" }), /<script>bad/);

console.log("warmane character model tests passed");
