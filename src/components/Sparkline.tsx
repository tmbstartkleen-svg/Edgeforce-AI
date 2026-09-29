'use client';

export default function Sparkline({values,label}:{values:number[];label:string}){
 const clean=values.filter(Number.isFinite);
 if(clean.length<2)return <div className="sparkEmpty">{label}: not enough data</div>;
 const min=Math.min(...clean),max=Math.max(...clean),span=Math.max(.000001,max-min);
 const points=clean.map((v,i)=>{
  const x=(i/(clean.length-1))*100;
  const y=100-((v-min)/span)*100;
  return x.toFixed(2)+','+y.toFixed(2);
 }).join(' ');
 return <div className="sparkWrap"><small>{label}</small><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="spark"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/></svg><div className="sparkRange"><span>{min.toFixed(2)}</span><span>{max.toFixed(2)}</span></div></div>;
}
