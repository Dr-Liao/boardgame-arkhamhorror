// 诡镇奇谈：卡牌版 · 声明式能力注册表（Ability Registry）
//
// P0-A 的核心。此前「一张卡能做什么」只有两个去处：
//   1. src/cards/card-effects.js 的效果 DSL（能力被写死成 effect 对象）；
//   2. engine.js 里按卡号/调查员名写死的分支（elder sign、看门狗、安奎娜……）。
// 本模块提供第三种、也是主张长期使用的去处：卡片模块只导出**描述子数组**，
// 引擎按窗口枚举、按成本校验、按上限记账，执行时调用描述子自己的 resolve()。
//
// 描述子形状（除 kind 外全部可选）：
// {
//   kind: 'action' | 'free' | 'reaction' | 'forced' | 'constant' | 'elderSign'
//       | 'played' | 'commit' | 'weakness' | 'entersPlay' | 'leavesPlay',
//   label: '横置：获得 2 资源',        // 牌桌与 AI 看到的行动文案
//   text:  '卡面原文',                  // 便于审计对照，不参与结算
//   trigger: 'clueDiscovered' | ['a','b'],   // reaction/forced 必填，见 windows.js
//   criteria: [here(), engagedWithMe()],     // 可否使用（matcher.js 组合子）
//   target:  { kind: 'enemy', query: ... },   // 需要选择目标时（见 targets.js）
//   cost:    { action, exhaust, uses, resources, clues, discardSelf, horror, damageSelf },
//   limit:   'oncePerTest' | { scope, owner, count },   // 见 limits.js（Phase 2 C4）
//   fromHand: true,                    // 事件卡：从手牌打出（结算后按打出规则弃置）
//   countsAs: 'evade',                 // 本次能力按哪种行动结算（借机攻击判定；旧式能力写在 effect.kind）
//   duringOwnSkillTest: true,          // 只在本人检定期间可用
//   effect / skill / weakness / entersPlay / leavesPlay,  // 生命周期钩子的数据体
//   resolve(ctx)                       // ctx = { state, inv, seat, source, descriptor, target, context, events, api }
// }
//
// 条目级字段（一个 card-abilities.js 条目）：
//   { code, modifiers[], abilities[], elderSign, playCondition[], uses, usesType, discardWhenEmpty,
//     name, source }
//
// 约定：
//   · 注册在模块加载时完成；内容错误（未知 kind、缺必填 payload、未知 trigger、未知 target、
//     未知费用字段、非法费用表达式、非法 limit）在注册时直接抛错，而不是等到对局中途静默失效。
//   · kind 为 action/free 的描述子会同时生成一份旧式 ability 形状（label/cost/effect），
//     使 legalMoves、牌桌按钮、doAbility 无需为能力层写第二套枚举。
//   · 描述子不可变（Object.freeze）；引擎不得就地修改描述子，运行期数据放 state。
//   · 生命周期钩子（played/commit/weakness/entersPlay/leavesPlay）只带数据体、不带 trigger，
//     读点在 lifecycle.js；`weakness` 可带 resolve 接管揭示结算。
//   · Phase 2：费用表达式（C3，cost.js）与上限作用域/归属（C4，limits.js）是两个独立模块，
//     本文件只负责在注册时校验它们，并在读点上再导出，避免引擎出现第二套口径。

import { normalizeTrigger, isKnownWindow, windowKind } from './windows.js'
import { normalizeTarget } from './targets.js'
import { normalizeLimit } from './limits.js'
import { NUMERIC_COST_KEYS, validateCostValue } from './cost.js'
// Phase 2（C4）：上限的作用域与归属从 ability.js 搬进 limits.js，这里只保留再导出，
// 引擎与测试的 import 位置因此不需要改（引擎仍从 ability.js 取 limitUsed）。
export { describeLimit, limitKey, limitUsed, markLimitUsed } from './limits.js'

export const ABILITY_KINDS = Object.freeze(['action', 'free', 'reaction', 'forced', 'constant', 'elderSign',
  // Phase 5（5c-39）：开局效果（「原定计划」），只在 setup 阶段跑一次。
  'setup',
  'played', 'commit', 'weakness', 'entersPlay', 'leavesPlay'])

// Phase 3（D1）：条目的作用域。'card' / 'investigator' 是玩家侧通道（叙述见文件头）；
// 其余是非玩家卡通道：敌人、地点、幕/议程、剧情支援、威胁区遭遇卡。
// scope 决定引擎在哪个枚举点把这张卡的行为挂进窗口，以及审计把它算进哪本账。
export const ABILITY_SCOPES = Object.freeze(['card', 'investigator', 'enemy', 'location', 'act', 'agenda',
  'storyAsset', 'treachery'])
