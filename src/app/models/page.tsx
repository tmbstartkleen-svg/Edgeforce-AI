import ExpertModelSuitePanel from '@/components/ExpertModelSuitePanel';
import TrainedSportModelsPanel from '@/components/TrainedSportModelsPanel';
import ExternalMlTournamentPanel from '@/components/ExternalMlTournamentPanel';

export const metadata={
 title:'Edgeforce External ML Tournament + Expert Modeling',
 description:'Professional sports prediction models, external ML engines, premium data connectors, and model governance.'
};

export default function ExpertModelsPage(){
 return <main className="v21">
  <header className="v21Top">
   <div>
    <div className="eyebrow">EDGEFORCE AI • V55</div>
    <h1>Expert Modeling Suite</h1>
    <p>Inspect professional quantitative model families, external ML software, licensed sports-data connectors, and active expert-model consensus for the current slate.</p>
   </div>
  </header>
  <ExternalMlTournamentPanel/>
  <TrainedSportModelsPanel/>
  <ExpertModelSuitePanel/>
 </main>;
}
