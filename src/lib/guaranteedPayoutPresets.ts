import {scanGuaranteedPayout,type ArbGame,type ArbTicket} from './guaranteedPayoutScanner';

/** Paper-only fixtures with all tickets assumed filled and settlement matched. */
export type ArbPreset='soccer_three_way'|'binary_cross_venue'|'two_game_full_cover'|'incomplete_cover';
export function runArbPreset(preset:ArbPreset){
 const game=(id:string,outcomes:string[]):ArbGame=>({id,outcomes});
 const ticket=(id:string,selections:Record<string,string>,stake:number,decimalOdds:number):ArbTicket=>({
  id,venue:'paper_fixture',selections,stake,decimalOdds,fees:0,fullyFilled:true
 });
 let games:ArbGame[]=[];
 let tickets:ArbTicket[]=[];
 switch(preset){
 case 'soccer_three_way':
  games=[game('soccer',['home','draw','away'])];
  tickets=[ticket('h',{soccer:'home'},30,100/30),ticket('d',{soccer:'draw'},20,5),ticket('a',{soccer:'away'},35,100/35)];
  break;
 case 'binary_cross_venue':
  games=[game('binary',['yes','no'])];
  tickets=[ticket('yes',{binary:'yes'},42,100/42),ticket('no',{binary:'no'},52,100/52)];
  break;
 case 'two_game_full_cover':
  games=[game('game1',['home','away']),game('game2',['home','away'])];
  tickets=[ticket('hh',{game1:'home',game2:'home'},20,5),ticket('ha',{game1:'home',game2:'away'},20,5),
   ticket('ah',{game1:'away',game2:'home'},20,5),ticket('aa',{game1:'away',game2:'away'},20,5)];
  break;
 case 'incomplete_cover':
  games=[game('game1',['home','away']),game('game2',['home','away'])];
  tickets=[ticket('hh',{game1:'home',game2:'home'},20,5),ticket('ha',{game1:'home',game2:'away'},20,5),
   ticket('ah',{game1:'away',game2:'home'},20,5)];
  break;
 }
 return scanGuaranteedPayout(games,tickets,true);
}
