"""Locked acceptance targets captured from the shared 2026-07-31 UwU report."""

from __future__ import annotations

import json
from pathlib import Path


BASELINE_PATH = Path(__file__).parent / "baselines" / "uwu-2026-07-31-lausudo.json"


def test_uwu_reference_baseline_is_complete_and_stable() -> None:
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    encounters = baseline["encounters"]

    assert baseline["schemaVersion"] == 1
    assert len(encounters) == 5
    assert [(row["boss"], row["difficulty"], row["outcome"]) for row in encounters] == [
        ("Lord Marrowgar", "25H", "KILL"),
        ("Lady Deathwhisper", "25N", "KILL"),
        ("Gunship Battle", "25H", "KILL"),
        ("Deathbringer Saurfang", "25H", "WIPE"),
        ("Deathbringer Saurfang", "25H", "WIPE"),
    ]
    assert encounters[-1]["durationSeconds"] == 242.263
    assert encounters[-1]["totalDamage"] == 45_521_200
    assert {row["player"] for row in baseline["playerAcceptanceChecks"]} == {
        "Shadowcake", "Azyia", "Gowron",
    }
