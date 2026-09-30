export const MISMATCH_CATEGORIES = ['leaf', 'missing-scope', 'extra-scope', 'reordered', 'ancestor', 'other'] as const
export type MismatchCategory = (typeof MISMATCH_CATEGORIES)[number]

function isProperSubsequence(shorter: readonly string[], longer: readonly string[]): boolean {
  if (shorter.length >= longer.length) return false
  let next = 0
  for (const name of longer) {
    if (next < shorter.length && shorter[next] === name) next++
  }
  return next === shorter.length
}

function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((name, i) => name === right[i])
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i])
}

function differsOnlyInLeaf(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false
  const last = a.length - 1
  return a[last] !== b[last] && a.slice(0, last).every((name, i) => name === b[i])
}

function sharesLeaf(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  return a[a.length - 1] === b[b.length - 1]
}

/** A conservative label from the first rule that explains the pair; mixed edits such as a reorder plus an insertion fall to `ancestor` or `other`. Precondition: the paths differ. */
export function categorize(reference: readonly string[], candidate: readonly string[]): MismatchCategory {
  if (isProperSubsequence(candidate, reference)) return 'missing-scope'
  if (isProperSubsequence(reference, candidate)) return 'extra-scope'
  if (sameMultiset(reference, candidate) && !sameOrder(reference, candidate)) return 'reordered'
  if (differsOnlyInLeaf(reference, candidate)) return 'leaf'
  if (sharesLeaf(reference, candidate)) return 'ancestor'
  return 'other'
}