// 非玩家作用域：这些卡不在调查员的控制列表里，由引擎按「场上实体」枚举。
export const NON_PLAYER_SCOPES = Object.freeze(['enemy', 'location', 'act', 'agenda', 'storyAsset', 'treachery'])

const KINDS_NEEDING_TRIGGER = new Set(['reaction', 'forced'])
// 生命周期描述子不带时机窗口，但必须带自己的数据体：
//   played       效果 DSL（事件卡打出）
//   commit       检定档案（投入技能检定）
//   weakness     弱点档案（揭示时结算）
//   entersPlay   效果 DSL（进场钩子）
//   leavesPlay   效果 DSL（离场钩子）
const KINDS_NEEDING_PAYLOAD = Object.freeze({
  played: { field: 'effect', hint: '效果解释器的纯数据描述' },
  commit: { field: 'skill', hint: '检定档案' },
  weakness: { field: 'weakness', hint: '弱点档案（揭示时由 resolveWeakness 结算）' },
  entersPlay: { field: 'entersPlay', hint: '进场时结算的效果数据' },
  leavesPlay: { field: 'leavesPlay', hint: '离场时结算的效果数据' },
})
const LIFECYCLE_KINDS = new Set(Object.keys(KINDS_NEEDING_PAYLOAD))
// Phase 5（5c-19）：这两个生命周期钩子允许「只带 resolve」——效果 DSL 表达不了时由 resolve 接管，
// 读点仍是 lifecycle 的 playedEffect / entersPlayEffect，引擎侧没有第二条路径。
const LIFECYCLE_RESOLVE_KINDS = new Set(['played', 'entersPlay', 'setup'])
const COST_KEYS = new Set(['action', 'exhaust', 'uses', 'resources', 'clues', 'discardSelf',
  'exileSelf', 'horror', 'damageSelf', 'assetDamage', 'discardHand', 'discardHandIcon',
  // Phase 5（5b-6）：旧式反应的「花 1 线索但放回地点」费用（02302 马莱森博士）。
  // 读点在 triggerReaction 的付费段：clues 照扣，returnClue 为真时把线索放回所在地点。
  'returnClue'])
const DESCRIPTOR_KEYS = new Set(['kind', 'id', 'label', 'text', 'trigger', 'criteria', 'target', 'cost',
  'limit', 'fromHand', 'noPlayCost', 'duringOwnSkillTest', 'oncePerTest', 'oncePerPhase', 'requiresNoClues',
  'maximumInvestigatorDamage',
  // Phase 5（5c-37）：支援能力上的计数器上限（「时间借取」最多 3 声滴答）；读点在 canAffordAbility。
  'maxClicks',
  'resolve', 'effect', 'skill', 'weakness', 'entersPlay', 'leavesPlay',
  'source', 'simplified', 'note',
  // Phase 2：事件卡的打出关键字从 EFFECTS 顶层字段搬进描述子（迁移逃生卡的前提）。
  'fast', 'noOpportunityAttack',
  // Phase 5（5c-24）：`played` 描述子也能声明「打出后去向」——移出游戏 / 加入胜利区 / 变成场上卡。
  'becomesAsset', 'exileAfterPlay', 'addToVictory',
  // Phase 5（5c）：能力"按哪种行动结算"。旧式能力把这件事写在 `effect.kind`（`fight`/`evade`），
  // 描述子用 resolve 实现时没有 effect 数据体，需要显式声明，否则借机攻击判定会把它当成普通行动。
  'countsAs',
  // Phase 5（5b-6）：反应能力的"旧式询问"兼容标记。
  // 从 `EFFECTS[code].reactions` 搬过来的反应描述子带这个标记：引擎仍用旧式反应询问
  // （`是否触发「X」的反应？` + skip/trigger）结算它，保证迁移前后玩家看到的提示与状态指纹一致。
  // Phase 6 删掉旧式询问后，这个标记随之消失。
  'legacyReaction'])
