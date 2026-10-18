import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('production startup fails closed for noncanonical origins and ephemeral Cloud Run storage', () => {
  for (const [overrides, message] of [
    [{NODE_ENV: 'production', ROOMREADY_ORIGIN: 'https://roomready.example/'}, /canonical HTTPS origin/],
    [{NODE_ENV: 'production', ROOMREADY_ORIGIN: 'https://roomready.example/path'}, /canonical HTTPS origin/],
    [{NODE_ENV: 'production', ROOMREADY_ORIGIN: 'https://roomready.example', K_SERVICE: 'roomready', ROOMREADY_STORE: 'sqlite'}, /Cloud Run requires the durable GCS store/],
    [{NODE_ENV: 'production', ROOMREADY_ORIGIN: 'https://roomready.example', ROOMREADY_STORE: 'unknown'}, /ROOMREADY_STORE must be/],
  ] as const) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], {
      env: {...process.env, ROOMREADY_MODEL_PROVIDER: 'none', ...overrides}, encoding: 'utf8', timeout: 10000,
    });
    assert.notEqual(result.status, 0); assert.match(result.stderr, message);
  }
});
