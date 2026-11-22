import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { investigatorBackExperience, investigatorDeckDefinition } from './alternate-investigator-build.js'
import { DRAFT_PLAYER_CARD_CODES, EXPANDED_PLAYER_CARD_CODES, isPlayable, matchesDeckOptions, signatureAndWeaknesses } from './deckbuilding.js'
import { brandedSpellOptions } from './branded-spell.js'
import { allowsCard, cardPoolContext } from './card-pool.js'
import { deckRules, validateDeckRules } from './deck-rules.js'
import { randomValue } from '../engine/rules-state.js'
import { requestChoice } from '../engine/resolution.js'
import { registeredEntry } from '../engine/ability.js'
import { applyStartingDeckExperience, campaignOpeningExperience, purchaseCard, registerCampaignInvestigator, replacementOptions, applyPermanentPurchaseEffects } from '../campaign/campaign.js'

export const INITIAL_DRAFT_REROLLS = 5
export const isDraftMode = state => state.deckMode === 'draft'
const ordinary = code => {
  const card = ALL_CARDS[code]
  return card && !card.subtype && !card.signatureFor && !card.story
}
const counted = codes => codes.filter(code => ordinary(code) && !ALL_CARDS[code].permanent && !ALL_CARDS[code].ignoreDeckLimit)
const roundKey = state => state.campaign.scenarioResults.length
const experienceCost = card => (card?.xp || 0) * (card?.exceptional ? 2 : 1)
const startingExperience = deck => [...new Set(deck)].reduce((sum, code) =>
  sum + (registeredEntry(code)?.campaignDeck?.startingExperience || 0), 0)

// 战役奖赏卡（卡面「不计入牌组张数」，见 campaign.js#campaignCardChange 的 deckSlot:false）：
// 只进战役牌组记录、不进 30 张计数。记录里 deck 是扁平卡号，按授予份数逐份抵扣。
function deckWithoutCampaignGrants(record) {
  const granted = new Map()
  for (const code of record?.campaignCards || []) granted.set(code, (granted.get(code) || 0) + 1)
  for (const code of record?.retainedUpgrades || []) granted.set(code, (granted.get(code) || 0) + 1)
  if (!granted.size) return record?.deck || []
  const deck = []
  for (const code of record.deck || []) {
    const left = granted.get(code) || 0
    if (left > 0) { granted.set(code, left - 1); continue }
    deck.push(code)
  }
  return deck
}

export function draftWeight(record, card) {
  return record.deck.some(code => ALL_CARDS[code]?.name === card.name && (ALL_CARDS[code]?.xp || 0) < (card.xp || 0)) ? 2 : 1
}

export function draftDeckStatus(record) {
  if (!record?.draftMode) return null
  const deck = deckWithoutCampaignGrants(record)
  const codes = deck.filter(ordinary)
  const definition = investigatorDeckDefinition(record)
  const size = deckRules(definition, codes, ALL_CARDS).size
  const count = counted(codes).length
  return { size, count, missing: Math.max(0, size - count),
    ready: !validateDeckRules(definition, codes, ALL_CARDS, { draftMode: true }).errors.length }
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
  const inv = investigatorDeckDefinition(record)
  const context = cardPoolContext(state)
  const hasStartingBudget = record.startingDeckExperience || investigatorBackExperience(record) || campaignOpeningExperience(state.campaign)
  const availableStartingXp = initial && !refill && hasStartingBudget ? record.xp : 0
  return DRAFT_PLAYER_CARD_CODES.map(code => ALL_CARDS[code]).filter(card => {
    if (!isPlayable(card) || card.signatureFor || card.subtype) return false
    if (!allowsCard(card.code, context) || !matchesDeckOptions(inv, card, record.deck)) return false
    if (initial) {
      if (refill && (card.permanent || card.ignoreDeckLimit)) return false
      if (experienceCost(card) > availableStartingXp || (card.xp > 0 && !EXPANDED_PLAYER_CARD_CODES.includes(card.code))) return false
      if (record.brandedSpell === card.name) return false
      const codes = [...record.deck.filter(ordinary), card.code]
      if (registeredEntry(card.code)?.campaignDeck?.brandSpellOnPurchase && !brandedSpellOptions(codes).length) return false
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

export function startInitialDraft(state, seat, basicWeaknessPool) {
  const inv = state.investigators[seat]
  let record = state.campaign.investigators[seat]
  if (record?.draftMode && record.code === inv.code) return
  const sig = signatureAndWeaknesses(INVESTIGATORS[inv.code], () => randomValue(state),
    { deferBasicWeakness: !state._legacyStartingDeckRules, investigatorBuild: inv.investigatorBuild, basicWeaknessPool })
  const retained = record?.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness') || []
  const dependencies = [...sig.signatureCards, ...sig.signatureWeaknesses, ...(retained.length ? retained : sig.basicWeaknesses)]
  if (!record) record = registerCampaignInvestigator(state.campaign, inv, dependencies)
  else {
    record.deck = dependencies
    if (inv.investigatorBuild) {
      record.investigatorBuild = structuredClone(inv.investigatorBuild)
      applyStartingDeckExperience(state.campaign, record, {})
    }
  }
  record.startingDeckReady = false
  record.draftMode = { phase: 'initial', options: [], freeRerolls: INITIAL_DRAFT_REROLLS, locked: false, round: roundKey(state) }
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
    purchaseCard(state.campaign, seat, move.added, move.removed, {
      ...cardPoolContext(state), choosePurchaseEffect: spec => requestChoice(state, spec),
    })
    draft.options = []
    draft.locked = false
    state.hubUpgradedSeats[seat] = true
    if (draftDeckStatus(record).missing > 0) beginRefill(state, record)
  } else if (move.action === 'hubDraftPick') {
    record.deck.push(move.code)
    applyPermanentPurchaseEffects(state.campaign, seat, move.code)
    const deck = deckWithoutCampaignGrants(record)
    if (initial) {
      const bonus = startingExperience(deck)
      if (bonus || record.startingDeckExperience || investigatorBackExperience(record) || campaignOpeningExperience(state.campaign)) {
        applyStartingDeckExperience(state.campaign, record, {
        startingExperience: bonus, startingExperienceSpent: deck.reduce((sum, code) => sum + experienceCost(ALL_CARDS[code]), 0),
        }, { choosePurchaseEffect: spec => requestChoice(state, spec) })
      }
    }
    const definition = investigatorDeckDefinition(record)
    const size = deckRules(definition, deck, ALL_CARDS).size
    if (counted(deck).length >= size) {
      const errors = validateDeckRules(definition, deck.filter(ordinary), ALL_CARDS, { draftMode: true }).errors
      if (errors.length) throw new Error(`选牌未满足调查员构筑要求：${errors[0]}`)
      record.startingDeckReady = refill || !!state._legacyStartingDeckRules
      if (!record.startingDeckReady) record.startingDeckConfirmationPending = true
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
      || (draft.freeRerolls != null && (!Number.isSafeInteger(draft.freeRerolls) || draft.freeRerolls < 0 || draft.freeRerolls > INITIAL_DRAFT_REROLLS))) throw new Error('选牌模式存档损坏')
  }
}
