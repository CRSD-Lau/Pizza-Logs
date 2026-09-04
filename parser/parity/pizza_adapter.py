"""Adapt actual Pizza parser output without redefining canonical metrics."""

from __future__ import annotations

from io import StringIO

from parser_core import CombatLogParser


def parse_pizza(source: bytes, year: int = 2026, *, damage_breakdown: bool = False) -> dict:
    parser = CombatLogParser(file_year=year)
    encounters = parser.parse_file(StringIO(source.decode('utf-8')))
    sessions = []
    for session in parser.session_analytics.values():
        sessions.append({
            'durationMs': session['durationMs'],
            'totalDamage': session['totalDamage'],
            'heal': session['heal'],
            'damageTaken': session['totalDamageTaken'],
            'players': {row['name']: {
                'totalDamage': row['totalDamage'],
                'heal': row['heal'], 'damageTaken': row['damageTaken'],
            } for row in session['players'].values()},
        })
    result = {'sessions': sessions, 'encounters': [{
        'name': encounter.boss_name,
        'difficulty': encounter.difficulty,
        'outcome': encounter.outcome,
        'durationMs': round(encounter.duration_seconds * 1000),
        'totalDamage': encounter.total_damage,
        'heal': encounter.total_healing + encounter.total_absorbs,
        'damageTaken': encounter.total_damage_taken,
    } for encounter in encounters]}
    if damage_breakdown:
        for normalized, encounter in zip(result['encounters'], encounters, strict=True):
            normalized['damageBreakdown'] = {
                actor['name']: {
                    'spells': {name: row['damage'] for name, row in actor['spellBreakdown'].items()
                               if row['damage'] > 0},
                    'targets': {name: row['damage'] for name, row in actor['targetBreakdown'].items()
                                if row['damage'] > 0},
                }
                for actor in encounter.participants if actor['totalDamage'] > 0
            }
    return result
