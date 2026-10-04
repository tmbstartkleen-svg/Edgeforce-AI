import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
 return {
  name:'Edgeforce Prediction Intelligence',
  short_name:'Edgeforce',
  description:'Live cross-venue prediction-market intelligence for Kalshi, Polymarket and sportsbook signals.',
  start_url:'/mobile',
  display:'standalone',
  background_color:'#050505',
  theme_color:'#050505',
  orientation:'portrait-primary',
  categories:['finance','sports','utilities'],
  icons:[
   {src:'/edgeforce-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}
  ]
 };
}
