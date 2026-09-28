import type {Market} from './types';

export type SportFeatureMap=Record<string,number>;
export type SportModelResult={
 sport:string;
 baseProbability:number;
 adjustedProbability:number;
 adjustment:number;
 featureScore:number;
 features:SportFeatureMap;
 factors:string[];
};

const clamp=(x:number,min=-1,max=1)=>Math.max(min,Math.min(max,x));
const pClamp=(x:number)=>Math.max(.01,Math.min(.99,x));

function feature(raw:unknown,fallback=0){
 const n=typeof raw==='number'?raw:fallback;
 return clamp(n);
}

function weighted(features:SportFeatureMap,weights:SportFeatureMap){
 let score=0,weight=0;
 for(const [k,w] of Object.entries(weights)){
  score+=(features[k]??0)*w;
  weight+=Math.abs(w);
 }
 return weight?score/weight:0;
}

const WEIGHTS:Record<string,SportFeatureMap>={
 NFL:{home:.10,injury:.18,quarterback:.22,offenseDefense:.15,rest:.07,weather:.10,trenches:.10,turnover:.08},
 MLB:{home:.05,starter:.24,bullpen:.17,offenseHandedness:.13,park:.10,weather:.10,rest:.05,defense:.07,lineup:.09},
 NBA:{home:.08,injury:.20,usage:.16,pace:.13,rest:.12,matchup:.12,shooting:.11,travel:.08},
 WNBA:{home:.08,injury:.20,usage:.17,pace:.13,rest:.11,matchup:.12,shooting:.11,travel:.08},
 NCAAB:{home:.13,injury:.11,tempo:.13,efficiency:.18,rebounding:.12,turnover:.10,travel:.08,experience:.15},
 NHL:{home:.07,goalie:.24,injury:.12,shotQuality:.15,specialTeams:.14,rest:.10,travel:.08,pace:.10},
 NCAAF:{home:.12,quarterback:.18,injury:.12,efficiency:.16,trenches:.14,tempo:.08,weather:.09,travel:.05,turnover:.06},
 Soccer:{home:.10,xg:.22,injury:.11,keeper:.10,rest:.08,travel:.06,form:.12,tactical:.11,setPieces:.10},
 Tennis:{surface:.22,serve:.18,return:.18,form:.15,fatigue:.10,injury:.10,headToHead:.07},
 UFC:{striking:.15,grappling:.17,takedownDefense:.13,cardio:.13,reach:.08,ageCurve:.08,form:.10,finishRisk:.08,weightCut:.08},
 Golf:{courseFit:.20,approach:.18,offTee:.13,putting:.10,recentForm:.13,weather:.11,fieldStrength:.08,travel:.07}
};

function canonicalSport(sport:string){
 const s=sport.toUpperCase();
 if(s.includes('NFL'))return 'NFL';
 if(s.includes('MLB'))return 'MLB';
 if(s.includes('WNBA'))return 'WNBA';
 if(s.includes('NBA'))return 'NBA';
 if(s.includes('NCAAB')||s.includes('COLLEGE BASKETBALL'))return 'NCAAB';
 if(s.includes('NHL'))return 'NHL';
 if(s.includes('NCAAF')||s.includes('COLLEGE FOOTBALL'))return 'NCAAF';
 if(s.includes('SOCCER')||s.includes('FOOTBALL'))return 'Soccer';
 if(s.includes('TENNIS')||s.includes('ATP')||s.includes('WTA'))return 'Tennis';
 if(s.includes('UFC')||s.includes('MMA'))return 'UFC';
 if(s.includes('GOLF')||s.includes('PGA'))return 'Golf';
 return sport;
}

export function sportModel(m:Market,raw:SportFeatureMap={}):SportModelResult{
 const sport=canonicalSport(m.sport||m.league);
 const weights=WEIGHTS[sport]||{home:.12,injury:.18,form:.20,matchup:.20,rest:.10,market:.20};
 const features:SportFeatureMap={};
 for(const k of Object.keys(weights))features[k]=feature(raw[k]);
 const score=weighted(features,weights);
 const confidenceScale=.025+.035*Math.max(.35,Math.min(1,m.confidence));
 const adjustment=clamp(score*confidenceScale,-.075,.075);
 const adjustedProbability=pClamp(m.modelProb+adjustment);
 const factors=Object.entries(features)
  .filter(([,v])=>Math.abs(v)>=.15)
  .sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]))
  .slice(0,5)
  .map(([k,v])=>`${k} ${v>=0?'+':''}${(v*100).toFixed(0)}`);
 return {sport,baseProbability:m.modelProb,adjustedProbability,adjustment,featureScore:score,features,factors};
}

export function sportModelCatalog(){
 return Object.entries(WEIGHTS).map(([sport,weights])=>({sport,features:Object.keys(weights),weights}));
}
