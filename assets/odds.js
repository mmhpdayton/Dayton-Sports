/* DraftKings odds presentation layer. The server-side updater discovers/fetches
   DraftKings leagues; this browser layer only matches and renders that snapshot. */
(()=>{
  const DK={updatedAt:null,games:[],errors:{},status:'loading'};
  const clean=s=>String(s??'').replace(/−|–/g,'-').trim();
  const norm=s=>String(s||'').toLowerCase().replace(/#\d+/g,'').replace(/\bst\.?\b/g,'state').replace(/[^a-z0-9]+/g,' ').trim();
  const short=n=>{const p=String(n||'').split(' ');return p[p.length-1]||n};
  const price=v=>v===undefined||v===null||v===''?'—':clean(v);

  function loadSnapshot(snapshot){
    if(!snapshot||!Array.isArray(snapshot.games))return false;
    DK.updatedAt=snapshot.updatedAt||null;
    DK.games=snapshot.games;
    DK.errors=snapshot.errors||{};
    DK.status=snapshot.status||'ok';
    return true;
  }

  function teamMatch(name,team){
    const d=norm(name),full=norm(team?.team?.displayName||team?.displayName||team?.name||team||''),ab=norm(team?.team?.abbreviation||team?.abbreviation||'');
    if(!d||!full)return false;
    if(d.includes(full)||full.includes(d))return true;
    if(ab&&new RegExp(`(^| )${ab}( |$)`).test(d))return true;
    const dl=d.split(' ').pop(),fl=full.split(' ').pop();
    return dl&&fl&&dl.length>=4&&dl===fl;
  }

  function findLeague(sport,home,away){
    return DK.games.find(x=>x.sport===sport&&teamMatch(x.home,home)&&teamMatch(x.away,away))||
           DK.games.find(x=>x.sport===sport&&teamMatch(x.home,away)&&teamMatch(x.away,home))||null;
  }
  function sportForTeam(t){if(t?.id==='cubs')return'mlb';if(['gb','buf','ind'].includes(t?.id))return'nfl';if(t?.id==='nd')return'cfb';if(t?.id==='lfc')return'epl';if(t?.id==='wisc')return'cvb';return''}
  function syntheticTeams(t,g){const ours={team:{displayName:t?.name||'',abbreviation:t?.abbr||''}},opp={team:{displayName:g?.opp||'',abbreviation:''}};return g?.ha==='AWAY'?{home:opp,away:ours}:{home:ours,away:opp}}
  function findTeam(t,g){const sport=sportForTeam(t);if(!sport)return null;const tm=g?._eventTeams||syntheticTeams(t,g);return findLeague(sport,tm.home,tm.away)}

  function summary(o){
    if(!o)return null;
    const teams=[o.away,o.home];
    const ml=teams.filter(n=>o.moneyline?.[n]).map(n=>`${short(n)} ${price(o.moneyline[n])}`).join(' · ');
    const sp=teams.filter(n=>o.spread?.[n]).map(n=>`${short(n)} ${price(o.spread[n].line)} (${price(o.spread[n].odds)})`).join(' · ');
    const tot=o.total?.line?`${price(o.total.line)}${o.total.overOdds||o.total.underOdds?` (O ${price(o.total.overOdds)} / U ${price(o.total.underOdds)})`:''}`:'';
    return{ml,sp,tot};
  }
  function age(){if(!DK.updatedAt)return'';const m=Math.max(0,Math.round((Date.now()-new Date(DK.updatedAt).getTime())/60000));return m<1?'just now':`${m}m ago`}
  function renderStrip(odds,sport){
    if(DK.status==='loading')return`<div class="dk-strip"><span class="dk-brand">DraftKings</span><span class="dk-muted">Loading lines…</span></div>`;
    if(!odds){const err=DK.errors?.[sport];return`<div class="dk-strip"><span class="dk-brand">DraftKings</span><span class="dk-muted">${err?'Feed unavailable':'Lines not posted'}</span>${age()?`<span class="dk-age">${esc(age())}</span>`:''}</div>`}
    const s=summary(odds);return`<div class="dk-strip"><span class="dk-brand">DraftKings</span><span class="dk-market"><b>Spread</b> ${esc(s.sp||'—')}</span><span class="dk-market"><b>ML</b> ${esc(s.ml||'—')}</span><span class="dk-market"><b>O/U</b> ${esc(s.tot||'—')}</span>${age()?`<span class="dk-age">${esc(age())}</span>`:''}</div>`;
  }

  window.oddsStripForTeamGame=(t,g)=>{const sport=sportForTeam(t);return sport?renderStrip(findTeam(t,g),sport):''};
  window.oddsStripForLeagueGame=(sport,home,away)=>renderStrip(findLeague(sport,home,away),sport);
  window.DK_ODDS=DK;

  const baseScheduleRow=window.scheduleRow;
  if(typeof baseScheduleRow==='function')window.scheduleRow=(t,g)=>{
    const html=baseScheduleRow(t,g),odds=window.oddsStripForTeamGame(t,g);
    return odds?html.replace(/<\/div>$/i,`${odds}</div>`):html;
  };

  function rerender(){
    try{renderHome();if(document.querySelector('#schedules')?.classList.contains('active'))renderSchedules();if(document.querySelector('#cfb')?.classList.contains('active')&&typeof window.refreshCfbOdds==='function')window.refreshCfbOdds()}catch(_){ }
  }
  function bootstrap(){
    if(APP?.data?.draftkingsOdds){loadSnapshot(APP.data.draftkingsOdds);rerender();return}
    if(!APP?.data){setTimeout(bootstrap,300);return}
    DK.status='unavailable';rerender();
  }
  async function pollSnapshot(){
    try{
      const r=await fetch(`data/sports-data.json?odds=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;
      const d=await r.json();if(d?.draftkingsOdds?.updatedAt!==DK.updatedAt&&loadSnapshot(d.draftkingsOdds))rerender();
    }catch(_){ }
  }
  bootstrap();
  setInterval(pollSnapshot,60*1000);
})();
