"""Conservative analytical enrichment for parsed combat-log participants.

Damage and healing totals remain owned by parser_core's Skada-aligned paths.
This module only classifies observed spell signatures and absorb-capable auras.
"""

from __future__ import annotations

from collections.abc import Iterable


ABSORB_AURA_NAMES: frozenset[str] = frozenset({
    "Anti-Magic Shell",
    "Divine Aegis",
    "Fire Ward",
    "Frost Ward",
    "Ice Barrier",
    "Mana Shield",
    "Power Word: Shield",
    "Protection of Ancient Kings",
    "Sacred Shield",
    "Savage Defense",
    "Shadow Ward",
})


CONSUMABLE_AURA_NAMES: frozenset[str] = frozenset({
    "Flask of Endless Rage",
    "Flask of Pure Mojo",
    "Flask of Stoneblood",
    "Flask of the Frost Wyrm",
    "Guru's Elixir",
    "Potion of Speed",
    "Potion of Wild Magic",
    "Well Fed",
})


def is_consumable_aura(spell_name: str) -> bool:
    return spell_name in CONSUMABLE_AURA_NAMES or spell_name.startswith(("Flask of ", "Elixir of "))


SPEC_SIGNATURES: dict[str, frozenset[str]] = {
    "Blood Death Knight": frozenset({"Heart Strike", "Vampiric Blood", "Dancing Rune Weapon"}),
    "Frost Death Knight": frozenset({"Frost Strike", "Howling Blast", "Unbreakable Armor"}),
    "Unholy Death Knight": frozenset({"Scourge Strike", "Summon Gargoyle", "Bone Shield"}),
    "Balance Druid": frozenset({"Starfall", "Typhoon", "Force of Nature"}),
    "Feral Druid": frozenset({"Mangle", "Savage Roar", "Berserk", "Lacerate"}),
    "Restoration Druid": frozenset({"Wild Growth", "Swiftmend", "Nourish"}),
    "Beast Mastery Hunter": frozenset({"Bestial Wrath", "Intimidation"}),
    "Marksmanship Hunter": frozenset({"Chimera Shot", "Silencing Shot"}),
    "Survival Hunter": frozenset({"Explosive Shot", "Black Arrow"}),
    "Arcane Mage": frozenset({"Arcane Blast", "Arcane Barrage"}),
    "Fire Mage": frozenset({"Living Bomb", "Pyroblast", "Combustion"}),
    "Frost Mage": frozenset({"Deep Freeze", "Ice Lance", "Summon Water Elemental"}),
    "Holy Paladin": frozenset({"Beacon of Light", "Holy Shock", "Holy Light"}),
    "Protection Paladin": frozenset({"Shield of Righteousness", "Hammer of the Righteous", "Avenger's Shield"}),
    "Retribution Paladin": frozenset({"Divine Storm", "Crusader Strike", "Seal of Vengeance"}),
    "Discipline Priest": frozenset({"Penance", "Power Word: Shield", "Divine Aegis"}),
    "Holy Priest": frozenset({"Circle of Healing", "Guardian Spirit", "Lightwell"}),
    "Shadow Priest": frozenset({"Vampiric Touch", "Mind Flay", "Dispersion"}),
    "Assassination Rogue": frozenset({"Mutilate", "Envenom", "Hunger For Blood"}),
    "Combat Rogue": frozenset({"Blade Flurry", "Adrenaline Rush", "Killing Spree"}),
    "Subtlety Rogue": frozenset({"Hemorrhage", "Shadow Dance", "Premeditation"}),
    "Elemental Shaman": frozenset({"Lava Burst", "Thunderstorm", "Elemental Mastery"}),
    "Enhancement Shaman": frozenset({"Stormstrike", "Lava Lash", "Feral Spirit"}),
    "Restoration Shaman": frozenset({"Riptide", "Earth Shield", "Mana Tide Totem"}),
    "Affliction Warlock": frozenset({"Haunt", "Unstable Affliction", "Drain Soul"}),
    "Demonology Warlock": frozenset({"Metamorphosis", "Demonic Empowerment", "Summon Felguard"}),
    "Destruction Warlock": frozenset({"Chaos Bolt", "Conflagrate", "Shadowfury"}),
    "Arms Warrior": frozenset({"Mortal Strike", "Bladestorm", "Taste for Blood"}),
    "Fury Warrior": frozenset({"Bloodthirst", "Heroic Fury", "Death Wish"}),
    "Protection Warrior": frozenset({"Shield Slam", "Devastate", "Shockwave", "Concussion Blow"}),
}


SPEC_ROLES: dict[str, str] = {
    "Restoration Druid": "HEALER",
    "Holy Paladin": "HEALER",
    "Discipline Priest": "HEALER",
    "Holy Priest": "HEALER",
    "Restoration Shaman": "HEALER",
    "Protection Paladin": "TANK",
    "Protection Warrior": "TANK",
}


def infer_spec(
    wow_class: str | None,
    observed_spells: Iterable[str],
) -> str | None:
    spells = set(observed_spells)
    candidates: list[tuple[int, str]] = []
    for spec, signatures in SPEC_SIGNATURES.items():
        if wow_class and not spec.endswith(wow_class):
            continue
        score = len(spells & signatures)
        if score:
            candidates.append((score, spec))

    if not candidates:
        return None
    candidates.sort(reverse=True)
    if len(candidates) > 1 and candidates[0][0] == candidates[1][0]:
        return None
    return candidates[0][1]


def infer_role(
    spec: str | None,
    observed_spells: Iterable[str],
    total_damage: float,
    total_healing: float,
    damage_taken: float,
) -> str:
    output = total_damage + total_healing
    healing_share = total_healing / max(1.0, output)
    spec_role = SPEC_ROLES.get(spec or "")

    if healing_share >= 0.5 or (spec_role == "HEALER" and total_healing > 0):
        return "HEALER"
    if spec_role == "TANK" and damage_taken > 0:
        return "TANK"
    if spec == "Blood Death Knight" and damage_taken > max(1.0, total_damage * 0.15):
        return "TANK"
    if spec == "Feral Druid" and "Lacerate" in set(observed_spells) and damage_taken > 0:
        return "TANK"
    if total_damage > total_healing * 1.5:
        return "DPS"
    return "UNKNOWN"
