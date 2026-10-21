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
import { createTurnFlow } from './turn-flow.js'
import { createHiddenRules } from './hidden-rules.js'
import { createCardDefs } from './card-defs.js'
import { createCardOps } from './card-ops.js'
import { createActAgenda } from './act-agenda.js'
import { createStats } from './stats.js'
import { createAssets } from './assets.js'
import { createHarmThreat } from './harm-threat.js'
import { createTreacheryTokens } from './treachery-tokens.js'
import { createCampaignPlugin } from '../cards/campaign-plugin.js'
import { createCampaignState } from '../cards/campaign-state.js'
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

function campaignRuleCodes(campaignId) {
  return [...new Set(contentRegistry.listScenarios(campaignId).flatMap(entry => {
    const scenario = contentRegistry.getScenarioData(entry.id)
    return ['enemies', 'treacheries', 'storyAssets'].flatMap(key => Object.keys(scenario[key] || {}))
  }))]
}

// campaignId limits scenario rule cards to that campaign; states embed this
// copy, so carrying every registered campaign would exceed the save budget.


// ---------------------------------------------------------------------------
// 牌组构筑（委托 deckbuilding.js）
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// 状态创建（战役入口）
// ---------------------------------------------------------------------------






// 存档迁移用：把状态里内嵌的资源副本（卡牌定义、调查员定义、展示常量）刷新为当前版本。
// 只替换派生数据，不改变牌序、随机状态、实例编号或战役进度。
const DERIVED_STATE_KEYS = new Set(['cards', 'investigatorDefs', 'classNames', 'classColors', 'skillNames', 'tokenLabels', 'log', 'legalMoves'])
const CARD_CODE = /^\d{5}[a-z]?$/











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

const LOLA_ROLES = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral']


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


// Phase 5（5a-31）：丽塔的光环由条目级 auraWhileInPlay 声明；会让盟友文字空白化的威胁
// 通过 BLANKS_TRAITS 判断（02088 就是「清除盟友文字」的那种）。


// Phase 5（5b-8）：被动数据体可能在能力层条目上（过渡方案），布尔/数值判定统一走这里。




// 「本回合额外一次行动，只能用于探索」（04148 探险日志）。这类行动单独记账，
// 普通行动不能花掉它；探索行动优先花普通行动，不够时才动用额外行动。


// 当前这次行动的类型（由 executeAction 设置），spendAction 用它判断能否使用探索专用行动。
let currentActionKind = null


// 手牌上限：8 + 剧本修正（handSizeModifier，失落时代 P2）+ 支援/威胁修正。
// 整理阶段的弃牌、抽到超上限的判断与前端提示都走这里。


// Phase 2：事件卡的打出关键字（fast / noOpportunityAttack）有两个来源——
// 描述子（迁移后的写法）与 EFFECTS 顶层字段（旧写法）。读点在 lifecycle.playFlag，
// actionCost / actionKind 因此不需要知道卡在哪条通道上。


// ---------------------------------------------------------------------------
// Phase 2（C2）：授予类修正的引擎读点。
//
// 三件事必须走同一条读点，否则「授予」会退化成新的引擎特判：
//   effectiveTraits  卡在运行期获得的特性（供特性判定、附件目标、计数）
//   cardKeyword      卡在运行期获得的关键词（fast / noOpportunityAttack …）
//   commitIcons      卡在投入时获得的额外技能图标
// 授予只来自「这张卡自己声明的 add:*」，因此查询时带上 code（来源必须匹配）。
// ---------------------------------------------------------------------------




// 投入技能检定时的图标数：卡面图标 + 声明的 add:skillIcon。

// 当前密谋的被动（地底噬魔密谋 2：所有敌人 +1 攻击 +1 躲避）。


// 敌人不能攻击 / 不能被攻击：卡面声明（D1，entityRuleActive）优先，其次剧本钩子。
// 两个读点都在这里，避免 scenarioRuntime、敌人阶段和攻击行动各写一份判定。


// 敌人是否发动借机攻击：卡面声明（D1）与剧本钩子同一读点，避免两处各写一份。

// 敌人能否被击败：卡面/实例字段（cannotBeDefeated）优先，其次能力层声明，最后剧本钩子。

// 敌人生命值统一读点：印刷值 + 当前剧本的常驻修正（enemyStatModifier('health')）。
// 04124/04132「遗物/亚历山卓附属的敌人 +2×人数」、04140「猎物 +1×人数」等
// 都在共享/章节 behavior 里用这个分支返回修正值。









// 额外盟友槽只能由非独特盟友占用；独特盟友仍受基础 1 个槽位限制。





// ---------------------------------------------------------------------------
// 抽牌 / 抽遭遇牌
// ---------------------------------------------------------------------------







// 04318 彼端的世界：敌人要生成在无人地点、场上却没有无人地点时，从探索牌库
// 逐张揭示到地点为止，把该地点放置入场并作为生成地点，其余牌洗回探索牌库。



// Phase 5（5a-18）：「打出的事件进牌库顶而不是弃牌堆」由条目级 playedEventsToDeckTop 声明。





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








// 从收藏里随机获得一张基础弱点并洗入牌库（04165「查找收藏」）。
// 只从 BASIC_WEAKNESSES 里挑、跳过牌库里已有的同名卡；没有可选牌时给中文提示。


// 将线索放回所在地点（午夜假面 tablet / 错误指示）。






// 结算特殊标记：返回 { delta, drawAnother, onDraw:[fx], onFail:[fx] }。




const failedTestResolves = new WeakMap()
// 古代抄本：揭示前弃掉本卡，改为结算封印其上的旧印标记。







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

// 从多个合法对象中取唯一项；出现并列时按规则交给指定座位显式选择。

// 猎物（prey）目标。

function invClues(inv) {
  return inv.clues || 0
}

// 供内容层与测试查询「这只敌人的猎物是谁」：并列时由队长选择（会走待决选择）。


function spendClues(state, inv, amount) {
  if (!Number.isInteger(amount) || amount < 0 || inv.clues < amount) throw new Error('个人线索不足')
  inv.clues -= amount
  syncClues(state)
}

function groupClues(state, location) {
  return aliveInvestigators(state).filter(inv => canSpendClues(state, inv)).filter(inv => !location || inv.location === location).reduce((sum, inv) => sum + inv.clues, 0)
}




