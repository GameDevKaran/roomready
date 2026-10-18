import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {ObjectSessionStore, GenerationConflict, MAX_SESSION_BYTES, type ConditionalObjects, type ObjectSnapshot} from '../src/server/object-store.js';
import {StorageUnavailable} from '../src/server/persistence.js';
import {createApp} from '../src/server/app.js';
import type {Command} from '../src/domain/index.js';

// Local transport double. These tests do not claim live GCP or microphone access.
class MemoryObjects implements ConditionalObjects {
  records = new Map<string, ObjectSnapshot>();
  sequence = 9007199254740993n;
  unavailable = false;
  loseNextWriteResponse = false;
  beforeRemove?: () => Promise<void>;
  async read(name: string) { if (this.unavailable) throw new Error('PRIVATE PROVIDER DETAILS'); return structuredClone(this.records.get(name) ?? null); }
  async write(name: string, body: string, generation: string) {
    await Promise.resolve();
    if (this.unavailable) throw new Error('PRIVATE PROVIDER DETAILS');
    if ((this.records.get(name)?.generation ?? '0') !== generation) throw new GenerationConflict();
    this.records.set(name, {body, generation: String(++this.sequence)});
    if (this.loseNextWriteResponse) { this.loseNextWriteResponse = false; throw new Error('Response lost after commit'); }
  }
  async remove(name: string, generation: string) {
    const hook = this.beforeRemove; this.beforeRemove = undefined; await hook?.();
    if (this.unavailable) throw new Error('PRIVATE PROVIDER DETAILS');
    if (this.records.get(name)?.generation !== generation) throw new GenerationConflict();
    this.records.delete(name);
  }
}
const owner = createHash('sha256').update('browser-owner').digest('hex');
const other = createHash('sha256').update('other-browser').digest('hex');
const observation: Command = {type: 'observe', observation: {probe: 'output', heard: 'yes', playbackRequested: true}};
const adjustment: Command = {type: 'adjust', probe: 'output', note: 'Selected another speaker'};
const errorCode = (code: string) => (error: any) => error.code === code;

test('concurrent bootstrap shares one soundcheck; a fresh instance preserves evidence and owner isolation', async () => {
  const objects = new MemoryObjects(); const a = new ObjectSessionStore(objects); const b = new ObjectSessionStore(objects);
  const [first, concurrent] = await Promise.all([a.create(owner), b.create(owner)]);
  assert.equal(first.id, concurrent.id); assert.equal(objects.records.size, 1);
  await a.command(owner, observation, 0, 'one', first.id); a.close();
  assert.equal((await b.get(owner))?.evidence.length, 1); assert.equal(await b.get(other), null);
  assert.ok(BigInt([...objects.records.values()][0].generation) > BigInt(Number.MAX_SAFE_INTEGER));
});

