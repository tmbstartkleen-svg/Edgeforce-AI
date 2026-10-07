import 'server-only';
import {db} from '@/lib/db';

const TEAM_ID='team_XlvGJkid1lgNPLVGPJn1ScEr';
const PROJECT_ID='prj_CJokQ1ngz20Rwb7eNjk9gf3HjFHo';
const PRODUCTION_ALIAS='edgeforce-ai.vercel.app';
const GITHUB_REPO='tmbstartkleen-svg/Edgeforce-AI';
const REQUIRED_WORKFLOWS=['Verify Edgeforce','Verify Edgeforce Cloudflare'];

type MainRun={
  headSha:string;
  name:string;
  status:string;
  conclusion:string|null;
};

type BacklogCommit={
  sha:string;
  committedAt:string|null;
  message:string;
  certified:boolean;
  workflowStates:Record<string,{success:boolean;count:number}>;
};

function shaFromMeta(meta:any){
  return String(
    meta?.governorCommit||
    meta?.edgeforceCommit||
    meta?.githubCommitSha||
    meta?.githubCommit||
    ''
  );
}

async function vercelJson(url:string){
  const token=process.env.VERCEL_TOKEN||'';
  if(!token)throw new Error('VERCEL_TOKEN is not configured');
  const response=await fetch(url,{
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    cache:'no-store'
  });
  if(!response.ok)throw new Error('Vercel backlog request failed: '+response.status);
  return response.json() as Promise<any>;
}

async function githubJson(path:string){
  const response=await fetch('https://api.github.com/repos/'+GITHUB_REPO+path,{
    headers:{
      accept:'application/vnd.github+json',
      'user-agent':'edgeforce-v143-backlog'
    },
    next:{revalidate:300}
  });
  if(!response.ok)throw new Error('GitHub backlog request failed: '+response.status);
  return response.json() as Promise<any>;
}

async function liveProductionSha(){
  const alias=await vercelJson(
    'https://api.vercel.com/v4/aliases/'+PRODUCTION_ALIAS+
    '?projectId='+PROJECT_ID+'&teamId='+TEAM_ID
  );
  const direct=shaFromMeta(alias?.deployment?.meta);
  if(direct)return direct;
  const deploymentId=String(alias?.deploymentId||alias?.deployment?.id||alias?.deployment||'');
  if(!deploymentId)throw new Error('Production alias deployment id is unavailable');
  const deployment=await vercelJson(
    'https://api.vercel.com/v13/deployments/'+deploymentId+'?teamId='+TEAM_ID
  );
  const sha=shaFromMeta(deployment?.meta||deployment?.deployment?.meta);
  if(!sha)throw new Error('Production deployment commit SHA is unavailable');
  return sha;
}

export function evaluateReleaseBacklog({
  compare,
  runs,
  liveSha,
  now=Date.now()
}:{
  compare:any;
  runs:MainRun[];
  liveSha:string;
  now?:number;
}){
  const commits=Array.isArray(compare?.commits)?compare.commits:[];
  const totalCommits=Number(compare?.total_commits??commits.length);
  const headSha=String(compare?.head_commit?.sha||commits.at(-1)?.sha||liveSha||'');
  const truncated=totalCommits>commits.length;
  const bySha=new Map<string,MainRun[]>();
  for(const run of runs){
    const list=bySha.get(run.headSha)||[];
    list.push(run);
    bySha.set(run.headSha,list);
  }
  const commitStates:BacklogCommit[]=commits.map((commit:any)=>{
    const sha=String(commit?.sha||'');
    const matching=bySha.get(sha)||[];
    const workflowStates=Object.fromEntries(REQUIRED_WORKFLOWS.map(name=>{
      const candidates=matching.filter(run=>run.name===name);
      return [name,{
        success:candidates.some(run=>run.status==='completed'&&run.conclusion==='success'),
        count:candidates.length
      }];
    }));
    return {
      sha,
      committedAt:commit?.commit?.committer?.date||commit?.commit?.author?.date||null,
      message:String(commit?.commit?.message||'').split('\n')[0],
      certified:REQUIRED_WORKFLOWS.every(name=>workflowStates[name]?.success===true),
      workflowStates
    };
  });
  const certified=commitStates.filter(commit=>commit.certified);
  const newestCertified=certified.at(-1)||null;
  const oldest=commitStates[0]||null;
  const oldestMs=oldest?.committedAt?new Date(oldest.committedAt).getTime():0;
  const backlogAgeMinutes=oldestMs?Math.max(0,Math.floor((now-oldestMs)/60_000)):0;
  const headCertified=Boolean(headSha)&&newestCertified?.sha===headSha;
  const catchUpEligible=totalCommits>0&&!truncated&&headCertified&&Boolean(liveSha)&&liveSha!==headSha;
  let reason='production already matches the repository head';
  if(totalCommits>0&&truncated)reason='release backlog exceeds the inspected commit window';
  else if(totalCommits>0&&!headCertified)reason='current main SHA has not completed the exact-main certification set';
  else if(catchUpEligible)reason='current main SHA is exactly certified and may catch up when normal governed capacity is available';
  return {
    schemaVersion:'v143-certified-backlog-1',
    generatedAt:new Date(now).toISOString(),
    liveSha:liveSha||null,
    headSha:headSha||null,
    requiredWorkflows:REQUIRED_WORKFLOWS,
    backlogDepth:totalCommits,
    certifiedBacklogDepth:certified.length,
    backlogAgeMinutes,
    oldestWaitingAt:oldest?.committedAt||null,
    newestCertifiedSha:newestCertified?.sha||null,
    headCertified,
    truncated,
    catchUpEligible,
    reason,
    commits:commitStates
  };
}

