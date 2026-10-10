import {PropLine} from 'propline';
import type {ProviderConfig,ProviderFetchResult} from './types';

type FlatRow={
  id:string;
  eventId:string;
  sport:string;
  league:string;
  event:string;
  home:string;
  away:string;
  selection:string;
  market:string;
  startTime:string;
  odds:number;
  bookmaker:string;
  pulledAt:string;
};

type Cached={
  at:number;
  rows:FlatRow[];
  latencyMs:number;
  warnings:string[];
};

let cache:Cached|null=null;
let inFlight:Promise<Cached>|null=null;

const cacheMs=()=>Math.max(
  300000,
  Number(process.env.PROPLINE_CACHE_MS||1200000)
);

const sports=()=>(
  process.env.PROPLINE_SPORTS ||
  'football_nfl,football_ncaaf,basketball_nba,hockey_nhl,baseball_mlb,tennis'
)
.split(',')
.map(x=>x.trim())
.filter(Boolean);

const batchWidth=()=>Math.max(
  1,
  Math.min(4,Number(process.env.PROPLINE_SPORTS_PER_BATCH||3))
);

const eventsPerSport=()=>Math.max(
  1,
  Math.min(4,Number(process.env.PROPLINE_EVENTS_PER_SPORT||2))
);

function rotatingSports(){
  const all=sports();
  const width=Math.min(batchWidth(),all.length);

  if(all.length<=width)return all;

  const bucket=Math.floor(Date.now()/cacheMs());
  const start=(bucket*width)%all.length;

  return Array.from(
    {length:width},
    (_,i)=>all[(start+i)%all.length]
  );
}

function marketsForSport(sport:string){
  switch(sport){

    case 'basketball_nba':
    case 'basketball_ncaab':
      return [
        'player_points',
        'player_rebounds',
        'player_assists',
        'player_threes',
        'player_steals',
        'player_blocks'
      ];

    case 'baseball_mlb':
      return [
        'pitcher_strikeouts',
        'pitcher_outs',
        'pitcher_hits_allowed',
        'batter_hits',
        'batter_home_runs',
        'batter_rbis',
        'batter_total_bases'
      ];

    case 'football_nfl':
    case 'football_ncaaf':
      return [
        'player_pass_yds',
        'player_pass_tds',
        'player_rush_yds',
        'player_reception_yds',
        'player_receptions',
        'player_anytime_td'
      ];

    case 'hockey_nhl':
      return [
        'player_goals',
        'player_shots_on_goal',
        'goalie_saves',
        'player_blocked_shots'
      ];

    case 'tennis':
      return [
        'player_aces',
        'player_games_won'
      ];

    case 'soccer_epl':
    case 'soccer_mls':
    case 'soccer_la_liga':
      return [
        'anytime_goal_scorer',
        'player_assists',
        'player_cards'
      ];

    default:
      return ['h2h','spreads','totals'];
  }
}

function cleanBook(book:any){
  return String(
    book?.title ||
    book?.key ||
    'PropLine'
  );
}

