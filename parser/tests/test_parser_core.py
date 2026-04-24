"""
Parser correctness tests — TDD suite.

Run from the parser/ directory:
    pytest tests/ -v
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from parser_core import (
    CombatLogParser, ParsedEncounter, DMG_EVENTS,
    UNIT_DIED_EVENT, ENCOUNTER_START, ENCOUNTER_END,
    _decode_difficulty, _is_player,
)
from bosses import lookup_boss


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_encounter(boss_name: str, difficulty: str = "25N", session_index: int = 0,
                   outcome: str = "KILL") -> ParsedEncounter:
    return ParsedEncounter(
        boss_name=boss_name,
        boss_def=lookup_boss(boss_name),
        boss_id=None,
        difficulty=difficulty,
        group_size=25,
        outcome=outcome,
        duration_seconds=200,
        started_at="2026-04-19T13:00:00+00:00",
        ended_at="2026-04-19T13:03:20+00:00",
        total_damage=50_000_000.0,
        total_healing=10_000_000.0,
        total_damage_taken=5_000_000.0,
        fingerprint="test",
        participants=[],
        raw_event_count=1000,
        session_index=session_index,
    )


def _spell_damage_parts(src_guid: str, src_name: str,
                        dst_guid: str, dst_name: str,
                        amount: int, spell: str = "Fireball",
                        event: str = "SPELL_DAMAGE",
                        overkill: int = 0) -> list[str]:
    """Build a minimal SPELL_DAMAGE parts list (18 fields)."""
    return [
        event,
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        "133", f'"{spell}"', "4",
        str(amount), str(overkill), "4", "0", "0", "0", "0", "0",
    ]


def _swing_damage_parts(src_guid: str, src_name: str,
                        dst_guid: str, dst_name: str,
                        amount: int, overkill: int = 0) -> list[str]:
    """Build a minimal SWING_DAMAGE parts list (14 fields)."""
    return [
        "SWING_DAMAGE",
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        str(amount), str(overkill), "1", "0", "0", "0", "0",
    ]


def _unit_died_parts(dead_name: str) -> list[str]:
    """Build a minimal UNIT_DIED parts list."""
    return [
        UNIT_DIED_EVENT,
        "0x0600000000000001", '"Phyre"', "0x512",
        "0xF130000000000001", f'"{dead_name}"', "0xa48",
        "0",
    ]


PLAYER_GUID      = "0x0600000000000001"
NPC_GUID         = "0xF130000000000001"
TRUE_PET_GUID    = "0xF140000000000001"  # 0xF140 = true WotLK pet GUID prefix
VEHICLE_GUID     = "0xF150000000000001"  # 0xF150 = vehicle GUID prefix

# dst_flags: 0x1114 = TYPE_PET | CONTROL_PLAYER | FRIENDLY | RAID (player-owned pet)
PET_DST_FLAGS     = "0x1114"
VEHICLE_DST_FLAGS = "0x1114"


def make_gunship_segment(
    crew_death: str = "Kor'kron Battle-Mage",
    encounter_end_success: int = 0,
    damage_event: str = "SPELL_DAMAGE",
    damage_amount: int = 50_000,
) -> list[tuple[str, list[str], float]]:
    """Build a minimal Gunship Battle segment.

    By default mirrors the Warmane pattern: ENCOUNTER_END success=0 even on kill,
    but crew member dies inside the window.
    """
    ts = 46800.0
    return [
        (
            "4/19 13:00:00.000",
            [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"],
            ts,
        ),
        (
            "4/19 13:01:00.000",
            _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, crew_death,
                                damage_amount, event=damage_event),
            ts + 60,
        ),
        (
            "4/19 13:02:00.000",
            _unit_died_parts(crew_death),
            ts + 120,
        ),
        (
            "4/19 13:03:21.000",
            [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25",
             str(encounter_end_success)],
            ts + 201,
        ),
    ]


# ── DMG_EVENTS exclusion regressions ──────────────────────────────────────────

def test_damage_shield_excluded_from_dmg_events():
    """DAMAGE_SHIELD is retribution-aura/thorns reflect — not player DPS."""
    assert "DAMAGE_SHIELD" not in DMG_EVENTS


def test_spell_building_damage_excluded_from_dmg_events():
    """SPELL_BUILDING_DAMAGE is vehicle/cannon fire — not player DPS."""
    assert "SPELL_BUILDING_DAMAGE" not in DMG_EVENTS


def test_core_dmg_events_present():
    """SPELL_DAMAGE, SWING_DAMAGE, RANGE_DAMAGE, SPELL_PERIODIC_DAMAGE must remain."""
    for ev in ("SPELL_DAMAGE", "SWING_DAMAGE", "RANGE_DAMAGE", "SPELL_PERIODIC_DAMAGE"):
        assert ev in DMG_EVENTS, f"{ev} missing from DMG_EVENTS"


# ── Difficulty decoding ────────────────────────────────────────────────────────

def test_decode_difficulty_25h():
    assert _decode_difficulty(6, 25) == "25H"

def test_decode_difficulty_25n():
    assert _decode_difficulty(4, 25) == "25N"

def test_decode_difficulty_10h():
    assert _decode_difficulty(5, 10) == "10H"

def test_decode_difficulty_10n():
    assert _decode_difficulty(3, 10) == "10N"

def test_decode_difficulty_fallback_25():
    assert _decode_difficulty(99, 25) == "25N"

def test_decode_difficulty_fallback_10():
    assert _decode_difficulty(99, 10) == "10N"


# ── _is_player ─────────────────────────────────────────────────────────────────

def test_is_player_warmane_guid():
    assert _is_player("0x0600000000B8F53B") is True

def test_is_player_retail_format():
    assert _is_player("Player-1234-AB123456") is True

def test_is_player_npc_guid():
    assert _is_player("0xF130000000000001") is False

def test_is_player_null_guid():
    assert _is_player("0x0000000000000000") is False

def test_is_player_empty():
    assert _is_player("") is False


# ── Gunship outcome: ENCOUNTER_END override ────────────────────────────────────

def test_gunship_kill_from_korkron_crew_death():
    """ENCOUNTER_END success=0, but Kor'kron Battle-Mage died → KILL (Alliance log)."""
    parser = CombatLogParser()
    seg = make_gunship_segment(crew_death="Kor'kron Battle-Mage", encounter_end_success=0)
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


