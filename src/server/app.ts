import express,{type Request,type Response,type NextFunction} from 'express';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {z} from 'zod';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {ObservationSchema,ProbeSchema,receipt,DomainError,type Command} from '../domain/index.js';
import {Store} from './store.js';
import {guard,identity} from './security.js';
import type {Adviser} from './model.js';
export interface Options{store:Store;origin?:string;production?:boolean;adviser?:Adviser;modelLabel?:string;modelLimit?:number;dist?:string}
export function createApp(options:Options){
 const app=express();app.disable('x-powered-by');app.use(guard(options.origin));app.use(express.json({limit:'24kb'}));
 const rates=new Map<string,{until:number;count:number}>();let day='',modelCount=0;
 const owner=(req:Request,res:Response)=>{const key=identity(req,res);if(!key)return null;const now=Date.now();if(rates.size>10000)for(const[k,v]of rates)if(v.until<now)rates.delete(k);const rate=rates.get(key);if(rate&&rate.until>now){if(++rate.count>120){res.status(429).json({error:'Wait a minute before retrying.'});return null;}}else rates.set(key,{until:now+60000,count:1});return key;};
 app.get('/api/health',(_q,r)=>r.json({status:'ok',application:'roomready'}));
 app.get('/api/ping',(_q,r)=>r.json({endpoint:'RoomReady',at:new Date().toISOString()}));
 app.get('/api/bootstrap',(q,r)=>{const key=identity(q,r,true,options.production)!;const state=options.store.create(key);r.json({state,receipt:receipt(state),model:{enabled:!!options.adviser,label:options.adviser?options.modelLabel??'Bedrock adapter':'Deterministic guide — no model inference'}});});
 app.delete('/api/session',(q,r)=>{const key=owner(q,r);if(!key)return;options.store.clear(key);r.json({cleared:true});});
 app.get('/api/export',(q,r)=>{const key=owner(q,r);if(!key)return;const state=options.store.get(key);if(!state)return r.status(404).json({error:'Session expired.'});r.setHeader('Content-Disposition','attachment; filename="roomready-receipt.json"');r.json({application:'RoomReady',exportedAt:new Date().toISOString(),state,receipt:receipt(state)});});
 app.post('/api/advice',async(q,r,next)=>{try{
  const key=owner(q,r);if(!key)return;if(!options.adviser)return r.status(503).json({error:'AI guidance is not configured. All four probes remain available.'});
  const input=z.object({symptom:z.string().trim().min(1).max(1200),expectedRevision:z.number().int().nonnegative()}).strict().parse(q.body);const state=options.store.get(key);if(!state)return r.status(404).json({error:'Session expired.'});if(input.expectedRevision!==state.revision)return r.status(409).json({error:'Soundcheck changed. Refresh first.'});
  const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;modelCount=0;}if(modelCount>=(options.modelLimit??100))return r.status(429).json({error:'Model limit reached; manual checks remain available.'});modelCount++;
  try{const advice=await options.adviser({symptom:input.symptom,state});r.json({...advice,expectedRevision:state.revision});}catch{r.status(502).json({error:'AI guidance could not be verified. No evidence changed; continue using the probe controls.'});}
 }catch(e){next(e);}});
 app.post('/mcp',async(q,r,next)=>{
  const key=owner(q,r);if(!key)return;
  const server=new McpServer({name:'roomready',version:'0.1.0'});const revision=z.number().int().nonnegative(),requestId=z.string().uuid();
  const reply=(state:ReturnType<Store['get']>)=>({content:[{type:'text' as const,text:JSON.stringify({state,receipt:state?receipt(state):null})}]});
  const run=(command:Command,rev:number,id:string)=>{try{return reply(options.store.command(key,command,rev,id));}catch(e){return{isError:true,content:[{type:'text' as const,text:JSON.stringify({error:e instanceof Error?e.message:'Invalid action',code:e instanceof DomainError?e.code:'INVALID_INPUT'})}]};}};
  server.registerTool('get_receipt',{description:'Read this browser soundcheck, current findings and limits.',inputSchema:{}},async()=>reply(options.store.get(key)));
  server.registerTool('record_probe',{description:'Store browser measurements or explicit user playback confirmation. Server does not hear audio; raw audio is never accepted.',inputSchema:{observation:ObservationSchema,expectedRevision:revision,requestId}},async({observation,expectedRevision,requestId})=>run({type:'observe',observation},expectedRevision,requestId));
  server.registerTool('record_adjustment',{description:'Record a user adjustment and require a fresh result for that probe.',inputSchema:{probe:ProbeSchema,note:z.string().trim().min(1).max(500),expectedRevision:revision,requestId}},async({probe,note,expectedRevision,requestId})=>run({type:'adjust',probe,note},expectedRevision,requestId));
  server.registerTool('withdraw_observation',{description:'Preserve a disputed observation in history while excluding it from readiness. A fresh probe is required.',inputSchema:{id:z.string().uuid(),reason:z.string().trim().min(1).max(500),expectedRevision:revision,requestId}},async({id,reason,expectedRevision,requestId})=>run({type:'withdraw',id,reason},expectedRevision,requestId));
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});r.on('close',()=>{void server.close();void transport.close();});try{await server.connect(transport);await transport.handleRequest(q,r,q.body);}catch(e){if(!r.headersSent)next(e);}
 });
 app.all('/mcp',(_q,r)=>r.status(405).json({error:'Use Streamable HTTP POST.'}));
 const dist=options.dist??resolve('dist');if(existsSync(dist))app.use(express.static(dist));
 app.use((_q,r)=>r.status(404).json({error:'Route not found.'}));
 app.use((error:unknown,_q:Request,r:Response,_n:NextFunction)=>r.status(error instanceof DomainError?409:error instanceof z.ZodError?400:500).json({error:error instanceof DomainError?error.message:error instanceof z.ZodError?'Invalid request.':'Request failed.'}));
 return app;
}
