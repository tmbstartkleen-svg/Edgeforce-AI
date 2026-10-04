import {externalMlTournamentStatus} from '@/lib/externalMlTournament';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await externalMlTournamentStatus();
 return Response.json({
  ...status,
  build:'V55',
  schemaVersion:'v55-external-ml-tournament-1'
 },{headers:{'Cache-Control':'no-store'}});
}
