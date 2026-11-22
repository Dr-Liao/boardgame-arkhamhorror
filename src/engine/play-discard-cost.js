import { ALL_CARDS } from '../cards/cards-data.js'
import { cannotLeaveHand } from './ability.js'
import { canDiscardControlledAsset } from './asset-departure.js'
import { discardControlledAssetAsCost, discardOneHandCardAsCost } from './discard-costs.js'
import { afterHandDiscard } from './hand-discard-window.js'
import { hasTrait } from './matcher.js'
import { discardPlayerCards } from './player-zones.js'

function matchesCost(code, { slot, trait }) {
  const definition = ALL_CARDS[code]
  if (!slot && !trait) return Boolean(definition)
  return definition?.type === 'asset' && hasTrait(definition, trait) && definition.slots?.some(printed => {
    const normalized = printed.toLowerCase().replace(/\s+/g, '')
    return normalized === slot || normalized === slot + 'x2'
  })
}

export function playDiscardCostChoices(state, inv, spec) {
  if (!spec) return []
  const hand = spec.zones.includes('hand') ? inv.hand.flatMap((code, index) => {
    const card = ALL_CARDS[code]
    return matchesCost(code, spec) && !['weakness', 'basicweakness'].includes(card.subtype)
      && !cannotLeaveHand(code) && !inv.hiddenCards?.includes(code)
      ? [{ id: 'hand:' + index, code, index, from: 'hand' }] : []
  }) : []
  const play = spec.zones.includes('play') ? inv.assets.flatMap(asset =>
    matchesCost(asset.code, spec) && canDiscardControlledAsset(state, inv, asset)
      ? [{ id: 'play:' + asset.id, code: asset.code, assetId: asset.id, from: 'play' }] : []) : []
  return [...hand, ...play]
}

export function payPlayDiscardCost(state, inv, source, spec, events, deps) {
  const choices = playDiscardCostChoices(state, inv, spec)
  if (!choices.length) return null
  const id = deps.requestChoice(state, {
    kind: 'card', source: { type: 'cost', kind: 'discard', code: source },
    seat: inv.seat, prompt: spec.upTo ? '支付额外费用：选择一张手牌弃掉，或结束支付。' : '支付额外费用：选择并弃掉一张符合条件的支援。',
    options: [...(spec.upTo ? [{ id: 'done', label: '结束支付' }] : []),
      ...choices.map(row => ({ id: row.id, cardCode: row.code,
        label: deps.cardName(row.code) + (row.from === 'hand' ? '（手牌）' : '（场上）') }))],
  })
  const chosen = choices.find(row => row.id === id)
  const costDeps = { ...deps, afterHandDiscard, canDiscardControlledAsset, discardPlayerCards }
  const paid = chosen?.from === 'hand'
    ? discardOneHandCardAsCost(state, inv, chosen.index, chosen.code, events, costDeps)
    : chosen && discardControlledAssetAsCost(state, inv, chosen.assetId, events, costDeps)
  return paid ? { code: chosen.code, from: chosen.from } : null
}
