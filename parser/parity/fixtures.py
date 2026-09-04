"""Original synthetic inputs. No real character or raid data is used here."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAYER = ('0x06000000000000A1', 'Syntheticmage', '0x514')
HEALER = ('0x06000000000000A2', 'Synthetichealer', '0x514')
PET = ('0xF140000001000001', 'Syntheticpet', '0x1114')
BOSS = ('0xF130008F04000001', 'Lord Marrowgar', '0xa48')


def event(second: int, flag: str, source=PLAYER, target=BOSS, extra: str = '') -> str:
    timestamp = f'9/4 12:{second // 60:02}:{second % 60:02}.000'
    return (
        f'{timestamp}  {flag},{source[0]},"{source[1]}",{source[2]},'
        f'{target[0]},"{target[1]}",{target[2]}' + (f',{extra}' if extra else '')
    )


def spell(second: int, amount: int, *, source=PLAYER, target=BOSS,
          flag: str = 'SPELL_DAMAGE', overkill: int = 0) -> str:
    return event(second, flag, source, target,
                 f'42842,"Frostbolt",0x10,{amount},{overkill},16,0,0,0,nil,nil,nil')


def synthetic_cases() -> dict[str, list[str]]:
    return {
        'marrowgar-dense-wipe': [spell(second, 1000 + second) for second in range(121)],
        'marrowgar-dense-kill': [spell(second, 1000 + second) for second in range(121)]
        + [event(121, 'UNIT_DIED', BOSS, BOSS)],
        'marrowgar-dense-10n': [
            event(second, 'SPELL_DAMAGE', BOSS, PLAYER,
                  f'69146,"Coldflame",0x10,{1000 + second},0,16,0,0,0,nil,nil,nil')
            if second == 1 else spell(second, 1000 + second)
            for second in range(121)
        ] + [event(121, 'UNIT_DIED', BOSS, BOSS)],
        'direct-damage': [spell(0, 1001), spell(15, 2003), spell(30, 3007)],
        'healing-overheal': [
            spell(0, 1000),
            event(5, 'SWING_DAMAGE', BOSS, PLAYER, '777,0,1,0,0,0,nil,nil,nil'),
            event(10, 'SPELL_HEAL', HEALER, PLAYER,
                  '48071,"Flash Heal",0x2,1000,250,0,nil'),
            spell(30, 1000),
        ],
        'healing-recipients': [
            spell(0, 1000),
            event(10, 'SPELL_HEAL', HEALER, PLAYER,
                  '48071,"Flash Heal",0x2,1000,200,0,nil'),
            event(20, 'SPELL_PERIODIC_HEAL', HEALER, HEALER,
                  '48068,"Renew",0x2,500,100,0,nil'),
            spell(30, 1000),
        ],
        'missed-environmental': [
            spell(0, 1000),
            event(10, 'SPELL_MISSED', PLAYER, BOSS,
                  '42842,"Frostbolt",0x10,MISS'),
            event(20, 'ENVIRONMENTAL_DAMAGE', ('0x0000000000000000', 'nil', '0x80000000'),
                  PLAYER, 'FALLING,500,0,1,0,0,0,nil,nil,nil'),
            spell(30, 1000),
        ],
        'utf8-names': [spell(second, 1000, source=(PLAYER[0], 'Synthetiqué', PLAYER[2]))
                       for second in (0, 15, 30)],
        'friendly-fire': [spell(0, 1000), spell(10, 500, target=HEALER), spell(30, 1000)],
        'overkill': [spell(0, 1000), spell(30, 1000, overkill=300)],
        'back-to-back-pulls': [spell(second, 1000) for second in range(121)]
        + [event(121, 'UNIT_DIED', BOSS, BOSS)]
        + [spell(second, 1000) for second in range(150, 271)]
        + [event(271, 'UNIT_DIED', BOSS, BOSS)],
        'multiple-sessions': [spell(second, 1000) for second in range(121)]
        + [spell(second, 1000).replace('9/4 ', '9/5 ') for second in range(121)],
        'pet-summon': [
            event(0, 'SPELL_SUMMON', PLAYER, PET, '688,"Summon Imp",0x20'),
            spell(1, 2000), spell(15, 3000, source=PET), spell(30, 1000),
        ],
        'absorbed-damage': [
            event(0, 'SPELL_AURA_APPLIED', HEALER, PLAYER,
                  '48066,"Power Word: Shield",0x2,BUFF'),
            spell(1, 1000),
            event(10, 'SWING_DAMAGE', BOSS, PLAYER, '300,0,1,0,0,200,nil,nil,nil'),
            event(20, 'SPELL_AURA_REMOVED', HEALER, PLAYER,
                  '48066,"Power Word: Shield",0x2,BUFF'),
            spell(30, 1000),
        ],
        'damage-event-coverage': [
            spell(0, 101), spell(5, 103, flag='RANGE_DAMAGE'),
            spell(10, 107, flag='SPELL_PERIODIC_DAMAGE'),
            spell(15, 109, flag='DAMAGE_SHIELD'),
            spell(20, 113, flag='DAMAGE_SPLIT'),
            spell(25, 127, flag='SPELL_BUILDING_DAMAGE'),
            event(30, 'SWING_DAMAGE', PLAYER, BOSS, '131,0,1,0,0,0,nil,nil,nil'),
        ],
        'boss-death-tail': [
            spell(0, 1000), spell(15, 1000), spell(30, 1000, overkill=100),
            event(31, 'UNIT_DIED', BOSS, BOSS),
            event(35, 'SPELL_HEAL', HEALER, PLAYER,
                  '48071,"Flash Heal",0x2,1000,0,0,nil'),
        ],
        'year-rollover': [
            spell(0, 1000).replace('9/4 12:00:00', '12/31 23:59:50'),
            spell(10, 1000).replace('9/4 12:00:10', '1/1 00:00:00'),
            spell(30, 1000).replace('9/4 12:00:30', '1/1 00:00:20'),
        ],
    }


def fixture_bytes(case_id: str) -> bytes:
    cases = synthetic_cases()
    if case_id in cases:
        return ('\n'.join(cases[case_id]) + '\n').encode('utf-8')
    if case_id in {'icc-25n-synthetic', 'icc-25h-synthetic', 'gunship-kill-synthetic'}:
        return (ROOT / 'tests' / 'fixtures' / case_id / 'combatlog.txt').read_bytes()
    raise ValueError(f'Unknown synthetic case: {case_id}')


def case_ids() -> list[str]:
    return list(synthetic_cases()) + [
        'icc-25n-synthetic', 'icc-25h-synthetic', 'gunship-kill-synthetic',
    ]