async function load(apiKey:string):Promise<Cached>{

  const started=Date.now();
  const rows:FlatRow[]=[];
  const warnings:string[]=[];

  const client=new PropLine(apiKey);

  await Promise.all(
    rotatingSports().map(async sport=>{

      try{

        const events:any[]=
          await client.getEvents(sport) as any[];

        const selected=events
          .filter(Boolean)
          .sort((a,b)=>{
            const at=new Date(
              a.commence_time ||
              a.start_time ||
              0
            ).getTime();

            const bt=new Date(
              b.commence_time ||
              b.start_time ||
              0
            ).getTime();

            return at-bt;
          })
          .slice(0,eventsPerSport());

        await Promise.all(
          selected.map(async event=>{

            try{

              const eventId=event.id;

              const odds:any=
                await client.getOdds(
                  sport,
                  {
                    eventId,
                    markets:marketsForSport(sport),
                    bookmakers:[
                      'draftkings',
                      'fanduel',
                      'pinnacle',
                      'bovada'
                    ],
                    includeBookIds:true
                  } as any
                );

              const home=String(
                event.home_team||''
              );

              const away=String(
                event.away_team||''
              );

              const startTime=String(
                event.commence_time ||
                event.start_time ||
                ''
              );

              if(!home||!away||!startTime){
                return;
              }

              for(const book of odds?.bookmakers||[]){

                const bookmaker=cleanBook(book);

                for(const market of book?.markets||[]){

                  const marketKey=String(
                    market?.key ||
                    market?.market_key ||
                    'player_prop'
                  );

                  for(const outcome of market?.outcomes||[]){

                    const price=
                      Number(outcome?.price);

                    if(!Number.isFinite(price)||price===0){
                      continue;
                    }

                    const player=String(
                      outcome?.description ||
                      outcome?.player_name ||
                      ''
                    ).trim();

                    const side=String(
                      outcome?.name ||
                      ''
                    ).trim();

                    const point=
                      Number(outcome?.point);

                    const selection=[
                      player,
                      side,
                      Number.isFinite(point)
                        ? String(point)
                        : ''
                    ]
                    .filter(Boolean)
                    .join(' ');

                    if(!selection){
                      continue;
                    }

                    const id=[
                      'propline',
                      sport,
                      String(eventId),
                      bookmaker,
                      marketKey,
                      String(outcome?.id||''),
                      selection
                    ].join(':');

                    rows.push({
                      id,
                      eventId:String(eventId),
                      sport,
                      league:sport,
                      event:`${away} @ ${home}`,
                      home,
                      away,
                      selection,
                      market:marketKey,
                      startTime,
                      odds:price,
                      bookmaker,
                      pulledAt:String(
                        book?.last_update ||
                        market?.last_update ||
                        new Date().toISOString()
                      )
                    });
                  }
                }
              }

            }catch(error){

              warnings.push(
                `${sport} event ${event.id}: ${
                  error instanceof Error
                    ? error.message
                    : 'PropLine odds request failed'
                }`
              );

            }
          })
        );

      }catch(error){

        warnings.push(
          `${sport}: ${
            error instanceof Error
              ? error.message
              : 'PropLine event request failed'
          }`
        );

      }
    })
  );

  return {
    at:Date.now(),
    rows,
    latencyMs:Date.now()-started,
    warnings:[...new Set(warnings)].slice(0,20)
  };
}

export function propLineProvider(
  env:Record<string,string|undefined>=process.env
):ProviderConfig|null{

  const key=env.PROPLINE_API_KEY?.trim();

  if(!key||env.PROPLINE_ENABLED==='false'){
    return null;
  }

  return {
    id:'propline',
    name:'PropLine Player Props',
    capability:'ODDS',
    url:'propline://player-props',
    apiKey:key,
    priority:Math.max(
      1,
      Number(env.PROPLINE_PRIORITY||118)
    ),
    timeoutMs:Math.max(
      3000,
      Number(env.PROPLINE_TIMEOUT_MS||12000)
    ),
    enabled:true,
    bookmaker:'PropLine',
    maxAgeMin:Math.max(
      1,
      Number(env.PROPLINE_MAX_AGE_MIN||20)
    ),
    failureThreshold:3,
    quarantineMin:5,
    marketRole:'REFERENCE',
    consensusWeight:Math.max(
      .1,
      Number(env.PROPLINE_CONSENSUS_WEIGHT||1)
    )
  };
}


export async function fetchPropLineBoard(
  config:ProviderConfig
):Promise<ProviderFetchResult<unknown>>{

  const base={
    providerId:config.id,
    providerName:config.name,
    capability:config.capability,
    receivedAt:new Date().toISOString()
  };

  if(cache&&Date.now()-cache.at<cacheMs()){

    return {
      ...base,
      ok:cache.rows.length>0,
      status:200,
      latencyMs:0,
      data:cache.rows,
      error:cache.rows.length
        ? undefined
        : cache.warnings.join(' | ')
    };
  }

  if(!inFlight){
    inFlight=load(
      config.apiKey||''
    ).finally(()=>{
      inFlight=null;
    });
  }

  try{

    const result=await inFlight;
    cache=result;

    return {
      ...base,
      ok:result.rows.length>0,
      status:200,
      latencyMs:result.latencyMs,
      data:result.rows,
      error:result.rows.length
        ? undefined
        : result.warnings.join(' | ') ||
          'PropLine returned no player props'
    };

  }catch(error){

    return {
      ...base,
      ok:false,
      status:503,
      latencyMs:0,
      error:
        error instanceof Error
          ? error.message
          : 'PropLine request failed'
    };
  }
}
