import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { ParseResultSchema } from "../lib/schema";
import { MAX_PARSER_EVENT_BYTES } from "../lib/parser-transport";

const python = process.env.PARSER_CONTRACT_PYTHON;

test("every canonical Python fixture satisfies the web persistence contract", {
  skip: python ? false : "Set PARSER_CONTRACT_PYTHON to the hash-locked parser Python executable",
}, () => {
  const script = `
import hashlib, json, sys
from pathlib import Path
sys.path.insert(0, str(Path('parser').resolve()))
from main import _enc_to_dict, session_analytics_payload
from parser_core import CombatLogParser
from version import make_parser_provenance
results = []
for source in sorted(Path('parser/tests/fixtures').glob('*/combatlog.txt')):
    parser = CombatLogParser(file_year=2024)
    with source.open(encoding='utf-8') as stream:
        encounters = parser.parse_file(stream)
    results.append({'fixture': source.parent.name, 'payload': {
        'filename': 'synthetic.txt', 'fileHash': hashlib.sha256(source.read_bytes()).hexdigest(),
        'rawLineCount': parser.raw_count, 'encounters': [_enc_to_dict(item) for item in encounters],
        'warnings': parser.warnings,
        'sessionDamage': {str(k): v for k, v in parser.session_damage.items()},
        'sessionAnalytics': session_analytics_payload(parser),
        'provenance': make_parser_provenance(),
    }})
print(json.dumps(results))
`;
  const raw = execFileSync(python!, ["-c", script], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 60_000 });
  const cases = JSON.parse(raw) as { fixture: string; payload: unknown }[];
  assert.ok(cases.length > 0);
  for (const item of cases) {
    const result = ParseResultSchema.safeParse(item.payload);
    assert.equal(result.success, true, `${item.fixture}: ${result.success ? "" : result.error.message}`);
    assert.ok(Buffer.byteLength(JSON.stringify(item.payload)) < MAX_PARSER_EVENT_BYTES, item.fixture);
  }
});
