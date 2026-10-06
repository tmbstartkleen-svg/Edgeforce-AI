export type SportFeed={
 id:string;
 family:string;
 label:string;
 scope:'PRO'|'COLLEGE'|'INTERNATIONAL'|'GLOBAL';
 scoreProvider:'ESPN'|'NATIVE'|'EXTERNAL';
 sportSlug?:string;
 leagueSlug?:string;
 livePriority:string[];
};

export const ESPN_SCOREBOARD_FEEDS:SportFeed[]=[
 {id:'nfl',family:'american-football',label:'NFL',scope:'PRO',scoreProvider:'ESPN',sportSlug:'football',leagueSlug:'nfl',livePriority:['espn-cdn','espn-site']},
 {id:'ncaaf',family:'american-football',label:'NCAAF',scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'football',leagueSlug:'college-football',livePriority:['espn-cdn','espn-site']},
 {id:'cfl',family:'american-football',label:'CFL',scope:'PRO',scoreProvider:'ESPN',sportSlug:'football',leagueSlug:'cfl',livePriority:['espn-site']},
 {id:'ufl',family:'american-football',label:'UFL',scope:'PRO',scoreProvider:'ESPN',sportSlug:'football',leagueSlug:'ufl',livePriority:['espn-site']},

 {id:'nba',family:'basketball',label:'NBA',scope:'PRO',scoreProvider:'ESPN',sportSlug:'basketball',leagueSlug:'nba',livePriority:['espn-cdn','espn-site']},
 {id:'wnba',family:'basketball',label:'WNBA',scope:'PRO',scoreProvider:'ESPN',sportSlug:'basketball',leagueSlug:'wnba',livePriority:['espn-cdn','espn-site']},
 {id:'ncaam-basketball',family:'basketball',label:'NCAAB',scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'basketball',leagueSlug:'mens-college-basketball',livePriority:['espn-cdn','espn-site']},
 {id:'ncaaw-basketball',family:'basketball',label:'NCAAW',scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'basketball',leagueSlug:'womens-college-basketball',livePriority:['espn-site']},

 {id:'mlb',family:'baseball',label:'MLB',scope:'PRO',scoreProvider:'NATIVE',sportSlug:'baseball',leagueSlug:'mlb',livePriority:['mlb-statsapi','espn-cdn','espn-site']},
 {id:'ncaa-baseball',family:'baseball',label:'NCAA Baseball',scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'baseball',leagueSlug:'college-baseball',livePriority:['espn-site']},
 {id:'ncaa-softball',family:'softball',label:'NCAA Softball',scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'baseball',leagueSlug:'college-softball',livePriority:['espn-site']},

 {id:'nhl',family:'ice-hockey',label:'NHL',scope:'PRO',scoreProvider:'NATIVE',sportSlug:'hockey',leagueSlug:'nhl',livePriority:['nhl-web','espn-cdn','espn-site']},
 {id:'ncaa-m-hockey',family:'ice-hockey',label:"NCAA Men's Hockey",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'hockey',leagueSlug:'mens-college-hockey',livePriority:['espn-site']},
 {id:'ncaa-w-hockey',family:'ice-hockey',label:"NCAA Women's Hockey",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'hockey',leagueSlug:'womens-college-hockey',livePriority:['espn-site']},

 {id:'ncaa-m-soccer',family:'soccer',label:"NCAA Men's Soccer",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'usa.ncaa.m.1',livePriority:['espn-cdn','espn-site']},
 {id:'ncaa-w-soccer',family:'soccer',label:"NCAA Women's Soccer",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'usa.ncaa.w.1',livePriority:['espn-cdn','espn-site']},
 {id:'mls',family:'soccer',label:'MLS',scope:'PRO',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'usa.1',livePriority:['espn-cdn','espn-site']},
 {id:'nwsl',family:'soccer',label:'NWSL',scope:'PRO',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'usa.nwsl',livePriority:['espn-cdn','espn-site']},
 {id:'epl',family:'soccer',label:'EPL',scope:'PRO',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'eng.1',livePriority:['espn-cdn','espn-site']},
 {id:'laliga',family:'soccer',label:'LaLiga',scope:'PRO',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'esp.1',livePriority:['espn-cdn','espn-site']},
 {id:'bundesliga',family:'soccer',label:'Bundesliga',scope:'PRO',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'ger.1',livePriority:['espn-cdn','espn-site']},
 {id:'serie-a',family:'soccer',label:'Serie A',scope:'PRO',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'ita.1',livePriority:['espn-cdn','espn-site']},
 {id:'ligue-1',family:'soccer',label:'Ligue 1',scope:'PRO',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'fra.1',livePriority:['espn-cdn','espn-site']},
 {id:'ucl',family:'soccer',label:'UCL',scope:'INTERNATIONAL',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'uefa.champions',livePriority:['espn-cdn','espn-site']},
 {id:'uel',family:'soccer',label:'Europa League',scope:'INTERNATIONAL',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'uefa.europa',livePriority:['espn-cdn','espn-site']},
 {id:'world-cup',family:'soccer',label:'FIFA World Cup',scope:'INTERNATIONAL',scoreProvider:'ESPN',sportSlug:'soccer',leagueSlug:'fifa.world',livePriority:['espn-cdn','espn-site']},

 {id:'ncaa-m-lacrosse',family:'lacrosse',label:"NCAA Men's Lacrosse",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'lacrosse',leagueSlug:'mens-college-lacrosse',livePriority:['espn-site']},
 {id:'ncaa-w-lacrosse',family:'lacrosse',label:"NCAA Women's Lacrosse",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'lacrosse',leagueSlug:'womens-college-lacrosse',livePriority:['espn-site']},
 {id:'ncaa-m-volleyball',family:'volleyball',label:"NCAA Men's Volleyball",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'volleyball',leagueSlug:'mens-college-volleyball',livePriority:['espn-site']},
 {id:'ncaa-w-volleyball',family:'volleyball',label:"NCAA Women's Volleyball",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'volleyball',leagueSlug:'womens-college-volleyball',livePriority:['espn-site']},
 {id:'ncaa-field-hockey',family:'field-hockey',label:"NCAA Women's Field Hockey",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'field-hockey',leagueSlug:'womens-college-field-hockey',livePriority:['espn-site']},
 {id:'ncaa-m-water-polo',family:'water-polo',label:"NCAA Men's Water Polo",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'water-polo',leagueSlug:'mens-college-water-polo',livePriority:['espn-site']},
 {id:'ncaa-w-water-polo',family:'water-polo',label:"NCAA Women's Water Polo",scope:'COLLEGE',scoreProvider:'ESPN',sportSlug:'water-polo',leagueSlug:'womens-college-water-polo',livePriority:['espn-site']},

 {id:'ufc',family:'mma',label:'UFC',scope:'PRO',scoreProvider:'ESPN',sportSlug:'mma',leagueSlug:'ufc',livePriority:['espn-site']},
 {id:'nrl',family:'rugby-league',label:'NRL',scope:'PRO',scoreProvider:'ESPN',sportSlug:'rugby-league',leagueSlug:'3',livePriority:['espn-site']},
 {id:'afl',family:'australian-football',label:'AFL',scope:'PRO',scoreProvider:'ESPN',sportSlug:'australian-football',leagueSlug:'afl',livePriority:['espn-site']}
];

