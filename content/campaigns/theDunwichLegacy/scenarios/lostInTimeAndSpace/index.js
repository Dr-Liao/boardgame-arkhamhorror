import { buildChapter } from '../../chapters.js'
import { laterBehavior } from '../../later-behaviors.js'
export const { scenario, identities, layout, manifest } = buildChapter('lostInTimeAndSpace')
export const behavior = laterBehavior('lostInTimeAndSpace')
