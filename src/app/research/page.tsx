import Link from 'next/link';
import ForecastResearchLabPanel from '@/components/ForecastResearchLabPanel';
import PlayerStreakResearchPanel from '@/components/PlayerStreakResearchPanel';

export const metadata={
 title:'Edgeforce Forecast Research Lab',
 description:'Research-only historical player streaks, forecast calibration, reliability, temporal replay and model evaluation.'
};

export default function ResearchPage(){
 return <>
  <Link className="predictionShortcut" href="/">Command Center</Link>
  <PlayerStreakResearchPanel/>
  <ForecastResearchLabPanel/>
 </>;
}
