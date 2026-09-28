import type {Market} from './types';
import type {SportFeatureMap} from './sportModels';

const clip=(x:number)=>Math.max(-1,Math.min(1,x));
const norm=(value:number,center:number,scale:number)=>clip((value-center)/scale);

export type HistoricalContext={
 homeWinRate?:number;
 awayWinRate?:number;
 recentWinRate?:number;
 restDays?:number;
 travelMiles?:number;
 injuryImpact?:number;
 weatherSeverity?:number;
 paceIndex?:number;
 usageIndex?:number;
 matchupIndex?:number;
 efficiencyIndex?:number;
 playerForm?:number;
 starterEdge?:number;
 bullpenEdge?:number;
 goalieEdge?:number;
 xgEdge?:number;
 surfaceEdge?:number;
 serveEdge?:number;
 returnEdge?:number;
};

export function engineerFeatures(m:Market,c:HistoricalContext={}):SportFeatureMap{
 const home=typeof c.homeWinRate==='number'&&typeof c.awayWinRate==='number'?clip((c.homeWinRate-c.awayWinRate)*2):0;
 const form=typeof c.recentWinRate==='number'?norm(c.recentWinRate,.5,.25):0;
 const injury=typeof c.injuryImpact==='number'?-clip(c.injuryImpact):0;
 const rest=typeof c.restDays==='number'?norm(c.restDays,3,3):0;
 const travel=typeof c.travelMiles==='number'?-norm(c.travelMiles,500,1500):0;
 const weather=typeof c.weatherSeverity==='number'?-clip(c.weatherSeverity):0;
 return {
  home,form,injury,rest,travel,weather,
  quarterback:c.playerForm??0,
  offenseDefense:c.matchupIndex??0,
  trenches:c.efficiencyIndex??0,
  turnover:0,
  starter:c.starterEdge??0,
  bullpen:c.bullpenEdge??0,
  offenseHandedness:c.matchupIndex??0,
  park:0,defense:c.efficiencyIndex??0,lineup:c.usageIndex??0,
  usage:c.usageIndex??0,pace:c.paceIndex??0,matchup:c.matchupIndex??0,shooting:c.efficiencyIndex??0,
  tempo:c.paceIndex??0,efficiency:c.efficiencyIndex??0,rebounding:0,experience:0,
  goalie:c.goalieEdge??0,shotQuality:c.efficiencyIndex??0,specialTeams:c.matchupIndex??0,
  xg:c.xgEdge??0,keeper:c.goalieEdge??0,tactical:c.matchupIndex??0,setPieces:0,
  surface:c.surfaceEdge??0,serve:c.serveEdge??0,return:c.returnEdge??0,fatigue:-Math.max(0,rest),headToHead:c.matchupIndex??0,
  striking:c.efficiencyIndex??0,grappling:c.matchupIndex??0,takedownDefense:0,cardio:c.playerForm??0,reach:0,ageCurve:0,finishRisk:0,weightCut:injury,
  courseFit:c.matchupIndex??0,approach:c.efficiencyIndex??0,offTee:c.playerForm??0,putting:0,recentForm:form,fieldStrength:0
 };
}
