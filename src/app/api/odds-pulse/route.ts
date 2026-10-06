import {fetchFanDuelOddsPulse} from '@/lib/providers/fanLineWire';

export const dynamic='force-dynamic';

export async function GET(){
 const pulse=await fetchFanDuelOddsPulse();
 return Response.json(pulse,{
  status:pulse.ok?200:503,
  headers:{
   'Cache-Control':'no-store, max-age=0',
   'CDN-Cache-Control':'no-store',
   'Cloudflare-CDN-Cache-Control':'no-store'
  }
 });
}
