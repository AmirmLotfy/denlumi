'use client';
import {useRef} from 'react';
export async function workflowRead<T>(path:string):Promise<T>{
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
 const value=await response.json();if(!response.ok)throw Error(value.error??'READ_FAILED');return value;
}
export function useWorkflowWrite(){
 const keys=useRef(new Map<string,string>());
 return async function write<T=unknown>(path:string,payload:unknown,method='POST'):Promise<T>{
  const body=JSON.stringify(payload),fingerprint=`${method}:${path}:${body}`;
  const key=keys.current.get(fingerprint)??crypto.randomUUID();keys.current.set(fingerprint,key);
  const response=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':key},body});
  const value=await response.json();if(!response.ok)throw Error(value.error??'WRITE_REFUSED');
  keys.current.delete(fingerprint);return value;
 };
}
