export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET && auth!==`Bearer ${process.env.INGEST_SECRET}`) return Response.json({ok:false,error:'unauthorized'},{status:401});
 const url=process.env.INJURY_FEED_URL;
 const key=process.env.INJURY_FEED_KEY;
 if(!url||!key)return Response.json({ok:true,mode:'demo',snapshots:0});
 const res=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
 return Response.json({ok:res.ok,mode:'live',payload:await res.json()});
}
