#!/usr/bin/env python3
"""Ensure Payton Varsity Volleyball is a first-class Dayton family team."""
import json
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "data" / "sports-data.json"

SCHEDULE = [
  {"date":"Aug 24","time":"6:00 PM CT","opp":"Willowbrook","ha":"HOME","conference":False,"status":"final","result":"L 0–2"},
  {"date":"Aug 26","time":"5:30 PM CT","opp":"York","ha":"NEUTRAL","conference":False,"tournament":True,"status":"final","result":"L 1–2"},
  {"date":"Aug 26","time":"6:30 PM CT","opp":"Buffalo Grove","ha":"NEUTRAL","conference":False,"tournament":True,"status":"final","result":"L 0–2"},
  {"date":"Aug 29","time":"11:00 AM CT","opp":"Glenbard East","ha":"NEUTRAL","conference":False,"tournament":True},
  {"date":"Aug 29","time":"12:00 PM CT","opp":"West Aurora","ha":"NEUTRAL","conference":False,"tournament":True},
  {"date":"Aug 29","time":"1:00 PM CT","opp":"Romeoville","ha":"NEUTRAL","conference":False,"tournament":True,"status":"final","result":"W 2–1","event":"Wheaton North Blue/Gold Invite"},
  {"date":"Sep 2","time":"5:00 PM CT","opp":"Marian Catholic","ha":"NEUTRAL","conference":False,"tournament":True},
  {"date":"Sep 2","time":"6:00 PM CT","opp":"Thornton Fractional North","ha":"NEUTRAL","conference":False,"tournament":True},
  {"date":"Sep 2","time":"7:00 PM CT","opp":"Evergreen Park","ha":"NEUTRAL","conference":False,"tournament":True},
  {"date":"Sep 3","time":"6:00 PM CT","opp":"St. Ignatius College Prep","ha":"HOME","conference":False},
  {"date":"Sep 5","time":"TBA","opp":"TBA — Evergreen Park Invite Game #4","ha":"NEUTRAL","conference":False,"tournament":True},
  {"date":"Sep 5","time":"TBA","opp":"TBA — Evergreen Park Invite Game #5","ha":"NEUTRAL","conference":False,"tournament":True},
  {"date":"Sep 8","time":"6:00 PM CT","opp":"Whitney Young","ha":"AWAY","conference":True},
  {"date":"Sep 9","time":"5:00 PM CT","opp":"Niles West","ha":"AWAY","conference":False},
  {"date":"Sep 10","time":"5:00 PM CT","opp":"Chicago Washington","ha":"HOME","conference":True},
  {"date":"Sep 15","time":"5:00 PM CT","opp":"Amundsen","ha":"AWAY","conference":True},
  {"date":"Sep 17","time":"5:00 PM CT","opp":"Hancock","ha":"HOME","conference":True},
  {"date":"Sep 22","time":"5:00 PM CT","opp":"Northside","ha":"HOME","conference":True},
  {"date":"Sep 23","time":"6:00 PM CT","opp":"Montini Catholic","ha":"AWAY","conference":False},
  {"date":"Sep 24","time":"5:00 PM CT","opp":"Kenwood","ha":"AWAY","conference":True},
  {"date":"Sep 29","time":"5:00 PM CT","opp":"Lane Tech","ha":"HOME","conference":True},
  {"date":"Sep 30","time":"6:00 PM CT","opp":"Elmwood Park","ha":"AWAY","conference":False},
  {"date":"Oct 1","time":"6:00 PM CT","opp":"Lincoln Park","ha":"AWAY","conference":True},
  {"date":"Oct 6","time":"5:00 PM CT","opp":"Jones","ha":"HOME","conference":True},
  {"date":"Oct 10","time":"TBA","opp":"TBA — Quincy HS Invite Game #1","ha":"AWAY","conference":False,"tournament":True},
  {"date":"Oct 10","time":"TBA","opp":"TBA — Quincy HS Invite Game #2","ha":"AWAY","conference":False,"tournament":True},
  {"date":"Oct 10","time":"TBA","opp":"TBA — Quincy HS Invite Game #3","ha":"AWAY","conference":False,"tournament":True},
  {"date":"Oct 10","time":"TBA","opp":"TBA — Quincy HS Invite Game #4","ha":"AWAY","conference":False,"tournament":True},
  {"date":"Oct 10","time":"TBA","opp":"TBA — Quincy HS Invite Game #5","ha":"AWAY","conference":False,"tournament":True}
]

TEAM = {
  "id":"paytonvarsity",
  "name":"Payton Varsity Volleyball",
  "abbr":"P",
  "color":"#f47b20",
  "record":"1–3",
  "context":"Hadley · Varsity call-up",
  "familyPriority":True,
  "homePriority":2,
  "logo":"https://raw.githubusercontent.com/mmhpdayton/FaveSports/main/payton-logo.png",
  "schedule":SCHEDULE
}

def main():
    data=json.loads(PATH.read_text(encoding="utf-8"))
    teams=data.get("teams",[])
    existing=next((t for t in teams if t.get("id")=="paytonvarsity"),None)
    if existing:
        # Preserve future result enrichment while keeping the published schedule current.
        by_key={(g.get("date"),g.get("time"),g.get("opp")):g for g in existing.get("schedule",[])}
        merged=[]
        for g in SCHEDULE:
            old=by_key.get((g.get("date"),g.get("time"),g.get("opp")),{})
            item=dict(g)
            for k in ("status","result","_score","detail"):
                if k in old and k not in item: item[k]=old[k]
            merged.append(item)
        existing.update({k:v for k,v in TEAM.items() if k!="schedule"})
        existing["schedule"]=merged
    else:
        idx=next((i+1 for i,t in enumerate(teams) if t.get("id")=="payton"),0)
        teams.insert(idx,TEAM)
    # Family teams stay at the top in the order that matters to the Daytons.
    priorities={"payton":1,"paytonvarsity":2,"amundsen":3,"amundsenvarsity":4}
    for t in teams:
        if t.get("id") in priorities:
            t["familyPriority"]=True
            t["homePriority"]=priorities[t["id"]]
    PATH.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Payton Varsity Volleyball ensured")

if __name__=="__main__": main()