const ENTRY_KEYS = new Set(['code', 'name', 'kind', 'scope', 'text', 'abilities', 'modifiers', 'elderSign', 'source',
  'uses', 'usesType', 'playCondition', 'simplified', 'note',
  // Phase 5（D2）：「用完弃置」是使用次数元数据，与 uses/usesType 同层。
  // 读点仍是 assetEffect / executeDescriptor 两处，旧 DSL 字段逐渐消失。
  'discardWhenEmpty',
  // Phase 5：资产/调查员卡的「快速」「不引发借机攻击」也是卡面关键字，需要与事件卡同名的条目级字段
  // （事件卡写在 played 描述子上；资产没有 played 钩子，只能写在条目上）。
  // Phase 5（5b-7）：「天赋」牌的自动投入档位（`freeTriggers`）与配套的 `minimumHandForBoost`，
  // 以及「沉静」关键字（`composure`，非直接恐惧必须分配给该支援）。读点都在 `assetEffect` 合并处。
  'freeTriggers', 'minimumHandForBoost', 'composure',
  // Phase 5（5c-10）：从弃牌堆打出与「打出后去向」（洗回牌库 / 移出游戏）。
  // 旧 DSL 把它们写在 EFFECTS 顶层，读点分别是 play-condition 与 doPlay 的收尾段。
  'playableFromDiscard', 'shuffleBackAfterPlay', 'removeAfterPlay',
  // Phase 5（5b-9）：资产上的规则性字段（回合结束自愈恐惧 / 维护阶段付费 / 被击败反伤 / 恐惧转移 / 不可离场）。
  'healSelfHorrorAfterTurn', 'forcedUpkeepPayOrDiscard', 'defeatedDamage',
  'redirectOneHorrorToSelf', 'cannotLeavePlay',
  // Phase 5（5b-10）：入场封印 / 替换封印旧印 / 附属目标声明（`attachTo` + `onAttach`）。
  'sealOnEnter', 'substituteSealedElderSign', 'attachTo', 'onAttach',
  // Phase 5（5b-11）：击败敌人后横置治愈恐惧。
  'exhaustOnEnemyDefeatedHealHorror',
  // Phase 5（5b-6d）：被动数据体（stats / handSizeBonus / sanityBonus …）。
  // 过渡方案：整块搬到条目上，读点仍是 assetEffect 的合并结果；5b-8 再逐键换成 modifiers。
  'passive',
  // Phase 5（5c-20）：卡面自带的「打出限制」与「团队仅限 N 张」。
  // 旧 DSL 写在 EFFECTS 顶层、由引擎的 cardPlayBlockedReason 读；搬到条目上之后读点不变
  // （先读条目、再回落 EFFECTS），这样迁移不影响 legalMoves 的可见性。
  'playRestriction', 'teamLimit',
  // Phase 5（5c-24）：「打出后去向」的三个字段也允许写在条目上（与 played 描述子同层），
  // 读点在 doPlay 的收尾段（移出游戏 / 加胜利区 / 卡牌本身留在场上）。
  'becomesAsset', 'exileAfterPlay', 'addToVictory',
  // Phase 5（5c-24）：这张支援会把封印其上的混乱标记当成本次检定的结算结果（危险预感）。
  'substituteSealedToken',
  // Phase 5（5c-34）：这张支援的 attachedCards 可以当作手牌打出（背包）。读点见 doPlay / legalMoves / validateMove。
  'cardBackpack',
  // Phase 5（5c-39）：这张支援的 attached 可以当作手牌打出（原定计划）；读点同 cardBackpack。
  'cardPlan',
  // Phase 5（5c-39）：手上有（或附属在计划里）这张牌时，动作前要留时间曲折快照。
  'rewindAction',
  // Phase 5（5b-8）：安奎娜这类「把这次攻击转给另一个敌人」的支援；读点在 tryAquinnahRedirect。
  'redirectAttackToAsset',
  // Phase 5（5b-8）：神话阶段结束时弃掉这张支援（戴红手套的男子）；读点在 mythosPhase。
  'forcedMythosEndDiscard',
  // Phase 5（5b-9）：关间免费替换（适应性，次数即上限）；读点在 campaign.js 的 upgrade 报价。
  'adaptableSwaps',
  // Phase 5（5b-9）：结局结算时的「卡戎的银币」契约（+2 经验、被击败即死亡）；读点在结局发经验段。
  'obolContract',
  // Phase 5（5a-6）：书虫每份占用的书位（手部槽位分配）。
  'tomeHandSlotsPerCopy',
  // Phase 5（5a-6）：回合开始把卡上的 clicks 换成额外行动（时间借取）。
  'clicksToActions',
  // Phase 5（5a-7）：控制占用盟友槽位的支援时自我弃掉（自食其力）。
  'discardIfControllingAlly',
  // Phase 5（5a-8）：威胁卡在结局带来的创伤（计数 / 充能阈值）。
  'mentalTraumaIfCounters',
  'physicalTraumaIfUsesBelow',
  // Phase 5（5a-8）：「谈判」检定的难度降低（02272）。
  'negotiationDifficultyReduction',
  // Phase 5（5a-9）：本该成功时改为再揭示一枚标记（雷克斯的诅咒）。
  'rerollRevealedTokenOnSuccess',
  // Phase 5（5a-10）：花 1 充能改揭示 2 枚标记并选 1（古代雕像）。
  'chaosTokenExtraReveal',
  // Phase 5（5a-12）：弱点入场时横置你所有支援（噩梦来袭）。
  'weaknessExhaustsAssets',
  // Phase 5（5a-18）：打出的事件进牌库顶（温蒂的护身符）/ 打出时自选花费（珍妮的双枪）。
  'playedEventsToDeckTop',
  'chooseResourceCostOnPlay',
  // Phase 5（5a-18）：打出后留在场上（屏障这类附属事件）。
  'keepOnPlay',
  // Phase 5（5a-19）：调查员被消除时离场（远古遗物这类支援）。
  'discardOnElimination',
  // Phase 5（5a-21）：花资源取消并重抽标记（幸运骰）/ 投入后流放换自动成功（天赐良机）。
  'rerollTokenCost',
  'exileForAutoSuccess',
  // Phase 5（5a-22）：抽到后留在手里的弱点（黑暗回忆）。
  'weaknessStaysInHand',
  // Phase 5（5a-24）：附属在宿主支援上时给宿主的技能加成（值得信赖）。
  'attachedSkillBonus',
  // Phase 5（5c-35）：这个 played 描述子的结算不写 `使用「X」：…` 日志（复刻旧数据体事件卡）。
  'quietPlay',
  'fast', 'noOpportunityAttack'])

