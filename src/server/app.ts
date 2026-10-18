import express,{type Request,type Response,type NextFunction} from 'express';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {ObservationSchema,ProbeSchema,receipt,DomainError,type Command,type Session} from '../domain/index.js';
import {StorageUnavailable,type SoundcheckStore} from './persistence.js';
import {guard,identity} from './security.js';
import type {Adviser} from './model.js';
export interface Options{store:SoundcheckStore;origin?:string;production?:boolean;adviser?:Adviser;modelLabel?:string;modelLimit?:number;dist?:string}
export function createApp(options:Options){
 const app=express();app.disable('x-powered-by');app.use(guard(options.origin));
 // Also bound clients rotating cookies. Process-local admission is not a financial cap.
 let admissionUntil=0,admissionCount=0,creationDay='',creations=0;
 app.use((q,r,next)=>{if(q.path!=='/api/health'&&(q.path.startsWith('/api/')||q.path==='/mcp')){const now=Date.now();if(now>=admissionUntil){admissionUntil=now+60000;admissionCount=0;}if(++admissionCount>600){r.setHeader('Retry-After','60');return r.status(429).json({error:'RoomReady is busy. Retry in a minute; saved receipts remain available.'});}}next();});
 app.use(express.json({limit:'24kb'}));
 const rates=new Map<string,{until:number;count:number}>();let day='',modelCount=0;
 const owner=(req:Request,res:Response,create=false)=>{const key=identity(req,res,create,options.production);if(!key)return null;const now=Date.now();if(rates.size>10000)for(const[k,v]of rates)if(v.until<now)rates.delete(k);const rate=rates.get(key);if(rate&&rate.until>now){if(++rate.count>120){res.setHeader('Retry-After','60');res.status(429).json({error:'Wait a minute before retrying.'});return null;}}else rates.set(key,{until:now+60000,count:1});return key;};
 app.get('/api/health',(_q,r)=>r.json({status:'ok',application:'roomready'}));
 app.get('/api/ping',(_q,r)=>r.json({endpoint:'RoomReady',at:new Date().toISOString()}));
 app.get('/api/bootstrap',async(q,r)=>{const key=owner(q,r,true);if(!key)return;let state=await options.store.get(key);if(!state){const today=new Date().toISOString().slice(0,10);if(creationDay!==today){creationDay=today;creations=0;}if(++creations>1000){r.setHeader('Retry-After','3600');return r.status(429).json({error:'New soundcheck capacity has been reached today. Existing receipts remain available.'});}state=await options.store.create(key);}r.json({state,receipt:receipt(state),model:{enabled:!!options.adviser,label:options.adviser?options.modelLabel??'Bedrock adapter':'Deterministic guide — no model inference'}});});
 app.delete('/api/session',async(q,r)=>{const key=owner(q,r);if(!key)return;const input=z.object({expectedSessionId:z.string().uuid()}).strict().parse(q.body);await options.store.clear(key,input.expectedSessionId);r.json({cleared:true});});
 app.get('/api/export',async(q,r)=>{const key=owner(q,r);if(!key)return;const state=await options.store.get(key);if(!state)return r.status(404).json({error:'Session expired.'});r.setHeader('Content-Disposition','attachment; filename="roomready-receipt.json"');r.json({application:'RoomReady',exportedAt:new Date().toISOString(),state,receipt:receipt(state)});});
 app.post('/api/advice',async(q,r,next)=>{try{
  const key=owner(q,r);if(!key)return;if(!options.adviser)return r.status(503).json({error:'AI guidance is not configured. All four probes remain available.'});
  const input=z.object({symptom:z.string().trim().min(1).max(1200),expectedRevision:z.number().int().nonnegative(),expectedSessionId:z.string().uuid()}).strict().parse(q.body);const state=await options.store.get(key);if(!state)return r.status(404).json({error:'Session expired.'});if(input.expectedSessionId!==state.id||input.expectedRevision!==state.revision)return r.status(409).json({error:'Soundcheck changed. Refresh first.'});
  const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;modelCount=0;}if(modelCount>=(options.modelLimit??100))return r.status(429).json({error:'Model limit reached; manual checks remain available.'});modelCount++;
  try{const advice=await options.adviser({symptom:input.symptom,state});r.json({...advice,expectedRevision:state.revision});}catch{r.status(502).json({error:'AI guidance could not be verified. No evidence changed; continue using the probe controls.'});}
 }catch(e){next(e);}});
 app.post('/mcp',async(q,r,next)=>{
  const key=owner(q,r);if(!key)return;
  const server=new McpServer({name:'roomready',version:'0.1.0'});const revision=z.number().int().nonnegative(),requestId=z.string().uuid();
  const reply=(state:Session|null)=>({content:[{type:'text' as const,text:JSON.stringify({state,receipt:state?receipt(state):null})}]});
  const failure=(e:unknown)=>({isError:true,content:[{type:'text' as const,text:JSON.stringify({error:e instanceof DomainError||e instanceof StorageUnavailable?e.message:'The action could not be completed. Retry after refreshing.',code:e instanceof DomainError?e.code:e instanceof StorageUnavailable?'STORAGE_UNAVAILABLE':'INVALID_INPUT'})}]});
  const run=async(command:Command,rev:number,id:string,expectedSessionId:string)=>{try{return reply(await options.store.command(key,command,rev,id,expectedSessionId));}catch(e){return failure(e);}};
  server.registerTool('get_receipt',{description:'Read this browser soundcheck, current findings and limits.',inputSchema:{}},async()=>{try{return reply(await options.store.get(key));}catch(e){return failure(e);}});
  server.registerTool('record_probe',{description:'Store browser measurements or explicit user playback confirmation. Server does not hear audio; raw audio is never accepted.',inputSchema:{observation:ObservationSchema,expectedRevision:revision,requestId,expectedSessionId:z.string().uuid()}},async({observation,expectedRevision,requestId,expectedSessionId})=>run({type:'observe',observation},expectedRevision,requestId,expectedSessionId));
  server.registerTool('record_adjustment',{description:'Record a user adjustment and require a fresh result for that probe.',inputSchema:{probe:ProbeSchema,note:z.string().trim().min(1).max(500),expectedRevision:revision,requestId,expectedSessionId:z.string().uuid()}},async({probe,note,expectedRevision,requestId,expectedSessionId})=>run({type:'adjust',probe,note},expectedRevision,requestId,expectedSessionId));
  server.registerTool('withdraw_observation',{description:'Preserve a disputed observation in history while excluding it from readiness. A fresh probe is required.',inputSchema:{id:z.string().uuid(),reason:z.string().trim().min(1).max(500),expectedRevision:revision,requestId,expectedSessionId:z.string().uuid()}},async({id,reason,expectedRevision,requestId,expectedSessionId})=>run({type:'withdraw',id,reason},expectedRevision,requestId,expectedSessionId));
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});r.on('close',()=>{void server.close();void transport.close();});try{await server.connect(transport);await transport.handleRequest(q,r,q.body);}catch(e){if(!r.headersSent)next(e);}
 });
 app.all('/mcp',(_q,r)=>r.status(405).json({error:'Use Streamable HTTP POST.'}));
 const dist=options.dist??resolve('dist');if(existsSync(dist))app.use(express.static(dist));
 app.use((_q,r)=>r.status(404).json({error:'Route not found.'}));
 app.use((error:unknown,_q:Request,r:Response,_n:NextFunction)=>{if(error instanceof StorageUnavailable)r.setHeader('Retry-After','5');r.status(error instanceof StorageUnavailable?503:error instanceof DomainError?409:error instanceof z.ZodError?400:500).json({error:error instanceof DomainError||error instanceof StorageUnavailable?error.message:error instanceof z.ZodError?'Invalid request.':'Request failed.',code:error instanceof DomainError?error.code:error instanceof StorageUnavailable?'STORAGE_UNAVAILABLE':'REQUEST_FAILED'});});
 return app;
}
