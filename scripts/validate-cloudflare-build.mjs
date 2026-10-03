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

const report={
  ok:failures.length===0,
  config:'dist/server/wrangler.json',
  main:config?.main||null,
  failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
