/* UI bridge: embedded ESPN DraftKings quote first, static odds snapshot second. */
(()=>{
  const baseTeam=window.oddsStripForTeamGame;
  window.oddsStripForTeamGame=(t,g)=>{
    const embedded=window.espnDkOddsStrip?.(g)||'';
    return embedded || (typeof baseTeam==='function'?baseTeam(t,g):'');
  };
  const baseLeague=window.oddsStripForLeagueGame;
  window.oddsStripForLeagueGame=(sport,home,away,g)=>{
    const embedded=window.espnDkOddsStrip?.(g)||'';
    return embedded || (typeof baseLeague==='function'?baseLeague(sport,home,away):'');
  };
  const baseRow=window.scheduleRow;
  if(typeof baseRow==='function')window.scheduleRow=(t,g)=>{
    let html=baseRow(t,g);
    const embedded=window.espnDkOddsStrip?.(g)||'';
    if(!embedded||html.includes('dk-strip'))return html;
    return html.replace(/<\/div>$/i,`${embedded}</div>`);
  };
})();
