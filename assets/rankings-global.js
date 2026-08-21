/* Apply current poll rankings consistently across Home, schedule hero/rows and game modal. */
(()=>{
  const MASCOTS='wildcats|cardinal|cardinals|panthers|fighting irish|badgers|aggies|longhorns|golden eagles|tigers|gators|boilermakers|nittany lions|sun devils|bluejays|golden gophers|jayhawks|hoosiers|horned frogs|tar heels|trojans|bears|volunteers|buffaloes|cougars|ducks|mustangs|bulldogs|hurricanes|buckeyes|rebels|sooners';
  const clean=s=>String(s||'').toLowerCase().replace(/^#\d+\s+/,'').replace(new RegExp(`\\b(${MASCOTS})\\b`,'g'),'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

  const AVCA={
    'nebraska':1,'texas':2,'kentucky':3,'pittsburgh':4,'stanford':5,'wisconsin':6,
    'louisville':7,'texas a m':8,'purdue':9,'penn state':10,'smu':11,'arizona state':12,
    'creighton':13,'minnesota':14,'kansas':15,'indiana':16,'florida':17,'tcu':18,
    'north carolina':19,'southern california':20,'usc':20,'baylor':21,'tennessee':22,
    'colorado':23,'byu':24,'oregon':25,'marquette':25
  };
  const AP={'ohio state':1,'oregon':2,'georgia':3,'notre dame':4,'texas':5,'indiana':6,'miami':7,'texas a m':8,'mississippi':9,'ole miss':9,'oklahoma':10};

  const ALIASES={
    'brigham young':'byu',
    'brigham young university':'byu',
    'texas a and m':'texas a m',
    'texas am':'texas a m',
    'southern cal':'southern california'
  };
  function canonical(name){const n=clean(name);return ALIASES[n]||n;}
  function ownerOfGame(g){return (APP?.data?.teams||[]).find(t=>(t.schedule||[]).includes(g));}
  function exactRank(list,name,pollRe){
    const target=canonical(name);
    const matches=(list||[]).filter(r=>canonical(r.team||r.name||'')===target);
    const preferred=matches.find(r=>pollRe.test(r.poll||''))||matches[0];
    const n=Number(String(preferred?.rank||'').replace(/\D/g,''));
    return n>0&&n<=25?n:null;
  }
  function dynamicRank(teamId,name){
    if(teamId==='wisc')return exactRank(APP?.data?.rankings?.volleyball,name,/avca/i);
    if(teamId==='nd')return exactRank(APP?.data?.rankings?.cfb,name,/associated press|\bap\b/i);
    return null;
  }
  function rankFor(teamId,name){
    const n=canonical(name);
    const map=teamId==='wisc'?AVCA:teamId==='nd'?AP:null;
    if(!map)return null;
    const dynamic=dynamicRank(teamId,name);
    if(dynamic)return dynamic;
    return map[n]||null;
  }
  window.rankedOpponentName=(t,g)=>{
    const raw=String(g?.opp||'TBD').replace(/^#\d+\s+/,'');
    const rank=rankFor(t?.id,raw);
    return `${rank?`#${rank} `:''}${raw}`;
  };
  window.gameLabel=function(g){
    const t=ownerOfGame(g),opp=t?window.rankedOpponentName(t,g):String(g?.opp||'TBD');
    return `${g?.ha==='AWAY'?'@ ':'vs '}${opp}`;
  };
  function seedSnapshots(){
    if(!APP?.data)return;
    APP.data.rankings=APP.data.rankings||{};
    if(!(APP.data.rankings.volleyball||[]).length)APP.data.rankings.volleyball=Object.entries(AVCA).filter(([n])=>n!=='usc').map(([team,rank])=>({team:team.replace(/\b\w/g,c=>c.toUpperCase()),rank,poll:'AVCA'}));
    if(!(APP.data.rankings.cfb||[]).length)APP.data.rankings.cfb=Object.entries(AP).filter(([n])=>n!=='ole miss').map(([team,rank])=>({team:team.replace(/\b\w/g,c=>c.toUpperCase()),rank,poll:'AP'}));
  }
  const originalRenderHome=window.renderHome;if(typeof originalRenderHome==='function')window.renderHome=function(){seedSnapshots();return originalRenderHome()};
  const originalRenderSchedules=window.renderSchedules;if(typeof originalRenderSchedules==='function')window.renderSchedules=function(){seedSnapshots();return originalRenderSchedules()};
  const timer=setInterval(()=>{if(APP?.data){seedSnapshots();clearInterval(timer);if(typeof renderHome==='function')renderHome();if(typeof renderSchedules==='function')renderSchedules()}},100);
  setTimeout(()=>clearInterval(timer),5000);
})();
