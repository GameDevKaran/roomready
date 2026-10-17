import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {applyCommand,createSession,DomainError,type Command,type Session} from '../domain/index.js';

// SQLite transaction/retry pattern adapted from HoldThat 557def91 (MIT).
// RoomReady sessions and evidence semantics are independent.
export class Store{
 private db:DatabaseSync;
 constructor(path:string){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions(owner TEXT PRIMARY KEY,body TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS operations(owner TEXT NOT NULL,key TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(owner,key));');this.prune();}
 private prune(){this.db.prepare('DELETE FROM operations WHERE owner IN (SELECT owner FROM sessions WHERE expires < ?)').run(Date.now());this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());}
 get(owner:string):Session|null{this.prune();const row=this.db.prepare('SELECT body FROM sessions WHERE owner=?').get(owner) as {body:string}|undefined;return row?JSON.parse(row.body):null;}
 create(owner:string){const current=this.get(owner);if(current)return current;const state=createSession();this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(owner,JSON.stringify(state),Date.now()+86400000);return state;}
 command(owner:string,command:Command,revision:number,key:string){
  this.db.exec('BEGIN IMMEDIATE');try{
   const state=this.get(owner);if(!state)throw new DomainError('NO_SESSION','Start a new soundcheck.');
   const hash=createHash('sha256').update(JSON.stringify({command,revision})).digest('hex');
   const cached=this.db.prepare('SELECT hash FROM operations WHERE owner=? AND key=?').get(owner,key) as {hash:string}|undefined;
   if(cached){if(cached.hash!==hash)throw new DomainError('KEY_REUSED','Request identifier already used.');this.db.exec('COMMIT');return state;}
   const next=applyCommand(state,command,revision);this.db.prepare('UPDATE sessions SET body=? WHERE owner=?').run(JSON.stringify(next),owner);this.db.prepare('INSERT INTO operations VALUES(?,?,?)').run(owner,key,hash);this.db.exec('COMMIT');return next;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 clear(owner:string){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('DELETE FROM operations WHERE owner=?').run(owner);this.db.prepare('DELETE FROM sessions WHERE owner=?').run(owner);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
 close(){this.db.close();}
}
