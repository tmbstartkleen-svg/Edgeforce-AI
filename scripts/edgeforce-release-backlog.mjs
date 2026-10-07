import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const REQUIRED_MAIN_WORKFLOWS=[
  'Verify Edgeforce',
  'Verify Edgeforce Cloudflare'
];

const asTime=value=>{
  const time=new Date(value||0).getTime();
  return Number.isFinite(time)?time:0;
};

export function evaluateReleaseBacklog({compare,runs,liveSha,headSha,now=Date.now(),requiredWorkflows=REQUIRED_MAIN_WORKFLOWS}){
  const commits=Array.isArray(compare?.commits)?compare.commits:[];
  const totalCommits=Number(compare?.totalCommits??commits.length);
  const truncated=totalCommits>commits.length;
  const runList=Array.isArray(runs)?runs:[];
  const bySha=new Map();
  for(const run of runList){
    const sha=String(run?.headSha||run?.head_sha||'');
    if(!sha)continue;
    const list=bySha.get(sha)||[];
    list.push(run);
    bySha.set(sha,list);
  }
  const commitStates=commits.map(commit=>{
    const sha=String(commit.sha||'');
    const matching=bySha.get(sha)||[];
    const workflowStates=Object.fromEntries(requiredWorkflows.map(name=>{
      const candidates=matching.filter(run=>String(run.name||'')===name);
      const success=candidates.some(run=>String(run.status||'')==='completed'&&String(run.conclusion||'')==='success');
      return [name,{success,count:candidates.length}];
    }));
    const certified=requiredWorkflows.every(name=>workflowStates[name]?.success===true);
    return {
      sha,
      committedAt:commit.committedAt||null,
      message:String(commit.message||'').split('\n')[0],
      certified,
      workflowStates
    };
  });
  const certifiedCommits=commitStates.filter(commit=>commit.certified);
  const newestCertified=certifiedCommits.at(-1)||null;
  const oldestWaiting=commitStates[0]||null;
  const oldestTime=asTime(oldestWaiting?.committedAt);
  const backlogAgeMinutes=oldestTime?Math.max(0,Math.floor((now-oldestTime)/60_000)):0;
  const headCertified=Boolean(headSha)&&newestCertified?.sha===headSha;
  const backlogDepth=totalCommits;
  const certifiedBacklogDepth=certifiedCommits.length;
  const catchUpEligible=backlogDepth>0&&!truncated&&headCertified&&Boolean(liveSha)&&liveSha!==headSha;
  let reason='production already matches the repository head';
  if(backlogDepth>0&&truncated)reason='release backlog exceeds the inspected commit window';
  else if(backlogDepth>0&&!headCertified)reason='current main SHA has not completed the exact-main certification set';
  else if(catchUpEligible)reason='current main SHA is exactly certified and may catch up when normal governed capacity is available';
  return {
    schemaVersion:'v143-certified-backlog-1',
    generatedAt:new Date(now).toISOString(),
    liveSha:liveSha||null,
    headSha:headSha||null,
    requiredWorkflows,
    backlogDepth,
    certifiedBacklogDepth,
    backlogAgeMinutes,
    oldestWaitingAt:oldestWaiting?.committedAt||null,
    newestCertifiedSha:newestCertified?.sha||null,
    headCertified,
    truncated,
    catchUpEligible,
    reason,
    commits:commitStates
  };
}

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const [mode,compareFile,runsFile,liveSha,headSha]=process.argv.slice(2);
    if(mode!=='evaluate')throw new Error('Usage: edgeforce-release-backlog.mjs evaluate <compare> <runs> <liveSha> <headSha>');
    const result=evaluateReleaseBacklog({
      compare:readJson(compareFile),
      runs:readJson(runsFile),
      liveSha,
      headSha
    });
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(error){
    console.error(error instanceof Error?error.message:'Edgeforce release backlog evaluation failed');
    process.exitCode=1;
  }
}