function discardEnemyCard(state, enemy) {
  disengageEnemy(state, enemy)
  removeOne(state.enemies, enemy)
  const owner = state.investigators[enemy.bearerSeat]
  if (isWeaknessCode(enemy.code) && owner) owner.discard.push(enemy.code)
  else state.encounterDiscard.push(enemy.code)
  scenarioBehavior(state).enemyDiscarded?.(state, enemy, scenarioRuntime(state, []))
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





// Only the current act's public objective; never include its unrevealed reverse.


// 场景目标判定。











// A normal investigate test without automatic clue discovery. Scenario actions
// that replace the discovery step use this so investigate bonuses, reaction
// windows and symbol handling still apply.





// 毁灭放置统一入口。剧本可以用 doomPlaced 钩子观察「每一次」放置：
//   04282 撼地之怒 / 04283 赤红深渊（密谋上）、04329 隐匿之城（异教徒敌人上）。
// 「手铐」（04265）在这里拦住非精英敌人的毁灭。


// ---------------------------------------------------------------------------
// 阶段机（神话 → 调查（3 行动）→ 敌人（猎手移动→交战→攻击）→ 重整）
// ---------------------------------------------------------------------------












// Wracked by Nightmares: "Assets you control cannot ready."

// 「残酷拷问」（04261）：威胁区域禁止抽取行动（卡实例或 threat 数据两者都认）。
// Phase 2（C1）：capability:draw 也在这里判定，两条来源共用一个读点。


// Phase 2（B2）：伤害/恐惧的分配策略。
//   'distribute'（默认）逐点询问（规则原样）
//   'self'       全部由调查员本人承受（不询问；直接伤害/恐惧的默认口径）
//   'assetsFirst'/'soakFirst' 先分给支援，溢出的部分由本人承受
//   'assetsOnly' 同 assetsFirst，但从不主动询问"由本人承受"
// 策略只影响"分给谁"，伤害/恐惧的量、时机、反应窗口完全相同——两条读点共用一份管线。








// Phase 5（5b-6）：把「从旧式 reactions 搬过来的反应描述子」翻译成旧式反应的数据形状。
// 目标不是新语义，而是**同一份结算流程**：条件、费用、上限、日志、效果解释器都与
// `EFFECTS[code].reactions` 走完全相同的代码，迁移因此只搬数据、不改行为。
//   · trigger       → when（窗口名）
//   · criteria 纯数据 → 旧式条件字段（selfOnly / nonElite / requiresClue / symbols …）
//   · cost          → 旧式费用（exhaust / uses / resources / clues / discardSelf …）
//   · limit         → 旧式上限字符串（'round' / 'phase' / 'turn'，键与旧实现一致）
//   · effect        → resolveEffect 的数据体（迁移时不改写成 resolve）

function legacyReactionLimit(limit) {
  if (!limit) return undefined
  const scope = typeof limit === 'string' ? limit : limit.scope
  if (scope === 'phase' || scope === 'perPhase') return 'phase'
  if (scope === 'turn' || scope === 'perTurn') return 'turn'
  if (scope === 'round' || scope === 'perRound') return 'round'
  return undefined
}






// 调查员被消除（败退或撤退）：解除交战，并按参考规则把线索放回所在地点。








// 「不能解除交战」类限制（失落时代 04089：半身入土）。















// ---------------------------------------------------------------------------
// 效果运行时（rt）：供 effects.js 回调引擎内部机制，避免循环依赖
// ---------------------------------------------------------------------------







function isChargeAsset(asset) {
  return ['charge', 'charges'].includes(String(asset?.usesType || '').toLowerCase())
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



function discardableHandCards(inv, requiredIcon = null) {
  return inv.hand.map((code, index) => ({ code, index })).filter(({ code }) =>
    !isWeaknessCode(code) && canDiscardFromHand(inv, code)
      && (!requiredIcon || Number(cardDef(code)?.icons?.[requiredIcon] || 0) > 0))
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
// Phase 6（战役插件化第三批）：战役专属状态字段只经这个访问器读写。
const campaignState = createCampaignState()

const commonDeps = {
  campaignState,
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
  campaignApplyPlayCost,
  campaignPlayCostPreview,
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
  campaignDiscardOnYourOwn,
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
  campaignPlayCostPreview,
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
  campaignBeforeChaosReveal,
  campaignFailedTestWindow,
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
let playerCardEffectImpl = null
function playerCardEffect(state, seat, effect, events) {
  playerCardEffectImpl ||= createPlayerEffects({
  ...commonDeps,
  doFight,
  doInvestigate,
  doPlay,
})
  return playerCardEffectImpl(state, seat, effect, events)
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
// setupApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function makeInvestigator(...args) { return setupApi().makeInvestigator(...args) } export function drawOpeningHand(...args) { return setupApi().drawOpeningHand(...args) } export function buildInvestigatorsDeck(...args) { return setupApi().buildInvestigatorsDeck(...args) }
export function prepareInvestigator(...args) { return setupApi().prepareInvestigator(...args) } export function refreshStateResources(...args) { return setupApi().refreshStateResources(...args) } export function unknownCardCodes(...args) { return setupApi().unknownCardCodes(...args) }
export function createGameState(...args) { return setupApi().createGameState(...args) } export function pickAiInvestigator(...args) { return setupApi().pickAiInvestigator(...args) } export function startScenario(...args) { return setupApi().startScenario(...args) }
export function scenarioStartLocation(...args) { return setupApi().scenarioStartLocation(...args) } export function setupScenarioLocations(...args) { return setupApi().setupScenarioLocations(...args) } export function setupScenarioEnemies(...args) { return setupApi().setupScenarioEnemies(...args) }
export function setupScenarioDecks(...args) { return setupApi().setupScenarioDecks(...args) } export function setupChaosBag(...args) { return setupApi().setupChaosBag(...args) }

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
// dispatchApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function applyMove(...args) { return dispatchApi().applyMove(...args) } export function executeCommand(...args) { return dispatchApi().executeCommand(...args) } export function executeAction(...args) { return dispatchApi().executeAction(...args) }
export function executeHubMove(...args) { return dispatchApi().executeHubMove(...args) } export function applyMoveUnchecked(...args) { return dispatchApi().applyMoveUnchecked(...args) }

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
// encounterApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function drawEncounter(...args) { return encounterApi().drawEncounter(...args) } export function reactionWindow(...args) { return encounterApi().reactionWindow(...args) } export function triggerReaction(...args) { return encounterApi().triggerReaction(...args) }
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
// movementApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function stepToward(...args) { return movementApi().stepToward(...args) } export function distanceToInvestigator(...args) { return movementApi().distanceToInvestigator(...args) } export function investigatorMoveDestinations(...args) { return movementApi().investigatorMoveDestinations(...args) }
export function moveInvestigatorTo(...args) { return movementApi().moveInvestigatorTo(...args) } export function doShortcutMove(...args) { return movementApi().doShortcutMove(...args) } export function doMove(...args) { return movementApi().doMove(...args) }
export function relocateInvestigator(...args) { return movementApi().relocateInvestigator(...args) } export function relocateEnemy(...args) { return movementApi().relocateEnemy(...args) }

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
// enemiesApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function enemyHealth(...args) { return enemiesApi().enemyHealth(...args) } export function enemyFightValue(...args) { return enemiesApi().enemyFightValue(...args) } export function enemyEvadeValue(...args) { return enemiesApi().enemyEvadeValue(...args) }
export function enemiesEngagedWith(...args) { return enemiesApi().enemiesEngagedWith(...args) } export function enemyAttack(...args) { return enemiesApi().enemyAttack(...args) } export function spawnEnemy(...args) { return enemiesApi().spawnEnemy(...args) }
export function engageEnemy(...args) { return enemiesApi().engageEnemy(...args) } export function disengageEnemy(...args) { return enemiesApi().disengageEnemy(...args) } export function defeatEnemy(...args) { return enemiesApi().defeatEnemy(...args) }
export function damageEnemy(...args) { return enemiesApi().damageEnemy(...args) } export function autoEvadeEnemy(...args) { return enemiesApi().autoEvadeEnemy(...args) } export function applyHarm(...args) { return enemiesApi().applyHarm(...args) }
export function defeatedAssetRetaliation(...args) { return enemiesApi().defeatedAssetRetaliation(...args) } export function applyDamage(...args) { return enemiesApi().applyDamage(...args) } export function applyHorror(...args) { return enemiesApi().applyHorror(...args) }

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
// locationsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function locName(...args) { return locationsApi().locName(...args) } export function placeLocation(...args) { return locationsApi().placeLocation(...args) } export function flipScenarioLocation(...args) { return locationsApi().flipScenarioLocation(...args) }
export function revealLocation(...args) { return locationsApi().revealLocation(...args) } export function removeLocation(...args) { return locationsApi().removeLocation(...args) } export function syncClues(...args) { return locationsApi().syncClues(...args) }
export function placeCluesOnLocation(...args) { return locationsApi().placeCluesOnLocation(...args) } export function notifyCluesRemoved(...args) { return locationsApi().notifyCluesRemoved(...args) } export function discoverClueAt(...args) { return locationsApi().discoverClueAt(...args) }
export function awardLocationVictory(...args) { return locationsApi().awardLocationVictory(...args) }

// Phase 6（6d-24）：检定的效果侧搬进 skill-effects.js；惰性装配保持导出与调用点。
let skillEffectsImpl = null
function skillEffectsApi() {
  skillEffectsImpl ||= createSkillEffects({
    tfaInvestigatorEffect,
    carcosaPlayerEffect,
    carcosaInvestigatorEffect,
    campaignPlayerEffect,
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
  playerCardEffect,
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
})
  return skillEffectsImpl
}
// skillEffectsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function applyTokenFx(...args) { return skillEffectsApi().applyTokenFx(...args) } export function applySkillOnSuccess(...args) { return skillEffectsApi().applySkillOnSuccess(...args) } export function makeRuntime(...args) { return skillEffectsApi().makeRuntime(...args) }

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
  campaignBorrowedTimeTurnStart,
  useGoldPocketWatch,
})
  return turnImpl
}
// turnApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function runMythos(...args) { return turnApi().runMythos(...args) } export function enemyPhase(...args) { return turnApi().enemyPhase(...args) } export function hunterStep(...args) { return turnApi().hunterStep(...args) }
export function runLocationRoundEnd(...args) { return turnApi().runLocationRoundEnd(...args) } export function runEnemyRoundEnd(...args) { return turnApi().runEnemyRoundEnd(...args) } export function runThreatEndTurn(...args) { return turnApi().runThreatEndTurn(...args) }
export function phaseBeginningWindow(...args) { return turnApi().phaseBeginningWindow(...args) } export function turnBeginningWindow(...args) { return turnApi().turnBeginningWindow(...args) } export function beginInvestigationPhase(...args) { return turnApi().beginInvestigationPhase(...args) }
export function runBetweenInvestigationPhases(...args) { return turnApi().runBetweenInvestigationPhases(...args) } export function doEndTurn(...args) { return turnApi().doEndTurn(...args) }

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
// revealApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function resolveTreacheryEffect(...args) { return revealApi().resolveTreacheryEffect(...args) } export function runActReveal(...args) { return revealApi().runActReveal(...args) } export function runAgendaForced(...args) { return revealApi().runAgendaForced(...args) }
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
    info,
    isWeaknessCard,
    leaveAsset,
    newPlayerAssetInstance,
    randomValue,
    registeredEntry,
    requestChoice,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    triggerReaction,
    describeCardMove,
    describeLook,
    describeSearch,
    discardLocked,
    findZoneCard,
    isThreatWeakness,
    normalizeCardMove,
    normalizeLookOptions,
    normalizeSearchOptions,
    removeThreat,
    resolveWeakness,
    campaignCardDrawReaction,
    weaknessProfile,
  })
  return deckOpsImpl
}
// deckOpsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function lookZoneAdapter(...args) { return deckOpsApi().lookZoneAdapter(...args) } export function lookAt(...args) { return deckOpsApi().lookAt(...args) } export function scryDeck(...args) { return deckOpsApi().scryDeck(...args) }
export function searchDeck(...args) { return deckOpsApi().searchDeck(...args) } export function moveCardTo(...args) { return deckOpsApi().moveCardTo(...args) } export function drawCards(...args) { return deckOpsApi().drawCards(...args) }
export function discardRandomFromHand(...args) { return deckOpsApi().discardRandomFromHand(...args) } export function removeOne(...args) { return deckOpsApi().removeOne(...args) } export function removeCardByCode(...args) { return deckOpsApi().removeCardByCode(...args) }

