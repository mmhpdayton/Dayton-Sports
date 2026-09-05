/* Prefer DraftKings odds embedded in ESPN event payloads and preserve the last
   pregame quote as the closing line after markets disappear at kickoff. */
(()=>{
  const STORE_KEY='daytonSports.dkClosing.v1';
  const mem=new Map();
  function num(v){return v===undefined||v===null||v===''?'':String(v).replace(/−|–/g,'-')}
  function providerName(o){return String(o?.provider?.name||o?.provider?.displayName||o?.provider?.id||'')}
  function extract(comp){
    const list=Array.isArray(comp?.odds)?comp.odds:[];
    if(!list.length)return null;
    const o=list.find(x=>/draft\s*kings?/i.test(providerName(x)))||list[0];
    if(!o)return null;
    const home=o.homeTeamOdds||{},away=o.awayTeamOdds||{};
    const spread=o.details||o.spread||'';
    const total=o.overUnder??o.total??'';
    const homeMl=home.moneyLine??home.moneyline??'', awayMl=away.moneyLine??away.moneyline??'';
    const homeSp=home.spreadOdds??home.spreadPrice??'', awaySp=away.spreadOdds??away.spreadPrice??'';
    const rec={provider:providerName(o)||'DraftKings',spread:num(spread),total:num(total),homeMl:num(homeMl),awayMl:num(awayMl),homeSp:num(homeSp),awaySp:num(awaySp)};
    return rec.spread||rec.total||rec.homeMl||rec.awayMl?rec:null;
  }
  function readStore(){
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}}catch(_){return{}}
  }
  function writeStore(obj){try{localStorage.setItem(STORE_KEY,JSON.stringify(obj))}catch(_){}}
  function gameKey(g){
    if(g?.id)return String(g.id);
    return [g?.start||g?.date||'',g?.away||'',g?.home||'',g?.opp||''].join('|').toLowerCase();
  }
  function remember(g,o){
    if(!g||!o)return o;
    const key=gameKey(g);if(!key)return o;
    const rec={...o,savedAt:new Date().toISOString()};
    mem.set(key,rec);
    const store=readStore();store[key]=rec;
    const keys=Object.keys(store);
    if(keys.length>250)keys.sort((a,b)=>String(store[a]?.savedAt||'').localeCompare(String(store[b]?.savedAt||''))).slice(0,keys.length-250).forEach(k=>delete store[k]);
    writeStore(store);
    return o;
  }
  function recalled(g){
    const key=gameKey(g);if(!key)return null;
    if(mem.has(key))return mem.get(key);
    const rec=readStore()[key]||null;if(rec)mem.set(key,rec);return rec;
  }
  function hydrateOdds(g,comp){
    if(!g)return g;
    const live=extract(comp);
    if(live){g._dkOdds=remember(g,live);g._dkClosing=false;}
    else {const old=recalled(g);if(old){g._dkOdds=old;g._dkClosing=true;}}
    return g;
  }
  function stripFromEmbedded(g){
    const o=g?._dkOdds;if(!o)return'';
    const away=g.away||'',home=g.home||'';
    const ml=(o.awayMl||o.homeMl)?`${esc(away)} ${esc(o.awayMl||'—')} · ${esc(home)} ${esc(o.homeMl||'—')}`:'—';
    const sp=o.spread?esc(o.spread):'—';
    const tot=o.total?esc(o.total):'—';
    const label=g?._dkClosing?'Closing line':'DraftKings';
    return `<div class="dk-strip"><span class="dk-brand">${label}</span><span class="dk-market"><b>Spread</b> ${sp}</span><span class="dk-market"><b>ML</b> ${ml}</span><span class="dk-market"><b>O/U</b> ${tot}</span></div>`;
  }
  const baseLeague=window.compToLeagueGame;
  if(typeof baseLeague==='function')window.compToLeagueGame=function(event){
    const g=baseLeague(event),comp=(event?.competitions||[])[0]||{};return hydrateOdds(g,comp);
  };
  const baseTeam=window.eventToTeamGame;
  if(typeof baseTeam==='function')window.eventToTeamGame=function(event,id){
    const g=baseTeam(event,id),comp=(event?.competitions||[])[0]||{};return hydrateOdds(g,comp);
  };
  window.extractEspnDkOdds=extract;
  window.attachEspnDkOdds=hydrateOdds;
  window.espnDkOddsStrip=stripFromEmbedded;
})();
