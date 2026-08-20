/* Prefer DraftKings odds embedded in ESPN event payloads. */
(()=>{
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
    return {provider:providerName(o)||'DraftKings',spread:num(spread),total:num(total),homeMl:num(homeMl),awayMl:num(awayMl),homeSp:num(homeSp),awaySp:num(awaySp)};
  }
  function stripFromEmbedded(g){
    const o=g?._dkOdds;if(!o)return'';
    const ml=(o.awayMl||o.homeMl)?`${esc(g.away)} ${esc(o.awayMl||'—')} · ${esc(g.home)} ${esc(o.homeMl||'—')}`:'—';
    const sp=o.spread?esc(o.spread):'—';
    const tot=o.total?esc(o.total):'—';
    return `<div class="dk-strip"><span class="dk-brand">DraftKings</span><span class="dk-market"><b>Spread</b> ${sp}</span><span class="dk-market"><b>ML</b> ${ml}</span><span class="dk-market"><b>O/U</b> ${tot}</span></div>`;
  }
  const baseLeague=window.compToLeagueGame;
  if(typeof baseLeague==='function')window.compToLeagueGame=function(event){
    const g=baseLeague(event),comp=(event?.competitions||[])[0]||{};if(g)g._dkOdds=extract(comp);return g;
  };
  const baseTeam=window.eventToTeamGame;
  if(typeof baseTeam==='function')window.eventToTeamGame=function(event,id){
    const g=baseTeam(event,id),comp=(event?.competitions||[])[0]||{};if(g)g._dkOdds=extract(comp);return g;
  };
  window.espnDkOddsStrip=stripFromEmbedded;
})();
