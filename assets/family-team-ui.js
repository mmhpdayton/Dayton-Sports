/* Family-team UI guard: permanent family teams must always have their own Schedules selector and My Teams entry. */
(()=>{
  const FAMILY_ORDER=['payton','paytonvarsity','amundsen','amundsenvarsity'];

  function orderedTeams(){
    const teams=[...(APP?.data?.teams||[])];
    return teams.sort((a,b)=>{
      const ai=FAMILY_ORDER.indexOf(a.id),bi=FAMILY_ORDER.indexOf(b.id);
      const ap=ai<0?999:ai,bp=bi<0?999:bi;
      if(ap!==bp)return ap-bp;
      return 0;
    });
  }

  function selectorLabel(t){
    if(t?.id==='payton')return 'Payton JV Volleyball';
    if(t?.id==='paytonvarsity')return 'Payton Varsity Volleyball';
    return t?.name||'';
  }

  function renderFamilyAwareSelector(){
    if(!APP?.data)return;
    const teams=orderedTeams();
    if(!teamById(APP.teamId))APP.teamId=teams[0]?.id;
    const box=document.querySelector('#teamSelector');
    if(!box)return;
    box.innerHTML=teams.map(t=>`<button class="team-chip ${t.id===APP.teamId?'active':''}" data-team="${esc(t.id)}">${logoHtml(t,true)}${esc(selectorLabel(t))}</button>`).join('');
    [...box.querySelectorAll('.team-chip')].forEach(b=>b.onclick=()=>{APP.teamId=b.dataset.team;renderSchedules()});
  }

  const baseRenderSchedules=window.renderSchedules;
  window.renderTeamSelector=renderFamilyAwareSelector;
  if(typeof baseRenderSchedules==='function'){
    window.renderSchedules=function(){
      const out=baseRenderSchedules.apply(this,arguments);
      renderFamilyAwareSelector();
      return out;
    };
  }

  function ensureMyTeams(){
    if(!APP?.data)return;
    const box=document.querySelector('#teamUtility');
    if(!box)return;
    const teams=orderedTeams();
    box.innerHTML=teams.map(t=>`<button class="team-utility goto-schedule" data-team="${esc(t.id)}">${logoHtml(t,true)}<span>${esc(selectorLabel(t))}</span></button>`).join('');
    if(typeof bindDynamicClicks==='function')bindDynamicClicks();
  }

  const baseRenderHome=window.renderHome;
  if(typeof baseRenderHome==='function'){
    window.renderHome=function(){
      const out=baseRenderHome.apply(this,arguments);
      ensureMyTeams();
      return out;
    };
  }

  function run(){
    if(!APP?.data){setTimeout(run,250);return;}
    renderFamilyAwareSelector();
    ensureMyTeams();
  }
  setTimeout(run,100);
})();
