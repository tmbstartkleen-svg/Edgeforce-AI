export function impliedProbability(odds:number){return odds<0?(-odds)/(-odds+100):100/(odds+100)}
export function decimalOdds(odds:number){return odds>0?1+odds/100:1+100/Math.abs(odds)}
export function fairAmerican(p:number){if(p<=0||p>=1)return 0;return p>=.5?Math.round(-100*p/(1-p)):Math.round(100*(1-p)/p)}
export function ev(p:number,odds:number){const d=decimalOdds(odds);return p*(d-1)-(1-p)}
export function kelly(p:number,odds:number){const b=decimalOdds(odds)-1;return Math.max(0,(b*p-(1-p))/b)}
export function fmtPct(n:number){return (n*100).toFixed(1)+'%'}
export function fmtOdds(n:number){return (n>0?'+':'')+Math.round(n)}
