export type LinePoint={odds:number;pulledAt:string|Date};

export function movement(points:LinePoint[]){
  if(points.length<2)return {direction:'FLAT',deltaOdds:0,velocityPerHour:0};
  const newest=points[0];
  const oldest=points[points.length-1];
  const delta=newest.odds-oldest.odds;
  const hours=Math.max(.01,(new Date(newest.pulledAt).getTime()-new Date(oldest.pulledAt).getTime())/3600000);
  return {
    direction:delta>3?'UP':delta<-3?'DOWN':'FLAT',
    deltaOdds:delta,
    velocityPerHour:delta/hours
  };
}
