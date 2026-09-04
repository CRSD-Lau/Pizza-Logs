"""Original synthetic coverage for Fel Synergy's owner-only direct pet heal."""

from io import StringIO

import pytest

from parser_core import CombatLogParser, _owner_evidence_from_event

OWNER = ('0x06000000000000E1', 'SyntheticWarlock', '0x514')
PET = ('0xF140000121000001', 'SyntheticDemon', '0x1114')
BOSS = ('0xF130008F98000001', 'Lord Marrowgar', '0xa48')


def owner_event(*, kind='SPELL_HEAL', spell_id=54181, source=OWNER, target=PET):
    return [kind, source[0], f'"{source[1]}"', source[2],
            target[0], f'"{target[1]}"', target[2],
            str(spell_id), '"Synthetic Pet Heal"', '0x20', '200', '0', '0', 'nil']


def line(second, parts):
    return f'9/4 12:{second // 60:02}:{second % 60:02}.000  {",".join(parts)}'


def damage(second, source, amount):
    return line(second, [
        'SPELL_DAMAGE', source[0], f'"{source[1]}"', source[2],
        BOSS[0], f'"{BOSS[1]}"', BOSS[2], '686', '"Synthetic Attack"', '0x20',
        str(amount), '0', '32', '0', '0', '0', 'nil', 'nil', 'nil',
    ])


def test_fel_synergy_direct_heal_attributes_earlier_pet_damage_without_summon():
    lines = [
        line(0, ['ENCOUNTER_START', '36612', '"Lord Marrowgar"', '6', '25']),
        *(damage(second, OWNER, 100) for second in range(1, 9)),
        damage(10, PET, 700),
        line(20, owner_event()),
        damage(30, PET, 300),
        line(60, ['UNIT_DIED', '0x0000000000000000', 'nil', '0x80000000',
                  BOSS[0], f'"{BOSS[1]}"', BOSS[2]]),
        line(61, ['ENCOUNTER_END', '36612', '"Lord Marrowgar"', '6', '25', '1']),
    ]
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO('\n'.join(lines) + '\n'))
    assert len(encounters) == 1
    encounter = encounters[0]
    assert encounter.total_damage == 1800
    assert encounter.total_healing == 200
    assert len(encounter.participants) == 1
    actor = encounter.participants[0]
    assert actor['name'] == OWNER[1]
    assert actor['totalDamage'] == 1800
    assert actor['totalHealing'] == 200
    assert actor['spellBreakdown']['Synthetic Attack']['damage'] == 1800
    session = next(iter(parser.session_analytics.values()))
    assert session['totalDamage'] == 1800
    assert session['totalHealing'] == 200


@pytest.mark.parametrize('kind', [
    'SPELL_PERIODIC_HEAL', 'SPELL_AURA_APPLIED', 'SPELL_CAST_SUCCESS', 'SPELL_DAMAGE',
])
def test_fel_synergy_id_on_other_event_types_is_not_owner_evidence(kind):
    assert _owner_evidence_from_event(owner_event(kind=kind)) is None


@pytest.mark.parametrize('spell_id', [34952, 25228, 48071])
def test_unproven_pet_interactions_and_generic_heals_do_not_establish_ownership(spell_id):
    assert _owner_evidence_from_event(owner_event(spell_id=spell_id)) is None


@pytest.mark.parametrize('target', [
    ('0xF130000121000001', 'SyntheticNpc', '0x1114'),
    ('0xF150000121000001', 'SyntheticVehicle', '0x1114'),
    ('0x06000000000000E2', 'SyntheticPlayer', '0x514'),
    (PET[0], PET[1], '0x1014'),  # Pet type without player control.
    (PET[0], PET[1], '0x114'),  # Player control without pet/guardian type.
    (PET[0], PET[1], 'invalid'),
])
def test_fel_synergy_requires_a_controlled_permanent_pet_target(target):
    assert _owner_evidence_from_event(owner_event(target=target)) is None


@pytest.mark.parametrize('source', [PET, BOSS])
def test_fel_synergy_requires_a_player_source(source):
    assert _owner_evidence_from_event(owner_event(source=source)) is None
