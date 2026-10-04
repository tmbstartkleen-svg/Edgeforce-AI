import ExpertModelSuitePanel from '@/components/ExpertModelSuitePanel';

export const metadata={
 title:'Edgeforce Expert Modeling Suite',
 description:'Professional sports prediction models, external ML engines, premium data connectors, and model governance.'
};

export default function ExpertModelsPage(){
 return <main className="v21">
  <header className="v21Top">
   <div>
    <div className="eyebrow">EDGEFORCE AI • V53</div>
    <h1>Expert Modeling Suite</h1>
    <p>Inspect professional quantitative model families, external ML software, licensed sports-data connectors, and the current slate's active expert-model consensus.</p>
   </div>
  </header>
  <ExpertModelSuitePanel/>
 </main>;
}
