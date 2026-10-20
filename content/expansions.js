import { manifest, effects, abilityLayerCodes as supportAbilityCodes } from './packs/dunwichSupport/manifest.js'
import { missingMechanics } from './mechanics.js'
import { manifest as playerManifest, effects as playerEffects, abilityLayerCodes as playerAbilityCodes } from './packs/dunwichPlayer/manifest.js'
import {
  manifest as carcosaPlayerManifest, effects as carcosaPlayerEffects, abilityLayerCodes as carcosaAbilityCodes,
} from './packs/carcosaPlayer/manifest.js'

// Remove this one registration to remove the optional batch. No UI/name branches.
export const expansionBundles = [
  { manifest, effects, abilityLayerCodes: supportAbilityCodes },
  { manifest: playerManifest, effects: playerEffects, abilityLayerCodes: playerAbilityCodes },
  { manifest: carcosaPlayerManifest, effects: carcosaPlayerEffects, abilityLayerCodes: carcosaAbilityCodes },
]
// 「有行为实现」现在有两条通道：本包的 effects 处理器，或能力层描述子（由卡包声明 abilityLayerCodes）。
export function expansionCardReady(pack, card, handlers, abilityLayerCodes = []) {
  return ['playable', 'verified'].includes(pack.status) && card.rulesImplemented && card.deckbuilding
    && !card.blockedReason && missingMechanics(card.requiredMechanicIds).length === 0
    && (!!handlers[card.code] || abilityLayerCodes.includes(card.code))
}
export const expansionPlayerCodes = Object.freeze(expansionBundles.flatMap(({ manifest: pack, effects: handlers, abilityLayerCodes }) =>
  pack.cards.filter(card => expansionCardReady(pack, card, handlers, abilityLayerCodes)).map(card => card.code)))
export const expansionEffects = Object.assign({}, ...expansionBundles.map(({ effects: handlers }) =>
  Object.fromEntries(Object.entries(handlers).filter(([code]) => expansionPlayerCodes.includes(code)))))
