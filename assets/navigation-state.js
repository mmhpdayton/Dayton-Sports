/* Persist the current Dayton Sports view/team in the URL so browser refresh returns to the same place. */
(()=>{
  const validViews=new Set(['home','schedules','cfb','premier','champions','nfl','volleyball','standings']);
  const read=()=>{
    const p=new URLSearchParams(location.search),hash=location.hash.replace(/^#/,'');
    return {view:validViews.has(p.get('view'))?p.get('view'):(validViews.has(hash)?hash:null),team:p.get('team')||null};
  };
  const write=(view,team)=>{
    const u=new URL(location.href);u.hash='';
    if(view&&view!=='home')u.searchParams.set('view',view);else u.searchParams.delete('view');
    if(view==='schedules'&&team)u.searchParams.set('team',team);else u.searchParams.delete('team');
    history.replaceState(null,'',u.pathname+(u.search?u.search:'')+(u.hash||''));
  };
  const activate=view=>{
    if(!validViews.has(view))return;
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===view));
    document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  };
  function restore(){
    const s=read();if(!s.view)return;
    if(s.team&&window.APP)APP.teamId=s.team;
    const btn=document.querySelector(`.nav-btn[data-view="${s.view}"]`);
    if(btn)btn.click();else activate(s.view);
    if(s.view==='schedules'&&s.team&&window.APP){APP.teamId=s.team;try{renderSchedules()}catch(_){}}
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest('.nav-btn[data-view]');
    if(nav)setTimeout(()=>write(nav.dataset.view,window.APP?.teamId),0);
    const team=e.target.closest('[data-team]');
    if(team&&team.dataset.team)setTimeout(()=>{
      const active=document.querySelector('.nav-btn.active')?.dataset.view||'home';
      if(active==='schedules')write('schedules',team.dataset.team);
    },0);
  },true);
  window.addEventListener('DOMContentLoaded',()=>setTimeout(restore,120));
  window.addEventListener('pageshow',()=>setTimeout(()=>{const s=read();if(s.view)activate(s.view)},50));
})();
