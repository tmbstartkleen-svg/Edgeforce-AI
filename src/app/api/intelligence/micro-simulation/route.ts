export const dynamic='force-dynamic';

export async function GET(){
 return Response.json({
  ok:true,
  engines:[
   {sport:'MLB',engine:'MLB_PLATE_APPEARANCE_MONTE_CARLO',microUnit:'plate appearances'},
   {sport:'NFL / NCAAF',engine:'FOOTBALL_DRIVE_MONTE_CARLO',microUnit:'drives'},
   {sport:'NBA / WNBA / NCAAB',engine:'BASKETBALL_POSSESSION_MONTE_CARLO',microUnit:'possessions'},
   {sport:'NHL',engine:'NHL_SHIFT_MONTE_CARLO',microUnit:'shifts'},
   {sport:'Soccer',engine:'SOCCER_CHANCE_MONTE_CARLO',microUnit:'chances'},
   {sport:'Tennis',engine:'TENNIS_POINT_GAME_SET_MONTE_CARLO',microUnit:'points'},
   {sport:'Table Tennis',engine:'TABLE_TENNIS_POINT_GAME_MONTE_CARLO',microUnit:'points'}
  ],
  fallback:'Unsupported or underspecified markets continue through distribution/team-score/probability-state engines.'
 },{headers:{'Cache-Control':'no-store'}});
}
