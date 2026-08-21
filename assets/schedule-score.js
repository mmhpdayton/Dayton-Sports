/* Schedule score layout override: keep results out of opponent/meta cluster. */
(()=>{
  function centeredScore(g){
    const s=g?._score||{};
    if(isLive(g)){
      const our=s.our??'–',opp=s.opp??'–';
      return `<div class="schedule-score-center live"><span class="result-main">${esc(our)}–${esc(opp)}</span><span class="result-state">LIVE</span></div>`;
    }
    if(isFinal(g)){
      let txt=g.result||'';
      if(!txt && s.our!==undefined && s.opp!==undefined)txt=`${s.our}–${s.opp}`;
      const cleaned=String(txt||'FINAL').replace(/^([WLT])\s+/,'$1 ');
      return `<div class="schedule-score-center"><span class="result-main">${esc(cleaned)}</span><span class="result-state">FINAL</span></div>`;
    }
    return `<div class="schedule-score-center"></div>`;
  }

  window.scheduleRow=function(t,g){
    return `<div class="schedule-card" style="--team:${esc(t.color||'#567')}" data-game-team="${esc(t.id)}" data-game-id="${esc(g.id||`${g.date}-${g.opp}`)}">
      <div class="schedule-main">
        <div class="schedule-opponent">${esc(gameLabel(g))}</div>
        <div class="venue">${esc(g.venue||g.event||'')}</div>
      </div>
      ${centeredScore(g)}
      <div class="schedule-date">${esc(g.date||'')}<br>${esc(g.time||'TBA')}</div>
      <div class="schedule-right"><div class="broadcast">${esc(g.tv||'')}</div><div class="chips">${gameChips(t,g)}</div></div>
    </div>`;
  };
})();
