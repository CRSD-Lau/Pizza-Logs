# Differential parity lab

Author: Neil Mitchell
Modifier: Neil Mitchell

This lab compares identical synthetic bytes against Pizza's actual parser and
goldens captured from an independently installed, unmodified UwU revision. It
does not run reference code or access the network during ordinary CI.

Current result: **9 exact cases, 11 mismatching cases, zero tolerated cases, and
seven unproven surface categories**. Most exact cases test session primitives;
only one covers a mode-identified encounter. Complete or live parity is not proven.

## Offline commands

Install Pizza's hash-locked development requirements first. From `parser/`:

```bash
python -m parity verify --output-dir /tmp/pizza-parity
python -m parity run --output-dir /tmp/pizza-parity-full
python -m parity run --claimed-only --output-dir /tmp/pizza-parity-claims
```

Use an equivalent temporary directory on Windows. `verify` exits zero only when
every explicit exact claim matches and every reviewed mismatch retains its
exact recorded difference fingerprint. An improvement also changes that
fingerprint and requires review. Mismatches never become compatibility passes.
`run` asserts full compatibility and currently exits **1**. `--claimed-only`
is explicitly narrower.

Both commands emit `parity.json`, `parity.junit.xml`, and `parity.md`. The full
JUnit contains failures for mismatches and skips for unproven scope. `verify`
also emits `regression.junit.xml`, separating regression stability from parity.
Generated reports belong outside the repository or in ephemeral CI artifacts.

## Schema and exactness

`manifest.json` declares schema version 1, reference provenance, case scope,
exact claims, known differences, and unsupported surfaces. Each golden contains:

- SHA-256 of the identical input bytes and exact inspected reference commit;
- capture timestamp, Python version, fixed realm/year configuration, and method;
- ordered sessions with raw millisecond duration, damage, Heal, damage taken,
  and a name-keyed participant map;
- ordered encounters with name, mode, result, duration, and headline amounts;
- untouched reference display strings, retained separately for future UI work.

All numeric comparisons are exact, with no floating-point tolerance. JSON
`1000` and `1000.0` may represent the same mathematical value. Strings, missing
fields, array length, and encounter order compare exactly. Participant maps
compare identity, not displayed row order. Missing observations cannot pass.

`fixtures.py` generates 17 original synthetic scenarios. Three existing
synthetic parser fixtures are also compared. No private combat log is used.
The old five-pull acceptance JSON has no paired source and is not counted.

## Intentional reference refresh

The pinned README explicitly describes self hosting. The reference ran
privately for that intended purpose; no source redistribution license was
identified. Keep its unmodified snapshot, environment, data, and synthetic
input exports outside Pizza Logs. Do not vendor its source or assets.

Capture used Python 3.11.9 and the reference's requirements. Runtime package
versions are recorded in the manifest. `reference-source.json` contains GitHub
Git blob hashes for the pinned Python files, README, and requirements. The
adapter checks those hashes before importing the reference. A Python audit hook
denies network and child processes during capture. This is an egress guard,
not a general sandbox. Source review is required for a new revision.

Export original inputs:

```bash
python -m parity export-inputs --output-dir /tmp/pizza-inputs
```

Run with the separate reference environment's Python, from the repository root,
substituting absolute temporary paths for the examples:

```bash
reference-venv/bin/python parser/parity/capture_reference.py \
  --reference /tmp/uwu-reference \
  --data-dir /tmp/uwu-capture-new \
  --input /tmp/pizza-inputs/direct-damage.txt \
  --case-id direct-damage \
  --reference-sha 4c046d266b85ad833ab4d70addb0b6f1a16647e3 \
  --output /tmp/uwu-candidates/direct-damage.json
```

Use a fresh data directory per round. The adapter refuses arbitrary input bytes
and existing per-case caches. It calls the reference's text session splitter,
normalizer, and report methods used by the Flask report route. Archive
extraction, admission limits, publication eligibility, and historical
deduplication are outside this adapter.

Review candidates before replacing committed goldens. A new reference requires
source/license review, source-inventory update, full recapture, and review of
the manifest and differences. No command silently updates the pin or accepts
goldens.

