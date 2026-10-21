import { buildChapter } from '../../chapters.js'
import { laterBehavior } from '../../later-behaviors.js'
import { coordinates } from './layout.js'
const chapter = buildChapter('theEssexCountyExpress', coordinates)
export const { scenario, identities, layout, manifest } = chapter
export const behavior = laterBehavior('theEssexCountyExpress')
