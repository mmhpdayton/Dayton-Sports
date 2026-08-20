/* Dayton Sports Home v3 — replaces the old hero+rest renderer entirely. */
(()=>{
  function familyLabel(t){
    if(t?.id==='payton') return 'Hadley · Setter';
    if(t?.id==='amundsen') return 'Patrick · WR/DB · #7';
    if(t?.id==='amundsenvarsity') return 'Patrick dresses varsity';
    return '';
  }
  function homeCardV3(t,g){
    const family=familyLabel(t);
    const detail=g?.detail?`<a class="card-btn" href="${esc(g.detail)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Game page</a>`:'';
    const record=t?.record?esc(t.record):'';
    const context=t?.context?esc(t.context):'';
    const meta=[context,record].filter(Boolean).join(' · ');
    const familyHtml=family?`<div class="personal-game-label">${esc(family)}</div>`:'';
    return `<article class="home-game-v3${family?' family':''}${t?.muted?' muted':''}" style="--team:${esc(t?.color||'#567')}" data-game-team="${esc(t.id)}" data-game-id="${esc(g.id||`${g.date}-${g.opp}`)}">
      <div class="v3-top">${logoHtml(t)}<div class="v3-team-block"><div class="v3-team">${esc(t.name)}</div>${meta?`<div class="v3-meta">${meta}</div>`:''}</div></div>
      ${familyHtml}
      <div class="v3-match">${esc(gameLabel(g))}</div>
      <div class="v3-when">${esc(g.date||'')} · ${esc(g.time||'TBA')}</div>
      <div class="v3-venue">${esc(g.venue||'')}</div>
      ${scoreHtml(g)}
      <div class="chips">${gameChips(t,g)}</div>
      <div class="v3-actions"><button class="card-btn goto-schedule" data-team="${esc(t.id)}">Full schedule</button>${detail}</div>
    </article>`;
  }
  renderHome=function(){
    if(!APP.data)return;
    const rows=(APP.data.teams||[])
      .filter(t=>!t.excludeUpcoming)
      .map(t=>({t,g:nextEligibleGame(t)}))
      .filter(x=>x.g)
      .sort((a,b)=>{
        const al=isLive(a.g),bl=isLive(b.g);if(al!==bl)return al?-1:1;
        const ad=gameDate(a.g)?.getTime()||Infinity,bd=gameDate(b.g)?.getTime()||Infinity;
        if(ad!==bd)return ad-bd;
        return (a.t.homePriority||99)-(b.t.homePriority||99);
      });
    const box=document.querySelector('#homeUpcoming');
    box.className='home-upcoming-v3';
    box.innerHTML=rows.length?rows.map(({t,g})=>homeCardV3(t,g)).join(''):'<div class="placeholder">No upcoming games found.</div>';
    document.querySelector('#teamUtility').innerHTML=(APP.data.teams||[]).map(t=>`<button class="team-utility goto-schedule" data-team="${esc(t.id)}">${logoHtml(t,true)}<span>${esc(t.name)}</span></button>`).join('');
    renderLiveToday();
    renderRankingsSnapshot();
    bindDynamicClicks();
  };
  if(APP?.data)renderHome();
})();
