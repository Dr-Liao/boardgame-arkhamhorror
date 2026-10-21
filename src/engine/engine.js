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
import { createTreacheryTokens } from './treachery-tokens.js'
import { createCampaignPlugin } from '../cards/campaign-plugin.js'
import { createDescribeAi } from './describe-ai.js'
import { createActionsExtra } from './actions-extra.js'
import { createTableDecisions } from './table-decisions.js'
import { createAbilityRules } from './ability-rules.js'
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
  RELIC_OF_AGES_CODE,
  RANDOM_BASIC_WEAKNESS_CODE,
  investigateExtraActionsFor,
  enemyRuleFlags,
  locationCounterTreacheries,
  SMITE_THE_WICKED_CODE,
  SEARCHING_FOR_IZZIE_CODE,
  weaknessUpgradeCode,
  LITA_CHANDLER_CODE,
  counterTreacheryCode,
  actPlacesLocationForEmptySpawn,
  PALLID_MASK_CODE,
  relicDiscountLocation,
  RELOCATE_DESTINATION_LOCATION_CODE,
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
const SLOT_CAPACITY = { hand: 2, ally: 1, arcane: 2, accessory: 1, body: 1, tarot: 1 }

const HAND_SIZE_BASE = 8

// ---------------------------------------------------------------------------
// 合并剧本注册表（遭遇牌 code 全局唯一，跨剧本合并后可按 code 直查）
// ---------------------------------------------------------------------------

import { ALL_ENEMIES, ALL_STORY_ASSETS, ALL_TREACHERIES } from './card-lookup.js'

// ---------------------------------------------------------------------------

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
      // Phase 6（6e-8）：快速反应事件搬成 `played` + `fast` + `trigger`，同样算「有反应提示」。
      || descriptorEntry?.abilities?.some(descriptor => descriptor.kind === 'free'
        || (descriptor.kind === 'played' && descriptor.fast && descriptor.trigger.length > 0)
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
    // Phase 5（5a-10）：「随机基础弱点」自身的卡号在卡号规则数据里，不再写进引擎。
    .filter((c) => isCardAvailable(c.code) && c.pack === 'core' && c.code !== RANDOM_BASIC_WEAKNESS_CODE)
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
  // Phase 5（5a-7）：入场额外充能完全由调查员能力的 additionalChargeOnEnter 决定（不再写卡号）。
  const extraCharges = INVESTIGATOR_ABILITIES[inv.code]?.additionalChargeOnEnter || 0
  if (extraCharges && ['charge', 'charges'].includes(String(asset.usesType || '').toLowerCase())) {
    asset.uses = (asset.uses || 0) + extraCharges
  }
  return asset
}
function newEnemyId(state) { return nextInstanceId(state, 'e') }





// 存档迁移用：把状态里内嵌的资源副本（卡牌定义、调查员定义、展示常量）刷新为当前版本。
// 只替换派生数据，不改变牌序、随机状态、实例编号或战役进度。
const DERIVED_STATE_KEYS = new Set(['cards', 'investigatorDefs', 'classNames', 'classColors', 'skillNames', 'tokenLabels', 'log', 'legalMoves'])
const CARD_CODE = /^\d{5}[a-z]?$/




function resolveAgendaDoomThresholds(agendas, numInvestigators) {
  for (const agenda of agendas || []) {
    if (agenda.doomThresholdPerInvestigator != null) {
      agenda.doomThreshold = agenda.doomThresholdPerInvestigator * numInvestigators
    }
  }
}







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


// Team decisions stay with a human player even if their investigator is out.



import { createDescribeState } from './describe.js'
import { createCombat } from './combat.js'
import { createActions } from './actions.js'
import { createPhases } from './phases.js'
import { createMoves } from './moves.js'
import { createCardApi } from './api-card.js'
import { createEnemyApi } from './api-enemy.js'
import { createClueApi } from './api-clue.js'
import { createTestApi } from './api-test.js'
import { createMiscApi } from './api-misc.js'
import { createPerformTest } from './tests.js'
import { createScenarioRuntime } from './scenario-runtime.js'
import { createWeakness } from './weakness.js'
import { createPlayerEffects } from '../cards/player-effects.js'
import { createAbilityExecution } from './ability-exec.js'
import { createCampaignFlow } from './campaign-flow.js'
import { createSetup } from './setup.js'
import { createDispatch } from './dispatch.js'
import { createEncounter } from './encounter.js'
import { createMovement } from './movement.js'
import { createEnemies } from './enemies.js'
import { createLocations } from './locations.js'
import { createSkillEffects } from './skill-effects.js'
import { createTurn } from './turn.js'
import { createReveal } from './reveal.js'
import { createDeckOps } from './deck-ops.js'
import { createHub } from './hub.js'

// Phase 6（6d-1）：卡牌 / 敌人定义查找搬进 card-lookup.js；这里既 import 自用，也转出给外部调用方，
// 外部模块的 import 路径保持不变。
import { cardDef, cardName, originalCardCode, ruleCodeForOriginal, isWeaknessCard, isWeaknessCode, enemyDef } from './card-lookup.js'
export { cardDef, cardName, originalCardCode, ruleCodeForOriginal, isWeaknessCard, isWeaknessCode, enemyDef }

// ---------------------------------------------------------------------------
// 属性 / 被动加成（来自 card-effects.js 的 passive）
// ---------------------------------------------------------------------------

