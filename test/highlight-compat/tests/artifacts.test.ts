import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { artifactDifferences, artifactHash } from '../src/artifacts.ts'

it.each(['extra', 'replacement', 'dangling', 'directory', 'root'] as const)('rejects a %s symlink in either artifact tree', kind => {
  const root = mkdtempSync(join(tmpdir(), 'highlight-compat-artifact-link-'))
  const left = join(root, 'left'), right = join(root, 'right')
  try {
    mkdirSync(left)
    mkdirSync(right)
    writeFileSync(join(left, 'report.md'), 'same bytes')
    writeFileSync(join(root, 'outside.md'), 'same bytes')
    if (kind === 'replacement') symlinkSync(join(root, 'outside.md'), join(right, 'report.md'))
    else writeFileSync(join(right, 'report.md'), 'same bytes')
    if (kind === 'extra') symlinkSync(join(root, 'outside.md'), join(right, 'extra.md'))
    if (kind === 'dangling') symlinkSync(join(root, 'absent.md'), join(right, 'dangling.md'))
    if (kind === 'directory') symlinkSync(left, join(right, 'nested'))
    const checked = kind === 'root' ? join(root, 'root-link') : right
    if (kind === 'root') symlinkSync(right, checked)
    expect(() => artifactHash(checked)).toThrow('unsupported artifact entry')
    expect(() => artifactDifferences(left, checked)).toThrow('unsupported artifact entry')
    expect(() => artifactDifferences(checked, left)).toThrow('unsupported artifact entry')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('rejects unsupported filesystem entry types without opening them', () => {
  const root = mkdtempSync(join(tmpdir(), 'highlight-compat-artifact-fifo-'))
  try {
    execFileSync('mkfifo', [join(root, 'pipe')])
    expect(() => artifactHash(root)).toThrow('unsupported artifact entry')
    expect(() => artifactDifferences(root, join(root, 'absent'))).toThrow('unsupported artifact entry')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
