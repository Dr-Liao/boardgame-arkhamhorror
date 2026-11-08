import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { DRAFT_PLAYER_CARD_CODES, isPlayable, matchesDeckOptions, signatureAndWeaknesses } from './deckbuilding.js'
import { allowsCard, cardPoolContext } from './card-pool.js'
import { deckRules, validateDeckRules } from './deck-rules.js'
import { randomValue } from '../engine/rules-state.js'
import { purchaseCard, registerCampaignInvestigator, replacementOptions, applyPermanentPurchaseEffects } from '../campaign/campaign.js'

export const isDraftMode = state => state.deckMode === 'draft'
const ordinary = code => {
  const card = ALL_CARDS[code]
  return card && !card.subtype && !card.signatureFor && !card.story
}
const counted = codes => codes.filter(code => ordinary(code) && !ALL_CARDS[code].permanent && !ALL_CARDS[code].ignoreDeckLimit)
const roundKey = state => state.campaign.scenarioResults.length

export function draftWeight(record, card) {
  return record.deck.some(code => ALL_CARDS[code]?.name === card.name && (ALL_CARDS[code]?.xp || 0) < (card.xp || 0)) ? 2 : 1
}

export function draftDeckStatus(record) {
  if (!record?.draftMode) return null
  const codes = record.deck.filter(ordinary)
  const size = deckRules(INVESTIGATORS[record.code], codes, ALL_CARDS).size
  const count = counted(codes).length
  return { size, count, missing: Math.max(0, size - count),
    ready: !validateDeckRules(INVESTIGATORS[record.code], codes, ALL_CARDS, { draftMode: true }).errors.length }
}

export function draftDecksReady(state) {
  const records = [...Object.values(state.campaign?.investigators || {}), ...Object.entries(state.campaign?.parts || {}).filter(([part]) => part !== state.campaign.currentPart).flatMap(([, part]) => Object.values(part.investigators || {}))]
  return records.every(record => !record.draftMode || record.status !== 'active' || (record.startingDeckReady !== false && draftDeckStatus(record).ready))
}

function beginRefill(state, record) {
  record.startingDeckReady = false
  record.draftMode.phase = 'refill'
  record.draftMode.locked = false
  generate(state, record, true, true)
}

function candidates(state, record, initial, refill = false) {
  const inv = INVESTIGATORS[record.code]
  const context = cardPoolContext(state)
  return DRAFT_PLAYER_CARD_CODES.map(code => ALL_CARDS[code]).filter(card => {
    if (!isPlayable(card) || card.signatureFor || card.subtype) return false
    if (!allowsCard(card.code, context) || !matchesDeckOptions(inv, card, record.deck)) return false
    if (initial) {
      if (refill && (card.permanent || card.ignoreDeckLimit)) return false
      if ((card.xp || 0) !== 0) return false
      const codes = [...record.deck.filter(ordinary), card.code]
      const rules = deckRules(inv, codes, ALL_CARDS)
      const remaining = rules.size - counted(codes).length
      if (Object.entries(rules.minimumTypes || {}).some(([type, min]) => codes.filter(code => ALL_CARDS[code]?.type === type).length + remaining < min)) return false
      return !validateDeckRules(inv, codes, ALL_CARDS, { partial: remaining > 0, draftMode: true }).errors.length
    }
    // Keep unaffordable cards in the offers so they can be saved for next time.
    return replacementOptions({ ...record, xp: Number.MAX_SAFE_INTEGER }, card.code, state.campaign.records, context).length > 0
  })
}

function generate(state, record, initial, refill = false) {
  const pool = candidates(state, record, initial, refill)
  const chosen = []
  for (let slot = 0; slot < 3; slot++) {
    const available = pool.filter(card => !chosen.includes(card.code) && (initial || ((card.xp || 0) === 0) === (slot === 0)))
    if (!available.length) { chosen.push(null); continue }
    let roll = randomValue(state) * available.reduce((sum, card) => sum + (initial ? 1 : draftWeight(record, card)), 0)
    const card = available.find(card => (roll -= initial ? 1 : draftWeight(record, card)) < 0) || available.at(-1)
    chosen.push(card.code)
  }
  record.draftMode.options = chosen
  record.draftMode.locked = false
}

export function startInitialDraft(state, seat) {
  const inv = state.investigators[seat]
  let record = state.campaign.investigators[seat]
  if (record?.draftMode && record.code === inv.code) return
  const sig = signatureAndWeaknesses(INVESTIGATORS[inv.code], () => randomValue(state))
  const retained = record?.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness') || []
  const dependencies = [...sig.signatureCards, ...sig.signatureWeaknesses, ...(retained.length ? retained : sig.basicWeaknesses)]
  if (!record) record = registerCampaignInvestigator(state.campaign, inv, dependencies)
  else record.deck = dependencies
  record.startingDeckReady = false
  record.draftMode = { phase: 'initial', options: [], freeRerolls: 3, locked: false, round: roundKey(state) }
  generate(state, record, true)
}