def test_gunship_kill_from_korkron_primalist_death():
    """ENCOUNTER_END success=0, Kor'kron Primalist died → KILL."""
    parser = CombatLogParser()
    seg = make_gunship_segment(crew_death="Kor'kron Primalist", encounter_end_success=0)
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


def test_gunship_kill_from_skybreaker_crew_death():
    """ENCOUNTER_END success=0, Skybreaker Rifleman died → KILL (Horde log)."""
    parser = CombatLogParser()
    seg = make_gunship_segment(crew_death="Skybreaker Rifleman", encounter_end_success=0)
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


def test_gunship_wipe_when_no_crew_dies():
    """No crew UNIT_DIED + ENCOUNTER_END success=0 → WIPE."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Skybreaker Cannon", 5000),
         ts + 60),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "0"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "WIPE"


def test_gunship_kill_from_encounter_end_success():
    """ENCOUNTER_END success=1 → KILL regardless of crew deaths."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Target", 5000),
         ts + 60),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


# ── Gunship difficulty: session-level normalization ────────────────────────────
# These tests are RED — _normalize_session_difficulty does not exist yet.

def test_gunship_difficulty_upgraded_to_match_session_heroic():
    """Gunship has no heroic-specific spells; difficulty must be inferred
    from the session context when other encounters in the same session are HC."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0),
        make_encounter("Gunship Battle", difficulty="25N", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    gunship = next(e for e in encounters if "gunship" in e.boss_name.lower())
    assert gunship.difficulty == "25H"


def test_gunship_difficulty_unchanged_when_already_heroic():
    """If Gunship is already 25H, normalization must not change it."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0),
        make_encounter("Gunship Battle", difficulty="25H", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    gunship = next(e for e in encounters if "gunship" in e.boss_name.lower())
    assert gunship.difficulty == "25H"


def test_gunship_difficulty_unchanged_in_all_normal_session():
    """If the whole session is normal, Gunship stays 25N."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25N", session_index=0),
        make_encounter("Gunship Battle", difficulty="25N", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    gunship = next(e for e in encounters if "gunship" in e.boss_name.lower())
    assert gunship.difficulty == "25N"


def test_non_gunship_difficulty_not_changed_by_normalization():
    """Lady Deathwhisper at 25N in a heroic session must NOT be changed —
    only Gunship gets the special session-inference treatment."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0),
        make_encounter("Lady Deathwhisper", difficulty="25N", session_index=0),
        make_encounter("Gunship Battle", difficulty="25N", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    dw = next(e for e in encounters if "deathwhisper" in e.boss_name.lower())
    assert dw.difficulty == "25N"


def test_gunship_difficulty_not_cross_contaminated_across_sessions():
    """A Gunship in a session-0 normal run must not be upgraded by session-1 heroics."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25N", session_index=0),
        make_encounter("Gunship Battle",  difficulty="25N", session_index=0),
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=1),
        make_encounter("Gunship Battle",  difficulty="25N", session_index=1),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    session0_gunship = next(
        e for e in encounters if "gunship" in e.boss_name.lower() and e.session_index == 0
    )
    session1_gunship = next(
        e for e in encounters if "gunship" in e.boss_name.lower() and e.session_index == 1
    )
    assert session0_gunship.difficulty == "25N"
    assert session1_gunship.difficulty == "25H"


# ── Damage exclusion integration ───────────────────────────────────────────────

def test_spell_building_damage_not_counted_in_total():
    """SPELL_BUILDING_DAMAGE events from a player GUID must not
    contribute to total_damage — they're vehicle/cannon fire."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        # Legitimate player damage
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Kor'kron Battle-Mage",
                             100_000, "Fireball", "SPELL_DAMAGE"),
         ts + 60),
        # SPELL_BUILDING_DAMAGE — cannon fire — must NOT be counted
        ("4/19 13:01:30.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Orgrim's Hammer",
                             5_000_000, "Skybreaker Cannon", "SPELL_BUILDING_DAMAGE"),
         ts + 90),
        ("4/19 13:02:00.000",
         _unit_died_parts("Kor'kron Battle-Mage"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "0"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    # Only the 100k Fireball should count — not the 5M cannon shot
    assert enc.total_damage == pytest.approx(100_000, rel=0.01)


def test_damage_shield_not_counted_in_total():
    """DAMAGE_SHIELD events must not contribute to total_damage."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Real damage
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             200_000, "Holy Shock", "SPELL_DAMAGE"),
         ts + 60),
        # Retribution Aura reflect — must NOT be counted
        ("4/19 13:01:10.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             3_000_000, "Retribution Aura", "DAMAGE_SHIELD"),
         ts + 70),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(200_000, rel=0.01)


# ── Overkill subtraction ───────────────────────────────────────────────────────

def test_overkill_not_counted_in_spell_damage():
    """SPELL_DAMAGE overkill must be subtracted from total_damage.
    Root cause of BPC 7.8M over-count: three princes die simultaneously,
    every last hit overkills. Parser was using raw amount, not amount-overkill."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # 100k hit, 30k overkill → effective = 70k
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             100_000, "Fireball", "SPELL_DAMAGE", overkill=30_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(70_000, rel=0.01)


def test_overkill_not_counted_in_swing_damage():
    """SWING_DAMAGE overkill must also be subtracted."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # 200k swing, 50k overkill → effective = 150k
        ("4/19 13:01:00.000",
         _swing_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             200_000, overkill=50_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(150_000, rel=0.01)


def test_zero_overkill_unchanged():
    """When overkill=0 the effective damage equals raw amount."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             500_000, "Fireball", "SPELL_DAMAGE", overkill=0),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(500_000, rel=0.01)


# ── Player-to-player damage exclusion ─────────────────────────────────────────

def test_player_to_player_damage_not_counted():
    """Damage from a player to another player must not count as DPS.
    Root cause of Blood-Queen 3.8M over-count: bitten vampires attack
    other raid members (Pact of Darkfallen, Blood Mirror, Vampiric Bite)."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Blood-Queen Lana\'thel"', "6", "25"], ts),
        # Legitimate DPS to boss
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Blood-Queen Lana'thel",
                             200_000, "Fireball"),
         ts + 60),
        # Vampire bites fellow player — must NOT count
        ("4/19 13:01:30.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", PLAYER_GUID, "Notlich",
                             500_000, "Pact of the Darkfallen"),
         ts + 90),
        ("4/19 13:02:00.000",
         _unit_died_parts("Blood-Queen Lana'thel"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Blood-Queen Lana\'thel"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(200_000, rel=0.01)


def test_player_to_npc_damage_still_counted():
    """Player damage to NPCs must still be counted after P2P filter lands."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             300_000, "Holy Shock"),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(300_000, rel=0.01)


# ── Pet owner inference — interaction scan ────────────────────────────────────

def _aoe_buff_parts(caster_guid: str, caster_name: str,
                    target_guid: str, target_name: str,
                    target_flags: str = PET_DST_FLAGS) -> list[str]:
    """SPELL_AURA_APPLIED representing an AoE buff hitting a pet (e.g. BoM)."""
    return [
        "SPELL_AURA_APPLIED",
        caster_guid, f'"{caster_name}"', "0x512",
        target_guid, f'"{target_name}"', target_flags,
        "19506", '"Blessing of Might"', "2", "BUFF",
    ]


def _run_segment_encounters(events: list[tuple[str, list[str], float]]):
    """Run _segment_encounters on a pre-built event list."""
    parser = CombatLogParser()
    def gen():
        yield from events
    return parser._segment_encounters(gen())


def test_vehicle_not_mapped_as_pet_via_aoe_buff():
    """A vehicle GUID (0xF150) that receives an AoE buff from a player
    must NOT be added to pet_owner. Gunship Cannons were 4.46M of fake DPS."""
    ts = 46800.0
    events = [
        # Player buffs a vehicle-flagged target (like stepping into a cannon seat)
        ("4/19 13:00:00.000",
         _aoe_buff_parts(PLAYER_GUID, "Phyre", VEHICLE_GUID, "Skybreaker Cannon",
                         target_flags=VEHICLE_DST_FLAGS),
         ts),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts + 60),
        ("4/19 13:02:00.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "0"], ts + 120),
    ]
    _, pet_owner = _run_segment_encounters(events)
    assert VEHICLE_GUID not in pet_owner, "Vehicle GUID must not be mapped as a player pet"


def test_npc_guid_not_mapped_via_non_heal_event():
    """A regular NPC GUID (0xF130) interacted with via a non-heal event
    must NOT enter pet_owner — only true 0xF140 pet GUIDs can be inferred."""
    ts = 46800.0
    events = [
        # Player casts a buff on something with pet flags but 0xF130 GUID
        ("4/19 13:00:00.000",
         _aoe_buff_parts(PLAYER_GUID, "Phyre", NPC_GUID, "SomeNPC"),
         ts),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts + 60),
        ("4/19 13:02:00.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 120),
    ]
    _, pet_owner = _run_segment_encounters(events)
    assert NPC_GUID not in pet_owner, "0xF130 NPC must not be mapped via non-heal event"


def test_hunter_pet_mapped_via_mend_pet():
    """A 0xF140 pet GUID with no SPELL_SUMMON must be attributed to its owner
    via SPELL_PERIODIC_HEAL (Mend Pet). This is the Phase-1 pre-summon fix."""
    ts = 46800.0
    events = [
        # Mend Pet fires before ENCOUNTER_START — owner inference
        ("4/19 13:00:30.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", TRUE_PET_GUID, "Fido"),
         ts + 30),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts + 60),
        ("4/19 13:02:00.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 120),
    ]
    _, pet_owner = _run_segment_encounters(events)
    assert TRUE_PET_GUID in pet_owner, "0xF140 pet must be mapped via Mend Pet"
    assert pet_owner[TRUE_PET_GUID][1] == "Phyre"


def test_pet_damage_attributed_to_owner_via_mend_pet():
    """Damage from a pre-summoned 0xF140 pet must be credited to its owner
    when the owner is inferred from a SPELL_PERIODIC_HEAL (Mend Pet)."""
    ts = 46800.0
    # Build 8 filler player hits so segment reaches MIN_ENCOUNTER_EVENTS (10)
    filler = [
        (f"4/19 13:01:{10+i:02d}.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar", 10_000),
         ts + 70 + i)
        for i in range(8)
    ]
    events = [
        ("4/19 13:00:30.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", TRUE_PET_GUID, "Fido"),
         ts + 30),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts + 60),
        *filler,
        # Pet attacks the boss during the encounter
        ("4/19 13:01:30.000",
         _spell_damage_parts(TRUE_PET_GUID, "Fido", NPC_GUID, "Lord Marrowgar", 80_000),
         ts + 90),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    segments, pet_owner = _run_segment_encounters(events)
    assert len(segments) == 1
    enc = CombatLogParser()._aggregate_segment(segments[0], pet_owner)
    assert enc is not None
    # total = 8×10k filler + 80k pet = 160k
    assert enc.total_damage == pytest.approx(160_000, rel=0.01)
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "Phyre must appear as participant via pet attribution"
    assert phyre["totalDamage"] == pytest.approx(160_000, rel=0.01)


