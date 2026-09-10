#!/usr/bin/env python3
"""Refresh Dayton family schedules/scores from MaxPreps.

Payton JV's full schedule is refreshed from MaxPreps so newly assigned tournament
opponents and times replace stale TBA placeholders. Other family schedules remain
static for now and still receive completed-score updates only.

The job is intentionally best-effort: MaxPreps updates can lag and transient
fetch/parser failures should not break the site or overwrite known-good data.
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
FULL_SCHEDULE_TEAMS = {"payton"}


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


def time_token(site_time: str) -> str:
    site_time = re.sub(r"\s+", "", site_time.strip())
    if site_time.upper() == "TBA":
        return "TBA"
    m = re.fullmatch(r"(\d{1,2}):(\d{2})(am|pm)", site_time, re.I)
    if not m:
        return site_time
    return f"{int(m.group(1))}:{m.group(2)} {m.group(3).upper()}"


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


def parse_schedule(text: str):
    """Parse the dated schedule rows emitted by MaxPreps' flattened page text."""
    row_pat = re.compile(
        r"(?P<date>\d{1,2}/\d{1,2})\s*"
        r"(?P<time>\d{1,2}:\d{2}\s*(?:am|pm)|TBA)\s*"
        r"(?P<where>@|vs)\s*"
        r"(?P<body>.*?)"
        r"(?=(?:\d{1,2}/\d{1,2})\s*(?:\d{1,2}:\d{2}\s*(?:am|pm)|TBA)\s*(?:@|vs)|Schedule last updated)",
        re.I,
    )
    out = []
    for m in row_pat.finditer(text):
        body = m.group("body").strip()
        result_match = re.search(r"\b([WLT])\s+(\d+)\s*[-–]\s*(\d+)\b", body, re.I)
        opponent_part = body[:result_match.start()] if result_match else body
        opponent_part = re.sub(
            r"\b(?:Buy Tickets|Watch|Preview Match|View Matchup|Box Score|Game Details)\b.*$",
            "",
            opponent_part,
            flags=re.I,
        ).strip()
        tournament = "***" in opponent_part
        conference = "*" in opponent_part and not tournament
        opp = re.sub(r"\*+", "", opponent_part).strip()
        opp = re.sub(r"^(?:Home|Away|Neutral|Non-Conference|Conference)\s+", "", opp, flags=re.I)
        if not opp or len(opp) > 100:
            continue
        game = {
            "date": date_token(m.group("date")),
            "time": time_token(m.group("time")),
            "opp": opp,
            "ha": "AWAY" if m.group("where") == "@" else ("NEUTRAL" if tournament else "HOME"),
            "conference": conference,
        }
        if tournament:
            game["tournament"] = True
        if result_match:
            result = site_result(
                result_match.group(1), int(result_match.group(2)), int(result_match.group(3))
            )
            game["status"] = "final"
            game["result"] = result
            parts = score_parts(result)
            if parts:
                _, ours, theirs = parts
                game["_score"] = {"our": ours, "opp": theirs, "live": False, "final": True}
        out.append(game)
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
            print(f"family refresh {team_id}: team missing; skipped")
            continue
        try:
            text = clean_html(fetch_text(url))

            if team_id in FULL_SCHEDULE_TEAMS:
                schedule = parse_schedule(text)
                # Reject an unexpectedly short scrape rather than destroying a
                # known-good schedule if MaxPreps changes markup or serves an error page.
                if len(schedule) >= 8:
                    if schedule != team.get("schedule", []):
                        team["schedule"] = schedule
                        total += 1
                        print(f"family schedule {team_id}: refreshed {len(schedule)} games")
                    else:
                        print(f"family schedule {team_id}: unchanged ({len(schedule)} games)")
                else:
                    print(f"family schedule {team_id}: rejected unexpected count {len(schedule)}; preserved")

            results = parse_results(text)
            if not results:
                print(f"family scores {team_id}: no parsable finals yet; preserved")
                continue
            changed = merge_team(team, results)
            total += changed
            print(f"family scores {team_id}: parsed {len(results)}, changed {changed}")
        except Exception as exc:
            print(f"family refresh {team_id}: source unavailable; preserved ({exc})")
    if total:
        DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Family refresh complete; {total} change(s)")


if __name__ == "__main__":
    main()