// Phase 6（6d-29）：战役台面与幕间搬进 hub.js；惰性装配保持导出与调用点。
let hubImpl = null
function hubApi() {
  hubImpl ||= createHub({
    aliveInvestigators,
    campaignFor,
    cardName,
    info,
    randomValue,
    requestChoice,
    shuffle,
    ALL_CARDS,
    ALL_ENEMIES,
    ALL_INVESTIGATORS,
    ALL_STORY_ASSETS,
    ALL_TREACHERIES,
    HUB_DIFFICULTIES,
    LITA_CHANDLER_CODE,
    SCENARIOS,
    actingSeats,
    applyCampaignEffect,
    availablePurchases,
    buildDeck,
    campaignCardChange,
    campaignEnding,
    campaignManifestFor,
    decisionSeat,
    hubInvestigatorChoices,
    hubStartingDeckReady,
    initialHubPreparation,
    initialHubScenarioMoves,
    makeInvestigator,
    progressCampaign,
    purchaseCard,
    registerCampaignInvestigator,
    replacementCandidates,
    replacementOptions,
    resolutionCheckpoint,
    upgradeRecord,
    walkCampaign,
  })
  return hubImpl
}
// hubApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function registerCampaignScenarios(...args) { return hubApi().registerCampaignScenarios(...args) } export function addLitaToCampaign(...args) { return hubApi().addLitaToCampaign(...args) } export function runInterlude(...args) { return hubApi().runInterlude(...args) }
export function endCampaign(...args) { return hubApi().endCampaign(...args) } export function firstAliveSeat(...args) { return hubApi().firstAliveSeat(...args) } export function leadDecisionSeat(...args) { return hubApi().leadDecisionSeat(...args) }
export function nextSeat(...args) { return hubApi().nextSeat(...args) } export function chooseTurn(...args) { return hubApi().chooseTurn(...args) } export function expeditionLeaderSeat(...args) { return hubApi().expeditionLeaderSeat(...args) }
export function selectInitialHubScenario(...args) { return hubApi().selectInitialHubScenario(...args) } export function hubLegalMoves(...args) { return hubApi().hubLegalMoves(...args) }


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
    controlledAbilityCards,
    costIsDynamic,
    describeCost,
    discardChosenCards,
    discardableHandCards,
    effectAbilitySources,
    hasNonPlayerBehavior,
    hiddenFightBlocked,
    limitUsed,
    normalizeCostValues,
    openAbilityWindow,
    scenarioResignAvailable,
  })
  return createAbilityRulesImpl
}
// createAbilityRulesApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function payAbilityCost(...args) { return createAbilityRulesApi().payAbilityCost(...args) } export function descriptorCost(...args) { return createAbilityRulesApi().descriptorCost(...args) } export function descriptorUsable(...args) { return createAbilityRulesApi().descriptorUsable(...args) }
export function descriptorSources(...args) { return createAbilityRulesApi().descriptorSources(...args) } export function entityAbilityEntry(...args) { return createAbilityRulesApi().entityAbilityEntry(...args) } export function nonPlayerAbilitySources(...args) { return createAbilityRulesApi().nonPlayerAbilitySources(...args) }
export function canAffordAbility(...args) { return createAbilityRulesApi().canAffordAbility(...args) } export function abilityTargets(...args) { return createAbilityRulesApi().abilityTargets(...args) } export function applyAbilityTarget(...args) { return createAbilityRulesApi().applyAbilityTarget(...args) }
export function costPreviewSuffix(...args) { return createAbilityRulesApi().costPreviewSuffix(...args) }


