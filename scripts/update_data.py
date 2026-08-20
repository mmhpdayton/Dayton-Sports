#!/usr/bin/env python3
"""Dayton Sports production data updater.

Static family schedules remain authoritative. Public schedules, scores, records,
broadcasts, rankings and standings are refreshed from ESPN. Known-good data is
preserved when a source is unavailable or unexpectedly incomplete.
"""
from __future__ import annotations

import json
import re
import urllib.request
import html as html_lib
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "sports-data.json"
CT = ZoneInfo("America/Chicago")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}

TEAM_ALIASES = {
    "nd": ["notre dame", "fighting irish"],
    "wisc": ["wisconsin", "badgers"],
    "lfc": ["liverpool"],
    "gb": ["green bay", "packers"],
    "buf": ["buffalo", "bills"],
    "ind": ["indianapolis", "colts"],
    "cubs": ["chicago cubs", "cubs"],
}
SCHEDULES = {
    "nd": ("https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/87/schedule?season=2026", 8),
    "wisc": ("https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/teams/275/schedule?season=2026", 10),
    "lfc": ("https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule?season=2026", 10),
    "gb": ("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/gb/schedule?season=2026", 17),
    "buf": ("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/buf/schedule?season=2026", 17),
    "ind": ("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/ind/schedule?season=2026", 17),
    "cubs": ("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/chc/schedule?season=2026&seasontype=2", 120),
}
STANDINGS_URLS = {
    "epl": "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2026",
    "nfl": "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=2026&type=0",
    "mlb": "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?season=2026&type=0",
}
RANKING_URLS = {
    "cfb": "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
    "volleyball": "https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/rankings",
}
WTW_NETWORKS = [
    "ESPN","ESPN2","ESPNU","ESPN+","ABC","FOX","FS1","FS2","CBS","CBS Sports Network",
    "NBC","Peacock","USA Network","NFL Network","Big Ten Network","B1G+","SEC Network",
    "ACC Network","Marquee Sports Network","Apple TV","Prime Video","Paramount+","MLB.TV"
]

def fetch_json(url: str, timeout: int = 25):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def fetch_text(url: str, timeout: int = 25):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")

def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

def team_name(c: dict) -> str:
    t = c.get("team") or {}
    return t.get("displayName") or t.get("shortDisplayName") or t.get("name") or t.get("abbreviation") or "TBD"

def team_matches(c: dict, aliases: list[str]) -> bool:
    text = norm(f"{team_name(c)} {(c.get('team') or {}).get('abbreviation','')}")
    return any(norm(a) in text for a in aliases)

def chicago_parts(iso: str):
    d = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(CT)
    return d.strftime("%b %-d"), d.strftime("%-I:%M %p CT"), d.isoformat()

def detail_link(event: dict) -> str:
    for link in event.get("links") or []:
        if re.search(r"summary|gamecast|boxscore", link.get("text",""), re.I):
            return link.get("href","")
    return (event.get("links") or [{}])[0].get("href","")

def event_to_team_game(event: dict, team_id: str):
    comp = (event.get("competitions") or [{}])[0]
    cs = comp.get("competitors") or []
    ours = next((c for c in cs if team_matches(c, TEAM_ALIASES[team_id])), None)
    opp = next((c for c in cs if c is not ours), None)
    if not ours or not opp or not event.get("date"):
        return None
    date, time, start = chicago_parts(event["date"])
    broadcasts = []
    for b in comp.get("broadcasts") or []:
        broadcasts.extend(b.get("names") or [])
    game = {
        "id": event.get("id"), "date": date, "time": time, "start": start,
        "opp": team_name(opp),
        "ha": "AWAY" if ours.get("homeAway") == "away" else ("HOME" if ours.get("homeAway") == "home" else "NEUTRAL"),
        "tv": " / ".join(dict.fromkeys(broadcasts)),
        "venue": (comp.get("venue") or {}).get("fullName", ""),
        "detail": detail_link(event),
    }
    status = (event.get("status") or {}).get("type") or {}
    live = status.get("state") == "in"
    final = bool(status.get("completed")) or status.get("state") == "post"
    game["status"] = "live" if live else ("final" if final else "scheduled")
    us_score = ours.get("score", "")
    opp_score = opp.get("score", "")
    game["_score"] = {
        "our": str(us_score), "opp": str(opp_score), "live": live, "final": final,
        "clock": (event.get("status") or {}).get("displayClock", ""),
        "period": (event.get("status") or {}).get("period", ""),
    }
    if final and us_score != "" and opp_score != "":
        try:
            a, b = float(us_score), float(opp_score)
            game["result"] = f"{'W' if a>b else 'L' if a<b else 'T'} {us_score}–{opp_score}"
        except Exception:
            pass
    notes = " · ".join(n.get("headline") or n.get("type") or "" for n in (comp.get("notes") or []) if n.get("headline") or n.get("type"))
    season_name = (event.get("seasonType") or {}).get("name", "")
    if notes or season_name:
        game["event"] = notes or season_name
    if team_id in {"gb","buf","ind"}:
        text = norm(f"{season_name} {notes}")
        game["type"] = "PRESEASON" if "preseason" in text else "REGULAR"
    return game

