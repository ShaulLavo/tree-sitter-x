import { expect, it } from 'vitest'
import { weightedRatio } from '../src/baseline-report.ts'
import { historicalScores } from '../src/historical-report.ts'

it('keeps empty comparisons N/A and weights comparable UTF-16 units', () => {
  expect(weightedRatio([])).toEqual({ matching: 0, comparable: 0, ratio: null })
  expect(weightedRatio([{ matching: 1, comparable: 2, ratio: 0.5 }, { matching: 8, comparable: 8, ratio: 1 }])).toEqual({ matching: 9, comparable: 10, ratio: 0.9 })
})

it('accounts for every historical assertion separately for raw and product', () => {
  const scores = historicalScores()
  for (const profile of ['raw', 'product']) {
    const selected = scores.filter(score => score.profile === profile)
    expect(selected.reduce((sum, score) => sum + score.total, 0)).toBe(2148)
    expect(selected.filter(score => score.family === 'vscode-colorize').reduce((sum, score) => sum + score.total, 0)).toBe(545)
    expect(selected.every(score => score.status === 'complete')).toBe(true)
  }
})
