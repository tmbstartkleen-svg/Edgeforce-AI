import Link from 'next/link';
import NetworkCommand from '@/components/NetworkCommand';
import './network.css';

export const metadata={
 title:'EdgeForce — Founder Command Network',
 description:'The Founder directs ATLAS, the AI Chief Director, who coordinates specialist sports intelligence agents.'
};
export default function NetworkPage(){
 return <>
  <nav style={{background:'#071018',padding:'10px 16px',display:'flex',flexWrap:'wrap',gap:18,borderBottom:'1px solid #263a4c'}}>
   <Link href="/" style={{color:'#b3e4cb',fontSize:12,textDecoration:'none'}}>← EdgeForce Main Dashboard</Link>
   <Link href="/network/coverage" style={{color:"#c4f46e",fontSize:14,textDecoration:"none"}}>All-Sports Coverage</Link>
   <Link href="/team" style={{color:'#aac0d0',fontSize:12,textDecoration:'none'}}>Research Team</Link>
   <Link href="/research" style={{color:'#aac0d0',fontSize:12,textDecoration:'none'}}>Model Research</Link>
  </nav>
  <NetworkCommand/>
 </>;
}
