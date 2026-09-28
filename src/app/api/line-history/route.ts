const points=[
 {minutesAgo:180,odds:-145},{minutesAgo:120,odds:-152},{minutesAgo:60,odds:-160},{minutesAgo:15,odds:-167}
];
export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 return Response.json({marketId:searchParams.get('marketId')||'demo',points});
}
