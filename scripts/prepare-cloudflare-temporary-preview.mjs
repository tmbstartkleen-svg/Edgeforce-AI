import fs from 'node:fs';
import path from 'node:path';

const source=path.resolve('dist/server/wrangler.json');
const target=path.resolve('dist/server/wrangler.temporary.json');
if(!fs.existsSync(source))throw new Error('generated Wrangler config is missing');

const config=JSON.parse(fs.readFileSync(source,'utf8'));
config.name='edgeforce-ai-v104-preview';
delete config.account_id;
delete config.route;
delete config.routes;
delete config.triggers;

const sourceVars=config.vars&&typeof config.vars==='object'?config.vars:{};
config.vars={
  MODEL_VERSION:'edgeforce-v104',
  DEPLOYMENT_PLATFORM:'cloudflare',
  DEPLOYMENT_ENV:'preview',
  DEFAULT_BANKROLL:String(sourceVars.DEFAULT_BANKROLL||'1000'),
  ALLOW_DEMO_DATA:'false',
  EDGEFORCE_SLO_TARGET:String(sourceVars.EDGEFORCE_SLO_TARGET||'0.99')
};

fs.writeFileSync(target,JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({
  ok:true,
  target:'dist/server/wrangler.temporary.json',
  main:config.main,
  name:config.name,
  variableCount:Object.keys(config.vars).length
}));
