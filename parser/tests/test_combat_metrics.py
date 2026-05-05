"""Unit tests for Skada-aligned combat event metric extraction."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from combat_metrics import (
    encounter_damage_amount,
    extract_damage_fields,
    extract_heal_fields,
    session_damage_amount,
)


def test_extract_spell_damage_fields_and_formulas():
    parts = [
        "SPELL_DAMAGE",
        "0x0600000000000001", "Phyre", "0x512",
        "0xF130000000000001", "Lord Marrowgar", "0xa48",
        "133", "Fireball", "4",
        "1000", "250", "4", "0", "0", "100", "0", "1",
    ]

    fields = extract_damage_fields(parts)

    assert fields is not None
    assert fields.amount == 1000
    assert fields.overkill == 250
    assert fields.absorbed == 100
    assert fields.school == 4
    assert fields.is_crit is True
    assert fields.spell_name == "Fireball"
    assert encounter_damage_amount(fields) == 650
    assert session_damage_amount(fields) == 1100


def test_extract_swing_damage_uses_shifted_wotlk_indexes():
    parts = [
        "SWING_DAMAGE",
        "0x0600000000000001", "Phyre", "0x512",
        "0xF130000000000001", "Lord Marrowgar", "0xa48",
        "1000", "250", "1", "0", "0", "100", "1",
    ]

    fields = extract_damage_fields(parts)

    assert fields is not None
    assert fields.amount == 1000
    assert fields.overkill == 250
    assert fields.absorbed == 100
    assert fields.school == 1
    assert fields.is_crit is True
    assert fields.spell_name == "Auto Attack"


def test_extract_heal_fields_uses_effective_healing():
    parts = [
        "SPELL_HEAL",
        "0x0600000000000001", "Healz", "0x512",
        "0x0600000000000002", "Tank", "0x512",
        "48782", "Holy Light", "2",
        "5000", "1250", "0", "1",
    ]

    fields = extract_heal_fields(parts)

    assert fields is not None
    assert fields.gross == 5000
    assert fields.overheal == 1250
    assert fields.effective == 3750
    assert fields.school == 2
    assert fields.is_crit is True
    assert fields.spell_name == "Holy Light"
