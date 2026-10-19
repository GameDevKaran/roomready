import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {chromium,expect} from '@playwright/test';
import {installSyntheticAudio} from '../tests/browser/synthetic-audio.js';

const journal=JSON.parse(readFileSync('.local/cloud-run-deployment.json','utf8'));
assert.equal(journal.project,'tough-melody-508008-p8');assert.equal(journal.service,'roomready');
const base=journal.url as string;assert.match(base,/^https:\/\/roomready-[a-z0-9.-]+\.run\.app$/);
const phase=process.argv[2]??'prepare';assert.ok(['prepare','restart','public'].includes(phase));
const auth=process.env.ROOMREADY_VERIFY_ID_TOKEN;
const headers:Record<string,string>=auth?{Authorization:'Bearer '+auth}:{};
if(phase==='public')assert.ok(!auth,'Public checks must be anonymous.');
mkdirSync('.local/live',{recursive:true});
const checks:string[]=[];
const report:any={at:new Date().toISOString(),phase,url:base,commit:journal.commit,image:journal.image,revision:journal.revision,
 authentication:auth?'operator identity (not saved)':'anonymous public',storage:'real deployed GCS',model:'disabled; no inference claim',checks};
async function mcp(cookie:string){const client=new Client({name:'roomready-live-verifier',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{...headers,cookie}}}));return client;}
async function json(response:Response){assert.equal(response.status,200);return response.json();}
try{
 assert.equal((await json(await fetch(base+'/api/health',{headers}))).application,'roomready');checks.push('HTTPS health');
 if(phase==='prepare'){
  const response=await fetch(base+'/api/bootstrap',{headers});const initial=await json(response);assert.equal(initial.state.revision,0);assert.equal(initial.receipt.status,'UNRESOLVED');assert.equal(initial.model.enabled,false);
  const setCookie=response.headers.get('set-cookie')!;assert.match(setCookie,/Secure/);assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);const cookie=setCookie.split(';')[0];checks.push('secure browser cookie and no readiness invented before evidence');
  const client=await mcp(cookie);let state=initial.state;
  try{
   const tools=await client.listTools();assert.equal(tools.tools.length,4);checks.push('actual MCP initialize and all four tools');
   const samplesMs:number[]=[];for(let n=0;n<5;n++){const started=performance.now();const ping=await json(await fetch(base+'/api/ping?t='+Date.now(),{headers}));assert.equal(ping.endpoint,'RoomReady');samplesMs.push(performance.now()-started);}
   const args={observation:{probe:'network',samplesMs,failures:0},expectedRevision:state.revision,expectedSessionId:state.id,requestId:randomUUID()};
   const result=await client.callTool({name:'record_probe',arguments:args});assert.ok(!result.isError);state=JSON.parse((result.content as any)[0].text).state;assert.equal(state.revision,1);
   const retry=await client.callTool({name:'record_probe',arguments:args});assert.ok(!retry.isError);assert.equal(JSON.parse((retry.content as any)[0].text).state.revision,1);checks.push('five real endpoint round trips recorded through MCP with idempotent retry');
   const adjustment=await client.callTool({name:'record_adjustment',arguments:{probe:'network',note:'Live release check: changed connection, requires a retest.',expectedRevision:1,expectedSessionId:state.id,requestId:randomUUID()}});assert.ok(!adjustment.isError);const changed=JSON.parse((adjustment.content as any)[0].text);state=changed.state;assert.equal(changed.receipt.findings[3].status,'unknown');checks.push('adjustment invalidates previous measurement and retains history');
   const stale=await client.callTool({name:'record_probe',arguments:{...args,requestId:randomUUID()}});assert.equal(stale.isError,true);checks.push('stale revision rejected');
  }finally{await client.close();}
  const other=await json(await fetch(base+'/api/bootstrap',{headers}));assert.notEqual(other.state.id,state.id);assert.equal(other.state.evidence.length,0);checks.push('independent browser isolation');
  const denied=await fetch(base+'/api/session',{method:'DELETE',headers:{...headers,cookie,origin:'https://untrusted.invalid','Content-Type':'application/json'},body:JSON.stringify({expectedSessionId:state.id})});assert.equal(denied.status,403);checks.push('hostile-origin mutation blocked');
  writeFileSync('.local/live/private-probe.json',JSON.stringify({cookie,id:state.id,revision:state.revision,deployedRevision:journal.revision}));
 }else if(phase==='restart'){
  const probe=JSON.parse(readFileSync('.local/live/private-probe.json','utf8'));assert.notEqual(probe.deployedRevision,journal.revision);
  const sessionHeaders={...headers,cookie:probe.cookie,origin:base,'Content-Type':'application/json'};
  const saved=await json(await fetch(base+'/api/bootstrap',{headers:sessionHeaders}));assert.equal(saved.state.id,probe.id);assert.equal(saved.state.revision,probe.revision);assert.equal(saved.state.evidence.length,1);assert.equal(saved.state.adjustments.length,1);checks.push('real stored evidence and adjustments survive actual Cloud Run revision replacement');
  const exported=await json(await fetch(base+'/api/export',{headers:sessionHeaders}));assert.equal(exported.state.id,probe.id);checks.push('receipt export');
  await json(await fetch(base+'/api/session',{method:'DELETE',headers:sessionHeaders,body:JSON.stringify({expectedSessionId:probe.id})}));const fresh=await json(await fetch(base+'/api/bootstrap',{headers:sessionHeaders}));assert.notEqual(fresh.state.id,probe.id);assert.equal(fresh.state.evidence.length,0);checks.push('live deletion and new isolated receipt');
 }else{
  report.audioVerification='Explicit synthetic Web Audio stream plus scripted playback confirmations; no physical microphone, human audibility or meeting-service claim.';
  const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'.local/live/video',size:{width:1440,height:1000}}});
  try{
   const page=await context.newPage();await installSyntheticAudio(page);let uploadedAudio=false;page.on('request',request=>{if(request.method()==='POST'&&(/audio\/|base64|blob:/.test(request.postData()??'')))uploadedAudio=true;});
   await page.goto(base);await expect(page.getByRole('heading',{name:'Let’s close the gaps.'})).toBeVisible({timeout:15000});
   await page.getByLabel('I agree to this short microphone recording.').check();await page.getByRole('button',{name:/Record a 3-second/}).click();await expect(page.getByRole('status')).toContainText('Sample measured',{timeout:20000});
   await page.getByRole('button',{name:/02 Recording replay/}).click();await page.locator('audio').evaluate((element:HTMLAudioElement)=>element.play());await expect(page.getByRole('button',{name:'Yes, it sounds clear'})).toBeEnabled({timeout:15000});await page.getByRole('button',{name:'Yes, it sounds clear'}).click();
   await page.getByRole('button',{name:/03 Speaker tone/}).click();await page.getByRole('button',{name:/Play test tone/}).click();await page.getByRole('button',{name:'I heard it',exact:true}).click();
   await page.getByRole('button',{name:/04 Connection/}).click();await page.getByRole('button',{name:/Check this connection/}).click();await expect(page.getByRole('status')).toContainText('Five connection attempts',{timeout:20000});
   const exportResponse=await page.request.get(base+'/api/export');assert.equal(exportResponse.status(),200);const exported=await exportResponse.json();assert.equal(exported.state.evidence.length,4);assert.equal(uploadedAudio,false);
   assert.ok(['UNRESOLVED','READY_WITH_LIMITS'].includes(exported.receipt.status));report.receiptStatus=exported.receipt.status;report.networkFinding=exported.receipt.findings[3];checks.push('public browser measured synthetic audio, replay/tone confirmations, real endpoint timing, actual MCP and receipt export; no audio upload');
   await page.screenshot({path:'.local/live/roomready-desktop.png',fullPage:true});await page.reload();await expect(page.getByRole('button',{name:/Recording replay/}).first()).toBeVisible({timeout:15000});await page.getByRole('button',{name:/Recording replay/}).first().click();await expect(page.getByText(/No current recording is available/)).toBeVisible();checks.push('saved observations reload while in-memory raw recording is removed');
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/live/roomready-mobile.png',fullPage:true});checks.push('desktop and mobile screenshots');
   await page.getByRole('button',{name:/03 Speaker tone|Speaker tone/}).first().click();await page.getByText('Changed a setting? Record an adjustment').click();await page.getByLabel('What did you change?').fill('Live test: changed headphones');await page.getByRole('button',{name:'Save adjustment & retest'}).click();await expect(page.getByText('Live test: changed headphones',{exact:true})).toBeVisible({timeout:15000});checks.push('public browser adjustment and retest requirement');
   const clearButton=page.getByRole('button',{name:'Clear & start again'});await expect(clearButton).toBeEnabled({timeout:15000});let dialogSeen=false;page.once('dialog',async dialog=>{dialogSeen=true;await dialog.accept();});await clearButton.click();await expect(page.getByText('Your first observation will appear here.',{exact:false})).toBeVisible({timeout:15000});assert.equal(dialogSeen,true);checks.push('explicit browser clear confirmed');
  }finally{await context.close();await browser.close();}
 }
 report.passed=true;
}catch(error){report.passed=false;report.error=error instanceof Error?error.message.replace(/Bearer\s+\S+/g,'Bearer [redacted]'):'verification failed';throw error;}
finally{writeFileSync('.local/live/'+phase+'-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({phase,passed:report.passed,checks}));}
