#!/usr/bin/env python3
"""Refresh DraftKings lines directly from DraftKings Sportsbook.

Uses DraftKings league pages for event-group discovery, then the current
sportsbook-nash v5 event-group API. Browser impersonation is provided by
curl_cffi because DraftKings rejects ordinary urllib/GitHub-runner requests.
"""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "sports-data.json"

HEADERS = {
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://sportsbook.draftkings.com",
    "Referer": "https://sportsbook.draftkings.com/",
}

LEAGUES = {
    "cfb": {
        "pages": ["https://sportsbook.draftkings.com/leagues/football/ncaaf"],
        "terms": ["college", "football"],
        "fallback": "87637",
    },
    "nfl": {
        "pages": ["https://sportsbook.draftkings.com/leagues/football/nfl"],
        "terms": ["nfl"],
        "fallback": "88808",
    },
    "mlb": {
        "pages": ["https://sportsbook.draftkings.com/leagues/baseball/mlb"],
        "terms": ["mlb"],
        "fallback": "84240",
    },
    "epl": {
        "pages": [
            "https://sportsbook.draftkings.com/leagues/soccer/england---premier-league/",
            "https://sportsbook.draftkings.com/leagues/soccer/english-premier-league",
        ],
        "terms": ["premier", "league"],
        "fallback": "40253",
    },
    "cvb": {
        "pages": ["https://sportsbook.draftkings.com/sports/volleyball"],
        "terms": ["volleyball"],
        "fallback": None,
    },
}

API_TEMPLATES = [
    "https://sportsbook-nash.draftkings.com/sites/US-IL-SB/api/v5/eventgroups/{group}?format=json",
    "https://sportsbook-nash.draftkings.com/sites/US-SB/api/v5/eventgroups/{group}?format=json",
    "https://sportsbook-nash.draftkings.com/sites/US-NJ-SB/api/v5/eventgroups/{group}?format=json",
]


def fetch_text(url: str, timeout: int = 25) -> str:
    r = requests.get(url, headers=HEADERS, timeout=timeout, impersonate="chrome")
    r.raise_for_status()
    return r.text


def fetch_json(url: str, timeout: int = 25):
    r = requests.get(url, headers=HEADERS, timeout=timeout, impersonate="chrome")
    r.raise_for_status()
    ctype = (r.headers.get("content-type") or "").lower()
    body = r.text.lstrip()
    if "json" not in ctype and not body.startswith(("{", "[")):
        raise RuntimeError(f"DraftKings returned non-JSON HTTP {r.status_code} ({ctype or 'unknown content type'})")
    return r.json()


def clean(v):
    return html.unescape(str(v or "")).replace("−", "-").replace("–", "-").strip()


def norm(v):
    return re.sub(r"[^a-z0-9]+", " ", clean(v).lower()).strip()


def discover_group(pages: list[str], terms: list[str]):
    patterns = [
        r'eventgroups?/(\d{3,10})',
        r'eventgroup(?:id)?["\':=\s]+(\d{3,10})',
        r'"eventGroupId"\s*:\s*"?(\d{3,10})',
        r'"leagueId"\s*:\s*"?(\d{3,10})',
    ]
    candidates = []
    for page in pages:
        try:
            raw = fetch_text(page)
        except Exception as exc:
            print(f"DraftKings discovery page failed {page}: {exc}")
            continue
        low = raw.lower()
        for pat in patterns:
            for m in re.finditer(pat, low, flags=re.I):
                window = low[max(0, m.start()-1200):min(len(low), m.end()+1200)]
                score = sum(1 for t in terms if t.lower() in window)
                candidates.append((score, m.group(1), page))
    if not candidates:
        return None, None
    candidates.sort(key=lambda x: x[0], reverse=True)
    score, group, page = candidates[0]
    return (group, page) if score >= max(1, len(terms)-1) else (None, None)


def event_teams(event: dict):
    away = event.get("teamName1") or event.get("awayTeamName") or ""
    home = event.get("teamName2") or event.get("homeTeamName") or ""
    for p in event.get("participants") or []:
        if not isinstance(p, dict):
            continue
        role = str(p.get("venueRole") or p.get("homeAway") or p.get("role") or "").lower()
        name = p.get("name") or p.get("displayName") or p.get("teamName") or ""
        if role in {"away", "visitor"} and name:
            away = name
        elif role == "home" and name:
            home = name
    if (not away or not home) and event.get("name"):
        parts = re.split(r"\s+@\s+|\s+vs\.?\s+", str(event["name"]), flags=re.I)
        if len(parts) == 2:
            away = away or parts[0]
            home = home or parts[1]
    return clean(away), clean(home)


def outcome_name(o):
    return clean(o.get("participant") or o.get("label") or o.get("name") or o.get("participantName") or o.get("displayName"))


def outcome_line(o):
    for key in ("line", "points", "handicap"):
        if o.get(key) is not None:
            return clean(o[key])
    return None


def outcome_price(o):
    for key in ("oddsAmerican", "americanOdds", "odds", "price"):
        if key not in o or o[key] is None:
            continue
        v = o[key]
        if isinstance(v, dict):
            v = v.get("american") or v.get("americanOdds") or v.get("display")
        if v is None:
            continue
        s = clean(v)
        return "+100" if s.lower() in {"ev", "even", "even money"} else s
    return None


