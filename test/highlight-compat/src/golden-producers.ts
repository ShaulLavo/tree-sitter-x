import type { GoldenProducer } from './golden.ts'
import type { ReferenceProfileId } from './schema.ts'

/** Oracle adapters register their golden producers here. */
export const goldenProducers: Readonly<Partial<Record<ReferenceProfileId, GoldenProducer>>> = {}