// ---------------------------------------------------------------------------
// createTableDecisions 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createTableDecisionsImpl = null
function createTableDecisionsApi() {
  createTableDecisionsImpl ||= createTableDecisions({
    ...commonDeps,
    legalMoves,
    ALL_INVESTIGATORS,
    HUB_SEAT_ACTIONS,
    PLAYABLE_INVESTIGATORS,
    actionCost,
    assetPassiveData,
    buildDeckFromList,
    campaignGraph,
    campaignManifestFor,
    cardPlayFlag,
    choiceSeats,
    chooseLolaRole,
    chooseTurn,
    corePlayerPool,
    drawOpeningHand,
    enemyCanOpportunityAttack,
    groupClues,
    hubConcurrentPhase,
    hubLegalMoves,
    hubPendingSeats,
    phaseBeginningWindow,
    turnBeginningWindow,
  })
  return createTableDecisionsImpl
}
// createTableDecisionsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function validateHubMove(...args) { return createTableDecisionsApi().validateHubMove(...args) } export function autoHubMove(...args) { return createTableDecisionsApi().autoHubMove(...args) } export function decisionSeed(...args) { return createTableDecisionsApi().decisionSeed(...args) }
export function moveCost(...args) { return createTableDecisionsApi().moveCost(...args) } export function cardPlayBlockedReason(...args) { return createTableDecisionsApi().cardPlayBlockedReason(...args) } export function actionKind(...args) { return createTableDecisionsApi().actionKind(...args) }
export function actionPreview(...args) { return createTableDecisionsApi().actionPreview(...args) } export function consumeStartingAdjustments(...args) { return createTableDecisionsApi().consumeStartingAdjustments(...args) } export function consumeMulliganBlock(...args) { return createTableDecisionsApi().consumeMulliganBlock(...args) }
export function runMulligans(...args) { return createTableDecisionsApi().runMulligans(...args) } export function useGoldPocketWatch(...args) { return createTableDecisionsApi().useGoldPocketWatch(...args) } export function resolveCallOfTheUnknown(...args) { return createTableDecisionsApi().resolveCallOfTheUnknown(...args) }
export function hubStartingDeckReady(...args) { return createTableDecisionsApi().hubStartingDeckReady(...args) } export function initialHubScenarioMoves(...args) { return createTableDecisionsApi().initialHubScenarioMoves(...args) } export function hubInvestigatorChoices(...args) { return createTableDecisionsApi().hubInvestigatorChoices(...args) }
export function initialHubPreparation(...args) { return createTableDecisionsApi().initialHubPreparation(...args) } export function hubActingSeats(...args) { return createTableDecisionsApi().hubActingSeats(...args) } export function decisionSeat(...args) { return createTableDecisionsApi().decisionSeat(...args) }
export function actingSeats(...args) { return createTableDecisionsApi().actingSeats(...args) } export function seatLocalMove(...args) { return createTableDecisionsApi().seatLocalMove(...args) } export function jakeSkipsOpportunityAttack(...args) { return createTableDecisionsApi().jakeSkipsOpportunityAttack(...args) }
export function canUseExtraEvade(...args) { return createTableDecisionsApi().canUseExtraEvade(...args) } export function abilityOfMove(...args) { return createTableDecisionsApi().abilityOfMove(...args) }


// ---------------------------------------------------------------------------
// createActionsExtra 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createActionsExtraImpl = null
function createActionsExtraApi() {
  createActionsExtraImpl ||= createActionsExtra({
    ...commonDeps,
    applyMove,
    executeAction,
    LITA_CHANDLER_CODE,
    SEARCHING_FOR_IZZIE_CODE,
    activeHiddenRules,
    assetReplacementPlans,
    campaignCardChange,
    canEquip,
    cardHasTrait,
    discardChosenCards,
    discardHiddenCard,
    effectiveTraits,
    groupClues,
    groupPayment,
    hasHiddenCard,
    hiddenRule,
    interrogateCultist,
    nextInstanceId,
    normalizedSlots,
    removeThreat,
  })
  return createActionsExtraImpl
}
// createActionsExtraApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function readyUmordhoth(...args) { return createActionsExtraApi().readyUmordhoth(...args) } export function scenarioAssetPlayError(...args) { return createActionsExtraApi().scenarioAssetPlayError(...args) } export function attachmentTargets(...args) { return createActionsExtraApi().attachmentTargets(...args) }
export function attachCardTo(...args) { return createActionsExtraApi().attachCardTo(...args) } export function assetCapacityValue(...args) { return createActionsExtraApi().assetCapacityValue(...args) } export function withEffectCode(...args) { return createActionsExtraApi().withEffectCode(...args) }
export function doDraw(...args) { return createActionsExtraApi().doDraw(...args) } export function doResource(...args) { return createActionsExtraApi().doResource(...args) } export function doFreeAction(...args) { return createActionsExtraApi().doFreeAction(...args) }
export function doHiddenAction(...args) { return createActionsExtraApi().doHiddenAction(...args) } export function doParley(...args) { return createActionsExtraApi().doParley(...args) } export function doParleyCultist(...args) { return createActionsExtraApi().doParleyCultist(...args) }
export function doParleyLita(...args) { return createActionsExtraApi().doParleyLita(...args) } export function doDrawCultist(...args) { return createActionsExtraApi().doDrawCultist(...args) } export function doInterruptRitual(...args) { return createActionsExtraApi().doInterruptRitual(...args) }
export function doSacrificeLita(...args) { return createActionsExtraApi().doSacrificeLita(...args) } export function doBreakDoor(...args) { return createActionsExtraApi().doBreakDoor(...args) } export function doDiscardThreat(...args) { return createActionsExtraApi().doDiscardThreat(...args) }
export function doPayDebt(...args) { return createActionsExtraApi().doPayDebt(...args) } export function doPurgeThreat(...args) { return createActionsExtraApi().doPurgeThreat(...args) } export function engagedWithMaskedHunter(...args) { return createActionsExtraApi().engagedWithMaskedHunter(...args) }
export function canSpendClues(...args) { return createActionsExtraApi().canSpendClues(...args) } export function locationAbilityAvailable(...args) { return createActionsExtraApi().locationAbilityAvailable(...args) } export function markLocationAbilityUsed(...args) { return createActionsExtraApi().markLocationAbilityUsed(...args) }
export function doLocationAbility(...args) { return createActionsExtraApi().doLocationAbility(...args) } export function doSearchIzzie(...args) { return createActionsExtraApi().doSearchIzzie(...args) } export function afterEvade(...args) { return createActionsExtraApi().afterEvade(...args) }


