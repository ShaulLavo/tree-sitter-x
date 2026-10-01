export interface QueryPattern {
  readonly index: number
  readonly from: number
  readonly line: number
  readonly source: string
  readonly operators: readonly string[]
}

interface QueryToken {
  readonly from: number
  readonly value: string
}

function queryTokens(source: string): QueryToken[] {
  const tokens: QueryToken[] = []
  const expression = /;[^\n]*|"(?:\\[\s\S]|[^"\\])*"|[()[\]]|[^\s()[\]";]+/g
  for (const match of source.matchAll(expression)) {
    if (match[0].startsWith(';')) continue
    tokens.push({ from: match.index, value: match[0] })
  }
  return tokens
}

export function queryPatterns(source: string): QueryPattern[] {
  const tokens = queryTokens(source)
  const starts: number[] = []
  const stack: string[] = []
  for (const token of tokens) {
    if (token.value === '(' || token.value === '[') {
      if (stack.length === 0) starts.push(token.from)
      stack.push(token.value)
      continue
    }
    if (token.value !== ')' && token.value !== ']') continue
    const expected = token.value === ')' ? '(' : '['
    if (stack.pop() !== expected) throw new Error(`unbalanced query at ${token.from}`)
  }
  if (stack.length > 0) throw new Error('unbalanced query at end of input')
  return starts.map((from, index) => {
    const to = starts[index + 1] ?? source.length
    return {
      index, from, line: source.slice(0, from).split('\n').length,
      source: source.slice(from, to),
      operators: [...new Set(tokens.filter(token => token.from >= from && token.from < to && token.value.startsWith('#')).map(token => token.value.slice(1)))].sort(),
    }
  })
}

export const TEXT_OPERATORS = [
  'eq?', 'not-eq?', 'any-eq?', 'any-not-eq?',
  'match?', 'not-match?', 'any-match?', 'any-not-match?',
  'any-of?', 'not-any-of?',
] as const

export function requireSupportedOperators(operators: readonly string[]): void {
  const unknown = operators.filter(operator => !(TEXT_OPERATORS as readonly string[]).includes(operator))
  if (unknown.length > 0) throw new Error(`unsupported query operation ${unknown.join(', ')}`)
}
