import {createServer} from 'node:http';
import {createFreeSportsApi} from '../src/lib/intelligence-core/free-sports-api.mjs';
const port=Number(process.env.FREE_SPORTS_API_PORT||8788);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid FREE_SPORTS_API_PORT');
if((process.env.FREE_SPORTS_API_TOKEN||'').length<24)throw new Error('Set FREE_SPORTS_API_TOKEN to a random token of at least 24 characters');
const handle=createFreeSportsApi({apiKey:process.env.BETSTACK_API_KEY,operatorToken:process.env.FREE_SPORTS_API_TOKEN});
createServer(async(req,res)=>{
 try{
  const response=await handle(new Request(new URL(req.url||'/',`http://127.0.0.1:${port}`),{method:req.method,headers:req.headers}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"ok":false,"error":"REQUEST_FAILED"}')}
}).listen(port,'127.0.0.1',()=>console.log(`Free sports API listening on http://127.0.0.1:${port}; no automatic polling or archive writes.`));