test('CAS gives one revision winner; concurrent identical retries commit once and return newest evidence', async () => {
  const objects = new MemoryObjects(); const a = new ObjectSessionStore(objects); const b = new ObjectSessionStore(objects);
  const {id} = await a.create(owner);
  const results = await Promise.allSettled([a.command(owner, observation, 0, 'one', id), b.command(owner, observation, 0, 'two', id)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.code, 'STALE_REVISION');
  const retries = await Promise.all([a.command(owner, adjustment, 1, 'same', id), b.command(owner, adjustment, 1, 'same', id)]);
  assert.deepEqual(retries.map(s => s.revision), [2, 2]);
  await a.command(owner, observation, 2, 'later', id);
  assert.equal((await b.command(owner, adjustment, 1, 'same', id)).revision, 3);
  await assert.rejects(a.command(owner, observation, 1, 'same', id), errorCode('KEY_REUSED'));
});

test('a lost write response is recoverable without duplicating evidence', async () => {
  const objects = new MemoryObjects(); const a = new ObjectSessionStore(objects); const {id} = await a.create(owner);
  objects.loseNextWriteResponse = true;
  await assert.rejects(a.command(owner, observation, 0, 'same', id), StorageUnavailable);
  const result = await a.command(owner, observation, 0, 'same', id);
  assert.equal(result.revision, 1); assert.equal(result.evidence.length, 1);
});

test('absolute 24-hour expiry is never extended by activity and expired commands cannot recreate a receipt', async () => {
  const objects = new MemoryObjects(); let now = 100; const a = new ObjectSessionStore(objects, () => now);
  const {id} = await a.create(owner);
  now += 86400000 - 1; await a.command(owner, observation, 0, 'last-millisecond', id);
  assert.equal((await a.get(owner))?.revision, 1);
  now++;
  await assert.rejects(a.command(owner, adjustment, 1, 'expired', id), errorCode('NO_SESSION'));
  assert.equal(await a.get(owner), null); assert.equal(objects.records.size, 0);
  const replacement = await a.create(owner); assert.notEqual(replacement.id, id);
  await assert.rejects(a.command(owner, observation, 0, 'last-millisecond', id), errorCode('STALE_SESSION'));
});

test('deletion racing a replacement cannot erase the new soundcheck; deletion retry is safe', async () => {
  const objects = new MemoryObjects(); const a = new ObjectSessionStore(objects); const b = new ObjectSessionStore(objects);
  const {id} = await a.create(owner); let replacement = '';
  objects.beforeRemove = async () => { objects.records.clear(); replacement = (await b.create(owner)).id; };
  await assert.rejects(a.clear(owner, id), errorCode('STALE_SESSION'));
  assert.equal((await b.get(owner))?.id, replacement);
  await b.clear(owner, replacement); await b.clear(owner, replacement);
  assert.equal(await a.get(owner), null);
});

test('expired-object cleanup retries CAS and preserves a freshly created replacement', async () => {
  const objects = new MemoryObjects(); let now = 100; const a = new ObjectSessionStore(objects, () => now); const b = new ObjectSessionStore(objects, () => now);
  const original = await a.create(owner); now += 86400000; let replacement = '';
  objects.beforeRemove = async () => { objects.records.clear(); replacement = (await b.create(owner)).id; };
  assert.equal((await a.get(owner))?.id, replacement); assert.notEqual(replacement, original.id);
});

test('unreadable/oversized state fails closed and repeated contention is bounded', async () => {
  const objects = new MemoryObjects(); const a = new ObjectSessionStore(objects); await a.create(owner);
  const [name, record] = [...objects.records.entries()][0];
  for (const body of ['not-json', '{}', 'x'.repeat(MAX_SESSION_BYTES + 1)]) {
    objects.records.set(name, {...record, body});
    await assert.rejects(a.get(owner), StorageUnavailable); assert.equal(objects.records.get(name)?.body, body);
  }
  objects.records.clear(); let attempts = 0;
  objects.write = async () => { attempts++; throw new GenerationConflict(); };
  await assert.rejects(a.create(owner), StorageUnavailable); assert.equal(attempts, 5);
});

test('real HTTP/MCP awaits object persistence and exposes only sanitized recoverable outages', async () => {
  const objects = new MemoryObjects(); const store = new ObjectSessionStore(objects);
  const server = createApp({store}).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + (server.address() as any).port;
  const bootstrap = await fetch(base + '/api/bootstrap'); const cookie = bootstrap.headers.get('set-cookie')!.split(';')[0];
  const headers = {cookie, 'Content-Type': 'application/json', origin: base};
  const {state} = await bootstrap.json();
  const client = new Client({name: 'async-store-local-test', version: '1'});
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), {requestInit: {headers: {cookie}}}));
    const saved = await client.callTool({name: 'record_probe', arguments: {observation: {probe: 'output', heard: 'yes', playbackRequested: true}, expectedRevision: 0, expectedSessionId: state.id, requestId: randomUUID()}});
    assert.equal(JSON.parse((saved.content as any)[0].text).receipt.confirmedChecks, 1);
    objects.unavailable = true;
    const failed = await fetch(base + '/api/bootstrap', {headers}); assert.equal(failed.status, 503); assert.equal(failed.headers.get('retry-after'), '5');
    const body = await failed.text(); assert.match(body, /STORAGE_UNAVAILABLE/); assert.ok(!body.includes('PRIVATE'));
    const failedMcp = await client.callTool({name: 'get_receipt', arguments: {}}); assert.equal(failedMcp.isError, true); assert.ok(!JSON.stringify(failedMcp).includes('PRIVATE'));
    objects.unavailable = false;
    assert.equal((await (await fetch(base + '/api/export', {headers})).json()).state.revision, 1);
    const cleared = await fetch(base + '/api/session', {method: 'DELETE', headers, body: JSON.stringify({expectedSessionId: state.id})});
    assert.equal(cleared.status, 200); assert.equal(objects.records.size, 0);
  } finally { await client.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('global admission rejects rotating-cookie requests before unbounded storage access', async () => {
  const objects = new MemoryObjects(); let reads = 0;
  objects.read = async () => { reads++; return null; };
  const server = createApp({store: new ObjectSessionStore(objects)}).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + (server.address() as any).port;
  try {
    for (let i = 0; i < 600; i++) {
      const result = await fetch(base + '/api/export', {headers: {cookie: 'roomready=' + i.toString(16).padStart(64, '0')}});
      assert.equal(result.status, 404); await result.text();
    }
    const denied = await fetch(base + '/api/export', {headers: {cookie: 'roomready=' + 'f'.repeat(64)}});
    assert.equal(denied.status, 429); assert.equal(reads, 600);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
