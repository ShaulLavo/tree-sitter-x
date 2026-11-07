import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { cpus, hostname, release, totalmem, type } from 'node:os';
import { resolve } from 'node:path';
import { repositoryRoot, digest } from '../native/component-inputs.ts';
import { ORACLE_THEMES } from '../oracles/pins.ts';
import { record, unsupported } from './model.ts';

function git(args: readonly string[]): string {
  return execFileSync('git', Array.from(args), { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

export async function sourceIdentity() {
  const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
  paths.sort();
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(JSON.stringify([path, digest(await readFile(resolve(repositoryRoot, path)))]));
    hash.update('\n');
  }
  return { head: git(['rev-parse', 'HEAD']).trim(), status: git(['status', '--porcelain=v1', '--untracked-files=all']),
    contentSha256: hash.digest('hex'), files: paths.length, method: 'sha256 of sorted JSON [path,sha256(bytes)] lines; tracked and nonignored untracked files' };
}

async function limit(path: string) {
  try { return { kind: 'observed', value: (await readFile(path, 'utf8')).trim() }; }
  catch { return unsupported(`Cannot read ${path}`); }
}

export async function environment() {
  const cpu = cpus();
  let group = '';
  try { group = (await readFile('/proc/self/cgroup', 'utf8')).split('\n').find(line => line.startsWith('0::'))?.slice(3) ?? ''; }
  catch { /* Non-Linux hosts report unavailable cgroup files below. */ }
  const root = `/sys/fs/cgroup${group === '/' ? '' : group}`;
  return { hostname: hostname(), os: { type: type(), release: release(), platform: process.platform, arch: process.arch },
    hardware: { cpuModels: Array.from(new Set(cpu.map(entry => entry.model))), logicalCpus: cpu.length, totalMemoryBytes: totalmem() },
    runtime: { executable: process.execPath, versions: process.versions, execArgv: process.execArgv },
    limits: { cgroup: await limit('/proc/self/cgroup'), memory: await limit(`${root}/memory.max`), cpu: await limit(`${root}/cpu.max`),
      cpuset: await limit(`${root}/cpuset.cpus.effective`), process: await limit('/proc/self/limits'),
      note: 'Leaf cgroup limits only; ancestor limits and quiet-host isolation are not inferred.' } };
}

function entries(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Invalid catalog array');
  return Array.from(value, record);
}
function name(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Invalid catalog name');
  return value;
}

export async function catalog(language: string) {
  const base = new URL('../../manifest/', import.meta.url);
  const assetsBytes = await readFile(new URL('assets.json', base));
  const structuralBytes = await readFile(new URL('tree-sitter-languages.json', base));
  const assets = record(JSON.parse(assetsBytes.toString('utf8')));
  const structural = record(JSON.parse(structuralBytes.toString('utf8')));
  return { manifestSha256: { assets: digest(assetsBytes), structural: digest(structuralBytes) },
    languages: entries(assets.grammars).filter(entry => entry.public === true).map(entry => ({ id: name(entry.name),
      status: entry.name === language ? 'measured-partial-prototype' : 'not-measured',
      reason: entry.name === language ? 'Full-pass diagnostic only; no parity, incrementality or promotion acceptance.' : 'Outside this command invocation.' })),
    themes: entries(assets.themes).map(entry => ({ id: name(entry.id),
      status: ORACLE_THEMES.includes(name(entry.id)) ? 'reference-matcher-only' : 'not-measured' })),
    structuralLanguages: entries(structural.languages).map(entry => ({ id: name(entry.id),
      status: entry.id === language ? 'measured-root-only' : 'not-measured', injectionDependencies: entry.injectionDependencies })),
    unavailableInjectionDependencies: record(structural.registry).unavailableInjectionDependencies,
    mixedMarkdown: unsupported('Existing mixed-language prototype is outside this root-only measurement adapter; no injection work is included.') };
}
