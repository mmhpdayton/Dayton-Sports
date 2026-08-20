/* College Football week accordion: keeps all weeks visible and lazy-loads each week on open. */
(()=>{
  /* 2026 Week 0 begins Sat Aug 22. ESPN's API labels that opening slate as week=1,
     so the UI week number is intentionally one behind the ESPN feed number. */
  const currentWeek=()=>Math.max(0,Math.min(16,Math.floor((APP.now()-new Date("2026-08-22T00:00:00-05:00"))/(7*864e5))));
  const espnWeekForUiWeek=(week)=>week+1;
  let activeGroup="top25";

  function panelMarkup(week,isCurrent){
    return `<section class="week-panel ${isCurrent?"current open":""}" data-cfb-week="${week}" data-loaded="0">
      <button class="week-toggle" type="button">
        <div><div class="toggle-title">Week ${week}${isCurrent?" · Current":""}</div><div class="toggle-meta">${isCurrent?"Open now":"Tap to view games"}</div></div>
        <span class="chev">›</span>
      </button>
      <div class="week-body"><div class="placeholder">${isCurrent?"Loading Week "+week+"…":"Open Week "+week+" to load games."}</div></div>
    </section>`;
  }

  function wirePanel(panel){
    const button=panel.querySelector('.week-toggle');
    if(!button)return;
    button.onclick=async()=>{
      const opening=!panel.classList.contains('open');
      panel.classList.toggle('open');
      if(opening&&panel.dataset.loaded!=="1")await loadWeek(Number(panel.dataset.cfbWeek),panel);
    };
  }

  async function loadWeek(week,panel){
    if(!panel)return;
    panel.classList.add('open');
    const body=panel.querySelector('.week-body');
    if(body)body.innerHTML=`<div class="placeholder">Loading Week ${week}…</div>`;
    try{
      const group=activeGroup==="top25"?"80":activeGroup;
      const espnWeek=espnWeekForUiWeek(week);
      const url=`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=1000&dates=2026&seasontype=2&week=${espnWeek}&groups=${encodeURIComponent(group)}`;
      const payload=await fetchJson(url,{cacheMs:90*1000});
      let games=(payload.events||[]).map(compToLeagueGame);
      if(activeGroup==="top25")games=games.filter(x=>(x.homeRank&&x.homeRank<=25)||(x.awayRank&&x.awayRank<=25));
      const holder=document.createElement('div');
      holder.innerHTML=leagueWeekPanel(`Week ${week}`,games,{current:week===currentWeek(),open:true,featuredNames:["Notre Dame"]});
      const replacement=holder.firstElementChild;
      replacement.dataset.cfbWeek=String(week);
      replacement.dataset.loaded="1";
      panel.replaceWith(replacement);
      wirePanel(replacement);
      const meta=replacement.querySelector('.toggle-meta');
      if(meta)meta.textContent=`${games.length} game${games.length===1?"":"s"}`;
      $('#cfbStatus').textContent=`${activeGroup==="top25"?"Top 25":CFB_GROUPS.find(x=>x[0]===activeGroup)?.[1]||"College Football"} · ${fmtTime(APP.now())}`;
    }catch(e){
      if(body)body.innerHTML=`<div class="placeholder">Week ${week} feed temporarily unavailable.</div>`;
      $('#cfbStatus').textContent="Feed temporarily unavailable";
    }
  }

  loadCfb=async(group="top25")=>{
    activeGroup=group||"top25";
    APP.cfbWeek=currentWeek();
    const weekSelect=document.querySelector('#cfbWeek');
    if(weekSelect)weekSelect.style.display='none';
    $('#cfbView').innerHTML=Array.from({length:17},(_,w)=>panelMarkup(w,w===APP.cfbWeek)).join('');
    $$('#cfbView .week-panel').forEach(wirePanel);
    const current=$(`#cfbView [data-cfb-week="${APP.cfbWeek}"]`);
    await loadWeek(APP.cfbWeek,current);
  };

  const select=document.querySelector('#cfbWeek');
  if(select)select.style.display='none';
})();
