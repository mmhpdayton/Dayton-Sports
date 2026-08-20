#!/usr/bin/env python3
"""Dayton Sports data updater.

Keeps family-entered schedules intact while refreshing public-team schedules.
"""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "sports-data.json"
CT = ZoneInfo("America/Chicago")
HEADERS = {"User-Agent": "Dayton-Sports/1.0"}

SCHEDULES = {
    "nd": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/87/schedule?season=2026",
    "wisc": "https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/teams/275/schedule?season=2026",
    "lfc": "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule?season=2026",
    "gb": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/gb/schedule?season=2026",
    "buf": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/buf/schedule?season=2026",
    "ind": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/ind/schedule?season=2026",
    "cubs": "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/chc/schedule?season=2026&seasontype=2"
}

ALIASES = {
    "nd": ["notre dame", "fighting irish"], "wisc": ["wisconsin", "badgers"],
    "lfc": ["liverpool"], "gb": ["green bay", "packers"],
    "buf": ["buffalo", "bills"], "ind": ["indianapolis", "colts"],
    "cubs": ["chicago cubs", "cubs"]
}


def fetch_json(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def chicago_time(iso: str):
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(CT)
    return dt.strftime("%b %-d"), dt.strftime("%-I:%M %p CT")


def display_team(c: dict) -> str:
    team = c.get("team") or {}
    return team.get("displayName") or team.get("shortDisplayName") or team.get("name") or "TBD"


def event_to_game(event: dict, team_id: str):
    comp = (event.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or []
    if len(competitors) < 2 or not event.get("date"):
        return None

    def is_ours(c):
        name = display_team(c).lower()
        return any(alias in name for alias in ALIASES[team_id])

    us = next((c for c in competitors if is_ours(c)), None)
    opp = next((c for c in competitors if c is not us), None)
    if not us or not opp:
        return None

    date, time = chicago_time(event["date"])
    broadcasts = []
    for b in comp.get("broadcasts") or []:
        broadcasts.extend(b.get("names") or [])

    game = {
        "date": date,
        "time": time,
        "opp": display_team(opp),
        "ha": "AWAY" if us.get("homeAway") == "away" else "HOME"
    }
    venue = (comp.get("venue") or {}).get("fullName")
    if venue:
        game["venue"] = venue
    if broadcasts:
        game["tv"] = " / ".join(dict.fromkeys(broadcasts))

    status = ((event.get("status") or {}).get("type") or {})
    if status.get("state") == "in":
        game["status"] = "live"
    elif status.get("completed") or status.get("state") == "post":
        game["status"] = "final"

    if team_id in {"gb", "buf", "ind"}:
        season_name = ((event.get("seasonType") or {}).get("name") or "").lower()
        game["type"] = "PRESEASON" if "preseason" in season_name else "REGULAR"
    return game


def main():
    data = json.loads(DATA_PATH.read_text())
    teams = {t["id"]: t for t in data.get("teams", [])}

    for team_id, url in SCHEDULES.items():
        try:
            payload = fetch_json(url)
            games = [event_to_game(event, team_id) for event in payload.get("events", [])]
            games = [game for game in games if game]
            if games:
                teams[team_id]["schedule"] = games
                print(f"{team_id}: {len(games)} games")
        except Exception as exc:
            print(f"{team_id}: preserving prior data ({exc})")

    data["generatedAt"] = datetime.now(CT).strftime("%Y-%m-%d %I:%M %p CT")
    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