// 条目级「能不能打出」条件：函数式 predicate，或 { when, message }（message 直接展示给玩家）。
// 与描述子的 criteria 共用 matcher.js 的 ctx 形状，读点是 src/engine/play-condition.js。
export function normalizePlayCondition(raw, origin = 'playCondition') {
  if (raw == null) return null
  if (!Array.isArray(raw)) throw new Error(`${origin}: playCondition 必须是数组`)
  return Object.freeze(raw.map((item, index) => {
    if (typeof item === 'function') return Object.freeze({ when: item, message: null })
    if (item && typeof item === 'object' && typeof item.when === 'function') {
      return Object.freeze({ when: item.when, message: item.message ? String(item.message) : null })
    }
    throw new Error(`${origin}[${index}]: playCondition 项必须是函数或 { when, message }`)
  }))
}

const REGISTRY = new Map()
const KNOWN_WINDOW_WARNINGS = new Set()

// ---------------------------------------------------------------------------
// 校验与规范化
// ---------------------------------------------------------------------------

function assertKnownKeys(object, allowed, origin) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw new Error(`${origin}: 未知字段 ${key}`)
  }
}

export function normalizeDescriptor(raw, { code, index }) {
  const origin = `能力 ${code}#${index}`
  if (!raw || typeof raw !== 'object') throw new Error(`${origin}: 描述子必须是对象`)
  assertKnownKeys(raw, DESCRIPTOR_KEYS, origin)
  const kind = raw.kind
  if (!ABILITY_KINDS.includes(kind)) throw new Error(`${origin}: 未知 kind ${JSON.stringify(kind)}`)
  const trigger = normalizeTrigger(raw.trigger)
  if (KINDS_NEEDING_TRIGGER.has(kind) && !trigger.length) throw new Error(`${origin}: ${kind} 必须声明 trigger`)
  for (const id of trigger) {
    if (!isKnownWindow(id)) KNOWN_WINDOW_WARNINGS.add(id)
  }
  if (raw.cost) {
    if (typeof raw.cost !== 'object') throw new Error(`${origin}: cost 必须是对象`)
    for (const key of Object.keys(raw.cost)) {
      if (!COST_KEYS.has(key)) throw new Error(`${origin}: 未知费用 ${key}`)
      // Phase 2（C3）：数值费用允许数字 / 函数 / 声明式表达式。
      if (NUMERIC_COST_KEYS.includes(key)) validateCostValue(key, raw.cost[key], `${origin} 的 cost`)
    }
  }
  // Phase 2（C4）：limit 可以是旧字符串，也可以是 { scope, owner, count }。
  const limit = normalizeLimit(
    raw.limit ?? (raw.oncePerTest ? 'oncePerTest' : raw.oncePerPhase ? 'oncePerPhase' : null), origin)
  if (raw.resolve != null && typeof raw.resolve !== 'function') throw new Error(`${origin}: resolve 必须是函数`)
  if (kind === 'reaction' || kind === 'forced') {
    // Phase 5（5b-6）：从旧式 reactions 搬来的反应是**纯数据**（effect 数据体 + 旧式条件/费用），
    // 由引擎的旧式反应流程结算；新写的反应/强制能力仍要求 resolve()。
    const legacyData = raw.legacyReaction === true && raw.effect && typeof raw.effect === 'object'
    if (!raw.resolve && !legacyData) throw new Error(`${origin}: ${kind} 必须提供 resolve()`)
  }
  const payload = KINDS_NEEDING_PAYLOAD[kind]
  if (payload && (!raw[payload.field] || typeof raw[payload.field] !== 'object')) {
    // Phase 2：事件卡的 played 钩子允许只带 resolve（当效果 DSL 表达不了时）——
    // 读点仍是 lifecycle.playedEffect()，引擎侧没有第二条路径。
    // Phase 5（5c-19）：entersPlay 同理（04021 的「牌库顶 9 张找遗物并附属」）。
    if (!(LIFECYCLE_RESOLVE_KINDS.has(kind) && typeof raw.resolve === 'function')) {
      throw new Error(`${origin}: ${kind} 必须提供 ${payload.field}（${payload.hint}）`)
    }
  }
  // Phase 5（5c-8）：`played` 平时是生命周期钩子、不声明 trigger；但**快速事件**可以在
  // 反应窗口打出（旧 DSL 写成 `fast: true, reaction: { when }`），所以允许 fast 的 played 声明 trigger。
  const fastPlayed = kind === 'played' && raw.fast === true
  if (LIFECYCLE_KINDS.has(kind) && trigger.length && !fastPlayed) {
    throw new Error(`${origin}: ${kind} 是生命周期钩子，不声明 trigger（快速事件除外）`)
  }
  const target = normalizeTarget(raw.target, origin)
  if (raw.countsAs != null && (typeof raw.countsAs !== 'string' || !raw.countsAs)) {
    throw new Error(`${origin}: countsAs 必须是非空字符串（如 'fight' / 'evade'）`)
  }
  const label = raw.label || raw.text || code
  return Object.freeze({
    id: raw.id || `${code}#${index}`,
    code,
    index,
    kind,
    label,
    text: raw.text || null,
    trigger,
    criteria: raw.criteria ?? null,
    target,
    cost: Object.freeze({ ...(raw.cost || {}) }),
    limit,
    fromHand: raw.fromHand === true,
    noPlayCost: raw.noPlayCost === true,
    // Phase 2：事件卡的"快速"/"不引发借机攻击"是卡面关键字，跟着描述子走。
    fast: raw.fast === true,
    noOpportunityAttack: raw.noOpportunityAttack === true,
    // Phase 5（5c-24）：`played` 描述子的「打出后去向」（读点在 doPlay 的收尾段）。
    becomesAsset: raw.becomesAsset === true,
    exileAfterPlay: raw.exileAfterPlay === true,
    addToVictory: raw.addToVictory === true,
    // Phase 5：这条能力"按哪种行动结算"（借机攻击判定用）。
    countsAs: raw.countsAs || null,
    // Phase 5（5b-6）：从旧式 reactions 搬来的反应，沿用旧式询问（见 DESCRIPTOR_KEYS 注释）。
    legacyReaction: raw.legacyReaction === true,
    duringOwnSkillTest: raw.duringOwnSkillTest === true,
    requiresNoClues: raw.requiresNoClues === true,
    maximumInvestigatorDamage: raw.maximumInvestigatorDamage ?? null,
    // Phase 5（5c-37）：支援能力的计数器上限（「时间借取」最多 3 声滴答）。
    maxClicks: raw.maxClicks ?? null,
    // 兼容旧 DSL：effect 描述子走效果解释器，resolve 描述子走自己的函数。
    effect: raw.effect ?? null,
    // 生命周期钩子的数据体（见 lifecycle.js）。
    skill: raw.skill ?? null,
    weakness: raw.weakness ?? null,
    entersPlay: raw.entersPlay ?? null,
    leavesPlay: raw.leavesPlay ?? null,
    source: raw.source || null,
    simplified: raw.simplified === true,
    note: raw.note || null,
    resolve: raw.resolve || null,
  })
}

