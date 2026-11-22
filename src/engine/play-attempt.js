import { registeredEntry } from './ability.js'
import { ALL_CARDS } from '../cards/cards-data.js'
import { bondedCardList, bondedSetKey } from './bonded.js'
import { availablePlayResources } from './play-payment.js'
import { requestChoice } from './resolution.js'

function damageDiscount(state, inv, definition) {
  const rule = registeredEntry(inv.code)?.investigator?.playDamageDiscount
  if (!rule || definition?.type !== 'event' || !definition.traits?.some(trait => trait.toLowerCase() === rule.trait.toLowerCase())
    || state.scenario?.mechanics?.protectInvestigators || inv.damage + rule.damage >= inv.maxHealth) return null
  return rule
}

export function damagePlayDiscount(state, inv, definition) {
  return damageDiscount(state, inv, definition)?.discount || 0
}

export function quickPlayReduction(state, inv, def) {
  return damagePlayDiscount(state, inv, def) + Math.max(0, ...inv.assets.map(asset => {
    const entry = registeredEntry(asset.code)
    const provider = entry?.playCostReductionProvider
    if (!provider || !entry.abilities.some(ability => ability.trigger.includes('beforePlayAttempt')
      || ability.trigger.includes('beforePlayCost'))) return 0
    return typeof provider === 'function' ? provider(state, inv, def, asset) || 0 : provider
  }))
}

export function bondedPlayCostAvailable(state, inv, code) {
  const rule = registeredEntry(code)?.bondedShufflePlayCost
  if (!rule) return true
  const main = rule.main || code
  const set = state.bondedSets?.[bondedSetKey(state, main, inv.seat)]
  const allowed = bondedCardList(ALL_CARDS[main])
  const count = set ? set.cards.filter(code => allowed.some(copy => copy.code === code)).length
    : allowed.reduce((sum, copy) => sum + copy.count, 0)
  return count >= rule.count
}

export function preparePlayAttempt(state, inv, code, events, deps, discount = 0) {
  const active = state._prePlayAttempt
  if (active?.seat === inv.seat && active.cardCode === code) return active
  const context = { when: 'beforePlayAttempt', seat: inv.seat, location: inv.location,
    cardCode: code, cost: Math.max(0, deps.playCost(state, inv, deps.cardDef(code)) - discount), costReduction: 0 }
  if (quickPlayReduction(state, inv, deps.cardDef(code)) > 0) context.optionalReduction = true
  if (inv.assets.some(asset => registeredEntry(asset.code)?.abilities.some(descriptor => descriptor.trigger.includes('beforePlayAttempt')))) {
    context.availableResources = availablePlayResources(state, inv, deps.cardDef(code))
    deps.reactionWindow(state, 'beforePlayAttempt', context, events, { allowNested: true })
  }
  const payment = damageDiscount(state, inv, deps.cardDef(code))
  if (!context.cancelled && payment && requestChoice(state, { kind: 'payment', source: inv.code, seat: inv.seat, canSkip: true,
    prompt: '是否承受伤害以降低本次打出的资源费用？', options: [{ id: 'skip', label: '正常支付' },
      { id: 'damage', label: `承受 ${payment.damage} 点伤害并减免 ${payment.discount} 资源` }] }) === 'damage') {
    context.costReduction += payment.discount
    context.damagePayment = payment.damage
    context.offerShuffle = payment.offerShuffle
  }
  const rule = registeredEntry(code)?.bondedShufflePlayCost
  if (!context.cancelled && rule) {
    if (!bondedPlayCostAvailable(state, inv, code)) return { ...context, cancelled: true }
  }
  return context
}

export function payAdditionalPlayDamage(state, inv, attempt, events, deps) {
  if (attempt.damagePayment) deps.applyDamage(state, inv, attempt.damagePayment, events, true)
}

export function choosePlayShuffle(state, inv, attempt) {
  return attempt.offerShuffle && requestChoice(state, { kind: 'effect', source: inv.code, seat: inv.seat, canSkip: true,
    prompt: '是否将这张事件洗回牌库？', options: [{ id: 'skip', label: '照常弃置' }, { id: 'shuffle', label: '洗回牌库' }] }) === 'shuffle'
}

export function payBondedPlayCost(state, inv, code, deps) {
  const rule = registeredEntry(code)?.bondedShufflePlayCost
  if (!rule) return true
  if (!bondedPlayCostAvailable(state, inv, code)) return false
    const main = rule.main || code
    const copies = bondedCardList(ALL_CARDS[main])
    state.bondedSets ||= {}
    const key = bondedSetKey(state, main, inv.seat)
    const set = state.bondedSets[key] ||= { seat: inv.seat,
      cards: copies.flatMap(copy => Array(copy.count).fill(copy.code)), retrieved: false }
    const taken = []
    for (let i = set.cards.length - 1; i >= 0 && taken.length < rule.count; i--) {
      if (copies.some(copy => copy.code === set.cards[i])) taken.push(set.cards.splice(i, 1)[0])
    }
    set.retrieved = true
    inv.deck = deps.shuffle([...inv.deck, ...taken], () => deps.randomValue(state))
  return true
}

export function payAdditionalPlayHorror(state, inv, definition, events, deps) {
  const horror = inv.threat.reduce((total, threat) =>
    total + (deps.getThreatEffect(threat)?.playHorrorByType?.[definition?.type] || 0), 0)
  if (horror > 0) deps.applyHorror(state, inv, horror, events)
}
