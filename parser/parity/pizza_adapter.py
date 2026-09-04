"""Adapt actual Pizza parser output without redefining canonical metrics."""

from __future__ import annotations

from io import StringIO

from parser_core import CombatLogParser


def parse_pizza(source: bytes, year: int = 2026) -> dict:
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
    return {'sessions': sessions, 'encounters': [{
        'name': encounter.boss_name,
        'difficulty': encounter.difficulty,
        'outcome': encounter.outcome,
        'durationMs': round(encounter.duration_seconds * 1000),
        'totalDamage': encounter.total_damage,
        'heal': encounter.total_healing + encounter.total_absorbs,
        'damageTaken': encounter.total_damage_taken,
    } for encounter in encounters]}
