// Candidate ESPN score feed identifiers. NOT verified as licensed, enabled or complete.
export const soccerCandidates=Object.freeze([
 {id:'soccer-epl',league:'Premier League',code:'eng.1'},
 {id:'soccer-laliga',league:'Spain - La Liga',code:'esp.1'},
 {id:'soccer-bundesliga',league:'Germany - Bundesliga',code:'ger.1'},
 {id:'soccer-seriea',league:'Italy - Serie A',code:'ita.1'},
 {id:'soccer-ligue1',league:'France - Ligue 1',code:'fra.1'},
 {id:'soccer-mls',league:'MLS',code:'usa.1'},
 {id:'soccer-ligamx',league:'Mexico - Liga MX',code:'mex.1'},
 {id:'soccer-ucl',league:'Champions League',code:'uefa.champions'},
 {id:'soccer-europa',league:'UEFA Europa League',code:'uefa.europa'},
 {id:'soccer-championship',league:'England - Championship',code:'eng.2'},
 {id:'soccer-eredivisie',league:'Netherlands - Eredivisie',code:'ned.1'},
 {id:'soccer-primeira',league:'Portugal - Primeira Liga',code:'por.1'},
 {id:'soccer-brasileirao',league:'Brazil - Serie A',code:'bra.1'},
 {id:'soccer-argentina',league:'Argentina - Liga Profesional',code:'arg.1'},
 {id:'soccer-scotland',league:'Scotland - Premiership',code:'sco.1'},
 {id:'soccer-saudi',league:'Saudi Arabia - Pro League',code:'ksa.1'},
 {id:'soccer-nwsl',league:'NWSL',code:'usa.nwsl'}
]);
export function soccerCandidate(id){
 const item=soccerCandidates.find(x=>x.id===id);
 if(!item)throw Error('UNSUPPORTED_SOCCER_LEAGUE');
 return {...item,scoreboardUrl:'https://site.api.espn.com/apis/site/v2/sports/soccer/'+item.code+'/scoreboard',status:'UNVERIFIED_CANDIDATE',oddsLicensed:false,enabled:false};
}
export function reconcileFixtureCoverage({targetFixtures=[],observedFixtures=[]}={}){
 const key=x=>[x.leagueId,x.eventId].map(v=>String(v||'').trim()).join(':');
 const observed=new Set(observedFixtures.filter(x=>x.leagueId&&x.eventId).map(key));
 const unique=new Map(targetFixtures.filter(x=>x.leagueId&&x.eventId).map(x=>[key(x),x]));
 const missing=[...unique.values()].filter(x=>!observed.has(key(x)));
 return {targetFixtureCount:unique.size,observedFixtureCount:unique.size-missing.length,
  missingFixtureCount:missing.length,missingFixtures:missing,complete:unique.size>0&&missing.length===0,
  requiresCurrentLicensedDraftKingsInventory:true};
}