export const GLOBAL_SPORT_REGISTRY:SportFeed[]=[
 ...ESPN_SCOREBOARD_FEEDS,
 {id:'tennis-atp',family:'tennis',label:'ATP Tennis',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','espn-tennis-all','therundown']},
 {id:'tennis-wta',family:'tennis',label:'WTA Tennis',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','espn-tennis-all','therundown']},
 {id:'table-tennis',family:'table-tennis',label:'Table Tennis',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'boxing',family:'boxing',label:'Boxing',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['licensed-provider','score-fallback']},
 {id:'golf',family:'golf',label:'Golf',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['espn-site','licensed-provider']},
 {id:'motorsport',family:'motorsport',label:'Motorsport',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['espn-site','licensed-provider']},
 {id:'cricket',family:'cricket',label:'Cricket',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['espncricinfo','licensed-backup']},
 {id:'rugby',family:'rugby',label:'Rugby Union',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'handball',family:'handball',label:'Handball',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'badminton',family:'badminton',label:'Badminton',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'darts',family:'darts',label:'Darts',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'snooker',family:'snooker',label:'Snooker',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'futsal',family:'futsal',label:'Futsal',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'beach-volleyball',family:'beach-volleyball',label:'Beach Volleyball',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'cycling',family:'cycling',label:'Cycling',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'floorball',family:'floorball',label:'Floorball',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'bandy',family:'bandy',label:'Bandy',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['sofascore-live','licensed-backup']},
 {id:'esports',family:'esports',label:'Esports',scope:'GLOBAL',scoreProvider:'EXTERNAL',livePriority:['pandascore','licensed-backup']}
];

export const NCAA_SPORT_IDS=GLOBAL_SPORT_REGISTRY.filter(x=>x.scope==='COLLEGE').map(x=>x.id);
export const SPORT_FAMILIES=[...new Set(GLOBAL_SPORT_REGISTRY.map(x=>x.family))].sort();

export function sportCoverageSummary(){
 return {
  feeds:GLOBAL_SPORT_REGISTRY.length,
  families:SPORT_FAMILIES.length,
  ncaa:NCAA_SPORT_IDS.length,
  espn:GLOBAL_SPORT_REGISTRY.filter(x=>x.scoreProvider==='ESPN'||x.scoreProvider==='NATIVE').length,
  external:GLOBAL_SPORT_REGISTRY.filter(x=>x.scoreProvider==='EXTERNAL').length
 };
}
