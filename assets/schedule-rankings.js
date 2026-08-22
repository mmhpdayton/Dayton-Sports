/* Apply current rankings to schedule opponent labels exactly once. */
(()=>{
  const cleanRank=s=>String(s||'').replace(/^#\d+\s*/,'').replace(/(?:#\d+\s*)+/g,'').trim();
  const norm=s=>cleanRank(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function getRankMap(){
    const map=new Map();
    const polls=[];
    const r=window.APP?.data?.rankings||{};
    if(Array.isArray(r.collegeVolleyball)) polls.push(r.collegeVolleyball);
    if(Array.isArray(r.volleyball)) polls.push(r.volleyball);
    if(Array.isArray(r.avca)) polls.push(r.avca);
    for(const poll of polls){
      for(const row of poll||[]){
        const rank=Number(row.rank||row.current||row.position);
        const name=row.team||row.name||row.school||row.displayName;
        if(rank>0&&name) map.set(norm(name),rank);
      }
    }
    return map;
  }

  function rerankWisconsin(){
    const team=typeof teamById==='function'?teamById('wisc'):null;
    if(!team?.schedule)return;
    const ranks=getRankMap();
    for(const g of team.schedule){
      const base=cleanRank(g.opp);
      const key=norm(base);
      let rank=ranks.get(key);
      if(!rank){
        for(const [k,v] of ranks){if(k.includes(key)||key.includes(k)){rank=v;break}}
      }
      g.opp=rank?`#${rank} ${base}`:base;
    }
  }

  window.applyScheduleRankings=rerankWisconsin;
  setTimeout(()=>{rerankWisconsin(); if(document.querySelector('#schedules')?.classList.contains('active')&&typeof renderSchedules==='function')renderSchedules();},1200);
})();
