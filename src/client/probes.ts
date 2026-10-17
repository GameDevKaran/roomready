import {analyseSamples,type Observation} from '../domain/index.js';

export async function recordMicrophone(deviceId:string,onLevel:(db:number)=>void,signal:AbortSignal):Promise<{observation:Observation;blob:Blob|null;devices:MediaDeviceInfo[]}>{
 if(!navigator.mediaDevices?.getUserMedia||!globalThis.AudioContext)return{observation:unavailable('unavailable'),blob:null,devices:[]};
 const context=new AudioContext();let stream:MediaStream|undefined;let recorder:MediaRecorder|undefined;let stopped:Promise<Blob>|undefined;
 try{
  await context.resume();
  let finished=false;
  const request=navigator.mediaDevices.getUserMedia({video:false,audio:{deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  request.then(s=>{if(finished||signal.aborted)s.getTracks().forEach(t=>t.stop());}).catch(()=>{});
  try{stream=await Promise.race([request,new Promise<never>((_r,reject)=>{const timer=setTimeout(()=>reject(new Error('Permission request timed out. Check browser permissions and retry.')),12000);request.finally(()=>clearTimeout(timer)).catch(()=>{});signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Recording cancelled.'));},{once:true});})]);}finally{finished=true;}
  if(signal.aborted)throw new Error('Recording cancelled.');
  const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
  if(globalThis.MediaRecorder){
   recorder=new MediaRecorder(stream);const chunks:BlobPart[]=[];
   stopped=new Promise<Blob>((resolve,reject)=>{recorder!.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder!.onstop=()=>resolve(new Blob(chunks,{type:recorder!.mimeType}));recorder!.onerror=()=>reject(new Error('Recording could not be encoded.'));});
   recorder.start();
  }
  const samples:number[]=[],frame=new Float32Array(analyser.fftSize);const started=performance.now();
  while(performance.now()-started<3200){if(signal.aborted)throw new Error('Recording cancelled.');analyser.getFloatTimeDomainData(frame);samples.push(...frame);onLevel(analyseSamples(frame).rmsDb);await new Promise(r=>setTimeout(r,80));}
  const durationMs=performance.now()-started;recorder?.stop();const blob=stopped?await stopped:null;
  const stats=analyseSamples(samples);const label=stream.getAudioTracks()[0]?.label??'Selected microphone';
  return{observation:{probe:'signal',permission:'granted',...stats,durationMs,deviceLabel:label.slice(0,150)},blob,devices:(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput')};
 }catch(error){
  if(signal.aborted)throw error;
  console.warn('Audio probe unavailable:',error instanceof Error?error.stack??error.message:'unknown browser error');
  const kind=error instanceof DOMException&&error.name==='NotAllowedError'?'denied':error instanceof DOMException&&error.name==='NotFoundError'?'unavailable':'error';
  return{observation:unavailable(kind),blob:null,devices:[]};
 }finally{
  if(recorder?.state==='recording'){recorder.stop();await stopped?.catch(()=>{});}
  stream?.getTracks().forEach(t=>t.stop());await context.close().catch(()=>{});
 }
}
function unavailable(permission:'denied'|'unavailable'|'error'):Observation{return{probe:'signal',permission,rmsDb:null,peak:null,clippedFraction:null,sampleCount:0,durationMs:0,deviceLabel:''};}
export async function playTone(){
 if(!globalThis.AudioContext)throw new Error('This browser cannot generate the test tone.');
 const ctx=new AudioContext();try{await ctx.resume();const tone=ctx.createOscillator(),volume=ctx.createGain();tone.type='sine';tone.frequency.value=440;volume.gain.setValueAtTime(0,ctx.currentTime);volume.gain.linearRampToValueAtTime(.035,ctx.currentTime+.08);volume.gain.setValueAtTime(.035,ctx.currentTime+.55);volume.gain.linearRampToValueAtTime(0,ctx.currentTime+.7);tone.connect(volume).connect(ctx.destination);tone.start();tone.stop(ctx.currentTime+.72);await new Promise<void>(r=>{tone.onended=()=>r();});}finally{await ctx.close();}
}
export async function networkProbe():Promise<Observation>{
 const samplesMs:number[]=[];let failures=0;
 for(let i=0;i<5;i++){const start=performance.now();try{const r=await fetch('/api/ping?nonce='+crypto.randomUUID(),{cache:'no-store',signal:AbortSignal.timeout(3000)});const body=await r.json();if(!r.ok||body.endpoint!=='RoomReady')throw new Error('Unexpected endpoint.');samplesMs.push(performance.now()-start);}catch{failures++;}}
 return{probe:'network',samplesMs,failures};
}
