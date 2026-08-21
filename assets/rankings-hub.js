(()=>{
  const AP=[
    [1,'Ohio State'],[2,'Oregon'],[3,'Georgia'],[4,'Notre Dame'],[5,'Texas'],[6,'Indiana'],[7,'Miami (Fla.)'],[8,'Texas A&M'],[9,'Ole Miss'],[10,'Oklahoma'],[11,'LSU'],[12,'Texas Tech'],[13,'Alabama'],[14,'BYU'],[14,'USC'],[16,'Michigan'],[17,'Washington'],[18,'Penn State'],[19,'SMU'],[20,'Tennessee'],[21,'Utah'],[22,'Iowa'],[23,'Houston'],[24,'Louisville'],[25,'Missouri']
  ];
  const COACHES=[
    [1,'Ohio State'],[2,'Oregon'],[3,'Georgia'],[4,'Texas'],[5,'Notre Dame'],[6,'Indiana'],[7,'Miami (Fla.)'],[8,'Texas A&M'],[9,'Oklahoma'],[10,'Ole Miss'],[11,'Alabama'],[12,'Texas Tech'],[13,'LSU'],[14,'USC'],[15,'BYU'],[16,'Michigan'],[17,'Penn State'],[18,'Tennessee'],[19,'Washington'],[20,'SMU'],[21,'Utah'],[22,'Iowa'],[23,'Clemson'],[24,'Houston'],[25,'Missouri']
  ];
  const AVCA=[
    [1,'Nebraska'],[2,'Texas'],[3,'Kentucky'],[4,'Pittsburgh'],[5,'Stanford'],[6,'Wisconsin'],[7,'Louisville'],[8,'Texas A&M'],[9,'Purdue'],[10,'Penn State'],[11,'SMU'],[12,'Arizona State'],[13,'Creighton'],[14,'Minnesota'],[15,'Kansas'],[16,'Indiana'],[17,'Florida'],[18,'TCU'],[19,'North Carolina'],[20,'Southern California'],[21,'Baylor'],[22,'Tennessee'],[23,'Colorado'],[24,'BYU'],[25,'Oregon']
  ];
  function table(rows,focus=''){
    return `<table class="ranking-table"><thead><tr><th>#</th><th>Team</th></tr></thead><tbody>${rows.map(([rank,team])=>`<tr class="${team.toLowerCase().includes(focus.toLowerCase())?'focus':''}"><td>${rank}</td><td class="ranking-team">${team}</td></tr>`).join('')}</tbody></table>`;
  }
  function render(){
    const cfb=document.querySelector('#cfbRankingsHub');
    if(cfb)cfb.innerHTML=`<div class="ranking-columns"><section class="ranking-card"><div class="ranking-card-head"><div><div class="kicker">COLLEGE FOOTBALL</div><h3>AP Top 25</h3></div><span class="note">Aug. 17, 2026</span></div>${table(AP,'Notre Dame')}<div class="poll-note">Notre Dame highlighted.</div></section><section class="ranking-card"><div class="ranking-card-head"><div><div class="kicker">COLLEGE FOOTBALL</div><h3>Coaches Poll</h3></div><span class="note">Aug. 4, 2026</span></div>${table(COACHES,'Notre Dame')}<div class="poll-note">Notre Dame highlighted.</div></section></div>`;
    const vb=document.querySelector('#vbRankingsHub');
    if(vb)vb.innerHTML=`<section class="ranking-card"><div class="ranking-card-head"><div><div class="kicker">NCAA WOMEN</div><h3>AVCA Top 25</h3></div><span class="note">Preseason · Aug. 10, 2026</span></div>${table(AVCA,'Wisconsin')}<div class="poll-note">Wisconsin highlighted.</div></section>`;
  }
  function showPane(name){
    document.querySelectorAll('.hub-tab').forEach(b=>b.classList.toggle('active',b.dataset.hub===name));
    document.querySelectorAll('.hub-pane').forEach(p=>p.classList.toggle('active',p.dataset.hubPane===name));
  }
  window.addEventListener('load',()=>{
    render();
    document.querySelectorAll('.hub-tab').forEach(b=>b.addEventListener('click',()=>showPane(b.dataset.hub)));
    showPane('standings');
  });
})();
