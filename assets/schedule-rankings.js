/* Keep schedule rankings aligned with the shared rankings layer. */
(()=>{
  function enhance(){
    document.querySelectorAll('#scheduleView .schedule-card').forEach(card=>{
      const teamId=card.dataset.gameTeam;
      if(!['wisc','nd'].includes(teamId)) return;
      const label=card.querySelector('.schedule-opponent');
      if(!label) return;
      const raw=label.textContent.trim();
      const prefix=raw.startsWith('@')?'@ ':'vs ';
      const opponent=raw.replace(/^(vs\s+|@\s+)/i,'').replace(/^#\d+\s+/,'').trim();
      const team=typeof teamById==='function'?teamById(teamId):null;
      if(!team||typeof window.rankedOpponentName!=='function') return;
      const ranked=window.rankedOpponentName(team,{opp:opponent});
      const m=String(ranked).match(/^#(\d+)\s+(.+)$/);
      if(m){
        label.innerHTML=`${prefix}<span class="schedule-rank">#${m[1]}</span>${m[2]}`;
      }else{
        label.textContent=`${prefix}${ranked}`;
      }
      label.dataset.ranked='1';
    });
  }

  const target=document.querySelector('#scheduleView');
  if(target)new MutationObserver(()=>requestAnimationFrame(enhance)).observe(target,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(enhance,250));
})();
