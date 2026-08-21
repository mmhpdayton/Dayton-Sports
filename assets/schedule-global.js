/* Universal schedule score/result layout + browser-side public schedule hydration. */
(()=>{
  const cfg={
    cubs:{sport:'baseball/mlb',team:'chc',match:['CHC','16']},
    wisc:{sport:'volleyball/womens-college-volleyball',team:'275',match:['WIS','275']},
    nd:{sport:'football/college-football',team:'87',match:['ND','87']},
    gb:{sport:'football/nfl',team:'gb',match:['GB','9']},
    buf:{sport:'football/nfl',team:'buf',match:['BUF','2']},
    ind:{sport:'football/nfl',team:'ind',match:['IND','11']},
    lfc:{sport:'soccer/eng.1',team:'364',match:['LIV','364']}
  };
  const n=s=>String(s||'').toLowerCase().replace(/#\d+/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const md=d=>{const x=new Date(d);return Number.isNaN(x.getTime())?'':x.toLocaleDateString('en-US',{month:'short',day:'numeric'}).replace(',','')};
  const clock=d=>{const x=new Date(d);return Number.isNaN(x.getTime())?'TBA':x.toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).replace(' AM',' AM CT').replace(' PM',' PM CT')};
  function isMine(c,conf){const id=String(c?.team?.id||''),ab=String(c?.team?.abbreviation||'').toUpperCase();return conf.match.some(x=>String(x).toUpperCase()===ab||String(x)===id)}
  function eventGame(e,conf){
    const comp=e?.competitions?.[0]||{},cs=comp.competitors||[],mine=cs.find(c=>isMine(c,conf));if(!mine)return null;
    const opp=cs.find(c=>c!==mine)||{},st=e?.status?.type||{},state=st.state==='in'?'live':(st.completed||st.state==='post')?'final':'scheduled';
    const our=String(mine.score??''),their=String(opp.score??''),ha=(mine.homeAway||'').toUpperCase()||'NEUTRAL';
    const ourN=Number(our),theirN=Number(their);let result='';
    if(state==='final'&&our!==''&&their!=='') result=`${ourN>theirN?'W':ourN<theirN?'L':'T'} ${our}–${their}`;
    const broadcasts=[];for(const b of comp.broadcasts||[])broadcasts.push(...(b.names||[]));
    return {id:e.id,date:md(e.date),time:clock(e.date),opp:opp?.team?.displayName||opp?.team?.shortDisplayName||'TBD',ha,tv:[...new Set(broadcasts)].join(' / '),venue:comp?.venue?.fullName||'',detail:e?.links?.[0]?.href||'',result,_score:{our,opp:their,status:state},status:state,start:e.date};
  }
  function mergeGames(t,incoming){
    for(const g of incoming){
      const found=(t.schedule||[]).find(x=>x.id&&String(x.id)===String(g.id))||(t.schedule||[]).find(x=>x.date===g.date&&(n(x.opp).includes(n(g.opp))||n(g.opp).includes(n(x.opp))));
      if(found){const keepTv=found.tv;Object.assign(found,g);if(!g.tv&&keepTv)found.tv=keepTv}else (t.schedule||=[]).push(g);
    }
  }
  async function hydrateTeam(id){
    const t=typeof teamById==='function'?teamById(id):null,conf=cfg[id];if(!t||!conf)return;
    try{const url=`https://site.api.espn.com/apis/site/v2/sports/${conf.sport}/teams/${conf.team}/schedule?season=2026`,p=await fetchJson(url,{cacheMs:2*60*1000}),games=(p.events||[]).map(e=>eventGame(e,conf)).filter(Boolean);if(games.length)mergeGames(t,games)}catch(_){ }
  }

  window.scheduleRow=(t,g)=>{
    const s=g?._score||{},live=s.status==='live'||g.status==='live',final=s.status==='final'||g.status==='final'||/^([WLT])\s/.test(g.result||'');
    const result=g.result||((live&&s.our!==undefined&&s.opp!==undefined)?`${s.our}–${s.opp}`:'');
    const score=result?`<div class="schedule-score-center ${live?'live':''}"><span class="result-main">${esc(result)}</span><span class="result-state">${live?'LIVE':final?'FINAL':''}</span></div>`:'<div class="schedule-score-center"></div>';
    const odds=typeof oddsStripForTeamGame==='function'?oddsStripForTeamGame(t,g):'';
    return `<div class="schedule-card" style="--team:${esc(t.color||'#567')}" data-game-team="${esc(t.id)}" data-game-id="${esc(g.id||`${g.date}-${g.opp}`)}">
      <div class="schedule-date">${esc(g.date||'')}<br>${esc(g.time||'TBA')}</div>
      <div class="schedule-main"><div class="schedule-opponent">${esc(gameLabel(g))}</div><div class="venue">${esc(g.venue||g.event||'')}</div></div>
      ${score}
      <div class="schedule-right"><div class="broadcast">${esc(g.tv||'')}</div><div class="chips">${gameChips(t,g)}</div></div>
      ${odds}
    </div>`;
  };

  async function hydrateAll(){
    if(!APP?.data){setTimeout(hydrateAll,700);return}
    await Promise.allSettled(Object.keys(cfg).map(hydrateTeam));
    if(document.querySelector('#schedules')?.classList.contains('active')&&typeof renderSchedules==='function')renderSchedules();
    if(typeof renderHome==='function')renderHome();
  }
  setTimeout(hydrateAll,800);setInterval(hydrateAll,5*60*1000);
})();
