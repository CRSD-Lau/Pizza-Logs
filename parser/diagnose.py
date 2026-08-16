"""
diagnose.py — forensic comparison tool for PizzaLogs vs UWU.

Usage:
    python diagnose.py WoWCombatLog.txt [--uwu-csv uwu_export.csv]

Produces:
  1. Per-encounter totals (boss, outcome, duration, total damage)
  2. Per-player totals per encounter (name, damage, dps, overkill_excluded)
  3. Orphan pets — non-player GUIDs with damage that have no owner mapping
  4. Event type counts
  5. Encounter segment boundaries
  6. (Optional) delta table vs UWU exported CSV

Run locally against the raw WoWCombatLog.txt before uploading to Railway.
"""

from __future__ import annotations

import sys
import csv
import json
import argparse
from collections import defaultdict
from pathlib import Path

# Allow importing from same directory
sys.path.insert(0, str(Path(__file__).parent))

from parser_core import (
    CombatLogParser, _is_player, DMG_EVENTS,
)
from combat_metrics import encounter_damage_amount, extract_damage_fields


# ── Diagnostic parser subclass ────────────────────────────────────────────────

class DiagnosticParser(CombatLogParser):
    """Extended parser that exposes diagnostic data."""

    def parse_file_diagnostic(self, fh, total_lines=0):
        lines_gen = self._iter_lines(fh, total_lines)

        # ── Pass 1: collect everything ────────────────────────────
        all_lines: list[tuple[str, list[str], float]] = list(lines_gen)

        # Event type counts
        self.event_counts: dict[str, int] = defaultdict(int)
        for _, parts, _ in all_lines:
            self.event_counts[parts[0]] += 1

        # ── Pass 2: build pet_owner map (SPELL_SUMMON) ────────────
        pet_owner: dict[str, tuple[str, str]] = {}
        filtered: list[tuple[str, list[str], float]] = []
        for ts_str, parts, ts in all_lines:
            ev = parts[0]
            if ev == "SPELL_SUMMON" and len(parts) >= 5:
                og, on_, pg = parts[1], parts[2].strip('"').strip(), parts[4]
                if _is_player(og) and pg:
                    pet_owner[pg] = (og, on_)
                continue
            filtered.append((ts_str, parts, ts))

        self._pet_owner = pet_owner

        # ── Pass 3: find orphan non-player GUIDs with damage ─────
        orphan_damage: dict[str, dict] = {}   # guid → {name, damage, spells}
        for _, parts, _ in filtered:
            ev = parts[0]
            if ev not in DMG_EVENTS:
                continue
            if len(parts) < 8:
                continue
            sg, sn = parts[1], parts[2].strip('"').strip()
            if _is_player(sg) or sg in pet_owner:
                continue
            if sg in ("0x0000000000000000", "0XNIL", "NIL", ""):
                continue
            fields = extract_damage_fields(parts)
            if not fields:
                continue
            damage = encounter_damage_amount(fields)
            if damage <= 0:
                continue
            spn = "Auto Attack" if ev == "SWING_DAMAGE" else (parts[8].strip('"') if len(parts) > 8 else "?")
            if sg not in orphan_damage:
                orphan_damage[sg] = {"name": sn, "damage": 0.0, "spells": defaultdict(float)}
            orphan_damage[sg]["damage"] += damage
            orphan_damage[sg]["spells"][spn] += damage

        self._orphan_damage = orphan_damage

        # ── Pass 4: segment + aggregate (using real parser) ──────
        # Re-open by seeking back if fh supports it
        fh.seek(0)
        segments, pet_owner2 = self._segment_encounters(self._iter_lines(fh, total_lines))
        fh.seek(0)
        encounters = []
        for seg in segments:
            enc = self._aggregate_segment(seg, pet_owner2)
            if enc:
                encounters.append(enc)
        self._assign_session_indices(encounters)
        return encounters


# ── Formatting helpers ────────────────────────────────────────────────────────

