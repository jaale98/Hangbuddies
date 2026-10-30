import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

it('client and shared code never import server code (answers stay secret)', () => {
  for (const f of [...files('src/client'), ...files('src/shared')]) {
    const src = readFileSync(f, 'utf8');
    expect(src, f).not.toMatch(/from ['"][^'"]*server\//);
  }
});
