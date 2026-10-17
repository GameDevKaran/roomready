import {createHash,randomBytes} from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';
// Narrow HTTP/session safeguards adapted from HoldThat 557def91, MIT.
export function guard(origin?:string){return(req:Request,res:Response,next:NextFunction)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');res.setHeader('Permissions-Policy','camera=(), microphone=(self)');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 if(req.path==='/api/health')return next();
 const host=req.get('host')??'',source=req.get('origin');
 if(origin?host!==new URL(origin).host:!['127.0.0.1','localhost','[::1]'].includes(req.hostname))return res.status(403).json({error:'Unrecognized host.'});
 if(source&&(origin?source!==origin:!['http://'+host,'http://127.0.0.1:5173','http://localhost:5173'].includes(source)))return res.status(403).json({error:'Different origin.'});
 if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Cross-site request refused.'});next();
};}
export function identity(req:Request,res:Response,create=false,secure=false){
 let token=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('roomready='))?.slice(10);
 if(!token||!/^[a-f0-9]{64}$/.test(token)){if(!create){res.status(401).json({error:'Open RoomReady first.'});return null;}token=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`roomready=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${secure?'; Secure':''}`);}
 return createHash('sha256').update(token).digest('hex');
}