# ── Pre-summoned pet attribution via interaction scan ──────────────────────────
#
# When a pet was alive before the log started there is no SPELL_SUMMON event.
# The parser must infer ownership from any player→pet event during the fight
# (Mend Pet, Feed Pet, any buff).  The dst_flags bitmask identifies a pet:
#   0x1000 = TYPE_PET   0x0100 = CONTROL_PLAYER  → both must be set.

PET_GUID  = "0xF1300007AC000042"   # realistic non-player NPC GUID for a pet
PET_FLAGS = "0x1114"               # TYPE_PET | CONTROL_PLAYER | FRIENDLY | RAID

PLAYER2_GUID  = "0x0600000000000002"
PLAYER2_FLAGS = "0x514"            # TYPE_PLAYER | CONTROL_PLAYER | FRIENDLY | RAID


def _mend_pet_parts(owner_guid: str, owner_name: str,
                    pet_guid: str, pet_name: str,
                    amount: int = 3000) -> list[str]:
    """SPELL_PERIODIC_HEAL — Mend Pet tick (player heals their pet)."""
    return [
        "SPELL_PERIODIC_HEAL",
        owner_guid, f'"{owner_name}"', PLAYER2_FLAGS,
        pet_guid,   f'"{pet_name}"',   PET_FLAGS,
        "13544", '"Mend Pet"', "8",
        str(amount), "0", "0", "0",
    ]


