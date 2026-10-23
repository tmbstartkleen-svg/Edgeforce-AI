/**
 * Major C Stage 1 sportsbook data acceptance decision.
 * Aggregates individually verified external evidence; never fabricates it.
 * This is a pure policy gate: no provider calls, approvals, D1 writes or deploys.
 */
export type OddsStage1Evidence={
 providerRequest?:{httpStatus:number;targetQuotes:number;observedAt:string;upstreamId:string};
 permittedStorage?:{confirmed:boolean;provider:string;authorizedBy:string;scope:string;expiresAt:string};
 pilotReadback?:{exactReadbackComplete:boolean;expectedQuotes:number;readbackMatches:number;querySaturated:boolean;sourceId:string;upstreamId:string};
 independentVerification?:{independentUpstreams:number;priceAlignedOutcomes:number;verifiedOutcomes:number};
 marketCatalog?:{complete:boolean;expectedMarkets:number;coveredMarkets:number};
};
const date=(v:unknown)=>typeof v==='string'?Date.parse(v):NaN;
const nonempty=(s:unknown)=>typeof s==='string'&&s.trim().length>0;
export function evaluateOddsStage1Acceptance(e:OddsStage1Evidence,now=Date.now()){
 if(!e||typeof e!=='object'||!Number.isFinite(now))throw Error('INVALID_STAGE1_EVIDENCE');
 const blockers:string[]=[];
 const request=e.providerRequest;
 const live=Boolean(request?.httpStatus===200&&Number.isSafeInteger(request.targetQuotes)&&request.targetQuotes>0&&
  nonempty(request.upstreamId)&&Number.isFinite(date(request.observedAt))&&date(request.observedAt)<=now&&
  now-date(request.observedAt)<=15*60*1000);
 if(!live)blockers.push('LIVE_PROVIDER_EVIDENCE_MISSING_OR_STALE');
 const right=e.permittedStorage;
 const storage=Boolean(right?.confirmed===true&&nonempty(right.provider)&&nonempty(right.authorizedBy)&&
  nonempty(right.scope)&&Number.isFinite(date(right.expiresAt))&&date(right.expiresAt)>now);
 if(!storage)blockers.push('PROVIDER_STORAGE_ENTITLEMENT_NOT_VERIFIED');
 const read=e.pilotReadback;
 const readback=Boolean(read?.exactReadbackComplete===true&&read.querySaturated===false&&
  Number.isSafeInteger(read.expectedQuotes)&&read.expectedQuotes>0&&read.readbackMatches===read.expectedQuotes&&
  read.upstreamId===request?.upstreamId&&nonempty(read.sourceId));
 if(!readback)blockers.push('ISOLATED_D1_EXACT_READBACK_NOT_VERIFIED');
 const independence=e.independentVerification;
 const verified=Boolean(independence&&Number.isSafeInteger(independence.independentUpstreams)&&
  independence.independentUpstreams>=2&&Number.isSafeInteger(independence.priceAlignedOutcomes)&&
  independence.priceAlignedOutcomes>0&&independence.verifiedOutcomes>=independence.priceAlignedOutcomes);
 if(!verified)blockers.push('INDEPENDENT_ODDS_PRICE_AGREEMENT_NOT_VERIFIED');
 const catalog=e.marketCatalog;
 const coverage=Boolean(catalog?.complete===true&&Number.isSafeInteger(catalog.expectedMarkets)&&
  catalog.expectedMarkets>0&&catalog.coveredMarkets>=catalog.expectedMarkets);
 if(!coverage)blockers.push('AUTHORIZED_MARKET_CATALOG_NOT_COMPLETE');
 return {stage:'MAJOR_C_STAGE_1',acceptanceReady:blockers.length===0,
  checks:{live,storage,readback,verified,coverage},
  blockers,releaseCertified:false,
  note:'Evidence must be independently obtained and audited. Policy gate passing alone cannot certify permissions, model calibration, or production readiness.'};
}
