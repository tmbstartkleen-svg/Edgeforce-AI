import fs from 'node:fs';
import path from 'node:path';

const configPath=path.resolve('dist/server/wrangler.json');
const failures=[];
let config=null;

if(!fs.existsSync(configPath)){
  failures.push('dist/server/wrangler.json was not generated. Run npm run build:vinext first.');
}else{
  try{
    config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  }catch(error){
    failures.push('dist/server/wrangler.json is not valid JSON: '+(error instanceof Error?error.message:String(error)));
  }
}

if(config){
  const main=String(config.main||'').trim();
  if(!main){
    failures.push('Generated Wrangler config has no main entry point.');
  }else{
    const mainPath=path.resolve(path.dirname(configPath),main);
    if(!fs.existsSync(mainPath))failures.push('Generated Worker entry point does not exist: '+mainPath);
  }
}

const schemaMarker='v48-recommendation-quality-1';
if(fs.existsSync('dist/server')){
  const stack=['dist/server'];
  let found=false;
  while(stack.length){
    const current=stack.pop();
    if(!current)continue;
    const stat=fs.statSync(current);
    if(stat.isDirectory()){
      for(const name of fs.readdirSync(current))stack.push(path.join(current,name));
    }else if(/\.(?:js|mjs|cjs|json)$/.test(current)){
      const text=fs.readFileSync(current,'utf8');
      if(text.includes(schemaMarker)){found=true;break}
    }
  }
  if(!found)failures.push('Generated Worker artifact is missing parlay schema marker '+schemaMarker);
}

const report={
  ok:failures.length===0,
  config:'dist/server/wrangler.json',
  main:config?.main||null,
  failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