def _pet_spell_damage_parts(pet_guid: str, pet_name: str,
                             dst_guid: str, dst_name: str,
                             amount: int, spell: str = "Claw") -> list[str]:
    """SPELL_DAMAGE from a player-controlled pet (PET_FLAGS as src_flags)."""
    return [
        "SPELL_DAMAGE",
        pet_guid, f'"{pet_name}"', PET_FLAGS,
        dst_guid, f'"{dst_name}"', "0xa48",
        "16827", f'"{spell}"', "1",
        str(amount), "0", "1", "0", "0", "0", "0", "0",
    ]


def test_presummoned_pet_attributed_via_mend_pet():
    """Pet has no SPELL_SUMMON but owner fires Mend Pet during the fight.
    The pre-pass in _aggregate_segment must infer ownership and credit
    pet damage to the Hunter/owner."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Mend Pet tick fires → establishes owner
        ("4/19 13:00:10.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", PET_GUID, "Growl"),
         ts + 10),
        # Pet attacks boss → should be credited to Phyre
        ("4/19 13:01:00.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 100_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "pet damage not attributed to owner"
    assert phyre["totalDamage"] == pytest.approx(100_000, rel=0.01)


def test_presummoned_pet_attributed_when_damage_comes_before_mend_pet():
    """Even if the pet deals damage BEFORE Mend Pet fires, the pre-pass
    over the whole segment must still attribute the damage correctly."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Pet attacks first — before any owner interaction
        ("4/19 13:00:30.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 80_000),
         ts + 30),
        # Mend Pet fires later in the fight
        ("4/19 13:01:00.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", PET_GUID, "Growl"),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "pre-pass did not resolve ordering"
    assert phyre["totalDamage"] == pytest.approx(80_000, rel=0.01)


