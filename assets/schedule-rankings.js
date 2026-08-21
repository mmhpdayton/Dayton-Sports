/* Restore current poll rankings to schedule opponent labels after live hydration. */
(()=>{
  const normName=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function rankingListForTeam(teamId){
    if(teamId==='wisc') return APP?.data?.rankings?.volleyball||[];
    if(teamId==='nd') return APP?.data?.rankings?.cfb||[];
    return [];
  }

  function preferredRank(teamId, opponent){
    const list=rankingListForTeam(teamId);
    const target=normName(opponent);
    if(!target||!list.length) return null;
    const matches=list.filter(r=>{
      const n=normName(r.team||r.name||'');
      return n===target || n.includes(target) || target.includes(n);
    });
    if(!matches.length) return null;
    if(teamId==='nd'){
      return matches.find(r=>/associated press|\bap\b/i.test(r.poll||'')) || matches[0];
    }
    return matches.find(r=>/avca/i.test(r.poll||'')) || matches[0];
  }

  function enhance(){
    document.querySelectorAll('#scheduleView .schedule-card').forEach(card=>{
      const teamId=card.dataset.gameTeam;
      if(!['wisc','nd'].includes(teamId)) return;
      const label=card.querySelector('.schedule-opponent');
      if(!label||label.dataset.ranked==='1') return;
      const raw=label.textContent.trim();
      const opponent=raw.replace(/^(vs\s+|@\s+)/i,'').replace(/^#\d+\s+/,'').trim();
      const rank=preferredRank(teamId,opponent);
      if(!rank?.rank) return;
      const prefix=raw.startsWith('@')?'@ ':'vs ';
      label.innerHTML=`${prefix}<span class="schedule-rank">#${String(rank.rank).replace(/[^0-9]/g,'')}</span>${opponent}`;
      label.dataset.ranked='1';
    });
  }

  const target=document.querySelector('#scheduleView');
  if(target){
    new MutationObserver(()=>requestAnimationFrame(enhance)).observe(target,{childList:true,subtree:true});
  }
  window.addEventListener('load',()=>setTimeout(enhance,250));
})();
