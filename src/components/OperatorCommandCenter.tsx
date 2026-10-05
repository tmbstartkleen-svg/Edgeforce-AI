'use client';

import {useMemo,useState} from 'react';
import LiveComebackPanel from './LiveComebackPanel';
import EarlyCashoutPanel from './EarlyCashoutPanel';
import ForecastSkillPanel from './ForecastSkillPanel';
import DailyEdgeRouterPanel from './DailyEdgeRouterPanel';
import MasterEdgePanel from './MasterEdgePanel';
import EdgeLifecyclePanel from './EdgeLifecyclePanel';
import EntryWindowPanel from './EntryWindowPanel';
import PriceTargetPanel from './PriceTargetPanel';
import BestPricePanel from './BestPricePanel';
import PriceCapturePanel from './PriceCapturePanel';
import ExecutionFeedbackPanel from './ExecutionFeedbackPanel';
import FinalDecisionGatePanel from './FinalDecisionGatePanel';
import OpportunityCommandQueuePanel from './OpportunityCommandQueuePanel';
import CommandLearningPanel from './CommandLearningPanel';
import CashoutLearningPanel from './CashoutLearningPanel';
import CashoutReconciliationPanel from './CashoutReconciliationPanel';
import CashoutPolicyPanel from './CashoutPolicyPanel';
import CashoutPolicyGovernancePanel from './CashoutPolicyGovernancePanel';
import DecisionReplayPanel from './DecisionReplayPanel';
import StressScenarioLabPanel from './StressScenarioLabPanel';

type View='TODAY'|'EXECUTION'|'LEARNING'|'CASHOUT'|'ALL';

const views:Array<{id:View;label:string;description:string}>= [
 {id:'TODAY',label:'Today',description:'Priority queue, final decisions, live movement and current edge board.'},
 {id:'EXECUTION',label:'Execution',description:'Timing, fair price, venue shopping, lifecycle and CLV quality.'},
 {id:'LEARNING',label:'Learning',description:'Skill, routing, alert learning, replay validation and stress testing.'},
 {id:'CASHOUT',label:'Cash-Out',description:'Ladder, real offer learning, reconciliation, learned policy and governance.'},
 {id:'ALL',label:'All Modules',description:'Expanded view of every V100+ operator module.'}
];

export default function OperatorCommandCenter(){
 const [view,setView]=useState<View>('TODAY');
 const active=useMemo(()=>views.find(x=>x.id===view)??views[0],[view]);

 const today=<>
  <OpportunityCommandQueuePanel/>
  <FinalDecisionGatePanel/>
  <MasterEdgePanel/>
  <LiveComebackPanel/>
 </>;

 const execution=<>
  <EntryWindowPanel/>
  <PriceTargetPanel/>
  <BestPricePanel/>
  <EdgeLifecyclePanel/>
  <ExecutionFeedbackPanel/>
  <PriceCapturePanel/>
 </>;

 const learning=<>
  <DailyEdgeRouterPanel/>
  <ForecastSkillPanel/>
  <CommandLearningPanel/>
  <DecisionReplayPanel/>
  <StressScenarioLabPanel/>
 </>;

 const cashout=<>
  <EarlyCashoutPanel/>
  <CashoutLearningPanel/>
  <CashoutReconciliationPanel/>
  <CashoutPolicyPanel/>
  <CashoutPolicyGovernancePanel/>
 </>;

 return <section className="operatorCenter">
  <div className="operatorCenterHead">
   <div>
    <div className="eyebrow">V121 OPERATOR COMMAND CENTER</div>
    <h2>EdgeForce Intelligence Console</h2>
    <p>{active.description}</p>
   </div>
   <div className="operatorCenterBadge">20 MODULES · CONSOLIDATED</div>
  </div>

  <div className="operatorNav" role="tablist" aria-label="EdgeForce operator views">
   {views.map(x=><button
    key={x.id}
    type="button"
    role="tab"
    aria-selected={view===x.id}
    className={view===x.id?'active':''}
    onClick={()=>setView(x.id)}
   >{x.label}</button>)}
  </div>

  <div className="operatorSummary">
   <div><small>TODAY</small><strong>4</strong><span>priority + live</span></div>
   <div><small>EXECUTION</small><strong>6</strong><span>price + timing</span></div>
   <div><small>LEARNING</small><strong>5</strong><span>validation + stress</span></div>
   <div><small>CASH-OUT</small><strong>5</strong><span>offer + policy</span></div>
  </div>

  <div className="operatorModules">
   {view==='TODAY'&&today}
   {view==='EXECUTION'&&execution}
   {view==='LEARNING'&&learning}
   {view==='CASHOUT'&&cashout}
   {view==='ALL'&&<>{today}{execution}{learning}{cashout}</>}
  </div>

  <div className="operatorCenterNote">
   V121 changes presentation only: the underlying APIs, learning loops, safeguards, and analytics remain separate and independently auditable.
  </div>
 </section>;
}
