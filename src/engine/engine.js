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
// Phase 1 新增（状态基础，见 docs/architecture-refactor-roadmap.md §6）：
//   - 生命周期读点：played / commit / weakness / entersPlay / leavesPlay 统一经 lifecycle.js；
//   - A1：state.effects[] 持续效果 + 统一过期点（effect-state.js）与修正/能力读点；
//   - B1：描述子 target 枚举（targets.js）接入 legalMoves / validateMove / ctx.target；
//   - playCondition 收敛（play-condition.js）：引擎不再逐字段读旧可用性字段。
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
import {
  agendaHandSizePenalty, blanksTraits, enemyWeaknessExtra, hasExplicitReactionPrompt,
  isPoisonThreat, isTextBlankEnemy, poisonThreatCode,
} from '../cards/card-rules.js'
import { CARD_ABILITY_ENTRIES } from '../cards/card-abilities.js'
// Phase 3（D1）：非玩家卡（敌人/地点/幕/议程/剧情支援）的声明式行为通道。
import { NON_PLAYER_ABILITY_ENTRIES } from '../cards/encounter-abilities.js'
import { resolveEffect, effectDefinitionError } from './effects.js'
import {
  commitProfile, entersPlayEffect, leavesPlayEffect, playedEffect, playFlag, weaknessProfile,
} from './lifecycle.js'
import {
  abilityShim, descriptorOfKind, descriptorsForWindow, descriptorsInEntry, elderSignDescriptor, limitUsed, markLimitUsed,
  modifiersFor, registeredCodes, registeredEntry, registerCardAbilities, weaknessDescriptor,
  // Phase 3（D1）：非玩家卡通道的枚举点。
  hasNonPlayerBehavior,
} from './ability.js'
import { enumerateTargets, resolveTarget } from './targets.js'
import {
  activeEffects, clearEffects, createEffect, effectAbilitySources, effectModifiers, expireEffects,
  removeEffectsFromSource,
} from './effect-state.js'
import { playAccess, playConditionError } from './play-condition.js'
import {
  statPipeline, enemyHealthDelta, playCostDelta, slotBonus, setModifierRegistry, setModifierHooks,
  // Phase 2（C1/C2）：布尔修正与授予类修正的读点。
  capabilityBlocked, ruleIgnored, collectGrants,
  // Phase 3（D1）：非玩家卡的数值修正与布尔规则读点。
  entityModifierTotal, entityRuleActive,
} from './modifiers.js'
// Phase 2（C3/C4）：费用表达式与上限作用域。
import { costIsDynamic, describeCost, normalizeCostValues } from './cost.js'
import { describeLimit } from './limits.js'
// Phase 2（B3/B5/B6）：检定结果契约、看牌/检索、区域与牌的去向。
import { describeTestResult, pendingTestResult, summarizeTestResult, testStage } from './test-result.js'
import { describeLook, describeSearch, normalizeLookOptions, normalizeSearchOptions } from './look.js'
import { describeCardMove, normalizeCardMove } from './zones.js'
import { playerWindowLabel, noteUnknownWindow } from './windows.js'
import { all } from './matcher.js'
import { cardIdentityFields } from '../cards/card-identity.js'
import { captureTableState } from '../integration/presentation-state.js'
import { attackStyle } from '../integration/attack-style.js'
import { describeTeamParticipation, investigatorParticipation } from '../ai/ai-participation.js'
import { narrativeLogTexts } from '../ai/ai-story.js'
import { STATE_SCHEMA_VERSION, RULES_VERSION, randomValue, nextInstanceId, stateCompatibilityError, agendaDoom, totalDoom, doomCards, enemyHealthValue } from './rules-state.js'
import { requestChoice, choiceMoves, choiceSeats, choiceError, resolveTransaction, resolutionCheckpoint } from './resolution.js'
import { introduction, resolutionStory } from '../campaign/story.js'
import { campaignGraph, enterCampaignNode, walkCampaign } from '../campaign/campaign-flow.js'
import { applyCampaignEffect, applyResolutionResults } from '../campaign/campaign-effects.js'
import { initializeChaosBag, beginChaosTest, drawChaosToken, returnChaosToken, endChaosTest, releaseChaosTokens, sealChaosToken } from './chaos-bag.js'
import { registerCampaignInvestigator, updateCampaignStatus, replacementCandidates, awardExperience, campaignCardChange, settleExiledCards, availablePurchases, replacementOptions, purchaseCard, upgradeRecord, stagePurchase, finishUpgradeDraft, recommendUpgrade, campaignEnding } from '../campaign/campaign.js'

const PLAYABLE_INVESTIGATORS = PLAYABLE_INVESTIGATOR_CODES

// 修正管线（modifiers.js）通过注入读取能力层注册表，避免两个模块互相 import。
setModifierRegistry(registeredEntry)
setModifierHooks({
  maxSanity: getMaxSanity,
  // 与 assetEffect 的空白判定保持一致：文本空白时被动与声明式修正都不生效。
  sourceBlanked: (state, inv, source) => {
    const traits = cardDef(source?.code)?.traits || []
    // Phase 5（5a-3）：「清空某类特质文案」在内容层数据里，按标记判断。
    if (inv?.threat?.some(item => blanksTraits(item.code).includes('ally')) && traits.includes('Ally')) return true
    if (inv?.threat?.some(item => item.blankItemAssets) && traits.includes('Item')) return true
    return false
  },
  investigatorBlanked: (state, inv) => investigatorTextBlanked(state, inv),
  // Phase 3（D1）：非玩家实体的「文本视为空白」——敌人 textBlanked 时，
  // 它自己声明的修正与布尔规则都不再生效（与支援的空白口径一致）。
  entityBlanked: (state, entity) => Boolean(entity?.textBlanked) && enemyTextBlanked(state, entity),
  // Phase 1 A1：持续效果是修正的第三条来源（有到期时间的那种）。
  activeEffects: state => effectModifiers(state),
  // 弱点数据走生命周期读点（描述子优先），威胁区的被动修正因此也能读到。
  weaknessProfile: code => weaknessProfile(code),
})
// 能力层内容注册（src/cards/card-abilities.js）：描述子、修正、旧印效果。
// 注册是幂等的"谁先加载谁注册"：审计工具（tools/audit-abilities.mjs）在单进程测试里
// 可能先于引擎注册同一批内容，重复调用会命中"同一卡号只允许一个条目"的守卫。
if (!registeredCodes().length) registerCardAbilities([...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES])

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
    // 从玩家牌/无目录数据生成的敌人（04331 飞天水螅：把牌库顶的牌视为敌人）。
    spawnStoryEnemy: (code, location, stats = {}, extra = {}) => spawnStoryEnemy(state, code, location, stats, extra, events),
    attack: (enemy, inv) => enemyAttack(state, enemy, inv, events, '剧本效果', { kind: 'effect' }),
    // 「无视卡牌效果」通用开关（失落时代 P2）：共享解析器与章节 behavior 在
    // 自己的攻击循环里也能用同一份判定。Phase 3（D1）起，敌人自己的卡面声明优先。
    cannotAttack: enemy => enemyCannotAttack(state, enemy),
    cannotBeAttacked: enemy => enemyCannotBeAttacked(state, enemy),
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
        const retaliationDamage = EFFECTS[asset.code]?.defeatedDamage ?? registeredEntry(asset.code)?.defeatedDamage
        if (retaliationDamage) defeatedAssetRetaliation(state, inv, retaliationDamage, events)
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
    // 在「某一张卡」上放毁灭的统一入口（敌人在内）：走 doomPlaced 钩子与 04265 手铐拦截。
    doomOn: (card, amount = 1) => placeDoomOnCard(state, card, amount, events, { silent: true }),
    payClues: (n, location) => groupPayment(state, n, location, events),
    spendClues: (seat, n) => { const inv = state.investigators[seat]; if (inv.clues < n) throw new Error('线索不足'); inv.clues -= n; syncClues(state) },
    trauma: (seat, kind, n) => addTrauma(state, seat, kind, n, events),
    storyAsset: (code, location) => spawnStoryAsset(state, code, location, events),
    // 失落的时代机制（M3-A）
    supplies: seat => suppliesFor(state, seat),
    hasSupply: (seat, name) => hasSupply(state, seat, name),
    grantSupplies: (seat, names) => grantSupplies(state, seat, names, events),
    crossOffSupply: (seat, name) => crossOffSupply(state, seat, name, events),
    checkSupplies: (seat, name) => checkSupplies(state, state.investigators[seat], name),
    suppliesAt: location => suppliesAtLocation(state, location),
    vengeance: () => vengeancePoints(state),
    recordVengeance: (amount, card) => recordVengeance(state, amount, card),
    isPoisoned: seat => isPoisoned(state.investigators[seat]),
    poison: seat => poisonInvestigator(state, seat, events),
    yigsFury: () => yigsFury(state),
    addYigsFury: amount => addYigsFury(state, amount, events),
    relicOfAges: () => relicOfAges(state),
    relicOfAgesLocation: () => relicOfAgesLocation(state),
    moveRelicOfAges: payload => moveRelicOfAges(state, payload, events),
    expeditionLeader: () => expeditionLeaderSeat(state),
    setExpeditionLeader: seat => setExpeditionLeader(state, seat, events),
    buildExplorationDeck: codes => buildExplorationDeck(state, codes, events),
    addToExplorationDeck: (codes, options) => addToExplorationDeck(state, codes, options),
    explorationDeck: () => [...(state.explorationDeck || [])],
    shuffleExploration: () => { state.explorationDeck = shuffle(state.explorationDeck || [], () => randomValue(state)) },
    explore: seat => doExplore(state, seat, events),
    drawCards: (seat, n) => drawCards(state, state.investigators[seat], n, events),
    drawMadnessWeakness: seat => drawMadnessWeakness(state, state.investigators[seat], events),
    // 04165 穿越界限：从收藏里随机获得一张基础[[疯狂]]或[[损伤]]弱点并洗入牌库。
    addBasicWeakness: (seat, traits = ['madness', 'injury']) =>
      addBasicWeakness(state, state.investigators[seat], events, traits),
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
      if (state.enemies.includes(enemy) && enemy.damageTaken >= enemyHealth(state, enemy)
        && enemyCanBeDefeated(state, enemy, source, seat)) {
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
      enemyAttack(state, enemy, inv, events, `「${enemy.name}」从弃牌堆发动攻击。`, { kind: 'effect' })
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

// 敌人型基础弱点的关键词在内容层（src/cards/card-rules.js），Phase 5（5a-2）搬走。

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
    const extra = { ...enemyWeaknessExtra(code), ...(EFFECTS[code]?.enemyWeakness || {}) }
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
      vengeance: c.vengeance ?? 0,
      traits: c.traits || [],
      text: c.textZh || '',
    }
  }
  return null
}

