import Link from 'next/link';
import TeamCommandCenter from '@/components/TeamCommandCenter';
import './team.css';

export const metadata={
 title:'EdgeForce AI Research Team',
 description:'Collaborative all-sports research command room with evidence-gated specialist agents and live feed coverage.'
};

export default function TeamPage(){
 return <>
  <nav style={{background:'#070b12',padding:'10px 18px',borderBottom:'1px solid #233044',display:'flex',gap:18,flexWrap:'wrap'}}>
   <Link href="/" style={{color:'#b6d9c9',textDecoration:'none',fontSize:12,fontWeight:700}}>← EdgeForce Dashboard</Link>
   <Link href="/network" style={{color:"#b3edc9",textDecoration:"none",fontSize:12}}>Founder Command Network</Link>
   <Link href="/research" style={{color:'#94a8c4',textDecoration:'none',fontSize:12}}>Forecast Research Lab</Link>
   <Link href="/predictions" style={{color:'#94a8c4',textDecoration:'none',fontSize:12}}>Prediction Terminal</Link>
  </nav>
  <TeamCommandCenter/>
 </>;
}
