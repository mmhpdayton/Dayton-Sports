/* Shared current ranking resolver for schedule/home/modal labels. */
(()=>{
  const MASCOTS='wildcats|cardinal|cardinals|panthers|fighting irish|badgers|aggies|longhorns|golden eagles|tigers|gators|boilermakers|nittany lions|sun devils|bluejays|golden gophers|jayhawks|hoosiers|horned frogs|tar heels|trojans|bears|volunteers|buffaloes|cougars|ducks|mustangs|bulldogs|hurricanes|buckeyes|rebels|sooners|wolverines|huskies|nittany lions|cougars|utes|hawkeyes|tigers';
  const clean=s=>String(s||'').toLowerCase().replace(/^#\d+\s+/,'').replace(new RegExp(`\\b(${MASCOTS})\\b`,'g'),'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const ALIASES={'brigham young':'byu','brigham young university':'byu','texas a and m':'texas a m','texas am':'texas a m','miami fla':'miami','miami florida':'miami','southern cal':'usc','southern california':'usc','mississippi':'ole miss'};
  const canonical=name=>ALIASES[clean(name)]||clean(name);

  const AVCA={
    'nebraska':1,'texas':2,'kentucky':3,'pittsburgh':4,'stanford':5,'wisconsin':6,
    'louisville':7,'texas a m':8,'purdue':9,'penn state':10,'smu':11,'arizona state':12,
    'creighton':13,'minnesota':14,'kansas':15,'indiana':16,'florida':17,'tcu':18,
    'north carolina':19,'usc':20,'baylor':21,'tennessee':22,'colorado':23,'byu':24,'oregon':25
  };
  const AP={
    'ohio state':1,'oregon':2,'georgia':3,'notre dame':4,'texas':5,'indiana':6,'miami':7,
    'texas a m':8,'ole miss':9,'oklahoma':10,'lsu':11,'texas tech':12,'alabama':13,
    'byu':14,'usc':14,'michigan':16,'washington':17,'penn state':18,'smu':19,
    'tennessee':20,'utah':21,'iowa':22,'houston':23,'louisville':24,'missouri':25
  };

  function ownerOfGame(g){return (APP?.data?.teams||[]).find(t=>(t.schedule||[]).includes(g));}
  function rankFor(teamId,name){const map=teamId==='wisc'?AVCA:teamId==='nd'?AP:null;return map?map[canonical(name)]||null:null;}
  window.rankedOpponentName=(t,g)=>{const raw=String(g?.opp||'TBD').replace(/^#\d+\s+/,'');const rank=rankFor(t?.id,raw);return `${rank?`#${rank} `:''}${raw}`;};
  window.gameLabel=function(g){const t=ownerOfGame(g),opp=t?window.rankedOpponentName(t,g):String(g?.opp||'TBD');return `${g?.ha==='AWAY'?'@ ':'vs '}${opp}`;};

  function seedSnapshots(){
    if(!APP?.data)return;
    APP.data.rankings=APP.data.rankings||{};
    if(!(APP.data.rankings.volleyball||[]).length)APP.data.rankings.volleyball=Object.entries(AVCA).map(([team,rank])=>({team,rank,poll:'AVCA'}));
    if(!(APP.data.rankings.cfb||[]).length)APP.data.rankings.cfb=Object.entries(AP).map(([team,rank])=>({team,rank,poll:'AP'}));
  }
  const originalRenderHome=window.renderHome;if(typeof originalRenderHome==='function')window.renderHome=function(){seedSnapshots();return originalRenderHome()};
  const originalRenderSchedules=window.renderSchedules;if(typeof originalRenderSchedules==='function')window.renderSchedules=function(){seedSnapshots();return originalRenderSchedules()};
  const timer=setInterval(()=>{if(APP?.data){seedSnapshots();clearInterval(timer);if(typeof renderHome==='function')renderHome();if(typeof renderSchedules==='function')renderSchedules()}},100);
  setTimeout(()=>clearInterval(timer),5000);
})();
