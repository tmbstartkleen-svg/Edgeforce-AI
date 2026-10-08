import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function GET(){

 return NextResponse.json({
  ok:true,
  ready:{
   launchReady:true,
   provider:'certified'
  },
  blocked:{
   launchReady:false,
   provider:'failed'
  }
 });
}
