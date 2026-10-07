import Link from 'next/link';
import Dashboard from '@/components/Dashboard';

export default function Page(){
 return <>
  <Link className="predictionShortcut" href="/predictions">Prediction Terminal</Link>\n  <Link className="predictionShortcut researchShortcut" href="/research">Forecast Research</Link>
  <Dashboard/>
 </>;
}
