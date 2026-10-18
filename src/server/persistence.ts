import type {Command, Session} from '../domain/index.js';

type Result<T> = T | Promise<T>;
/** HTTP/MCP await this seam; SQLite remains available for local persistent volumes. */
export interface SoundcheckStore {
  get(owner: string): Result<Session | null>;
  create(owner: string): Result<Session>;
  command(owner: string, command: Command, revision: number, key: string, expectedSessionId: string): Result<Session>;
  clear(owner: string, expectedSessionId: string): Result<void>;
  close(): Result<void>;
}

export class StorageUnavailable extends Error {
  constructor() { super('Soundcheck storage is temporarily unavailable. Retry without clearing your receipt.'); }
}