def test_presummoned_pet_without_interaction_remains_unattributed():
    """A pet with no SPELL_SUMMON and no owner interaction must NOT be
    credited to any player — better to under-count than misattribute."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        ("4/19 13:01:00.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 100_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(0, abs=1)


def test_pet_already_in_pet_owner_not_overwritten_by_interaction():
    """If a pet is already in the pet_owner map (from SPELL_SUMMON), a
    player→pet interaction for a DIFFERENT player must not overwrite it."""
    parser = CombatLogParser()
    ts = 46800.0
    established_owner = {PET_GUID: (PLAYER_GUID, "Phyre")}  # Phyre owns the pet
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Some other player heals the pet (e.g. paladin aura, not Mend Pet)
        ("4/19 13:00:10.000",
         _mend_pet_parts(PLAYER2_GUID, "Notlich", PET_GUID, "Growl"),
         ts + 10),
        ("4/19 13:01:00.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 50_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, established_owner)
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "damage not credited to original owner"
    assert phyre["totalDamage"] == pytest.approx(50_000, rel=0.01)


# ── Full-session damage (parser.session_damage) ───────────────────────────────
#
# parser.session_damage[session_idx] must equal the sum of ALL player/pet damage
# across the entire session (boss pulls + trash), matching what UWU shows.

import io as _io


def _make_full_log(*lines: str) -> str:
    return "".join(lines)


def _pdmg(ts: str, src: str, dst: str, dst_name: str, amount: int,
          overkill: int = 0) -> str:
    """Format a SPELL_DAMAGE log line for parse_file."""
    return (f'{ts}  SPELL_DAMAGE,{src},"Phyre",0x512,'
            f'{dst},"{dst_name}",0xa48,133,"Frostbolt",4,'
            f'{amount},{overkill},4,0,0,0,0,0\n')


def _enc_start(ts: str, boss: str = "Lord Marrowgar",
               bid: int = 1234, diff: int = 6, size: int = 25) -> str:
    return f'{ts}  ENCOUNTER_START,{bid},"{boss}",{diff},{size}\n'


def _enc_end(ts: str, boss: str = "Lord Marrowgar",
             bid: int = 1234, diff: int = 6, size: int = 25,
             success: int = 1) -> str:
    return f'{ts}  ENCOUNTER_END,{bid},"{boss}",{diff},{size},{success}\n'


def _died(ts: str, guid: str, name: str) -> str:
    return (f'{ts}  UNIT_DIED,{PLAYER_GUID},"Phyre",0x512,'
            f'{guid},"{name}",0xa48,0\n')


def test_session_damage_starts_empty():
    """parser.session_damage is an empty dict before parse_file is called."""
    parser = CombatLogParser()
    assert hasattr(parser, "session_damage")
    assert parser.session_damage == {}


def test_session_damage_includes_pre_encounter_trash():
    """Damage that lands before ENCOUNTER_START must appear in session_damage."""
    PG = PLAYER_GUID
    NG = NPC_GUID
    BG = "0xF130000000000002"

    trash_amount = 77_777
    boss_amount  = 55_555

    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG, BG, "Lord Marrowgar", boss_amount)
        for i in range(10)
    )

    log = _make_full_log(
        _pdmg("4/19 13:00:00.000", PG, NG, "Trash Mob", trash_amount),
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = trash_amount + boss_amount * 10
    assert 0 in parser.session_damage, "session 0 must be populated"
    assert parser.session_damage[0] == pytest.approx(expected, rel=0.01)


def test_session_damage_excludes_player_to_player():
    """P2P damage (Blood-Queen vampires etc.) must not appear in session_damage."""
    PG1 = PLAYER_GUID
    PG2 = "0x0600000000000099"  # second player
    BG  = "0xF130000000000002"

    p2p_amount  = 99_999
    boss_amount =  50_000

    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG1, BG, "Lord Marrowgar", boss_amount)
        for i in range(10)
    )

    log = _make_full_log(
        _pdmg("4/19 13:00:00.000", PG1, PG2, "Player2", p2p_amount),
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = boss_amount * 10  # p2p excluded
    assert parser.session_damage.get(0, 0) == pytest.approx(expected, rel=0.01)


def test_session_damage_includes_damage_shield_from_player():
    """DAMAGE_SHIELD (Retribution Aura, thorns) from a player source must be
    included in session_damage to match UWU Custom Slice totals.
    These are excluded from per-boss DPS but UWU counts them in the full slice."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    shield_amount = 12_345   # e.g. Retribution Aura proc
    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG, BG, "Lord Marrowgar", 50_000)
        for i in range(10)
    )

    def dmg_shield(ts: str, src: str, dst: str, dst_name: str, amount: int) -> str:
        return (f'{ts}  DAMAGE_SHIELD,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,20066,"Retribution Aura",2,'
                f'{amount},0,2,0,0,0,0,0\n')

    log = _make_full_log(
        dmg_shield("4/19 13:00:30.000", PG, BG, "Boss", shield_amount),
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = shield_amount + 50_000 * 10
    assert 0 in parser.session_damage, "session 0 must be populated"
    assert parser.session_damage[0] == pytest.approx(expected, rel=0.01)


def test_session_damage_includes_guardian_from_player():
    """TYPE_GUARDIAN units (Mirror Images, Treants, Army-of-the-Dead ghouls) that
    are player-controlled must be counted in session_damage.

    Guardian flags: TYPE_GUARDIAN (0x2000) | CONTROL_PLAYER (0x0100) | FRIENDLY
    (0x0020) | RAID (0x0004) = 0x2124.  Current code checks (flags & 0x1100) ==
    0x1100 which misses 0x2000 guardians — this test asserts the fix is in place.
    """
    PG = PLAYER_GUID
    GUARDIAN_GUID  = "0xF140000000000002"
    GUARDIAN_FLAGS = "0x2124"   # TYPE_GUARDIAN | CONTROL_PLAYER | FRIENDLY | RAID
    BG = "0xF130000000000002"

    guardian_amount = 33_333
    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG, BG, "Lord Marrowgar", 50_000)
        for i in range(10)
    )

    def guardian_dmg(ts: str, src: str, dst: str, dst_name: str, amount: int) -> str:
        return (
            f'{ts}  SPELL_DAMAGE,{src},"Mirror Image",{GUARDIAN_FLAGS},'
            f'{dst},"{dst_name}",0xa48,58833,"Frostbolt",4,'
            f'{amount},0,4,0,0,0,0,0\n'
        )

    log = _make_full_log(
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        guardian_dmg("4/19 13:01:30.000", GUARDIAN_GUID, BG, "Lord Marrowgar",
                     guardian_amount),
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = 50_000 * 10 + guardian_amount   # player hits + guardian hits
    assert 0 in parser.session_damage, "session 0 must be populated"
    assert parser.session_damage[0] == pytest.approx(expected, rel=0.01), (
        "Guardian (TYPE_GUARDIAN | CONTROL_PLAYER) damage missing from session total"
    )


# ── Absorbed damage in session_damage ─────────────────────────────────────────
#
# WarcraftLogs and UWU both count "damage done" as amount + absorbed, not just
# the HP the target actually lost.  When a boss has a shield (Lady Deathwhisper
# mana barrier, Saurfang Blood Barrier), a hit may be partially or fully
# absorbed: the log shows amount=<hp_lost> absorbed=<shield_absorbed>.  Our
# session_damage accumulator must add both to match the reference totals.
#
# SPELL_DAMAGE field layout (18 fields):
#   [10]=amount  [11]=overkill  [15]=absorbed
# SWING_DAMAGE field layout (14 fields):
#   [7]=amount   [8]=overkill   [12]=absorbed


def test_session_damage_includes_absorbed_spell_damage():
    """When a spell hit is partially absorbed by a boss shield, session_damage
    must count amount + absorbed (total damage output, not just HP removed).

    This is the WCL / UWU convention.  Lady Deathwhisper mana barrier (phase 1)
    absorbs ALL physical damage; Saurfang Blood Barrier absorbs large hits.
    Without this fix our totals are ~0.88 – 3.29 % below UWU."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    unabsorbed = 15_000   # HP actually removed
    absorbed   =  5_000   # absorbed by boss shield

    def spell_dmg_absorbed(ts: str, src: str, dst: str, dst_name: str,
                            amount: int, absorb: int) -> str:
        # 18 fields: [10]=amount [11]=overkill=0 [12-14]=meta [15]=absorb [16-17]=0
        return (f'{ts}  SPELL_DAMAGE,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,133,"Frostbolt",4,'
                f'{amount},0,4,0,0,{absorb},0,0\n')

    log = _make_full_log(
        spell_dmg_absorbed("4/19 13:00:30.000", PG, BG, "Lady Deathwhisper",
                            unabsorbed, absorbed),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = unabsorbed + absorbed   # 20_000 total output
    assert parser.session_damage.get(0, 0) == pytest.approx(expected, rel=0.01), (
        "Absorbed spell damage must be counted in session total "
        f"(expected {expected}, absorbed={absorbed}, unabsorbed={unabsorbed})"
    )


def test_session_damage_includes_absorbed_swing_damage():
    """When a melee swing is partially absorbed by a boss shield, session_damage
    must count amount + absorbed.

    SWING_DAMAGE field layout (14 fields): [7]=amount [8]=overkill [12]=absorbed"""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    unabsorbed = 20_000
    absorbed   =  8_000

    def swing_dmg_absorbed(ts: str, src: str, dst: str, dst_name: str,
                            amount: int, absorb: int) -> str:
        # 14 fields: [7]=amount [8]=overkill=0 [9]=school [10-11]=meta
        # [12]=absorb [13]=crit
        return (f'{ts}  SWING_DAMAGE,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,'
                f'{amount},0,1,0,0,{absorb},0\n')

    log = _make_full_log(
        swing_dmg_absorbed("4/19 13:00:30.000", PG, BG, "Lord Marrowgar",
                            unabsorbed, absorbed),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = unabsorbed + absorbed   # 28_000 total output
    assert parser.session_damage.get(0, 0) == pytest.approx(expected, rel=0.01), (
        "Absorbed swing damage must be counted in session total "
        f"(expected {expected}, absorbed={absorbed}, unabsorbed={unabsorbed})"
    )
