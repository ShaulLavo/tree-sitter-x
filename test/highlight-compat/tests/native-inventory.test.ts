import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { committedDifferences, preserveCandidate } from '../scripts/regenerate.ts';

it('separates only the exact candidate report identity and rejects every unrelated report or reference change', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'native-inventory-'));
  const generated = join(scratch, 'generated'), committed = join(scratch, 'committed');
  try {
    for (const root of [generated, committed]) setup(root);
    writeFileSync(join(committed, 'reports/native-pilot.md'), 'independently checked candidate');
    expect(committedDifferences(generated, committed)).toEqual([]);
    writeFileSync(join(committed, 'reports/unexpected.md'), 'extra report');
    expect(committedDifferences(generated, committed)).toEqual(['reports/unexpected.md: extra committed artifact']);
    rmSync(join(committed, 'reports/unexpected.md'));
    mkdirSync(join(committed, 'reports/nested'));
    writeFileSync(join(committed, 'reports/nested/native-pilot.md'), 'wrong identity');
    expect(committedDifferences(generated, committed)).toEqual(['reports/nested/native-pilot.md: extra committed artifact']);
    rmSync(join(committed, 'reports/nested'), { recursive: true });
    writeFileSync(join(committed, 'goldens/native-pilot.md'), 'wrong directory');
    expect(committedDifferences(generated, committed)).toEqual(['goldens/native-pilot.md: extra committed artifact']);
    rmSync(join(committed, 'goldens/native-pilot.md'));
    writeFileSync(join(committed, 'reports/reference.md'), 'changed truth');
    expect(committedDifferences(generated, committed)).toEqual(['reports/reference.md: bytes differ']);
    writeFileSync(join(generated, 'reports/native-pilot.md'), 'candidate must never be regenerated as reference truth');
    expect(() => committedDifferences(generated, committed)).toThrow('candidate report in reference generation');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

it('preserves candidate bytes during reference publication without using them in reference generation', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'native-preservation-'));
  const generated = join(scratch, 'generated'), committed = join(scratch, 'committed');
  try {
    setup(generated); setup(committed);
    writeFileSync(join(committed, 'reports/native-pilot.md'), 'independently checked bytes');
    preserveCandidate(generated, committed);
    expect(readFileSync(join(generated, 'reports/native-pilot.md'), 'utf8')).toBe('independently checked bytes');
    expect(readFileSync(join(generated, 'reports/reference.md'), 'utf8')).toBe('reference truth');
    expect(readFileSync(join(committed, 'reports/native-pilot.md'), 'utf8')).toBe('independently checked bytes');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

function setup(root: string): void {
  mkdirSync(join(root, 'goldens'), { recursive: true }); mkdirSync(join(root, 'reports'));
  writeFileSync(join(root, 'goldens/reference.json'), 'reference truth');
  writeFileSync(join(root, 'reports/reference.md'), 'reference truth');
}