export function openDraftUpgrades(state) {
  if (!isDraftMode(state)) return
  for (const record of Object.values(state.campaign.investigators)) {
    if (record.status !== 'active' || ['initial', 'refill'].includes(record.draftMode?.phase)) continue
    const draft = record.draftMode ||= { options: [], locked: false }
    if (draft.phase === 'upgrade' && draft.round === roundKey(state)) continue
    const keep = draft.locked && draft.options.some(Boolean)
    draft.phase = 'upgrade'
    draft.round = roundKey(state)
    if (!keep) generate(state, record, false)
  }
}

export function draftLegalMoves(state, record) {
  const draft = record?.draftMode
  if (!draft || record.status !== 'active') return []
  const moves = []
  const initial = draft.phase === 'initial'
  const refill = draft.phase === 'refill'
  if (!initial && (state.uiState !== 'interlude' || state.campaign.upgradesAllowed === false)) return []
  if (!initial && !refill && draftDeckStatus(record).missing > 0) return [{ action: 'hubDraftRefill', label: '补足牌组（0 经验三选一）' }]
  for (const code of draft.options.filter(Boolean)) {
    if (initial || refill) moves.push({ action: 'hubDraftPick', code, label: `选择 ${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}` })
    else for (const option of replacementOptions(record, code, state.campaign.records, cardPoolContext(state))) {
      moves.push({ action: 'hubDraftBuy', added: code, removed: option.code, cost: option.cost,
        label: `购入 ${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}（${option.cost} XP）`, explanation: option.explanation })
    }
  }
  if (initial ? draft.freeRerolls > 0 : record.xp >= 1) moves.push({ action: 'hubDraftRefresh', label: initial ? `刷新（剩余 ${draft.freeRerolls} 次免费）` : '刷新全部选项（1 XP）' })
  if (!initial && !refill && draft.options.some(Boolean)) moves.push({ action: 'hubDraftLock', locked: !draft.locked,
    label: draft.locked ? '解除整组锁定' : '锁定整组（放弃下关免费刷新）' })
  return moves
}

export function applyDraftMove(state, seat, move) {
  const record = state.campaign.investigators[seat]
  const draft = record.draftMode
  const initial = draft.phase === 'initial'
  const refill = draft.phase === 'refill'
  if (move.action === 'hubDraftRefill') {
    beginRefill(state, record)
  } else if (move.action === 'hubDraftRefresh') {
    if (initial) draft.freeRerolls--
    else { record.xp--; record.spentXp++; state.campaign.xp-- }
    generate(state, record, initial || refill, refill)
  } else if (move.action === 'hubDraftLock') draft.locked = move.locked
  else if (move.action === 'hubDraftBuy') {
    purchaseCard(state.campaign, seat, move.added, move.removed, cardPoolContext(state))
    draft.options = []
    draft.locked = false
    state.hubUpgradedSeats[seat] = true
    if (draftDeckStatus(record).missing > 0) beginRefill(state, record)
  } else if (move.action === 'hubDraftPick') {
    record.deck.push(move.code)
    applyPermanentPurchaseEffects(state.campaign, seat, move.code)
    const size = deckRules(INVESTIGATORS[record.code], record.deck, ALL_CARDS).size
    if (counted(record.deck).length >= size) {
      const errors = validateDeckRules(INVESTIGATORS[record.code], record.deck.filter(ordinary), ALL_CARDS, { draftMode: true }).errors
      if (errors.length) throw new Error(`选牌未满足调查员构筑要求：${errors[0]}`)
      record.startingDeckReady = true
      draft.phase = refill ? 'upgrade' : 'ready'
      draft.options = []
    } else generate(state, record, true, refill)
  }
}

// Optional additive state: older saves without deckMode retain ordinary rules.
export function validateDraftState(state) {
  if (state.deckMode == null) return
  if (state.deckMode !== 'draft') throw new Error('未知选牌模式')
  for (const record of Object.values(state.campaign?.investigators || {})) {
    const draft = record.draftMode
    if (!draft) continue
    if (!['initial', 'ready', 'upgrade', 'refill'].includes(draft.phase) || !Array.isArray(draft.options)
      || ![0, 3].includes(draft.options.length) || draft.options.some(code => code !== null && !ALL_CARDS[code])
      || typeof draft.locked !== 'boolean' || !Number.isSafeInteger(draft.round) || draft.round < 0
      || (draft.freeRerolls != null && (!Number.isSafeInteger(draft.freeRerolls) || draft.freeRerolls < 0 || draft.freeRerolls > 3))) throw new Error('选牌模式存档损坏')
  }
}
