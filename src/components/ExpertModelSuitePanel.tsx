'use client';

import {useEffect,useMemo,useState} from 'react';

type CatalogEntry={
 id:string;name:string;family:string;kind:'MODEL'|'SOFTWARE'|'DATA_PLATFORM'|'MLOPS';
 integration:string;status:'ACTIVE'|'BRIDGE_READY'|'CONFIGURED'|'LICENSE_REQUIRED';
 sports:string[];purpose:string;requires:string[];activeOnCurrentSlate?:boolean;
};
type ModelOutput={
 id:string;name:string;family:string;probability:number;confidence:number;source:string;explanation:string;
};
type MarketRow={
 id:string;sport:string;event:string;selection:string;market:string;odds:number;
 marketProbability:number;baseModelProbability:number;expertProbability:number;expertEdge:number;
 expertModelCount:number;externalModelCount:number;agreement:number;coverage:number;models:ModelOutput[];
};
type Payload={
 ok:boolean;
 summary:{
  nativeModels:number;bridgeTools:number;configuredBridgeTools:number;premiumDataPlatforms:number;
  configuredPremiumPlatforms:number;mlopsTools:number;externalModelServiceConfigured:boolean;
  slateMarkets:number;marketsWithFivePlusModels:number;marketsWithExternalModels:number;
  averageExpertModels:number;averageAgreement:number;
 };
 catalog:CatalogEntry[];
 topMarkets:MarketRow[];
 warnings:string[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const statusLabel=(x:CatalogEntry)=>{
 if(x.activeOnCurrentSlate&&x.kind==='MODEL')return 'LIVE';
 if(x.status==='CONFIGURED')return 'CONNECTED';
 if(x.status==='ACTIVE')return 'BUILT IN';
 if(x.status==='LICENSE_REQUIRED')return 'LICENSE';
 return 'BRIDGE';
};

export default function ExpertModelSuitePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/expert-models',{cache:'no-store'});
    if(!res.ok)throw new Error('expert model suite unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'expert model suite unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 const native=useMemo(()=>data?.catalog.filter(x=>x.kind==='MODEL')||[],[data]);
 const ml=useMemo(()=>data?.catalog.filter(x=>x.kind==='SOFTWARE')||[],[data]);
 const premium=useMemo(()=>data?.catalog.filter(x=>x.kind==='DATA_PLATFORM')||[],[data]);
 const mlops=useMemo(()=>data?.catalog.filter(x=>x.kind==='MLOPS')||[],[data]);

 const stack=(title:string,rows:CatalogEntry[])=><div className="historyBox">
  <h4>{title}</h4>
  {rows.map(x=><div className="historyRow" key={x.id}>
   <span>{x.name}</span><b>{statusLabel(x)}</b>
   <small>{x.purpose} • {x.sports.join(', ')}</small>
  </div>)}
 </div>;

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V58 EXPERT MODELING SUITE</div>
    <h3>Professional model families, ML software bridge, premium data, and model governance</h3>
   </div>
   <div className="panelMeta">
    <span>{data?.summary.nativeModels??0} native models</span>
    <span>{data?.summary.configuredBridgeTools??0}/{data?.summary.bridgeTools??0} ML tools connected</span>
    <span>{data?.summary.configuredPremiumPlatforms??0}/{data?.summary.premiumDataPlatforms??0} data platforms available</span>
   </div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}

  <div className="v21Stats">
   <div><small>EXPERT MODELS / MARKET</small><strong>{data?data.summary.averageExpertModels.toFixed(1):'—'}</strong><span>{data?.summary.marketsWithFivePlusModels??0} markets with 5+ active models</span></div>
   <div><small>MODEL AGREEMENT</small><strong>{data?pct(data.summary.averageAgreement):'—'}</strong><span>dispersion-aware expert consensus</span></div>
   <div><small>EXTERNAL ML</small><strong>{data?.summary.externalModelServiceConfigured?'CONNECTED':'READY'}</strong><span>{data?.summary.marketsWithExternalModels??0} current rows receiving external ML</span></div>
   <div><small>PROFESSIONAL STACK</small><strong>{(data?.summary.nativeModels??0)+(data?.summary.bridgeTools??0)+(data?.summary.premiumDataPlatforms??0)+(data?.summary.mlopsTools??0)}</strong><span>models, software, data, and MLOps components</span></div>
  </div>

  <div className="historyNote">Trained Sport ML activates only after its chronological holdout gates pass. Other built-in models only activate when their required inputs exist. XGBoost, LightGBM, CatBoost, Random Forest, stacking and PyMC can compete through the V55 external tournament service; only the promoted champion feeds live inference; licensed vendors require your own authorized API/data access.</div>

  <div className="historyGrid">
   {stack('Native quantitative models',native)}
   {stack('External ML / statistical software',ml)}
   {stack('Premium sports-data platforms',premium)}
   {stack('Training, tuning & explainability',mlops)}
  </div>

  <div className="v21PanelHead">
   <div><div className="eyebrow">CURRENT SLATE</div><h3>Markets with the deepest expert-model coverage</h3></div>
   <span className="miniBadge">{data?.summary.slateMarkets??0} markets evaluated</span>
  </div>
  <div className="tableWrap">
   <table className="v21Table">
    <thead><tr><th>Sport</th><th>Selection</th><th>Models</th><th>Market</th><th>Expert</th><th>Edge</th><th>Agreement</th><th>Active engines</th></tr></thead>
    <tbody>
     {(data?.topMarkets||[]).slice(0,12).map(x=><tr key={x.id}>
      <td><span className="sportPill">{x.sport}</span></td>
      <td><b>{x.selection}</b><small>{x.event} • {x.market}</small></td>
      <td>{x.expertModelCount}</td>
      <td>{pct(x.marketProbability)}</td>
      <td>{pct(x.expertProbability)}</td>
      <td className={x.expertEdge>=0?'lime':'negative'}>{x.expertEdge>=0?'+':''}{pct(x.expertEdge)}</td>
      <td>{pct(x.agreement)}</td>
      <td><small>{x.models.slice(0,5).map(m=>m.name).join(' • ')}</small></td>
     </tr>)}
     {!data?.topMarkets?.length&&<tr><td colSpan={8} className="emptyRow">No current markets are available for expert-model analysis.</td></tr>}
    </tbody>
   </table>
  </div>
  <div className="historyNote">This section is an analysis and validation workbench, not a promise of profit. EdgeForce still applies its out-of-sample validation, calibration, drift, context, and portfolio-risk controls before model outputs influence recommendations.</div>
 </section>;
}
