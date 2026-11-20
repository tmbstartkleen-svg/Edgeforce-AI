import type {StatGame} from './playerStatQuestions';

export type PlayerEvidenceStatus = {
  usableForResearch:boolean;
  usableForLiveForecast:false;
  recordedGames:number;
  latestGameDate:string|null;
  uniqueSources:string[];
  warnings:string[];
};

/** This checks only recorded history, not live roster/injury availability. */
export function assessPlayerEvidence(games:Array<StatGame & {source?:string}>, asOf=new Date()):PlayerEvidenceStatus {
  const warnings:string[]=[];
  const dated=games.map(g=>g.stat_date?new Date(g.stat_date):null).filter((d):d is Date=>d!==null&&Number.isFinite(d.getTime()));
  const latest=dated.length?new Date(Math.max(...dated.map(d=>d.getTime()))):null;
  const uniqueSources=Array.from(new Set(games.map(g=>g.source?.trim()).filter((s):s is string=>Boolean(s))));
  if(games.length<5)warnings.push('Fewer than five game logs are available.');
  if(dated.length!==games.length)warnings.push('Some game dates are missing or invalid.');
  if(!latest)warnings.push('No valid game date available.');
  else if(latest.getTime()>asOf.getTime())warnings.push('A game date is in the future; verify source timestamps.');
  else if(asOf.getTime()-latest.getTime()>45*86400000)warnings.push('Latest recorded game is older than 45 days; check offseason or stale ingestion.');
  if(!uniqueSources.length)warnings.push('Game-log source attribution is missing.');
  warnings.push('Current injuries, roster status, confirmed lineups and opponent context have not been verified by this check.');
  return {
    usableForResearch:games.length>=5&&dated.length===games.length,
    usableForLiveForecast:false,
    recordedGames:games.length,
    latestGameDate:latest?latest.toISOString():null,
    uniqueSources,
    warnings
  };
}
