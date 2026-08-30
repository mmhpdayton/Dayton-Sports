#!/usr/bin/env python3
"""Refresh completed scores for Dayton family teams from MaxPreps.

This job is intentionally best-effort: MaxPreps updates can lag and transient
fetch/parser failures should not break the site or generate noisy alerts.
"""
from __future__ import annotations

import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "sports-data.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*",
}
SOURCES = {
    "payton": "https://www.maxpreps.com/il/chicago/payton-college-prep-grizzlies/volleyball/jv/schedule/",
    "paytonvarsity": "https://www.maxpreps.com/il/chicago/payton-college-prep-grizzlies/volleyball/schedule/",
    "amundsen": "https://www.maxpreps.com/il/chicago/amundsen-vikings/football/jv/schedule/",
    "amundsenvarsity": "https://www.maxpreps.com/il/chicago/amundsen-vikings/football/schedule/",
}


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
    s = re.sub(r"\b(high school|college prep|prep|hs)\b", " ", s, flags=re.I)
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def date_token(site_date: str) -> str:
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})", site_date.strip())
    if not m:
        return site_date.strip()
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return f"{months[int(m.group(1))-1]} {int(m.group(2))}"


def site_result(outcome: str, a: int, b: int) -> str:
    # MaxPreps displays the winner's score first in its result label. Convert to
    # the tracked team's score first, which is how Dayton Sports renders scores.
    if outcome.upper() == "W":
        return f"W {a}–{b}"
    if outcome.upper() == "L":
        return f"L {b}–{a}"
    return f"T {a}–{b}"


def score_parts(result: str):
    m = re.match(r"([WLT])\s+(\d+)[–-](\d+)", result or "")
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


def parse_results(text: str):
    # Works against the schedule text MaxPreps emits, e.g.
    # 8/26 4:30pm vsWestinghouse L 14-12 Box Score
    pat = re.compile(
        r"(?P<date>\d{1,2}/\d{1,2})\s*(?P<time>\d{1,2}:\d{2}\s*(?:am|pm)|TBA)?\s*"
        r"(?P<where>@|vs)?\s*(?P<opp>[A-Za-z0-9 .&'’()/-]+?)\s*"
        r"(?P<outcome>[WLT])\s+(?P<a>\d+)\s*[-–]\s*(?P<b>\d+)\b",
        re.I,
    )
    out = []
    for m in pat.finditer(text):
        opp = re.sub(r"\*+", "", m.group("opp")).strip()
        # Guard against the regex absorbing labels before the actual opponent.
        opp = re.sub(r"^(?:Home|Away|Neutral|Non-Conference|Conference)\s+", "", opp, flags=re.I)
        result = site_result(m.group("outcome"), int(m.group("a")), int(m.group("b")))
        out.append({"date": date_token(m.group("date")), "opp": opp, "result": result})
    return out


def compatible_opponents(a: str, b: str) -> bool:
    a, b = norm(a), norm(b)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    at = {x for x in a.split() if len(x) >= 4}
    bt = {x for x in b.split() if len(x) >= 4}
    return bool(at & bt)


def merge_team(team: dict, results: list[dict]) -> int:
    changed = 0
    for r in results:
        candidates = [g for g in team.get("schedule", []) if g.get("date") == r["date"]]
        target = next((g for g in candidates if compatible_opponents(g.get("opp", ""), r["opp"])), None)
        if not target:
            continue
        if target.get("status") == "final" and target.get("result") == r["result"]:
            continue
        target["status"] = "final"
        target["result"] = r["result"]
        parts = score_parts(r["result"])
        if parts:
            _, ours, theirs = parts
            target["_score"] = {"our": ours, "opp": theirs, "live": False, "final": True}
        changed += 1
    return changed


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    teams = {t.get("id"): t for t in data.get("teams", [])}
    total = 0
    for team_id, url in SOURCES.items():
        team = teams.get(team_id)
        if not team:
            print(f"family scores {team_id}: team missing; skipped")
            continue
        try:
            text = clean_html(fetch_text(url))
            results = parse_results(text)
            if not results:
                print(f"family scores {team_id}: no parsable finals yet; preserved")
                continue
            changed = merge_team(team, results)
            total += changed
            print(f"family scores {team_id}: parsed {len(results)}, changed {changed}")
        except Exception as exc:
            print(f"family scores {team_id}: source unavailable; preserved ({exc})")
    if total:
        DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Family score refresh complete; {total} game(s) changed")


if __name__ == "__main__":
    main()