// ---------------------------------------------------------------------------
// createDescribeAi 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createDescribeAiImpl = null
function createDescribeAiApi() {
  createDescribeAiImpl ||= createDescribeAi({
    ...commonDeps,
    validateMove,
    canAffordAbility,
    cannotTriggerFreeAbility,
    choiceSeats,
    controlledAbilityCards,
    groupClues,
  })
  return createDescribeAiImpl
}
// createDescribeAiApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function describePrey(...args) { return createDescribeAiApi().describePrey(...args) } export function describeFreeAbilities(...args) { return createDescribeAiApi().describeFreeAbilities(...args) } export function scriptActionHints(...args) { return createDescribeAiApi().scriptActionHints(...args) }
export function moveToText(...args) { return createDescribeAiApi().moveToText(...args) } export function stripLabel(...args) { return createDescribeAiApi().stripLabel(...args) }


// ---------------------------------------------------------------------------
// createCampaignPlugin 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createCampaignPluginImpl = null
function createCampaignPluginApi() {
  createCampaignPluginImpl ||= createCampaignPlugin({
    ...commonDeps,
    doInvestigate,
    doPlay,
    RELIC_OF_AGES_CODE,
    assetReplacementPlans,
    cardPlayFlag,
    chooseLolaRole,
    discardLocked,
    expeditionLeaderSeat,
    failedTestResolves,
    isPoisonThreat,
    normalizedSlots,
    payActionCost,
    poisonThreatCode,
  })
  return createCampaignPluginImpl
}
// createCampaignPluginApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function ensureSupplies(...args) { return createCampaignPluginApi().ensureSupplies(...args) } export function suppliesFor(...args) { return createCampaignPluginApi().suppliesFor(...args) } export function hasSupply(...args) { return createCampaignPluginApi().hasSupply(...args) }
export function grantSupplies(...args) { return createCampaignPluginApi().grantSupplies(...args) } export function crossOffSupply(...args) { return createCampaignPluginApi().crossOffSupply(...args) } export function checkSupplies(...args) { return createCampaignPluginApi().checkSupplies(...args) }
export function suppliesAtLocation(...args) { return createCampaignPluginApi().suppliesAtLocation(...args) } export function vengeancePoints(...args) { return createCampaignPluginApi().vengeancePoints(...args) } export function recordVengeance(...args) { return createCampaignPluginApi().recordVengeance(...args) }
export function isPoisoned(...args) { return createCampaignPluginApi().isPoisoned(...args) } export function poisonInvestigator(...args) { return createCampaignPluginApi().poisonInvestigator(...args) } export function yigsFury(...args) { return createCampaignPluginApi().yigsFury(...args) }
export function addYigsFury(...args) { return createCampaignPluginApi().addYigsFury(...args) } export function setExpeditionLeader(...args) { return createCampaignPluginApi().setExpeditionLeader(...args) } export function moveRelicOfAges(...args) { return createCampaignPluginApi().moveRelicOfAges(...args) }
export function relicOfAges(...args) { return createCampaignPluginApi().relicOfAges(...args) } export function relicOfAgesLocation(...args) { return createCampaignPluginApi().relicOfAgesLocation(...args) } export function buildExplorationDeck(...args) { return createCampaignPluginApi().buildExplorationDeck(...args) }
export function addToExplorationDeck(...args) { return createCampaignPluginApi().addToExplorationDeck(...args) } export function doExplore(...args) { return createCampaignPluginApi().doExplore(...args) } export function campaignPlayCostPreview(...args) { return createCampaignPluginApi().campaignPlayCostPreview(...args) } export function campaignCardDrawReaction(...args) { return createCampaignPluginApi().campaignCardDrawReaction(...args) }
export function campaignFailedTestWindow(...args) { return createCampaignPluginApi().campaignFailedTestWindow(...args) } 
export function campaignApplyPlayCost(...args) { return createCampaignPluginApi().campaignApplyPlayCost(...args) } export function campaignDiscardOnYourOwn(...args) { return createCampaignPluginApi().campaignDiscardOnYourOwn(...args) } export function campaignBorrowedTimeTurnStart(...args) { return createCampaignPluginApi().campaignBorrowedTimeTurnStart(...args) }
export function campaignBeforeChaosReveal(...args) { return createCampaignPluginApi().campaignBeforeChaosReveal(...args) } export function carcosaPlayerEffect(...args) { return createCampaignPluginApi().carcosaPlayerEffect(...args) } export function carcosaInvestigatorEffect(...args) { return createCampaignPluginApi().carcosaInvestigatorEffect(...args) } export function tfaInvestigatorEffect(...args) { return createCampaignPluginApi().tfaInvestigatorEffect(...args) } export function tfaPlayerEffect(...args) { return createCampaignPluginApi().tfaPlayerEffect(...args) } export function campaignPlayerEffect(...args) { return createCampaignPluginApi().campaignPlayerEffect(...args) }


// ---------------------------------------------------------------------------
// createTreacheryTokens 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createTreacheryTokensImpl = null
function createTreacheryTokensApi() {
  createTreacheryTokensImpl ||= createTreacheryTokens({
    ...commonDeps,
    BASIC_WEAKNESSES,
    SYMBOL_DEFAULTS,
    TOKEN_LABEL,
    cannotTriggerFreeAbility,
    chooseAmong,
    discardRandomAsset,
    placeCluesOnLocation,
    placeHiddenCard,
    privateInfo,
    resolveTreacheryEffect,
    totalDoom,
  })
  return createTreacheryTokensImpl
}
// createTreacheryTokensApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function resolveTreachery(...args) { return createTreacheryTokensApi().resolveTreachery(...args) } export function resolveTreacheryBody(...args) { return createTreacheryTokensApi().resolveTreacheryBody(...args) } export function nearestEnemyByTrait(...args) { return createTreacheryTokensApi().nearestEnemyByTrait(...args) }
export function applyPenalty(...args) { return createTreacheryTokensApi().applyPenalty(...args) } export function addBasicWeakness(...args) { return createTreacheryTokensApi().addBasicWeakness(...args) } export function drawMadnessWeakness(...args) { return createTreacheryTokensApi().drawMadnessWeakness(...args) }
export function tokenLabel(...args) { return createTreacheryTokensApi().tokenLabel(...args) } export function applyFreeTriggers(...args) { return createTreacheryTokensApi().applyFreeTriggers(...args) } export function ghoulsAtLocation(...args) { return createTreacheryTokensApi().ghoulsAtLocation(...args) }
export function monstersInPlay(...args) { return createTreacheryTokensApi().monstersInPlay(...args) } export function countTokenValue(...args) { return createTreacheryTokensApi().countTokenValue(...args) } export function resolveSpecialToken(...args) { return createTreacheryTokensApi().resolveSpecialToken(...args) }
export function drawEnemyByTrait(...args) { return createTreacheryTokensApi().drawEnemyByTrait(...args) } export function minhCommitWildBonus(...args) { return createTreacheryTokensApi().minhCommitWildBonus(...args) }


