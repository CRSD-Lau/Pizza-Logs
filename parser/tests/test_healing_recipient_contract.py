"""Original synthetic coverage for source-qualified healing to NPC/pet targets."""

from io import StringIO

import pytest

from parser_core import CombatLogParser

HEALER = ('0x06000000000000D1', 'SyntheticHealer', '0x514')
RECIPIENT = ('0x06000000000000D2', 'SyntheticRecipient', '0x514')
VALITHRIA = ('0xF130008FB5000001', 'Valithria Dreamwalker', '0xa14')
FRIENDLY_NPC = ('0xF130000111000001', 'SyntheticAlly', '0xa14')
PET = ('0xF140000112000001', 'SyntheticCompanion', '0x1114')
HOSTILE = ('0xF130000113000001', 'SyntheticHostile', '0xa48')


def event(second, kind, source, target, extra):
    return (
        f'9/4 12:{second // 60:02}:{second % 60:02}.000  {kind},'
        f'{source[0]},"{source[1]}",{source[2]},'
        f'{target[0]},"{target[1]}",{target[2]},{extra}'
    )


def heal(second, source, target, gross, overheal=0, *, periodic=False, absorbed=0):
    return event(second, 'SPELL_PERIODIC_HEAL' if periodic else 'SPELL_HEAL', source, target,
                 f'48071,"Flash Heal",0x2,{gross},{overheal},{absorbed},nil')


def parse(events):
    lines = ['9/4 12:00:00.000  ENCOUNTER_START,36789,"Valithria Dreamwalker",6,25',
             *events,
             # A zero-effective boss-target event bounds the synthetic window
             # without adding healing or introducing unrelated damage behavior.
             heal(60, HEALER, VALITHRIA, 0),
             '9/4 12:01:01.000  ENCOUNTER_END,36789,"Valithria Dreamwalker",6,25,1']
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO('\n'.join(lines) + '\n'))
    assert len(encounters) == 1
    return parser, encounters[0]


@pytest.mark.parametrize('target', [VALITHRIA, FRIENDLY_NPC, PET],
                         ids=['valithria', 'friendly-npc', 'pet'])
def test_player_healing_counts_for_every_recipient_type(target):
    parser, encounter = parse([heal(5, HEALER, target, 1000, 250),
                               heal(10, HEALER, target, 500, 100, periodic=True)])
    assert encounter.total_healing == 1150
    actor = next(actor for actor in encounter.participants if actor['name'] == HEALER[1])
    assert actor['totalHealing'] == 1150
    assert actor['spellBreakdown']['Flash Heal']['healing'] == 1150
    assert actor['hps'] == round(1150 / encounter.duration_seconds, 2)
    assert {actor['name'] for actor in encounter.participants} == {HEALER[1]}
    assert next(iter(parser.session_analytics.values()))['totalHealing'] == 1150


def test_owned_pet_healing_keeps_source_eligibility_overheal_and_absorbs_separate():
    parser, encounter = parse([
        event(1, 'SPELL_SUMMON', HEALER, PET, '5394,"Healing Stream Totem",0x8'),
        heal(2, HEALER, VALITHRIA, 1000, 200, absorbed=33),
        heal(3, PET, FRIENDLY_NPC, 600, 100, periodic=True, absorbed=50),
        heal(4, HEALER, PET, 50, 100),
        heal(5, HEALER, RECIPIENT, 200, absorbed=88),
        # An unowned hostile source does not become a raid healer simply because
        # its destination is the friendly encounter NPC.
        heal(6, HOSTILE, VALITHRIA, 999999),
        # Preserve the existing separate encounter-level NPC mechanic credit;
        # this source is never attributed to a player participant.
        heal(7, HOSTILE, RECIPIENT, 30, 10),
        event(8, 'SPELL_AURA_APPLIED', HEALER, RECIPIENT,
              '48066,"Power Word: Shield",0x2,BUFF'),
        event(9, 'SWING_DAMAGE', HOSTILE, RECIPIENT, '20,0,1,0,0,90,nil,nil,nil'),
        heal(20, HEALER, VALITHRIA, 3000, 200),
    ])
    actor = next(actor for actor in encounter.participants if actor['name'] == HEALER[1])
    assert actor['totalHealing'] == 4300
    assert actor['spellBreakdown']['Flash Heal']['healing'] == 4300
    assert actor['totalAbsorbs'] == 90
    assert encounter.total_healing == 4320  # Includes the unchanged 20-point NPC mechanic.
    assert encounter.total_absorbs == 90
    assert encounter.unattributed_absorbs == 0
    assert not {PET[1], HOSTILE[1], FRIENDLY_NPC[1], VALITHRIA[1]} & {
        participant['name'] for participant in encounter.participants
    }
    assert next(iter(parser.session_analytics.values()))['totalHealing'] == 4300
