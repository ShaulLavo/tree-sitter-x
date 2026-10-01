import type { Expectation } from '../expectations.ts'
import { physicalLines } from './source-map.ts'
import type { PhysicalLine } from './source-map.ts'

export interface BaselineSection {
  readonly grammar: 'TypeScript.tmLanguage' | 'TypeScriptReact.tmLanguage'
  readonly expectations: readonly Expectation[]
}

function sectionStart(records: readonly PhysicalLine[], sourceLines: readonly PhysicalLine[]): number {
  if (records[0].text !== 'original file') return 0
  if (!/^-{3,}$/.test(records[1]?.text ?? '')) throw new Error('invalid baseline input header')
  for (const [index, line] of sourceLines.entries()) {
    if (records[index + 2]?.text !== line.text) throw new Error(`baseline original source mismatch at line ${index + 3}`)
  }
  const closing = sourceLines.length + 2
  if (records[closing]?.text !== records[1].text) throw new Error('missing baseline input separator')
  return closing + 1
}

/** The baseline's leading `>` shifts carets by one; its tokenizer also emits an EOL sentinel. */
export function adaptTypescript(source: string, baseline: string, fixtureId: string, file: string): readonly BaselineSection[] {
  const lines = physicalLines(source)
  const records = physicalLines(baseline)
  const sections: BaselineSection[] = []
  let grammar: BaselineSection['grammar'] | undefined
  let expectations: Expectation[] = []
  let row = -1
  let tokenEnd = 0
  let separatorAllowed = false
  for (let i = sectionStart(records, lines); i < records.length; i++) {
    const record = records[i]
    const header = /^Grammar: (TypeScript(?:React)?\.tmLanguage)$/.exec(record.text)
    if (header) {
      if (grammar) finish()
      grammar = header[1] as BaselineSection['grammar']
      if (sections.some(section => section.grammar === grammar)) throw new Error(`duplicate baseline grammar at line ${record.number}`)
      expectations = []
      row = -1
      tokenEnd = 0
      separatorAllowed = true
      continue
    }
    if (record.text === '') continue
    if (separatorAllowed && /^-{3,}$/.test(record.text)) {
      separatorAllowed = false
      continue
    }
    separatorAllowed = false
    if (!grammar) throw new Error(`unexpected baseline record at line ${record.number}`)
    if (record.text.startsWith('>')) {
      finishRow()
      row++
      tokenEnd = 0
      if (!lines[row] || record.text.slice(1) !== lines[row].text) throw new Error(`baseline source mismatch at line ${record.number}`)
      continue
    }
    const caret = /^( +)(\^+)$/.exec(record.text)
    if (!caret) throw new Error(`unexpected baseline record at line ${record.number}`)
    const line = lines[row]
    const column = caret[1].length - 1
    const end = column + caret[2].length
    if (!line || column > line.text.length || end > line.text.length + 1) throw new Error(`baseline caret outside source at line ${record.number}`)
    if (column !== tokenEnd) throw new Error(`baseline token coverage gap or overlap at line ${record.number}`)
    tokenEnd = end
    const scopesLine = records[++i]
    if (!scopesLine || !scopesLine.text.startsWith(caret[1])) throw new Error(`missing baseline scope path at line ${record.number}`)
    const scopes = scopesLine.text.slice(caret[1].length).split(' ')
    if (scopes.some(scope => !/^[\w][\w.-]*$/.test(scope)) || scopes.includes('INCORRECT_SCOPE_EXTENSION')) {
      throw new Error(`invalid baseline scope path at line ${scopesLine.number}`)
    }
    const to = line.from + Math.min(end, line.text.length)
    const from = line.from + column
    if (to === from) continue
    expectations.push({
      fixtureId, from, to, scopes,
      origin: { family: 'typescript-tmlanguage', file, line: record.number, column: caret[1].length + 1 },
    })
  }
  if (grammar) finish()
  if (sections.length === 0) throw new Error('baseline has no grammar sections')
  return sections

  function finishRow(): void {
    if (row < 0 || sections.length > 0 && tokenEnd === 0) return
    if (Math.min(tokenEnd, lines[row].text.length) !== lines[row].text.length) {
      throw new Error(`baseline token coverage is incomplete for source line ${row + 1}`)
    }
  }

  function finish(): void {
    finishRow()
    if (row + 1 !== lines.length) throw new Error(`baseline ${grammar} has ${row + 1} lines for ${lines.length} source lines`)
    sections.push({ grammar: grammar!, expectations })
  }
}
