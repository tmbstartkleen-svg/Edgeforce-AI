import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./predictiveIncidentRisk-KpbzZiS2.js";import{n as r,r as i}from"./preventiveActionLearning-D5uPnDdu.js";var a=e=>Math.max(0,Math.min(1,e));function o(e,t,n,r){let o=new Map(r.filter(t=>t.cause===e).map(e=>[e.actionKey,e])),s=new Set,c=[];for(let r of n){let n=i(r);if(s.has(n))continue;s.add(n);let l=o.get(n),u=l?.effectivenessScore??.5,d=l?.confidence??0,f=l?.sampleSize??0,p=f>=8&&d>=.8?`STRONG`:f>=4&&d>=.45?`MODERATE`:f>=1?`LIMITED`:`NEW`,m=f===0?.04:0,h=a(t*.45+u*.35+d*.16+m),g=[`Current ${e} risk is ${Math.round(t*100)}%.`,f?`Learned effectiveness is ${Math.round(u*100)}% from ${f} evaluated window(s).`:`No direct effectiveness history yet; ranking uses neutral prior evidence.`,`Evidence quality: ${p}.`];c.push({cause:e,actionKey:n,actionText:r,priorityScore:h,effectivenessScore:u,confidence:d,sourceRiskScore:t,evidenceQuality:p,reason:g})}return c.sort((e,t)=>t.priorityScore-e.priorityScore||t.confidence-e.confidence)}async function s(e){let[t,i]=await Promise.all([e?.risk?Promise.resolve(e.risk):n(),e?.learning?Promise.resolve(e.learning):r()]),a=t.componentRisks.find(e=>e.cause===t.predictedCause)||t.componentRisks[0],s=t.predictedCause,c=a?.preventiveActions||t.preventiveActions||[],l=i.profiles.map(e=>({cause:String(e.cause),actionKey:String(e.actionKey),effectivenessScore:Number(e.effectivenessScore||0),confidence:Number(e.confidence||0),sampleSize:Number(e.sampleSize||0)})),u=o(s,t.riskScore,c,l),d=u[0]||null;return{generatedAt:new Date().toISOString(),predictedCause:s,sourceRiskScore:t.riskScore,sourceRiskLevel:t.riskLevel,topRecommendation:d,recommendations:u,decision:`ADVISORY_ONLY`,notes:[`V79 ranks candidate safeguards using current predictive risk plus V78 learned effectiveness evidence.`,`Recommendations remain operator-confirmed and never execute automatically.`]}}async function c(n){let r=e();if(!r)return{persisted:!1};let i=n.topRecommendation;return await r`
  insert into preventive_action_ranking_snapshots(
   model_version,predicted_cause,source_risk_score,source_risk_level,
   top_action_key,top_action_text,top_priority_score,recommendations
  ) values(
   ${t.modelVersion},${n.predictedCause},${n.sourceRiskScore},${n.sourceRiskLevel},
   ${i?.actionKey||null},${i?.actionText||null},${i?.priorityScore||0},
   ${r.json(n.recommendations)}
  )
 `,{persisted:!0}}async function l(e){let t=await s(e),n=await c(t);return{...t,persistence:n}}async function u(){let t=await s(),n=e();if(!n)return{...t,recent:[]};try{let e=await n`
   select id,model_version as "modelVersion",predicted_cause as "predictedCause",
    source_risk_score::float as "sourceRiskScore",source_risk_level as "sourceRiskLevel",
    top_action_key as "topActionKey",top_action_text as "topActionText",
    top_priority_score::float as "topPriorityScore",generated_at as "generatedAt"
   from preventive_action_ranking_snapshots
   order by generated_at desc limit 20
  `;return{...t,recent:e}}catch{return{...t,recent:[]}}}export{l as i,u as n,o as r,s as t};