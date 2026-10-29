export type TrackedTicket={id:string;stake:number;decimalOdds:number;status:'open'|'won'|'lost'|'void';legs:Array<{sport:string}>};
const sportFor=(league:string)=>{
 if(/^(NBA|WNBA|NCAAB|NCAA Basketball|Euroleague|Basketball)/i.test(league))return 'Basketball';
 if(/^(NFL|NCAAF|NCAA Football|CFL|American Football)/i.test(league))return 'American football';
 if(/^(MLB|NPB|KBO|Baseball)/i.test(league))return 'Baseball';
 if(/^(NHL|Ice Hockey|Hockey)/i.test(league))return 'Ice hockey';
 if(/^(ATP|WTA|Tennis)/i.test(league))return 'Tennis';
 if(/^(EPL|English Premier League|UEFA|La Liga|Bundesliga|Serie A|Ligue 1|MLS|Soccer|FIFA)/i.test(league))return 'Soccer';
 if(/^(MMA|UFC)/i.test(league))return 'MMA';
 return 'Unclassified';
};
export function summarizeTickets(tickets:TrackedTicket[],dimension:'sport'|'league'){
 const groups=new Map<string,{name:string;won:number;lost:number;open:number;void:number;stake:number;profit:number}>();
 for(const ticket of tickets){
  const leagues=[...new Set(ticket.legs.map(l=>l.sport.trim()||'Unknown league'))];
  const values=dimension==='league'?leagues:[...new Set(leagues.map(sportFor))];
  const name=values.length>1?`Mixed ${dimension} parlay`:values[0]||'Unknown';
  const row=groups.get(name)||{name,won:0,lost:0,open:0,void:0,stake:0,profit:0};row[ticket.status]++;
  if((ticket.status==='won'||ticket.status==='lost')&&Number.isFinite(ticket.stake)&&ticket.stake>0&&Number.isFinite(ticket.decimalOdds)&&ticket.decimalOdds>1){row.stake+=ticket.stake;row.profit+=ticket.status==='won'?ticket.stake*(ticket.decimalOdds-1):-ticket.stake;}
  groups.set(name,row);
 }
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