// ---------------------------------------------------------------------------
// createHarmThreat 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createHarmThreatImpl = null
function createHarmThreatApi() {
  createHarmThreatImpl ||= createHarmThreat({
    ...commonDeps,
    ALL_TREACHERIES,
    activeHiddenRules,
    all,
    assetCapacityValue,
    assetPassiveData,
    captureTableState,
    chooseInvestigator,
    discardHiddenCard,
    doInvestigate,
    enemyHealth,
    investigateBonus,
    placeCluesOnLocation,
    weaknessProfile,
  })
  return createHarmThreatImpl
}
// createHarmThreatApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function hasTomeAsset(...args) { return createHarmThreatApi().hasTomeAsset(...args) } export function getThreatEffect(...args) { return createHarmThreatApi().getThreatEffect(...args) } export function availableThreatAbilities(...args) { return createHarmThreatApi().availableThreatAbilities(...args) }
export function assetsCannotReady(...args) { return createHarmThreatApi().assetsCannotReady(...args) } export function drawBlocked(...args) { return createHarmThreatApi().drawBlocked(...args) } export function removeThreat(...args) { return createHarmThreatApi().removeThreat(...args) }
export function HARM_STRATEGIES(...args) { return createHarmThreatApi().HARM_STRATEGIES(...args) } export function assignHarm(...args) { return createHarmThreatApi().assignHarm(...args) } export function triggerThreatForced(...args) { return createHarmThreatApi().triggerThreatForced(...args) }
export function applyThreatForced(...args) { return createHarmThreatApi().applyThreatForced(...args) } export function unpaidExtraActionThreats(...args) { return createHarmThreatApi().unpaidExtraActionThreats(...args) } export function payActionCost(...args) { return createHarmThreatApi().payActionCost(...args) }
export function defeatAll(...args) { return createHarmThreatApi().defeatAll(...args) } export function eliminateInvestigator(...args) { return createHarmThreatApi().eliminateInvestigator(...args) } export function checkDefeated(...args) { return createHarmThreatApi().checkDefeated(...args) }
export function checkOutcome(...args) { return createHarmThreatApi().checkOutcome(...args) } export function disengageAll(...args) { return createHarmThreatApi().disengageAll(...args) } export function canDisengage(...args) { return createHarmThreatApi().canDisengage(...args) }
export function targetedTest(...args) { return createHarmThreatApi().targetedTest(...args) } export function investigateForResources(...args) { return createHarmThreatApi().investigateForResources(...args) } export function dealDamageAll(...args) { return createHarmThreatApi().dealDamageAll(...args) }
export function dealDamageExhausted(...args) { return createHarmThreatApi().dealDamageExhausted(...args) } export function blankEnemy(...args) { return createHarmThreatApi().blankEnemy(...args) } export function ignoreChaos(...args) { return createHarmThreatApi().ignoreChaos(...args) }
export function returnAssetToHand(...args) { return createHarmThreatApi().returnAssetToHand(...args) } export function shuffleIntoEncounter(...args) { return createHarmThreatApi().shuffleIntoEncounter(...args) } export function moveHorrorToInvestigator(...args) { return createHarmThreatApi().moveHorrorToInvestigator(...args) }
export function damagedTargetsAtLocation(...args) { return createHarmThreatApi().damagedTargetsAtLocation(...args) } export function healDamageAtLocation(...args) { return createHarmThreatApi().healDamageAtLocation(...args) } export function recordResearch(...args) { return createHarmThreatApi().recordResearch(...args) }
export function researchSolution(...args) { return createHarmThreatApi().researchSolution(...args) } export function healHorrorNearby(...args) { return createHarmThreatApi().healHorrorNearby(...args) } export function dukeInvestigate(...args) { return createHarmThreatApi().dukeInvestigate(...args) }


// ---------------------------------------------------------------------------
// createAssets 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createAssetsImpl = null
function createAssetsApi() {
  createAssetsImpl ||= createAssets({
    ...commonDeps,
    SLOT_CAPACITY,
    blanksTraits,
    distanceToInvestigator,
    leavesPlayEffect,
    nextInstanceId,
    releaseChaosTokens,
    removeEffectsFromSource,
    slotBonus,
    weaknessProfile,
    withEffectCode,
  })
  return createAssetsImpl
}
// createAssetsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function litaAuraAt(...args) { return createAssetsApi().litaAuraAt(...args) } export function assetPassiveBonus(...args) { return createAssetsApi().assetPassiveBonus(...args) } export function assetPassiveData(...args) { return createAssetsApi().assetPassiveData(...args) }
export function assetCannotLeavePlay(...args) { return createAssetsApi().assetCannotLeavePlay(...args) } export function normalizedSlots(...args) { return createAssetsApi().normalizedSlots(...args) } export function slotUsage(...args) { return createAssetsApi().slotUsage(...args) }
export function canEquip(...args) { return createAssetsApi().canEquip(...args) } export function assetReplacementPlans(...args) { return createAssetsApi().assetReplacementPlans(...args) } export function replaceAssets(...args) { return createAssetsApi().replaceAssets(...args) }
export function nonUniqueAllySlotsFor(...args) { return createAssetsApi().nonUniqueAllySlotsFor(...args) } export function allySlotsOk(...args) { return createAssetsApi().allySlotsOk(...args) } export function isTomeCard(...args) { return createAssetsApi().isTomeCard(...args) }
export function handSlotsBonusFor(...args) { return createAssetsApi().handSlotsBonusFor(...args) } export function isWeaponCard(...args) { return createAssetsApi().isWeaponCard(...args) } export function weaponHandSlotsFor(...args) { return createAssetsApi().weaponHandSlotsFor(...args) }
export function isThreatWeakness(...args) { return createAssetsApi().isThreatWeakness(...args) } export function leaveAsset(...args) { return createAssetsApi().leaveAsset(...args) } export function discardRandomAsset(...args) { return createAssetsApi().discardRandomAsset(...args) }
export function placeLocationForEmptySpawn(...args) { return createAssetsApi().placeLocationForEmptySpawn(...args) } export function farthestLocationsFor(...args) { return createAssetsApi().farthestLocationsFor(...args) } export function discardLocked(...args) { return createAssetsApi().discardLocked(...args) }
export function hasPlayedEventsToDeckTop(...args) { return createAssetsApi().hasPlayedEventsToDeckTop(...args) } export function topDiscardEvent(...args) { return createAssetsApi().topDiscardEvent(...args) } export function disposePlayedEvent(...args) { return createAssetsApi().disposePlayedEvent(...args) }
export function consumePlayThreatResources(...args) { return createAssetsApi().consumePlayThreatResources(...args) } export function playReactionCard(...args) { return createAssetsApi().playReactionCard(...args) }


