import './globals.css';
import './v21.css';
import './workspaces.css';

export const metadata={
 title:'Edgeforce AI',
 description:'Live sports probability, simulation, history and cross-venue prediction-market intelligence',
 manifest:'/manifest.webmanifest',
 icons:{icon:'/edgeforce-icon.svg'},
 appleWebApp:{
  capable:true,
  title:'Edgeforce',
  statusBarStyle:'black-translucent'
 }
};

export const viewport={
 width:'device-width',
 initialScale:1,
 viewportFit:'cover',
 themeColor:'#050505'
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>
}
