"""Shared player identity classification for supported combat-log formats."""

from __future__ import annotations

from typing import Optional


COMBATLOG_OBJECT_TYPE_PLAYER = 0x00000400
COMBATLOG_OBJECT_TYPE_MASK = 0x0000FC00

NULL_GUIDS = frozenset({
    "",
    "0X0000000000000000",
    "0XNIL",
    "NIL",
})


def _parse_flags(flags: Optional[str]) -> Optional[int]:
    if flags is None:
        return None
    try:
        return int(flags, 16)
    except (TypeError, ValueError):
        return None


def is_player_guid(guid: str, flags: Optional[str] = None) -> bool:
    """Return whether combat-log identity evidence describes a player.

    Object type flags are authoritative when present. GUID patterns remain as
    compatibility fallbacks for older logs whose flags are missing or zero.
    """
    normalized = (guid or "").strip().upper()
    if normalized in NULL_GUIDS:
        return False

    flag_value = _parse_flags(flags)
    if flag_value is not None and flag_value & COMBATLOG_OBJECT_TYPE_MASK:
        return bool(flag_value & COMBATLOG_OBJECT_TYPE_PLAYER)

    if normalized.startswith("PLAYER-"):
        return True
    if not normalized.startswith("0X"):
        return False

    hex_part = normalized[2:]
    if not hex_part or any(char not in "0123456789ABCDEF" for char in hex_part):
        return False

    # Warmane's established Lordaeron/private-server player format.
    if hex_part.startswith("06"):
        return True

    # Standard legacy WotLK player GUIDs use a zero high portion. The all-zero
    # sentinel was rejected above.
    if normalized.startswith("0X0000000000"):
        return True

    # Preserve the legacy type-nibble fallback for compatible 3.x logs.
    return len(hex_part) >= 4 and hex_part[3] == "4"