export async function getEdgeforceReleaseBacklog(){
  try{
    const liveSha=await liveProductionSha();
    const [compare,runsPayload]=await Promise.all([
      githubJson('/compare/'+liveSha+'...main?per_page=100'),
      githubJson('/actions/runs?branch=main&per_page=100')
    ]);
    const runs:MainRun[]=(runsPayload?.workflow_runs||[]).map((run:any)=>({
      headSha:String(run?.head_sha||''),
      name:String(run?.name||''),
      status:String(run?.status||''),
      conclusion:run?.conclusion?String(run.conclusion):null
    }));
    return {ok:true as const,backlog:evaluateReleaseBacklog({compare,runs,liveSha}),error:null};
  }catch(error){
    return {
      ok:false as const,
      backlog:null,
      error:error instanceof Error?error.message:'Edgeforce release backlog unavailable'
    };
  }
}

export async function persistEdgeforceReleaseBacklog(backlog:ReturnType<typeof evaluateReleaseBacklog>){
  const sql=db();
  if(!sql)return {mode:'memory' as const,id:null,stored:false};
  try{
    const [latest]=await sql`
      select id,created_at as "createdAt"
      from edgeforce_release_backlog_snapshots
      order by created_at desc limit 1
    `;
    if(latest?.createdAt&&Date.now()-new Date(latest.createdAt).getTime()<15*60*1000){
      return {mode:'database' as const,id:Number(latest.id),stored:false};
    }
    const [row]=await sql`
      insert into edgeforce_release_backlog_snapshots(
        live_sha,head_sha,newest_certified_sha,backlog_depth,certified_backlog_depth,
        backlog_age_minutes,head_certified,catch_up_eligible,truncated,reason
      ) values(
        ${backlog.liveSha},${backlog.headSha},${backlog.newestCertifiedSha},
        ${backlog.backlogDepth},${backlog.certifiedBacklogDepth},${backlog.backlogAgeMinutes},
        ${backlog.headCertified},${backlog.catchUpEligible},${backlog.truncated},${backlog.reason}
      ) returning id
    `;
    return {mode:'database' as const,id:Number(row.id),stored:true};
  }catch{
    return {mode:'database' as const,id:null,stored:false};
  }
}

export async function recentEdgeforceReleaseBacklog(limit=24){
  const sql=db();
  if(!sql)return [];
  try{
    return await sql`
      select id,live_sha as "liveSha",head_sha as "headSha",newest_certified_sha as "newestCertifiedSha",
        backlog_depth as "backlogDepth",certified_backlog_depth as "certifiedBacklogDepth",
        backlog_age_minutes as "backlogAgeMinutes",head_certified as "headCertified",
        catch_up_eligible as "catchUpEligible",truncated,reason,created_at as "createdAt"
      from edgeforce_release_backlog_snapshots
      order by created_at desc
      limit ${Math.max(1,Math.min(96,limit))}
    `;
  }catch{return []}
}
