import {getConsoleSnapshot} from '@/lib/consoleData';
export async function GET(){
 return Response.json(await getConsoleSnapshot());
}
