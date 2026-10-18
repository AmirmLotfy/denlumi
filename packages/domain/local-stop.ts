export type StopResources={audio:{pause:()=>void;currentTime:number}|null;speech?:{cancel:()=>void};abort?:AbortController;stopMicrophone?:()=>void;persist:()=>void;showStopped:()=>void};
/** Synchronous and network-free. Side effects cannot prevent the visible latch. */
export function stopLocally(r:StopResources) {
 try{r.audio?.pause();if(r.audio)r.audio.currentTime=0;}catch{}
 try{r.speech?.cancel();}catch{}
 try{r.abort?.abort();}catch{}
 try{r.stopMicrophone?.();}catch{}
 try{r.persist();}catch{}
 r.showStopped();
}
