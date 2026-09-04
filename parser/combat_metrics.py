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
    if event == "ENVIRONMENTAL_DAMAGE":
        # WotLK environmental events have an environmental type instead of the
        # three spell fields. Keep incoming damage/absorbs at their own offsets.
        if len(parts) < 15:
            return None
        return DamageFields(
            amount=_safe_float(parts[8]),
            overkill=_safe_float(parts[9]),
            absorbed=_safe_float(parts[13]),
            school=_safe_int(parts[10]) or 1,
            is_crit=parts[14] == "1",
            spell_name=parts[7].strip('"').strip(),
        )
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
    """UwU Total Damage: use the raw damage amount reported by the log."""
    return max(0.0, fields.amount)


def useful_damage_amount(fields: DamageFields) -> float:
    """Legacy useful/effective damage kept separate from headline Total Damage."""
    return max(0.0, fields.amount - fields.overkill - fields.absorbed)


def session_damage_amount(fields: DamageFields) -> float:
    """UwU Custom Slice Total Damage: use the raw reported amount."""
    return max(0.0, fields.amount)


def reported_damage_taken_amount(fields: DamageFields) -> float:
    """UwU-compatible incoming damage as reported by the combat log.

    UwU's headline Damage Taken metric sums the event amount without removing
    overkill or the separately reported absorbed value.  Keeping this formula
    separate from encounter_damage_amount prevents outgoing DPS semantics from
    being silently reused for an analytically different metric.
    """
    return max(0.0, fields.amount)


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
