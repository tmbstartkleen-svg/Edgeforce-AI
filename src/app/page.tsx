import Link from 'next/link';
import Dashboard from '@/components/Dashboard';

export default function Page(){
 return <>
  <Link className="predictionShortcut" href="/predictions">Prediction Terminal</Link>
  <Dashboard/>
 </>;
}
