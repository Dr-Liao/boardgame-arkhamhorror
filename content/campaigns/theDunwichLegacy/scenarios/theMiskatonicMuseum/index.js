import { buildChapter } from '../../chapters.js'
import { laterBehavior } from '../../later-behaviors.js'
export const { scenario, identities, layout, manifest } = buildChapter('theMiskatonicMuseum')
export const behavior = laterBehavior('theMiskatonicMuseum')