function windowKindMatches(descriptor, windowId) {
  const kind = windowKind(windowId)
  if (descriptor.kind === 'free') return kind === 'player'
  if (descriptor.kind === 'reaction' || descriptor.kind === 'forced') return kind !== 'player'
  return false
}

// ---------------------------------------------------------------------------
// 注册
// ---------------------------------------------------------------------------

export function registerCardAbilities(entries) {
  const list = Array.isArray(entries) ? entries : [entries]
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') throw new Error('能力条目必须是对象')
    const origin = `能力条目 ${entry.code || '<无 code>'}`
    assertKnownKeys(entry, ENTRY_KEYS, origin)
    if (typeof entry.code !== 'string' || !entry.code) throw new Error(`${origin}: 缺少 code`)
    if (REGISTRY.has(entry.code) && REGISTRY.get(entry.code).registered !== false) {
      throw new Error(`${origin}: 重复注册（能力层同一卡号只允许一个条目）`)
    }
    const entryKind = entry.kind || (entry.elderSign ? 'investigator' : 'card')
    const scope = entry.scope || (entryKind === 'investigator' ? 'investigator' : 'card')
    if (!ABILITY_SCOPES.includes(scope)) {
      throw new Error(`${origin}: 未知 scope ${JSON.stringify(scope)}（可选：${ABILITY_SCOPES.join(' / ')}）`)
    }
    const abilities = (entry.abilities || []).map((raw, index) => normalizeDescriptor(raw, { code: entry.code, index }))
    const seen = new Set()
    for (const descriptor of abilities) {
      if (seen.has(descriptor.id)) throw new Error(`${origin}: 重复能力 id ${descriptor.id}`)
      seen.add(descriptor.id)
    }
    // 非玩家卡没有「打出」「投入」这类玩家侧时机：生命周期钩子与 action/free 都不成立，
    // 否则会声明出永远不结算的条目。注册期直接失败，不等到对局中途静默失效。
    if (NON_PLAYER_SCOPES.includes(scope)) {
      for (const descriptor of abilities) {
        if (LIFECYCLE_KINDS.has(descriptor.kind) || descriptor.kind === 'action' || descriptor.kind === 'free') {
          throw new Error(`${origin}: 非玩家卡（scope ${scope}）不能声明 ${descriptor.kind}`
            + '（只能写 constant / reaction / forced / elderSign）')
        }
      }
      if (entry.playCondition) throw new Error(`${origin}: 非玩家卡不能声明 playCondition`)
      if (entry.elderSign) throw new Error(`${origin}: 非玩家卡不能声明 elderSign`)
    }
    const normalized = {
      code: entry.code,
      name: entry.name || null,
      kind: entryKind,
      scope,
      // 非玩家卡的卡面参考文本（玩家卡的原文写在描述子的 text 上）。
      text: entry.text || null,
      abilities: Object.freeze(abilities),
      modifiers: Object.freeze((entry.modifiers || []).map(raw => ({ ...raw }))),
      // 条目级打出条件（描述子化卡牌的唯一写法；旧 DSL 字段由 play-condition.js 收敛）。
      playCondition: normalizePlayCondition(entry.playCondition, origin),
      elderSign: entry.elderSign || null,
      uses: entry.uses ?? null,
      usesType: entry.usesType || null,
      // Phase 5（D2）：使用次数元数据三件套一起进注册表，迁移 uses 时不用改引擎读点。
      discardWhenEmpty: entry.discardWhenEmpty === true,
      // Phase 5：条目级卡面关键字（资产/调查员的 fast 与不引发借机攻击）。
      fast: entry.fast === true,
      noOpportunityAttack: entry.noOpportunityAttack === true,
      // Phase 5（5b-7）：天赋牌的自动投入档位与「沉静」关键字（读点见 assetEffect 的合并）。
      // freeTriggers 是纯数据数组（每个元素 { skill, cost, bonus, requireTestTrait }）。
      freeTriggers: Object.freeze((entry.freeTriggers || []).map(trigger => Object.freeze({ ...trigger, cost: Object.freeze({ ...(trigger.cost || {}) }) }))),
      minimumHandForBoost: entry.minimumHandForBoost != null ? entry.minimumHandForBoost : null,
      composure: entry.composure === true,
      playableFromDiscard: entry.playableFromDiscard === true,
      shuffleBackAfterPlay: entry.shuffleBackAfterPlay === true,
      removeAfterPlay: entry.removeAfterPlay === true,
      passive: entry.passive ? Object.freeze({ ...entry.passive }) : null,
      // Phase 5（5b-9）：规则性字段（数值或布尔）原样透传，读点与旧 DSL 相同。
      healSelfHorrorAfterTurn: entry.healSelfHorrorAfterTurn ?? null,
      forcedUpkeepPayOrDiscard: entry.forcedUpkeepPayOrDiscard ?? null,
      defeatedDamage: entry.defeatedDamage ?? null,
      redirectOneHorrorToSelf: entry.redirectOneHorrorToSelf === true,
      cannotLeavePlay: entry.cannotLeavePlay === true,
      sealOnEnter: entry.sealOnEnter ?? null,
      substituteSealedElderSign: entry.substituteSealedElderSign === true,
      attachTo: entry.attachTo ? Object.freeze({ ...entry.attachTo }) : null,
      onAttach: entry.onAttach ? Object.freeze({ ...entry.onAttach }) : null,
      exhaustOnEnemyDefeatedHealHorror: entry.exhaustOnEnemyDefeatedHealHorror ?? null,
      // Phase 5（5c-20）：卡面自带的打出限制 / 团队张数上限（读点 cardPlayBlockedReason）。
      playRestriction: entry.playRestriction ?? null,
      teamLimit: entry.teamLimit ?? null,
      // Phase 5（5c-24）：打出后去向与「封印标记当结算结果」的声明。
      becomesAsset: entry.becomesAsset === true,
      exileAfterPlay: entry.exileAfterPlay === true,
      addToVictory: entry.addToVictory === true,
      substituteSealedToken: entry.substituteSealedToken === true,
      // Phase 5（5c-34）：attachedCards 可以当手牌打出（背包）。
      cardBackpack: entry.cardBackpack === true,
      // Phase 5（5c-39）：attached 可以当手牌打出（原定计划）与「动作前留回滚快照」。
      cardPlan: entry.cardPlan === true,
      rewindAction: entry.rewindAction === true,
      // Phase 5（5b-8）：攻击转移支援 / 神话结束弃掉。
      redirectAttackToAsset: entry.redirectAttackToAsset === true,
      forcedMythosEndDiscard: entry.forcedMythosEndDiscard === true,
      // Phase 5（5b-9）：关间免费替换次数 / 结局契约。
      adaptableSwaps: entry.adaptableSwaps ?? null,
      obolContract: entry.obolContract === true,
      // Phase 5（5a-6）：书位与「滴答换行动」。
      tomeHandSlotsPerCopy: entry.tomeHandSlotsPerCopy ?? null,
      clicksToActions: entry.clicksToActions === true,
      discardIfControllingAlly: entry.discardIfControllingAlly === true,
      // Phase 5（5a-8）：结局创伤与谈判降难度。
      mentalTraumaIfCounters: entry.mentalTraumaIfCounters === true,
      physicalTraumaIfUsesBelow: entry.physicalTraumaIfUsesBelow ?? null,
      negotiationDifficultyReduction: entry.negotiationDifficultyReduction ?? null,
      rerollRevealedTokenOnSuccess: entry.rerollRevealedTokenOnSuccess === true,
      chaosTokenExtraReveal: entry.chaosTokenExtraReveal === true,
      weaknessExhaustsAssets: entry.weaknessExhaustsAssets === true,
      playedEventsToDeckTop: entry.playedEventsToDeckTop === true,
      chooseResourceCostOnPlay: entry.chooseResourceCostOnPlay === true,
      keepOnPlay: entry.keepOnPlay === true,
      discardOnElimination: entry.discardOnElimination === true,
      rerollTokenCost: entry.rerollTokenCost ?? null,
      exileForAutoSuccess: entry.exileForAutoSuccess === true,
      weaknessStaysInHand: entry.weaknessStaysInHand === true,
      attachedSkillBonus: entry.attachedSkillBonus ?? null,
      // Phase 5（5c-35）：结算时静默（不写 `使用「X」：…`）。
      quietPlay: entry.quietPlay === true,
      source: entry.source || null,
      registered: true,
    }
    REGISTRY.set(entry.code, normalized)
  }
  return list.length
}

