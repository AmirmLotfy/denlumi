'use client';
import {useState,type ReactNode} from 'react';
export default function WorkflowSection({title,children}:{title:string;children:ReactNode}){
 const [opened,setOpened]=useState(false);
 return <details className="panel" onToggle={e=>{if(e.currentTarget.open)setOpened(true);}}><summary>{title}</summary>{opened&&children}</details>;
}
