/* Browser-side live metadata layer. ESPN currently returns 403 to GitHub-hosted runners,
   so live public metadata is refreshed in the visitor's browser instead of making Pages
   depend on a blocked server-side fetch. */
(()=>{
  const nativeSirius={
    cubs:"https://www.siriusxm.com/sports/mlb/chicago-cubs",
    gb:"https://www.siriusxm.com/sports/nfl/green-bay-packers",
    buf:"https://www.siriusxm.com/sports/nfl/buffalo-bills",
    ind:"https://www.siriusxm.com/sports/nfl/indianapolis-colts",
    nd:"https://www.siriusxm.com/sports/ncaaf/notre-dame"
  };
  siriusUrl=t=>nativeSirius[t?.id]||"";
  const baseGameChips=gameChips;
  gameChips=(t,g)=>{
    const html=baseGameChips(t,g).replace(/<a class="chip audio"[\s\S]*?<\/a>/g,"");
    const sxm=isLive(g)?siriusUrl(t):"";
    return html+(sxm?`<a class="chip audio" href="${sxm}" target="_blank" rel="noopener" onclick="event.stopPropagation()">◉ SiriusXM Live</a>`:"");
  };

  /* Family personalization should travel with every game, not live only in a team header. */
  const personalLabel=t=>t?.id==="payton"?"Hadley · Setter":t?.id==="amundsen"?"Patrick · WR/DB · #7":t?.id==="amundsenvarsity"?"Patrick dresses varsity":"";
  const personalBadge=t=>personalLabel(t)?`<div class="personal-game-label">${esc(personalLabel(t))}</div>`:"";

  /* Layout guard: keep Home as a uniform dashboard even if an older cached stylesheet is served. */
  const style=document.createElement("style");
  style.textContent=`
    .personal-game-label{display:inline-flex;align-items:center;width:max-content;max-width:100%;margin:8px 0 0;padding:4px 8px;border-radius:999px;border:1px solid rgba(231,189,102,.38);background:rgba(231,189,102,.09);color:#f0cf86;font-size:9px;font-weight:900;letter-spacing:.02em}.schedule-card .personal-game-label{margin:0 0 5px}
    .home-upcoming{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important}.home-upcoming>.home-hero,.home-upcoming>.home-rest{display:contents!important}.home-upcoming .home-hero,.home-upcoming .up-card{min-width:0!important;min-height:205px!important;padding:15px!important;border-radius:18px!important}.home-upcoming .home-hero .hero-matchup{font-size:18px!important;line-height:1.12!important;margin:14px 0 4px!important}.home-upcoming .home-hero .hero-time{font-size:12px!important}.home-upcoming .logo-box{width:44px!important;height:44px!important;flex-basis:44px!important}.home-upcoming .team-name{font-size:15px!important;line-height:1.05!important}.home-upcoming .team-context,.home-upcoming .record,.home-upcoming .venue{font-size:10px!important}.home-upcoming .card-btn{padding:7px 9px!important;font-size:9px!important;border-radius:9px!important}
    @media(max-width:1050px){.home-upcoming{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media(max-width:900px){.home-upcoming{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:700px){.home-upcoming{display:flex!important;overflow-x:auto!important;gap:10px!important;scroll-snap-type:x mandatory!important;padding-bottom:8px!important}.home-upcoming>.home-hero,.home-upcoming>.home-rest{display:contents!important}.home-upcoming .home-hero,.home-upcoming .up-card{flex:0 0 86%!important;min-height:195px!important;scroll-snap-align:start!important}}@media(max-width:430px){.home-upcoming .home-hero,.home-upcoming .up-card{flex-basis:91%!important}}
  `;
  document.head.appendChild(style);

  const baseGameCard=gameCard;
  gameCard=(t,g,hero=false)=>{
    let html=baseGameCard(t,g,hero);
    const badge=personalBadge(t);
    if(!badge)return html;
    return html.replace(/(<div class="(?:hero-matchup|matchup)">)/,`${badge}$1`);
  };
  const baseScheduleRow=scheduleRow;
  scheduleRow=(t,g)=>{
    let html=baseScheduleRow(t,g);
    const badge=personalBadge(t);
    if(!badge)return html;
    return html.replace(/(<div class="schedule-opponent">)/,`${badge}$1`);
  };

  function walk(node,out=[]){
    if(!node||typeof node!=="object")return out;
    const st=node.standings||{};
    if(Array.isArray(st.entries))out.push({name:node.name||node.abbreviation||node.shortName||"",entries:st.entries});
    for(const k of ["children","groups"])for(const child of node[k]||[])walk(child,out);
    return out;
  }
  function findGroup(groups,name){const n=norm(name);return groups.find(g=>norm(g.name).includes(n))}
  function rankRows(payload,label){
    const rows=[];
    for(const poll of payload?.rankings||payload?.polls||[]){
      const pollName=poll.name||poll.shortName||poll.headline||label;
      for(const r of poll.ranks||poll.rankings||[]){
        const team=r.team||{},name=team.displayName||team.shortDisplayName||r.teamName||"",rank=r.current||r.rank||r.ranking;
        if(name&&rank)rows.push({poll:pollName,team:name,rank:Number(rank),record:r.recordSummary||""});
      }
    }
    return rows;
  }
  async function liveMetadata(){
    if(!APP?.data){setTimeout(liveMetadata,1200);return}
    const tasks=[];
    tasks.push((async()=>{
      try{const p=await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",{cacheMs:5*60*1000}),rows=rankRows(p,"AP");if(rows.length){APP.data.rankings.cfb=rows;const nd=rows.find(r=>/notre dame/i.test(r.team)&&/associated|\bap\b/i.test(r.poll))||rows.find(r=>/notre dame/i.test(r.team));if(nd)teamById("nd").context=`#${nd.rank} ${/coach/i.test(nd.poll)?"Coaches":"AP"}`}}catch(_){}}
    )());
    tasks.push((async()=>{
      try{const p=await fetchJson("https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/rankings",{cacheMs:5*60*1000}),rows=rankRows(p,"AVCA");if(rows.length){APP.data.rankings.volleyball=rows;const wi=rows.find(r=>/wisconsin/i.test(r.team));if(wi)teamById("wisc").context=`#${wi.rank} AVCA`}}catch(_){}}
    )());
    tasks.push((async()=>{
      try{const p=await fetchJson("https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2026",{cacheMs:5*60*1000}),groups=walk(p),g=groups.sort((a,b)=>b.entries.length-a.entries.length)[0];if(g?.entries?.length>=18)APP.data.standings.epl=g.entries}catch(_){}}
    )());
    tasks.push((async()=>{
      try{const p=await fetchJson("https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=2026&type=0",{cacheMs:5*60*1000}),groups=walk(p);for(const [key,name] of [["nfcNorth","NFC North"],["afcEast","AFC East"],["afcSouth","AFC South"]]){const g=findGroup(groups,name);if(g?.entries?.length===4)APP.data.standings[key]=g.entries}}catch(_){}}
    )());
    tasks.push((async()=>{
      try{const p=await fetchJson("https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?season=2026&type=0",{cacheMs:5*60*1000}),groups=walk(p),g=findGroup(groups,"NL Central");if(g?.entries?.length===5)APP.data.standings.nlCentral=g.entries}catch(_){}}
    )());
    await Promise.allSettled(tasks);
    renderHome();renderStandings();renderPremierTable();renderVolleyballRankings();
  }
  setTimeout(liveMetadata,1400);
  setInterval(liveMetadata,10*60*1000);
})();