// ---------------------------------------------------------------------------
// createStats 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createStatsImpl = null
function createStatsApi() {
  createStatsImpl ||= createStats({
    ...commonDeps,
    doPlay,
    HAND_SIZE_BASE,
    LOLA_ROLES,
    abilityShim,
    agendaHandSizePenalty,
    applyFreeTriggers,
    assetPassiveBonus,
    blanksTraits,
    collectGrants,
    doAbility,
    isCardAvailable,
    legalMoves,
    playFlag,
    statPipeline,
  })
  return createStatsImpl
}
// createStatsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function assetEffect(...args) { return createStatsApi().assetEffect(...args) } export function controlledAbilityCards(...args) { return createStatsApi().controlledAbilityCards(...args) } export function controlledAbilityCard(...args) { return createStatsApi().controlledAbilityCard(...args) }
export function lolaCanUseCard(...args) { return createStatsApi().lolaCanUseCard(...args) } export function chooseLolaRole(...args) { return createStatsApi().chooseLolaRole(...args) } export function runtimeCardAvailable(...args) { return createStatsApi().runtimeCardAvailable(...args) }
export function getStat(...args) { return createStatsApi().getStat(...args) } export function getMaxHealth(...args) { return createStatsApi().getMaxHealth(...args) } export function getMaxSanity(...args) { return createStatsApi().getMaxSanity(...args) }
export function extraActionBonus(...args) { return createStatsApi().extraActionBonus(...args) } export function exploreOnlyActionBonus(...args) { return createStatsApi().exploreOnlyActionBonus(...args) } export function normalActionsLeft(...args) { return createStatsApi().normalActionsLeft(...args) }
export function investigateBonus(...args) { return createStatsApi().investigateBonus(...args) } export function handSize(...args) { return createStatsApi().handSize(...args) } export function getHandSize(...args) { return createStatsApi().getHandSize(...args) }
export function cardPlayFlag(...args) { return createStatsApi().cardPlayFlag(...args) } export function iconValue(...args) { return createStatsApi().iconValue(...args) } export function effectiveTraits(...args) { return createStatsApi().effectiveTraits(...args) }
export function cardHasTrait(...args) { return createStatsApi().cardHasTrait(...args) } export function cardKeyword(...args) { return createStatsApi().cardKeyword(...args) } export function commitIcons(...args) { return createStatsApi().commitIcons(...args) }
export function enemyStatMods(...args) { return createStatsApi().enemyStatMods(...args) }


// ---------------------------------------------------------------------------
// createActAgenda 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createActAgendaImpl = null
function createActAgendaApi() {
  createActAgendaImpl ||= createActAgenda({
    ...commonDeps,
    ALL_STORY_ASSETS,
    agendaDoom,
    groupClues,
    groupPayment,
    investigateBonus,
    preyTarget,
    runActReveal,
    runAgendaReveal,
    startScenario,
  })
  return createActAgendaImpl
}
// createActAgendaApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function advanceAct(...args) { return createActAgendaApi().advanceAct(...args) } export function discardUntilEnemy(...args) { return createActAgendaApi().discardUntilEnemy(...args) } export function canAdvanceWithClues(...args) { return createActAgendaApi().canAdvanceWithClues(...args) }
export function actObjectiveContext(...args) { return createActAgendaApi().actObjectiveContext(...args) } export function payAndAdvanceAct(...args) { return createActAgendaApi().payAndAdvanceAct(...args) } export function checkAct(...args) { return createActAgendaApi().checkAct(...args) }
export function locationRevealCue(...args) { return createActAgendaApi().locationRevealCue(...args) } export function spawnStoryAsset(...args) { return createActAgendaApi().spawnStoryAsset(...args) } export function advanceAgenda(...args) { return createActAgendaApi().advanceAgenda(...args) }
export function maskedHunterPrey(...args) { return createActAgendaApi().maskedHunterPrey(...args) } export function discardUntilEnemyFromEncounter(...args) { return createActAgendaApi().discardUntilEnemyFromEncounter(...args) } export function investigateTest(...args) { return createActAgendaApi().investigateTest(...args) }
export function discardUntilEnemyTrait(...args) { return createActAgendaApi().discardUntilEnemyTrait(...args) } export function checkAgenda(...args) { return createActAgendaApi().checkAgenda(...args) } export function checkAgendaForcedEnemyDefeated(...args) { return createActAgendaApi().checkAgendaForcedEnemyDefeated(...args) }
export function placeDoomOnCard(...args) { return createActAgendaApi().placeDoomOnCard(...args) } export function addDoom(...args) { return createActAgendaApi().addDoom(...args) }


// ---------------------------------------------------------------------------
// createCardOps 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createCardOpsImpl = null
function createCardOpsApi() {
  createCardOpsImpl ||= createCardOps({
    ...commonDeps,
    searchDeck,
    afterEvade,
    describePrey,
    discardLocked,
    disposePlayedEvent,
    invClues,
    remainingHealth,
  })
  return createCardOpsImpl
}
// createCardOpsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function PREY_RANK(...args) { return createCardOpsApi().PREY_RANK(...args) } export function chooseAmong(...args) { return createCardOpsApi().chooseAmong(...args) } export function preyTarget(...args) { return createCardOpsApi().preyTarget(...args) }
export function preySeatForTest(...args) { return createCardOpsApi().preySeatForTest(...args) } export function searchDiscard(...args) { return createCardOpsApi().searchDiscard(...args) } export function autoEvadeNonElite(...args) { return createCardOpsApi().autoEvadeNonElite(...args) }
export function attachBarricade(...args) { return createCardOpsApi().attachBarricade(...args) } export function discardBarricades(...args) { return createCardOpsApi().discardBarricades(...args) } export function findZoneCard(...args) { return createCardOpsApi().findZoneCard(...args) }
export function chooseInvestigator(...args) { return createCardOpsApi().chooseInvestigator(...args) } export function searchTop(...args) { return createCardOpsApi().searchTop(...args) } export function refillAsset(...args) { return createCardOpsApi().refillAsset(...args) }
export function reloadAmmo(...args) { return createCardOpsApi().reloadAmmo(...args) } export function defeatNonEliteEnemyAt(...args) { return createCardOpsApi().defeatNonEliteEnemyAt(...args) } export function rechargeAsset(...args) { return createCardOpsApi().rechargeAsset(...args) }
export function chooseEnemy(...args) { return createCardOpsApi().chooseEnemy(...args) } export function enemyForTarget(...args) { return createCardOpsApi().enemyForTarget(...args) } export function searchCards(...args) { return createCardOpsApi().searchCards(...args) }


