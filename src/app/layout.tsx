import './globals.css';
import './v21.css';

export const metadata={
 title:'Edgeforce AI V30',
 description:'Automated DraftKings and prediction-market simulation intelligence'
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>
}