def refresh_team_schedules(data: dict):
    teams = {t["id"]: t for t in data.get("teams", [])}
    for team_id, (url, min_games) in SCHEDULES.items():
        if team_id not in teams:
            continue
        try:
            payload = fetch_json(url)
            games = [event_to_team_game(e, team_id) for e in payload.get("events", [])]
            games = [g for g in games if g]
            if team_id == "lfc":
                games = [g for g in games if "friendly" not in norm(g.get("event",""))]
            if len(games) >= min_games:
                teams[team_id]["schedule"] = games
                record = payload.get("team", {}).get("recordSummary", "")
                if record:
                    teams[team_id]["record"] = record
                print(f"schedule {team_id}: {len(games)}")
            else:
                print(f"schedule {team_id}: rejected unexpected count {len(games)}")
        except Exception as exc:
            print(f"schedule {team_id}: preserved ({exc})")

def clean_html(raw: str) -> str:
    raw = re.sub(r"<script\b[^>]*>.*?</script>", " ", raw, flags=re.I|re.S)
    raw = re.sub(r"<style\b[^>]*>.*?</style>", " ", raw, flags=re.I|re.S)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html_lib.unescape(raw)).strip()

def find_network(text: str, aliases: list[str], opponent: str):
    low = text.lower()
    opp_tokens = [x for x in norm(opponent).split() if len(x)>=4]
    for alias in aliases:
        p = low.find(alias.lower())
        while p >= 0:
            window = text[max(0,p-180):p+800]
            nw = norm(window)
            if not opp_tokens or any(tok in nw for tok in opp_tokens):
                found = [n for n in WTW_NETWORKS if re.search(rf"(?<![A-Za-z0-9+]){re.escape(n)}(?![A-Za-z0-9+])", window, re.I)]
                if found:
                    return " / ".join(dict.fromkeys(found[:3]))
            p = low.find(alias.lower(), p+1)
    return None

def refresh_broadcasts(data: dict):
    today = datetime.now(CT).date()
    cutoff = today + timedelta(days=21)
    cache = {}
    for t in data.get("teams", []):
        aliases = TEAM_ALIASES.get(t.get("id"))
        if not aliases:
            continue
        for g in t.get("schedule", []):
            try:
                d = datetime.fromisoformat(g.get("start","")).astimezone(CT).date()
            except Exception:
                continue
            if d < today or d > cutoff or g.get("status") == "final":
                continue
            code = d.strftime("%Y%m%d")
            if code not in cache:
                try:
                    cache[code] = clean_html(fetch_text(f"https://www.espn.com/where-to-watch/_/dates/{code}"))
                except Exception:
                    cache[code] = ""
            if cache[code]:
                network = find_network(cache[code], aliases, g.get("opp",""))
                if network:
                    g["tv"] = network

def flatten_groups(node: dict, out=None):
    if out is None: out=[]
    if not isinstance(node, dict): return out
    st = node.get("standings") or {}
    if isinstance(st.get("entries"), list):
        out.append({"name":node.get("name") or node.get("abbreviation") or "", "entries":st["entries"]})
    for key in ("children","groups"):
        for child in node.get(key) or []:
            flatten_groups(child,out)
    return out