// ---------------------------------------------------------------------------
// createCardDefs 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createCardDefsImpl = null
function createCardDefsApi() {
  createCardDefsImpl ||= createCardDefs({
    ...commonDeps,
    ALL_ENEMIES,
    ALL_STORY_ASSETS,
    ALL_TREACHERIES,
    BASIC_WEAKNESSES,
    RANDOM_BASIC_WEAKNESS_CODE,
    campaignManifestFor,
    campaignRuleCodes,
    canSelectInvestigator,
    cardIdentityFields,
    contentRegistry,
    getAvailability,
    hasExplicitReactionPrompt,
    isAutomaticReward,
    isCardAvailable,
    nextInstanceId,
    playablePool,
  })
  return createCardDefsImpl
}
// createCardDefsApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function declarativeDisplayBonuses(...args) { return createCardDefsApi().declarativeDisplayBonuses(...args) } export function allCardDefs(...args) { return createCardDefsApi().allCardDefs(...args) } export function embeddedCardDefs(...args) { return createCardDefsApi().embeddedCardDefs(...args) }
export function corePlayerPool(...args) { return createCardDefsApi().corePlayerPool(...args) } export function basicWeaknessPool(...args) { return createCardDefsApi().basicWeaknessPool(...args) } export function newCardInstance(...args) { return createCardDefsApi().newCardInstance(...args) }
export function newPlayerAssetInstance(...args) { return createCardDefsApi().newPlayerAssetInstance(...args) } export function newEnemyId(...args) { return createCardDefsApi().newEnemyId(...args) } export function resolveAgendaDoomThresholds(...args) { return createCardDefsApi().resolveAgendaDoomThresholds(...args) }


// ---------------------------------------------------------------------------
// createHiddenRules 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createHiddenRulesImpl = null
function createHiddenRulesApi() {
  createHiddenRulesImpl ||= createHiddenRules({
    ...commonDeps,
    isTextBlankEnemy,
    privateInfo,
  })
  return createHiddenRulesImpl
}
// createHiddenRulesApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function hiddenDefinition(...args) { return createHiddenRulesApi().hiddenDefinition(...args) } export function hiddenRule(...args) { return createHiddenRulesApi().hiddenRule(...args) } export function hasHiddenCard(...args) { return createHiddenRulesApi().hasHiddenCard(...args) }
export function removeHiddenMarker(...args) { return createHiddenRulesApi().removeHiddenMarker(...args) } export function canDiscardFromHand(...args) { return createHiddenRulesApi().canDiscardFromHand(...args) } export function discardHiddenCard(...args) { return createHiddenRulesApi().discardHiddenCard(...args) }
export function placeHiddenCard(...args) { return createHiddenRulesApi().placeHiddenCard(...args) } export function activeHiddenRules(...args) { return createHiddenRulesApi().activeHiddenRules(...args) } export function cannotTriggerFreeAbility(...args) { return createHiddenRulesApi().cannotTriggerFreeAbility(...args) }
export function hiddenFightBlocked(...args) { return createHiddenRulesApi().hiddenFightBlocked(...args) } export function movementError(...args) { return createHiddenRulesApi().movementError(...args) } export function currentInv(...args) { return createHiddenRulesApi().currentInv(...args) }
export function investigatorTextBlanked(...args) { return createHiddenRulesApi().investigatorTextBlanked(...args) } export function enemyTextBlanked(...args) { return createHiddenRulesApi().enemyTextBlanked(...args) } export function enemyCannotAttack(...args) { return createHiddenRulesApi().enemyCannotAttack(...args) }
export function enemyCannotBeAttacked(...args) { return createHiddenRulesApi().enemyCannotBeAttacked(...args) } export function enemyCanOpportunityAttack(...args) { return createHiddenRulesApi().enemyCanOpportunityAttack(...args) } export function enemyCanBeDefeated(...args) { return createHiddenRulesApi().enemyCanBeDefeated(...args) }


// ---------------------------------------------------------------------------
// createTurnFlow 装配（Phase 6 拆分）：模块是本文件的依赖注入工厂。
// ---------------------------------------------------------------------------
let createTurnFlowImpl = null
function createTurnFlowApi() {
  createTurnFlowImpl ||= createTurnFlow({
    ...commonDeps,
    LITA_CHANDLER_CODE,
    abilityOfMove,
    abilityShim,
    actionKind,
    availableThreatAbilities,
    beginInvestigationPhase,
    blanksTraits,
    canSpendClues,
    cardKeyword,
    cardPlayFlag,
    createAbilityRulesApi,
    discardableHandCards,
    elderSignDescriptor,
    groupClues,
    hiddenRule,
    investigateExtraActionsFor,
    legacyReactionLimit,
    legalMoves,
    newEnemyId,
    nextSeat,
    playCostDelta,
    readyUmordhoth,
    relicDiscountLocation,
    resolveCallOfTheUnknown,
    runBetweenInvestigationPhases,
    runThreatEndTurn,
    campaignPlayCostPreview,
    turnBeginningWindow,
    unpaidExtraActionThreats,
    useGoldPocketWatch,
  })
  return createTurnFlowImpl
}
// createTurnFlowApi() 的导出包装：每行 3 个（保持 function 声明，commonDeps 等可在模块初始化时提前引用）。
export function tryAquinnahRedirect(...args) { return createTurnFlowApi().tryAquinnahRedirect(...args) } export function codexSealedElderSign(...args) { return createTurnFlowApi().codexSealedElderSign(...args) } export function elderSignEffect(...args) { return createTurnFlowApi().elderSignEffect(...args) }
export function spawnStoryEnemy(...args) { return createTurnFlowApi().spawnStoryEnemy(...args) } export function processPlayerEnemyEntry(...args) { return createTurnFlowApi().processPlayerEnemyEntry(...args) } export function groupPayment(...args) { return createTurnFlowApi().groupPayment(...args) }
export function addVictory(...args) { return createTurnFlowApi().addVictory(...args) } export function descriptorReactionSpec(...args) { return createTurnFlowApi().descriptorReactionSpec(...args) } export function cannotPlayTypes(...args) { return createTurnFlowApi().cannotPlayTypes(...args) }
export function chooseEnemyFrom(...args) { return createTurnFlowApi().chooseEnemyFrom(...args) } export function sealRevealedChaosToken(...args) { return createTurnFlowApi().sealRevealedChaosToken(...args) } export function discardHandTo(...args) { return createTurnFlowApi().discardHandTo(...args) }
export function discardChosenCards(...args) { return createTurnFlowApi().discardChosenCards(...args) } export function advanceInvestigator(...args) { return createTurnFlowApi().advanceInvestigator(...args) } export function scenarioResignAvailable(...args) { return createTurnFlowApi().scenarioResignAvailable(...args) }
export function playCost(...args) { return createTurnFlowApi().playCost(...args) } export function itemDiscountAtLocation(...args) { return createTurnFlowApi().itemDiscountAtLocation(...args) } export function consumeItemDiscountAtLocation(...args) { return createTurnFlowApi().consumeItemDiscountAtLocation(...args) }
export function charlesPayCandidate(...args) { return createTurnFlowApi().charlesPayCandidate(...args) } export function tomeActionEligible(...args) { return createTurnFlowApi().tomeActionEligible(...args) } export function actionCost(...args) { return createTurnFlowApi().actionCost(...args) }
export function canParleyCultist(...args) { return createTurnFlowApi().canParleyCultist(...args) } export function litaControlled(...args) { return createTurnFlowApi().litaControlled(...args) } export function litaUncontrolled(...args) { return createTurnFlowApi().litaUncontrolled(...args) }
export function unique(...args) { return createTurnFlowApi().unique(...args) } export function evaluateCriteria(...args) { return createTurnFlowApi().evaluateCriteria(...args) } export function playConditionHelpers(...args) { return createTurnFlowApi().playConditionHelpers(...args) }