export function registeredEntry(code) {
  return REGISTRY.get(code) || null
}

export function registeredCodes() {
  return [...REGISTRY.keys()].sort()
}

export function declaredAbilityCount() {
  let total = 0
  for (const entry of REGISTRY.values()) total += entry.abilities.length
  return total
}

// Phase 3（D1）：非玩家卡通道的查询。
// 引擎按「场上实体」枚举它们，审计按 scope 单独记账，不与玩家卡混在一起。
export function nonPlayerEntries() {
  const out = []
  for (const entry of REGISTRY.values()) {
    if (!NON_PLAYER_SCOPES.includes(entry.scope)) continue
    if (!entry.abilities.length && !entry.modifiers.length) continue
    out.push(entry)
  }
  return out
}

export function nonPlayerCodes() {
  return nonPlayerEntries().map(entry => entry.code).sort()
}

export function abilityScopeOf(code) {
  return REGISTRY.get(code)?.scope || null
}

// 某张非玩家卡有没有「行为」（能力或修正）。
export function hasNonPlayerBehavior(code) {
  const entry = REGISTRY.get(code)
  return Boolean(entry && NON_PLAYER_SCOPES.includes(entry.scope) && (entry.abilities.length || entry.modifiers.length))
}

// 实体声明窗口能力的唯一枚举点：传 code，返回该卡在此窗口的强制/反应能力。
// scope 校验放在这里，避免玩家卡被非玩家枚举点误用。
export function entityDescriptorsForWindow(code, windowId, kind) {
  const entry = REGISTRY.get(code)
  if (!entry || !NON_PLAYER_SCOPES.includes(entry.scope)) return []
  return descriptorsInEntry(entry, windowId, kind)
}

