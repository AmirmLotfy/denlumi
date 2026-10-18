import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stopLocally} from '../packages/domain/local-stop';
test('local stop cancels playing and queued audio, aborts pending work and latches without network',()=>{
 let paused=0,canceled=0,shown=0,persisted=0;const abort=new AbortController(),audio={pause:()=>{paused++},currentTime:10};
 stopLocally({audio,speech:{cancel:()=>{canceled++}},abort,persist:()=>{persisted++},showStopped:()=>{shown++}});
 assert.equal(paused,1);assert.equal(audio.currentTime,0);assert.equal(canceled,1);assert.ok(abort.signal.aborted);assert.equal(persisted,1);assert.equal(shown,1);
});
test('storage/audio failure cannot prevent the local visible stop',()=>{
 let shown=false;stopLocally({audio:{pause:()=>{throw Error('audio')},currentTime:1},persist:()=>{throw Error('storage')},showStopped:()=>{shown=true}});assert.ok(shown);
});
test('stop closes microphone even when audio and persistence fail',()=>{
 let closed=false,shown=false;stopLocally({audio:null,stopMicrophone:()=>{closed=true;},persist:()=>{throw Error('offline');},showStopped:()=>{shown=true;}});assert.ok(closed&&shown);
});