def fmt_dmg(v: float) -> str:
    if v >= 1_000_000:
        return f"{v/1_000_000:.2f}M"
    if v >= 1_000:
        return f"{v/1_000:.1f}K"
    return str(int(v))

def pct(part, total):
    if not total:
        return "0.0%"
    return f"{100*part/total:.1f}%"


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="PizzaLogs diagnostic parser")
    ap.add_argument("logfile", help="Path to WoWCombatLog.txt")
    ap.add_argument("--uwu-csv", help="Optional UWU export CSV for delta comparison")
    ap.add_argument("--encounter", help="Filter to one boss name (partial match)")
    ap.add_argument("--json", action="store_true", help="Emit JSON output instead of tables")
    args = ap.parse_args()

    path = Path(args.logfile)
    if not path.exists():
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    print(f"\n{'='*70}")
    print("  PizzaLogs Diagnostic Parser")
    print(f"  File : {path.name}  ({path.stat().st_size / 1_048_576:.1f} MB)")
    print(f"{'='*70}\n")

    parser = DiagnosticParser()
    with open(path, encoding="utf-8", errors="replace") as fh:
        encounters = parser.parse_file_diagnostic(fh)

    # ── Event type counts ────────────────────────────────────────
    print("EVENT TYPE COUNTS")
    print("-"*50)
    for ev, cnt in sorted(parser.event_counts.items(), key=lambda x: -x[1]):
        print(f"  {ev:<40} {cnt:>10,}")
    print()

    # ── SPELL_SUMMON / pet_owner map ────────────────────────────
    print(f"PET OWNER MAP  ({len(parser._pet_owner)} entries)")
    print("-"*50)
    for pg, (og, on_) in list(parser._pet_owner.items())[:30]:
        print(f"  {pg[:30]:<32}  ->  {on_}")
    if len(parser._pet_owner) > 30:
        print(f"  ... and {len(parser._pet_owner)-30} more")
    print()

    # ── Orphan non-player GUIDs ──────────────────────────────────
    total_orphan = sum(d["damage"] for d in parser._orphan_damage.values())
    print(f"ORPHAN (UNATTRIBUTED) PET / NPC DAMAGE  (total: {fmt_dmg(total_orphan)})")
    print("-"*70)
    sorted_orphans = sorted(parser._orphan_damage.items(), key=lambda x: -x[1]["damage"])
    for guid, info in sorted_orphans[:20]:
        top_spell = max(info["spells"], key=info["spells"].get) if info["spells"] else "?"
        print(f"  {info['name']:<25}  {fmt_dmg(info['damage']):>10}  ({guid[:28]})  top: {top_spell}")
    if len(sorted_orphans) > 20:
        print(f"  ... and {len(sorted_orphans)-20} more orphan GUIDs")
    print()

    # ── Encounter summary ────────────────────────────────────────
    filter_boss = args.encounter.lower() if args.encounter else None
    shown = [e for e in encounters if not filter_boss or filter_boss in e.boss_name.lower()]

    print(f"ENCOUNTERS  ({len(shown)} of {len(encounters)} shown)")
    print("-"*90)
    for enc in shown:
        total_d = enc.total_damage
        m, s = divmod(enc.duration_seconds, 60)
        print(f"\n  [{enc.session_index}] {enc.boss_name} {enc.difficulty}  {enc.outcome}  "
              f"{m}:{s:02d}  {fmt_dmg(total_d)} dmg  "
              f"({enc.started_at[11:19]} → {enc.ended_at[11:19]})")

        parts_sorted = sorted(enc.participants, key=lambda p: -p["totalDamage"])
        rank = 0
        for p in parts_sorted:
            if p["totalDamage"] <= 0:
                continue
            rank += 1
            print(f"    {rank:>2}. {p['name']:<22}  "
                  f"{fmt_dmg(p['totalDamage']):>9}  "
                  f"{p['dps']:>8.0f} dps  "
                  f"{pct(p['totalDamage'], total_d):>6}")
            if rank >= 25:
                break

    print()

    # ── Session roll-up ──────────────────────────────────────────
    by_session: dict[int, dict] = defaultdict(lambda: {"damage": 0.0, "healing": 0.0, "bosses": []})
    for enc in encounters:
        si = enc.session_index
        by_session[si]["damage"]  += enc.total_damage
        by_session[si]["healing"] += enc.total_healing
        by_session[si]["bosses"].append(f"{enc.boss_name} ({enc.outcome[:1]})")

    print("SESSION ROLL-UP")
    print("-"*70)
    for si, data in sorted(by_session.items()):
        print(f"  Session {si+1}: {fmt_dmg(data['damage'])} dmg  {fmt_dmg(data['healing'])} heal")
        for b in data["bosses"]:
            print(f"    • {b}")
    print()

    # ── Per-player session totals ────────────────────────────────
    player_totals: dict[str, float] = defaultdict(float)
    for enc in encounters:
        for p in enc.participants:
            player_totals[p["name"]] += p["totalDamage"]

    print("PER-PLAYER TOTAL DAMAGE (all encounters)")
    print("-"*60)
    for rank, (name, dmg) in enumerate(
        sorted(player_totals.items(), key=lambda x: -x[1])[:30], 1
    ):
        print(f"  {rank:>2}. {name:<22}  {fmt_dmg(dmg):>10}")
    print()

    # ── UWU delta comparison ─────────────────────────────────────
    if args.uwu_csv:
        uwu_path = Path(args.uwu_csv)
        if not uwu_path.exists():
            print(f"WARNING: UWU CSV not found: {uwu_path}", file=sys.stderr)
        else:
            print("UWU DELTA COMPARISON")
            print("-"*70)
            uwu: dict[str, float] = {}
            with open(uwu_path, encoding="utf-8") as cf:
                reader = csv.DictReader(cf)
                for row in reader:
                    name = row.get("Name") or row.get("name") or row.get("Player") or ""
                    dmg  = float(row.get("Total Damage") or row.get("damage") or 0)
                    if name:
                        uwu[name] = dmg

            all_names = set(player_totals.keys()) | set(uwu.keys())
            deltas = []
            for name in all_names:
                ours = player_totals.get(name, 0.0)
                theirs = uwu.get(name, 0.0)
                delta = ours - theirs
                deltas.append((name, ours, theirs, delta))

            deltas.sort(key=lambda x: abs(x[3]), reverse=True)
            print(f"  {'Player':<22}  {'Ours':>12}  {'UWU':>12}  {'Delta':>12}  {'%':>6}")
            print(f"  {'-'*22}  {'-'*12}  {'-'*12}  {'-'*12}  {'-'*6}")
            for name, ours, theirs, delta in deltas[:30]:
                sign = "+" if delta >= 0 else ""
                pct_str = f"{100*delta/theirs:.1f}%" if theirs else "N/A"
                print(f"  {name:<22}  {fmt_dmg(ours):>12}  {fmt_dmg(theirs):>12}  "
                      f"{sign}{fmt_dmg(delta):>11}  {pct_str:>6}")
            print()

    # ── JSON output ──────────────────────────────────────────────
    if args.json:
        out = {
            "event_counts": dict(parser.event_counts),
            "pet_owner_count": len(parser._pet_owner),
            "orphan_total_damage": total_orphan,
            "orphans": [
                {"guid": g, "name": d["name"], "damage": d["damage"]}
                for g, d in sorted_orphans[:50]
            ],
            "encounters": [
                {
                    "boss": e.boss_name,
                    "difficulty": e.difficulty,
                    "outcome": e.outcome,
                    "duration": e.duration_seconds,
                    "total_damage": e.total_damage,
                    "players": sorted(
                        [{"name": p["name"], "damage": p["totalDamage"], "dps": p["dps"]}
                         for p in e.participants],
                        key=lambda x: -x["damage"],
                    ),
                }
                for e in encounters
            ],
        }
        print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
