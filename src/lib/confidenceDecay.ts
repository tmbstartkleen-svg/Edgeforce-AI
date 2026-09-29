export function confidenceDecay(ageDays:number,halfLifeDays=45){const age=Math.max(0,ageDays);return Math.pow(.5,age/Math.max(1,halfLifeDays));}

export function recencyWeightedScore(rows:{occurredAt:string;score:number}[],halfLifeDays=45,now=new Date()){let weighted=0,total=0;for(const row of rows){const ageDays=Math.max(0,(now.getTime()-new Date(row.occurredAt).getTime())/86400000);const w=confidenceDecay(ageDays,halfLifeDays);weighted+=row.score*w;total+=w;}return total?weighted/total:0;}
