import {firstChampionTournamentStatus} from '@/lib/mlFirstTournament';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await firstChampionTournamentStatus();
 return Response.json(status,{headers:{'Cache-Control':'no-store'}});
}