def iter_offers(event_group):
    for cat in event_group.get("offerCategories") or []:
        cat_name = str(cat.get("name") or "")
        for desc in cat.get("offerSubcategoryDescriptors") or []:
            sub_name = str(desc.get("name") or "")
            sub = desc.get("offerSubcategory") or {}
            for offer_group in sub.get("offers") or []:
                seq = offer_group if isinstance(offer_group, list) else [offer_group]
                for offer in seq:
                    if isinstance(offer, dict):
                        yield cat_name, sub_name, offer


def market_type(cat, sub, offer):
    text = " ".join([cat, sub, str(offer.get("label") or ""), str(offer.get("name") or ""), str(offer.get("marketName") or "")]).lower()
    if "moneyline" in text or "money line" in text or "3-way" in text or "3 way" in text:
        return "moneyline"
    if "run line" in text or "spread" in text or "handicap" in text:
        return "spread"
    if "total" in text or "over/under" in text or "over under" in text:
        return "total"
    return None


def parse_eventgroup(payload: dict, sport: str):
    eg = payload.get("eventGroup") or payload
    events = eg.get("events") or payload.get("events") or []
    games, event_map = {}, {}
    for e in events:
        if not isinstance(e, dict):
            continue
        eid = str(e.get("eventId") or e.get("id") or "")
        if not eid:
            continue
        away, home = event_teams(e)
        event_map[eid] = e
        games[eid] = {
            "sport": sport, "eventId": eid, "away": away, "home": home,
            "startDate": e.get("startDate") or e.get("startDateTime") or e.get("startEventDate"),
            "moneyline": {}, "spread": {}, "total": {}, "source": "DraftKings Sportsbook",
        }

    for cat, sub, offer in iter_offers(eg):
        mt = market_type(cat, sub, offer)
        if not mt:
            continue
        eid = str(offer.get("eventId") or offer.get("providerEventId") or offer.get("eventID") or "")
        if not eid:
            continue
        rec = games.setdefault(eid, {
            "sport": sport, "eventId": eid, "away": "", "home": "", "startDate": "",
            "moneyline": {}, "spread": {}, "total": {}, "source": "DraftKings Sportsbook",
        })
        if not rec["away"] or not rec["home"]:
            away, home = event_teams(event_map.get(eid, {}))
            rec["away"], rec["home"] = rec["away"] or away, rec["home"] or home
        outcomes = offer.get("outcomes") or []
        if mt == "moneyline":
            for o in outcomes:
                name, price = outcome_name(o), outcome_price(o)
                if name and price:
                    rec["moneyline"][name] = price
        elif mt == "spread":
            for o in outcomes:
                name, line, price = outcome_name(o), outcome_line(o), outcome_price(o)
                if name and (line is not None or price):
                    rec["spread"][name] = {"line": line, "odds": price}
        elif mt == "total":
            for o in outcomes:
                label = norm(outcome_name(o) or o.get("label") or o.get("name"))
                line, price = outcome_line(o), outcome_price(o)
                if "over" in label:
                    if line is not None: rec["total"]["line"] = line
                    if price: rec["total"]["overOdds"] = price
                elif "under" in label:
                    if line is not None: rec["total"].setdefault("line", line)
                    if price: rec["total"]["underOdds"] = price

    return [g for g in games.values() if g.get("away") and g.get("home") and (g["moneyline"] or g["spread"] or g["total"])]


def fetch_group(sport: str, group: str):
    failures = []
    for template in API_TEMPLATES:
        url = template.format(group=group)
        try:
            games = parse_eventgroup(fetch_json(url, timeout=25), sport)
            if games:
                return games, url
            failures.append(f"{url}: JSON returned but no main markets parsed")
        except Exception as exc:
            failures.append(f"{url}: {exc}")
    raise RuntimeError(" | ".join(failures))


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    prior = data.get("draftkingsOdds") or {}
    all_games, errors, sources, groups, seen = [], {}, {}, {}, set()

    for sport, cfg in LEAGUES.items():
        discovered, page = discover_group(cfg["pages"], cfg["terms"])
        group = discovered or cfg.get("fallback")
        groups[sport] = {"id": group, "discovered": bool(discovered), "page": page or cfg["pages"][0]}
        if not group:
            errors[sport] = "No DraftKings event group discovered"
            continue
        try:
            games, source = fetch_group(sport, group)
            sources[sport] = source
            for g in games:
                key = (sport, norm(g.get("away")), norm(g.get("home")), str(g.get("startDate") or "")[:10])
                if key not in seen:
                    seen.add(key); all_games.append(g)
        except Exception as exc:
            errors[sport] = str(exc)

    attempt_at = datetime.now(timezone.utc).isoformat()
    if all_games:
        data["draftkingsOdds"] = {
            "updatedAt": attempt_at,
            "source": "DraftKings Sportsbook",
            "primarySource": "sportsbook-nash v5 event-group feed",
            "leaguePages": {k: v["pages"][0] for k, v in LEAGUES.items()},
            "groups": groups,
            "sourceFeeds": sources,
            "errors": errors,
            "games": all_games,
            "status": "ok",
        }
    else:
        # Do not poison the site with an empty snapshot. Preserve a last-known-good
        # snapshot if one exists, while exposing diagnostics to the workflow log.
        retained = dict(prior)
        retained["lastAttemptAt"] = attempt_at
        retained["lastErrors"] = errors
        if not retained.get("games"):
            retained.update({"updatedAt": attempt_at, "games": [], "errors": errors, "status": "unavailable"})
        data["draftkingsOdds"] = retained

    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = {s: sum(1 for g in all_games if g["sport"] == s) for s in LEAGUES}
    print("DraftKings odds refresh:", counts)
    if errors: print("DraftKings errors:", errors)


if __name__ == "__main__":
    main()
