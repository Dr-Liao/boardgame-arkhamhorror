import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { INVESTIGATOR_ABILITIES } from '../cards/card-effects.js'
import { implementationSummary } from '../cards/card-implementation.js'
import { commitProfile } from '../engine/lifecycle.js'
import { playablePool, matchesDeckOptions } from '../deck/deckbuilding.js'
import { deckRules } from '../deck/deck-rules.js'
import { upgradeRecord } from '../campaign/campaign.js'
import { legalMoves, actionPreview, getStat, actingSeats, actObjectiveContext } from '../engine/engine.js'
import { investigatorParticipation } from './ai-participation.js'
import { storyDecisionContext } from './ai-story.js'

const counts = codes => Object.fromEntries([...new Set(codes)].sort().map(code => [code, codes.filter(c => c === code).length]))
const card = code => {
  const c = ALL_CARDS[code]
  if (!c) return { code }
  return { code, name: c.nameZh || c.name, type: c.type, cost: c.cost, xp: c.xp || 0,
    icons: c.icons, slots: c.slots || c.slot, traits: c.traits, health: c.health, sanity: c.sanity,
    printedText: c.textZh || c.text, implemented: implementationSummary(code) }
}

// Only known cards and this observer's own deck composition; never deck order,
// RNG, continuation state, other hands, or unrevealed encounter draws.
export function aiDecisionContext(state, seat) {
  const inv = state.investigators.find(i => i.seat === seat)
  if (!inv) return ''
  const record = state.campaign.investigators[seat]
  const moves = actingSeats(state).includes(seat) ? legalMoves(state, seat) : []
  const data = { observerSeat: seat, phase: state.phase, round: state.round,
    timing: state.skillTest && !state.skillTest.helpRequested && state.skillTest.seat !== seat ? null : state.timingWindow, investigator: { code: inv.code, ability: INVESTIGATOR_ABILITIES[inv.code] },
    team: state.investigators.map(i => ({ seat: i.seat, code: i.code, name: i.name, klass: i.klass,
      locationId: i.location, clues: i.clues,
      ...investigatorParticipation(state, i),
      stats: Object.fromEntries(['willpower', 'intellect', 'combat', 'agility'].map(k => [k, getStat(state, i, k)])) })) }
  const known = new Set(inv.hand)
  for (const i of state.investigators) for (const c of [...i.assets, ...i.threat]) known.add(c.code)
  for (const code of inv.discard) known.add(code)
  if (state.uiState !== 'inScenario' && state.hubFlow) {
    data.investigatorCandidates = moves.filter(m => m.action === 'hubSelectInvestigator').map(m => {
      const i = INVESTIGATORS[m.code]
      return { code: i.code, name: i.nameZh || i.name, stats: { willpower: i.willpower, intellect: i.intellect, combat: i.combat, agility: i.agility },
        rules: deckRules(i), ability: INVESTIGATOR_ABILITIES[i.code] }
    })
    if (moves.some(m => m.action === 'hubSetDeck')) {
      data.deckRules = deckRules(INVESTIGATORS[inv.code])
      data.buildPool = playablePool().filter(c => (c.xp || 0) === 0 && matchesDeckOptions(INVESTIGATORS[inv.code], c)).map(c => c.code)
      data.buildPool.forEach(code => known.add(code))
      data.deckInstruction = '提交 hubSetDeck，codes 是普通玩家卡卡号数组，可重复以表示数量；必须凑足 deckRules.size。签名和随机弱点由引擎添加。根据队友职责、经济、槽位和组合构筑，不得调用自动构筑代替思考。'
    }
    if (record) {
      const effective = upgradeRecord(record)
      data.deck = counts(effective.deck)
      data.xp = effective.xp
      data.upgradeDraft = record.upgradeDraft?.changes || []
      data.upgradeInstruction = '逐次 hubPurchase 暂存，可连续购买；随后 hubConfirmUpgrades 确认或 hubCancelUpgrades 撤销；没有值得买的卡可 hubDoneSeat 保留 XP。不要调用自动升级。'
      effective.deck.forEach(code => known.add(code))
      moves.filter(m => m.action === 'hubPurchase').forEach(m => { known.add(m.added); if (m.removed) known.add(m.removed) })
    }
  } else {
    data.actObjective = actObjectiveContext(state)
    data.locations = state.locations.map(loc => ({ id: loc.id, name: loc.name, clues: loc.clues,
      revealed: Boolean(loc.revealed), locked: Boolean(loc.locked), connections: [...loc.connections] }))
    data.hand = counts(inv.hand)
    if (record) {
      data.campaignDeck = counts(record.deck)
      record.deck.forEach(code => known.add(code))
    }
    data.remainingDeck = counts(inv.deck)
    data.discard = counts(inv.discard)
    data.assets = inv.assets.map(a => ({ ...a }))
    data.chaosBag = counts(state.chaosBag)
    data.revealedTokens = state.chaos?.revealed || []
    data.tokenMeanings = state.scenario?.tokenMeanings?.[state.difficulty]
    const test = state.skillTest
    if (test && (test.seat === seat || test.helpRequested)) {
      data.test = { ...test, marginBeforeToken: Number.isFinite(test.value) ? test.value - test.difficulty : null }
      data.commitOptions = state.pendingChoice?.kind === 'commit' && state.pendingChoice.seat === seat
        ? moves.filter(m => /^\d+$/.test(m.optionId)).map(m => {
          const code = inv.hand[Number(m.optionId)], c = ALL_CARDS[code]
          const icons = (c?.icons?.[test.skill] || 0) + (c?.icons?.wild || 0)
          return { optionId: m.optionId, code, icons, valueAfter: Number.isFinite(test.value) ? test.value + icons : null,
            // Phase 5：投入档案的唯一读点（描述子优先、旧 DSL 回落）。
            effect: commitProfile(code) }
        }) : []
    }
    data.actionCosts = state.pendingChoice ? [] : moves.map(m => ({ move: Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'label')), ...actionPreview(state, seat, m) }))
  }
  const story = storyDecisionContext(state, seat)
  if (story) data.story = story
  data.cards = [...known].sort().map(card)
  return '\n【决策资料】\n' + JSON.stringify(data) + '\nprintedText 是原卡参考；implemented 和当前合法选项才是本实现的效果依据。不要猜测未提供的隐藏信息。'
}