// 所有卡牌定义（供前端渲染）。cards-data.js 的卡以「中文名」作为 name 暴露给前端，
// 并附上由 card-effects.js 反推的 statBonus/fightDamageBonus（兼容现有前端 ahEffStat）。
// Phase 5（§7 迁移清单第 4 条）：passive.stats 搬成声明式修正后，图鉴仍要看得到
// statBonus / extraSlots。只反推"无条件的数值修正"，条件修正照旧由图鉴文案描述。
function declarativeDisplayBonuses(modifiers) {
  const statBonus = {}
  const extraSlots = {}
  for (const modifier of modifiers || []) {
    if (modifier.condition) continue
    if (typeof modifier.target !== 'string') continue
    if (modifier.target.startsWith('skill:') && modifier.target !== 'skill:*'
      && typeof modifier.amount === 'number') {
      const skill = modifier.target.slice('skill:'.length)
      statBonus[skill] = (statBonus[skill] || 0) + modifier.amount
    }
    // Phase 2（C2）的授予槽位写法：add:slot + value = 槽位名。
    if (modifier.target === 'add:slot' && typeof modifier.value === 'string') {
      extraSlots[modifier.value] = (extraSlots[modifier.value] || 0) + (typeof modifier.amount === 'number' ? modifier.amount : 1)
    }
  }
  return {
    statBonus: Object.keys(statBonus).length ? statBonus : null,
    extraSlots: Object.keys(extraSlots).length ? extraSlots : null,
  }
}

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
    const descriptorEntry = registeredEntry(code)
    if (descriptorEntry?.abilities.length) copy.abilityIds = descriptorEntry.abilities.map(descriptor => descriptor.id)
    copy.hasReactionPrompt = !!(eff?.reaction || reactions.some(r => !isAutomaticReward(r)) || investigatorAbility?.chaosTokenRedraw || eff?.freeTriggers?.length
      || eff?.abilities?.some(ability => ability.cost?.action === false) || hasExplicitReactionPrompt(code)
      // Phase 5（5b-6）：迁移来的反应描述子按同一口径判断——自动奖励（无费用/无目标/无上限）不算询问。
      || descriptorEntry?.abilities?.some(descriptor => descriptor.kind === 'free'
        || (descriptor.kind === 'reaction'
          && !(descriptor.legacyReaction && isAutomaticReward({ effect: descriptor.effect, cost: descriptor.cost, id: descriptor.id })))))
    const entryPassive = !eff?.passive ? registeredEntry(code)?.passive : null
    if (eff && eff.passive) {
      if (eff.passive.stats) copy.statBonus = eff.passive.stats
      if (eff.passive.fightDamage) copy.fightDamageBonus = eff.passive.fightDamage
      if (eff.passive.extraSlots || eff.passive.handSlotsBonus) {
        copy.extraSlots = { ...eff.passive.extraSlots }
        if (eff.passive.handSlotsBonus) copy.extraSlots.hand = (copy.extraSlots.hand || 0) + eff.passive.handSlotsBonus
      }
    } else if (entryPassive) {
      if (entryPassive.stats) copy.statBonus = entryPassive.stats
      if (entryPassive.fightDamage) copy.fightDamageBonus = entryPassive.fightDamage
      if (entryPassive.extraSlots || entryPassive.handSlotsBonus) {
        copy.extraSlots = { ...entryPassive.extraSlots }
        if (entryPassive.handSlotsBonus) copy.extraSlots.hand = (copy.extraSlots.hand || 0) + entryPassive.handSlotsBonus
      }
    } else if (descriptorEntry?.modifiers.length) {
      // Phase 5：passive.stats 迁成 modifiers 后，图鉴字段从声明式修正反推，
      // 否则前端会丢掉 statBonus / extraSlots（§7 迁移清单第 4 条）。
      const display = declarativeDisplayBonuses(descriptorEntry.modifiers)
      if (display.statBonus) copy.statBonus = display.statBonus
      if (display.extraSlots) copy.extraSlots = display.extraSlots
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
  const abilityEntry = registeredEntry(code)
  const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round, ...fields })
  const uses = effect.uses ?? abilityEntry?.uses
  const usesType = effect.usesType ?? abilityEntry?.usesType
  if (uses != null && asset.uses == null) {
    asset.uses = uses
    asset.usesType = usesType || 'charges'
  }
  // 「古代巨石（研究完成）」：秘密数等于剧本日志里记录的鉴定难度。
  if (effect.usesFromStoneRecord && asset.uses == null) {
    asset.uses = Math.max(0, Number(state.campaign?.records?.identifiedTheAncientStone) || 0)
    asset.usesType = effect.usesType || 'secrets'
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
  inv.exploreOnlyActions = 0
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
    // Phase 5（5c-39）：「原定计划」这类开局效果改成描述子（kind: 'setup'）；
    // 旧的数据体 setup 仍是回退路径，保证未迁移的卡不受影响。
    const setupDescriptor = descriptorOfKind(code, 'setup')
    if (setupDescriptor?.resolve) {
      executeDescriptor(state, { inv, source: card, descriptor: setupDescriptor, events, silent: true })
    } else {
      const setup = EFFECTS[code]?.setup
      if (setup) carcosaPlayerEffect(state, inv.seat, { ...setup, assetId: card.id }, events)
    }
  }
  drawOpeningHand(state, inv)
  // 幕间留下的下一场修正（原卡：配给不足 → 起始资源 -3，水壶 → 起始线索 +1）。
  consumeStartingAdjustments(state, inv, events)
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
  // 调查员候选顺序只影响 AI 选人；用独立随机流，避免新增调查员改变主随机流
  // （否则旧种子对局的牌序、遭遇与混乱标记会随卡池扩张而漂移）。
  const orderState = { rngState: hashSeed(`${seed}:investigator-order`) >>> 0 }
  const order = shuffle(invCodes, () => randomValue(orderState))

  let humanPick = settings.playerInvestigator
  if (!humanPick || humanPick === 'auto' || humanPick === '__random__') humanPick = order[0]
  if (!canSelectInvestigator(humanPick) || !Object.hasOwn(ALL_INVESTIGATORS, humanPick)) {
    throw new Error(`调查员未开放：${humanPick}`)
  }

  // 重放（src/engine/replay.js）需要按座位复现建局结果。AI 席位的调查员由 persona
  // 与独立随机流决定，而 persona 不进 state，所以允许显式给出逐座位卡号；
  // 只用于重放/测试，正常开局不传这个字段。
  const seatInvestigators = settings.seatInvestigators
  if (seatInvestigators != null) {
    if (!Array.isArray(seatInvestigators) || seatInvestigators.length !== players.length) {
      throw new Error('座位调查员必须是与席位数一致的卡号数组')
    }
    if (new Set(seatInvestigators).size !== seatInvestigators.length) throw new Error('座位调查员不能重复')
    seatInvestigators.forEach((code, index) => {
      if (!Object.hasOwn(ALL_INVESTIGATORS, code) || !canSelectInvestigator(code)) throw new Error(`调查员未开放：${code}`)
      if (players[index].seat === 0 && code !== humanPick) throw new Error('座位调查员与主角调查员不一致')
    })
  }

  const used = new Set()
  const investigators = []
  for (const [index, p] of players.entries()) {
    let code
    if (seatInvestigators) {
      code = seatInvestigators[index]
    } else if (p.seat === 0) {
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
    // 建局参数快照：重放（src/engine/replay.js）需要它才能重建同一局。
    // seatInvestigators 记的是**建局时**逐座位选到的调查员；关间换人由动作日志重放，
    // 不覆盖这份快照，否则重放时的开局日志与真人/AI 选人顺序会对不上。
    setup: {
      rulesMode,
      playerDeck: Array.isArray(settings.playerDeck) ? [...settings.playerDeck] : null,
      seatInvestigators: investigators.map(inv => inv.code),
    },
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
    // Phase 1（A1）：持续效果实体。纯 JSON、随存档往返，过期只经 expireEffects()。
    effects: [],
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
  // 失落的时代：探索牌库逐关重建；免疫/复仇等记录随关卡重置。
  state.explorationDeck = []
  state.explorationDiscard = []
  state.relicOfAges = null
  state.expeditionLeaderSeat = state.expeditionLeaderSeat ?? null
  state.exiled = []
  state.exiledBySeat = []
  state.locationVariants = {}
  state.scenarioZones = {}
  state.scenarioFlags = {}
  state.round = 1
  state.phase = 'investigation'
  state.turnsTaken = []
  // 新关卡不带上一关的临时效果（A1）；持续到关卡结束的效果由「所有调查员离场」自然消失。
  state.effects = []

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
  // 能力层窗口：冒险开始时（起始手牌里的塔罗牌等「游戏开始时」能力）。
  openAbilityWindow(state, 'scenarioStarts', { when: 'scenarioStarts', scenarioId: sc.id }, events)
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

// 剧本重开原语（失落时代 P2：04059 结局 4「重演本场冒险」）。结局钩子调用后，
// 引擎放弃本次结算、把当前战役节点的 visit 计数 +1，并在原地重新布置同一剧本。
class ScenarioRestarted extends Error {
  constructor() {
    super('剧本重演')
  }
}

// 只负责「把 visit 计数 +1」；真正的重新布置由 executeCommand 在捕获
// ScenarioRestarted 后调用 startScenario 完成。返回 false 表示当前局面不能重开。
export function restartScenario(state) {
  const campaign = state.campaign
  if (!campaign || !state.scenario) return false
  const graph = campaignGraph(campaignManifestFor(state))
  // campaignGraph 直接返回 manifest.flow，节点对象没有 id 字段，key 从 flow.nodeId 取。
  const nodeId = campaign.flow?.nodeId
  const node = graph.nodes[nodeId]
  if (!node || node.type !== 'scenario') return false
  const roster = state.investigators.filter(inv => campaign.investigators?.[inv.seat])
  if (!roster.length) return false
  // 有人死亡/疯狂/退场时不在原地重开：让正常结算流程处理替补。
  if (roster.some(inv => campaign.investigators[inv.seat].status !== 'active')) return false
  campaign.flow.visits ||= {}
  campaign.flow.visits[nodeId] = (campaign.flow.visits[nodeId] || 1) + 1
  return true
}

function finishScenario(state, resolutionKey, events) {
  const CAMPAIGN = campaignFor(state)
  if (state.status !== 'playing') return
  const sc = state.scenario
  const campaign = state.campaign
  if (!Object.hasOwn(sc.resolutions, resolutionKey)) throw new Error('未知剧本结局')
  const visitId = `${campaign.flow?.nodeId || sc.id}:${campaign.flow?.visits?.[campaign.flow.nodeId] || 1}`
  if (campaign.scenarioResults.some(result => result.visitId === visitId)) throw new Error('本关已经结算')
  // 剧本以「无结局」收场且没有任何幸存者时，战役到此为止，不能算胜利。
  if (resolutionKey === 'noResolution'
    && !state.investigators.some(inv => !inv.defeated && !inv.resigned)) campaign.failed = true
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
  const result = scenarioBehavior(state).resolution?.(
    state, resolutionKey, events,
    { addLitaToCampaign, addTrauma, originalCardCode, basicWeaknessPool,
      ALL_CARDS, campaignCardChange, randomValue,
      // P2：结局钩子也能要求玩家做选择（04059 结局 3「回到遗迹深处 / 摧毁此处」），
      // 以及「重演本场冒险」的剧本重开原语（04059 结局 4）。
      choose: request => requestChoice(state, request),
      restartScenario: () => {
        if (!restartScenario(state)) return false
        throw new ScenarioRestarted()
      } }) || {}
  const { bonus = 0, award = true, seatBonus = () => 0 } = result
  // Phase 3（D4）：结局的「写哪些记录 / 给谁创伤 / 加什么标记」可以是声明式条目，
  // 由 campaign-effects 的解释器统一校验 recordSchema 后结算。必须在记录快照之前完成。
  if (result.effects) {
    try {
      applyResolutionResults(state, result.effects, { log: text => info(state, events, text) })
    } catch (error) {
      throw new Error(`关卡 ${state.scenario?.id || '?'} 的结局 ${resolutionKey} 声明无效：${error.message}`)
    }
  }
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
    if (!inv.defeated || inv.resigned || !inv.defeatCause) continue
    // 只有「因伤害/恐惧被击败」才按创伤结算；阵亡类原因（坠崖、被杀等）不折算成精神创伤。
    if (!['both', 'damage', 'horror'].includes(inv.defeatCause)) continue
    const kind = inv.defeatCause === 'both' ? requestChoice(state, {
      kind: 'trauma', source: 'defeat', seat: inv.seat, prompt: '同时因伤害与恐惧被击败，选择一种创伤。',
      options: [{ id: 'physical', label: '1 点肉体创伤' }, { id: 'mental', label: '1 点精神创伤' }],
    }) : inv.defeatCause === 'damage' ? 'physical' : 'mental'
    addTrauma(state, inv.seat, kind, 1, events)
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
  // 没有任何幸存者（时间线崩解、全灭）同样按失败收尾。
  const noSurvivors = !(state.investigators || []).some(inv => !inv.defeated && !inv.resigned)
  // 战役结局编号：按 manifest.endings 匹配剧本日志，映射到具体结局（结局 1–5）。
  const ending = campaignEnding(CAMPAIGN, state.campaign.records || {})
  if (ending) {
    state.campaign.ending = ending.id
    state.campaign.endingLabel = ending.label
    info(state, events, `📖 战役结局：${ending.label}。`)
  }
  if (state.campaign.failed || state.campaign.flowOutcome === 'defeat' || noSurvivors) {
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
  // Phase 2（C1）：能力禁止走声明式修正（capability:triggerAbilities），
  // 不再需要给「不能触发能力」类卡面加引擎字段。
  if (capabilityBlocked(state, inv, 'triggerAbilities')) return true
  return activeHiddenRules(state, inv).some(item => item.rule.cannotTriggerFree)
}

function hiddenFightBlocked(state, inv, enemy) {
  const traits = (enemy?.traits || []).map(trait => String(trait).toLowerCase())
  return activeHiddenRules(state, inv).some(item =>
    item.rule.cannotFightTraits?.some(trait => traits.includes(String(trait).toLowerCase())))
}

function movementError(state, inv) {
  // Phase 2（C1）：capability:move —— 「不能移动」由卡面声明，引擎只问读点。
  if (capabilityBlocked(state, inv, 'move')) return '当前效果禁止你移动'
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
  // Phase 5（5a-2）：按内容层的数据标记判断（不再是卡号字面量）。
  return !!inv && state.enemies.some(enemy => isTextBlankEnemy(enemy.code)
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
  // 「毒蛇灾厄」（04099）：非弱点道具的文字视为空白。
  if (inv.threat?.some(item => item.blankItemAssets) && (cardDef(asset?.code)?.traits || []).includes('Item')) return {}
  const legacy = EFFECTS[asset?.code]
  // Phase 5（D2）：使用次数元数据（uses / usesType / discardWhenEmpty）可以整组搬到
  // 注册表条目上；这里与描述子一起合并，读点（补充弹药、充能耗尽、界面文字）不需要
  // 知道自己拿到的是旧 DSL 还是新条目。
  const entry = registeredEntry(asset?.code)
  const meta = entry
    ? {
        ...(entry.uses != null ? { uses: entry.uses } : {}),
        ...(entry.usesType ? { usesType: entry.usesType } : {}),
        ...(entry.discardWhenEmpty ? { discardWhenEmpty: true } : {}),
        // Phase 5（5b-7）：「沉静」关键字（非直接恐惧必须先分给该支援）。
        ...(entry.composure ? { composure: true } : {}),
        // Phase 5（5b-11）：击败敌人后横置治愈恐惧。
        ...(entry.exhaustOnEnemyDefeatedHealHorror != null
          ? { exhaustOnEnemyDefeatedHealHorror: entry.exhaustOnEnemyDefeatedHealHorror } : {}),
        // Phase 5（5b-10）：封印与附属声明。
        ...(entry.sealOnEnter ? { sealOnEnter: entry.sealOnEnter } : {}),
        ...(entry.substituteSealedElderSign ? { substituteSealedElderSign: true } : {}),
        ...(entry.attachTo ? { attachTo: entry.attachTo } : {}),
        ...(entry.onAttach ? { onAttach: entry.onAttach } : {}),
        // Phase 5（5b-9）：规则性字段（自愈 / 维护付费 / 被击败反伤 / 恐惧转移 / 不可离场）。
        ...(entry.healSelfHorrorAfterTurn != null ? { healSelfHorrorAfterTurn: entry.healSelfHorrorAfterTurn } : {}),
        ...(entry.forcedUpkeepPayOrDiscard != null ? { forcedUpkeepPayOrDiscard: entry.forcedUpkeepPayOrDiscard } : {}),
        ...(entry.defeatedDamage != null ? { defeatedDamage: entry.defeatedDamage } : {}),
        ...(entry.redirectOneHorrorToSelf ? { redirectOneHorrorToSelf: true } : {}),
        ...(entry.cannotLeavePlay ? { cannotLeavePlay: true } : {}),
        // Phase 5（5b-8）：资产卡面关键字（不引发借机攻击 / 快速）也在条目上。
        ...(entry.noOpportunityAttack ? { noOpportunityAttack: true } : {}),
        ...(entry.fast ? { fast: true } : {}),
        // Phase 5（5b-6d）：被动数据体（stats / handSizeBonus / sanityBonus …）。
        ...(entry.passive ? { passive: entry.passive } : {}),
      }
    : null
  // 能力层：声明式描述子折叠成旧式 ability 形状，使 legalMoves / 牌桌按钮 /
  // doAbility / playerWindow 不需要为能力层写第二套枚举。
  const shim = abilityShim(asset?.code)
  // Phase 5（5b-7）：`freeTriggers`（天赋牌「花资源提升检定」）也可以整组搬到注册表条目上。
  // 读点是 applyFreeTriggers，它拿到的就是这里的合并结果。
  const entryTriggers = entry?.freeTriggers?.length
    ? {
        freeTriggers: [...(legacy?.freeTriggers || []), ...entry.freeTriggers],
        ...(entry.minimumHandForBoost != null ? { minimumHandForBoost: entry.minimumHandForBoost } : {}),
      }
    : null
  if (!shim.length && !meta && !entryTriggers) return legacy
  return {
    ...(legacy || {}),
    ...(meta || {}),
    ...(entryTriggers || {}),
    ...(shim.length ? { abilities: [...(legacy?.abilities || []), ...shim] } : {}),
  }
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

// ---------------------------------------------------------------------------
// 失落的时代（三循环）战役机制 · M3-A
// ---------------------------------------------------------------------------
// 探索牌库、检查补给、复仇、伊格之怒、中毒、古代遗物与领队。这些能力由剧本
// 行为、卡牌效果与测试共用，全部写在可 JSON 保存的状态里。

function ensureSupplies(state, seat) {
  state.campaign.supplies ||= {}
  state.campaign.supplies[seat] ||= []
  return state.campaign.supplies[seat]
}

export function suppliesFor(state, seat) {
  return [...ensureSupplies(state, seat)]
}

function hasSupply(state, seat, name) {
  return ensureSupplies(state, seat).includes(name)
}

function grantSupplies(state, seat, names, events) {
  const list = ensureSupplies(state, seat)
  const added = []
  for (const name of [names].flat()) {
    if (!name || list.includes(name)) continue
    list.push(name)
    added.push(name)
  }
  if (added.length) {
    info(state, events, `🎒 ${state.investigators[seat]?.name || seat} 得到补给：${added.join('、')}。`)
  }
  return added
}

function crossOffSupply(state, seat, name, events) {
  const list = ensureSupplies(state, seat)
  const index = list.indexOf(name)
  if (index < 0) return false
  list.splice(index, 1)
  info(state, events, `✂️ ${state.investigators[seat]?.name || seat} 划掉了补给「${name}」。`)
  return true
}

// 「检查补给」：同地点的任意调查员持有该补给即算通过。
function checkSupplies(state, inv, name) {
  return aliveInvestigators(state).filter(owner => owner.location === inv.location)
    .some(owner => hasSupply(state, owner.seat, name))
}

function suppliesAtLocation(state, location) {
  return aliveInvestigators(state).filter(inv => inv.location === location)
    .map(inv => ({ seat: inv.seat, name: inv.name, supplies: suppliesFor(state, inv.seat) }))
}

// 复仇：胜利区中带有复仇点数的卡牌（含被视为在胜利区的卡牌）。
function vengeancePoints(state) {
  return (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
}

function recordVengeance(state, amount, card = null) {
  // 非正数不新增记录，直接返回当前累计，便于剧本按「差值」调用。
  if (!(amount > 0)) return vengeancePoints(state)
  state.victoryDisplay ||= []
  state.victoryDisplay.push({ id: `vengeance-${state.instanceSeq?.c || 0}-${state.victoryDisplay.length}`,
    code: card?.code || 'vengeance', originalCode: card?.code || 'vengeance', victory: 0, vengeance: amount, virtual: true })
  return vengeancePoints(state)
}

// 中毒：永久弱点 04102 在威胁区域，或显式中毒标记。
function isPoisoned(inv) {
  // Phase 5（5a-4）：中毒威胁按内容层数据标记判断。
  return (inv?.threat || []).some(card => isPoisonThreat(card.code)) || inv?.poisoned === true
}

function poisonInvestigator(state, seat, events) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return false
  if (isPoisoned(inv)) return false
  // Phase 5（5a-4）：威胁卡卡号只在内容层出现。
  const poisonCode = poisonThreatCode()
  inv.threat.push(newCardInstance(state, poisonCode, { permanent: true }))
  info(state, events, `🧪 ${inv.name} 中毒了（「${cardName(poisonCode)}」进入威胁区域）。`)
  return true
}

function yigsFury(state) {
  return Number(state.campaign.records?.yigsFury || 0)
}

function addYigsFury(state, amount, events) {
  state.campaign.records ||= {}
  const next = Math.max(0, yigsFury(state) + Number(amount || 0))
  state.campaign.records.yigsFury = next
  if (events) info(state, events, `🐍 伊格之怒变为 ${next}。`)
  return next
}

// 领队：战役记录中的远征求领队，默认由队长担任。
function expeditionLeaderSeat(state) {
  const seat = state.expeditionLeaderSeat ?? state.campaign.expeditionLeader
  if (Number.isInteger(seat) && state.investigators?.[seat]) return seat
  return state.campaign.leadSeat ?? state.currentSeat ?? 0
}

function setExpeditionLeader(state, seat, events) {
  if (!Number.isInteger(seat) || !state.investigators?.[seat]) return null
  state.expeditionLeaderSeat = seat
  state.campaign.expeditionLeader = seat
  info(state, events, `${state.investigators[seat].name} 成为远征求领队。`)
  return seat
}

// 古代遗物：剧情资产在各章之间移动或由调查员携带。
function moveRelicOfAges(state, { code = null, location = null, seat = null } = {}, events) {
  const previous = state.relicOfAges
  state.relicOfAges = {
    code: code || previous?.code || '04061',
    location: seat != null ? state.investigators[seat]?.location ?? null : location,
    seat: seat ?? null,
  }
  if (events) {
    const holder = seat != null ? state.investigators[seat]?.name : null
    info(state, events, `🏺 古代遗物位于${holder ? `${holder} 身上` : locName(state, state.relicOfAges.location) || '一边'}。`)
  }
  return state.relicOfAges
}

function relicOfAges(state) {
  return state.relicOfAges || null
}

function relicOfAgesLocation(state) {
  const relic = relicOfAges(state)
  if (!relic) return null
  if (relic.seat != null) return state.investigators[relic.seat]?.location ?? null
  return relic.location ?? null
}

// 探索牌库：牌库顺序、牌堆与弃牌堆都写入状态，保证存档恢复后一致。
function buildExplorationDeck(state, codes, events) {
  state.explorationDeck = shuffle([...new Set(codes)], () => randomValue(state))
  state.explorationDiscard = []
  if (events) info(state, events, `🧭 探索牌库已建立（${state.explorationDeck.length} 张）。`)
  return state.explorationDeck.length
}

function addToExplorationDeck(state, codes, { top = false } = {}) {
  state.explorationDeck ||= []
  if (top) state.explorationDeck.push(...codes)
  else state.explorationDeck = shuffle([...state.explorationDeck, ...codes], () => randomValue(state))
  return state.explorationDeck.length
}

function doExplore(state, seat, events) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return
  if (!state.explorationDeck?.length) {
    info(state, events, '🧭 探索牌库已经空了。')
    return
  }
  payActionCost(state, inv, 'explore', events)
  // 剧本可以在探索开始前拦截（如「索桥」要求先检定，失败则取消本次探索）。
  const blocked = scenarioBehavior(state).beforeExplore?.(state, inv, scenarioRuntime(state, events))
  if (blocked === false) return
  if (!state.explorationDeck?.length) {
    info(state, events, '🧭 探索牌库已经空了。')
    return
  }
  const code = state.explorationDeck.pop()
  const scenarioLocation = state.scenario?.locations?.[code]
  // 剧本可以要求「只有连接地点才能放置入场」（04285 前往联结点）。
  // 不相连时把牌放回探索牌库底部，本次探索不放置、不移动。
  if (scenarioLocation
    && scenarioBehavior(state).exploreConnects?.(state, inv.location, code) === false) {
    state.explorationDeck.unshift(code)
    info(state, events, `🧭 ${inv.name} 探索到「${scenarioLocation.nameZh || scenarioLocation.name || code}」，`
      + '但它不与当前地点相连，放回探索牌库底部。')
    scenarioBehavior(state).afterExplore?.(state, inv,
      { code, kind: 'blocked', runtime: scenarioRuntime(state, events) })
    return
  }
  const def = scenarioLocation || cardDef(code)
  info(state, events, `🧭 ${inv.name} 探索并翻开「${def?.nameZh || def?.name || code}」。`, {
    kind: 'automatic', phase: state.phase, round: state.round,
    text: `${inv.name} 探索「${def?.nameZh || def?.name || code}」`, code, effect: 'explore',
    seat, location: inv.location,
  })
  if (scenarioLocation) {
    placeLocation(state, code, events, seat)
    const placed = state.locations.find(location => location.id === code)
    const here = state.locations.find(location => location.id === inv.location)
    if (placed && here) {
      placed.connections = [...new Set([...(placed.connections || []), here.id])]
      here.connections = [...new Set([...(here.connections || []), placed.id])]
    }
    if (placed) relocateInvestigator(state, seat, code, events)
  } else {
    // 敌人与诡计走与「遭遇」相同的结算路径。
    state.encounterDeck.push(code)
    drawEncounter(state, inv, events)
  }
  scenarioBehavior(state).afterExplore?.(state, inv,
    { code, kind: scenarioLocation ? 'location' : 'encounter', runtime: scenarioRuntime(state, events) })
}

// 供剧本行为、卡牌效果与测试直接调用的机制接口。
export {
  grantSupplies, crossOffSupply, checkSupplies, suppliesAtLocation,
  vengeancePoints, recordVengeance,
  isPoisoned, poisonInvestigator,
  yigsFury, addYigsFury,
  expeditionLeaderSeat, setExpeditionLeader,
  moveRelicOfAges, relicOfAges, relicOfAgesLocation,
  buildExplorationDeck, addToExplorationDeck, doExplore,
}

export function getStat(state, inv, skill, skipSubstitute) {
  let v = inv[skill] || 0
  if (inv.handlingEncounter?.bonus) v += inv.handlingEncounter.bonus
  // 修正管线（modifiers.js）：声明式修正 + 旧式 passive 字段的桥接。
  // 迁移完成的卡牌分支已从引擎删除，新的修正请写在 card-abilities.js 的 modifiers 里。
  const { delta, floor } = statPipeline(state, inv, skill)
  v += delta
  if (floor != null) v = Math.max(v, floor)
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

// Phase 5（5b-8）：被动数据体可能在能力层条目上（过渡方案），布尔/数值判定统一走这里。
function assetPassiveData(code) {
  return EFFECTS[code]?.passive || registeredEntry(code)?.passive || null
}
function assetCannotLeavePlay(asset) {
  return Boolean(asset?.cannotLeavePlay || EFFECTS[asset?.code]?.cannotLeavePlay
    || registeredEntry(asset?.code)?.cannotLeavePlay)
}

export function getMaxHealth(inv) {
  // 威胁区的生命值修正（04085 伊格的诅咒 -1 生命）与支援被动一起结算。
  return Math.max(0, inv.maxHealth + assetPassiveBonus(inv, 'healthBonus')
    + inv.threat.reduce((sum, card) => sum + (getThreatEffect(card)?.healthModifier || 0), 0))
}

export function getMaxSanity(inv) {
  return Math.max(0, inv.maxSanity + assetPassiveBonus(inv, 'sanityBonus')
    + (inv.assets || []).reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0)
    + inv.threat.reduce((sum, card) => sum + (getThreatEffect(card)?.sanityModifier || 0), 0))
}

function extraActionBonus(inv) {
  return (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraAction || 0), 0)
}

// 「本回合额外一次行动，只能用于探索」（04148 探险日志）。这类行动单独记账，
// 普通行动不能花掉它；探索行动优先花普通行动，不够时才动用额外行动。
function exploreOnlyActionBonus(inv) {
  return (inv.assets || []).reduce((sum, asset) =>
    sum + (assetEffect(inv, asset)?.passive?.extraActionExploreOnly || 0), 0)
}

function normalActionsLeft(inv) {
  return Math.max(0, (inv.actionsLeft || 0) - (inv.exploreOnlyActions || 0))
}

// 当前这次行动的类型（由 executeAction 设置），spendAction 用它判断能否使用探索专用行动。
let currentActionKind = null

function investigateBonus(inv) {
  return (inv.assets || []).reduce((sum, asset) => {
    const passive = assetEffect(inv, asset)?.passive
    return sum + (passive?.investigateBonus || 0) + (inv.clues === 0 ? passive?.investigateBonusIfNoClues || 0 : 0)
  }, 0)
}

// 手牌上限：8 + 剧本修正（handSizeModifier，失落时代 P2）+ 支援/威胁修正。
// 整理阶段的弃牌、抽到超上限的判断与前端提示都走这里。
export function handSize(state, inv) {
  let v = HAND_SIZE_BASE + (scenarioBehavior(state).handSizeModifier?.(state, inv) || 0)
  // Phase 5（5a-4）：议程的手牌上限惩罚在内容层数据里。
  if (state.phase === 'upkeep') v -= agendaHandSizePenalty(state.agendas[state.agendaIndex]?.originalCode)
  for (const a of inv.assets) {
    const eff = assetEffect(inv, a)
    if (eff && eff.passive && eff.passive.handSizeBonus) v += eff.passive.handSizeBonus
  }
  for (const card of inv.threat) v += getThreatEffect(card)?.handSizeModifier || 0
  return Math.max(0, v)
}

function getHandSize(state, inv) { return handSize(state, inv) }

// Phase 2：事件卡的打出关键字（fast / noOpportunityAttack）有两个来源——
// 描述子（迁移后的写法）与 EFFECTS 顶层字段（旧写法）。读点在 lifecycle.playFlag，
// actionCost / actionKind 因此不需要知道卡在哪条通道上。
function cardPlayFlag(code, flag) {
  return playFlag(code, flag)
}

function iconValue(code, skill) {
  const c = cardDef(code)
  if (!c || !c.icons) return 0
  return (c.icons[skill] || 0) + (c.icons.wild || 0)
}

// ---------------------------------------------------------------------------
// Phase 2（C2）：授予类修正的引擎读点。
//
// 三件事必须走同一条读点，否则「授予」会退化成新的引擎特判：
//   effectiveTraits  卡在运行期获得的特性（供特性判定、附件目标、计数）
//   cardKeyword      卡在运行期获得的关键词（fast / noOpportunityAttack …）
//   commitIcons      卡在投入时获得的额外技能图标
// 授予只来自「这张卡自己声明的 add:*」，因此查询时带上 code（来源必须匹配）。
// ---------------------------------------------------------------------------

export function effectiveTraits(state, inv, code) {
  const base = (cardDef(code)?.traits || []).map(trait => String(trait))
  if (!state || !inv) return base
  const granted = [...collectGrants(state, inv, 'trait', { code })]
  if (!granted.length) return base
  const seen = new Set(base.map(trait => trait.toLowerCase()))
  for (const trait of granted) if (!seen.has(trait.toLowerCase())) { base.push(trait); seen.add(trait.toLowerCase()) }
  return base
}

export function cardHasTrait(state, inv, code, trait) {
  const wanted = String(trait).toLowerCase()
  return effectiveTraits(state, inv, code).some(item => String(item).toLowerCase() === wanted)
}

export function cardKeyword(state, inv, code, keyword) {
  if (!state || !inv) return false
  return collectGrants(state, inv, 'keyword', { code }).has(keyword)
}

// 投入技能检定时的图标数：卡面图标 + 声明的 add:skillIcon。
export function commitIcons(state, inv, code, skill) {
  const base = iconValue(code, skill)
  if (!state || !inv) return base
  return base + (collectGrants(state, inv, 'skillIcon', { code }).has(skill) ? 1 : 0)
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

// 敌人不能攻击 / 不能被攻击：卡面声明（D1，entityRuleActive）优先，其次剧本钩子。
// 两个读点都在这里，避免 scenarioRuntime、敌人阶段和攻击行动各写一份判定。
function enemyCannotAttack(state, enemy) {
  if (entityRuleActive(state, enemy, 'cannot:attack')) return true
  return scenarioBehavior(state).enemyCannotAttack?.(state, enemy) === true
}

function enemyCannotBeAttacked(state, enemy) {
  if (entityRuleActive(state, enemy, 'cannot:beAttacked')) return true
  return scenarioBehavior(state).enemyCannotBeAttacked?.(state, enemy) === true
}

// 敌人是否发动借机攻击：卡面声明（D1）与剧本钩子同一读点，避免两处各写一份。
function enemyCanOpportunityAttack(state, enemy) {
  if (entityRuleActive(state, enemy, 'cannot:opportunityAttack')) return false
  return scenarioBehavior(state).canOpportunityAttack?.(state, enemy) !== false
}

// 敌人能否被击败：卡面/实例字段（cannotBeDefeated）优先，其次能力层声明，最后剧本钩子。
function enemyCanBeDefeated(state, enemy, source = null, seat = null) {
  if (enemy?.cannotBeDefeated) return false
  if (entityRuleActive(state, enemy, 'cannot:beDefeated')) return false
  return scenarioBehavior(state).enemyCanBeDefeated?.(state, enemy, source, seat) !== false
}

// 敌人生命值统一读点：印刷值 + 当前剧本的常驻修正（enemyStatModifier('health')）。
// 04124/04132「遗物/亚历山卓附属的敌人 +2×人数」、04140「猎物 +1×人数」等
// 都在共享/章节 behavior 里用这个分支返回修正值。
export function enemyHealth(state, enemy) {
  // 印刷值 + 剧本常驻修正 + 能力层声明式修正（例如 02255 的「文本空白时按人数扣血」）。
  return enemyHealthValue(state, enemy, scenarioBehavior(state)) + enemyHealthDelta(state, enemy)
}

export function enemyFightValue(state, enemy, inv) {
  let value = enemy.fight + (enemyStatMods(state).enemyFight || 0)
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'fight') || 0
  // D1：敌人的战斗值修正来自它自己的卡面声明，或它所在地点的卡面声明
  // （「此处的每个蛇族敌人 +1」不再需要章节 behavior）。
  value += entityModifierTotal(state, enemy, 'enemyFight')
  const reduction = enemy.fightReduction
  if (reduction && reduction.round === state.round && reduction.phase === state.phase) value = Math.max(0, value - (reduction.amount || 0))
  return value
}

export function enemyEvadeValue(state, enemy, inv) {
  let value = enemy.evade + (enemyStatMods(state).enemyEvade || 0)
  value += scenarioBehavior(state).enemyStatModifier?.(state, enemy, 'evade') || 0
  value += entityModifierTotal(state, enemy, 'enemyEvade')
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
  // 米奇·布朗：额外 2 个只能携带非独特盟友的盟友槽位。
  const allyExtra = nonUniqueAllySlotsFor(inv)
  if (need.ally && allyExtra && !allySlotsOk(inv, card, allyExtra)) return false
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
    if (s === 'ally' && allyExtra) continue
    let cap = SLOT_CAPACITY[s] ?? 0
    if (s === 'hand') {
      cap += handSlotsBonusFor(inv, card) + Math.min(tomeHands, restrictedHands)
      // Bandolier: an extra hand slot that may only hold a [[Weapon]] asset.
      if (isWeaponCard(card)) cap += weaponHandSlotsFor(inv)
    }
    cap += (inv.assets || []).reduce((sum, asset) => sum + (assetEffect(inv, asset)?.passive?.extraSlots?.[s] || 0), 0)
    // 能力层槽位修正（如 05112 魔法手势的额外法术槽位）。
    cap += slotBonus(inv, s)
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

function nonUniqueAllySlotsFor(inv) {
  return (inv.assets || []).reduce((sum, asset) =>
    sum + (assetEffect(inv, asset)?.passive?.allySlotsForNonUnique || 0), 0)
}

// 额外盟友槽只能由非独特盟友占用；独特盟友仍受基础 1 个槽位限制。
function allySlotsOk(inv, card, extra) {
  const base = SLOT_CAPACITY.ally ?? 1
  const entries = [...inv.assets, ...(inv.threat || []), { code: card.code }]
    .filter(item => normalizedSlots(cardDef(item.code)).includes('ally'))
  let unique = 0
  let nonUnique = 0
  for (const item of entries) {
    if (cardDef(item.code)?.unique) unique++
    else nonUnique++
  }
  return unique <= base && nonUnique <= base + extra
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
  let drawnCount = 0
  for (let i = 0; i < n; i++) {
    if (inv.deck.length === 0) {
      if (inv.discard.length === 0 || discardLocked(state, inv)) continue
      const rng = () => randomValue(state)
      inv.deck = shuffle(inv.discard, rng)
      inv.discard = []
      reshuffles++
    }
    const code = inv.deck.pop()
    drawnCount++
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
          && !['attachedEnemy', 'attachedLocation'].includes(weaknessProfile(code)?.type)) {
          // Attached weaknesses go to the discard pile when they detach.
          inv.discard.push(code)
        }
      }
    } else {
      inv.hand.push(code)
      texts.push(`${inv.name} 抽取了 1 张牌。`)
      scenarioBehavior(state).cardDrawn?.(state, inv, code, scenarioRuntime(state, events))
      // 能力层窗口：抽牌后（02040 亨利·阿米蒂奇博士等）。
      triggerReaction(state, inv.seat, 'cardDrawn', events, { when: 'cardDrawn', seat: inv.seat,
        location: inv.location, cardCode: code })
    }
    scenarioBehavior(state).deckEmptied?.(state, inv, scenarioRuntime(state, events))
    if (inv.defeated) break
  }
  for (let i = 0; i < reshuffles; i++) {
    texts.push(`${inv.name} 重新混洗弃牌堆，抽牌结束后受到 1 点恐惧。`)
    applyHorror(state, inv, 1, events)
  }
  // 「古代巨石（研究完成）」：抽牌后可按抽到的张数花费秘密。
  if (drawnCount > 0 && !inv.defeated) tfaCardDrawReaction(state, inv, events, drawnCount)
  return texts
}

// 古代巨石（研究完成）：04230 造成伤害 / 04231 治愈恐惧。
function tfaCardDrawReaction(state, inv, events, count) {
  for (const code of ['04230', '04231']) {
    const stone = inv.assets.find(asset => asset.code === code)
    if (!stone || (stone.uses || 0) < count) continue
    if (code === '04230' && !state.enemies.some(enemy => enemy.location === inv.location)) continue
    if (code === '04231') {
      const healable = aliveInvestigators(state).some(other => other.location === inv.location
        && (other.horror > 0 || other.assets.some(asset => (asset.horror || 0) > 0)))
      if (!healable) continue
    }
    const answer = requestChoice(state, { kind: 'reaction', source: stone.id, seat: inv.seat, canSkip: true,
      prompt: `抽取了 ${count} 张牌，是否花费 ${count} 秘密使用「${cardName(code)}」？`,
      options: [{ id: 'skip', label: '不花费秘密' }, { id: 'trigger', label: `花费 ${count} 秘密` }] })
    if (answer !== 'trigger') continue
    stone.uses -= count
    if (code === '04230') {
      const targets = state.enemies.filter(enemy => enemy.location === inv.location)
      const chosen = targets.length === 1 ? targets[0].id : requestChoice(state, { kind: 'target', source: code, seat: inv.seat,
        prompt: '选择要造成伤害的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      damageEnemy(state, enemy, count, inv.seat, events)
      info(state, events, `「${cardName(code)}」对「${enemy.name}」造成 ${count} 点伤害。`)
    } else {
      const options = aliveInvestigators(state).filter(other => other.location === inv.location)
        .flatMap(other => [{ id: `inv:${other.seat}`, label: `${other.name}（恐惧 ${other.horror}）` },
          ...other.assets.filter(asset => (asset.horror || 0) > 0)
            .map(asset => ({ id: `asset:${asset.id}`, label: `${cardName(asset.code)}（恐惧 ${asset.horror}）` }))])
      if (!options.length) continue
      const chosen = options.length === 1 ? options[0].id : requestChoice(state, { kind: 'target', source: code, seat: inv.seat,
        prompt: `选择治愈 ${count} 点恐惧的目标。`, options })
      if (chosen.startsWith('inv:')) {
        const target = state.investigators[Number(chosen.slice(4))]
        const healed = Math.min(target.horror, count)
        target.horror -= healed
        info(state, events, `「${cardName(code)}」治愈 ${target.name} ${healed} 点恐惧。`)
      } else {
        const id = chosen.slice(6)
        const owner = aliveInvestigators(state).find(other => other.assets.some(asset => asset.id === id))
        const asset = owner?.assets.find(item => item.id === id)
        if (asset) {
          const healed = Math.min(asset.horror || 0, count)
          asset.horror = (asset.horror || 0) - healed
          info(state, events, `「${cardName(code)}」治愈「${cardName(asset.code)}」${healed} 点恐惧。`)
        }
      }
    }
  }
}

function isThreatWeakness(code) {
  return weaknessProfile(code)?.type === 'threat'
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
    if (enemy) {
      // 伊格蛇族：显现时把旧印标记封印在自身。
      if (EFFECTS[def.code]?.enemyWeakness?.sealsElderSign && state.chaosBag.includes('eldersign')) {
        sealChaosToken(state, 'eldersign', enemy.id)
        info(state, events, `🔒 「${enemy.name}」封印了 ${tokenLabel('eldersign')}。`)
      }
      info(state, events, `👹 弱点敌人「${enemy.name}」出现并与 ${inv.name} 交战！`)
    }
    return
  }
  // 弱点数据唯一读点（Phase 1 的 weakness kind）：描述子优先，旧 DSL 回落。
  const profile = weaknessProfile(def.code)
  if (!profile) throw new Error(`未实现的弱点效果：${def.code}`)
  // 自定义结算：描述子带 resolve() 时由它接管（新卡走这条，不改引擎）。
  const descriptor = weaknessDescriptor(def.code)
  if (descriptor?.resolve) {
    descriptor.resolve({
      state, inv, seat: inv.seat, source: { code: def.code }, descriptor, events,
      context: { weakness: profile }, api: abilityApi(state, events),
    })
    return
  }
  // 旧式类型分支仍然只读数据；为了让下面的代码一字不改，这里包成同形状的 eff。
  const eff = { weakness: profile }
  // 失落的时代剧本模式弱点链（04038–04042）。
  const swapWeakness = (from, to) => {
    const index = inv.deck.indexOf(from)
    if (index >= 0) inv.deck.splice(index, 1)
    inv.deck.push(to)
  }
  if (eff.weakness.type === 'darkPact') {
    const options = aliveInvestigators(state).filter(owner => owner.location === inv.location)
    const target = options.length === 1 ? options[0].seat : requestChoice(state, { kind: 'target', source: def.code,
      seat: inv.seat, prompt: '「黑暗契约」：选择受到 2 点伤害的调查员。',
      options: options.map(owner => ({ id: String(owner.seat), label: owner.name })) })
    const victim = state.investigators[Number(target)] || inv
    applyHarm(state, victim, 2, 0, events)
    info(state, events, `「${cardName(def.code)}」对 ${victim.name} 造成 2 点伤害。`)
    return
  }
  if (eff.weakness.type === 'outOfBody') {
    // 离体体验（04264）：所有手牌洗回牌库并抽取等量，然后把本卡洗回牌库。
    const hand = [...(inv.hand || [])]
    inv.hand = []
    if (hand.length) inv.deck = shuffle([...inv.deck, ...hand], () => randomValue(state))
    inv.shuffleWeaknessAfterResolution = def.code
    info(state, events, `「${cardName(def.code)}」：${inv.name} 把 ${hand.length} 张手牌洗回牌库并重抽。`)
    if (hand.length) texts.push(...drawCards(state, inv, hand.length, events))
    return
  }
  if (eff.weakness.type === 'priceOfFailure') {
    applyHarm(state, inv, 2, 2, events)
    addDoom(state, 1, events)
    // 卡面：把 04039 从牌库移除，并把 04038 放入弃牌堆（不是牌库）。
    const index = inv.deck.indexOf(def.code)
    if (index >= 0) inv.deck.splice(index, 1)
    inv.discard.push('04038')
    info(state, events, `「${cardName(def.code)}」：伤害与恐惧各 2 点，密谋 +1 毁灭；「黑暗契约」进入弃牌堆。`)
    return
  }
  if (eff.weakness.type === 'impendingDoom') {
    applyHorror(state, inv, 1, events)
    // 记录按调查员各算一份（不再写进共享的 campaign.records）。
    inv.weaknessCounters ||= {}
    inv.weaknessCounters.impendingDoom = (inv.weaknessCounters.impendingDoom || 0) + 1
    if (inv.weaknessCounters.impendingDoom > 1) swapWeakness(def.code, '04041')
    info(state, events, `「${cardName(def.code)}」：1 点恐惧并记录（第 ${inv.weaknessCounters.impendingDoom} 次）。`)
    return
  }
  if (eff.weakness.type === 'cursedFate') {
    applyHorror(state, inv, 2, events)
    inv.weaknessCounters ||= {}
    inv.weaknessCounters.cursedFate = (inv.weaknessCounters.cursedFate || 0) + 1
    if (inv.weaknessCounters.cursedFate > 1) swapWeakness(def.code, '04042')
    info(state, events, `「${cardName(def.code)}」：2 点恐惧并记录（第 ${inv.weaknessCounters.cursedFate} 次）。`)
    return
  }
  if (eff.weakness.type === 'deathKnell') {
    info(state, events, `「${cardName(def.code)}」：${inv.name} 的死期到了——阵亡。`)
    inv.defeatCause = 'killed'
    inv.defeated = true
    const record = state.campaign?.investigators?.[inv.seat]
    if (record) record.status = 'killed'
    checkDefeated(state, inv.seat, events)
    return
  }
  // 血的代价：必须弃掉控制的盟友支援，或弃掉手牌中所有盟友支援；否则洗回牌库。
  if (eff.weakness.type === 'boughtInBlood') {
    const allyTrait = item => (cardDef(item.code)?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'ally')
    const controlled = inv.assets.filter(asset => allyTrait(asset) && !assetCannotLeavePlay(asset))
    const handAllies = inv.hand.filter(code => (cardDef(code)?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'ally'))
    let discarded = 0
    if (controlled.length) {
      const chosen = controlled.length === 1 ? controlled[0].id : requestChoice(state, { kind: 'discard',
        source: def.code, seat: inv.seat, prompt: '「血的代价」：选择弃掉的盟友支援。',
        options: controlled.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
      const asset = controlled.find(item => item.id === chosen) || controlled[0]
      leaveAsset(state, inv, asset, events)
      inv.discard.push(asset.code)
      discarded = 1
      info(state, events, `「${cardName(def.code)}」：${inv.name} 弃掉「${cardName(asset.code)}」。`)
    } else if (handAllies.length) {
      for (const code of handAllies.slice()) {
        removeOne(inv.hand, code)
        inv.discard.push(code)
        discarded++
      }
      info(state, events, `「${cardName(def.code)}」：${inv.name} 弃掉手牌中 ${discarded} 张盟友支援。`)
    }
    if (!discarded) {
      inv.shuffleWeaknessAfterResolution = def.code
      info(state, events, `「${cardName(def.code)}」没有弃掉任何支援，洗回牌库。`)
    }
    return
  }
  // 当场抓获：重整你所在地点或连接地点的所有敌人；连接地点的猎手向你移动 1 个地点。
  if (eff.weakness.type === 'caughtRedHanded') {
    const loc = state.locations.find(item => item.id === inv.location)
    const spots = new Set([inv.location, ...(loc?.connections || [])])
    let moved = 0
    for (const enemy of state.enemies.filter(item => spots.has(item.location) && !item.defeated)) {
      enemy.exhausted = false
      if (enemy.location !== inv.location && enemy.hunter) {
        enemy.location = inv.location
        moved++
      }
    }
    if (moved) info(state, events, `「${cardName(def.code)}」：${moved} 个猎手敌人向 ${inv.name} 移动。`)
    else {
      inv.shuffleWeaknessAfterResolution = def.code
      info(state, events, `「${cardName(def.code)}」没有敌人移动，洗回牌库。`)
    }
    return
  }
  // 信使之声：受到 1 点直接伤害与 1 点肉体创伤，或 1 点直接恐惧与 1 点精神创伤。
  if (eff.weakness.type === 'voiceOfTheMessenger') {
    const answer = requestChoice(state, { kind: 'effect', source: def.code, seat: inv.seat,
      prompt: '「信使之声」：选择承受的代价。',
      options: [{ id: 'damage', label: '1 点直接伤害与 1 点肉体创伤' },
        { id: 'horror', label: '1 点直接恐惧与 1 点精神创伤' }] })
    if (answer === 'damage') {
      applyDamage(state, inv, 1, events, true)
      if (!inv.defeated) addTrauma(state, inv.seat, 'physical', 1, events)
    } else {
      applyHorror(state, inv, 1, events, true)
      if (!inv.defeated) addTrauma(state, inv.seat, 'mental', 1, events)
    }
    return
  }
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
  // 来源离场：绑定在这张卡上的持续效果一起消失（Phase 1 A1）。
  for (const effect of removeEffectsFromSource(state, asset.id)) {
    if (effect.label) info(state, events, `「${effect.label}」随「${cardName(asset.code)}」离场而结束。`)
  }
  // 「如果其离场，将其从游戏中移除」（04311 第七印记的封印）。
  if (EFFECTS[asset.code]?.removeFromGameWhenEmpty) {
    asset.removedFromGame = true
    state.removedFromGame ||= []
    if (!state.removedFromGame.includes(asset.code)) state.removedFromGame.push(asset.code)
  }
  // 离场钩子（Phase 1 的 leavesPlay kind）：数据驱动，引擎不再认识具体卡面字段。
  const leaveEffect = leavesPlayEffect(asset.code)
  if (leaveEffect) {
    resolveEffect(state, inv.seat, { ...leaveEffect, assetId: asset.id }, makeRuntime(state, events))
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

// 04318 彼端的世界：敌人要生成在无人地点、场上却没有无人地点时，从探索牌库
// 逐张揭示到地点为止，把该地点放置入场并作为生成地点，其余牌洗回探索牌库。
function placeLocationForEmptySpawn(state) {
  const deck = [...(state.explorationDeck || [])]
  const revealed = []
  let found = null
  while (deck.length) {
    const code = deck.shift()
    if (state.scenario?.locations?.[code]) { found = code; break }
    revealed.push(code)
  }
  if (!found) {
    state.explorationDeck = shuffle([...deck, ...revealed], () => randomValue(state))
    return null
  }
  placeLocation(state, found, [])
  state.explorationDeck = shuffle([...deck, ...revealed], () => randomValue(state))
  return found
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
  // 「交给你了！」只是改由他人结算；带 +2 的同类卡（如「让我来！」）在反应效果里给出 redirectBonus。
  if (redrawContext.redirectSeat != null) resolvingInv.handlingEncounter = { code, bonus: redrawContext.redirectBonus || 0 }
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
  // 「恢复元气」等需要知道本回合是否抽到过诡计。
  if (ALL_TREACHERIES[code]) resolvingInv.drewTreacheryRound = state.round
  if (ALL_ENEMIES[code]) {
    const def = enemyDef(code)
    // 带固定生成地点的敌人在该地点生成，否则与抽牌者交战；「任意无人地点」敌人去无人地点。
    let engage = null
    let loc = resolvingInv.location
    if (def.spawnAnyEmpty) {
      const empty = state.locations.filter((l) => !state.enemies.some((e) => e.location === l.id)
        && !aliveInvestigators(state).some(i => i.location === l.id))
      let picked = empty.length ? chooseAmong(state, {
        kind: 'spawn', source: { type: 'enemy', code }, seat: leadDecisionSeat(state),
        prompt: `选择「${def.name}」的生成地点（任意无人地点）。`,
        options: empty.map((l) => ({ id: l.id, label: l.name })),
      }) : null
      const act = state.acts?.[state.actIndex]
      const actCode = String(act?.originalCode || act?.code || '')
      if (!picked && !empty.length && actCode === '04318') {
        // 04318 强制：翻探索牌库直到地点，放在场上并让敌人在这里生成。
        picked = placeLocationForEmptySpawn(state)
        if (picked) info(state, events, `🌐 彼端的世界：从探索牌库翻出地点「${locName(state, picked)}」并让「${def.name}」在那里生成。`)
      }
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
    const surge = encounter.surge || scenarioBehavior(state).encounterGainsSurge?.(state, code, resolvingInv)
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
      const planCandidates = inv.assets.filter(asset => registeredEntry(asset.code)?.cardPlan && !asset.exhausted)
        .flatMap(asset => (asset.attached || []).map((code, index) =>
          ({ code, index, fromPlanAssetId: asset.id, id: `plan:${asset.id}:${index}` })))
      const candidates = [...handCandidates,
        ...planCandidates,
        ...(discardEvent ? [{ code: discardEvent, fromDiscard: true, id: 'discard' }] : [])]
        .filter(({ code, copyCode }) => {
          const eff = EFFECTS[copyCode || code]
          // Phase 5（5c-8）：快速事件也可以在能力层声明——`kind:'played'` + `fast` + `trigger:<窗口>`，
          // 条件写在 criteria 的旧字段里。两条通道共用下面同一份条件判定。
          const descriptor = descriptorOfKind(copyCode || code, 'played')
          const reaction = eff?.reaction
            ?? (descriptor?.fast && descriptor.trigger.includes(when)
              ? { when, ...(descriptor.criteria && typeof descriptor.criteria === 'object' && !Array.isArray(descriptor.criteria)
                ? descriptor.criteria : {}) }
              : null)
          if (!reaction || reaction.when !== when || !runtimeCardAvailable(state, inv, code)) return false
          if (!lolaCanUseCard(inv, code)) return false
          if (!reaction.anyLocation && context.location != null && inv.location !== context.location) return false
          if (reaction.selfOnly && inv.seat !== context.seat) return false
          if (reaction.otherInvestigator && inv.seat === context.seat) return false
          if (reaction.nonPerilOnly && context.peril) return false
          if (reaction.ownMythosOnly && inv.seat !== context.seat) return false
          if (reaction.nonWeaknessOnly && (context.weakness || !context.cardCode || isWeaknessCode(context.cardCode))) return false
          if (reaction.nonElite && context.enemy?.elite) return false
          if (reaction.nonEliteOnly && context.enemy?.elite) return false
          if (reaction.treacheryOnly && context.cardCode
            && ALL_CARDS[context.cardCode]?.type !== 'treachery') return false
          if (reaction.requiresClue
            && !(state.locations.find(location => location.id === context.location)?.clues > 0)) return false
          if (reaction.requiresNoClues && inv.clues > 0) return false
          if (reaction.nonWeakness && context.enemy && isWeaknessCode(context.enemy.code)) return false
          if (reaction.failedByAtMost != null && (context.failedBy || 0) > reaction.failedByAtMost) return false
          if (reaction.successByAtLeast != null && (context.successBy || 0) < reaction.successByAtLeast) return false
          if (reaction.symbols && !reaction.symbols.includes(context.token)) return false
          if (reaction.requiresDifficultyAboveBase
            && !(Number(context.difficulty) > Number(context.baseValue ?? 0))) return false
          if (cannotPlayTypes(inv).has(cardDef(copyCode || code)?.type)) return false
          if (scenarioBehavior(state).canPlayCard?.(state, inv, cardDef(copyCode || code)) === false) return false
          if (inv.resources < playCost(state, inv, cardDef(copyCode || code))) return false
          if (descriptor) {
            // resolve 型描述子自己判断可行性；数据体走效果解释器的校验。
            return Boolean(descriptor.resolve) || !effectError(state, inv, descriptor.effect)
          }
          return !effectError(state, inv, playedEffect(copyCode || code))
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
  // 能力层：同一个窗口下，声明式反应/强制能力也在这里结算。
  return openAbilityWindow(state, when, context, events)
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
  const plan = fromPlanAssetId && inv.assets.find(asset => asset.id === fromPlanAssetId && registeredEntry(asset.code)?.cardPlan)
  const code = plan ? plan.attached.splice(index, 1)[0]
    : fromDiscard ? inv.discard.splice(inv.discard.lastIndexOf(topDiscardEvent(state, inv)), 1)[0] : inv.hand.splice(index, 1)[0]
  if (plan) plan.exhausted = true
  const def = cardDef(copyCode || code)
  inv.resources -= playCost(state, inv, def)
  consumePlayThreatResources(state, inv, events)
  info(state, events, `⚡ ${inv.name} 快速打出「${copyCode ? `彩绘世界／${cardName(copyCode)}` : cardName(code)}」。`, { kind: 'play', seat: inv.seat, code })
  state._reaction = context
  try {
    // Phase 5（5c-8）：能力层的快速事件由描述子结算（alreadyPaid：费用与「快速打出」日志已在上面付过/写过）。
    const descriptor = descriptorOfKind(copyCode || code, 'played')
    if (descriptor) {
      executeDescriptor(state, {
        inv, source: { code }, descriptor, context, events, windowId: context.when ?? null,
        alreadyPaid: true, silent: true,
      })
    } else {
      resolveEffect(state, inv.seat, playedEffect(copyCode || code), makeRuntime(state, events))
    }
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
// options.kind 区分攻击来源（P2 钩子）：
//   'enemy'       敌人阶段 / 神话阶段的普通攻击（默认）
//   'opportunity' 借机攻击（趁乱攻击）
//   'retaliate'   反击
//   'alert'       警戒
//   'effect'      卡牌或剧本效果造成的攻击
function enemyAttack(state, enemy, inv, events, label, options = {}) {
  const attack = {
    kind: options.kind || 'enemy',
    source: options.source || null,
    plannedDamage: enemy.damage,
    plannedHorror: enemy.horror,
    damage: 0,
    horror: 0,
    cancelled: false,
  }
  if (!enemyTextBlanked(state, enemy) && enemy.code === 'wolfManDrew') enemy.damageTaken = Math.max(0, enemy.damageTaken - 1)
  // 「不能攻击」（失落时代 P2 通用开关，04048 守卫者）。卡牌效果造成的攻击不受此限制。
  if (attack.kind !== 'effect' && enemyCannotAttack(state, enemy)) {
    info(state, events, `⛔ 「${enemy.name}」不能攻击。`)
    attack.cancelled = true
    return false
  }
  const context = reactionWindow(state, 'enemyAttack',
    { when: 'enemyAttack', seat: inv.seat, location: inv.location, enemy, attackKind: attack.kind,
      prompt: `「${enemy.name}」攻击 ${inv.name}` }, events)
  if (context.cancelled) {
    info(state, events, `「${enemy.name}」对 ${inv.name} 的攻击被取消。`)
    attack.cancelled = true
    return false
  }
  let extraDamage = 0
  let extraHorror = 0
  if (!enemyTextBlanked(state, enemy)) scenarioBehavior(state).enemyAttackStarted?.(state, enemy, inv, scenarioRuntime(state, events), attack)
  const attackBonus = scenarioBehavior(state).enemyAttackModifier?.(state, enemy, inv) || {}
  extraDamage += attackBonus.damage || 0
  extraHorror += attackBonus.horror || 0
  if (!enemyTextBlanked(state, enemy)
    && (enemy.ruleId === 'yithianObserver' || enemy.code === 'yithianObserver' || enemy.code === '01177')) {
    if (inv.hand.length) discardRandomFromHand(state, inv, 1, events)
    else { extraDamage = 1; extraHorror = 1; info(state, events, `🧠 ${inv.name} 无手牌可弃，「${enemy.name}」的伤害和恐惧各 +1。`) }
  }
  const adjusted = scenarioBehavior(state).beforeEnemyHarm?.(state, enemy, inv,
    { damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror }, scenarioRuntime(state, events))
  if (adjusted?.horror != null) extraHorror = adjusted.horror - enemy.horror
  attack.plannedDamage = enemy.damage + extraDamage
  attack.plannedHorror = enemy.horror + extraHorror
  const attackText = label || `🗡️ 「${enemy.name}」攻击 ${inv.name}：${enemy.damage + extraDamage} 点伤害、${enemy.horror + extraHorror} 点恐惧。`
  info(state, events, attackText, { kind: 'attack', direction: 'incoming', phase: state.phase, round: state.round,
    attackKind: attack.kind,
    code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code, name: enemy.name, text: attackText,
    effect: 'attack', seat: inv.seat, enemyId: enemy.id, location: inv.location, damage: enemy.damage + extraDamage, horror: enemy.horror + extraHorror })
  const damageBefore = inv.damage || 0
  const horrorBefore = inv.horror || 0
  if (!inv.defeated && !tryAquinnahRedirect(state, enemy, inv, events, extraDamage, extraHorror)) {
    applyHarm(state, inv, enemy.damage + extraDamage, enemy.horror + extraHorror, events, false, { enemy, location: inv.location })
  }
  // 实际落到调查员身上的伤害/恐惧（被取消、被防止或转移时为 0）。
  attack.damage = Math.max(0, (inv.damage || 0) - damageBefore)
  attack.horror = Math.max(0, (inv.horror || 0) - horrorBefore)
  scenarioBehavior(state).enemyAttackResolved?.(state, enemy, inv, scenarioRuntime(state, events), attack)
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
        // Phase 5：用 resolve 实现的免费能力没有 effect 数据体，可行性由 resolve 自己判断。
        if (ability.cost?.action !== false || !canAffordAbility(state, inv, asset, ability)
          || (!ability.descriptor?.resolve && effectError(state, inv, ability.effect))) continue
        if (!lolaCanUseCard(inv, asset.code)) continue
        // 能力层：免费能力只在它声明的窗口里出现（旧 DSL 能力没有 trigger，行为不变）。
        if (ability.windowTrigger?.length && !ability.windowTrigger.includes(timing)) continue
        if (ability.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) continue
        if (ability.oncePerTest && state.skillTest?.usedAbilities?.[`${asset.id}:${index}`]) continue
        if (ability.oncePerPhase && inv.usedAbilities?.[`${asset.id}:${index}:${state.round}:${state.phase}`]) continue
        if (ability.descriptor && limitUsed(state, inv, ability.descriptor, null, timing, asset)) continue
        const targets = abilityTargets(state, inv, ability.effect)
        for (const targetId of targets.length ? targets.map(target => target.id) : [null]) options.push({
          id: `${asset.id}:${index}:${targetId || ''}`, label: `${cardName(asset.code)}：${ability.label}`,
          assetId: asset.id, index, targetId,
        })
      }
    }
    if (!options.length) { passed++; continue }
    const answer = requestChoice(state, { kind: 'playerWindow', source: timing, seat: inv.seat,
      prompt: `${playerWindowLabel(timing)}：可以使用免费触发能力，或让过。`, canSkip: true,
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
  const previousTreachery = state._treacheryResolving
  state._treacheryResolving = t.code
  try {
    return resolveTreacheryBody(state, inv, t, events)
  } finally {
    if (previousTreachery === undefined) delete state._treacheryResolving
    else state._treacheryResolving = previousTreachery
  }
}

function resolveTreacheryBody(state, inv, t, events) {
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
  // 「无视卡牌效果」通用开关（失落时代 P2，04048「忽略每个林中暗箭」）。
  if (scenarioBehavior(state).ignoreTreachery?.(state, t.originalCode || t.code, t) === true) {
    info(state, events, `⛔ 「${t.name}」的效果被忽略。`)
    return
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
    performTest(state, inv.seat, t.test.skill, t.test.difficulty, { source: { type: 'encounter', name: t.name, code: t.originalCode || t.code, label: '遭遇检定', scenarioAbility: true }, peril: !!t.peril, resolve: r => {
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
      // 走统一入口：密谋毁灭的每次放置都要让剧本看到（04282/04283 的强制）。
      addDoom(state, fx.amount, events)
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
        placeDoomOnCard(state, target, fx.amount, events, { silent: true })
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

// 从收藏里随机获得一张基础弱点并洗入牌库（04165「查找收藏」）。
// 只从 BASIC_WEAKNESSES 里挑、跳过牌库里已有的同名卡；没有可选牌时给中文提示。
function addBasicWeakness(state, inv, events, traits = ['madness', 'injury']) {
  const wanted = new Set(traits.map(trait => String(trait).toLowerCase()))
  const pool = Object.values(BASIC_WEAKNESSES).filter(def =>
    (def.traits || []).some(trait => wanted.has(String(trait).toLowerCase()))
    && !inv.deck.includes(def.code) && !inv.discard.includes(def.code))
  if (!pool.length) {
    info(state, events, `${inv.name} 的收藏里没有可用的基础弱点。`)
    return null
  }
  const pick = pool[Math.floor(randomValue(state) * pool.length)]
  inv.deck.push(pick.code)
  inv.deck = shuffle(inv.deck, () => randomValue(state))
  info(state, events, `🃏 ${inv.name} 从收藏中随机获得基础弱点「${pick.nameZh || pick.name}」，并洗入牌库。`)
  return pick.code
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
        if (doomCost) placeDoomOnCard(state, a, doomCost, events, { silent: true })
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
      if (target) { placeDoomOnCard(state, target, fx.amount || 1, events, { silent: true }); info(state, events, `🌑 「${target.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeDoomOnEachCultist': {
      const cultists = state.enemies.filter((e) => (e.traits || []).some((t) => t.toLowerCase() === 'cultist'))
      for (const e of cultists) { placeDoomOnCard(state, e, fx.amount || 1, events, { silent: true }); info(state, events, `🌑 「${e.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
      break
    }
    case 'placeDoomOnNearestEnemy': {
      const target = nearestEnemyByTrait(state, inv.location)
      if (target) { placeDoomOnCard(state, target, fx.amount || 1, events, { silent: true }); info(state, events, `🌑 「${target.name}」上放置 ${fx.amount || 1} 点毁灭。`) }
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
  // 「纳克特手稿」：本回合下一场检定不揭示混乱标记。
  if (inv.nextTestNoTokens?.round === state.round) {
    delete inv.nextTestNoTokens
    state.skillTest.skipTokens = true
  }
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

  // 「追忆未来」等：技能检定开始（投入之前）的反应窗口。
  {
    const context = { when: 'testBegins', seat, location: inv.location, skill, difficulty, baseValue: statReference }
    triggerReaction(state, seat, 'testBegins', events, context)
    reactionWindow(state, 'testBegins', { ...context, prompt: `${inv.name} 的${SKILL_NAMES[skill]}检定开始` }, events)
  }
  // 「手稿」等：显现效果期间的检定可以提前取消混乱标记。
  if (state._treacheryResolving) {
    const context = { when: 'revelationTest', seat, location: inv.location, skill, difficulty }
    triggerReaction(state, seat, 'revelationTest', events, context)
    for (const other of aliveInvestigators(state).filter(owner => owner.location === inv.location)) {
      if (other.seat !== seat) triggerReaction(state, other.seat, 'revelationTestAlly', events, context)
    }
  }

  // A personal test stays with its owner until they explicitly ask for help.
  playerWindow(state, 'test.beforeCommit', events, seat)
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skill, events)
  state.skillTest.stage = 'ST.2'

  const committed = []
  const committedCodes = new Set()
  const commitments = []
  // Phase 5（5a-5）：远程投入的判据改成「控制着带 remoteCommit 标记的支援」
  // （原来是 `other.code === '03002' && 有 '03010'`）。卡面本来就是「缜密分析」授予、
  // 且该卡只能出现在潘明的牌库里，因此行为等价；引擎不再认这两张卡的卡号。
  const grantsRemoteCommit = person => person.assets.some(asset => registeredEntry(asset.code)?.passive?.remoteCommit)
  const remoteMinhs = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && grantsRemoteCommit(other))
  const helpers = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && other.location === inv.location && !remoteMinhs.includes(other))
  const testOwners = [inv, ...remoteMinhs]
  // Phase 2（C1）：capability:commit —— 不能投入卡牌（队友投入不受影响）。
  const cannotCommit = capabilityBlocked(state, inv, 'commit')
  for (const owner of testOwners) {
    let count = 0
    while (true) {
      state.skillTest.value = value + getStat(state, inv, skill) - statReference
      const candidates = owner.hand.map((code, index) => ({ code, index }))
        .filter(() => !(cannotCommit && owner === inv))
        .filter(item => {
          const rule = hiddenRule(state, item.code)
          if (hasHiddenCard(owner, item.code)) return rule?.allowCommit === true
          return runtimeCardAvailable(state, owner, item.code) && !isWeaknessCode(item.code)
            && (commitIcons(state, owner, item.code, skill) > 0 || commitProfile(item.code)?.anySkill === true)
        })
        .filter(item => lolaCanUseCard(owner, item.code))
        .filter(item => !activeHiddenRules(state, owner).some(hidden =>
          hidden.rule.cannotCommitTypes?.includes(cardDef(item.code)?.type)))
        .filter(item => scenarioBehavior(state).canCommitCard?.(state, owner, item.code) !== false)
        .filter(item => owner === inv || !commitProfile(item.code)?.selfTestOnly)
        .filter(item => !commitProfile(item.code)?.requireClueAtLocation || (state.locations.find(loc => loc.id === owner.location)?.clues || 0) > 0)
        .filter(item => !commitProfile(item.code)?.requireDifficultyAboveBase
          || difficulty - getStat(state, inv, skill) >= commitProfile(item.code).requireDifficultyAboveBase)
        .filter(item => commitProfile(item.code)?.remainingSanityAtMost == null
          || getMaxSanity(owner) - owner.horror <= commitProfile(item.code).remainingSanityAtMost)
        .filter(item => !commitProfile(item.code)?.requireEngagedEnemy || enemiesEngagedWith(state, owner).length > 0)
        .filter(item => !commitProfile(item.code)?.maxPerTest
          || commitments.filter(committed => committed.code === item.code).length < commitProfile(item.code).maxPerTest)
        // 「重拾信念」等：可投入任意类型检定（不要求匹配图标）。
        .filter(item => hasHiddenCard(owner, item.code) || commitProfile(item.code)?.anySkill || commitIcons(state, owner, item.code, skill) > 0 || committedCodes.has(item.code))
        // 「殊死一搏」：只能单独投入。
        .filter(item => hasHiddenCard(owner, item.code) || !commitProfile(item.code)?.noOtherCommits || commitments.length === 0)
        // 已投入「殊死一搏」时不能再投入其他牌。
        .filter(item => !commitments.some(committed => commitProfile(committed.code)?.noOtherCommits)
          || item.code === commitments[0]?.code)
        // 「参透真谛」：只能投入冒险卡印刷能力的检定。
        .filter(item => hasHiddenCard(owner, item.code) || !commitProfile(item.code)?.scenarioAbilityOnly
          || options.source?.scenarioAbility === true)
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
      let icons = commitIcons(state, owner, code, skill)
      // 「殊死一搏」：手牌越多失去越多万能图标；「占据先机」：本阶段每个行动减少 1 个万能图标。
      const skillRules = commitProfile(code)
      if (skillRules?.wildLosesPerHandCard) icons = Math.max(0, icons - owner.hand.length)
      if (skillRules?.wildLosesPerActionsThisPhase) {
        const performed = state.phaseActionCount || 0
        icons = Math.max(0, icons - performed)
      }
      const skillEffect = commitProfile(code)
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
      if (owner !== inv && commitProfile(code)?.leadership) icons += skill === 'willpower' ? 2 : 1
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
    const analyticalMind = owner.assets.find(asset => !asset.exhausted
      && registeredEntry(asset.code)?.passive?.analyticalMind)
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
  const doubleOrNothing = commitments.some(item => commitProfile(item.code)?.doubleDifficultyAndRewards)
  if (doubleOrNothing) {
    difficulty *= 2
    state.skillTest.difficulty = difficulty
    info(state, events, `「孤注一掷」使本次检定难度翻倍至 ${difficulty}；成功效果将结算两次。`)
  }
  let defiedToken = null
  if (commitments.some(item => commitProfile(item.code)?.defiance)) {
    defiedToken = requestChoice(state, { kind: 'token', source: '02190', seat, prompt: '蔑视：选择本次检定要忽略的混乱符号。',
      options: ['skull', 'cultist', 'tablet', 'elderthing'].map(id => ({ id, label: tokenLabel(id) })) })
  }
  playerWindow(state, 'test.afterCommit', events, options.peril || !state.skillTest.helpRequested ? seat : null)
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skill, events)
  value += getStat(state, inv, skill) - statReference
  state.skillTest.stage = 'ST.3'
  const sealElderSign = commitments.some(item => commitProfile(item.code)?.elderSignInsteadOfChaos)
  const closeTest = resolved => {
    state.skillTest.stage = 'ST.8'
    for (const item of state.skillTest.committed) {
      if (commitProfile(item.code)?.exileAfterTest) {
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

  let summary = null
  const resolveResult = result => {
    // 「第七印记的封印」（04311）：任何技能检定期间揭示符号标记后移除 1 充能；
    // 充能耗尽时移出游戏（离场时移出由 leaveAsset 处理）。
    const symbols = ['skull', 'cultist', 'tablet', 'elderthing']
    if ((result.drawn || []).some(token => symbols.includes(token))) {
      for (const owner of state.investigators) {
        for (const asset of owner.assets.slice()) {
          const amount = EFFECTS[asset.code]?.chargesOnSymbolReveal || 0
          if (!amount) continue
          asset.uses = Math.max(0, (asset.uses || 0) - amount)
          info(state, events, `🔮 「${cardName(asset.code)}」移除 ${amount} 点充能（剩余 ${asset.uses}）。`)
          if ((asset.uses || 0) === 0 && EFFECTS[asset.code]?.removeFromGameWhenEmpty) {
            leaveAsset(state, owner, asset, events)
            info(state, events, `「${cardName(asset.code)}」没有充能，被移出游戏。`)
          }
        }
      }
    }
    // Public, confirmed result for the UI. Transaction replay already deduplicates
    // emitted events across choice pauses; no random draw happens in the client.
    state._resolution?.events.push({ type: 'presentation', kind: 'test', seat, name: inv.name,
      skill, value: result.value, difficulty: result.difficulty, success: result.success,
      autoFail: !!result.autoFail, drawn: [...result.drawn], source: state.skillTest.source })
    // Phase 2（B3）：标准化结果。三处共用一份：options.resolve 的入参、窗口的 ctx.result、
    // state.lastTestResult（结算后仍可读，随存档往返），以及 api.test() 的返回值。
    summary = summarizeTestResult(state.skillTest, { ...result, seat, skill })
    state.lastTestResult = summary
    // 就地写入：调用方（performTest 的返回值、afterTest、窗口条件）拿到的是同一个对象。
    result.summary = summary
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
  let elderMayMoveAfterTest = false
  let elderClueOnSuccessBy = 0
  let elderChosenReward = false
  const drawn = []
  const cancelledTokens = []
  const pendingOnFail = []
  let wendyRedrawUsed = false
  let strokeOfLuckExiled = false
  let extraChaosUsed = false
  const pendingTokens = []
  let guard = 0
  while (guard++ < 100) {
    if (inv.ignoreChaosThisTurn) { drawn.push('0'); break }
    // 「手稿」等：本次检定不揭示混乱标记。
    if (state.skillTest?.skipTokens && !state.skillTest.skipTokensUsed) {
      state.skillTest.skipTokensUsed = true
      info(state, events, `${inv.name} 本次检定不揭示混乱标记。`)
      drawn.push('0')
      break
    }
    let token = sealElderSign ? 'eldersign' : null
    if (token == null && pendingTokens.length) token = pendingTokens.shift()
    const extraChoices = Math.max(options.extraChaosChoices || 0, state.skillTest?.extraChaosChoices || 0)
    if (token == null && !extraChaosUsed && extraChoices > 0) {
      extraChaosUsed = true
      const pool = Array.from({ length: 1 + extraChoices }, () => drawChaosToken(state))
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
    // 失落时代：揭示前的替代与额外揭示（危险预感 / 奥利芙 / 黑暗预言）。
    if (token == null) {
      const plan = tfaBeforeChaosReveal(state, seat, inv, events)
      if (plan?.token) token = plan.token
      else if (plan?.count > 1) {
        const pool = Array.from({ length: plan.count }, () => drawChaosToken(state))
        const keep = Math.max(1, Math.min(pool.length, plan.choose || 1))
        const options = plan.symbolOnly
          ? pool.map((face, index) => ({ face, index })).filter(item => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(item.face))
          : pool.map((face, index) => ({ face, index }))
        const usable = options.length ? options : pool.map((face, index) => ({ face, index }))
        const picked = []
        const remaining = [...usable]
        for (let pick = 0; pick < keep && remaining.length; pick++) {
          const answer = remaining.length === 1 ? '0' : requestChoice(state, {
            kind: 'token', source: plan.source || 'tfaReveal', seat,
            prompt: `${usable.length === pool.length ? `揭示 ${pool.length} 个混乱标记` : `揭示 ${pool.length} 个混乱标记，其中只有 ${usable.length} 个带有符号`}，选择第 ${pick + 1} 个要结算的标记。`,
            options: remaining.map((item, index) => ({ id: String(index), label: tokenLabel(item.face) })),
          })
          const chosen = remaining.splice(Number(answer) || 0, 1)[0]
          picked.push(chosen.index)
        }
        for (let index = 0; index < pool.length; index++) {
          if (!picked.includes(index)) returnChaosToken(state, pool[index])
        }
        token = pool[picked[0]]
        for (const extra of picked.slice(1)) pendingTokens.push(pool[extra])
        info(state, events, `${inv.name} 揭示了 ${pool.length} 个混乱标记（${pool.map(face => tokenLabel(face)).join('、')}），结算 ${picked.map(index => tokenLabel(pool[index])).join('、')}。`)
      }
    }
    if (token == null) token = codexSealedElderSign(state, inv, seat, events)
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
    // 「逆反」：忽略本次检定所有符号标记的效果（含修正值）。
    const ignoreSymbolEffects = commitments.some(item => commitProfile(item.code)?.ignoreSymbolEffects)
    token = ignoreSymbolEffects ? token
      : scenarioBehavior(state).chaosTokenRevealed?.(state, inv, token, scenarioRuntime(state, events)) || token
    // 马泰奥神父：任何调查员揭示 autofail 时，改为 elder_sign（每局一次）。
    if (token === 'autofail') {
      const mateo = aliveInvestigators(state).find(owner => owner.code === '04004'
        && INVESTIGATOR_ABILITIES[owner.code]?.autofailToElderSign && !owner.mateoSignUsed
        && !investigatorTextBlanked(state, owner))
      if (mateo) {
        const answer = requestChoice(state, { kind: 'reaction', source: '04004', seat: mateo.seat, canSkip: true,
          prompt: `揭示了 ${tokenLabel(token)}，是否取消它并改为 ${tokenLabel('eldersign')}（每局一次）？`,
          options: [{ id: 'skip', label: '保留自动失败' }, { id: 'trigger', label: '改为旧印' }] })
        if (answer === 'trigger') {
          mateo.mateoSignUsed = true
          returnChaosToken(state, token)
          token = 'eldersign'
          info(state, events, `✨ ${mateo.name} 取消了自动失败标记，改为结算 ${tokenLabel('eldersign')}（本局一次已用）。`)
        }
      }
    }
    drawn.push(token)
    state.skillTest.currentToken = token
    state.skillTest.cancelledSymbol = null
    // 「追忆未来」：揭示了指定的混乱标记时横置支援并 +2。
    const named = state.skillTest.namedToken
    if (named && named.token === token) {
      const recall = inv.assets.find(asset => asset.id === named.assetId)
      if (recall) {
        recall.exhausted = true
        value += 2
        info(state, events, `「${cardName(recall.code)}」命中了指定的 ${tokenLabel(token)}，本次检定 +2。`)
      }
      delete state.skillTest.namedToken
    }
    // 「反击法术」：在符号标记结算前取消它（不揭示替代标记）。
    if (['skull', 'cultist', 'tablet', 'elderthing'].includes(token) && !ignoreSymbolEffects) {
      reactionWindow(state, 'symbolRevealed', { when: 'symbolRevealed', seat, location: inv.location, token,
        prompt: `${inv.name} 的检定揭示了 ${tokenLabel(token)}` }, events)
    }
    if (state.skillTest.cancelledSymbol === token) {
      info(state, events, `「${cardName('04110')}」取消了 ${tokenLabel(token)}。`)
      lastTokenDelta = 0
      break
    }
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token) && !ignoreSymbolEffects) {
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
    if (token === 'autofail') {
      autoFail = true
      const stone = inv.assets.find(asset => EFFECTS[asset.code]?.returnToHandOnAutoFail)
      if (stone) {
        leaveAsset(state, inv, stone, events)
        inv.hand.push(stone.code)
        info(state, events, `「${cardName(stone.code)}」在揭示自动失败后返回手牌。`)
      }
      break
    }
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
        const es = elderSignEffect(state, inv, events)
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
        elderMayMoveAfterTest = !!es.mayMoveAfterTest
        elderClueOnSuccessBy = es.clueOnSuccessBy || 0
        elderChosenReward = !!es.chosenReward
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
      if (pendingTokens.length) continue
      break
    }
    const res = ignoreSymbolEffects && ['skull', 'cultist', 'tablet', 'elderthing'].includes(token)
      ? { delta: 0, onDraw: [], onFail: [] }
      : resolveSpecialToken(state, seat, inv, token, events)
    if (res.autoFail) autoFail = true
    if (res.cancelCommitted && !committedCancelled) {
      const cancelled = commitments.filter(item => cardDef(item.code)?.type === 'skill')
      value -= cancelled.reduce((sum, item) => sum + commitIcons(state, state.investigators[item.seat], item.code, skill), 0)
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
    if (res.drawAnother) continue
    if (pendingTokens.length) continue
    break
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
      const es = elderSignEffect(state, inv, events)
      delta += es.delta
      elderAutoSuccess = !!es.autoSuccess
      elderReturnCommittedSkill = !!es.returnCommittedSkill
      elderMayMoveAfterTest = !!es.mayMoveAfterTest
      elderClueOnSuccessBy = es.clueOnSuccessBy || 0
      elderChosenReward = !!es.chosenReward
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
    triggerReaction(state, seat, 'skillTestFail', events, { skill, difficulty, failedBy: Math.max(0, difficulty),
      committed: commitments.map(item => ({ ...item })) })
    const result = { success: false, value: 0, difficulty, skill, token: 'autofail', committed, autoFail: true, drawn, cancelledTokens, source: options.source || null, damageBonus: 0, clueBonus: 0 }
    state.skillTest.stage = 'ST.7'
    resolveResult(result)
    scenarioBehavior(state).afterTest?.(state, inv, result, scenarioRuntime(state, events))
    tfaFailedTestWindow(state, seat, { skill, difficulty, baseValue: statReference, source: options.source,
      peril: options.peril, resolve: options.resolve, failedBy: difficulty }, events)
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
    // Phase 2（B3）：窗口上下文带上标准化的当前结果（ctx.result），
    // 内容层不需要再从 testValue/difficulty 自己算差额。
    const context = { when: 'testWouldFail', seat, location: inv.location, skill, difficulty, testValue: value,
      testBonus: 0, prompt: '技能检定将要失败', result: pendingTestResult(state.skillTest) }
    reactionWindow(state, 'testWouldFail', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  value = Math.max(0, value)
  if (!elderAutoSuccess && value >= difficulty) {
    const context = { when: 'wouldSucceedTest', seat, location: inv.location, skill, difficulty, testValue: value,
      testBonus: 0, prompt: '技能检定将要成功', result: pendingTestResult(state.skillTest) }
    reactionWindow(state, 'wouldSucceedTest', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  state.skillTest.value = value
  state.skillTest.stage = 'ST.6'
  const success = elderAutoSuccess || value >= difficulty
  // 「埃兹特里之牙」：结算诡计卡上的能力时检定成功后可以横置抽牌。
  if (success && state._treacheryResolving) {
    triggerReaction(state, seat, 'treacheryTestSuccess', events, { location: inv.location, skill, cardCode: state._treacheryResolving })
  }
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
  // 「挥金如土」等：检定成功后的额外结算。
  if (success && state.skillTest?.extraOnSuccess?.length) {
    const extras = state.skillTest.extraOnSuccess
    state.skillTest.extraOnSuccess = []
    for (const fx of extras) resolveEffect(state, seat, fx, makeRuntime(state, events))
  }
  // 失落的时代旧印的后续结算（芬恩线索 / 厄休拉移动 / 马泰奥二选一）。
  if (success && elderClueOnSuccessBy && value - difficulty >= elderClueOnSuccessBy) {
    const answer = requestChoice(state, { kind: 'reaction', source: 'finnElderSign', seat, canSkip: true,
      prompt: '旧印：是否发现你所在地点的 1 个线索？',
      options: [{ id: 'skip', label: '不发现' }, { id: 'trigger', label: '发现 1 个线索' }] })
    if (answer === 'trigger') discoverClueAt(state, inv, 1, events)
  }
  if (success && elderMayMoveAfterTest) {
    const destinations = investigatorMoveDestinations(state, seat, {})
    if (destinations.length) {
      const answer = requestChoice(state, { kind: 'move', source: 'ursulaElderSign', seat, canSkip: true,
        prompt: '旧印：是否移动到连接地点？',
        options: [{ id: 'skip', label: '留在原地' },
          ...destinations.map(id => ({ id, label: locName(state, id) }))] })
      if (answer !== 'skip') relocateInvestigator(state, seat, answer, events)
    }
  }
  if (elderChosenReward && success) {
    const options = [{ id: 'draw', label: '抽取 1 张牌并获得 1 资源' }]
    if (state.currentSeat === seat) options.push({ id: 'action', label: '本回合额外 1 次行动' })
    const answer = requestChoice(state, { kind: 'effect', source: 'mateoElderSign', seat,
      prompt: '旧印：选择一项结算。', options })
    if (answer === 'action') { inv.actionsLeft += 1; info(state, events, `${inv.name} 获得 1 次额外行动。`) }
    else {
      for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
      inv.resources += 1
      info(state, events, `${inv.name} 抽取 1 张牌并获得 1 资源。`)
    }
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
  if (!success) triggerReaction(state, seat, 'skillTestFail', events, { skill, difficulty, failedBy: Math.max(0, difficulty - value),
    committed: commitments.map(item => ({ ...item })) })
  // 技能牌失败奖励（如「重拾信念」）。
  if (!success) {
    for (const item of commitments) {
      const fail = commitProfile(item.code)?.onFail
      if (!fail) continue
      const owner = state.investigators[item.seat]
      if (fail.draw) for (const line of drawCards(state, owner, fail.draw, events)) info(state, events, line)
      if (fail.resources) owner.resources += fail.resources
      info(state, events, `${owner.name} 的「${cardName(item.code)}」检定失败奖励已结算。`)
    }
  }
  const result = { success, value, difficulty, skill, token: drawn.at(-1), committed, autoFail, drawn, elderSign, cancelledTokens,
    rewardMultiplier: doubleOrNothing && success ? 2 : 1, source: options.source || null, ...skillFx }
  if (success && elderSign && !investigatorTextBlanked(state, inv)) result.damageBonus += INVESTIGATOR_ABILITIES[inv.code]?.elderSign?.attackDamageBonus || 0
  state.skillTest.stage = 'ST.7'
  resolveResult(result)
  scenarioBehavior(state).afterTest?.(state, inv, result, scenarioRuntime(state, events))
  if (success) {
    const successBy = value - difficulty
    for (const commitment of commitments) {
      const threshold = commitProfile(commitment.code)?.returnOnSuccessBy
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
  // 「学无止境」：检定失败并结算完后重新尝试该检定。
  if (!success) {
    tfaFailedTestWindow(state, seat, { skill, difficulty, baseValue: statReference, source: options.source,
      peril: options.peril, resolve: options.resolve, failedBy: Math.max(0, difficulty - value) }, events)
  }
  // 检定结束：本次检定内的效果到期（A1）。
  for (const effect of expireEffects(state, 'endOfTest')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（本次检定结束）。`)
  }
  return {
    success, value, difficulty,
    token: drawn[drawn.length - 1],
    committed, autoFail, drawn, elderSign, cancelledTokens,
    damageBonus: skillFx.damageBonus,
    clueBonus: skillFx.clueBonus,
    evadeDisengage: skillFx.evadeDisengage,
    mayMoveAfterEvade: skillFx.mayMoveAfterEvade,
    // Phase 2（B3）：标准化结果（同步结算时直接可用；异步/多次选择的检定读 state.lastTestResult）。
    summary,
  }
}

// 「学无止境」使用的失败后窗口；同时把上一场失败检定的信息留给重试效果。
// 检定的 resolve 回调不可序列化，因此挂在 WeakMap 上，不进入对局状态。
const failedTestResolves = new WeakMap()
function tfaFailedTestWindow(state, seat, context, events) {
  const { resolve, ...serializable } = context
  state.lastFailedTest = { seat, ...serializable, round: state.round }
  if (typeof resolve === 'function') failedTestResolves.set(state, resolve)
  reactionWindow(state, 'skillTestFailed', { when: 'skillTestFailed', seat,
    location: state.investigators[seat]?.location, skill: context.skill, difficulty: context.difficulty,
    peril: context.peril, prompt: '技能检定失败并结算完毕' }, events)
}
// 古代抄本：揭示前弃掉本卡，改为结算封印其上的旧印标记。
function codexSealedElderSign(state, inv, seat, events) {
  const codex = inv.assets.find(asset => (EFFECTS[asset.code]?.substituteSealedElderSign
    || registeredEntry(asset.code)?.substituteSealedElderSign)
    && (state.chaos?.sealed || []).some(entry => entry.source === asset.id && entry.token === 'eldersign'))
  if (!codex) return null
  const answer = requestChoice(state, { kind: 'reaction', source: codex.id, seat, canSkip: true,
    prompt: '古代抄本：是否弃掉它并结算封印的旧印标记？',
    options: [{ id: 'skip', label: '照常揭示混乱袋' }, { id: 'trigger', label: '结算封印的旧印' }] })
  if (answer !== 'trigger') return null
  leaveAsset(state, inv, codex, events)
  inv.discard.push(codex.code)
  info(state, events, `${inv.name} 弃掉「${cardName(codex.code)}」，改为结算封印的 ${tokenLabel('eldersign')}。`)
  return 'eldersign'
}

function elderSignEffect(state, inv, events = []) {
  // 剧本可以整体替换旧印效果（如 04244 伊斯人身体：+2、抽 1 张）。
  const scenarioEffect = scenarioBehavior(state).elderSign?.(state, inv, scenarioRuntime(state, events))
  if (scenarioEffect) return scenarioEffect
  if (investigatorTextBlanked(state, inv)) return { delta: 0 }
  // 能力层：调查员的旧印效果写在 card-abilities.js（kind: 'elderSign'），
  // 与卡牌能力共用同一套描述子、同样可被测试与审计枚举。
  const registered = elderSignDescriptor(inv.code)
  if (registered) {
    const ctx = {
      state, seat: inv.seat, inv, source: { investigator: inv.seat, code: inv.code },
      descriptor: registered, window: 'eldersign', context: {}, events,
      api: abilityApi(state, events),
    }
    return registered.resolve?.(ctx) || { delta: 0 }
  }
  // 21 位可玩调查员的旧印全部迁移到能力层（src/cards/card-abilities.js）；
  // 未登记的新调查员在补描述子之前按默认 +1 结算。
  return { delta: 1 }
}

function applySkillOnSuccess(state, inv, committed, success, successBy = 0) {
  const out = { damageBonus: 0, clueBonus: 0, evadeDisengage: false, mayMoveAfterEvade: false, homeFrontDamage: 0 }
  if (!success) {
    for (const code of committed) if (inv.carcosaWagers) delete inv.carcosaWagers[code]
    return out
  }
  for (const code of committed) {
    const s = commitProfile(code)
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
    // 「孤注一掷」：按成功超出难度的点数抽牌，抽到的弱点洗回牌库而不是结算。
    if (o.drawPerSuccessBy) {
      const amount = Math.min(o.maxDraw || 5, Math.max(0, successBy) * o.drawPerSuccessBy)
      let drawn = 0
      for (let index = 0; index < amount; index++) {
        if (!inv.deck.length) break
        const drawnCode = inv.deck.pop()
        if (isWeaknessCard(cardDef(drawnCode))) {
          inv.deck = shuffle([...inv.deck, drawnCode], () => randomValue(state))
          continue
        }
        inv.hand.push(drawnCode)
        drawn++
      }
      if (drawn) info(state, null, `${inv.name} 的「${cardName(code)}」触发：抽 ${drawn} 张牌。`)
    }
    // 「如痴如醉」：调查成功后在支援上放置充能或秘密。
    if (o.placeChargeOrSecret) tfaPlayerEffect(state, inv.seat, { action: 'placeChargeOrSecret' }, [])
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
    // 「英勇无畏」：检定成功后把技能牌本身作为支援留在场上。
    if (o.becomeAsset) {
      const spec = o.becomeAsset
      const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round,
        statBonus: { ...(spec.stats || {}) }, tfaRoundEndDiscard: state.round })
      inv.assets.push(asset)
      info(state, null, `${inv.name} 的「${cardName(code)}」作为支援进入游戏区域，并在轮末弃掉。`)
      triggerReaction(state, inv.seat, 'assetEnteredPlay', [], { assetCode: code, assetId: asset.id, location: inv.location })
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
    // 「不能被击败」（04209b 羽翼蛇族等）：引擎在每次击败判定前读这个字段。
    cannotBeDefeated: !!def.cannotBeDefeated,
    // 「横置时也能反击 / 也能攻击」（04062 瓦卢西亚的预示者、04078 蝮蛇类）：
    // 由卡面数据登记，引擎在反击与敌人阶段两处放行。
    retaliateWhileExhausted: !!def.retaliateWhileExhausted,
    attacksWhileExhausted: !!def.attacksWhileExhausted,
    immobile: !!def.immobile,
    massive: def.massive, prey: def.prey, forcedDoom: def.forcedDoom, parleyCost: def.parleyCost || 0,
    uniqueCultist: !!def.uniqueCultist, evadeToVictory: !!def.evadeToVictory,
    bearerSeat: isWeaknessCode(code) || def.prey === 'bearer' ? engagedSeat : null,
    drawnBySeat: engagedSeat,
    victory: def.victory || 0, vengeance: def.vengeance || 0,
    traits: def.traits || [],
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

// 由剧本现场生成、不在卡牌目录里的敌人（04331 纽约遗址的飞天水螅）。
// stats 提供印刷数值；extra 放实例标记（例如 underlyingCard = 被当作敌人的那张牌）。
function spawnStoryEnemy(state, code, locationId, stats = {}, extra = {}, events = []) {
  if (!locationExists(state, locationId)) return null
  const enemy = {
    id: newEnemyId(state), code, originalCode: code,
    name: stats.name || code,
    fight: stats.fight ?? 0, evade: stats.evade ?? 0, health: stats.health ?? 1,
    damage: stats.damage ?? 0, horror: stats.horror ?? 0,
    hunter: !!stats.hunter, retaliate: !!stats.retaliate, alert: !!stats.alert,
    elite: !!stats.elite, aloof: !!stats.aloof, massive: !!stats.massive,
    traits: [...(stats.traits || [])], victory: stats.victory || 0, vengeance: 0,
    damageTaken: 0, exhausted: false, doom: 0, engagedSeat: null, location: locationId,
    ...extra,
  }
  state.enemies.push(enemy)
  scenarioBehavior(state).enemySpawned?.(state, enemy, scenarioRuntime(state, events))
  autoEngageAt(state, locationId, events)
  return enemy
}

function processPlayerEnemyEntry(state, enemy, events, spawned = false) {  const attachments = state.playerLocationAttachments || []
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
  // 「猎物 - 手牌最多」：数值越小越优先，所以取负。
  mostHand: (state, inv) => -inv.hand.length,
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

// 供内容层与测试查询「这只敌人的猎物是谁」：并列时由队长选择（会走待决选择）。
export function preySeatForTest(state, enemy, candidates) {
  return preyTarget(state, enemy, candidates)
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
  // 「煤油」等需要知道本地点本轮是否有敌人被击败。
  const defeatedAt = state.locations.find(location => location.id === enemy.location)
  if (defeatedAt) defeatedAt.enemyDefeatedRound = state.round
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
  // 04147 伊塔卡：敌人加入胜利区后，可横置伊塔卡治愈自己与它各 1 点恐惧。
  for (const holder of aliveInvestigators(state)) {
    const ichtaca = holder.assets.find(asset => asset.code === '04147'
      && !asset.exhausted && (EFFECTS[asset.code]?.exhaustOnEnemyDefeatedHealHorror
        ?? registeredEntry(asset.code)?.exhaustOnEnemyDefeatedHealHorror))
    if (!ichtaca) continue
    const answer = requestChoice(state, {
      kind: 'reaction', source: '04147', seat: holder.seat, canSkip: true,
      prompt: '伊塔卡：横置她，治愈你与伊塔卡各 1 点恐惧？',
      options: [{ id: 'heal', label: '横置伊塔卡并各治愈 1 点恐惧' }, { id: 'skip', label: '不发动' }],
    })
    if (answer !== 'heal') continue
    ichtaca.exhausted = true
    holder.horror = Math.max(0, (holder.horror || 0) - 1)
    ichtaca.horror = Math.max(0, (ichtaca.horror || 0) - 1)
    info(state, events, `💚 ${holder.name} 横置伊塔卡，治愈自己与伊塔卡各 1 点恐惧。`)
  }
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
    && (entityRuleActive(state, enemy, 'cannot:beDamaged')
      || scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, source, seat) === false)) return false
  // 「职业杀手」：本回合该敌人下次受到的伤害 +1（一次性）。
  let total = amount
  if (enemy.tfaDamageBonus?.round === state.round) {
    total += enemy.tfaDamageBonus.amount || 0
    delete enemy.tfaDamageBonus
  }
  // 幽嘶蛇人：每次受到攻击少受 1 点伤害（失落时代 M3 的通用减伤字段）。
  if (enemy.tfaDamageReduction) total = Math.max(0, total - enemy.tfaDamageReduction)
  enemy.damageTaken = (enemy.damageTaken || 0) + total
  enemy.defeatedBy = seat
  scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events))
  if (enemy.damageTaken >= enemyHealth(state, enemy)
    && enemyCanBeDefeated(state, enemy, source, seat)) defeatEnemy(state, enemy, events)
  return true
}

// 胜利点 + 独特异教徒盘问记录。
function addVictory(state, enemy, events) {
  const originalCode = enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code
  const vengeance = enemy.vengeance || enemyDef(enemy.code)?.vengeance || 0
  // 复仇：带复仇点数的敌人被击败时同样进入胜利区（即使没有胜利点）。
  if (Object.hasOwn(ALL_CARDS[originalCode] || {}, 'victory') || enemy.victory > 0 || vengeance > 0 || enemy.uniqueCultist) {
    if (!state.victoryDisplay.some(card => card.id === enemy.id)) state.victoryDisplay.push({
      id: enemy.id, code: enemy.code, originalCode, victory: enemy.victory || 0,
      ...(vengeance ? { vengeance } : {}),
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
  if (vengeance) info(state, events, `🐍 「${enemy.name}」带有 ${vengeance} 点复仇。`)
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
  // 命运之线这类「多格幕牌库」剧本会在 actReveal 里自己重算当前幕；
  // 有 actIndexAfterAdvance 钩子时以它为准，避免再 ++ 一次而漂移。
  const advanceIndex = scenarioBehavior(state).actIndexAfterAdvance?.(
    state, cur, scenarioRuntime(state, events))
  if (Number.isInteger(advanceIndex)) state.actIndex = advanceIndex
  else state.actIndex++
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

function placeLocation(state, id, events, seat = null) {
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
  // 印刷就是 0 线索的地点（如 04227 深入幽嘶）：入场即视为「已被完全调查」，
  // 胜利/复仇点数立刻进胜利区（否则地点复仇 2 永远不会计入）。
  if (loc.revealed) awardLocationVictory(state, loc, events)
  // 杰克·威廉斯：新地点入场后可以横置并抽牌（仅限放置该地点的调查员）。
  if (seat != null) {
    const placer = state.investigators[seat]
    if (placer?.assets.some(asset => assetPassiveData(asset.code)?.noOpportunityFirstAction)) {
      triggerReaction(state, seat, 'locationRevealed', events, { when: 'locationRevealed', seat, location: id })
    }
  }
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
    // D1：地点卡自己的声明式线索修正；剧本钩子仍然优先（历史数据依赖它的覆盖语义）。
    const clueDelta = entityModifierTotal(state, loc, 'locationClues')
    const clueOverride = scenarioBehavior(state).cluesOnReveal?.(state, loc, seat == null ? null : state.investigators[seat])
    loc.clues = Math.max(0, clueOverride ?? ((loc.maxClues || 0) + clueDelta))
    info(state, events, `「${loc.name}」被揭示。`, locationRevealCue(loc, false, seat))
    awardLocationVictory(state, loc, events)
    const ignored = seat != null
      && (entityRuleActive(state, loc, 'ignore:revealText')
        || scenarioBehavior(state).ignoreLocationRevealText?.(state, state.investigators[seat], loc))
    if (!ignored) scenarioBehavior(state).locationRevealed?.(state, loc, scenarioRuntime(state, events), seat)
    if (seat != null) triggerReaction(state, seat, 'locationRevealed', events, { when: 'locationRevealed', seat, location: loc.id })
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
          placeDoomOnCard(state, enemy, 1, events, { silent: true })
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
  if (!ag || state.status !== 'playing') return
  // 卡面目标型密谋（如 04284「每位调查员被击败」）：不靠毁灭阈值推进。
  if (ag.objective?.type === 'allDefeated'
    && !state.investigators.some(inv => !inv.defeated && !inv.resigned)) {
    advanceAgenda(state, events, 'objective')
    return
  }
  if (ag.doomThreshold == null) return
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

// 毁灭放置统一入口。剧本可以用 doomPlaced 钩子观察「每一次」放置：
//   04282 撼地之怒 / 04283 赤红深渊（密谋上）、04329 隐匿之城（异教徒敌人上）。
// 「手铐」（04265）在这里拦住非精英敌人的毁灭。
function placeDoomOnCard(state, card, amount, events, options = {}) {
  if (!card || !(amount > 0)) return 0
  const cuffed = (card.attachments || []).some(attachment => (attachment.originalCode || attachment.code) === '04265')
  if (cuffed && !card.elite) {
    if (options.silent !== true) {
      info(state, events, `🔒 「${card.name || cardName(card.code)}」被手铐铐住，不能在其上放置毁灭。`)
    }
    return 0
  }
  card.doom = (card.doom || 0) + amount
  scenarioBehavior(state).doomPlaced?.(state,
    { target: card, amount, agenda: false }, scenarioRuntime(state, events))
  return amount
}

function addDoom(state, amount, events) {
  state.doom += amount
  info(state, events, `🌑 密谋上增加 ${amount} 点毁灭（当前 ${state.doom}）。`)
  if (amount > 0) {
    scenarioBehavior(state).doomPlaced?.(state,
      { target: null, amount, agenda: true }, scenarioRuntime(state, events))
  }
  checkAgenda(state, events)
}

// ---------------------------------------------------------------------------
// 阶段机（神话 → 调查（3 行动）→ 敌人（猎手移动→交战→攻击）→ 重整）
// ---------------------------------------------------------------------------

function runMythos(state, repeated = false) {
  const events = []
  // 上一轮的「本轮内」效果在这里到期；神话阶段自身的临时效果在敌人阶段开始时到期。
  for (const effect of expireEffects(state, 'endOfRound')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（本轮结束）。`)
  }
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'mythos'
  state.phaseActionCount = 0
  if (!repeated) state.round += 1
  // 「轮末弃置」的支援（如柯尔特袖珍手枪）在新一轮开始时弃掉。
  if (!repeated) {
    for (const inv of state.investigators) {
      if (!inv || inv.defeated || inv.resigned) continue
      for (const asset of inv.assets.filter(item => EFFECTS[item.code]?.discardAtRoundEnd).slice()) {
        leaveAsset(state, inv, asset, [])
        inv.discard.push(asset.code)
      }
    }
  }
  state.doom += 1
  info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：密谋上放置 1 点毁灭（当前 ${state.doom}）。`,
    { kind: 'phase', phase: 'mythos', round: state.round, text: `密谋增加 1 点毁灭 · 当前 ${state.doom}`, effect: 'doom', delta: 1 })
  // 神话阶段的毁灭也是「放置毁灭」，剧本的强制要能看到（04282/04283）。
  scenarioBehavior(state).doomPlaced?.(state,
    { target: null, amount: 1, agenda: true }, scenarioRuntime(state, events))
  phaseBeginningWindow(state, events)
  checkAgenda(state, events)
  // 神话阶段「检查毁灭阈值」步骤结束后的剧本强制（04284 复仇等）。
  if (state.status === 'playing') scenarioBehavior(state).mythosDoomChecked?.(state, scenarioRuntime(state, events))
  if (state.status !== 'playing') return events
  for (const inv of aliveInvestigators(state)) {
    drawEncounter(state, inv, events)
  }
  playerWindow(state, 'mythos.afterEncounter', events)
  // 神话阶段结束强制：数据中的 mythosEndDoom。
  for (const enemy of state.enemies.slice()) {
    const doom = enemyTextBlanked(state, enemy) ? 0 : enemyDef(enemy.code)?.mythosEndDoom || 0
    if (doom > 0) {
      placeDoomOnCard(state, enemy, doom, events, { silent: true })
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
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'enemy'
  state.fogMod = 0
  info(state, events, '⚔️ 敌人阶段……', { kind: 'phase', phase: 'enemy', round: state.round, text: '猎手移动 · 交战 · 敌人攻击' })
  phaseBeginningWindow(state, events)
  scenarioBehavior(state).enemyPhaseStart?.(state, scenarioRuntime(state, events))
  reactionWindow(state, 'enemyPhaseBegins', { when: 'enemyPhaseBegins', prompt: '敌人阶段开始' }, events)

  // 1) 猎手移动
  for (const enemy of state.enemies.slice()) {
    if (!enemy.hunter || enemyTextBlanked(state, enemy) || enemy.engagedSeat != null || enemy.exhausted || enemy.immobile) continue
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
  // Phase 2（C1）：ignore:hunter —— 声明「敌人不把你当作猎手目标」的调查员不参与猎物计算。
  targets = targets.filter(i => !ruleIgnored(state, i, 'hunter'))
  if (!targets.length) return null
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
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'upkeep'
  info(state, events, '🔧 重整阶段……', { kind: 'phase', phase: 'upkeep', round: state.round, text: '重整卡牌 · 抽牌 · 获得资源' })
  phaseBeginningWindow(state, events)

  for (const inv of aliveInvestigators(state)) {
    inv.actionsLeft = 3 + extraActionBonus(inv)
    inv.exploreOnlyActions = exploreOnlyActionBonus(inv)
    inv.tomeActionUsed = false
    // 兼容清理：旧存档可能残留 phaseStatBonus(s)；新逻辑写 state.effects。
    inv.phaseStatBonus = null
    inv.phaseStatBonuses = []
    inv.fearExtraPaid = false
    if (!assetsCannotReady(inv, state.round)) for (const a of inv.assets) a.exhausted = false
    if (inv.tfaNoReadyRound === state.round) delete inv.tfaNoReadyRound
    for (const threat of inv.threat) if (getThreatEffect(threat)?.debt) threat.debtPaymentsThisRound = 0
  }
  for (const enemy of state.enemies) if (!enemy.bindMonster) {
    if (enemy.snareTrap) {
      state.investigators[enemy.snareTrap.ownerSeat]?.discard.push(enemy.snareTrap.code)
      delete enemy.snareTrap
    } else if (enemy.preventReady && enemy.preventReady.from + enemy.preventReady.rounds > state.round) {
      // 「悄然遁去」等：下个补给阶段不重整。
      continue
    } else if (enemy.attachments?.some(entry => entry.code === '04265') && !enemy.elite) {
      // 「手铐」：附属的非精英敌人不能重整。
      continue
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
      enemyAttack(state, enemy, owner, events, `「${enemy.name}」解除绑定后攻击。`, { kind: 'effect' })
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
      // 「英勇无畏」：由技能牌转化而来的支援在轮末弃掉。
      if (asset.tfaRoundEndDiscard != null && asset.tfaRoundEndDiscard <= state.round) {
        leaveAsset(state, inv, asset); inv.discard.push(asset.code)
        info(state, events, `「${cardName(asset.code)}」在轮末被弃掉。`)
      }
    }
    // 「自食其力」：控制占用盟友槽位的支援时强制弃掉。
    tfaDiscardOnYourOwn(state, inv, events)
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
  const profile = weaknessProfile(code)
  if (profile?.type === 'threat') return profile
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
function assetsCannotReady(inv, round = null) {
  // 「蟒蛇」（04079）：下个补给阶段不能重整（标记写在调查员身上）。
  if (Number.isInteger(inv.tfaNoReadyRound) && (round == null || inv.tfaNoReadyRound === round)) return true
  return inv.threat.some(card => getThreatEffect(card)?.preventReady)
}

// 「残酷拷问」（04261）：威胁区域禁止抽取行动（卡实例或 threat 数据两者都认）。
// Phase 2（C1）：capability:draw 也在这里判定，两条来源共用一个读点。
function drawBlocked(state, inv) {
  if (capabilityBlocked(state, inv, 'draw')) return true
  return (inv.threat || []).some(card => card.noDrawAction === true || getThreatEffect(card)?.noDrawAction === true)
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

// Phase 2（B2）：伤害/恐惧的分配策略。
//   'distribute'（默认）逐点询问（规则原样）
//   'self'       全部由调查员本人承受（不询问；直接伤害/恐惧的默认口径）
//   'assetsFirst'/'soakFirst' 先分给支援，溢出的部分由本人承受
//   'assetsOnly' 同 assetsFirst，但从不主动询问"由本人承受"
// 策略只影响"分给谁"，伤害/恐惧的量、时机、反应窗口完全相同——两条读点共用一份管线。
const HARM_STRATEGIES = Object.freeze(['distribute', 'self', 'assetsFirst', 'soakFirst', 'assetsOnly'])

function assignHarm(state, inv, amount, kind, events, direct, assetsFirst = false, strategy = null) {
  if (strategy != null && !HARM_STRATEGIES.includes(strategy)) {
    throw new Error(`未知伤害分配策略 ${JSON.stringify(strategy)}（可选：${HARM_STRATEGIES.join(' / ')}）`)
  }
  if (strategy === 'self') return new Map([[inv, amount]])
  const preferAssets = assetsFirst || strategy === 'assetsFirst' || strategy === 'soakFirst' || strategy === 'assetsOnly'
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
    // 「时间尽头」允许把直接伤害/直接恐惧分配给自己，其余支援不能承接直接伤害。
    const directSoaks = direct
      ? inv.assets.filter(asset => assetPassiveData(asset.code)?.assignDirectHarm
        && assetCapacityValue(asset, capacity) > (asset[kind] || 0) + (assignments.get(asset) || 0))
      : []
    let assets = direct ? directSoaks
      : inv.assets.filter(asset => assetCapacityValue(asset, capacity) > (asset[kind] || 0) + (assignments.get(asset) || 0))
    // Phase 5（5b-7）：「沉静」与「redirectOneHorrorToSelf」也可以写在能力层条目上（读点走 assetEffect）。
    const mandatory = kind === 'horror' && assets.filter(asset => (EFFECTS[asset.code]?.composure || assetEffect(inv, asset)?.composure)
      || ((EFFECTS[asset.code]?.redirectOneHorrorToSelf || assetEffect(inv, asset)?.redirectOneHorrorToSelf) && !(assignments.get(asset) > 0)))
    if (mandatory?.length) assets = mandatory
    const candidates = assets.length || soaks.length
      ? requestChoice(state, { kind: 'assign-' + kind, source: 'harm', seat: inv.seat,
        prompt: `分配 1 点${kind === 'damage' ? '伤害' : '恐惧'}（剩余 ${amount - i}）。`,
        options: [...(preferAssets || mandatory?.length ? [] : [{ id: 'self', label: '由调查员承受' }]),
          ...assets.map(asset => ({ id: asset.id, label: cardName(asset.code) })),
          ...soaks.map(({ asset, owner }) => ({ id: asset.id, label: `${cardName(asset.code)}（${owner.name}）` }))] })
      : 'self'
    const recipient = candidates === 'self' ? inv
      : assets.find(item => item.id === candidates) || soaks.find(item => item.asset.id === candidates)?.asset
    assignments.set(recipient, (assignments.get(recipient) || 0) + 1)
  }
  return assignments
}

function applyHarm(state, inv, damage, horror, events, direct, attack = null, assetsFirst = false, strategy = null) {
  const changed = scenarioBehavior(state).beforeHarm?.(state, inv,
    { damage: damage || 0, horror: horror || 0, direct: !!direct }, scenarioRuntime(state, events))
  if (changed) { damage = changed.damage; horror = changed.horror; direct = changed.direct }
  if (!(damage > 0 || horror > 0)) return
  const harmContext = reactionWindow(state, 'harmDealt', { when: 'harmDealt', seat: inv.seat, location: inv.location,
    damage: damage || 0, horror: horror || 0, direct: !!direct, attack, prompt: `${inv.name} 将受到伤害或恐惧` }, events)
  damage = Math.max(0, harmContext.damage || 0)
  horror = Math.max(0, harmContext.horror || 0)
  if (!(damage > 0 || horror > 0)) return
  if (direct && inv.assets.some(asset => !assetPassiveData(asset.code)?.assignDirectHarm
    && ((damage > 0 && cardDef(asset.code)?.health > 0) || (horror > 0 && cardDef(asset.code)?.sanity > 0))))
    info(state, events, `本次为直接${damage > 0 && horror > 0 ? '伤害与恐惧' : damage > 0 ? '伤害' : '恐惧'}，只能由${inv.name}本人承受，不能分配给支援卡。`)
  const assignedDamage = assignHarm(state, inv, damage || 0, 'damage', events, direct, assetsFirst, strategy)
  const assignedHorror = assignHarm(state, inv, horror || 0, 'horror', events, direct, false, strategy)
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
    ...attack,
    damagedAssetIds: [...assignedDamage.keys()].filter(a => a !== inv).map(a => a.id),
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
        const retaliation = EFFECTS[asset.code]?.defeatedDamage ?? registeredEntry(asset.code)?.defeatedDamage
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

// Phase 5（5b-6）：把「从旧式 reactions 搬过来的反应描述子」翻译成旧式反应的数据形状。
// 目标不是新语义，而是**同一份结算流程**：条件、费用、上限、日志、效果解释器都与
// `EFFECTS[code].reactions` 走完全相同的代码，迁移因此只搬数据、不改行为。
//   · trigger       → when（窗口名）
//   · criteria 纯数据 → 旧式条件字段（selfOnly / nonElite / requiresClue / symbols …）
//   · cost          → 旧式费用（exhaust / uses / resources / clues / discardSelf …）
//   · limit         → 旧式上限字符串（'round' / 'phase' / 'turn'，键与旧实现一致）
//   · effect        → resolveEffect 的数据体（迁移时不改写成 resolve）
function descriptorReactionSpec(descriptor, when) {
  const flags = descriptor.criteria && typeof descriptor.criteria === 'object' && !Array.isArray(descriptor.criteria)
    ? descriptor.criteria
    : {}
  return {
    ...flags,
    id: descriptor.id || undefined,
    when,
    cost: descriptor.cost || {},
    limit: legacyReactionLimit(descriptor.limit),
    effect: descriptor.effect,
    prompt: null,
    resolve: descriptor.resolve || null,
    criteriaFn: typeof descriptor.criteria === 'function' ? descriptor.criteria : null,
    descriptor,
  }
}

function legacyReactionLimit(limit) {
  if (!limit) return undefined
  const scope = typeof limit === 'string' ? limit : limit.scope
  if (scope === 'phase' || scope === 'perPhase') return 'phase'
  if (scope === 'turn' || scope === 'perTurn') return 'turn'
  if (scope === 'round' || scope === 'perRound') return 'round'
  return undefined
}

function triggerReaction(state, seat, when, events, context = {}) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return
  const entries = []
  const ab = INVESTIGATOR_ABILITIES[inv.code]
  for (const r of (ab && ab.reactions) || []) { if (!investigatorTextBlanked(state, inv)) entries.push({ r, type: 'investigator' }) }
  for (const asset of inv.assets) {
    const eff = assetEffect(inv, asset)
    if (!lolaCanUseCard(inv, asset.code)) continue
    for (const r of (eff && eff.reactions) || []) entries.push({ r, type: 'asset', asset })
    // Phase 5（5b-6）：同一张卡搬过来的反应描述子，按旧式询问顺序接在同一位置。
    for (const descriptor of descriptorsForWindow(asset.code, when, 'reaction')) {
      if (!descriptor.legacyReaction) continue
      entries.push({ r: descriptorReactionSpec(descriptor, when), type: 'asset', asset, descriptor })
    }
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
    // 描述子方向的条件函数（迁移来的数据是纯字段，这里通常为空）。
    if (r.criteriaFn && !evaluateCriteria(r.criteriaFn, { state, inv, source: asset, windowId: when, context })) continue
    const cost = r.cost || {}
    if (cost.exhaust && asset?.exhausted) continue
    if (cost.uses && (asset?.uses || 0) < cost.uses) continue
    if (cost.resources && inv.resources < cost.resources) continue
    if (cost.clues && inv.clues < cost.clues) continue
    if (!r.resolve && effectError(state, inv, r.effect)) continue
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
    const previousReaction = state._reaction
    const reactionState = { when, context, ...context }
    state._reaction = reactionState
    try {
      // Phase 5（5b-6）：迁移来的反应仍走效果解释器（数据体不变）；
      // 只有新写的 resolve 型反应才走自己的函数。
      if (r.resolve) {
        r.resolve({
          state, seat, inv,
          source: asset || { code: r.id || inv.code },
          descriptor: r.descriptor || null,
          window: when,
          context: reactionState,
          events,
          targetId: context?.targetId ?? null,
          target: null,
          api: abilityApi(state, events),
        })
      } else {
        const effect = { ...r.effect }
        if (context.enemy && effect.type === 'dealDamage' && !effect.target) effect.target = 'id:' + context.enemy.id
        if (context.enemy && effect.type === 'defeatNonEliteEnemy') effect.target = 'id:' + context.enemy.id
        resolveEffect(state, seat, effect, makeRuntime(state, events))
      }
    } finally {
      if (reactionState.testBonus) context.testBonus = (context.testBonus || 0) + reactionState.testBonus
      state._reaction = previousReaction
    }
    if (asset && assetEffect(inv, asset)?.discardWhenEmpty && asset.uses != null && asset.uses <= 0 && inv.assets.includes(asset)) {
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      info(state, events, `「${cardName(asset.code)}」充能耗尽，弃掉。`)
    }
  }
  // 能力层：旧式 reactions 之后，同一个 when 也作为窗口开放给声明式描述子。
  openAbilityWindow(state, when, context, events)
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
    if (enemy && canDisengage(state, inv, enemy)) disengageEnemy(state, enemy)
  }
  info(state, events, `${inv.name} 与所有敌人解除交战。`)
}

// 「不能解除交战」类限制（失落时代 04089：半身入土）。
function canDisengage(state, inv, enemy) {
  return scenarioBehavior(state).canDisengage?.(state, inv, enemy) !== false
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

// ---------------------------------------------------------------------------
// Phase 2（B5）：看牌与检索的统一入口
//
// 「看顶 N 张、排列、放回顶/底/洗回」「看弃牌堆」「搜索整副牌库」此前没有通用写法，
// 每张卡都在引擎里手写 splice/push。这里做成一份实现，选项的形状与校验在 look.js（纯函数），
// 本函数的职责只有：读牌、询问、写回、记日志。
//
// 一切随机走 randomValue(state)，一切询问走 requestChoice(state)，
// 因此看牌/洗回同样可重放，不需要额外的快照。
// ---------------------------------------------------------------------------

// 区域适配器：{ pile: 从顶到底的牌, detach(n): 从区域里摘掉顶 n 张, attach(cards, where): 放回 }。
// 「先摘掉再放回」是关键：如果只替换尾部，choose>0 拿走的牌会留在原来的区域里（重复）。
function lookZoneAdapter(state, seat, zone, targetSeat = null) {
  const inv = state.investigators[seat]
  const readArray = array => array.slice(-3).reverse()
  const adapter = (getArray, setArray) => ({
    pile: readArray(getArray()),
    detach: count => {
      const array = getArray()
      const removed = array.splice(Math.max(0, array.length - count), count)
      setArray(array)
      return removed.reverse()
    },
    attach: (cards, where = 'top') => {
      const array = getArray()
      if (where === 'bottom') array.unshift(...cards)
      else array.push(...cards.slice().reverse())
      setArray(array)
    },
    get owner() { return null },
  })
  switch (zone) {
    case 'deck':
    case 'investigatorDeck': {
      const owner = state.investigators[Number.isInteger(targetSeat) ? targetSeat : seat] || inv
      if (!owner) return null
      const base = adapter(() => owner.deck, next => { owner.deck = next })
      return { ...base, owner }
    }
    case 'discard':
      if (!inv) return null
      return { ...adapter(() => inv.discard, next => { inv.discard = next }), owner: inv }
    case 'encounterDeck':
      return adapter(() => state.encounterDeck, next => { state.encounterDeck = next })
    case 'explorationDeck':
      state.explorationDeck ||= []
      return adapter(() => state.explorationDeck, next => { state.explorationDeck = next })
    default: return null
  }
}

// 看牌：默认「看 N 张、洗回」；choose>0 时把选中的牌放进手牌（检索语义）。
function lookAt(state, seat, rawOptions, events) {
  const inv = state.investigators[seat]
  const options = rawOptions?.zone ? rawOptions : normalizeLookOptions(rawOptions)
  const zone = lookZoneAdapter(state, seat, options.zone, options.targetSeat)
  if (!zone || !zone.pile.length) {
    info(state, events, `${inv?.name || '调查员'} 查看的牌库是空的。`)
    return []
  }
  const count = Math.min(options.count, zone.pile.length)
  let pile = zone.pile.slice(0, count)
  const label = describeLook({ ...options, count })
  info(state, events, `👁 ${inv?.name || '调查员'}：${label}。`)
  // 先把看过的牌整体摘出来，之后的「拿走/放回」都不会和原区域里的副本打架。
  zone.detach(count)

  const taken = []
  for (let i = 0; i < options.choose && pile.length; i++) {
    const selectable = pile.filter(code => {
      if (!options.filter) return true
      const def = cardDef(code)
      if (!def) return false
      if (options.filter.type && def.type !== options.filter.type) return false
      if (options.filter.trait && !(def.traits || []).some(trait => String(trait).toLowerCase() === String(options.filter.trait).toLowerCase())) return false
      if (options.filter.usesType) {
        const usesType = registeredEntry(code)?.usesType ?? EFFECTS[code]?.usesType
        if (!usesType || String(usesType).toLowerCase() !== String(options.filter.usesType).toLowerCase()) return false
      }
      return true
    })
    if (!selectable.length) break
    const answer = requestChoice(state, {
      kind: 'search', source: options.source || 'lookAt', seat,
      prompt: options.prompt || `${label}：选择 1 张拿走（剩余 ${options.choose - i}）。`,
      options: selectable.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })),
    })
    const chosen = selectable[Number(answer)]
    if (!chosen) break
    pile.splice(pile.indexOf(chosen), 1)
    taken.push(chosen)
    if (zone.owner) zone.owner.hand.push(chosen)
    info(state, events, `${inv?.name || '调查员'} 取走「${cardName(chosen)}」。`)
  }
  // 排列：只对「看过但没拿走」的牌有意义（≤4 张时用全排列询问，避免组合爆炸）。
  let ordered = pile
  if (options.arrange && pile.length > 1 && pile.length <= 4) {
    const permutations = []
    const permute = (arr, prefix = []) => {
      if (!arr.length) { permutations.push(prefix); return }
      for (let i = 0; i < arr.length; i++) permute(arr.slice(0, i).concat(arr.slice(i + 1)), prefix.concat([arr[i]]))
    }
    permute(pile)
    const answer = requestChoice(state, {
      kind: 'look', source: options.source || 'lookAt', seat, prompt: '选择放回的顺序（从上到下）。',
      options: permutations.map((order, index) => ({ id: String(index), cardCodes: order, label: order.map(code => cardName(code)).join(' → ') })),
    })
    ordered = permutations[Number(answer)] || pile
  }
  const returned = [...ordered]
  if (returned.length) {
    switch (options.returnStrategy) {
      case 'discard':
        if (zone.owner) zone.owner.discard.push(...returned)
        else state.encounterDiscard.push(...returned)
        break
      case 'shuffle': {
        // 洗回：先放回原区域，再洗牌（洗牌走 randomValue，可重放）。
        zone.attach(returned)
        if (options.zone === 'encounterDeck') state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
        else if (options.zone === 'explorationDeck') state.explorationDeck = shuffle(state.explorationDeck, () => randomValue(state))
        else if (zone.owner) zone.owner.deck = shuffle(zone.owner.deck, () => randomValue(state))
        break
      }
      case 'bottom':
        zone.attach(returned, 'bottom')
        break
      case 'top':
      case 'keep':
      default:
        zone.attach(returned, 'top')
        break
    }
  }
  return taken
}

// 检索整副牌库（trait / type / usesType 之一），取出 choose 张进手牌，然后洗牌。
function searchDeck(state, seat, rawOptions, events) {
  const inv = state.investigators[seat]
  const options = rawOptions?.choose ? rawOptions : normalizeSearchOptions(rawOptions)
  if (!inv) return []
  const matches = inv.deck.filter(code => {
    const def = cardDef(code)
    if (!def) return false
    if (options.type && def.type !== options.type) return false
    if (options.trait && !(def.traits || []).some(trait => String(trait).toLowerCase() === String(options.trait).toLowerCase())) return false
    // usesType 不是卡面数据，按注册条目 / 旧 DSL 的 uses 判定。
    if (options.usesType) {
      const usesType = registeredEntry(code)?.usesType ?? EFFECTS[code]?.usesType
      if (!usesType || String(usesType).toLowerCase() !== String(options.usesType).toLowerCase()) return false
    }
    return true
  })
  if (!matches.length) {
    info(state, events, `${inv.name} 检索牌库，没有符合条件的卡牌${options.shuffle ? '，洗回牌库。' : '。'}`)
    if (options.shuffle) inv.deck = shuffle(inv.deck, () => randomValue(state))
    return []
  }
  const taken = []
  for (let i = 0; i < options.choose && matches.length; i++) {
    const selectable = matches.filter(code => inv.deck.includes(code) && !taken.includes(code))
    if (!selectable.length) break
    const answer = requestChoice(state, {
      kind: 'search', source: options.source || 'searchDeck', seat, canSkip: options.optional,
      prompt: options.prompt || `${describeSearch({ ...options, choose: options.choose - i })}：选择 1 张加入手牌。`,
      options: [...(options.optional ? [{ id: 'skip', label: '不拿取' }] : []),
        ...selectable.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))],
    })
    if (answer === 'skip') break
    const chosen = selectable[Number(answer)]
    if (!chosen) break
    const index = inv.deck.lastIndexOf(chosen)
    if (index >= 0) inv.deck.splice(index, 1)
    inv.hand.push(chosen)
    taken.push(chosen)
    info(state, events, `${inv.name} 从牌库找到「${cardName(chosen)}」。`)
  }
  if (options.shuffle) inv.deck = shuffle(inv.deck, () => randomValue(state))
  return taken
}

// ---------------------------------------------------------------------------
// Phase 2（B6）：把一张牌搬到别处
//
// 区域词表与规格校验在 zones.js；这里只做四件事：定位来源、摘出来、
// 放进目标区域（必要时建实例/附属/压牌）、记日志。
// ---------------------------------------------------------------------------

function findZoneCard(state, inv, spec) {
  const isInstance = card => (spec.id ? card.id === spec.id : card.code === spec.code)
  const owners = spec.ownerSeat != null ? [state.investigators[spec.ownerSeat]] : state.investigators
  // 声明了 from 就只在那个区域找：否则「从弃牌堆拿回」会先命中牌库里的同名卡。
  const wanted = spec.from && spec.from !== 'auto' ? spec.from : null
  const wants = zone => !wanted || wanted === zone || (wanted === 'attached' && false)
  for (const owner of owners) {
    if (!owner) continue
    for (const zone of ['play', 'threat']) {
      if (!wants(zone)) continue
      const array = zone === 'play' ? owner.assets : owner.threat
      const found = array.find(isInstance)
      if (found) return { zone, owner, instance: found }
    }
    if (!spec.code) continue
    for (const zone of ['hand', 'deck', 'discard']) {
      if (!wants(zone)) continue
      const array = owner[zone]
      const index = array.lastIndexOf(spec.code)
      if (index >= 0) return { zone, owner, index }
    }
  }
  for (const zone of ['setAside', 'removedFromGame', 'victoryDisplay', 'encounterDeck', 'encounterDiscard']) {
    if (!wants(zone)) continue
    const array = state[zone]
    if (!Array.isArray(array) || !spec.code) continue
    const index = array.lastIndexOf(spec.code)
    if (index >= 0) return { zone, owner: inv, index, shared: zone }
  }
  return null
}

function moveCardTo(state, inv, rawSpec, events) {
  const spec = rawSpec?.to ? rawSpec : normalizeCardMove(rawSpec)
  const seat = inv?.seat ?? null
  const found = findZoneCard(state, inv, spec)
  if (!found) {
    info(state, events, `没有找到要移动的牌（${spec.code || spec.id}）。`)
    return null
  }
  // 先摘出来：共享区域是 state 上的数组，场上卡要触发离场钩子。
  if (found.shared) state[found.shared].splice(found.index, 1)
  else if (found.zone === 'play') leaveAsset(state, found.owner, found.instance, events)
  else if (found.zone === 'threat') removeThreat(state, found.owner, found.instance, events)
  else found.owner[found.zone].splice(found.index, 1)

  const code = spec.code || found.instance?.code
  const owner = state.investigators[spec.ownerSeat ?? seat] || inv
  switch (spec.to) {
    case 'hand': owner.hand.push(code); break
    case 'deckTop': owner.deck.push(code); break
    case 'deckBottom': owner.deck.unshift(code); break
    case 'discard': owner.discard.push(code); break
    case 'play': {
      const asset = newPlayerAssetInstance(state, owner, code, spec.facedown ? { facedown: true } : {})
      owner.assets.push(asset)
      scenarioBehavior(state).assetEntered?.(state, owner, asset, scenarioRuntime(state, events))
      break
    }
    case 'threat': owner.threat.push(newPlayerAssetInstance(state, owner, code, spec.facedown ? { facedown: true } : {})); break
    case 'attached': {
      const host = [...owner.assets, ...owner.threat].find(card => card.id === spec.attachTo)
        || state.enemies.find(enemy => enemy.id === spec.attachTo)
        || state.locations.find(location => location.id === spec.attachTo)
      if (!host) {
        owner.discard.push(code)
        info(state, events, `附属宿主不存在，「${cardName(code)}」进入弃牌堆。`)
        break
      }
      attachCardTo(state, owner.seat, code, host)
      break
    }
    case 'beneath': {
      const host = [...owner.assets, ...owner.threat].find(card => card.id === spec.beneath)
        || state.enemies.find(enemy => enemy.id === spec.beneath)
        || state.locations.find(location => location.id === spec.beneath)
      if (host) {
        host.beneath ||= []
        host.beneath.push(code)
      } else owner.discard.push(code)
      break
    }
    case 'setAside':
      state.setAside ||= []
      state.setAside.push(code)
      break
    case 'removedFromGame':
      state.removedFromGame ||= []
      state.removedFromGame.push(code)
      break
    case 'victoryDisplay':
      state.victoryDisplay ||= []
      state.victoryDisplay.push(code)
      break
    default:
      throw new Error(`未知目标区域 ${spec.to}`)
  }
  info(state, events, `🃏 「${cardName(code)}」${describeCardMove(spec)}。`)
  return code
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
    kind: 'search', source: effect.source || 'search-top', seat, canSkip: !effect.mandatory,
    prompt: `查看牌库顶 ${cards.length} 张，选择 ${effect.choose || 1} 张加入手牌，其余洗回。`,
    options: [...(effect.mandatory ? [] : [{ id: 'skip', label: '不选择' }]),
      ...matches.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) }))],
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
  if (enemy.damageTaken >= enemyHealth(state, enemy)) { enemy.defeatedBy = seat; defeatEnemy(state, enemy, events) }
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
  throw new Error(`未实现的卡尔克萨玩家卡效果：${effect.action}`)
}

function carcosaInvestigatorEffect(state, seat, effect, events) {
  const inv = state.investigators[seat]
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
  if (effect.action === 'lolaSwitchRole') {
    const role = chooseLolaRole(state, inv, effect.action, '选择罗拉要切换到的角色。')
    info(state, events, `${inv.name} 切换为${CLASS_NAMES[role] || role}角色。`)
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

// ---------------------------------------------------------------------------
// 失落的时代（三循环）调查员与专属卡效果（M1）
// ---------------------------------------------------------------------------

function tfaInvestigatorEffect(state, seat, effect, events) {
  const inv = state.investigators[seat]
  // 里奥·安德森：回合开始后打出 1 张盟友支援，费用减 1。
  if (effect.action === 'playAllyDiscounted') {
    const costOf = code => Math.max(0, playCost(state, inv, cardDef(code)) - (effect.amount || 0))
    const candidates = inv.hand
      .filter(code => cardDef(code)?.type === 'asset'
        && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))
      .filter(code => inv.resources >= costOf(code))
      .filter(code => cardDef(code)?.unique
        ? !state.investigators.some(other => other.assets.some(asset => cardDef(asset.code)?.name === cardDef(code)?.name))
        : true)
    if (!candidates.length) return
    const chosen = requestChoice(state, { kind: 'target', source: '04001', seat,
      prompt: '选择要打出并减免 1 费用的盟友支援。',
      options: [{ id: 'skip', label: '跳过' },
        ...candidates.map(code => ({ id: code, cardCode: code, label: `${cardName(code)}（${costOf(code)} 资源）` }))] })
    if (chosen === 'skip') return
    inv.playDiscount = effect.amount || 1
    doPlay(state, seat, chosen, events)
    delete inv.playDiscount
    return
  }
  // 厄休拉·唐斯：移动后进行 1 次调查行动（不额外消耗行动点）。
  if (effect.action === 'investigateAction') {
    doInvestigate(state, seat, {}, events, true)
    return
  }
  // 芬恩·爱德华兹：手枪攻击，未交战时额外 +1 伤害。
  throw new Error(`未实现的失落调查员效果：${effect.action}`)
}

// ---------------------------------------------------------------------------
// 失落的时代玩家卡（M2）效果调度器
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 失落的时代 · 第三批玩家卡共用原语（M2-B）
// ---------------------------------------------------------------------------

// 揭示混乱标记之前的替代/额外揭示：
//   - 「危险预感」（04199）强制改为结算封印其上的标记；
//   - 「奥利芙·麦克布莱德」（04197）横置后揭示 3 个并选 2 个结算；
//   - 「黑暗预言」（04032）改为揭示 5 个并选 1 个带符号的标记结算。
function tfaBeforeChaosReveal(state, seat, inv, events) {
  const test = state.skillTest
  if (!test) return null
  // Phase 5（5c-24）：判据改成「封印标记 + 条目声明 substituteSealedToken」，引擎不再认卡号。
  const premonition = inv.assets.find(asset => asset.sealedToken
    && registeredEntry(asset.code)?.substituteSealedToken)
  if (premonition) {
    const token = premonition.sealedToken
    leaveAsset(state, inv, premonition, events)
    if (!premonition.removedFromGame) inv.discard.push(premonition.code)
    state.chaos.sealed = (state.chaos.sealed || []).filter(entry => entry.source !== premonition.id)
    state.sealedTokens = (state.chaos.sealed || []).map(entry => entry.token)
    state.chaosBag.push(token)
    info(state, events, `「${cardName(premonition.code)}」改为结算封印的 ${tokenLabel(token)}，随后被弃掉。`)
    return { token }
  }
  triggerReaction(state, seat, 'tokenReveal', events, { when: 'tokenReveal', seat, location: inv.location, skill: test.skill })
  reactionWindow(state, 'tokenReveal', { when: 'tokenReveal', seat, location: inv.location, skill: test.skill,
    prompt: '即将揭示混乱标记' }, events)
  const plan = test.pendingRevealPlan
  if (plan) { delete test.pendingRevealPlan; return plan }
  return null
}

// 把已揭示的混乱标记直接封印到某张卡上（「虚空碎裂」）。
function sealRevealedChaosToken(state, token, source) {
  const revealed = state.chaos?.revealed || []
  const index = revealed.lastIndexOf(token)
  if (index < 0) return false
  revealed.splice(index, 1)
  state.chaos.sealed ||= []
  state.chaos.sealed.push({ token, source })
  state.sealedTokens = state.chaos.sealed.map(entry => entry.token)
  return true
}

// 「销赃贩子」（04108）与「自食其力」（04236）的打出优惠预览（不修改状态）。
function tfaPlayCostPreview(state, inv, code) {
  const def = cardDef(code)
  if (!def) return null
  const traits = (def.traits || []).map(trait => String(trait).toLowerCase())
  const preview = { discount: 0, noAction: false, sources: [] }
  for (const asset of inv.assets) {
    const eff = EFFECTS[asset.code]
    if (!eff || asset.exhausted) continue
    if (eff.fastForIllicit && traits.includes('illicit') && !preview.sources.includes(asset.id)) {
      preview.sources.push(asset.id)
      // Phase 5：fast 走统一读点（卡面 EFFECTS → 描述子的 fast 字段），迁移后优惠口径不变。
      if (cardPlayFlag(code, 'fast')) preview.discount += 1
      else preview.noAction = true
    }
    if (eff.survivorEventDiscount && def.type === 'event'
      && (def.factions || [def.klass]).includes('survivor') && !preview.sources.includes(asset.id)) {
      preview.sources.push(asset.id)
      preview.discount += 2
    }
  }
  return preview.sources.length ? preview : null
}

function tfaApplyPlayCost(state, inv, preview, events) {
  if (!preview) return
  for (const id of preview.sources) {
    const asset = inv.assets.find(item => item.id === id)
    if (!asset) continue
    asset.exhausted = true
    info(state, events, `⚡ 横置「${cardName(asset.code)}」以调整本次打出的费用。`)
  }
}

// 「自食其力」：控制占用盟友槽位的支援时强制弃掉。
function tfaDiscardOnYourOwn(state, inv, events) {
  const own = inv.assets.filter(asset => asset.code === '04236')
  if (!own.length) return
  const ally = inv.assets.some(asset => asset.code !== '04236' && normalizedSlots(cardDef(asset.code)).includes('ally'))
  if (!ally) return
  for (const asset of own) {
    leaveAsset(state, inv, asset, events)
    inv.discard.push(asset.code)
    info(state, events, `「${cardName('04236')}」因 ${inv.name} 控制了占用盟友槽位的支援而被弃掉。`)
  }
}

// 「时间借取」（04308）：回合开始时移除所有滴答，换成额外行动。
function tfaBorrowedTimeTurnStart(state, inv, events) {
  for (const asset of inv.assets.filter(item => item.code === '04308' && (item.clicks || 0) > 0)) {
    const clicks = asset.clicks
    asset.clicks = 0
    inv.actionsLeft += clicks
    info(state, events, `⏳ 「${cardName('04308')}」移除 ${clicks} 声滴答，${inv.name} 本回合获得 ${clicks} 次额外行动。`)
  }
}

// 失落时代第三批卡牌的调度器。
const TFA_PLAYER_WAVE3_ACTIONS = new Set([
  'youHandleThisOne', 'darkProphecy', 'dumbLuck', 'yaotlIcons', 'yaotlDiscardTop', 'marksmanship',
  'wellPrepared',
  'againstAllOdds', 'pnakoticSkipTest', 'pnakoticNextTest',
])

function tfaPlayerEffect3(state, seat, effect, events) {
  const inv = state.investigators[seat]
  // 「交给你了！」：把刚抽到的遭遇卡转给另一位调查员。
  // 「黑暗预言」：改为揭示 5 个混乱标记，选 1 个带符号的结算。
  // 「狗屎运」：把刚躲避失败的敌人放到遭遇牌库顶。
  // 「雅沃托」：本次检定按弃牌堆顶卡牌的匹配图标加值。
  // 「雅沃托」：弃掉牌库顶。
  // 「枪法如神」：用枪械/远程支援攻击连接地点上的敌人。
  // 「准备万全」：按所选支援上的匹配图标提升本次检定。
  // 「勇斗异劫」：额外揭示 X 个混乱标记并选 1 个结算。
  // 「纳克特手稿」：本次检定不揭示混乱标记。
  // 「纳克特手稿」：让某位调查员本轮下一次检定不揭示混乱标记。
  // 「时间借取」：在支援上放置 1 声滴答。
  // 「虚空碎裂」：用意志攻击，并按封印的「0」标记增加意志与伤害。
  // 「临时路障」：躲避；从弃牌堆打出时还能多躲一个敌人。
  throw new Error(`未实现的失落玩家卡效果：${effect.action}`)
}

function tfaPlayerEffect(state, seat, effect, events) {
  // 第三批卡牌统一走 tfaPlayerEffect3；前两批保持在原来的调度器里。
  if (TFA_PLAYER_WAVE3_ACTIONS.has(effect.action)) return tfaPlayerEffect3(state, seat, effect, events)
  return tfaPlayerEffectCore(state, seat, effect, events)
}

function tfaPlayerEffectCore(state, seat, effect, events) {
  const inv = state.investigators[seat]
  // 04157「一心一意」的技能成功后：在自己控制的一个充能/秘密支援上放 1 点。
  // 它属于「技能卡的 onSuccess 标志」而不是卡的 event，因此仍留在本调度器里。
  if (effect.action === 'placeChargeOrSecret') {
    const candidates = inv.assets.filter(asset => ['charges', 'secrets'].includes(String(asset.usesType || ''))
      || EFFECTS[asset.code]?.usesType === 'secrets' || EFFECTS[asset.code]?.usesType === 'charges')
    if (!candidates.length) return
    const chosen = candidates.length === 1 ? candidates[0].id : requestChoice(state, { kind: 'target', source: '04157', seat,
      prompt: '选择要放置充能/秘密的支援。', options: candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
    const asset = candidates.find(item => item.id === chosen) || candidates[0]
    asset.uses = (asset.uses || 0) + 1
    info(state, events, `「${cardName(asset.code)}」获得 1 点${asset.usesType === 'secrets' ? '秘密' : '充能'}。`)
    return
  }
  // 彩饰骷髅：地点上的敌人被击败后放 1 充能。
  // 犯罪现场：发现 1 个线索，地点有敌人时改为 2 个。
  // 收获日：本回合每个行动换 1 资源；若是自己的回合则结束回合。
  // 献祭贡品：弃掉一张秘术支援，然后分配 3 点抽牌/资源。
  // 最后的枪击：对同地点敌人造成 1 点伤害；击败则抽 1 张；若是自己的回合则结束回合。
  // 陈旧猎枪：攻击；揭示骷髅或自动失败时卡膛（本次攻击不造成伤害）。
  // 如痴如醉：在控制的一张支援上放置 1 充能或秘密。
  // 求生匕首：被敌人攻击造成伤害后横置反击。
  // 冒险家：在自己地点的一个支援上放置 1 补给或子弹。
  // 窃听：对未交战敌人检定智识（难度为躲避值），成功发现 2 个线索。
  // 临时武器：攻击，敌人攻击值 -1；从弃牌堆打出时 +1 伤害。
  // 劝服：谈判人形敌人；成功洗回遭遇牌库，精英改为自动躲避。
  // 恢复元气：治疗 1 点伤害（本回合抽到诡计则 2 点）并抽 1 张。
  // 去伪存真：在控制的一张支援上放置 2 秘密。
  // 挥金如土：本次检定 +2；成功返还 3 资源。
  // 萝拉·桑提亚哥：花费隐藏值等量资源发现 1 个线索。
  // 华饰弓：重新搭箭（1 子弹）。
  // 勃朗宁自动步枪：花 1–5 子弹，+X 战斗并造成 X 点伤害。
  // 悄然遁去：躲避加入智识；成功超过 2 点且非精英时下个补给阶段不重整。
  // 鲜血失色：可额外受到最多 3 点伤害，换取意志攻击加成。
  // 养神术：意志检定(0)，按成功点数抽牌，再按超出手牌上限受恐惧。
  // 将就一下：调查帷幕 -1；从弃牌堆打出并成功时额外 1 个线索。
  // 暖水瓶：治疗同地点调查员 1 点伤害（创伤 2 点时为 2 点）。
  // 古旧锈剑：蓄力斩加入意志并造成 +3 伤害；击败精英抽 3 张（每局一次）。
  // 煤油：本地点本轮击败过敌人时，治愈最多 2 点恐惧。
  // 火焰喷射器：攻击攻击值最高的交战敌人 +4，可改为向所有交战敌人分配 4 点伤害。
  // 有利位置：本回合地点帷幕 -1，并可以把别处 1 个线索移过来。
  // 改变命运：弃掉一张未附属精英敌人的非弱点诡计。

  // 背包：从牌库顶 6 张找出最多 3 张非弱点道具/供给卡，正面朝下附属。
  throw new Error(`未实现的失落玩家卡效果：${effect.action}`)
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
    if (bury === 'bottom') { deck.pop(); deck.unshift(top); if (asset) placeDoomOnCard(state, asset, 1, events, { silent: true }) }
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
    canReadyAssets: seat => !assetsCannotReady(state.investigators[seat], state.round),
    investigate: (seat, opts) => doInvestigate(state, seat, opts || {}, events, true),
    fight: (seat, opts) => doFight(state, seat, opts || {}, events, true),
    evade: (seat, opts) => doEvade(state, seat, opts || {}, events, true),
    autoEvade: (enemy) => autoEvadeEnemy(state, enemy, events),
    discardRandomFromHand: (inv, n) => discardRandomFromHand(state, inv, n, events),
    // 弃掉牌库顶 N 张（离场钩子等效果数据用的原语，Phase 1）。
    mill: (seat, amount) => {
      const inv = state.investigators[seat]
      if (!inv) return
      const discarded = []
      for (let index = 0; index < amount && inv.deck.length; index++) discarded.push(inv.deck.pop())
      if (!discarded.length) return
      inv.discard.push(...discarded)
      info(state, events, `${inv.name} 弃掉牌库顶 ${discarded.length} 张牌。`)
    },
    addEffect: (seat, record) => createEffect(state, { ...record, controllerSeat: seat }),
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
    tfaInvestigatorEffect: (seat, effect) => tfaInvestigatorEffect(state, seat, effect, events),
    tfaPlayerEffect: (seat, effect) => tfaPlayerEffect(state, seat, effect, events),
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
    // 能力层窗口：发现线索后（02061 沃伦·莱斯教授、05025 串联线索等）。
    triggerReaction(state, inv.seat, 'clueDiscovered', events, { when: 'clueDiscovered', seat: inv.seat,
      location: loc.id, amount: got, lastClue: loc.clues === 0, shroud: loc.shroud })
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
  // 调用方（effects.js 的 dealDamage / evade）把"没有目标"当成正常分支处理，
  // 因此这里必须返回 null 而不是抛错：随机走子器在"手上有需要敌人的事件卡、场上却没有合法敌人"
  // 时走到过这条路径（Phase 4 · 重放安全网）。
  const enemies = abilityTargets(state, state.investigators[seat], { type: 'dealDamage', target })
  if (!enemies.length) return null
  const id = requestChoice(state, { kind: 'target', source: 'dealDamage', seat, prompt: '选择敌人目标。',
    options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  return enemies.find(enemy => enemy.id === id) || enemies[0]
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
  if (currentActionKind === 'explore') {
    // 探索：先花普通行动，不够时才花「只能探索」的额外行动。
    if (normalActionsLeft(inv) < 1) inv.exploreOnlyActions = Math.max(0, (inv.exploreOnlyActions || 0) - 1)
  } else {
    if (normalActionsLeft(inv) < 1) throw new Error('行动点不足（额外行动只能用于探索）')
  }
  inv.actionsLeft--
  inv.exploreOnlyActions = Math.min(inv.exploreOnlyActions || 0, Math.max(0, inv.actionsLeft))
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

// 卡面自带的打出限制（不是库存或构筑限制）。
function cardPlayBlockedReason(state, inv, def) {
  // Phase 2（C1）：capability:play —— 声明式「不能打出卡牌」。
  if (capabilityBlocked(state, inv, 'play')) return '当前效果禁止你打出卡牌'
  // Phase 5（5c-20）：条目的同名字段优先（迁移后可删旧 DSL 条目），读点只有一个。
  const entry = def?.code ? registeredEntry(def.code) : null
  const restriction = entry?.playRestriction ?? EFFECTS[def?.code]?.playRestriction
  if (restriction === 'noReadyEnemy'
    && state.enemies.some(enemy => enemy.location === inv.location && !enemy.exhausted && !enemy.defeated)) {
    return '你所在地点有处于重整状态的敌人'
  }
  // 「团队仅限 N 张」的支援（04031 保护咒语）：场上所有调查员的副本合计不能超过 N。
  const teamLimit = entry?.teamLimit ?? EFFECTS[def?.code]?.teamLimit
  if (teamLimit) {
    const inPlay = state.investigators.reduce((sum, owner) =>
      sum + owner.assets.filter(asset => asset.code === def.code).length, 0)
    if (inPlay >= teamLimit) return `团队中已有 ${teamLimit} 张「${def.name || def.code}」在场`
  }
  return null
}

function jakeSkipsOpportunityAttack(state, inv, kind) {  if (!inv.assets.some(asset => assetPassiveData(asset.code)?.noOpportunityFirstAction)) return false
  if (!['move', 'investigate'].includes(kind)) return false
  if (inv.jakeFree?.round !== state.round) inv.jakeFree = { round: state.round, used: [] }
  if (inv.jakeFree.used.includes(kind)) return false
  inv.jakeFree.used.push(kind)
  return true
}

function canUseExtraEvade(state, inv) {
  if (!INVESTIGATOR_ABILITIES[inv.code]?.extraEvadeAction) return false
  if (investigatorTextBlanked(state, inv)) return false
  if (state.currentSeat !== inv.seat && state.phase === 'investigation') return false
  return inv.extraEvadeUsed !== state.turnSerial
}

// 一次 move 对应的能力对象（能力层描述子折叠后与旧式 ability 同形）。
function abilityOfMove(state, inv, move) {
  if (move.action !== 'ability') return null
  const card = controlledAbilityCard(inv, move.assetId)
  return assetEffect(inv, card)?.abilities?.[move.abilityIndex] || null
}

function actionKind(state, inv, move) {
  if (move.action === 'scenarioAction' || move.action === 'encounterAction') {
    const declared = move.actionKind || scenarioBehavior(state).actionKind?.(state, inv, move)
    if (declared) return declared
  }
  if (move.action === 'scenarioAction' && ['castFormula', 'concoctionAttack'].includes(move.rule)) return 'fight'
  if (move.action === 'scenarioAction' && move.rule === 'resignBeyond') return 'resign'
  if (move.action === 'scenarioAction' && ['parleyJazz', 'parleyPassenger'].includes(move.rule)) return 'parley'
  // 剧本自己的「探索」行动（探索牌库）与基础探索一样吃 04148 的探索专用行动。
  if (move.action === 'scenarioAction' && /explore/i.test(String(move.rule))) return 'explore'
  // 芬恩·爱德华兹的额外躲避行动按躲避结算（不引发借机攻击）。
  if (move.action === 'extraEvade') return 'evade'
  const source = move.action === 'play' ? EFFECTS[move.copyCode || move.cardId]
    : move.action === 'ability' ? assetEffect(inv, controlledAbilityCard(inv, move.assetId)) : null
  if (source?.noOpportunityAttack) return 'evade'
  // Phase 2：描述子化的「不引发借机攻击」事件卡（统一读点）。
  if (move.action === 'play' && cardPlayFlag(move.copyCode || move.cardId, 'noOpportunityAttack')) return 'evade'
  const actionEffect = move.action === 'play' ? playedEffect(move.copyCode || move.cardId)
    : move.action === 'ability' ? abilityOfMove(state, inv, move)?.effect : null
  if (actionEffect?.noOpportunityAttack) return 'evade'
  // Phase 5：描述子用 resolve 实现时没有 effect 数据体，「按哪种行动结算」写在 countsAs 上
  // （旧式能力写在 effect.kind 上，见「意志闪避」）。
  const ability = move.action === 'ability' ? abilityOfMove(state, inv, move) : null
  if (ability?.descriptor?.countsAs) return ability.descriptor.countsAs
  // 失落时代的卡牌能力在 effect.kind 里声明自己属于攻击/躲避，避免被当成普通行动引发借机攻击。
  return actionEffect?.kind || actionEffect?.type || move.action
}

export function actionPreview(state, seat, move) {
  const inv = state.investigators[seat]
  if (!inv || state.pendingChoice || inHub(state)) return { actions: 0 }
  const ability = abilityOfMove(state, inv, move)
  const kind = actionKind(state, inv, move)
  const provoking = actionCost(state, inv, move, false) > 0 && !['fight', 'evade', 'resign', 'parley', 'parleyCultist', 'parleyLita'].includes(kind)
  const attacks = provoking ? enemiesEngagedWith(state, inv).filter(e => !e.exhausted && !(inv.onTheLam && !e.elite)
    && enemyCanOpportunityAttack(state, e)) : []
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
  // 事务会用"本次动作开始前"的快照重建整个 state（见 resolution.js），
  // 所以动作日志必须由这里持有，事务结束后再挂回去。
  const actionLog = state.actionLog || []
  let events
  try {
    events = resolveTransaction(state, seat, move, executeCommand)
  } finally {
    state.actionLog = actionLog
  }
  // 对局级动作日志：重放、撤销与 AI 决策回归都读它（见 src/engine/replay.js）。
  // 只记成功提交的动作；内容是可 JSON 存档的纯数据，不含闭包。
  actionLog.push({ seat, move: { ...move } })
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
    if (error instanceof ScenarioRestarted) {
      // 04059 结局 4：重演本场冒险。原地重新布置同一剧本，并重新发起始手牌。
      const index = state.campaign.scenarioIndex
      startScenario(state, index, events)
      runMulligans(state, events)
      info(state, events, '🔁 调查队重组队伍，再次进入遗迹深处。')
      return
    }
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
  // Phase 5（5c-39）：谁能回滚这个动作由条目级 rewindAction 决定（手上或附属区里都算）。
  const needsTimeWarpSnapshot = !['endTurn', 'setup', 'interlude'].includes(move.action)
    && aliveInvestigators(state).some(owner => owner.hand.some(code => registeredEntry(code)?.rewindAction === true)
      || owner.assets.some(asset => (asset.attached || []).some(code => registeredEntry(code)?.rewindAction === true)))
  const actionSnapshot = needsTimeWarpSnapshot
    ? structuredClone({ ...state, _resolution: null, pendingChoice: null, legalMoves: [], lastActionSnapshot: null }) : null
  const totalCost = actionCost(state, inv, move, false)
  const cost = actionCost(state, inv, move)
  const kind = actionKind(state, inv, move)
  currentActionKind = kind
  // 04148 探险日志：每回合额外一次只能探索的行动。普通行动不能花掉它。
  if (kind === 'explore') {
    if (inv.actionsLeft < cost) throw new Error('行动点不足')
    const normal = normalActionsLeft(inv)
    inv.actionsLeft -= cost
    if (normal < cost) inv.exploreOnlyActions = Math.max(0, (inv.exploreOnlyActions || 0) - (cost - normal))
  } else {
    if (normalActionsLeft(inv) < cost) throw new Error('行动点不足（额外行动只能用于探索）')
    inv.actionsLeft -= cost
  }
  inv.exploreOnlyActions = Math.min(inv.exploreOnlyActions || 0, Math.max(0, inv.actionsLeft))
  if (cost > 0) { inv.actionsTakenThisTurn = (inv.actionsTakenThisTurn || 0) + 1; state.phaseActionCount = (state.phaseActionCount || 0) + 1 }
  if (totalCost > cost || move.action === 'endTurn') inv.tomeActionUsed = true
  state.moveCount++
  const ability = move.action === 'ability' ? assetEffect(inv, controlledAbilityCard(inv, move.assetId))?.abilities?.[move.abilityIndex] : null
  if (totalCost) for (const threat of unpaidExtraActionThreats(state, inv, kind)) {
    threat.extraActionPaidRound = state.round
  }
  state._actionPaid = true
  try {
    if (move.action === 'scenarioAction') scenarioBehavior(state).payScenarioActionCost?.(state, inv, move, scenarioRuntime(state, events))
    const noOpportunityAttack = move.action === 'freeAction' && INVESTIGATOR_ABILITIES[inv.code]?.freeAction?.noOpportunityAttack
    // Phase 2（C2）：noOpportunityAttack 也可以由描述子的 add:keyword 授予。
    // Phase 5（5c）：资产把「打出时不引发借机攻击」写成条目级 noOpportunityAttack
    // （旧 DSL 的字段名是 noOpportunityAttackOnPlay），两边都在这里汇合。
    const playNoAoO = move.action === 'play'
      && (EFFECTS[move.copyCode || move.cardId]?.noOpportunityAttackOnPlay
        || playFlag(move.copyCode || move.cardId, 'noOpportunityAttack')
        || cardKeyword(state, inv, move.copyCode || move.cardId, 'noOpportunityAttack'))
    if (totalCost && !noOpportunityAttack && !playNoAoO && !ruleIgnored(state, inv, 'opportunityAttack')
      && !jakeSkipsOpportunityAttack(state, inv, kind)
      && !['fight', 'evade', 'resign', 'parley', 'parleyCultist', 'parleyLita'].includes(kind)) {
      const pending = enemiesEngagedWith(state, inv).filter(enemy => !enemy.exhausted
        && enemyCanOpportunityAttack(state, enemy)).map(e => e.id)
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
        enemyAttack(state, enemy, inv, events, enemy.name + ' 发动借机攻击。', { kind: 'opportunity' })
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

// 幕间结算留下的「下一场冒险」修正：起始资源 / 起始线索，用一次后清空。
export function consumeStartingAdjustments(state, inv, events = null) {
  const adjustment = state.campaign.startingAdjustments?.[inv.seat]
  if (!adjustment) return null
  if (adjustment.resources) {
    inv.resources = Math.max(0, inv.resources + adjustment.resources)
    if (events !== null) info(state, events, `${inv.name} 因幕间结算以 ${inv.resources} 点资源开始本关（${adjustment.resources}）。`)
  }
  if (adjustment.clues) {
    inv.clues = Math.max(0, inv.clues + adjustment.clues)
    if (events !== null) info(state, events, `${inv.name} 因幕间结算额外获得 ${adjustment.clues} 个线索。`)
  }
  delete state.campaign.startingAdjustments[inv.seat]
  return adjustment
}

// 幕间效果可能禁止下一场冒险换起始手牌；读到一次就清空。
export function consumeMulliganBlock(state) {
  const blocked = state.campaign.ruleFlags?.cannotMulliganOnce === true
  if (blocked) delete state.campaign.ruleFlags.cannotMulliganOnce
  return blocked
}

function runMulligans(state, events) {
  // 幕间可能禁止下一场冒险换起始手牌（例如没有汽油 / 没有粉笔）。
  const noMulligan = consumeMulliganBlock(state)
  for (const inv of state.investigators) {
    if ((noMulligan || inv.cannotMulligan) && inv.code !== '03003') {
      info(state, events, `${inv.name} 必须保留起始手牌（幕间效果禁止换牌）。`)
      delete inv.cannotMulligan
      continue
    }
    delete inv.cannotMulligan
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
    case 'play': doPlay(state, seat, m.cardId, events, !!m.fromDiscard, false, m.copyCode, m.fromPlanAssetId, m.fromBackpackId); break
    case 'draw': doDraw(state, seat, events); break
    case 'resource': doResource(state, seat, events); break
    case 'freeAction': doFreeAction(state, seat, events); break
    case 'hiddenAction': doHiddenAction(state, seat, m, events); break
    case 'move': doMove(state, seat, m.locationId, events); break
    case 'investigate': doInvestigate(state, seat, {}, events); break
    case 'explore': doExplore(state, seat, events); break
    case 'searchIzzie': doSearchIzzie(state, seat, events); break
    case 'locationAbility': doLocationAbility(state, seat, m.locationId, events); break
    case 'fight': doFight(state, seat, { enemyId: m.enemyId }, events); break
    case 'evade': doEvade(state, seat, { enemyId: m.enemyId }, events); break
    case 'extraEvade': doEvade(state, seat, { enemyId: m.enemyId }, events, true); inv.extraEvadeUsed = state.turnSerial; break
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
  // 剧本可以在每个阶段开始时结算持续/强制效果（04256 的「调查阶段开始」等）。
  scenarioBehavior(state).phaseBegan?.(state, state.phase, scenarioRuntime(state, events))
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
    // 「时间借取」：回合开始时移除所有滴答，换取等量额外行动。
    tfaBorrowedTimeTurnStart(state, inv, events)
    triggerReaction(state, inv.seat, 'turnBegins', events, { seat: inv.seat, location: inv.location })
    reactionWindow(state, 'turnBegins', { when: 'turnBegins', seat: inv.seat, location: inv.location, prompt: `${inv.name} 的回合开始` }, events)
    // 「未知的呼唤」：回合开始时选择本回合要调查的地点。
    for (const threat of inv.threat.filter(item => getThreatEffect(item)?.turnForced === 'callOfTheUnknown')) {
      const options = state.locations.filter(loc => loc.id !== inv.location)
        .map(loc => ({ id: loc.id, label: loc.name }))
      if (!options.length) continue
      threat.callTarget = requestChoice(state, { kind: 'location', source: threat.code, seat: inv.seat,
        prompt: '「未知的呼唤」：选择本回合必须成功调查的地点。', options })
      info(state, events, `「${cardName(threat.code)}」：${inv.name} 本回合必须成功调查「${locName(state, threat.callTarget)}」。`)
    }
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
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phaseActionCount = 0
  state.turnsTaken = []
  for (const inv of aliveInvestigators(state)) {
    const loss = inv.pendingActionLoss?.[state.round] || 0
    inv.actionsLeft = Math.max(0, 3 + extraActionBonus(inv) - loss)
    inv.exploreOnlyActions = Math.max(0, exploreOnlyActionBonus(inv) - loss)
    if (inv.pendingActionLoss) delete inv.pendingActionLoss[state.round]
  }
  // Phase 1（A1）：阶段级临时修正改由 state.effects 承载，上面的 expireEffects 已经清掉，
  // 这里保留旧的 phaseStatBonus 兼容清理（外部存档/测试可能仍有该字段）。
  for (const inv of aliveInvestigators(state)) inv.phaseStatBonus = null
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

function resolveCallOfTheUnknown(state, inv, events) {
  for (const threat of inv.threat.filter(item => getThreatEffect(item)?.turnForced === 'callOfTheUnknown').slice()) {
    // 本回合开始之后才入场的弱点没有指定地点，不在当回合结算。
    if (!threat.callTarget) continue
    const finished = inv.investigatedTurnRound === state.round
      && (inv.investigatedThisTurn || []).includes(threat.callTarget)
    if (finished) continue
    removeOne(inv.threat, threat)
    inv.deck = shuffle([...inv.deck, threat.code], () => randomValue(state))
    info(state, events, `「${cardName(threat.code)}」：${inv.name} 未能调查所选地点，受到 2 点恐惧并洗回牌库。`)
    applyHorror(state, inv, 2, events)
    if (inv.defeated || state.status !== 'playing') return
  }
}

function advanceInvestigator(state, seat, events) {
  const inv = state.investigators[seat]
  if (inv && !inv.defeated && !inv.resigned) resolveCallOfTheUnknown(state, inv, events)
  if (inv && state.status !== 'playing') return
  if (inv && !inv.defeated && !inv.resigned && inv.actionsLeft <= 0
      && !inv.tomeActionUsed && !investigatorTextBlanked(state, inv) && INVESTIGATOR_ABILITIES[inv.code]?.extraTomeAction
      && legalMoves(state).some(move => tomeActionEligible(state, inv, move))) return
  if (inv) {
    runThreatEndTurn(state, inv, events)
    // 04031 保护咒语：回合结束时花费 1 资源，或弃掉它。
    for (const asset of [...inv.assets]) {
      const pay = EFFECTS[asset.code]?.forcedTurnEndPayOrDiscard
      if (!pay) continue
      const answer = requestChoice(state, {
        kind: 'reaction', source: asset.code, seat: inv.seat, canSkip: true,
        prompt: `「${cardName(asset.code)}」：花费 ${pay} 资源，或弃掉它。`,
        options: [
          { id: 'pay', label: `花费 ${pay} 资源保留` },
          { id: 'discard', label: '弃掉它' },
        ],
      })
      if (answer === 'pay' && (inv.resources || 0) >= pay) {
        inv.resources -= pay
        info(state, events, `💸 ${inv.name} 为「${cardName(asset.code)}」支付 ${pay} 资源。`)
      } else {
        inv.discard.push(asset.code)
        leaveAsset(state, inv, asset, events)
        info(state, events, `🗑️ ${inv.name} 弃掉了「${cardName(asset.code)}」。`)
      }
    }
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
  // 回合结束：本回合内生效的效果到期（A1 的统一过期点）。
  for (const effect of expireEffects(state, 'endOfTurn')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（回合结束）。`)
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


// ---- 附属（attachments）支持 ----
function attachmentTargets(state, inv, spec, code) {
  if (!spec) return []
  if (spec.kind === 'asset') {
    return inv.assets.filter(asset => {
      if (asset.code === code) return false
      // Phase 2（C2）：特性判定走 effectiveTraits，运行期授予的特性也能当附件目标。
      if (spec.trait && !cardHasTrait(state, inv, asset.code, spec.trait)) return false
      if (spec.maxPerTarget) {
        const used = (asset.attachments || []).filter(entry => entry.code === code).length
        if (used >= spec.maxPerTarget) return false
      }
      return true
    })
  }
  if (spec.kind === 'location') return state.locations.filter(location => location.inPlay !== false)
  if (spec.kind === 'enemy') {
    return state.enemies.filter(enemy => !enemy.defeated
      && (!spec.trait || (enemy.traits || []).some(trait => String(trait).toLowerCase() === spec.trait.toLowerCase()))
      && (!spec.nonElite || !enemy.elite))
  }
  return []
}

function attachCardTo(state, seat, code, target, extra = {}) {
  target.attachments ||= []
  const id = nextInstanceId(state, 'a')
  target.attachments.push({ id, code, ownerSeat: seat, attachedRound: state.round, ...extra })
  return target.attachments[target.attachments.length - 1]
}

// 附带的 +1 生命/+1 神智等会提高宿主可承受的伤害上限。
function assetCapacityValue(asset, capacity) {
  let value = cardDef(asset.code)?.[capacity] || 0
  for (const entry of asset.attachments || []) {
    const passive = EFFECTS[entry.code]?.passive || registeredEntry(entry.code)?.passive
    if (!passive) continue
    if (capacity === 'health') value += passive.hostHealth || 0
    if (capacity === 'sanity') value += passive.hostSanity || 0
  }
  return value
}

function doPlay(state, seat, cardId, events, fromDiscard = false, noAction = false, copyCode = null, fromPlanAssetId = null, fromBackpackId = null) {
  const inv = state.investigators[seat]
  const def = cardDef(cardId)
  const copiedDef = copyCode && cardId === '03012' ? cardDef(copyCode) : null
  const playedDef = copiedDef || def
  if (!def) return
  if (!lolaCanUseCard(inv, cardId)) return
  if (def.type === 'skill' || (isWeaknessCard(def) && !playAccess(cardId).playableWeakness)) return
  if (cannotPlayTypes(inv).has(def.type)) {
    info(state, events, `⛔ ${inv.name} 受「刺耳之声」影响，不能打出${def.type === 'asset' ? '支援' : '事件'}。`)
    return
  }
  const plan = fromPlanAssetId && inv.assets.find(asset =>
    asset.id === fromPlanAssetId && registeredEntry(asset.code)?.cardPlan && !asset.exhausted && asset.attached?.includes(cardId))
  if (plan) {
    plan.attached.splice(plan.attached.indexOf(cardId), 1)
    plan.exhausted = true
  } else if (fromDiscard) {
    // 温蒂的护身符要求弃牌堆顶；「临时武器」等标记 playableFromDiscard 的卡可在弃牌堆任意位置。
    if (playAccess(cardId).fromDiscard) {
      if (!inv.discard.includes(cardId)) return
      inv.discard.splice(inv.discard.lastIndexOf(cardId), 1)
    } else {
      if (topDiscardEvent(state, inv) !== cardId) return
      inv.discard.splice(inv.discard.lastIndexOf(cardId), 1)
    }
  } else if (fromBackpackId) {
    // 04037 背包：从附属区当作手牌打出；最后一张打完后弃掉背包。
    const bag = inv.assets.find(asset => asset.id === fromBackpackId && registeredEntry(asset.code)?.cardBackpack)
    const index = bag?.attachedCards?.indexOf(cardId) ?? -1
    if (index < 0) return
    bag.attachedCards.splice(index, 1)
    if (!bag.attachedCards.length) {
      inv.discard.push(bag.code)
      leaveAsset(state, inv, bag, events)
      info(state, events, '🎒 背包里的最后一张牌被打出，弃掉背包。')
    }
  } else if (!removeCardByCode(inv.hand, cardId)) return

  // Phase 5（5b-10）：附属声明也可以写在能力层条目上。
  const attachSpec = EFFECTS[copyCode || cardId]?.attachTo ?? registeredEntry(copyCode || cardId)?.attachTo
  if (attachSpec && (attachSpec.kind === 'asset')) {
    const candidates = attachmentTargets(state, inv, attachSpec, cardId)
    if (!candidates.length) {
      if (!fromAttachmentAssetId) inv.hand.push(cardId)
      info(state, events, `没有可以附属「${cardName(cardId)}」的支援。`)
      return
    }
    const chosen = candidates.length === 1 ? candidates[0].id : requestChoice(state, { kind: 'target', source: cardId, seat,
      prompt: `选择要附属「${cardName(cardId)}」的支援。`, options: candidates.map(asset => ({ id: asset.id, label: cardName(asset.code) })) })
    const target = candidates.find(asset => asset.id === chosen) || candidates[0]
    attachCardTo(state, seat, cardId, target)
    // Phase 5（5b-10）：附带来的加值也可以写在能力层条目上。
    const onAttach = EFFECTS[cardId]?.onAttach || registeredEntry(cardId)?.onAttach || {}
    if (onAttach.ammo) target.uses = (target.uses || 0) + onAttach.ammo
    info(state, events, `「${cardName(cardId)}」附属到「${cardName(target.code)}」。`)
    if (!noAction) spendAction(state, inv)
    return
  }

  if (def.unique) {
    const exists = state.investigators.some((i) => i.assets.some((a) => cardDef(a.code)?.name === def.name))
    if (exists) { inv.hand.push(cardId); info(state, events, `「${cardName(cardId)}」已在场上，不能重复打出。`); return }
  }

  if (def.type === 'asset') replaceAssets(state, inv, def, events)

  // 「销赃贩子」（违法卡获得快速／已有快速则减 1 费用）与「自食其力」（幸存者事件减 2 费用）。
  const playPreview = tfaPlayCostPreview(state, inv, cardId)
  if (playPreview) {
    tfaApplyPlayCost(state, inv, playPreview, events)
    if (playPreview.noAction) noAction = true
    if (playPreview.discount) inv.playDiscount = (inv.playDiscount || 0) + playPreview.discount
  }

  const usesLolaDiscount = inv.lolaDiscount?.round === state.round && inv.lolaDiscount?.turnSeat === state.currentSeat
    && (playedDef.factions || [playedDef.klass, playedDef.klass2, playedDef.klass3].filter(Boolean)).includes(inv.lolaDiscount.role)
  const cost = cardId === '02010' ? Number(requestChoice(state, { kind: 'resource', source: '02010', seat,
    prompt: '选择花费多少资源，为珍妮的双枪装填等量弹药。',
    options: Array.from({ length: inv.resources + 1 }, (_, i) => ({ id: String(i), label: `${i} 资源／${i} 弹药` })),
  })) : playCost(state, inv, playedDef)
  delete inv.carcosaPlayDiscount
  delete inv.playDiscount
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
    // Phase 5（5b-8）：资产入场时读的 passive（额外行动等）也要认条目。
    const entryPassive = registeredEntry(cardId)?.passive
    const entryFlags = registeredEntry(cardId) || {}
    const eff = {
      ...(EFFECTS[cardId] || {}),
      ...(entryPassive ? { passive: entryPassive } : {}),
      ...(entryFlags.sealOnEnter ? { sealOnEnter: entryFlags.sealOnEnter } : {}),
    }
    const asset = newPlayerAssetInstance(state, inv, cardId)
    if (cardId === '02010') { asset.uses = cost; asset.usesType = 'ammo' }
    if (eff.onPlayDoom) asset.doom = eff.onPlayDoom
    if (eff.passive && eff.passive.extraAction && state.currentSeat === seat) inv.actionsLeft += eff.passive.extraAction
    inv.assets.push(asset)
    scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
    if (eff.sealOnEnter && state.chaosBag.includes(eff.sealOnEnter)) {
      sealChaosToken(state, eff.sealOnEnter, asset.id)
      info(state, events, `🔒 「${cardName(cardId)}」封印了 ${tokenLabel(eff.sealOnEnter)}。`)
    }
    // 封印任意标记：从混乱袋中选择一个符合条件的标记。
    if (eff.sealOnEnterChoice) {
      const symbols = ['skull', 'cultist', 'tablet', 'elderthing']
      const pool = state.chaosBag.filter(token => {
        if (eff.sealOnEnterChoice === 'symbol') return symbols.includes(token)
        if (eff.sealOnEnterChoice === 'nonAutofail') return token !== 'autofail'
        return true
      })
      if (pool.length) {
        const chosen = eff.sealOnEnterChoice === 'random'
          ? pool[Math.floor(randomValue(state) * pool.length)]
          : pool.length === 1 ? pool[0] : requestChoice(state, { kind: 'seal', source: cardId, seat,
            prompt: `选择要封印在「${cardName(cardId)}」上的标记。`,
            options: pool.map(token => ({ id: token, label: tokenLabel(token) })) })
        const token = pool.includes(chosen) ? chosen : pool[0]
        sealChaosToken(state, token, asset.id)
        info(state, events, `🔒 「${cardName(cardId)}」封印了 ${tokenLabel(token)}。`)
      }
    }
    info(state, events, `✔️ 「${cardName(cardId)}」已装备（${def.textZh || def.text || ''}）。`)
    // 入场即生效的支援（如「背包」「爱丽·霍洛维兹博士」）：
    // Phase 1 起走进入场钩子的唯一读点（描述子 kind: 'entersPlay'，回落旧 onEnter）。
    // Phase 5（5c-19）：描述子可以只带 resolve（效果 DSL 表达不了时），由它接管结算；
    // 读点仍是 lifecycle 的 entersPlay，引擎侧没有第二条路径（与弱点 resolve 同形）。
    const enterDescriptor = descriptorOfKind(copyCode || cardId, 'entersPlay')
    if (enterDescriptor?.resolve) {
      enterDescriptor.resolve({
        state, inv, seat, source: asset, descriptor: enterDescriptor, events, context: {},
        api: abilityApi(state, events),
      })
    } else {
      const enterEffect = entersPlayEffect(copyCode || cardId)
      if (enterEffect) {
        resolveEffect(state, seat, enterEffect, makeRuntime(state, events))
      }
    }
    triggerReaction(state, seat, 'assetEnteredPlay', events, { assetCode: cardId, assetId: asset.id, location: inv.location })
  } else if (def.type === 'event') {
    const eff = EFFECTS[copyCode || cardId] || {}
    // Phase 5（5c-10）：打出后的去向（移出游戏 / 洗回牌库）也可以写在 played 描述子上。
    const playedFlags = descriptorOfKind(copyCode || cardId, 'played') || {}
    const entryFlags = registeredEntry(copyCode || cardId) || {}
    const disposal = {
      removeAfterPlay: eff.removeAfterPlay === true || playedFlags.removeAfterPlay === true || entryFlags.removeAfterPlay === true,
      shuffleBackAfterPlay: eff.shuffleBackAfterPlay === true || playedFlags.shuffleBackAfterPlay === true || entryFlags.shuffleBackAfterPlay === true,
      // Phase 5（5c-24）：打出后去向的另外三项也认 played 描述子与条目级字段（旧 DSL 仍然优先）。
      exileAfterPlay: eff.exileAfterPlay === true || playedFlags.exileAfterPlay === true || entryFlags.exileAfterPlay === true,
      addToVictory: eff.addToVictory === true || playedFlags.addToVictory === true || entryFlags.addToVictory === true,
      becomesAsset: eff.becomesAsset === true || playedFlags.becomesAsset === true || entryFlags.becomesAsset === true,
    }
    const played = playedEffect(copyCode || cardId)
    // Phase 2：事件卡的「played」描述子可以直接带 resolve（数据表达不了时），
    // 与 effect 数据体共用同一个读点，因此迁移一张事件卡不需要改引擎。
    const playedDescriptor = descriptorOfKind(copyCode || cardId, 'played')
    // 「临时武器」等从弃牌堆打出的事件需要知道自己来自哪里。
    const previousFromDiscard = state._fromDiscardCode
    state._fromDiscardCode = fromDiscard ? cardId : null
    try {
      if (playedDescriptor?.resolve) {
        // Phase 5（5c-35）：quietPlay 的条目复刻「数据体事件卡」的日志——旧数据体不写
        // 「使用「X」：…」这一行，迁移后若照写会改玩家可见日志、重放指纹立刻对不上（03189）。
        executeDescriptor(state, { inv, source: { code: cardId, id: cardId }, descriptor: playedDescriptor,
          context: { fromDiscard, copyCode: copyCode || null, cardId }, events,
          silent: registeredEntry(cardId)?.quietPlay === true })
      } else if (played) resolveEffect(state, seat, played, makeRuntime(state, events))
    } finally {
      if (previousFromDiscard === undefined) delete state._fromDiscardCode
      else state._fromDiscardCode = previousFromDiscard
    }
    if (copyCode && cardId === '03012') {
      state.removedFromGame ||= []
      state.removedFromGame.push(cardId)
    } else if (disposal.removeAfterPlay) {
      state.removedFromGame ||= []
      state.removedFromGame.push(cardId)
    } else if (disposal.addToVictory) {
      state.victoryDisplay.push({ id: nextInstanceId(state, 'c'), code: cardId, originalCode: cardId,
        victory: cardDef(cardId)?.victory || 0 })
      info(state, events, `💎 「${cardName(cardId)}」被加入胜利展示区。`)
    } else if (disposal.exileAfterPlay) exilePlayerCard(state, inv, cardId, events)
    else if (disposal.becomesAsset) { /* 「危险预感」等：卡牌本身留在场上，由效果创建实例。 */ }
    else if (fromDiscard && disposal.shuffleBackAfterPlay) {
      inv.deck = shuffle([...inv.deck, cardId], () => randomValue(state))
      info(state, events, `「${cardName(cardId)}」洗回 ${inv.name} 的牌库。`)
    }
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
    placeLocation(state, locationId, events, seat)
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
  // 「不能移动，也不能被移动」（04337 无形之子）：任何移动来源都被拦住。
  if (enemy.immobile) {
    info(state, events, `⛔ 「${enemy.name}」不能移动，也不能被移动。`)
    return
  }
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
  // Phase 2（C1）：capability:investigate。
  if (capabilityBlocked(state, inv, 'investigate')) {
    info(state, events, `⛔ ${inv.name} 受当前效果影响，不能进行调查。`)
    return
  }
  const loc = state.locations.find((l) => l.id === (opts.locationId || inv.location))
  // 剧本可以在调查前收费/拦截（04073 曲折小道：没有指南针要花 3 资源）。
  const before = scenarioBehavior(state).beforeInvestigate?.(
    state, inv, loc, scenarioRuntime(state, events))
  if (before === false) return
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
  const temporaryShroud = (loc.carcosaShroudModifier?.round === state.round
    && loc.carcosaShroudModifier.turnSeat === state.currentSeat ? loc.carcosaShroudModifier.amount : 0)
    + (loc.turnShroudMod?.round === state.round && loc.turnShroudMod.turnSeat === state.currentSeat
      ? loc.turnShroudMod.amount : 0)
  // 帷幕的剧本修正：把正在调查的调查员也传进去（04182/04185 的帷幕取决于他的
  // 剩余行动/控制支援数，失落时代 P2）。D1：地点卡自己的声明式帷幕修正也在这里叠加。
  const scenarioShroud = (scenarioBehavior(state).locationShroudModifier?.(state, loc, inv) || 0)
    + entityModifierTotal(state, loc, 'locationShroud')
  // 「骷髅钥匙」：附属地点的帷幕设为 1（现在是附属条目上的声明式标记 shroudAsOne）。
  const keyed = (loc.attachments || []).some(entry => entry.shroudAsOne === true)
  const difficulty = keyed ? 1
    : loc.shroud + (loc.shroudMod || 0) + temporaryShroud + scenarioShroud + (state.fogMod || 0) + (opts.shroudMod || 0)
  const noIntellectBoost = skill === 'intellect' && loc.noIntellectBoost
  const baseValue = opts.baseValue ?? (loc.doubleBaseSkill ? (inv[skill] || 0) * 2
    : noIntellectBoost ? (inv[skill] || 0) : undefined)

  // 「值得信赖」：结算宿主支援的触发能力时每项技能 +1。
  const trustedHost = inv.assets.find(item => item.id === opts.assetId)
  const trustedFreshBonus = (trustedHost?.attachments || []).some(entry => entry.code === '04020') ? 1 : 0
  return performTest(state, seat, skill, difficulty, { source: { label: '调查', name: loc.name, code: loc.originalCode || loc.code }, baseValue,
    skillBonus: (noIntellectBoost ? 0 : skill === 'intellect' ? investigateBonus(inv) : 0) + (opts.bonus || 0)
      + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0) + trustedFreshBonus, resolve: r => {
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
    // 调查结果窗口（在发现线索之前）：04064 华美石室要先把线索翻成毁灭。
    scenarioBehavior(state).investigateResult?.(state, inv, loc, r, scenarioRuntime(state, events))
    if (r.success) {
      const successBy = r.value - difficulty
      // 「未知的呼唤」需要知道本回合是否成功调查了被指定的地点。
      if (inv.investigatedTurnRound !== state.round) { inv.investigatedTurnRound = state.round; inv.investigatedThisTurn = [] }
      if (!inv.investigatedThisTurn.includes(loc.id)) inv.investigatedThisTurn.push(loc.id)
      const gain = (1 + (opts.clueBonus || 0) + (r.clueBonus || 0)
        + (opts.successByClueEvery ? Math.floor(successBy / opts.successByClueEvery) : 0)) * (r.rewardMultiplier || 1)
      info(state, events, `${inv.name} 调查成功（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}）。`)
      triggerReaction(state, seat, 'investigateSuccess', events, { location: loc.id, successBy: r.value - difficulty })
      discoverClueAt(state, inv, gain, events)
      // 「古代巨石」：成功时额外发现 1 个线索、弃置自身并记录鉴定难度。
      if (opts.ancientStone) {
        discoverClueAt(state, inv, 1, events)
        const stone = inv.assets.find(asset => asset.code === '04022')
        if (stone) { leaveAsset(state, inv, stone, events); inv.discard.push(stone.code) }
        state.campaign.records ||= {}
        state.campaign.records.identifiedTheAncientStone = r.value
        info(state, events, `📜 剧本日志：你鉴定了古代巨石（难度 ${r.value}）。`)
      }
      if (opts.autoEvadeOnSuccess) {
        const targets = enemiesEngagedWith(state, inv)
        if (targets.length) {
          const enemy = targets.length === 1 ? targets[0] : chooseEnemyFrom(state, seat, targets, '03193')
          enemy.exhausted = true; disengageEnemy(state, enemy); afterEvade(state, inv, enemy, events)
        }
      }
      if (loc.fog) {
        // 朦胧之雾可以叠加：每次成功调查只吹散其中 1 张（-2 帷幕）。
        loc.fog -= 1
        loc.shroudMod = Math.max(0, (loc.shroudMod || 0) - 2)
        state.encounterDiscard.push(loc.fogCode || 'obscuringFog')
        if (!loc.fog) {
          delete loc.fogCode
          delete loc.fog
        }
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
  const printed = ALL_CARDS[loc.originalCode || loc.code] || {}
  const victory = Number(loc.victory || printed.victory || 0)
  if (loc.clues <= 0 && victory && !loc.victoryAwarded) {
    loc.victoryAwarded = true
    state.victory += victory
    // 复仇：地点进入胜利区时同样计入复仇点数（定义没写就回落到印刷值）。
    const vengeance = Number(loc.vengeance ?? printed.vengeance ?? 0)
    state.victoryDisplay ||= []
    state.victoryDisplay.push({ id: `location:${loc.id}`, code: loc.originalCode || loc.code,
      originalCode: loc.originalCode || loc.code, victory, vengeance })
    info(state, events, `💎 「${loc.name}」被完全调查，胜利点 +${victory}（累计 ${state.victory}）。`)
  }
}

function doFight(state, seat, opts, events, noSpend) {
  const inv = state.investigators[seat]
  // Phase 2（C1）：capability:fight。
  if (capabilityBlocked(state, inv, 'fight')) {
    info(state, events, `⛔ ${inv.name} 受当前效果影响，不能进行攻击。`)
    return
  }
  const enemy = state.enemies.find((e) => e.id === opts.enemyId)
  if (hiddenFightBlocked(state, inv, enemy)) return
  // 「不能被攻击」（失落时代 P2 通用开关，04048 守卫者；D1 起也可由敌人卡面声明）。
  if (enemy && enemyCannotBeAttacked(state, enemy)) {
    info(state, events, `⛔ 「${enemy.name}」不能被攻击。`)
    return
  }
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
  // 「枪法如神」等允许攻击连接地点上的敌人。
  const here = state.locations.find(item => item.id === inv.location)
  const atConnecting = (here?.connections || []).includes(enemy.location)
  const canFight = enemy.location === inv.location || (opts.atConnectingLocation && atConnecting)
  if (!canFight) { info(state, events, `${inv.name} 找不到可攻击的交战敌人。`); return }
  const mods = enemyStatMods(state)
  const skill = opts.skill || 'combat'
  const loc = state.locations.find(item => item.id === inv.location)
  const clueCombat = opts.ifCluesAtLocationCombatBonus && loc && loc.clues > 0 ? opts.ifCluesAtLocationCombatBonus : 0
  let difficulty = enemyFightValue(state, enemy, inv)
  // 「临时武器」等：本次攻击把敌人攻击值降低。
  if (opts.enemyFightMod) difficulty = Math.max(0, difficulty + opts.enemyFightMod)
  // 「暴露弱点」：本阶段下次攻击把攻击值视为 0。
  if (enemy.exposeWeakness?.round === state.round && enemy.exposeWeakness.phase === state.phase) {
    difficulty = 0
    delete enemy.exposeWeakness
  }
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
  // 「值得信赖」：结算宿主支援的触发能力时每项技能 +1。
  const trustedHost = inv.assets.find(item => item.id === opts.assetId)
  const trustedBonus = (trustedHost?.attachments || []).some(entry => entry.code === '04020') ? 1 : 0
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
      let dmg = opts.damageOverride != null
        ? Math.max(0, opts.damageOverride + (r.damageBonus || 0))
        : opts.successDamage === 'overDifficulty'
        ? Math.max(opts.minDamage || 1, Math.min(opts.maxDamage || 5, r.value - difficulty))
        : 1 + weaponBonus + conditional + (r.damageBonus || 0)
      dmg *= r.rewardMultiplier || 1
      // 「虚空碎裂」：本次攻击每揭示一个「0」标记，把它封印在卡上并额外 +1 伤害。
      // Phase 5（5c-37）：「虚空碎裂」这类「攻击时封印揭示的 0 并加伤害」由内容层声明。
      if (opts.sealZerosTo) {
        let zeros = 0
        for (const face of r.drawn || []) {
          if (face !== '0') continue
          if (sealRevealedChaosToken(state, '0', opts.sealZerosTo)) zeros += 1
        }
        if (zeros) {
          dmg += zeros
          info(state, events, `「${opts.sealZerosLabel || '虚空碎裂'}」封印了 ${zeros} 个「0」标记，本次攻击额外造成 ${zeros} 点伤害。`)
        }
      }
      const isMonster = (enemy.traits || []).some((t) => t.toLowerCase() === 'monster')
      if (isMonster && litaAuraAt(state, inv)) {
        dmg += 1
        info(state, events, `✨ 丽塔·钱德勒的激励：对怪物敌人的攻击 +1 伤害。`)
      }
      if (!enemyTextBlanked(state, enemy)
        && (entityRuleActive(state, enemy, 'cannot:beDamaged')
          || scenarioBehavior(state).enemyDamageAllowed?.(state, enemy, opts.assetId || null, seat) === false)) {
        dmg = 0
        info(state, events, `⛔ 「${enemy.name}」免疫这次攻击造成的伤害。`)
      }
      ;(state._resolution?.events || events).push({ type: 'presentation', kind: 'attack', direction: 'outgoing', seat, enemyId: enemy.id,
        assetId: opts.assetId, ...attackFx, name: enemy.name, location: enemy.location, damage: dmg, success: true,
        defeated: enemy.damageTaken + dmg >= enemyHealth(state, enemy)
          && enemyCanBeDefeated(state, enemy, opts.assetId || null, seat),
        tableState: captureTableState(state, getStat, getMaxSanity) })
      // 「特制弹药」：附属的枪械攻击怪物时 +1 伤害。
      if ((inv.assets.find(item => item.id === opts.assetId)?.attachments || []).some(entry => entry.code === '04193')
        && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'monster')) {
        dmg += 1
        info(state, events, '「特制弹药」：攻击怪物 +1 伤害。')
      }

      if (enemy.code === '02255' && opts.assetId !== '02254' && !enemyTextBlanked(state, enemy)) return
      // 「职业杀手」：本回合该敌人下次受到的攻击伤害 +1（一次性）。
      if (enemy.tfaDamageBonus?.round === state.round) {
        dmg += enemy.tfaDamageBonus.amount || 0
        delete enemy.tfaDamageBonus
      }
      if (opts.stormOfSpirits) {
        for (const other of state.enemies.filter(item => item.location === enemy.location)) {
          damageEnemy(state, other, other.id === enemy.id ? dmg : 2, seat, events, opts.assetId || null)
        }
      } else if (opts.flamethrowerSpread) {
        // 火焰喷射器：可选择把 4 点伤害分配给所有交战敌人（简化：轮流分配）。
        const engaged = state.enemies.filter(item => item.engagedSeat === seat && !item.defeated)
        const spread = engaged.length > 1 && requestChoice(state, { kind: 'effect', source: '04305', seat,
          prompt: `是否改为向 ${engaged.length} 个交战敌人分配 ${opts.flamethrowerSpread} 点伤害？`,
          options: [{ id: 'focus', label: `只对「${enemy.name}」造成 ${dmg} 点伤害` },
            { id: 'spread', label: `向所有交战敌人分配 ${opts.flamethrowerSpread} 点伤害` }] }) === 'spread'
        if (spread) {
          let remaining = opts.flamethrowerSpread
          while (remaining > 0) {
            let dealt = false
            for (const target of engaged.slice()) {
              if (remaining <= 0) break
              if (!state.enemies.includes(target)) continue
              damageEnemy(state, target, 1, seat, events, opts.assetId || null)
              remaining -= 1
              dealt = true
            }
            if (!dealt) break
          }
        } else if (state.enemies.includes(enemy)) enemy.damageTaken += dmg
      } else enemy.damageTaken += dmg
      if (!opts.stormOfSpirits) {
        scenarioBehavior(state).enemyDamaged?.(state, enemy, scenarioRuntime(state, events))
        enemy.defeatedBy = seat
      }
      // 「晕眩重击」：攻击成功时自动躲避被攻击敌人。
      for (const commitment of r.committed || []) {
        const code = typeof commitment === 'string' ? commitment : commitment.code
        if (!commitProfile(code)?.onSuccess?.autoEvadeAttackedEnemy) continue
        if (!state.enemies.includes(enemy)) continue
        enemy.exhausted = true
        disengageEnemy(state, enemy)
        info(state, events, `「${cardName(code)}」：上次攻击命中后自动躲避了「${enemy.name}」。`)
      }
      info(state, events, `⚔️ ${inv.name} 攻击成功（${SKILL_NAMES[skill]} ${r.value} vs ${difficulty}），对「${enemy.name}」造成 ${dmg} 点伤害（${enemy.damageTaken}/${enemy.health}）。`)
      scenarioBehavior(state).enemyAttackedSuccessfully?.(state, inv, enemy, scenarioRuntime(state, events))
      if (opts.defeatNonEliteOnSuccess && !enemy.elite) enemy.damageTaken = enemyHealth(state, enemy)
      if (state.enemies.includes(enemy) && enemy.damageTaken >= enemyHealth(state, enemy)
        && enemyCanBeDefeated(state, enemy, opts.assetId || null, seat)) defeatEnemy(state, enemy, events)
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
      // 反击：横置时通常不能反击，但 04062 瓦卢西亚的预示者等「横置时也能反击」的
      // 敌人（retaliateWhileExhausted）必须放行（失落时代 P2 钩子）。
      // Phase 2（C1）：ignore:retaliate 让攻击者的反击失效（卡面声明，引擎只问读点）。
      if (!opts.ignoreRetaliate && !ruleIgnored(state, inv, 'retaliate') && (enemy.retaliate || opts.grantRetaliate)
        && (!enemy.exhausted || enemy.retaliateWhileExhausted || opts.grantRetaliate)
        && !enemyTextBlanked(state, enemy)) {
        enemyAttack(state, enemy, inv, events, `⚡ 「${enemy.name}」反击 ${inv.name}：${enemy.damage} 点伤害、${enemy.horror} 点恐惧。`, { kind: 'retaliate' })
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
  // Phase 2（C1）：capability:evade。
  if (capabilityBlocked(state, inv, 'evade')) {
    info(state, events, `⛔ ${inv.name} 受当前效果影响，不能进行躲避。`)
    return
  }
  const enemy = state.enemies.find((e) => e.id === opts.enemyId)
  if (!noSpend) payActionCost(state, inv, 'evade', events)
  if (!enemy) { info(state, events, `${inv.name} 找不到可躲避的敌人。`); return }
  const canEvade = enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location)
  if (!canEvade) { info(state, events, `${inv.name} 找不到可躲避的交战敌人。`); return }
  const mods = enemyStatMods(state)
  if (opts.auto) {
    enemy.exhausted = true
    if (canDisengage(state, inv, enemy)) disengageEnemy(state, enemy)
    else info(state, events, `${inv.name} 无法与「${enemy.name}」解除交战。`)
    info(state, events, `💨 ${inv.name} 摆脱了「${enemy.name}」！`)
    afterEvade(state, inv, enemy, events, null)
    return
  }
  const evadeSkill = opts.skill || 'agility'
  const evadeBase = Math.max(0, enemyEvadeValue(state, enemy, inv) + (opts.evadeModifier || 0))
  // 「战壕大衣」等支援在躲避尝试期间提供敏捷加值。
  const evadeAssetBonus = (inv.assets || []).reduce((sum, item) =>
    sum + (assetEffect(inv, item)?.passive?.evadeBonus || 0), 0)
  return performTest(state, seat, evadeSkill, evadeBase, { source: { label: '躲避', enemyId: enemy.id, name: enemy.name, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code }, baseValue: opts.baseValue,
    skillBonus: (opts.bonus || 0) + evadeAssetBonus + (opts.addSkill ? getStat(state, inv, opts.addSkill) : 0),
    doubleNegative: (enemy.ruleId === 'huntingNightgaunt' || enemy.code === 'huntingNightgaunt' || enemy.code === '01172') && !enemyTextBlanked(state, enemy), resolve: r => {
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
      if (canDisengage(state, inv, enemy)) disengageEnemy(state, enemy)
      else info(state, events, `${inv.name} 无法与「${enemy.name}」解除交战。`)
      // 「职业杀手」：躲避成功后该敌人本回合下次受伤 +1。
      for (const commitment of r.committed || []) {
        const code = typeof commitment === 'string' ? commitment : commitment.code
        const bonus = commitProfile(code)?.onEvadeSuccess?.damageBonusNext
        if (bonus && state.enemies.includes(enemy)) enemy.tfaDamageBonus = { amount: bonus, round: state.round }
      }
      if (opts.preventEngageThisTurn) enemy.preventEngageSeat = { seat, round: state.round, turnSeat: state.currentSeat }
      if (opts.evadeOthersOnSuccess) for (const other of state.enemies.filter(item => item.engagedSeat === seat)) autoEvadeEnemy(state, other, events)
      // 「悄然遁去」等：该敌人在下个补给阶段不重整。
      if (opts.skipReadyRounds) enemy.preventReady = { rounds: opts.skipReadyRounds, from: state.round }
      // 「拉莱耶迷雾」等：躲避后可以移动到连接地点。
      if (opts.moveAfterEvade) {
        const destinations = investigatorMoveDestinations(state, seat, {})
        if (destinations.length) {
          const answer = requestChoice(state, { kind: 'move', source: '04029', seat, canSkip: true,
            prompt: '是否移动到连接地点？',
            options: [{ id: 'skip', label: '留在原地' }, ...destinations.map(id => ({ id, label: locName(state, id) }))] })
          if (answer !== 'skip') relocateInvestigator(state, seat, answer, events)
        }
      }
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
      // 「狗屎运」：躲避失败且低于难度 2 点及以内时可以打出。
      reactionWindow(state, 'evadeFail', { when: 'evadeFail', seat, location: inv.location, enemy,
        failedBy: Math.max(0, evadeBase - r.value), prompt: `躲避「${enemy.name}」失败` }, events)
      // Phase 2（C1）：ignore:alert 让躲避失败时的警戒反击失效。
      if (enemy.alert && !ruleIgnored(state, inv, 'alert') && !enemy.exhausted && !enemyTextBlanked(state, enemy)) {
        enemyAttack(state, enemy, inv, events, `⚡ 「${enemy.name}」警戒反击 ${inv.name}。`, { kind: 'alert' })
      }
    }
    // 「临时路障」：从弃牌堆打出时，可以再自动躲避一个躲避值不超过成功点数的敌人。
    if (r.success && opts.evadeSecondUpTo != null) {
      const successBy = Math.max(0, r.value - evadeBase)
      const extra = state.enemies.filter(other => other.id !== enemy.id && other.location === inv.location
        && enemyEvadeValue(state, other, inv) <= Math.min(successBy, opts.evadeSecondUpTo))
      if (extra.length) {
        const chosen = extra.length === 1 ? extra[0].id : requestChoice(state, { kind: 'target', source: '04312', seat,
          prompt: `再躲避一个躲避值不超过 ${successBy} 的敌人。`, options: extra.map(other => ({ id: other.id, label: other.name })) })
        const second = extra.find(item => item.id === chosen)
        if (second) {
          autoEvadeEnemy(state, second, events)
          info(state, events, `💨 「${cardName('04312')}」额外躲避了「${second.name}」。`)
        }
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
  // Phase 2（C1）：capability:triggerAbilities。
  if (capabilityBlocked(state, inv, 'triggerAbilities')) return
  if (!lolaCanUseCard(inv, asset.code)) return
  const eff = assetEffect(inv, asset)
  const ability = eff && eff.abilities && eff.abilities[abilityIndex]
  if (!ability) return
  // 能力层描述子：成本、上限、日志与 resolve 走同一条路径，不再经过效果 DSL。
  if (ability.descriptor) {
    const descriptor = ability.descriptor
    if (!descriptorUsable(state, inv, asset, descriptor, { windowId: state.timingWindow, mode: 'action' })) return
    executeDescriptor(state, { inv, source: asset, descriptor, context: { targetId, optionIndex },
      events, windowId: state.timingWindow, legacyAbilityLog: true })
    return
  }
  // Phase 2（C3）：旧式能力也走同一份费用求值（动态费用不再只有描述子能用）。
  const cost = normalizeCostValues(ability.cost || {}, { state, inv, source: asset, descriptor: ability.descriptor || null }) || {}
  // 「围困」等：每次检定只能使用一次。
  if (ability.oncePerTest && state.skillTest?.usedAbilities?.[`${asset.id}:${abilityIndex}`]) return
  // 「雅沃托」等：每阶段只能使用一次。
  if (ability.oncePerPhase
    && inv.usedAbilities?.[`${asset.id}:${abilityIndex}:${state.round}:${state.phase}`]) return

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
  // 「一目十行」等：以个人线索作为能力费用。
  if (cost.clues) {
    if ((inv.clues || 0) < cost.clues) return
    inv.clues -= cost.clues
    syncClues(state)
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
  if (ability.oncePerTest) {
    state.skillTest.usedAbilities ||= {}
    state.skillTest.usedAbilities[`${asset.id}:${abilityIndex}`] = true
  }
  if (ability.oncePerPhase) {
    inv.usedAbilities ||= {}
    inv.usedAbilities[`${asset.id}:${abilityIndex}:${state.round}:${state.phase}`] = true
  }
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

// ---------------------------------------------------------------------------
// 能力层（P0-A）：声明式描述子的执行与窗口收集
// ---------------------------------------------------------------------------

// 能力 resolve() 可用的窄接口。只用引擎已有的入口，避免内容层直接改状态。
function abilityApi(state, events) {
  return {
    info: text => info(state, events, text),
    random: () => randomValue(state),
    choice: options => requestChoice(state, options),
    damage: (seat, amount) => applyDamage(state, state.investigators[seat], amount, events),
    horror: (seat, amount) => applyHorror(state, state.investigators[seat], amount, events),
    directDamage: (seat, amount) => applyDamage(state, state.investigators[seat], amount, events, true),
    directHorror: (seat, amount) => applyHorror(state, state.investigators[seat], amount, events, true),
    healDamage: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.damage = Math.max(0, (inv.damage || 0) - amount)
    },
    healHorror: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.horror = Math.max(0, (inv.horror || 0) - amount)
    },
    gainResources: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.resources += amount
    },
    loseResources: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.resources = Math.max(0, inv.resources - amount)
    },
    drawCards: (seat, amount) => drawCards(state, state.investigators[seat], amount, events),
    // Phase 5（5c-18）：抽牌并把引擎的抽牌日志写进事件流。
    // 「扒手」这类旧 handler 自己遍历 drawCards 的返回值打日志，走 api.drawCards 会丢掉
    // 「抽取了 1 张牌」这行——它进 state.log 也进重放指纹，因此需要一个同源的带日志版本。
    drawCardsLogged: (seat, amount) => {
      const texts = drawCards(state, state.investigators[seat], amount, events)
      for (const text of texts) info(state, events, text)
      return texts.length
    },
    discardFromHand: (seat, code) => {
      const inv = state.investigators[seat]
      const index = inv?.hand.indexOf(code)
      if (index == null || index < 0) return false
      inv.hand.splice(index, 1)
      inv.discard.push(code)
      return true
    },
    discoverClue: (seat, amount = 1) => discoverClueAt(state, state.investigators[seat], amount, events),
    placeClues: (seat, amount = 1) => placeCluesOnLocation(state, state.investigators[seat], amount, events),
    moveInvestigator: (seat, locationId) => relocateInvestigator(state, seat, locationId, events),
    damageEnemy: (enemy, amount, seat) => damageEnemy(state, enemy, amount, seat, events),
    moveEnemy: (enemy, locationId) => relocateEnemy(state, enemy, locationId, events),
    engage: (enemy, seat) => engageEnemy(state, enemy, seat, events),
    autoEvade: enemy => autoEvadeEnemy(state, enemy, events),
    exhaust: card => { if (card) card.exhausted = true },
    ready: card => { if (card) card.exhausted = false },
    addUses: (card, amount) => { if (card) card.uses = (card.uses || 0) + amount },
    addDoom: (amount = 1) => addDoom(state, amount, events),
    // Phase 1（A1）：持续效果的唯一创建接口。修正与能力都从 state.effects 读，
    // 到期由引擎的统一过期点处理，内容层不需要（也不允许）自己记时间戳。
    addEffect: (record, ownerSeat = null) => createEffect(state, {
      ...record,
      controllerSeat: record?.controllerSeat ?? ownerSeat ?? state.currentSeat,
    }),
    effects: () => activeEffects(state),
    addChaosToken: token => { state.chaosBag.push(token) },
    removeChaosToken: token => {
      const index = state.chaosBag.indexOf(token)
      if (index >= 0) state.chaosBag.splice(index, 1)
      return index >= 0
    },
    addTestValue: amount => { if (state.skillTest) state.skillTest.value = (state.skillTest.value || 0) + amount },
    // Phase 2（B2）：伤害/恐惧的统一入口，可以指定分配策略。
    //   strategy: 'distribute'（默认，逐点询问）| 'self' | 'assetsFirst' | 'assetsOnly'
    harm: (seat, spec = {}) => {
      const target = state.investigators[seat] || state.investigators[state.currentSeat]
      if (!target) return null
      applyHarm(state, target, spec.damage || 0, spec.horror || 0, events,
        spec.direct === true, spec.attack || null, spec.assetsFirst === true, spec.strategy || null)
      return target
    },
    // Phase 2（B3）：检定结果契约。
    testResult: () => state.lastTestResult || null,
    describeTest: () => describeTestResult(state.lastTestResult),
    testStage: () => testStage(state.skillTest?.stage),
    // 「失败后重试」：用同一份 skill / difficulty / source 重跑一次检定，可加值。
    retryTest: (seat, options = {}) => {
      const last = state.lastTestResult
      if (!last) return null
      return performTest(state, Number.isInteger(seat) ? seat : (last.seat ?? state.currentSeat),
        last.skill, last.difficulty, {
          source: last.source ? { ...last.source, label: `${last.source.label || '检定'}（重试）` } : null,
          skillBonus: options.bonus || 0,
          resolve: options.resolve,
        })
    },
    // 「强制投入」：不询问就把手牌放进本次检定（返回增加的点数）。
    commitCards: (seat, codes = []) => {
      const owner = state.investigators[seat]
      if (!owner || !state.skillTest) return 0
      let added = 0
      for (const code of codes) {
        const index = owner.hand.indexOf(code)
        if (index < 0) continue
        owner.hand.splice(index, 1)
        const icons = commitIcons(state, owner, code, state.skillTest.skill)
        state.skillTest.value = (state.skillTest.value || 0) + icons
        state.skillTest.committed.push({ seat: owner.seat, code, icons })
        info(state, events, `${owner.name} 强制投入「${cardName(code)}」（${icons} 个图标）。`)
        added += icons
      }
      return added
    },
    // Phase 2（B5）：看牌与检索。
    lookAt: (seat, options) => lookAt(state, seat, options, events),
    searchDeck: (seat, options) => searchDeck(state, seat, options, events),
    describeLook,
    describeSearch,
    // Phase 2（B6）：把一张牌搬到别处（默认按当前行动者）。
    moveCard: spec => moveCardTo(state, state.investigators[state.currentSeat], spec, events),
    // Phase 2（C4）：上限的描述文案（AI 上下文/图鉴用）。
    describeLimit: descriptor => describeLimit(descriptor),
    // Phase 2 收尾：迁移逃生卡时需要的几个薄包装（都只是已有引擎入口的别名，
    // 内容层仍然不直接改 state）。
    addPendingTestBonus: amount => {
      if (!state.skillTest) return 0
      state.skillTest.pendingBonus = (state.skillTest.pendingBonus || 0) + amount
      return state.skillTest.pendingBonus
    },
    // Phase 5（5c-18）：「田野调查」这类「本阶段下一次技能检定 +N」。读点仍在 performTest 里
    // （inv.fieldwork 的字段名沿用旧原语，避免改读点形状；行为与迁移前逐字一致）。
    phaseTestBonus: (seat, amount = 2) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.fieldwork = { round: state.round, phase: state.phase, amount }
      return amount
    },
    returnClueToLocation: (seat, amount = 1) => {
      const owner = state.investigators[seat]
      const location = state.locations.find(item => item.id === owner?.location)
      if (!owner || !location) return 0
      // 「放回 1 个线索」是效果而不是退还费用：线索通常已经作为能力费用付掉了，
      // 因此这里直接放到地点上，不再从调查员身上扣（与旧原语 bookwormBoost 一致）。
      location.clues = (location.clues || 0) + amount
      syncClues(state)
      info(state, events, `🔍 ${owner.name} 把 ${amount} 个线索放回「${locName(state, location.id)}」。`)
      return amount
    },
    placeDoomOnCard: (card, amount = 1) => {
      if (!card) return 0
      placeDoomOnCard(state, card, amount, events, { silent: false })
      return card.doom || 0
    },
    removeThreat: card => {
      const owner = state.investigators.find(item => (item.threat || []).includes(card))
      if (!owner) return false
      removeThreat(state, owner, card, events)
      return true
    },
    drawEncounter: seat => drawEncounter(state, state.investigators[seat], events),
    endTurn: seat => doEndTurn(state, seat ?? state.currentSeat, events),
    // 支援自身的恐惧/充能（不是调查员的）：03112/03271 这类"放在自己身上的计数"。
    addAssetHorror: (card, amount = 1) => {
      if (!card) return 0
      card.horror = (card.horror || 0) + amount
      return card.horror
    },
    setAssetUses: (card, amount) => {
      if (!card) return 0
      card.uses = Math.max(0, amount)
      return card.uses
    },
    discardTopOfDeck: (seat, amount = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return []
      const discarded = []
      for (let i = 0; i < amount && owner.deck.length; i++) {
        const code = owner.deck.pop()
        owner.discard.push(code)
        discarded.push(code)
        info(state, events, `🃏 ${owner.name} 弃掉牌库顶的「${cardName(code)}」。`)
      }
      return discarded
    },
    // 本回合有效的帷幕修正（原引擎的 turnShroudMod / carcosaShroudModifier）。
    tempShroudMod: (location, amount) => {
      if (!location) return 0
      location.turnShroudMod = { amount, round: state.round, turnSeat: state.currentSeat }
      return amount
    },
    // Phase 5（5c）：把玩家卡作为「地点附属」放到场上（隐藏处 / 伏击 / 陷阱 / 捷径）。
    // 数据形状与引擎的读点一致（state.playerLocationAttachments），内容层不碰 state 内部结构。
    attachToLocation: (locationId, fields = {}) => {
      if (!locationId) return null
      state.playerLocationAttachments ||= []
      const attachment = {
        code: fields.code, location: locationId,
        ownerSeat: fields.ownerSeat ?? state.currentSeat ?? 0, exhausted: false,
        ...(fields.extra || {}),
      }
      state.playerLocationAttachments.push(attachment)
      info(state, events, `📌 「${cardName(fields.code)}」附属到「${locName(state, locationId)}」。`)
      return attachment
    },
    // Phase 5（5c）：按打出规则直接打出另一张牌（折扣 / 免行动由选项决定）。
    playCard: (seat, code, options = {}) => {
      const owner = state.investigators[seat]
      if (!owner || !(owner.hand.includes(code) || options.fromDiscard === true)) return false
      if (options.discount) owner.carcosaPlayDiscount = options.discount
      doPlay(state, seat, code, events, options.fromDiscard === true, options.noAction === true)
      return true
    },
    // Phase 5（5c）：调查与躲避的主体流程（与行动入口共用同一份规则与日志）。
    // options 直接透传：{ locationId, shroudMod, addSkill, clueBonus, lockpicksAssetId, ancientStone } /
    // { enemyId, skill, addSkill, moveAfterEvade, skipReadyRounds, evadeModifier }。
    investigate: (seat, options = {}) => doInvestigate(state, seat, { ...options }, events, true),
    evade: (seat, options = {}) => doEvade(state, seat, { ...options }, events, true),
    // Phase 5（5c）：读取敌人的当前战斗值（含修正），供「攻击战斗值最高的交战敌人」这类卡使用。
    enemyFight: (enemy, seat = state.currentSeat) => enemyFightValue(state, enemy, state.investigators[seat]),
    // Phase 5（5c）：敌人的当前躲避值（含修正），躲避类检定（「伏击」等）要用。
    enemyEvade: (enemy, seat = state.currentSeat) => enemyEvadeValue(state, enemy, state.investigators[seat]),
    // Phase 5（5c）：调查员当前的伤害上限（含被动与修正），「最多额外承受 N 点伤害」这类卡要用。
    maxHealth: (seat = state.currentSeat) => getMaxHealth(state.investigators[seat]),
    // Phase 5（5c）：把一张支援弃掉（离场 + 进弃牌堆）。
    discardAsset: (seat, card) => {
      const owner = state.investigators[seat]
      if (!owner || !card) return false
      leaveAsset(state, owner, card, events)
      if (!card.removedFromGame) owner.discard.push(card.code)
      return true
    },
    // Phase 5（5c）：击败敌人（恐惧/战斗之外的效果，如「与你们同归于尽」）。
    defeatEnemy: (enemy, seat = state.currentSeat) => {
      if (!enemy || !state.enemies.includes(enemy)) return false
      enemy.defeatedBy = seat
      defeatEnemy(state, enemy, events)
      return true
    },
    moveClueToLocation: (fromId, toId, amount = 1) => {
      const from = state.locations.find(location => location.id === fromId)
      const to = state.locations.find(location => location.id === toId)
      if (!from || !to) return 0
      const moved = Math.min(amount, from.clues || 0)
      if (!moved) return 0
      from.clues -= moved
      to.clues = (to.clues || 0) + moved
      syncClues(state)
      return moved
    },
    test: (seat, skill, difficulty, options = {}) => performTest(state, seat, skill, difficulty, options),
    setShroudMod: (location, amount) => { if (location) location.shroudMod = (location.shroudMod || 0) + amount },
    addLocationTrait: (location, trait) => {
      if (!location) return
      location.traits ||= []
      if (!location.traits.some(value => String(value).toLowerCase() === String(trait).toLowerCase())) location.traits.push(trait)
    },
    gainAction: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      if (inv) inv.actionsLeft += amount
    },
    finish: key => finishScenario(state, key, events),
    // 查询与检索：内容层不直接读引擎内部实现，只通过这些窄接口。
    cardName: code => cardName(code),
    // Phase 2（C2）：运行期特性读点（含 add:trait 授予），内容层不需要 import 引擎。
    cardTraits: code => cardDef(code)?.traits || [],
    cardIcons: code => ({ ...(cardDef(code)?.icons || {}) }),
    effectiveTraits: code => effectiveTraits(state, state.investigators[state.currentSeat], code),
    locationName: id => locName(state, id),
    // Phase 5（5c）：卡面印刷数值（恐惧/伤害上限），「治愈支援身上的恐惧」这类卡要用。
    cardSanity: code => cardDef(code)?.sanity || 0,
    cardType: code => cardDef(code)?.type || null,
    // Phase 5（5c）：治愈支援自身承受的伤害/恐惧（「急救」这类卡）。
    healAsset: (card, spec = {}) => {
      if (!card) return card
      card.damage = Math.max(0, (card.damage || 0) - (spec.damage || 0))
      card.horror = Math.max(0, (card.horror || 0) - (spec.horror || 0))
      return card
    },
    cardFactions: code => {
      const def = cardDef(code)
      return def?.factions || (def?.klass ? [def.klass] : [])
    },
    // Phase 5（5c）：「本回合该敌人的战斗/躲避值 -N」（解剖图）。
    enemyTestModifier: (enemy, spec = {}) => {
      if (!enemy) return enemy
      enemy.carcosaDifficultyModifier = {
        fight: spec.fight || 0, evade: spec.evade || 0,
        round: state.round, turnSeat: state.currentSeat,
      }
      return enemy
    },
    // Phase 5（5c）：「本阶段非精英敌人不攻击」（内讧）。
    preventNonEliteAttacks: (seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      owner.infighting = { round: state.round, phase: 'enemy' }
      return owner.infighting
    },
    // Phase 5（5c）：把敌人移出游戏（不经过伤害）与把卡洗回遭遇牌库（「劝服」）。
    removeEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      return enemy
    },
    shuffleIntoEncounterDeck: code => {
      state.encounterDeck = shuffle([...state.encounterDeck, code], () => randomValue(state))
      return state.encounterDeck.length
    },
    // Phase 5（5c-10）：这张正在结算的事件是否来自弃牌堆（临时武器 / 应急处理）。
    fromDiscardCode: () => state._fromDiscardCode || null,
    shuffleDiscardIntoDeck: (seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.deck = shuffle([...owner.deck, ...owner.discard], () => randomValue(state))
      owner.discard = []
      return owner.deck.length
    },
    // Phase 5（5c-23）：「追猎」——遭遇牌库顶 N 张里的敌人候选（只读，顺序按牌库顶在数组末位）。
    encounterEnemies: (count = 9) => {
      const deck = state.encounterDeck || []
      const top = deck.slice(-Math.min(count, deck.length))
      return top.filter(code => Boolean(enemyDef(code)))
    },
    // Phase 5（5c-23）：从遭遇牌库取一张敌人放到该座位所在地点、洗回牌库并交战。
    spawnEncounterEnemy: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return null
      const index = state.encounterDeck.lastIndexOf(code)
      if (index < 0) return null
      state.encounterDeck.splice(index, 1)
      state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
      const spawned = spawnEnemy(state, code, owner.location, seat)
      if (spawned) engageEnemy(state, spawned, seat, events)
      return spawned
    },
    // Phase 5（5c-22）：「预警」花 1 个线索并把它放回所在地点（这是卡的代价，不是退还费用）。
    // 三处写入与旧 handler 逐字一致：个人线索 -N、state.clues（各人线索之和）-N、地点线索 +N。
    spendClueToLocation: (seat, amount = 1) => {
      const owner = state.investigators[seat]
      const location = state.locations.find(item => item.id === owner?.location)
      if (!owner || !location || (owner.clues || 0) < amount) return 0
      owner.clues -= amount
      state.clues = (state.clues || 0) - amount
      location.clues = (location.clues || 0) + amount
      return amount
    },
    // Phase 5（5c-30）：「骷髅钥匙」把支援附属到所在地点（可带声明式字段，如 shroudAsOne）。
    attachSelfToLocation: (card, locationId, fields = {}) => {
      const owner = state.investigators.find(person => (person.assets || []).includes(card))
      const location = state.locations.find(item => item.id === locationId)
      if (!owner || !location || !card) return null
      leaveAsset(state, owner, card, events)
      return attachCardTo(state, owner.seat, card.code, location, fields)
    },
    // Phase 5（5c-29）：「古代雕文」这类卡要把「研究记录」写进战役账本。
    recordResearch: key => {
      if (!key) return false
      recordResearch(state, key)
      return true
    },
    // Phase 5（5c-29）：支援的充能类型（`usesType`）也要能由内容层声明。
    setUsesType: (card, type) => {
      if (!card || !type) return null
      card.usesType = type
      return card.usesType
    },
    // Phase 5（5c-28）：充能支援的判定与「能不能离场」——「灵语人 / 愤怒之灵」这类卡的候选筛选。
    isChargeAsset: card => isChargeAsset(card),
    canLeavePlay: card => !assetCannotLeavePlay(card),
    // Phase 5（5c-27）：「掩埋」——把刚击败的非精英敌人与这张事件卡一起放进胜利区。
    buryEnemyInVictory: (enemy, eventCode) => {
      if (!enemy || enemy.elite) return false
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
      // 事件卡本身也进胜利区：处置段读的是反应上下文里的 eventToVictory。
      if (state._reaction) state._reaction.eventToVictory = eventCode
      if (eventCode) info(state, events, `「${cardName(eventCode)}」将「${enemy.name}」和自身加入胜利区。`)
      return true
    },
    // Phase 5（5c-26）：「暗示」这类「先选敌人、再按某个技能躲避」的能力。
    // 与 effectError / validateMove 共用同一份 abilityTargets（旧实现就是 chooseEnemy）。
    chooseEnemy: (seat, effect = {}) => chooseEnemy(state, seat, effect),
    // Phase 5（5c-25）：调查员级的「本局一次」标记（读点就是 inv.gameFlags，随存档往返）。
    gameFlag: (seat, key) => Boolean(state.investigators[seat]?.gameFlags?.[key]),
    setGameFlag: (seat, key, value = true) => {
      const owner = state.investigators[seat]
      if (!owner) return false
      owner.gameFlags ||= {}
      if (value) owner.gameFlags[key] = true
      else delete owner.gameFlags[key]
      return Boolean(value)
    },
    // Phase 5（5c-25）：当前密谋上的毁灭数与移除（「古代遗物」这类卡要读它再写日志）。
    doom: () => state.doom || 0,
    removeDoom: (amount = 1) => {
      const removed = Math.min(amount, state.doom || 0)
      state.doom = (state.doom || 0) - removed
      return removed
    },
    // Phase 5（5c-24）：把正在结算的这张牌**自身**放置入场（「危险预感」这类打出后变成场上卡的事件）。
    putSelfIntoPlay: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return null
      const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round })
      owner.assets.push(asset)
      return asset
    },
    // Phase 5（5c-24）：从混乱袋随机抽一个标记并封印到这张卡上（随机数走 randomValue，可重放）。
    // 空袋时的兜底与旧实现逐字一致（把 undefined 塞回袋子，等价于无事发生）。
    sealRandomChaosToken: card => {
      if (!card) return null
      let token
      if (state.chaosBag.length) {
        token = state.chaosBag.splice(Math.floor(randomValue(state) * state.chaosBag.length), 1)[0]
      }
      if (!token) { state.chaosBag.push(token); return null }
      card.sealedToken = token
      state.chaos.sealed ||= []
      state.chaos.sealed.push({ token, source: card.id })
      state.sealedTokens = state.chaos.sealed.map(entry => entry.token)
      return token
    },
    // Phase 5（5c-24）：混乱标记的展示文案（内容层写日志时用）。
    tokenLabel: token => tokenLabel(token),
    // Phase 5（5c-21）：「以折扣打出另一张牌」的候选筛选——这张牌现在打出去有没有合法目标。
    // 与 effectError / validateMove 用的是同一份 abilityTargets；没有目标要求时恒为真
    // （与旧 handler 的判定一致：`played` 为空也算"可以打"）。
    cardHasLegalTarget: (seat, code) => {
      const owner = state.investigators[seat]
      const played = playedEffect(code)
      if (!owner || !played) return true
      if (played.target === 'enemy' || ['fight', 'evade'].includes(played.type)) {
        return abilityTargets(state, owner, played).length > 0
      }
      return true
    },
    // Phase 5（5c-19）：把控制的一张支援拿回手牌（「求助盟友」）。
    // 离场钩子照常结算（leaveAsset），与旧 handler 的写法一致。
    returnAssetToHand: (seat, card) => {
      const owner = state.investigators[seat]
      if (!owner || !card) return false
      leaveAsset(state, owner, card, events)
      owner.hand.push(card.code)
      return true
    },
    // Phase 5（5c-19）：读牌库顶 N 张的卡号（**只读**，不移动也不洗牌）。
    // 顺序与 `inv.deck.slice(-N)` 相同（末位是牌库顶），筛选逻辑留在内容层。
    topDeckCodes: (seat, count = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return []
      const n = Math.min(Math.max(0, count), owner.deck.length)
      return n > 0 ? owner.deck.slice(-n) : []
    },
    // Phase 5（5c-19）：把牌库里的一张牌附属到场上的一张支援（不占用槽位）。
    attachCardFromDeck: (host, code) => {
      const owner = state.investigators.find(person => (person.assets || []).includes(host))
      if (!owner || !code) return null
      const index = owner.deck.lastIndexOf(code)
      if (index < 0) return null
      owner.deck.splice(index, 1)
      return attachCardTo(state, owner.seat, code, host)
    },
    shuffleDeck: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.deck = shuffle(owner.deck, () => randomValue(state))
      return owner.deck.length
    },
    // Phase 5（5c-9）：检定的「揭示计划」与额外标记数（黑暗预言 / 勇斗异劫）。
    // Phase 5（5c-12）：重试上一次失败的技能检定（学无止境）。
    retryLastFailedTest: (cardLabel, skillBonus = 0) => {
      const failed = state.lastFailedTest
      const active = state.investigators[state.currentSeat]
      if (!failed || failed.seat !== state.currentSeat) {
        info(state, events, '没有可以重新尝试的技能检定。')
        return false
      }
      info(state, events, `🔁 ${active.name} 用「${cardLabel}」重新尝试${SKILL_NAMES[failed.skill]}检定（+${skillBonus}）。`)
      performTest(state, failed.seat, failed.skill, failed.difficulty, {
        source: failed.source, skillBonus, peril: failed.peril, resolve: failedTestResolves.get(state),
      })
      return true
    },
    // Phase 5（5c-12）：这名调查员**下一次**检定不揭示混乱标记（秘籍的主动能力）。
    skipNextTestTokens: seat => {
      const owner = state.investigators[seat]
      if (!owner) return false
      owner.nextTestNoTokens = { round: state.round }
      return true
    },
    // Phase 5（5c-12）：本次检定不揭示混乱标记（秘籍 / 纳克特手稿）。
    skipTestTokens: () => {
      if (!state.skillTest) return false
      state.skillTest.skipTokens = true
      return true
    },
    // Phase 5（5c-17）：把这张支援附属到敌人身上（手铐：横置 + 脱离交战）。
    attachSelfTo: (code, enemyId) => {
      const active = state.investigators[state.currentSeat]
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (!active || !enemy) return false
      const existing = active.assets.find(asset => asset.code === code)
      if (existing) leaveAsset(state, active, existing, events, { keepAttachments: true })
      attachCardTo(state, active.seat, code, enemy)
      enemy.exhausted = true
      disengageEnemy(state, enemy)
      return true
    },
    // Phase 5（5c-16）：卡面费用与"直接放置入场"（发掘古物）。
    cardCost: code => cardDef(code)?.cost ?? 0,
    putAssetIntoPlay: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !cardDef(code)) return false
      if (!removeCardByCode(owner.hand, code)) return false
      owner.assets.push(newPlayerAssetInstance(state, owner, code))
      return true
    },
    // Phase 5（5c-15）：把伤害设为上限并做击败检查（「我会在地狱里见你」这类自我击败）。
    lethalSelfDamage: seat => {
      const target = state.investigators[seat]
      if (!target) return false
      target.damage = getMaxHealth(target)
      checkDefeated(state, seat, events)
      return true
    },
    // Phase 5（5c-15）：检定中的临时加成 / 成功后的额外结算 / 创伤 / 弃牌堆招募盟友。
    addTestPendingBonus: amount => {
      if (!state.skillTest) return 0
      state.skillTest.pendingBonus = (state.skillTest.pendingBonus || 0) + amount
      return state.skillTest.pendingBonus
    },
    addExtraOnSuccess: effectData => {
      if (!state.skillTest) return false
      state.skillTest.extraOnSuccess ||= []
      state.skillTest.extraOnSuccess.push(effectData)
      return true
    },
    addTrauma: (seat, kind, amount = 1) => {
      if (!state.investigators[seat]) return false
      addTrauma(state, seat, kind, amount, events)
      return true
    },
    recruitAllyFromDiscard: seat => {
      const owner = state.investigators[seat]
      const candidates = state.investigators.flatMap(person => person.discard
        .filter(code => cardDef(code)?.type === 'asset' && (cardDef(code)?.traits || [])
          .some(trait => String(trait).toLowerCase() === 'ally'))
        .map(code => ({ code, owner: person })))
      if (!candidates.length || !owner) return false
      const answer = requestChoice(state, { kind: 'card', source: '03238', seat, prompt: '选择弃牌堆中的盟友。',
        options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) })) })
      const picked = candidates[Number(answer)]
      if (!picked) return false
      removeOne(picked.owner.discard, picked.code)
      owner.assets.push(newPlayerAssetInstance(state, owner, picked.code))
      return true
    },
    // Phase 5（5c-14）：卡面读数与"打出标记"（时刻警惕 / 障眼戏法）。
    playCost: (seat, code) => {
      const owner = state.investigators[seat]
      const def = cardDef(code)
      return owner && def ? playCost(state, owner, def) : 0
    },
    cardName: code => cardName(code),
    cardTraits: code => (cardDef(code)?.traits || []).map(trait => String(trait).toLowerCase()),
    markSleightOfHand: code => {
      const played = state.investigators[state.currentSeat]?.assets.filter(item => item.code === code).at(-1)
      if (played) played.sleightOfHand = { round: state.round, turnSeat: state.currentSeat }
      return Boolean(played)
    },
    // Phase 5（5c-13）：启动一次技能检定（内容层自己给难度与成功后的后续动作）。
    // 注意：abilityApi 已有 test(seat, skill, difficulty, options)，这里用不同名字避免覆盖。
    startTest: spec => {
      const seat = spec.seat ?? state.currentSeat
      performTest(state, seat, spec.skill, spec.difficulty ?? 0, {
        source: spec.source || undefined,
        skillBonus: spec.skillBonus ?? 0,
        peril: spec.peril === true,
        resolve: typeof spec.resolve === 'function' ? spec.resolve : undefined,
      })
      return true
    },
    // Phase 5（5c-13）：手牌上限与直接恐惧（养神术的溢出惩罚）。
    handSize: seat => getHandSize(state, state.investigators[seat ?? state.currentSeat]),
    applyHorror: (seat, amount) => {
      const target = state.investigators[seat]
      if (!target || !amount) return
      applyHorror(state, target, amount, events)
    },
    planTestReveal: spec => {
      if (!state.skillTest) return null
      state.skillTest.pendingRevealPlan = { ...spec }
      return state.skillTest.pendingRevealPlan
    },
    addExtraChaosChoices: amount => {
      if (!state.skillTest) return 0
      state.skillTest.extraChaosChoices = (state.skillTest.extraChaosChoices || 0) + amount
      return state.skillTest.extraChaosChoices
    },
    // 调查员当前属性（与 getStat 同源）：判定「难度高出多少」这类卡要用。
    stat: (seat, skill) => getStat(state, state.investigators[seat], skill),
    // 把当前遭遇卡改由指定座位接手（可以指定别人，不只是自己）。
    redirectEncounterTo: seat => {
      const context = state._reaction?.context || state._reaction
      const owner = state.investigators[seat]
      if (!context || !owner || context.when !== 'encounterDrawn') return false
      context.redirectSeat = seat
      context.location = owner.location
      return true
    },
    // 把敌人放回遭遇牌库顶并解除交战（狗屎运）。
    shuffleEnemyToEncounterTop: enemy => {
      if (!enemy) return false
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      for (const owner of state.investigators) {
        if (Array.isArray(owner.engaged)) owner.engaged = owner.engaged.filter(id => id !== enemy.id)
      }
      state.encounterDeck.push(enemy.code)
      return true
    },
    // Phase 5（5c-8）：反应窗口的上下文（快速事件的结算靠它拿到「这次遭遇/攻击」的信息）。
    reactionContext: () => state._reaction || null,
    // 「窄路逃生」：取消正在结算的攻击，并让下一次躲避 +2。
    cancelCurrentAttack: () => {
      if (!state._reaction) return false
      state._reaction.cancelled = true
      return true
    },
    prepareEvadeBonus: (amount = 2, seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      owner.narrowEscape = { amount, round: state.round, turnSeat: state.currentSeat }
      return owner.narrowEscape
    },
    // 「阿登森林护甲」：取消正在分配的 N 点伤害（反应窗口里的唯一接线点）。
    cancelDamage: (amount = 1) => {
      const reaction = state._reaction
      if (!reaction) return 0
      if (reaction.context) reaction.context.cancelDamage = (reaction.context.cancelDamage || 0) + amount
      else reaction.damage = Math.max(0, (reaction.damage || 0) - amount)
      return amount
    },
    // Phase 5（5c-18）：「追忆未来」在检定开始时指定一个混乱标记。
    // 命中时横置与 +2 仍由引擎的标记揭示段处理（读点 state.skillTest.namedToken 不变）。
    nameChaosToken: (seat, options = {}) => {
      const owner = state.investigators[seat]
      const asset = options.asset || null
      if (!asset || asset.exhausted || !state.skillTest || !owner) {
        info(state, events, options.unavailableText || '现在不能指定混乱标记。')
        return null
      }
      const faces = unique(state.chaosBag)
      const chosen = faces.length === 1 ? faces[0] : requestChoice(state, { kind: 'token', source: asset.id, seat,
        prompt: options.prompt || '指定一个混乱标记；本次检定揭示它时本次检定 +2。',
        options: faces.map(face => ({ id: face, label: tokenLabel(face) })) })
      state.skillTest.namedToken = { token: faces.includes(chosen) ? chosen : faces[0], assetId: asset.id }
      info(state, events, `🔮 ${owner.name} 用「${cardName(asset.code)}」指定了 ${tokenLabel(state.skillTest.namedToken.token)}。`)
      return state.skillTest.namedToken.token
    },
    // Phase 5（5c-18）：「再试一次」把本次检定投入的一张自己的技能牌收回手牌。
    recallCommittedSkill: (seat, options = {}) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      const committed = (state.skillTest?.committed || [])
        .filter(item => item.seat === seat && cardDef(item.code)?.type === 'skill')
      if (!committed.length) {
        info(state, events, options.emptyText || '本次检定没有可收回的技能牌。')
        return null
      }
      const chosen = committed.length === 1 ? committed[0].code : requestChoice(state, { kind: 'card',
        source: options.source || committed[0].code, seat,
        prompt: options.prompt || '选择要返回手牌的一张技能牌。',
        options: committed.map(item => ({ id: item.code, cardCode: item.code, label: cardName(item.code) })) })
      const entry = committed.find(item => item.code === chosen) || committed[0]
      removeOne(state.skillTest.committed, entry)
      owner.hand.push(entry.code)
      info(state, events, `「${cardName(options.source || entry.code)}」把「${cardName(entry.code)}」返回 ${owner.name} 的手牌。`)
      return entry.code
    },
    // 「我來处理」：把当前遭遇卡改由该座位接手结算（反应窗口里唯一的接线点）。
    redirectEncounter: seat => {
      const context = state._reaction?.context || state._reaction
      const owner = state.investigators[seat]
      if (!context || !owner || context.when !== 'encounterDrawn' || context.seat === seat) return false
      context.redirectSeat = seat
      context.location = owner.location
      return true
    },
    isNonWeakness: code => {
      const def = cardDef(code)
      return Boolean(def) && !isWeaknessCard(def)
    },
    enemiesAt: locationId => state.enemies.filter(enemy => enemy.location === locationId),
    investigatorsAt: locationId => aliveInvestigators(state).filter(inv => inv.location === locationId),
    countControlled: (seat, { trait = null, usesType = null } = {}) => {
      const inv = state.investigators[seat]
      if (!inv) return []
      return [...inv.assets, ...(inv.threat || [])].filter(card => {
        // Phase 2（C2）：特性判定合并运行期授予（add:trait）。
        if (trait && !cardHasTrait(state, inv, card.code, trait)) return false
        if (usesType) {
          const type = String(card.usesType || '').toLowerCase()
          if (!(type === String(usesType).toLowerCase() || type === `${String(usesType).toLowerCase()}s`)) return false
        }
        return true
      })
    },
    assetsCannotReady: inv => assetsCannotReady(inv),
    searchTop: (seat, options) => searchTop(state, seat, options, events),
    fight: (seat, enemyId, options = {}) => doFight(state, seat, { enemyId, ...options }, events, options.noSpend === true),
    // Phase 5（5c-39）：「原定计划」把牌放进 attached（不是 attachments），并能从那里面打出。
    attachedCodes: host => (host?.attached || []).slice(),
    attachToHostByCode: (host, code) => {
      if (!host) return false
      const owner = state.investigators.find(person => (person.deck || []).includes(code))
      if (!owner) return false
      const index = owner.deck.indexOf(code)
      if (index < 0) return false
      owner.deck.splice(index, 1)
      host.attached ||= []
      host.attached.push(code)
      return true
    },
    // Phase 5（5c-38）：「遗觉记忆」——所有弃牌堆里的候选、复制的费用、移出游戏、重放被复制的事件。
    discardPiles: () => state.investigators.flatMap(owner => (owner.discard || [])
      .map(code => ({ code, seat: owner.seat }))),
    playCostOf: (seat, code) => {
      const owner = state.investigators[seat]
      const def = cardDef(code)
      return owner && def ? playCost(state, owner, def) : 0
    },
    exileFromDiscard: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner) return false
      const index = (owner.discard || []).lastIndexOf(code)
      if (index < 0) return false
      owner.discard.splice(index, 1)
      state.removedFromGame ||= []
      state.removedFromGame.push(code)
      return true
    },
    // 重放「被复制的事件卡」的打出效果：数据体与描述子两条读点都走这里。
    replayPlayedCode: (seat, code) => {
      const played = playedEffect(code)
      const descriptor = descriptorOfKind(code, 'played')
      const previousFromDiscard = state._fromDiscardCode
      state._fromDiscardCode = null
      try {
        if (descriptor?.resolve) {
          executeDescriptor(state, { inv: state.investigators[seat], source: { code, id: code }, descriptor,
            context: { fromDiscard: false, copyCode: null, cardId: code }, events })
          return true
        }
        if (played) { resolveEffect(state, seat, played, makeRuntime(state, events)); return true }
        return false
      } finally {
        if (previousFromDiscard === undefined) delete state._fromDiscardCode
        else state._fromDiscardCode = previousFromDiscard
      }
    },
    // Phase 5（5c-37）：「时间借取」的滴答计数（上限 3）与「虚空碎裂」的封印「0」标记支付。
    addClicks: (card, max = 3) => {
      if (!card) return null
      if ((card.clicks || 0) >= max) return card.clicks
      card.clicks = (card.clicks || 0) + 1
      return card.clicks
    },
    sealedTokensFrom: (card, token = '0') => (state.chaos?.sealed || [])
      .filter(entry => entry.source === card?.id && entry.token === token).length,
    releaseSealedToken: (card, token = '0') => {
      const entry = (state.chaos?.sealed || []).find(item => item.source === card?.id && item.token === token)
      if (!entry) return null
      state.chaos.sealed = state.chaos.sealed.filter(item => item !== entry)
      state.sealedTokens = state.chaos.sealed.map(item => item.token)
      state.chaosBag.push(entry.token)
      return entry.token
    },
    // Phase 5（5c-36）：「死里逃生」的候选地点——已揭示且没有敌人。
    locationsWithoutEnemies: () => state.locations.filter(location => location.revealed
      && !state.enemies.some(enemy => enemy.location === location.id)),
    // Phase 5（5c-36）：「死里逃生」——与所有敌人解除交战、把威胁区的牌丢进弃牌堆、软结束回合。
    disengageAll: seat => disengageAll(state, seat, events),
    discardAllThreats: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      let removed = 0
      for (const threat of owner.threat.slice()) {
        removeOne(owner.threat, threat)
        owner.discard.push(threat.code)
        removed++
      }
      return removed
    },
    softEndTurn: seat => {
      const owner = state.investigators[seat]
      if (!owner) return false
      if (state.currentSeat === seat) { owner.actionsLeft = 0; owner.turnEnded = true }
      return owner.turnEnded === true
    },
    // Phase 5（5c-36）：「时间曲折」——把整局状态回滚到上一个动作的快照，
    // 保留该调查员的手牌/资源/弃牌堆与「移出游戏」，并保留事务层的 _resolution/revision。
    rewindLastAction: seat => {
      const snapshot = state.lastActionSnapshot
      if (!snapshot) return false
      const owner = state.investigators[seat]
      if (!owner) return false
      const preserved = { hand: owner.hand.slice(), resources: owner.resources,
        discard: owner.discard.slice(), removedFromGame: (state.removedFromGame || []).slice() }
      const resolution = state._resolution
      const revision = state.revision
      for (const key of Object.keys(state)) delete state[key]
      Object.assign(state, structuredClone(snapshot))
      Object.assign(state.investigators[seat], preserved)
      state.removedFromGame = preserved.removedFromGame
      state._resolution = resolution
      state.revision = revision
      state._timeWarped = true
      return true
    },
    // Phase 5（5c-35）：「同归于尽」用——列出与我交战的所有敌人（不限地点）。
    engagedEnemies: seat => state.enemies.filter(enemy => enemy.engagedSeat === seat),
    // Phase 5（5c-35）：写调查员实例上的 physicalTrauma/mentalTrauma（**不是**战役账本）。
    // 「同归于尽」的旧实现只写了这个实例字段：引擎里没有读点、也不写日志——见 §4.44 的已知缺陷记录。
    bumpInstanceTrauma: (seat, kind, amount = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      const key = kind === 'physical' ? 'physicalTrauma' : 'mentalTrauma'
      owner[key] = (owner[key] || 0) + amount
      return owner[key]
    },
    // Phase 5（5c-35）：「同归于尽」把伤害直接拉到最大生命值，再走一次击败检查（与旧原语同序）。
    setDamageToMax: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.damage = getMaxHealth(owner)
      checkDefeated(state, seat, events)
      return owner.damage
    },
    // Phase 5（5c-35）：「查尔斯·罗斯」这类「本地点下一件物品 -N」，记在支援或玩家身上。
    setLocationItemDiscount: (seat, card, amount = 1) => {
      const owner = state.investigators[seat ?? state.currentSeat]
      const record = { amount, round: state.round, phase: state.phase }
      if (card) card.itemDiscountAtLocation = record
      else if (owner) owner.itemDiscountAtLocation = record
      return record
    },
    // Phase 5（5c-34）：「背包」把牌放在 attachedCards 上（能从那里当手牌打出）与从牌库取走若干张。
    setAttachedCards: (host, codes) => {
      if (!host) return null
      host.attachedCards = [...codes]
      return host.attachedCards
    },
    takeFromDeck: (seat, codes) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      let taken = 0
      for (const code of codes || []) {
        const index = owner.deck.lastIndexOf(code)
        if (index >= 0) { owner.deck.splice(index, 1); taken++ }
      }
      return taken
    },
    // Phase 5（5c-33）：「吃子弹」这类在反应窗口里给本次检定加「额外揭示数」的卡。
    // 反应窗口里写反应上下文（战斗流程在窗口后读 context.extraChaosChoices），否则写 skillTest。
    addExtraChaosChoicesToTest: amount => {
      const reaction = state._reaction
      const target = reaction && (reaction.context || reaction)
      if (target) {
        target.extraChaosChoices = (target.extraChaosChoices || 0) + amount
        return target.extraChaosChoices
      }
      if (state.skillTest) {
        state.skillTest.extraChaosChoices = (state.skillTest.extraChaosChoices || 0) + amount
        return state.skillTest.extraChaosChoices
      }
      return 0
    },
    // Phase 5（5c-32）：「英勇救援」这类由卡牌造成的敌人攻击（不计入「不能攻击」开关）。
    enemyAttackByCard: (enemy, label, seat = state.currentSeat) => {
      const target = state.investigators[seat] || state.investigators[state.currentSeat]
      if (!enemy || !target) return false
      return enemyAttack(state, enemy, target, events, label, { kind: 'effect' })
    },
    // Phase 5（5c-32）：「即兴表演」这类切换角色（会写 inv.role）与「本回合下一张该阵营卡 -N」。
    switchRole: (seat, source, prompt) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      return chooseLolaRole(state, owner, source, prompt)
    },
    setRoleDiscount: (seat, role, amount = 3) => {
      const owner = state.investigators[seat]
      if (!owner || !role) return null
      owner.lolaDiscount = { role, amount, round: state.round, turnSeat: state.currentSeat }
      return owner.lolaDiscount
    },
    className: role => CLASS_NAMES[role] || role,
    // Phase 5（5c-31）：这个敌人是否还在场上（反击类能力要先确认目标没被同窗口的效果清掉）。
    isEnemyInPlay: enemy => Boolean(enemy) && state.enemies.includes(enemy),
    discoverAt: (seat, locationId, amount = 1) => {
      const inv = state.investigators[seat]
      const location = state.locations.find(entry => entry.id === locationId)
      if (!inv || !location) return 0
      const got = Math.min(amount, location.clues || 0)
      if (!got) return 0
      location.clues -= got
      inv.clues += got
      syncClues(state)
      info(state, events, `🔍 ${inv.name} 在「${locName(state, location.id)}」发现 ${got} 个线索。`)
      notifyCluesRemoved(state, location, got, events)
      return got
    },
    putIntoPlay: (seat, code) => {
      const inv = state.investigators[seat]
      const index = inv?.hand.indexOf(code) ?? -1
      if (!inv || index < 0) return null
      inv.hand.splice(index, 1)
      const asset = newPlayerAssetInstance(state, inv, code)
      inv.assets.push(asset)
      scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
      info(state, events, `🎴 ${inv.name} 将「${cardName(code)}」放置入场。`)
      return asset
    },
  }
}

// 支付能力费用。与旧式 doAbility 的费用顺序保持一致（横置 → 充能 → 资源 → 线索 →
// 弃手牌 → 恐惧/伤害 → 支援自身伤害 → 弃掉/驱逐自身），返回 false 表示付不起。
function payAbilityCost(state, inv, source, cost = {}, events, descriptor = null) {
  // Phase 2（C3）：先把费用表达式求值成数字——校验与扣费必须用同一份结果，
  // 否则「每有 1 个线索付 1 资源」会在校验和扣费之间看到不同的线索数。
  const resolved = normalizeCostValues(cost, { state, inv, source, descriptor })
  if (!resolved) return false
  cost = resolved
  // 先整体校验，再逐项扣费：避免「付了一半失败」留下部分修改。
  if (cost.exhaust && source?.exhausted) return false
  if (cost.uses && (source?.uses || 0) < cost.uses) return false
  if (cost.resources && inv.resources < cost.resources) return false
  if (cost.clues && (inv.clues || 0) < cost.clues) return false
  if (cost.discardHand && discardableHandCards(inv, cost.discardHandIcon).length < cost.discardHand) return false
  if (cost.exhaust) source.exhausted = true
  if (cost.uses) source.uses -= cost.uses
  if (cost.resources) inv.resources -= cost.resources
  if (cost.clues) {
    inv.clues -= cost.clues
    syncClues(state)
  }
  if (cost.discardHand) discardChosenCards(state, inv, cost.discardHand, events, source?.code, cost.discardHandIcon)
  if (cost.horror) applyHorror(state, inv, cost.horror, events)
  if (cost.damageSelf) applyDamage(state, inv, cost.damageSelf, events, true)
  if (cost.assetDamage && source) {
    source.damage = (source.damage || 0) + cost.assetDamage
    const def = cardDef(source.code)
    if (def?.health > 0 && source.damage >= def.health) {
      leaveAsset(state, inv, source)
      if (!source.removedFromGame) inv.discard.push(source.code)
      info(state, events, `${cardName(source.code)} 因自身伤害被弃置。`)
    }
  }
  if (cost.discardSelf && source) {
    leaveAsset(state, inv, source)
    if (!source.removedFromGame) inv.discard.push(source.code)
    info(state, events, `♻️ ${inv.name} 弃掉了「${cardName(source.code)}」。`)
  }
  if (cost.exileSelf && source) {
    leaveAsset(state, inv, source)
    exilePlayerCard(state, inv, source.code, events)
  }
  return true
}

function descriptorCost(descriptor) {
  return descriptor.kind === 'free' ? { ...descriptor.cost, action: false } : descriptor.cost
}

// 执行一条描述子。source 可以是资产实例、手牌 code（fromHand）、调查员本身，
// 或持续效果（effect 记录，Phase 1 A1）。
function executeDescriptor(state, { inv, source, descriptor, context = {}, events, windowId = null, fromHandIndex = null, effect = null, legacyAbilityLog = false, alreadyPaid = false, silent = false }) {
  const cost = descriptorCost(descriptor)
  // 手牌事件：先按打出规则付费并离开手牌，再结算效果。
  // noPlayCost 的描述子（如 05023 宝剑王牌「放置入场」）自己负责移动这张牌。
  // Phase 5（5c-8）：反应窗口打出的快速事件由 playReactionCard 先付费/离手，
  // 此时用 alreadyPaid 跳过这一段（费用与日志都在那边，保持逐字一致）。
  let handCode = null
  if (!alreadyPaid && descriptor.fromHand && !descriptor.noPlayCost) {
    const index = Number.isInteger(fromHandIndex) && inv.hand[fromHandIndex] === descriptor.code
      ? fromHandIndex
      : (inv.hand || []).indexOf(descriptor.code)
    if (index < 0) return false
    handCode = inv.hand[index]
    const def = cardDef(handCode)
    if (!def) return false
    const price = playCost(state, inv, def)
    if (inv.resources < price) return false
    inv.hand.splice(index, 1)
    inv.resources -= price
    consumePlayThreatResources(state, inv, events)
    info(state, events, `⚡ ${inv.name} 快速打出「${cardName(handCode)}」。`)
  }
  if (!alreadyPaid && !payAbilityCost(state, inv, source, cost, events, descriptor)) return false
  // 只有 kind 'action' 的描述子消耗行动点：free / reaction / forced 都是 0 费，
  // 不能因为 cost 里没写 action:false 就在窗口结算里扣行动（Phase 1 修正）。
  if (!alreadyPaid && descriptor.kind === 'action' && cost.action !== false) spendAction(state, inv)
  markLimitUsed(state, inv, descriptor, context, windowId, source)
  // 日志文案：从牌桌「能力」入口（doAbility）进来的描述子必须复刻旧式能力文案
  // （`使用「X」的能力：…`），否则迁移一张卡就改一行玩家可见日志，重放指纹会对不上。
  // 事件卡（fromHand）与窗口触发的描述子沿用 Phase 2 起的短文案；
  // Phase 5（5c-8）：反应窗口打出的快速事件已有「快速打出」日志，这里静默。
  if (!silent) info(state, events, `✨ ${inv.name} 使用「${cardName(descriptor.code)}」${legacyAbilityLog ? '的能力' : ''}：${descriptor.label}。`)
  const ctx = {
    state, seat: inv.seat, inv,
    source: source || { code: descriptor.code },
    descriptor,
    window: windowId,
    context,
    events,
    fromHandIndex,
    effect,
    // 目标枚举（B1）：描述子声明 target 时，legalMoves 已经让玩家/AI 选好 targetId，
    // 这里还原成实体（enemy / investigator / location / asset / cardInHand）。
    targetId: context?.targetId ?? null,
    target: resolveTarget(state, inv, descriptor.target, context?.targetId, { source, windowId, context }),
    api: abilityApi(state, events),
  }
  descriptor.resolve?.(ctx)
  // 描述子也可以只声明旧式 effect（例如「花 1 子弹攻击」），由效果解释器结算。
  // Phase 5：legalMoves 已经让玩家/AI 选好 targetId，effect 数据体必须像旧式能力那样
  // 收到同一份目标（doAbility 的 applyAbilityTarget），否则解释器会再问一次目标。
  if (!descriptor.resolve && descriptor.effect) {
    let effectData = { ...descriptor.effect, assetId: source?.id ?? descriptor.code }
    if (ctx.targetId != null) effectData = applyAbilityTarget(effectData, ctx.targetId)
    if (context?.optionIndex != null) effectData = { ...effectData, optionIndex: context.optionIndex }
    resolveEffect(state, inv.seat, effectData, makeRuntime(state, events))
  }
  if (handCode) disposePlayedEvent(inv, handCode)
  // Phase 5（D2）：discardWhenEmpty 也可以写在注册表条目上（与 uses/usesType 同层）。
  const entry = registeredEntry(descriptor.code)
  const discardWhenEmpty = entry?.discardWhenEmpty || EFFECTS[descriptor.code]?.discardWhenEmpty
  if (discardWhenEmpty && source && source.uses != null && source.uses <= 0) {
    leaveAsset(state, inv, source)
    if (!source.removedFromGame) inv.discard.push(source.code)
    info(state, events, `「${cardName(source.code)}」充能耗尽，弃掉。`)
  }
  return true
}

// 描述子的使用前提：窗口匹配、条件（matcher）、上限、负担能力。
// mode: 'action'（主动使用，走 legalMoves/doAbility）
//       'free'  （玩家窗口里的免费触发）
//       'window'（反应/强制能力，由 openAbilityWindow 触发）
function descriptorUsable(state, inv, source, descriptor, { windowId = null, context = {}, mode = 'window' } = {}) {
  const timing = state.timingWindow
  if (mode === 'free') {
    if (descriptor.kind !== 'free') return false
    if (descriptor.trigger.length && !descriptor.trigger.includes(timing)) return false
  } else if (mode === 'action') {
    if (!['action', 'free'].includes(descriptor.kind)) return false
    if (descriptor.kind === 'free' && descriptor.trigger.length && !descriptor.trigger.includes(timing)) return false
  } else if (!['reaction', 'forced'].includes(descriptor.kind)) {
    return false
  }
  if (descriptor.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return false
  // Phase 2（C1）：capability:triggerAbilities 只禁止"可选"的能力；
  // forced（强制）在规则上仍然结算，不能被"不能触发能力"挡住。
  if (descriptor.kind !== 'forced' && capabilityBlocked(state, inv, 'triggerAbilities')) return false
  if (descriptor.requiresNoClues) {
    const here = state.locations.find(location => location.id === inv.location)
    if (here && here.clues > 0) return false
  }
  if (limitUsed(state, inv, descriptor, context, windowId, source)) return false
  // 手牌事件按打出费用结算，不套用资产的「横置/充能」检查。
  if (descriptor.fromHand) {
    // 手牌事件必须先还在手里（反应窗口可能在结算后再次枚举）。
    if (!(inv.hand || []).includes(descriptor.code)) return false
    const def = cardDef(descriptor.code)
    if (!def) return false
    if (cannotPlayTypes(inv).has(def.type)) return false
    if (!descriptor.noPlayCost && inv.resources < playCost(state, inv, def)) return false
  } else if (!canAffordAbility(state, inv, source, { cost: descriptorCost(descriptor), descriptor })) return false
  if (descriptor.criteria && !evaluateCriteria(descriptor.criteria, {
    state, inv, source, windowId, context,
    // 条件里常用的读点：内容层不直接 import 引擎，也不需要 api 的完整面。
    helpers: {
      isWeakness: code => isWeaknessCode(code),
      cardType: code => cardDef(code)?.type || null,
      cardTraits: code => cardDef(code)?.traits || [],
    },
  })) return false
  return true
}

function evaluateCriteria(criteria, ctx) {
  if (criteria == null) return true
  const list = Array.isArray(criteria) ? criteria : [criteria]
  return all(...list)(ctx)
}

// 收集某个窗口下、某调查员能用的描述子（资产/威胁/调查员自身/手牌事件/持续效果）。
function descriptorSources(state, inv) {
  const out = []
  for (const card of controlledAbilityCards(inv)) {
    const entry = registeredEntry(card.code)
    if (entry?.abilities.length) out.push({ source: card, code: card.code, entry })
  }
  const investigatorEntry = registeredEntry(inv.code)
  if (investigatorEntry?.abilities.length) {
    out.push({ source: { investigator: inv.seat, code: inv.code }, code: inv.code, entry: investigatorEntry })
  }
  for (const [index, code] of (inv.hand || []).entries()) {
    const entry = registeredEntry(code)
    if (!entry?.abilities.length) continue
    out.push({ source: null, code, entry, fromHandIndex: index })
  }
  // Phase 1（A1）：持续效果也可以挂反应/强制能力（"本阶段内每当……"类卡面）。
  // 它们只在效果有效期内出现，来源是效果记录本身（上限/条件读点与卡片一致）。
  for (const { effect, abilities } of effectAbilitySources(state, inv.seat)) {
    const code = effect.sourceCode || 'effect'
    out.push({ source: { effectId: effect.id, code }, code, entry: { abilities }, effect })
  }
  // Phase 3（D1）：非玩家卡（敌人/地点/幕/议程/剧情支援）的能力来源。
  // descriptorSources 的签名没有 window context，实体能力因此读 state；
  // 窗口上下文里带但已离场的实体（被击败的敌人）在 openAbilityWindow 里补一次。
  for (const row of nonPlayerAbilitySources(state)) out.push(row)
  return out
}

// ---------------------------------------------------------------------------
// Phase 3（D1）：非玩家卡的能力来源枚举
//
// 这些卡没有持有者，因此：
//   · 每个窗口只枚举一次（不按调查员重复），否则同一张敌人的强制能力会结算 N 次；
//   · 需要「谁来决定」时统一落到 decideSeatFor：窗口 context.seat → 当前回合座位 → 队长；
//   · 结算时把该座位当作执行者（费用里的资源/线索、条件里的 inv 都指向他），
//     与「剧本替卡牌做决定」的既有约定一致（见 content/registry 的关卡行为）。
// ---------------------------------------------------------------------------

function entityAbilityEntry(entity) {
  for (const code of [entity?.originalCode, entity?.code]) {
    if (!code || !hasNonPlayerBehavior(code)) continue
    const entry = registeredEntry(code)
    if (entry?.abilities.length) return { entry, code }
  }
  return null
}

function nonPlayerAbilitySources(state, context = {}) {
  const out = []
  const seen = new Set()
  const push = (entity, { requireRevealed = false } = {}) => {
    if (!entity) return
    if (requireRevealed && !entity.revealed) return
    const key = entity.id ?? entity.code
    if (key != null) {
      if (seen.has(key)) return
      seen.add(key)
    }
    const found = entityAbilityEntry(entity)
    if (!found) return
    out.push({ source: entity, code: found.code, entry: found.entry })
  }
  for (const enemy of state.enemies || []) {
    if (enemy.defeated || enemy.removedFromGame) continue
    push(enemy)
  }
  for (const location of state.locations || []) push(location, { requireRevealed: true })
  push((state.acts || [])[state.actIndex])
  push((state.agendas || [])[state.agendaIndex])
  for (const asset of state.storyAssets || []) push(asset)
  // 窗口上下文里带的实体也算来源：`defeatEnemy` 打开时敌人已经从 state 移除，
  // 但它的「被击败时」能力仍然要结算（来源就是这次结算的敌人本身）。
  push(context.enemy)
  if (context.location != null) {
    const location = (state.locations || []).find(entry => entry.id === context.location)
    push(location, { requireRevealed: true })
  }
  return out
}

// 非玩家卡的「决定座位」：窗口没指定就落到当前回合/队长座位，保证选择有回答人。
function decideSeatFor(state, context = {}) {
  for (const seat of [context.seat, context.decisionSeat, state.currentSeat, state.campaign?.leadSeat]) {
    if (!Number.isInteger(seat)) continue
    const inv = state.investigators[seat]
    if (inv && !inv.defeated && !inv.resigned) return seat
  }
  return aliveInvestigators(state)[0]?.seat ?? null
}

// 打开一个能力层窗口：先结算强制能力，再按座位询问可选反应。
// 返回被修改过的 context（与 reactionWindow 的约定一致）。
function openAbilityWindow(state, windowId, context, events) {
  noteUnknownWindow(windowId)
  if (state._reaction || state._abilityWindow) return context
  state._abilityWindow = true
  try {
    // 1) 强制能力：无条件结算，不询问。
    //    先玩家卡（逐座位），再非玩家卡（每张实体卡一次，由决定座位代表执行）。
    for (const inv of aliveInvestigators(state)) {
      for (const { source, code, fromHandIndex, entry, effect } of descriptorSources(state, inv)) {
        for (const descriptor of descriptorsInEntry(entry, windowId, 'forced')) {
          if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
          if (descriptor.fromHand && fromHandIndex == null) continue
          executeDescriptor(state, { inv, source, descriptor, context, events, windowId, fromHandIndex, effect })
          if (state.pendingChoice) return context
        }
      }
    }
    // Phase 3（D1）：实体卡的强制能力。窗口 context 里带但已离场的实体（被击败的敌人）
    // 也从 context 补一次，否则「被击败时」这类强制能力永远不结算。
    // 同一个窗口实例只结算一次：引擎对部分事件会先后开 triggerReaction 与 reactionWindow，
    // 两边都进到这里，卡面强制效果不能因此翻倍。
    {
      const seat = decideSeatFor(state, context)
      const inv = seat == null ? null : state.investigators[seat]
      if (inv) {
        // 只按「窗口 + 本轮/阶段/回合 + 相关实体」去重：同一事件的两次窗口调用
        // 上下文可能一个带 seat 一个不带，不能用 windowInstanceKey 原样做键。
        const instanceKey = [windowId, state.round, state.phase, state.turnSerial ?? 0,
          context.enemy?.id ?? '', context.location ?? '', context.cardCode ?? ''].join('|')
        for (const { source, entry } of nonPlayerAbilitySources(state, context)) {
          for (const descriptor of descriptorsInEntry(entry, windowId, 'forced')) {
            const markKey = `entityWindow:${instanceKey}:${descriptor.id}:${source?.id ?? descriptor.code}`
            if (state.abilityLimits?.[markKey]) continue
            if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
            state.abilityLimits ||= {}
            state.abilityLimits[markKey] = { used: 1, round: state.round, phase: state.phase, turn: state.turnSerial ?? 0 }
            executeDescriptor(state, { inv, source, descriptor, context, events, windowId })
            if (state.pendingChoice) return context
          }
        }
      }
    }
    // 2) 可选反应：逐个座位询问，直到让过。
    for (const inv of aliveInvestigators(state)) {
      const candidates = []
      for (const { source, code, fromHandIndex, entry, effect } of descriptorSources(state, inv)) {
        for (const descriptor of descriptorsInEntry(entry, windowId, 'reaction')) {
          // Phase 5（5b-6）：从旧式 reactions 搬来的反应由 triggerReaction 用旧式询问结算，
          // 这里跳过，避免同一张卡在两个提示里各出现一次。
          if (descriptor.legacyReaction) continue
          if (descriptor.fromHand && !(inv.hand || []).includes(code)) continue
          if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
          candidates.push({ source, code, descriptor, fromHandIndex, effect })
        }
      }
      if (!candidates.length) continue
      let guard = 0
      while (guard++ < 12) {
        const usable = candidates.filter(item => descriptorUsable(state, inv, item.source, item.descriptor, { windowId, context }))
        if (!usable.length) break
        const options = [{ id: 'skip', label: '不触发' }]
        for (const item of usable) {
          const id = `desc:${item.descriptor.id}:${item.source?.id ?? item.effect?.id ?? 'hand'}`
          options.push({ id, label: `【能力】${cardName(item.code)}：${item.descriptor.label}`, cardCode: item.code })
        }
        const answer = requestChoice(state, {
          kind: 'reaction', source: { type: 'window', when: windowId }, seat: inv.seat, canSkip: true,
          prompt: `是否触发反应能力？（${windowLabelOf(windowId)}${context?.prompt ? '／' + context.prompt : ''}）`,
          options,
        })
        if (answer === 'skip') break
        const chosen = usable.find(item => `desc:${item.descriptor.id}:${item.source?.id ?? item.effect?.id ?? 'hand'}` === answer)
        if (!chosen) break
        executeDescriptor(state, { inv, source: chosen.source, descriptor: chosen.descriptor, context, events,
          windowId, fromHandIndex: chosen.fromHandIndex, effect: chosen.effect })
      }
    }
    // 3) 非玩家卡：同一个窗口里只问一次，由决定座位代表调查队作答。
    const nonPlayer = nonPlayerAbilitySources(state, context)
    if (nonPlayer.length) {
      const seat = decideSeatFor(state, context)
      const inv = seat == null ? null : state.investigators[seat]
      if (inv) {
        const usable = []
        for (const { source, code, entry } of nonPlayer) {
          for (const descriptor of descriptorsInEntry(entry, windowId, 'reaction')) {
            if (!descriptorUsable(state, inv, source, descriptor, { windowId, context })) continue
            usable.push({ source, code, descriptor })
          }
        }
        if (usable.length) {
          const options = [{ id: 'skip', label: '不触发' }]
          for (const item of usable) {
            options.push({ id: `entity:${item.descriptor.id}:${item.source?.id ?? item.code}`,
              label: `【卡面】${cardName(item.code)}：${item.descriptor.label}`, cardCode: item.code })
          }
          const answer = requestChoice(state, {
            kind: 'reaction', source: { type: 'window', when: windowId, seat: 'entity' }, seat: inv.seat, canSkip: true,
            prompt: `是否触发场景卡的反应能力？（${windowLabelOf(windowId)}${context?.prompt ? '／' + context.prompt : ''}）`,
            options,
          })
          if (answer !== 'skip') {
            const chosen = usable.find(item => `entity:${item.descriptor.id}:${item.source?.id ?? item.code}` === answer)
            if (chosen) {
              executeDescriptor(state, { inv, source: chosen.source, descriptor: chosen.descriptor, context, events, windowId })
            }
          }
        }
      }
    }
  } finally {
    delete state._abilityWindow
  }
  return context
}

const windowLabelOf = id => playerWindowLabel(id)

function doEngage(state, seat, enemyId, events) {  const inv = state.investigators[seat]
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

// play-condition.js 需要两个引擎侧读数：理智上限（含被动加成）与「能否撤退」。
// 由引擎注入而不是让规则层 import 引擎，保持依赖方向单向。
function playConditionHelpers(state) {
  return {
    maxSanity: inv => getMaxSanity(inv),
    resignAvailable: () => scenarioResignAvailable(state),
  }
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
  // 剧本/遭遇卡赋予的行动统一由行为的 actions()/encounterActions() 给出。
  // 每一项都可以带 reason（条件不满足时给）：这里只取不带 reason 的进可执行列表，
  // 带 reason 的留给 scriptActionHints 当提示——否则客户端会渲染出点不动的按钮，
  // AI 也会照抄一个必被拒绝的行动。locationId 只补在"由当前地点赋予"的行动上，
  // 让客户端在选中该地点时能展示它。
  moves.push(...(scenarioBehavior(state).actions?.(state, inv) || []).filter(move => !move.reason).map(move =>
    move.locationId || move.scriptCard ? move : { ...move, locationId: inv.location }))
  moves.push(...(scenarioBehavior(state).encounterActions?.(state, inv) || []).filter(move => !move.reason))
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
    if (!def || !runtimeCardAvailable(state, inv, code) || def.dataStatus === 'quarantined' || def.type === 'skill' || (isWeaknessCard(def) && !playAccess(code).playableWeakness)) continue
    if (!lolaCanUseCard(inv, code)) continue
    if (scenarioBehavior(state).canPlayCard?.(state, inv, def) === false) continue
    if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) continue
    if (blocked.has(def.type)) continue
    if (cardPlayBlockedReason(state, inv, def)) continue
    if (code === '03012') {
      for (const copyCode of inv.beneath || []) {
        const copy = cardDef(copyCode)
        const copyPlayed = playedEffect(copyCode)
        if (!copy || copy.type !== 'event' || copy.exceptional || !copyPlayed || playAccess(copyCode).reactionOnly) continue
        const cost = playCost(state, inv, copy)
        if (inv.resources < cost || effectError(state, inv, copyPlayed)) continue
        moves.push({ action: 'play', cardId: code, copyCode,
          label: `🃏 彩绘世界复制「${cardName(copyCode)}」(${cost} 资源)` })
      }
      continue
    }
    const cost = playCost(state, inv, def)
    if (inv.resources < cost - (tfaPlayCostPreview(state, inv, code)?.discount || 0)
      && !charlesPayCandidate(state, inv, cost)) continue
    if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) continue
    const kindLabel = def.type === 'asset' ? '装备' : '打出'
    moves.push({ action: 'play', cardId: code, label: `🃏 ${kindLabel}「${cardName(code)}」(${cost} 资源)` })
  }

  // 04037 背包：附属的牌可以当作手牌打出。
  for (const bag of inv.assets.filter(asset => registeredEntry(asset.code)?.cardBackpack)) {
    for (const code of unique(bag.attachedCards || [])) {
      const def = cardDef(code)
      if (!def || def.type === 'skill'
        || (isWeaknessCard(def) && !playAccess(code).playableWeakness)) continue
      if (blocked.has(def.type) || cardPlayBlockedReason(state, inv, def)) continue
      const cost = playCost(state, inv, def)
      if (inv.resources < cost) continue
      moves.push({
        action: 'play', cardId: code, fromBackpackId: bag.id,
        label: `🎒 从背包打出「${cardName(code)}」(${cost} 资源)`,
      })
    }
  }

  // 「临时武器」「将就一下」等：可从自己的弃牌堆打出。
  for (const code of unique(inv.discard)) {
    if (!playAccess(code).fromDiscard || !isCardAvailable(code)) continue
    if (inv.discard.includes(code) === false) continue
    const def = cardDef(code)
    if (!def || def.type !== 'event' || isWeaknessCard(def) || blocked.has(def.type)) continue
    if (inv.resources < playCost(state, inv, def) || effectError(state, inv, playedEffect(code))) continue
    moves.push({ action: 'play', cardId: code, fromDiscard: true,
      label: `🃏 从弃牌堆打出「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
  }

  if (inv.assets.some(asset => asset.code === '01014') && inv.discard.length) {
    const code = topDiscardEvent(state, inv)
    const def = cardDef(code)
    if (def && def.type === 'event' && isCardAvailable(code) && !isWeaknessCard(def)
        && !blocked.has(def.type) && inv.resources >= playCost(state, inv, def)
        && !effectError(state, inv, playedEffect(code))) {
      moves.push({ action: 'play', cardId: code, fromDiscard: true, label: `🃏 温蒂的护身符：打出弃牌堆顶事件「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
    }
  }

  for (const plan of inv.assets.filter(asset => registeredEntry(asset.code)?.cardPlan && !asset.exhausted)) {
    for (const code of unique(plan.attached || [])) {
      const def = cardDef(code)
      if (!def || def.type !== 'event' || playAccess(code).reactionOnly || blocked.has(def.type)
          || !runtimeCardAvailable(state, inv, code) || inv.resources < playCost(state, inv, def)
          || effectError(state, inv, playedEffect(code))) continue
      moves.push({ action: 'play', cardId: code, fromPlanAssetId: plan.id,
        label: `🃏 原定计划：打出「${cardName(code)}」(${playCost(state, inv, def)} 资源)` })
    }
  }

  // 「残酷拷问」（04261）等：威胁区域禁止抽取行动。
  if (!drawBlocked(state, inv)) moves.push({ action: 'draw', label: '🀄 抽 1 张牌' })
  if (scenarioBehavior(state).canGainResources?.(state, inv) !== false) moves.push({ action: 'resource', label: '💰 获得 1 资源' })
  // 失落的时代：探索牌库非空且剧本允许时提供探索行动。
  if ((state.explorationDeck || []).length && !investigatorTextBlanked(state, inv)
    && scenarioBehavior(state).canExplore?.(state, inv) !== false) {
    moves.push({ action: 'explore', label: `🧭 探索（剩余 ${state.explorationDeck.length} 张）` })
  }

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
    const scenarioShroud = (scenarioBehavior(state).locationShroudModifier?.(state, loc, inv) || 0)
      + entityModifierTotal(state, loc, 'locationShroud')
    const shroud = loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0) + scenarioShroud
    moves.push({ action: 'investigate', label: `🔍 调查「${loc.name}」（${SKILL_NAMES[skill]} vs 帷幕 ${shroud}）` })
  }

  if (loc && loc.ability && locationAbilityAvailable(state, loc, inv)
    && !activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotTriggerLocationAbilities)) {
    moves.push({ action: 'locationAbility', locationId: loc.id, label: `📍 ${loc.ability.label}` })
  }

  for (const enemy of state.enemies.filter(enemy => enemy.location === inv.location)) {
    if ((enemy.code !== '02255' || enemyTextBlanked(state, enemy)) && !hiddenFightBlocked(state, inv, enemy)
      && !enemyCannotBeAttacked(state, enemy))
      moves.push({ action: 'fight', enemyId: enemy.id, label: `⚔️ 攻击「${enemy.name}」（战斗 vs ${enemyFightValue(state, enemy, inv)}${enemy.retaliate ? '，反击' : ''}）` })
    if (scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) !== false)
      moves.push({ action: 'evade', enemyId: enemy.id, label: `💨 躲避「${enemy.name}」（敏捷 vs ${enemyEvadeValue(state, enemy, inv)}）` })
    // 芬恩·爱德华兹：每回合 1 次不消耗行动的额外躲避。
    if (canUseExtraEvade(state, inv) && (enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location))
      && scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) !== false)
      moves.push({ action: 'extraEvade', enemyId: enemy.id,
        label: `💨 额外躲避「${enemy.name}」（本回合一次，不消耗行动）` })
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

  // 上锁的门：破门。
  if (loc && loc.locked) {
    moves.push({ action: 'breakDoor', skill: 'combat', label: '🔓 破门（战斗 4）' })
    moves.push({ action: 'breakDoor', skill: 'agility', label: '🔓 破门（敏捷 4）' })
  }
  if (loc?.searchingForIzzieSeat != null) moves.push({ action: 'searchIzzie', label: '🔎 寻找伊兹（花 2 行动，调查）' })


  for (const a of controlledAbilityCards(inv)) {
    const eff = assetEffect(inv, a)
    if (!eff || !eff.abilities) continue
    if (!lolaCanUseCard(inv, a.code)) continue
    eff.abilities.forEach((ab, i) => {
      if (!canAffordAbility(state, inv, a, ab)) return
      // 能力层上限：已用完的能力不再出现在合法列表里（与玩家窗口的过滤一致）。
      if (ab.descriptor && limitUsed(state, inv, ab.descriptor, null, null, a)) return
      if (ab.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return
      if (ab.oncePerTest && state.skillTest?.usedAbilities?.[`${a.id}:${i}`]) return
      if (ab.oncePerPhase && inv.usedAbilities?.[`${a.id}:${i}:${state.round}:${state.phase}`]) return
      if (ab.requiresNoClues && loc && loc.clues > 0) return
      const free = ab.cost && ab.cost.action === false
      if (free && cannotTriggerFreeAbility(state, inv)) return
      const prefix = free ? '⚡免费 ' : tomeActionEligible(state, inv, { action: 'ability', assetId: a.id, abilityIndex: i }) ? '[书籍额外行动] ' : ''
      // Phase 2（C3）：动态费用在行动文案里给出当前数值（"预览 = 校验 = 扣费"同一份求值）。
      const suffix = costPreviewSuffix(state, inv, a, ab) || ''
      const base = { action: 'ability', assetId: a.id, abilityIndex: i }
      // 目标枚举（B1）：描述子声明 target 时，每个合法目标拆成一条独立行动，
      // 牌桌可以先选目标、AI 不用再多问一轮。没有目标且非 optional 就不出现。
      if (ab.descriptor && ab.descriptor.target) {
        const candidates = enumerateTargets(state, inv, ab.descriptor.target, { source: a })
        if (!candidates.length) {
          if (!ab.descriptor.target.optional) return
          moves.push({ ...base, label: `${prefix}${ab.label}${suffix}` })
          return
        }
        for (const candidate of candidates) {
          moves.push({ ...base, targetId: candidate.id, label: `${prefix}${ab.label} → ${candidate.label}${suffix}` })
        }
        return
      }
      if (ab.effect?.type === 'fight' && !abilityTargets(state, inv, ab.effect).length) return
      if (ab.effect && (ab.effect.type === 'investigate' || ab.effect.type === 'discoverClue') && (!loc || loc.clues <= 0)) return
      if (ab.effect && ab.effect.type === 'dealDamage' && abilityTargets(state, inv, ab.effect).length === 0) return
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
          moves.push({ ...base, targetId: t.id, label: `${prefix}${ab.label} → ${t.name}${suffix}` })
        }
        return
      }
      moves.push({ ...base, label: `${prefix}${ab.label}${suffix}` })
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
  if (effect.type === 'tfaInvestigator') {
    if (effect.action === 'playAllyDiscounted') {
      const cost = code => Math.max(0, playCost(state, inv, cardDef(code)) - (effect.amount || 0))
      const ally = inv.hand.some(code => cardDef(code)?.type === 'asset'
        && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')
        && inv.resources >= cost(code))
      if (!ally) return '手牌中没有可打出的盟友支援'
    }
    if (effect.action === 'investigateAction') {
      const loc = state.locations.find(item => item.id === inv.location)
      if (!loc || loc.locked || loc.clues <= 0) return '这里不能调查'
    }
  }
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
  const tfa = inv.playDiscount || 0
  const threatIncrease = inv.threat.reduce((sum, threat) =>
    sum + (getThreatEffect(threat)?.playCostIncrease || 0), 0)
  const loc = state.locations.find(location => location.id === inv.location)
  const locationIncrease = loc?.playCostIncrease || 0
  // 04142 珍品店：位于此处时打出每个 [[遗物]] 支援的费用 -2。
  const relicDiscount = loc && ['04142'].includes(String(loc.originalCode || loc.code))
    && def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'relic') ? 2 : 0
  const charles = itemDiscountAtLocation(state, inv, def)
  // 能力层修正：例如 03142「黑玛瑙扣环」在手牌中时其他手牌 +1 费用（负数为折扣）。
  const abilityLayer = playCostDelta(state, inv, def.code)
  return Math.max(0, (def.cost || 0) - discount - lola - carcosa - tfa + threatIncrease + locationIncrease - relicDiscount - charles + abilityLayer)
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
    // Phase 5：从牌桌使用的能力可能是旧 DSL 条目，也可能是能力层描述子（abilityShim 折叠后
    // 与 legalMoves 同序）；「书籍额外行动」只能用于真正消耗行动的能力。
    const ability = assetEffect(inv, source)?.abilities?.[move.abilityIndex]
    if (!ability || ability.cost?.action === false || ability.cost?.action === 0) return false
  } else if (move.action === 'purgeThreat') {
    source = inv.threat.find(item => item.id === move.threatId)
    if (!getThreatEffect(source)?.purgeAbility) return false
  } else return false
  return (cardDef(source?.code)?.traits || []).some(trait => trait.toLowerCase() === 'tome')
}

function actionCost(state, inv, move, applyTome = true) {
  if (['endTurn', 'advanceAct', 'shortcutMove', 'extraEvade'].includes(move.action)) return 0
  if (move.action === 'freeAction') return INVESTIGATOR_ABILITIES[inv.code]?.freeAction?.actionCost || 0
  let cost = 1
  const investigateLoc = state.locations.find(loc => loc.id === (move.locationId || inv.location))
  if (move.action === 'investigate' && investigateLoc?.originalCode === '02050') cost++
  // 04145「屋中无人」：附属地点调查额外 +1 行动（剧本往地点上写计数）。
  if (move.action === 'investigate' && investigateLoc?.investigateExtraActions) {
    cost += investigateLoc.investigateExtraActions
  }
  if (move.action === 'searchIzzie') cost = 2
  if (move.action === 'hiddenAction') cost = hiddenRule(state, move.cardId)?.discard?.actions ?? 1
  if (move.action === 'scenarioAction') cost = scenarioBehavior(state).actions?.(state, inv).find(m => m.rule === move.rule && !m.reason)?.actions ?? 1
  if (move.action === 'encounterAction') cost = scenarioBehavior(state).encounterActions?.(state, inv).find(m => m.rule === move.rule && !m.reason)?.actions ?? 1
  let kind = actionKind(state, inv, move)
  if (move.action === 'discardThreat') {
    const threat = availableThreatAbilities(state, inv).find(item => item.id === move.threatId)
    cost = getThreatEffect(threat)?.discardCost?.action ?? 1
  }
  if (move.action === 'ability') {
    const ability = abilityOfMove(state, inv, move)
    cost = ability?.cost?.action === false ? 0 : typeof ability?.cost?.action === 'number' ? ability.cost.action : 1
    // Phase 5：描述子可以用 countsAs 声明「按哪种行动结算」（旧式能力把这件事写在 effect.kind 上，
    // 例如「意志闪避」按 evade 结算、不引发借机攻击）。
    kind = ability?.descriptor
      ? (ability.descriptor.countsAs || ability.descriptor.kind)
      : (ability?.effect?.kind || ability?.effect?.type)
  }
  // fast 有三个来源：卡面 EFFECTS、描述子的 fast 字段（cardPlayFlag）、
  // 以及 C2 的 add:keyword 授予（卡在运行期获得"快速"）。三处汇合在 actionCost 一处。
  if (move.action === 'play' && (cardPlayFlag(move.copyCode || move.cardId, 'fast')
    || cardKeyword(state, inv, move.copyCode || move.cardId, 'fast')
    || tfaPlayCostPreview(state, inv, move.copyCode || move.cardId)?.noAction)) cost = 0
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
// Phase 2（C3）：费用表达式在这里求值——「预览 = 校验 = 扣费」三处共用一份数值，
// 因此「每有 1 个线索付 1 资源」这类动态费用不会出现"预览说付得起、结算说付不起"。
function canAffordAbility(state, inv, asset, ability) {
  const cost = normalizeCostValues(ability.cost || {}, { state, inv, source: asset, descriptor: ability.descriptor || null })
  if (!cost) return false
  if (cost.exhaust && asset?.exhausted) return false
  if (cost.uses && (asset?.uses || 0) < cost.uses) return false
  if (cost.resources && inv.resources < cost.resources) return false
  if (cost.clues && (inv.clues || 0) < cost.clues) return false
  if (cost.discardHand && discardableHandCards(inv, cost.discardHandIcon).length < cost.discardHand) return false
  if (cost.damageSelf && inv.damage + cost.damageSelf >= inv.health) return false
  if (ability.maximumInvestigatorDamage != null && inv.damage > ability.maximumInvestigatorDamage) return false
  if (ability.maxClicks != null && (asset.clicks || 0) >= ability.maxClicks) return false
  return true
}

// 动态费用的预览文案（静态费用返回 null，避免牌桌/AI 看到多余的括号）。
// 注意：文案用**未求值**的 cost 生成，这样玩家看到的是"2 资源（按线索数）"而不是光秃秃的 2，
// 求值结果只用来判断"费用是否合法"。
function costPreviewSuffix(state, inv, source, ability) {
  const raw = ability?.cost
  if (!raw || !costIsDynamic(raw)) return null
  const resolved = normalizeCostValues(raw, { state, inv, source, descriptor: ability.descriptor || null })
  if (!resolved) return '（费用不合法）'
  const text = describeCost(raw, { state, inv, source })
  return text ? `（${text}）` : null
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
    mostHand: '手牌最多者',
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
        if (ability.cost && ability.cost.action === false && canAffordAbility(state, inv, a, ability)) {
          out.push('免费能力「' + cardName(a.code) + '」' + ability.label)
        }
      })
    }
  }
  return out
}

// 卡面赋予的行动提示：不论此刻能否执行都列出，并给出不可执行的原因。
// 数据来源是行为自己的 actions()/encounterActions()——每一项都可以带 reason（条件不满足时给），
// legalMoves 只取不带 reason 的，这里取全部，所以"什么时候可用"只在一个地方写一遍。
// scriptCard 标明行动归属：'act'/'agenda' 显示在牌桌剧本区；'enemy'/'location' 只喂 AI 计划，
// 牌桌不渲染。真正执行仍只走 legalMoves/validateMove。
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
  hints.push(...(behavior.actions?.(state, inv) || []), ...(behavior.encounterActions?.(state, inv) || []))
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
  {
    const cost = actionCost(state, inv, move)
    const kind = actionKind(state, inv, move)
    if (kind === 'explore' ? inv.actionsLeft < cost : normalActionsLeft(inv) < cost) {
      return kind === 'explore' ? '行动点不足' : '行动点不足（额外行动只能用于探索）'
    }
  }

  switch (move.action) {
    case 'scenarioAction': return scenarioBehavior(state).actions?.(state, inv).some(m => m.rule === move.rule && !m.reason)
      ? null : '当前不能执行此剧本行动'
    case 'encounterAction': return scenarioBehavior(state).encounterActions?.(state, inv).some(m => m.rule === move.rule && !m.reason)
      ? null : '当前不能执行此遭遇卡行动'
    case 'play': {
      const def = cardDef(move.cardId)
      if (!def) return '未知卡牌'
      if (!lolaCanUseCard(inv, move.cardId)) return '罗拉只能使用中立或当前角色阵营的卡牌'
      if (scenarioBehavior(state).canPlayCard?.(state, inv, def) === false) return '当前效果禁止你打出卡牌'
      const playBlocked = cardPlayBlockedReason(state, inv, def)
      if (playBlocked) return playBlocked
      if (activeHiddenRules(state, inv).some(hidden => hidden.rule.cannotPlayTypes?.includes(def.type))) return '隐私牌禁止你打出该类型卡牌'
      if (def.permanent) return '永久卡在开局时入场'
      // 打出条件的唯一读点（Phase 1）：描述子 playCondition + 旧 DSL 的 10 个字段
      // 都在 src/engine/play-condition.js 里收敛，引擎不再逐字段判断。
      const conditionError = playConditionError(state, inv, move.cardId, playConditionHelpers(state))
      if (conditionError) return conditionError
      if (!runtimeCardAvailable(state, inv, move.cardId) || def.dataStatus === 'quarantined') return '该卡牌未获运行时许可'
      if (move.cardId === '03012') {
        const copied = cardDef(move.copyCode)
        const copiedPlayed = playedEffect(move.copyCode)
        if (!inv.beneath?.includes(move.copyCode) || !copied || copied.type !== 'event' || copied.exceptional
          || !copiedPlayed || playAccess(move.copyCode).reactionOnly) return '彩绘世界没有合法的复制事件'
        if (!inv.hand.includes(move.cardId)) return '手牌中没有彩绘世界'
        if (inv.resources < playCost(state, inv, copied)) return '资源不足'
        return effectError(state, inv, copiedPlayed)
      }
      if (def.type === 'skill' || (isWeaknessCard(def) && !playAccess(move.cardId).playableWeakness)) return '该牌不能作为行动打出'
      if (move.fromDiscard) {
        if (!playAccess(move.cardId).fromDiscard && !inv.assets.some(asset => asset.code === '01014')) return '你没有温蒂的护身符'
        // 卡面允许从弃牌堆任意位置打出的卡（「临时武器」等）不受牌库顶限制。
        if (!playAccess(move.cardId).fromDiscard
          && (def.type !== 'event' || topDiscardEvent(state, inv) !== move.cardId)) return '不是弃牌堆中最上方的事件'
      } else if (move.fromPlanAssetId) {
        const plan = inv.assets.find(asset => asset.id === move.fromPlanAssetId && registeredEntry(asset.code)?.cardPlan)
        if (!plan || plan.exhausted || !plan.attached?.includes(move.cardId) || def.type !== 'event') return '原定计划下没有可打出的这张事件'
      } else if (move.fromBackpackId) {
        const bag = inv.assets.find(asset => asset.id === move.fromBackpackId && registeredEntry(asset.code)?.cardBackpack)
        if (!bag || !(bag.attachedCards || []).includes(move.cardId)) return '背包里没有这张牌'
      } else if (!inv.hand.includes(move.cardId)) return '手牌中没有这张牌'
      if (playAccess(move.cardId).reactionOnly) return '该牌只能在对应的反应窗口打出'
      if (cannotPlayTypes(inv).has(def.type)) return '当前禁止打出该类型卡牌'
      if (inv.resources < playCost(state, inv, def) - (tfaPlayCostPreview(state, inv, move.cardId)?.discount || 0)
        && !charlesPayCandidate(state, inv, playCost(state, inv, def))) return '资源不足'
      if (def.unique && state.investigators.some(item => item.assets.some(asset => cardDef(asset.code)?.name === def.name))) return '唯一资产已经在场'
      if (def.type === 'asset' && normalizedSlots(def).length && !assetReplacementPlans(inv, def).length) return '槽位已满'
      if (playAccess(move.cardId).limitPerInvestigator
        && inv.assets.some(asset => asset.code === move.cardId)) return '每位调查员仅限 1 张'
      return effectError(state, inv, playedEffect(move.cardId))
    }
    case 'draw': return drawBlocked(state, inv) ? '「残酷拷问」：你不能进行抽取行动' : null
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
      if (capabilityBlocked(state, inv, 'locationAbility')) return '当前效果禁止你使用地点能力'
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
      if (capabilityBlocked(state, inv, 'investigate')) return '当前效果禁止你调查'
      const loc = state.locations.find((l) => l.id === inv.location)
      if (!loc || loc.clues <= 0) return '这里没有线索可调查'
      if (loc.locked) return '地点被上锁的门封锁'
      const reason = scenarioBehavior(state).investigationError?.(state, inv, loc)
      if (reason) return reason
      return null
    }
    case 'explore': {
      if (!(state.explorationDeck || []).length) return '探索牌库已经空了'
      if (scenarioBehavior(state).canExplore?.(state, inv) === false) return '当前不能探索'
      return null
    }
    case 'searchIzzie': {
      const loc = state.locations.find(item => item.id === inv.location)
      if (loc?.searchingForIzzieSeat == null) return '此处没有伊兹'
      if (loc.locked) return '地点被上锁的门封锁'
      return null
    }
    case 'fight': {
      if (capabilityBlocked(state, inv, 'fight')) return '当前效果禁止你攻击'
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (enemy.code === '02255' && !enemyTextBlanked(state, enemy)) return '子嗣只能使用深奥的咒文攻击'
      if (hiddenFightBlocked(state, inv, enemy)) return '隐私牌禁止你攻击该敌人'
      const canFight = enemy.location === inv.location
      if (!canFight) return '该敌人未与你交战'
      return null
    }
    case 'evade': {
      if (capabilityBlocked(state, inv, 'evade')) return '当前效果禁止你躲避'
      const enemy = state.enemies.find((e) => e.id === move.enemyId)
      if (!enemy) return '未找到该敌人'
      if (scenarioBehavior(state).canEvadeEnemy?.(state, inv, enemy) === false) return '该敌人不能被躲避'
      const canEvade = enemy.engagedSeat === seat || (enemy.massive && enemy.location === inv.location)
      if (!canEvade) return '该敌人未与你交战'
      return null
    }
    case 'extraEvade': {
      if (!canUseExtraEvade(state, inv)) return '本回合的额外躲避行动已经用过'
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
      if (capabilityBlocked(state, inv, 'triggerAbilities')) return '当前效果禁止你触发能力'
      if (!lolaCanUseCard(inv, asset.code)) return '罗拉不能触发非当前角色阵营卡牌的能力'
      const eff = assetEffect(inv, asset)
      const ability = eff && eff.abilities && eff.abilities[move.abilityIndex]
      if (!ability || !Number.isInteger(move.abilityIndex)) return '无效能力'
      if (ability.descriptor && limitUsed(state, inv, ability.descriptor, null, state.timingWindow, asset)) {
        return '该能力的次数已用完（本阶段/本回合/本局）'
      }
      if (ability.cost?.action === false && cannotTriggerFreeAbility(state, inv)) return '隐私牌禁止你触发免费能力'
      if (!canAffordAbility(state, inv, asset, ability)) return '能力成本不足'
      if (ability.duringOwnSkillTest && state.skillTest?.seat !== inv.seat) return '只能在自己的技能检定期间使用'
      if (ability.oncePerTest && state.skillTest?.usedAbilities?.[`${asset.id}:${move.abilityIndex}`]) return '每次检定仅限一次'
      if (ability.oncePerPhase
        && inv.usedAbilities?.[`${asset.id}:${move.abilityIndex}:${state.round}:${state.phase}`]) return '每阶段仅限一次'
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
        if (ability.descriptor?.target) {
          // 目标枚举（B1）：只接受 enumerateTargets 的候选，与 legalMoves 用的是同一份枚举。
          const candidate = resolveTarget(state, inv, ability.descriptor.target, move.targetId, { source: asset })
          if (!candidate) return '该目标不是合法的能力目标'
        } else if (ability.descriptor) {
          // 描述子没有声明 target 时，目标由 resolve() 自己询问，这里只要求实体存在。
          if (!state.enemies.some(enemy => enemy.id === move.targetId)) return '该敌人不是有效目标'
        } else {
          const targets = abilityTargets(state, inv, ability.effect)
          if (!targets.some((e) => e.id === move.targetId)) return '该敌人不是有效目标'
        }
      } else if (ability.descriptor?.target && !ability.descriptor.target.optional) {
        return '该能力需要选择目标'
      }
      return null
    }
    case 'resign': {
      if (capabilityBlocked(state, inv, 'resign')) return '当前效果禁止你撤退'
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
      const healthText = enemyHealth(state, e) > 0
        ? `生命 ${enemyHealth(state, e) - e.damageTaken}/${enemyHealth(state, e)}`
        : '生命 无'
      lines.push(`- ${e.name}：战斗${enemyFightValue(state, e, state.investigators[observerSeat])} 躲避${enemyEvadeValue(state, e, state.investigators[observerSeat])} ${healthText}${e.doom ? ` 毁灭${e.doom}` : ''}${kw ? '（' + kw + '）' : ''}，交战「${eng}」${e.exhausted ? '（已横置）' : ''}${intent ? '；意图：' + intent : ''}`)
    }
  }

  if (state.pendingChoice && (state.pendingChoice.seat === observerSeat || !state.skillTest || state.skillTest.helpRequested || state.skillTest.seat === observerSeat)) lines.push(`待决选择：${state.pendingChoice.prompt}；回答座位 ${state.pendingChoice.seat}。`)
  const legal = observerSeat === decisionSeat(state) ? legalMoves(state) : []
  if (legal.length) {
    lines.push('')
    lines.push('【可执行行动】（从下列选择一项，用其 JSON 表示）')
    legal.forEach((m, i) => { lines.push(`${i + 1}. ${m.label}  →  ${JSON.stringify(stripLabel(m))}`) })
  }

  // 卡面赋予却暂时走不通的行动：只讲清缺哪个条件，让 AI 能反过来做准备。
  // 未满足条件时该行动不在 legalMoves 里，AI 无从得知它存在；能执行时已在上面的列表，不重复列出。
  if (observerSeat === decisionSeat(state) && !state.pendingChoice) {
    const blocked = scriptActionHints(state, observerSeat).filter(hint => hint.reason)
    if (blocked.length) {
      lines.push('')
      lines.push('【暂时不可执行的卡面行动】（不能直接提交；条件满足后才会出现在上面的可执行列表）')
      blocked.forEach(hint => lines.push(`- ${hint.label}：${hint.reason}`))
    }
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
