export const SAMPLE_RATE=16000;
export const MAX_RECORDING_SECONDS=15;
export const MAX_PCM_BYTES=SAMPLE_RATE*2*MAX_RECORDING_SECONDS;
export function floatToPCM(input:Float32Array) {
 const bytes=new Uint8Array(input.length*2),view=new DataView(bytes.buffer);
 for(let i=0;i<input.length;i++){const v=Math.max(-1,Math.min(1,input[i]));view.setInt16(i*2,v<0?v*32768:v*32767,true);}
 return bytes;
}
