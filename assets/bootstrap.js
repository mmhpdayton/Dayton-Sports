/* Migration fallback: merge the last-known-good FaveSports snapshot into the new data response.
   This is same-origin on GitHub Pages and keeps the new site useful if ESPN blocks an automated host. */
(()=>{
  const nativeFetch=window.fetch.bind(window);
  function archiveRankings(base,old){
    base.rankings??={};
    if(!(base.rankings.cfb||[]).length){
      const rows=[];
      for(const [key,label] of [["ap","AP"],["coaches","Coaches"]]){
        (old?.rankings?.[key]||[]).forEach((team,i)=>rows.push({poll:label,rank:i+1,team}));
      }
      base.rankings.cfb=rows;
    }
    if(!(base.rankings.volleyball||[]).length){
      base.rankings.volleyball=(old?.rankings?.avca||[]).map((team,i)=>({poll:"AVCA",rank:i+1,team}));
    }
  }
  function mergeArchive(base,old){
    const byId=new Map((old?.teams||[]).map(t=>[t.id,t]));
    for(const t of base.teams||[]){
      if(["payton","amundsen","amundsenvarsity"].includes(t.id))continue;
      const archived=byId.get(t.id);if(!archived)continue;
      if((archived.schedule||[]).length>(t.schedule||[]).length)t.schedule=archived.schedule;
      if(!t.record&&archived.record)t.record=archived.record;
      if((!t.context||/Central|League|North|East|South/.test(t.context))&&archived.context)t.context=archived.context;
    }
    base.standings??={};
    for(const k of ["epl","nfcNorth","afcEast","afcSouth","nlCentral"]){
      if(!(base.standings[k]||[]).length&&(old?.standings?.[k]||[]).length)base.standings[k]=old.standings[k];
    }
    archiveRankings(base,old);
    if(old?.siriusxm)base.siriusxm=old.siriusxm;
    base.archiveFallbackVersion=old?.version||"unknown";
    return base;
  }
  window.fetch=async(input,init)=>{
    const url=typeof input==="string"?input:input?.url||"";
    if(!/data\/sports-data\.json(?:\?|$)/.test(url))return nativeFetch(input,init);
    const baseResponse=await nativeFetch(input,init);
    try{
      const base=await baseResponse.clone().json();
      const archiveResponse=await nativeFetch("/FaveSports/sports-data.json",{cache:"no-store"});
      if(!archiveResponse.ok)return baseResponse;
      const old=await archiveResponse.json();
      const merged=mergeArchive(base,old);
      return new Response(JSON.stringify(merged),{status:200,headers:{"Content-Type":"application/json"}});
    }catch(_){return baseResponse}
  };
})();
