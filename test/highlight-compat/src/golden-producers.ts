import type { GoldenProducers } from './golden.ts'
import { differingCases, originalCases } from './reference-results.ts'

/** Reference profiles over the original fixtures; raw:shiki-fork only where it differs from raw. */
export const goldenProducers: GoldenProducers = {
  raw: () => originalCases('raw'),
  'raw:shiki-fork': () => differingCases('raw:shiki-fork', 'raw'),
  'shiki-api': () => originalCases('shiki-api'),
  product: () => originalCases('product'),
  'product:warm': () => originalCases('product:warm'),
}
