"""Environmental incoming damage uses its own WotLK field layout."""

from io import StringIO

from combat_metrics import extract_damage_fields
from parity.fixtures import BOSS, HEALER, PLAYER, event, spell
from parser_core import CombatLogParser, DMG_EVENTS

ENVIRONMENT = ('0x0000000000000000', 'nil', '0x80000000')


def test_environmental_damage_fields_are_shifted_and_keep_absorbs_separate():
    parts = event(0, 'ENVIRONMENTAL_DAMAGE', ENVIRONMENT, PLAYER,
                  'FIRE,500,50,4,17,23,200,1,nil,nil').split('  ', 1)[1].split(',')
    fields = extract_damage_fields(parts)
    assert fields is not None
    assert (fields.amount, fields.overkill, fields.absorbed) == (500, 50, 200)
    assert fields.school == 4
    assert fields.is_crit is True
    assert fields.spell_name == 'FIRE'
    assert 'ENVIRONMENTAL_DAMAGE' not in DMG_EVENTS


def test_truncated_environmental_damage_does_not_become_spell_damage():
    parts = event(0, 'ENVIRONMENTAL_DAMAGE', ENVIRONMENT, PLAYER,
                  'FALLING,500').split('  ', 1)[1].split(',')
    assert extract_damage_fields(parts) is None


def test_environmental_incoming_damage_and_death_timeline_preserve_outgoing():
    lines = [spell(second, 1000) for second in range(31)]
    lines.extend([
        event(5, 'SPELL_AURA_APPLIED', HEALER, PLAYER, '48066,"Power Word: Shield",0x2,BUFF'),
        event(10, 'ENVIRONMENTAL_DAMAGE', ENVIRONMENT, PLAYER, 'FALLING,500,50,1,0,0,200,nil,nil,nil'),
        event(11, 'UNIT_DIED', ENVIRONMENT, PLAYER),
    ])
    lines.sort(key=lambda line: line.split('  ', 1)[0])
    parser = CombatLogParser(file_year=2026)
    encounters = parser.parse_file(StringIO('\n'.join(lines) + '\n'))
    assert len(encounters) == 1
    encounter = encounters[0]
    assert encounter.total_damage == 31_000
    assert encounter.total_damage_taken == 500
    players = {row['name']: row for row in encounter.participants}
    assert players['Synthetichealer']['totalAbsorbs'] == 200
    damage = players['Syntheticmage']['deathEvents'][0]['recentDamage']
    assert damage[0]['amount'] == 500
    assert damage[0]['spell'] == 'FALLING'
    assert parser.session_analytics[0]['totalDamage'] == 31_000
    assert parser.session_analytics[0]['totalDamageTaken'] == 500
    assert parser.session_analytics[0]['totalAbsorbs'] == 200
    assert parser.session_analytics[0]['totalHealing'] == 0


def test_environmental_player_source_never_counts_as_outgoing_damage():
    parser = CombatLogParser(file_year=2026)
    parser.parse_file(StringIO(event(0, 'ENVIRONMENTAL_DAMAGE', PLAYER, BOSS,
                                   'FIRE,500,0,4,0,0,0,nil,nil,nil') + '\n'))
    assert parser.session_analytics[0]['totalDamage'] == 0
