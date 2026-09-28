import {demoPlayers} from '@/lib/players';
export async function GET(){return Response.json({count:demoPlayers.length,players:demoPlayers});}
