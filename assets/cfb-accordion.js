/* College Football week accordion: date-anchored Week 0 and lazy-loaded weeks. */
(()=>{
  const DAY=864e5;
  const weekRange=(week)=>{
    if(week===0){
      return {start:new Date('2026-08-29T00:00:00-05:00'),end:new Date('2026-09-02T23:59:59-05:00')};
    }
    const start=new Date('2026-09-03T00:00:00-05:00');
    start.setDate(start.getDate()+(week-1)*7);
    const end=new Date(start);end.setDate(end.getDate()+6);end.setHours(23,59,59,999);
    return {start,end};
  };
  const currentWeek=()=>{
    const now=APP.now();
    if(now<new Date('2026-09-03T00:00:00-05:00'))return 0;
    return Math.max(1,Math.min(16,1+Math.floor((now-new Date('2026-09-03T00:00:00-05:00'))/(7*DAY))));
  };
  let activeGroup='top25';

  function panelMarkup(week,isCurrent){
    const {start,end}=weekRange(week);
    const dates=`${fmtDate(start,{month:'short',day:'numeric'})} – ${fmtDate(end,{month:'short',day:'numeric'})}`;
    return `<section class="week-panel ${isCurrent?'current open':''}" data-cfb-week="${week}" data-loaded="0">
      <button class="week-toggle" type="button">
        <div><div class="toggle-title">Week ${week}${isCurrent?' · Current':''}</div><div class="toggle-meta">${dates}</div></div>
        <span class="chev">›</span>
      </button>
      <div class="week-body"><div class="placeholder">${isCurrent?'Loading Week '+week+'…':'Tap to view games.'}</div></div>
    </section>`;
  }

  function wirePanel(panel){
    const button=panel.querySelector('.week-toggle');
    if(!button)return;
    button.onclick=async()=>{
      const opening=!panel.classList.contains('open');
      panel.classList.toggle('open');
      if(opening&&panel.dataset.loaded!=='1')await loadWeek(Number(panel.dataset.cfbWeek),panel);
    };
  }

  function addOdds(replacement,games){
    if(typeof window.oddsStripForLeagueGame!=='function')return;
    [...replacement.querySelectorAll('.league-game')].forEach((row,i)=>{
      const g=games[i];if(!g)return;
      const odds=window.oddsStripForLeagueGame('cfb',g.home,g.away);
      if(!odds)return;
      const right=row.querySelector('.league-right')||row;
      right.insertAdjacentHTML('beforeend',odds);
    });
  }

  async function loadWeek(week,panel){
    if(!panel)return;
    panel.classList.add('open');
    const body=panel.querySelector('.week-body');
    if(body)body.innerHTML=`<div class="placeholder">Loading Week ${week}…</div>`;
    try{
      const group=activeGroup==='top25'?'80':activeGroup;
      const {start,end}=weekRange(week);
      const url=`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=1000&dates=${rangeCode(start,end)}&groups=${encodeURIComponent(group)}`;
      const payload=await fetchJson(url,{cacheMs:90*1000});
      let games=(payload.events||[]).map(compToLeagueGame);
      if(activeGroup==='top25')games=games.filter(x=>(x.homeRank&&x.homeRank<=25)||(x.awayRank&&x.awayRank<=25));
      const holder=document.createElement('div');
      holder.innerHTML=leagueWeekPanel(`Week ${week}`,games,{current:week===currentWeek(),open:true,featuredNames:['Notre Dame']});
      const replacement=holder.firstElementChild;
      replacement.dataset.cfbWeek=String(week);
      replacement.dataset.loaded='1';
      panel.replaceWith(replacement);
      wirePanel(replacement);
      addOdds(replacement,games);
      const meta=replacement.querySelector('.toggle-meta');
      if(meta)meta.textContent=`${fmtDate(start,{month:'short',day:'numeric'})} – ${fmtDate(end,{month:'short',day:'numeric'})} · ${games.length} game${games.length===1?'':'s'}`;
      $('#cfbStatus').textContent=`${activeGroup==='top25'?'Top 25':CFB_GROUPS.find(x=>x[0]===activeGroup)?.[1]||'College Football'} · ${fmtTime(APP.now())}`;
    }catch(e){
      if(body)body.innerHTML=`<div class="placeholder">Week ${week} feed temporarily unavailable.</div>`;
      $('#cfbStatus').textContent='Feed temporarily unavailable';
    }
  }

  loadCfb=async(group='top25')=>{
    activeGroup=group||'top25';
    APP.cfbWeek=currentWeek();
    const weekSelect=document.querySelector('#cfbWeek');
    if(weekSelect)weekSelect.style.display='none';
    $('#cfbView').innerHTML=Array.from({length:17},(_,w)=>panelMarkup(w,w===APP.cfbWeek)).join('');
    $$('#cfbView .week-panel').forEach(wirePanel);
    const current=$(`#cfbView [data-cfb-week="${APP.cfbWeek}"]`);
    await loadWeek(APP.cfbWeek,current);
  };

  window.refreshCfbOdds=()=>{
    const open=[...document.querySelectorAll('#cfbView .week-panel.open[data-loaded="1"]')];
    if(open.length)loadCfb(activeGroup);
  };
  const select=document.querySelector('#cfbWeek');
  if(select)select.style.display='none';
})();
