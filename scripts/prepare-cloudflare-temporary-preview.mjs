import fs from 'node:fs';
import path from 'node:path';

const source=path.resolve('dist/server/wrangler.json');
const target=path.resolve('dist/server/wrangler.temporary.json');
if(!fs.existsSync(source))throw new Error('generated Wrangler config is missing');

const config=JSON.parse(fs.readFileSync(source,'utf8'));
config.name='edgeforce-ai-v102-preview';
delete config.account_id;
delete config.route;
delete config.routes;
delete config.triggers;
if(config.vars&&typeof config.vars==='object'){
  config.vars={
    ...config.vars,
    DEPLOYMENT_ENV:'preview',
    MODEL_VERSION:'edgeforce-v102'
  };
}
fs.writeFileSync(target,JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({ok:true,target:'dist/server/wrangler.temporary.json',main:config.main,name:config.name}));
