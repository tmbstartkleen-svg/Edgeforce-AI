import {parseEspnScoreboard,matchEspnEvent,parseEspnInjuries,deriveInjurySignals,deriveRestDays} from '@/lib/providers/publicSportsContext';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';

export async function GET(){
 const scoreboard={
  events:[{
   id:'401-test',
   date:'2026-10-04T17:00:00Z',
   name:'Dallas Cowboys at New York Giants',
   competitions:[{
    competitors:[
     {homeAway:'home',team:{id:'19',displayName:'New York Giants'},records:[{summary:'3-1'}]},
     {homeAway:'away',team:{id:'6',displayName:'Dallas Cowboys'},records:[{summary:'2-2'}]}
    ],
    venue:{fullName:'MetLife Stadium',indoor:false,address:{city:'East Rutherford',state:'NJ',country:'USA'}}
   }]
  }]
 };
 const market:Market={
  id:'odds-test',sport:'NFL',league:'NFL',event:'Dallas Cowboys @ New York Giants',
  selection:'New York Giants',market:'h2h',startTime:'2026-10-04T17:00:00Z',
  home:'New York Giants',away:'Dallas Cowboys',odds:-120,marketProb:.55,modelProb:.57,
  confidence:.7,sourceAgeMin:1,period:'PM'
 };
 const events=parseEspnScoreboard(scoreboard);
 const matched=matchEspnEvent(market,events);

 const injuriesPayload={
  injuries:[
   {team:{displayName:'New York Giants'},athlete:{displayName:'Starter QB',position:{abbreviation:'QB'}},status:'Out'},
   {team:{displayName:'New York Giants'},athlete:{displayName:'Guard A',position:{abbreviation:'G'}},status:'Questionable'},
   {team:{displayName:'Dallas Cowboys'},athlete:{displayName:'Wide Receiver B',position:{abbreviation:'WR'}},status:'Questionable'}
  ]
 };
 const injuries=parseEspnInjuries(injuriesPayload);
 const signals=deriveInjurySignals('New York Giants','Dallas Cowboys',injuries,'nfl');

 const schedule={
  events:[
   {date:'2026-09-27T17:00:00Z'},
   {date:'2026-10-01T17:00:00Z'},
   {date:'2026-10-04T17:00:00Z'}
  ]
 };
 const rest=deriveRestDays(schedule,'2026-10-04T17:00:00Z');

 const ok=
  events.length===1 &&
  matched?.event?.id==='401-test' &&
  matched.event.venue?.city==='East Rutherford' &&
  injuries.length===3 &&
  Number(signals.injury)>0 &&
  Number(signals.quarterback)<0 &&
  rest!==undefined&&rest>2.9&&rest<3.1;

 return Response.json({ok,event:matched?.event||null,injuries,signals,rest},{headers:{'Cache-Control':'no-store'}});
}
