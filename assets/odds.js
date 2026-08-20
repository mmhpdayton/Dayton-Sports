/* DraftKings odds layer — isolated from core schedules/scores. */
(()=>{
  const DK={updatedAt:null,games:[],errors:{},loading:false};
  const GROUPS={mlb:'84240',nfl:'88808',cfb:'87637'};
  const URLS=g=>[
    `https://sportsbook.draftkings.com/sites/US-IL-SB/api/v1/eventgroup/${g}/full?format=json`,
    `https://sportsbook.draftkings.com/sites/US-NJ-SB/api/v1/eventgroup/${g}/full?format=json`,
    `https://sportsbook.draftkings.com/sites/US-SB/api/v1/eventgroup/${g}/full?format=json`
  ];
  const clean=s=>String(s??'').replace(/−|–/g,'-').trim();
  const norm=s=>String(s||'').toLowerCase().replace(/#\d+/g,'').replace(/\bst\.?\b/g,'state').replace(/[^a-z0-9]+/g,' ').trim();
  function teamName(o){return clean(o?.participant||o?.label||o?.name||o?.participantName||o?.displayName)}
  function oddsVal(o){for(const k of ['oddsAmerican','americanOdds','odds','price'])if(o?.[k]!=null){const v=typeof o[k]==='object'?(o[k].american||o[k].americanOdds||o[k].display):o[k];if(v!=null){const s=clean(v);return /^(ev|even|even money)$/i.test(s)?'+100':s}}return ''}
  function lineVal(o){for(const k of ['line','points','handicap'])if(o?.[k]!=null)return clean(o[k]);return ''}
  function eventTeams(e){let away=e?.teamName1||e?.awayTeamName||'',home=e?.teamName2||e?.homeTeamName||'';for(const p of e?.participants||[]){const role=String(p?.venueRole||p?.homeAway||p?.role||'').toLowerCase(),name=p?.name||p?.displayName||p?.teamName||'';if(['away','visitor'].includes(role))away=name;else if(role==='home')home=name}if((!away||!home)&&e?.name){const b=String(e.name).split(/\s+@\s+|\s+vs\.?\s+/i);if(b.length===2){away=away||b[0];home=home||b[1]}}return{away:clean(away),home:clean(home)}}
  function marketType(cat,sub,o){const t=[cat,sub,o?.label,o?.name,o?.marketName].join(' ').toLowerCase();if(/money\s*line/.test(t))return'moneyline';if(/run line|spread|handicap/.test(t))return'spread';if(/total|over\/under|over under/.test(t))return'total';return''}
  function offers(eg){const out=[];for(const cat of eg?.offerCategories||[])for(const desc of cat?.offerSubcategoryDescriptors||[]){const sub=desc?.offerSubcategory||{};for(const group of sub?.offers||[]){const seq=Array.isArray(group)?group:[group];for(const o of seq)if(o&&typeof o==='object')out.push([cat?.name||'',desc?.name||'',o])}}return out}
  function parse(payload,sport){const eg=payload?.eventGroup||payload||{},games=new Map(),events=eg?.events||payload?.events||[];for(const e of events){const id=String(e?.eventId||e?.id||'');if(!id)continue;const tm=eventTeams(e);games.set(id,{sport,eventId:id,away:tm.away,home:tm.home,startDate:e?.startDate||e?.startDateTime||'',moneyline:{},spread:{},total:{},source:'DraftKings'})}
    for(const [cat,sub,o] of offers(eg)){const type=marketType(cat,sub,o);if(!type)continue;const id=String(o?.eventId||o?.event?.eventId||o?.event?.id||'');if(!id)continue;let rec=games.get(id);if(!rec){rec={sport,eventId:id,away:'',home:'',moneyline:{},spread:{},total:{},source:'DraftKings'};games.set(id,rec)}const outcomes=o?.outcomes||[];
      if(type==='moneyline'){for(const x of outcomes){const n=teamName(x);if(n)rec.moneyline[n]=oddsVal(x)}}
      else if(type==='spread'){for(const x of outcomes){const n=teamName(x);if(n)rec.spread[n]={line:lineVal(x),odds:oddsVal(x)}}}
      else{for(const x of outcomes){const n=norm(teamName(x));const line=lineVal(x)||clean(o?.line||o?.points||'');if(n.includes('over')){rec.total.line=line;rec.total.overOdds=oddsVal(x)}else if(n.includes('under')){rec.total.line=line;rec.total.underOdds=oddsVal(x)}}}
    }
    return [...games.values()].filter(g=>g.home&&g.away);
  }
  async function fetchGroup(sport,group){let last;for(const url of URLS(group)){try{const r=await fetch(url,{cache:'no-store',mode:'cors'});if(!r.ok)throw Error(`HTTP ${r.status}`);const p=await r.json(),g=parse(p,sport);if(g.length)return g}catch(e){last=e}}throw last||Error('No lines returned')}
  function teamMatch(name,team){const d=norm(name),full=norm(team?.team?.displayName||team?.displayName||team?.name||team||''),ab=norm(team?.team?.abbreviation||team?.abbreviation||'');if(!d||!full)return false;if(d.includes(full)||full.includes(d))return true;if(ab&&new RegExp(`(^| )${ab}( |$)`).test(d))return true;const dl=d.split(' ').pop(),fl=full.split(' ').pop();return dl&&fl&&dl.length>=4&&dl===fl}
  function sportForTeam(t){if(t?.id==='cubs')return'mlb';if(['gb','buf','ind'].includes(t?.id))return'nfl';if(t?.id==='nd')return'cfb';return''}
  function syntheticTeams(t,g){const ours={team:{displayName:t?.name||'',abbreviation:t?.abbr||''}},opp={team:{displayName:g?.opp||'',abbreviation:''}};return g?.ha==='AWAY'?{home:opp,away:ours}:{home:ours,away:opp}}
  function find(t,g){const sport=sportForTeam(t);if(!sport)return null;const tm=g?._eventTeams||syntheticTeams(t,g);return DK.games.find(x=>x.sport===sport&&teamMatch(x.home,tm.home)&&teamMatch(x.away,tm.away))||DK.games.find(x=>x.sport===sport&&teamMatch(x.home,tm.away)&&teamMatch(x.away,tm.home))||null}
  const price=v=>v===undefined||v===null||v===''?'—':clean(v);
  function summary(o){if(!o)return null;const teams=[o.away,o.home],ml=teams.filter(n=>o.moneyline?.[n]).map(n=>`${short(n)} ${price(o.moneyline[n])}`).join(' · '),sp=teams.filter(n=>o.spread?.[n]).map(n=>`${short(n)} ${price(o.spread[n].line)} (${price(o.spread[n].odds)})`).join(' · '),tot=o.total?.line?`${price(o.total.line)}${o.total.overOdds||o.total.underOdds?` (O ${price(o.total.overOdds)} / U ${price(o.total.underOdds)})`:''}`:'';return{ml,sp,tot}}
  function short(n){const p=String(n||'').split(' ');return p[p.length-1]||n}
  function strip(t,g){const sport=sportForTeam(t);if(!sport)return'';if(DK.loading&&!DK.updatedAt)return`<div class="dk-strip"><span class="dk-brand">DraftKings</span><span class="dk-muted">Loading lines…</span></div>`;const o=find(t,g);if(!o)return`<div class="dk-strip"><span class="dk-brand">DraftKings</span><span class="dk-muted">Lines not posted</span></div>`;const s=summary(o);return`<div class="dk-strip"><span class="dk-brand">DraftKings</span><span class="dk-market"><b>Spread</b> ${esc(s.sp||'—')}</span><span class="dk-market"><b>ML</b> ${esc(s.ml||'—')}</span><span class="dk-market"><b>O/U</b> ${esc(s.tot||'—')}</span></div>`}
  window.oddsStripForTeamGame=strip;
  window.DK_ODDS=DK;

  const baseScheduleRow=window.scheduleRow;
  if(typeof baseScheduleRow==='function')window.scheduleRow=(t,g)=>{const html=baseScheduleRow(t,g),odds=strip(t,g);return odds?html.replace(/<\/div>$/i,`${odds}</div>`):html};

  async function refresh(){if(DK.loading)return;DK.loading=true;const all=[];for(const [sport,group] of Object.entries(GROUPS)){try{all.push(...await fetchGroup(sport,group));delete DK.errors[sport]}catch(e){DK.errors[sport]=String(e?.message||e)}}DK.games=all;DK.updatedAt=new Date().toISOString();DK.loading=false;try{renderHome();if(document.querySelector('#schedules')?.classList.contains('active'))renderSchedules()}catch(_){}}
  refresh();setInterval(refresh,5*60*1000);
})();
