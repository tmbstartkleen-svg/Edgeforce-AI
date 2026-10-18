import Link from 'next/link';
import Dashboard from '@/components/Dashboard';

export default function Page(){
 return <>
  <Link className="predictionShortcut" href="/predictions">Prediction Terminal</Link>
  <Link className="predictionShortcut researchShortcut" href="/research">Forecast Research</Link>
  <Dashboard/>
  <Link className="predictionShortcut" style={{bottom:114}} href="/team">AI Research Team</Link>
 </>;
}
