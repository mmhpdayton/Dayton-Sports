/* College Football week accordion: date-anchored Week 0, lazy weeks, live refresh. */
(()=>{
  const DAY=864e5;
  const LIVE_REFRESH_MS=30*1000;
  let liveRefreshTimer=null;
  const weekRange=(week)=>{
    if(week===0){
      return {start:new Date('2026-08-24T00:00:00-05:00'),end:new Date('2026-08-30T23:59:59-05:00')};
    }
    const start=new Date('2026-08-31T00:00:00-05:00');
    start.setDate(start.getDate()+(week-1)*7);
    const end=new Date(start);end.setDate(end.getDate()+6);end.setHours(23,59,59,999);
    return {start,end};
  };
  const currentWeek=()=>{
    const now=APP.now();
    if(now<new Date('2026-08-31T00:00:00-05:00'))return 0;
    return Math.max(1,Math.min(16,1+Math.floor((now-new Date('2026-08-31T00:00:00-05:00'))/(7*DAY))));
  };
  let activeGroup='top25';

  const scoreOf=c=>{
    const s=c?.score;
    if(s==null||s==='')return '';
    if(typeof s==='object'){
      const v=s.displayValue??s.value??s.score??s.current??'';
      return v==null?'':String(v);
    }
    return String(s);
  };
  function cfbGame(event){
    const comp=(event?.competitions||[])[0]||{},cs=comp.competitors||[];
    const home=cs.find(c=>c.homeAway==='home')||cs[0]||{},away=cs.find(c=>c.homeAway==='away')||cs[1]||{};
    const d=event.date?new Date(event.date):null,st=event?.status?.type||{},broadcasts=[];
    for(const b of comp.broadcasts||[])broadcasts.push(...(b.names||[]));
    return {
      id:event.id,start:event.date,date:d?fmtDate(d):'',time:d?fmtTime(d):'',
      home:eventTeamName(home),away:eventTeamName(away),homeLogo:eventLogo(home),awayLogo:eventLogo(away),
      homeScore:scoreOf(home),awayScore:scoreOf(away),
      homeRank:home?.curatedRank?.current||0,awayRank:away?.curatedRank?.current||0,
      status:st.state==='in'?'live':st.completed||st.state==='post'?'final':'scheduled',
      clock:event?.status?.displayClock||'',period:event?.status?.period||'',
      detail:event?.links?.[0]?.href||'',tv:[...new Set(broadcasts)].join(' / '),venue:comp?.venue?.fullName||'',
      homeRecord:recordText(home),awayRecord:recordText(away)
    };
  }

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
    [...replacement.querySelectorAll('.league-game')].forEach((row,i)=>{
      const g=games[i];if(!g)return;
      const odds=(typeof window.espnDkOddsStrip==='function'&&window.espnDkOddsStrip(g)) ||
        (typeof window.oddsStripForLeagueGame==='function'&&window.oddsStripForLeagueGame('cfb',g.home,g.away,g)) || '';
      if(!odds)return;
      const right=row.querySelector('.league-right')||row;
      right.insertAdjacentHTML('beforeend',odds);
    });
  }

  function enhanceLiveRows(replacement,games){
    [...replacement.querySelectorAll('.league-game')].forEach((row,i)=>{
      const g=games[i];if(!g||g.status!=='live')return;
      const time=row.querySelector('.league-time');
      if(time&&g.clock){
        const q=g.period?`Q${g.period}`:'';
        time.insertAdjacentHTML('beforeend',`<div class="status-text">${esc(q)}${q&&g.clock?' · ':''}${esc(g.clock)}</div>`);
      }
    });
  }

  async function loadWeek(week,panel,{background=false}={}){
    if(!panel)return;
    const wasOpen=panel.classList.contains('open');
    panel.classList.add('open');
    const body=panel.querySelector('.week-body');
    if(body&&!background)body.innerHTML=`<div class="placeholder">Loading Week ${week}…</div>`;
    try{
      const group=activeGroup==='top25'?'80':activeGroup;
      const {start,end}=weekRange(week);
      const url=`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=1000&dates=${rangeCode(start,end)}&groups=${encodeURIComponent(group)}`;
      const payload=await fetchJson(url,{cacheMs:10*1000});
      let games=(payload.events||[]).map(cfbGame);
      if(activeGroup==='top25')games=games.filter(x=>(x.homeRank&&x.homeRank<=25)||(x.awayRank&&x.awayRank<=25));
      const holder=document.createElement('div');
      holder.innerHTML=leagueWeekPanel(`Week ${week}`,games,{current:week===currentWeek(),open:wasOpen||week===currentWeek(),featuredNames:['Notre Dame']});
      const replacement=holder.firstElementChild;
      replacement.dataset.cfbWeek=String(week);
      replacement.dataset.loaded='1';
      panel.replaceWith(replacement);
      wirePanel(replacement);
      addOdds(replacement,games);
      enhanceLiveRows(replacement,games);
      const meta=replacement.querySelector('.toggle-meta');
      const liveCount=games.filter(g=>g.status==='live').length;
      if(meta)meta.textContent=`${fmtDate(start,{month:'short',day:'numeric'})} – ${fmtDate(end,{month:'short',day:'numeric'})} · ${games.length} game${games.length===1?'':'s'}${liveCount?` · ${liveCount} LIVE`:''}`;
      $('#cfbStatus').textContent=`${activeGroup==='top25'?'Top 25':CFB_GROUPS.find(x=>x[0]===activeGroup)?.[1]||'College Football'} · updated ${fmtTime(APP.now())}`;
    }catch(e){
      if(body&&!background)body.innerHTML=`<div class="placeholder">Week ${week} feed temporarily unavailable.</div>`;
      $('#cfbStatus').textContent='Feed temporarily unavailable';
    }
  }

  async function refreshOpenCfb(){
    if(!document.querySelector('#cfb')?.classList.contains('active'))return;
    const open=[...document.querySelectorAll('#cfbView .week-panel.open[data-loaded="1"]')];
    if(!open.length)return;
    await Promise.allSettled(open.map(panel=>loadWeek(Number(panel.dataset.cfbWeek),panel,{background:true})));
  }

  function startLiveRefresh(){
    if(liveRefreshTimer)clearInterval(liveRefreshTimer);
    liveRefreshTimer=setInterval(refreshOpenCfb,LIVE_REFRESH_MS);
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
    startLiveRefresh();
  };

  window.refreshCfbOdds=()=>refreshOpenCfb();
  const select=document.querySelector('#cfbWeek');
  if(select)select.style.display='none';
  startLiveRefresh();
})();
