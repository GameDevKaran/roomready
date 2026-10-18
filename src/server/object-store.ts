import {createHash} from 'node:crypto';
import {ZodError} from 'zod';
import {applyCommand, createSession, DomainError, type Command, type Session} from '../domain/index.js';
import {StorageUnavailable, type SoundcheckStore} from './persistence.js';

// Conditional transport/retry pattern adapted from HoldThat 0e90b898 (MIT).
// RoomReady preserves its own absolute 24-hour expiry and evidence semantics.
export class GenerationConflict extends Error {}
export interface ObjectSnapshot {body: string; generation: string}
export interface ConditionalObjects {
  read(name: string): Promise<ObjectSnapshot | null>;
  write(name: string, body: string, generation: string): Promise<void>;
  remove(name: string, generation: string): Promise<void>;
}
type RecordBody = {schema: 1; expires: number; session: Session; operations: Record<string, string>};
export const MAX_SESSION_BYTES = 1024 * 1024;
const TTL = 24 * 60 * 60 * 1000;

/** Session and retry identities commit atomically in one generation-guarded object. */
export class ObjectSessionStore implements SoundcheckStore {
  constructor(private objects: ConditionalObjects, private now: () => number = Date.now) {}
  private name(owner: string): string {
    if (!/^[a-f0-9]{64}$/.test(owner)) throw new Error('Invalid opaque owner hash.');
    return 'sessions/' + owner + '.json';
  }
  private async retry<T>(action: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { return await action(); }
      catch (error) {
        if (error instanceof DomainError || error instanceof ZodError) throw error;
        if (!(error instanceof GenerationConflict)) throw new StorageUnavailable();
      }
    }
    throw new StorageUnavailable();
  }
  private async current(name: string): Promise<{value: RecordBody; generation: string} | null> {
    const snapshot = await this.objects.read(name);
    if (!snapshot) return null;
    if (Buffer.byteLength(snapshot.body) > MAX_SESSION_BYTES) throw new StorageUnavailable();
    const value = JSON.parse(snapshot.body) as RecordBody;
    if (value.schema !== 1 || !Number.isFinite(value.expires) || typeof value.session?.id !== 'string' ||
        !Number.isInteger(value.session.revision) || value.session.revision < 0 ||
        !Number.isFinite(Date.parse(value.session.createdAt)) || !Array.isArray(value.session.evidence) ||
        !Array.isArray(value.session.adjustments) || !value.operations ||
        typeof value.operations !== 'object' || Array.isArray(value.operations)) throw new StorageUnavailable();
    if (this.now() >= value.expires) {
      await this.objects.remove(name, snapshot.generation);
      return null;
    }
    return {value, generation: snapshot.generation};
  }
  private encode(value: RecordBody): string {
    const body = JSON.stringify(value);
    if (Buffer.byteLength(body) > MAX_SESSION_BYTES) throw new DomainError('SESSION_LIMIT', 'Export and start a new soundcheck.');
    return body;
  }
  async get(owner: string): Promise<Session | null> {
    return this.retry(async () => (await this.current(this.name(owner)))?.value.session ?? null);
  }
  async create(owner: string): Promise<Session> {
    const name = this.name(owner);
    return this.retry(async () => {
      const current = await this.current(name);
      if (current) return current.value.session;
      const session = createSession();
      await this.objects.write(name, this.encode({schema: 1, expires: this.now() + TTL, session, operations: {}}), '0');
      return session;
    });
  }
  async command(owner: string, command: Command, revision: number, key: string, expectedSessionId: string): Promise<Session> {
    const name = this.name(owner);
    const hash = createHash('sha256').update(JSON.stringify({command, revision})).digest('hex');
    const retryKey = createHash('sha256').update(key).digest('hex');
    return this.retry(async () => {
      const record = await this.current(name);
      if (!record) throw new DomainError('NO_SESSION', 'Start a new soundcheck.');
      const {value, generation} = record;
      if (value.session.id !== expectedSessionId) throw new DomainError('STALE_SESSION', 'This soundcheck was replaced. Refresh before changing it.');
      const cached = value.operations[retryKey];
      if (cached) {
        if (cached !== hash) throw new DomainError('KEY_REUSED', 'Request identifier already used.');
        return value.session;
      }
      const session = applyCommand(value.session, command, revision);
      // Absolute expiry is deliberately retained; activity never renews it.
      await this.objects.write(name, this.encode({...value, session, operations: {...value.operations, [retryKey]: hash}}), generation);
      return session;
    });
  }
  async clear(owner: string, expectedSessionId: string): Promise<void> {
    const name = this.name(owner);
    return this.retry(async () => {
      const record = await this.current(name);
      if (!record) return;
      if (record.value.session.id !== expectedSessionId) throw new DomainError('STALE_SESSION', 'This soundcheck was replaced. Refresh before clearing it.');
      await this.objects.remove(name, record.generation);
    });
  }
  close(): void {}
}