def normalize_entry(e: dict):
    team = e.get("team") or {}
    stats = {}
    for s in e.get("stats") or []:
        stats[s.get("name") or s.get("abbreviation") or s.get("type")] = s.get("displayValue", s.get("value",""))
    return {
        "team": team.get("displayName") or team.get("name") or "",
        "abbr": team.get("abbreviation",""),
        "logo": ((team.get("logos") or [{}])[0]).get("href",""),
        "w": stats.get("wins", stats.get("W","")), "l": stats.get("losses", stats.get("L","")),
        "t": stats.get("ties", stats.get("T","")), "pct": stats.get("winPercent", stats.get("PCT","")),
        "gp": stats.get("gamesPlayed", stats.get("GP","")), "points": stats.get("points", stats.get("PTS","")),
        "diff": stats.get("pointDifferential", stats.get("differential","")),
    }

def find_group(groups, patterns):
    for g in groups:
        n = norm(g.get("name",""))
        if any(norm(p) in n for p in patterns):
            return [normalize_entry(e) for e in g["entries"]]
    return []

def refresh_standings(data: dict):
    try:
        p = fetch_json(STANDINGS_URLS["epl"])
        groups = flatten_groups(p)
        rows = []
        for g in groups:
            if len(g["entries"]) >= 10:
                rows = [normalize_entry(e) for e in g["entries"]]
                break
        if rows: data["standings"]["epl"] = rows
    except Exception as exc: print("standings epl:", exc)
    try:
        p = fetch_json(STANDINGS_URLS["nfl"])
        groups = flatten_groups(p)
        for key, pats in {"nfcNorth":["nfc north"],"afcEast":["afc east"],"afcSouth":["afc south"]}.items():
            rows = find_group(groups,pats)
            if rows: data["standings"][key] = rows
    except Exception as exc: print("standings nfl:", exc)
    try:
        p = fetch_json(STANDINGS_URLS["mlb"])
        groups = flatten_groups(p)
        rows = find_group(groups,["nl central","national league central"])
        if rows: data["standings"]["nlCentral"] = rows
    except Exception as exc: print("standings mlb:", exc)

def ranking_rows(payload: dict):
    out=[]
    for poll in payload.get("rankings") or []:
        poll_name = poll.get("name") or poll.get("shortName") or poll.get("headline") or ""
        for r in poll.get("ranks") or []:
            team = r.get("team") or {}
            out.append({
                "poll": poll_name, "rank": r.get("current") or r.get("rank"),
                "team": team.get("displayName") or team.get("name") or "", "record": r.get("recordSummary") or "",
                "previous": r.get("previous"), "firstPlaceVotes": r.get("firstPlaceVotes"),
            })
    return [r for r in out if r.get("rank") and r.get("team")]

def refresh_rankings(data: dict):
    for key,url in RANKING_URLS.items():
        try:
            rows = ranking_rows(fetch_json(url))
            if rows:
                data["rankings"][key] = rows
                print(f"rankings {key}: {len(rows)}")
        except Exception as exc:
            print(f"rankings {key}: preserved ({exc})")
    teams={t["id"]:t for t in data.get("teams",[])}
    nd = [r for r in data.get("rankings",{}).get("cfb",[]) if "notre dame" in norm(r["team"])]
    if nd:
        labels=[]
        for r in nd:
            pname = r["poll"].replace("Poll","").strip()
            labels.append(f"#{r['rank']} {pname}")
        teams["nd"]["context"]=" · ".join(labels[:2])
    wi = [r for r in data.get("rankings",{}).get("volleyball",[]) if "wisconsin" in norm(r["team"])]
    if wi:
        teams["wisc"]["context"]=f"#{wi[0]['rank']} {wi[0]['poll'].replace('Poll','').strip()}"

def main():
    data=json.loads(DATA_PATH.read_text(encoding="utf-8"))
    refresh_team_schedules(data)
    refresh_broadcasts(data)
    refresh_rankings(data)
    refresh_standings(data)
    data["version"]="robust-v1"
    data["generatedAt"]=datetime.now(CT).strftime("%Y-%m-%d %I:%M %p CT")
    DATA_PATH.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Dayton Sports data refresh complete")

if __name__=="__main__":
    main()
