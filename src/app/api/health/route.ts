export async function GET(){
 return Response.json({ok:true,app:'Edgeforce AI',version:'4.0.0',time:new Date().toISOString()});
}
