import { integer, investigatorAt } from './mechanic-state.js'
import { assetTextBlankedExceptForced } from './card-text.js'
const normalize = value => String(value || '').toLowerCase().replace(/s$/, '')
function controlled(state, id) {
  for (const owner of state.investigators || []) {
    const card = (owner.assets || []).find(asset => asset.id === id)
    if (card) return { owner, card }
  }
  return null
}
function uses(card, type) { return normalize(card.usesType) === normalize(type) ? card.uses || 0 : card.useTokens?.[normalize(type)] || 0 }
function change(card, type, delta) {
  if (normalize(card.usesType) === normalize(type)) card.uses = (card.uses || 0) + delta
  else { card.useTokens ||= {}; card.useTokens[normalize(type)] = (card.useTokens[normalize(type)] || 0) + delta }
}
export function moveUses(state, from, to, type, count = 1) {
  integer(count)
  if (!['secret', 'charge'].includes(normalize(type))) throw new TypeError('只支持秘密或充能转移')
  const a = controlled(state, from), b = controlled(state, to)
  if (!a || !b || from === to || a.owner.location !== b.owner.location || uses(a.card, type) < count) return false
  if (b.card.usesType && normalize(b.card.usesType) !== normalize(type)) return false
  change(a.card, type, -count); change(b.card, type, count); return count
}
export function spendSharedUses(state, seat, assetId, type, count, providers = []) {
  integer(count); const owner = investigatorAt(state, seat), target = controlled(state, assetId)
  if (!target || target.owner !== owner || !Array.isArray(providers) || new Set(providers).size !== providers.length) return false
  const sources = [target, ...providers.filter(id => id !== assetId).map(id => controlled(state, id))]
  if (sources.some(source => !source || source.owner.location !== owner.location)) return false
  if (sources.reduce((sum, source) => sum + uses(source.card, type), 0) < count) return false
  let remaining = count
  for (const source of sources) { const paid = Math.min(remaining, uses(source.card, type)); change(source.card, type, -paid); remaining -= paid }
  return count
}

export function useCostSources(state, card, registeredEntry) {
  const owner = state.investigators.find(inv => inv.assets.includes(card))
  if (normalize(card?.usesType) !== 'secret' || !owner) return [card]
  return [card, ...state.investigators.filter(inv => inv.location === owner.location && !inv.defeated && !inv.resigned)
    .flatMap(inv => inv.assets).filter(source => source !== card && !assetTextBlankedExceptForced(source) && registeredEntry(source.code)?.assetRule?.sharedUses === 'secrets')]
}
export function availableUseCost(state, card, registeredEntry) {
  return useCostSources(state, card, registeredEntry).reduce((total, source) => total + (source?.uses || 0), 0)
}
export function payUseCost(state, seat, card, count, registeredEntry, choose) {
  if (availableUseCost(state, card, registeredEntry) < count) return false
  for (let i = 0; i < count; i++) {
    const sources = useCostSources(state, card, registeredEntry).filter(source => source.uses > 0)
    const source = sources.length === 1 ? sources[0] : sources[Number(choose({ kind: 'effect', seat, source: card.id,
      prompt: '选择支付使用次数的来源。', options: sources.map((source, index) => ({ id: String(index), cardCode: source.code, label: source.code })) }))]
    source.uses--
  }
  return true
}
