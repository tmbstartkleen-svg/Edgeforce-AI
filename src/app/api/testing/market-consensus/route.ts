import {buildConsensusMarkets} from '@/lib/marketConsensus';
import type {Market,MarketRole} from '@/lib/types';

function quote(id:string,book:string,role:MarketRole,market:string,prob:number,odds:number,weight=1):Market & {sourceProviderId:string;marketRole:MarketRole;sourceProviderWeight:number}{
 return {
  id,sport:'NFL',league:'TEST',event:'Away @ Home',selection:'Home ML',market,
  startTime:'2026-10-04T20:00:00Z',home:'Home',away:'Away',odds,
  rawImpliedProb:prob,sourceBook:book,sourceProviderId:id,marketRole:role,sourceProviderWeight:weight,
  marketProb:prob,modelProb:prob,confidence:.8,sourceAgeMin:1,period:'PM'
 };
}

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const quotes=[
  quote('reference','DraftKings','REFERENCE','Moneyline',.55,-122,1.2),
  quote('sharp','SharpBook','SHARP','h2h',.58,-138,1.4),
  quote('public','PublicBook','PUBLIC','ML',.52,-108,1),
  quote('outlier','BadBook','NEUTRAL','Money Line',.80,-400,.6)
 ];
 const markets=buildConsensusMarkets(quotes,'DraftKings');
 const row=markets[0];
 const c=row?.consensus;
 const ok=
  markets.length===1&&
  row.odds===-122&&
  c?.targetBookFound===true&&
  c.bookCount===4&&
  c.providerCount===4&&
  c.consensusProbability>.53&&c.consensusProbability<.59&&
  c.marketStructure==='SHARP_OVER_PUBLIC'&&
  (c.sharpPublicGap||0)>.04&&
  c.outlierBooks.includes('BadBook')&&
  c.bestBook==='PublicBook';
 return Response.json({ok,row});
}
