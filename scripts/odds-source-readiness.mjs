import {pathToFileURL} from 'node:url';

export function evaluateOddsReadiness({providers=[],markets=[],targetBook='DraftKings'}={}){
 const configured=providers.filter(p=>p?.configured===true);
 const healthy=configured.filter(p=>p?.healthy===true);
 const targetQuotes=markets.filter(m=>String(m?.bookmaker||m?.sourceBook||'').trim().toLowerCase()===targetBook.toLowerCase()&&Number.isFinite(Number(m?.odds))&&Number(m.odds)!==0);
 const upstreams=[...new Set(healthy.map(p=>String(p.upstreamId||p.providerId||'').trim()).filter(Boolean))];
 const reasons=[];
 if(!configured.length)reasons.push('NO_ODDS_PROVIDERS_CONFIGURED');
 if(!healthy.length)reasons.push('NO_HEALTHY_ODDS_PROVIDERS');
 if(!targetQuotes.length)reasons.push('NO_VERIFIED_TARGET_BOOK_QUOTES');
 if(upstreams.length<2)reasons.push('INDEPENDENT_UPSTREAM_REDUNDANCY_MISSING');
 return {status:reasons.length?'NOT_READY':'READY_FOR_MARKET_VALIDATION',targetBook,configuredProviders:configured.length,healthyProviders:healthy.length,targetBookPricedQuotes:targetQuotes.length,distinctHealthyUpstreams:upstreams.length,independentCrossBookValueCertified:false,reasons,caveat:'Readiness counts do not prove complete market coverage, quote licensing, fair probability calibration, or positive expected value.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.error('This evaluator requires explicit diagnostic JSON input from an authorized operator; it does not poll providers or read secrets.');process.exitCode=2;
}
