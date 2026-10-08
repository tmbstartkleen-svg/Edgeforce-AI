import{t as e}from"./db-9LtqYd6N.js";import{t}from"./modelPerformance-MBoIKhzt.js";import{i as n,r}from"./modelGovernance-DERBcsy-.js";import{r as i}from"./validationLab-CpfyTMQ0.js";var a=(e,t,n)=>Math.max(t,Math.min(n,e)),o=(e,t,n)=>[e,t,n].join(`|`);function s(e){let t={},n=new Map,r=new Map;for(let i of e){t[o(i.modelName,i.sport,i.marketKey)]=i.multiplier;let e=o(i.modelName,i.sport,`*`),a=n.get(e)||{sum:0,weight:0};a.sum+=i.multiplier*i.sampleSize,a.weight+=i.sampleSize,n.set(e,a);let s=o(i.modelName,`*`,`*`),c=r.get(s)||{sum:0,weight:0};c.sum+=i.multiplier*i.sampleSize,c.weight+=i.sampleSize,r.set(s,c)}for(let[e,r]of n)r.weight&&(t[e]=a(r.sum/r.weight,.75,1.25));for(let[e,n]of r)n.weight&&(t[e]=a(n.sum/n.weight,.8,1.2));return t}async function c(){let o=e();if(!o)return{};try{let e=await r().catch(()=>({})),c=await i().catch(()=>({})),l=await o`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",
    multiplier::float,sample_size as "sampleSize"
   from learned_model_weight_snapshots
   where promoted=true
   order by model_name,sport,market_key,as_of desc
  `;return l.length?s(l.map(t=>({modelName:String(t.modelName),sport:String(t.sport),marketKey:String(t.marketKey),multiplier:a((Number(t.multiplier)||1)*(e[n(String(t.modelName),String(t.sport),String(t.marketKey))]??1)*(c[n(String(t.modelName),String(t.sport),String(t.marketKey))]??1),.25,1.25),sampleSize:Math.max(1,Number(t.sampleSize)||1)}))):s(t(await o`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
    predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
   from historical_predictions
   where outcome is not null
   order by occurred_at desc
   limit 10000
  `).filter(e=>e.sampleSize>=25).map(t=>{let r=a(t.avgClv,-.05,.05)*2,i=a(1+(t.decayedScore-.65)*1.4-t.calibrationError*1.6+r,.75,1.25),o=e[n(t.modelName,t.sport,t.marketKey)]??1,s=c[n(t.modelName,t.sport,t.marketKey)]??1,l=a(i*o*s,.25,1.25);return{modelName:t.modelName,sport:t.sport,marketKey:t.marketKey,multiplier:l,sampleSize:t.sampleSize}}))}catch{return{}}}function l(e,t,n,r){return e?e[o(t,n,r)]??e[o(t,n,`*`)]??e[o(t,`*`,`*`)]??1:1}export{c as n,l as t};