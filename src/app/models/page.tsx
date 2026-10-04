import ExpertModelSuitePanel from '@/components/ExpertModelSuitePanel';
import TrainedSportModelsPanel from '@/components/TrainedSportModelsPanel';
import ExternalMlTournamentPanel from '@/components/ExternalMlTournamentPanel';
import MlServiceActivationPanel from '@/components/MlServiceActivationPanel';
import MlDeploymentAutomationPanel from '@/components/MlDeploymentAutomationPanel';
import FirstChampionTournamentPanel from '@/components/FirstChampionTournamentPanel';

export const metadata={
 title:'Edgeforce First Champion Tournament + Expert Modeling',
 description:'Professional sports prediction models, external ML engines, premium data connectors, and model governance.'
};

export default function ExpertModelsPage(){
 return <main className="v21">
  <header className="v21Top">
   <div>
    <div className="eyebrow">EDGEFORCE AI • V58</div>
    <h1>Expert Modeling Suite</h1>
    <p>Inspect professional quantitative model families, external ML software, licensed sports-data connectors, and active expert-model consensus for the current slate.</p>
   </div>
  </header>
  <FirstChampionTournamentPanel/>
  <MlDeploymentAutomationPanel/>
  <MlServiceActivationPanel/>
  <ExternalMlTournamentPanel/>
  <TrainedSportModelsPanel/>
  <ExpertModelSuitePanel/>
 </main>;
}
