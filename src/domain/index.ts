import {z} from 'zod';

export const ProbeSchema=z.enum(['signal','replay','output','network']);
export type Probe=z.infer<typeof ProbeSchema>;
const n=z.number().finite();
export const ObservationSchema=z.discriminatedUnion('probe',[
 z.object({probe:z.literal('signal'),permission:z.enum(['granted','denied','unavailable','error']),rmsDb:n.min(-120).max(20).nullable(),peak:n.min(0).max(10).nullable(),clippedFraction:n.min(0).max(1).nullable(),sampleCount:n.int().min(0).max(10000000),durationMs:n.min(0).max(20000),deviceLabel:z.string().max(150)}).strict(),
 z.object({probe:z.literal('replay'),heard:z.enum(['yes','no','unknown']),signalId:z.string().uuid()}).strict(),
 z.object({probe:z.literal('output'),heard:z.enum(['yes','no','unknown']),playbackRequested:z.boolean()}).strict(),
 z.object({probe:z.literal('network'),samplesMs:z.array(n.min(0).max(10000)).max(5),failures:n.int().min(0).max(5)}).strict(),
]).superRefine((o,ctx)=>{
 if(o.probe==='signal'){
  const measured=o.rmsDb!==null&&o.peak!==null&&o.clippedFraction!==null&&o.sampleCount>=1024&&o.durationMs>=1000;
  if(o.permission==='granted'&&!measured)ctx.addIssue({code:'custom',message:'Granted microphone observation needs at least one second of valid signal measurements.'});
  if(o.permission!=='granted'&&(o.rmsDb!==null||o.peak!==null||o.clippedFraction!==null||o.sampleCount!==0))ctx.addIssue({code:'custom',message:'Unavailable audio cannot carry invented measurements.'});
 }
 if(o.probe==='network'&&o.samplesMs.length+o.failures!==5)ctx.addIssue({code:'custom',message:'A network probe accounts for exactly five attempts.'});
 if(o.probe==='output'&&o.heard==='yes'&&!o.playbackRequested)ctx.addIssue({code:'custom',message:'Request playback before confirming audibility.'});
});
export type Observation=z.infer<typeof ObservationSchema>;
export interface Evidence {id:string;revision:number;at:string;value:Observation;withdrawn?:string}
export interface Adjustment {id:string;revision:number;at:string;probe:Probe;note:string}
export interface Session {id:string;revision:number;createdAt:string;evidence:Evidence[];adjustments:Adjustment[]}
export type Command={type:'observe';observation:Observation}|{type:'adjust';probe:Probe;note:string}|{type:'withdraw';id:string;reason:string};
export class DomainError extends Error {constructor(public code:string,message:string){super(message);}}
export function createSession():Session{return{id:crypto.randomUUID(),revision:0,createdAt:new Date().toISOString(),evidence:[],adjustments:[]};}
export function applyCommand(state:Session,command:Command,expectedRevision:number):Session{
 if(state.revision!==expectedRevision)throw new DomainError('STALE_REVISION','This soundcheck changed. Refresh before saving this observation.');
 if(state.evidence.length+state.adjustments.length>=200)throw new DomainError('SESSION_LIMIT','Export and start a new soundcheck.');
 const next=structuredClone(state);next.revision++;
 if(command.type==='observe'){
  const value=ObservationSchema.parse(command.observation);
  if(value.probe==='replay'){
   const signal=currentEvidence(state,'signal');
   if(!signal||signal.id!==value.signalId||signal.value.probe!=='signal'||signal.value.permission!=='granted')throw new DomainError('STALE_RECORDING','Record a current microphone sample before confirming its replay.');
  }
  next.evidence.push({id:crypto.randomUUID(),revision:next.revision,at:new Date().toISOString(),value});
 }else if(command.type==='adjust'){
  const note=z.string().trim().min(1).max(500).parse(command.note);
  next.adjustments.push({id:crypto.randomUUID(),revision:next.revision,at:new Date().toISOString(),probe:ProbeSchema.parse(command.probe),note});
 }else{
  const item=next.evidence.find(e=>e.id===command.id);
  if(!item||item.withdrawn)throw new DomainError('UNKNOWN_EVIDENCE','Choose an active observation to withdraw.');
  item.withdrawn=z.string().trim().min(1).max(500).parse(command.reason);
 }
 return next;
}
export function currentEvidence(state:Session,probe:Probe):Evidence|undefined{
 const last=state.evidence.filter(e=>e.value.probe===probe).at(-1);
 const adjustment=state.adjustments.filter(a=>a.probe===probe).at(-1);
 if(!last||last.withdrawn||adjustment&&adjustment.revision>last.revision)return;
 return last;
}
export function analyseSamples(samples:ArrayLike<number>){
 if(samples.length<1)throw new Error('No audio samples.');
 let sum=0,peak=0,clipped=0;
 for(let i=0;i<samples.length;i++){const v=samples[i];if(!Number.isFinite(v))throw new Error('Non-finite sample.');sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=.98)clipped++;}
 return{rmsDb:Math.max(-120,20*Math.log10(Math.sqrt(sum/samples.length))),peak,clippedFraction:clipped/samples.length,sampleCount:samples.length};
}
export interface Finding {probe:Probe;status:'pass'|'attention'|'unknown';title:string;detail:string;action:string;evidenceId:string|null;basis:'browser measurement'|'user confirmation'|'not observed'}
export function receipt(state:Session){
 const signal=currentEvidence(state,'signal'),replay=currentEvidence(state,'replay'),output=currentEvidence(state,'output'),network=currentEvidence(state,'network');
 const unknown=(probe:Probe,title:string,action:string):Finding=>({probe,status:'unknown',title,detail:'No current result. A change or withdrawal requires a new test.',action,evidenceId:null,basis:'not observed'});
 let mic=unknown('signal','Microphone','Record a short microphone sample.');
 if(signal&&signal.value.probe==='signal'){
  const v=signal.value;const permission=v.permission==='granted';const clipped=permission&&v.clippedFraction!>=.01;const quiet=permission&&v.rmsDb!< -45;
  mic={probe:'signal',status:permission&&!clipped&&!quiet?'pass':'attention',title:'Microphone',detail:permission?`${v.rmsDb!.toFixed(1)} dBFS average · ${(v.clippedFraction!*100).toFixed(1)}% near clipping · sampled in your browser`:`Microphone ${v.permission}; no signal was measured.`,action:!permission?'Use the browser permission control or check the selected input. Continue other checks with text.':clipped?'Lower the input gain or move farther from the mic, then retest.':quiet?'Speak normally closer to the mic; check mute/input selection, then retest.':'Signal is in the supported range. Listen to the recording next.',evidenceId:signal.id,basis:'browser measurement'};
 }
 let listen=unknown('replay','Recording replay','Record a current sample and listen with headphones.');
 if(replay&&replay.value.probe==='replay'&&replay.value.signalId===signal?.id){const heard=replay.value.heard;listen={probe:'replay',status:heard==='yes'?'pass':heard==='no'?'attention':'unknown',title:'Recording replay',detail:heard==='yes'?'You confirmed this microphone recording was intelligible.':heard==='no'?'You reported that the recording was not clear.':'You have not confirmed the recording.',action:heard==='yes'?'Replay confirmed by you.':'Check the input and output selection, then record again.',evidenceId:replay.id,basis:'user confirmation'};}
 let tone=unknown('output','Speaker tone','Play a quiet test tone, then tell us whether you heard it.');
 if(output&&output.value.probe==='output'){const heard=output.value.heard;tone={probe:'output',status:heard==='yes'?'pass':heard==='no'?'attention':'unknown',title:'Speaker tone',detail:heard==='yes'?'You confirmed hearing the tone. The browser cannot measure speaker audibility.':heard==='no'?'You reported no audible tone.':'Playback is unconfirmed.',action:heard==='yes'?'Output confirmed by you.':'Check volume, mute and output selection. Then replay the tone.',evidenceId:output.id,basis:'user confirmation'};}
 let connection=unknown('network','RoomReady connection','Measure five round trips to this app.');
 if(network&&network.value.probe==='network'){const v=network.value,sorted=[...v.samplesMs].sort((a,b)=>a-b);const p50=sorted.length?sorted[Math.ceil(sorted.length*.5)-1]:null,p95=sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null;const pass=v.failures===0&&p95!==null&&p95<300;connection={probe:'network',status:pass?'pass':'attention',title:'RoomReady connection',detail:`${5-v.failures}/5 replies · median ${p50===null?'unknown':Math.round(p50)+' ms'} · p95 ${p95===null?'unknown':Math.round(p95)+' ms'}. This app only; not Zoom or call quality.`,action:pass?'This endpoint responded promptly.':'Check connectivity and retry. This cannot diagnose another meeting service.',evidenceId:network.id,basis:'browser measurement'};}
 const findings=[mic,listen,tone,connection];const ready=findings.every(f=>f.status==='pass');
 const next=findings.find(f=>f.status!=='pass')?.probe??null;
 return{status:ready?'READY_WITH_LIMITS' as const:'UNRESOLVED' as const,findings,nextProbe:next,confirmedChecks:findings.filter(f=>f.status==='pass').length,limits:['Only this browser/device and these observations were checked.','No Zoom/Teams connectivity, acoustic echo, camera, bandwidth or remote participant was tested.','Measurements are client-reported; the server did not hear the microphone or speakers.','Adjustments and new microphone samples invalidate the related earlier confirmation.']};
}
