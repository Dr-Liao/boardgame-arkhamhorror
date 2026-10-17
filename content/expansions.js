import { manifest, effects } from './packs/dunwichSupport/manifest.js'
import { missingMechanics } from './mechanics.js'
import { manifest as playerManifest, effects as playerEffects } from './packs/dunwichPlayer/manifest.js'
import { manifest as carcosaPlayerManifest, effects as carcosaPlayerEffects } from './packs/carcosaPlayer/manifest.js'

// Remove this one registration to remove the optional batch. No UI/name branches.
export const expansionBundles = [
  { manifest, effects },
  { manifest: playerManifest, effects: playerEffects },
  { manifest: carcosaPlayerManifest, effects: carcosaPlayerEffects },
]
export function expansionCardReady(pack, card, handlers) {
  return ['playable', 'verified'].includes(pack.status) && card.rulesImplemented && card.deckbuilding
    && !card.blockedReason && missingMechanics(card.requiredMechanicIds).length === 0 && !!handlers[card.code]
}
export const expansionPlayerCodes = Object.freeze(expansionBundles.flatMap(({ manifest: pack, effects: handlers }) =>
  pack.cards.filter(card => expansionCardReady(pack, card, handlers)).map(card => card.code)))
export const expansionEffects = Object.assign({}, ...expansionBundles.map(({ effects: handlers }) =>
  Object.fromEntries(Object.entries(handlers).filter(([code]) => expansionPlayerCodes.includes(code)))))
