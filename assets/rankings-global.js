/* Apply current poll rankings consistently across Home, schedule hero/rows and game modal. */
(()=>{
  const clean=s=>String(s||'').toLowerCase().replace(/^#\d+\s+/,'').replace(/\b(wildcats|cardinal|cardinals|panthers|fighting irish|badgers)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  /* Official 2026 preseason AVCA Division I poll (Aug. 10). Used as a
     resilient fallback until the rankings updater populates sports-data.json. */
  const AVCA={
    'nebraska':1,'texas':2,'kentucky':3,'pittsburgh':4,'stanford':5,'wisconsin':6,
    'louisville':7,'texas a m':8,'purdue':9,'penn state':10,'smu':11,'arizona state':12,
    'creighton':13,'minnesota':14,'kansas':15,'indiana':16,'florida':17,'tcu':18,
    'north carolina':19,'southern california':20,'usc':20,'baylor':21,'tennessee':22,
    'colorado':23,'byu':24,'oregon':25
  };

  /* 2026 AP preseason CFB top 10; dynamic rankings data wins when populated. */
  const AP={'ohio state':1,'oregon':2,'georgia':3,'notre dame':4,'texas':5,'indiana':6,'miami':7,'texas a m':8,'mississippi':9,'ole miss':9,'oklahoma':10};

  function ownerOfGame(g){
    return (APP?.data?.teams||[]).find(t=>(t.schedule||[]).includes(g));
  }

  function dynamicRank(teamId,name){
    const list=teamId==='wisc'?(APP?.data?.rankings?.volleyball||[]):teamId==='nd'?(APP?.data?.rankings?.cfb||[]):[];
    const target=clean(name);
    const matches=list.filter(r=>{const n=clean(r.team||r.name||'');return n===target||n.includes(target)||target.includes(n)});
    if(!matches.length)return null;
    const preferred=teamId==='wisc'?(matches.find(r=>/avca/i.test(r.poll||''))||matches[0]):(matches.find(r=>/associated press|\bap\b/i.test(r.poll||''))||matches[0]);
    const n=Number(String(preferred?.rank||'').replace(/\D/g,''));
    return n>0&&n<=25?n:null;
  }

  function rankFor(teamId,name){
    const dynamic=dynamicRank(teamId,name);if(dynamic)return dynamic;
    const n=clean(name);
    const map=teamId==='wisc'?AVCA:teamId==='nd'?AP:null;
    if(!map)return null;
    if(map[n])return map[n];
    const key=Object.keys(map).find(k=>n===k||n.includes(k)||k.includes(n));
    return key?map[key]:null;
  }

  window.rankedOpponentName=(t,g)=>{
    const raw=String(g?.opp||'TBD').replace(/^#\d+\s+/,'');
    const rank=rankFor(t?.id,raw);
    return `${rank?`#${rank} `:''}${raw}`;
  };

  window.gameLabel=function(g){
    const t=ownerOfGame(g);
    const opp=t?window.rankedOpponentName(t,g):String(g?.opp||'TBD');
    const p=g?.ha==='AWAY'?'@ ':'vs ';
    return `${p}${opp}`;
  };

  /* Seed the rankings snapshot when the normalized data has not yet been
     refreshed, so Wisconsin/ND rank cards do not render as em dashes. */
  function seedSnapshots(){
    if(!APP?.data)return;
    APP.data.rankings=APP.data.rankings||{};
    if(!(APP.data.rankings.volleyball||[]).length){
      APP.data.rankings.volleyball=Object.entries(AVCA).filter(([n])=>n!=='usc').map(([team,rank])=>({team:team.replace(/\b\w/g,c=>c.toUpperCase()),rank,poll:'AVCA'}));
    }
    if(!(APP.data.rankings.cfb||[]).length){
      APP.data.rankings.cfb=Object.entries(AP).filter(([n])=>!['ole miss'].includes(n)).map(([team,rank])=>({team:team.replace(/\b\w/g,c=>c.toUpperCase()),rank,poll:'AP'}));
    }
  }

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==='function')window.renderHome=function(){seedSnapshots();return originalRenderHome()};
  const originalRenderSchedules=window.renderSchedules;
  if(typeof originalRenderSchedules==='function')window.renderSchedules=function(){seedSnapshots();return originalRenderSchedules()};

  /* APP.data usually arrives asynchronously from bootstrap.js. */
  const timer=setInterval(()=>{
    if(APP?.data){seedSnapshots();clearInterval(timer);if(typeof renderHome==='function')renderHome();if(typeof renderSchedules==='function')renderSchedules()}
  },100);
  setTimeout(()=>clearInterval(timer),5000);
})();