For a complete regeneration of the **existing pin** on Windows, start in the
Pizza Logs repository root with Pizza's development Python environment active.
Install Python 3.11.9 separately first. This creates a fresh temporary workspace
and reference environment; it does not use or change an existing UwU checkout.
The package list reproduces the recorded capture environment; it is not a
hash-locked dependency file.

```powershell
$pizzaRepo = (Get-Location).Path
$pizzaPython = (Get-Command python).Source
$manifest = Get-Content parser/parity/manifest.json -Raw | ConvertFrom-Json
$referenceSha = $manifest.reference.inspectedSha
if ((py -3.11 -c 'import platform; print(platform.python_version())') -ne $manifest.reference.runtime.python) {
    throw 'Install the exact reference Python version recorded in manifest.json.'
}
$lab = Join-Path ([System.IO.Path]::GetTempPath()) ('pizza-parity-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $lab | Out-Null
$archive = Join-Path $lab 'reference.zip'
$sourceDir = Join-Path $lab 'source'
Invoke-WebRequest "https://api.github.com/repos/CRSD-Lau/uwu-logs/zipball/$referenceSha" -OutFile $archive
Expand-Archive -LiteralPath $archive -DestinationPath $sourceDir
$referenceRoots = @(Get-ChildItem -LiteralPath $sourceDir -Directory)
if ($referenceRoots.Count -ne 1) { throw 'Expected one root in the pinned source archive.' }
$reference = $referenceRoots[0].FullName
$referenceEnv = Join-Path $lab 'reference-venv'
py -3.11 -m venv $referenceEnv
$referencePython = Join-Path $referenceEnv 'Scripts/python.exe'
$packages = Join-Path $lab 'reference-packages.txt'
$manifest.reference.runtime.packages.PSObject.Properties |
    ForEach-Object { $_.Name + '==' + $_.Value } |
    Set-Content -LiteralPath $packages -Encoding utf8
& $referencePython -m pip install -r $packages
if ($LASTEXITCODE -ne 0) { throw 'Reference dependency installation failed.' }

$inputs = Join-Path $lab 'inputs'
$dataDir = Join-Path $lab 'capture-data'
$candidates = Join-Path $lab 'candidates'
Push-Location (Join-Path $pizzaRepo 'parser')
try {
    & $pizzaPython -m parity export-inputs --output-dir $inputs
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic input export failed.' }
} finally { Pop-Location }
foreach ($case in $manifest.cases) {
    & $referencePython parser/parity/capture_reference.py `
        --reference $reference --data-dir $dataDir `
        --input (Join-Path $inputs ($case.id + '.txt')) --case-id $case.id `
        --reference-sha $referenceSha --output (Join-Path $candidates ($case.id + '.json'))
    if ($LASTEXITCODE -ne 0) { throw ('Reference capture failed: ' + $case.id) }
}
git diff --no-index -- parser/parity/goldens $candidates
```

The last command normally exits 1 when capture timestamps differ. Inspect every
candidate's input hash, reference SHA, configuration, normalized values, and
display values. After review, copy each accepted candidate over its corresponding
file in `parser/parity/goldens/`, then run the offline `verify` command and the
differential tests below. If comparison results change, inspect `parity.json`;
review the case classification and exact difference fingerprint in the manifest
explicitly. Never turn a changed mismatch into an exact claim without evidence.
Run strict `run` as well and retain its honest nonzero result for incomplete
parity. Keep the source snapshot, capture data, inputs, and reports outside Git.

```bash
# From parser/, using Pizza's environment:
python -m pytest tests/test_differential_parity.py -q
python -m parity verify --output-dir /tmp/pizza-parity-refreshed
python -m parity run --output-dir /tmp/pizza-parity-refreshed-full
```

## Conservative drift check

```bash
python -m parity check-reference --cache /tmp/pizza-reference-cache.json
```

This explicit command makes one bounded HTTPS request to GitHub, reusing an
ETag when available. Exit **0** means the repository pin is current, **2** means
stale, and **3** means unavailable. A current repository pin does not prove live
deployment parity. Never make normal PR tests or report rendering depend on it.
