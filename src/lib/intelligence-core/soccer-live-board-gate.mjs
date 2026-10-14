// Until licensed odds and approved scoreboard fixture joins exist, suppress soccer picks.
// Classify explicit soccer codes, not generic "football" which includes NFL.
export function isSoccerBoardRow(row){
 const sport=String(row?.sport??'').trim().toLowerCase();
 return sport==='soccer'||sport==='association football'||sport.startsWith('soccer-')||
  ['epl','premier league','la liga','bundesliga','serie a','ligue 1','mls','liga mx','ucl','champions league','nwsl'].includes(sport);
}
export function enforceSoccerEvidence(rows){
 const eligible=[],withheld=[];
 for(const row of rows){
  if(isSoccerBoardRow(row)){withheld.push(row);}
  else eligible.push(row);
 }
 return {eligible,withheldSoccerCount:withheld.length,reason:'SOCCER_FIXTURE_AND_AUTHORIZED_ODDS_JOIN_UNAVAILABLE',gateEnforced:true,
  note:'Soccer recommendations require a verified fixture match to approved score observations and authorized sportsbook odds; no complete join is currently operational.'};
}
