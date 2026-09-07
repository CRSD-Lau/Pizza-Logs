import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { UPLOAD_POLICY_HEADER, UPLOAD_POLICY_VERSION } from "../lib/upload-policy.ts";

export function localTestBase(value) {
  const base = new URL(value);
  assert.ok(
    ["http:", "https:"].includes(base.protocol)
      && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
      && !base.username && !base.password,
    "E2E uploads are restricted to an isolated loopback test stack.",
  );
  return base;
}

// Generate upload bytes from public synthetic constants. Never send local file
// contents: the separate fixture comparison test detects drift in this sample.
export function syntheticCombatLog() {
  const boss = '0xF130000000000001,"Lord Marrowgar",0xa18';
  const actors = [
    '0x0600000000000001,"Phyre",0x514',
    '0x0600000000000002,"Lausudo",0x514',
  ];
  const spells = ['28920,"Frostbolt",6', '61491,"Hammer of the Righteous",1'];
  const amounts = [10000, 8000, 10000, 8000, 5000, 4000, 5000, 4000];
  const lines = ['1/1 00:00:01.000  ENCOUNTER_START,1084,"Lord Marrowgar",4,25'];
  for (const [index, amount] of amounts.entries()) {
    const actor = index % 2;
    lines.push(`1/1 00:00:0${index + 2}.000  SPELL_DAMAGE,${actors[actor]},${boss},${spells[actor]},${amount},0,${actor === 0 ? 6 : 1},0,0,0,nil,nil,nil,nil,0`);
  }
  lines.push(`1/1 00:00:27.000  UNIT_DIED,${actors[0]},${boss},0`);
  lines.push('1/1 00:00:27.100  ENCOUNTER_END,1084,"Lord Marrowgar",4,25,1');
  return Buffer.from(`${lines.join("\n")}\n`);
}

export async function uploadSyntheticLog(base, bytes, filename = "synthetic.txt") {
  const params = new URLSearchParams({ filename, fileSize: String(bytes.length), uploaderName: "Audit", guildName: "Synthetic Audit" });
  const response = await fetch(new URL(`/api/upload?${params}`, localTestBase(base)), {
    method: "POST", body: bytes, signal: AbortSignal.timeout(120000),
    redirect: "error",
    headers: { "content-type": "application/octet-stream", "x-upload-id": randomUUID(), [UPLOAD_POLICY_HEADER]: UPLOAD_POLICY_VERSION },
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
  assert.equal(events.some(event => event.type === "error"), false, JSON.stringify(events));
  const complete = events.find(event => event.type === "complete");
  assert.ok(complete, "Upload must complete and persist");
  return complete.result;
}
