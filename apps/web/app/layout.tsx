import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Denlumi — Every pet. One home.',description:'A fictional shared-home demonstration for cats, dogs, and the people caring for them.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
