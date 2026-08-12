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
