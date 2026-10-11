/** Connection inventory never implies an active licensed deal or validates a provider secret. */
export type IntegrationStatus='PUBLIC_READ'|'KEY_PRESENT_UNVERIFIED'|'NEEDS_KEY'|'OPT_IN_DISABLED'|'LICENSE_REQUIRED'|'NATIVE';
export type ProIntegration={id:string;name:string;category:'SPORTSBOOK'|'PREDICTION'|'SCORES'|'ANALYST'|'TACTICS';status:IntegrationStatus;description:string;next:string};

export function proIntegrations(env:Record<string,string|undefined>=process.env):ProIntegration[]{
 const present=(v?:string)=>Boolean(v?.trim());
 const odds=present(env.THE_ODDS_API_KEY)||present(env.SPORTS_GAME_ODDS_API_KEY)||
  present(env.ODDS_API_2_KEY)||present(env.SHARPAPI_API_KEY);
 const sportsbook=(id:string,name:string):ProIntegration=>({
  id,name,category:'SPORTSBOOK',status:odds?'KEY_PRESENT_UNVERIFIED':'NEEDS_KEY',
  description:'Bookmaker prices are available only when the authorized odds aggregator actually returns this bookmaker. Neither access nor freshness is assumed.',
  next:odds?'Check feed status and returned bookmaker list':'Install valid, authorized SportsGameOdds / The Odds API credentials as Cloudflare secrets'
 });
 return [
  sportsbook('draftkings','DraftKings'),sportsbook('fanduel','FanDuel'),sportsbook('betmgm','BetMGM'),
  {id:'kalshi',name:'Kalshi',category:'PREDICTION',status:env.KALSHI_ENABLED==='false'?'OPT_IN_DISABLED':'PUBLIC_READ',
   description:'Official public market data adapter. No authenticated Kalshi trading/order submission connected.',
   next:'Confirm real contracts, prices, settlement rules, and geographic eligibility'},
  {id:'polymarket',name:'Polymarket',category:'PREDICTION',status:env.POLYMARKET_ENABLED==='false'?'OPT_IN_DISABLED':'PUBLIC_READ',
   description:'Public Gamma market-data adapter, not authenticated execution or a right to trade.',
   next:'Match exact market settlement and availability; CLOB trading requires separate authorization'},
  {id:'api-football',name:'API-Football',category:'SCORES',
   status:present(env.API_SPORTS_KEY)||present(env.API_FOOTBALL_KEY)?'KEY_PRESENT_UNVERIFIED':'NEEDS_KEY',
   description:'Soccer fixture/stats adapter does not establish executable sportsbook prices.',
   next:'Configure your issued API key and verify actual soccer fixture responses'},
  {id:'google-sports',name:'Google Sports / SerpApi',category:'SCORES',
   status:present(env.SERPAPI_API_KEY)&&env.SERPAPI_SPORTS_ENABLED==='true'?'KEY_PRESENT_UNVERIFIED':'OPT_IN_DISABLED',
   description:'Third-party Google sports research snapshots, not an official real-time betting feed.',
   next:'Verify KGIDs, opt in and configure the issued SerpApi key'},
  {id:'ai-analyst',name:'EdgeForce AI Analyst',category:'ANALYST',
   status:present(env.AI_GATEWAY_API_KEY)&&present(env.AI_GATEWAY_MODEL)&&present(env.EDGEFORCE_ANALYST_ACCESS_TOKEN)?'KEY_PRESENT_UNVERIFIED':'NEEDS_KEY',
   description:'Optional Vercel AI Gateway text analyst. Evidence interpretation only; cannot invent probabilities.',
   next:'Set Gateway credentials, a real model ID and private access token; verify shared daily quota'},
  ...(['Hudl Sportscode','Catapult Pro Video','Stats Perform Opta'] as const).map((name,i):ProIntegration=>({
   id:['hudl','catapult','opta'][i],name,category:'TACTICS',status:'LICENSE_REQUIRED',
   description:'Specialized sports film, tracking or biomechanics feeds are not connected or licensed.',
   next:'Obtain contractual data rights and documentation before adding a restricted import connector'
  }))
 ];
}
