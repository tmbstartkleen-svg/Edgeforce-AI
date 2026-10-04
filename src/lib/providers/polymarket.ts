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

export async function fetchPublicPolymarket(){
 if(process.env.POLYMARKET_ENABLED==='false')return {ok:false,source:'Polymarket',contracts:[],error:'Polymarket public feed disabled'};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 try{
  const url=process.env.POLYMARKET_GAMMA_URL||'https://gamma-api.polymarket.com/markets?closed=false&limit=500&order=volumeNum&ascending=false';
  const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
  if(!res.ok)return {ok:false,source:'Polymarket',contracts:[],error:`HTTP ${res.status}`};
  const rows=await res.json() as GammaMarket[];
  const contracts=(Array.isArray(rows)?rows:[]).map((row,index)=>{
   const outcomes=parseArray(row.outcomes).map(String);
   const prices=parseArray(row.outcomePrices).map(Number);
   const yesIndex=Math.max(0,outcomes.findIndex(x=>x.toLowerCase()==='yes'));
   const yes=Number.isFinite(prices[yesIndex])?Math.max(.001,Math.min(.999,prices[yesIndex])):.5;
   const volume=Number(row.volumeNum??row.volume??0);
   const liquidity=Number(row.liquidity??0);
   const bid=Number(row.bestBid);
   const ask=Number(row.bestAsk);
   return {
    id:String(row.id||`polymarket-${index}`),
    title:String(row.question||row.title||`Polymarket ${index+1}`),
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
  }).filter(x=>x.title&&x.yesProbability>0&&x.yesProbability<1);
  return {ok:contracts.length>0,source:'Polymarket',contracts,error:contracts.length?undefined:'No public markets returned'};
 }catch(error){
  return {ok:false,source:'Polymarket',contracts:[],error:error instanceof Error?error.message:'Polymarket request failed'};
 }finally{clearTimeout(timer)}
}
