import { buildChapter } from '../../chapters.js'
import { laterBehavior } from '../../later-behaviors.js'
export const { scenario, identities, layout, manifest } = buildChapter('whereDoomAwaits')
export const behavior = laterBehavior('whereDoomAwaits')
