"""Skada-aligned combat event metric extraction helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DamageFields:
    amount: float
    overkill: float
    absorbed: float
    school: int
    is_crit: bool
    spell_name: str


@dataclass(frozen=True)
class HealFields:
    gross: float
    overheal: float
    absorbed: float
    effective: float
    school: int
    is_crit: bool
    spell_name: str


def extract_damage_fields(parts: list[str]) -> Optional[DamageFields]:
    event = parts[0] if parts else ""
    if event == "SWING_DAMAGE":
        if len(parts) < 14:
            return None
        return DamageFields(
            amount=_safe_float(parts[7]),
            overkill=_safe_float(parts[8]),
            absorbed=_safe_float(parts[12]) if len(parts) > 12 else 0.0,
            school=_safe_int(parts[9]) or 1,
            is_crit=parts[13] == "1",
            spell_name="Auto Attack",
        )

    if len(parts) < 15:
        return None
    return DamageFields(
        amount=_safe_float(parts[10]),
        overkill=_safe_float(parts[11]),
        absorbed=_safe_float(parts[15]) if len(parts) > 15 else 0.0,
        school=_safe_int(parts[9]) or 1,
        is_crit=len(parts) > 17 and parts[17] == "1",
        spell_name=parts[8].strip('"').strip(),
    )


def extract_heal_fields(parts: list[str]) -> Optional[HealFields]:
    if len(parts) < 11:
        return None
    gross = _safe_float(parts[10])
    overheal = _safe_float(parts[11]) if len(parts) > 11 else 0.0
    absorbed = _safe_float(parts[12]) if len(parts) > 12 else 0.0
    return HealFields(
        gross=gross,
        overheal=overheal,
        absorbed=absorbed,
        effective=max(0.0, gross - overheal),
        school=_safe_int(parts[9]) or 2,
        is_crit=len(parts) > 13 and parts[13] == "1",
        spell_name=parts[8].strip('"').strip(),
    )


def encounter_damage_amount(fields: DamageFields) -> float:
    """Damage stored for encounter DPS: excludes overkill and absorbed shield damage."""
    return max(0.0, fields.amount - fields.overkill - fields.absorbed)


def session_damage_amount(fields: DamageFields) -> float:
    """Full-session output convention: count unabsorbed plus absorbed output."""
    return max(0.0, fields.amount + fields.absorbed)


def _safe_int(s: str) -> int:
    try:
        return int(s.strip(), 0)
    except (ValueError, TypeError):
        return 0


def _safe_float(s: str) -> float:
    try:
        v = float(s.strip())
        return max(0.0, v)
    except (ValueError, TypeError):
        return 0.0