function assetEffect(inv, asset) {
  // Phase 5（5a-20）：「毒蛇灾厄」清空某类特长卡的文字——规则数据在 BLANKS_TRAITS 里。
  const blankedTraits = (inv.threat || []).flatMap(item => blanksTraits(item.code))
  if (blankedTraits.length
    && (cardDef(asset?.code)?.traits || []).some(trait => blankedTraits.includes(String(trait).toLowerCase()))) return {}
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
        // Phase 5（5b-8）：神话阶段结束时弃掉这张支援（戴红手套的男子）。
        ...(entry.forcedMythosEndDiscard ? { forcedMythosEndDiscard: true } : {}),
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
  // Phase 5（5a-33）：只有「用角色限制卡牌」的调查员走这套校验。
  if (!INVESTIGATOR_ABILITIES[inv.code]?.deckbuildingRoles) return true
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
// 战役机制：Phase 6（6e-7）起搬到内容层 src/cards/campaign-plugin.js
// ---------------------------------------------------------------------------
// 探索牌库、检查补给、复仇、伊格之怒、中毒、古代遗物与领队，以及「数据体表达不了」的
// 玩家卡效果调度，都由那个模块提供；本文件只保留同名 export 包装（见文件末尾装配）。






// 「检查补给」：同地点的任意调查员持有该补给即算通过。


// 复仇：胜利区中带有复仇点数的卡牌（含被视为在胜利区的卡牌）。


// 中毒：永久弱点 04102 在威胁区域，或显式中毒标记。




// 领队：战役记录中的远征求领队，默认由队长担任。


// 古代遗物：剧情资产在各章之间移动或由调查员携带。



// 探索牌库：牌库顺序、牌堆与弃牌堆都写入状态，保证存档恢复后一致。



// 供剧本行为、卡牌效果与测试直接调用的机制接口：
// Phase 6（战役插件化第一批）起由 src/cards/campaign-plugin.js 提供，
// 本文件只保留同名 export 包装（见文件末尾的 createCampaignPlugin 装配），外部 import 路径不变。

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

// Phase 5（5a-31）：丽塔的光环由条目级 auraWhileInPlay 声明；会让盟友文字空白化的威胁
// 通过 BLANKS_TRAITS 判断（02088 就是「清除盟友文字」的那种）。
function litaAuraAt(state, inv) {
  return state.investigators.some((i) => {
    if (i.location !== inv.location || i.defeated || i.resigned) return false
    const hasAura = i.assets.some((a) => registeredEntry(a.code)?.auraWhileInPlay)
    const auraBlanked = i.threat.some((t) => blanksTraits(t.code).includes('ally'))
    return hasAura && !auraBlanked
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
  // Phase 5（5a-6）：「书虫」这类「每份占用 2 个书位」的规则由条目级 tomeHandSlotsPerCopy 声明。
  const restrictedHands = inv.assets.reduce((sum, asset) => sum + (registeredEntry(asset.code)?.tomeHandSlotsPerCopy || 0), 0)
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
    // Phase 5（5a-7）：带「书位」的支援（书虫）不参与普通手部加成，书位单独结算。
    if (registeredEntry(a.code)?.tomeHandSlotsPerCopy) continue
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


function isThreatWeakness(code) {
  return weaknessProfile(code)?.type === 'threat'
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

function farthestLocationsFor(state, inv) {
  if (!inv) return []
  const distances = state.locations.map(loc => ({ id: loc.id, distance: distanceToInvestigator(state, loc.id, [inv]) }))
  const finite = distances.filter(item => Number.isFinite(item.distance))
  if (!finite.length) return []
  const farthest = Math.max(...finite.map(item => item.distance))
  return finite.filter(item => item.distance === farthest).map(item => item.id)
}

function discardLocked(state, inv) {
  return state.enemies.some(enemy => enemyRuleFlags(enemy.code).locksDiscardWhileEngaged
    && enemy.engagedSeat === inv.seat && !enemyTextBlanked(state, enemy))
}

// Phase 5（5a-18）：「打出的事件进牌库顶而不是弃牌堆」由条目级 playedEventsToDeckTop 声明。
function hasPlayedEventsToDeckTop(inv) {
  return (inv.assets || []).some(asset => registeredEntry(asset.code)?.playedEventsToDeckTop)
}

function topDiscardEvent(state, inv) {
  return hasPlayedEventsToDeckTop(inv) && !discardLocked(state, inv)
    ? inv.discard.findLast(code => cardDef(code)?.type === 'event') : null
}

function disposePlayedEvent(inv, code) {
  if (hasPlayedEventsToDeckTop(inv)) inv.deck.unshift(code)
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
      resolveEffect(state, inv.seat, withEffectCode(playedEffect(copyCode || code), copyCode || code), makeRuntime(state, events))
    }
  } finally {
    delete state._reaction
  }
  if (copyCode && registeredEntry(code)?.copiesBeneathEvents) {
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

function chooseAttack(state, inv, enemies, timing) {
  if (enemies.length === 1) return enemies[0]
  const id = requestChoice(state, { kind: 'attackOrder', source: timing, seat: inv.seat,
    prompt: '选择下一名攻击的敌人；攻击结算后可重新决定余下顺序。',
    options: enemies.map(enemy => ({ id: enemy.id, label: `${enemy.name}：${enemy.damage} 伤害／${enemy.horror} 恐惧` })) })
  return enemies.find(enemy => enemy.id === id)
}


function tryAquinnahRedirect(state, enemy, inv, events, extraDamage = 0, extraHorror = 0) {
  // Phase 5（5a-31）：会让盟友文字空白化的威胁用 BLANKS_TRAITS 判断。
  if (inv.threat.some(item => blanksTraits(item.code).includes('ally'))) return false
  // Phase 5（5b-8）：「安奎娜」这类「横置并放 1 点恐惧，把这次攻击的伤害转给另一个敌人」由条目级标记声明。
  const aquinnah = inv.assets.find(asset => registeredEntry(asset.code)?.redirectAttackToAsset && !asset.exhausted)
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






// 从收藏里随机获得一张基础弱点并洗入牌库（04165「查找收藏」）。
// 只从 BASIC_WEAKNESSES 里挑、跳过牌库里已有的同名卡；没有可选牌时给中文提示。


// 将线索放回所在地点（午夜假面 tablet / 错误指示）。






// 结算特殊标记：返回 { delta, drawAnother, onDraw:[fx], onFail:[fx] }。




const failedTestResolves = new WeakMap()
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
  // Phase 5（5a-26）：「藏身处」这类给敌人 aloof 的附属由条目级 grantsHidingSpot 声明。
  enemy.hidingSpotAloof = !enemy.elite
    && attachments.some(item => registeredEntry(item.code)?.grantsHidingSpot && item.location === enemy.location)
  enemy.aloof = !!enemy.printedAloof || enemy.hidingSpotAloof
  // Phase 5（5a-27）：「伏击」这类敌人入场即触发伤害的附属由条目级 ambushAttachment 声明。
  const ambush = spawned && attachments.find(item => registeredEntry(item.code)?.ambushAttachment && item.location === enemy.location)
  if (ambush) {
    removeOne(attachments, ambush)
    state.investigators[ambush.ownerSeat]?.discard.push(ambush.code)
    enemy.defeatedBy = ambush.ownerSeat
    damageEnemy(state, enemy, 2, ambush.ownerSeat, events)
  }
  if (!state.enemies.includes(enemy)) return
  const snare = attachments.find(item => registeredEntry(item.code)?.snareAttachment && item.location === enemy.location && !enemy.elite)
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
  if (inv && state.enemies.some(enemy => enemyRuleFlags(enemy.code).blocksMovementWhileEngaged && enemy.engagedSeat === seat && !enemyTextBlanked(state, enemy))) return '与攫取恐怖交战时不能移动'
  return scenarioBehavior(state).investigatorEntryError?.(state, location, inv) || null
}

function remainingHealth(inv) {
  return getMaxHealth(inv) - inv.damage
}

function remainingSanity(inv) {
  return getMaxSanity(inv) - inv.horror
}

// 与某调查员交战的敌人（含庞大敌人：与所在地点所有调查员交战）。
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



function discardEnemyCard(state, enemy) {
  disengageEnemy(state, enemy)
  removeOne(state.enemies, enemy)
  const owner = state.investigators[enemy.bearerSeat]
  if (isWeaknessCode(enemy.code) && owner) owner.discard.push(enemy.code)
  else state.encounterDiscard.push(enemy.code)
  scenarioBehavior(state).enemyDiscarded?.(state, enemy, scenarioRuntime(state, []))
}


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




function locationRevealCue(loc, entered = false, seat = null) {
  const code = loc.originalCode || loc.code, card = cardDef(code)
  return { kind: 'location', seat, location: loc.id, code, name: loc.name, title: entered ? '进入地点' : '地点揭示',
    flip: !entered, shroud: loc.shroud, clues: loc.clues, onEnter: loc.onEnter,
    text: card?.textZh || card?.text || loc.text || '此地点没有额外的卡面效果。' }
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
  // Phase 5（5a-28）：「手铐」这类禁止放毁灭的附属由条目级 restrainsDoom 声明。
  const cuffed = (card.attachments || []).some(attachment => registeredEntry(attachment.originalCode || attachment.code)?.restrainsDoom)
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
  // Phase 5（5a-19）：「被消除时离场」的支援由条目级 discardOnElimination 声明。
  for (const asset of inv.assets.filter(item => registeredEntry(item.code)?.discardOnElimination)) {
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
  // Phase 5（5a-18）：附属卡号随效果数据走（effect.code）。
  const attachment = { ownerSeat: seat, code: effect.code || null }
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
  // Phase 5（5a-9）：研究能力只按实例 id 找支援（调用方就是这张卡的能力），不再写死卡号。
  const asset = inv.assets.find(item => item.id === assetId)
  if (!asset) throw new Error('奇异溶液必须在场才能研究')
  return performTest(state, seat, 'intellect', 4, { source: { label: '研究', name: cardName(asset.code), code: asset.code }, resolve: result => {
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
    kind: 'target', source: effect.code, seat, prompt: '选择本地点或连接地点的一名调查员，治疗 1 点恐惧。',
    options: targets.map(target => ({ id: String(target.seat), label: target.name })),
  })
  const target = targets.find(item => String(item.seat) === id)
  if (target) { target.horror = Math.max(0, target.horror - amount); info(state, events, `${target.name} 治疗 ${amount} 点恐惧。`) }
}

function dukeInvestigate(state, seat, events, code = null) {
  const inv = state.investigators[seat]
  const destinations = investigatorMoveDestinations(state, seat, {})
  if (destinations.length) {
    const id = requestChoice(state, { kind: 'move', source: code, seat,
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



// ---------------------------------------------------------------------------
// 玩家卡效果调度：Phase 6（6e-7）起搬到内容层 src/cards/campaign-plugin.js
// ---------------------------------------------------------------------------
// 调查员专属卡 / 玩家卡「数据体表达不了」的效果按 effect.type / action 分派；
// 引擎侧只留同名 export 包装。

// 揭示混乱标记之前的替代/额外揭示：
//   - 「危险预感」（04199）强制改为结算封印其上的标记；
//   - 「奥利芙·麦克布莱德」（04197）横置后揭示 3 个并选 2 个结算；
//   - 「黑暗预言」（04032）改为揭示 5 个并选 1 个带符号的标记结算。

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


// 「自食其力」：控制占用盟友槽位的支援时强制弃掉。

// 「时间借取」（04308）：回合开始时移除所有滴答，换成额外行动。

// 失落时代第三批卡牌的调度器。





function exilePlayerCard(state, inv, code, events) {
  state.exiled.push(code)
  state.exiledBySeat ||= []
  state.exiledBySeat.push({ seat: inv.seat, code })
  info(state, events, `${inv.name} 流放「${cardName(code)}」；本关结束后从战役牌组移除。`)
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


/** Seats allowed to submit now; per-seat hub preparation is simultaneous. */

const HUB_SEAT_ACTIONS = new Set(['hubSelectInvestigator', 'hubAutoDeck', 'hubSetDeck', 'hubPurchase',
  'hubConfirmUpgrades', 'hubCancelUpgrades', 'hubAutoUpgrade', 'hubDoneSeat'])

/** Seat preparation only touches the submitting seat, so it may follow a teammate's newer revision. */

const HUB_DIFFICULTIES = ['easy', 'standard', 'hard', 'expert']
const inHub = state => state.hubFlow && state.uiState !== 'inScenario'
const hubConcurrentPhase = state => (state.uiState === 'scenarioSetup' && !state.hubReady) || state.uiState === 'interlude'
const hubPendingSeats = state => state.investigators.map(inv => inv.seat).filter(seat => !state.hubSeatDone?.[seat])
// AI teammates prepare after every human has confirmed: they pick from what is left,
// and their model latency never holds the session while humans are still choosing.

// A campaign may begin with a route choice whose exits are scenarios. Surface
// that choice as ordinary case selection instead of a detached story prompt.









// 大厅的可选契约 decisionSeed：给 agent 的兜底选择提供一个由对局状态决定的种子。
// 同一局（同一种子）在同一步的兜底动作因此可复现，便于回放与回归；
// 未提供时大厅退化为按对局编号决定，行为同样不会退化成「恒选第一项」。

// 大厅的可选契约 moveCost：该动作消耗的行动点数。
// 「结束回合 / 撤退」不消耗行动点，返回 0 —— 模型失败时的确定性兜底会优先挑正成本动作，
// 因此不会把 AI 回合直接结束掉（见 lib/agent/orchestrator.js 的 pickFallback 分档）。

// 卡面自带的打出限制（不是库存或构筑限制）。



// 一次 move 对应的能力对象（能力层描述子折叠后与旧式 ability 同形）。






// 幕间效果可能禁止下一场冒险换起始手牌；读到一次就清空。









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


// —— 打出卡牌 ——


// ---- 附属（attachments）支持 ----


// 附带的 +1 生命/+1 神智等会提高宿主可承受的伤害上限。

// Phase 6（6a-1）：把「打出它的那张牌」注入效果对象，效果处理器不再需要写死自己的卡号。
// 只在结算入口注入（`playedEffect` 本身保持纯函数，生命周期读点的测试才能继续断言原始数据体）。







// 谈判盘问独特异教徒（午夜假面）。


// 抽取异教徒牌堆（午夜假面场景 1 能力：共同花费 2 线索/人）。

// 破坏仪式（地底噬魔场景 3）。

// 献祭丽塔（地底噬魔，结局 3）。

// 破门（上锁的门）。

















// Phase 6（6d-27）：25 张依赖表里大量条目被反复复制（info 23 张、cardName 19 张、
// aliveInvestigators 17 张…）。把「3 张以上表都要、且不是工厂产物」的条目提成 commonDeps，
// 各表只写自己额外需要的依赖。工厂产物（doFight/doEvade/… 等 const 绑定）仍逐表内联：
// 它们在模块末尾才初始化，进 commonDeps 会 TDZ。
const commonDeps = {
  ALL_CARDS,
  CLASS_NAMES,
  EFFECTS,
  INVESTIGATOR_ABILITIES,
  SKILL_NAMES,
  ScenarioEnded,
  abilityApi,
  abilityTargets,
  addDoom,
  addTrauma,
  advanceAct,
  aliveInvestigators,
  applyDamage,
  applyHarm,
  applyHorror,
  assetEffect,
  assetsCannotReady,
  attachCardTo,
  autoEngageAll,
  autoEngageAt,
  autoEvadeEnemy,
  basicWeaknessPool,
  beginChaosTest,
  campaignFor,
  canDiscardFromHand,
  cannotPlayTypes,
  capabilityBlocked,
  cardDef,
  cardName,
  checkAct,
  checkDefeated,
  checkOutcome,
  chooseEnemy,
  commitProfile,
  controlledAbilityCard,
  damageEnemy,
  defeatEnemy,
  descriptorOfKind,
  discardRandomFromHand,
  discoverClueAt,
  disengageEnemy,
  doResign,
  drawCards,
  drawChaosToken,
  drawEncounter,
  effectError,
  endChaosTest,
  enemiesEngagedWith,
  enemyAttack,
  enemyCanBeDefeated,
  enemyCannotBeAttacked,
  enemyDef,
  enemyEvadeValue,
  enemyFightValue,
  enemyRuleFlags,
  enemyTextBlanked,
  engageEnemy,
  entityModifierTotal,
  entityRuleActive,
  executeDescriptor,
  exilePlayerCard,
  expireEffects,
  extraActionBonus,
  finishScenario,
  getMaxHealth,
  getMaxSanity,
  getStat,
  getThreatEffect,
  inHub,
  info,
  investigatorMoveDestinations,
  investigatorTextBlanked,
  isWeaknessCard,
  isWeaknessCode,
  leadDecisionSeat,
  leaveAsset,
  locName,
  locationExists,
  lolaCanUseCard,
  makeRuntime,
  newCardInstance,
  newPlayerAssetInstance,
  notifyCluesRemoved,
  performTest,
  placeDoomOnCard,
  placeLocation,
  playCost,
  playedEffect,
  playerWindow,
  randomValue,
  reactionWindow,
  registeredEntry,
  relocateEnemy,
  relocateInvestigator,
  removeCardByCode,
  removeOne,
  requestChoice,
  resolveEffect,
  returnAssetToHand,
  revealLocation,
  ruleIgnored,
  runtimeCardAvailable,
  scenarioBehavior,
  scenarioRuntime,
  searchTop,
  shuffle,
  spawnEnemy,
  spendAction,
  spendClues,
  syncClues,
  tokenLabel,
  topDiscardEvent,
  triggerReaction,
  unique,
}

const apiDeps = { ...commonDeps,
  chooseLolaRole,
  disengageAll,
  farthestLocationsFor,
  itemDiscountAtLocation, }

const apiEnemyDeps = { ...commonDeps,
  assetCannotLeavePlay,
  isChargeAsset,
  recordResearch, }

const apiClueDeps = { ...commonDeps,
  doInvestigate: (...args) => doInvestigate(...args),
  doEvade: (...args) => doEvade(...args),
  doPlay: (...args) => doPlay(...args),
  doEndTurn,
  removeThreat, }

const apiTestDeps = { ...commonDeps,
  commitIcons,
  describeLimit,
  describeLook,
  describeSearch,
  describeTestResult,
  lookAt,
  moveCardTo,
  searchDeck,
  testStage, }

const apiMiscDeps = { ...commonDeps,
  activeEffects,
  cardHasTrait,
  createEffect,
  effectiveTraits,
  failedTestResolves,
  getHandSize,
  handSize,
  placeCluesOnLocation,
  doFightRaw: (...args) => doFight(...args), }

function abilityApi(state, events) {
  return {
    ...createMiscApi(state, events, apiMiscDeps),
    ...createTestApi(state, events, apiTestDeps),
    ...createClueApi(state, events, apiClueDeps),
    ...createEnemyApi(state, events, apiEnemyDeps),
    ...createCardApi(state, events, apiDeps),
  }
}


// 执行一条描述子。source 可以是资产实例、手牌 code（fromHand）、调查员本身，
// 或持续效果（effect 记录，Phase 1 A1）。


// 收集某个窗口下、某调查员能用的描述子（资产/威胁/调查员自身/手牌事件/持续效果）。

// ---------------------------------------------------------------------------
// Phase 3（D1）：非玩家卡的能力来源枚举
//
// 这些卡没有持有者，因此：
//   · 每个窗口只枚举一次（不按调查员重复），否则同一张敌人的强制能力会结算 N 次；
//   · 需要「谁来决定」时统一落到 decideSeatFor：窗口 context.seat → 当前回合座位 → 队长；
//   · 结算时把该座位当作执行者（费用里的资源/线索、条件里的 inv 都指向他），
//     与「剧本替卡牌做决定」的既有约定一致（见 content/registry 的关卡行为）。
// ---------------------------------------------------------------------------



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

function doResign(state, seat, events) {
  const inv = state.investigators[seat]
  inv.resigned = true
  eliminateInvestigator(state, inv, events)
  info(state, events, `🏳️ ${inv.name} 撤退了。`)
  if (aliveInvestigators(state).length === 0) scenarioBehavior(state).allResigned?.(state, scenarioRuntime(state, events))
  checkOutcome(state, events)
}




function playCost(state, inv, def) {
  const discount = inv.location === 'easttown' && def.type === 'asset' && (def.traits || []).some(trait => trait.toLowerCase() === 'ally') ? 2 : 0
  const factions = def.factions || [def.klass, def.klass2, def.klass3].filter(Boolean)
  const lola = inv.lolaDiscount?.round === state.round && inv.lolaDiscount?.turnSeat === state.currentSeat
    && factions.includes(inv.lolaDiscount.role) ? inv.lolaDiscount.amount : 0
  // Phase 6：这两项都是「打出折扣」的通用通道（名字里的战役前缀是历史遗留的 state 字段）。
  const cardDiscount = inv.carcosaPlayDiscount || 0
  const playDiscount = inv.playDiscount || 0
  const threatIncrease = inv.threat.reduce((sum, threat) =>
    sum + (getThreatEffect(threat)?.playCostIncrease || 0), 0)
  const loc = state.locations.find(location => location.id === inv.location)
  const locationIncrease = loc?.playCostIncrease || 0
  // 04142 珍品店：位于此处时打出每个 [[遗物]] 支援的费用 -2。
  const relicDiscount = loc && relicDiscountLocation(loc.originalCode || loc.code)
    && def.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'relic') ? 2 : 0
  const charles = itemDiscountAtLocation(state, inv, def)
  // 能力层修正：例如 03142「黑玛瑙扣环」在手牌中时其他手牌 +1 费用（负数为折扣）。
  const abilityLayer = playCostDelta(state, inv, def.code)
  return Math.max(0, (def.cost || 0) - discount - lola - cardDiscount - playDiscount + threatIncrease + locationIncrease - relicDiscount - charles + abilityLayer)
}

function itemDiscountAtLocation(state, inv, def) {
  if (!def || def.type !== 'asset') return 0
  if (!(def.traits || []).some(trait => String(trait).toLowerCase() === 'item')) return 0
  const holder = state.investigators.find(other => other.location === inv.location
    && other.assets.some(asset => asset.itemDiscountAtLocation
      && asset.itemDiscountAtLocation.round === state.round
      && asset.itemDiscountAtLocation.phase === state.phase))
  if (!holder) return 0
  const asset = holder.assets.find(item => item.itemDiscountAtLocation
    && item.itemDiscountAtLocation.round === state.round && item.itemDiscountAtLocation.phase === state.phase)
  return asset?.itemDiscountAtLocation?.amount || 1
}

function consumeItemDiscountAtLocation(state, inv) {
  for (const other of state.investigators.filter(item => item.location === inv.location)) {
    for (const asset of other.assets.filter(item => item.itemDiscountAtLocation)) {
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
    && other.assets.some(asset => asset.itemDiscountAtLocation)) || null
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
  // Phase 5（5a-11）：某些地点调查要多花行动，映射在卡号规则数据里。
  if (move.action === 'investigate') cost += investigateExtraActionsFor(investigateLoc?.originalCode || investigateLoc?.code)
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
    && (seat == null || inv.seat === seat) && inv.assets.some(asset => asset.code === LITA_CHANDLER_CODE))
}

function litaUncontrolled(state, locationId = null) {
  return state.actIndex === scenarioBehavior(state).litaParleyActIndex && !litaControlled(state)
    && (state.storyAssets || []).some(asset => asset.code === LITA_CHANDLER_CODE && asset.controllerSeat == null
      && (locationId == null || asset.location === locationId))
}

function unique(arr) {
  return [...new Set(arr)]
}

// 资产能力成本是否可支付（不判定行动点，仅看资源/充能/横置）。
// Phase 2（C3）：费用表达式在这里求值——「预览 = 校验 = 扣费」三处共用一份数值，
// 因此「每有 1 个线索付 1 资源」这类动态费用不会出现"预览说付得起、结算说付不起"。

// 动态费用的预览文案（静态费用返回 null，避免牌桌/AI 看到多余的括号）。
// 注意：文案用**未求值**的 cost 生成，这样玩家看到的是"2 资源（按线索数）"而不是光秃秃的 2，
// 求值结果只用来判断"费用是否合法"。

// 资产能力效果的可选目标敌人（用于目标选择拆分）。

// 把 targetId（敌人 id）注入到能力效果，供效果解释器定向结算。


// 汇总当前调查员可用的「免费能力」（异能 / 免费资产能力 / 天赋牌），供 describeState 展示。

// 卡面赋予的行动提示：不论此刻能否执行都列出，并给出不可执行的原因。
// 数据来源是行为自己的 actions()/encounterActions()——每一项都可以带 reason（条件不满足时给），
// legalMoves 只取不带 reason 的，这里取全部，所以"什么时候可用"只在一个地方写一遍。
// scriptCard 标明行动归属：'act'/'agenda' 显示在牌桌剧本区；'enemy'/'location' 只喂 AI 计划，
// 牌桌不渲染。真正执行仍只走 legalMoves/validateMove。



// ---------------------------------------------------------------------------
// 给 AI 的局面描述
// ---------------------------------------------------------------------------


// Phase 6（6d-3）：战斗 / 躲避搬进 combat.js；依赖在这里一次性注入（函数声明已提升，可直接引用）。
const { doFight, doEvade } = createCombat({
  ...commonDeps,
  afterEvade,
  attackStyle,
  canDisengage,
  captureTableState,
  enemyHealth,
  enemyStatMods,
  hiddenFightBlocked,
  litaAuraAt,
  moveInvestigatorTo,
  payActionCost,
  sealRevealedChaosToken,
})

// Phase 6（6d-4）：打牌 / 调查搬进 actions.js；依赖一次性注入。
const { doPlay, doInvestigate } = createActions({
  ...commonDeps,
  afterEvade,
  attachmentTargets,
  awardLocationVictory,
  charlesPayCandidate,
  chooseEnemyFrom,
  consumeItemDiscountAtLocation,
  consumePlayThreatResources,
  disposePlayedEvent,
  engagedWithMaskedHunter,
  entersPlayEffect,
  investigateBonus,
  nextInstanceId,
  playAccess,
  replaceAssets,
  sealChaosToken,
  tfaApplyPlayCost,
  tfaPlayCostPreview,
  withEffectCode,
})

// Phase 6（6d-5）：补给阶段 / 密谋揭示搬进 phases.js；依赖一次性注入。
const { upkeepPhase, runAgendaReveal } = createPhases({
  ...commonDeps,
  defeatAll,
  discardHandTo,
  discardUntilEnemyTrait,
  eliminateInvestigator,
  exploreOnlyActionBonus,
  firstAliveSeat,
  getHandSize,
  maskedHunterPrey,
  phaseBeginningWindow,
  runAgendaForced,
  runEnemyRoundEnd,
  runLocationRoundEnd,
  runThreatEndTurn,
  tfaDiscardOnYourOwn,
})

// Phase 6（6d-6）：合法行动枚举 / 校验搬进 moves.js；外部仍然从 engine.js 取这两个名字。
export const { legalMoves, validateMove } = createMoves({
  ...commonDeps,
  LITA_CHANDLER_CODE,
  META,
  actingSeats,
  actionCost,
  actionKind,
  activeHiddenRules,
  assetReplacementPlans,
  availableThreatAbilities,
  canAdvanceWithClues,
  canAffordAbility,
  canParleyCultist,
  canUseExtraEvade,
  cannotTriggerFreeAbility,
  cardPlayBlockedReason,
  charlesPayCandidate,
  choiceError,
  choiceMoves,
  controlledAbilityCards,
  costPreviewSuffix,
  decisionSeat,
  drawBlocked,
  enumerateTargets,
  groupClues,
  hasHiddenCard,
  hasPlayedEventsToDeckTop,
  hiddenFightBlocked,
  hiddenRule,
  hubLegalMoves,
  investigatorEntryError,
  isCardAvailable,
  limitUsed,
  litaUncontrolled,
  locationAbilityAvailable,
  movementError,
  normalActionsLeft,
  normalizedSlots,
  playAccess,
  playConditionError,
  playConditionHelpers,
  resolveTarget,
  stateCompatibilityError,
  tfaPlayCostPreview,
  tomeActionEligible,
  validateHubMove,
})

// Phase 6（6d-2）：状态描述搬进 describe.js（纯投影 + 依赖注入）。
export const describeState = createDescribeState({
  ...commonDeps,
  describeTeamParticipation,
  actingSeats,
  legalMoves,
  actObjectiveContext,
  totalDoom,
  agendaDoom,
  investigatorParticipation,
  decisionSeat,
  describeFreeAbilities,
  describePrey,
  enemyHealth,
  narrativeLogTexts,
  scriptActionHints,
  stripLabel,
})

// Phase 6（6d-12）：技能检定主流程搬进 tests.js。
// 用惰性装配的原因：performTest 被多个 api 依赖表引用，而那些表在模块顶层立即求值；
// 若这里用 const 初始化会 TDZ（Cannot access 'performTest' before initialization）。
// 函数声明 + 首次调用装配，既保持 hoisting，也保证依赖在运行时才解析。
let performTestImpl = null
export function performTest(state, seat, skill, difficulty, options = {}) {
  performTestImpl ||= createPerformTest({
  ...commonDeps,
  activeHiddenRules,
  applyFreeTriggers,
  applySkillOnSuccess,
  applyTokenFx,
  codexSealedElderSign,
  commitIcons,
  elderSignEffect,
  hasHiddenCard,
  hiddenDefinition,
  hiddenRule,
  isChargeAsset,
  minhCommitWildBonus,
  pendingTestResult,
  removeHiddenMarker,
  resolveSpecialToken,
  returnChaosToken,
  summarizeTestResult,
  tfaBeforeChaosReveal,
  tfaFailedTestWindow,
})
  return performTestImpl(state, seat, skill, difficulty, options)
}

// Phase 6（6d-13）：剧本运行时搬进 scenario-runtime.js；同样用惰性装配（依赖表在顶层立即求值）。
let scenarioRuntimeImpl = null
function scenarioRuntime(state, events, testSource = null) {
  scenarioRuntimeImpl ||= createScenarioRuntime({
  ...commonDeps,
  addBasicWeakness,
  addToExplorationDeck,
  addYigsFury,
  advanceAgenda,
  buildExplorationDeck,
  checkSupplies,
  crossOffSupply,
  defeatedAssetRetaliation,
  discardEnemyCard,
  discardUntilEnemy,
  discardUntilEnemyFromEncounter,
  doExplore,
  doPlay,
  doomCards,
  drawMadnessWeakness,
  eliminateInvestigator,
  enemyCannotAttack,
  enemyHealth,
  expeditionLeaderSeat,
  flipScenarioLocation,
  grantSupplies,
  groupPayment,
  hasSupply,
  hunterStep,
  investigateTest,
  isPoisoned,
  moveRelicOfAges,
  poisonInvestigator,
  privateInfo,
  recordVengeance,
  relicOfAges,
  relicOfAgesLocation,
  removeLocation,
  scenarioAssetPlayError,
  setExpeditionLeader,
  spawnStoryAsset,
  spawnStoryEnemy,
  stepToward,
  suppliesAtLocation,
  suppliesFor,
  vengeancePoints,
  yigsFury,
})
  return scenarioRuntimeImpl(state, events, testSource)
}

// Phase 6（6d-14）：弱点结算搬进 weakness.js；同样惰性装配（依赖表在顶层立即求值）。
let resolveWeaknessImpl = null
function resolveWeakness(state, inv, def, events, texts) {
  resolveWeaknessImpl ||= createWeakness({
  ...commonDeps,
  assetCannotLeavePlay,
  farthestLocationsFor,
  replaceAssets,
  sealChaosToken,
  weaknessDescriptor,
  weaknessProfile,
  weaknessUpgradeCode,
})
  return resolveWeaknessImpl(state, inv, def, events, texts)
}

// Phase 6（6d-15）：玩家卡效果调度搬进 player-effects.js；惰性装配，保留老调用点。
let dunwichPlayerEffectImpl = null
function dunwichPlayerEffect(state, seat, effect, events) {
  dunwichPlayerEffectImpl ||= createPlayerEffects({
  ...commonDeps,
  doFight,
  doInvestigate,
  doPlay,
})
  return dunwichPlayerEffectImpl(state, seat, effect, events)
}

// Phase 6（6d-16）：能力执行搬进 ability-exec.js；惰性装配（部分依赖表在顶层立即求值）。
let abilityExecution = null
function abilityExec() {
  abilityExecution ||= createAbilityExecution({
  ...commonDeps,
  applyAbilityTarget,
  assetReplacementPlans,
  autoEvadeNonElite,
  blankEnemy,
  damagedTargetsAtLocation,
  dealDamageAll,
  dealDamageExhausted,
  decideSeatFor,
  descriptorSources,
  descriptorUsable,
  descriptorsInEntry,
  discardChosenCards,
  discardLocked,
  discardableHandCards,
  effectDefinitionError,
  healDamageAtLocation,
  investigateForResources,
  nonPlayerAbilitySources,
  normalizeCostValues,
  noteUnknownWindow,
  rechargeAsset,
  reloadAmmo,
  shuffleIntoEncounter,
  windowLabelOf,
})
  return abilityExecution
}
function doAbility(state, seat, assetId, index, targetId, choice, events) {
  return abilityExec().doAbility(state, seat, assetId, index, targetId, choice, events)
}
function openAbilityWindow(state, when, context, events) {
  return abilityExec().openAbilityWindow(state, when, context, events)
}
function effectError(state, inv, effect) {
  return abilityExec().effectError(state, inv, effect)
}

// Phase 6（6d-17）：战役流程搬进 campaign-flow.js。
// 用函数声明 + 惰性装配：这些函数被多个依赖表在模块顶层引用，const 解构会 TDZ。
let campaignFlowImpl = null
function campaignFlowApi() {
  campaignFlowImpl ||= createCampaignFlow({
  ...commonDeps,
  CHAOS_BAGS,
  PALLID_MASK_CODE,
  ScenarioRestarted,
  addLitaToCampaign,
  applyCampaignEffect,
  applyResolutionResults,
  awardExperience,
  campaignCardChange,
  campaignGraph,
  campaignManifestFor,
  endCampaign,
  enterCampaignNode,
  initializeChaosBag,
  introduction,
  originalCardCode,
  resolutionStory,
  runInterlude,
  runMulligans,
  settleExiledCards,
  startScenario,
  updateCampaignStatus,
  walkCampaign,
})
  return campaignFlowImpl
}
function progressCampaign(...args) { return campaignFlowApi().progressCampaign(...args) }
function restartScenario(...args) { return campaignFlowApi().restartScenario(...args) }
function finishScenario(...args) { return campaignFlowApi().finishScenario(...args) }
function applyResolutionEffects(...args) { return campaignFlowApi().applyResolutionEffects(...args) }
function addTrauma(...args) { return campaignFlowApi().addTrauma(...args) }
function applyDefeatTrauma(...args) { return campaignFlowApi().applyDefeatTrauma(...args) }

// Phase 6（6d-18）：建局流程搬进 setup.js。函数声明 + 惰性装配，保持所有调用点与导出不变。
let setupImpl = null
function setupApi() {
  setupImpl ||= createSetup({
  ...commonDeps,
  ALL_INVESTIGATORS,
  CARD_CODE,
  CHAOS_BAGS,
  CLASS_COLOR,
  CLASS_EMOJI,
  DERIVED_STATE_KEYS,
  META,
  PLAYABLE_INVESTIGATORS,
  RULES_VERSION,
  SCENARIOS,
  STATE_SCHEMA_VERSION,
  TOKEN_LABEL,
  allCardDefs,
  buildDeck,
  buildDeckFromList,
  campaignManifestFor,
  canSelectInvestigator,
  carcosaPlayerEffect,
  consumeStartingAdjustments,
  corePlayerPool,
  embeddedCardDefs,
  executeCommand,
  expeditionLeaderSeat,
  firstAliveSeat,
  hashSeed,
  initialHubScenarioMoves,
  initializeChaosBag,
  introduction,
  legalMoves,
  openAbilityWindow,
  randomUUID,
  registerCampaignInvestigator,
  registerCampaignScenarios,
  relicOfAges,
  resolveAgendaDoomThresholds,
  resolveTransaction,
})
  return setupImpl
}
export function makeInvestigator(...args) { return setupApi().makeInvestigator(...args) }
export function drawOpeningHand(...args) { return setupApi().drawOpeningHand(...args) }
export function buildInvestigatorsDeck(...args) { return setupApi().buildInvestigatorsDeck(...args) }
export function prepareInvestigator(...args) { return setupApi().prepareInvestigator(...args) }
export function refreshStateResources(...args) { return setupApi().refreshStateResources(...args) }
export function unknownCardCodes(...args) { return setupApi().unknownCardCodes(...args) }
export function createGameState(...args) { return setupApi().createGameState(...args) }
export function pickAiInvestigator(...args) { return setupApi().pickAiInvestigator(...args) }
export function startScenario(...args) { return setupApi().startScenario(...args) }
export function scenarioStartLocation(...args) { return setupApi().scenarioStartLocation(...args) }
export function setupScenarioLocations(...args) { return setupApi().setupScenarioLocations(...args) }
export function setupScenarioEnemies(...args) { return setupApi().setupScenarioEnemies(...args) }
export function setupScenarioDecks(...args) { return setupApi().setupScenarioDecks(...args) }
export function setupChaosBag(...args) { return setupApi().setupChaosBag(...args) }

// Phase 6（6d-19）：行动分派搬进 dispatch.js；函数声明 + 惰性装配，保持导出与调用点不变。
let dispatchImpl = null
function dispatchApi() {
  dispatchImpl ||= createDispatch({
  ...commonDeps,
  getCurrentActionKind: () => currentActionKind,
  setCurrentActionKind: value => { currentActionKind = value },
  ALL_INVESTIGATORS,
  ScenarioRestarted,
  actionCost,
  actionKind,
  advanceInvestigator,
  buildDeck,
  buildDeckFromList,
  captureTableState,
  cardKeyword,
  chooseAttack,
  corePlayerPool,
  currentActionKind,
  doAbility,
  doBreakDoor,
  doDiscardThreat,
  doDraw,
  doDrawCultist,
  doEndTurn,
  doEngage,
  doEvade,
  doExplore,
  doFight,
  doFreeAction,
  doHiddenAction,
  doInterruptRitual,
  doInvestigate,
  doLocationAbility,
  doMove,
  doParley,
  doParleyCultist,
  doParleyLita,
  doPayDebt,
  doPlay,
  doPurgeThreat,
  doResource,
  doSacrificeLita,
  doSearchIzzie,
  doShortcutMove,
  endCampaign,
  enemyCanOpportunityAttack,
  finishUpgradeDraft,
  hubActingSeats,
  hubPendingSeats,
  initialHubPreparation,
  jakeSkipsOpportunityAttack,
  legalMoves,
  makeInvestigator,
  normalActionsLeft,
  payAndAdvanceAct,
  playFlag,
  progressCampaign,
  recommendUpgrade,
  registerCampaignInvestigator,
  resolveTransaction,
  runInterlude,
  runMulligans,
  selectInitialHubScenario,
  stagePurchase,
  startScenario,
  unpaidExtraActionThreats,
  validateMove,
})
  return dispatchImpl
}
export function applyMove(...args) { return dispatchApi().applyMove(...args) }
export function executeCommand(...args) { return dispatchApi().executeCommand(...args) }
export function executeAction(...args) { return dispatchApi().executeAction(...args) }
export function executeHubMove(...args) { return dispatchApi().executeHubMove(...args) }
export function applyMoveUnchecked(...args) { return dispatchApi().applyMoveUnchecked(...args) }

// Phase 6（6d-20）：遭遇牌与窗口搬进 encounter.js；惰性装配保持调用点与导出。
let encounterImpl = null
function encounterApi() {
  encounterImpl ||= createEncounter({
  ...commonDeps,
  ALL_ENEMIES,
  ALL_TREACHERIES,
  actPlacesLocationForEmptySpawn,
  canAffordAbility,
  cannotTriggerFreeAbility,
  chooseAmong,
  controlledAbilityCards,
  descriptorReactionSpec,
  descriptorsForWindow,
  doAbility,
  evaluateCriteria,
  isAutomaticReward,
  limitUsed,
  openAbilityWindow,
  placeLocationForEmptySpawn,
  playReactionCard,
  playerWindowLabel,
  resolveTreachery,
})
  return encounterImpl
}
export function drawEncounter(...args) { return encounterApi().drawEncounter(...args) }
export function reactionWindow(...args) { return encounterApi().reactionWindow(...args) }
export function triggerReaction(...args) { return encounterApi().triggerReaction(...args) }
export function playerWindow(...args) { return encounterApi().playerWindow(...args) }

// Phase 6（6d-21）：移动与位置搬进 movement.js；惰性装配保持调用点与导出。
let movementImpl = null
function movementApi() {
  movementImpl ||= createMovement({
  ...commonDeps,
  applyPenalty,
  counterTreacheryCode,
  discardBarricades,
  investigatorEntryError,
  locationRevealCue,
  movementError,
  payActionCost,
  processPlayerEnemyEntry,
})
  return movementImpl
}
export function stepToward(...args) { return movementApi().stepToward(...args) }
export function distanceToInvestigator(...args) { return movementApi().distanceToInvestigator(...args) }
export function investigatorMoveDestinations(...args) { return movementApi().investigatorMoveDestinations(...args) }
export function moveInvestigatorTo(...args) { return movementApi().moveInvestigatorTo(...args) }
export function doShortcutMove(...args) { return movementApi().doShortcutMove(...args) }
export function doMove(...args) { return movementApi().doMove(...args) }
export function relocateInvestigator(...args) { return movementApi().relocateInvestigator(...args) }
export function relocateEnemy(...args) { return movementApi().relocateEnemy(...args) }

// Phase 6（6d-22）：敌人与伤害原语搬进 enemies.js；惰性装配保持导出与调用点。
let enemiesImpl = null
function enemiesApi() {
  enemiesImpl ||= createEnemies({
  ...commonDeps,
  PALLID_MASK_CODE,
  SMITE_THE_WICKED_CODE,
  addVictory,
  assetPassiveData,
  assignHarm,
  cardIdentityFields,
  checkAgendaForcedEnemyDefeated,
  enemyCannotAttack,
  enemyHealthDelta,
  enemyHealthValue,
  enemyStatMods,
  newEnemyId,
  processPlayerEnemyEntry,
  triggerThreatForced,
  tryAquinnahRedirect,
})
  return enemiesImpl
}
export function enemyHealth(...args) { return enemiesApi().enemyHealth(...args) }
export function enemyFightValue(...args) { return enemiesApi().enemyFightValue(...args) }
export function enemyEvadeValue(...args) { return enemiesApi().enemyEvadeValue(...args) }
export function enemiesEngagedWith(...args) { return enemiesApi().enemiesEngagedWith(...args) }
export function enemyAttack(...args) { return enemiesApi().enemyAttack(...args) }
export function spawnEnemy(...args) { return enemiesApi().spawnEnemy(...args) }
export function engageEnemy(...args) { return enemiesApi().engageEnemy(...args) }
export function disengageEnemy(...args) { return enemiesApi().disengageEnemy(...args) }
export function defeatEnemy(...args) { return enemiesApi().defeatEnemy(...args) }
export function damageEnemy(...args) { return enemiesApi().damageEnemy(...args) }
export function autoEvadeEnemy(...args) { return enemiesApi().autoEvadeEnemy(...args) }
export function applyHarm(...args) { return enemiesApi().applyHarm(...args) }
export function defeatedAssetRetaliation(...args) { return enemiesApi().defeatedAssetRetaliation(...args) }
export function applyDamage(...args) { return enemiesApi().applyDamage(...args) }
export function applyHorror(...args) { return enemiesApi().applyHorror(...args) }

// Phase 6（6d-23）：地点与线索搬进 locations.js；惰性装配保持导出与调用点。
let locationsImpl = null
function locationsApi() {
  locationsImpl ||= createLocations({
  ...commonDeps,
  ALL_TREACHERIES,
  RELOCATE_DESTINATION_LOCATION_CODE,
  assetPassiveData,
  discardBarricades,
  engagedWithMaskedHunter,
  locationCounterTreacheries,
  locationRevealCue,
})
  return locationsImpl
}
export function locName(...args) { return locationsApi().locName(...args) }
export function placeLocation(...args) { return locationsApi().placeLocation(...args) }
export function flipScenarioLocation(...args) { return locationsApi().flipScenarioLocation(...args) }
export function revealLocation(...args) { return locationsApi().revealLocation(...args) }
export function removeLocation(...args) { return locationsApi().removeLocation(...args) }
export function syncClues(...args) { return locationsApi().syncClues(...args) }
export function placeCluesOnLocation(...args) { return locationsApi().placeCluesOnLocation(...args) }
export function notifyCluesRemoved(...args) { return locationsApi().notifyCluesRemoved(...args) }
export function discoverClueAt(...args) { return locationsApi().discoverClueAt(...args) }
export function awardLocationVictory(...args) { return locationsApi().awardLocationVictory(...args) }

// Phase 6（6d-24）：检定的效果侧搬进 skill-effects.js；惰性装配保持导出与调用点。
let skillEffectsImpl = null
function skillEffectsApi() {
  skillEffectsImpl ||= createSkillEffects({
  ...commonDeps,
  legalMoves,
  upkeepPhase,
  doPlay,
  doInvestigate,
  doEvade,
  doFight,
  all,
  attachBarricade,
  autoEvadeNonElite,
  blankEnemy,
  carcosaInvestigatorEffect,
  carcosaPlayerEffect,
  chooseInvestigator,
  createEffect,
  dealDamageAll,
  dealDamageExhausted,
  defeatNonEliteEnemyAt,
  discardHandTo,
  discardRandomAsset,
  disengageAll,
  drawEnemyByTrait,
  dukeInvestigate,
  dunwichPlayerEffect,
  enemyForTarget,
  healDamageAtLocation,
  healHorrorNearby,
  ignoreChaos,
  investigateForResources,
  moveHorrorToInvestigator,
  moveInvestigatorTo,
  nearestEnemyByTrait,
  placeCluesOnLocation,
  rechargeAsset,
  reloadAmmo,
  researchSolution,
  scryDeck,
  searchCards,
  searchDiscard,
  shuffleIntoEncounter,
  targetedTest,
  tfaInvestigatorEffect,
  tfaPlayerEffect,
})
  return skillEffectsImpl
}
export function applyTokenFx(...args) { return skillEffectsApi().applyTokenFx(...args) }
export function applySkillOnSuccess(...args) { return skillEffectsApi().applySkillOnSuccess(...args) }
export function makeRuntime(...args) { return skillEffectsApi().makeRuntime(...args) }

// Phase 6（6d-25）：回合与阶段推进搬进 turn.js；惰性装配保持导出与调用点。
let turnImpl = null
function turnApi() {
  turnImpl ||= createTurn({
  ...commonDeps,
  upkeepPhase,
  PREY_RANK,
  applyThreatForced,
  checkAgenda,
  chooseAmong,
  chooseAttack,
  chooseTurn,
  distanceToInvestigator,
  exploreOnlyActionBonus,
  removeThreat,
  runAgendaForced,
  tfaBorrowedTimeTurnStart,
  useGoldPocketWatch,
})
  return turnImpl
}
export function runMythos(...args) { return turnApi().runMythos(...args) }
export function enemyPhase(...args) { return turnApi().enemyPhase(...args) }
export function hunterStep(...args) { return turnApi().hunterStep(...args) }
export function runLocationRoundEnd(...args) { return turnApi().runLocationRoundEnd(...args) }
export function runEnemyRoundEnd(...args) { return turnApi().runEnemyRoundEnd(...args) }
export function runThreatEndTurn(...args) { return turnApi().runThreatEndTurn(...args) }
export function phaseBeginningWindow(...args) { return turnApi().phaseBeginningWindow(...args) }
export function turnBeginningWindow(...args) { return turnApi().turnBeginningWindow(...args) }
export function beginInvestigationPhase(...args) { return turnApi().beginInvestigationPhase(...args) }
export function runBetweenInvestigationPhases(...args) { return turnApi().runBetweenInvestigationPhases(...args) }
export function doEndTurn(...args) { return turnApi().doEndTurn(...args) }

// Phase 6（6d-26）：揭示与描述子执行搬进 reveal.js；惰性装配保持导出与调用点。
let revealImpl = null
function revealApi() {
  revealImpl ||= createReveal({
  ...commonDeps,
  LITA_CHANDLER_CODE,
  applyAbilityTarget,
  canSpendClues,
  consumePlayThreatResources,
  descriptorCost,
  discardUntilEnemy,
  disposePlayedEvent,
  drawEnemyByTrait,
  markLimitUsed,
  nearestEnemyByTrait,
  payAbilityCost,
  removeLocation,
  resolveTarget,
  ruleCodeForOriginal,
  spawnStoryAsset,
  stepToward,
})
  return revealImpl
}
export function resolveTreacheryEffect(...args) { return revealApi().resolveTreacheryEffect(...args) }
export function runActReveal(...args) { return revealApi().runActReveal(...args) }
export function runAgendaForced(...args) { return revealApi().runAgendaForced(...args) }
export function executeDescriptor(...args) { return revealApi().executeDescriptor(...args) }

// Phase 6（6d-28）：牌堆操作搬进 deck-ops.js；惰性装配保持导出与调用点。
let deckOpsImpl = null
function deckOpsApi() {
  deckOpsImpl ||= createDeckOps({
    EFFECTS,
    aliveInvestigators,
    applyHorror,
    attachCardTo,
    canDiscardFromHand,
    cardDef,
    cardName,
    describeCardMove,
    describeLook,
    describeSearch,
    discardLocked,
    findZoneCard,
    info,
    isThreatWeakness,
    isWeaknessCard,
    leaveAsset,
    newPlayerAssetInstance,
    normalizeCardMove,
    normalizeLookOptions,
    normalizeSearchOptions,
    randomValue,
    registeredEntry,
    removeThreat,
    requestChoice,
    resolveWeakness,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    tfaCardDrawReaction,
    triggerReaction,
    weaknessProfile,
  })
  return deckOpsImpl
}
export function lookZoneAdapter(...args) { return deckOpsApi().lookZoneAdapter(...args) }
export function lookAt(...args) { return deckOpsApi().lookAt(...args) }
export function scryDeck(...args) { return deckOpsApi().scryDeck(...args) }
export function searchDeck(...args) { return deckOpsApi().searchDeck(...args) }
export function moveCardTo(...args) { return deckOpsApi().moveCardTo(...args) }
export function drawCards(...args) { return deckOpsApi().drawCards(...args) }
export function discardRandomFromHand(...args) { return deckOpsApi().discardRandomFromHand(...args) }
export function removeOne(...args) { return deckOpsApi().removeOne(...args) }
export function removeCardByCode(...args) { return deckOpsApi().removeCardByCode(...args) }

// Phase 6（6d-29）：战役台面与幕间搬进 hub.js；惰性装配保持导出与调用点。
let hubImpl = null
function hubApi() {
  hubImpl ||= createHub({
    ALL_CARDS,
    ALL_ENEMIES,
    ALL_INVESTIGATORS,
    ALL_STORY_ASSETS,
    ALL_TREACHERIES,
    HUB_DIFFICULTIES,
    LITA_CHANDLER_CODE,
    SCENARIOS,
    actingSeats,
    aliveInvestigators,
    applyCampaignEffect,
    availablePurchases,
    buildDeck,
    campaignCardChange,
    campaignEnding,
    campaignFor,
    campaignManifestFor,
    cardName,
    contentRegistry,
    decisionSeat,
    hubInvestigatorChoices,
    hubStartingDeckReady,
    info,
    initialHubPreparation,
    initialHubScenarioMoves,
    makeInvestigator,
    progressCampaign,
    purchaseCard,
    randomValue,
    registerCampaignInvestigator,
    replacementCandidates,
    replacementOptions,
    requestChoice,
    resolutionCheckpoint,
    shuffle,
    upgradeRecord,
    walkCampaign,
  })
  return hubImpl
}
export function registerCampaignScenarios(...args) { return hubApi().registerCampaignScenarios(...args) }
export function addLitaToCampaign(...args) { return hubApi().addLitaToCampaign(...args) }
export function runInterlude(...args) { return hubApi().runInterlude(...args) }
export function endCampaign(...args) { return hubApi().endCampaign(...args) }
export function firstAliveSeat(...args) { return hubApi().firstAliveSeat(...args) }
export function leadDecisionSeat(...args) { return hubApi().leadDecisionSeat(...args) }
export function nextSeat(...args) { return hubApi().nextSeat(...args) }
export function chooseTurn(...args) { return hubApi().chooseTurn(...args) }
export function expeditionLeaderSeat(...args) { return hubApi().expeditionLeaderSeat(...args) }
export function selectInitialHubScenario(...args) { return hubApi().selectInitialHubScenario(...args) }
export function hubLegalMoves(...args) { return hubApi().hubLegalMoves(...args) }


// ---------------------------------------------------------------------------
// createAbilityRules 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createAbilityRulesImpl = null
function createAbilityRulesApi() {
  createAbilityRulesImpl ||= createAbilityRules({
    ...commonDeps,
    doAbility,
    legalMoves,
    all,
    applyDamage,
    applyHorror,
    cannotPlayTypes,
    capabilityBlocked,
    cardDef,
    cardName,
    controlledAbilityCards,
    costIsDynamic,
    defeatEnemy,
    describeCost,
    discardChosenCards,
    discardableHandCards,
    effectAbilitySources,
    enemiesEngagedWith,
    enemyRuleFlags,
    enemyTextBlanked,
    exilePlayerCard,
    getMaxSanity,
    hasNonPlayerBehavior,
    hiddenFightBlocked,
    info,
    isWeaknessCode,
    leaveAsset,
    limitUsed,
    normalizeCostValues,
    openAbilityWindow,
    playCost,
    registeredEntry,
    scenarioResignAvailable,
    syncClues,
  })
  return createAbilityRulesImpl
}
export function payAbilityCost(...args) { return createAbilityRulesApi().payAbilityCost(...args) }
export function descriptorCost(...args) { return createAbilityRulesApi().descriptorCost(...args) }
export function descriptorUsable(...args) { return createAbilityRulesApi().descriptorUsable(...args) }
export function evaluateCriteria(...args) { return createAbilityRulesApi().evaluateCriteria(...args) }
export function descriptorSources(...args) { return createAbilityRulesApi().descriptorSources(...args) }
export function entityAbilityEntry(...args) { return createAbilityRulesApi().entityAbilityEntry(...args) }
export function nonPlayerAbilitySources(...args) { return createAbilityRulesApi().nonPlayerAbilitySources(...args) }
export function canAffordAbility(...args) { return createAbilityRulesApi().canAffordAbility(...args) }
export function abilityTargets(...args) { return createAbilityRulesApi().abilityTargets(...args) }
export function applyAbilityTarget(...args) { return createAbilityRulesApi().applyAbilityTarget(...args) }
export function costPreviewSuffix(...args) { return createAbilityRulesApi().costPreviewSuffix(...args) }
export function playConditionHelpers(...args) { return createAbilityRulesApi().playConditionHelpers(...args) }


// ---------------------------------------------------------------------------
// createTableDecisions 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createTableDecisionsImpl = null
function createTableDecisionsApi() {
  createTableDecisionsImpl ||= createTableDecisions({
    ...commonDeps,
    legalMoves,
    ALL_INVESTIGATORS,
    CLASS_NAMES,
    EFFECTS,
    HUB_SEAT_ACTIONS,
    INVESTIGATOR_ABILITIES,
    PLAYABLE_INVESTIGATORS,
    actionCost,
    advanceAct,
    aliveInvestigators,
    applyHorror,
    assetEffect,
    assetPassiveData,
    basicWeaknessPool,
    buildDeckFromList,
    campaignGraph,
    campaignManifestFor,
    capabilityBlocked,
    cardDef,
    cardName,
    cardPlayFlag,
    choiceSeats,
    chooseLolaRole,
    chooseTurn,
    controlledAbilityCard,
    corePlayerPool,
    discardRandomFromHand,
    drawOpeningHand,
    enemiesEngagedWith,
    enemyCanOpportunityAttack,
    enemyDef,
    getThreatEffect,
    groupClues,
    hubConcurrentPhase,
    hubLegalMoves,
    hubPendingSeats,
    inHub,
    info,
    investigatorTextBlanked,
    leaveAsset,
    phaseBeginningWindow,
    playCost,
    playedEffect,
    randomValue,
    registeredEntry,
    removeOne,
    requestChoice,
    scenarioBehavior,
    shuffle,
    turnBeginningWindow,
  })
  return createTableDecisionsImpl
}
export function validateHubMove(...args) { return createTableDecisionsApi().validateHubMove(...args) }
export function autoHubMove(...args) { return createTableDecisionsApi().autoHubMove(...args) }
export function decisionSeed(...args) { return createTableDecisionsApi().decisionSeed(...args) }
export function moveCost(...args) { return createTableDecisionsApi().moveCost(...args) }
export function cardPlayBlockedReason(...args) { return createTableDecisionsApi().cardPlayBlockedReason(...args) }
export function actionKind(...args) { return createTableDecisionsApi().actionKind(...args) }
export function actionPreview(...args) { return createTableDecisionsApi().actionPreview(...args) }
export function consumeStartingAdjustments(...args) { return createTableDecisionsApi().consumeStartingAdjustments(...args) }
export function consumeMulliganBlock(...args) { return createTableDecisionsApi().consumeMulliganBlock(...args) }
export function runMulligans(...args) { return createTableDecisionsApi().runMulligans(...args) }
export function useGoldPocketWatch(...args) { return createTableDecisionsApi().useGoldPocketWatch(...args) }
export function resolveCallOfTheUnknown(...args) { return createTableDecisionsApi().resolveCallOfTheUnknown(...args) }
export function hubStartingDeckReady(...args) { return createTableDecisionsApi().hubStartingDeckReady(...args) }
export function initialHubScenarioMoves(...args) { return createTableDecisionsApi().initialHubScenarioMoves(...args) }
export function hubInvestigatorChoices(...args) { return createTableDecisionsApi().hubInvestigatorChoices(...args) }
export function initialHubPreparation(...args) { return createTableDecisionsApi().initialHubPreparation(...args) }
export function hubActingSeats(...args) { return createTableDecisionsApi().hubActingSeats(...args) }
export function decisionSeat(...args) { return createTableDecisionsApi().decisionSeat(...args) }
export function actingSeats(...args) { return createTableDecisionsApi().actingSeats(...args) }
export function seatLocalMove(...args) { return createTableDecisionsApi().seatLocalMove(...args) }
export function jakeSkipsOpportunityAttack(...args) { return createTableDecisionsApi().jakeSkipsOpportunityAttack(...args) }
export function canUseExtraEvade(...args) { return createTableDecisionsApi().canUseExtraEvade(...args) }
export function abilityOfMove(...args) { return createTableDecisionsApi().abilityOfMove(...args) }


// ---------------------------------------------------------------------------
// createActionsExtra 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createActionsExtraImpl = null
function createActionsExtraApi() {
  createActionsExtraImpl ||= createActionsExtra({
    ...commonDeps,
    applyMove,
    executeAction,
    EFFECTS,
    INVESTIGATOR_ABILITIES,
    LITA_CHANDLER_CODE,
    SEARCHING_FOR_IZZIE_CODE,
    SKILL_NAMES,
    activeHiddenRules,
    applyDamage,
    applyHorror,
    assetReplacementPlans,
    autoEngageAll,
    campaignCardChange,
    canDiscardFromHand,
    canEquip,
    cannotPlayTypes,
    cardDef,
    cardHasTrait,
    cardName,
    checkAct,
    discardChosenCards,
    discardHiddenCard,
    drawCards,
    effectError,
    effectiveTraits,
    enemyDef,
    enemyTextBlanked,
    finishScenario,
    getThreatEffect,
    groupClues,
    groupPayment,
    hasHiddenCard,
    hiddenRule,
    info,
    interrogateCultist,
    investigatorTextBlanked,
    isWeaknessCard,
    isWeaknessCode,
    leaveAsset,
    locName,
    lolaCanUseCard,
    makeRuntime,
    nextInstanceId,
    normalizedSlots,
    performTest,
    playCost,
    registeredEntry,
    removeOne,
    removeThreat,
    requestChoice,
    resolveEffect,
    runtimeCardAvailable,
    scenarioBehavior,
    scenarioRuntime,
    spawnEnemy,
    spendAction,
    spendClues,
    unique,
  })
  return createActionsExtraImpl
}
export function readyUmordhoth(...args) { return createActionsExtraApi().readyUmordhoth(...args) }
export function scenarioAssetPlayError(...args) { return createActionsExtraApi().scenarioAssetPlayError(...args) }
export function attachmentTargets(...args) { return createActionsExtraApi().attachmentTargets(...args) }
export function attachCardTo(...args) { return createActionsExtraApi().attachCardTo(...args) }
export function assetCapacityValue(...args) { return createActionsExtraApi().assetCapacityValue(...args) }
export function withEffectCode(...args) { return createActionsExtraApi().withEffectCode(...args) }
export function doDraw(...args) { return createActionsExtraApi().doDraw(...args) }
export function doResource(...args) { return createActionsExtraApi().doResource(...args) }
export function doFreeAction(...args) { return createActionsExtraApi().doFreeAction(...args) }
export function doHiddenAction(...args) { return createActionsExtraApi().doHiddenAction(...args) }
export function doParley(...args) { return createActionsExtraApi().doParley(...args) }
export function doParleyCultist(...args) { return createActionsExtraApi().doParleyCultist(...args) }
export function doParleyLita(...args) { return createActionsExtraApi().doParleyLita(...args) }
export function doDrawCultist(...args) { return createActionsExtraApi().doDrawCultist(...args) }
export function doInterruptRitual(...args) { return createActionsExtraApi().doInterruptRitual(...args) }
export function doSacrificeLita(...args) { return createActionsExtraApi().doSacrificeLita(...args) }
export function doBreakDoor(...args) { return createActionsExtraApi().doBreakDoor(...args) }
export function doDiscardThreat(...args) { return createActionsExtraApi().doDiscardThreat(...args) }
export function doPayDebt(...args) { return createActionsExtraApi().doPayDebt(...args) }
export function doPurgeThreat(...args) { return createActionsExtraApi().doPurgeThreat(...args) }
export function engagedWithMaskedHunter(...args) { return createActionsExtraApi().engagedWithMaskedHunter(...args) }
export function canSpendClues(...args) { return createActionsExtraApi().canSpendClues(...args) }
export function locationAbilityAvailable(...args) { return createActionsExtraApi().locationAbilityAvailable(...args) }
export function markLocationAbilityUsed(...args) { return createActionsExtraApi().markLocationAbilityUsed(...args) }
export function doLocationAbility(...args) { return createActionsExtraApi().doLocationAbility(...args) }
export function doSearchIzzie(...args) { return createActionsExtraApi().doSearchIzzie(...args) }
export function afterEvade(...args) { return createActionsExtraApi().afterEvade(...args) }


// ---------------------------------------------------------------------------
// createDescribeAi 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createDescribeAiImpl = null
function createDescribeAiApi() {
  createDescribeAiImpl ||= createDescribeAi({
    ...commonDeps,
    validateMove,
    INVESTIGATOR_ABILITIES,
    SKILL_NAMES,
    assetEffect,
    canAffordAbility,
    cannotTriggerFreeAbility,
    cardName,
    choiceSeats,
    controlledAbilityCards,
    groupClues,
    inHub,
    lolaCanUseCard,
    scenarioBehavior,
  })
  return createDescribeAiImpl
}
export function describePrey(...args) { return createDescribeAiApi().describePrey(...args) }
export function describeFreeAbilities(...args) { return createDescribeAiApi().describeFreeAbilities(...args) }
export function scriptActionHints(...args) { return createDescribeAiApi().scriptActionHints(...args) }
export function moveToText(...args) { return createDescribeAiApi().moveToText(...args) }
export function stripLabel(...args) { return createDescribeAiApi().stripLabel(...args) }


// ---------------------------------------------------------------------------
// createCampaignPlugin 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createCampaignPluginImpl = null
function createCampaignPluginApi() {
  createCampaignPluginImpl ||= createCampaignPlugin({
    ...commonDeps,
    doInvestigate,
    doPlay,
    CLASS_NAMES,
    EFFECTS,
    RELIC_OF_AGES_CODE,
    aliveInvestigators,
    assetReplacementPlans,
    cardDef,
    cardName,
    cardPlayFlag,
    chooseLolaRole,
    damageEnemy,
    discardLocked,
    drawEncounter,
    expeditionLeaderSeat,
    failedTestResolves,
    info,
    isPoisonThreat,
    isWeaknessCard,
    leaveAsset,
    locName,
    newCardInstance,
    normalizedSlots,
    payActionCost,
    placeLocation,
    playCost,
    poisonThreatCode,
    randomValue,
    reactionWindow,
    registeredEntry,
    relocateInvestigator,
    requestChoice,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    tokenLabel,
    triggerReaction,
    unique,
  })
  return createCampaignPluginImpl
}
export function ensureSupplies(...args) { return createCampaignPluginApi().ensureSupplies(...args) }
export function suppliesFor(...args) { return createCampaignPluginApi().suppliesFor(...args) }
export function hasSupply(...args) { return createCampaignPluginApi().hasSupply(...args) }
export function grantSupplies(...args) { return createCampaignPluginApi().grantSupplies(...args) }
export function crossOffSupply(...args) { return createCampaignPluginApi().crossOffSupply(...args) }
export function checkSupplies(...args) { return createCampaignPluginApi().checkSupplies(...args) }
export function suppliesAtLocation(...args) { return createCampaignPluginApi().suppliesAtLocation(...args) }
export function vengeancePoints(...args) { return createCampaignPluginApi().vengeancePoints(...args) }
export function recordVengeance(...args) { return createCampaignPluginApi().recordVengeance(...args) }
export function isPoisoned(...args) { return createCampaignPluginApi().isPoisoned(...args) }
export function poisonInvestigator(...args) { return createCampaignPluginApi().poisonInvestigator(...args) }
export function yigsFury(...args) { return createCampaignPluginApi().yigsFury(...args) }
export function addYigsFury(...args) { return createCampaignPluginApi().addYigsFury(...args) }
export function setExpeditionLeader(...args) { return createCampaignPluginApi().setExpeditionLeader(...args) }
export function moveRelicOfAges(...args) { return createCampaignPluginApi().moveRelicOfAges(...args) }
export function relicOfAges(...args) { return createCampaignPluginApi().relicOfAges(...args) }
export function relicOfAgesLocation(...args) { return createCampaignPluginApi().relicOfAgesLocation(...args) }
export function buildExplorationDeck(...args) { return createCampaignPluginApi().buildExplorationDeck(...args) }
export function addToExplorationDeck(...args) { return createCampaignPluginApi().addToExplorationDeck(...args) }
export function doExplore(...args) { return createCampaignPluginApi().doExplore(...args) }
export function tfaCardDrawReaction(...args) { return createCampaignPluginApi().tfaCardDrawReaction(...args) }
export function tfaFailedTestWindow(...args) { return createCampaignPluginApi().tfaFailedTestWindow(...args) }
export function carcosaPlayerEffect(...args) { return createCampaignPluginApi().carcosaPlayerEffect(...args) }
export function carcosaInvestigatorEffect(...args) { return createCampaignPluginApi().carcosaInvestigatorEffect(...args) }
export function tfaInvestigatorEffect(...args) { return createCampaignPluginApi().tfaInvestigatorEffect(...args) }
export function tfaBeforeChaosReveal(...args) { return createCampaignPluginApi().tfaBeforeChaosReveal(...args) }
export function tfaPlayCostPreview(...args) { return createCampaignPluginApi().tfaPlayCostPreview(...args) }
export function tfaApplyPlayCost(...args) { return createCampaignPluginApi().tfaApplyPlayCost(...args) }
export function tfaDiscardOnYourOwn(...args) { return createCampaignPluginApi().tfaDiscardOnYourOwn(...args) }
export function tfaBorrowedTimeTurnStart(...args) { return createCampaignPluginApi().tfaBorrowedTimeTurnStart(...args) }
export function TFA_PLAYER_WAVE3_ACTIONS(...args) { return createCampaignPluginApi().TFA_PLAYER_WAVE3_ACTIONS(...args) }
export function tfaPlayerEffect3(...args) { return createCampaignPluginApi().tfaPlayerEffect3(...args) }
export function tfaPlayerEffect(...args) { return createCampaignPluginApi().tfaPlayerEffect(...args) }
export function tfaPlayerEffectCore(...args) { return createCampaignPluginApi().tfaPlayerEffectCore(...args) }


// ---------------------------------------------------------------------------
// createTreacheryTokens 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createTreacheryTokensImpl = null
function createTreacheryTokensApi() {
  createTreacheryTokensImpl ||= createTreacheryTokens({
    ...commonDeps,
    BASIC_WEAKNESSES,
    INVESTIGATOR_ABILITIES,
    SKILL_NAMES,
    SYMBOL_DEFAULTS,
    TOKEN_LABEL,
    aliveInvestigators,
    applyDamage,
    applyHarm,
    applyHorror,
    assetEffect,
    canDiscardFromHand,
    cannotTriggerFreeAbility,
    cardDef,
    cardName,
    checkDefeated,
    chooseAmong,
    discardRandomAsset,
    disengageEnemy,
    drawCards,
    drawEncounter,
    enemyDef,
    info,
    investigatorTextBlanked,
    isWeaknessCard,
    isWeaknessCode,
    leadDecisionSeat,
    lolaCanUseCard,
    newCardInstance,
    performTest,
    placeCluesOnLocation,
    placeDoomOnCard,
    placeHiddenCard,
    privateInfo,
    randomValue,
    reactionWindow,
    relocateInvestigator,
    requestChoice,
    resolveTreacheryEffect,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    totalDoom,
  })
  return createTreacheryTokensImpl
}
export function resolveTreachery(...args) { return createTreacheryTokensApi().resolveTreachery(...args) }
export function resolveTreacheryBody(...args) { return createTreacheryTokensApi().resolveTreacheryBody(...args) }
export function nearestEnemyByTrait(...args) { return createTreacheryTokensApi().nearestEnemyByTrait(...args) }
export function applyPenalty(...args) { return createTreacheryTokensApi().applyPenalty(...args) }
export function addBasicWeakness(...args) { return createTreacheryTokensApi().addBasicWeakness(...args) }
export function drawMadnessWeakness(...args) { return createTreacheryTokensApi().drawMadnessWeakness(...args) }
export function tokenLabel(...args) { return createTreacheryTokensApi().tokenLabel(...args) }
export function applyFreeTriggers(...args) { return createTreacheryTokensApi().applyFreeTriggers(...args) }
export function ghoulsAtLocation(...args) { return createTreacheryTokensApi().ghoulsAtLocation(...args) }
export function monstersInPlay(...args) { return createTreacheryTokensApi().monstersInPlay(...args) }
export function countTokenValue(...args) { return createTreacheryTokensApi().countTokenValue(...args) }
export function resolveSpecialToken(...args) { return createTreacheryTokensApi().resolveSpecialToken(...args) }
export function drawEnemyByTrait(...args) { return createTreacheryTokensApi().drawEnemyByTrait(...args) }
export function minhCommitWildBonus(...args) { return createTreacheryTokensApi().minhCommitWildBonus(...args) }
