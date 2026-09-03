#!/usr/bin/env python3
"""Merge completed Wisconsin volleyball results from UWBadgers.com into Dayton Sports.

The official cumulative-statistics page exposes completed-event accessibility text
consistently. We treat it as authoritative for finals and verify every official final
that corresponds to a game already present on the Dayton Sports schedule.
"""
from __future__ import annotations

import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "sports-data.json"
SOURCES = [
    "https://uwbadgers.com/sports/womens-volleyball/stats/2026",
    "https://uwbadgers.com/sports/womens-volleyball/schedule",
]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*",
}
MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def clean_html(raw: str) -> str:
    raw = re.sub(r"<script\b[^>]*>.*?</script>", " ", raw, flags=re.I | re.S)
    raw = re.sub(r"<style\b[^>]*>.*?</style>", " ", raw, flags=re.I | re.S)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(raw)).strip()


def norm(s: str) -> str:
    s = re.sub(r"#\d+", " ", s or "")
    s = re.sub(r"\b(cardinal|cardinals|wildcats|panthers|aggies|longhorns|golden eagles|cougars|gators|tigers)\b", " ", s, flags=re.I)
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def parse_finals(text: str):
    month_re = "|".join(MONTHS)
    # Official pages use both "versus" and "at" depending on venue.
    pat = re.compile(
        rf"Completed Event:\s*Volleyball\s+(?:versus|at)\s+(.+?)\s+on\s+({month_re})\s+(\d{{1,2}}),\s+2026\s*,\s*(Win|Loss)\s*,\s*(\d+)\s*,\s*to,\s*(\d+)",
        re.I,
    )
    finals = {}
    for opp, month, day, outcome, our, their in pat.findall(text):
        item = {
            "date": f"{month[:3]} {int(day)}",
            "opp": opp.strip(),
            "result": f"{'W' if outcome.lower() == 'win' else 'L'} {our}–{their}",
            "our": our,
            "opp_score": their,
        }
        finals[(item["date"], norm(item["opp"]))] = item
    return list(finals.values())


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    team = next((t for t in data.get("teams", []) if t.get("id") == "wisc"), None)
    if not team:
        raise SystemExit("Wisconsin team not found")

    finals = []
    errors = []
    for source in SOURCES:
        try:
            parsed = parse_finals(clean_html(fetch_text(source)))
            if parsed:
                finals = parsed
                print(f"Parsed {len(finals)} official Wisconsin finals from {source}")
                break
        except Exception as exc:
            errors.append(f"{source}: {exc}")
    if not finals:
        raise SystemExit("No completed Wisconsin volleyball results parsed: " + "; ".join(errors))

    matched = 0
    changed = 0
    unmatched = []
    for final in finals:
        target = None
        for g in team.get("schedule", []):
            if g.get("date") != final["date"]:
                continue
            a, b = norm(g.get("opp", "")), norm(final["opp"])
            if a == b or (a and a in b) or (b and b in a):
                target = g
                break
        if not target:
            unmatched.append(f"{final['date']} {final['opp']} {final['result']}")
            continue
        matched += 1
        expected_score = {"our": final["our"], "opp": final["opp_score"], "live": False, "final": True}
        if target.get("status") != "final" or target.get("result") != final["result"] or target.get("_score") != expected_score:
            target["status"] = "final"
            target["result"] = final["result"]
            target["_score"] = expected_score
            changed += 1

    if not matched:
        raise SystemExit("Official Wisconsin finals parsed, but none matched Dayton Sports schedule")

    # Do not silently declare success if a recent official final exists on a date that
    # Dayton Sports also has but failed opponent matching.
    schedule_dates = {g.get("date") for g in team.get("schedule", [])}
    relevant_unmatched = [x for x in unmatched if any(x.startswith(d + " ") for d in schedule_dates if d)]
    if relevant_unmatched:
        raise SystemExit("Official Wisconsin finals failed schedule matching: " + " | ".join(relevant_unmatched))

    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Verified {matched} Wisconsin finals; changed {changed}")


if __name__ == "__main__":
    main()
