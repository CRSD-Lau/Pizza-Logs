import assert from "node:assert/strict";
import { fetchWarmaneGearLive } from "../lib/warmane-armory";

async function main() {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;

  let rejectEquipmentRequest = false;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/character/")) {
      if (rejectEquipmentRequest) throw new Error("equipment network failure");
      return new Response("temporarily unavailable", { status: 503 });
    }

    return new Response(`
      <script>
        var charactermodel = {
          sk: 0, ha: 5, hc: 3, fa: 7, fh: 0, fc: 0, ep: 0, ho: 4, ta: 0, cls: 2,
          items: [[1,63931],[16,48563]],
          models: { type: ModelViewer.Wow.Types.CHARACTER, id: 'draeneifemale' }
        };
      </script>
    `, { status: 200 });
  };
  console.error = () => {};

  try {
    const result = await fetchWarmaneGearLive("Mothrmonster", "Lordaeron");
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("Expected the equipment request to fail.");
    assert.equal(result.appearance?.modelId, "draeneifemale");
    assert.deepEqual(result.appearance?.items, [[1, 63931], [16, 48563]]);

    rejectEquipmentRequest = true;
    const rejectedResult = await fetchWarmaneGearLive("Mothrmonster", "Lordaeron");
    assert.equal(rejectedResult.ok, false);
    if (rejectedResult.ok) throw new Error("Expected the equipment request to reject.");
    assert.equal(rejectedResult.appearance?.modelId, "draeneifemale");

    const cancelled: string[] = [];
    globalThis.fetch = async input => {
      const kind = String(input).includes("/api/character/") ? "summary" : "profile";
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode("error body does not finish")); },
        cancel() { cancelled.push(kind); },
      }), { status: 503 });
    };
    const unavailable = await fetchWarmaneGearLive("Synthetic", "Lordaeron");
    assert.equal(unavailable.ok, false);
    assert.deepEqual(cancelled.sort(), ["profile", "summary"], "Both failure bodies must release their connections");

    cancelled.length = 0;
    globalThis.fetch = async input => {
      if (String(input).includes("/api/character/")) return Response.json({ name: "Synthetic", equipment: [] });
      return new Response(new ReadableStream({
        cancel() { cancelled.push("profile"); },
      }), { status: 500 });
    };
    const healthySummary = await fetchWarmaneGearLive("Synthetic", "Lordaeron");
    assert.equal(healthySummary.ok, true, "Profile failure must preserve a healthy equipment response");
    assert.deepEqual(cancelled, ["profile"]);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }

  console.log("warmane armory live fallback tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
