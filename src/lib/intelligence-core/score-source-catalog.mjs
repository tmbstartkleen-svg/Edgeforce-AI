/** Strict, bounded scoreboard source catalog. These are score feeds, never odds feeds. */
export const scoreSports=Object.freeze([
 {id:'nfl',label:'NFL',path:'football/nfl'},
 {id:'ncaaf',label:'NCAA Football',path:'football/college-football'},
 {id:'nba',label:'NBA',path:'basketball/nba'},
 {id:'ncaab',label:'NCAA Basketball',path:'basketball/mens-college-basketball'},
 {id:'wnba',label:'WNBA',path:'basketball/wnba'},
 {id:'mlb',label:'MLB',path:'baseball/mlb'},
 {id:'nhl',label:'NHL',path:'hockey/nhl'},
 {id:'soccer-epl',label:'Premier League',path:'soccer/eng.1'},
 {id:'soccer-laliga',label:'LaLiga',path:'soccer/esp.1'},
 {id:'soccer-bundesliga',label:'Bundesliga',path:'soccer/ger.1'},
 {id:'soccer-serie-a',label:'Serie A',path:'soccer/ita.1'},
 {id:'soccer-ligue-1',label:'Ligue 1',path:'soccer/fra.1'},
 {id:'soccer-mls',label:'MLS',path:'soccer/usa.1'},
 {id:'soccer-nwsl',label:'NWSL',path:'soccer/usa.nwsl'},
 {id:'soccer-ucl',label:'UEFA Champions League',path:'soccer/uefa.champions'},
 {id:'soccer-uel',label:'UEFA Europa League',path:'soccer/uefa.europa'}
]);
export function scoreboardSource(sport){
 const source=scoreSports.find(s=>s.id===sport);
 if(!source)throw Error('SPORT_NOT_APPROVED');
 return {sport:source.id,label:source.label,
  endpoint:'https://site.api.espn.com/apis/site/v2/sports/'+source.path+'/scoreboard'+(source.id==='nfl'?'?dates='+new Date().toISOString().slice(0,10).replace(/-/g,'')+'&limit=10':''),
  sourceId:'espn-scoreboard-'+source.id,upstreamId:'site.api.espn.com',
  classification:'SCORES_NOT_ODDS'};
}
