export type PlayerStreakInput = {
  playerId:string; games:Array<{
    eventId:string; playerId:string; date:string; completed:boolean;
    stats:Record<string,unknown>; sourceUrl?:string; source?:string;
  }>;
  stat:string; threshold:number; asOf:string; source?:string;
};
export type PlayerStreakReview = {
  playerId:string; status:'OBSERVED_HISTORY_ONLY'|'INSUFFICIENT_HISTORY';
  modelProbability:null; executableSelection:false;
  last5:{requested:number;observed:number;hits:number;hitRate:number|null;complete:boolean;values:number[]};
  last10:{requested:number;observed:number;hits:number;hitRate:number|null;complete:boolean;values:number[]};
  verifiedGames:number; consecutive:number; rejectedCount:number;
  [key:string]:unknown;
};
export function reviewPlayerStreakEvidence(input:PlayerStreakInput):PlayerStreakReview;
