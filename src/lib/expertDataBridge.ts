import type {ContextProvenance,Market,PlayerContext} from './types';

type VendorConfig={id:string;name:string;url:string;key:string};
type NormalizedRow={
 marketId?:string;event?:string;home?:string;away?:string;sport?:string;
 features?:Record<string,number>;
 player?:PlayerContext;
 observedAt?:string;
 confidence?:number;
};
type VendorResponse={rows?:NormalizedRow[];warnings?:string[]};

const configs=():VendorConfig[]=>[
 {id:'opta',name:'Stats Perform Opta',url:String(process.env.OPTA_NORMALIZED_URL||''),key:String(process.env.OPTA_NORMALIZED_KEY||'')},
 {id:'sportradar',name:'Sportradar',url:String(process.env.SPORTRADAR_NORMALIZED_URL||''),key:String(process.env.SPORTRADAR_NORMALIZED_KEY||'')},
 {id:'synergy',name:'Synergy Basketball',url:String(process.env.SYNERGY_NORMALIZED_URL||''),key:String(process.env.SYNERGY_NORMALIZED_KEY||'')},
 {id:'second-spectrum',name:'Second Spectrum',url:String(process.env.SECOND_SPECTRUM_NORMALIZED_URL||''),key:String(process.env.SECOND_SPECTRUM_NORMALIZED_KEY||'')},
 {id:'pff',name:'PFF Data',url:String(process.env.PFF_NORMALIZED_URL||''),key:String(process.env.PFF_NORMALIZED_KEY||'')}
].filter(x=>x.url.trim());

const norm=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const match=(m:Market,r:NormalizedRow)=>{
 if(r.marketId&&r.marketId===m.id)return true;
 if(r.event&&norm(r.event)===norm(m.event))return true;
 if(r.home&&r.away&&norm(r.home)===norm(m.home)&&norm(r.away)===norm(m.away))return true;
 return false;
};
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

async function fetchVendor(config:VendorConfig,markets:Market[]){
 const controller=new AbortController();
 const timeoutMs=Math.max(1500,Number(process.env.PREMIUM_DATA_TIMEOUT_MS||7000));
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const res=await fetch(config.url,{
   method:'POST',
   headers:{
    'content-type':'application/json',accept:'application/json',
    ...(config.key?{authorization:`Bearer ${config.key}`}:{})
   },
   body:JSON.stringify({
    schemaVersion:'edgeforce-premium-context-v1',
    vendor:config.id,
    markets:markets.slice(0,500).map(m=>({
     id:m.id,sport:m.sport,league:m.league,event:m.event,home:m.home,away:m.away,
     selection:m.selection,market:m.market,startTime:m.startTime
    }))
   }),
   cache:'no-store',signal:controller.signal
  });
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const body=await res.json() as VendorResponse;
  return {ok:true,rows:Array.isArray(body.rows)?body.rows:[],warnings:body.warnings||[]};
 }catch(error){
  return {ok:false,rows:[] as NormalizedRow[],warnings:[error instanceof Error?error.message:'premium data request failed']};
 }finally{
  clearTimeout(timer);
 }
}

export async function enrichMarketsWithPremiumData(markets:Market[]){
 const providers=configs();
 if(!providers.length)return {
  markets,sourceQuality:{} as Record<string,number>,
  diagnostics:{configured:0,successful:0,matchedRows:0,providers:[] as Array<Record<string,unknown>>}
 };

 const results=await Promise.all(providers.map(async config=>({config,...await fetchVendor(config,markets)})));
 let matchedRows=0;
 const sourceQuality:Record<string,number>={};

 const enriched=markets.map(m=>{
  let features={...(m.sportFeatures||{})};
  let playerContext=m.playerContext;
  const contextSources=[...(m.contextSources||[])];
  const provenance:ContextProvenance[]=[...(m.contextProvenance||[])];
  let matched=false;

  for(const result of results){
   if(!result.ok)continue;
   sourceQuality[result.config.id]=.94;
   for(const row of result.rows){
    if(!match(m,row))continue;
    const confidence=clamp(Number(row.confidence??.94),.2,.99);
    const observedAt=row.observedAt||new Date().toISOString();
    for(const [key,value] of Object.entries(row.features||{})){
     const n=Number(value);
     if(!Number.isFinite(n))continue;
     features[key]=n;
     provenance.push({
      source:result.config.name,providerId:result.config.id,field:key,observedAt,
      confidence,status:'LIVE'
     });
    }
    if(row.player&&m.selection.toLowerCase().includes(row.player.name.toLowerCase())){
     playerContext={...playerContext,...row.player,name:row.player.name};
     provenance.push({
      source:result.config.name,providerId:result.config.id,field:'playerContext',observedAt,
      confidence,status:'LIVE'
     });
    }
    contextSources.push(result.config.id);
    matched=true;
   }
  }
  if(matched)matchedRows++;
  return {...m,sportFeatures:features,playerContext,contextSources:[...new Set(contextSources)],contextProvenance:provenance};
 });

 return {
  markets:enriched,sourceQuality,
  diagnostics:{
   configured:providers.length,
   successful:results.filter(x=>x.ok).length,
   matchedRows,
   providers:results.map(x=>({
    id:x.config.id,name:x.config.name,ok:x.ok,rows:x.rows.length,warnings:x.warnings
   }))
  }
 };
}
