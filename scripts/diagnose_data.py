#!/usr/bin/env python3
import json, urllib.request
from pathlib import Path
URLS={
"nd":"https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/87/schedule?season=2026",
"wisc":"https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/teams/275/schedule?season=2026",
"lfc":"https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule?season=2026",
"gb":"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/gb/schedule?season=2026",
"buf":"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/buf/schedule?season=2026",
"ind":"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/ind/schedule?season=2026",
"cubs":"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/chc/schedule?season=2026&seasontype=2",
"cfb_rank":"https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
"vb_rank":"https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/rankings",
"epl_stand":"https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2026",
}
HEADERS={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36","Accept":"application/json,text/plain,*/*","Referer":"https://sportsbook.draftkings.com/","Origin":"https://sportsbook.draftkings.com"}
out={}
for k,u in URLS.items():
    try:
        req=urllib.request.Request(u,headers=HEADERS)
        with urllib.request.urlopen(req,timeout=25) as r:
            p=json.load(r)
        row={"ok":True,"top_keys":list(p.keys())[:20]}
        if "events" in p: row["events"]=len(p.get("events") or [])
        if "rankings" in p: row["rankings"]=len(p.get("rankings") or [])
        if "children" in p: row["children"]=len(p.get("children") or [])
        out[k]=row
    except Exception as e:
        out[k]={"ok":False,"error":repr(e)}
Path("data/diagnostics.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
