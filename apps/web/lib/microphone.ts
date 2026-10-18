import { floatToPCM,MAX_RECORDING_SECONDS,SAMPLE_RATE } from '../../../packages/domain/audio';
export type Microphone={finish:()=>Uint8Array;cancel:()=>void};
export async function captureMicrophone(signal:AbortSignal,onLimit:()=>void):Promise<Microphone> {
 if(!navigator.mediaDevices?.getUserMedia||!window.AudioContext)throw Error('MICROPHONE_UNSUPPORTED');
 let stream:MediaStream|undefined,context:AudioContext|undefined,node:AudioWorkletNode|undefined;
 let chunks:Uint8Array[]=[],samples=0,closed=false,timer:ReturnType<typeof setTimeout>|undefined;
 const close=()=>{closed=true;if(timer)clearTimeout(timer);node?.disconnect();stream?.getTracks().forEach(t=>t.stop());void context?.close().catch(()=>{});signal.removeEventListener('abort',cancel);};
 const cancel=()=>{chunks=[];close();};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  if(signal.aborted)throw new DOMException('Stopped','AbortError');
  stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
  if(closed||signal.aborted){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Stopped','AbortError');}
  context=new AudioContext({sampleRate:SAMPLE_RATE});
  if(context.sampleRate!==SAMPLE_RATE||!context.audioWorklet)throw Error('AUDIO_FORMAT_UNSUPPORTED');
  await context.audioWorklet.addModule('/pcm-capture.js');
  if(closed||signal.aborted)throw new DOMException('Stopped','AbortError');
  node=new AudioWorkletNode(context,'denlumi-capture');
  node.port.onmessage=event=>{
   if(closed)return;
   const remaining=SAMPLE_RATE*MAX_RECORDING_SECONDS-samples;
   const input=(event.data as Float32Array).subarray(0,remaining);
   chunks.push(floatToPCM(input));samples+=input.length;
   if(samples>=SAMPLE_RATE*MAX_RECORDING_SECONDS){node!.port.onmessage=null;onLimit();}
  };
  const mute=context.createGain();mute.gain.value=0;
  context.createMediaStreamSource(stream).connect(node);node.connect(mute);mute.connect(context.destination);await context.resume();
  timer=setTimeout(onLimit,MAX_RECORDING_SECONDS*1000);
  return {cancel,finish:()=>{close();const bytes=new Uint8Array(samples*2);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}chunks=[];return bytes;}};
 }catch(e){cancel();throw e;}
}