export function unknownTriggerWarnings() {
  return [...KNOWN_WINDOW_WARNINGS].sort()
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

export function actionDescriptors(code) {
  const entry = REGISTRY.get(code)
  if (!entry) return []
  return entry.abilities.filter(descriptor => descriptor.kind === 'action' || descriptor.kind === 'free')
}

// 旧式 ability 形状：legalMoves / 牌桌按钮 / doAbility 共用同一份枚举。
export function abilityShim(code) {
  const descriptors = actionDescriptors(code)
  if (!descriptors.length) return []
  return descriptors.map(descriptor => ({
    label: descriptor.label,
    // kind 'free' 一律表示不消耗行动点，与旧 DSL 的 cost.action === false 同义。
    cost: descriptor.kind === 'free' ? Object.freeze({ ...descriptor.cost, action: false }) : descriptor.cost,
    effect: descriptor.effect || null,
    descriptor,
    // 目标枚举（B1）：legalMoves 按 target 展开成逐目标行动，validateMove 用同一份枚举校验。
    target: descriptor.target,
    windowTrigger: descriptor.trigger,
    // Phase 2（C4）：上限现在是对象，旧式布尔字段从 scope 推导，别再比较字符串。
    oncePerTest: descriptor.limit?.scope === 'perTest' || undefined,
    oncePerPhase: descriptor.limit?.scope === 'perPhase' || undefined,
    duringOwnSkillTest: descriptor.duringOwnSkillTest || undefined,
    requiresNoClues: descriptor.requiresNoClues || undefined,
    maximumInvestigatorDamage: descriptor.maximumInvestigatorDamage ?? undefined,
    // Phase 5（5c-37）：计数器上限（「时间借取」最多 3 声滴答），读点在 canAffordAbility。
    maxClicks: descriptor.maxClicks ?? undefined,
    fromAbilityLayer: true,
  }))
}

export function descriptorsForWindow(code, windowId, kind = null) {
  return descriptorsInEntry(REGISTRY.get(code), windowId, kind)
}

// 同一份窗口匹配逻辑也用于「持续效果携带的能力」：那些能力没有自己的注册条目，
// 只有 entry 形状 { abilities }，这里避免在引擎里重复实现一遍 kind/窗口判定。
export function descriptorsInEntry(entry, windowId, kind = null) {
  return (entry?.abilities || []).filter(descriptor => {
    if (kind && descriptor.kind !== kind) return false
    if (!descriptor.trigger.includes(windowId)) return false
    return windowKindMatches(descriptor, windowId)
  })
}

export function allDescriptors(code) {
  return REGISTRY.get(code)?.abilities || []
}

export function elderSignDescriptor(code) {
  return REGISTRY.get(code)?.elderSign || null
}

// 生命周期钩子的通用查询：lifecycle.js 与引擎的弱点/进出场读点都从这里取，
// 避免每加一种钩子就在两处各写一遍 find()。
export function descriptorOfKind(code, kind) {
  const entry = REGISTRY.get(code)
  if (!entry) return null
  return entry.abilities.find(descriptor => descriptor.kind === kind) || null
}

export function weaknessDescriptor(code) {
  return descriptorOfKind(code, 'weakness')
}

export function modifiersFor(code) {
  return REGISTRY.get(code)?.modifiers || []
}

export function playConditionFor(code) {
  return REGISTRY.get(code)?.playCondition || null
}

export function describeRegistry() {
  return registeredCodes().map(code => {
    const entry = REGISTRY.get(code)
    return {
      code,
      kind: entry.kind,
      abilities: entry.abilities.map(descriptor => ({
        id: descriptor.id, kind: descriptor.kind, trigger: descriptor.trigger, label: descriptor.label, limit: descriptor.limit,
      })),
      modifiers: entry.modifiers.length,
      elderSign: entry.elderSign ? { id: entry.elderSign.id || 'elderSign' } : null,
    }
  })
}

// 给 AI 上下文与图鉴用的轻量摘要：只暴露「这张卡能做什么」，不含 resolve 实现。
export function abilitySummary(code) {
  const entry = REGISTRY.get(code)
  if (!entry) return null
  const abilities = entry.abilities.map(descriptor => ({
    kind: descriptor.kind,
    label: descriptor.label,
    trigger: descriptor.trigger.length ? descriptor.trigger : undefined,
    cost: Object.keys(descriptor.cost).length ? descriptor.cost : undefined,
    limit: descriptor.limit || undefined,
    simplified: descriptor.simplified || undefined,
  }))
  const modifiers = entry.modifiers.map(modifier => ({ target: modifier.target, amount: modifier.amount }))
  if (!abilities.length && !modifiers.length && !entry.elderSign) return null
  // 打出条件的文案提示（不暴露 predicate 实现）：AI 与图鉴据此解释「为什么现在打不出」。
  const playCondition = entry.playCondition
    ? entry.playCondition.map(item => item.message).filter(Boolean)
    : []
  return {
    abilities,
    modifiers,
    playCondition: playCondition.length ? playCondition : undefined,
    elderSign: entry.elderSign ? { id: entry.elderSign.id || 'elderSign' } : null,
  }
}

export function windowDescriptorSummary(windowId) {
  const rows = []
  for (const entry of REGISTRY.values()) {
    for (const descriptor of entry.abilities) {
      if (!descriptor.trigger.includes(windowId)) continue
      rows.push({
        code: entry.code,
        id: descriptor.id,
        kind: descriptor.kind,
        label: descriptor.label,
        limit: descriptor.limit,
      })
    }
  }
  return rows
}

// 上限记账（limitKey / limitUsed / markLimitUsed）在 limits.js；
// 本文件在顶部再导出，保持引擎与内容层的 import 位置稳定。
