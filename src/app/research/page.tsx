import Link from 'next/link';
import ForecastResearchLabPanel from '@/components/ForecastResearchLabPanel';

export const metadata={
 title:'Edgeforce Forecast Research Lab',
 description:'Research-only historical forecast calibration, reliability, temporal replay and model evaluation.'
};

export default function ResearchPage(){
 return <>
  <Link className="predictionShortcut" href="/">Command Center</Link>
  <ForecastResearchLabPanel/>
 </>;
}
