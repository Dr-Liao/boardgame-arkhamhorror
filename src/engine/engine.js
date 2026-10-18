// 诡镇奇谈：卡牌版 · 规则引擎（Night of the Zealot 三关简化流程）
//
// 职责划分：
//   - cards-data.js     全量卡牌目录；可用范围由 availability.js 单独控制
//   - card-effects.js   卡牌效果编码（DSL 效果定义）
//   - content/registered.js 战役、关卡和卡包注册入口；各关数据与行为独立定义
//   - deckbuilding.js   牌组构筑（deck_options + deck_requirements）
//   - effects.js        效果 DSL 解释器（原语结算）
//   - engine.js（本文件）规则引擎：阶段机 + 技能检定 + 敌人 + 关键词 + 胜负 + 战役推进 + AI 接口
//
// Phase 4 新增：
//   - 战役状态 state.campaign（剧本顺序 / 累计胜利点 / 创伤 / 冒险日志 records）；
//   - 剧本动态化：state.scenario 指向当前剧本，场景/密谋/地点/敌人/诡计/遭遇牌堆/标记含义均按剧本读取；
//   - 第二幕《午夜假面》（异教徒牌堆 + 谈判盘问 + 撤退 + 假面猎手）；
//   - 第三幕《地底噬魔》（密林地图 + 仪式地 + 乌默尔多斯 + 破坏仪式）。
//
// 所有函数都是纯数据操作，原地修改 state 并返回事件数组。
// Mod 入口 index.js 只做胶水（createState / validateMove / applyMove / describeState / legalMoves）。

import { randomUUID } from 'node:crypto'
import {
  SKILL_NAMES, CLASS_NAMES, CLASS_EMOJI, CLASS_COLOR, TOKEN_LABEL,
} from './presentation-constants.js'
import {
  ALL_CARDS, INVESTIGATORS as ALL_INVESTIGATORS, BASIC_WEAKNESSES, META,
} from '../cards/cards-data.js'
import { CHAOS_BAGS, SYMBOL_DEFAULTS } from '../../content/campaigns/nightOfTheZealot/shared.js'
import { contentRegistry } from '../../content/registered.js'
import { buildDeck, buildDeckFromList, playablePool, hashSeed, shuffle } from '../deck/deckbuilding.js'
import { PLAYABLE_INVESTIGATOR_CODES, canSelectInvestigator, isCardAvailable, getAvailability } from '../deck/availability.js'
import { EFFECTS, INVESTIGATOR_ABILITIES, isAutomaticReward } from '../cards/card-effects.js'
import { resolveEffect, effectDefinitionError } from './effects.js'
import { cardIdentityFields } from '../cards/card-identity.js'
import { captureTableState } from '../integration/presentation-state.js'
import { attackStyle } from '../integration/attack-style.js'
import { describeTeamParticipation, investigatorParticipation } from '../ai/ai-participation.js'
import { narrativeLogTexts } from '../ai/ai-story.js'
import { STATE_SCHEMA_VERSION, RULES_VERSION, randomValue, nextInstanceId, stateCompatibilityError, agendaDoom, totalDoom, doomCards, enemyHealthValue } from './rules-state.js'
import { requestChoice, choiceMoves, choiceSeats, choiceError, resolveTransaction, resolutionCheckpoint } from './resolution.js'
import { introduction, resolutionStory } from '../campaign/story.js'
import { campaignGraph, enterCampaignNode, walkCampaign } from '../campaign/campaign-flow.js'
import { applyCampaignEffect } from '../campaign/campaign-effects.js'
import { initializeChaosBag, beginChaosTest, drawChaosToken, returnChaosToken, endChaosTest, releaseChaosTokens } from './chaos-bag.js'
import { registerCampaignInvestigator, updateCampaignStatus, replacementCandidates, awardExperience, campaignCardChange, settleExiledCards, availablePurchases, replacementOptions, purchaseCard, upgradeRecord, stagePurchase, finishUpgradeDraft, recommendUpgrade } from '../campaign/campaign.js'

const PLAYABLE_INVESTIGATORS = PLAYABLE_INVESTIGATOR_CODES
const SCENARIOS = Object.fromEntries(contentRegistry.listScenarios()
  .filter(entry => ['playable', 'verified'].includes(entry.status))
  .map(entry => [entry.id, contentRegistry.getScenarioData(entry.id)]))
const campaignManifestFor = state => contentRegistry.getCampaign(state.campaign.id)
const campaignFor = state => ({ ...campaignManifestFor(state), scenarioOrder: campaignManifestFor(state).scenarioIds })
const scenarioBehavior = state => state.scenario ? contentRegistry.getBehavior(state.scenario.id) || {} : {}

// Content modules receive a narrow, transaction-local interface. All choices,
// randomness, damage and tests use the same replay path as the original campaign.
function scenarioRuntime(state, events, testSource = null) {
  return {
    info: text => info(state, events, text),
    random: () => randomValue(state),
    place: id => placeLocation(state, id, events),
    reveal: id => revealLocation(state, id, events),
    remove: id => removeLocation(state, id, events),
    spawn: (code, location) => spawnEnemy(state, code, location, null, true),
    attack: (enemy, inv) => enemyAttack(state, enemy, inv, events, '剧本效果'),
    damage: (seat, n) => applyDamage(state, state.investigators[seat], n, events),
    horror: (seat, n) => applyHorror(state, state.investigators[seat], n, events),
    healDamage: (seat, n) => {
      const inv = state.investigators[seat]
      inv.damage = Math.max(0, inv.damage - n)
    },
    healHorror: (seat, n) => {
      const inv = state.investigators[seat]
      inv.horror = Math.max(0, inv.horror - n)
    },
    directDamage: (seat, n) => applyDamage(state, state.investigators[seat], n, events, true),
    directHorror: (seat, n) => applyHorror(state, state.investigators[seat], n, events, true),
    assetsFirstDamage: (seat, n) => applyHarm(state, state.investigators[seat], n, 0, events, false, null, true),
    moveInvestigator: (seat, destination) => relocateInvestigator(state, seat, destination, events),
    moveEnemy: (enemy, destination) => relocateEnemy(state, enemy, destination, events),
    stepToward: (from, to) => stepToward(state, from, to),
    hunterStep: enemy => hunterStep(state, enemy),
    loseActions: (seat, n) => {
      const inv = state.investigators[seat]
      if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, inv.actionsLeft - n)
      else {
        inv.pendingActionLoss ||= {}
        inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + n
      }
    },
    removeAsset: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      return asset.code
    },
    damageAsset: (seat, assetId, n) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return
      asset.damage = (asset.damage || 0) + n
      if (asset.damage >= (cardDef(asset.code)?.health || Infinity)) {
        leaveAsset(state, inv, asset, events)
        if (!asset.removedFromGame) inv.discard.push(asset.code)
        if (EFFECTS[asset.code]?.defeatedDamage) defeatedAssetRetaliation(state, inv, EFFECTS[asset.code].defeatedDamage, events)
      }
    },
    horrorAsset: (seat, assetId, n) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return
      asset.horror = (asset.horror || 0) + n
      if (asset.horror >= (cardDef(asset.code)?.sanity || Infinity)) {
        leaveAsset(state, inv, asset, events)
        if (!asset.removedFromGame) inv.discard.push(asset.code)
        if (EFFECTS[asset.code]?.defeatedDamage) defeatedAssetRetaliation(state, inv, EFFECTS[asset.code].defeatedDamage, events)
      }
    },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      return asset.code
    },
    shuffleAssetIntoDeck: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame) inv.deck.push(asset.code)
      inv.deck = shuffle(inv.deck, () => randomValue(state))
      return asset.code
    },
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null) => performTest(state, seat, skill, difficulty, { resolve, skillBonus, source: source || testSource }),
    investigateTest: (seat, options = {}) => investigateTest(state, seat, options, events),
    endTurn: seat => {
      const target = state.investigators[seat]
      if (!target) return
      target.actionsLeft = 0
      if (state.currentSeat === seat) target.turnEnded = true
    },
    discardUntilEnemy: (seat, predicate) => discardUntilEnemyFromEncounter(state, seat, predicate, events),
    clueRemoved: (loc, n) => notifyCluesRemoved(state, loc, n, events),
    finish: key => finishScenario(state, key, events),
    resign: seat => doResign(state, seat, events),
    advanceAct: () => advanceAct(state, events),
    advanceAgenda: () => advanceAgenda(state, events),
    clearDoom: () => {
      state.doom = 0
      for (const card of doomCards(state)) card.doom = 0
      scenarioBehavior(state).doomCleared?.(state, scenarioRuntime(state, events))
    },
    addDoom: n => addDoom(state, n, events),
    payClues: (n, location) => groupPayment(state, n, location, events),
    spendClues: (seat, n) => { const inv = state.investigators[seat]; if (inv.clues < n) throw new Error('线索不足'); inv.clues -= n; syncClues(state) },
    trauma: (seat, kind, n) => addTrauma(state, seat, kind, n, events),
    storyAsset: (code, location) => spawnStoryAsset(state, code, location, events),
    drawCards: (seat, n) => drawCards(state, state.investigators[seat], n, events),
    drawMadnessWeakness: seat => drawMadnessWeakness(state, state.investigators[seat], events),
    gainClues: (seat, n) => { const inv = state.investigators[seat]; inv.clues += n; syncClues(state); scenarioBehavior(state).cluesGained?.(state, inv, n, scenarioRuntime(state, events)) },
    damageEnemy: (enemyId, amount, seat, source = null) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      return damageEnemy(state, enemy, amount, seat, events, source)
    },
    enemyFight: (enemy, seat) => enemyFightValue(state, enemy, state.investigators[seat]),
    engage: (enemy, seat) => engageEnemy(state, enemy, seat, events),
    evadeEnemy: enemy => autoEvadeEnemy(state, enemy, events),
    revealToken: (seat = state.currentSeat) => {
      beginChaosTest(state)
      const token = drawChaosToken(state)
      endChaosTest(state, [token])
      const inv = state.investigators[seat]
      const replacement = scenarioBehavior(state).chaosTokenRevealed?.(state, inv, token, scenarioRuntime(state, events))
      return replacement ?? token
    },
    choose: request => requestChoice(state, request),
    privateInfo: (seat, text) => privateInfo(state, events, seat, text),
    cardReveal: (code, title = '卡牌结算') => {
      const card = cardDef(code)
      const name = card?.nameZh || card?.name || cardName(code)
      const text = [
        card?.flavorZh || card?.flavor,
        card?.textZh || card?.text,
      ].filter(Boolean).join('\n\n') || '揭示卡牌并结算其效果。'
      info(state, events, `揭示「${name}」并结算其效果。`, {
        kind: 'story', title, code, face: 'front', name, text, flip: true,
      })
    },
    cardFlip: (code, title = '卡牌翻面') => {
      const front = cardDef(code)
      const reverseCode = front?.linkedCardCode || front?.linkedToCode
      const reverse = cardDef(reverseCode)
      const reverseName = reverse?.nameZh || reverse?.name || cardName(reverseCode || code)
      const reverseText = [
        reverse?.flavorZh || reverse?.flavor,
        reverse?.textZh || reverse?.text,
      ].filter(Boolean).join('\n\n') || '翻开卡牌并结算背面的效果。'
      info(state, events, `翻开「${cardName(code)}」并结算「${reverseName}」。`, {
        kind: 'story', title, code, face: 'back', name: reverseName, text: reverseText, flip: true,
      })
    },
    flipLocation: (id, seat) => flipScenarioLocation(state, id, seat, events),
    drawEncounter: seat => { const inv = state.investigators[seat]; if (!inv.defeated && !inv.resigned) drawEncounter(state, inv, events) },
    threat: (seat, code, extra = {}) =>
      state.investigators[seat].threat.push(newCardInstance(state, code, extra)),
    discardTop: (seat, n) => {
      const inv = state.investigators[seat]
      const discarded = []
      for (let i = 0; i < n && inv.deck.length; i++) {
        const card = inv.deck.pop()
        inv.discard.push(card)
        discarded.push(card)
        scenarioBehavior(state).deckEmptied?.(state, inv, scenarioRuntime(state, events))
        if (inv.defeated) break
      }
      return discarded
    },
    giveAsset: (seat, code, extra = {}) => {
      const inv = state.investigators[seat], asset = newCardInstance(state, code, { exhausted: false, ...extra })
      inv.assets.push(asset); scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
      return asset
    },
    canPlayAsset: (seat, code) => !scenarioAssetPlayError(state, state.investigators[seat], code),
    playAsset: (seat, code) => {
      const inv = state.investigators[seat]
      const error = scenarioAssetPlayError(state, inv, code)
      if (error) throw new Error(error)
      inv.hand.push(code)
      doPlay(state, seat, code, events, false, true)
      return inv.assets.findLast(asset => asset.code === code)
    },
    defeat: (inv, cause = null) => { inv.defeated = true; inv.defeatCause = cause; eliminateInvestigator(state, inv, events) },
    drawEncounterLocation: seat => {
      if (!scenarioBehavior(state).drawEncounterLocation) throw new Error('当前剧本没有遭遇地点处理器')
      return scenarioBehavior(state).drawEncounterLocation(state, seat, scenarioRuntime(state, events))
    },
    placeEncounterLocation: code => {
      const def = Object.values(state.scenario.locations).find(l => l.originalCode === code)
      if (!def) throw new Error(`未知遭遇地点：${code}`)
      state.scenarioZones.locationSeq = (state.scenarioZones.locationSeq || 0) + 1
      const loc = { ...structuredClone(def), id: `${def.id}-${state.scenarioZones.locationSeq}`, revealed: true,
        clues: def.cluesFixed ?? def.cluesPerInvestigator * state.numInvestigators }
      state.locations.push(loc)
      for (const here of state.locations) if (here.symbols) {
        here.connections = state.locations.filter(other => other.id !== here.id && here.symbols.front.links.includes(other.symbols?.front.symbol)).map(other => other.id)
      }
      return loc
    },
    discardRandom: (seat, n) => discardRandomFromHand(state, state.investigators[seat], n, events),
    discardChosen: (seat, n, source = 'encounter') => {
      const inv = state.investigators[seat]
      for (let i = 0; i < n; i++) {
        const options = inv.hand.flatMap((code, index) => canDiscardFromHand(inv, code)
          ? [{ id: String(index), label: cardName(code) }] : [])
        if (!options.length) break
        const index = Number(requestChoice(state, {
          kind: 'discard', source, seat, prompt: `选择弃掉一张手牌（${i + 1}/${n}）。`, options,
        }))
        inv.discard.push(inv.hand.splice(index, 1)[0])
      }
    },
    drawDiscard: (seat, index) => {
      const inv = state.investigators[seat], code = inv.discard.splice(index, 1)[0]
      inv.deck.push(code); drawCards(state, inv, 1, events)
    },
    drawEncounterDiscard: (seat, index) => { state.encounterDeck.push(state.encounterDiscard.splice(index, 1)[0]); drawEncounter(state, state.investigators[seat], events) },
    shuffleDiscard: () => {
      state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
      state.encounterDiscard = []
    },
    shuffleEncounterDeck: () => { state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state)) },
    discardEnemy: enemy => discardEnemyCard(state, enemy),
    removeEnemyFromGame: enemy => {
      if (!state.enemies.includes(enemy)) return false
      disengageEnemy(state, enemy)
      removeOne(state.enemies, enemy)
      state.removedFromGame ||= []
      state.removedFromGame.push(enemy.originalCode || enemy.code)
      return true
    },
    checkEnemyDefeat: (enemy, source = null, seat = null) => {
      if (state.enemies.includes(enemy) && enemy.damageTaken >= enemyHealthValue(state, enemy)
        && scenarioBehavior(state).enemyCanBeDefeated?.(state, enemy, source, seat) !== false) {
        defeatEnemy(state, enemy, events)
        return true
      }
      return false
    },
    attackFromDiscard: (code, seat) => {
      if (!state.encounterDiscard.includes(code)) return false
      const inv = state.investigators[seat]
      const enemy = spawnEnemy(state, code, inv.location, seat, true, true)
      if (!enemy) return false
      enemyAttack(state, enemy, inv, events, `「${enemy.name}」从弃牌堆发动攻击。`)
      return true
    },
    devourLocation: id => {
      for (const inv of aliveInvestigators(state).filter(i => i.location === id)) {
        inv.defeated = true; inv.defeatCause = null; eliminateInvestigator(state, inv, events)
      }
      for (const enemy of state.enemies.filter(e => e.location === id)) discardEnemyCard(state, enemy)
      const lost = (state.storyAssets || []).filter(a => a.location === id)
      for (const asset of lost) removeOne(state.storyAssets, asset)
      // "Place it in the victory display instead if it has Victory X and no clues."
      const devoured = state.locations.find(loc => loc.id === id)
      if (devoured && devoured.victory && (devoured.clues || 0) === 0
        && !state.victoryDisplay.some(card => card.id === devoured.id)) {
        state.victoryDisplay.push({ id: devoured.id, code: devoured.originalCode || devoured.code,
          originalCode: devoured.originalCode || devoured.code, victory: devoured.victory })
        info(state, events, `💎 「${devoured.name}」无线索且带胜利点，被放入胜利展示区。`)
      }
      removeLocation(state, id, events)
      for (const asset of lost) scenarioBehavior(state).storyAssetLeftPlay?.(state, asset, scenarioRuntime(state, events))
    },
  }
}

// 敌人型基础弱点的关键词（来自参考 cards_zh-cn.json 规则文本：猎手/猎物/强制等）。
const WEAKNESS_ENEMY_EXTRA = {
  '01101': { hunter: true, prey: true, parleyCost: 4 },
  '01102': { hunter: true, prey: true, forcedDoom: true },
  '01103': { hunter: true, prey: true },
}

// 槽位容量（每个调查员）。
const SLOT_CAPACITY = { hand: 2, ally: 1, arcane: 2, accessory: 1, body: 1, tarot: 1 }

const HAND_SIZE_BASE = 8

// ---------------------------------------------------------------------------
// 合并剧本注册表（遭遇牌 code 全局唯一，跨剧本合并后可按 code 直查）
// ---------------------------------------------------------------------------

const ALL_ENEMIES = {}
const ALL_TREACHERIES = {}
const ALL_STORY_ASSETS = {}
for (const sc of Object.values(SCENARIOS)) {
  Object.assign(ALL_ENEMIES, sc.enemies || {})
  Object.assign(ALL_TREACHERIES, sc.treacheries || {})
  Object.assign(ALL_STORY_ASSETS, sc.storyAssets || {})
}

// ---------------------------------------------------------------------------
// 卡牌 / 敌人定义查找（统一入口：cards-data.js ∪ 所有剧本遭遇牌）
// ---------------------------------------------------------------------------

function cardDef(code) {
  const rule = ALL_ENEMIES[code] || ALL_TREACHERIES[code] || ALL_STORY_ASSETS[code]
  if (rule) {
    const metadata = ALL_CARDS[rule.originalCode || code]
    return { ...metadata, ...rule, code, type: ALL_STORY_ASSETS[code] ? 'asset' : metadata?.type || rule.type }
  }
  return Object.hasOwn(ALL_CARDS, code) ? ALL_CARDS[code] : null
}

function cardName(code) {
  const c = cardDef(code)
  if (!c) return code
  return c.nameZh || c.name || code
}

function originalCardCode(ruleCode) {
  return ALL_ENEMIES[ruleCode]?.originalCode || ruleCode
}

function ruleCodeForOriginal(originalCode) {
  return Object.keys(ALL_ENEMIES).find((ruleCode) => originalCardCode(ruleCode) === originalCode) || originalCode
}

function isWeaknessCard(c) {
  return !!(c && (c.subtype === 'weakness' || c.subtype === 'basicweakness'))
}

function isWeaknessCode(code) {
  return isWeaknessCard(cardDef(code))
}

// 敌人定义：优先剧本敌人（合并注册表），其次 cards-data.js 的敌人型卡（弱化敌人）。
function enemyDef(code) {
  if (ALL_ENEMIES[code]) return ALL_ENEMIES[code]
  const c = ALL_CARDS[code]
  if (c && c.type === 'enemy') {
    const extra = { ...(WEAKNESS_ENEMY_EXTRA[code] || {}), ...(EFFECTS[code]?.enemyWeakness || {}) }
    return {
      code,
      name: c.nameZh || c.name,
      fight: c.fight ?? 0,
      evade: c.evade ?? 0,
      health: c.health ?? 1,
      damage: c.damage ?? 0,
      horror: c.horror ?? 0,
      hunter: !!extra.hunter,
      retaliate: !!extra.retaliate,
      alert: !!extra.alert,
      elite: !!extra.elite,
      prey: extra.prey ? 'bearer' : null,
      forcedDoom: !!extra.forcedDoom,
      parleyCost: extra.parleyCost ?? 0,
      victory: c.victory ?? 0,
      traits: c.traits || [],
      text: c.textZh || '',
    }
  }
  return null
}

// 所有卡牌定义（供前端渲染）。cards-data.js 的卡以「中文名」作为 name 暴露给前端，
// 并附上由 card-effects.js 反推的 statBonus/fightDamageBonus（兼容现有前端 ahEffStat）。
function campaignRuleCodes(campaignId) {
  return [...new Set(contentRegistry.listScenarios(campaignId).flatMap(entry => {
    const scenario = contentRegistry.getScenarioData(entry.id)
    return ['enemies', 'treacheries', 'storyAssets'].flatMap(key => Object.keys(scenario[key] || {}))
  }))]
}

// campaignId limits scenario rule cards to that campaign; states embed this
// copy, so carrying every registered campaign would exceed the save budget.
export function allCardDefs({ runtimeOnly = false, campaignId = null, playerCodes = null } = {}) {
  const out = {}
  const selected = playerCodes && new Set(playerCodes)
  for (const [code, c] of Object.entries(ALL_CARDS)) {
    if (runtimeOnly && !canSelectInvestigator(code) && !isCardAvailable(code)) continue
    if (selected && !selected.has(code)) continue
    const eff = EFFECTS[code]
    const availability = getAvailability(code)
    const copy = { ...c, name: c.nameZh || c.name, nameEn: c.name,
      availability: availability.availability, strictAccepted: availability.strictAccepted }
    const investigatorAbility = INVESTIGATOR_ABILITIES[code]
    const reactions = [...(eff?.reactions || []), ...(investigatorAbility?.reactions || [])]
    copy.reactionIds = reactions.map(r => r.id || code)
    if (investigatorAbility?.chaosTokenRedraw) copy.reactionIds.push('wendyRedraw')
    copy.hasReactionPrompt = !!(eff?.reaction || reactions.some(r => !isAutomaticReward(r)) || investigatorAbility?.chaosTokenRedraw || eff?.freeTriggers?.length
      || eff?.abilities?.some(ability => ability.cost?.action === false) || ['01071','01082','01007'].includes(code))
    if (eff && eff.passive) {
      if (eff.passive.stats) copy.statBonus = eff.passive.stats
      if (eff.passive.fightDamage) copy.fightDamageBonus = eff.passive.fightDamage
      if (eff.passive.extraSlots || eff.passive.handSlotsBonus) {
        copy.extraSlots = { ...eff.passive.extraSlots }
        if (eff.passive.handSlotsBonus) copy.extraSlots.hand = (copy.extraSlots.hand || 0) + eff.passive.handSlotsBonus
      }
    }
    out[code] = copy
  }
  const ruleCodes = campaignId ? campaignRuleCodes(campaignId)
    : [...Object.keys(ALL_ENEMIES), ...Object.keys(ALL_TREACHERIES), ...Object.keys(ALL_STORY_ASSETS)]
  for (const code of ruleCodes) {
    const def = cardDef(code)
    const catalog = ALL_CARDS[def.originalCode || code]
    out[code] = { ...def, name: def.nameZh || def.name, availability: 'strict', strictAccepted: true,
      effectStatus: catalog?.effectStatus || 'unverified', acceptanceProfile: catalog?.acceptanceProfile || null }
  }
  return out
}

function embeddedCardDefs(state, campaignId) {
  const codes = new Set()
  for (const inv of state.investigators || []) {
    codes.add(inv.code)
    for (const code of [...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || [])]) codes.add(code)
    for (const card of [...(inv.assets || []), ...(inv.threat || [])]) {
      codes.add(card.code)
      for (const code of card.attached || []) codes.add(code)
    }
    for (const code of inv.beneath || []) codes.add(code)
  }
  for (const record of Object.values(state.campaign?.investigators || {})) {
    for (const code of record.deck || []) codes.add(code)
  }
  for (const card of state.victoryDisplay || []) codes.add(card.code)
  for (const code of [...(state.removedFromGame || []), ...(state.exiled || [])]) codes.add(code)
  return allCardDefs({ runtimeOnly: true, campaignId, playerCodes: codes })
}

// ---------------------------------------------------------------------------
// 牌组构筑（委托 deckbuilding.js）
// ---------------------------------------------------------------------------

function corePlayerPool() {
  return playablePool()
}

function basicWeaknessPool(state = null) {
  const core = Object.values(BASIC_WEAKNESSES)
    .filter((c) => isCardAvailable(c.code) && c.pack === 'core' && c.code !== '01000')
    .map((c) => c.code)
  const packs = state?.campaign ? campaignManifestFor(state).requiredPackIds.map(id => contentRegistry.getPack(id)) : []
  const extra = packs.flatMap(pack => pack?.basicWeaknessCodes || []).filter(code => isCardAvailable(code))
  return [...new Set([...core, ...extra])]
}

// ---------------------------------------------------------------------------
// 状态创建（战役入口）
// ---------------------------------------------------------------------------

function newCardInstance(state, code, fields = {}) {
  return { id: nextInstanceId(state, 'c'), code, ...cardIdentityFields(cardDef(code)), ...fields }
}
function newPlayerAssetInstance(state, inv, code, fields = {}) {
  const effect = EFFECTS[code] || {}
  const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round, ...fields })
  if (effect.uses != null && asset.uses == null) {
    asset.uses = effect.uses
    asset.usesType = effect.usesType || 'charges'
  }
  if (inv.code === '03004' && ['charge', 'charges'].includes(String(asset.usesType || '').toLowerCase())) {
    asset.uses = (asset.uses || 0) + (INVESTIGATOR_ABILITIES[inv.code]?.additionalChargeOnEnter || 0)
  }
  return asset
}
function newEnemyId(state) { return nextInstanceId(state, 'e') }

function makeInvestigator(invDef, seat) {
  return {
    seat,
    code: invDef.code,
    name: invDef.nameZh || invDef.name,
    nameEn: invDef.name,
    klass: invDef.klass,
    willpower: invDef.willpower, intellect: invDef.intellect,
    combat: invDef.combat, agility: invDef.agility,
    baseHealth: invDef.health, baseSanity: invDef.sanity,
    health: invDef.health, sanity: invDef.sanity,
    maxHealth: invDef.health, maxSanity: invDef.sanity,
    damage: 0, horror: 0,
    resources: 5,
    clues: 0,
    actionsLeft: 3,
    hand: [], deck: [], discard: [], hiddenCards: [],
    assets: [],           // [{ id, code, exhausted, uses? }]
    threat: [],           // 威胁区域：持续型弱点/诡计 [{ id, code, ... }]
    location: 'study',
    engaged: [],          // enemy ids
    defeated: false,
    resigned: false,
    defeatCause: null,    // 'damage' | 'horror'
    testBonus: 0,
    phaseStatBonus: null,
    skillSubstitute: null,
    onTheLam: false,
    fearExtraPaid: false,
    usedReactions: {},
    autoBuilt: true,
    deckName: '自动构筑 · ' + (CLASS_NAMES[invDef.klass] || invDef.klass) + ' ' + (CLASS_EMOJI[invDef.klass] || ''),
  }
}

function drawOpeningHand(state, inv) {
  const weaknesses = []
  const target = inv.code === '03003' ? 13 : 5
  while (inv.hand.length < target && inv.deck.length) {
    const code = inv.deck.pop()
    if (isWeaknessCode(code)) weaknesses.push(code)
    else inv.hand.push(code)
  }
  inv.deck = shuffle([...inv.deck, ...weaknesses], () => randomValue(state))
}

// 为调查员构筑牌库：人类座位若设置了自定义卡组（settings.playerDeck）则用自定义清单，
// 校验失败拒绝开局；其余座位（AI）始终使用相同许可池自动构筑。
function buildInvestigatorsDeck(state, inv, def, events) {
  const opts = {
    seat: inv.seat,
    seed: Math.floor(randomValue(state) * 4294967296),
    playerPool: corePlayerPool(),
    basicWeaknessPool: basicWeaknessPool(state),
  }
  if (inv.seat === 0 && state.customPlayerDeck) {
    const built = buildDeckFromList(def, state.customPlayerDeck, opts)
    if (built.errors && built.errors.length) {
      throw new Error(`自定义卡组无效：${built.errors.join('；')}`)
    }
    info(state, events, `🃏 ${inv.name} 使用自定义卡组（${built.playerCards.length} 张玩家卡）。`)
    return built
  }
  return buildDeck(def, opts)
}

function prepareInvestigator(state, inv, events, startLocation) {
  const def = ALL_INVESTIGATORS[inv.code]
  let record = state.campaign.investigators[inv.seat]
  let deck
  if (!record) {
    const built = buildInvestigatorsDeck(state, inv, def, events)
    record = registerCampaignInvestigator(state.campaign, inv, built.deck)
    deck = built.deck
  } else {
    if (record.code !== inv.code || record.status !== 'active') throw new Error('调查员战役身份不可进入剧本')
    deck = shuffle(record.deck, () => randomValue(state))
  }
  const trauma = state.campaign.trauma[inv.seat]
  inv.campaignId = record.id
  inv.baseHealth = def.health
  inv.baseSanity = def.sanity
  inv.maxHealth = def.health
  inv.maxSanity = def.sanity
  inv.health = def.health
  inv.sanity = def.sanity
  inv.damage = trauma.physical
  inv.horror = trauma.mental
  inv.resources = 5
  inv.clues = 0
  inv.actionsLeft = 3 + extraActionBonus(inv)
  inv.tomeActionUsed = false
  inv.hand = []
  inv.deck = deck
  inv.discard = []
  inv.hiddenCards = []
  inv.assets = []
  inv.threat = []
  inv.engaged = []
  inv.defeated = false
  inv.resigned = false
  inv.defeatCause = null
  inv.testBonus = 0
  inv.phaseStatBonus = null
  inv.skillSubstitute = null
  inv.onTheLam = false
  inv.fearExtraPaid = false
  inv.usedReactions = {}
  inv.location = startLocation
  inv.handSlotsPenalty = state.locations.find(location => location.id === startLocation)?.handSlotsPenalty || 0
  const startsWith = INVESTIGATOR_ABILITIES[inv.code]?.startsWith
  for (const code of startsWith == null ? [] : Array.isArray(startsWith) ? startsWith : [startsWith]) {
    if (removeCardByCode(inv.deck, code)) inv.assets.push(newPlayerAssetInstance(state, inv, code))
  }
  for (const code of inv.deck.filter(code => cardDef(code)?.permanent)) {
    removeCardByCode(inv.deck, code)
    const card = newPlayerAssetInstance(state, inv, code)
    if (cardDef(code)?.type === 'treachery') inv.threat.push(card)
    else inv.assets.push(card)
    inv.resources = Math.max(0, inv.resources + (EFFECTS[code]?.startingResources || 0))
    const setup = EFFECTS[code]?.setup
    if (setup) carcosaPlayerEffect(state, inv.seat, { ...setup, assetId: card.id }, events)
  }
  drawOpeningHand(state, inv)
  if ((trauma.physical || 0) > 0 || (trauma.mental || 0) > 0) {
    info(state, events, `${inv.name} 因创伤以 ${inv.damage} 点伤害、${inv.horror} 点恐惧开始本关；生命与理智上限不变。`)
  }
}

function registerCampaignScenarios(campaignId) {
  for (const entry of contentRegistry.listScenarios(campaignId)) {
    const scenario = contentRegistry.getScenarioData(entry.id)
    SCENARIOS[entry.id] = scenario
    Object.assign(ALL_ENEMIES, scenario.enemies || {})
    Object.assign(ALL_TREACHERIES, scenario.treacheries || {})
    Object.assign(ALL_STORY_ASSETS, scenario.storyAssets || {})
  }
}

// 存档迁移用：把状态里内嵌的资源副本（卡牌定义、调查员定义、展示常量）刷新为当前版本。
// 只替换派生数据，不改变牌序、随机状态、实例编号或战役进度。
export function refreshStateResources(state) {
  const campaignId = state.campaign?.id
  if (!campaignId || !contentRegistry.getCampaign(campaignId)) throw new Error(`存档所属战役 ${campaignId || '(缺失)'} 已不可用`)
  registerCampaignScenarios(campaignId)
  if (state.scenario?.id && !SCENARIOS[state.scenario.id]) throw new Error(`存档所在关卡 ${state.scenario.id} 已不可用`)
  state.resourceVersion = META.resourceVersion
  state.cards = inHub(state) ? allCardDefs({ runtimeOnly: true, campaignId })
    : embeddedCardDefs(state, campaignId)
  state.investigatorDefs = Object.fromEntries(PLAYABLE_INVESTIGATORS.map(code => [code, ALL_INVESTIGATORS[code]]))
  state.classNames = CLASS_NAMES
  state.classColors = CLASS_COLOR
  state.skillNames = SKILL_NAMES
  state.tokenLabels = TOKEN_LABEL
  return state
}

// 内嵌资源与派生字段不参与卡号核对；其余位置出现的卡号必须能在当前资源中解析。
const DERIVED_STATE_KEYS = new Set(['cards', 'investigatorDefs', 'classNames', 'classColors', 'skillNames', 'tokenLabels', 'log', 'legalMoves'])
const CARD_CODE = /^\d{5}[a-z]?$/

export function unknownCardCodes(state) {
  if (state.campaign?.id) registerCampaignScenarios(state.campaign.id)
  const missing = new Set()
  const check = value => { if (typeof value === 'string' && CARD_CODE.test(value) && !cardDef(value)) missing.add(value) }
  const walk = (value, depth) => {
    if (!value || typeof value !== 'object' || depth > 64) return
    if (Array.isArray(value)) { for (const item of value) typeof item === 'object' ? walk(item, depth + 1) : check(item); return }
    for (const [key, item] of Object.entries(value)) {
      if (depth === 0 && DERIVED_STATE_KEYS.has(key)) continue
      if (typeof item === 'object') walk(item, depth + 1)
      else if (key === 'code' || key === 'originalCode') check(item)
    }
  }
  walk(state, 0)
  return [...missing].sort()
}

export function createGameState(settings, players) {
  const manifest = contentRegistry.assertLaunchable(settings.campaignId || contentRegistry.listCampaigns()[0].id)
  const CAMPAIGN = { ...manifest, scenarioOrder: manifest.scenarioIds }
  registerCampaignScenarios(manifest.id)
  const rulesMode = settings.rulesMode || 'simplified'
  if (!['simplified', 'strict'].includes(rulesMode)) throw new Error('未知识别的规则模式')
  if (settings.playerDeck != null && !Array.isArray(settings.playerDeck)) throw new Error('自定义卡组必须是卡号数组')
  // New games get independent randomness; explicit seeds remain reproducible.
  // The seed and evolving rngState are persisted with the game for resuming.
  const seed = String(settings.seed ?? randomUUID())
  const randomState = { rngState: hashSeed(seed) >>> 0 }
  const invCodes = PLAYABLE_INVESTIGATORS
  const rng = () => randomValue(randomState)
  const order = shuffle(invCodes, rng)

  let humanPick = settings.playerInvestigator
  if (!humanPick || humanPick === 'auto' || humanPick === '__random__') humanPick = order[0]
  if (!canSelectInvestigator(humanPick) || !Object.hasOwn(ALL_INVESTIGATORS, humanPick)) {
    throw new Error(`调查员未开放：${humanPick}`)
  }

  const used = new Set()
  const investigators = []
  for (const p of players) {
    let code
    if (p.seat === 0) {
      code = humanPick
    } else {
      code = pickAiInvestigator(p, order, used)
    }
    used.add(code)
    investigators.push(makeInvestigator(ALL_INVESTIGATORS[code], p.seat))
  }

  const difficulty = settings.difficulty || 'standard'
  const state = {
    schemaVersion: STATE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    revision: 0,
    seed,
    rngState: randomState.rngState,
    instanceSeq: { c: 0, e: 0 },
    status: 'playing',
    hubFlow: !!settings.campaignHub,
    uiState: settings.campaignHub ? 'campaignHub' : 'inScenario',
    winnerSeat: null,
    currentSeat: 0,
    moveCount: 0,
    round: 1,
    phase: settings.campaignHub ? 'campaignHub' : 'investigation',
    outcome: null,
    resolution: null,
    scenario: null,
    difficulty,
    numInvestigators: investigators.length,
    humanSeats: players.filter(p => p.role === 'human' || (p.role == null && p.seat === 0)).map(p => p.seat),
    actIndex: 0,
    agendaIndex: 0,
    doom: 0,
    clues: 0,
    victory: 0,
    actClues: 0,
    fogMod: 0,
    investigators,
    locations: [],
    enemies: [],
    encounterDeck: [],
    encounterDiscard: [],
    cultistDeck: [],
    cultistsInVictory: [],
    chaosBag: [],
    sealedTokens: [],
    exiled: [],
    exiledBySeat: [],
    log: [],
    legalMoves: [],
    customPlayerDeck: Array.isArray(settings.playerDeck) ? settings.playerDeck.slice() : null,
    aiStoryAwareness: settings.aiStoryAwareness === true || settings.aiStoryAwareness === 'on',
    resourceVersion: META.resourceVersion,
    rulesMode,
    cards: allCardDefs({ runtimeOnly: true, campaignId: CAMPAIGN.id }),
    investigatorDefs: Object.fromEntries(PLAYABLE_INVESTIGATORS.map(code => [code, ALL_INVESTIGATORS[code]])),
    classNames: CLASS_NAMES,
    classColors: CLASS_COLOR,
    skillNames: SKILL_NAMES,
    acts: [],
    agendas: [],
    tokenLabels: TOKEN_LABEL,
    campaign: {
      id: CAMPAIGN.id,
      name: CAMPAIGN.name,
      scenarioCount: CAMPAIGN.scenarioOrder.length,
      scenarioIndex: 0,
      phase: settings.campaignHub ? 'campaignHub' : 'scenario',
      leadSeat: players.find(p => p.role === 'human' || (p.role == null && p.seat === 0))?.seat ?? null,
      leadConfirmed: !settings.campaignHub || players.filter(p => p.role === 'human' || (p.role == null && p.seat === 0)).length === 1,
      investigatorSeq: 0,
      investigators: {},
      retired: [],
      scenarioResults: [],
      victory: 0,
      xp: 0,
      trauma: {},
      recordSchema: structuredClone(CAMPAIGN.recordSchema || {}),
      records: Object.fromEntries(Object.entries(CAMPAIGN.recordSchema || {}).map(([key, type]) =>
        [key, type === 'boolean' ? false : type === 'number' ? 0 : type === 'string[]' ? [] : ''])),
      finished: false,
      result: null,
    },
  }

  state.log.push('🎬 战役开始：' + CAMPAIGN.name)
  for (const inv of investigators) {
    state.log.push(`${CLASS_EMOJI[inv.klass] || ''} ${inv.name}（${CLASS_NAMES[inv.klass] || inv.klass}）加入调查队。`)
  }
  if (state.hubFlow) {
    state.hubSelectedScenarioId = initialHubScenarioMoves(state).length > 1 ? null : CAMPAIGN.scenarioOrder[0]
    state.hubSeatSelected = {}
    state.hubSeatDone = {}
    state.hubUpgradedSeats = {}
    state.legalMoves = legalMoves(state)
    return state
  }
  resolveTransaction(state, 0, { action: 'setup' }, executeCommand, { initial: true })
  state.cards = embeddedCardDefs(state, CAMPAIGN.id)
  state.legalMoves = legalMoves(state)
  return state
}

function pickAiInvestigator(player, order, used) {
  const persona = (player && player.persona) || ''
  const map = {
    guardian: ['守卫', '守护', '战斗', '枪', '战士', '警察', 'guardian'],
    seeker: ['探求', '求知', '学者', '书', '研究', 'seeker'],
    mystic: ['秘术', '法术', '魔法', '巫师', '意志', 'mystic'],
    rogue: ['游荡', '窃', '敏捷', '赌徒', '小偷', 'rogue'],
    survivor: ['幸存', '生存', '幸运', '流浪', 'survivor'],
  }
  for (const [klass, keys] of Object.entries(map)) {
    if (keys.some((k) => persona.includes(k))) {
      const code = PLAYABLE_INVESTIGATORS.find((c) => ALL_INVESTIGATORS[c].klass === klass && !used.has(c))
      if (code) return code
    }
  }
  for (const code of order) {
    if (!used.has(code)) return code
  }
  return order[0]
}

// ---------------------------------------------------------------------------
// 剧本切换（战役推进）
// ---------------------------------------------------------------------------

// 从战役进入指定剧本：设置剧本数据、铺地图/敌人/遭遇牌堆/混乱袋、恢复调查员。
function progressCampaign(state, events, launch = false, leaveRest = false) {
  const campaign = state.campaign
  const manifest = campaignManifestFor(state)
  const graph = campaignGraph(manifest)
  if (!campaign.chaosBag) {
    const bags = manifest.chaosBags || CHAOS_BAGS
    initializeChaosBag(state, bags[state.difficulty] || bags.standard)
  }
  if (campaign.pendingNode) {
    enterCampaignNode(campaign, manifest, campaign.pendingNode)
    delete campaign.pendingNode
  } else if (leaveRest && ['interlude', 'checkpoint'].includes(graph.nodes[campaign.flow?.nodeId]?.type)) {
    enterCampaignNode(campaign, manifest, graph.nodes[campaign.flow.nodeId].next)
  }
  const node = walkCampaign(campaign, manifest, (id, node, options) => requestChoice(state, {
    kind: 'campaignBranch', source: id, seat: campaign.leadSeat, prompt: node.prompt || node.text || '选择战役路线',
    options: options.map(option => ({ id: option.id, label: option.label })),
  }), effect => applyCampaignEffect(state, effect, text => info(state, events, text)))
  campaign.flowStage = node.type
  if (node.type === 'end') {
    campaign.flowOutcome = node.outcome
    endCampaign(state, events)
  } else if (node.type === 'scenario') {
    campaign.scenarioIndex = manifest.scenarioIds.indexOf(node.scenarioId)
    state.hubSelectedScenarioId = node.scenarioId
    state.uiState = 'scenarioSetup'; state.phase = 'scenarioSetup'; campaign.phase = 'scenarioSetup'
    if (launch) { startScenario(state, campaign.scenarioIndex, events); runMulligans(state, events) }
  } else {
    campaign.phase = 'interlude'; state.phase = 'interlude'; state.uiState = 'interlude'
    const next = graph.nodes[node.next]
    if (next?.type === 'scenario') {
      campaign.scenarioIndex = manifest.scenarioIds.indexOf(next.scenarioId)
      state.hubSelectedScenarioId = next.scenarioId
    }
    campaign.upgradesAllowed = node.type === 'interlude' && node.upgrades !== false
    state.hubReady = false; state.hubSeatDone = {}; state.currentSeat = 0
    if (launch && !state.hubFlow) runInterlude(state, campaign.scenarioIndex, events)
  }
}

function resolveAgendaDoomThresholds(agendas, numInvestigators) {
  for (const agenda of agendas || []) {
    if (agenda.doomThresholdPerInvestigator != null) {
      agenda.doomThreshold = agenda.doomThresholdPerInvestigator * numInvestigators
    }
  }
}

function startScenario(state, index, events) {
  const CAMPAIGN = campaignFor(state)
  const scenarioId = CAMPAIGN.scenarioOrder[index]
  const sc = structuredClone(SCENARIOS[scenarioId])
  resolveAgendaDoomThresholds(sc.agendas, state.numInvestigators)
  state.scenario = sc
  state.acts = sc.acts
  state.agendas = sc.agendas
  state.campaign.scenarioIndex = index
  for (const record of Object.values(state.campaign.investigators || {})) record.currentScenarioIndex = index
  state.campaign.phase = 'scenario'
  state.uiState = 'inScenario'
  state.storyAssets = []
  state.victoryDisplay = []
  state.actIndex = 0
  state.agendaIndex = 0
  state.doom = 0
  state.clues = 0
  state.victory = 0
  state.actClues = 0
  state.fogMod = 0
  state.resolution = null
  state.locations = []
  state.enemies = []
  state.encounterDeck = []
  state.encounterDiscard = []
  state.cultistDeck = []
  state.cultistsInVictory = []
  state.sealedTokens = []
  state.exiled = []
  state.exiledBySeat = []
  state.locationVariants = {}
  state.scenarioZones = {}
  state.scenarioFlags = {}
  state.round = 1
  state.phase = 'investigation'
  state.turnsTaken = []

  // 计算有效起始地点（午夜假面：房屋已烧毁则从河岸城开始）。
  const startLoc = scenarioStartLocation(state, sc)

  // 调查员：恢复/重建（含创伤）。
  for (const inv of state.investigators) {
    prepareInvestigator(state, inv, events, startLoc)
  }

  scenarioBehavior(state).preScenarioSetup?.(state, events, scenarioRuntime(state, events))

  // 剧本专属布置。
  setupScenarioLocations(state, events)
  setupScenarioEnemies(state, events)
  setupScenarioDecks(state, events)
  setupChaosBag(state, events)
  scenarioBehavior(state).afterChaosBagSetup?.(state, events)

  state.currentSeat = firstAliveSeat(state)
  info(state, events, `🎬 第 ${index + 1} 关：${sc.name}`)
  state.scenarioIntro = introduction(sc, state.campaign.records, state)
  const introText = state.scenarioIntro.paragraphs.join('\n\n')
  info(state, events, introText, { kind: 'story', title: '故事导入', scenarioId: sc.id,
    code: sc.acts[0]?.originalCode || sc.acts[0]?.code, name: sc.acts[0]?.name || sc.name,
    text: introText, intro: true })
  const openingAgenda = state.agendas[state.agendaIndex]
  if (openingAgenda) info(state, events, `初始密谋：${openingAgenda.name}。`, {
    kind: 'story', title: '密谋揭示', scenarioId: sc.id, initialAgenda: true,
    code: openingAgenda.originalCode || openingAgenda.code, name: openingAgenda.name,
    text: openingAgenda.text || '新的威胁正在逼近。',
  })
  info(state, events, sc.setup)
  for (const inv of state.investigators) {
    info(state, events, `${CLASS_EMOJI[inv.klass] || ''} ${inv.name} 位于「${locName(state, inv.location)}」。`)
  }
  info(state, events, `☀️ 第 1 回合 · 调查阶段开始，轮到 ${state.investigators[state.currentSeat]?.name}。`)
  state.legalMoves = legalMoves(state)
}

function scenarioStartLocation(state, sc) {
  return contentRegistry.getBehavior(sc.id).startLocation?.(state) || sc.startLocation
}

function setupScenarioLocations(state, events) {
  const placed = scenarioBehavior(state).setupLocations?.(state, events, { randomValue, shuffle, info })
    || [state.scenario.startLocation]
  for (const id of placed) placeLocation(state, id, events)
}

function setupScenarioEnemies(state, events) {
  scenarioBehavior(state).setupEnemies?.(state, events, { spawnEnemy, locName, info })
}

function setupScenarioDecks(state, events) {
  const sc = state.scenario
  const rng = () => randomValue(state)
  let deck = sc.encounterDeck.slice()

  deck = scenarioBehavior(state).modifyDeck?.(state, deck, events,
    { randomValue, removeCardByCode, info }) || deck

  // 若食尸鬼祭司仍存活（第一幕未击败），洗入遭遇牌库。
  if (scenarioBehavior(state).includeSurvivingPriest && state.campaign.records.ghoulPriestAlive) {
    deck.push('ghoulPriest')
    info(state, events, '👹 食尸鬼祭司仍存活，被洗入遭遇牌库。')
  }

  state.encounterDeck = shuffle(deck, rng)

  // 午夜假面：独立异教徒牌堆。
  if (sc.cultistDeck) {
    state.cultistDeck = shuffle(sc.cultistDeck.slice(), rng)
  }

  scenarioBehavior(state).afterDeckSetup?.(state, events, { info, randomValue, shuffle })
}

function setupChaosBag(state, events) {
  const bags = campaignManifestFor(state).chaosBags || CHAOS_BAGS
  initializeChaosBag(state, bags[state.difficulty] || bags.standard)
  const extra = state.scenario.chaosBagExtra || []
  if (extra.length) {
    state.chaosBag.push(...extra)
    info(state, events, `🎲 混乱袋加入：${extra.map((t) => tokenLabel(t)).join('、')}。`)
  }
}

// ---------------------------------------------------------------------------
// 战役结算（结局 → 创伤 → 冒险日志 → 下一关 / 战役结束）
// ---------------------------------------------------------------------------

class ScenarioEnded extends Error {
  constructor(nextIndex) {
    super('剧本结算完成')
    this.nextIndex = nextIndex
  }
}

function finishScenario(state, resolutionKey, events) {
  const CAMPAIGN = campaignFor(state)
  if (state.status !== 'playing') return
  const sc = state.scenario
  const campaign = state.campaign
  if (!Object.hasOwn(sc.resolutions, resolutionKey)) throw new Error('未知剧本结局')
  const visitId = `${campaign.flow?.nodeId || sc.id}:${campaign.flow?.visits?.[campaign.flow.nodeId] || 1}`
  if (campaign.scenarioResults.some(result => result.visitId === visitId)) throw new Error('本关已经结算')
  const before = structuredClone(campaign.investigators)
  const recordsBefore = structuredClone(campaign.records)
  state.resolution = resolutionKey
  campaign.phase = 'resolution'
  state.victory = (state.victoryDisplay || []).reduce((sum, card) => sum + (card.victory || 0), 0)
    + state.locations.filter(loc => loc.revealed && loc.clues === 0).reduce((sum, loc) => sum + (loc.victory || 0), 0)
  info(state, events, `剧本结局：${resolutionKey}。`)
  const storyKey = scenarioBehavior(state).storyResolutionKey?.(state, resolutionKey) || resolutionKey
  const story = resolutionStory(sc, storyKey, null, {
    records: recordsBefore,
    investigators: state.investigators,
    actIndex: state.actIndex,
  })
  info(state, events, story.paragraphs.join('\n\n'), { kind: 'story', title: story.title,
    name: sc.name, text: story.paragraphs.join('\n\n') })
  applyDefeatTrauma(state, events)
  applyResolutionEffects(state, resolutionKey, events)
  settleExiledCards(campaign, state.exiledBySeat)
  for (const inv of state.investigators) {
    if (inv.threat.some(card => card.code === '01007' && card.counters > 0)) addTrauma(state, inv.seat, 'mental', 1, events)
    const angeredSpirits = inv.threat.find(card => card.code === '03015')
    if (angeredSpirits && (angeredSpirits.uses || 0) < 4 && !angeredSpirits.traumaApplied) {
      angeredSpirits.traumaApplied = true
      addTrauma(state, inv.seat, 'physical', 1, events)
    }
    if (state.enemies.some(enemy => enemy.smiteTheWickedSeat === inv.seat)
      || state.locations.some(loc => loc.searchingForIzzieSeat === inv.seat)) addTrauma(state, inv.seat, 'mental', 1, events)
    updateCampaignStatus(campaign, inv.seat)
  }
  if (campaign.id === 'thePathToCarcosa' && campaign.records.pallidMaskBearer) {
    applyCampaignEffect(state, {
      type: 'transferCampaignWeakness',
      code: '03059',
      bearerRecord: 'pallidMaskBearer',
    }, text => info(state, events, text))
  }
  campaign.victory += state.victory
  campaign.scenarioResults.push({
    scenarioId: sc.id, scenarioIndex: campaign.scenarioIndex, visitId, resolution: resolutionKey,
    storyResolution: storyKey,
    introStory: structuredClone(state.scenarioIntro || introduction(sc, recordsBefore, state)),
    story,
    victory: state.victory, rounds: state.round, recordsBefore, recordsAfter: structuredClone(campaign.records),
    investigators: state.investigators.map(inv => {
      const record = campaign.investigators[inv.seat]
      return { seat: inv.seat, id: record.id, code: record.code, status: record.status,
        defeated: inv.defeated, resigned: inv.resigned,
        xpAwarded: record.earnedXp - before[inv.seat].earnedXp, xp: record.xp,
        traumaBefore: before[inv.seat].trauma, traumaAfter: { ...record.trauma }, deck: [...record.deck] }
    }),
  })
  const graph = campaignGraph(campaignManifestFor(state))
  const current = graph.nodes[campaign.flow?.nodeId]
  const node = current?.type === 'scenario' && current.scenarioId === sc.id ? current
    : Object.values(graph.nodes).find(item => item.type === 'scenario' && item.scenarioId === sc.id)
  campaign.pendingNode = node?.next
  const next = graph.nodes[campaign.pendingNode]
  if (campaign.failed || !next || next.type === 'end') {
    throw new ScenarioEnded(null)
  }
  throw new ScenarioEnded(campaign.scenarioIndex + 1)
}

function addLitaToCampaign(state) {
  const campaign = state.campaign
  const lead = state.investigators[campaign.leadSeat]
  const candidates = campaign.investigators[lead.seat].status === 'active' ? [lead]
    : state.investigators.filter(inv => inv.resigned && campaign.investigators[inv.seat].status === 'active')
  if (!candidates.length) return
  const answer = requestChoice(state, { kind: 'storyCard', source: '01117', seat: candidates[0].seat,
    prompt: '是否将丽塔·钱德勒加入战役牌组？不计入牌组张数。', canSkip: true,
    options: [{ id: 'skip', label: '不加入丽塔' }, ...candidates.map(inv => ({ id: String(inv.seat), label: `加入${inv.name}的牌组` }))] })
  if (answer !== 'skip') {
    const seat = Number(answer)
    campaignCardChange(campaign, seat, '01117', 'add', state.scenario.id)
    campaign.records.litaOwner = campaign.investigators[seat].id
  }
}

function applyResolutionEffects(state, resolutionKey, events) {
  const campaign = state.campaign
  const { bonus = 0, award = true, seatBonus = () => 0 } = scenarioBehavior(state).resolution?.(
    state, resolutionKey, events,
    { addLitaToCampaign, addTrauma, originalCardCode, basicWeaknessPool,
      ALL_CARDS, campaignCardChange, randomValue }) || {}
  if (award) for (const inv of state.investigators) {
    let amount = state.victory + bonus + seatBonus(inv.seat)
    const obol = inv.assets.find(asset => asset.code === '03308')
    if (obol) {
      if (inv.defeated) {
        const record = campaign.investigators[inv.seat]
        if (record) record.status = 'killed'
        updateCampaignStatus(campaign, inv.seat)
        info(state, events, `${inv.name} 在「卡戎的银币」的契约下被击败，已死亡。`)
        continue
      }
      amount += 2
      info(state, events, `${inv.name} 因「卡戎的银币」额外获得 2 XP。`)
    }
    const debt = inv.threat.find(item => getThreatEffect(item)?.debt)
    if (debt && (debt.resources || 0) < 6) {
      const penalty = getThreatEffect(debt)?.xpPenalty || 2
      amount = Math.max(0, amount - penalty)
      info(state, events, `${inv.name} 的医院债务少于 6 资源，本场冒险少获得 ${penalty} XP。`)
    }
    awardExperience(campaign, inv.seat, amount)
    info(state, events, `${inv.name} 获得 ${amount} XP，未花费 ${campaign.investigators[inv.seat].xp} XP。`)
  }
}

function addTrauma(state, seat, kind, amount, events) {
  const t = state.campaign.trauma[seat]
  t[kind] += amount
  updateCampaignStatus(state.campaign, seat)
  const inv = state.investigators[seat]
  info(state, events, `${inv.name} 受到 ${amount} 点${kind === 'physical' ? '肉体' : '精神'}创伤。`)
}

function applyDefeatTrauma(state, events) {
  for (const inv of state.investigators) {
    if (inv.defeated && !inv.resigned && inv.defeatCause) {
      const kind = inv.defeatCause === 'both' ? requestChoice(state, {
        kind: 'trauma', source: 'defeat', seat: inv.seat, prompt: '同时因伤害与恐惧被击败，选择一种创伤。',
        options: [{ id: 'physical', label: '1 点肉体创伤' }, { id: 'mental', label: '1 点精神创伤' }],
      }) : inv.defeatCause === 'damage' ? 'physical' : 'mental'
      addTrauma(state, inv.seat, kind, 1, events)
    }
  }
}

function runInterlude(state, nextIndex, events) {
  const campaign = state.campaign
  campaign.phase = 'interlude'
  state.phase = 'interlude'
  const eliminated = state.investigators.filter(inv => campaign.investigators[inv.seat].status !== 'active')
  if (replacementCandidates(campaign).length < eliminated.length) {
    campaign.failed = true
    info(state, events, '已开放的调查员不足以替换所有死亡或疯狂的人物，战役无法继续。')
    endCampaign(state, events)
    return
  }
  for (const inv of eliminated) {
    const code = requestChoice(state, { kind: 'replacement', source: campaign.investigators[inv.seat].id,
      seat: inv.seat, prompt: '选择新的调查员，以全新 0 XP 牌组加入；不继承旧人物创伤与卡牌。',
      options: replacementCandidates(campaign).map(code => ({ id: code, label: cardName(code) })),
    })
    campaign.retired.push(structuredClone(campaign.investigators[inv.seat]))
    const replacement = makeInvestigator(ALL_INVESTIGATORS[code], inv.seat)
    const built = buildDeck(ALL_INVESTIGATORS[code], { seat: inv.seat, seed: Math.floor(randomValue(state) * 4294967296) })
    registerCampaignInvestigator(campaign, replacement, built.deck)
    state.investigators[inv.seat] = replacement
    info(state, events, `${replacement.name} 替换 ${inv.name} 加入战役。`)
  }
  campaign.interlude ||= { seatIndex: 0 }
  const inv = state.investigators[campaign.interlude.seatIndex]
  if (!inv) {
    delete campaign.interlude
    progressCampaign(state, events, true, true)
    return
  }
  const resume = () => resolutionCheckpoint(state, inv.seat, { action: 'interlude', nextIndex })
  const record = campaign.investigators[inv.seat]
  const cards = campaign.upgradesAllowed === false ? [] : availablePurchases(record, campaign.records)
  const answer = requestChoice(state, { kind: 'interlude', source: record.id, seat: inv.seat,
    prompt: `${inv.name}：未花费 ${record.xp} XP。可调整牌组，或保留经验进入下一关。候选卡按构筑限制、经验和替换后的完整牌组筛选。`,
    options: [{ id: 'done', label: '完成关间准备，保留剩余 XP' }, ...(cards.length ? [{ id: 'upgrade', label: '购买或替换一张卡牌' }] : [])],
  })
  if (answer === 'done') { campaign.interlude.seatIndex++; resume() }
  const added = requestChoice(state, { kind: 'upgradeCard', source: record.id, seat: inv.seat,
    prompt: '选择购入卡牌；0 级新卡至少支付 1 XP。', canSkip: true,
    options: [{ id: 'cancel', label: '返回关间准备' }, ...cards.map(code => ({ id: code, label: `${cardName(code)}（${ALL_CARDS[code].xp || 0} 级）` }))],
  })
  if (added === 'cancel') resume()
  const removed = requestChoice(state, { kind: 'upgradeRemove', source: { type: 'upgrade', cardCode: added, id: record.id }, seat: inv.seat,
    prompt: '选择被替换的普通玩家卡；签名、弱点与剧情卡不能以此方式移除。', canSkip: true,
    options: [{ id: 'cancel', label: '取消购买' }, ...replacementOptions(record, added, campaign.records).map(item => ({ id: item.code, label: `替换${cardName(item.code)}，支付 ${item.cost} XP` }))],
  })
  if (removed === 'cancel') resume()
  const purchase = purchaseCard(campaign, inv.seat, added, removed)
  info(state, events, `${inv.name} 完成一次牌组调整，支付 ${purchase.cost} XP。`)
  resume()
}

function endCampaign(state, events) {
  const CAMPAIGN = campaignFor(state)
  state.status = 'over'
  if (state.hubFlow) { state.uiState = 'campaignResult'; state.phase = 'campaignResult' }
  state.campaign.phase = 'finished'
  state.campaign.finished = true
  // 地底噬魔 noResolution → 失败；其余剧本推进到底 → 胜利。
  if (state.campaign.failed || state.campaign.flowOutcome === 'defeat') {
    state.outcome = 'defeat'
    state.campaign.result = 'defeat'
    info(state, events, '调查失败，战役结束。')
  } else if (state.campaign.records.sacrificedLita || state.campaign.flowOutcome === 'survived') {
    state.outcome = 'survived'
    state.campaign.result = 'survived'
    state.winnerSeat = null
    info(state, events, state.campaign.records.sacrificedLita ? '调查队以牺牲丽塔为代价幸存；这不是胜利结局。' : '调查队幸存，战役结束。')
  } else {
    state.outcome = 'victory'
    state.campaign.result = 'victory'
    state.winnerSeat = 0
    info(state, events, `🏆 战役完成！《${CAMPAIGN.name}》结束。累计胜利点 ${state.campaign.victory}，经验 ${state.campaign.xp}。`)
  }
  state.legalMoves = []
}

// ---------------------------------------------------------------------------
// 通用小工具
// ---------------------------------------------------------------------------

function info(state, events, text, presentation = null) {
  state.log.push(text)
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120)
  const cue = presentation || (['enemy', 'upkeep', 'mythos'].includes(state.phase)
    ? { kind: 'automatic', phase: state.phase, round: state.round, text } : null)
  const event = { type: 'info', text, ...(state.skillTest && !state.skillTest.helpRequested ? { privateSeat: state.skillTest.seat } : {}), ...(cue ? { presentation: { ...cue, tableState: captureTableState(state, getStat, getMaxSanity) } } : {}) }
  if (events) events.push(event)
  if (state._resolution) state._resolution.events.push(event)
  return text
}

function privateInfo(state, events, seat, text, presentation = null) {
  const event = { type: 'info', text, privateSeat: seat,
    ...(presentation ? { presentation } : {}) }
  if (events) events.push(event)
  if (state._resolution && events !== state._resolution.events) state._resolution.events.push(event)
}

function hiddenDefinition(state, code) {
  const definition = state.scenario?.treacheries?.[code]
  return definition?.hidden ? definition : null
}

function hiddenRule(state, code) {
  return hiddenDefinition(state, code)?.hiddenRule || null
}

function hasHiddenCard(inv, code = null) {
  return (inv.hiddenCards || []).some(hidden => code == null || hidden === code)
}

function removeHiddenMarker(inv, code) {
  const index = (inv.hiddenCards || []).indexOf(code)
  if (index >= 0) inv.hiddenCards.splice(index, 1)
}

function canDiscardFromHand(inv, code) {
  return !hasHiddenCard(inv, code)
}

function discardHiddenCard(state, inv, code, events) {
  const handIndex = inv.hand.indexOf(code)
  if (handIndex < 0 || !hasHiddenCard(inv, code)) return false
  inv.hand.splice(handIndex, 1)
  removeHiddenMarker(inv, code)
  state.encounterDiscard.push(code)
  info(state, events, `${inv.name} 弃掉了隐私牌「${cardName(code)}」。`)
  return true
}

function placeHiddenCard(state, inv, definition, events) {
  inv.hand.push(definition.code)
  inv.hiddenCards ||= []
  inv.hiddenCards.push(definition.code)
  info(state, events, `${inv.name} 秘密将一张隐私遭遇卡加入手牌。`)
  privateInfo(state, events, inv.seat, `你秘密将「${definition.name}」加入手牌：${definition.text || ''}`, {
    kind: 'automatic', phase: state.phase, round: state.round, text: `你获得隐私牌「${definition.name}」`,
    code: definition.originalCode || definition.code, name: definition.name, effect: 'encounter', seat: inv.seat,
  })
}

function activeHiddenRules(state, inv) {
  return (inv.hiddenCards || []).map(code => ({ code, rule: hiddenRule(state, code) }))
    .filter(item => item.rule)
}

function cannotTriggerFreeAbility(state, inv) {
  return activeHiddenRules(state, inv).some(item => item.rule.cannotTriggerFree)
}

function hiddenFightBlocked(state, inv, enemy) {
  const traits = (enemy?.traits || []).map(trait => String(trait).toLowerCase())
  return activeHiddenRules(state, inv).some(item =>
    item.rule.cannotFightTraits?.some(trait => traits.includes(String(trait).toLowerCase())))
}

function movementError(state, inv) {
  if (state.phase !== 'investigation' || !state.turnSerial) return null
  const maximum = Math.min(...activeHiddenRules(state, inv)
    .map(item => item.rule.maxMovesPerTurn).filter(Number.isFinite), Infinity)
  return Number.isFinite(maximum) && inv.hiddenMoves?.turnSerial === state.turnSerial
    && inv.hiddenMoves.count >= maximum ? '隐私牌限制你本回合不能再次移动'
    : scenarioBehavior(state).movementError?.(state, inv) || null
}

function locName(state, id) {
  const l = state.locations.find((x) => x.id === id)
  return l ? l.name : id
}

function currentInv(state) {
  return state.investigators[state.currentSeat]
}

function investigatorTextBlanked(state, inv) {
  return !!inv && state.enemies.some(enemy => enemy.code === '01103'
    && enemy.location === inv.location && !enemy.defeated && !enemyTextBlanked(state, enemy))
}

function aliveInvestigators(state) {
  return state.investigators.filter((i) => !i.defeated && !i.resigned)
}

function firstAliveSeat(state) {
  const a = aliveInvestigators(state)
  return a.length ? a[0].seat : null
}

// Team decisions stay with a human player even if their investigator is out.
function leadDecisionSeat(state) {
  const humans = state.humanSeats || [0]
  return humans.includes(state.campaign.leadSeat) ? state.campaign.leadSeat : humans[0] ?? null
}

function nextSeat(state, seat) {
  state.turnsTaken ||= []
  if (!state.turnsTaken.includes(seat)) state.turnsTaken.push(seat)
  return chooseTurn(state)
}

function chooseTurn(state) {
  const candidates = aliveInvestigators(state).filter(inv => !(state.turnsTaken || []).includes(inv.seat))
  if (!candidates.length) return null
  if (state.numInvestigators === 1) return candidates[0].seat
  const humanSeats = state.humanSeats || [0]
  const humans = candidates.filter(inv => humanSeats.includes(inv.seat))
  if (humans.length) {
    const leadSeat = state.campaign.leadSeat
    const aiOptions = humans.some(inv => inv.seat === leadSeat)
      ? candidates.filter(candidate => !humanSeats.includes(candidate.seat))
        .map(candidate => ({ id: String(candidate.seat), label: `让 ${candidate.name} 先行动`, responderSeat: leadSeat }))
      : []
    const shared = humans.length > 1 ? '尚未行动的玩家谁先点击「开始行动」谁先行动。' : '点击开始行动。'
    return Number(requestChoice(state, { kind: 'turnOrder', source: `round:${state.round}`, seat: humans[0].seat,
      seats: humans.map(inv => inv.seat),
      prompt: aiOptions.length ? shared + '队长也可以让一名尚未行动的 AI 队友先行动。' : shared,
      options: [...humans.map(inv => ({ id: String(inv.seat), label: '开始行动', responderSeat: inv.seat })), ...aiOptions] }))
  }
  if (state.aiTurnOrderRound !== state.round) {
    state.aiTurnOrderRound = state.round
    state.aiTurnOrder = shuffle(candidates.map(inv => inv.seat), () => randomValue(state))
  }
  return state.aiTurnOrder.find(seat => candidates.some(inv => inv.seat === seat)) ?? candidates[0].seat
}

// ---------------------------------------------------------------------------
// 属性 / 被动加成（来自 card-effects.js 的 passive）
// ---------------------------------------------------------------------------

function assetEffect(inv, asset) {
  if (inv.threat?.some(item => item.code === '02088') && cardDef(asset?.code)?.traits?.includes('Ally')) return {}
  return EFFECTS[asset?.code]
}
function controlledAbilityCards(inv) { return [...inv.assets, ...(inv.threat || [])] }
function controlledAbilityCard(inv, id) { return controlledAbilityCards(inv).find(card => card.id === id) }
const LOLA_ROLES = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral']
function lolaCanUseCard(inv, code) {
  if (inv.code !== '03006') return true
  const def = cardDef(code)
  const factions = def?.factions || [def?.klass, def?.klass2, def?.klass3].filter(Boolean)
  return factions.includes('neutral') || factions.includes(inv.role)
}
function chooseLolaRole(state, inv, source, prompt, allowSame = false) {
  const roles = LOLA_ROLES.filter(role => allowSame || role !== inv.role)
  const role = requestChoice(state, { kind: 'role', source, seat: inv.seat, prompt,
    options: roles.map(id => ({ id, label: CLASS_NAMES[id] || id })) })
  inv.role = role
  return role
}

function runtimeCardAvailable(state, inv, code) {
  const signatures = cardDef(code)?.signatureFor || []
  return isCardAvailable(code) || signatures.includes(inv.code)
    || scenarioBehavior(state).canPlayScenarioCard?.(state, inv, code) === true
}

export function getStat(state, inv, skill, skipSubstitute) {
  let v = inv[skill] || 0
  if (inv.handlingEncounter?.bonus) v += inv.handlingEncounter.bonus
  for (const a of inv.assets) {
    const eff = assetEffect(inv, a)
    if (eff && eff.passive && eff.passive.stats && eff.passive.stats[skill]) v += eff.passive.stats[skill]
    if (eff?.passive?.allStatsIfNoResources && inv.resources === 0) v += eff.passive.allStatsIfNoResources
    const conditional = eff?.passive?.conditionalStats
    if (conditional && (conditional.doomAtLeast == null || (a.doom || 0) >= conditional.doomAtLeast)
      && (conditional.resourcesAtLeast == null || inv.resources >= conditional.resourcesAtLeast)
      && (conditional.remainingSanityAtMost == null
        || getMaxSanity(inv) - inv.horror <= conditional.remainingSanityAtMost)) {
      v += conditional.stats?.[skill] || 0
    }
    if (eff?.passive?.statsPerAssetHorror) v += (a.horror || 0) * eff.passive.statsPerAssetHorror
    if (a.statOverride?.includes(skill)) v = Math.max(v, 6)
    if (a.code === '03009' && inv.damage >= 5) v -= 1
  }
  for (const t of inv.threat) {
    const threat = getThreatEffect(t)
    const mods = threat?.mods
    if (mods && mods.allSkills) v += mods.allSkills
    v += threat?.statModifiers?.[skill] || 0
  }
  if (inv.phaseStatBonus && inv.phaseStatBonus.skill === skill) v += inv.phaseStatBonus.amount
  for (const bonus of inv.phaseStatBonuses || []) {
    if (bonus.round === state.round && bonus.phase === state.phase && bonus.skill === skill) v += bonus.amount
  }
  if (inv.fightOrFlight?.round === state.round && ['combat', 'agility'].includes(skill)) v += inv.fightOrFlight.amount || 0
  if (skill === 'combat' && litaAuraAt(state, inv)) v += 1
  v += scenarioBehavior(state).statModifier?.(state, inv, skill) || 0
  const substitute = inv.skillSubstitute
  if (!skipSubstitute && substitute && substitute.round === state.round
      && substitute.from.includes(skill) && substitute.to !== skill) {
    v = Math.max(v, getStat(state, inv, substitute.to, true))
  }
  return v
}

function litaAuraAt(state, inv) {
  return state.investigators.some((i) => {
    if (i.location !== inv.location || i.defeated || i.resigned) return false
    return i.assets.some((a) => a.code === '01117') && !i.threat.some(t => t.code === '02088')
  })
}

function assetPassiveBonus(inv, key) {
  return (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.[key] || 0), 0)
}

function assetCannotLeavePlay(asset) {
  return Boolean(asset?.cannotLeavePlay || EFFECTS[asset?.code]?.cannotLeavePlay)
}

function getMaxHealth(inv) {
  return Math.max(0, inv.maxHealth + assetPassiveBonus(inv, 'healthBonus'))
}

export function getMaxSanity(inv) {
  return Math.max(0, inv.maxSanity + assetPassiveBonus(inv, 'sanityBonus')
    + (inv.assets || []).reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0)
    + inv.threat.reduce((sum, card) => sum + (getThreatEffect(card)?.sanityModifier || 0), 0))
}

function extraActionBonus(inv) {
  return (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraAction || 0), 0)
}

function investigateBonus(inv) {
  return (inv.assets || []).reduce((sum, asset) => {
    const passive = assetEffect(inv, asset)?.passive
    return sum + (passive?.investigateBonus || 0) + (inv.clues === 0 ? passive?.investigateBonusIfNoClues || 0 : 0)
  }, 0)
}

function getHandSize(state, inv) {
  let v = HAND_SIZE_BASE
  if (state.phase === 'upkeep' && state.agendas[state.agendaIndex]?.originalCode === '02043') v -= 3
  for (const a of inv.assets) {
    const eff = assetEffect(inv, a)
    if (eff && eff.passive && eff.passive.handSizeBonus) v += eff.passive.handSizeBonus
  }
  for (const card of inv.threat) v += getThreatEffect(card)?.handSizeModifier || 0
  return v
}

function iconValue(code, skill) {
  const c = cardDef(code)
  if (!c || !c.icons) return 0
  return (c.icons[skill] || 0) + (c.icons.wild || 0)
}

// 当前密谋的被动（地底噬魔密谋 2：所有敌人 +1 攻击 +1 躲避）。
function enemyStatMods(state) {
  const ag = state.agendas[state.agendaIndex]
  return (ag && ag.passive) || {}
}

function enemyTextBlanked(state, enemy) {
  const blank = enemy && enemy.textBlanked
  return !!(blank && blank.round === state.round && blank.phase === state.phase)
}

export function enemyFightValue(state, enemy, inv) {
  let value = enemy.fight + (enemyStatMods(state).enemyFight || 0)
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'fight') || 0
  if (enemy.code === 'screechingByakhee' && enemy.engagedSeat != null && getMaxSanity(state.investigators[enemy.engagedSeat]) - state.investigators[enemy.engagedSeat].horror <= 4 && !enemyTextBlanked(state, enemy)) value += 1
  const reduction = enemy.fightReduction
  if (reduction && reduction.round === state.round && reduction.phase === state.phase) value = Math.max(0, value - (reduction.amount || 0))
  return value
}

export function enemyEvadeValue(state, enemy, inv) {
  let value = enemy.evade + (enemyStatMods(state).enemyEvade || 0)
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'evade') || 0
  if (enemy.code === 'screechingByakhee' && enemy.engagedSeat != null && getMaxSanity(state.investigators[enemy.engagedSeat]) - state.investigators[enemy.engagedSeat].horror <= 4 && !enemyTextBlanked(state, enemy)) value += 1
  return value
}

// ---------------------------------------------------------------------------
// 槽位系统
// ---------------------------------------------------------------------------

function normalizedSlots(card) {
  if (!card || !Array.isArray(card.slots) || !card.slots.length) return []
  return card.slots.map((s) => {
    const key = String(s).trim().toLowerCase()
    if (key === 'hand x2') return 'handx2'
    if (key === 'arcane x2') return 'arcanex2'
    return key
  })
}

function slotUsage(inv) {
  const usage = {}
  for (const a of [...inv.assets, ...(inv.threat || [])]) {
    const def = cardDef(a.code)
    for (const s of normalizedSlots(Array.isArray(a.slots) && a.slots.length ? a : def)) {
      if (s === 'handx2') usage.hand = (usage.hand || 0) + 2
      else if (s === 'arcanex2') usage.arcane = (usage.arcane || 0) + 2
      else usage[s] = (usage[s] || 0) + 1
    }
  }
  return usage
}

function canEquip(inv, card) {
  const need = {}
  for (const s of normalizedSlots(card)) {
    if (s === 'handx2') need.hand = (need.hand || 0) + 2
    else if (s === 'arcanex2') need.arcane = (need.arcane || 0) + 2
    else need[s] = (need[s] || 0) + 1
  }
  const usage = slotUsage(inv)
  // Allocate Tomes to Daisy's restricted slots before counting ordinary hands.
  // Otherwise playing a non-Tome after two books incorrectly forces a discard.
  const tomeHands = [...inv.assets, ...(inv.threat || []), { code: card.code }]
    .reduce((n, item) => {
      const def = cardDef(item.code)
      return n + (isTomeCard(def) ? normalizedSlots(def).reduce((v, slot) => v + (slot === 'handx2' ? 2 : slot === 'hand' ? 1 : 0), 0) : 0)
    }, 0)
  const restrictedHands = inv.assets.filter(a => a.code === '01008').length * 2
  for (const [s, n] of Object.entries(need)) {
    let cap = SLOT_CAPACITY[s] ?? 0
    if (s === 'hand') {
      cap += handSlotsBonusFor(inv, card) + Math.min(tomeHands, restrictedHands)
      // Bandolier: an extra hand slot that may only hold a [[Weapon]] asset.
      if (isWeaponCard(card)) cap += weaponHandSlotsFor(inv)
    }
    cap += (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraSlots?.[s] || 0), 0)
    if ((usage[s] || 0) + n > cap) return false
  }
  return true
}

function assetReplacementPlans(inv, card) {
  if (canEquip(inv, card)) return [[]]
  const assets = inv.assets.filter(asset => !cardDef(asset.code)?.permanent && !assetEffect(inv, asset)?.cannotDiscard)
  const plans = []
  const visit = (index, removed) => {
    if (plans.some(plan => plan.every(id => removed.includes(id)))) return
    if (canEquip({ ...inv, assets: inv.assets.filter(a => !removed.includes(a.id)) }, card)) {
      plans.push(removed); return
    }
    for (let i = index; i < assets.length; i++) visit(i + 1, [...removed, assets[i].id])
  }
  visit(0, [])
  return plans
}

function replaceAssets(state, inv, card, events) {
  let plans = assetReplacementPlans(inv, card)
  if (!plans.length) throw new Error('没有合法的槽位替换方案')
  const removed = []
  while (!plans.some(plan => plan.length === removed.length)) {
    const ids = [...new Set(plans.flat())].filter(id => !removed.includes(id))
    const id = requestChoice(state, { kind: 'assetReplacement', source: card.code, seat: inv.seat,
      prompt: `为「${cardName(card.code)}」腾出槽位，选择弃置资产。`,
      options: ids.map(id => ({ id, label: `弃置 ${cardName(inv.assets.find(a => a.id === id).code)}` })) })
    removed.push(id)
    plans = plans.filter(plan => removed.every(id => plan.includes(id)))
  }
  for (const asset of inv.assets.filter(a => removed.includes(a.id))) {
    leaveAsset(state, inv, asset, events)
    if (!asset.removedFromGame) inv.discard.push(asset.code)
    releaseChaosTokens(state, asset.id)
    info(state, events, `${inv.name} 弃置「${cardName(asset.code)}」腾出槽位。`)
  }
  inv.assets = inv.assets.filter(a => !removed.includes(a.id))
}

function isTomeCard(card) {
  return (card?.traits || []).some(trait => {
    const key = String(trait).toLowerCase()
    return key === 'tome' || String(trait) === '书籍'
  })
}

function handSlotsBonusFor(inv, card) {
  let v = -(inv.handSlotsPenalty || 0)
  for (const a of inv.assets) {
    const eff = assetEffect(inv, a)
    if (a.code === '01008') {
      continue
    }
    if (eff && eff.passive && eff.passive.handSlotsBonus) v += eff.passive.handSlotsBonus
  }
  return v
}

function isWeaponCard(card) {
  return (card?.traits || []).some(trait => {
    const key = String(trait).toLowerCase()
    return key === 'weapon' || String(trait) === '武器'
  })
}

function weaponHandSlotsFor(inv) {
  return (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraSlots?.handWeapon || 0), 0)
}

// ---------------------------------------------------------------------------
// 抽牌 / 抽遭遇牌
// ---------------------------------------------------------------------------

function drawCards(state, inv, n, events) {
  const texts = []
  let reshuffles = 0
  for (let i = 0; i < n; i++) {
    if (inv.deck.length === 0) {
      if (inv.discard.length === 0 || discardLocked(state, inv)) continue
      const rng = () => randomValue(state)
      inv.deck = shuffle(inv.discard, rng)
      inv.discard = []
      reshuffles++
    }
    const code = inv.deck.pop()
    const def = cardDef(code)
    if (isWeaknessCard(def)) {
      texts.push(`⚠️ ${inv.name} 抽到了弱点「${cardName(code)}」：${def.textZh || def.text || ''}`)
      if (def.code === '01013') {
        inv.hand.push(code)
        texts.push('黑暗回忆留在手中；可支付费用打出，否则每回合结束受到 2 恐惧。')
      } else {
        resolveWeakness(state, inv, def, events, texts)
        if (inv.shuffleWeaknessAfterResolution === code) {
          delete inv.shuffleWeaknessAfterResolution
          inv.deck = shuffle([...inv.deck, code], () => randomValue(state))
        } else if (def.type !== 'enemy' && !isThreatWeakness(def.code)
          && !['attachedEnemy', 'attachedLocation'].includes(EFFECTS[code]?.weakness?.type)) {
          // Attached weaknesses go to the discard pile when they detach.
          inv.discard.push(code)
        }
      }
    } else {
      inv.hand.push(code)
      texts.push(`${inv.name} 抽取了 1 张牌。`)
      scenarioBehavior(state).cardDrawn?.(state, inv, code, scenarioRuntime(state, events))
    }
    scenarioBehavior(state).deckEmptied?.(state, inv, scenarioRuntime(state, events))
    if (inv.defeated) break
  }
  for (let i = 0; i < reshuffles; i++) {
    texts.push(`${inv.name} 重新混洗弃牌堆，抽牌结束后受到 1 点恐惧。`)
    applyHorror(state, inv, 1, events)
  }
  return texts
}

function isThreatWeakness(code) {
  const eff = EFFECTS[code]
  return !!(eff && eff.weakness && eff.weakness.type === 'threat')
}

function resolveWeakness(state, inv, def, events, texts) {
  if (def.code === '02178') { scenarioRuntime(state, events).discardTop(inv.seat, 3); return }
  if (def.code === '02007') {
    let enemyCode = null
    while (state.encounterDeck.length && !enemyCode) {
      const code = state.encounterDeck.pop()
      if (enemyDef(code)) enemyCode = code
      else state.encounterDiscard.push(code)
    }
    if (!enemyCode) { inv.discard.push(def.code); return }
    const distances = state.locations.map(loc => ({ id: loc.id, distance: distanceToInvestigator(state, loc.id, [inv]) }))
    const farthest = Math.max(...distances.filter(item => Number.isFinite(item.distance)).map(item => item.distance))
    const choices = distances.filter(item => item.distance === farthest)
    const location = choices.length === 1 ? choices[0].id : requestChoice(state, {
      kind: 'location', source: def.code, seat: inv.seat, prompt: '选择距离你最远的地点，生成被惩戒敌人。',
      options: choices.map(item => ({ id: item.id, label: locName(state, item.id) })),
    })
    const enemy = spawnEnemy(state, enemyCode, location, null)
    if (enemy) { enemy.smiteTheWickedSeat = inv.seat; info(state, events, `「惩戒邪恶」附着于 ${enemy.name}。`) }
    return
  }
  if (def.code === '02011') {
    const distances = state.locations.map(loc => ({ id: loc.id, distance: distanceToInvestigator(state, loc.id, [inv]) }))
    const farthest = Math.max(...distances.filter(item => Number.isFinite(item.distance)).map(item => item.distance))
    const choices = distances.filter(item => item.distance === farthest)
    const location = choices.length === 1 ? choices[0].id : requestChoice(state, {
      kind: 'location', source: def.code, seat: inv.seat, prompt: '选择距离你最远的地点，放置「寻找伊兹」。',
      options: choices.map(item => ({ id: item.id, label: locName(state, item.id) })),
    })
    const loc = state.locations.find(item => item.id === location)
    if (loc) { loc.searchingForIzzieSeat = inv.seat; info(state, events, `「寻找伊兹」附着于 ${loc.name}。`) }
    return
  }
  if (def.code === '02013') {
    beginChaosTest(state)
    const tokens = Array.from({ length: Math.min(5, state.chaosBag.length) }, () => drawChaosToken(state))
    endChaosTest(state, tokens)
    const harm = tokens.filter(token => token === 'skull' || token === 'autofail').length
    if (harm) applyHarm(state, inv, harm, harm, events)
    info(state, events, `最终狂想曲揭示 ${tokens.map(tokenLabel).join('、')}；${inv.name} 受到 ${harm} 点伤害和 ${harm} 点恐惧。`)
    return
  }
  if (def.type === 'enemy') {
    let location = inv.location
    if (def.code === '03042') {
      const distances = state.locations.map(loc => ({ id: loc.id, distance: distanceToInvestigator(state, loc.id, [inv]) }))
      const farthest = Math.max(...distances.filter(item => Number.isFinite(item.distance)).map(item => item.distance))
      const choices = distances.filter(item => item.distance === farthest)
      if (choices.length) location = choices.length === 1 ? choices[0].id : requestChoice(state, {
        kind: 'location', source: def.code, seat: inv.seat, prompt: '选择距离你最远的地点生成随行鬼影。',
        options: choices.map(item => ({ id: item.id, label: locName(state, item.id) })),
      })
    }
    const enemy = spawnEnemy(state, def.code, location, inv.seat)
    if (enemy) info(state, events, `👹 弱点敌人「${enemy.name}」出现并与 ${inv.name} 交战！`)
    return
  }
  const eff = EFFECTS[def.code]
  if (!eff || !eff.weakness) throw new Error(`未实现的弱点效果：${def.code}`)
  if (eff.weakness.type === 'shellShock') {
    const amount = Math.floor(inv.damage / 2)
    applyHorror(state, inv, amount, events)
    info(state, events, `「${cardName(def.code)}」：${inv.name} 受到 ${amount} 点恐惧。`)
    return
  }
  if (eff.weakness.type === 'crisisOfIdentity') {
    const role = inv.role
    for (const asset of inv.assets.slice()) {
      const factions = cardDef(asset.code)?.factions || [cardDef(asset.code)?.klass].filter(Boolean)
      if (!factions.includes(role) || assetCannotLeavePlay(asset)) continue
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
    }
    const top = inv.deck.pop()
    if (top) inv.discard.push(top)
    const topDef = cardDef(top)
    inv.role = !topDef || isWeaknessCard(topDef) ? 'neutral'
      : (topDef.factions || [topDef.klass, topDef.klass2, topDef.klass3].filter(Boolean))[0] || 'neutral'
    info(state, events, `「${cardName(def.code)}」弃置了当前角色支援，并将角色切换为${CLASS_NAMES[inv.role] || inv.role}。`)
    return
  }
  if (eff.weakness.type === 'starsOfHyades') {
    const shouldShuffle = inv.deck.length >= 5
    if (inv.beneath?.length) {
      const index = Math.floor(randomValue(state) * inv.beneath.length)
      const removed = inv.beneath.splice(index, 1)[0]
      state.removedFromGame ||= []
      state.removedFromGame.push(removed)
      info(state, events, `「${cardName(def.code)}」随机将赛菲娜下方的「${cardName(removed)}」移出游戏。`)
    } else {
      applyHarm(state, inv, 1, 1, events)
    }
    if (shouldShuffle) inv.shuffleWeaknessAfterResolution = def.code
    return
  }
  if (eff.weakness.type === 'threat') {
    if (def.code === '02015') for (const asset of inv.assets) asset.exhausted = true
    if (def.type === 'asset') replaceAssets(state, inv, def, events)
    if (eff.weakness.clues != null) {
      inv.threat.push(newCardInstance(state, def.code, { counters: eff.weakness.clues }))
    } else if (eff.weakness.horror != null) {
      inv.threat.push(newCardInstance(state, def.code, { counters: eff.weakness.horror }))
    } else if (eff.weakness.debt) {
      inv.threat.push(newCardInstance(state, def.code, { resources: eff.weakness.resources || 0, debtPaymentsThisRound: 0 }))
    } else {
      inv.threat.push(newCardInstance(state, def.code, eff.weakness.initialUses == null ? {}
        : { uses: eff.weakness.initialUses, usesType: eff.weakness.usesType || 'charges', exhausted: false }))
    }
    info(state, events, `⚠️ 「${cardName(def.code)}」进入 ${inv.name} 的威胁区域。`)
    return
  }
  if (eff.weakness.effects) {
    for (const fx of eff.weakness.effects) resolveEffect(state, inv.seat, fx, makeRuntime(state, events))
  } else {
    resolveEffect(state, inv.seat, eff.weakness, makeRuntime(state, events))
  }
  checkDefeated(state, inv.seat, events)
}

function discardRandomFromHand(state, inv, n, events) {
  for (let i = 0; i < n; i++) {
    const candidates = inv.hand.map((code, index) => ({ code, index }))
      .filter(item => canDiscardFromHand(inv, item.code))
    if (!candidates.length) break
    const chosen = candidates[Math.floor(randomValue(state) * candidates.length)]
    const code = inv.hand.splice(chosen.index, 1)[0]
    inv.discard.push(code)
    info(state, events, `${inv.name} 弃掉了「${cardName(code)}」。`)
  }
}

function leaveAsset(state, inv, asset, events = []) {
  if (!inv.assets.includes(asset)) return
  removeOne(inv.assets, asset)
  releaseChaosTokens(state, asset.id)
  const mill = EFFECTS[asset.code]?.millOnLeave
  if (mill) {
    const discarded = []
    for (let index = 0; index < mill && inv.deck.length; index++) discarded.push(inv.deck.pop())
    if (discarded.length) {
      inv.discard.push(...discarded)
      info(state, events, `「${cardName(asset.code)}」离场：${inv.name} 弃掉牌库顶 ${discarded.length} 张牌。`)
    }
  }
  scenarioBehavior(state).assetLeftPlay?.(state, inv, asset, scenarioRuntime(state, events))
}

function discardRandomAsset(state, inv, events) {
  const candidates = inv.assets.filter(asset => !assetCannotLeavePlay(asset))
  if (!candidates.length) { info(state, events, `${inv.name} 没有可弃置的资产。`); return }
  const id = requestChoice(state, { kind: 'discard-asset', source: 'discard-asset', seat: inv.seat,
    prompt: '选择一件要弃置的资产。', options: candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
  const a = candidates.find(asset => asset.id === id)
  leaveAsset(state, inv, a, events)
  if (!a.removedFromGame) inv.discard.push(a.code)
  info(state, events, `${inv.name} 弃掉了资产「${cardName(a.code)}」。`)
}

function drawEncounter(state, inv, events) {
  if (state.encounterDeck.length === 0) {
    if (state.encounterDiscard.length === 0) return
    state.encounterDeck = shuffle(state.encounterDiscard, () => randomValue(state))
    state.encounterDiscard = []
  }
  const code = state.encounterDeck.pop()
  const encounter = ALL_ENEMIES[code] || ALL_TREACHERIES[code]
  const redrawContext = { when: 'encounterDrawn', seat: inv.seat, location: inv.location, cardCode: code,
    weakness: isWeaknessCode(code), peril: !!encounter?.peril, cancelled: false,
    prompt: `${inv.name} 抽到「${encounter?.name || code}」` }
  for (const owner of aliveInvestigators(state).filter(owner => owner.location === inv.location)) {
    triggerReaction(state, owner.seat, 'encounterDrawn', events, redrawContext)
    if (redrawContext.cancelled) break
  }
  if (!redrawContext.cancelled) reactionWindow(state, 'encounterDrawn', redrawContext, events)
  if (redrawContext.cancelled) {
    state.encounterDiscard.push(code)
    const cancelledName = encounter?.hidden ? '一张隐私遭遇卡' : `「${encounter?.name || code}」`
    if (redrawContext.redraw) {
      info(state, events, `${cancelledName}被取消并弃置，${inv.name} 重新抽取遭遇卡。`)
      return drawEncounter(state, inv, events)
    }
    info(state, events, `${cancelledName}的显现效果被取消并弃置。`)
    return
  }
  const resolvingInv = redrawContext.redirectSeat == null ? inv : state.investigators[redrawContext.redirectSeat]
  if (redrawContext.redirectSeat != null) resolvingInv.handlingEncounter = { code, bonus: 2 }
  scenarioBehavior(state).encounterDrawn?.(state, resolvingInv, code, scenarioRuntime(state, events))
  if (encounter?.hidden) {
    info(state, events, `${resolvingInv.name} 翻开了一张隐私遭遇卡。`, {
      kind: 'automatic', phase: state.phase, round: state.round, text: `${resolvingInv.name} 遭遇一张隐私牌`,
      effect: 'encounter', seat: resolvingInv.seat, location: resolvingInv.location,
    })
  } else {
    info(state, events, `${resolvingInv.name} 翻开遭遇卡「${encounter?.name || code}」。`, {
      kind: 'automatic', phase: state.phase, round: state.round, text: `${resolvingInv.name} 遭遇「${encounter?.name || code}」`,
      code: encounter?.originalCode || code, name: encounter?.name, effect: 'encounter', seat: resolvingInv.seat, location: resolvingInv.location,
    })
  }
  if (ALL_ENEMIES[code]) {
    const def = enemyDef(code)
    // 带固定生成地点的敌人在该地点生成，否则与抽牌者交战；「任意无人地点」敌人去无人地点。
    let engage = null
    let loc = resolvingInv.location
    if (def.spawnAnyEmpty) {
      const empty = state.locations.filter((l) => !state.enemies.some((e) => e.location === l.id)
        && !aliveInvestigators(state).some(i => i.location === l.id))
      const picked = chooseAmong(state, {
        kind: 'spawn', source: { type: 'enemy', code }, seat: leadDecisionSeat(state),
        prompt: `选择「${def.name}」的生成地点（任意无人地点）。`,
        options: empty.map((l) => ({ id: l.id, label: l.name })),
      })
      if (!picked) { state.encounterDiscard.push(code); return }
      loc = picked
    } else if (def.spawn) {
      if (!locationExists(state, def.spawn)) { state.encounterDiscard.push(code); return }
      loc = def.spawn
    } else {
      engage = resolvingInv.seat
    }
    const enemy = spawnEnemy(state, code, loc, engage)
    if (enemy) info(state, events, `👹 ${resolvingInv.name} 遭遇了「${enemy.name}」！它出现在「${locName(state, enemy.location)}」${enemy.engagedSeat != null ? '并与之交战' : ''}。`)
    if (enemy) autoEngageAt(state, enemy.location, events)
  } else if (ALL_TREACHERIES[code]) {
    const resolution = resolveTreachery(state, resolvingInv, ALL_TREACHERIES[code], events)
    // Older campaign handlers may already perform their printed surge; the marker prevents a second draw.
    const placed = typeof resolution === 'object' ? resolution.placed : resolution
    if (!placed) state.encounterDiscard.push(code)
    const surge = encounter.surge || scenarioBehavior(state).encounterGainsSurge?.(state, code)
    if (surge && !resolution?.surgeHandled && !resolvingInv.defeated && !resolvingInv.resigned) {
      info(state, events, `🌀 「${encounter.name || code}」涌动：再抽取一张遭遇牌。`)
      drawEncounter(state, resolvingInv, events)
    }
  } else if (ALL_CARDS[code]?.type === 'asset' && scenarioBehavior(state).drawStoryAsset) {
    scenarioBehavior(state).drawStoryAsset(state, resolvingInv, code, scenarioRuntime(state, events))
  } else if (ALL_CARDS[code]?.type === 'location' && scenarioBehavior(state).drawLocation) {
    scenarioBehavior(state).drawLocation(state, resolvingInv.seat, code, scenarioRuntime(state, events))
  } else throw new Error(`未知遭遇卡：${code}`)
  delete resolvingInv.handlingEncounter
}

// 快速反应窗口：同地点持有对应反应事件的调查员可显式打出（如闪躲、守护结界）。
// 返回上下文；context.cancelled 为真表示本次结算被取消。
function reactionWindow(state, when, context, events) {
  if (state._reaction) return context
  for (const inv of aliveInvestigators(state)) {
    if (context.peril && inv.seat !== context.seat) continue
    while (!context.cancelled) {
      const discardEvent = topDiscardEvent(state, inv)
      const handCandidates = inv.hand.flatMap((code, index) => code === '03012'
        ? (inv.beneath || []).flatMap(copyCode => {
          const copied = cardDef(copyCode)
          return copied?.type === 'event' && !copied.exceptional && EFFECTS[copyCode]?.reaction
            ? [{ code, copyCode, index, id: `${index}:${copyCode}` }] : []
        })
        : [{ code, index, id: String(index) }])
      const planCandidates = inv.assets.filter(asset => asset.code === '03264' && !asset.exhausted)
        .flatMap(asset => (asset.attached || []).map((code, index) =>
          ({ code, index, fromPlanAssetId: asset.id, id: `plan:${asset.id}:${index}` })))
      const candidates = [...handCandidates,
        ...planCandidates,
        ...(discardEvent ? [{ code: discardEvent, fromDiscard: true, id: 'discard' }] : [])]
        .filter(({ code, copyCode }) => {
          const eff = EFFECTS[copyCode || code]
          if (!eff || eff.reaction?.when !== when || !runtimeCardAvailable(state, inv, code)) return false
          if (!lolaCanUseCard(inv, code)) return false
          if (!eff.reaction.anyLocation && context.location != null && inv.location !== context.location) return false
          if (eff.reaction.selfOnly && inv.seat !== context.seat) return false
          if (eff.reaction.otherInvestigator && inv.seat === context.seat) return false
          if (eff.reaction.nonPerilOnly && context.peril) return false
          if (eff.reaction.ownMythosOnly && inv.seat !== context.seat) return false
          if (eff.reaction.nonWeaknessOnly && (context.weakness || !context.cardCode || isWeaknessCode(context.cardCode))) return false
          if (eff.reaction.nonElite && context.enemy?.elite) return false
          if (eff.reaction.nonEliteOnly && context.enemy?.elite) return false
          if (eff.reaction.treacheryOnly && context.cardCode
            && ALL_CARDS[context.cardCode]?.type !== 'treachery') return false
          if (eff.reaction.requiresClue
            && !(state.locations.find(location => location.id === context.location)?.clues > 0)) return false
          if (eff.reaction.requiresNoClues && inv.clues > 0) return false
          if (eff.reaction.nonWeakness && context.enemy && isWeaknessCode(context.enemy.code)) return false
          if (eff.reaction.failedByAtMost != null && (context.failedBy || 0) > eff.reaction.failedByAtMost) return false
          if (eff.reaction.successByAtLeast != null && (context.successBy || 0) < eff.reaction.successByAtLeast) return false
          if (cannotPlayTypes(inv).has(cardDef(copyCode || code)?.type)) return false
          if (scenarioBehavior(state).canPlayCard?.(state, inv, cardDef(copyCode || code)) === false) return false
          if (inv.resources < playCost(state, inv, cardDef(copyCode || code))) return false
          return !effectError(state, inv, eff.event)
        })
      if (!candidates.length) break
      const answer = requestChoice(state, {
        kind: 'reaction', source: { type: 'window', when }, seat: inv.seat, canSkip: true,
        prompt: `是否打出快速反应卡？（${context.prompt}）`,
        options: [{ id: 'skip', label: '不打出' },
          ...candidates.map(({ code, copyCode, id, fromDiscard }) => ({ id, cardCode: code,
            label: (copyCode ? `彩绘世界复制「${cardName(copyCode)}」` : cardName(code))
              + (fromDiscard ? '（护身符：弃牌）' : '') }))],
      })
      if (answer === 'skip') break
      const chosen = candidates.find(item => item.id === answer)
      playReactionCard(state, inv, chosen.index, context, events, chosen.fromDiscard, chosen.copyCode, chosen.fromPlanAssetId)
    }
  }
  return context
}

function discardLocked(state, inv) {
  return state.enemies.some(enemy => enemy.code === '03017' && enemy.engagedSeat === inv.seat && !enemyTextBlanked(state, enemy))
}

function topDiscardEvent(state, inv) {
  return inv.assets.some(a => a.code === '01014') && !discardLocked(state, inv)
    ? inv.discard.findLast(code => cardDef(code)?.type === 'event') : null
}

function disposePlayedEvent(inv, code) {
  if (inv.assets.some(a => a.code === '01014')) inv.deck.unshift(code)
  else inv.discard.push(code)
}

function consumePlayThreatResources(state, inv, events) {
  for (const threat of inv.threat.slice()) {
    if (!getThreatEffect(threat)?.consumeResourceAfterPlay) continue
    threat.resources = Math.max(0, (threat.resources || 0) - 1)
    if (threat.resources === 0) {
      removeOne(inv.threat, threat)
      state.encounterDiscard.push(threat.code)
      info(state, events, `「${cardName(threat.code)}」上的资源耗尽并被弃掉。`)
    }
  }
}

function playReactionCard(state, inv, index, context, events, fromDiscard = false, copyCode = null, fromPlanAssetId = null) {
  const plan = fromPlanAssetId && inv.assets.find(asset => asset.id === fromPlanAssetId && asset.code === '03264')
  const code = plan ? plan.attached.splice(index, 1)[0]
    : fromDiscard ? inv.discard.splice(inv.discard.lastIndexOf(topDiscardEvent(state, inv)), 1)[0] : inv.hand.splice(index, 1)[0]
  if (plan) plan.exhausted = true
  const def = cardDef(copyCode || code)
  inv.resources -= playCost(state, inv, def)
  consumePlayThreatResources(state, inv, events)
  info(state, events, `⚡ ${inv.name} 快速打出「${copyCode ? `彩绘世界／${cardName(copyCode)}` : cardName(code)}」。`, { kind: 'play', seat: inv.seat, code })
  state._reaction = context
  try {
    resolveEffect(state, inv.seat, EFFECTS[copyCode || code].event, makeRuntime(state, events))
  } finally {
    delete state._reaction
  }
  if (copyCode && code === '03012') {
    state.removedFromGame ||= []
    state.removedFromGame.push(code)
  } else if (context.eventToVictory === code) {
    state.victoryDisplay.push({ id: nextInstanceId(state, 'c'), code, originalCode: code, victory: cardDef(code)?.victory || 0 })
  } else disposePlayedEvent(inv, code)
}

// 敌人攻击统一入口：先开反应窗口，再结算伤害与恐惧。
function enemyAttack(state, enemy, inv, events, label) {
  if (!enemyTextBlanked(state, enemy) && enemy.code === 'wolfManDrew') enemy.damageTaken = Math.max(0, enemy.damageTaken - 1)
  const context = reactionWindow(state, 'enemyAttack',
    { when: 'enemyAttack', seat: inv.seat, location: inv.location, enemy, prompt: `「${enemy.name}」攻击 ${inv.name}` }, events)
  if (context.cancelled) {
    info(state, events, `「${enemy.name}」对 ${inv.name} 的攻击被取消。`)
    return false
  }
  let extraDamage = 0
  let extraHorror = 0
  if (!enemyTextBlanked(state, enemy)) scenarioBehavior(state).enemyAttackStarted?.(state, enemy, inv, scenarioRuntime(state, events))
  const attackBonus = scenarioBehavior(state).enemyAttackModifier?.(state, enemy, inv) || {}
  extraDamage += attackBonus.damage || 0
  extraHorror += attackBonus.horror || 0
  if (!enemyTextBlanked(state, enemy) && enemy.code === 'yithianObserver') {
    if (inv.hand.length) discardRandomFromHand(state, inv, 1, events)
    else { extraDamage = 1; extraHorror = 1; info(state, events, `🧠 ${inv.name} 无手牌可弃，「${enemy.name}」的伤害和恐惧各 +1。`) }
  }
  const adjusted = scenarioBehavior(state).beforeEnemyHarm?.(state, enemy, inv,
    { damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror }, scenarioRuntime(state, events))
  if (adjusted?.horror != null) extraHorror = adjusted.horror - enemy.horror
  const attackText = label || `🗡️ 「${enemy.name}」攻击 ${inv.name}：${enemy.damage + extraDamage} 点伤害、${enemy.horror + extraHorror} 点恐惧。`
  info(state, events, attackText, { kind: 'attack', direction: 'incoming', phase: state.phase, round: state.round,
    code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code, name: enemy.name, text: attackText,
    effect: 'attack', seat: inv.seat, enemyId: enemy.id, location: inv.location, damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror })
  if (!inv.defeated && !tryAquinnahRedirect(state, enemy, inv, events, extraDamage, extraHorror)) {
    applyHarm(state, inv, enemy.damage + extraDamage, enemy.horror + extraHorror, events, false, { enemy, location: inv.location })
  }
  scenarioBehavior(state).enemyAttackResolved?.(state, enemy, inv, scenarioRuntime(state, events))
  if (inv.defeated) checkOutcome(state, events)
  if (!enemyTextBlanked(state, enemy) && enemy.forcedDoom) {
    // "Place 1 doom on the current agenda" goes through the agenda clock, so it
    // must be able to advance the agenda immediately.
    info(state, events, `「${enemy.name}」攻击后，在密谋上放置 1 点毁灭。`)
    addDoom(state, 1, events)
  }
  return true
}

function chooseAttack(state, inv, enemies, timing) {
  if (enemies.length === 1) return enemies[0]
  const id = requestChoice(state, { kind: 'attackOrder', source: timing, seat: inv.seat,
    prompt: '选择下一名攻击的敌人；攻击结算后可重新决定余下顺序。',
    options: enemies.map(enemy => ({ id: enemy.id, label: `${enemy.name}：${enemy.damage} 伤害／${enemy.horror} 恐惧` })) })
  return enemies.find(enemy => enemy.id === id)
}

const WINDOW_LABELS = {
  'test.beforeCommit': '检定开始、投入前', 'test.afterCommit': '投入结束、揭示标记前',
  'mythos.afterEncounter': '遭遇牌结算后', 'enemy.afterHunters': '猎手移动后、敌人攻击前',
  'enemy.afterAttacks': '敌人攻击结束', 'upkeep.end': '重整结束', 'investigation.afterAction': '行动结束',
}

function playerWindow(state, timing, events, restrictedSeat = null) {
  state.timingWindow = timing
  const participants = aliveInvestigators(state).filter(inv => restrictedSeat == null || inv.seat === restrictedSeat)
  let passed = 0
  let cursor = 0
  while (participants.length && passed < participants.length) {
    const inv = participants[cursor++ % participants.length]
    if (inv.defeated || inv.resigned) { passed++; continue }
    if (cannotTriggerFreeAbility(state, inv)) { passed++; continue }
    const options = []
    for (const asset of controlledAbilityCards(inv)) {
      for (const [index, ability] of (assetEffect(inv, asset)?.abilities || []).entries()) {
        if (ability.cost?.action !== false || !canAffordAbility(inv, asset, ability) || effectError(state, inv, ability.effect)) continue
        if (!lolaCanUseCard(inv, asset.code)) continue
        if (ability.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) continue
        const targets = abilityTargets(state, inv, ability.effect)
        for (const targetId of targets.length ? targets.map(target => target.id) : [null]) options.push({
          id: `${asset.id}:${index}:${targetId || ''}`, label: `${cardName(asset.code)}：${ability.label}`,
          assetId: asset.id, index, targetId,
        })
      }
    }
    if (!options.length) { passed++; continue }
    const answer = requestChoice(state, { kind: 'playerWindow', source: timing, seat: inv.seat,
      prompt: `${WINDOW_LABELS[timing] || timing}：可以使用免费触发能力，或让过。`, canSkip: true,
      options: [{ id: 'skip', label: '让过' }, ...options.map(({ id, label, assetId, index, targetId }) => ({ id, label, assetId, abilityIndex: index, targetId }))] })
    if (answer === 'skip') { passed++; continue }
    passed = 0
    const chosen = options.find(option => option.id === answer)
    doAbility(state, inv.seat, chosen.assetId, chosen.index, chosen.targetId, null, events)
  }
  state.timingWindow = null
}

function tryAquinnahRedirect(state, enemy, inv, events, extraDamage = 0, extraHorror = 0) {
  if (inv.threat.some(item => item.code === '02088')) return false
  const aquinnah = inv.assets.find(asset => ['01082', '02308'].includes(asset.code) && !asset.exhausted)
  if (!aquinnah) return false
  const candidates = state.enemies.filter(item => item.location === inv.location && item.id !== enemy.id)
  if (!candidates.length) return false
  const answer = requestChoice(state, { kind: 'reaction', source: aquinnah.id, seat: inv.seat, prompt: '是否横置安奎娜并放置 1 点恐惧，将这次攻击的伤害转移给另一个敌人？', canSkip: true, options: [{ id: 'skip', label: '正常承受攻击' }, { id: 'trigger', label: '转移伤害' }] })
  if (answer !== 'trigger') return false
  aquinnah.exhausted = true
  aquinnah.horror = (aquinnah.horror || 0) + 1
  if ((aquinnah.horror || 0) >= (cardDef(aquinnah.code)?.sanity || Infinity)) {
    leaveAsset(state, inv, aquinnah)
    inv.discard.push(aquinnah.code)
    info(state, events, `「安奎娜」恐惧达到上限并被弃掉。`)
  }
  const targetId = requestChoice(state, { kind: 'target', source: aquinnah.id, seat: inv.seat, prompt: '选择另一个敌人承受伤害。', options: candidates.map(item => ({ id: item.id, label: item.name })) })
  const target = candidates.find(item => item.id === targetId)
  if (target) {
    damageEnemy(state, target, enemy.damage + extraDamage, inv.seat, events)
    info(state, events, '安奎娜将「' + enemy.name + '」的 ' + enemy.damage + ' 点伤害转移给「' + target.name + '」。')
  }
  if (enemy.horror + extraHorror) applyHorror(state, inv, enemy.horror + extraHorror, events)
  return true
}

function resolveTreachery(state, inv, t, events) {
  if (t.hidden) {
    privateInfo(state, events, inv.seat, `🃏 你抽到隐私诡计「${t.name}」：${t.text || ''}`)
  } else {
    info(state, events, `🃏 ${inv.name} 抽到诡计「${t.name}」：${t.text || ''}`)
  }
  const context = reactionWindow(state, 'treachery',
    { when: 'treachery', seat: inv.seat, location: inv.location, cardCode: t.code, peril: !!t.peril,
      weakness: isWeaknessCard(t) || isWeaknessCode(t.code), prompt: `${inv.name} 抽到「${t.name}」` }, events)
  if (context.cancelled) {
    info(state, events, t.hidden ? '一张隐私诡计的显现效果被取消。' : `「${t.name}」的显现效果被取消。`)
    return
  }
  if (t.hidden) {
    placeHiddenCard(state, inv, t, events)
    return true
  }
  if (t.effect?.kind === 'campaignRule') return scenarioBehavior(state).resolveEncounter(state, inv, t, scenarioRuntime(state, events, { type: 'encounter', label: '诡计检定', code: t.originalCode || t.code }))
  if (t.rulesPending) throw new Error(`遭遇效果尚未迁移：${t.originalCode || t.code}`)
  if (t.threat) {
    inv.threat.push(newCardInstance(state, t.code))
    info(state, events, `「${t.name}」进入 ${inv.name} 的威胁区域。`)
    checkDefeated(state, inv.seat, events)
    return true
  }
  if (t.effect) {
    return resolveTreacheryEffect(state, inv, t.effect, events)
  }
  if (t.code === 'falseLead' && inv.clues === 0) {
    info(state, events, '🌀 「错误指示」获得涌动：再抽取一张遭遇牌。')
    drawEncounter(state, inv, events)
    return
  }
  if (t.test) {
    performTest(state, inv.seat, t.test.skill, t.test.difficulty, { source: { type: 'encounter', name: t.name, code: t.originalCode || t.code, label: '遭遇检定' }, peril: !!t.peril, resolve: r => {
      if (r.success) {
        info(state, events, `✔️ ${inv.name} 通过「${t.name}」检定（${SKILL_NAMES[t.test.skill]} ${r.value} vs ${t.test.difficulty}）。`)
      } else {
        const failedBy = Math.max(0, t.test.difficulty - r.value)
        info(state, events, `❌ ${inv.name} 未通过「${t.name}」检定（${SKILL_NAMES[t.test.skill]} ${r.value} vs ${t.test.difficulty}，低于 ${failedBy}）。`)
        applyPenalty(state, inv, t.fail, failedBy, events)
      }
    } })
  }
}

function resolveTreacheryEffect(state, inv, fx, events) {
  switch (fx.kind) {
    case 'addDoom': {
      state.doom += fx.amount
      info(state, events, `🌑 密谋上增加 ${fx.amount} 点毁灭（当前 ${state.doom}）。`)
      checkAgenda(state, events)
      break
    }
    case 'addFog': {
      state.fogMod = Math.max(state.fogMod, fx.amount || 2)
      info(state, events, `🌫️ 本回合调查难度 +${fx.amount || 2}。`)
      break
    }
    case 'attachShroud': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (loc && !loc.fog) {
        loc.shroudMod = (loc.shroudMod || 0) + fx.amount
        loc.fog = (loc.fog || 0) + 1
        loc.fogCode = loc.fogCode || 'obscuringFog'
        info(state, events, `🌫️ 「朦胧之雾」附着于「${loc.name}」，帷幕 +${fx.amount}。`)
        return true
      }
      break
    }
    case 'chooseCluesOrDamage': {
      const options = [{ id: 'damage', label: `受到 ${fx.damage} 伤害` }]
      if (canSpendClues(state, inv) && inv.clues >= fx.clues) options.push({ id: 'clues', label: `支付 ${fx.clues} 个人线索` })
      const answer = requestChoice(state, { kind: 'treachery', source: fx.kind, seat: inv.seat, prompt: '选择诡计效果。', options })
      if (answer === 'clues') spendClues(state, inv, fx.clues)
      else applyDamage(state, inv, fx.damage, events)
      break
    }
    case 'choosePowerOrHorror': {
      const answer = requestChoice(state, { kind: 'treachery', source: fx.kind, seat: inv.seat, prompt: '选择力量或恐惧。',
        options: [{ id: 'horror', label: `受到 ${fx.horror || 2} 恐惧` }, { id: 'power', label: `抽 ${fx.draw || 2} 张牌并放置毁灭` }] })
      if (answer === 'horror') applyHorror(state, inv, fx.horror || 2, events)
      else {
        for (const text of drawCards(state, inv, fx.draw || 2, events)) info(state, events, text)
        addDoom(state, fx.doom || 2, events)
      }
      break
    }
    case 'doomOnNearestCultist': {
      const target = nearestEnemyByTrait(state, inv.location, 'Cultist')
      if (target) {
        target.doom = (target.doom || 0) + fx.amount
        info(state, events, `🌑 「${target.name}」上放置 ${fx.amount} 点毁灭（当前 ${target.doom}）。`)
      } else {
        // "Search the encounter deck and discard pile for a Cultist enemy."
        drawEnemyByTrait(state, inv, 'Cultist', events, true)
      }
      break
    }
    case 'attachLockedDoor': {
      const candidates = state.locations.filter(loc => !loc.locked)
      if (!candidates.length) { info(state, events, '没有可附属上锁的门的地点。'); break }
      const maxClues = Math.max(...candidates.map(loc => loc.clues || 0))
      const pool = candidates.filter(loc => (loc.clues || 0) === maxClues)
      const chosenId = pool.length === 1 ? pool[0].id : requestChoice(state, {
        kind: 'target', source: fx.kind, seat: inv.seat, prompt: '选择线索最多且没有上锁的门的地点。',
        options: pool.map(loc => ({ id: loc.id, label: `${loc.name}（线索 ${loc.clues || 0}）` })),
      })
      const chosen = pool.find(loc => loc.id === chosenId)
      if (chosen) {
        chosen.locked = true
        chosen.lockedDoorCode = 'lockedDoor'
        info(state, events, `🔒 「上锁的门」封锁了「${chosen.name}」。`)
        return true
      }
      break
    }
    default:
      throw new Error(`未实现的诡计效果：${fx.kind}`)
  }
}

function nearestEnemyByTrait(state, fromId, trait) {
  const t = trait?.toLowerCase()
  const enemies = state.enemies.filter((e) => !t || (e.traits || []).some((x) => x.toLowerCase() === t))
  if (!enemies.length) return null
  const distances = new Map([[fromId, 0]])
  const queue = [fromId]
  for (const id of queue) {
    for (const next of state.locations.find(l => l.id === id)?.connections || []) {
      if (!distances.has(next)) { distances.set(next, distances.get(id) + 1); queue.push(next) }
    }
  }
  const distance = Math.min(...enemies.map(e => distances.get(e.location) ?? Infinity))
  if (!Number.isFinite(distance)) return null
  const candidates = enemies.filter(e => distances.get(e.location) === distance)
  const id = chooseAmong(state, { kind: 'target', source: 'nearest-enemy', seat: state.skillTest?.seat ?? leadDecisionSeat(state),
    prompt: '选择距离最近的敌人（距离相同）。', options: candidates.map(e => ({ id: e.id, label: e.name })) })
  return candidates.find(e => e.id === id)
}

function applyPenalty(state, inv, fail, failedBy, events) {
  if (!fail) return
  if (fail.kind === 'takeDamage') { info(state, events, `${inv.name} 受到 ${fail.amount} 点伤害。`); applyDamage(state, inv, fail.amount, events) }
  else if (fail.kind === 'takeHorror') { info(state, events, `${inv.name} 受到 ${fail.amount} 点恐惧。`); applyHorror(state, inv, fail.amount, events) }
  else if (fail.kind === 'damageByAmount') { const n = failedBy; info(state, events, `${inv.name} 受到 ${n} 点伤害。`); applyDamage(state, inv, n, events) }
  else if (fail.kind === 'horrorByAmount') { const n = failedBy; info(state, events, `${inv.name} 受到 ${n} 点恐惧。`); applyHorror(state, inv, n, events) }
  else if (fail.kind === 'discardAsset') { discardRandomAsset(state, inv, events); info(state, events, `${inv.name} 弃掉了一件资产。`) }
  else if (fail.kind === 'discardAssetOrDamage') {
    if (inv.assets.length) discardRandomAsset(state, inv, events)
    else { info(state, events, `${inv.name} 没有资产可弃，受到 ${fail.damage} 点伤害。`); applyDamage(state, inv, fail.damage, events) }
  }
  else if (fail.kind === 'horrorAndDrawMadness') {
    applyHorror(state, inv, fail.horror, events)
    if (inv.defeated || inv.resigned) return
    drawMadnessWeakness(state, inv, events)
  }
  else if (fail.kind === 'onWingsOfDarkness') {
    info(state, events, `${inv.name} 受到 ${fail.damage} 点伤害和 ${fail.horror} 点恐惧。`)
    applyHarm(state, inv, fail.damage, fail.horror, events)
    if (inv.defeated || inv.resigned) return
    for (const enemyId of inv.engaged.slice()) {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (enemy && !(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'nightgaunt')) disengageEnemy(state, enemy)
    }
    const central = state.locations.find(loc => loc.central)
    if (central && inv.location !== central.id) {
      relocateInvestigator(state, inv.seat, central.id, events, `🪽 ${inv.name} 被黑暗之翼带到中心地点「${central.name}」。`)
    }
  }
  else if (fail.kind === 'cluesByAmount') { placeCluesOnLocation(state, inv, failedBy, events) }
  else if (fail.kind === 'damageAndHorror') {
    info(state, events, `${inv.name} 受到 ${fail.damage} 点伤害和 ${fail.horror} 点恐惧。`)
    applyHarm(state, inv, fail.damage, fail.horror, events)
  }
  else if (fail.kind === 'wrathByAmount') {
    for (let i = 0; i < failedBy; i++) {
      const options = [{ id: 'harm', label: '受到 1 伤害和 1 恐惧' },
        ...inv.hand.flatMap((code, index) => isWeaknessCode(code) || !canDiscardFromHand(inv, code)
          ? [] : [{ id: String(index), cardCode: code, label: `弃掉 ${cardName(code)}` }])]
      const answer = requestChoice(state, { kind: 'discard', source: 'wrath', seat: inv.seat,
        prompt: `乌默尔多斯之怒：选择弃牌或承受伤害／恐惧（剩余 ${failedBy - i} 次）。`, options })
      if (answer === 'harm') applyHarm(state, inv, 1, 1, events)
      else {
        const code = inv.hand.splice(Number(answer), 1)[0]; inv.discard.push(code)
        info(state, events, `${inv.name} 弃掉了「${cardName(code)}」。`)
      }
      if (inv.defeated || inv.resigned) break
    }
  }
}

function drawMadnessWeakness(state, inv, events) {
  const candidates = inv.deck.map((code, index) => ({ code, index }))
    .filter(({ code }) => isWeaknessCode(code) && (cardDef(code)?.traits || []).some(trait => trait.toLowerCase() === 'madness'))
  if (candidates.length) {
    const answer = requestChoice(state, {
      kind: 'search', source: 'theYellowSign', seat: inv.seat,
      prompt: '选择牌库中的一张疯狂弱点并抽取。',
      options: candidates.map(({ code, index }) => ({ id: String(index), cardCode: code, label: cardName(code) })),
    })
    const code = inv.deck.splice(Number(answer), 1)[0]
    inv.deck.push(code)
    for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
  } else {
    info(state, events, `${inv.name} 的牌库中没有疯狂弱点。`)
  }
  inv.deck = shuffle(inv.deck, () => randomValue(state))
}

// 将线索放回所在地点（午夜假面 tablet / 错误指示）。
function placeCluesOnLocation(state, inv, amount, events) {
  const n = Math.min(amount, inv.clues)
  const loc = state.locations.find((l) => l.id === inv.location)
  if (n <= 0 || !loc) return
  spendClues(state, inv, n)
  loc.clues += n
  loc.maxClues = Math.max(loc.maxClues || 0, loc.clues)
  info(state, events, `🔍 ${inv.name} 将 ${n} 个线索放回「${loc.name}」。`)
}

// ---------------------------------------------------------------------------
// 技能检定 + 混乱袋（4 难度 + 特殊标记按剧本动态结算）
// ---------------------------------------------------------------------------

function tokenLabel(token) {
  return TOKEN_LABEL[token] || token
}

function applyFreeTriggers(state, inv, skill, events) {
  if (cannotTriggerFreeAbility(state, inv)) return 0
  let bonus = 0
  const spent = []
  for (const a of inv.assets) {
    const eff = assetEffect(inv, a)
    if (!eff || !eff.freeTriggers) continue
    if (!lolaCanUseCard(inv, a.code)) continue
    if (eff.minimumHandForBoost && inv.hand.length < eff.minimumHandForBoost) continue
    for (const ft of eff.freeTriggers) {
      if (ft.skill !== skill && ft.skill !== 'any') continue
      if (ft.requireTestTrait && !(cardDef(state.skillTest.source?.code)?.traits || [])
        .some(trait => String(trait).toLowerCase() === String(ft.requireTestTrait).toLowerCase())) continue
      const resourceCost = (ft.cost && ft.cost.resources) || 0
      const doomCost = (ft.cost && ft.cost.doom) || 0
      const exhaustCost = !!ft.cost?.exhaust
      if (exhaustCost && a.exhausted) continue
      state.skillTest.freeTriggerUses ||= {}
      const triggerKey = `${a.id}:${skill}`
      if (doomCost && state.skillTest.freeTriggerUses[triggerKey]) continue
      let activations = 0
      while ((resourceCost > 0 && inv.resources >= resourceCost) || (doomCost > 0 && activations === 0)
        || (exhaustCost && activations === 0)) {
        const answer = requestChoice(state, { kind: 'boost', source: a.id, seat: inv.seat,
          prompt: doomCost ? `是否在「${cardName(a.code)}」上放置 ${doomCost} 毁灭，提高${SKILL_NAMES[skill]}？`
            : `是否花 ${resourceCost} 资源提高${SKILL_NAMES[skill]}？`, canSkip: true,
          options: [{ id: 'skip', label: '不再支付' }, { id: 'pay', label: `${doomCost ? `放置 ${doomCost} 毁灭` : `支付 ${resourceCost} 资源`}，+${ft.bonus}` }] })
        if (answer === 'skip') break
        inv.resources -= resourceCost
        if (doomCost) a.doom = (a.doom || 0) + doomCost
        if (exhaustCost) a.exhausted = true
        if (doomCost) state.skillTest.freeTriggerUses[triggerKey] = true
        bonus += ft.bonus
        if (Number.isFinite(state.skillTest.value)) state.skillTest.value += ft.bonus
        activations++
        spent.push(`${cardName(a.code)}(${SKILL_NAMES[skill]}+${ft.bonus})`)
      }
    }
  }
  if (spent.length) info(state, events, `${inv.name} 激活天赋：${spent.join('、')}。`)
  return bonus
}

function ghoulsAtLocation(state, inv) {
  return state.enemies.filter((e) => e.location === inv.location && (e.traits || []).some((t) => t.toLowerCase() === 'ghoul'))
}

function monstersInPlay(state) {
  return state.enemies.filter((e) => (e.traits || []).some((t) => t.toLowerCase() === 'monster'))
}

function countTokenValue(name, state, inv) {
  if (name === 'ghoulsAtLocation') return ghoulsAtLocation(state, inv).length
  if (name === 'monsters') return monstersInPlay(state).length
  if (name === 'maxDoomOnCultist') {
    const cultists = state.enemies.filter((e) => (e.traits || []).some((t) => t.toLowerCase() === 'cultist'))
    return cultists.reduce((m, e) => Math.max(m, e.doom || 0), 0)
  }
  if (name === 'totalDoom') {
    return totalDoom(state)
  }
  return 0
}

// 结算特殊标记：返回 { delta, drawAnother, onDraw:[fx], onFail:[fx] }。
function resolveSpecialToken(state, seat, inv, token, events) {
  const custom = scenarioBehavior(state).resolveChaosToken?.(state, inv, token, scenarioRuntime(state, events))
  if (custom) return { delta: 0, drawAnother: false, onDraw: [], onFail: [], ...custom }
  const meanings = (state.scenario.tokenMeanings && state.scenario.tokenMeanings[state.difficulty]) || {}
  const m = meanings[token]
  const onDraw = []
  const onFail = []
  if (!m) {
    return { delta: SYMBOL_DEFAULTS[token] != null ? SYMBOL_DEFAULTS[token] : 0, drawAnother: false, onDraw, onFail }
  }
  let delta = 0
  if (m.kind === 'count') {
    delta = -(m.base + countTokenValue(m.count, state, inv))
  } else {
    delta = m.mod || 0
  }
  if (m.ifGhoul) {
    if (ghoulsAtLocation(state, inv).length) {
      if (m.ifGhoul.damage) onDraw.push({ type: 'takeDamage', amount: m.ifGhoul.damage })
      if (m.ifGhoul.horror) onDraw.push({ type: 'takeHorror', amount: m.ifGhoul.horror })
    }
  }
  if (m.ifMonsterAtLocation) {
    const hereMonster = state.enemies.some((e) => e.location === inv.location && (e.traits || []).some((t) => t.toLowerCase() === 'monster'))
    if (hereMonster) {
      if (m.ifMonsterAtLocation.damage) onDraw.push({ type: 'takeDamage', amount: m.ifMonsterAtLocation.damage })
      if (m.ifMonsterAtLocation.horror) onDraw.push({ type: 'takeHorror', amount: m.ifMonsterAtLocation.horror })
    }
  }
  if (m.onDraw) {
    for (const [k, v] of Object.entries(m.onDraw)) onDraw.push({ type: k, amount: v })
  }
  if (m.onFail) {
    for (const [k, v] of Object.entries(m.onFail)) onFail.push({ type: k, amount: v })
  }
  let drawAnother = !!m.drawAnother
  if (m.drawAnotherIfNoCultist) {
    const hasCultist = state.enemies.some((e) => (e.traits || []).some((t) => t.toLowerCase() === 'cultist'))
    drawAnother = !hasCultist
  }
  if (m.drawAnotherIf === 'ancientOne') {
    drawAnother = state.enemies.some((e) => (e.traits || []).some((t) => t.toLowerCase() === 'ancientone'))
  }
  return { delta, drawAnother, onDraw, onFail }
}

function applyTokenFx(state, seat, inv, fx, events) {
  switch (fx.type) {
    case 'damage': case 'takeDamage': info(state, events, `${inv.name} 受到 ${fx.amount} 点伤害。`); applyDamage(state, inv, fx.amount, events); break
    case 'horror': case 'takeHorror': info(state, events, `${inv.name} 受到 ${fx.amount} 点恐惧。`); applyHorror(state, inv, fx.amount, events); break
    case 'drawEnemyTrait': drawEnemyByTrait(state, inv, fx.amount || fx.trait || 'Monster', events, true); break
    case 'placeDoomOnNearestCultist': {
      const target = nearestEnemyByTrait(state, inv.location, 'Cultist')
      if (target) { target.doom = (target.doom || 0) + (fx.amount || 1); info(state, events, `🌑 「${target.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeDoomOnEachCultist': {
      const cultists = state.enemies.filter((e) => (e.traits || []).some((t) => t.toLowerCase() === 'cultist'))
      for (const e of cultists) { e.doom = (e.doom || 0) + (fx.amount || 1); info(state, events, `🌑 「${e.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeDoomOnNearestEnemy': {
      const target = nearestEnemyByTrait(state, inv.location)
      if (target) { target.doom = (target.doom || 0) + (fx.amount || 1); info(state, events, `🌑 「${target.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeCluesOnLocation': {
      if (fx.amount === 'all') placeCluesOnLocation(state, inv, inv.clues, events)
      else placeCluesOnLocation(state, inv, fx.amount || 1, events)
      break
    }
    default: break
  }
}

function drawEnemyByTrait(state, inv, trait, events, includeDiscard = false) {
  const t = (trait || '').toLowerCase()
  const candidates = [...state.encounterDeck.map((code,index)=>({code,index,pile:'deck'})),
    ...(includeDiscard ? state.encounterDiscard.map((code,index)=>({code,index,pile:'discard'})) : [])].filter(({code}) => {
    const d = enemyDef(code)
    return d && (d.traits || []).some((x) => x.toLowerCase() === t)
  })
  if (candidates.length) {
    const id = chooseAmong(state, { kind: 'search', source: 'encounter-enemy', seat: inv.seat,
      prompt: '选择要抽取的敌人。', options: candidates.map(({code,index,pile})=>({id:`${pile}:${index}`,cardCode:enemyDef(code).originalCode || code,label:enemyDef(code).name})) })
    const chosen=candidates.find(c=>`${c.pile}:${c.index}`===id)
    const code = (chosen.pile==='discard'?state.encounterDiscard:state.encounterDeck).splice(chosen.index,1)[0]
    state.encounterDeck.push(code)
    drawEncounter(state, inv, events)
  } else {
    info(state, events, '没有可引出的敌人。')
  }
  state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
}

function minhCommitWildBonus(state, committer, events) {
  let bonus = 0
  for (const minh of aliveInvestigators(state).filter(owner => owner.code === '03002'
    && owner.location === committer.location && !investigatorTextBlanked(state, owner))) {
    const key = `minhWild:${committer.seat}:${state.round}`
    if (minh.usedReactions?.[key]) continue
    const answer = requestChoice(state, { kind: 'reaction', source: 'minhWild', seat: minh.seat, canSkip: true,
      prompt: `是否让 ${committer.name} 投入的这张牌获得1个百搭图标？`,
      options: [{ id: 'skip', label: '不增加图标' }, { id: 'trigger', label: '增加1个百搭图标' }] })
    if (answer === 'trigger') {
      minh.usedReactions ||= {}
      minh.usedReactions[key] = true
      bonus += 1
      info(state, events, `${minh.name} 使投入牌获得1个百搭图标。`)
    }
  }
  return bonus
}

export function performTest(state, seat, skill, difficulty, options = {}) {
  beginChaosTest(state)
  const previousTest = state.skillTest || null
  state.skillTest = { seat, skill, difficulty: Math.max(0, difficulty), stage: 'ST.1', committed: [], publicLog: [...state.log],
    source: options.source || { type: 'effect', label: '卡牌效果检定', name: SKILL_NAMES[skill] + '检定' } }
  const inv = state.investigators[seat]
  const events = []
  difficulty = Math.max(0, difficulty)
  const statReference = getStat(state, inv, skill)
  const startingStat = options.baseValue ?? statReference
  if (options.source?.label?.includes('谈判') && inv.assets.some(asset => asset.code === '02272')) {
    difficulty = Math.max(0, difficulty - 2)
    state.skillTest.difficulty = difficulty
  }
  const initialBonus = typeof options.skillBonus === 'function' ? options.skillBonus() : options.skillBonus || 0
  let value = startingStat + initialBonus
  if (inv.fieldwork?.round === state.round && inv.fieldwork.phase === state.phase) {
    value += inv.fieldwork.amount || 2
    delete inv.fieldwork
  }
  if (inv.narrowEscape?.round === state.round && inv.narrowEscape.turnSeat === state.currentSeat) {
    value += inv.narrowEscape.amount || 2
    delete inv.narrowEscape
  }

  if (inv.testBonus) {
    value += inv.testBonus
    info(state, null, `${inv.name} 的检定加成 +${inv.testBonus} 生效。`)
    inv.testBonus = 0
  }

  state.skillTest.printedValue = options.baseValue ?? (inv[skill] || 0)
  state.skillTest.baseValue = startingStat
  state.skillTest.value = value

  // A personal test stays with its owner until they explicitly ask for help.
  playerWindow(state, 'test.beforeCommit', events, seat)
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skill, events)
  state.skillTest.stage = 'ST.2'

  const committed = []
  const committedCodes = new Set()
  const commitments = []
  const remoteMinhs = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && other.code === '03002' && other.assets.some(asset => asset.code === '03010'))
  const helpers = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && other.location === inv.location && !remoteMinhs.includes(other))
  const testOwners = [inv, ...remoteMinhs]
  for (const owner of testOwners) {
    let count = 0
    while (true) {
      state.skillTest.value = value + getStat(state, inv, skill) - statReference
      const candidates = owner.hand.map((code, index) => ({ code, index }))
        .filter(item => {
          const rule = hiddenRule(state, item.code)
          if (hasHiddenCard(owner, item.code)) return rule?.allowCommit === true
          return runtimeCardAvailable(state, owner, item.code) && !isWeaknessCode(item.code)
            && iconValue(item.code, skill) > 0
        })
        .filter(item => lolaCanUseCard(owner, item.code))
        .filter(item => !activeHiddenRules(state, owner).some(hidden =>
          hidden.rule.cannotCommitTypes?.includes(cardDef(item.code)?.type)))
        .filter(item => scenarioBehavior(state).canCommitCard?.(state, owner, item.code) !== false)
        .filter(item => owner === inv || !EFFECTS[item.code]?.skill?.selfTestOnly)
        .filter(item => !EFFECTS[item.code]?.skill?.requireClueAtLocation || (state.locations.find(loc => loc.id === owner.location)?.clues || 0) > 0)
        .filter(item => !EFFECTS[item.code]?.skill?.requireDifficultyAboveBase
          || difficulty - getStat(state, inv, skill) >= EFFECTS[item.code].skill.requireDifficultyAboveBase)
        .filter(item => EFFECTS[item.code]?.skill?.remainingSanityAtMost == null
          || getMaxSanity(owner) - owner.horror <= EFFECTS[item.code].skill.remainingSanityAtMost)
        .filter(item => !EFFECTS[item.code]?.skill?.requireEngagedEnemy || enemiesEngagedWith(state, owner).length > 0)
        .filter(item => !EFFECTS[item.code]?.skill?.maxPerTest
          || commitments.filter(committed => committed.code === item.code).length < EFFECTS[item.code].skill.maxPerTest)
        .filter(item => !committedCodes.has(item.code) || !String(cardDef(item.code)?.textZh || '').includes('最多投入1张'))
      const kingInYellow = owner.code === '03002' && owner.threat.some(card => card.code === '03011')
      if (kingInYellow && count === 0 && candidates.length < 3) candidates.length = 0
      if (owner !== inv && (!candidates.length || (!kingInYellow && count >= 1))) break
      const canFinish = !kingInYellow || count === 0 || count >= 3
      const answer = requestChoice(state, { kind: 'commit', source: `test:${seat}:${skill}`, seat: owner.seat,
        prompt: owner === inv ? `${inv.name} 的${SKILL_NAMES[skill]}检定：投入手牌后，可直接检定或求助队友。`
          : `${inv.name} 请求协助${SKILL_NAMES[skill]}检定；你可以投入一张牌，或放弃协助。`, canSkip: true,
        options: [...(canFinish ? [{ id: 'done', label: owner === inv ? '开始检定' : '放弃协助' }] : []),
          ...(owner === inv && helpers.length ? [{ id: 'help', label: '求助' }] : []),
          ...candidates.map(item => ({ id: String(item.index), label: '投入：' + cardName(item.code) }))] })
      if (answer === 'done') break
      if (answer === 'help') {
        state.skillTest.helpRequested = true
        testOwners.push(...helpers)
        info(state, null, `${inv.name} 请求同地点队友协助投入。`)
        break
      }
      const code = owner.hand.splice(Number(answer), 1)[0]
      if (hasHiddenCard(owner, code)) removeHiddenMarker(owner, code)
      let icons = iconValue(code, skill)
      const skillEffect = EFFECTS[code]?.skill
      if (skillEffect?.wagerResources) {
        const maximum = Math.min(skillEffect.wagerResources, owner.resources)
        const wager = maximum ? Number(requestChoice(state, { kind: 'resource', source: code, seat: owner.seat,
          prompt: '选择为本次检定押注的资源。', options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount}资源` })) })) : 0
        owner.resources -= wager
        owner.carcosaWagers ||= {}
        owner.carcosaWagers[code] = (owner.carcosaWagers[code] || 0) + wager
      }
      if (skillEffect?.spendChargesForIcons) {
        const chargeAssets = owner.assets.filter(asset => isChargeAsset(asset) && (asset.uses || 0) > 0)
        const maximum = Math.min(skillEffect.spendChargesForIcons, chargeAssets.reduce((sum, asset) => sum + asset.uses, 0))
        const spend = maximum ? Number(requestChoice(state, { kind: 'amount', source: code, seat: owner.seat,
          prompt: '选择为力量洪流花费的充能。', options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount}充能` })) })) : 0
        let remaining = spend
        for (const charged of chargeAssets) {
          const used = Math.min(remaining, charged.uses); charged.uses -= used; remaining -= used
          if (!remaining) break
        }
        icons += spend * (skill === 'willpower' ? 2 : 1)
      }
      if (skillEffect?.iconsPerEngagedEnemy?.includes(skill)) icons += enemiesEngagedWith(state, owner).length
      if (owner !== inv && EFFECTS[code]?.skill?.leadership) icons += skill === 'willpower' ? 2 : 1
      icons += minhCommitWildBonus(state, owner, events)
      const commitLocation = state.locations.find(location => location.id === owner.location)
      const multiplier = scenarioBehavior(state).commitIconMultiplier?.(state, owner, commitLocation)
        || commitLocation?.commitIconMultiplier
      const investigateOnly = commitLocation?.commitIconMultiplierInvestigateOnly
      if (multiplier && multiplier !== 1 && (!investigateOnly || state.skillTest.source?.label === '调查')) icons *= multiplier
      value += icons
      state.skillTest.committed.push({ seat: owner.seat, code, icons })
      committed.push(code)
      committedCodes.add(code)
      commitments.push({ seat: owner.seat, code, icons })
      count++
      info(state, null, `${owner.name} 投入「${cardName(code)}」。`)
    }
    const analyticalMind = owner.assets.find(asset => asset.code === '03010' && !asset.exhausted)
    if (count === 1 && analyticalMind) {
      const answer = requestChoice(state, { kind: 'reaction', source: '03010', seat: owner.seat, canSkip: true,
        prompt: '是否横置「分析性思维」并抽1张牌？',
        options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '横置并抽1张牌' }] })
      if (answer === 'trigger') {
        analyticalMind.exhausted = true
        for (const line of drawCards(state, owner, 1, events)) info(state, events, line)
      }
    }
  }

  state.skillTest.value = value + getStat(state, inv, skill) - statReference
  const doubleOrNothing = commitments.some(item => EFFECTS[item.code]?.skill?.doubleDifficultyAndRewards)
  if (doubleOrNothing) {
    difficulty *= 2
    state.skillTest.difficulty = difficulty
    info(state, events, `「孤注一掷」使本次检定难度翻倍至 ${difficulty}；成功效果将结算两次。`)
  }
  let defiedToken = null
  if (commitments.some(item => EFFECTS[item.code]?.skill?.defiance)) {
    defiedToken = requestChoice(state, { kind: 'token', source: '02190', seat, prompt: '蔑视：选择本次检定要忽略的混乱符号。',
      options: ['skull', 'cultist', 'tablet', 'elderthing'].map(id => ({ id, label: tokenLabel(id) })) })
  }
  playerWindow(state, 'test.afterCommit', events, options.peril || !state.skillTest.helpRequested ? seat : null)
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skill, events)
  value += getStat(state, inv, skill) - statReference
  state.skillTest.stage = 'ST.3'
  const sealElderSign = commitments.some(item => EFFECTS[item.code]?.skill?.elderSignInsteadOfChaos)
  const closeTest = resolved => {
    state.skillTest.stage = 'ST.8'
    for (const item of state.skillTest.committed) {
      if (EFFECTS[item.code]?.skill?.exileAfterTest) {
        state.removedFromGame ||= []
        state.removedFromGame.push(item.code)
      } else if (hiddenDefinition(state, item.code)) {
        state.encounterDiscard.push(item.code)
      } else state.investigators[item.seat].discard.push(item.code)
    }
    if (strokeOfLuckExiled) {
      const owner = state.investigators[seat]
      const index = owner.discard.lastIndexOf('02271')
      if (index >= 0) owner.discard.splice(index, 1)
      exilePlayerCard(state, owner, '02271', events)
    }
    endChaosTest(state, resolved)
    state.skillTest = previousTest
  }

  const resolveResult = result => {
    // Public, confirmed result for the UI. Transaction replay already deduplicates
    // emitted events across choice pauses; no random draw happens in the client.
    state._resolution?.events.push({ type: 'presentation', kind: 'test', seat, name: inv.name,
      skill, value: result.value, difficulty: result.difficulty, success: result.success,
      autoFail: !!result.autoFail, drawn: [...result.drawn], source: state.skillTest.source })
    try { options.resolve?.(result) }
    catch (error) {
      if (error instanceof ScenarioEnded) closeTest(result.drawn)
      throw error
    }
    closeTest(result.drawn)
    if (!result.success) for (const fx of pendingOnFail.filter(fx=>fx.type==='drawEnemyTrait')) applyTokenFx(state,seat,inv,fx,events)
  }

  const necronomiconInPlay = inv.threat.some((t) => {
    const th = getThreatEffect(t)
    return th && th.eldersignToAutofail
  })

  let delta = 0
  let lastTokenDelta = 0
  let autoFail = commitments.some(item => hiddenRule(state, item.code)?.autoFailOnCommit)
  let committedCancelled = false
  let elderSign = false
  let elderAutoSuccess = false
  let elderOnSuccess = null
  let elderReturnCommittedSkill = false
  const drawn = []
  const cancelledTokens = []
  const pendingOnFail = []
  let wendyRedrawUsed = false
  let strokeOfLuckExiled = false
  let extraChaosUsed = false
  let guard = 0
  while (guard++ < 100) {
    if (inv.ignoreChaosThisTurn) { drawn.push('0'); break }
    let token = sealElderSign ? 'eldersign' : null
    if (token == null && !extraChaosUsed && (options.extraChaosChoices || 0) > 0) {
      extraChaosUsed = true
      const pool = Array.from({ length: 1 + options.extraChaosChoices }, () => drawChaosToken(state))
      const chosen = requestChoice(state, { kind: 'token', source: '03304', seat,
        prompt: `额外揭示了 ${pool.length} 个混乱标记，选择 1 个结算。`,
        options: pool.map((face, index) => ({ id: String(index), label: tokenLabel(face) })) })
      for (let index = 0; index < pool.length; index++) {
        if (index !== Number(chosen)) returnChaosToken(state, pool[index])
      }
      token = pool[Number(chosen)]
      info(state, events, `${inv.name} 结算额外混乱标记 ${tokenLabel(token)}，其余标记归还。`)
    }
    const statue = token == null && inv.assets.find(asset => asset.code === '01071' && (asset.uses || 0) > 0)
    if (statue) {
      const answer = requestChoice(state, { kind: 'reaction', source: statue.id, seat, canSkip: true, prompt: '是否花费 1 充能，改为揭示 2 个混乱标记并选择 1 个？', options: [{ id: 'skip', label: '不花费充能' }, { id: 'trigger', label: '花费 1 充能' }] })
      if (answer === 'trigger') {
        statue.uses -= 1
        const first = drawChaosToken(state)
        const second = state.chaosBag.length ? drawChaosToken(state) : null
        const chosen = requestChoice(state, { kind: 'token', source: statue.id, seat, prompt: '选择要结算的混乱标记。', options: [{ id: '0', label: tokenLabel(first) }, ...(second == null ? [] : [{ id: '1', label: tokenLabel(second) }])] })
        token = chosen === '0' ? first : second
        info(state, events, inv.name + ' 使用「诡秘石像」：揭示 ' + tokenLabel(first) + ' 与 ' + tokenLabel(second) + '，选择 ' + tokenLabel(token) + '。')
        if ((statue.uses || 0) <= 0) {
          leaveAsset(state, inv, statue)
          inv.discard.push(statue.code)
          info(state, events, '「诡秘石像」充能耗尽，弃掉。')
        }
      }
    }
    if (token == null) token = drawChaosToken(state)
    if (INVESTIGATOR_ABILITIES[inv.code]?.chaosTokenRedraw && !wendyRedrawUsed && !investigatorTextBlanked(state, inv)) {
      const candidates = inv.hand.map((code, index) => ({ code, index }))
        .filter(item => !isWeaknessCode(item.code) && canDiscardFromHand(inv, item.code))
      if (candidates.length) {
        const answer = requestChoice(state, { kind: 'reaction', source: 'wendyRedraw', seat,
          prompt: `已揭示混乱标记 ${tokenLabel(token)}，是否弃掉 1 张非弱点手牌取消并归还该标记，然后重抽？`, canSkip: true,
          options: [{ id: 'skip', label: '保留该标记' }, { id: 'trigger', label: '弃牌并重抽（每次检定限一次）' }] })
        if (answer === 'trigger') {
          const index = requestChoice(state, { kind: 'discard-hand', source: 'wendyRedraw', seat,
            prompt: '选择弃掉的非弱点手牌。',
            options: candidates.map(item => ({ id: String(item.index), label: cardName(item.code) })) })
          const code = inv.hand.splice(Number(index), 1)[0]
          inv.discard.push(code)
          wendyRedrawUsed = true
          cancelledTokens.push(token)
          info(state, events, `${inv.name} 弃掉「${cardName(code)}」，取消并归还混乱标记 ${tokenLabel(token)}，重新抽取。`)
          returnChaosToken(state, token)
          token = drawChaosToken(state)
        }
      }
    }
    let luckyDice = inv.assets.find(asset => asset.code === '02230')
    let luckyGuard = 0
    while (luckyDice && inv.resources >= 2 && luckyGuard++ < 20) {
      const answer = requestChoice(state, { kind: 'reaction', source: luckyDice.id, seat, canSkip: true,
        prompt: `幸运骰：是否支付 2 资源，取消并归还 ${tokenLabel(token)}，然后重新揭示？`,
        options: [{ id: 'skip', label: '保留该标记' }, { id: 'trigger', label: '支付 2 资源并重抽' }] })
      if (answer !== 'trigger') break
      inv.resources -= 2
      cancelledTokens.push(token)
      returnChaosToken(state, token)
      token = drawChaosToken(state)
      info(state, events, `${inv.name} 使用「幸运骰」归还混乱标记并重新揭示 ${tokenLabel(token)}。`)
      if (token === 'autofail') {
        leaveAsset(state, inv, luckyDice, events)
        inv.discard.push(luckyDice.code)
        info(state, events, `「幸运骰」重新揭示自动失败，弃置。`)
        luckyDice = null
      }
    }
    state.skillTest.stage = 'ST.4'
    token = scenarioBehavior(state).chaosTokenRevealed?.(state, inv, token, scenarioRuntime(state, events)) || token
    drawn.push(token)
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) {
      const symbolContext = { seat, token, location: inv.location, testBonus: 0 }
      for (const owner of aliveInvestigators(state).filter(owner => owner.location === inv.location))
        triggerReaction(state, owner.seat, 'symbolRevealed', events, symbolContext)
      value += symbolContext.testBonus || 0
    }
    if (token === defiedToken) {
      info(state, events, `「蔑视」忽略了 ${tokenLabel(token)} 的修正值与效果。`)
      lastTokenDelta = 0
      break
    }
    if (token === 'skull') for (const owner of aliveInvestigators(state)) triggerReaction(state, owner.seat, 'skullRevealed', events, { seat, token })
    if (token === 'autofail') { autoFail = true; break }
    if (token === 'bless' || token === 'curse') { delta += token === 'bless' ? 2 : -2; continue }
    if (token === 'frost') {
      delta -= 1
      if (drawn.filter(t => t === 'frost').length > 1) { autoFail = true; break }
      continue
    }
    if (token === 'eldersign') {
      elderSign = true
      if (necronomiconInPlay) { autoFail = true; info(state, null, `☠️ 死灵之书使 ${inv.name} 的 elder_sign 变为自动失败！`) }
      else {
        const es = elderSignEffect(state, inv)
        if (es.autoFail) autoFail = true
        if (es.draw) drawCards(state, inv, es.draw, events)
        if (es.asSkull) {
          const res = resolveSpecialToken(state, seat, inv, 'skull', events)
          for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
          pendingOnFail.push(...res.onFail)
          drawn[drawn.length - 1] = 'skull'
        }
        delta += es.delta
        lastTokenDelta = es.delta
        elderAutoSuccess = !!es.autoSuccess
        elderOnSuccess = es.onSuccess || null
        elderReturnCommittedSkill = !!es.returnCommittedSkill
        if (es.optionalDraw > 0) {
          const answer = requestChoice(state, { kind: 'reaction', source: 'daisyElderSign', seat, canSkip: true,
            prompt: `旧印：是否为控制的书籍抽取 ${es.optionalDraw} 张牌？`,
            options: [{ id: 'skip', label: '不抽牌' }, { id: 'trigger', label: `抽取 ${es.optionalDraw} 张牌` }] })
          if (answer === 'trigger') for (const text of drawCards(state, inv, es.optionalDraw, events)) info(state, events, text)
        }
        if (elderAutoSuccess) info(state, null, `✨ ${inv.name} 的 elder_sign 效果触发自动成功！`)
      }
      break
    }
    if (/^[+-]?\d+$/.test(token)) {
      let numeric = Number(token)
      if (numeric < 0) {
        const context = { when: 'negativeTokenRevealed', seat, location: inv.location, token, testValue: value + numeric, prompt: '揭示了带有负值修正的混乱标记' }
        reactionWindow(state, 'negativeTokenRevealed', context, events)
        if (context.flipTokenSign) numeric = -numeric
      }
      if (options.doubleNegative && numeric < 0) numeric *= 2
      delta += numeric
      lastTokenDelta = numeric
      break
    }
    const res = resolveSpecialToken(state, seat, inv, token, events)
    if (res.autoFail) autoFail = true
    if (res.cancelCommitted && !committedCancelled) {
      const cancelled = commitments.filter(item => cardDef(item.code)?.type === 'skill')
      value -= cancelled.reduce((sum, item) => sum + iconValue(item.code, skill), 0)
      for (const item of cancelled) commitments.splice(commitments.indexOf(item), 1)
      state.skillTest.cancelledCommitments = cancelled.map(item => ({ ...item }))
      committedCancelled = true
    }
    let tokenDelta = !investigatorTextBlanked(state, inv) && INVESTIGATOR_ABILITIES[inv.code]?.tokenModifiers?.[token] != null
      ? INVESTIGATOR_ABILITIES[inv.code].tokenModifiers[token] : res.delta
    if (tokenDelta < 0) {
      const context = { when: 'negativeTokenRevealed', seat, location: inv.location, token, testValue: value + delta, prompt: '揭示了带有负值修正的混乱标记' }
      reactionWindow(state, 'negativeTokenRevealed', context, events)
      if (context.flipTokenSign) tokenDelta = -tokenDelta
    }
    lastTokenDelta = options.doubleNegative && tokenDelta < 0 ? tokenDelta * 2 : tokenDelta
    delta += lastTokenDelta
    for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
    for (const fx of res.onFail) pendingOnFail.push(fx)
    if (!res.drawAnother) break
  }

  state.skillTest.stage = 'ST.5'
  if (typeof options.skillBonus === 'function') value += options.skillBonus() - initialBonus
  const rexCurse = inv.threat.find(item => item.code === '02009')
  if (rexCurse && !autoFail && (elderAutoSuccess || value + delta >= difficulty) && drawn.length) {
    const oldToken = drawn.pop()
    returnChaosToken(state, state.chaos.revealed.includes(oldToken) ? oldToken : state.chaos.revealed.at(-1))
    delta -= lastTokenDelta
    elderAutoSuccess = false
    elderOnSuccess = null
    elderSign = false
    const replacement = drawChaosToken(state)
    drawn.push(replacement)
    if (replacement === 'skull') for (const owner of aliveInvestigators(state)) triggerReaction(state, owner.seat, 'skullRevealed', events, { seat, token: replacement })
    if (replacement === 'autofail') autoFail = true
    else if (replacement === 'eldersign') {
      elderSign = true
      const es = elderSignEffect(state, inv)
      delta += es.delta
      elderAutoSuccess = !!es.autoSuccess
      elderReturnCommittedSkill = !!es.returnCommittedSkill
      if (es.autoFail) autoFail = true
    } else if (/^[+-]?\d+$/.test(replacement)) delta += Number(replacement)
    else {
      const res = resolveSpecialToken(state, seat, inv, replacement, events)
      delta += INVESTIGATOR_ABILITIES[inv.code]?.tokenModifiers?.[replacement] ?? res.delta
      autoFail ||= !!res.autoFail
      for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
      pendingOnFail.push(...res.onFail)
    }
    if (autoFail || (!elderAutoSuccess && value + delta < difficulty)) {
      removeOne(inv.threat, rexCurse)
      inv.deck = shuffle([...inv.deck, '02009'], () => randomValue(state))
      info(state, events, `「雷克斯的诅咒」令检定失败，洗回 ${inv.name} 的牌库。`)
    } else info(state, events, `「雷克斯的诅咒」归还 ${tokenLabel(oldToken)} 并揭示 ${tokenLabel(replacement)}；检定仍然成功。`)
  }
  state.skillTest.value = autoFail ? 0 : Math.max(0, value + delta)
  if (autoFail) {
    state.skillTest.stage = 'ST.6'
    for (const fx of pendingOnFail.filter(fx=>fx.type!=='drawEnemyTrait')) applyTokenFx(state, seat, inv, fx, events)
    triggerReaction(state, seat, 'skillTestFail', events, { skill, difficulty, failedBy: Math.max(0, difficulty) })
    const result = { success: false, value: 0, difficulty, skill, token: 'autofail', committed, autoFail: true, drawn, cancelledTokens, source: options.source || null, damageBonus: 0, clueBonus: 0 }
    state.skillTest.stage = 'ST.7'
    resolveResult(result)
    scenarioBehavior(state).afterTest?.(state, inv, result, scenarioRuntime(state, events))
    return result
  }
  value += delta
  if (!autoFail && commitments.some(item => item.seat === seat && item.code === '02271')) {
    const answer = requestChoice(state, { kind: 'reaction', source: '02271', seat, canSkip: true,
      prompt: '是否流放「天赐良机」，使本次检定自动成功？',
      options: [{ id: 'skip', label: '保留卡牌，正常结算' }, { id: 'exile', label: '流放并自动成功' }] })
    if (answer === 'exile') { strokeOfLuckExiled = true; elderAutoSuccess = true }
  }
  if (!elderAutoSuccess && value < difficulty) {
    const context = { when: 'testWouldFail', seat, location: inv.location, skill, difficulty, testValue: value, testBonus: 0, prompt: '技能检定将要失败' }
    reactionWindow(state, 'testWouldFail', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  value = Math.max(0, value)
  if (!elderAutoSuccess && value >= difficulty) {
    const context = { when: 'wouldSucceedTest', seat, location: inv.location, skill, difficulty, testValue: value,
      testBonus: 0, prompt: '技能检定将要成功' }
    reactionWindow(state, 'wouldSucceedTest', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  state.skillTest.value = value
  state.skillTest.stage = 'ST.6'
  const success = elderAutoSuccess || value >= difficulty
  if (!success) {
    for (const fx of pendingOnFail.filter(fx=>fx.type!=='drawEnemyTrait')) applyTokenFx(state, seat, inv, fx, events)
  }

  const skillFx = { damageBonus: 0, clueBonus: 0, evadeDisengage: false, mayMoveAfterEvade: false, homeFrontDamage: 0 }
  for (let pass = 0; pass < (doubleOrNothing && success ? 2 : 1); pass++) {
    for (const commitment of commitments) {
      const result = applySkillOnSuccess(state, state.investigators[commitment.seat], [commitment.code], success, value - difficulty)
      skillFx.damageBonus += result.damageBonus
      skillFx.clueBonus += result.clueBonus
      skillFx.evadeDisengage ||= result.evadeDisengage
      skillFx.mayMoveAfterEvade ||= result.mayMoveAfterEvade
      skillFx.homeFrontDamage += result.homeFrontDamage
    }
  }
  if (elderOnSuccess && success) {
    resolveEffect(state, seat, elderOnSuccess, makeRuntime(state, []))
  }
  if (success && elderReturnCommittedSkill) {
    const candidates = state.skillTest.committed.filter(item => cardDef(item.code)?.type === 'skill')
    if (candidates.length) {
      const choice = requestChoice(state, { kind: 'reaction', source: 'minhElderSign', seat, canSkip: true,
        prompt: '旧印：可以将本次投入的一张技能牌返回其所有者手牌。',
        options: [{ id: 'skip', label: '不返回' },
          ...candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
            label: `${cardName(item.code)}（${state.investigators[item.seat].name}）` }))] })
      if (choice !== 'skip') {
        const chosen = candidates[Number(choice)]
        removeOne(state.skillTest.committed, chosen)
        state.investigators[chosen.seat].hand.push(chosen.code)
      }
    }
  }
  if (success) for (const minh of state.investigators.filter(owner => owner.code === '03002')) {
    const king = minh.threat.find(card => card.code === '03011')
    const matchingIcons = commitments.filter(item => item.seat === minh.seat).reduce((sum, item) => sum + item.icons, 0)
    if (king && matchingIcons >= 6) {
      removeOne(minh.threat, king)
      minh.discard.push(king.code)
      info(state, events, `${minh.name} 投入了至少6个匹配图标，弃置「${cardName(king.code)}」。`)
    }
  }
  if (!success) triggerReaction(state, seat, 'skillTestFail', events, { skill, difficulty, failedBy: Math.max(0, difficulty - value) })
  const result = { success, value, difficulty, skill, token: drawn.at(-1), committed, autoFail, drawn, elderSign, cancelledTokens,
    rewardMultiplier: doubleOrNothing && success ? 2 : 1, source: options.source || null, ...skillFx }
  if (success && elderSign && !investigatorTextBlanked(state, inv)) result.damageBonus += INVESTIGATOR_ABILITIES[inv.code]?.elderSign?.attackDamageBonus || 0
  state.skillTest.stage = 'ST.7'
  resolveResult(result)
  scenarioBehavior(state).afterTest?.(state, inv, result, scenarioRuntime(state, events))
  if (success) {
    const successBy = value - difficulty
    for (const commitment of commitments) {
      const threshold = EFFECTS[commitment.code]?.skill?.returnOnSuccessBy
      if (threshold != null && successBy >= threshold) {
        const owner = state.investigators[commitment.seat]
        const idx = owner.discard.lastIndexOf(commitment.code)
        if (idx >= 0) {
          owner.discard.splice(idx, 1)
          owner.hand.push(commitment.code)
          info(state, events, `${owner.name} 的「${cardName(commitment.code)}」因超过难度 ${threshold} 点返回手牌。`)
        }
      }
    }
  }
  return {
    success, value, difficulty,
    token: drawn[drawn.length - 1],
    committed, autoFail, drawn, elderSign, cancelledTokens,
    damageBonus: skillFx.damageBonus,
    clueBonus: skillFx.clueBonus,
    evadeDisengage: skillFx.evadeDisengage,
    mayMoveAfterEvade: skillFx.mayMoveAfterEvade,
  }
}

function elderSignEffect(state, inv) {
  const ab = INVESTIGATOR_ABILITIES[inv.code]
  if (!ab || !ab.elderSign) return { delta: 1 }
  if (investigatorTextBlanked(state, inv)) return { delta: 0 }
  const es = ab.elderSign
  switch (es.kind) {
    case 'resources': return { delta: inv.resources }
    case 'rex': {
      const answer = requestChoice(state, { kind: 'reaction', source: 'rexElderSign', seat: inv.seat, prompt: '旧印：是否改为自动失败并抽 3 张牌？',
        options: [{ id: 'skip', label: '保留 +2' }, { id: 'draw', label: '自动失败并抽 3 张牌' }] })
      return { delta: 2, autoFail: answer === 'draw', draw: answer === 'draw' ? 3 : 0 }
    }
    case 'jim': {
      const answer = requestChoice(state, { kind: 'reaction', source: 'jimElderSign', seat: inv.seat, prompt: '旧印：是否视为骷髅？',
        options: [{ id: 'skip', label: '保留 +1' }, { id: 'skull', label: '视为骷髅（修正为 0）' }] })
      return { delta: answer === 'skull' ? 0 : 1, asSkull: answer === 'skull' }
    }
    case 'readySignature': {
      const asset = inv.assets.find(a => a.code === es.code)
      if (asset && !assetsCannotReady(inv)) asset.exhausted = false
      return { delta: es.bonus }
    }
    case 'perClueAtLocation': {
      const loc = state.locations.find((l) => l.id === inv.location)
      const n = loc ? loc.clues : 0
      return { delta: n * (es.bonus || 1) }
    }
    case 'perHorror': {
      const n = inv.horror
      return { delta: n * (es.bonus || 1) }
    }
    case 'perDamage': {
      return { delta: (es.base || 0) + inv.damage * (es.bonus || 1) }
    }
    case 'akachi': {
      const candidates = inv.assets.filter(asset => ['charge', 'charges'].includes(String(asset.usesType || '').toLowerCase()))
      if (candidates.length) {
        const answer = requestChoice(state, { kind: 'elderSign', source: 'akachiElderSign', seat: inv.seat,
          prompt: '旧印：是否在一个由你控制的充能支援上放置1个充能？', canSkip: true,
          options: [{ id: 'skip', label: '不放置充能' },
            ...candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) }))] })
        const asset = candidates.find(item => item.id === answer)
        if (asset) asset.uses = (asset.uses || 0) + 1
      }
      return { delta: es.bonus || 1 }
    }
    case 'minh': return { delta: es.bonus || 1, returnCommittedSkill: true }
    case 'static': {
      return { delta: es.bonus || 0, onSuccess: es.onSuccess }
    }
    case 'drawPerTome': {
      const tomes = [...inv.assets, ...inv.threat].filter((a) => {
        const def = cardDef(a.code)
        return def && (def.traits || []).some((t) => t.toLowerCase() === 'tome')
      }).length
      return { delta: 0, optionalDraw: tomes }
    }
    case 'wendyAmulet': {
      const hasAmulet = inv.assets.some((a) => a.code === '01014')
      return { delta: 0, autoSuccess: hasAmulet }
    }
    default:
      return { delta: 1 }
  }
}

function applySkillOnSuccess(state, inv, committed, success, successBy = 0) {
  const out = { damageBonus: 0, clueBonus: 0, evadeDisengage: false, mayMoveAfterEvade: false, homeFrontDamage: 0 }
  if (!success) {
    for (const code of committed) if (inv.carcosaWagers) delete inv.carcosaWagers[code]
    return out
  }
  for (const code of committed) {
    const eff = EFFECTS[code]
    const s = eff && eff.skill
    if (!s) continue
    const o = { ...(s.onSuccess || {}) }
    if (s.successBy && successBy >= s.successBy.threshold) {
      for (const key of ['damageBonus', 'clueBonus', 'healHorror', 'gainAction']) o[key] = (o[key] || 0) + (s.successBy[key] || 0)
    }
    if (o.draw) {
      const texts = drawCards(state, inv, o.draw, [])
      for (const t of texts) info(state, null, t)
      info(state, null, `${inv.name} 的「${cardName(code)}」触发：抽 ${o.draw} 张牌。`)
    }
    if (o.damageBonus) out.damageBonus += o.damageBonus
    if (o.clueBonus) out.clueBonus += o.clueBonus
    if (o.healHorror) {
      const h = Math.min(inv.horror, o.healHorror)
      inv.horror -= h
      info(state, null, `${inv.name} 的「${cardName(code)}」触发：治愈 ${h} 点恐惧。`)
    }
    if (o.gainAction) inv.actionsLeft += o.gainAction
    if (o.evadeDisengage) out.evadeDisengage = true
    if (o.mayMoveAfterEvade) out.mayMoveAfterEvade = true
    const owner = inv
    if (s.wagerResources && owner.carcosaWagers?.[code]) {
      owner.resources += owner.carcosaWagers[code] * 2
      delete owner.carcosaWagers[code]
    }
    if (o.returnDiscardClass) {
      const candidates = owner.discard.filter(item => item !== code && cardDef(item)?.klass === o.returnDiscardClass)
      if (candidates.length) {
        const answer = requestChoice(state, { kind: 'card', source: code, seat: owner.seat, canSkip: true,
          prompt: '选择从弃牌堆返回手牌的卡牌。', options: [{ id: 'skip', label: '不返回' },
            ...candidates.map((item, index) => ({ id: String(index), cardCode: item, label: cardName(item) }))] })
        if (answer !== 'skip') {
          const picked = candidates[Number(answer)]
          removeOne(owner.discard, picked); owner.hand.push(picked)
        }
      }
    }
    if (o.readyAndHealAlly) {
      const allies = aliveInvestigators(state).filter(other => other.location === inv.location)
        .flatMap(other => other.assets.map(asset => ({ asset, owner: other })))
        .filter(item => (cardDef(item.asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')
          && (item.asset.exhausted || item.asset.damage > 0 || item.asset.horror > 0))
      if (allies.length) {
        const answer = requestChoice(state, { kind: 'asset', source: code, seat: inv.seat,
          prompt: '选择重整并治疗的盟友。', options: allies.map(item => ({ id: item.asset.id, label: cardName(item.asset.code) })) })
        const picked = allies.find(item => item.asset.id === answer)?.asset
        if (picked) {
          picked.exhausted = false
          const kind = picked.damage > 0 && picked.horror > 0 ? requestChoice(state, { kind: 'heal', source: code, seat: inv.seat,
            prompt: '选择治疗1点伤害或恐惧。', options: [{ id: 'damage', label: '治疗伤害' }, { id: 'horror', label: '治疗恐惧' }] })
            : picked.damage > 0 ? 'damage' : 'horror'
          picked[kind] = Math.max(0, (picked[kind] || 0) - 1)
        }
      }
    }
    if (o.searchTop) searchTop(state, inv.seat, { amount: o.searchTop, source: code }, [])
    if (s.homeFront && inv.code === '03001' && inv.damage > out.homeFrontDamage && state.skillTest?.source?.enemyId) {
      const answer = requestChoice(state, { kind: 'skillEffect', source: code, seat: inv.seat,
        prompt: '是否从马克·哈里根身上移动1点伤害到正在攻击的敌人？',
        options: [{ id: 'skip', label: '不移动' }, { id: 'move', label: '移动1点伤害' }] })
      if (answer === 'move') out.homeFrontDamage += 1
    }
  }
  return out
}

function removeOne(arr, code) {
  const i = arr.indexOf(code)
  if (i >= 0) arr.splice(i, 1)
}

function removeCardByCode(arr, code) {
  const i = arr.indexOf(code)
  if (i >= 0) arr.splice(i, 1)
  return i >= 0
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

function spawnEnemy(state, code, locationId, engagedSeat, ignoreSpawn = false, temporary = false) {
  const def = enemyDef(code)
  if (!def) return null
  const override = scenarioBehavior(state).spawnOverrides?.[code]
  let loc = override && locationExists(state, override)
    ? override : !ignoreSpawn && def.spawn ? def.spawn : locationId
  if (!ignoreSpawn && scenarioBehavior(state).spawnLocation) loc = scenarioBehavior(state).spawnLocation(state, code, loc, engagedSeat, scenarioRuntime(state, []))
  if (!locationExists(state, loc)) {
    state.encounterDiscard.push(code)
    scenarioBehavior(state).spawnFailed?.(state, code, engagedSeat, scenarioRuntime(state, []))
    return null
  }
  const health = def.healthPerInvestigator
    ? def.healthPerInvestigator * state.numInvestigators
    : def.health + (def.healthPerPlayerBonus || 0) * state.numInvestigators
  const enemy = {
    id: newEnemyId(state), code, name: def.name,
    ...cardIdentityFields(def),
    fight: def.fight, evade: def.evade, health,
    damage: def.damage, horror: def.horror, hunter: def.hunter,
    retaliate: def.retaliate, alert: def.alert, elite: def.elite, aloof: !!def.aloof, printedAloof: !!def.aloof,
    massive: def.massive, prey: def.prey, forcedDoom: def.forcedDoom, parleyCost: def.parleyCost || 0,
    uniqueCultist: !!def.uniqueCultist, evadeToVictory: !!def.evadeToVictory,
    bearerSeat: isWeaknessCode(code) || def.prey === 'bearer' ? engagedSeat : null,
    drawnBySeat: engagedSeat,
    victory: def.victory || 0, traits: def.traits || [],
    damageTaken: 0, exhausted: false, doom: def.onSpawnDoom || 0,
    location: loc, engagedSeat: null,
  }
  if (temporary) return enemy
  state.enemies.push(enemy)
  processPlayerEnemyEntry(state, enemy, [], true)
  if (!state.enemies.includes(enemy)) return enemy
  scenarioBehavior(state).enemySpawned?.(state, enemy, scenarioRuntime(state, []))
  for (const inv of aliveInvestigators(state)) {
    if (inv.location === enemy.location) triggerReaction(state, inv.seat, 'enemySpawn', [], { enemy, location: enemy.location })
  }
  // Reaction events (e.g. Think on Your Feet) are played from hand on the same
  // window; the enemy still spawns at the original location.
  reactionWindow(state, 'enemySpawn', { when: 'enemySpawn', seat: engagedSeat ?? leadDecisionSeat(state),
    location: loc, enemy }, [])
  if (state.enemies.includes(enemy) && !enemy.exhausted && !enemy.aloof && !enemy.massive && engagedSeat != null && state.investigators[engagedSeat]?.location === loc) engageEnemy(state, enemy, engagedSeat)
  return enemy
}

function processPlayerEnemyEntry(state, enemy, events, spawned = false) {
  const attachments = state.playerLocationAttachments || []
  enemy.hidingSpotAloof = !enemy.elite && attachments.some(item => item.code === '03038' && item.location === enemy.location)
  enemy.aloof = !!enemy.printedAloof || enemy.hidingSpotAloof
  const ambush = spawned && attachments.find(item => item.code === '03148' && item.location === enemy.location)
  if (ambush) {
    removeOne(attachments, ambush)
    state.investigators[ambush.ownerSeat]?.discard.push(ambush.code)
    enemy.defeatedBy = ambush.ownerSeat
    damageEnemy(state, enemy, 2, ambush.ownerSeat, events)
  }
  if (!state.enemies.includes(enemy)) return
  const snare = attachments.find(item => item.code === '03199' && item.location === enemy.location && !enemy.elite)
  if (snare) {
    removeOne(attachments, snare)
    enemy.exhausted = true
    disengageEnemy(state, enemy)
    enemy.snareTrap = snare
  }
}

function locationExists(state, id) {
  return state.locations.some((l) => l.id === id)
}

function investigatorEntryError(state, locationId, seat = state.currentSeat) {
  const location = state.locations.find(loc => loc.id === locationId)
  if (!location) return '目标地点未入场'
  const inv = state.investigators[seat]
  if (inv?.steamImmobileRound === state.round) return '本轮受到蒸汽之爪影响，不能移动'
  if (inv && state.enemies.some(enemy => enemy.code === '02182' && enemy.engagedSeat === seat && !enemyTextBlanked(state, enemy))) return '与攫取恐怖交战时不能移动'
  return scenarioBehavior(state).investigatorEntryError?.(state, location, inv) || null
}

function remainingHealth(inv) {
  return getMaxHealth(inv) - inv.damage
}

function remainingSanity(inv) {
  return getMaxSanity(inv) - inv.horror
}

// 与某调查员交战的敌人（含庞大敌人：与所在地点所有调查员交战）。
function enemiesEngagedWith(state, inv) {
  return state.enemies.filter((e) => e.engagedSeat === inv.seat || (e.massive && !enemyTextBlanked(state, e) && e.location === inv.location))
}

// 猎物（prey）排序：数值越小越优先，便于统一计算并列集合。
const PREY_RANK = {
  highestIntellect: (state, inv) => -getStat(state, inv, 'intellect'),
  lowestIntellect: (state, inv) => getStat(state, inv, 'intellect'),
  lowestWillpower: (state, inv) => getStat(state, inv, 'willpower'),
  highestCombat: (state, inv) => -getStat(state, inv, 'combat'),
  lowestHealth: (state, inv) => remainingHealth(inv),
  mostClues: (state, inv) => -invClues(inv),
  mostHorror: (state, inv) => -inv.horror,
  lowestSanity: (state, inv) => getMaxSanity(inv) - inv.horror,
  lowestAgility: (state, inv) => getStat(state, inv, 'agility'),
  lowestCombat: (state, inv) => getStat(state, inv, 'combat'),
  fewestHand: (state, inv) => inv.hand.length,
}

// 从多个合法对象中取唯一项；出现并列时按规则交给指定座位显式选择。
function chooseAmong(state, { kind, source, seat, prompt, options }) {
  if (!options.length) return null
  if (options.length === 1) return options[0].id
  return requestChoice(state, { kind, source, seat, prompt, options })
}

// 猎物（prey）目标。
function preyTarget(state, enemy, candidates) {
  if (!candidates.length) return null
  if (enemy.prey === 'bearer' && !enemyTextBlanked(state, enemy)) {
    const bearer = enemy.bearerSeat
    const inv = bearer != null ? state.investigators[bearer] : null
    if (inv && inv.location === enemy.location && !inv.defeated && !inv.resigned) return inv.seat
    return null
  }
  const rank = !enemyTextBlanked(state, enemy) && PREY_RANK[enemy.prey]
  let pool = candidates
  if (rank) {
    const scores = candidates.map(seat => rank(state, state.investigators[seat]))
    const best = Math.min(...scores)
    pool = candidates.filter((_, index) => scores[index] === best)
  }
  const answer = chooseAmong(state, {
    kind: 'prey', source: { type: 'enemy', id: enemy.id, code: enemy.code }, seat: leadDecisionSeat(state),
    prompt: `选择「${enemy.name}」的猎物（${describePrey(enemy.prey) || '任意调查员'}并列）。`,
    options: pool.map(seat => ({ id: String(seat), label: state.investigators[seat].name })),
  })
  return answer == null ? null : Number(answer)
}

function invClues(inv) {
  return inv.clues || 0
}

function syncClues(state) {
  state.clues = state.investigators.reduce((sum, inv) => sum + inv.clues, 0)
}

function spendClues(state, inv, amount) {
  if (!Number.isInteger(amount) || amount < 0 || inv.clues < amount) throw new Error('个人线索不足')
  inv.clues -= amount
  syncClues(state)
}

function groupClues(state, location) {
  return aliveInvestigators(state).filter(inv => canSpendClues(state, inv)).filter(inv => !location || inv.location === location).reduce((sum, inv) => sum + inv.clues, 0)
}

function groupPayment(state, amount, location, events) {
  const payers = aliveInvestigators(state).filter(inv => canSpendClues(state, inv)).filter(inv => !location || inv.location === location)
  if (groupClues(state, location) < amount) throw new Error('符合地点条件的共同线索不足')
  let remaining = amount
  for (let i = 0; remaining; i++) {
    const inv = payers[i % payers.length]
    if (!inv.clues) continue
    const min = 1
    const max = Math.min(remaining, inv.clues)
    const options = Array.from({ length: max - min + 1 }, (_, offset) => ({ id: String(min + offset), label: `支付 ${min + offset} 个线索` }))
    const round = Math.floor(i / payers.length) + 1
    const answer = requestChoice(state, { kind: 'payment', source: 'group-clues', seat: inv.seat,
      prompt: `第 ${round} 轮分摊 · 共同支付还需 ${remaining} 个线索，请决定个人贡献。`, options,
      payment: { required: amount, remaining, paid: amount - remaining, round, min, max, available: inv.clues } })
    const paid = Number(answer)
    spendClues(state, inv, paid)
    remaining -= paid
    info(state, events, `${inv.name} 支付 ${paid} 个线索。`)
  }
}

function engageEnemy(state, enemy, seat, events = []) {
  if (enemy.engagedSeat === seat) return
  if (enemy.engagedSeat != null) {
    const old = state.investigators[enemy.engagedSeat]
    if (old) removeOne(old.engaged, enemy.id)
  }
  enemy.engagedSeat = seat
  const inv = state.investigators[seat]
  if (inv && !inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
  if (inv && !enemyTextBlanked(state, enemy)) {
    scenarioBehavior(state).enemyEngaged?.(state, enemy, inv, scenarioRuntime(state, events))
  }
  if (inv && state.enemies.includes(enemy)) triggerReaction(state, seat, 'enemyEngaged', events, { enemy })
  if (inv && enemy.code === 'youngDeepOne' && !enemyTextBlanked(state, enemy)) {
    info(state, events, `😱 「${enemy.name}」交战强制：${inv.name} 受到 1 点恐惧。`)
    applyHorror(state, inv, 1, events)
  }
}

function disengageEnemy(state, enemy) {
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) removeOne(inv.engaged, enemy.id)
  }
  enemy.engagedSeat = null
}

function discardEnemyCard(state, enemy) {
  disengageEnemy(state, enemy)
  removeOne(state.enemies, enemy)
  const owner = state.investigators[enemy.bearerSeat]
  if (isWeaknessCode(enemy.code) && owner) owner.discard.push(enemy.code)
  else state.encounterDiscard.push(enemy.code)
  scenarioBehavior(state).enemyDiscarded?.(state, enemy, scenarioRuntime(state, []))
}

function defeatEnemy(state, enemy, events) {
  const defeatedBy = enemy.defeatedBy ?? enemy.engagedSeat
  if (enemy.bindMonster) {
    state.investigators[enemy.bindMonster.ownerSeat]?.discard.push(enemy.bindMonster.code)
    delete enemy.bindMonster
  }
  removeOne(state.enemies, enemy)
  if (enemy.smiteTheWickedSeat != null) state.investigators[enemy.smiteTheWickedSeat]?.discard.push('02007')
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) removeOne(inv.engaged, enemy.id)
  }
  if (EFFECTS[enemy.code]?.enemyWeakness?.shuffleIntoDeckOnDefeat) {
    const owner = state.investigators[enemy.bearerSeat]
    if (owner) owner.deck = shuffle([...owner.deck, enemy.code], () => randomValue(state))
    info(state, events, `「${enemy.name}」将被击败时改为洗回其承受者的牌库。`)
    return
  }
  // "When defeated" forced effects resolve before "after defeated" reactions.
  if (!enemyTextBlanked(state, enemy) && enemy.code === 'goatSpawn') {
    for (const inv of aliveInvestigators(state).filter(inv=>inv.location===enemy.location)) {
      info(state, events, `😱 「${enemy.name}」的临死反噬：${inv.name} 受到 1 点恐惧。`)
      applyHorror(state, inv, 1, events)
    }
  }
  if ((enemy.originalCode || enemy.code) === '03059') {
    state.campaign.records.chasingTheStranger =
      Number(state.campaign.records.chasingTheStranger || 0) + 1
  }
  const replaced = scenarioBehavior(state).enemyDefeated?.(state, enemy, scenarioRuntime(state, events))
  if (!replaced) addVictory(state, enemy, events)
  if (!enemy.victory) info(state, events, `💥 「${enemy.name}」被击败了！`)
  ;(state._resolution?.events || events)?.push({
    type: 'agentSignal', kind: 'enemyDefeated', seat: defeatedBy,
    enemyId: enemy.id, name: enemy.name, investigatorName: state.investigators[defeatedBy]?.name || null,
  })
  if (defeatedBy != null) {
    triggerReaction(state, defeatedBy, 'defeatEnemy', events, { enemy, location: enemy.location })
    reactionWindow(state, 'defeatEnemy', {
      when: 'defeatEnemy', seat: defeatedBy, location: enemy.location, enemy,
      prompt: `「${enemy.name}」被击败后`,
    }, events)
  }
  checkAct(state, events)
  checkAgendaForcedEnemyDefeated(state, enemy, events)
}

function damageEnemy(state, enemy, amount, seat, events, source = null) {
  if (!enemy || !(amount > 0) || (enemy.code === '02255' && source !== '02254' && !enemyTextBlanked(state, enemy))) return false
  if (!enemyTextBlanked(state, enemy)
    && scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, source, seat) === false) return false
  enemy.damageTaken = (enemy.damageTaken || 0) + amount
  enemy.defeatedBy = seat
  scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events))
  if (enemy.damageTaken >= enemyHealthValue(state, enemy)
    && scenarioBehavior(state).enemyCanBeDefeated?.(state, enemy, source, seat) !== false) defeatEnemy(state, enemy, events)
  return true
}

// 胜利点 + 独特异教徒盘问记录。
function addVictory(state, enemy, events) {
  const originalCode = enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code
  if (Object.hasOwn(ALL_CARDS[originalCode] || {}, 'victory') || enemy.victory > 0 || enemy.uniqueCultist) {
    if (!state.victoryDisplay.some(card => card.id === enemy.id)) state.victoryDisplay.push({
      id: enemy.id, code: enemy.code, originalCode, victory: enemy.victory || 0,
    })
  } else if (isWeaknessCode(enemy.code)) {
    const owner = state.investigators[enemy.bearerSeat]
    if (!owner) throw new Error('弱点敌人缺少牌组归属')
    owner.discard.push(enemy.code)
  } else state.encounterDiscard.push(enemy.code)
  if (enemy.victory) {
    state.victory += enemy.victory
    info(state, events, `💥 「${enemy.name}」被击败了！胜利点 +${enemy.victory}（累计 ${state.victory}）。`)
  }
  if (enemy.uniqueCultist && !state.cultistsInVictory.includes(enemy.code)) {
    state.cultistsInVictory.push(enemy.code)
    info(state, events, `🕵️ 「${enemy.name}」被盘问/击败，加入胜利区（${state.cultistsInVictory.length}/6）。`)
  }
}

// 谈判盘问异教徒（午夜假面）。
function interrogateCultist(state, enemy, events) {
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) removeOne(inv.engaged, enemy.id)
  }
  removeOne(state.enemies, enemy)
  addVictory(state, enemy, events)
  checkAct(state, events)
}

function autoEvadeEnemy(state, enemy, events) {
  enemy.exhausted = true
  disengageEnemy(state, enemy)
  info(state, events, `💨 「${enemy.name}」被横置并脱离交战。`)
}

// 冷漠（aloof）敌人不会主动与调查员交战，需由调查员主动交战或攻击。
function engagesAutomatically(state, enemy) {
  return !enemy.exhausted && enemy.engagedSeat == null && (!enemy.massive || enemyTextBlanked(state, enemy)) && (!enemy.aloof || enemyTextBlanked(state, enemy))
}

function autoEngageAt(state, locationId, events = []) {
  for (const enemy of state.enemies) {
    if (enemy.location !== locationId || !engagesAutomatically(state, enemy)) continue
    const here = aliveInvestigators(state).filter((i) => i.location === locationId).map((i) => i.seat)
    const target = preyTarget(state, enemy, here)
    if (target != null) engageEnemy(state, enemy, target, events)
  }
}

function autoEngageAll(state, events) {
  for (const enemy of state.enemies) {
    if (!engagesAutomatically(state, enemy)) continue
    const here = aliveInvestigators(state).filter((i) => i.location === enemy.location).map((i) => i.seat)
    const target = preyTarget(state, enemy, here)
    if (target != null) {
      engageEnemy(state, enemy, target, events)
      info(state, events, `「${enemy.name}」与 ${state.investigators[enemy.engagedSeat]?.name} 交战。`)
    }
  }
}

// ---------------------------------------------------------------------------
// 场景 / 密谋推进
// ---------------------------------------------------------------------------

function advanceAct(state, events) {
  if (state.status !== 'playing') return
  const scBefore = state.scenario
  const cur = state.acts[state.actIndex]
  if (!cur) return
  info(state, events, `翻开场景「${cur.name}」的背面。`, { kind: 'story', title: '场景推进',
    code: cur.originalCode || cur.code, face: 'back', name: cur.name, text: cur.backText || '翻开场景卡，结算背面的剧情与效果。', flip: true })
  if (cur.reveal) runActReveal(state, cur, events)
  // 若 reveal 触发了剧本切换（finishScenario → startScenario），立即返回，避免污染新剧本。
  if (state.scenario !== scBefore || state.status !== 'playing') return
  scenarioBehavior(state).actLeftPlay?.(state, cur, scenarioRuntime(state, events))
  state.actIndex++
  const next = state.acts[state.actIndex]
  if (!next) {
    checkOutcome(state, events)
    return
  }
  info(state, events, `📜 场景推进：${next.stage}「${next.name}」—— ${next.text}`,
    { kind: 'story', title: '新的场景', code: next.originalCode || next.code, name: next.name, text: next.text })
  if (state.status === 'playing') autoEngageAll(state, events)
}

function runActReveal(state, act, events) {
  const r = act.reveal
  if (!r) return
  const scId = state.scenario.id
  switch (r.type) {
    case 'campaignRule':
      if (!scenarioBehavior(state).actReveal) throw new Error(`场景规则尚未迁移：${act.originalCode}`)
      scenarioBehavior(state).actReveal(state, act, scenarioRuntime(state, events))
      break
    case 'openHallway': {
      // 原卡：将放在一边的走廊、地窖、阁楼和客厅放置入场；揭示走廊。
      for (const id of ['hallway', 'cellar', 'attic', 'parlor']) placeLocation(state, id, events)
      const studyEnemies = state.enemies.filter((e) => e.location === 'study')
      for (const e of studyEnemies.slice()) {
        disengageEnemy(state, e)
        removeOne(state.enemies, e)
        const owner = state.investigators[e.bearerSeat]
        if (isWeaknessCode(e.code) && owner) owner.discard.push(e.code)
        else state.encounterDiscard.push(e.code)
      }
      for (const inv of aliveInvestigators(state)) inv.location = 'hallway'
      revealLocation(state, 'hallway', events)
      removeLocation(state, 'study', events)
      info(state, events, '🚪 书房的地板上出现一道暗门！所有人进入「走廊」，书房被移出游戏。')
      break
    }
    case 'revealParlor': {
      placeLocation(state, 'parlor', events)
      revealLocation(state, 'parlor', events)
      spawnStoryAsset(state, '01117', 'parlor', events)
      const boss = spawnEnemy(state, 'ghoulPriest', 'hallway', null)
      if (boss) info(state, events, `👹 首领「${boss.name}」出现在「走廊」！`)
      break
    }
    case 'revealRitualSite': {
      // 地底噬魔场景 1 推进：放置仪式地（若未放），逃跑的异教徒生成于主道路。
      placeLocation(state, 'ritualSite', events)
      const escaped = state.campaign.records.cultistsEscaped || []
      for (const originalCode of escaped) {
        const code = ruleCodeForOriginal(originalCode)
        const enemy = spawnEnemy(state, code, 'mainPath', null, true)
        if (enemy) info(state, events, `👹 逃跑的异教徒「${enemy.name}」出现在「主道路」！`)
      }
      break
    }
    case 'drawEnemyAtRitualSite': {
      // 地底噬魔场景 2 推进：洗回弃牌，弃牌直到翻出敌人（>3 人两次），生成于仪式地。
      if (state.encounterDiscard.length) {
        state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
        state.encounterDiscard = []
      }
      const times = state.numInvestigators >= 3 ? 2 : 1
      for (let k = 0; k < times; k++) {
        const enemy = discardUntilEnemy(state, events)
        if (enemy) {
          const e = spawnEnemy(state, enemy, 'ritualSite', null, true)
          if (e) info(state, events, `👹 「${e.name}」在「仪式地」生成！`)
        }
      }
      break
    }
    case 'resolutionChoice': {
      const resolution = scenarioBehavior(state).houseFateChoice ? requestChoice(state, { kind: 'story', source: act.id, seat: leadDecisionSeat(state),
        prompt: '决定房屋的命运。', options: [{ id: 'r1', label: '烧毁房屋' }, { id: 'r2', label: '保留房屋' }] }) : 'r1'
      finishScenario(state, resolution, events)
      break
    }
    case 'resolution2': finishScenario(state, 'r2', events); break
    default:
      throw new Error(`未实现的场景效果：${r.type}`)
  }
}

function discardUntilEnemy(state, events) {
  const discarded = []
  while (state.encounterDeck.length) {
    const code = state.encounterDeck.pop()
    const def = enemyDef(code)
    if (def) { for (const c of discarded) state.encounterDiscard.push(c); return code }
    discarded.push(code)
  }
  for (const c of discarded) state.encounterDiscard.push(c)
  return null
}

function canAdvanceWithClues(state, roundEnd = false) {
  const obj = state.acts[state.actIndex]?.objective
  if (obj?.type !== 'clues') return false
  const requiresRoundEnd = scenarioBehavior(state).roundEndActIndex === state.actIndex
  if (requiresRoundEnd !== roundEnd) return false
  return aliveInvestigators(state).filter(inv => !obj.atLocation || inv.location === obj.atLocation)
    .reduce((sum, inv) => sum + inv.clues, 0) >= obj.perInvestigator * state.numInvestigators
}

// Only the current act's public objective; never include its unrevealed reverse.
export function actObjectiveContext(state) {
  const obj = state.acts[state.actIndex]?.objective
  if (!obj) return null
  if (obj.type === 'clues') {
    const required = obj.perInvestigator * state.numInvestigators
    const available = groupClues(state)
    const atLocation = groupClues(state, obj.atLocation)
    const roundEnd = scenarioBehavior(state).roundEndActIndex === state.actIndex
    return { type: obj.type, perInvestigator: obj.perInvestigator, investigatorCount: state.numInvestigators,
      requiredClues: required, availableTeamClues: available, eligibleCluesAtLocation: atLocation,
      cluesStillToCollect: Math.max(0, required - available),
      cluesMissingAtLocation: Math.max(0, required - atLocation),
      locationId: obj.atLocation || null, locationName: obj.atLocation ? locName(state, obj.atLocation) : null,
      timing: roundEnd ? 'roundEnd' : 'actionWindow',
      readyForPayment: atLocation >= required,
      instruction: `需要 ${required} 个线索（每位 ${obj.perInvestigator} × 本局 ${state.numInvestigators} 位调查员，败退不降低需求）；`
        + (obj.atLocation ? `由位于「${locName(state, obj.atLocation)}」的在场调查员共同支付；` : '由在场调查员共同支付；')
        + `全队可支付 ${available}，还需收集 ${Math.max(0, required - available)}，符合地点条件的可支付 ${atLocation}。`
        + (roundEnd ? '仅在回合结束时触发支付选择；凑齐后留在指定地点等待该窗口，来回移动不会触发推进。' : '满足条件后使用合法列表中的 advanceAct 推进。') }
  }
  if (obj.type === 'actClues') return { type: obj.type, required: obj.perInvestigator * state.numInvestigators,
    current: state.actClues, instruction: '通过当前合法的破坏仪式行动增加场景上线索；手持线索不等于场景上线索。' }
  if (obj.type === 'enterLocation') return { type: obj.type, locationId: obj.location,
    instruction: `进入「${locName(state, obj.location)}」推进场景；路线以已提供的地图和合法行动为准。` }
  if (obj.type === 'defeatEnemy') return { type: obj.type, enemyCode: obj.enemy,
    instruction: `击败目标敌人：${enemyDef(obj.enemy)?.name || obj.enemy}。` }
  if (obj.type === 'uniqueCultists') return { type: obj.type, required: obj.amount,
    current: state.cultistsInVictory.length, instruction: `将 ${obj.amount} 名独特异教徒加入胜利区。` }
  return { type: obj.type }
}

function payAndAdvanceAct(state, events) {
  const objective = state.acts[state.actIndex].objective
  groupPayment(state, objective.perInvestigator * state.numInvestigators, objective.atLocation, events)
  advanceAct(state, events)
}

// 场景目标判定。
function checkAct(state, events) {
  if (state.status === 'playing') scenarioBehavior(state).checkObjectives?.(state, scenarioRuntime(state, events))
  const act = state.acts[state.actIndex]
  if (!act || state.status !== 'playing') return
  const obj = act.objective
  if (!obj) return
  if (obj.type === 'defeatEnemy') {
    const alive = state.enemies.some((e) => e.code === obj.enemy)
    if (!alive) advanceAct(state, events)
    return
  }
  if (obj.type === 'uniqueCultists') {
    if (state.cultistsInVictory.length >= obj.amount) advanceAct(state, events)
    return
  }
  if (obj.type === 'actClues') {
    const needed = obj.perInvestigator * state.numInvestigators
    if (state.actClues >= needed) advanceAct(state, events)
    return
  }
  if (obj.type === 'clues' && state._roundEndWindow && canAdvanceWithClues(state, true)) {
    const answer = requestChoice(state, { kind: 'act', source: act.id, seat: leadDecisionSeat(state),
      prompt: '回合结束：是否共同支付线索推进场景？', canSkip: true,
      options: [{ id: 'skip', label: '暂不推进' }, { id: 'advance', label: '共同支付并推进' }] })
    if (answer === 'advance') payAndAdvanceAct(state, events)
  }
}

function placeLocation(state, id, events) {
  if (locationExists(state, id)) return
  const base = state.scenario.locations[id]
  if (!base) return
  const def = { ...base, ...(state.locationVariants?.[id] || {}) }
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null ? def.cluesPerInvestigator * state.numInvestigators : (def.clues || 0))
  const revealed = Boolean(scenarioBehavior(state).locationsStartRevealed)
    || state.investigators.some(inv => inv.location === id)
  const loc = { ...def, id, revealed, clues: revealed ? clues : 0, maxClues: clues }
  state.locations.push(loc)
  info(state, events, `📍 「${loc.name}」进入游戏。`)
}

function flipScenarioLocation(state, id, seat, events) {
  const loc = state.locations.find(location => location.id === id)
  if (!loc || loc.cannotFlipAgain) return false
  const api = scenarioRuntime(state, events)
  scenarioBehavior(state).locationWillFlip?.(state, loc, api, seat)
  scenarioBehavior(state).locationStory?.(state, loc, api, seat)
  scenarioBehavior(state).locationFlipped?.(state, loc, api, seat)
  autoEngageAll(state, events)
  info(state, events, `「${loc.name}」完成翻面结算。`, locationRevealCue(loc, false, seat))
  return true
}

function revealLocation(state, id, events, seat = null) {
  const loc = state.locations.find((l) => l.id === id)
  if (loc && !loc.revealed) {
    loc.revealed = true
    if (loc.unrevealedActualName) { loc.name = loc.unrevealedActualName; delete loc.unrevealedActualName }
    delete loc.hiddenIdentity
    delete loc.artCode
    const clueOverride = scenarioBehavior(state).cluesOnReveal?.(state, loc, seat == null ? null : state.investigators[seat])
    loc.clues = Math.max(0, clueOverride ?? (loc.maxClues || 0))
    info(state, events, `「${loc.name}」被揭示。`, locationRevealCue(loc, false, seat))
    const ignored = seat != null
      && scenarioBehavior(state).ignoreLocationRevealText?.(state, state.investigators[seat], loc)
    if (!ignored) scenarioBehavior(state).locationRevealed?.(state, loc, scenarioRuntime(state, events), seat)
  }
}

function locationRevealCue(loc, entered = false, seat = null) {
  const code = loc.originalCode || loc.code, card = cardDef(code)
  return { kind: 'location', seat, location: loc.id, code, name: loc.name, title: entered ? '进入地点' : '地点揭示',
    flip: !entered, shroud: loc.shroud, clues: loc.clues, onEnter: loc.onEnter,
    text: card?.textZh || card?.text || loc.text || '此地点没有额外的卡面效果。' }
}

function removeLocation(state, id, events) {
  const i = state.locations.findIndex((l) => l.id === id)
  if (i >= 0) {
    const destination = state.locations.find(loc => loc.originalCode === '02320' && loc.id !== id)
    const departing = destination ? aliveInvestigators(state).filter(inv => inv.location === id) : []
    if (destination) {
      const companions = state.enemies.filter(enemy => enemy.location === id && departing.some(inv => inv.seat === enemy.engagedSeat))
      for (const inv of departing) inv.location = destination.id
      for (const enemy of state.enemies.filter(enemy => enemy.location === id)) {
        enemy.location = destination.id
        scenarioBehavior(state).enemyMoved?.(state, enemy, id, scenarioRuntime(state, events), enemy.engagedSeat)
      }
      for (const inv of departing) scenarioBehavior(state).locationEntered?.(state, inv, destination, scenarioRuntime(state, events), companions.map(enemy => enemy.id))
      autoEngageAt(state, destination.id, events)
    }
    const [loc] = state.locations.splice(i, 1)
    for (const attachment of loc.attachments || []) {
      const code = typeof attachment === 'string' ? attachment : attachment?.code
      if (code && ALL_TREACHERIES[code]) state.encounterDiscard.push(code)
    }
    discardBarricades(state, loc)
    state.encounterDiscard.push(...Array(loc.arcaneBarriers || 0).fill('02102'), ...Array(loc.sordidAndSilent || 0).fill('02089'))
    info(state, events, `📍 「${loc.name}」被移出游戏。`)
    for (const inv of departing) scenarioBehavior(state).investigatorMovedByEncounterCard?.(state, inv, scenarioRuntime(state, events))
  }
}

function spawnStoryAsset(state, code, locationId, events) {
  const def = ALL_STORY_ASSETS[code]
  if (!def || !locationExists(state, locationId)) return
  state.storyAssets ||= []
  if (state.storyAssets.some(asset => asset.code === code)
      || state.investigators.some(inv => inv.assets.some(asset => asset.code === code))) return
  const asset = newCardInstance(state, code, { exhausted: false, location: locationId, controllerSeat: null })
  state.storyAssets.push(asset)
  info(state, events, `剧情资产「${def.name}」出现在「${locName(state, locationId)}」，尚无人控制。`)
}

function advanceAgenda(state, events, reason = 'objective') {
  if (state.status !== 'playing') return
  if (reason === 'doom' && scenarioBehavior(state).agendaWouldAdvance?.(state, scenarioRuntime(state, events))) return
  const scBefore = state.scenario
  for (;;) {
    const cur = state.agendas[state.agendaIndex]
    if (!cur) return
    scenarioBehavior(state).agendaAdvancing?.(state, cur, scenarioRuntime(state, events))
    info(state, events, `翻开密谋「${cur.name}」的背面。`, { kind: 'story', title: '密谋推进',
      code: cur.originalCode || cur.code, face: 'back', name: cur.name, text: cur.backText || '翻开密谋，结算背面的剧情与效果。', flip: true })
    // Only the agenda's own doom is discarded; doom on enemies/locations/assets
    // stays in play (Rules Reference, "Doom").
    state.doom = 0
    scenarioBehavior(state).doomCleared?.(state, scenarioRuntime(state, events))
    if (cur.reveal) runAgendaReveal(state, cur, events)
    // 若 reveal 触发了剧本切换，立即返回。
    if (state.scenario !== scBefore || state.status !== 'playing') return
    if (state.agendas[state.agendaIndex] !== cur) return
    scenarioBehavior(state).agendaLeftPlay?.(state, cur, scenarioRuntime(state, events))
    state.agendaIndex++
    const next = state.agendas[state.agendaIndex]
    if (!next) {
      checkOutcome(state, events)
      return
    }
    info(state, events, `🌑 密谋推进：${next.stage}「${next.name}」—— ${next.text}`,
      { kind: 'story', title: '新的密谋', code: next.originalCode || next.code, name: next.name, text: next.text })
    if (state.status === 'playing') autoEngageAll(state, events)
    // "Advance directly to 2b": flip the newly revealed agenda immediately.
    if (!scenarioBehavior(state).agendaChain?.(state, next, scenarioRuntime(state, events))) return
  }
}

function runAgendaReveal(state, ag, events) {
  const r = ag.reveal
  if (!r) return
  const scId = state.scenario.id
  switch (r.type) {
    case 'campaignRule':
      if (!scenarioBehavior(state).agendaReveal) throw new Error(`密谋规则尚未迁移：${ag.originalCode}`)
      scenarioBehavior(state).agendaReveal(state, ag, scenarioRuntime(state, events))
      break
    case 'agenda1Reveal': {
      const lead = state.investigators[state.campaign.leadSeat] && !state.investigators[state.campaign.leadSeat].defeated
        && !state.investigators[state.campaign.leadSeat].resigned
        ? state.investigators[state.campaign.leadSeat] : state.investigators[firstAliveSeat(state)]
      if (!lead) break
      // Both options are always legal; with empty hands the discard branch simply
      // does nothing, so the lead investigator may still choose it.
      const options = [{ id: 'discard', label: '每位调查员随机弃掉 1 张手牌' },
        { id: 'horror', label: '队长受到 2 点恐惧' }]
      const answer = requestChoice(state, {
        kind: 'agenda', source: ag.id, seat: leadDecisionSeat(state),
        prompt: '到底发生了什么？！队长必须选择一项。', options,
      })
      if (answer === 'discard') {
        for (const inv of aliveInvestigators(state)) {
          if (!inv.hand.length) continue
          info(state, events, `🎲 ${inv.name} 随机弃掉 1 张手牌。`)
          discardRandomFromHand(state, inv, 1, events)
        }
      } else {
        info(state, events, `😱 ${lead.name} 作为队长受到 2 点恐惧（密谋 1 揭示）。`)
        applyHorror(state, lead, 2, events)
      }
      break
    }
    case 'agenda2Reveal': {
      if (state.encounterDiscard.length) {
        state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
        state.encounterDiscard = []
      }
      const lead = state.investigators[state.campaign.leadSeat]
      const ghoul = discardUntilEnemyTrait(state, 'ghoul', events)
      if (ghoul && lead) {
        const enemy = spawnEnemy(state, ghoul, lead.location, lead.seat)
        if (enemy) info(state, events, `👹 密谋 2 揭示：「${enemy.name}」被引出，与 ${lead.name} 交战！`)
      } else {
        info(state, events, '密谋 2 揭示：遭遇牌库中没有食尸鬼敌人。')
      }
      break
    }
    case 'agenda3Reveal': {
      if (state.actIndex <= 1) {
        info(state, events, '☠️ 食尸鬼们破墙而出！调查队被团团包围，无处可逃……')
        defeatAll(state, events)
        finishScenario(state, 'r3', events)
      } else {
        // 01107 背面：若已推进到场景 3，未撤退的调查员被击败并各承受 1 点肉体创伤。
        for (const inv of aliveInvestigators(state)) {
          inv.defeated = true
          inv.defeatCause = 'damage'
          eliminateInvestigator(state, inv, events)
        }
        info(state, events, '🏃 你们在食尸鬼涌出前逃出了房子，但未撤退的调查员被击败。')
        finishScenario(state, 'noResolution', events)
      }
      break
    }
    case 'spawnMaskedHunter': {
      // 午夜假面密谋 1：生成假面猎手并与猎物交战。
      const target = maskedHunterPrey(state)
      const enemy = spawnEnemy(state, 'theMaskedHunter', target != null ? state.investigators[target].location : state.scenario.startLocation, target)
      if (enemy) info(state, events, `👹 「${enemy.name}」现身，与 ${target != null ? state.investigators[target].name : '无人'} 交战！`)
      break
    }
    case 'resolution2': {
      finishScenario(state, 'r2', events)
      break
    }
    case 'drawMonsterAtMainPath': {
      // 地底噬魔密谋 1：洗回弃牌，弃牌直到翻出怪物敌人，生成于主道路 + 1 毁灭。
      if (state.encounterDiscard.length) {
        state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
        state.encounterDiscard = []
      }
      const code = discardUntilEnemyTrait(state, 'monster', events)
      if (code) {
        const enemy = spawnEnemy(state, code, 'mainPath', null, true)
        if (enemy) {
          enemy.doom = (enemy.doom || 0) + 1
          info(state, events, `👹 「${enemy.name}」在「主道路」生成，并放置 1 点毁灭。`)
        }
      }
      break
    }
    case 'madnessTest': {
      // 地底噬魔密谋 2：每位调查员意志(6)检定，失败从基础弱点池加入一张疯狂弱点。
      const pool = basicWeaknessPool().filter(code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'madness'))
      if (!pool.length) throw new Error('疯狂弱点依赖缺失')
      for (const inv of aliveInvestigators(state)) {
        performTest(state, inv.seat, 'willpower', 6, { source: { label: '密谋结算', name: '疯狂侵蚀' }, resolve: r => {
          if (r.success) {
            info(state, events, `✔️ ${inv.name} 通过意志检定，未被疯狂侵蚀。`)
          } else {
            const code = pool[Math.floor(randomValue(state) * pool.length)]
            inv.hand.push(code)
            info(state, events, `❌ ${inv.name} 意志检定失败，获得疯狂弱点「${cardName(code)}」。`)
          }
        } })
      }
      break
    }
    case 'spawnUmordhoth': {
      // 地底噬魔密谋 3：放置仪式地（或在仪式地清理敌人），生成乌默尔多斯。
      if (locationExists(state, 'ritualSite')) {
        for (const e of state.enemies.filter((x) => x.location === 'ritualSite').slice()) {
          removeOne(state.enemies, e)
          if (e.engagedSeat != null) {
            const target = state.investigators[e.engagedSeat]
            if (target) removeOne(target.engaged, e.id)
          }
          if (isWeaknessCode(e.code)) state.investigators[e.bearerSeat].discard.push(e.code)
          else state.encounterDiscard.push(e.code)
          info(state, events, `♻️ 「${e.name}」因仪式地让位于乌默尔多斯而进入遭遇弃牌堆。`)
        }
      } else {
        placeLocation(state, 'ritualSite', events)
      }
      const boss = spawnEnemy(state, 'umordhoth', 'ritualSite', null)
      if (boss) info(state, events, `👹 古神「${boss.name}」降临于「仪式地」！`)
      // 3b replaces both decks. Its objective remains in play until the Ancient
      // One is defeated; the old ritual objective can no longer be completed.
      const final = { ...ag, name: '地底噬魔', stage: '3b', face: 'back', doomThreshold: null, reveal: null,
        text: '目标 — 如果乌默尔多斯被击败，推进至结局 2。' }
      state.agendas = [final]; state.agendaIndex = 0
      state.acts = [{ ...final, id: 'finalObjective', objective: { type: 'defeatEnemy', enemy: 'umordhoth' },
        reveal: { type: 'resolution2' } }]; state.actIndex = 0
      autoEngageAll(state, events)
      break
    }
    default:
      throw new Error(`未实现的密谋效果：${r.type}`)
  }
}

function maskedHunterPrey(state) {
  const living = aliveInvestigators(state)
  if (!living.length) return null
  return preyTarget(state, { code: 'theMaskedHunter', name: '假面猎手', prey: 'mostClues' }, living.map(inv => inv.seat))
}

function discardUntilEnemyFromEncounter(state, seat, predicate, events) {
  const discarded = []
  let found = null
  while (state.encounterDeck.length) {
    const code = state.encounterDeck.pop()
    const def = enemyDef(code)
    if (def && predicate(def, code)) { found = code; break }
    discarded.push(code)
  }
  for (const c of discarded) state.encounterDiscard.push(c)
  return found
}

// A normal investigate test without automatic clue discovery. Scenario actions
// that replace the discovery step use this so investigate bonuses, reaction
// windows and symbol handling still apply.
function investigateTest(state, seat, options = {}, events) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === (options.locationId || inv.location))
  if (!loc) return null
  const skill = loc.investigateSkill || 'intellect'
  const difficulty = loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0)
  return performTest(state, seat, skill, difficulty, {
    source: { label: '调查', name: loc.name, code: loc.originalCode || loc.code },
    skillBonus: skill === 'intellect' ? investigateBonus(inv) : 0,
    resolve: r => {
      if (r.success) {
        triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
        options.onSuccess?.(r, loc)
      } else {
        reactionWindow(state, 'investigateFail', { when: 'investigateFail', seat, location: loc.id,
          failedBy: Math.max(0, difficulty - r.value), prompt: '调查检定失败后' }, events)
        options.onFail?.(r, loc)
      }
    },
  })
}

function notifyCluesRemoved(state, loc, amount, events) {
  if (!loc || amount <= 0) return
  scenarioBehavior(state).cluesRemoved?.(state, loc, amount, scenarioRuntime(state, events))
}

function discardUntilEnemyTrait(state, trait, events) {
  const t = (trait || '').toLowerCase()
  const discarded = []
  while (state.encounterDeck.length) {
    const code = state.encounterDeck.pop()
    const def = enemyDef(code)
    if (def && (def.traits || []).some((x) => x.toLowerCase() === t)) {
      for (const c of discarded) state.encounterDiscard.push(c)
      return code
    }
    discarded.push(code)
  }
  for (const c of discarded) state.encounterDiscard.push(c)
  return null
}

function checkAgenda(state, events) {
  const ag = state.agendas[state.agendaIndex]
  if (!ag || ag.doomThreshold == null || state.status !== 'playing') return
  // Only doom on the current agenda advances it. Doom on enemies/locations/assets
  // stays in play when the agenda advances (see rules-state.js).
  if (agendaDoom(state) >= ag.doomThreshold) advanceAgenda(state, events, 'doom')
}

function checkAgendaForcedEnemyDefeated(state, enemy, events) {
  const ag = state.agendas[state.agendaIndex]
  if (!ag || !ag.forced || !ag.forced.enemyDefeated) return
  const f = ag.forced.enemyDefeated
  if (f.type === 'umordhothDefeated' && enemy.code === 'umordhoth') {
    finishScenario(state, 'r2', events)
  }
}

function addDoom(state, amount, events) {
  state.doom += amount
  info(state, events, `🌑 密谋上增加 ${amount} 点毁灭（当前 ${state.doom}）。`)
  checkAgenda(state, events)
}

// ---------------------------------------------------------------------------
// 阶段机（神话 → 调查（3 行动）→ 敌人（猎手移动→交战→攻击）→ 重整）
// ---------------------------------------------------------------------------

function runMythos(state, repeated = false) {
  const events = []
  state.phase = 'mythos'
  if (!repeated) state.round += 1
  state.doom += 1
  info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：密谋上放置 1 点毁灭（当前 ${state.doom}）。`,
    { kind: 'phase', phase: 'mythos', round: state.round, text: `密谋增加 1 点毁灭 · 当前 ${state.doom}`, effect: 'doom', delta: 1 })
  phaseBeginningWindow(state, events)
  checkAgenda(state, events)
  if (state.status !== 'playing') return events
  for (const inv of aliveInvestigators(state)) {
    drawEncounter(state, inv, events)
  }
  playerWindow(state, 'mythos.afterEncounter', events)
  // 神话阶段结束强制：数据中的 mythosEndDoom。
  for (const enemy of state.enemies.slice()) {
    const doom = enemyTextBlanked(state, enemy) ? 0 : enemyDef(enemy.code)?.mythosEndDoom || 0
    if (doom > 0) {
      enemy.doom = (enemy.doom || 0) + doom
      info(state, events, `🌑 「${enemy.name}」上放置 ${doom} 点毁灭（当前 ${enemy.doom}）。`)
    }
  }
  for (const inv of aliveInvestigators(state)) {
    for (const asset of inv.assets.slice()) {
      if (!assetEffect(inv, asset)?.forcedMythosEndDiscard) continue
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      info(state, events, `🌑 「${cardName(asset.code)}」在神话阶段结束时被弃掉。`)
    }
  }
  return events
}

function enemyPhase(state) {
  const events = []
  state.phase = 'enemy'
  state.fogMod = 0
  info(state, events, '⚔️ 敌人阶段……', { kind: 'phase', phase: 'enemy', round: state.round, text: '猎手移动 · 交战 · 敌人攻击' })
  phaseBeginningWindow(state, events)
  scenarioBehavior(state).enemyPhaseStart?.(state, scenarioRuntime(state, events))
  reactionWindow(state, 'enemyPhaseBegins', { when: 'enemyPhaseBegins', prompt: '敌人阶段开始' }, events)

  // 1) 猎手移动
  for (const enemy of state.enemies.slice()) {
    if (!enemy.hunter || enemyTextBlanked(state, enemy) || enemy.engagedSeat != null || enemy.exhausted) continue
    if (aliveInvestigators(state).some((inv) => inv.location === enemy.location && (enemy.prey !== 'bearer' || inv.seat === enemy.bearerSeat))) continue
    if (scenarioBehavior(state).hunterMove?.(state, enemy, scenarioRuntime(state, events))) continue
    const target = hunterStep(state, enemy)
    if (target && target !== enemy.location) {
      const prev = enemy.location
      relocateEnemy(state, enemy, target, events)
      info(state, events, `「${enemy.name}」从「${locName(state, prev)}」移动到「${locName(state, target)}」。`, {
        kind: 'automatic', phase: 'enemy', round: state.round, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code,
        name: enemy.name, text: `${enemy.name}：${locName(state, prev)} → ${locName(state, target)}`, effect: 'hunter', enemyId: enemy.id, from: prev, to: target, location: target })
    }
  }
  autoEngageAll(state, events)
  playerWindow(state, 'enemy.afterHunters', events)

  // Resolve each investigator's attacks in their chosen order. Massive enemies
  // attack every eligible investigator before exhausting.
  const attacked = new Set()
  const seats = [...aliveInvestigators(state)].sort((a,b) =>
    (a.seat - state.campaign.leadSeat + state.numInvestigators) % state.numInvestigators -
    (b.seat - state.campaign.leadSeat + state.numInvestigators) % state.numInvestigators)
  for (const inv of seats) {
    const pending = enemiesEngagedWith(state, inv)
      .filter(e => !e.exhausted && e.skipAttackRound !== state.round)
      .map(e => e.id)
    while (pending.length && !inv.defeated && !inv.resigned) {
      const candidates = pending.map(id => state.enemies.find(e => e.id === id)).filter(e => e && !e.exhausted)
      if (!candidates.length) break
      const enemy = chooseAttack(state, inv, candidates, 'enemyPhase')
      pending.splice(pending.indexOf(enemy.id), 1)
      if (inv.onTheLam && !enemy.elite) continue
      if (inv.infighting?.round === state.round && inv.infighting?.phase === 'enemy' && !enemy.elite) {
        info(state, events, `🥊 「内讧」取消了「${enemy.name}」对 ${inv.name} 的攻击。`)
        continue
      }
      const resolved = enemyAttack(state, enemy, inv, events)
      attacked.add(enemy.id)
      if (!enemy.massive) enemy.exhausted = true
      checkDefeated(state, inv.seat, events)
      if (state.status !== 'playing') return events
    }
  }
  for (const enemy of state.enemies) if (attacked.has(enemy.id)) enemy.exhausted = true
  playerWindow(state, 'enemy.afterAttacks', events)
  for (const attachment of (state.playerLocationAttachments || []).slice()) {
    const location = attachment.location
    const owner = state.investigators[attachment.ownerSeat]
    if (attachment.code === '03038'
      && state.enemies.some(enemy => enemy.location === location && !enemy.exhausted)) {
      removeOne(state.playerLocationAttachments, attachment)
      owner?.discard.push(attachment.code)
      info(state, events, `「藏身地点」在敌人阶段结束时被弃置。`)
    }
    if (attachment.code === '03148'
      && !aliveInvestigators(state).some(inv => inv.location === location)) {
      removeOne(state.playerLocationAttachments, attachment)
      owner?.discard.push(attachment.code)
      info(state, events, `「埋伏」的附属地点没有调查员，被弃置。`)
    }
  }

  // 3) 密谋 3 强制（集结：敌人阶段结束食尸鬼向客厅移动）
  runAgendaForced(state, 'enemyPhaseEnd', events)
  scenarioBehavior(state).enemyPhaseEnd?.(state, scenarioRuntime(state, events))
  return events
}

function runAgendaForced(state, when, events) {
  const ag = state.agendas[state.agendaIndex]
  if (!ag || !ag.forced || !ag.forced[when]) return
  const f = ag.forced[when]
  if (f.type === 'ghoulsMoveToParlor') {
    for (const enemy of state.enemies) {
      if (enemy.engagedSeat != null) continue
      const isGhoul = (enemy.traits || []).some((t) => t.toLowerCase() === 'ghoul')
      if (!isGhoul) continue
      const dest = stepToward(state, enemy.location, 'parlor')
      if (dest && dest !== enemy.location) {
        const prev = enemy.location
        relocateEnemy(state, enemy, dest, events)
        info(state, events, `「${enemy.name}」向客厅移动（${locName(state, prev)} → ${locName(state, dest)}）。`)
      }
    }
    autoEngageAll(state, events)
  } else if (f.type === 'doomPerGhoulAtParlorHallway') {
    const n = state.enemies.filter((e) => ['parlor', 'hallway'].includes(e.location) && (e.traits || []).some((t) => t.toLowerCase() === 'ghoul')).length
    if (n > 0) {
      info(state, events, `🌑 密谋 3 强制：走廊/客厅有 ${n} 个食尸鬼，放置 ${n} 点毁灭。`)
      addDoom(state, n, events)
    }
  }
}

function stepToward(state, fromId, toId) {
  if (fromId === toId) return fromId
  const from = state.locations.find((l) => l.id === fromId)
  if (!from) return null
  if (from.connections.includes(toId)) return toId
  const q = [{ id: fromId, first: null }]
  const seen = new Set([fromId])
  while (q.length) {
    const cur = q.shift()
    const loc = state.locations.find((l) => l.id === cur.id)
    for (const nb of (loc ? loc.connections : [])) {
      if (seen.has(nb)) continue
      if (nb === toId) return cur.first || nb
      seen.add(nb)
      q.push({ id: nb, first: cur.first || nb })
    }
  }
  return null
}

function distanceToInvestigator(state, fromId, targetInvestigators = aliveInvestigators(state)) {
  const targets = new Set(targetInvestigators.map((i) => i.location))
  if (targets.has(fromId)) return 0
  const seen = new Set([fromId])
  const queue = [{ id: fromId, distance: 0 }]
  while (queue.length) {
    const cur = queue.shift()
    const loc = state.locations.find((l) => l.id === cur.id)
    for (const nb of (loc ? loc.connections : [])) {
      if (seen.has(nb) || !state.locations.some((l) => l.id === nb)) continue
      if (targets.has(nb)) return cur.distance + 1
      seen.add(nb)
      queue.push({ id: nb, distance: cur.distance + 1 })
    }
  }
  return Infinity
}

// 猎手移动一步：取距离最近调查员最短的相邻地点，等距路线由队长选择。
function hunterStep(state, enemy) {
  const loc = state.locations.find((l) => l.id === enemy.location)
  const extraConnections = scenarioBehavior(state).enemyConnections?.(state, enemy, loc) || []
  const neighbours = [...new Set([...(loc ? loc.connections : []), ...extraConnections])].filter((id) => {
    const target = state.locations.find((l) => l.id === id)
    if (!target) return false
    if (target.barricade && !enemy.elite) return false
    return true
  })
  if (!neighbours.length) return null
  const lure = state.locations.find(item => item.lure?.round === state.round)
  if (lure) {
    const target = [{ location: lure.id }]
    const distances = neighbours.map(id => distanceToInvestigator(state, id, target))
    const best = Math.min(...distances)
    const pool = neighbours.filter((_, index) => distances[index] === best)
    return chooseAmong(state, { kind: 'hunter', source: { type: 'enemy', code: enemy.code }, seat: leadDecisionSeat(state),
      prompt: `选择「${enemy.name}」向诱饵移动的路线。`, options: pool.map(id => ({ id, label: locName(state, id) })) })
  }
  let targets = aliveInvestigators(state).filter(i => enemy.prey !== 'bearer' || i.seat === enemy.bearerSeat)
  const proximity = targets.map(i => distanceToInvestigator(state, enemy.location, [i]))
  const nearest = Math.min(...proximity)
  targets = targets.filter((_, index) => proximity[index] === nearest)
  const rank = PREY_RANK[enemy.prey]
  if (rank && targets.length) {
    const best = Math.min(...targets.map(i => rank(state, i)))
    targets = targets.filter(i => rank(state, i) === best)
  }
  const distances = neighbours.map((id) => distanceToInvestigator(state, id, targets))
  const best = Math.min(...distances)
  if (!Number.isFinite(best)) return null
  const pool = neighbours.filter((_, index) => distances[index] === best)
  return chooseAmong(state, {
    kind: 'hunter', source: { type: 'enemy', code: enemy.code }, seat: leadDecisionSeat(state),
    prompt: `选择「${enemy.name}」的移动路线（多条等距路线）。`,
    options: pool.map((id) => ({ id, label: locName(state, id) })),
  })
}

function upkeepPhase(state) {
  const events = []
  state.phase = 'upkeep'
  info(state, events, '🔧 重整阶段……', { kind: 'phase', phase: 'upkeep', round: state.round, text: '重整卡牌 · 抽牌 · 获得资源' })
  phaseBeginningWindow(state, events)

  for (const inv of aliveInvestigators(state)) {
    inv.actionsLeft = 3 + extraActionBonus(inv)
    inv.tomeActionUsed = false
    inv.phaseStatBonus = null
    inv.phaseStatBonuses = []
    inv.fearExtraPaid = false
    if (!inv.threat.some(card => getThreatEffect(card)?.preventReady)) for (const a of inv.assets) a.exhausted = false
    for (const threat of inv.threat) if (getThreatEffect(threat)?.debt) threat.debtPaymentsThisRound = 0
  }
  for (const enemy of state.enemies) if (!enemy.bindMonster) {
    if (enemy.snareTrap) {
      state.investigators[enemy.snareTrap.ownerSeat]?.discard.push(enemy.snareTrap.code)
      delete enemy.snareTrap
    } else enemy.exhausted = false
  }
  for (const enemy of state.enemies.slice().filter(enemy => enemy.bindMonster)) {
    const owner = state.investigators[enemy.bindMonster.ownerSeat]
    if (!owner || owner.defeated || owner.resigned) {
      if (owner) owner.discard.push(enemy.bindMonster.code)
      delete enemy.bindMonster
      enemy.exhausted = false
      continue
    }
    performTest(state, owner.seat, 'willpower', 3, { source: { label: '维持绑定', name: enemy.name, code: '02031' }, resolve: result => {
      if (result.success || !enemy.bindMonster) return
      owner.discard.push(enemy.bindMonster.code)
      delete enemy.bindMonster
      enemy.exhausted = false
      info(state, events, `维持「绑定怪物」失败；「${enemy.name}」解除绑定并攻击 ${owner.name}。`)
      enemyAttack(state, enemy, owner, events, `「${enemy.name}」解除绑定后攻击。`)
    } })
  }
  autoEngageAll(state, events)

  for (const inv of aliveInvestigators(state)) {
    for (const asset of inv.assets.slice()) {
      const payment = assetEffect(inv, asset)?.forcedUpkeepPayOrDiscard
      if (!payment) continue
      const keep = inv.resources >= payment && requestChoice(state, { kind: 'upkeep', source: asset.id, seat: inv.seat,
        prompt: `是否支付 ${payment} 资源保留「${cardName(asset.code)}」？`,
        options: [{ id: 'pay', label: '支付资源' }, { id: 'discard', label: '弃置支援' }] }) === 'pay'
      if (keep) inv.resources -= payment
      else { leaveAsset(state, inv, asset); inv.discard.push(asset.code) }
    }
    if (!scenarioBehavior(state).skipUpkeepIncome?.(state, inv)) {
      const texts = scenarioBehavior(state).skipUpkeepDraw?.(state, inv) ? [] : drawCards(state, inv, 1, events)
      for (const t of texts) info(state, events, t, { kind: 'automatic', phase: 'upkeep', round: state.round, text: t, effect: 'draw', seat: inv.seat, location: inv.location })
      const supply = !investigatorTextBlanked(state, inv) ? INVESTIGATOR_ABILITIES[inv.code]?.upkeepResources || 1 : 1
      const darkHorse = inv.assets.some(asset => assetEffect(inv, asset)?.passive?.darkHorse)
      const skipIncome = darkHorse && requestChoice(state, { kind: 'upkeep', source: '02234', seat: inv.seat,
        prompt: '黑马：本回合是否放弃获得资源？',
        options: [{ id: 'gain', label: `获得 ${supply} 资源` }, { id: 'skip', label: '不获得资源（保持 0 资源）' }] }) === 'skip'
      if (!skipIncome && scenarioBehavior(state).canGainResources?.(state, inv) !== false) {
        inv.resources += supply
        const supplyText = `${inv.name} 获得 ${supply} 资源（当前 ${inv.resources}）。`
        info(state, events, supplyText, { kind: 'automatic', phase: 'upkeep', round: state.round, text: supplyText, effect: 'resource', delta: supply, seat: inv.seat, location: inv.location })
      }
    }
    const limit = getHandSize(state, inv)
    discardHandTo(state, inv, limit, events)
    runThreatEndTurn(state, inv, events, 'round')
    for (const asset of inv.assets.slice()) {
      const eff = assetEffect(inv, asset)
      if (asset.temporaryAllyRound === state.round || eff?.forcedRoundEndDiscard) {
        leaveAsset(state, inv, asset); inv.discard.push(asset.code)
      }
    }
  }

  playerWindow(state, 'upkeep.end', events)
  // 地底噬魔：仪式地回合结束补线索；坚韧的黑山羊幼崽治愈 2。
  runLocationRoundEnd(state, events)
  runEnemyRoundEnd(state, events)
  scenarioBehavior(state).roundEnded?.(state, scenarioRuntime(state, events))

  runAgendaForced(state, 'roundEnd', events)
  for (const inv of state.investigators) { inv.onTheLam = false; inv.skillSubstitute = null }
  return events
}

function runLocationRoundEnd(state, events) {
  for (const loc of state.locations) {
    if (loc.lure?.round === state.round) { state.investigators[loc.lure.seat]?.discard.push(loc.lure.code); delete loc.lure }
    if (loc.id === 'ritualSite' && loc.clues < state.numInvestigators * 2) {
      loc.clues = state.numInvestigators * 2
      info(state, events, `🔍 「仪式地」的线索补至 ${loc.clues}。`)
    }
  }
}

function runEnemyRoundEnd(state, events) {
  for (const enemy of state.enemies) {
    if (enemy.code === 'relentlessDarkYoung' && !enemyTextBlanked(state, enemy)) {
      enemy.damageTaken = Math.max(0, enemy.damageTaken - 2)
      info(state, events, `💉 「${enemy.name}」治愈 2 点伤害。`)
    }
  }
}

function hasTomeAsset(inv) {
  return inv.assets.some((a) => {
    const def = cardDef(a.code)
    return def && (def.traits || []).some((t) => t.toLowerCase() === 'tome')
  })
}

function getThreatEffect(cardOrCode) {
  if (cardOrCode && typeof cardOrCode === 'object' && cardOrCode.threatEffect) {
    return cardOrCode.threatEffect
  }
  const code = typeof cardOrCode === 'object' ? cardOrCode?.code : cardOrCode
  const eff = EFFECTS[code]
  if (eff && eff.weakness && eff.weakness.type === 'threat') return eff.weakness
  const t = ALL_TREACHERIES[code]
  if (t?.threatEffect) return t.threatEffect
  if (t && t.threat) return t.threat
  return null
}

function availableThreatAbilities(state, inv) {
  return state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location)
    .flatMap(owner => owner.threat.filter(card => owner.seat === inv.seat || getThreatEffect(card)?.sameLocationAction))
}

// Wracked by Nightmares: "Assets you control cannot ready."
function assetsCannotReady(inv) {
  return inv.threat.some(card => getThreatEffect(card)?.preventReady)
}

function runThreatEndTurn(state, inv, events, timing = 'turn') {
  for (const t of inv.threat.slice()) {
    const th = getThreatEffect(t)
    if (!th) continue
    if (th.endTurnTest && timing === 'turn') {
      performTest(state, inv.seat, th.endTurnTest.skill, th.endTurnTest.difficulty, { source: { label: '回合结束', name: cardName(t.code), code: t.code }, resolve: r => {
        if (r.success) {
          removeThreat(state, inv, t, events)
          info(state, events, `✔️ ${inv.name} 通过检定，弃掉了「${cardName(t.code)}」。`)
        } else {
          info(state, events, `❌ ${inv.name} 未通过「${cardName(t.code)}」的回合结束检定。`)
        }
      } })
    } else if (th.forced?.onTurnEnd && timing === 'turn') {
      applyThreatForced(state, inv, t, th.forced.onTurnEnd, events)
      if (inv.defeated || inv.resigned) return
    } else if (th.roundEndDiscard && timing === 'round') {
      removeThreat(state, inv, t, events)
      info(state, events, `♻️ 「${cardName(t.code)}」在回合末被弃掉。`)
    }
  }
}

function removeThreat(state, inv, threatCard, events) {
  removeOne(inv.threat, threatCard)
  const discard = ALL_TREACHERIES[threatCard.code] ? state.encounterDiscard : inv.discard
  discard.push(threatCard.code)
}

function assignHarm(state, inv, amount, kind, events, direct, assetsFirst = false) {
  const assignments = new Map()
  const capacity = kind === 'damage' ? 'health' : 'sanity'
  // Allies such as Brother Xavier may soak harm dealt to other investigators at
  // their location (passive.assignHarmAtLocation).
  const soaks = direct ? [] : state.investigators
    .filter(other => other !== inv && !other.defeated && !other.resigned && other.location === inv.location)
    .flatMap(other => other.assets
      .filter(asset => assetEffect(other, asset)?.passive?.assignHarmAtLocation)
      .map(asset => ({ asset, owner: other })))
  for (let i = 0; i < amount; i++) {
    let assets = direct ? [] : inv.assets.filter(asset => (cardDef(asset.code)?.[capacity] || 0) > (asset[kind] || 0) + (assignments.get(asset) || 0))
    const mandatory = kind === 'horror' && assets.filter(asset => EFFECTS[asset.code]?.composure
      || (EFFECTS[asset.code]?.redirectOneHorrorToSelf && !(assignments.get(asset) > 0)))
    if (mandatory?.length) assets = mandatory
    const candidates = assets.length || soaks.length
      ? requestChoice(state, { kind: 'assign-' + kind, source: 'harm', seat: inv.seat,
        prompt: `分配 1 点${kind === 'damage' ? '伤害' : '恐惧'}（剩余 ${amount - i}）。`,
        options: [...(assetsFirst || mandatory?.length ? [] : [{ id: 'self', label: '由调查员承受' }]),
          ...assets.map(asset => ({ id: asset.id, label: cardName(asset.code) })),
          ...soaks.map(({ asset, owner }) => ({ id: asset.id, label: `${cardName(asset.code)}（${owner.name}）` }))] })
      : 'self'
    const recipient = candidates === 'self' ? inv
      : assets.find(item => item.id === candidates) || soaks.find(item => item.asset.id === candidates)?.asset
    assignments.set(recipient, (assignments.get(recipient) || 0) + 1)
  }
  return assignments
}

function applyHarm(state, inv, damage, horror, events, direct, attack = null, assetsFirst = false) {
  const changed = scenarioBehavior(state).beforeHarm?.(state, inv,
    { damage: damage || 0, horror: horror || 0, direct: !!direct }, scenarioRuntime(state, events))
  if (changed) { damage = changed.damage; horror = changed.horror; direct = changed.direct }
  if (!(damage > 0 || horror > 0)) return
  const harmContext = reactionWindow(state, 'harmDealt', { when: 'harmDealt', seat: inv.seat, location: inv.location,
    damage: damage || 0, horror: horror || 0, direct: !!direct, attack, prompt: `${inv.name} 将受到伤害或恐惧` }, events)
  damage = Math.max(0, harmContext.damage || 0)
  horror = Math.max(0, harmContext.horror || 0)
  if (!(damage > 0 || horror > 0)) return
  if (direct && inv.assets.some(asset => (damage > 0 && cardDef(asset.code)?.health > 0) || (horror > 0 && cardDef(asset.code)?.sanity > 0)))
    info(state, events, `本次为直接${damage > 0 && horror > 0 ? '伤害与恐惧' : damage > 0 ? '伤害' : '恐惧'}，只能由${inv.name}本人承受，不能分配给支援卡。`)
  const assignedDamage = assignHarm(state, inv, damage || 0, 'damage', events, direct, assetsFirst)
  const assignedHorror = assignHarm(state, inv, horror || 0, 'horror', events, direct)
  for (const [recipient, amount] of assignedDamage) {
    if (recipient === inv || amount <= 0) continue
    const context = { when: 'damageAssignedToSelf', seat: inv.seat, location: inv.location,
      assetId: recipient.id, cancelDamage: 0 }
    triggerReaction(state, inv.seat, 'damageAssignedToSelf', events, context)
    if (context.cancelDamage) assignedDamage.set(recipient, Math.max(0, amount - context.cancelDamage))
  }
  // "When dealt damage" reactions occur after assignment, before placement and
  // defeat. A Guard Dog can retaliate even when this attack will defeat it.
  if (attack) triggerReaction(state, inv.seat, 'enemyAttackDamage', events, {
    ...attack, damagedAssetIds: [...assignedDamage.keys()].filter(a => a !== inv).map(a => a.id),
  })
  for (const [kind, assignments] of [['damage', assignedDamage], ['horror', assignedHorror]]) {
    for (const [recipient, amount] of assignments) {
      if (recipient !== inv && !inv.assets.includes(recipient)) {
        const owner = state.investigators.find(other => other.assets.includes(recipient))
        if (!owner) continue
        recipient[kind] = (recipient[kind] || 0) + amount
        info(state, events, `${cardName(recipient.code)}（${owner.name}）承受 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
        continue
      }
      recipient[kind] = (recipient[kind] || 0) + amount
      if (recipient !== inv) info(state, events, `${cardName(recipient.code)} 承受 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
    }
  }
  for (const owner of state.investigators) {
    for (const asset of owner.assets.slice()) {
      const def = cardDef(asset.code)
      if ((def?.health > 0 && asset.damage >= def.health) || (def?.sanity > 0 && asset.horror >= def.sanity)) {
        leaveAsset(state, owner, asset)
        if (!asset.removedFromGame) owner.discard.push(asset.code)
        info(state, events, `${cardName(asset.code)} 被击败并弃置。`)
        const retaliation = EFFECTS[asset.code]?.defeatedDamage
        if (retaliation) defeatedAssetRetaliation(state, owner, retaliation, events)
      }
    }
  }
  checkDefeated(state, inv.seat, events)
  if (inv.defeated || inv.resigned) return
  if ([...assignedDamage.values()].some(amount => amount > 0)) {
    triggerReaction(state, inv.seat, 'damagePlaced', events, {
      amount: [...assignedDamage.values()].reduce((total, amount) => total + amount, 0),
      damagedAssetIds: [...assignedDamage.keys()].filter(recipient => recipient !== inv).map(recipient => recipient.id),
    })
  }
  if (assignedDamage.get(inv) > 0) triggerThreatForced(state, inv, 'onDamage', events)
  if (assignedHorror.get(inv) > 0) {
    triggerReaction(state, inv.seat, 'horrorPlaced', events)
    triggerThreatForced(state, inv, 'onHorror', events)
  }
}

function defeatedAssetRetaliation(state, owner, amount, events) {
  const enemies = state.enemies.filter(enemy => enemy.location === owner.location)
  if (!enemies.length) return
  const enemyId = enemies.length === 1 ? enemies[0].id : requestChoice(state, { kind: 'target', source: 'assetDefeat', seat: owner.seat,
    prompt: `选择承受 ${amount} 点伤害的敌人。`, options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  const enemy = enemies.find(item => item.id === enemyId)
  if (!enemy) return
  info(state, events, `${owner.name} 的支援被击败，对「${enemy.name}」造成 ${amount} 点伤害。`)
  damageEnemy(state, enemy, amount, owner.seat, events)
}

function applyDamage(state, inv, amount, events, direct) {
  applyHarm(state, inv, amount, 0, events, direct)
}

function applyHorror(state, inv, amount, events, direct) {
  applyHarm(state, inv, 0, amount, events, direct)
}

function triggerThreatForced(state, inv, when, events, depth = 0) {
  if (depth > 4 || inv.defeated || inv.resigned) return
  for (const t of inv.threat.slice()) {
    const th = getThreatEffect(t)
    const fx = th && th.forced && th.forced[when]
    if (fx) applyThreatForced(state, inv, t, fx, events, depth)
  }
}

function applyThreatForced(state, inv, t, fx, events, depth = 0) {
  if (fx.damage && !inv.defeated && !inv.resigned) {
    inv.damage += fx.damage
    info(state, events, `💥 「${cardName(t.code)}」强制：${inv.name} 受到 ${fx.damage} 点直接伤害。`)
    checkDefeated(state, inv.seat, events)
    if (!inv.defeated && !inv.resigned) triggerThreatForced(state, inv, 'onDamage', events, depth + 1)
  }
  if (fx.horror && !inv.defeated && !inv.resigned) {
    inv.horror += fx.horror
    info(state, events, `😱 「${cardName(t.code)}」强制：${inv.name} 受到 ${fx.horror} 点直接恐惧。`)
    checkDefeated(state, inv.seat, events)
    if (!inv.defeated && !inv.resigned) triggerThreatForced(state, inv, 'onHorror', events, depth + 1)
  }
}

function triggerReaction(state, seat, when, events, context = {}) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return
  const entries = []
  const ab = INVESTIGATOR_ABILITIES[inv.code]
  for (const r of (ab && ab.reactions) || []) { if (!investigatorTextBlanked(state, inv)) entries.push({ r, type: 'investigator' }) }
  for (const asset of inv.assets) {
    const eff = assetEffect(inv, asset)
    if (lolaCanUseCard(inv, asset.code)) for (const r of (eff && eff.reactions) || []) entries.push({ r, type: 'asset', asset })
  }
  for (const entry of entries) {
    const r = entry.r
    if (r.when !== when) continue
    const asset = entry.asset
    if (r.selfOnly && context.seat != null && context.seat !== seat) continue
    if (r.nonElite && context.enemy?.elite) continue
    if (r.nonEliteOnly && context.enemy?.elite) continue
    if (r.treacheryOnly && context.cardCode
      && ALL_CARDS[context.cardCode]?.type !== 'treachery') continue
    if (r.requiresClue
      && !(state.locations.find(location => location.id === context.location)?.clues > 0)) continue
    if (r.requiresNoClues && inv.clues > 0) continue
    if (r.when === 'damageAssignedToSelf' && context.assetId && asset?.id !== context.assetId) continue
    if (r.nonWeakness && context.enemy && isWeaknessCode(context.enemy.code)) continue
    if (r.failedByAtMost != null && (context.failedBy || 0) > r.failedByAtMost) continue
    if (r.successByAtLeast != null && (context.successBy || 0) < r.successByAtLeast) continue
    if (r.assetCode && (context.assetCode !== r.assetCode || context.assetId !== asset?.id)) continue
    if (r.requiresAssetDamage && !context.damagedAssetIds?.includes(asset?.id)) continue
    if (r.symbols && !r.symbols.includes(context.token)) continue
    if (r.requiresAlone && aliveInvestigators(state).some(other => other.seat !== seat && other.location === inv.location)) continue
    const cost = r.cost || {}
    if (cost.exhaust && asset?.exhausted) continue
    if (cost.uses && (asset?.uses || 0) < cost.uses) continue
    if (cost.resources && inv.resources < cost.resources) continue
    if (cost.clues && inv.clues < cost.clues) continue
    if (effectError(state, inv, r.effect)) continue
    const scope = r.limit === 'phase' ? `${state.round}:${state.phase}` : r.limit === 'turn' ? `${state.round}:turn` : state.round
    const key = (r.id || (asset?.code || inv.code)) + ':' + scope
    inv.usedReactions ||= {}
    if (r.limit && inv.usedReactions[key]) continue
    const answer = requestChoice(state, { kind: 'reaction', source: r.id || asset?.code || inv.code, seat,
      prompt: r.prompt || `是否触发 ${asset ? cardName(asset.code) : inv.name} 的反应？`, canSkip: true,
      automaticOptionId: isAutomaticReward(r) ? 'trigger' : null,
      options: [{ id: 'skip', label: '跳过反应' }, { id: 'trigger', label: '触发反应' }] })
    if (answer === 'skip') continue
    if (r.limit) inv.usedReactions[key] = true
    if (cost.exhaust && asset) asset.exhausted = true
    if (cost.uses && asset) asset.uses = Math.max(0, (asset.uses || 0) - cost.uses)
    if (cost.resources) inv.resources -= cost.resources
    if (cost.clues) {
      inv.clues -= cost.clues
      if (cost.returnClue) {
        const location = state.locations.find(loc => loc.id === inv.location)
        if (location) location.clues = (location.clues || 0) + cost.clues
      }
      syncClues(state)
    }
    if (cost.horror) applyHorror(state, inv, cost.horror, events, true)
    if (cost.damageSelf) { inv.damage += cost.damageSelf; checkDefeated(state, seat, events) }
    if (cost.discardSelf && asset) {
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      info(state, events, `♻️ ${inv.name} 弃掉了「${cardName(asset.code)}」。`)
    }
    info(state, events, `⚡ ${inv.name} 触发「${asset ? cardName(asset.code) : (r.id || inv.name)}」的反应。`)
    const effect = { ...r.effect }
    if (context.enemy && effect.type === 'dealDamage' && !effect.target) effect.target = 'id:' + context.enemy.id
    if (context.enemy && effect.type === 'defeatNonEliteEnemy') effect.target = 'id:' + context.enemy.id
    const previousReaction = state._reaction
    const reactionState = { when, context, ...context }
    state._reaction = reactionState
    try { resolveEffect(state, seat, effect, makeRuntime(state, events)) }
    finally {
      if (reactionState.testBonus) context.testBonus = (context.testBonus || 0) + reactionState.testBonus
      state._reaction = previousReaction
    }
    if (asset && assetEffect(inv, asset)?.discardWhenEmpty && asset.uses != null && asset.uses <= 0 && inv.assets.includes(asset)) {
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      info(state, events, `「${cardName(asset.code)}」充能耗尽，弃掉。`)
    }
  }
}

function cannotPlayTypes(inv) {
  const set = new Set()
  for (const t of inv.threat) {
    const th = getThreatEffect(t)
    if (th && th.cannotPlay) for (const k of th.cannotPlay) set.add(k)
  }
  return set
}

function unpaidExtraActionThreats(state, inv, kind) {
  return inv.threat.filter(card => {
    const effect = getThreatEffect(card)
    return effect?.extraActionCost?.includes(kind) && card.extraActionPaidRound !== state.round
  })
}

function payActionCost(state, inv, kind, events) {
  if (state._actionPaid) return
  spendAction(state, inv)
  for (const threat of unpaidExtraActionThreats(state, inv, kind)) {
    spendAction(state, inv)
    threat.extraActionPaidRound = state.round
    info(state, events, `⏳ ${inv.name} 受「${cardName(threat.code)}」影响，本次${kind === 'move' ? '移动' : kind === 'fight' ? '攻击' : '躲避'}额外消耗 1 行动。`)
  }
}

function defeatAll(state, events) {
  for (const inv of state.investigators) {
    if (!inv.defeated && !inv.resigned) inv.defeated = true
  }
  info(state, events, '💀 调查队全军覆没……')
}

// 调查员被消除（败退或撤退）：解除交战，并按参考规则把线索放回所在地点。
function eliminateInvestigator(state, inv, events) {
  for (const code of [...(inv.hiddenCards || [])]) discardHiddenCard(state, inv, code, events)
  for (const asset of inv.assets.filter(item => ['02138', '02139', '02179'].includes(item.code))) {
    leaveAsset(state, inv, asset, events)
    if (!asset.removedFromGame) inv.discard.push(asset.code)
  }
  for (const eid of inv.engaged.slice()) {
    const enemy = state.enemies.find((e) => e.id === eid)
    if (enemy) disengageEnemy(state, enemy)
  }
  inv.engaged = []
  const handled = scenarioBehavior(state).investigatorEliminated?.(state, inv, inv.clues, scenarioRuntime(state, events))
  if (!handled) placeCluesOnLocation(state, inv, inv.clues, events)
}

function checkDefeated(state, seat, events) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return
  const lethalHidden = activeHiddenRules(state, inv).find(item =>
    Number.isFinite(item.rule.killAtHorrorOverSanityMultiplier)
      && inv.horror > getMaxSanity(inv) * item.rule.killAtHorrorOverSanityMultiplier)
  if (lethalHidden) {
    inv.defeated = true
    inv.defeatCause = 'killed'
    if (state.campaign.investigators[inv.seat]) state.campaign.investigators[inv.seat].status = 'killed'
    eliminateInvestigator(state, inv, events)
    info(state, events, `${inv.name} 因隐私牌「${cardName(lethalHidden.code)}」退场并死亡。`)
    checkOutcome(state, events)
    return
  }
  let damageLethal = inv.damage >= getMaxHealth(inv)
  let horrorLethal = inv.horror >= getMaxSanity(inv)
    && scenarioBehavior(state).investigatorCanBeDefeated?.(state, inv, 'horror') !== false
  if (damageLethal || horrorLethal) {
    if (horrorLethal) {
      triggerReaction(state, inv.seat, 'wouldDefeatByHorror', events, {
        when: 'wouldDefeatByHorror', seat: inv.seat, location: inv.location,
      })
    }
    reactionWindow(state, 'wouldDefeat', {
      when: 'wouldDefeat', seat: inv.seat, location: inv.location,
      prompt: `${inv.name} 将要被击败`,
    }, events)
    damageLethal = inv.damage >= getMaxHealth(inv)
    horrorLethal = inv.horror >= getMaxSanity(inv)
      && scenarioBehavior(state).investigatorCanBeDefeated?.(state, inv, 'horror') !== false
    if (!damageLethal && !horrorLethal) return
  }
  if (damageLethal || horrorLethal) {
    inv.defeated = true
    inv.defeatCause = damageLethal && horrorLethal ? 'both' : damageLethal ? 'damage' : 'horror'
    eliminateInvestigator(state, inv, events)
    info(state, events, `💀 ${inv.name} 被击败了！`)
    checkOutcome(state, events)
  }
}

function checkOutcome(state, events) {
  if (state.status !== 'playing') return
  // 场景/密谋推进到尽头时由各自的 reveal 处理结局（resolutionChoice / agenda reveal）。
  // 这里只兜底处理「全体调查员均败退/撤退」的无结局情况（按剧本差异结算）。
  if (aliveInvestigators(state).length === 0) {
    finishScenario(state, 'noResolution', events)
  }
}

function searchDiscard(state, seat, effect, events) {
  const inv = state.investigators[seat]
  if (discardLocked(state, inv)) {
    info(state, events, `${inv.name} 的弃牌堆被锁定，卡牌不能离开。`)
    return
  }
  const matches = inv.discard.filter((code, index) => {
    const def = cardDef(code)
    if (!def) return false
    if (effect.typeFilter && def.type !== effect.typeFilter) return false
    if (effect.trait) {
      const needle = String(effect.trait).toLowerCase()
      return (def.traits || []).some(trait => String(trait).toLowerCase() === needle
        || String(trait) === String(effect.traitZh || ''))
    }
    return true
  }).map(code => ({ code, index: inv.discard.indexOf(code) }))
  if (!matches.length) { info(state, events, `${inv.name} 的弃牌堆中没有符合条件的卡牌。`); return }
  const answer = matches.length === 1 ? '0' : requestChoice(state, {
    kind: 'search', source: effect.source || 'discard-search', seat, canSkip: true,
    prompt: `从弃牌堆选择 1 张牌加入手牌。`,
    options: [{ id: 'skip', label: '不选择' }, ...matches.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) }))],
  })
  if (answer === 'skip') return
  const chosen = matches[Number(answer)]
  const idx = inv.discard.indexOf(chosen.code)
  if (idx >= 0) inv.discard.splice(idx, 1)
  inv.hand.push(chosen.code)
  info(state, events, `${inv.name} 从弃牌堆取回「${cardName(chosen.code)}」。`)
}

function autoEvadeNonElite(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
  if (!candidates.length) { info(state, events, '这里没有非精英敌人。'); return }
  const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
    kind: 'target', source: effect.source || 'auto-evade', seat, prompt: '选择要自动躲避的非精英敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  const enemy = candidates.find(item => item.id === id)
  autoEvadeEnemy(state, enemy, events)
  afterEvade(state, inv, enemy, events)
}

function attachBarricade(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === inv.location)
  if (!loc) return
  const attachment = { ownerSeat: seat, code: '01038' }
  loc.barricades ||= loc.barricade ? [loc.barricade] : []
  loc.barricades.push(attachment)
  loc.barricade = attachment
  info(state, events, `🚧 「屏障」附属到「${loc.name}」：非精英敌人不能移动进入。`)
}

function discardBarricades(state, loc) {
  for (const attachment of loc.barricades || (loc.barricade ? [loc.barricade] : [])) {
    if (attachment.code) disposePlayedEvent(state.investigators[attachment.ownerSeat], attachment.code)
  }
  delete loc.barricade
  delete loc.barricades
}

function disengageAll(state, seat, events) {
  const inv = state.investigators[seat]
  for (const enemyId of inv.engaged.slice()) {
    const enemy = state.enemies.find(item => item.id === enemyId)
    if (enemy) disengageEnemy(state, enemy)
  }
  info(state, events, `${inv.name} 与所有敌人解除交战。`)
}
function scryDeck(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const choices = []
  for (const target of aliveInvestigators(state)) choices.push({ id: 'deck:' + target.seat, label: target.name + ' 的牌库' })
  choices.push({ id: 'encounter', label: '遭遇牌库' })
  const source = choices.length === 1 ? choices[0].id : requestChoice(state, {
    kind: 'scry', source: effect.source || 'scry', seat, prompt: '选择要查看的牌库顶 3 张。',
    options: choices,
  })
  let pile
  if (source === 'encounter') pile = state.encounterDeck.slice(-3).reverse()
  else {
    const target = state.investigators[Number(source.slice(5))]
    pile = target ? target.deck.slice(-3).reverse() : []
  }
  if (!pile.length) { info(state, events, '所选牌库已空。'); return }
  const permutations = []
  const permute = (arr, prefix = []) => {
    if (!arr.length) { permutations.push(prefix); return }
    for (let i = 0; i < arr.length; i++) permute(arr.slice(0, i).concat(arr.slice(i + 1)), prefix.concat([arr[i]]))
  }
  permute(pile)
  const answer = permutations.length === 1 ? '0' : requestChoice(state, {
    kind: 'scry', source: effect.source || 'scry', seat, prompt: '选择牌库顶的顺序（从上到下）。',
    options: permutations.map((order, index) => ({ id: String(index), cardCodes: order, label: order.map(code => cardName(code)).join(' → ') })),
  })
  const ordered = permutations[Number(answer)]
  if (source === 'encounter') {
    state.encounterDeck.splice(Math.max(0, state.encounterDeck.length - pile.length), pile.length, ...ordered.slice().reverse())
  } else {
    const target = state.investigators[Number(source.slice(5))]
    target.deck.splice(Math.max(0, target.deck.length - pile.length), pile.length, ...ordered.slice().reverse())
  }
  info(state, events, inv.name + ' 查看并重新排列了牌库顶 ' + pile.length + ' 张。')
}
function chooseInvestigator(state, seat, target = 'location', effect = null, constraints = {}) {
  const inv = state.investigators[seat]
  let candidates = aliveInvestigators(state)
  if (target === 'self') candidates = [inv]
  else if (target === 'location') candidates = candidates.filter(item => item.location === inv.location)
  if (constraints.activeTurnOnly) candidates = candidates.filter(item => state.phase === 'investigation' && item.seat === state.currentSeat && !item.turnEnded)
  if (effect) candidates = candidates.filter(item => !effectError(state, item, effect))
  if (!candidates.length) throw new Error('没有合法调查员目标')
  if (candidates.length === 1) return candidates[0].seat
  const id = requestChoice(state, {
    kind: 'investigator', source: 'target', seat, prompt: '选择一名调查员。',
    options: candidates.map(item => ({ id: String(item.seat), label: `${item.name}（座位 ${item.seat + 1}）` })),
  })
  return Number(id)
}

function searchTop(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const n = Math.max(1, effect.amount || 3)
  const cards = inv.deck.slice(-Math.min(n, inv.deck.length))
  if (!cards.length) { info(state, events, `${inv.name} 的牌库已空，无法搜索。`); return }
  const matches = cards.filter(code => {
    const def = cardDef(code)
    if (!def) return false
    if (effect.typeFilter && def.type !== effect.typeFilter) return false
    const wantedTraits = effect.traits || (effect.trait ? [effect.trait] : [])
    if (wantedTraits.length) {
      const wantedZh = effect.traitZh ? [String(effect.traitZh)] : []
      const wanted = wantedTraits.map(item => String(item).toLowerCase())
      if (!(def.traits || []).some(trait => wanted.includes(String(trait).toLowerCase()) || wantedZh.includes(String(trait)))) return false
    }
    return true
  })
  if (!matches.length) {
    inv.deck = shuffle(inv.deck, () => randomValue(state))
    info(state, events, `${inv.name} 查看了牌库顶 ${cards.length} 张，没有符合条件的卡牌，洗回牌库。`)
    return
  }
  const answer = requestChoice(state, {
    kind: 'search', source: effect.source || 'search-top', seat, canSkip: true,
    prompt: `查看牌库顶 ${cards.length} 张，选择 ${effect.choose || 1} 张加入手牌，其余洗回。`,
    options: [{ id: 'skip', label: '不选择' }, ...matches.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))],
  })
  if (answer !== 'skip') {
    const code = matches[Number(answer)]
    const idx = inv.deck.lastIndexOf(code)
    if (idx >= 0) inv.deck.splice(idx, 1)
    inv.hand.push(code)
    info(state, events, `${inv.name} 查找后将「${cardName(code)}」加入手牌。`)
  }
  inv.deck = shuffle(inv.deck, () => randomValue(state))
}

function targetedTest(state, seat, effect, events) {
  const targetSeat = chooseInvestigator(state, seat, effect.target || 'location')
  return performTest(state, seat, effect.skill || 'intellect', effect.difficulty ?? 2, { source: { label: '卡牌能力', name: effect.source ? cardName(effect.source) : '目标调查员：' + state.investigators[targetSeat].name, code: effect.source }, resolve: result => {
    const rt = makeRuntime(state, events)
    if (result.success) {
      if (effect.successEffect) resolveEffect(state, targetSeat, effect.successEffect, rt)
    } else if (effect.failEffect) {
      resolveEffect(state, targetSeat, effect.failEffect, rt)
    }
  } })
}

function investigateForResources(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === inv.location)
  if (!loc) return
  const skill = loc.investigateSkill || 'intellect'
  const difficulty = loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0)
  return performTest(state, seat, skill, difficulty, { source: { label: '调查以获取资源', name: loc.name, code: loc.originalCode || loc.code }, skillBonus: skill === 'intellect' ? investigateBonus(inv) : 0, resolve: r => {
    if (r.success) {
      const amount = effect.amount || 3
      if (scenarioBehavior(state).canGainResources?.(state, inv) !== false) inv.resources += amount
      info(state, events, `${inv.name} 调查成功，将发现线索改为获得 ${amount} 资源（当前 ${inv.resources}）。`)
      if (loc.fog) {
        loc.shroudMod = Math.max(0, (loc.shroudMod || 0) - 2); loc.fog = 0
        state.encounterDiscard.push(loc.fogCode || 'obscuringFog'); delete loc.fogCode
      }
      triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
    } else {
      info(state, events, `${inv.name} 的调查失败，未获得资源。`)
      reactionWindow(state, 'investigateFail', { when: 'investigateFail', seat, location: loc.id, failedBy: Math.max(0, difficulty-r.value), prompt: '调查检定失败后' }, events)
    }
  } })
}

function investigatorMoveDestinations(state, seat, effect) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === inv.location)
  let destinations = (loc?.connections || []).filter(id => state.locations.some(item => item.id === id))
  if (effect.anyRevealed) {
    destinations = state.locations.filter(item => item.id !== inv.location && item.revealed && !state.enemies.some(enemy => enemy.location === item.id)).map(item => item.id)
  }
  return destinations.filter(id => !investigatorEntryError(state, id, seat) && (!effect.destination || id === effect.destination))
}

function moveInvestigatorTo(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const destinations = investigatorMoveDestinations(state, seat, effect)
  if (!destinations.length) { info(state, events, '没有可移动的连接地点。'); return }
  const id = effect.destination || (destinations.length === 1 ? destinations[0] : requestChoice(state, {
    kind: 'move', source: effect.source || 'move', seat, prompt: '选择要移动到的连接地点。',
    options: destinations.map(locId => ({ id: locId, label: locName(state, locId) })),
  }))
  if (!effect.keepEngaged) for (const enemyId of inv.engaged.slice()) {
    const enemy = state.enemies.find(e => e.id === enemyId)
    if (enemy) disengageEnemy(state, enemy)
  }
  relocateInvestigator(state, seat, id, events, `${inv.name} 从「${locName(state, inv.location)}」移动到「${locName(state, id)}」；本次移动不触发借机攻击。`)
}

function dealDamageAll(state, seat, effect, events) {
  const inv = state.investigators[seat]
  let locId = inv.location
  if (effect.location === 'choice') {
    const options = [inv.location, ...((state.locations.find(item => item.id === inv.location)?.connections) || [])]
      .filter((id, index, arr) => arr.indexOf(id) === index && state.locations.some(item => item.id === id))
    locId = options.length === 1 ? options[0] : requestChoice(state, {
      kind: 'target', source: effect.source || 'deal-damage-all', seat, prompt: '选择要造成伤害的地点。',
      options: options.map(id => ({ id, label: locName(state, id) })),
    })
  }
  const enemies = state.enemies.filter(enemy => enemy.location === locId)
  ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'blast', fx: effect.fx || 'blast', seat, location: locId,
    name: locName(state, locId), damage: effect.amount || 3, enemyIds: enemies.map(enemy => enemy.id),
    seats: effect.investigators ? aliveInvestigators(state).filter(item => item.location === locId).map(item => item.seat) : [],
    tableState: captureTableState(state, getStat, getMaxSanity) })
  for (const enemy of enemies.slice()) {
    if (!damageEnemy(state, enemy, effect.amount || 3, seat, events)) continue
    info(state, events, `💥 「${enemy.name}」受到 ${effect.amount || 3} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
  }
  if (effect.investigators) {
    for (const target of aliveInvestigators(state).filter(item => item.location === locId)) {
      info(state, events, `💥 ${target.name} 受到 ${effect.amount || 3} 点伤害。`)
      applyDamage(state, target, effect.amount || 3, events)
    }
  }
}

function dealDamageExhausted(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const candidates = state.enemies.filter(enemy => enemy.location === inv.location && enemy.exhausted)
  if (!candidates.length) { info(state, events, '这里没有已横置的敌人。'); return }
  const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
    kind: 'target', source: effect.source || 'deal-damage-exhausted', seat, prompt: '选择已横置的敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  const enemy = candidates.find(item => item.id === id)
  if (!damageEnemy(state, enemy, effect.amount || 2, seat, events)) return
  info(state, events, `💥 「${enemy.name}」受到 ${effect.amount || 2} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
}

function blankEnemy(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
  if (!candidates.length) { info(state, events, '这里没有可抹消的非精英敌人。'); return }
  const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
    kind: 'target', source: effect.source || 'blank-enemy', seat, prompt: '选择要抹消文本框的非精英敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  const enemy = candidates.find(item => item.id === id)
  enemy.textBlanked = { round: state.round, phase: state.phase }
  if (enemy.damageTaken >= enemyHealthValue(state, enemy)) { enemy.defeatedBy = seat; defeatEnemy(state, enemy, events) }
  else autoEngageAt(state, enemy.location, events)
  info(state, events, `📖 「${enemy.name}」的印刷文本被视为空白，直到本阶段结束。`)
}

function ignoreChaos(state, seat, effect, events) {
  const inv = state.investigators[seat]
  inv.ignoreChaosThisTurn = true
  info(state, events, `${inv.name} 本回合执行的所有技能检定不揭示混乱标记。`)
}

function returnAssetToHand(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const asset = effect.assetId ? inv.assets.find(item => item.id === effect.assetId) : null
  if (!asset) return
  leaveAsset(state, inv, asset)
  if (!asset.removedFromGame) inv.hand.push(asset.code)
  info(state, events, `${inv.name} 将「${cardName(asset.code)}」返回手牌。`)
}

function shuffleIntoEncounter(state, seat, effect, events) {
  const inv = state.investigators[seat]
  let candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite && !isWeaknessCode(enemy.code))
  if (state._reaction?.enemy && candidates.includes(state._reaction.enemy)) candidates = [state._reaction.enemy]
  if (!candidates.length) { info(state, events, '这里没有可洗回遭遇牌库的敌人。'); return }
  const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
    kind: 'target', source: effect.source || 'shuffle-enemy', seat, prompt: '选择要洗回遭遇牌库的敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  const enemy = candidates.find(item => item.id === id)
  removeOne(state.enemies, enemy)
  if (enemy.engagedSeat != null) {
    const target = state.investigators[enemy.engagedSeat]
    if (target) removeOne(target.engaged, enemy.id)
  }
  state.encounterDeck.push(enemy.code)
  state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
  info(state, events, `🌀 「${enemy.name}」被洗回遭遇牌库。`)
}

function moveHorrorToInvestigator(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const source = state.investigators[seat].threat.find(item => item.id === effect.threatId)
  if (source && (source.counters || 0) > 0 && effect.toSeat != null) {
    source.counters -= 1
    const target = state.investigators[effect.toSeat]
    if (target) { target.horror += 1; info(state, events, `😱 将 1 点恐惧移动到 ${target.name}。`); checkDefeated(state, target.seat, events) }
  }
}
// ---------------------------------------------------------------------------
// 效果运行时（rt）：供 effects.js 回调引擎内部机制，避免循环依赖
// ---------------------------------------------------------------------------

function damagedTargetsAtLocation(state, seat) {
  const here = state.investigators[seat].location
  return aliveInvestigators(state).filter(owner => owner.location === here).flatMap(owner => [
    ...(owner.damage > 0 ? [{ id: `investigator:${owner.seat}`, name: owner.name, target: owner }] : []),
    ...owner.assets.filter(asset => asset.damage > 0 && (cardDef(asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))
      .map(asset => ({ id: `asset:${asset.id}`, name: cardName(asset.code), target: asset })),
  ])
}

function healDamageAtLocation(state, seat, amount, events) {
  const targets = damagedTargetsAtLocation(state, seat)
  if (!targets.length) return
  const id = targets.length === 1 ? targets[0].id : requestChoice(state, {
    kind: 'target', source: 'healDamageAtLocation', seat, prompt: '选择同地点的调查员或盟友，治疗伤害。',
    options: targets.map(target => ({ id: target.id, label: target.name })),
  })
  const chosen = targets.find(target => target.id === id)
  if (chosen) {
    const healed = Math.min(amount, chosen.target.damage)
    chosen.target.damage -= healed
    info(state, events, `${chosen.name} 治疗了 ${healed} 点伤害。`)
  }
}

function recordResearch(state, key) {
  state.campaign.records ||= {}
  state.campaign.records[key] = true
  for (const record of Object.values(state.campaign.investigators)) {
    record.research ||= {}
    record.research[key] = true
  }
}

function researchSolution(state, seat, assetId, events) {
  const inv = state.investigators[seat]
  const asset = inv.assets.find(item => item.id === assetId && item.code === '02021')
  if (!asset) throw new Error('奇异溶液必须在场才能研究')
  return performTest(state, seat, 'intellect', 4, { source: { label: '研究', name: cardName('02021'), code: '02021' }, resolve: result => {
    if (!result.success) return
    recordResearch(state, 'identifiedStrangeSolution')
    leaveAsset(state, inv, asset, events)
    inv.discard.push(asset.code)
    for (const line of drawCards(state, inv, 2, events)) info(state, events, line)
    info(state, events, `${inv.name} 鉴定了奇异溶液；该研究记录已保存到战役。`)
  } })
}

function healHorrorNearby(state, seat, amount, events) {
  const inv = state.investigators[seat]
  const connections = state.locations.find(loc => loc.id === inv.location)?.connections || []
  const targets = aliveInvestigators(state).filter(other => other.horror > 0
    && (other.location === inv.location || connections.includes(other.location)))
  if (!targets.length) return
  const id = targets.length === 1 ? String(targets[0].seat) : requestChoice(state, {
    kind: 'target', source: '02012', seat, prompt: '选择本地点或连接地点的一名调查员，治疗 1 点恐惧。',
    options: targets.map(target => ({ id: String(target.seat), label: target.name })),
  })
  const target = targets.find(item => String(item.seat) === id)
  if (target) { target.horror = Math.max(0, target.horror - amount); info(state, events, `${target.name} 治疗 ${amount} 点恐惧。`) }
}

function dukeInvestigate(state, seat, events) {
  const inv = state.investigators[seat]
  const destinations = investigatorMoveDestinations(state, seat, {})
  if (destinations.length) {
    const id = requestChoice(state, { kind: 'move', source: '02014', seat,
      prompt: '杜克调查前是否移动到连接地点？',
      options: [{ id: 'stay', label: '留在原地调查' }, ...destinations.map(loc => ({ id: loc, label: locName(state, loc) }))] })
    if (id !== 'stay') relocateInvestigator(state, seat, id, events)
  }
  return doInvestigate(state, seat, { baseValue: 4 }, events, true)
}

function isChargeAsset(asset) {
  return ['charge', 'charges'].includes(String(asset?.usesType || '').toLowerCase())
}

function chooseEnemyFrom(state, seat, candidates, source) {
  if (candidates.length === 1) return candidates[0]
  const id = requestChoice(state, { kind: 'enemy', source, seat, prompt: '选择敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  return candidates.find(enemy => enemy.id === id)
}

function carcosaPlayerEffect(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const asset = effect.assetId && inv.assets.find(item => item.id === effect.assetId)
  const chooseAsset = (items, source = effect.action, prompt = '选择一张支援。') => {
    if (!items.length) return null
    const id = items.length === 1 ? items[0].id : requestChoice(state, {
      kind: 'target', source, seat, prompt,
      options: items.map(item => ({ id: item.id, cardCode: item.code, label: cardName(item.code) })),
    })
    return items.find(item => item.id === id)
  }
  if (effect.action === 'letMeHandleThis') {
    const context = state._reaction?.context || state._reaction
    if (context?.when !== 'encounterDrawn' || context.seat === seat) return
    context.redirectSeat = seat
    context.location = inv.location
    info(state, events, `${inv.name} 接手结算这张遭遇卡，并在其技能检定中获得 +2。`)
    return
  }
  if (effect.action === 'stickToThePlan') {
    if (!asset) return
    asset.attached ||= []
    const selectedNames = new Set()
    while (asset.attached.length < 3) {
      const candidates = inv.deck.map((code, index) => ({ code, index, def: cardDef(code) }))
        .filter(({ def }) => def?.type === 'event'
          && (def.traits || []).some(trait => ['tactic', 'supply'].includes(String(trait).toLowerCase()))
          && !selectedNames.has(def.name))
      if (!candidates.length) break
      const answer = requestChoice(state, {
        kind: 'card', source: '03264', seat, canSkip: true,
        prompt: `选择附属到「原定计划」的事件（还可选择 ${3 - asset.attached.length} 张）。`,
        options: [{ id: 'done', label: '完成' },
          ...candidates.map(item => ({ id: String(item.index), cardCode: item.code, label: cardName(item.code) }))],
      })
      if (answer === 'done') break
      const picked = candidates.find(item => item.index === Number(answer))
      if (!picked) break
      asset.attached.push(inv.deck.splice(picked.index, 1)[0])
      selectedNames.add(picked.def.name)
    }
    inv.deck = shuffle(inv.deck, () => randomValue(state))
    info(state, events, `${inv.name} 将 ${asset.attached.length} 张事件附属到「原定计划」。`)
    return
  }
  if (effect.action === 'everVigilant') {
    for (let count = 0; count < 3; count++) {
      const candidates = inv.hand.filter(code => {
        const def = cardDef(code)
        return def?.type === 'asset' && inv.resources >= Math.max(0, playCost(state, inv, def) - 1)
      })
      if (!candidates.length) break
      const answer = requestChoice(state, { kind: 'card', source: '03023', seat, canSkip: true,
        prompt: `选择要打出的支援（还可打出 ${3 - count} 张；每张费用-1）。`,
        options: [{ id: 'done', label: '完成' }, ...candidates.map(code => ({ id: code, cardCode: code, label: cardName(code) }))] })
      if (answer === 'done') break
      inv.carcosaPlayDiscount = 1
      doPlay(state, seat, answer, events, false, true)
    }
    return
  }
  if (effect.action === 'fieldwork') {
    inv.fieldwork = { round: state.round, phase: state.phase, amount: 2 }
    return
  }
  if (effect.action === 'archaicGlyphs') {
    if (!asset) return
    asset.uses = (asset.uses || 0) + 1
    asset.usesType = 'secrets'
    if (asset.uses >= 3) {
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
      inv.resources += 5
      recordResearch(state, 'translatedGlyphs')
    }
    return
  }
  if (effect.action === 'noStoneUnturned') {
    const targets = aliveInvestigators(state).filter(other => other.location === inv.location)
    const targetSeat = targets.length === 1 ? targets[0].seat : Number(requestChoice(state, {
      kind: 'investigator', source: effect.source || 'noStoneUnturned', seat,
      prompt: '选择要搜索牌库的调查员。',
      options: targets.map(other => ({ id: String(other.seat), label: other.name })),
    }))
    searchTop(state, targetSeat, { amount: effect.amount === 'all'
      ? state.investigators[targetSeat].deck.length : effect.amount || 6, source: effect.source || 'noStoneUnturned' }, events)
    return
  }
  if (effect.action === 'inTheKnow') {
    const locations = state.locations.filter(location => location.revealed && !location.locked)
    if (!locations.length) return
    const locationId = requestChoice(state, { kind: 'location', source: '03027', seat,
      prompt: '选择要远程调查的已揭示地点。',
      options: locations.map(location => ({ id: location.id, label: locName(state, location.id) })) })
    doInvestigate(state, seat, { locationId }, events, true)
    return
  }
  if (effect.action === 'sleightOfHand') {
    const candidates = inv.hand.filter(code => cardDef(code)?.type === 'asset'
      && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'item'))
    if (!candidates.length) return
    const code = requestChoice(state, { kind: 'card', source: '03029', seat,
      prompt: '选择一件物品支援放置入场。',
      options: candidates.map(item => ({ id: item, cardCode: item, label: cardName(item) })) })
    inv.carcosaPlayDiscount = playCost(state, inv, cardDef(code))
    doPlay(state, seat, code, events, false, true)
    const played = inv.assets.filter(item => item.code === code).at(-1)
    if (played) played.sleightOfHand = { round: state.round, turnSeat: state.currentSeat }
    return
  }
  if (effect.action === 'lockpicks') {
    doInvestigate(state, seat, { addSkill: 'agility', lockpicksAssetId: asset?.id }, events, true)
    return
  }
  if (effect.action === 'alchemicalTransmutation') {
    return performTest(state, seat, 'willpower', 1, { source: { label: '支援能力', name: cardName('03032'), code: '03032' },
      resolve: result => {
        if (result.success) inv.resources += Math.min(3, result.value - result.difficulty)
        if ((result.drawn || []).some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
          applyDamage(state, inv, 1, events)
        }
      } })
  }
  if (effect.action === 'uncageTheSoul') {
    const candidates = inv.hand.filter(code => cardDef(code)
      && (cardDef(code).traits || []).some(trait => ['spell', 'ritual'].includes(String(trait).toLowerCase())))
    if (!candidates.length) return
    const code = requestChoice(state, { kind: 'card', source: '03033', seat,
      prompt: '选择要以费用-3打出的法术或仪式。',
      options: candidates.map(item => ({ id: item, cardCode: item, label: cardName(item) })) })
    inv.carcosaPlayDiscount = 3
    doPlay(state, seat, code, events, false, true)
    return
  }
  if (effect.action === 'astralTravel') {
    const locations = state.locations.filter(location => location.revealed && location.id !== inv.location && !location.locked)
    if (!locations.length) return
    const destination = requestChoice(state, { kind: 'location', source: '03034', seat,
      prompt: '选择星界旅行的目的地。', options: locations.map(location => ({ id: location.id, label: locName(state, location.id) })) })
    relocateInvestigator(state, seat, destination, events)
    const token = state.chaosBag[Math.floor(randomValue(state) * state.chaosBag.length)]
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) {
      const candidates = inv.assets.filter(item => (cardDef(item.code)?.traits || [])
        .some(trait => ['item', 'ally'].includes(String(trait).toLowerCase())))
      const target = chooseAsset(candidates, '03034', '选择弃置一件物品或盟友；若没有则受到1点伤害。')
      if (target) { leaveAsset(state, inv, target, events); inv.discard.push(target.code) } else applyDamage(state, inv, 1, events)
    }
    return
  }
  if (effect.action === 'hidingSpot' || effect.action === 'ambush' || effect.action === 'snareTrap'
    || effect.action === 'shortcut2') {
    const locations = effect.action === 'hidingSpot' ? state.locations.filter(location => location.revealed)
      : state.locations.filter(location => location.id === inv.location)
    if (!locations.length) return
    const locationId = locations.length === 1 ? locations[0].id : requestChoice(state, {
      kind: 'location', source: effect.action, seat, prompt: '选择附加地点。',
      options: locations.map(location => ({ id: location.id, label: locName(state, location.id) })),
    })
    state.playerLocationAttachments ||= []
    state.playerLocationAttachments.push({ code: effect.cardCode || ({
      hidingSpot: '03038', ambush: '03148', snareTrap: '03199', shortcut2: '03232',
    })[effect.action], location: locationId, ownerSeat: seat, exhausted: false })
    return
  }
  if (effect.action === 'overzealous') {
    drawEncounter(state, inv, events)
    drawEncounter(state, inv, events)
    return
  }
  if (effect.action === 'heroicRescue') {
    const context = state._reaction
    const enemy = context?.enemyId && state.enemies.find(item => item.id === context.enemyId)
    if (!enemy) return
    engageEnemy(state, enemy, seat, events)
    enemyAttack(state, enemy, inv, events, cardName('03106'))
    damageEnemy(state, enemy, 1, seat, events)
    return
  }
  if (effect.action === 'anatomicalDiagrams') {
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
    if (!candidates.length) return
    const target = chooseEnemyFrom(state, seat, candidates, '03108')
    target.carcosaDifficultyModifier = { fight: -2, evade: -2, round: state.round, turnSeat: state.currentSeat }
    return
  }
  if (effect.action === 'davidRenfield') {
    if (!asset) return
    asset.doom = (asset.doom || 0) + 1
    inv.resources += asset.doom
    return
  }
  if (effect.action === 'trenchKnifeFight') {
    doFight(state, seat, { enemyId: chooseEnemy(state, seat, {}).id, combatBonus: inv.engaged.length }, events, true)
    return
  }
  if (effect.action === 'charlesRoss') {
    if (asset) asset.itemDiscountAtLocation = { amount: 1, round: state.round, phase: state.phase }
    else inv.itemDiscountAtLocation = { amount: 1, round: state.round, phase: state.phase }
    return
  }
  if (effect.action === 'forewarned') {
    const location = state.locations.find(item => item.id === inv.location)
    if (inv.clues > 0 && location) { inv.clues--; state.clues--; location.clues = (location.clues || 0) + 1 }
    state._reaction && (state._reaction.cancelled = true)
    return
  }
  if (effect.action === 'sneakAttack2') {
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat !== seat)
    if (!candidates.length) return
    const target = chooseEnemyFrom(state, seat, candidates, '03152')
    damageEnemy(state, target, 2, seat, events)
    return
  }
  if (effect.action === 'stormOfSpirits') {
    const target = enemyForTarget(state, seat, 'engaged') || state.enemies.find(enemy => enemy.location === inv.location)
    if (!target) return
    return doFight(state, seat, { enemyId: target.id, skill: 'willpower', stormOfSpirits: true }, events, true)
  }
  if (effect.action === 'fightOrFlight') {
    inv.fightOrFlight = { amount: inv.horror, round: state.round }
    return
  }
  if (effect.action === 'callingInFavors') {
    const ally = chooseAsset(inv.assets.filter(item => (cardDef(item.code)?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'ally')), '03158', '选择返回手牌的盟友。')
    if (!ally) return
    const discount = cardDef(ally.code)?.cost || 0
    leaveAsset(state, inv, ally, events); inv.hand.push(ally.code)
    const before = inv.hand.length
    searchTop(state, seat, { amount: 9, trait: 'Ally', source: '03158' }, events)
    if (inv.hand.length > before) {
      const code = inv.hand.at(-1)
      inv.carcosaPlayDiscount = discount
      doPlay(state, seat, code, events, false, true)
    }
    return
  }
  if (effect.action === 'illSeeYouInHell') {
    for (const enemy of state.enemies.filter(item => item.engagedSeat === seat && !item.elite).slice()) {
      enemy.defeatedBy = seat
      defeatEnemy(state, enemy, events)
    }
    inv.physicalTrauma = (inv.physicalTrauma || 0) + 1
    inv.damage = getMaxHealth(inv)
    checkDefeated(state, seat, events)
    return
  }
  if (effect.action === 'logicalReasoning') {
    const targetSeat = chooseInvestigator(state, seat, 'location')
    const target = state.investigators[targetSeat]
    const terrors = target.threat.filter(item => (cardDef(item.code)?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'terror'))
    const options = [{ id: 'heal', label: '治疗2点恐惧' }, ...terrors.map(item => ({ id: item.id, label: `弃置「${cardName(item.code)}」` }))]
    const answer = requestChoice(state, { kind: 'effect', source: '03191', seat, prompt: '选择逻辑推理的效果。', options })
    if (answer === 'heal') target.horror = Math.max(0, target.horror - 2)
    else {
      const threat = terrors.find(item => item.id === answer)
      if (threat) { removeOne(target.threat, threat); target.discard.push(threat.code) }
    }
    return
  }
  if (effect.action === 'pickpocketing') {
    const successBy = state._reaction?.successBy || 0
    const answer = successBy >= 2 ? 'both' : requestChoice(state, { kind: 'effect', source: '03195', seat,
      prompt: '选择抽1张牌或获得1资源。', options: [{ id: 'draw', label: '抽1张牌' }, { id: 'resource', label: '获得1资源' }] })
    if (answer === 'draw' || answer === 'both') for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
    if (answer === 'resource' || answer === 'both') inv.resources++
    return
  }
  if (effect.action === 'quantumFlux') {
    inv.deck = shuffle([...inv.deck, ...inv.discard], () => randomValue(state)); inv.discard = []
    for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
    return
  }
  if (effect.action === 'recharge') {
    const target = chooseAsset(aliveInvestigators(state).filter(other => other.location === inv.location)
      .flatMap(other => other.assets).filter(item => (cardDef(item.code)?.traits || [])
        .some(trait => ['spell', 'relic'].includes(String(trait).toLowerCase()))), '03197')
    if (!target) return
    const token = state.chaosBag[Math.floor(randomValue(state) * state.chaosBag.length)]
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) {
      const owner = state.investigators.find(other => other.assets.includes(target))
      leaveAsset(state, owner, target, events); owner.discard.push(target.code)
    } else target.uses = (target.uses || 0) + 3
    return
  }
  if (effect.action === 'madameDraw') {
    if (!inv.hand.length) for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
    return
  }
  if (effect.action === 'madameResource') {
    if (!inv.resources) inv.resources++
    return
  }
  if (effect.action === 'firstAid') {
    const targets = aliveInvestigators(state).filter(other => other.location === inv.location)
    const allies = targets.flatMap(owner => owner.assets
      .filter(asset => (cardDef(asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')))
    const options = [
      ...targets.map(other => ({ id: `inv:${other.seat}`, label: other.name })),
      ...allies.map(asset => ({ id: `asset:${asset.id}`, label: cardName(asset.code) })),
    ]
    if (!options.length) return
    const answer = options.length === 1 ? options[0].id : requestChoice(state, {
      kind: 'target', source: '03230', seat, prompt: '选择治疗目标（调查员或盟友资产）。', options,
    })
    if (String(answer).startsWith('asset:')) {
      const asset = allies.find(item => `asset:${item.id}` === answer)
      if (asset) { asset.damage = Math.max(0, (asset.damage || 0) - 1); asset.horror = Math.max(0, (asset.horror || 0) - 1) }
    } else {
      const target = targets.find(other => `inv:${other.seat}` === answer)
      if (target) { target.damage = Math.max(0, target.damage - 1); target.horror = Math.max(0, target.horror - 1) }
    }
    return
  }
  if (effect.action === 'scrying3') {
    const decks = [
      { id: 'self', label: `${inv.name} 的牌库`, pile: inv.deck },
      ...aliveInvestigators(state).filter(other => other.seat !== seat)
        .map(other => ({ id: `seat:${other.seat}`, label: `${other.name} 的牌库`, pile: other.deck })),
      { id: 'encounter', label: '遭遇牌库', pile: state.encounterDeck },
    ].filter(option => option.pile && option.pile.length)
    if (!decks.length) return
    const deckId = decks.length === 1 ? decks[0].id : requestChoice(state, {
      kind: 'deck', source: '03236', seat, prompt: '选择要查看牌库顶 3 张的牌库。',
      options: decks.map(option => ({ id: option.id, label: option.label })),
    })
    const chosenDeck = decks.find(option => option.id === deckId) || decks[0]
    const cards = chosenDeck.pile.slice(-3)
    if (cards.some(code => (cardDef(code)?.traits || []).some(trait => ['terror', 'omen'].includes(String(trait).toLowerCase())))) {
      applyHorror(state, inv, 1, events)
    }
    if (cards.length > 1) {
      const order = requestChoice(state, { kind: 'order', source: '03236', seat,
        prompt: '选择置于牌库顶的第一张牌。', options: cards.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })) })
      const selected = cards.splice(Number(order), 1)[0]
      chosenDeck.pile.splice(-Math.min(3, chosenDeck.pile.length), Math.min(3, chosenDeck.pile.length), ...cards, selected)
    }
    return
  }
  if (effect.action === 'waylay') {
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && enemy.exhausted && !enemy.elite)
    if (!candidates.length) return
    const target = chooseEnemyFrom(state, seat, candidates, '03237')
    return performTest(state, seat, 'agility', enemyEvadeValue(state, target, inv), { source: { label: '事件', name: cardName('03237'), code: '03237' },
      resolve: result => { if (result.success) { target.defeatedBy = seat; defeatEnemy(state, target, events) } } })
  }
  if (effect.action === 'chanceEncounter2') {
    const candidates = state.investigators.flatMap(owner => owner.discard
      .filter(code => cardDef(code)?.type === 'asset' && (cardDef(code)?.traits || [])
        .some(trait => String(trait).toLowerCase() === 'ally')).map(code => ({ code, owner })))
    if (!candidates.length) return
    const answer = requestChoice(state, { kind: 'card', source: '03238', seat, prompt: '选择弃牌堆中的盟友。',
      options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) })) })
    const picked = candidates[Number(answer)]
    removeOne(picked.owner.discard, picked.code)
    inv.assets.push(newPlayerAssetInstance(state, inv, picked.code))
    return
  }
  if (effect.action === 'emergencyCache3') {
    const answer = requestChoice(state, { kind: 'amount', source: '03239', seat,
      prompt: '选择获得的资源数，其余作为补给放置。', options: Array.from({ length: 5 }, (_, amount) => ({ id: String(amount), label: `${amount}资源／${4 - amount}补给` })) })
    const resources = Number(answer); inv.resources += resources
    const supplies = 4 - resources
    if (supplies) {
      const target = chooseAsset(aliveInvestigators(state).filter(other => other.location === inv.location).flatMap(other => other.assets)
        .filter(item => String(item.usesType).toLowerCase().startsWith('suppl')), '03239')
      if (target) target.uses = (target.uses || 0) + supplies
    }
    return
  }
  if (effect.action === 'onTheHunt') {
    const top = state.encounterDeck.slice(-9)
    const candidates = top.map((code, index) => ({ code, index, def: enemyDef(code) }))
      .filter(item => item.def)
    if (!candidates.length) { drawEncounter(state, inv, events); return }
    const pick = candidates.length === 1 ? candidates[0] : (() => {
      const id = requestChoice(state, { kind: 'enemy', source: '03263', seat,
        prompt: '从遭遇牌库顶 9 张中选择 1 名敌人生成。',
        options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) })) })
      return candidates[Number(id)] || candidates[0]
    })()
    state.encounterDeck.splice(state.encounterDeck.lastIndexOf(pick.code), 1)
    state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
    const spawned = spawnEnemy(state, pick.code, inv.location, seat)
    if (spawned) engageEnemy(state, spawned, seat, events)
    return
  }
  if (effect.action === 'guidance') {
    const targets = aliveInvestigators(state).filter(other => other.seat !== seat && other.location === inv.location && !other.turnEnded)
    if (!targets.length) return
    const targetSeat = targets.length === 1 ? targets[0].seat : Number(requestChoice(state, { kind: 'investigator', source: '03265', seat,
      prompt: '选择获得额外行动的调查员。', options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
    state.investigators[targetSeat].actionsLeft++
    return
  }
  if (effect.action === 'arcaneInsight') {
    const key = `arcaneInsight:${state.round}`
    if (inv.usedReactions?.[key]) {
      if (asset) asset.uses = (asset.uses || 0) + 1
      info(state, events, '「奥术洞察」每回合只能使用一次。')
      return
    }
    inv.usedReactions ||= {}
    inv.usedReactions[key] = true
    const location = state.locations.find(item => item.id === inv.location)
    if (location) location.carcosaShroudModifier = { amount: -2, round: state.round, turnSeat: state.currentSeat }
    return
  }
  if (effect.action === 'narrowEscape') {
    if (state._reaction) state._reaction.cancelled = true
    inv.narrowEscape = { amount: 2, round: state.round, turnSeat: state.currentSeat }
    return
  }
  if (effect.action === 'suggestionEvade') {
    doEvade(state, seat, { enemyId: chooseEnemy(state, seat, {}).id,
      addSkill: 'willpower', suggestionAssetId: asset?.id }, events, true)
    return
  }
  if (effect.action === 'arcaneInitiateEntry') {
    const entered = inv.assets.find(item => item.id === state._reaction?.assetId) || inv.assets.find(item => item.code === '03271')
    if (!entered) return
    const answer = requestChoice(state, { kind: 'effect', source: '03271', seat, prompt: '选择放置1毁灭或2恐惧。',
      options: [{ id: 'doom', label: '放置1毁灭' }, { id: 'horror', label: '放置2恐惧' }] })
    if (answer === 'doom') entered.doom = (entered.doom || 0) + 1
    else entered.horror = (entered.horror || 0) + 2
    return
  }
  if (effect.action === 'trueSurvivor') {
    const candidates = inv.discard.filter(code => cardDef(code)?.type === 'skill'
      && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'innate'))
    for (let count = 0; count < 3 && candidates.length; count++) {
      const code = requestChoice(state, { kind: 'card', source: '03273', seat, prompt: '选择返回手牌的天生技能。',
        options: candidates.map((item, index) => ({ id: String(index), cardCode: item, label: cardName(item) })) })
      const picked = candidates.splice(Number(code), 1)[0]; removeOne(inv.discard, picked); inv.hand.push(picked)
    }
    return
  }
  if (effect.action === 'eatLead') {
    const context = state._reaction?.context || state._reaction || null
    const firearm = (context?.assetId && inv.assets.find(item => item.id === context.assetId))
      || inv.assets.find(item => (cardDef(item.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'firearm') && (item.uses || 0) > 0)
    if (!firearm) return
    const amount = Number(requestChoice(state, { kind: 'amount', source: '03304', seat, prompt: '选择额外花费的弹药。',
      options: Array.from({ length: firearm.uses + 1 }, (_, value) => ({ id: String(value), label: `${value}弹药` })) }))
    firearm.uses -= amount
    if (context) {
      context.extraChaosChoices = (context.extraChaosChoices || 0) + amount
      context.assetId = firearm.id
    } else if (state.skillTest) state.skillTest.extraChaosChoices = (state.skillTest.extraChaosChoices || 0) + amount
    return
  }
  if (effect.action === 'armorArdennes') {
    if (state._reaction?.context) state._reaction.context.cancelDamage =
      (state._reaction.context.cancelDamage || 0) + 1
    else if (state._reaction) state._reaction.damage = Math.max(0, (state._reaction.damage || 0) - 1)
    return
  }
  if (effect.action === 'eideticMemory') {
    const candidates = state.investigators.flatMap(owner => owner.discard.filter(code => cardDef(code)?.type === 'event'
      && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'insight')).map(code => ({ code, owner })))
      .filter(item => inv.resources >= playCost(state, inv, cardDef(item.code)))
    if (!candidates.length) return
    const answer = requestChoice(state, { kind: 'card', source: '03306', seat, prompt: '选择要复制的洞察事件。',
      options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
        label: `${cardName(item.code)}（${playCost(state, inv, cardDef(item.code))}资源）` })) })
    const picked = candidates[Number(answer)]
    const copyCost = playCost(state, inv, cardDef(picked.code))
    inv.resources -= copyCost
    removeOne(picked.owner.discard, picked.code); state.removedFromGame ||= []; state.removedFromGame.push(picked.code)
    const copied = EFFECTS[picked.code]
    if (copied?.event) resolveEffect(state, seat, copied.event, makeRuntime(state, events))
    return
  }
  if (effect.action === 'luparaFight') {
    doFight(state, seat, { enemyId: chooseEnemy(state, seat, {}).id,
      combatBonus: asset?.enteredRound === state.round ? 2 : 1,
      damageBonus: asset?.enteredRound === state.round ? 2 : 1 }, events, true)
    return
  }
  if (effect.action === 'cheatDeath') {
    for (const enemy of state.enemies.filter(item => item.engagedSeat === seat)) disengageEnemy(state, enemy, events)
    for (const threat of inv.threat.slice()) { removeOne(inv.threat, threat); inv.discard.push(threat.code) }
    inv.damage = Math.max(0, inv.damage - 2); inv.horror = Math.max(0, inv.horror - 2)
    const locations = state.locations.filter(location => location.revealed && !state.enemies.some(enemy => enemy.location === location.id))
    if (locations.length) {
      const destination = requestChoice(state, { kind: 'location', source: '03310', seat, prompt: '选择没有敌人的已揭示地点。',
        options: locations.map(location => ({ id: location.id, label: locName(state, location.id) })) })
      relocateInvestigator(state, seat, destination, events)
    }
    if (state.currentSeat === seat) { inv.actionsLeft = 0; inv.turnEnded = true }
    return
  }
  if (effect.action === 'timeWarp') {
    const snapshot = state.lastActionSnapshot
    if (!snapshot) return
    const preserved = { hand: inv.hand.slice(), resources: inv.resources, discard: inv.discard.slice(), removedFromGame: (state.removedFromGame || []).slice() }
    const resolution = state._resolution
    const revision = state.revision
    for (const key of Object.keys(state)) delete state[key]
    Object.assign(state, structuredClone(snapshot))
    Object.assign(state.investigators[seat], preserved)
    state.removedFromGame = preserved.removedFromGame
    state._resolution = resolution
    state.revision = revision
    state._timeWarped = true
    return
  }
  if (effect.action === 'infighting') {
    inv.infighting = { round: state.round, phase: 'enemy' }
    return
  }
  throw new Error(`未实现的卡尔克萨玩家卡效果：${effect.action}`)
}

function carcosaInvestigatorEffect(state, seat, effect, events) {
  const inv = state.investigators[seat]
  if (effect.action === 'spiritSpeaker') {
    const candidates = inv.assets.filter(asset => asset.id !== effect.assetId && isChargeAsset(asset)
      && !assetCannotLeavePlay(asset))
    if (!candidates.length) return
    const targetId = requestChoice(state, { kind: 'target', source: '03014', seat,
      prompt: '选择一个由你控制的充能支援。', options: candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
    const asset = candidates.find(item => item.id === targetId)
    const mode = requestChoice(state, { kind: 'effect', source: '03014', seat,
      prompt: '选择灵语人的结算方式。', options: [
        { id: 'return', label: '将支援返回手牌' },
        { id: 'resources', label: `获得 ${asset.uses || 0} 资源并弃置支援` },
      ] })
    leaveAsset(state, inv, asset, events)
    if (mode === 'return') inv.hand.push(asset.code)
    else {
      inv.resources += asset.uses || 0
      inv.discard.push(asset.code)
    }
    info(state, events, `「${cardName('03014')}」将「${cardName(asset.code)}」${mode === 'return' ? '返回手牌' : '转化充能并弃置'}。`)
    return
  }
  if (effect.action === 'angeredSpirits') {
    const source = controlledAbilityCard(inv, effect.assetId)
    const candidates = inv.assets.filter(asset => !asset.exhausted && isChargeAsset(asset) && (asset.uses || 0) > 0
      && (cardDef(asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'spell'))
    if (!source || !candidates.length) return
    const targetId = requestChoice(state, { kind: 'target', source: '03015', seat,
      prompt: '选择并横置一个有充能的法术支援。', options: candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
    const asset = candidates.find(item => item.id === targetId)
    asset.exhausted = true
    asset.uses -= 1
    source.uses = (source.uses || 0) + 1
    info(state, events, `「${cardName('03015')}」从「${cardName(asset.code)}」移动了1个充能（${source.uses}/4）。`)
    return
  }
  if (effect.action === 'yorickPlayAsset') {
    if (discardLocked(state, inv)) return
    const candidates = inv.discard.filter(code => {
      const def = cardDef(code)
      if (!def || def.type !== 'asset' || isWeaknessCard(def) || inv.resources < playCost(state, inv, def)) return false
      if (def.unique && state.investigators.some(owner => owner.assets.some(asset => cardDef(asset.code)?.name === def.name))) return false
      return assetReplacementPlans(inv, def).length > 0
    })
    if (!candidates.length) return
    const choice = requestChoice(state, { kind: 'discard', source: 'yorickAsset', seat, canSkip: true,
      prompt: '选择弃牌堆中的一个支援，支付费用并打出。', options: [{ id: 'skip', label: '不打出支援' },
        ...candidates.map((code, index) => ({ id: String(index), cardCode: code, label: `${cardName(code)}（${playCost(state, inv, cardDef(code))}资源）` }))] })
    if (choice === 'skip') return
    const code = candidates[Number(choice)]
    inv.discard.splice(inv.discard.indexOf(code), 1)
    inv.hand.push(code)
    doPlay(state, seat, code, events, false, true)
    return
  }
  if (effect.action === 'yorickElderSign') {
    if (discardLocked(state, inv) || !inv.discard.length) return
    const choice = requestChoice(state, { kind: 'discard', source: 'yorickElderSign', seat, canSkip: true,
      prompt: '旧印成功：可以将弃牌堆中的一张牌返回手牌。', options: [{ id: 'skip', label: '不返回' },
        ...inv.discard.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))] })
    if (choice !== 'skip') inv.hand.push(...inv.discard.splice(Number(choice), 1))
    return
  }
  if (effect.action === 'buryThemDeep') {
    const enemy = state._reaction?.enemy
    if (!enemy || enemy.elite) return
    const originalCode = enemy.originalCode || enemy.code
    const owner = state.investigators[enemy.bearerSeat]
    const piles = owner ? [owner.discard, state.encounterDiscard] : [state.encounterDiscard]
    for (const pile of piles) {
      const index = pile.lastIndexOf(enemy.code)
      if (index >= 0) { pile.splice(index, 1); break }
    }
    if (!state.victoryDisplay.some(card => card.id === enemy.id)) {
      state.victoryDisplay.push({ id: enemy.id, code: enemy.code, originalCode, victory: enemy.victory || 0 })
    }
    state._reaction.eventToVictory = '03016'
    info(state, events, `「${cardName('03016')}」将「${enemy.name}」和自身加入胜利区。`)
    return
  }
  if (effect.action === 'lolaSwitchRole') {
    const role = chooseLolaRole(state, inv, effect.action, '选择罗拉要切换到的角色。')
    info(state, events, `${inv.name} 切换为${CLASS_NAMES[role] || role}角色。`)
    return
  }
  if (effect.action === 'improvisation') {
    const role = chooseLolaRole(state, inv, '03018', '选择即兴表演要切换到的角色。')
    inv.lolaDiscount = { role, amount: 3, round: state.round, turnSeat: state.currentSeat }
    for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
    info(state, events, `${inv.name} 切换为${CLASS_NAMES[role] || role}；本回合下一张该阵营卡牌费用-3。`)
    return
  }
  if (effect.action === 'sefinaDrawBeneath' || effect.action === 'sefinaElderSign') {
    if (!inv.beneath?.length) return
    const choice = requestChoice(state, { kind: 'beneath', source: effect.action === 'sefinaElderSign' ? 'sefinaElderSign' : 'sefinaBeneath',
      seat, canSkip: effect.action === 'sefinaElderSign',
      prompt: '选择赛菲娜下方的一张事件加入手牌。',
      options: [...(effect.action === 'sefinaElderSign' ? [{ id: 'skip', label: '不抽取下方事件' }] : []),
        ...inv.beneath.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))] })
    if (choice === 'skip') return
    inv.hand.push(...inv.beneath.splice(Number(choice), 1))
    return
  }
  throw new Error(`未实现的卡尔克萨调查员效果：${effect.action}`)
}

function dunwichPlayerEffect(state, seat, effect, events) {
  const inv = state.investigators[seat]
  if (effect.type === 'engageEnemies') {
    const enemies = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat !== seat)
    for (const enemy of enemies) engageEnemy(state, enemy, seat, events)
    if (effect.drawPerEnemy) for (const line of drawCards(state, inv, enemies.length, events)) info(state, events, line)
    return
  }
  if (effect.type === 'teamwork') {
    const others = aliveInvestigators(state).filter(other => other.seat !== seat && other.location === inv.location)
    if (!others.length) return
    const targetSeat = others.length === 1 ? String(others[0].seat) : requestChoice(state, {
      kind: 'target', source: '02018', seat, prompt: '选择交换物品、盟友或资源的调查员。',
      options: others.map(other => ({ id: String(other.seat), label: other.name })),
    })
    const target = others.find(other => String(other.seat) === targetSeat)
    const options = []
    if (inv.resources) options.push({ id: 'resource', label: '交给对方 1 资源' })
    for (const asset of inv.assets.filter(item => (cardDef(item.code)?.traits || []).some(t => ['item', 'ally'].includes(String(t).toLowerCase()))))
      options.push({ id: asset.id, label: `交给对方：${cardName(asset.code)}` })
    if (!options.length) return
    const answer = requestChoice(state, { kind: 'target', source: '02018', seat, prompt: '选择要交换的内容。', options })
    if (answer === 'resource') { inv.resources--; target.resources++ }
    else { const asset = inv.assets.find(item => item.id === answer); if (asset) { leaveAsset(state, inv, asset); target.assets.push(asset) } }
    return
  }
  if (effect.type === 'investigateConnectingClue') {
    const loc = state.locations.find(item => item.id === inv.location)
    const targets = (loc?.connections || []).map(id => state.locations.find(item => item.id === id)).filter(item => item?.clues > 0)
    if (!targets.length) return doInvestigate(state, seat, {}, events, true)
    return performTest(state, seat, 'intellect', loc.shroud + (loc.shroudMod || 0), { source: { label: '调查', name: cardName('02023'), code: '02023' }, resolve: result => {
      if (!result.success) return
      const targetId = targets.length === 1 ? targets[0].id : requestChoice(state, { kind: 'location', source: '02023', seat,
        prompt: '选择一个连接地点发现线索。', options: targets.map(item => ({ id: item.id, label: item.name })) })
      const target = targets.find(item => item.id === targetId)
      target.clues--; inv.clues++; info(state, events, `${inv.name} 从「${target.name}」发现 1 条线索。`)
      notifyCluesRemoved(state, target, 1, events)
    } })
  }
  if (effect.type === 'liquidCourage') {
    const targets = aliveInvestigators(state).filter(other => other.location === inv.location && other.horror > 0)
    if (!targets.length) return
    const targetSeat = targets.length === 1 ? String(targets[0].seat) : requestChoice(state, { kind: 'target', source: '02024', seat,
      prompt: '选择治疗恐惧的调查员。', options: targets.map(other => ({ id: String(other.seat), label: other.name })) })
    const target = targets.find(other => String(other.seat) === targetSeat)
    target.horror--
    return performTest(state, target.seat, 'willpower', 2, { source: { label: '饮用烈酒', name: cardName('02024'), code: '02024' }, resolve: result => {
      if (result.success) {
        const healed = Math.min(target.horror, 1)
        target.horror -= healed
        info(state, events, `${target.name} 检定成功，额外治愈 ${healed} 点恐惧。`)
      } else {
        info(state, events, `${target.name} 检定失败，随机弃掉 1 张手牌。`)
        discardRandomFromHand(state, target, 1, events)
      }
    } })
  }
  if (effect.type === 'bindMonster') {
    const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite && !enemy.bindMonster)
    if (!candidates.length) { info(state, events, '本地点没有可绑定的非精英敌人。'); return }
    const id = candidates.length === 1 ? candidates[0].id : requestChoice(state, {
      kind: 'target', source: '02031', seat, prompt: '选择要绑定的非精英敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const enemy = candidates.find(item => item.id === id)
    return performTest(state, seat, 'willpower', enemyEvadeValue(state, enemy, inv), {
      source: { label: '绑定怪物', name: enemy.name, code: '02031' }, resolve: result => {
        if (!result.success || !state.enemies.includes(enemy)) return
        // Evade the enemy, then attach Bind Monster to it.
        enemy.exhausted = true
        if (enemy.engagedSeat != null) disengageEnemy(state, enemy)
        enemy.bindMonster = { ownerSeat: seat, code: '02031' }
        info(state, events, `「绑定怪物」附属于「${enemy.name}」；它被躲避，不能移动，并在重整阶段保持横置。`)
      },
    })
  }
  if (effect.type === 'doubleUses') {
    const targets = aliveInvestigators(state).filter(other => other.location === inv.location).flatMap(owner => owner.assets.filter(asset => effect.usesTypes.includes(asset.usesType)))
    if (!targets.length) return
    const id = requestChoice(state, { kind: 'target', source: '02109', seat, prompt: '选择弹药或补给翻倍的支援。', options: targets.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
    const asset = targets.find(item => item.id === id); if (asset) asset.uses *= 2
    return
  }
  if (effect.type === 'drawEncounterAll') { for (const target of aliveInvestigators(state)) drawEncounter(state, target, events); return }
  if (effect.type === 'redirectFailedAttack') {
    const context = state._reaction?.context || state._reaction
    if (context?.when !== 'attackFail' && state._reaction?.when !== 'attackFail') return
    const original = context.enemy
    const targets = state.enemies.filter(enemy => enemy.location === inv.location && enemy.id !== original?.id)
    if (!targets.length) return
    const id = targets.length === 1 ? targets[0].id : requestChoice(state, {
      kind: 'target', source: '02113', seat, prompt: '选择承受这次攻击伤害的另一名敌人。',
      options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const target = targets.find(enemy => enemy.id === id)
    context.redirected = true
    damageEnemy(state, target, Math.max(1, context.attackDamage || 1), seat, events, '02113')
    info(state, events, `${inv.name} 的攻击落空后改为对「${target.name}」造成 ${Math.max(1, context.attackDamage || 1)} 点伤害。`)
    return
  }
  if (effect.type === 'flare') {
    const choice = requestChoice(state, { kind: 'effect', source: '02115', seat, prompt: '选择照明弹的效果。',
      options: [{ id: 'fight', label: '战斗 +3，伤害 +2' }, { id: 'ally', label: '搜索任意调查员牌库顶 9 张并使一名盟友入场' }] })
    if (choice === 'fight') return doFight(state, seat, { enemyId: chooseEnemy(state, seat, {}).id, combatBonus: 3, damageBonus: 2 }, events, true)
    const owners = aliveInvestigators(state)
    const ownerSeat = owners.length === 1 ? owners[0].seat : Number(requestChoice(state, { kind: 'target', source: '02115', seat,
      prompt: '选择要搜索的牌库。', options: owners.map(owner => ({ id: String(owner.seat), label: `${owner.name} 的牌库` })) }))
    const owner = state.investigators[ownerSeat]
    const cards = owner.deck.slice(-Math.min(9, owner.deck.length))
    const allies = cards.filter(code => (cardDef(code)?.traits || []).some(t => String(t).toLowerCase() === 'ally'))
    if (allies.length) {
      const code = allies.length === 1 ? allies[0] : allies[Number(requestChoice(state, { kind: 'card', source: '02115', seat,
        prompt: '选择要放置入场的盟友支援。', options: allies.map((item, index) => ({ id: String(index), cardCode: item, label: cardName(item) })) }))]
      const index = owner.deck.lastIndexOf(code)
      owner.deck.splice(index, 1)
      const asset = newCardInstance(state, code, { exhausted: false }); inv.assets.push(asset)
      triggerReaction(state, seat, 'assetEnteredPlay', events, { assetCode: code, assetId: asset.id, location: inv.location })
    }
    owner.deck = shuffle(owner.deck, () => randomValue(state)); return
  }
  if (effect.type === 'standTogether') {
    const targets = aliveInvestigators(state).filter(other => other.seat !== seat && other.location === inv.location)
    if (!targets.length) return
    const target = targets.length === 1 ? targets[0] : targets.find(other => other.seat === Number(requestChoice(state, {
      kind: 'target', source: '02148', seat, prompt: '选择与你共享卡牌与资源的调查员。',
      options: targets.map(other => ({ id: String(other.seat), label: other.name })),
    })))
    for (const owner of [inv, target]) { owner.resources += 2; for (const line of drawCards(state, owner, 2, events)) info(state, events, line) }
    return
  }
  if (effect.type === 'resign') { doResign(state, seat, events); return }
  if (effect.type === 'hypnoticGaze') {
    if (state._reaction?.when !== 'enemyAttack') return
    state._reaction.cancelled = true
    beginChaosTest(state); const token = drawChaosToken(state); endChaosTest(state, [token])
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) {
      const enemy = state._reaction.context?.enemy || state._reaction.enemy
      if (enemy) damageEnemy(state, enemy, enemy.damage || 0, seat, events)
    }
    return
  }
  if (effect.type === 'attachLure') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (loc) loc.lure = { seat, round: state.round, code: '02156' }
    return
  }
  if (effect.type === 'healHorrorAtLocationByEnemy') {
    const enemy = state._reaction?.context?.enemy || state._reaction?.enemy
    if (!enemy || !(enemy.traits || []).some(t => String(t).toLowerCase() === 'monster')) return
    for (const target of aliveInvestigators(state).filter(other => other.location === inv.location))
      target.horror = Math.max(0, target.horror - (enemy.horror || 0))
    return
  }
  if (effect.type === 'exposeWeakness') {
    const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
    if (!enemies.length) { info(state, events, '本地点没有可选择弱点的敌人。'); return }
    const enemy = enemies.length === 1 ? enemies[0] : enemies.find(item => item.id === requestChoice(state, {
      kind: 'target', source: '02228', seat, prompt: '选择要暴露弱点的敌人。',
      options: enemies.map(item => ({ id: item.id, label: item.name })),
    }))
    if (!enemy) return
    const difficulty = enemyFightValue(state, enemy, inv)
    return performTest(state, seat, 'intellect', difficulty, { source: { label: '揭露弱点', name: enemy.name, code: '02228' }, resolve: result => {
      if (!result.success) return
      const margin = Math.max(1, result.value - difficulty)
      const active = enemy.fightReduction?.round === state.round && enemy.fightReduction.phase === state.phase
      enemy.fightReduction = { amount: (active ? enemy.fightReduction.amount : 0) + margin, round: state.round, phase: state.phase }
      info(state, events, `「${enemy.name}」本阶段下一次被攻击时战斗值 -${margin}。`)
    } })
  }
  if (effect.type === 'lookTopDeckAndDoom') {
    const choice = requestChoice(state, { kind: 'deck', source: effect.assetId || '02232', seat, prompt: '选择查看的牌库。',
      options: [{ id: 'encounter', label: '遭遇牌库' }, ...state.investigators.map(owner => ({ id: String(owner.seat), label: `${owner.name} 的牌库` }))] })
    const deck = choice === 'encounter' ? state.encounterDeck : state.investigators[Number(choice)].deck
    const top = deck.at(-1); if (!top) return
    const asset = inv.assets.find(item => item.id === effect.assetId)
    const bury = requestChoice(state, { kind: 'card', source: effect.assetId || '02232', seat, prompt: `顶牌是「${cardName(top)}」，是否放到牌库底并在艾丽莎上放 1 毁灭？`,
      options: [{ id: 'keep', label: '保留在顶端' }, { id: 'bottom', label: '放到牌库底' }] })
    if (bury === 'bottom') { deck.pop(); deck.unshift(top); if (asset) asset.doom = (asset.doom || 0) + 1 }
    return
  }
  if (effect.type === 'redrawChaos') return
  if (effect.type === 'cancelHarmGainResources') {
    const context = state._reaction
    if (!context || context.when !== 'harmDealt') return
    const maximum = Math.min(effect.maximum || 5, (context.damage || 0) + (context.horror || 0))
    const options = []
    for (let damage = 0; damage <= Math.min(context.damage || 0, maximum); damage++) {
      for (let horror = 0; horror <= Math.min(context.horror || 0, maximum - damage); horror++) {
        if (damage + horror > 0) options.push({ id: `${damage}:${horror}`,
          label: `取消 ${damage} 伤害、${horror} 恐惧${effect.noResources ? '' : `（获得 ${damage + horror} 资源）`}` })
      }
    }
    if (!options.length) return
    const answer = options.length === 1 ? options[0].id : requestChoice(state, {
      kind: 'harm', source: '02261', seat, prompt: '选择“我见过更糟的”要取消的伤害与恐惧。', options,
    })
    const [damage, horror] = answer.split(':').map(Number)
    context.damage -= damage; context.horror -= horror
    if (!effect.noResources) inv.resources += damage + horror
    info(state, events, `${inv.name} 取消 ${damage} 点伤害与 ${horror} 点恐惧${effect.noResources ? '。' : `，并获得 ${damage + horror} 资源。`}`)
    return
  }
  if (effect.type === 'removeDoomControlled') {
    const targets = inv.assets.filter(asset => (asset.doom || 0) > 0); if (!targets.length) return
    const target = targets.length === 1 ? targets[0] : targets.find(asset => asset.id === requestChoice(state, {
      kind: 'target', source: '02267', seat, prompt: '选择要移除全部毁灭标记的卡牌。',
      options: targets.map(asset => ({ id: asset.id, label: `${cardName(asset.code)}（${asset.doom} 毁灭）` })),
    }))
    if (!target) return
    target.doom = 0
    info(state, events, `「${cardName(target.code)}」上的毁灭标记被全部移除。`)
    return
  }
  if (effect.type === 'temporaryAllyFromDiscard') {
    const candidates = aliveInvestigators(state).flatMap(owner => owner.discard
      .map(code => ({ owner, code }))
      .filter(item => (cardDef(item.code)?.traits || []).some(t => String(t).toLowerCase() === 'ally')))
    if (!candidates.length) return
    const chosen = candidates.length === 1 ? candidates[0] : (() => {
      const id = requestChoice(state, { kind: 'card', source: '02270', seat, prompt: '选择任意玩家弃牌堆中的盟友支援。',
        options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
          label: `${cardName(item.code)}（${item.owner.name} 的弃牌堆）` })) })
      return candidates[Number(id)]
    })()
    const index = chosen.owner.discard.indexOf(chosen.code); chosen.owner.discard.splice(index, 1)
    inv.assets.push(newCardInstance(state, chosen.code, { exhausted: false, temporaryAllyRound: state.round }))
    info(state, events, `${inv.name} 让「${cardName(chosen.code)}」暂时入场。`)
    return
  }
  if (effect.type === 'playItemFromHand') {
    const items = inv.hand.map((code, index) => ({ code, index }))
      .filter(item => (cardDef(item.code)?.traits || []).some(t => String(t).toLowerCase() === 'item'))
    if (!items.length) return
    const chosen = items.length === 1 ? items[0] : items.find(item => String(item.index) === requestChoice(state, {
      kind: 'card', source: '02265', seat, prompt: '选择要打出的道具支援（支付其费用）。',
      options: items.map(item => ({ id: String(item.index), cardCode: item.code, label: cardName(item.code) })),
    }))
    const code = chosen.code; doPlay(state, seat, code, events); return
  }
  if (effect.type === 'decipheredReality') {
    const revealed = state.locations.filter(loc => loc.revealed)
    const difficulty = Math.max(0, ...revealed.map(loc => loc.shroud + (loc.shroudMod || 0)))
    return performTest(state, seat, 'intellect', difficulty, { source: { label: '调查', name: cardName('02303'), code: '02303' }, resolve: result => {
      if (result.success) for (const loc of revealed) if (loc.clues > 0) { loc.clues--; inv.clues++; notifyCluesRemoved(state, loc, 1, events) }
    } })
  }
  if (effect.type === 'redrawEncounter') {
    const context = state._reaction?.context || state._reaction
    if (context?.when === 'encounterDrawn' || state._reaction?.when === 'encounterDrawn') {
      context.cancelled = true
      context.redraw = true
    }
    return
  }
  if (effect.type === 'returnCommittedSkill') {
    const candidates = (state.skillTest?.committed || []).filter(item => item.seat === seat && cardDef(item.code)?.type === 'skill')
    if (!candidates.length) return
    const id = candidates.length === 1 ? '0' : requestChoice(state, { kind: 'card', source: '02309', seat,
      prompt: '选择一张已投入的技能牌返回其持有者手牌。',
      options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
        label: `${cardName(item.code)}（${state.investigators[item.seat].name}）` })),
    })
    const chosen = candidates[Number(id)]
    const index = state.skillTest.committed.indexOf(chosen)
    if (index >= 0) state.skillTest.committed.splice(index, 1)
    state.investigators[chosen.seat].hand.push(chosen.code)
    info(state, events, `「再试一次」将 ${cardName(chosen.code)} 返回 ${state.investigators[chosen.seat].name} 的手牌。`)
    return
  }
  if (effect.type === 'redGlovedManSkills') {
    const asset = inv.assets.find(item => item.code === '02310')
    if (!asset) return
    const pool = ['willpower', 'intellect', 'combat', 'agility']
    const first = requestChoice(state, { kind: 'target', source: '02310', seat,
      prompt: '选择第一项技能（只要戴红手套的男子在场，其基础值提升为 6）。',
      options: pool.map(skill => ({ id: skill, label: SKILL_NAMES[skill] })) })
    const second = requestChoice(state, { kind: 'target', source: '02310', seat,
      prompt: '选择第二项技能（基础值提升为 6）。',
      options: pool.filter(skill => skill !== first).map(skill => ({ id: skill, label: SKILL_NAMES[skill] })) })
    asset.statOverride = [first, second]
    info(state, events, `${inv.name} 的${SKILL_NAMES[first]}与${SKILL_NAMES[second]}基础值提升为 6。`)
    return
  }
  info(state, events, `「${effect.type}」已进入敦威治专属时序。`)
}

function exilePlayerCard(state, inv, code, events) {
  state.exiled.push(code)
  state.exiledBySeat ||= []
  state.exiledBySeat.push({ seat: inv.seat, code })
  info(state, events, `${inv.name} 流放「${cardName(code)}」；本关结束后从战役牌组移除。`)
}

function makeRuntime(state, events) {
  return {
    cancelPending: (when) => {
      if (!state._reaction || state._reaction.when !== when) throw new Error('当前没有可取消的结算')
      state._reaction.cancelled = true
    },
    substituteSkill: (seat, from, to) => {
      const target = state.investigators[seat]
      target.skillSubstitute = { from: [...from], to, round: state.round }
      info(state, events, `${target.name} 本轮可用${SKILL_NAMES[to]}代替${from.map(skill => SKILL_NAMES[skill]).join('、')}。`)
    },
    info: (text) => info(state, events, text),
    effectError: (seat, effect) => effectError(state, state.investigators[seat], effect),
    chooseEnemy: (seat, effect) => chooseEnemy(state, seat, effect),
    search: (seat, effect) => searchCards(state, seat, effect, events),
    drawCards: (inv, n) => drawCards(state, inv, n, events),
    checkDefeated: (seat) => checkDefeated(state, seat, events),
    applyDamage: (seat, amount, direct) => applyDamage(state, state.investigators[seat], amount, events, direct),
    applyHorror: (seat, amount, direct) => applyHorror(state, state.investigators[seat], amount, events, direct),
    discoverClue: (inv, amount) => discoverClueAt(state, inv, amount, events),
    addDoom: (amount) => addDoom(state, amount, events),
    enemyForTarget: (seat, target) => enemyForTarget(state, seat, target),
    defeatEnemy: (enemy) => defeatEnemy(state, enemy, events),
    damageEnemy: (enemy, amount, seat) => damageEnemy(state, enemy, amount, seat, events),
    canGainResources: seat => scenarioBehavior(state).canGainResources?.(state, state.investigators[seat]) !== false,
    canReadyAssets: seat => !assetsCannotReady(state.investigators[seat]),
    investigate: (seat, opts) => doInvestigate(state, seat, opts || {}, events, true),
    fight: (seat, opts) => doFight(state, seat, opts || {}, events, true),
    evade: (seat, opts) => doEvade(state, seat, opts || {}, events, true),
    autoEvade: (enemy) => autoEvadeEnemy(state, enemy, events),
    discardRandomFromHand: (inv, n) => discardRandomFromHand(state, inv, n, events),
    discardRandomAsset: (inv) => discardRandomAsset(state, inv, events),
    discardHandTo: (inv, keep) => discardHandTo(state, inv, keep, events),
    reloadAmmo: (inv, amount, effect) => reloadAmmo(state, inv, amount, events, effect),
    defeatNonEliteEnemy: (seat, target) => defeatNonEliteEnemyAt(state, seat, target, events),
    rechargeAsset: (inv, amount, effect) => rechargeAsset(state, inv, amount, events, effect),
    exileCards: (inv, arr) => { for (const c of arr) state.exiled.push(c) },
    performTest: (seat, skill, difficulty, options) => performTest(state, seat, skill, difficulty, options),
    spawnEnemy: (code, loc, engagedSeat) => spawnEnemy(state, code, loc, engagedSeat),
    locName: (id) => locName(state, id),
    autoEngageAt: (loc) => autoEngageAt(state, loc, events),
    exhaustSelf: () => {},
    chooseInvestigator: (seat, target, effect, constraints) => chooseInvestigator(state, seat, target, effect, constraints),
    healDamageAtLocation: (seat, amount) => healDamageAtLocation(state, seat, amount, events),
    healHorrorNearby: (seat, amount) => healHorrorNearby(state, seat, amount, events),
    dukeInvestigate: seat => dukeInvestigate(state, seat, events),
    dunwichPlayerEffect: (seat, effect) => dunwichPlayerEffect(state, seat, effect, events),
    carcosaInvestigatorEffect: (seat, effect) => carcosaInvestigatorEffect(state, seat, effect, events),
    carcosaPlayerEffect: (seat, effect) => carcosaPlayerEffect(state, seat, effect, events),
    researchSolution: (seat, assetId) => researchSolution(state, seat, assetId, events),
    searchTop: (seat, effect) => searchTop(state, seat, effect, events),
    investigateForResources: (seat, effect) => investigateForResources(state, seat, effect, events),
    moveTo: (seat, effect) => moveInvestigatorTo(state, seat, effect, events),
    moveInvestigator: (seat, destination) => relocateInvestigator(state, seat, destination, events),
    dealDamageAll: (seat, effect) => dealDamageAll(state, seat, effect, events),
    dealDamageExhausted: (seat, effect) => dealDamageExhausted(state, seat, effect, events),
    blankEnemy: (seat, effect) => blankEnemy(state, seat, effect, events),
    ignoreChaos: (seat, effect) => ignoreChaos(state, seat, effect, events),
    returnAssetToHand: (seat, effect) => returnAssetToHand(state, seat, effect, events),
    shuffleIntoEncounter: (seat, effect) => shuffleIntoEncounter(state, seat, effect, events),
    moveHorrorToInvestigator: (seat, effect) => moveHorrorToInvestigator(state, seat, effect, events),
    searchDiscard: (seat, effect) => searchDiscard(state, seat, effect, events),
    autoEvadeNonElite: (seat, effect) => autoEvadeNonElite(state, seat, effect, events),
    attachBarricade: (seat, effect) => attachBarricade(state, seat, effect, events),
    drawEncounter: (seat) => { const inv = state.investigators[seat]; drawEncounter(state, inv, events) },
    addTestValue: (amount) => {
      if (state._reaction) state._reaction.testBonus = (state._reaction.testBonus || 0) + amount
      else if (state.skillTest) state.skillTest.pendingBonus = (state.skillTest.pendingBonus || 0) + amount
    },
    disengageAll: (seat) => disengageAll(state, seat, events),
    flipTokenSign: () => { if (state._reaction) state._reaction.flipTokenSign = true },
    scry: (seat, effect) => scryDeck(state, seat, effect, events),
    gainClues: (inv, amount) => { inv.clues += amount; syncClues(state); info(state, events, `${inv.name} 从供应堆获得 ${amount} 个线索（个人 ${inv.clues}）。`) },
    targetedTest: (seat, effect) => targetedTest(state, seat, effect, events),
    reactionContext: null,
  }
}

function discardHandTo(state, inv, keep, events) {
  while (inv.hand.length > keep) {
    const options = inv.hand.map((code, index) => ({ code, index }))
      .filter(item => !isWeaknessCode(item.code) && canDiscardFromHand(inv, item.code))
      .map(item => ({ id: String(item.index), label: cardName(item.code) }))
    if (!options.length) break
    const answer = requestChoice(state, { kind: 'discard', source: 'hand-limit', seat: inv.seat, prompt: `选择弃牌，保留至 ${keep} 张。`, options })
    const code = inv.hand.splice(Number(answer), 1)[0]
    inv.discard.push(code)
    info(state, events, `${inv.name} 弃掉了「${cardName(code)}」。`)
  }
}

function discardableHandCards(inv, requiredIcon = null) {
  return inv.hand.map((code, index) => ({ code, index })).filter(({ code }) =>
    !isWeaknessCode(code) && canDiscardFromHand(inv, code)
      && (!requiredIcon || Number(cardDef(code)?.icons?.[requiredIcon] || 0) > 0))
}

function discardChosenCards(state, inv, count, events, source, requiredIcon = null) {
  let discarded = 0
  for (let i = 0; i < count && discardableHandCards(inv, requiredIcon).length; i++) {
    const answer = requestChoice(state, {
      kind: 'discard', source, seat: inv.seat, prompt: `选择要弃掉的手牌（还需 ${count - i} 张）。`,
      options: discardableHandCards(inv, requiredIcon)
        .map(({ code, index }) => ({ id: String(index), cardCode: code, label: cardName(code) })),
    })
    const code = inv.hand.splice(Number(answer), 1)[0]
    inv.discard.push(code)
    info(state, events, `${inv.name} 弃掉了「${cardName(code)}」。`)
    discarded++
  }
  return discarded
}

function refillAsset(state, inv, amount, events, { usesType, kind, emptyText, verb, icon, trait = null }) {
  const candidates = inv.assets.filter((asset) => {
    const eff = assetEffect(inv, asset)
    if (!eff || eff.uses == null) return false
    if (usesType && (eff.usesType || 'charges') !== usesType) return false
    if (trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(trait).toLowerCase())) return false
    return true
  })
  if (!candidates.length) {
    info(state, events, emptyText)
    return
  }
  const id = chooseAmong(state, {
    kind, source: 'refill-asset', seat: inv.seat, prompt: `选择要${verb}的资产。`,
    options: candidates.map((asset) => ({ id: asset.id, label: cardName(asset.code) })),
  })
  const asset = candidates.find((item) => item.id === id)
  const eff = assetEffect(inv, asset)
  asset.uses = (asset.uses || 0) + amount
  info(state, events, `${icon} 「${cardName(asset.code)}」${verb} ${amount}（当前 ${asset.uses}/${eff.uses}）。`)
}

function reloadAmmo(state, inv, amount, events, opts = {}) {
  const roots = aliveInvestigators(state).filter(item => item.location === inv.location)
  const candidates = []
  for (const owner of roots) {
    for (const asset of owner.assets) {
      const eff = assetEffect(owner, asset)
      if (!eff || eff.uses == null) continue
      if ((eff.usesType || 'charges') !== 'ammo') continue
      if (opts.trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(opts.trait).toLowerCase())) continue
      candidates.push({ owner, asset, max: eff.uses })
    }
  }
  if (!candidates.length) { info(state, events, `${inv.name} 所在地点没有可装填的弹药武器。`); return }
  const chosen = candidates.length === 1 ? candidates[0] : (() => {
    const id = requestChoice(state, { kind: 'reload', source: 'reload', seat: inv.seat,
      prompt: '选择要装填的资产。',
      options: candidates.map(item => ({ id: item.asset.id, label: `${cardName(item.asset.code)}（${item.owner.name}）` })) })
    return candidates.find(item => item.asset.id === id)
  })()
  chosen.asset.uses = (chosen.asset.uses || 0) + amount
  info(state, events, `🔫 「${cardName(chosen.asset.code)}」装填 ${amount}（当前 ${chosen.asset.uses}/${chosen.max}）。`)
}

function defeatNonEliteEnemyAt(state, seat, target, events) {
  const inv = state.investigators[seat]
  if (typeof target === 'string' && target.startsWith('id:')) {
    const chosen = state.enemies.find(enemy => enemy.id === target.slice(3) && !enemy.elite)
    if (!chosen) { info(state, events, '没有可放逐的非精英敌人。'); return }
    info(state, events, `「${chosen.name}」（非精英）被放逐。`)
    removeOne(state.enemies, chosen)
    if (chosen.engagedSeat != null) {
      const eng = state.investigators[chosen.engagedSeat]
      if (eng) removeOne(eng.engaged, chosen.id)
    }
    if (isWeaknessCode(chosen.code)) state.investigators[chosen.bearerSeat ?? seat].discard.push(chosen.code)
    else state.encounterDiscard.push(chosen.code)
    return
  }
  const candidates = state.enemies.filter((e) => e.location === inv.location && !e.elite)
  if (!candidates.length) {
    info(state, events, '这里没有非精英敌人。')
    return
  }
  const id = chooseAmong(state, {
    kind: 'target', source: 'defeat-non-elite', seat, prompt: '选择要放逐的非精英敌人。',
    options: candidates.map((enemy) => ({ id: enemy.id, label: enemy.name })),
  })
  const enemy = candidates.find((item) => item.id === id)
  info(state, events, `「${enemy.name}」（非精英）被放逐。`)
  removeOne(state.enemies, enemy)
  if (enemy.engagedSeat != null) {
    const eng = state.investigators[enemy.engagedSeat]
    if (eng) removeOne(eng.engaged, enemy.id)
  }
  if (isWeaknessCode(enemy.code)) state.investigators[enemy.bearerSeat ?? seat].discard.push(enemy.code)
  else state.encounterDiscard.push(enemy.code)
}

function rechargeAsset(state, inv, amount, events, opts = {}) {
  refillAsset(state, inv, amount, events, {
    kind: 'recharge', verb: '充能', icon: '🔮',
    trait: opts.trait || null,
    emptyText: `${inv.name} 没有可充能的法术资产。`,
  })
}

function discoverClueAt(state, inv, amount, events) {
  if (scenarioBehavior(state).canDiscoverClues?.(state, inv) === false) return
  // Revelation can put the hunter into play after an event was paid for.
  // Recheck at resolution, including discoveries that bypass investigation.
  if (engagedWithMaskedHunter(state, inv)) {
    info(state, events, `${inv.name} 与蒙面猎手交战，不能发现线索。`)
    return
  }
  if (!state._discoveringClue) {
    state._discoveringClue = true
    try {
      triggerReaction(state, inv.seat, 'discoverClue', events, {
        when: 'discoverClue', seat: inv.seat, location: inv.location, amount,
      })
    } finally {
      state._discoveringClue = false
    }
  }
  const coverUp = inv.threat.find((t) => {
    const th = getThreatEffect(t)
    return th && th.redirectClues && (t.counters || 0) > 0
  })
  const loc = state.locations.find((l) => l.id === inv.location)
  if (coverUp && loc?.clues > 0) {
    const answer = requestChoice(state, { kind: 'reaction', source: coverUp.id, seat: inv.seat,
      prompt: '是否用本次发现移除掩盖罪证上的线索？', canSkip: true,
      options: [{ id: 'skip', label: '正常发现地点线索' }, { id: 'remove', label: '移除掩盖罪证上的线索' }] })
    if (answer === 'remove') {
      const removed = Math.min(amount, loc.clues, coverUp.counters)
      coverUp.counters -= removed
      info(state, events, `移除掩盖罪证上的 ${removed} 个线索。`)
      return
    }
  }
  if (loc && loc.clues > 0) {
    const got = Math.min(amount, loc.clues)
    loc.clues -= got
    inv.clues += got
    syncClues(state)
    info(state, events, `🔍 ${inv.name} 获得 ${got} 个线索！（队内累计 ${state.clues}）`)
    notifyCluesRemoved(state, loc, got, events)
    scenarioBehavior(state).cluesGained?.(state, inv, got, scenarioRuntime(state, events))
  } else {
    info(state, events, '这里没有线索。')
  }
}

function chooseEnemy(state, seat, effect) {
  const enemies = abilityTargets(state, state.investigators[seat], effect)
  if (!enemies.length) throw new Error('没有合法敌人目标')
  const id = requestChoice(state, { kind: 'target', source: effect.type, seat, prompt: '选择敌人目标。',
    options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  return enemies.find(enemy => enemy.id === id)
}

function enemyForTarget(state, seat, target) {
  if (target?.startsWith('id:')) return state.enemies.find(enemy => enemy.id === target.slice(3)) || null
  return chooseEnemy(state, seat, { type: 'dealDamage', target })
}

function searchCards(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const cards = inv.deck.slice(-Math.min(effect.amount || 3, inv.deck.length))
  const answer = requestChoice(state, { kind: 'search', source: 'deck-search', seat,
    prompt: '查看搜索到的牌并选择一张加入手牌，其余洗回。', canSkip: true,
    options: [{ id: 'skip', label: '不选择卡牌' }, ...cards.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))] })
  if (answer !== 'skip') {
    const index = inv.deck.length - cards.length + Number(answer)
    inv.hand.push(inv.deck.splice(index, 1)[0])
    info(state, events, `${inv.name} 搜索后将 1 张牌加入手牌。`)
  }
  inv.deck = shuffle(inv.deck, () => randomValue(state))
}

// ---------------------------------------------------------------------------
// 行动结算
// ---------------------------------------------------------------------------

function spendAction(state, inv) {
  if (state._actionPaid) return
  if (inv.actionsLeft < 1) throw new Error('行动点不足')
  inv.actionsLeft--
  state.moveCount++
}

export function decisionSeat(state) {
  if (state.status !== 'playing') return null
  if (state.pendingChoice) return state.pendingChoice.seat
  const seats = actingSeats(state)
  return seats.includes(state.currentSeat) ? state.currentSeat : seats[0]
}

/** Seats allowed to submit now; per-seat hub preparation is simultaneous. */
export function actingSeats(state) {
  if (state.status !== 'playing') return []
  if (state.pendingChoice) return choiceSeats(state.pendingChoice)
  const pending = inHub(state) && hubConcurrentPhase(state) ? hubActingSeats(state) : []
  return pending.length ? pending : [state.currentSeat]
}

const HUB_SEAT_ACTIONS = new Set(['hubSelectInvestigator', 'hubAutoDeck', 'hubSetDeck', 'hubPurchase',
  'hubConfirmUpgrades', 'hubCancelUpgrades', 'hubAutoUpgrade', 'hubDoneSeat'])

/** Seat preparation only touches the submitting seat, so it may follow a teammate's newer revision. */
export function seatLocalMove(state, seat, move) {
  return inHub(state) && !state.pendingChoice && hubConcurrentPhase(state)
    && HUB_SEAT_ACTIONS.has(move?.action) && hubActingSeats(state).includes(seat)
}

const HUB_DIFFICULTIES = ['easy', 'standard', 'hard', 'expert']
const inHub = state => state.hubFlow && state.uiState !== 'inScenario'
const hubConcurrentPhase = state => (state.uiState === 'scenarioSetup' && !state.hubReady) || state.uiState === 'interlude'
const hubPendingSeats = state => state.investigators.map(inv => inv.seat).filter(seat => !state.hubSeatDone?.[seat])
// AI teammates prepare after every human has confirmed: they pick from what is left,
// and their model latency never holds the session while humans are still choosing.
function hubActingSeats(state) {
  const pending = hubPendingSeats(state), humans = state.humanSeats || [0]
  const humanPending = pending.filter(seat => humans.includes(seat))
  return humanPending.length ? humanPending : pending
}

// A campaign may begin with a route choice whose exits are scenarios. Surface
// that choice as ordinary case selection instead of a detached story prompt.
function initialHubScenarioMoves(state) {
  if (state.campaign.scenarioResults.length) return []
  const manifest = campaignManifestFor(state)
  const graph = campaignGraph(manifest)
  const start = graph.nodes[graph.start]
  if (start?.type !== 'choice') return []
  return start.options.flatMap(option => {
    const destination = graph.nodes[option.next]
    return destination?.type === 'scenario'
      ? [{ action: 'hubSelectScenario', scenarioId: destination.scenarioId, optionId: option.id,
          label: option.label || `选择 ${destination.scenarioId}` }]
      : []
  })
}

function selectInitialHubScenario(state, scenarioId, events) {
  const choices = initialHubScenarioMoves(state)
  const selected = choices.find(choice => choice.scenarioId === scenarioId)
  if (!selected) return false
  const campaign = state.campaign
  const manifest = campaignManifestFor(state)
  delete campaign.flow
  const node = walkCampaign(campaign, manifest, () => selected.optionId,
    effect => { if (effect.type !== 'log') applyCampaignEffect(state, effect, text => info(state, events, text)) })
  if (node.type !== 'scenario' || node.scenarioId !== scenarioId) throw new Error('初始路线没有到达所选关卡')
  campaign.flowStage = node.type
  campaign.scenarioIndex = manifest.scenarioIds.indexOf(scenarioId)
  state.hubSelectedScenarioId = scenarioId
  return true
}

function hubInvestigatorChoices(state, seat) {
  const unavailable = new Set([...Object.values(state.campaign.investigators), ...state.campaign.retired]
    .filter(record => record.seat !== seat || record.status !== 'active').map(record => record.code))
  // Teammates preparing at the same time reserve a pick before saving a deck.
  for (const inv of state.investigators) {
    if (inv.seat !== seat && state.hubSeatSelected?.[inv.seat]) unavailable.add(inv.code)
  }
  return PLAYABLE_INVESTIGATORS.filter(code => !unavailable.has(code))
}

function initialHubPreparation(state) {
  return state.uiState === 'scenarioSetup' && !state.campaign.scenarioResults.length
}

function hubStartingDeckReady(record) {
  return !!record?.deck?.length && record.startingDeckReady !== false
}

function hubLegalMoves(state, seat = decisionSeat(state)) {
  const CAMPAIGN = campaignFor(state)
  if (state.status !== 'playing' || !actingSeats(state).includes(seat)) return []
  const record = state.campaign.investigators[seat]
  const moves = []
  const humans = state.humanSeats || [0]
  const leaderMoves = humans.includes(seat) ? humans.map(leadSeat => ({ action: 'hubSetLeader', leadSeat,
    label: `队长：${state.investigators[leadSeat].name}` })) : []
  if (state.uiState === 'campaignHub') {
    if (seat !== 0) return []
    moves.push(...HUB_DIFFICULTIES.map(difficulty => ({ action: 'hubSetDifficulty', difficulty,
      label: `难度：${difficulty}` })))
    const opening = initialHubScenarioMoves(state)
    moves.push(...(opening.length ? opening.map(({ optionId, ...move }) => move)
      : [{ action: 'hubSelectScenario', scenarioId: CAMPAIGN.scenarioOrder[0], label: '选择第一关' }]))
    if (!opening.length || state.hubSelectedScenarioId) moves.push({ action: 'hubGoSetup', label: '配置调查员与卡组' })
    moves.push(...leaderMoves)
    return moves
  }
  if (state.uiState === 'scenarioResult') return seat === 0
    ? [{ action: 'hubContinue', label: '查看结算并进入关间准备' }] : []
  if (state.uiState === 'scenarioSetup' && state.hubReady) {
    return seat === 0 ? [
      ...leaderMoves,
      { action: 'hubSelectScenario', scenarioId: CAMPAIGN.scenarioOrder[state.campaign.scenarioIndex], label: '选择当前关卡' },
      ...(!state.campaign.scenarioResults.length
        ? [{ action: 'hubReopenSetup', label: '重新准备调查员与牌组' }] : []),
      ...(state.campaign.leadConfirmed && humans.includes(state.campaign.leadSeat) ? [{ action: 'hubBeginScenario', label: '开始当前关卡' }] : []),
    ] : []
  }
  if (state.uiState !== 'scenarioSetup' && state.uiState !== 'interlude') return []
  moves.push(...leaderMoves)
  if (!record || record.status !== 'active' || initialHubPreparation(state)) {
    moves.push(...hubInvestigatorChoices(state, seat).map(code => ({
      action: 'hubSelectInvestigator', code, label: `选择调查员：${ALL_INVESTIGATORS[code].nameZh || ALL_INVESTIGATORS[code].name}`,
    })))
    if (state.hubSeatSelected?.[seat] && (!record || !hubStartingDeckReady(record))) {
      moves.push({ action: 'hubAutoDeck', label: '自动构筑合法牌组' })
      moves.push({ action: 'hubSetDeck', label: '保存手动牌组' })
    }
  }
  if (state.uiState === 'interlude' && record?.status === 'active' && state.campaign.upgradesAllowed !== false) {
    const effective = upgradeRecord(record)
    for (const added of availablePurchases(effective, state.campaign.records)) {
      for (const option of replacementOptions(effective, added, state.campaign.records)) moves.push({ action: 'hubPurchase', added, removed: option.code,
        label: `购入 ${cardName(added)}，${option.code ? '替换 ' + cardName(option.code) : '加入永久卡'}（${option.cost} XP）`, explanation: option.explanation })
    }
    if (!state.hubUpgradedSeats?.[seat] && moves.some(move => move.action === 'hubPurchase')) {
      moves.push({ action: 'hubAutoUpgrade', label: '自动选择一次合法升级' })
    }
  }
  if (record?.upgradeDraft) {
    moves.push({ action: 'hubConfirmUpgrades', label: '保存升级方案' }, { action: 'hubCancelUpgrades', label: '撤销本轮升级' })
  }
  if (record?.status === 'active' && !record.upgradeDraft && hubStartingDeckReady(record)) {
    moves.push({ action: 'hubDoneSeat', label: state.uiState === 'interlude' ? '完成升级，准备下一关' : '确认准备' })
  }
  if (state.uiState === 'scenarioSetup' && !state.campaign.scenarioResults.length && !state.hubSeatDone?.[seat] && record?.status === 'active') {
    moves.push({ action: 'hubSetDeck', label: '调整起始牌组' })
  }
  return moves
}

function validateHubMove(state, seat, move) {
  if (!actingSeats(state).includes(seat)) return '现在不是你的局外操作时机'
  if (!move || typeof move.action !== 'string') return '无效局外操作'
  if (move.action === 'hubSelectInvestigator' && state.campaign.investigators[seat]?.status === 'active' && !initialHubPreparation(state)) {
    return state.uiState === 'interlude' ? '关间只能为死亡或疯狂的调查员挑选替补，不能更换现役调查员' : '当前调查员仍在战役中，不能更换'
  }
  if (move.action === 'hubSetDeck') {
    if (!hubLegalMoves(state, seat).some(m => m.action === 'hubSetDeck')) return '当前不能保存牌组'
    if (!Array.isArray(move.codes)) return '牌组必须是卡号数组'
    const built = buildDeckFromList(ALL_INVESTIGATORS[state.investigators[seat].code], move.codes,
      { seat, seed: 1, playerPool: corePlayerPool(), basicWeaknessPool: basicWeaknessPool(state) })
    return built.errors?.length ? `自定义卡组无效：${built.errors.join('；')}` : null
  }
  return hubLegalMoves(state, seat).some(legal => Object.entries(legal)
    .filter(([key]) => !['label', 'explanation'].includes(key)).every(([key, value]) => move[key] === value)) ? null : '当前不可执行该局外操作'
}

function executeHubMove(state, seat, move, events) {
  const CAMPAIGN = campaignFor(state)
  const campaign = state.campaign
  switch (move.action) {
    case 'hubSetLeader':
      if (!(state.humanSeats || [0]).includes(move.leadSeat)) throw new Error('队长必须由真人玩家担任')
      campaign.leadSeat = move.leadSeat
      campaign.leadConfirmed = true
      info(state, events, `${state.investigators[move.leadSeat].name} 被选为小队队长。`)
      break
    case 'hubSetDifficulty': state.difficulty = move.difficulty; break
    case 'hubSelectScenario':
      if (!selectInitialHubScenario(state, move.scenarioId, events)) state.hubSelectedScenarioId = move.scenarioId
      break
    case 'hubGoSetup': state.uiState = 'scenarioSetup'; state.phase = 'scenarioSetup'; campaign.phase = 'scenarioSetup'; break
    case 'hubSelectInvestigator': {
      const previous = campaign.investigators[seat]
      if (previous?.status === 'active' && !initialHubPreparation(state)) throw new Error('现役调查员不能更换；只有死亡或疯狂后才能挑选替补')
      if (previous?.status === 'active' && previous.code !== move.code) {
        // Before the first scenario the player may reconsider their investigator.
        // Keep the already generated basic weakness, but require a new legal deck
        // so repeatedly previewing investigators cannot reroll that weakness.
        previous.code = move.code
        previous.name = ALL_INVESTIGATORS[move.code].nameZh || ALL_INVESTIGATORS[move.code].name
        previous.deck = previous.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness')
        previous.startingDeckReady = false
      } else if (previous && previous.status !== 'active') {
        campaign.retired.push(structuredClone(previous))
        delete campaign.investigators[seat]
      }
      state.investigators[seat] = makeInvestigator(ALL_INVESTIGATORS[move.code], seat)
      if (campaign.investigators[seat]) state.investigators[seat].campaignId = campaign.investigators[seat].id
      state.hubSeatSelected[seat] = true
      break
    }
    case 'hubAutoDeck':
    case 'hubSetDeck': {
      const inv = state.investigators[seat]
      const built = move.action === 'hubSetDeck'
        ? buildDeckFromList(ALL_INVESTIGATORS[inv.code], move.codes,
          { seat, seed: Math.floor(randomValue(state) * 4294967296), playerPool: corePlayerPool(), basicWeaknessPool: basicWeaknessPool(state) })
        : buildDeck(ALL_INVESTIGATORS[inv.code], { seat, seed: Math.floor(randomValue(state) * 4294967296) })
      if (built.errors?.length) throw new Error(`牌组无效：${built.errors.join('；')}`)
      const existing = campaign.investigators[seat]
      if (existing) {
        // Editing or rebuilding a starting deck keeps the generated basic
        // weakness and identity while replacing investigator-specific cards.
        const retained = existing.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness')
        existing.code = inv.code
        existing.name = inv.name
        existing.deck = [...built.playerCards, ...built.signatureCards, ...built.signatureWeaknesses,
          ...(retained.length ? retained : built.basicWeaknesses)].sort()
        existing.startingDeckReady = true
      } else {
        const created = registerCampaignInvestigator(campaign, inv, built.deck)
        created.startingDeckReady = true
      }
      inv.autoBuilt = move.action === 'hubAutoDeck'
      if (inv.autoBuilt) info(state, events, `${inv.name}：按调查员属性与卡牌能力评分组牌，并通过尺寸、职业、等级、限额、重复张数和 0 XP 预算检查；签名卡与随机基础弱点另行加入。`)
      info(state, events, `${inv.name} 的战役牌组已保存。`)
      break
    }
    case 'hubPurchase': {
      const purchase = stagePurchase(campaign, seat, move.added, move.removed)
      info(state, events, `${state.investigators[seat].name} 暂存升级（${purchase.cost} XP），等待确认。`)
      break
    }
    case 'hubConfirmUpgrades': finishUpgradeDraft(campaign, seat, true); break
    case 'hubCancelUpgrades': finishUpgradeDraft(campaign, seat, false); break
    case 'hubAutoUpgrade': {
      const advice = recommendUpgrade(campaign.investigators[seat], campaign.records)
      campaign.investigators[seat].upgradeAdvice = advice
      if (advice.added) {
        stagePurchase(campaign, seat, advice.added, advice.removed)
        finishUpgradeDraft(campaign, seat, true)
      }
      state.hubUpgradedSeats[seat] = true
      info(state, events, state.investigators[seat].name + '：' + advice.reason)
      break
    }
    case 'hubDoneSeat': {
      state.hubSeatDone[seat] = true
      if (hubPendingSeats(state).length) state.currentSeat = hubActingSeats(state)[0]
      else {
        state.currentSeat = 0
        state.hubReady = true
        if (state.uiState === 'interlude') {
          progressCampaign(state, events, false, true)
        }
      }
      break
    }
    case 'hubReopenSetup':
      state.hubReady = false
      state.hubSeatDone = {}
      state.currentSeat = 0
      info(state, events, '首关尚未开始，已重新开放调查员、牌组与席位准备。')
      break
    case 'hubBeginScenario': {
      if (!campaign.leadConfirmed || !(state.humanSeats || [0]).includes(campaign.leadSeat)) throw new Error('请先选择一名真人玩家担任队长')
      if (!state.hubReady || state.hubSelectedScenarioId !== CAMPAIGN.scenarioOrder[campaign.scenarioIndex]) {
        throw new Error('关卡尚未解锁或队伍尚未准备')
      }
      progressCampaign(state, events, true)
      break
    }
    case 'hubContinue': {
      delete campaign.pendingNextIndex
      progressCampaign(state, events, false)
      if (state.status !== 'playing') break
      if (state.campaign.flowStage !== 'interlude' && state.campaign.flowStage !== 'checkpoint') break
      campaign.phase = 'interlude'
      state.uiState = 'interlude'
      state.phase = 'interlude'
      state.currentSeat = 0
      state.hubReady = false
      state.hubSeatDone = {}
      state.hubUpgradedSeats = {}
      state.hubSelectedScenarioId = CAMPAIGN.scenarioOrder[campaign.scenarioIndex]
      break
    }
    default: throw new Error('未知局外操作')
  }
  state.legalMoves = legalMoves(state)
}

export function autoHubMove(state, seat, includeHuman = false) {
  if (!inHub(state) || !actingSeats(state).includes(seat) || (seat === 0 && !includeHuman) || state.pendingChoice) return null
  const moves = hubLegalMoves(state, seat)
  // A failed model step may leave a valid staged purchase to finish.
  const confirm = moves.find(move => move.action === 'hubConfirmUpgrades')
  if (confirm) return confirm
  for (const action of ['hubGoSetup', 'hubContinue', 'hubBeginScenario', 'hubSelectScenario']) {
    const move = moves.find(move => move.action === action)
    if (move) return move
  }
  const priority = state.hubSeatSelected?.[seat] ? ['hubAutoDeck', 'hubAutoUpgrade', 'hubDoneSeat', 'hubSelectInvestigator']
    : ['hubSelectInvestigator', 'hubAutoDeck', 'hubAutoUpgrade', 'hubDoneSeat']
  for (const action of priority) {
    if (action === 'hubAutoUpgrade' && state.hubUpgradedSeats?.[seat]) continue
    const move = moves.find(item => item.action === action)
    if (move) return move
  }
  return null
}

// 大厅的可选契约 decisionSeed：给 agent 的兜底选择提供一个由对局状态决定的种子。
// 同一局（同一种子）在同一步的兜底动作因此可复现，便于回放与回归；
// 未提供时大厅退化为按对局编号决定，行为同样不会退化成「恒选第一项」。
export function decisionSeed(session, seat, step) {
  const state = session && session.state
  if (!state) return null
  return [state.rngState, state.revision, seat, step, state.round, state.phase].join(':')
}

// 大厅的可选契约 moveCost：该动作消耗的行动点数。
// 「结束回合 / 撤退」不消耗行动点，返回 0 —— 模型失败时的确定性兜底会优先挑正成本动作，
// 因此不会把 AI 回合直接结束掉（见 lib/agent/orchestrator.js 的 pickFallback 分档）。
export function moveCost(state, seat, move) {
  if (!move || typeof move !== 'object') return 1
  if (state.pendingChoice || inHub(state)) return 0
  if (move.action === 'endTurn' || move.action === 'resign') return 0
  return actionCost(state, state.investigators[seat], move)
}

function actionKind(state, inv, move) {
  if (move.action === 'scenarioAction' || move.action === 'encounterAction') {
    const declared = move.actionKind || scenarioBehavior(state).actionKind?.(state, inv, move)
    if (declared) return declared
  }
  if (move.action === 'scenarioAction' && ['castFormula', 'concoctionAttack'].includes(move.rule)) return 'fight'
  if (move.action === 'scenarioAction' && move.rule === 'resignBeyond') return 'resign'
  if (move.action === 'scenarioAction' && ['parleyJazz', 'parleyPassenger'].includes(move.rule)) return 'parley'
  const source = move.action === 'play' ? EFFECTS[move.copyCode || move.cardId]
    : move.action === 'ability' ? EFFECTS[controlledAbilityCard(inv, move.assetId)?.code] : null
  if (source?.noOpportunityAttack) return 'evade'
  const actionEffect = move.action === 'play' ? source?.event
    : move.action === 'ability' ? source?.abilities?.[move.abilityIndex]?.effect : null
  if (actionEffect?.noOpportunityAttack) return 'evade'
  return actionEffect?.type || move.action
}

export function actionPreview(state, seat, move) {
  const inv = state.investigators[seat]
  if (!inv || state.pendingChoice || inHub(state)) return { actions: 0 }
  const asset = controlledAbilityCard(inv, move.assetId)
  const ability = EFFECTS[asset?.code]?.abilities?.[move.abilityIndex]
  const kind = actionKind(state, inv, move)
  const provoking = actionCost(state, inv, move, false) > 0 && !['fight', 'evade', 'resign', 'parley', 'parleyCultist', 'parleyLita'].includes(kind)
  const attacks = provoking ? enemiesEngagedWith(state, inv).filter(e => !e.exhausted && !(inv.onTheLam && !e.elite)
    && scenarioBehavior(state).canOpportunityAttack?.(state, e) !== false) : []
  const enemy = state.enemies.find(e => e.id === move.enemyId)
  const extraCost = move.action === 'parleyCultist' ? enemyDef(enemy?.code)?.parley?.cost || {}
    : move.action === 'freeAction' ? INVESTIGATOR_ABILITIES[inv.code]?.freeAction?.cost || {}
    : move.action === 'locationAbility' ? state.locations.find(l => l.id === move.locationId)?.ability?.cost || {}
    : move.action === 'parley' ? { resources: enemy?.parleyCost || 0 }
    : move.action === 'payDebt' ? { resources: 1 } : {}
  return { actions: actionCost(state, inv, move), resources: move.action === 'play' ? playCost(state, inv, cardDef(move.copyCode || move.cardId)) : extraCost.resources || ability?.cost?.resources || 0,
    clues: extraCost.clues || 0, discardHand: extraCost.discardHand || 0,
    groupClues: move.action === 'drawCultist' ? 2 * state.numInvestigators : move.action === 'advanceAct' ? (state.acts[state.actIndex]?.objective?.perInvestigator || 0) * state.numInvestigators : 0,
    uses: ability?.cost?.uses || 0, exhaust: !!ability?.cost?.exhaust,
    opportunityAttacks: attacks.map(e => ({ id: e.id, name: e.name, damage: e.damage, horror: e.horror })),
    note: attacks.length ? '借机攻击发生在行动效果之前；伤害数值为当前基础值，反应或强制效果可能改变结果。' : undefined }
}

export function applyMove(state, seat, move) {
  const error = validateMove(state, seat, move)
  if (error) throw new Error(error)
  const events = resolveTransaction(state, seat, move, executeCommand)
  state.legalMoves = legalMoves(state)
  if (!inHub(state)) events.push({ type: 'presentation', kind: 'checkpoint', tableState: captureTableState(state, getStat, getMaxSanity) })
  return events
}

function executeCommand(state, seat, move, events) {
  if (inHub(state)) {
    executeHubMove(state, seat, move, events)
    return
  }
  if (move.action === 'interlude') {
    runInterlude(state, move.nextIndex, events)
    return
  }
  try {
    executeAction(state, seat, move, events)
  } catch (error) {
    if (!(error instanceof ScenarioEnded)) throw error
    if (error.nextIndex == null) {
      if (state.campaign.failed || !state.campaign.pendingNode) endCampaign(state, events)
      else progressCampaign(state, events, false)
    }
    else if (state.hubFlow) {
      state.campaign.pendingNextIndex = error.nextIndex
      state.campaign.phase = 'scenarioResult'
      state.uiState = 'scenarioResult'
      state.phase = 'scenarioResult'
      state.currentSeat = 0
      state.legalMoves = legalMoves(state)
    } else progressCampaign(state, events, true)
  }
}

function executeAction(state, seat, move, events) {
  if (move.action === 'setup') {
    progressCampaign(state, events, true)
    return
  }
  const inv = state.investigators[seat]
  const needsTimeWarpSnapshot = !['endTurn', 'setup', 'interlude'].includes(move.action)
    && aliveInvestigators(state).some(owner => owner.hand.includes('03311')
      || owner.assets.some(asset => asset.code === '03264' && (asset.attached || []).includes('03311')))
  const actionSnapshot = needsTimeWarpSnapshot
    ? structuredClone({ ...state, _resolution: null, pendingChoice: null, legalMoves: [], lastActionSnapshot: null }) : null
  const totalCost = actionCost(state, inv, move, false)
  const cost = actionCost(state, inv, move)
  if (inv.actionsLeft < cost) throw new Error('行动点不足')
  inv.actionsLeft -= cost
  if (cost > 0) inv.actionsTakenThisTurn = (inv.actionsTakenThisTurn || 0) + 1
  if (totalCost > cost || move.action === 'endTurn') inv.tomeActionUsed = true
  state.moveCount++
  const ability = move.action === 'ability' ? EFFECTS[controlledAbilityCard(inv, move.assetId)?.code]?.abilities?.[move.abilityIndex] : null
  const kind = actionKind(state, inv, move)
  if (totalCost) for (const threat of unpaidExtraActionThreats(state, inv, kind)) {
    threat.extraActionPaidRound = state.round
  }
  state._actionPaid = true
  try {
    if (move.action === 'scenarioAction') scenarioBehavior(state).payScenarioActionCost?.(state, inv, move, scenarioRuntime(state, events))
    const noOpportunityAttack = move.action === 'freeAction' && INVESTIGATOR_ABILITIES[inv.code]?.freeAction?.noOpportunityAttack
    const playNoAoO = move.action === 'play'
      && EFFECTS[move.copyCode || move.cardId]?.noOpportunityAttackOnPlay
    if (totalCost && !noOpportunityAttack && !playNoAoO
      && !['fight', 'evade', 'resign', 'parley', 'parleyCultist', 'parleyLita'].includes(kind)) {
      const pending = enemiesEngagedWith(state, inv).filter(enemy => !enemy.exhausted
        && scenarioBehavior(state).canOpportunityAttack?.(state, enemy) !== false).map(e => e.id)
      while (pending.length) {
        const candidates = pending.map(id => state.enemies.find(e => e.id === id)).filter(e => e && !e.exhausted)
        if (!candidates.length) break
        const enemy = chooseAttack(state, inv, candidates, 'opportunity')
        pending.splice(pending.indexOf(enemy.id), 1)
        if (inv.onTheLam && !enemy.elite) continue
        const opportunity = reactionWindow(state, 'opportunityAttack', {
          when: 'opportunityAttack', seat, location: inv.location, enemy, prompt: `「${enemy.name}」对 ${inv.name} 发动借机攻击`,
        }, events)
        if (opportunity.cancelled) {
          info(state, events, `${inv.name} 取消了「${enemy.name}」的借机攻击。`)
          continue
        }
        enemyAttack(state, enemy, inv, events, enemy.name + ' 发动借机攻击。')
        if (inv.defeated || state.status !== 'playing') break
      }
    }
    if (!inv.defeated && !inv.resigned && state.status === 'playing') {
      state.lastActionSnapshot = actionSnapshot
      applyMoveUnchecked(state, seat, move, events)
      if (state._timeWarped) {
        delete state._timeWarped
        state.lastActionSnapshot = null
        return
      }
      if (move.action !== 'endTurn') {
        reactionWindow(state, 'actionResolvedAtLocation', {
          when: 'actionResolvedAtLocation', seat, location: inv.location, prompt: `${inv.name} 完成了一次行动`,
        }, events)
      }
      state.lastActionSnapshot = null
    } else if (state.status === 'playing') advanceInvestigator(state, seat, events)
  } finally {
    delete state._actionPaid
  }
}

function runMulligans(state, events) {
  for (const inv of state.investigators) {
    if (inv.code === '03003') {
      inv.beneath ||= []
      while (inv.beneath.length < 5) {
        const eligible = inv.hand.map((code, index) => ({ code, index })).filter(item =>
          item.code !== '03012' && cardDef(item.code)?.type === 'event')
        if (!eligible.length) break
        const answer = requestChoice(state, { kind: 'openingHand', source: 'sefinaBeneath', seat: inv.seat, canSkip: true,
          prompt: '选择至多5张非「彩绘世界」事件放在赛菲娜下方，或完成选择。',
          options: [{ id: 'done', label: '完成下方事件选择' },
            ...eligible.map(item => ({ id: String(item.index), cardCode: item.code, label: cardName(item.code) }))] })
        if (answer === 'done') break
        inv.beneath.push(inv.hand.splice(Number(answer), 1)[0])
      }
      const returned = []
      while (inv.hand.length > 8) {
        const answer = requestChoice(state, { kind: 'openingHand', source: 'sefinaKeepEight', seat: inv.seat,
          prompt: `选择返回牌库的牌（还需返回 ${inv.hand.length - 8} 张）。`,
          options: inv.hand.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })) })
        returned.push(inv.hand.splice(Number(answer), 1)[0])
      }
      inv.deck = shuffle([...inv.deck, ...returned], () => randomValue(state))
      info(state, events, `${inv.name} 将 ${inv.beneath.length} 张事件放在下方并保留8张起始手牌；不能调度。`)
      continue
    }
    const held = []
    while (true) {
      const options = [{ id: 'done', label: held.length ? '确认换牌' : '保留起始手牌' }, ...inv.hand.map((code, i) => ({ id: String(i), label: '换掉：' + cardName(code) }))]
      const answer = requestChoice(state, { kind: 'mulligan', source: 'opening-hand', seat: inv.seat, prompt: '选择要更换的起始手牌，完成后确认。', options, canSkip: true })
      if (answer === 'done') break
      held.push(inv.hand.splice(Number(answer), 1)[0])
    }
    drawOpeningHand(state, inv)
    inv.deck = shuffle([...inv.deck, ...held], () => randomValue(state))
    info(state, events, `${inv.name} 完成起始换牌（更换 ${held.length} 张）。`)
    if (inv.code === '03006' && !inv.role) {
      chooseLolaRole(state, inv, 'lolaOpeningRole', '选择罗拉·海斯的初始角色。', true)
      info(state, events, `${inv.name} 选择了${CLASS_NAMES[inv.role] || inv.role}角色。`)
    }
  }
  scenarioBehavior(state).afterMulligan?.(state, events, { discardRandomFromHand, info })
  state.currentSeat = chooseTurn(state)
  state.turnSeat = state.currentSeat
  phaseBeginningWindow(state, events)
  turnBeginningWindow(state, events)
}

function applyMoveUnchecked(state, seat, move, events) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return events

  const m = move || {}
  switch (m.action) {
    case 'advanceAct': payAndAdvanceAct(state, events); break
    case 'scenarioAction': scenarioBehavior(state).performAction(state, inv, m, scenarioRuntime(state, events)); break
    case 'shortcutMove': doShortcutMove(state, seat, m, events); break
    case 'encounterAction': scenarioBehavior(state).performEncounterAction(state, inv, m, scenarioRuntime(state, events)); break
    case 'play': doPlay(state, seat, m.cardId, events, !!m.fromDiscard, false, m.copyCode, m.fromPlanAssetId); break
    case 'draw': doDraw(state, seat, events); break
    case 'resource': doResource(state, seat, events); break
    case 'freeAction': doFreeAction(state, seat, events); break
    case 'hiddenAction': doHiddenAction(state, seat, m, events); break
    case 'move': doMove(state, seat, m.locationId, events); break
    case 'investigate': doInvestigate(state, seat, {}, events); break
    case 'searchIzzie': doSearchIzzie(state, seat, events); break
    case 'locationAbility': doLocationAbility(state, seat, m.locationId, events); break
    case 'fight': doFight(state, seat, { enemyId: m.enemyId }, events); break
    case 'evade': doEvade(state, seat, { enemyId: m.enemyId }, events); break
    case 'parley': doParley(state, seat, m.enemyId, events); break
    case 'parleyCultist': doParleyCultist(state, seat, m.enemyId, events); break
    case 'parleyLita': doParleyLita(state, seat, events); break
    case 'drawCultist': doDrawCultist(state, seat, events); break
    case 'interruptRitual': doInterruptRitual(state, seat, m.skill, events); break
    case 'sacrificeLita': doSacrificeLita(state, seat, events); break
    case 'breakDoor': doBreakDoor(state, seat, m.skill, events); break
    case 'ability': doAbility(state, seat, m.assetId, m.abilityIndex, m.targetId, m.optionIndex, events); break
    case 'discardThreat': doDiscardThreat(state, seat, m.threatId, events); break
    case 'purgeThreat': doPurgeThreat(state, seat, m.threatId, events); break
    case 'payDebt': doPayDebt(state, seat, m.threatId, events); break
    case 'engage': doEngage(state, seat, m.enemyId, events); break
    case 'resign': doResign(state, seat, events); break
    case 'endTurn': doEndTurn(state, seat, events); break
    default: break
  }

  checkAct(state, events)
  checkDefeated(state, seat, events)
  checkOutcome(state, events)

  if (state.status === 'playing') {
    playerWindow(state, 'investigation.afterAction', events)
    const cur = state.investigators[seat]
    if (cur.actionsLeft <= 0 || cur.turnEnded || cur.defeated || cur.resigned) {
      advanceInvestigator(state, seat, events)
    }
  }

  if (state.status === 'playing') {
    state.legalMoves = legalMoves(state)
  } else {
    state.legalMoves = []
  }
  return events
}

function phaseBeginningWindow(state, events) {
  for (const enemy of state.enemies) if (enemy.massive && enemy.engagedSeat != null && !enemyTextBlanked(state, enemy)) disengageEnemy(state, enemy)
  for (const inv of aliveInvestigators(state)) triggerReaction(state, inv.seat, 'phaseBegins', events, {})
  reactionWindow(state, 'phaseBegins', { when: 'phaseBegins', prompt: '阶段开始' }, events)
}

function turnBeginningWindow(state, events) {
  const inv = state.investigators[state.currentSeat]
  state.turnSerial = (state.turnSerial || 0) + 1
  if (inv) {
    inv.turnEnded = false
    inv.actionsTakenThisTurn = 0
    scenarioBehavior(state).turnBegins?.(state, inv, scenarioRuntime(state, events))
    triggerReaction(state, inv.seat, 'turnBegins', events, { seat: inv.seat, location: inv.location })
    reactionWindow(state, 'turnBegins', { when: 'turnBegins', seat: inv.seat, location: inv.location, prompt: `${inv.name} 的回合开始` }, events)
  }
}

function useGoldPocketWatch(state, timing, phase, events) {
  const holder = aliveInvestigators(state).find(inv => inv.assets.some(asset => asset.code === '02305'))
  if (!holder) return false
  const asset = holder.assets.find(item => item.code === '02305')
  const verb = timing === 'begin' ? '跳过' : '重复'
  const answer = requestChoice(state, { kind: 'reaction', source: asset.id, seat: holder.seat, canSkip: true,
    prompt: `黄金怀表：是否从游戏中移除它，${verb}${phase === 'investigation' ? '调查' : phase === 'enemy' ? '敌人' : phase === 'upkeep' ? '重整' : '神话'}阶段？`,
    options: [{ id: 'skip', label: '保留黄金怀表' }, { id: 'trigger', label: `${verb}该阶段` }] })
  if (answer !== 'trigger') return false
  leaveAsset(state, holder, asset, events)
  asset.removedFromGame = true
  state.removedFromGame ||= []
  state.removedFromGame.push(asset.code)
  info(state, events, `${holder.name} 从游戏中移除「黄金怀表」，${verb}本阶段。`)
  return true
}

function beginInvestigationPhase(state, events, repeated = false) {
  state.turnsTaken = []
  for (const inv of aliveInvestigators(state)) {
    const loss = inv.pendingActionLoss?.[state.round] || 0
    inv.actionsLeft = Math.max(0, 3 + extraActionBonus(inv) - loss)
    if (inv.pendingActionLoss) delete inv.pendingActionLoss[state.round]
  }
  state.phase = 'investigation'
  phaseBeginningWindow(state, events)
  const first = chooseTurn(state)
  if (first == null) { checkOutcome(state, events); return }
  state.currentSeat = first
  info(state, events, `${repeated ? '黄金怀表重复调查阶段；' : ''}第 ${state.round} 回合 · 调查阶段开始，轮到 ${state.investigators[first].name}。`,
    { kind: 'phase', phase: 'investigation', round: state.round, text: `轮到 ${state.investigators[first].name} 行动` })
  turnBeginningWindow(state, events)
}

function runBetweenInvestigationPhases(state, events) {
  if (!useGoldPocketWatch(state, 'begin', 'enemy', events)) {
    events.push(...enemyPhase(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'enemy', events)) events.push(...enemyPhase(state))
  }
  if (state.status !== 'playing') return
  if (!useGoldPocketWatch(state, 'begin', 'upkeep', events)) {
    events.push(...upkeepPhase(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'upkeep', events)) events.push(...upkeepPhase(state))
  }
  if (state.status !== 'playing') return
  state._roundEndWindow = true
  try { checkAct(state, events) } finally { delete state._roundEndWindow }
  if (state.status !== 'playing') return
  if (useGoldPocketWatch(state, 'begin', 'mythos', events)) {
    state.phase = 'mythos'; state.round += 1
  } else {
    events.push(...runMythos(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'mythos', events)) events.push(...runMythos(state, true))
  }
}

function advanceInvestigator(state, seat, events) {
  const inv = state.investigators[seat]
  if (inv && !inv.defeated && !inv.resigned && inv.actionsLeft <= 0
      && !inv.tomeActionUsed && !investigatorTextBlanked(state, inv) && INVESTIGATOR_ABILITIES[inv.code]?.extraTomeAction
      && legalMoves(state).some(move => tomeActionEligible(state, inv, move))) return
  if (inv) {
    runThreatEndTurn(state, inv, events)
    scenarioBehavior(state).turnEnded?.(state, inv, scenarioRuntime(state, events))
    for (const asset of inv.assets) {
      const heal = assetEffect(inv, asset)?.healSelfHorrorAfterTurn || 0
      if (heal && (asset.horror || 0) > 0) asset.horror = Math.max(0, asset.horror - heal)
    }
    for (const code of inv.hand.slice()) {
      const horror = EFFECTS[code]?.endTurnInHandHorror
      if (!horror) continue
      info(state, events, `🌑 ${inv.name} 回合结束时揭示「${cardName(code)}」，受到 ${horror} 恐惧，卡牌留在手中。`)
      applyHorror(state, inv, horror, events)
    }
    inv.tomeActionUsed = true
    inv.ignoreChaosThisTurn = false
  }
  const next = nextSeat(state, seat)
  if (next != null && next !== seat) {
    state.currentSeat = next
    state.phase = 'investigation'
    // 乌默尔多斯：每位调查员回合结束时重整。
    readyUmordhoth(state, events)
    turnBeginningWindow(state, events)
    return
  }
  readyUmordhoth(state, events)
  if (useGoldPocketWatch(state, 'end', 'investigation', events)) {
    beginInvestigationPhase(state, events, true)
    return
  }
  runBetweenInvestigationPhases(state, events)
  if (state.status !== 'playing') return
  while (useGoldPocketWatch(state, 'begin', 'investigation', events)) {
    runBetweenInvestigationPhases(state, events)
    if (state.status !== 'playing') return
  }
  beginInvestigationPhase(state, events)
}

function readyUmordhoth(state, events) {
  const boss = state.enemies.find((e) => e.code === 'umordhoth' && e.exhausted)
  if (boss) {
    boss.exhausted = false
    info(state, events, `🌀 「乌默尔多斯」重整。`)
  }
}

// —— 打出卡牌 ——
function scenarioAssetPlayError(state, inv, code) {
  const def = cardDef(code)
  if (!inv || !def || def.type !== 'asset' || isWeaknessCard(def)) return '该卡牌不是可打出的支援'
  if (!runtimeCardAvailable(state, inv, code) || !lolaCanUseCard(inv, code)) return '当前调查员不能打出该支援'
  if (cannotPlayTypes(inv).has(def.type)
    || scenarioBehavior(state).canPlayCard?.(state, inv, def) === false
    || activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) {
    return '当前效果禁止打出支援'
  }
  if (inv.resources < playCost(state, inv, def)) return '资源不足'
  if (def.unique && state.investigators.some(other =>
    other.assets.some(asset => cardDef(asset.code)?.name === def.name))) return '同名独特支援已在场'
  if (normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) return '没有可用槽位'
  return null
}

function doPlay(state, seat, cardId, events, fromDiscard = false, noAction = false, copyCode = null, fromPlanAssetId = null) {
  const inv = state.investigators[seat]
  const def = cardDef(cardId)
  const copiedDef = copyCode && cardId === '03012' ? cardDef(copyCode) : null
  const playedDef = copiedDef || def
  if (!def) return
  if (!lolaCanUseCard(inv, cardId)) return
  if (def.type === 'skill' || (isWeaknessCard(def) && !EFFECTS[cardId]?.playableWeakness)) return
  if (cannotPlayTypes(inv).has(def.type)) {
    info(state, events, `⛔ ${inv.name} 受「刺耳之声」影响，不能打出${def.type === 'asset' ? '支援' : '事件'}。`)
    return
  }
  const plan = fromPlanAssetId && inv.assets.find(asset =>
    asset.id === fromPlanAssetId && asset.code === '03264' && !asset.exhausted && asset.attached?.includes(cardId))
  if (plan) {
    plan.attached.splice(plan.attached.indexOf(cardId), 1)
    plan.exhausted = true
  } else if (fromDiscard) {
    if (topDiscardEvent(state, inv) !== cardId) return
    inv.discard.splice(inv.discard.lastIndexOf(cardId), 1)
  } else if (!removeCardByCode(inv.hand, cardId)) return

  if (def.unique) {
    const exists = state.investigators.some((i) => i.assets.some((a) => cardDef(a.code)?.name === def.name))
    if (exists) { inv.hand.push(cardId); info(state, events, `「${cardName(cardId)}」已在场上，不能重复打出。`); return }
  }

  if (def.type === 'asset') replaceAssets(state, inv, def, events)

  const usesLolaDiscount = inv.lolaDiscount?.round === state.round && inv.lolaDiscount?.turnSeat === state.currentSeat
    && (playedDef.factions || [playedDef.klass, playedDef.klass2, playedDef.klass3].filter(Boolean)).includes(inv.lolaDiscount.role)
  const cost = cardId === '02010' ? Number(requestChoice(state, { kind: 'resource', source: '02010', seat,
    prompt: '选择花费多少资源，为珍妮的双枪装填等量弹药。',
    options: Array.from({ length: inv.resources + 1 }, (_, i) => ({ id: String(i), label: `${i} 资源／${i} 弹药` })),
  })) : playCost(state, inv, playedDef)
  delete inv.carcosaPlayDiscount
  const payer = inv.resources >= cost ? inv : (charlesPayCandidate(state, inv, cost) || inv)
  if (payer.resources < cost) {
    info(state, events, `${inv.name} 资源不足，无法打出「${cardName(cardId)}」。`)
    return
  }
  payer.resources -= cost
  if (def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')) {
    consumeItemDiscountAtLocation(state, inv)
  }
  consumePlayThreatResources(state, inv, events)
  if (usesLolaDiscount) delete inv.lolaDiscount
  info(state, events, `🃏 ${inv.name} 打出「${cardName(cardId)}」（花费 ${cost} 资源，剩余 ${inv.resources}）。`, { kind: 'play', seat: inv.seat, code: cardId })

  if (def.type === 'asset') {
    const eff = EFFECTS[cardId] || {}
    const asset = newPlayerAssetInstance(state, inv, cardId)
    if (cardId === '02010') { asset.uses = cost; asset.usesType = 'ammo' }
    if (eff.onPlayDoom) asset.doom = eff.onPlayDoom
    if (eff.passive && eff.passive.extraAction && state.currentSeat === seat) inv.actionsLeft += eff.passive.extraAction
    inv.assets.push(asset)
    scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
    info(state, events, `✔️ 「${cardName(cardId)}」已装备（${def.textZh || def.text || ''}）。`)
    triggerReaction(state, seat, 'assetEnteredPlay', events, { assetCode: cardId, assetId: asset.id, location: inv.location })
  } else if (def.type === 'event') {
    const eff = EFFECTS[copyCode || cardId] || {}
    if (eff.event) resolveEffect(state, seat, eff.event, makeRuntime(state, events))
    if (copyCode && cardId === '03012') {
      state.removedFromGame ||= []
      state.removedFromGame.push(cardId)
    } else if (eff.removeAfterPlay) {
      state.removedFromGame ||= []
      state.removedFromGame.push(cardId)
    } else if (eff.addToVictory) {
      state.victoryDisplay.push({ id: nextInstanceId(state, 'c'), code: cardId, originalCode: cardId,
        victory: cardDef(cardId)?.victory || 0 })
      info(state, events, `💎 「${cardName(cardId)}」被加入胜利展示区。`)
    } else if (eff.exileAfterPlay) exilePlayerCard(state, inv, cardId, events)
    else if (cardId !== '01038' && !(cardId === '02031' && state.enemies.some(enemy => enemy.bindMonster?.ownerSeat === seat))) disposePlayedEvent(inv, cardId)
  }
  const traits = (playedDef.traits || []).map(trait => String(trait).toLowerCase())
  if (traits.includes('spell')) triggerReaction(state, seat, 'spellPlayed', events, { location: inv.location, cardId })
  if (!noAction) spendAction(state, inv)
}

function doDraw(state, seat, events) {
  const inv = state.investigators[seat]
  spendAction(state, inv)
  const texts = drawCards(state, inv, 1, events)
  for (const t of texts) info(state, events, t)
}

function doResource(state, seat, events) {
  const inv = state.investigators[seat]
  spendAction(state, inv)
  if (scenarioBehavior(state).canGainResources?.(state, inv) === false) return
  inv.resources += 1
  info(state, events, `${inv.name} 获得 1 资源（当前 ${inv.resources}）。`)
}

function doFreeAction(state, seat, events) {
  const inv = state.investigators[seat]
  const skids = INVESTIGATOR_ABILITIES[inv.code]
  if (!skids || !skids.freeAction || investigatorTextBlanked(state, inv)) return
  inv.resources -= skids.freeAction.cost.resources || 0
  if (skids.freeAction.cost.discardHand) {
    const index = requestChoice(state, { kind: 'discard', source: skids.freeAction.id, seat, prompt: '选择弃掉的手牌。',
      options: inv.hand.flatMap((code, i) => isWeaknessCode(code) || !canDiscardFromHand(inv, code)
        ? [] : [{ id: String(i), label: cardName(code) }]) })
    inv.discard.push(...inv.hand.splice(Number(index), 1))
  }
  if (!skids.freeAction.repeatable) inv.usedReactions[skids.freeAction.id + ':' + state.round] = true
  info(state, events, `⚡ ${inv.name} 使用调查员免费能力。`)
  resolveEffect(state, seat, skids.freeAction.effect, makeRuntime(state, events))
}

function doHiddenAction(state, seat, move, events) {
  const inv = state.investigators[seat]
  const rule = hiddenRule(state, move.cardId)
  const discard = rule?.discard
  if (!discard || !hasHiddenCard(inv, move.cardId)) return
  inv.resources -= discard.resources || 0
  if (discard.damageInvestigator) {
    const target = state.investigators.find(other => other.seat === move.targetSeat
      && !other.defeated && !other.resigned && other.location === inv.location)
    if (!target) throw new Error('隐私牌没有合法的伤害目标')
    applyDamage(state, target, discard.damageInvestigator, events)
  }
  discardHiddenCard(state, inv, move.cardId, events)
}

function doParley(state, seat, enemyId, events) {
  const inv = state.investigators[seat]
  const enemy = state.enemies.find((e) => e.id === enemyId)
  if (!enemy || enemy.engagedSeat !== seat || !enemy.parleyCost) return
  spendAction(state, inv)
  inv.resources -= enemy.parleyCost
  info(state, events, `🤝 ${inv.name} 花费 ${enemy.parleyCost} 资源谈判，「${enemy.name}」被弃掉。`)
  removeOne(state.enemies, enemy)
  removeOne(inv.engaged, enemy.id)
  if (isWeaknessCode(enemy.code)) inv.discard.push(enemy.code)
  else state.encounterDiscard.push(enemy.code)
}

// 谈判盘问独特异教徒（午夜假面）。
function doParleyCultist(state, seat, enemyId, events) {
  const inv = state.investigators[seat]
  const enemy = state.enemies.find((e) => e.id === enemyId)
  if (!enemy || !enemy.uniqueCultist) return
  const def = enemyDef(enemy.code)
  const cost = def.parley ? def.parley.cost : null
  if (!cost) return
  // 校验成本。
  if (cost.clues && inv.clues < cost.clues) { info(state, events, '线索不足，无法谈判。'); return }
  if (cost.resources && inv.resources < cost.resources) { info(state, events, '资源不足，无法谈判。'); return }
  if (cost.discardHand && inv.hand.length < cost.discardHand) { info(state, events, '手牌不足，无法谈判。'); return }
  spendAction(state, inv)
  if (cost.clues) spendClues(state, inv, cost.clues)
  if (cost.resources) inv.resources -= cost.resources
  if (cost.discardHand) discardChosenCards(state, inv, cost.discardHand, events, 'parley')
  info(state, events, `🤝 ${inv.name} 谈判盘问「${enemy.name}」，将其加入胜利区。`)
  interrogateCultist(state, enemy, events)
}

function doParleyLita(state, seat, events) {
  const inv = state.investigators[seat]
  const asset = state.storyAssets?.find(item => item.code === '01117'
    && item.controllerSeat == null && item.location === inv.location)
  if (!asset || scenarioBehavior(state).litaParleyActIndex !== state.actIndex) throw new Error('此处没有可谈判的丽塔')
  spendAction(state, inv)
  return performTest(state, seat, 'intellect', 4, { source: { label: '谈判', name: '丽塔·钱德勒', code: '01117' }, resolve: r => {
    if (r.success) {
      while (!canEquip(inv, cardDef(asset.code))) {
        const allies = inv.assets.filter(item => normalizedSlots(cardDef(item.code)).includes('ally'))
        const id = requestChoice(state, { kind: 'discard-asset', source: 'lita-control', seat,
          prompt: '选择弃掉一位盟友，为丽塔腾出槽位。',
          options: allies.map(item => ({ id: item.id, label: cardName(item.code) })) })
        const discarded = inv.assets.find(item => item.id === id)
        leaveAsset(state, inv, discarded)
        inv.discard.push(discarded.code)
      }
      removeOne(state.storyAssets, asset)
      delete asset.location
      asset.controllerSeat = seat
      inv.assets.push(asset)
      info(state, events, `${inv.name} 谈判成功，取得「丽塔·钱德勒」的控制权！`)
    } else {
      info(state, events, `${inv.name} 谈判失败（智识 ${r.value} vs 4）。`)
    }
  } })
}

// 抽取异教徒牌堆（午夜假面场景 1 能力：共同花费 2 线索/人）。
function doDrawCultist(state, seat, events) {
  const inv = state.investigators[seat]
  const needed = 2 * state.numInvestigators
  if (groupClues(state) < needed) throw new Error('符合条件的共同线索不足')
  if (!state.cultistDeck.length) { info(state, events, '异教徒牌堆已空。'); return }
  spendAction(state, inv)
  groupPayment(state, needed, null, events)
  const code = state.cultistDeck.pop()
  const def = enemyDef(code)
  const loc = def.spawn || inv.location
  const enemy = spawnEnemy(state, code, loc, null)
  info(state, events, `🕵️ 调查队花费 ${needed} 个线索抽取异教徒牌堆：「${enemy.name}」生成于「${locName(state, loc)}」。`)
  autoEngageAll(state, events)
}

// 破坏仪式（地底噬魔场景 3）。
function doInterruptRitual(state, seat, skill, events) {
  const inv = state.investigators[seat]
  if (scenarioBehavior(state).interruptRitualActIndex !== state.actIndex) return
  if (inv.clues < 1) { info(state, events, '需要 1 个线索。'); return }
  spendAction(state, inv)
  spendClues(state, inv, 1)
  const sk = skill === 'agility' ? 'agility' : 'willpower'
  return performTest(state, seat, sk, 3, { source: { label: '剧本行动', name: '破坏仪式' }, resolve: r => {
    if (r.success) {
      state.actClues += 1
      info(state, events, `📜 ${inv.name} 破坏仪式成功，本场景线索 +1（${state.actClues}/${state.numInvestigators * 2}）。`)
      checkAct(state, events)
    } else {
      info(state, events, `❌ ${inv.name} 破坏仪式失败（${SKILL_NAMES[sk]} ${r.value} vs 3）。`)
    }
  } })
}

// 献祭丽塔（地底噬魔，结局 3）。
function doSacrificeLita(state, seat, events) {
  const inv = state.investigators[seat]
  const asset = inv.assets.find(item => item.code === '01117')
  if (!scenarioBehavior(state).sacrificeLita || !asset
      || !state.enemies.some(enemy => enemy.code === 'umordhoth' && enemy.location === inv.location)) {
    throw new Error('献祭需要本人控制丽塔并与乌默尔多斯位于同一地点')
  }
  const owners = Object.values(state.campaign.investigators || {}).filter(record => record.deck?.includes(asset.code))
  if (owners.length !== 1) throw new Error('无法确定丽塔所属的持久牌组')
  spendAction(state, inv)
  leaveAsset(state, inv, asset)
  campaignCardChange(state.campaign, owners[0].seat, asset.code, 'remove', 'sacrificedLita')
  state.exiled.push(asset.code)
  info(state, events, `${inv.name} 将丽塔·钱德勒推向了乌默尔多斯，并从实际牌组中移除丽塔。`)
  finishScenario(state, 'r3', events)
}

// 破门（上锁的门）。
function doBreakDoor(state, seat, skill, events) {
  const inv = state.investigators[seat]
  const loc = state.locations.find((l) => l.id === inv.location)
  if (!loc || !loc.locked) return
  spendAction(state, inv)
  const useSkill = skill === 'agility' ? 'agility' : 'combat'
  return performTest(state, seat, useSkill, 4, { source: { label: '破门', name: loc.name, code: loc.lockedDoorCode || 'lockedDoor' }, resolve: r => {
    if (r.success) {
      loc.locked = false
      state.encounterDiscard.push(loc.lockedDoorCode || 'lockedDoor')
      delete loc.lockedDoorCode
      info(state, events, `🔓 ${inv.name} 以${SKILL_NAMES[useSkill]}检定破门而入。`)
    } else {
      info(state, events, `❌ ${inv.name} 以${SKILL_NAMES[useSkill]}检定破门失败。`)
    }
  } })
}

function doDiscardThreat(state, seat, threatId, events) {
  const inv = state.investigators[seat]
  const owner = state.investigators.find(other => !other.defeated && !other.resigned
    && other.location === inv.location && other.threat.some(t => t.id === threatId
      && (other.seat === seat || getThreatEffect(t)?.sameLocationAction)))
  const t = owner?.threat.find(item => item.id === threatId)
  const th = t && getThreatEffect(t)
  if (!t || !th?.discardCost) throw new Error('该威胁没有可用的弃置能力')
  const cost = th.discardCost.action ?? 1
  for (let i = 0; i < cost; i++) spendAction(state, inv)
  const discard = () => {
    removeThreat(state, owner, t, events)
    info(state, events, `${inv.name} 花 ${cost} 行动弃掉了「${cardName(t.code)}」。`)
  }
  if (th.discardTest) {
    performTest(state, seat, th.discardTest.skill, th.discardTest.difficulty, { source: { label: '解除威胁', name: cardName(t.code), code: t.code }, resolve: result => {
        if (result.success) discard()
        else info(state, events, `${inv.name} 未通过「${cardName(t.code)}」的弃置检定，该牌留在威胁区域。`)
    } })
  } else discard()
}

function doPayDebt(state, seat, threatId, events) {
  const inv = state.investigators[seat]
  const t = inv.threat.find(item => item.id === threatId)
  if (!t || !getThreatEffect(t)?.debt) return
  inv.resources -= 1
  t.resources = (t.resources || 0) + 1
  t.debtPaymentsThisRound = (t.debtPaymentsThisRound || 0) + 1
  info(state, events, `${inv.name} 向医院债务支付 1 资源（债务 ${t.resources}/6）。`)
}

function doPurgeThreat(state, seat, threatId, events) {
  const inv = state.investigators[seat]
  const t = inv.threat.find((x) => x.id === threatId)
  if (!t || (t.counters || 0) <= 0) return
  spendAction(state, inv)
  t.counters -= 1
  info(state, events, `📖 ${inv.name} 将「${cardName(t.code)}」的 1 点恐惧移到自己身上（剩余 ${t.counters}），受到 1 点恐惧。`)
  applyHorror(state, inv, 1, events, true)
  if (t.counters <= 0) {
    removeThreat(state, inv, t, events)
    info(state, events, `✔️ 「${cardName(t.code)}」恐惧清空，被弃掉。`)
  }
}

function doShortcutMove(state, seat, move, events) {
  const inv = state.investigators[seat]
  const attachment = (state.playerLocationAttachments || []).find(item =>
    item.code === '03232' && item.location === inv.location && !item.exhausted)
  if (!attachment) return
  attachment.exhausted = true
  relocateInvestigator(state, seat, move.locationId, events,
    `${inv.name} 使用「捷径」移动到「${locName(state, move.locationId)}」。`)
}

function doMove(state, seat, locationId, events) {
  const inv = state.investigators[seat]
  payActionCost(state, inv, 'move', events)
  if (!locationExists(state, locationId) && (state.scenario.setAsideLocations || []).includes(locationId)) {
    placeLocation(state, locationId, events)
  }
  relocateInvestigator(state, seat, locationId, events)
}

// Entering a location has the same consequences for an action or a card effect.
// Action payment and effect-specific disengagement stay with the caller.
function relocateInvestigator(state, seat, locationId, events, message = null) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned || inv.location === locationId || !locationExists(state, locationId)) return
  if (inv.steamImmobileRound === state.round) return
  const moveError = movementError(state, inv)
  if (moveError) { info(state, events, moveError); return }
  const entryError = investigatorEntryError(state, locationId, seat)
  if (entryError) { info(state, events, entryError); return }
  const from = locName(state, inv.location)
  const prevLoc = state.locations.find((l) => l.id === inv.location)
  const companions = state.enemies.filter(enemy => enemy.engagedSeat === seat).map(enemy => enemy.id)
  const enter = () => {
  if (prevLoc && prevLoc.barricade) {
    discardBarricades(state, prevLoc)
    info(state, events, `🚧 「${prevLoc.name}」上的屏障因调查员离开而被弃掉。`)
  }
  inv.location = locationId
  inv.handSlotsPenalty = state.locations.find(location => location.id === locationId)?.handSlotsPenalty || 0
  if (state.phase === 'investigation' && state.turnSerial) {
    if (inv.hiddenMoves?.turnSerial !== state.turnSerial) inv.hiddenMoves = { turnSerial: state.turnSerial, count: 0 }
    inv.hiddenMoves.count++
  }
  info(state, events, message || `🚶 ${inv.name} 从「${from}」移动到「${locName(state, locationId)}」。`)
  for (const enemy of state.enemies.filter(enemy => enemy.engagedSeat === seat)) {
    if (enemy.bindMonster) { disengageEnemy(state, enemy); continue }
    const previous = enemy.location
    enemy.location = locationId
    scenarioBehavior(state).enemyMoved?.(state, enemy, previous, scenarioRuntime(state, events), seat)
  }
  const alreadyRevealed = state.locations.find(l => l.id === locationId)?.revealed
  revealLocation(state, locationId, events, seat)
  autoEngageAt(state, locationId, events)
  const loc = state.locations.find((l) => l.id === locationId)
  scenarioBehavior(state).locationEntered?.(state, inv, loc, scenarioRuntime(state, events), companions)
  if (loc && loc.onEnter) {
    if (alreadyRevealed) info(state, events, `${inv.name} 进入「${loc.name}」，触发地点效果。`, locationRevealCue(loc, true, seat))
    if (loc.onEnter.horror) { info(state, events, `😱 进入「${loc.name}」：${inv.name} 受到 ${loc.onEnter.horror} 点恐惧。`); applyHorror(state, inv, loc.onEnter.horror, events) }
    if (loc.onEnter.damage) { info(state, events, `💥 进入「${loc.name}」：${inv.name} 受到 ${loc.onEnter.damage} 点伤害。`); applyDamage(state, inv, loc.onEnter.damage, events) }
    if (loc.onEnter.test) {
      performTest(state, seat, loc.onEnter.test.skill, loc.onEnter.test.difficulty, { source: { label: '进入地点', name: loc.name, code: loc.originalCode || loc.code }, resolve: r => {
        if (!r.success && loc.id === 'graveyard') {
          const options = [{ id: 'horror', label: '受到 2 点恐惧' }]
          const rivertown = state.locations.find((item) => item.id === 'rivertown')
          if (rivertown) options.push({ id: 'move', label: '移动到河岸城' })
          const answer = options.length === 1 ? 'horror' : requestChoice(state, {
            kind: 'location', source: loc.id, seat: inv.seat, prompt: '墓地检定失败：选择受到 2 点恐惧或移动到河岸城。', options,
          })
          if (answer === 'move') {
            relocateInvestigator(state, seat, 'rivertown', events)
          } else {
            info(state, events, `😱 「墓地」检定失败：${inv.name} 受到 2 点恐惧。`)
            applyHorror(state, inv, 2, events)
          }
        } else if (!r.success) {
          applyPenalty(state, inv, loc.onEnter.fail, Math.max(0, loc.onEnter.test.difficulty - r.value), events)
        }
      } })
    }
  }
  if (!inv.defeated && !inv.resigned && inv.location === locationId) {
    triggerReaction(state, seat, 'move', events, { when: 'move', seat, location: locationId })
  }
  // 地底噬魔场景 2 目标：进入仪式地。
  const act = state.acts[state.actIndex]
  if (act && act.objective && act.objective.type === 'enterLocation' && locationId === act.objective.location) {
    advanceAct(state, events)
  }
  }
  const moveAfterCosts = () => {
  scenarioBehavior(state).beforeMove?.(state, inv, state.locations.find(loc => loc.id === locationId), scenarioRuntime(state, events))
  if (prevLoc?.id === 'twistingPaths') {
    performTest(state, seat, 'intellect', 3, { source: { label: '离开地点', name: prevLoc.name, code: prevLoc.originalCode || prevLoc.code }, resolve: r => {
        if (r.success) enter()
        else { inv.location = prevLoc.id; info(state, events, `🌀 「扭曲的道路」：${inv.name} 迷路了，移动被取消。`) }
    } })
  } else {
    const leaveTest = scenarioBehavior(state).locationLeaveTest?.(state, inv, prevLoc, locationId)
    if (leaveTest) performTest(state, seat, leaveTest.skill, leaveTest.difficulty,
      { source: { label: '离开地点', name: prevLoc.name, code: prevLoc.originalCode || prevLoc.code }, resolve: result => {
        if (result.success) enter()
        else scenarioBehavior(state).locationLeaveFailed?.(state, inv, prevLoc, scenarioRuntime(state, events))
      } })
    else enter()
  }
  if (prevLoc && prevLoc.id !== inv.location) scenarioBehavior(state).locationLeft?.(state, inv, prevLoc, scenarioRuntime(state, events))
  }
  const barriers = state.locations.filter(loc => [inv.location, locationId].includes(loc.id))
    .flatMap(loc => Array(loc.arcaneBarriers || 0).fill(loc))
  const payBarrier = index => {
    if (index >= barriers.length) return moveAfterCosts()
    const loc = barriers[index]
    performTest(state, seat, 'willpower', 4, { source: { label: '奥术屏障', code: '02102' }, resolve: result => {
      if (result.success) { loc.arcaneBarriers--; state.encounterDiscard.push('02102'); payBarrier(index + 1) }
      else if (requestChoice(state, { kind: 'encounter', source: '02102', seat,
        prompt: '奥术屏障：取消移动，或弃掉牌库顶 5 张牌继续移动。',
        options: [{ id: 'cancel', label: '取消移动' }, { id: 'mill', label: '弃掉 5 张牌继续移动' }] }) === 'mill') {
        scenarioRuntime(state, events).discardTop(seat, 5)
        if (!inv.defeated) payBarrier(index + 1)
      }
    } })
  }
  payBarrier(0)
}

function relocateEnemy(state, enemy, destination, events) {
  if (!enemy || enemy.bindMonster || !destination || enemy.location === destination || !locationExists(state, destination)) return
  if (!enemy.elite && state.locations.find(loc => loc.id === destination)?.barricade) return
  const previous = enemy.location
  enemy.location = destination
  if (enemy.engagedSeat != null && state.investigators[enemy.engagedSeat]?.location !== destination) disengageEnemy(state, enemy)
  processPlayerEnemyEntry(state, enemy, events)
  scenarioBehavior(state).enemyMoved?.(state, enemy, previous, scenarioRuntime(state, events))
  autoEngageAt(state, destination, events)
}

function engagedWithMaskedHunter(state, inv) {
  return state.enemies.some(enemy => enemy.code === 'theMaskedHunter' && enemy.engagedSeat === inv.seat && !enemyTextBlanked(state, enemy))
}

function canSpendClues(state, inv) {
  return !engagedWithMaskedHunter(state, inv)
}

function locationAbilityAvailable(state, loc, inv) {
  if (!loc.revealed || inv.location !== loc.id) return false
  const ab = loc.ability
  if (!ab) return false
  if (ab.limit === 'game' && (loc.abilityUsed || loc.abilityUsedSeats?.includes(inv.seat))) return false
  if (ab.limit === 'team-game' && state.locationAbilityTeamUsed?.[loc.id]) return false
  if (ab.limit === 'round' && loc.abilityRound === state.round) return false
  if (ab.limit === 'player-turn' && loc.abilityTurns?.[inv.seat] === `${state.round}:${state.currentSeat}`) return false
  if (effectError(state, inv, ab.effect)) return false
  if (ab.cost && ab.cost.resources && inv.resources < ab.cost.resources) return false
  return true
}

function markLocationAbilityUsed(state, loc, inv) {
  const ab = loc.ability || {}
  if (ab.limit === 'game') { loc.abilityUsedSeats ||= []; loc.abilityUsedSeats.push(inv.seat) }
  if (ab.limit === 'team-game') { state.locationAbilityTeamUsed ||= {}; state.locationAbilityTeamUsed[loc.id] = true }
  if (ab.limit === 'round') loc.abilityRound = state.round
  if (ab.limit === 'player-turn') { loc.abilityTurns ||= {}; loc.abilityTurns[inv.seat] = `${state.round}:${state.currentSeat}` }
}

function doLocationAbility(state, seat, locationId, events) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === locationId)
  if (!loc || !loc.ability || inv.location !== locationId) return
  const ab = loc.ability
  if (ab.cost && ab.cost.resources) inv.resources -= ab.cost.resources
  markLocationAbilityUsed(state, loc, inv)
  info(state, events, `📍 ${inv.name} 使用「${loc.name}」的能力：${ab.label}。`)
  resolveEffect(state, seat, ab.effect, makeRuntime(state, events))
}

function doInvestigate(state, seat, opts, events, noSpend) {
  const inv = state.investigators[seat]
  const loc = state.locations.find((l) => l.id === (opts.locationId || inv.location))
  if (!noSpend) spendAction(state, inv)
  if (!loc || loc.clues <= 0) {
    info(state, events, `${inv.name} 调查了「${loc ? loc.name : inv.location}」，但这里已经没有线索了。`)
    return
  }
  if (loc.locked) {
    info(state, events, `🔒 「${loc.name}」被上锁的门封锁，无法调查。`)
    return
  }
  if (engagedWithMaskedHunter(state, inv)) {
    info(state, events, `🎭 ${inv.name} 与假面猎手交战时不能发现线索。`)
    return
  }
  const skill = loc.investigateSkill || 'intellect'
  const temporaryShroud = loc.carcosaShroudModifier?.round === state.round
    && loc.carcosaShroudModifier.turnSeat === state.currentSeat ? loc.carcosaShroudModifier.amount : 0
  const scenarioShroud = scenarioBehavior(state).locationShroudModifier?.(state, loc) || 0
  const difficulty = loc.shroud + (loc.shroudMod || 0) + temporaryShroud + scenarioShroud + (state.fogMod || 0) + (opts.shroudMod || 0)
  const noIntellectBoost = skill === 'intellect' && loc.noIntellectBoost
  const baseValue = opts.baseValue ?? (loc.doubleBaseSkill ? (inv[skill] || 0) * 2
    : noIntellectBoost ? (inv[skill] || 0) : undefined)

  return performTest(state, seat, skill, difficulty, { source: { label: '调查', name: loc.name, code: loc.originalCode || loc.code }, baseValue,
    skillBonus: (noIntellectBoost ? 0 : skill === 'intellect' ? investigateBonus(inv) : 0) + (opts.bonus || 0)
      + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0), resolve: r => {
    const negativeSymbol = r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))
    if (negativeSymbol && opts.symbolEndsTurn) {
      inv.actionsLeft = 0
      if (state.currentSeat === seat) inv.turnEnded = true
      info(state, events, `${inv.name} 揭示负面符号，失去所有剩余行动并结束本回合。`)
    } else if (negativeSymbol && opts.symbolActionLoss) {
      inv.actionsLeft = Math.max(0, inv.actionsLeft - opts.symbolActionLoss)
      info(state, events, `${inv.name} 揭示负面符号，失去 ${opts.symbolActionLoss} 个行动。`)
    }
    if (opts.lockpicksAssetId && r.value - difficulty < 2) {
      const lockpicks = inv.assets.find(item => item.id === opts.lockpicksAssetId)
      if (lockpicks) {
        lockpicks.uses = Math.max(0, (lockpicks.uses || 0) - 1)
        if (!lockpicks.uses) { leaveAsset(state, inv, lockpicks, events); inv.discard.push(lockpicks.code) }
      }
    }
    if (r.success) {
      const successBy = r.value - difficulty
      const gain = (1 + (opts.clueBonus || 0) + (r.clueBonus || 0)
        + (opts.successByClueEvery ? Math.floor(successBy / opts.successByClueEvery) : 0)) * (r.rewardMultiplier || 1)
      info(state, events, `${inv.name} 调查成功（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}）。`)
      triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
      discoverClueAt(state, inv, gain, events)
      if (opts.autoEvadeOnSuccess) {
        const targets = enemiesEngagedWith(state, inv)
        if (targets.length) {
          const enemy = targets.length === 1 ? targets[0] : chooseEnemyFrom(state, seat, targets, '03193')
          enemy.exhausted = true; disengageEnemy(state, enemy); afterEvade(state, inv, enemy, events)
        }
      }
      if (loc.fog) {
        loc.shroudMod = 0
        loc.fog = 0
        state.encounterDiscard.push(loc.fogCode || 'obscuringFog')
        delete loc.fogCode
        info(state, events, `🌫️ 「${loc.name}」被成功调查，朦胧之雾消散。`)
      }
      awardLocationVictory(state, loc, events)
    } else {
      info(state, events, `🔍 ${inv.name} 调查失败（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}，标记 ${tokenLabel(r.token)}）。`)
      reactionWindow(state, 'investigateFail', { when: 'investigateFail', seat, location: loc.id, failedBy: Math.max(0, difficulty - r.value), prompt: '调查检定失败后' }, events)
    }
  } })
}

function doSearchIzzie(state, seat, events) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === inv.location)
  if (!loc || loc.searchingForIzzieSeat == null) return
  performTest(state, seat, 'intellect', loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0), {
    source: { label: '调查', name: '寻找伊兹', code: '02011' }, resolve: result => {
      if (!result.success) return
      state.investigators[loc.searchingForIzzieSeat]?.discard.push('02011')
      delete loc.searchingForIzzieSeat
      info(state, events, `${inv.name} 成功寻找伊兹，弃掉这张弱点。`)
    },
  })
}

function awardLocationVictory(state, loc, events) {
  if (loc.clues <= 0 && loc.victory && !loc.victoryAwarded) {
    loc.victoryAwarded = true
    state.victory += loc.victory
    info(state, events, `💎 「${loc.name}」被完全调查，胜利点 +${loc.victory}（累计 ${state.victory}）。`)
  }
}

function doFight(state, seat, opts, events, noSpend) {
  const inv = state.investigators[seat]
  const enemy = state.enemies.find((e) => e.id === opts.enemyId)
  if (hiddenFightBlocked(state, inv, enemy)) return
  if (enemy?.code === '02255' && opts.assetId !== '02254' && !enemyTextBlanked(state, enemy)) return
  if (opts.requireNotEngagedTarget && enemy?.engagedSeat === seat) { info(state, events, '该武器不能攻击与你交战的敌人。'); return }
  if (!noSpend) payActionCost(state, inv, 'fight', events)
  if (!enemy) { info(state, events, `${inv.name} 找不到可攻击的敌人。`); return }
  if (opts.fireAxe) {
    // "Limit three times per attack" -> at most 3 resources, +2 combat each.
    const max = Math.min(inv.resources, 3)
    const spend = max ? Number(requestChoice(state, { kind: 'resource', source: opts.assetId || '02032', seat,
      prompt: '消防斧：选择为本次攻击花费的资源（每次攻击最多 3 点）。', options: Array.from({ length: max + 1 }, (_, i) => ({ id: String(i), label: `${i} 资源（战斗 +${i * 2}）` })) })) : 0
    inv.resources -= spend; opts.combatBonus = (opts.combatBonus || 0) + spend * 2
    if (inv.resources === 0) opts.damageBonus = (opts.damageBonus || 0) + 1
  }
  if (opts.maySpendActionForDamage && inv.actionsLeft > 0 && requestChoice(state, { kind: 'action', source: opts.assetId, seat,
    prompt: '是否额外花费 1 行动，使本次攻击伤害 +1？', options: [{ id: 'skip', label: '不花费' }, { id: 'spend', label: '花费 1 行动' }] }) === 'spend') {
    inv.actionsLeft--; opts.damageBonus = (opts.damageBonus || 0) + opts.maySpendActionForDamage
  }
  if (opts.additionalActionCombatBonus) {
    const maximum = inv.actionsLeft
    const extra = maximum ? Number(requestChoice(state, { kind: 'action', source: opts.assetId, seat,
      prompt: '芝加哥打字机：选择额外花费的行动数。',
      options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount} 个额外行动（战斗 +${(amount + 1) * opts.additionalActionCombatBonus}）` })) })) : 0
    inv.actionsLeft -= extra
    opts.combatBonus = (opts.combatBonus || 0) + (extra + 1) * opts.additionalActionCombatBonus
  }
  // 庞大敌人：与所在地点所有调查员交战，无需单独交战。
  const canFight = enemy.location === inv.location
  if (!canFight) { info(state, events, `${inv.name} 找不到可攻击的交战敌人。`); return }
  const mods = enemyStatMods(state)
  const skill = opts.skill || 'combat'
  const loc = state.locations.find(item => item.id === inv.location)
  const clueCombat = opts.ifCluesAtLocationCombatBonus && loc && loc.clues > 0 ? opts.ifCluesAtLocationCombatBonus : 0
  let difficulty = enemyFightValue(state, enemy, inv)
  // Expose Weakness: the reduction applies to the next attack against it this phase.
  if (enemy.fightReduction && enemy.fightReduction.round === state.round && enemy.fightReduction.phase === state.phase) delete enemy.fightReduction
  const weapon = inv.assets.find(asset => asset.id === opts.assetId)
  if (weapon && (cardDef(weapon.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'firearm')) {
    const context = { when: 'activateFirearmFight', seat, location: inv.location, enemy, assetId: weapon.id,
      prompt: `${inv.name} 启动了「${cardName(weapon.code)}」的攻击能力` }
    reactionWindow(state, 'activateFirearmFight', context, events)
    opts.extraChaosChoices = context.extraChaosChoices || 0
  }
  if (enemy.code === '02094' && !enemyTextBlanked(state, enemy)
    && cardDef(weapon?.code)?.traits?.some(trait => ['Ranged', 'Firearm', 'Spell'].includes(trait))) difficulty = Math.max(0, difficulty - 3)
  const weaponCode = weapon?.code || (opts.assetId && cardDef(opts.assetId) ? opts.assetId : null)
  const attackFx = { weaponCode, attackStyle: attackStyle(weaponCode && cardDef(weaponCode)) }
  return performTest(state, seat, skill, difficulty, { source: { label: '攻击', enemyId: enemy.id, name: enemy.name, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code }, baseValue: opts.baseValue,
    extraChaosChoices: opts.extraChaosChoices || 0,
    skillBonus: (opts.combatBonus || 0) + clueCombat + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0), resolve: r => {
    if (enemy.code === '02103' && !enemyTextBlanked(state, enemy) && weapon && cardDef(weapon.code)?.traits?.includes('Melee')) {
      leaveAsset(state, inv, weapon, events); inv.discard.push(weapon.code)
    }
    if (opts.onChaosSymbolHorror && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      info(state, events, `😱 ${inv.name} 在攻击中揭示了负面符号，受到 ${opts.onChaosSymbolHorror} 点恐惧。`)
      applyHorror(state, inv, opts.onChaosSymbolHorror, events)
    }
    if (opts.stormOfSpirits && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      for (const investigator of aliveInvestigators(state).filter(other => other.location === enemy.location)) applyDamage(state, investigator, 1, events)
    }
    if (r.success) {
      const movedDamage = Math.min(inv.damage, r.homeFrontDamage || 0)
      if (movedDamage > 0) {
        inv.damage -= movedDamage
        info(state, events, `「${cardName('03007')}」：从 ${inv.name} 身上移动 ${movedDamage} 点伤害到「${enemy.name}」。`)
        damageEnemy(state, enemy, movedDamage, inv.seat, events)
        if (!state.enemies.includes(enemy)) return
      }
      if (opts.damagePerClue) opts.damageBonus = Math.min(opts.maxDamageBonus || 3, inv.clues)
      if (opts.skullDamageBonus && r.drawn.includes('skull')) opts.damageBonus = (opts.damageBonus || 0) + opts.skullDamageBonus
      const weaponBonus = opts.successBy == null || r.value - difficulty >= opts.successBy ? opts.damageBonus || 0 : 0
      if (opts.damageOnSuccessBy != null && r.value - difficulty >= opts.damageOnSuccessBy) opts.damageBonus = (opts.damageBonus || 0) + 1
      if (opts.gainActionOnSuccessBy != null && r.value - difficulty >= opts.gainActionOnSuccessBy) {
        inv.carcosaActionGains ||= {}
        const key = `${state.round}:${state.currentSeat}:${opts.assetId || 'attack'}`
        if (!inv.carcosaActionGains[key]) { inv.carcosaActionGains[key] = true; inv.actionsLeft++ }
      }
      const onlyEngaged = enemiesEngagedWith(state, inv)
      const conditional = opts.onlyEngagedDamage && onlyEngaged.length === 1 && onlyEngaged[0].id === enemy.id ? opts.onlyEngagedDamage : 0
      let dmg = opts.successDamage === 'overDifficulty'
        ? Math.max(opts.minDamage || 1, Math.min(opts.maxDamage || 5, r.value - difficulty))
        : 1 + weaponBonus + conditional + (r.damageBonus || 0)
      dmg *= r.rewardMultiplier || 1
      const isMonster = (enemy.traits || []).some((t) => t.toLowerCase() === 'monster')
      if (isMonster && litaAuraAt(state, inv)) {
        dmg += 1
        info(state, events, `✨ 丽塔·钱德勒的激励：对怪物敌人的攻击 +1 伤害。`)
      }
      if (!enemyTextBlanked(state, enemy)
        && scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, opts.assetId || null, seat) === false) {
        dmg = 0
        info(state, events, `⛔ 「${enemy.name}」免疫这次攻击造成的伤害。`)
      }
      ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'attack', direction: 'outgoing', seat, enemyId: enemy.id,
        assetId: opts.assetId, ...attackFx, name: enemy.name, location: enemy.location, damage: dmg, success: true,
        defeated: enemy.damageTaken + dmg >= enemyHealthValue(state, enemy)
          && scenarioBehavior(state).enemyCanBeDefeated?.(state, enemy, opts.assetId || null, seat) !== false,
        tableState: captureTableState(state, getStat, getMaxSanity) })
      if (enemy.code === '02255' && opts.assetId !== '02254' && !enemyTextBlanked(state, enemy)) return
      if (opts.stormOfSpirits) {
        for (const other of state.enemies.filter(item => item.location === enemy.location)) {
          damageEnemy(state, other, other.id === enemy.id ? dmg : 2, seat, events, opts.assetId || null)
        }
      } else enemy.damageTaken += dmg
      if (!opts.stormOfSpirits) {
        scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events))
        enemy.defeatedBy = seat
      }
      info(state, events, `⚔️ ${inv.name} 攻击成功（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}），对「${enemy.name}」造成 ${dmg} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
      scenarioBehavior(state).enemyAttackedSuccessfully?.(state, inv, enemy, scenarioRuntime(state, events))
      if (opts.defeatNonEliteOnSuccess && !enemy.elite) enemy.damageTaken = enemyHealthValue(state, enemy)
      if (state.enemies.includes(enemy) && enemy.damageTaken >= enemyHealthValue(state, enemy)
        && scenarioBehavior(state).enemyCanBeDefeated?.(state, enemy, opts.assetId || null, seat) !== false) defeatEnemy(state, enemy, events)
      if (opts.autoEvadeOnSuccessBy != null && state.enemies.includes(enemy)
        && r.value - difficulty >= opts.autoEvadeOnSuccessBy) {
        enemy.exhausted = true
        disengageEnemy(state, enemy)
        afterEvade(state, inv, enemy, events, r)
        info(state, events, `💨 ${inv.name} 以 ${opts.autoEvadeOnSuccessBy} 点以上成功，自动躲避「${enemy.name}」。`)
      }
    } else {
      ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'attack', direction: 'outgoing', seat, enemyId: enemy.id,
        assetId: opts.assetId, ...attackFx, name: enemy.name, location: enemy.location, damage: 0, success: false,
        tableState: captureTableState(state, getStat, getMaxSanity) })
      info(state, events, `⚔️ ${inv.name} 攻击失败（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}，标记 ${tokenLabel(r.token)}）。`)
      const attackFail = reactionWindow(state, 'attackFail', { when: 'attackFail', seat, location: inv.location, enemy,
        failedBy: Math.max(0, difficulty - r.value), attackDamage: 1 + (opts.damageBonus || 0), redirected: false,
        prompt: `对「${enemy.name}」的攻击失败` }, events)
      // 参考 Investigator/Runner.hs：目标恰与一名其他调查员交战时，攻击者误伤该调查员 1 点。
      const engaged = state.investigators.filter(other => !other.defeated && !other.resigned
        && (other.engaged.includes(enemy.id) || (enemy.massive && other.location === enemy.location)))
      if (!attackFail.redirected && !opts.noFriendlyFire && engaged.length === 1 && engaged[0].seat !== seat) {
        const missDamage = opts.failByAmountToEngaged
          ? Math.max(1, Math.min(5, difficulty - r.value))
          : 1
        info(state, events, `${inv.name} 攻击落空，误伤 ${engaged[0].name} ${missDamage} 点。`)
        applyHarm(state, engaged[0], missDamage, 0, events)
      }
      if (!opts.ignoreRetaliate && (enemy.retaliate || opts.grantRetaliate) && !enemy.exhausted && !enemyTextBlanked(state, enemy)) {
        enemyAttack(state, enemy, inv, events, `⚡ 「${enemy.name}」反击 ${inv.name}：${enemy.damage} 点伤害、${enemy.horror} 点恐惧。`)
      }
    }
    if (opts.discardOnTokens?.some(token => r.drawn.includes(token)) && opts.assetId) {
      const asset = inv.assets.find(item => item.id === opts.assetId)
      if (asset) { leaveAsset(state, inv, asset); if (!asset.removedFromGame) inv.discard.push(asset.code) }
    }
  } })
}

function doEvade(state, seat, opts, events, noSpend) {
  const inv = state.investigators[seat]
  const enemy = state.enemies.find((e) => e.id === opts.enemyId)
  if (!noSpend) payActionCost(state, inv, 'evade', events)
  if (!enemy) { info(state, events, `${inv.name} 找不到可躲避的敌人。`); return }
  const canEvade = enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location)
  if (!canEvade) { info(state, events, `${inv.name} 找不到可躲避的交战敌人。`); return }
  const mods = enemyStatMods(state)
  if (opts.auto) {
    enemy.exhausted = true
    disengageEnemy(state, enemy)
    info(state, events, `💨 ${inv.name} 摆脱了「${enemy.name}」！`)
    afterEvade(state, inv, enemy, events, null)
    return
  }
  const evadeSkill = opts.skill || 'agility'
  const evadeBase = Math.max(0, enemyEvadeValue(state, enemy, inv) + (opts.evadeModifier || 0))
  return performTest(state, seat, evadeSkill, evadeBase, { source: { label: '躲避', enemyId: enemy.id, name: enemy.name, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code }, baseValue: opts.baseValue,
    skillBonus: (opts.bonus || 0) + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0),
    doubleNegative: enemy.code === 'huntingNightgaunt' && !enemyTextBlanked(state, enemy), resolve: r => {
    if (opts.symbolActionLoss && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
      info(state, events, `🌀 ${inv.name} 在躲避中揭示负面符号，本回合失去 1 个行动。`)
    }
    if (opts.onChaosSymbolHorror && r.drawn.some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
      info(state, events, `😱 ${inv.name} 受到 ${opts.onChaosSymbolHorror} 点恐惧。`)
      applyHorror(state, inv, opts.onChaosSymbolHorror, events)
    }
    if (opts.suggestionAssetId && r.value - evadeBase < 2) {
      const suggestion = inv.assets.find(item => item.id === opts.suggestionAssetId)
      if (suggestion) suggestion.uses = Math.max(0, (suggestion.uses || 0) - 1)
    }
    if (r.success) {
      enemy.exhausted = !opts.noExhaustOnSuccess
      disengageEnemy(state, enemy)
      if (opts.preventEngageThisTurn) enemy.preventEngageSeat = { seat, round: state.round, turnSeat: state.currentSeat }
      if (opts.evadeOthersOnSuccess) for (const other of state.enemies.filter(item => item.engagedSeat === seat)) autoEvadeEnemy(state, other, events)
      info(state, events, `💨 ${inv.name} 躲避成功（${SKILL_NAMES[evadeSkill]} ${r.value} vs ${evadeBase}），「${enemy.name}」被横置并脱离交战。`)
      triggerReaction(state, seat, 'evadeSuccess', events, { enemy, location: inv.location })
      reactionWindow(state, 'evadeSuccess', {
        when: 'evadeSuccess', seat, location: inv.location, enemy,
        prompt: `「${enemy.name}」被躲避后`,
      }, events)
      if (opts.damageOnSuccess && state.enemies.includes(enemy)) {
        enemy.defeatedBy = seat
        damageEnemy(state, enemy, opts.damageOnSuccess, seat, events)
        info(state, events, `💥 「${enemy.name}」被躲避后受到 ${opts.damageOnSuccess} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
      }
      afterEvade(state, inv, enemy, events, r)
      if (opts.moveEnemyOnSuccess && !enemy.elite) {
        const current = state.locations.find(loc => loc.id === enemy.location)
        const destinations = (current?.connections || []).filter(id => locationExists(state, id))
        if (destinations.length) {
          const id = destinations.length === 1 ? destinations[0] : requestChoice(state, { kind: 'move', source: '02034', seat,
            prompt: '选择诱饵与换位将敌人移动到的连接地点。', options: destinations.map(id => ({ id, label: locName(state, id) })) })
          relocateEnemy(state, enemy, id, events)
        }
      }
      const disengage = r.evadeDisengage && inv.engaged.length && requestChoice(state, {
        kind: 'reaction', source: 'survivalInstinct', seat, canSkip: true, prompt: '是否躲避所有其他交战敌人？',
        options: [{ id: 'skip', label: '保持交战' }, { id: 'trigger', label: '躲避所有其他敌人' }],
      }) === 'trigger'
      if (disengage) {
        for (const eid of inv.engaged.slice()) {
          const e = state.enemies.find((x) => x.id === eid)
          if (e) autoEvadeEnemy(state, e, events)
        }
        info(state, events, `💨 ${inv.name} 的「求生本能」：躲避所有其他交战敌人。`)
      }
      if (r.mayMoveAfterEvade && investigatorMoveDestinations(state, seat, {}).length && requestChoice(state, {
        kind: 'reaction', source: 'survivalInstinctMove', seat, canSkip: true, prompt: '是否移动到相连地点？',
        options: [{ id: 'skip', label: '留在此处' }, { id: 'trigger', label: '移动' }],
      }) === 'trigger') moveInvestigatorTo(state, seat, { source: 'survivalInstinct', keepEngaged: !disengage }, events)
    } else {
      info(state, events, `💨 ${inv.name} 躲避失败（${SKILL_NAMES[evadeSkill]} ${r.value} vs ${evadeBase}，标记 ${tokenLabel(r.token)}）。`)
      if (enemy.alert && !enemy.exhausted && !enemyTextBlanked(state, enemy)) {
        enemyAttack(state, enemy, inv, events, `⚡ 「${enemy.name}」警戒反击 ${inv.name}。`)
      }
    }
  } })
}

// 躲避后的强制（露丝·特纳：躲避成功加入胜利区）。
function afterEvade(state, inv, enemy, events, result = null) {
  scenarioBehavior(state).afterEvade?.(state, inv, enemy, result, scenarioRuntime(state, events))
  if (enemy.evadeToVictory && !enemyTextBlanked(state, enemy)) {
    info(state, events, `🕵️ 「${enemy.name}」被躲避，加入胜利区！`)
    interrogateCultist(state, enemy, events)
  }
}

function doAbility(state, seat, assetId, abilityIndex, targetId, optionIndex, events) {
  const inv = state.investigators[seat]
  const asset = controlledAbilityCard(inv, assetId)
  if (!asset) return
  if (!lolaCanUseCard(inv, asset.code)) return
  const eff = assetEffect(inv, asset)
  const ability = eff && eff.abilities && eff.abilities[abilityIndex]
  if (!ability) return
  const cost = ability.cost || {}

  if (cost.exhaust) {
    if (asset.exhausted) return
    asset.exhausted = true
  }
  if (cost.uses) {
    if ((asset.uses || 0) < cost.uses) return
    asset.uses -= cost.uses
  }
  if (cost.resources) {
    if (inv.resources < cost.resources) return
    inv.resources -= cost.resources
  }
  if (cost.discardHand) {
    if (discardableHandCards(inv, cost.discardHandIcon).length < cost.discardHand) return
    discardChosenCards(state, inv, cost.discardHand, events, asset.code, cost.discardHandIcon)
  }
  if (cost.horror) applyHorror(state, inv, cost.horror, events)
  if (cost.damageSelf) applyDamage(state, inv, cost.damageSelf, events, true)
  if (cost.assetDamage && asset) {
    asset.damage = (asset.damage || 0) + cost.assetDamage
    const assetDef = cardDef(asset.code)
    if (assetDef?.health > 0 && asset.damage >= assetDef.health) {
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      info(state, events, `${cardName(asset.code)} 因自身伤害被弃置。`)
    }
  }
  if (cost.action !== false) spendAction(state, inv)
  if (cost.discardSelf) {
    leaveAsset(state, inv, asset)
    if (!asset.removedFromGame) inv.discard.push(asset.code)
    info(state, events, `♻️ ${inv.name} 弃掉了「${cardName(asset.code)}」。`)
  }
  if (cost.exileSelf) {
    leaveAsset(state, inv, asset)
    exilePlayerCard(state, inv, asset.code, events)
  }

  // 目标选择（targetId）与 choose 分支（optionIndex）由 AI/前端传入，注入到效果上。
  let effect = { ...ability.effect, assetId: asset.id }
  if (targetId != null) effect = applyAbilityTarget(effect, targetId)
  if (optionIndex != null) effect = { ...effect, optionIndex }

  info(state, events, `✨ ${inv.name} 使用「${cardName(asset.code)}」的能力：${ability.label}。`)
  resolveEffect(state, seat, effect, makeRuntime(state, events))

  if (eff.discardWhenEmpty && asset.uses != null && asset.uses <= 0) {
    leaveAsset(state, inv, asset)
    if (!asset.removedFromGame) inv.discard.push(asset.code)
    info(state, events, `「${cardName(asset.code)}」充能耗尽，弃掉。`)
  }
}

function doEngage(state, seat, enemyId, events) {
  const inv = state.investigators[seat]
  const enemy = state.enemies.find((e) => e.id === enemyId)
  if (!enemy) return
  engageEnemy(state, enemy, seat, events)
  info(state, events, `${inv.name} 主动与「${enemy.name}」交战。`)
}

function scenarioResignAvailable(state) {
  if (state.scenario?.resignAnywhere) return true
  if (state.locations.some(loc => loc.resign)) return true
  return [...(state.acts || []), ...(state.agendas || [])]
    .some(card => /(^|\n)\s*(Resign|撤退)[.。]/i.test(card.text || ''))
}

function doResign(state, seat, events) {
  const inv = state.investigators[seat]
  inv.resigned = true
  eliminateInvestigator(state, inv, events)
  info(state, events, `🏳️ ${inv.name} 撤退了。`)
  if (aliveInvestigators(state).length === 0) scenarioBehavior(state).allResigned?.(state, scenarioRuntime(state, events))
  checkOutcome(state, events)
}

function doEndTurn(state, seat, events) {
  const inv = state.investigators[seat]
  for (const asset of inv.assets.filter(item => item.sleightOfHand?.round === state.round
    && item.sleightOfHand.turnSeat === state.currentSeat).slice()) {
    leaveAsset(state, inv, asset, events)
    inv.hand.push(asset.code)
  }
  inv.actionsLeft = 0
  delete inv.lolaDiscount
  info(state, events, `${inv.name} 结束了本回合的行动。`)
}

// ---------------------------------------------------------------------------
// 合法行动 / 校验
// ---------------------------------------------------------------------------

export function legalMoves(state, observerSeat) {
  if (state.status !== 'playing') return []
  if (state.pendingChoice) return choiceMoves(state, observerSeat)
  if (inHub(state)) return hubLegalMoves(state, observerSeat ?? decisionSeat(state))
  const seat = state.currentSeat
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const loc = state.locations.find((l) => l.id === inv.location)
  // Scenario actions are normally granted by the investigator's current
  // location. Preserve an explicit target, but annotate local actions so the
  // client can present them when that location is selected.
  moves.push(...(scenarioBehavior(state).actions?.(state, inv) || []).map(move =>
    move.locationId || move.scriptCard ? move : { ...move, locationId: inv.location }))
  moves.push(...(scenarioBehavior(state).encounterActions?.(state, inv) || []))
  for (const attachment of state.playerLocationAttachments || []) {
    if (attachment.code !== '03232' || attachment.location !== inv.location || attachment.exhausted) continue
    for (const destination of new Set(loc?.connections || [])) {
      if (!locationExists(state, destination) || investigatorEntryError(state, destination)) continue
      moves.push({ action: 'shortcutMove', locationId: destination,
        label: `🏃 捷径：移动到「${locName(state, destination)}」` })
    }
  }
  for (const { code, rule } of activeHiddenRules(state, inv)) {
    const discard = rule.discard
    if (!discard || inv.resources < (discard.resources || 0)) continue
    if (discard.damageInvestigator) {
      for (const target of aliveInvestigators(state).filter(other => other.location === inv.location)) {
        moves.push({ action: 'hiddenAction', cardId: code, targetSeat: target.seat,
          label: `隐私牌「${cardName(code)}」：对${target.name}造成${discard.damageInvestigator}点伤害并弃掉` })
      }
    } else {
      moves.push({ action: 'hiddenAction', cardId: code,
        label: `弃掉隐私牌「${cardName(code)}」${discard.resources ? `（支付${discard.resources}资源）` : ''}` })
    }
  }

  const blocked = cannotPlayTypes(inv)
  for (const code of unique(inv.hand)) {
    const def = cardDef(code)
    if (!def || !runtimeCardAvailable(state, inv, code) || def.dataStatus === 'quarantined' || def.type === 'skill' || (isWeaknessCard(def) && !EFFECTS[code]?.playableWeakness)) continue
    if (!lolaCanUseCard(inv, code)) continue
    if (scenarioBehavior(state).canPlayCard?.(state, inv, def) === false) continue
    if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) continue
    if (blocked.has(def.type)) continue
    if (code === '03012') {
      for (const copyCode of inv.beneath || []) {
        const copy = cardDef(copyCode), effect = EFFECTS[copyCode]
        if (!copy || copy.type !== 'event' || copy.exceptional || !effect?.event || effect.reaction) continue
        const cost = playCost(state, inv, copy)
        if (inv.resources < cost || effectError(state, inv, effect.event)) continue
        moves.push({ action: 'play', cardId: code, copyCode,
          label: `🃏 彩绘世界复制「${cardName(copyCode)}」(${cost} 资源)` })
      }
      continue
    }
    const cost = playCost(state, inv, def)
    if (inv.resources < cost && !charlesPayCandidate(state, inv, cost)) continue
    if (EFFECTS[code]?.firstActionOnly && (inv.actionsTakenThisTurn || 0) > 0) continue
    if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) continue
    const kindLabel = def.type === 'asset' ? '装备' : '打出'
    moves.push({ action: 'play', cardId: code, label: `🃏 ${kindLabel}「${cardName(code)}」(${cost} 资源)` })
  }

  if (inv.assets.some(asset => asset.code === '01014') && inv.discard.length) {
    const code = topDiscardEvent(state, inv)
    const def = cardDef(code)
    if (def && def.type === 'event' && isCardAvailable(code) && !isWeaknessCard(def)
        && !blocked.has(def.type) && inv.resources >= playCost(state, inv, def)
        && !effectError(state, inv, EFFECTS[code]?.event)) {
      moves.push({ action: 'play', cardId: code, fromDiscard: true, label: `🃏 温蒂的护身符：打出弃牌堆顶事件「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
    }
  }

  for (const plan of inv.assets.filter(asset => asset.code === '03264' && !asset.exhausted)) {
    for (const code of unique(plan.attached || [])) {
      const def = cardDef(code)
      const effect = EFFECTS[code]
      if (!def || def.type !== 'event' || effect?.reaction || blocked.has(def.type)
          || !runtimeCardAvailable(state, inv, code) || inv.resources < playCost(state, inv, def)
          || effectError(state, inv, effect?.event)) continue
      moves.push({ action: 'play', cardId: code, fromPlanAssetId: plan.id,
        label: `🃏 原定计划：打出「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
    }
  }

  moves.push({ action: 'draw', label: '🀄 抽 1 张牌' })
  if (scenarioBehavior(state).canGainResources?.(state, inv) !== false) moves.push({ action: 'resource', label: '💰 获得 1 资源' })

  const skids = INVESTIGATOR_ABILITIES[inv.code]
  if (skids && skids.freeAction && !investigatorTextBlanked(state, inv) && inv.resources >= (skids.freeAction.cost.resources || 0)
    && (skids.freeAction.repeatable || !inv.usedReactions[skids.freeAction.id + ':' + state.round])) {
    moves.push({ action: 'freeAction', label: skids.freeAction.label || '⚡ 花 2 资源获得 1 额外行动' })
  }

  for (const nb of new Set(loc && !movementError(state, inv) ? loc.connections : [])) {
    const target = state.locations.find((l) => l.id === nb)
    if (!target || investigatorEntryError(state, nb)) continue
    moves.push({ action: 'move', locationId: nb, label: `🚶 移动到「${target.name}」（线索 ${target.clues}${target.locked ? '，上锁' : ''}）` })
  }

  if (loc && loc.clues > 0 && !loc.locked && !scenarioBehavior(state).investigationError?.(state, inv, loc)) {
    const skill = loc.investigateSkill || 'intellect'
    moves.push({ action: 'investigate', label: `🔍 调查「${loc.name}」（${SKILL_NAMES[skill]} vs 帷幕 ${loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0)}）` })
  }

  if (loc && loc.ability && locationAbilityAvailable(state, loc, inv)
    && !activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotTriggerLocationAbilities)) {
    moves.push({ action: 'locationAbility', locationId: loc.id, label: `📍 ${loc.ability.label}` })
  }

  for (const enemy of state.enemies.filter(enemy => enemy.location === inv.location)) {
    if ((enemy.code !== '02255' || enemyTextBlanked(state, enemy)) && !hiddenFightBlocked(state, inv, enemy))
      moves.push({ action: 'fight', enemyId: enemy.id, label: `⚔️ 攻击「${enemy.name}」（战斗 vs ${enemyFightValue(state, enemy, inv)}${enemy.retaliate ? '，反击' : ''}）` })
    if (scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) !== false)
      moves.push({ action: 'evade', enemyId: enemy.id, label: `💨 躲避「${enemy.name}」（敏捷 vs ${enemyEvadeValue(state, enemy, inv)}）` })
    if (enemy.parleyCost && inv.resources >= enemy.parleyCost) {
      moves.push({ action: 'parley', enemyId: enemy.id, label: `🤝 谈判「${enemy.name}」（花 ${enemy.parleyCost} 资源弃掉）` })
    }
    if (!enemy.massive && enemy.engagedSeat !== seat) {
      moves.push({ action: 'engage', enemyId: enemy.id, label: `与「${enemy.name}」交战` })
    }
    // 谈判盘问独特异教徒。
    const def = enemyDef(enemy.code)
    if (def && def.parley && canParleyCultist(state, inv, def.parley.cost)) {
      moves.push({ action: 'parleyCultist', enemyId: enemy.id, label: `🤝 ${def.parley.label}「${enemy.name}」` })
    }
  }

  // 午夜假面场景 1：抽异教徒牌堆。
  if (scenarioBehavior(state).drawCultistActIndex === state.actIndex && groupClues(state) >= 2 * state.numInvestigators && state.cultistDeck.length) {
    moves.push({ action: 'drawCultist', scriptCard: 'act', label: `🕵️ 抽取异教徒牌堆（花 ${2 * state.numInvestigators} 线索）` })
  }

  // 地底噬魔场景 3：破坏仪式。
  if (scenarioBehavior(state).interruptRitualActIndex === state.actIndex && state.clues >= 1) {
    moves.push({ action: 'interruptRitual', scriptCard: 'act', skill: 'willpower', label: '📜 破坏仪式（意志 3，花 1 线索）' })
    moves.push({ action: 'interruptRitual', scriptCard: 'act', skill: 'agility', label: '📜 破坏仪式（敏捷 3，花 1 线索）' })
  }

  // 地底噬魔：献祭丽塔（结局 3）。这是乌默尔多斯卡面上的行动，绑定到该敌人。
  const umordhoth = scenarioBehavior(state).sacrificeLita
    && state.enemies.find(e => e.code === 'umordhoth' && e.location === inv.location)
  if (umordhoth && inv.assets.some(asset => asset.code === '01117')) {
    moves.push({ action: 'sacrificeLita', enemyId: umordhoth.id, label: '😱 献祭丽塔·钱德勒（→ 结局 3）' })
  }

  // 上锁的门：破门。
  if (loc && loc.locked) {
    moves.push({ action: 'breakDoor', skill: 'combat', label: '🔓 破门（战斗 4）' })
    moves.push({ action: 'breakDoor', skill: 'agility', label: '🔓 破门（敏捷 4）' })
  }
  if (loc?.searchingForIzzieSeat != null) moves.push({ action: 'searchIzzie', label: '🔎 寻找伊兹（花 2 行动，调查）' })

  // 客厅谈判丽塔。
  if (loc && loc.parley && litaUncontrolled(state)
      && (state.storyAssets || []).some(asset => asset.code === '01117' && asset.location === inv.location)) {
    moves.push({ action: 'parleyLita', label: '🤝 谈判丽塔·钱德勒（智识 4，取得控制权）' })
  }

  for (const a of controlledAbilityCards(inv)) {
    const eff = assetEffect(inv, a)
    if (!eff || !eff.abilities) continue
    if (!lolaCanUseCard(inv, a.code)) continue
    eff.abilities.forEach((ab, i) => {
      if (!canAffordAbility(inv, a, ab)) return
      if (ab.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return
      if (ab.requiresNoClues && loc && loc.clues > 0) return
      const free = ab.cost && ab.cost.action === false
      if (free && cannotTriggerFreeAbility(state, inv)) return
      const prefix = free ? '⚡免费 ' : tomeActionEligible(state, inv, { action: 'ability', assetId: a.id, abilityIndex: i }) ? '[书籍额外行动] ' : ''
      if (ab.effect?.type === 'fight' && !abilityTargets(state, inv, ab.effect).length) return
      if (ab.effect && (ab.effect.type === 'investigate' || ab.effect.type === 'discoverClue') && (!loc || loc.clues <= 0)) return
      if (ab.effect && ab.effect.type === 'dealDamage' && abilityTargets(state, inv, ab.effect).length === 0) return
      const base = { action: 'ability', assetId: a.id, abilityIndex: i }
      // choose 分支：每个选项拆成一条独立行动（optionIndex 从 0 起）。
      if (ab.effect && ab.effect.type === 'chooseOne' && Array.isArray(ab.effect.options)) {
        ab.effect.options.forEach((opt, oi) => {
          moves.push({ ...base, optionIndex: oi, label: `${prefix}${opt.label || ab.label}（选项 ${oi + 1}）` })
        })
        return
      }
      // Explicit targets also let the table point an ability at its sole legal enemy.
      const targets = abilityTargets(state, inv, ab.effect)
      if (targets.length > 0) {
        for (const t of targets) {
          moves.push({ ...base, targetId: t.id, label: `${prefix}${ab.label} → ${t.name}` })
        }
        return
      }
      moves.push({ ...base, label: `${prefix}${ab.label}` })
    })
  }

  for (const t of availableThreatAbilities(state, inv)) {
    const th = getThreatEffect(t)
    if (th && th.discardCost) {
      moves.push({ action: 'discardThreat', threatId: t.id, label: `♻️ 弃掉「${cardName(t.code)}」（花 ${th.discardCost.action} 行动）` })
    }
    if (th && th.purgeAbility && (t.counters || 0) > 0) {
      moves.push({ action: 'purgeThreat', threatId: t.id, label: `📖 净化「${cardName(t.code)}」（移走 1 恐惧）` })
    }
    if (th && th.debt && inv.threat.includes(t) && inv.resources > 0 && (t.debtPaymentsThisRound || 0) < 2) {
      moves.push({ action: 'payDebt', threatId: t.id, label: `💸 向医院债务支付 1 资源（每轮至多 2 次）` })
    }
  }

  if (canAdvanceWithClues(state)) moves.push({ action: 'advanceAct', scriptCard: 'act', label: '共同支付线索推进场景' })
  moves.push({ action: 'endTurn', label: '⏭️ 结束回合' })
  // scriptCard 标出行动来自当前场景或密谋，牌桌据此把按钮放在剧本书旁。
  // 不依赖地点的撤退由密谋赋予（如《午夜假面》两张密谋的 [action]：撤退）。
  if (loc && loc.resign) moves.push({ action: 'resign', locationId: loc.id, label: '🏳️ 撤退' })
  else if (state.scenario.resignAnywhere) moves.push({ action: 'resign', scriptCard: 'agenda', label: '🏳️ 撤退' })

  return moves.filter(move => validateMove(state, seat, move) === null)
}

function effectError(state, inv, effect) {
  const definition = effectDefinitionError(effect)
  if (definition || !effect) return definition
  if (effect.type === 'readyAsset' && !inv.assets.some(a => a.exhausted)) return '没有需要重整的支援'
  if (effect.type === 'heal' && !(effect.what === 'horror' ? inv.horror > 0 : effect.what === 'both' ? inv.damage > 0 || inv.horror > 0 : inv.damage > 0)) return '没有可治疗的伤害或恐惧'
  if (effect.type === 'healDamageAtLocation' && !damagedTargetsAtLocation(state, inv.seat).length) return '同地点没有可治疗的调查员或盟友'
  if (effect.type === 'evade' && effect.allAtLocation) {
    if (!state.enemies.some(enemy => enemy.location === inv.location)) return '这里没有可躲避的敌人'
  } else if (['fight', 'evade', 'dealDamage'].includes(effect.type) && !abilityTargets(state, inv, effect).length) return '没有合法敌人目标'
  if (effect.type === 'chooseOne' && effect.options.every(option => effectError(state, inv, option.effect))) return '没有可执行的效果选项'
  if (effect.type === 'investigate') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.locked || loc.clues <= 0) return '这里不能调查'
  }
  if (effect.type === 'discoverClue') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.clues <= 0) return '这里没有线索'
  }
  if (effect.type === 'reloadAmmo') {
    const roots = aliveInvestigators(state).filter(item => item.location === inv.location)
    const hasTarget = roots.some(owner => owner.assets.some(asset => {
      const eff = assetEffect(inv, asset)
      if (!eff || eff.uses == null || (eff.usesType || 'charges') !== 'ammo') return false
      if (effect.trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(effect.trait).toLowerCase())) return false
      return true
    }))
    if (!hasTarget) return '这里没有可装填的枪械'
  }
  if (effect.type === 'rechargeAsset') {
    const hasTarget = inv.assets.some(asset => {
      const eff = assetEffect(inv, asset)
      if (!eff || eff.uses == null) return false
      if (effect.trait && !(cardDef(asset.code)?.traits || []).some(item => String(item).toLowerCase() === String(effect.trait).toLowerCase())) return false
      return true
    })
    if (!hasTarget) return '没有可充能的法术支援'
  }
  if (effect.type === 'search' && !inv.deck.length) return '牌库中没有可搜索的牌'
  if (effect.type === 'searchTop' && !inv.deck.length) return '牌库中没有可搜索的牌'
  if (effect.type === 'investigateForResources') {
    const loc = state.locations.find(item => item.id === inv.location)
    if (!loc || loc.locked) return '这里不能调查'
  }
  if (effect.type === 'moveTo') {
    if (!investigatorMoveDestinations(state, inv.seat, effect).length) return '没有可移动的地点'
  }
  if (effect.type === 'dealDamageAll') {
    const locations = effect.location === 'choice'
      ? [inv.location, ...((state.locations.find(item => item.id === inv.location)?.connections) || [])]
      : [inv.location]
    const hasTarget = state.enemies.some(enemy => locations.includes(enemy.location))
      || (effect.investigators && aliveInvestigators(state).some(item => locations.includes(item.location)))
    if (!hasTarget) return '这里没有可造成伤害的目标'
  }
  if (effect.type === 'dealDamageExhausted' && !state.enemies.some(enemy => enemy.location === inv.location && enemy.exhausted)) return '这里没有已横置的敌人'
  if (effect.type === 'blankEnemy' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite)) return '这里没有非精英敌人'
  if (effect.type === 'autoEvadeNonElite' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite)) return '这里没有非精英敌人'
  if (effect.type === 'shuffleIntoEncounter' && !state.enemies.some(enemy => enemy.location === inv.location && !enemy.elite && !isWeaknessCode(enemy.code))) return '这里没有可洗回遭遇牌库的敌人'
  if (effect.type === 'returnAssetToHand' && effect.assetId && !inv.assets.some(asset => asset.id === effect.assetId)) return '未找到要返回手牌的资产'
  if (effect.type === 'carcosaInvestigator' && effect.action === 'spiritSpeaker'
    && !inv.assets.some(asset => isChargeAsset(asset) && !assetCannotLeavePlay(asset))) return '没有可选择的充能支援'
  if (effect.type === 'carcosaInvestigator' && effect.action === 'angeredSpirits'
    && !inv.assets.some(asset => !asset.exhausted && isChargeAsset(asset) && (asset.uses || 0) > 0
      && (cardDef(asset.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'spell'))) return '没有可移动充能的法术支援'
  if (effect.type === 'carcosaInvestigator' && effect.action === 'yorickPlayAsset'
    && (discardLocked(state, inv) || !inv.discard.some(code => {
      const def = cardDef(code)
      return def?.type === 'asset' && !isWeaknessCard(def) && inv.resources >= playCost(state, inv, def)
        && assetReplacementPlans(inv, def).length > 0
    }))) return '弃牌堆中没有可打出的支援'
  if (effect.type === 'carcosaInvestigator' && effect.action === 'sefinaDrawBeneath' && !inv.beneath?.length) return '赛菲娜下方没有事件'
  if (effect.type === 'targetedEffect' && effect.effect) {
    const targets = aliveInvestigators(state).filter(other => effect.target === 'self' ? other.seat === inv.seat : effect.target === 'location' ? other.location === inv.location : true)
      .filter(other => !effect.activeTurnOnly || (state.phase === 'investigation' && other.seat === state.currentSeat && !other.turnEnded))
    if (!targets.some(other => !effectError(state, other, effect.effect))) return '没有合法调查员目标'
  }
  return null
}

function playCost(state, inv, def) {
  const discount = inv.location === 'easttown' && def.type === 'asset' && (def.traits || []).some(trait => trait.toLowerCase() === 'ally') ? 2 : 0
  const factions = def.factions || [def.klass, def.klass2, def.klass3].filter(Boolean)
  const lola = inv.lolaDiscount?.round === state.round && inv.lolaDiscount?.turnSeat === state.currentSeat
    && factions.includes(inv.lolaDiscount.role) ? inv.lolaDiscount.amount : 0
  const carcosa = inv.carcosaPlayDiscount || 0
  const threatIncrease = inv.threat.reduce((sum, threat) =>
    sum + (getThreatEffect(threat)?.playCostIncrease || 0), 0)
  const loc = state.locations.find(location => location.id === inv.location)
  const locationIncrease = loc?.playCostIncrease || 0
  const charles = itemDiscountAtLocation(state, inv, def)
  return Math.max(0, (def.cost || 0) - discount - lola - carcosa + threatIncrease + locationIncrease - charles)
}

function itemDiscountAtLocation(state, inv, def) {
  if (!def || def.type !== 'asset') return 0
  if (!(def.traits || []).some(trait => String(trait).toLowerCase() === 'item')) return 0
  const holder = state.investigators.find(other => other.location === inv.location
    && other.assets.some(asset => asset.code === '03149' && asset.itemDiscountAtLocation
      && asset.itemDiscountAtLocation.round === state.round
      && asset.itemDiscountAtLocation.phase === state.phase))
  if (!holder) return 0
  const asset = holder.assets.find(item => item.code === '03149' && item.itemDiscountAtLocation
    && item.itemDiscountAtLocation.round === state.round && item.itemDiscountAtLocation.phase === state.phase)
  return asset?.itemDiscountAtLocation?.amount || 1
}

function consumeItemDiscountAtLocation(state, inv) {
  for (const other of state.investigators.filter(item => item.location === inv.location)) {
    for (const asset of other.assets.filter(item => item.code === '03149' && item.itemDiscountAtLocation)) {
      if (asset.itemDiscountAtLocation.round === state.round && asset.itemDiscountAtLocation.phase === state.phase) {
        delete asset.itemDiscountAtLocation
        return true
      }
    }
  }
  return false
}

function charlesPayCandidate(state, inv, cost) {
  return state.investigators.find(other => other !== inv && other.location === inv.location
    && !other.defeated && !other.resigned && other.resources >= cost
    && other.assets.some(asset => asset.code === '03149')) || null
}

function tomeActionEligible(state, inv, move) {
  if (!INVESTIGATOR_ABILITIES[inv.code]?.extraTomeAction || investigatorTextBlanked(state, inv) || inv.tomeActionUsed
      || state.phase !== 'investigation' || state.currentSeat !== inv.seat) return false
  let source
  if (move.action === 'ability') {
    source = controlledAbilityCard(inv, move.assetId)
    const ability = EFFECTS[source?.code]?.abilities?.[move.abilityIndex]
    if (!ability || ability.cost?.action === false || ability.cost?.action === 0) return false
  } else if (move.action === 'purgeThreat') {
    source = inv.threat.find(item => item.id === move.threatId)
    if (!getThreatEffect(source)?.purgeAbility) return false
  } else return false
  return (cardDef(source?.code)?.traits || []).some(trait => trait.toLowerCase() === 'tome')
}

function actionCost(state, inv, move, applyTome = true) {
  if (['endTurn', 'advanceAct', 'shortcutMove'].includes(move.action)) return 0
  if (move.action === 'freeAction') return INVESTIGATOR_ABILITIES[inv.code]?.freeAction?.actionCost || 0
  let cost = 1
  if (move.action === 'investigate' && state.locations.find(loc => loc.id === inv.location)?.originalCode === '02050') cost++
  if (move.action === 'searchIzzie') cost = 2
  if (move.action === 'hiddenAction') cost = hiddenRule(state, move.cardId)?.discard?.actions ?? 1
  if (move.action === 'scenarioAction') cost = scenarioBehavior(state).actions?.(state, inv).find(m => m.rule === move.rule)?.actions ?? 1
  if (move.action === 'encounterAction') cost = scenarioBehavior(state).encounterActions?.(state, inv).find(m => m.rule === move.rule)?.actions ?? 1
  let kind = actionKind(state, inv, move)
  if (move.action === 'discardThreat') {
    const threat = availableThreatAbilities(state, inv).find(item => item.id === move.threatId)
    cost = getThreatEffect(threat)?.discardCost?.action ?? 1
  }
  if (move.action === 'ability') {
    const asset = controlledAbilityCard(inv, move.assetId)
    const ability = EFFECTS[asset?.code]?.abilities?.[move.abilityIndex]
    cost = ability?.cost?.action === false ? 0 : typeof ability?.cost?.action === 'number' ? ability.cost.action : 1
    kind = ability?.effect?.type
  }
  if (move.action === 'play' && EFFECTS[move.copyCode || move.cardId]?.fast) cost = 0
  if (cost) cost += unpaidExtraActionThreats(state, inv, kind).length
  if (applyTome && cost > 0 && tomeActionEligible(state, inv, move)) cost--
  return cost
}

function canParleyCultist(state, inv, cost) {
  if (!cost) return false
  if (cost.clues && !canSpendClues(state, inv)) return false
  if (cost.clues && inv.clues < cost.clues) return false
  if (cost.resources && inv.resources < cost.resources) return false
  if (cost.discardHand && inv.hand.filter(code => !isWeaknessCode(code) && canDiscardFromHand(inv, code)).length < cost.discardHand) return false
  return true
}

function litaControlled(state, seat = null) {
  return state.investigators.some(inv => !inv.defeated && !inv.resigned
    && (seat == null || inv.seat === seat) && inv.assets.some(asset => asset.code === '01117'))
}

function litaUncontrolled(state, locationId = null) {
  return state.actIndex === scenarioBehavior(state).litaParleyActIndex && !litaControlled(state)
    && (state.storyAssets || []).some(asset => asset.code === '01117' && asset.controllerSeat == null
      && (locationId == null || asset.location === locationId))
}

function unique(arr) {
  return [...new Set(arr)]
}

// 资产能力成本是否可支付（不判定行动点，仅看资源/充能/横置）。
function canAffordAbility(inv, asset, ability) {
  const cost = ability.cost || {}
  if (cost.exhaust && asset.exhausted) return false
  if (cost.uses && (asset.uses || 0) < cost.uses) return false
  if (cost.resources && inv.resources < cost.resources) return false
  if (cost.discardHand && discardableHandCards(inv, cost.discardHandIcon).length < cost.discardHand) return false
  if (cost.damageSelf && inv.damage + cost.damageSelf >= inv.health) return false
  if (ability.maximumInvestigatorDamage != null && inv.damage > ability.maximumInvestigatorDamage) return false
  return true
}

// 资产能力效果的可选目标敌人（用于目标选择拆分）。
function abilityTargets(state, inv, effect) {
  if (!effect) return []
  if (effect.type === 'dealDamage') {
    if (effect.target === 'here') return state.enemies.filter((e) => e.location === inv.location)
    return enemiesEngagedWith(state, inv) // 'engaged' 或默认交战
  }
  if (effect.type === 'fight') return state.enemies.filter(enemy => enemy.location === inv.location
    && (!effect.requireNotEngagedTarget || enemy.engagedSeat !== inv.seat)
    && (enemy.code !== '02255' || enemyTextBlanked(state, enemy))
    && !hiddenFightBlocked(state, inv, enemy))
  if (effect.type === 'evade') return enemiesEngagedWith(state, inv)
  return []
}

// 把 targetId（敌人 id）注入到能力效果，供效果解释器定向结算。
function applyAbilityTarget(effect, targetId) {
  if (!effect) return effect
  if (effect.type === 'dealDamage') return { ...effect, target: 'id:' + targetId }
  if (effect.type === 'fight' || effect.type === 'evade') return { ...effect, enemyId: targetId }
  return effect
}

function describePrey(prey) {
  const map = {
    bearer: '持有者',
    highestCombat: '战斗最高者',
    lowestHealth: '生命最低者',
    mostClues: '线索最多者',
    mostHorror: '恐惧最多者',
    lowestSanity: '理智最低者',
    lowestAgility: '敏捷最低者',
    lowestCombat: '战斗最低者',
    fewestHand: '手牌最少者',
  }
  return map[prey] || prey
}

// 汇总当前调查员可用的「免费能力」（异能 / 免费资产能力 / 天赋牌），供 describeState 展示。
function describeFreeAbilities(state, inv) {
  if (cannotTriggerFreeAbility(state, inv)) return []
  const out = []
  const ab = INVESTIGATOR_ABILITIES[inv.code] || {}
  if (ab.freeAction) {
    const cost = ab.freeAction.cost || {}
    if (inv.resources >= (cost.resources || 0) && !inv.usedReactions[ab.freeAction.id + ':' + state.round]) {
      out.push('⚡异能「花 ' + (cost.resources || 0) + ' 资源 +1 行动」')
    }
  }
  for (const a of controlledAbilityCards(inv)) {
    const eff = assetEffect(inv, a)
    if (!eff) continue
    if (!lolaCanUseCard(inv, a.code)) continue
    if (eff.freeTriggers && !a.exhausted) {
      const skills = eff.freeTriggers.map((ft) => SKILL_NAMES[ft.skill] + '+' + (ft.bonus || 1) + '(花' + ((ft.cost && ft.cost.resources) || 0) + '资源)').join('、')
      out.push('天赋「' + cardName(a.code) + '」检定前自动 ' + skills)
    }
    if (eff.abilities) {
      eff.abilities.forEach((ability) => {
        if (ability.cost && ability.cost.action === false && canAffordAbility(inv, a, ability)) {
          out.push('免费能力「' + cardName(a.code) + '」' + ability.label)
        }
      })
    }
  }
  return out
}

// 当前场景/密谋卡面赋予的行动提示，不论此刻能否执行都列出，并给出不可执行的原因。
// 牌桌据此常驻显示剧本行动按钮；真正执行仍只走 legalMoves/validateMove。
export function scriptActionHints(state, seat) {
  if (state.status !== 'playing' || inHub(state) || !state.scenario) return []
  const inv = state.investigators.find(item => item.seat === seat)
  if (!inv || inv.defeated || inv.resigned) return []
  const behavior = scenarioBehavior(state), hints = []
  if (behavior.drawCultistActIndex === state.actIndex) {
    const cost = 2 * state.numInvestigators
    hints.push({ action: 'drawCultist', scriptCard: 'act', label: `抽取异教徒牌堆（调查员共同花费 ${cost} 线索）`,
      reason: !state.cultistDeck.length ? '异教徒牌堆已空' : groupClues(state) < cost ? `需要调查员共同花费 ${cost} 个线索` : null })
  }
  if (behavior.interruptRitualActIndex === state.actIndex) {
    for (const [skill, name] of [['willpower', '意志'], ['agility', '敏捷']])
      hints.push({ action: 'interruptRitual', skill, scriptCard: 'act', label: `破坏仪式（${name} 3，花 1 线索）`, reason: inv.clues < 1 ? '需要花费 1 个线索' : null })
  }
  if (state.scenario.resignAnywhere) hints.push({ action: 'resign', scriptCard: 'agenda', label: '撤退', reason: null })
  hints.push(...(behavior.scriptActions?.(state, inv) || []))
  const choice = state.pendingChoice
  return hints.map(({ reason, ...move }) => ({ ...move,
    reason: reason || (choice ? (choice.kind === 'turnOrder' && choiceSeats(choice).includes(seat) ? '先点击「开始行动」' : '等待当前选择结算')
      : seat !== state.currentSeat ? '尚未轮到你行动' : validateMove(state, seat, move)) || null }))
}

export function validateMove(state, seat, move) {
  const compatibility = stateCompatibilityError(state, META.resourceVersion)
  if (compatibility) return compatibility
  if (!move || Array.isArray(move) || typeof move.action !== 'string') return '无效行动'
  if (!Number.isInteger(seat) || !actingSeats(state).includes(seat)) return '现在不是你的应答时机'
  if (Object.hasOwn(move, 'revision') && (!Number.isSafeInteger(move.revision) || move.revision !== state.revision)) return '对局版本已过期'
  if (state.status !== 'playing') return '对局已结束'
  if (state.pendingChoice) return choiceError(state, seat, move)
  if (inHub(state)) return validateHubMove(state, seat, move)
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return '你已经败退'
  if (inv.actionsLeft < actionCost(state, inv, move)) return '行动点不足'

  switch (move.action) {
    case 'scenarioAction': return scenarioBehavior(state).actions?.(state, inv).some(m => m.rule === move.rule)
      ? null : '当前不能执行此剧本行动'
    case 'encounterAction': return scenarioBehavior(state).encounterActions?.(state, inv).some(m => m.rule === move.rule)
      ? null : '当前不能执行此遭遇卡行动'
    case 'play': {
      const def = cardDef(move.cardId)
      if (!def) return '未知卡牌'
      if (!lolaCanUseCard(inv, move.cardId)) return '罗拉只能使用中立或当前角色阵营的卡牌'
      if (scenarioBehavior(state).canPlayCard?.(state, inv, def) === false) return '此地点不能打出该卡牌'
      if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) return '隐私牌禁止你打出该类型卡牌'
      const effect = EFFECTS[move.cardId]
      if (def.permanent) return '永久卡在开局时入场'
      if (effect?.requiresClueAtLocation && !state.locations.some(l => l.id === inv.location && l.clues > 0)) return '当前地点没有线索'
      if (effect?.requiresClue && inv.clues < 1) return '需要至少 1 个线索才能打出'
      if (effect?.requiresRemainingSanity != null
        && getMaxSanity(inv) - inv.horror < effect.requiresRemainingSanity) {
        return `剩余神志不足 ${effect.requiresRemainingSanity} 点`
      }
      if (effect?.firstActionOnly && (inv.actionsTakenThisTurn || 0) > 0) return '只能作为本回合的第一个行动打出'
      if (effect?.requiresNoEnemies && state.enemies.some(e => e.location === inv.location)) return '当前地点有敌人'
      if (effect?.ownTurnOnly && (state.phase !== 'investigation' || state.currentSeat !== seat)) return '只能在自己的回合打出'
      if (effect?.duringOwnTurn && (state.phase !== 'investigation' || state.currentSeat !== seat)) return '只能在自己的回合打出'
      if (effect?.requiresResign && !scenarioResignAvailable(state)) return '场上没有带「撤退」能力的剧本卡'
      if (!runtimeCardAvailable(state, inv, move.cardId) || def.dataStatus === 'quarantined') return '该卡牌未获运行时许可'
      if (move.cardId === '03012') {
        const copied = cardDef(move.copyCode), copiedEffect = EFFECTS[move.copyCode]
        if (!inv.beneath?.includes(move.copyCode) || !copied || copied.type !== 'event' || copied.exceptional
          || !copiedEffect?.event || copiedEffect.reaction) return '彩绘世界没有合法的复制事件'
        if (!inv.hand.includes(move.cardId)) return '手牌中没有彩绘世界'
        if (inv.resources < playCost(state, inv, copied)) return '资源不足'
        return effectError(state, inv, copiedEffect.event)
      }
      if (def.type === 'skill' || (isWeaknessCard(def) && !EFFECTS[move.cardId]?.playableWeakness)) return '该牌不能作为行动打出'
      if (move.fromDiscard) {
        if (!inv.assets.some(asset => asset.code === '01014')) return '你没有温蒂的护身符'
        if (def.type !== 'event' || topDiscardEvent(state, inv) !== move.cardId) return '不是弃牌堆中最上方的事件'
      } else if (move.fromPlanAssetId) {
        const plan = inv.assets.find(asset => asset.id === move.fromPlanAssetId && asset.code === '03264')
        if (!plan || plan.exhausted || !plan.attached?.includes(move.cardId) || def.type !== 'event') return '原定计划下没有可打出的这张事件'
      } else if (!inv.hand.includes(move.cardId)) return '手牌中没有这张牌'
      if (EFFECTS[move.cardId]?.reaction) return '该牌只能在对应的反应窗口打出'
      if (cannotPlayTypes(inv).has(def.type)) return '当前禁止打出该类型卡牌'
      if (inv.resources < playCost(state, inv, def)
        && !charlesPayCandidate(state, inv, playCost(state, inv, def))) return '资源不足'
      if (def.unique && state.investigators.some(item => item.assets.some(asset => cardDef(asset.code)?.name === def.name))) return '唯一资产已经在场'
      if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) return '槽位已满'
      return effectError(state, inv, EFFECTS[move.cardId]?.event)
    }
    case 'draw': return null
    case 'resource': return scenarioBehavior(state).canGainResources?.(state, inv) === false ? '此地点不能获得资源' : null
    case 'freeAction': {
      const skids = INVESTIGATOR_ABILITIES[inv.code]
      if (!skids || !skids.freeAction || investigatorTextBlanked(state, inv)) return '你没有该异能'
      if (cannotTriggerFreeAbility(state, inv)) return '隐私牌禁止你触发免费能力'
      if (inv.resources < (skids.freeAction.cost.resources || 0)) return '资源不足'
      if (skids.freeAction.cost.discardHand
        && !inv.hand.some(code => !isWeaknessCode(code) && canDiscardFromHand(inv, code))) return '没有可弃掉的手牌'
      if (effectError(state, inv, skids.freeAction.effect)) return effectError(state, inv, skids.freeAction.effect)
      if (!skids.freeAction.repeatable && inv.usedReactions[skids.freeAction.id + ':' + state.round]) return '本回合已使用'
      return null
    }
    case 'hiddenAction': {
      const rule = hiddenRule(state, move.cardId)
      const discard = rule?.discard
      if (!discard || !hasHiddenCard(inv, move.cardId)) return '手牌中没有该隐私牌'
      if (inv.resources < (discard.resources || 0)) return '资源不足'
      if (discard.damageInvestigator && !state.investigators.some(other => other.seat === move.targetSeat
        && !other.defeated && !other.resigned && other.location === inv.location)) return '隐私牌没有合法的伤害目标'
      return null
    }
    case 'parley': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy || enemy.engagedSeat !== seat) return '该敌人未与你交战'
      if (!enemy.parleyCost || inv.resources < enemy.parleyCost) return '无法谈判（资源不足）'
      return null
    }
    case 'parleyCultist': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy || !enemy.uniqueCultist) return '该敌人不可谈判'
      if (enemy.location !== inv.location || enemyTextBlanked(state, enemy)) return '该敌人不在此处或谈判能力已失效'
      const def = enemyDef(enemy.code)
      if (!def || !def.parley) return '该敌人不可谈判'
      if (!canParleyCultist(state, inv, def.parley.cost)) return '谈判成本不足'
      return null
    }
    case 'parleyLita': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || !loc.parley) return '这里不能谈判'
      if (!litaUncontrolled(state)) return '丽塔尚未入场或已被控制'
      if (!(state.storyAssets || []).some(asset => asset.code === '01117' && asset.location === inv.location)) return '丽塔不在你所在的地点'
      return null
    }
    case 'drawCultist': {
      if (scenarioBehavior(state).drawCultistActIndex !== state.actIndex) return '现在不能抽取异教徒牌堆'
      if (groupClues(state) < 2 * state.numInvestigators) return '线索不足'
      if (!state.cultistDeck.length) return '异教徒牌堆已空'
      return null
    }
    case 'interruptRitual': {
      if (scenarioBehavior(state).interruptRitualActIndex !== state.actIndex) return '现在不能破坏仪式'
      if (inv.clues < 1) return '需要 1 个线索'
      return null
    }
    case 'sacrificeLita': {
      if (!scenarioBehavior(state).sacrificeLita) return '当前剧本不能献祭丽塔'
      const boss = state.enemies.find(e => e.code === 'umordhoth')
      if (!boss) return '乌默尔多斯尚未降临'
      if (boss.location !== inv.location) return '乌默尔多斯不在你所在的地点'
      if (!inv.assets.some(asset => asset.code === '01117')) return '你没有控制丽塔·钱德勒'
      return null
    }
    case 'breakDoor': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || !loc.locked) return '这里没有上锁的门'
      return null
    }
    case 'discardThreat': {
      const t = availableThreatAbilities(state, inv).find(card => card.id === move.threatId)
      if (!t || !getThreatEffect(t)?.discardCost) return '该威胁没有弃置能力'
      return null
    }
    case 'purgeThreat': {
      const t = inv.threat.find((x) => x.id === move.threatId)
      if (!t || (t.counters || 0) <= 0) return '无法净化'
      return null
    }
    case 'payDebt': {
      const t = inv.threat.find((x) => x.id === move.threatId)
      if (!t || !getThreatEffect(t)?.debt) return '没有该债务'
      if (inv.resources <= 0) return '资源不足'
      if ((t.debtPaymentsThisRound || 0) >= 2) return '本轮已支付两次'
      return null
    }
    case 'locationAbility': {
      const loc = state.locations.find((l) => l.id === move.locationId)
      if (!loc || !loc.ability) return '该地点没有可用能力'
      if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotTriggerLocationAbilities)) return '隐私牌禁止你触发地点能力'
      if (!locationAbilityAvailable(state, loc, inv)) return '该地点能力当前不可用'
      const abilityError = effectError(state, inv, loc.ability.effect)
      if (abilityError) return abilityError
      return null
    }
    case 'shortcutMove': {
      const loc = state.locations.find((l) => l.id === inv.location)
      const attachment = (state.playerLocationAttachments || []).find(item =>
        item.code === '03232' && item.location === inv.location && !item.exhausted)
      if (!attachment) return '这里没有可用的「捷径」'
      if (!loc || !loc.connections.includes(move.locationId)) return '不能移动到该地点'
      return movementError(state, inv) || investigatorEntryError(state, move.locationId)
    }
    case 'move': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || !loc.connections.includes(move.locationId)) return '不能移动到该地点'
      return movementError(state, inv) || investigatorEntryError(state, move.locationId)
    }
    case 'investigate': {
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || loc.clues <= 0) return '这里没有线索可调查'
      if (loc.locked) return '地点被上锁的门封锁'
      const reason = scenarioBehavior(state).investigationError?.(state, inv, loc)
      if (reason) return reason
      return null
    }
    case 'searchIzzie': {
      const loc = state.locations.find(item => item.id === inv.location)
      if (loc?.searchingForIzzieSeat == null) return '此处没有伊兹'
      if (loc.locked) return '地点被上锁的门封锁'
      return null
    }
    case 'fight': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (enemy.code === '02255' && !enemyTextBlanked(state, enemy)) return '子嗣只能使用深奥的咒文攻击'
      if (hiddenFightBlocked(state, inv, enemy)) return '隐私牌禁止你攻击该敌人'
      const canFight = enemy.location === inv.location
      if (!canFight) return '该敌人未与你交战'
      return null
    }
    case 'evade': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) === false) return '该敌人不能被躲避'
      const canEvade = enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location)
      if (!canEvade) return '该敌人未与你交战'
      return null
    }
    case 'ability': {
      const asset = controlledAbilityCard(inv, move.assetId)
      if (!asset) return '未找到该资产'
      if (!lolaCanUseCard(inv, asset.code)) return '罗拉不能触发非当前角色阵营卡牌的能力'
      const eff = assetEffect(inv, asset)
      const ability = eff && eff.abilities && eff.abilities[move.abilityIndex]
      if (!ability || !Number.isInteger(move.abilityIndex)) return '无效能力'
      if (ability.cost?.action === false && cannotTriggerFreeAbility(state, inv)) return '隐私牌禁止你触发免费能力'
      if (!canAffordAbility(inv, asset, ability)) return '能力成本不足'
      if (ability.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return '只能在自己的技能检定期间使用'
      if (ability.requiresNoClues) { const loc = state.locations.find(item => item.id === inv.location); if (loc && loc.clues > 0) return '所在地点仍有线索' }
      const effectInvalid = effectError(state, inv, ability.effect)
      if (effectInvalid) return effectInvalid
      if (move.optionIndex != null) {
        const ok = ability.effect && ability.effect.type === 'chooseOne' && Array.isArray(ability.effect.options) && ability.effect.options[move.optionIndex]
        if (!Number.isInteger(move.optionIndex) || !ok) return '无效选项'
        const branchError = effectError(state, inv, ability.effect.options[move.optionIndex].effect)
        if (branchError) return branchError
      }
      if (move.targetId != null) {
        const targets = abilityTargets(state, inv, ability.effect)
        if (!targets.some((e) => e.id === move.targetId)) return '该敌人不是有效目标'
      }
      return null
    }
    case 'resign': {
      const loc = state.locations.find(item => item.id === inv.location)
      return loc?.resign || state.scenario.resignAnywhere ? null : '当前地点不能撤退'
    }
    case 'engage': {
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (enemy.location !== inv.location) return '该敌人不在你所在的地点'
      if (enemy.massive) return '庞大敌人已与所在地点所有调查员交战'
      if (enemy.engagedSeat === seat) return '你已经与该敌人交战'
      return null
    }
    case 'advanceAct': return canAdvanceWithClues(state) ? null : '当前线索或窗口不能推进场景'
    case 'endTurn': return null
    default: return '未知行动：' + move.action
  }
}

export function moveToText(move) {
  if (!move) return ''
  if (move.label) return move.label.replace(/^[^\s]+\s/, '')
  switch (move.action) {
    case 'draw': return '抽牌'
    case 'resource': return '获得资源'
    case 'investigate': return '调查'
    case 'fight': return '攻击'
    case 'evade': return '躲避'
    case 'move': return '移动'
    case 'resign': return '撤退'
    case 'endTurn': return '结束回合'
    case 'freeAction': return '使用调查员异能'
    case 'parley': return '谈判'
    case 'parleyCultist': return '谈判盘问'
    case 'parleyLita': return '谈判丽塔'
    case 'drawCultist': return '抽取异教徒牌堆'
    case 'interruptRitual': return '破坏仪式'
    case 'sacrificeLita': return '献祭丽塔'
    case 'breakDoor': return '破门'
    case 'discardThreat': return '弃掉威胁'
    case 'purgeThreat': return '净化威胁'
    case 'play': return '打出' + (move.cardId ? '「' + cardName(move.cardId) + '」' : '')
    case 'ability': return '使用能力'
    default: return move.action
  }
}

// ---------------------------------------------------------------------------
// 给 AI 的局面描述
// ---------------------------------------------------------------------------

export function describeState(state, observerSeat = decisionSeat(state)) {
  const CAMPAIGN = campaignFor(state)
  if (inHub(state)) {
    const lines = [...describeTeamParticipation(state, observerSeat), `【战役局外】${state.campaign.name} · ${state.uiState} · 难度 ${state.difficulty}`]
    lines.push('待操作席位：' + actingSeats(state).join('、') + '；下一关：' + (state.hubSelectedScenarioId || '未选择'))
    for (const inv of state.investigators) {
      const record = state.campaign.investigators[inv.seat]
      lines.push(`${inv.seat}：${inv.name} · ${record ? `牌组 ${record.deck.length} 张 · ${record.xp} XP` : '未保存牌组'}`)
    }
    lines.push('【可执行行动】')
    if (actingSeats(state).includes(observerSeat)) for (const move of legalMoves(state, observerSeat)) lines.push(JSON.stringify(move))
    return lines.join('\n')
  }
  const lines = describeTeamParticipation(state, observerSeat)
  const act = state.acts[state.actIndex]
  const ag = state.agendas[state.agendaIndex]
  const scIdx = state.campaign ? state.campaign.scenarioIndex : 0
  const totalScenarios = CAMPAIGN.scenarioOrder.length

  lines.push('【合作调查】《诡镇奇谈：卡牌版》第 ' + (scIdx + 1) + '/' + totalScenarios + ' 关：' + state.scenario.name + '，第 ' + state.round + ' 回合（难度：' + state.difficulty + '）。')
  lines.push('目标是合作通关：收集线索推进「场景」，同时避免「密谋」因毁灭推进、避免调查员全部倒下。')

  lines.push('')
  lines.push('【场景 ' + (act ? act.stage : '?') + '】' + (act ? act.name + '：' + act.text : '（已通关）'))
  const objective = actObjectiveContext(state)
  if (objective) lines.push('【当前场景推进条件】' + JSON.stringify(objective))
  const onBoardDoom = totalDoom(state) - agendaDoom(state)
  lines.push('【密谋 ' + (ag ? ag.stage : '?') + '】' + (ag ? ag.name + '：' + ag.text : '（已失败）') + ' 密谋毁灭 ' + agendaDoom(state) + '/' + (ag ? ag.doomThreshold : '?')
    + (onBoardDoom > 0 ? `（场上另有毁灭 ${onBoardDoom}，不计入阈值）` : '') + '。')
  lines.push('队内线索：' + state.clues + '；本关胜利点：' + state.victory + '。')

  // 战役进度：经验 / 累计胜利点 / 创伤（跨关继承）。
  if (state.campaign) {
    const traumas = []
    for (const inv of state.investigators) {
      const t = state.campaign.trauma[inv.seat] || { physical: 0, mental: 0 }
      if ((t.physical || 0) || (t.mental || 0)) traumas.push(`${inv.name} 肉体${t.physical || 0}/精神${t.mental || 0}`)
    }
    lines.push('战役进度：未花费经验合计 ' + state.campaign.xp + '、累计胜利点 ' + state.campaign.victory + (traumas.length ? '；创伤 ' + traumas.join('、') : '；无创伤') + '。')
    lines.push('个人经验：' + Object.values(state.campaign.investigators).map(record => `${record.name} ${record.xp} XP（已花费 ${record.spentXp}）`).join('；'))
    if (state.campaign.phase === 'interlude') lines.push('当前为关间准备，只能回答待决选择；经验不会自动升级，也不会重建既有牌组。')
  }

  lines.push(...(scenarioBehavior(state).describe?.(state) || []))

  lines.push('')
  lines.push('【调查员队伍】')
  for (const inv of state.investigators) {
    const participation = investigatorParticipation(state, inv)
    const alive = participation.status === 'active'
    const mark = alive && inv.seat === state.currentSeat ? ' ◀ 当前行动' : ''
    lines.push(`- ${inv.name}（${CLASS_NAMES[inv.klass] || inv.klass}，位置「${locName(state, inv.location)}」）` +
      ` 生命 ${getMaxHealth(inv) - inv.damage}/${getMaxHealth(inv)} 理智 ${getMaxSanity(inv) - inv.horror}/${getMaxSanity(inv)}` +
      ` 资源 ${inv.resources} 行动 ${inv.actionsLeft}${alive ? '' : '（' + participation.statusLabel + '）'}${mark}`)
    lines.push(`  属性：意志${getStat(state, inv, 'willpower')} 智识${getStat(state, inv, 'intellect')} 战斗${getStat(state, inv, 'combat')} 敏捷${getStat(state, inv, 'agility')}`)
    lines.push(`  线索 ${inv.clues}；手牌(${inv.hand.length})：${inv.seat === observerSeat ? inv.hand.map((c) => cardName(c)).join('、') || '（空）' : '（隐藏）'}`)
    if (inv.assets.length) {
      lines.push(`  资产：${inv.assets.map((a) => {
        const eff = assetEffect(inv, a)
        const usesTxt = (eff && eff.uses) ? `(${a.uses}/${eff.uses})` : ''
        return (a.exhausted ? '✗' : '') + cardName(a.code) + usesTxt
      }).join('、')}`)
    }
    if (inv.engaged.length) {
      const es = inv.engaged.map((eid) => { const e = state.enemies.find((x) => x.id === eid); return e ? e.name : eid }).join('、')
      lines.push(`  交战：${es}`)
    }
    if (inv.threat.length) {
      lines.push(`  威胁区域：${inv.threat.map((t) => cardName(t.code) + ((t.counters != null) ? `(${t.counters})` : '')).join('、')}`)
    }
    const freeAbilities = alive ? describeFreeAbilities(state, inv) : []
    if (freeAbilities.length) {
      lines.push(`  可用免费能力：${freeAbilities.join('；')}`)
    }
  }

  lines.push('')
  lines.push('【地点与连接图】')
  for (const loc of state.locations) {
    const here = aliveInvestigators(state).filter((i) => i.location === loc.id).map((i) => i.name).join('、')
    const enemiesHere = state.enemies.filter((e) => e.location === loc.id && e.engagedSeat == null).map((e) => e.name).join('、')
    const conns = loc.connections.map((c) => locName(state, c)).join('、')
    lines.push(`- ${loc.name}（${loc.id}）：帷幕 ${loc.shroud}，线索 ${loc.clues}${loc.locked ? '，🔒上锁' : ''}；连接「${conns || '无'}」${here ? '；调查员：' + here : ''}${enemiesHere ? '；敌人：' + enemiesHere : ''}`)
  }

  if (state.enemies.length) {
    lines.push('')
    lines.push('【敌人意图】')
    for (const e of state.enemies) {
      const eng = e.massive ? '与所在地点所有人交战' : (e.engagedSeat != null ? state.investigators[e.engagedSeat]?.name : '无')
      const kw = [e.hunter && '猎手', e.retaliate && '反击', e.alert && '警戒', e.elite && '精英', e.massive && '庞大'].filter(Boolean).join(' ')
      const intent = [
        e.hunter && '会主动向最近调查员移动',
        e.prey && ('猎物「' + describePrey(e.prey) + '」'),
        e.retaliate && '攻击落空会反击',
      ].filter(Boolean).join('；')
      lines.push(`- ${e.name}：战斗${enemyFightValue(state, e, state.investigators[observerSeat])} 躲避${e.evade} 生命 ${e.health - e.damageTaken}/${e.health}${e.doom ? ` 毁灭${e.doom}` : ''}${kw ? '（' + kw + '）' : ''}，交战「${eng}」${e.exhausted ? '（已横置）' : ''}${intent ? '；意图：' + intent : ''}`)
    }
  }

  if (state.pendingChoice && (state.pendingChoice.seat === observerSeat || !state.skillTest || state.skillTest.helpRequested || state.skillTest.seat === observerSeat)) lines.push(`待决选择：${state.pendingChoice.prompt}；回答座位 ${state.pendingChoice.seat}。`)
  const legal = observerSeat === decisionSeat(state) ? legalMoves(state) : []
  if (legal.length) {
    lines.push('')
    lines.push('【可执行行动】（从下列选择一项，用其 JSON 表示）')
    legal.forEach((m, i) => { lines.push(`${i + 1}. ${m.label}  →  ${JSON.stringify(stripLabel(m))}`) })
  }

  if (state.log.length) {
    lines.push('')
    lines.push('【最近局势】')
    const log = state.skillTest && !state.skillTest.helpRequested && state.skillTest.seat !== observerSeat ? state.skillTest.publicLog || [] : state.log
    const narrative = narrativeLogTexts(state)
    lines.push(log.slice(-12).map((t) => '· ' + (narrative.has(t) ? '（剧情文本已省略）' : t)).join('\n'))
  }

  return lines.join('\n')
}

function stripLabel(m) {
  const copy = { ...m }
  delete copy.label
  return copy
}
