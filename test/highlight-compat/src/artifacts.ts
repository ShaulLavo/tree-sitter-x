import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

export function artifactFiles(root: string): string[] {
  const status = lstatSync(root, { throwIfNoEntry: false })
  if (status === undefined) return []
  if (!status.isDirectory()) throw new Error(`unsupported artifact entry: ${root}`)
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...artifactFiles(path))
    else if (entry.isFile()) files.push(path)
    else throw new Error(`unsupported artifact entry: ${path}`)
  }
  return files.sort()
}

export function artifactHash(root: string): string {
  const hash = createHash('sha256')
  for (const file of artifactFiles(root)) {
    hash.update(relative(root, file).replaceAll('\\', '/') + '\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function artifactDifferences(expected: string, actual: string): string[] {
  const names = new Set([...artifactFiles(expected).map(file => relative(expected, file)), ...artifactFiles(actual).map(file => relative(actual, file))])
  const differences: string[] = []
  for (const name of [...names].sort()) {
    const left = join(expected, name), right = join(actual, name)
    if (!existsSync(left)) differences.push(`${name}: extra committed artifact`)
    else if (!existsSync(right)) differences.push(`${name}: missing committed artifact`)
    else if (!readFileSync(left).equals(readFileSync(right))) differences.push(`${name}: bytes differ`)
  }
  return differences
}
