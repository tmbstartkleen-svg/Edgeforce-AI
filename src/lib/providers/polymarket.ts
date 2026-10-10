type GammaMarket={
 id?:string;
 question?:string;
 title?:string;
 category?:string;
 outcomes?:string|string[];
 outcomePrices?:string|Array<string|number>;
 volume?:string|number;
 volumeNum?:number;
 liquidity?:string|number;
 bestBid?:string|number;
 bestAsk?:string|number;
 endDate?:string;
 end_date_iso?:string;
 closed?:boolean;
 active?:boolean;
};

const parseArray=(value:unknown):unknown[]=>{
 if(Array.isArray(value))return value;
 if(typeof value==='string'){
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return []}
 }
 return [];
};

async function loadPublicPolymarket(){
 if(process.env.POLYMARKET_ENABLED==='false')return {ok:false,source:'Polymarket',contracts:[],error:'Polymarket public feed disabled'};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),5000);
 try{
  const rows:GammaMarket[]=[];
  const maxPages=Math.max(1,Math.min(4,Number(process.env.POLYMARKET_MAX_PAGES||3)));
  let cursor='';
  for(let page=0;page<maxPages;page++){
   const url=new URL(process.env.POLYMARKET_GAMMA_URL||'https://gamma-api.polymarket.com/markets/keyset?closed=false&limit=250');
   if(cursor)url.searchParams.set('after_cursor',cursor);
   try{
    const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
    if(!res.ok){if(!rows.length)return {ok:false,source:'Polymarket',contracts:[],error:`HTTP ${res.status}`};break;}
    const data=await res.json();
    const batch=Array.isArray(data)?data:Array.isArray(data.markets)?data.markets:[];
    rows.push(...batch);
    cursor=String(data.next_cursor||'');
    if(!cursor||process.env.POLYMARKET_GAMMA_URL)break;
   }catch(error){if(!rows.length)throw error;break;}
  }
  const contracts=(Array.isArray(rows)?rows:[]).map((row,index)=>{
   const outcomes=parseArray(row.outcomes).map(String);
   const prices=parseArray(row.outcomePrices).map(Number);
   const yesIndex=Math.max(0,outcomes.findIndex(x=>x.toLowerCase()==='yes'));
   const yes=Number.isFinite(prices[yesIndex])&&prices[yesIndex]>0&&prices[yesIndex]<1?prices[yesIndex]:Number.NaN;
   const volume=Number(row.volumeNum??row.volume??0);
   const liquidity=Number(row.liquidity??0);
   const bid=Number(row.bestBid);
   const ask=Number(row.bestAsk);
   return {
    id:String(row.id||`polymarket-${index}`),
    title:String(row.question||row.title||`Polymarket ${index+1}`)+(outcomes[yesIndex]&&outcomes[yesIndex].toLowerCase()!=='yes'?' — '+outcomes[yesIndex]:''),
    category:String(row.category||'Polymarket'),
    yesProbability:yes,noProbability:1-yes,modelProbability:yes,probabilityDifference:0,
    volume:Number.isFinite(volume)&&volume>0?volume:undefined,
    liquidity:Number.isFinite(liquidity)&&liquidity>0?liquidity:undefined,
    bidProbability:Number.isFinite(bid)&&bid>0?Math.max(.001,Math.min(.999,bid)):undefined,
    askProbability:Number.isFinite(ask)&&ask>0?Math.max(.001,Math.min(.999,ask)):undefined,
    expiresAt:String(row.endDate||row.end_date_iso||'')||undefined,
    source:'Polymarket',
    venueType:'PREDICTION_EXCHANGE' as const
   };
  }).filter((x,i,all)=>x.title&&x.yesProbability>0&&x.yesProbability<1&&all.findIndex(y=>y.id===x.id)===i);
  return {ok:contracts.length>0,source:'Polymarket',contracts,error:contracts.length?undefined:'No public markets returned'};
 }catch(error){
  return {ok:false,source:'Polymarket',contracts:[],error:error instanceof Error?error.message:'Polymarket request failed'};
 }finally{clearTimeout(timer)}
}

type PublicResult=Awaited<ReturnType<typeof loadPublicPolymarket>>;
let publicCache:{at:number;result:PublicResult}|null=null;
let publicInFlight:Promise<PublicResult>|null=null;
export async function fetchPublicPolymarket(){
 if(process.env.POLYMARKET_ENABLED==='false')return {ok:false,source:'Polymarket',contracts:[],error:'Polymarket public feed disabled'};
 if(publicCache&&Date.now()-publicCache.at<60000)return publicCache.result;
 if(!publicInFlight)publicInFlight=loadPublicPolymarket().then(result=>{publicCache={at:Date.now(),result};return result}).finally(()=>{publicInFlight=null});
 return publicInFlight;
}
