// 诡镇奇谈：卡牌版 · 修正（Modifier）管线
//
// P0-A 的一部分。目标：把「谁的什么数值被谁改了多少」从 engine.js 的 getStat 里
// 那串 if 变成一份可枚举的修正清单，读点只有一个，内容层可以声明式地加修正。
//
// 四类来源，按优先级：
//   1. declarative  —— 能力层注册的卡片/调查员修正（本文件主张的写法）
//   2. effects      —— state.effects[] 上的持续效果修正（Phase 1 A1；由引擎注入读点）
//   3. legacy       —— 旧 passive 字段的桥接（EFFECTS[code].passive.* 等），
//                      逐条迁移到 declarative 后即可删除对应桥接分支
//   4. scenario     —— 剧本行为的 statModifier 钩子（保留，归内容层）
//
// 修正形状：
//   { target, amount, condition, audience, value? }
//     target    'skill:willpower' | 'skill:*' | 'maxHealth' | 'handSize'
//               | 'slot:arcane' | 'playCost' | 'enemyHealth' | 'actions'
//               | 'capability:<id>' | 'ignore:<id>' | 'add:trait' | 'add:keyword'
//               | 'add:slot' | 'add:skillIcon'        （Phase 2：C1 / C2）
//     amount    数字，或 ({ state, inv, controller, source, enemy }) => 数字
//               （capability/ignore/add:* 目标可省略，默认 1；0 表示"不生效"）
//     value     add:* 授予的具体名字（特性/关键词/槽位/技能图标）
//     condition 声明式条件对象（见 evaluateCondition），或 { when: fn }
//     audience  'controller'（默认，只有持有者受益）
//               | 'here'（同地点所有调查员受益，例如 01117 丽塔的灵光）
//
// 约定：修正只做加法；需要「下限/覆盖」的语义用 floor 表达（见 statPipeline），
// 不引入顺序依赖。
//
// Phase 2（C1）新增两类**布尔**修正目标，读点仍是本文件，engine.js 不再新增卡号分支：
//   capability:<id>  能力被禁止（"不能调查""不能打出事件"）
//   ignore:<id>      规则元素被无视（"无视反击""敌人不狩猎你"）
// 读点：capabilityBlocked() / ruleIgnored() / modifierBlocked()（见文件末尾）。
// Phase 2（C2）新增授予类目标：add:trait / add:keyword / add:slot / add:skillIcon，
// 读点 collectGrants()，引擎侧的 effectiveTraits()/enemyKeyword()/slotUsage() 都走它。

import { registeredEntry } from './ability.js'
import { EFFECTS } from '../cards/card-effects.js'
import { hasTrait } from './matcher.js'

const MODIFIER_CACHE = new Map()

export const MODIFIER_TARGETS = Object.freeze([
  'skill:willpower', 'skill:intellect', 'skill:combat', 'skill:agility', 'skill:wild', 'skill:*',
  'maxHealth', 'maxSanity', 'handSize', 'actions',
  'slot:hand', 'slot:arcane', 'slot:accessory', 'slot:ally', 'slot:body',
  'playCost', 'enemyHealth',
])

// Phase 3（D1）：非玩家卡（敌人/地点/幕/议程/剧情支援）的数值修正目标。
// 读点 entityModifierTotal(state, entity, target)：来源是实体自己的卡号条目，
// 以及「容纳」它的场景卡（敌人在某地点 → 该地点条目的 enemyFight 修正生效）。
// 这条通道让「此处的每个蛇族敌人 +1 攻击」写成地点卡上的声明，而不是章节 behavior。
export const ENTITY_MODIFIER_TARGETS = Object.freeze([
  'enemyFight', 'enemyEvade', 'enemyHealth',
  'locationShroud', 'locationClues',
])

// Phase 3（D1）：非玩家卡的布尔规则。每一项都必须有引擎侧读点（entityRuleActive），
// 否则"能声明但不生效"——与 C1 的 capability:<id> 同一口径。
export const ENTITY_RULE_TARGETS = Object.freeze([
  'cannot:attack',          // 该敌人不能发动攻击（敌人阶段与剧本攻击）
  'cannot:beAttacked',      // 不能被攻击（攻击行动不提供目标）
  'cannot:beDefeated',      // 不能被击败（伤害仍可累积）
  'cannot:beDamaged',       // 不能受到伤害
  'cannot:opportunityAttack', // 不发动借机攻击
  'ignore:revealText',      // 地点/卡的「揭示时」文本视为空白
])

// C1：能力禁止。每一项都必须有引擎侧读点（见 engine.js 的同名调用），
// 否则"能声明但不能生效"——这比不支持更糟。
export const BLOCKABLE_CAPABILITIES = Object.freeze([
  'investigate',      // 不能调查（调查行动与「调查」类效果）
  'fight',            // 不能攻击
  'evade',            // 不能躲避
  'move',             // 不能移动
  'draw',             // 不能抽牌（抽牌行动）
  'play',             // 不能打出卡牌
  'triggerAbilities', // 不能触发能力（免费/主动/地点能力）
  'locationAbility',  // 不能使用地点行动
  'commit',           // 不能投入技能检定
  'resign',           // 不能撤退
  'discoverClue',     // 不能发现线索
])

// C1：可被"无视"的规则元素。
export const IGNORABLE_RULES = Object.freeze([
  'retaliate',        // 攻击落空不触发反击
  'alert',            // 躲避落空不触发警戒
  'hunter',           // 敌人不把你当作猎手目标
  'opportunityAttack', // 你执行行动时不引发借机攻击
])

// C2：授予类修正（amount 省略即 1，value 是授予的名字）。
export const GRANT_TARGETS = Object.freeze(['add:trait', 'add:keyword', 'add:slot', 'add:skillIcon'])

const capabilityTarget = id => `capability:${id}`
const ignoreTarget = id => `ignore:${id}`

// 'value'（数值修正）/ 'capability' / 'ignore' / 'grant' / 'entity'（非玩家卡数值）
// / 'entityRule'（非玩家卡布尔规则）
export function modifierTargetKind(target) {
  if (typeof target !== 'string') return null
  if (MODIFIER_TARGETS.includes(target)) return 'value'
  if (ENTITY_MODIFIER_TARGETS.includes(target)) return 'entity'
  if (ENTITY_RULE_TARGETS.includes(target)) return 'entityRule'
  if (GRANT_TARGETS.includes(target)) return 'grant'
  if (BLOCKABLE_CAPABILITIES.some(id => target === capabilityTarget(id))) return 'capability'
  if (IGNORABLE_RULES.some(id => target === ignoreTarget(id))) return 'ignore'
  return null
}

const BOOLEAN_KINDS = new Set(['capability', 'ignore', 'grant', 'entityRule'])

export function normalizeModifier(raw, origin = 'modifier') {
  if (!raw || typeof raw !== 'object') throw new Error(`${origin}: 修正必须是对象`)
  const target = raw.target
  const kind = modifierTargetKind(target)
  if (!kind) throw new Error(`${origin}: 未知修正目标 ${JSON.stringify(target)}`)
  const amount = raw.amount ?? (BOOLEAN_KINDS.has(kind) ? 1 : undefined)
  if (typeof amount !== 'number' && typeof amount !== 'function') {
    throw new Error(`${origin}: 修正 amount 必须是数字或函数`)
  }
  if (kind === 'grant' && raw.value == null) throw new Error(`${origin}: ${target} 必须声明 value`)
  if (raw.value != null && kind !== 'grant') throw new Error(`${origin}: 只有 add:* 目标可以声明 value`)
  if (raw.audience != null && !['controller', 'here'].includes(raw.audience)) {
    throw new Error(`${origin}: 未知 audience ${raw.audience}`)
  }
  return Object.freeze({
    target,
    kind,
    amount,
    value: raw.value != null ? String(raw.value) : null,
    condition: raw.condition ?? null,
    audience: raw.audience || 'controller',
    origin,
  })
}

// ---------------------------------------------------------------------------
// 条件
// ---------------------------------------------------------------------------

const CONDITION_KEYS = new Set([
  'when', 'noResources', 'resourcesAtLeast', 'resourcesAtMost',
  'cluesAtLeast', 'cluesAtMost', 'damageAtLeast', 'damageAtMost',
  'horrorAtLeast', 'horrorAtMost', 'atTrait', 'inPhase', 'inRound',
  'sourceDamageAtLeast', 'sourceHorrorAtLeast', 'sourceDoomAtLeast', 'sourceUsesAtLeast',
  'controllerHasThreat', 'controllerHasNoThreat', 'sealedWithSource', 'treacheryResolving',
  'sourceInHand', 'blankedThisRound',
])

export function validateCondition(condition, origin = 'condition') {
  if (condition == null) return null
  if (typeof condition !== 'object') throw new Error(`${origin}: 条件必须是对象`)
  for (const key of Object.keys(condition)) {
    if (!CONDITION_KEYS.has(key)) throw new Error(`${origin}: 未知条件字段 ${key}`)
  }
  return condition
}

function threatCodes(investigator) {
  return new Set([...(investigator?.threat || []).map(card => card.code)])
}

// ctx: { state, inv, controller, source, sourceDef, enemy }
export function evaluateCondition(condition, ctx) {
  if (condition == null) return true
  const { state, inv, controller, source } = ctx
  if (typeof condition.when === 'function') {
    try { if (condition.when(ctx) !== true) return false } catch { return false }
  }
  if (condition.noResources && (controller?.resources ?? 0) > 0) return false
  if (condition.resourcesAtLeast != null && (controller?.resources ?? 0) < condition.resourcesAtLeast) return false
  if (condition.resourcesAtMost != null && (controller?.resources ?? 0) > condition.resourcesAtMost) return false
  if (condition.cluesAtLeast != null && (inv?.clues ?? 0) < condition.cluesAtLeast) return false
  if (condition.cluesAtMost != null && (inv?.clues ?? 0) > condition.cluesAtMost) return false
  if (condition.damageAtLeast != null && (controller?.damage ?? 0) < condition.damageAtLeast) return false
  if (condition.damageAtMost != null && (controller?.damage ?? 0) > condition.damageAtMost) return false
  if (condition.horrorAtLeast != null && (controller?.horror ?? 0) < condition.horrorAtLeast) return false
  if (condition.horrorAtMost != null && (controller?.horror ?? 0) > condition.horrorAtMost) return false
  if (condition.atTrait != null) {
    const location = (state?.locations || []).find(entry => entry.id === controller?.location)
    if (!hasTrait(location, condition.atTrait)) return false
  }
  if (condition.inPhase != null && state?.phase !== condition.inPhase) return false
  if (condition.inRound != null && state?.round !== condition.inRound) return false
  if (condition.sourceDamageAtLeast != null && (source?.damage ?? 0) < condition.sourceDamageAtLeast) return false
  if (condition.sourceHorrorAtLeast != null && (source?.horror ?? 0) < condition.sourceHorrorAtLeast) return false
  if (condition.sourceDoomAtLeast != null && (source?.doom ?? 0) < condition.sourceDoomAtLeast) return false
  if (condition.sourceUsesAtLeast != null && (source?.uses ?? 0) < condition.sourceUsesAtLeast) return false
  if (condition.controllerHasThreat != null && !threatCodes(controller).has(condition.controllerHasThreat)) return false
  if (condition.controllerHasNoThreat != null && threatCodes(controller).has(condition.controllerHasNoThreat)) return false
  if (condition.sealedWithSource && !(state?.chaos?.sealed || []).some(entry => entry.source === source?.id)) return false
  if (condition.treacheryResolving && !state?._treacheryResolving) return false
  if (condition.sourceInHand) {
    const inHand = (controller?.hand || []).some(code => code === (source?.handCode || source?.code))
    if (!inHand) return false
  }
  if (condition.blankedThisRound) {
    // 实体修正的 ctx 用 entity；旧读点可能用 enemy。两者都认。
    const blank = ctx.entity?.textBlanked || ctx.enemy?.textBlanked
    if (!blank || blank.round !== state?.round || blank.phase !== state?.phase) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// 来源
// ---------------------------------------------------------------------------

// 由 ability.js 注入（避免循环 import）：code → 注册条目。
let lookupEntry = () => null

export function setModifierRegistry(reader) {
  lookupEntry = reader
  MODIFIER_CACHE.clear()
}

// 引擎注入的读点数：桥接旧式字段时需要和引擎完全一致的口径（例如理智上限含被动加成）。
// sourceBlanked/investigatorBlanked 让「文本视为空白」对声明式修正同样生效
// （02088 不能触碰的盟友、04099 毒蛇灾厄等）。
// activeEffects 是 Phase 1 的效果实体读点：引擎用 effect-state 的 effectModifiers 注入，
// 本模块因此不需要 import effect-state（保持「modifiers 与 ability 互不 import」的方向）。
// weaknessProfile 同理：威胁区卡面的弱点数据由引擎按生命周期读点注入。
let hooks = {
  maxSanity: inv => inv?.maxSanity || 0,
  sourceBlanked: () => false,
  investigatorBlanked: () => false,
  // Phase 3（D1）：非玩家实体的文本空白判定（敌人 textBlanked 等），
  // 空白时该实体自己的声明式修正与布尔规则都不生效。
  entityBlanked: () => false,
  activeEffects: () => [],
  weaknessProfile: code => EFFECTS[code]?.weakness || null,
}

export function setModifierHooks(next) {
  hooks = { ...hooks, ...next }
}

function modifiersOf(code) {
  if (!code) return []
  if (MODIFIER_CACHE.has(code)) return MODIFIER_CACHE.get(code)
  const list = []
  const entry = lookupEntry(code)
  for (const raw of entry?.modifiers || []) list.push(normalizeModifier(raw, `卡片 ${code} 的修正`))
  for (const raw of EFFECTS[code]?.modifiers || []) list.push(normalizeModifier(raw, `卡片 ${code} 的旧式修正`))
  MODIFIER_CACHE.set(code, list)
  return list
}

function amountOf(modifier, ctx) {
  const value = typeof modifier.amount === 'function' ? modifier.amount(ctx) : modifier.amount
  return Number.isFinite(value) ? value : 0
}

// 单个实体的修正是否作用于 benficiary（inv）。
function appliesTo(modifier, ctx) {
  if (modifier.audience === 'here') return ctx.inv?.location === ctx.controller?.location
  return ctx.inv?.seat === ctx.controller?.seat
}

function sumModifiers(list, ctx, target) {
  let total = 0
  for (const modifier of list) {
    const matches = modifier.target === target
      || (modifier.target === 'skill:*' && target.startsWith('skill:'))
    if (!matches) continue
    if (!appliesTo(modifier, ctx)) continue
    if (!evaluateCondition(modifier.condition, ctx)) continue
    total += amountOf(modifier, ctx)
  }
  return total
}

export function modifierTotal(state, inv, target) {
  let total = 0
  // 'controller' 只算持有者；'here' 需要同地点的其他调查员，统一按 appliesTo 过滤。
  for (const row of modifierSourceRows(state)) {
    total += sumModifiers(row.list, { state, inv, controller: row.controller, source: row.source, effect: row.effect }, target)
  }
  return total
}

// 修正来源的唯一枚举点：卡片修正、调查员修正与持续效果走同一份清单。
// 数值读点（modifierTotal）与布尔/授予读点（文件末尾）共用它，避免三处各写一遍过滤。
function* modifierSourceRows(state) {
  for (const investigator of state?.investigators || []) {
    if (investigator.defeated || investigator.resigned) continue
    for (const source of [...(investigator.assets || []), ...(investigator.threat || [])]) {
      const list = modifiersOf(source.code)
      if (!list.length) continue
      if (hooks.sourceBlanked(state, investigator, source)) continue
      yield { controller: investigator, source, list }
    }
    const investigatorModifiers = modifiersOf(investigator.code)
    if (investigatorModifiers.length && !hooks.investigatorBlanked(state, investigator)) {
      yield { controller: investigator, source: investigator, list: investigatorModifiers }
    }
  }
  // 持续效果（state.effects）：与卡片修正等价的一条声明式来源，只是有到期时间。
  for (const row of hooks.activeEffects(state)) {
    const controller = state?.investigators?.[row.effect?.controllerSeat]
    if (!controller || controller.defeated || controller.resigned) continue
    yield { controller, source: row.effect, effect: row.effect, list: [row.modifier] }
  }
}

// ---------------------------------------------------------------------------
// 旧式 passive 字段的桥接（迁移期间保留，逐条迁走后删除）
// ---------------------------------------------------------------------------

const connectionCount = (state, inv) => {
  const here = (state?.locations || []).find(entry => entry.id === inv?.location)
  return (here?.connections || []).filter(id => (state?.locations || []).some(other => other.id === id)).length
}

// 旧式字段的数值桥接。这里刻意直接算数字而不是构造修正对象：
// getStat 是热路径（渲染、AI 上下文、每次检定都要算），逐次 new 修正会白付分配。
// 每迁移一张卡到 declarative 后，对应分支就应该从本函数删除。
export function legacyStatDelta(state, inv, skill) {
  let v = 0
  const connected = connectionCount(state, inv)
  for (const asset of inv?.assets || []) {
    // 文本被清空的支援（02088 等）不提供被动加成，与 assetEffect 的口径一致。
    if (hooks.sourceBlanked(state, inv, asset)) continue
    const eff = EFFECTS[asset?.code]
    // Phase 5（5b-8）：passive 已搬到能力层条目时，桥接同样要认。
    const passive = eff?.passive || registeredEntry(asset?.code)?.passive
    if (passive) {
      if (passive.stats) v += passive.stats[skill] || 0
      if (passive.statsWhileSealed && (state?.chaos?.sealed || []).some(entry => entry.source === asset.id)) {
        v += passive.statsWhileSealed[skill] || 0
      }
      if (passive.statsByConnections) {
        const tier = passive.statsByConnections
        if (connected >= (tier.count || 0)) v += tier.stats?.[skill] || 0
        const extra = passive.extraConnections
        if (extra && connected >= (extra.count || 0)) v += extra.stats?.[skill] || 0
      }
      if (passive.allStatsIfNoResources && inv.resources === 0) v += passive.allStatsIfNoResources
      const conditional = passive.conditionalStats
      if (conditional && (conditional.doomAtLeast == null || (asset.doom || 0) >= conditional.doomAtLeast)
        && (conditional.resourcesAtLeast == null || inv.resources >= conditional.resourcesAtLeast)
        && (conditional.remainingSanityAtMost == null || remainingSanity(inv) <= conditional.remainingSanityAtMost)) {
        v += conditional.stats?.[skill] || 0
      }
      if (passive.statsPerAssetHorror) v += (asset.horror || 0) * passive.statsPerAssetHorror
      if (passive.treacheryTestStats && state?._treacheryResolving) v += passive.treacheryTestStats[skill] || 0
    }
    if (asset.statBonus?.[skill]) v += asset.statBonus[skill]
  }
  for (const threat of inv?.threat || []) {
    // 与 engine.getThreatEffect 同序：实例上的 threatEffect 优先，其次是卡面的 weakness 定义。
    const effects = hooks.weaknessProfile(threat?.code)
    const source = threat?.threatEffect
      || (effects?.type === 'threat' ? effects : null)
    if (!source) continue
    if (source.mods?.allSkills) v += source.mods.allSkills
    v += source.statModifiers?.[skill] || 0
  }
  // 「本阶段/本轮 +X」这类临时修正现在由 state.effects 承载（Phase 1 A1）：
  // effectModifiers 已经在 modifierTotal 里统一叠加，这里只保留真正的旧字段桥接。
  if (inv?.phaseStatBonus && inv.phaseStatBonus.skill === skill) v += inv.phaseStatBonus.amount
  return v
}

const remainingSanity = inv => hooks.maxSanity(inv) - (inv?.horror || 0)

// ---------------------------------------------------------------------------
// 读点
// ---------------------------------------------------------------------------

export function statPipeline(state, inv, skill) {
  const delta = modifierTotal(state, inv, `skill:${skill}`) + legacyStatDelta(state, inv, skill)
  // 覆盖式「属性下限」：支援把某项属性视为至少 6（如 03018 的 statOverride）。
  const floor = (inv?.assets || []).some(asset => (asset.statOverride || []).includes(skill)) ? 6 : null
  return { delta, floor }
}

export function effectiveStatValue(base, state, inv, skill) {
  const { delta, floor } = statPipeline(state, inv, skill)
  const value = base + delta
  return floor == null ? value : Math.max(value, floor)
}

// 槽位加成：canEquip 目前不带 state（调用点很多），因此这里只结算持有者自己的
// 修正，且条件里不做需要 state 的判断。需要 state 的槽位规则应改为走 modifierTotal。
export function slotBonus(inv, slot) {
  let total = 0
  for (const asset of inv?.assets || []) {
    for (const modifier of modifiersOf(asset.code)) {
      // Phase 2（C2）：add:slot 是"授予槽位"的声明式写法（value = 槽位名），
      // slot:<slot> 是旧数值写法；两者在这里汇合，canEquip 不需要知道有两个来源。
      const matches = modifier.target === `slot:${slot}`
        || (modifier.target === 'add:slot' && modifier.value === slot)
      if (!matches) continue
      const ctx = { state: null, inv, controller: inv, source: asset }
      if (!evaluateCondition(modifier.condition, ctx)) continue
      total += amountOf(modifier, ctx)
    }
  }
  return total
}

export function enemyHealthDelta(state, enemy) {
  return entityModifierTotal(state, enemy, 'enemyHealth')
}

// ---------------------------------------------------------------------------
// D1：非玩家卡的修正读点
//
// 模型：一个实体（敌人/地点/剧情支援）的修正来自三处，按「声明在谁身上」区分：
//   1. 自己的卡号条目            —— source = entity
//   2. 容纳它的地点（敌人所在地点）—— source = location，host = 'location'
//   3. 当前幕/议程（全局场景修正）—— source = act/agenda，host = 'scene'
// 条件里的 ctx 因此有 source（声明者）、entity（被修正者）、host 三个读点；
// 例如「此处的每个蛇族敌人 +1 攻击」写在 04072 地点条目上：
//   { target: 'enemyFight', amount: 1, condition: { when: ({ entity }) => hasTrait(entity, 'Serpent') } }
// 地点行只对「位于该地点的敌人」生效，因此不需要在条件里再写一遍地点判断。
// ---------------------------------------------------------------------------

function entityModifierRows(state, entity) {
  const rows = []
  if (!entity) return rows
  // 场景里的敌人/地点可能用别名生成（'ghoulPriest'），印刷卡号在 originalCode 上；
  // 两条都查，别名条目与印刷条目可以各自声明规则。
  const selfCodes = [...new Set([entity.originalCode, entity.code].filter(Boolean))]
  for (const code of selfCodes) {
    const own = modifiersOf(code)
    if (own.length) rows.push({ source: entity, host: 'self', list: own })
  }
  if (entity.location) {
    const location = (state?.locations || []).find(entry => entry.id === entity.location)
    const locationCode = location?.originalCode || location?.code
    const inherited = locationCode ? modifiersOf(locationCode) : []
    if (inherited.length) rows.push({ source: location, host: 'location', list: inherited })
  }
  for (const list of [state?.acts?.[state?.actIndex], state?.agendas?.[state?.agendaIndex]]) {
    const code = list?.originalCode || list?.code
    const scene = code ? modifiersOf(code) : []
    if (scene.length) rows.push({ source: list, host: 'scene', list: scene })
  }
  return rows
}

function entityModifierCtx(state, entity, row) {
  return {
    state, inv: null, controller: null, source: row.source, entity, host: row.host,
    // 内容层不 import 引擎：直接读「有效上限」这类引擎口径的修正走注入的 helpers。
    helpers: {
      maxSanity: inv => hooks.maxSanity(inv),
      remainingSanity: inv => hooks.maxSanity(inv) - (inv?.horror || 0),
    },
  }
}

// 实体数值修正（enemyFight / enemyEvade / enemyHealth / locationShroud / locationClues）。
export function entityModifierTotal(state, entity, target) {
  if (!ENTITY_MODIFIER_TARGETS.includes(target)) {
    throw new Error(`未知实体修正目标 ${JSON.stringify(target)}（可选：${ENTITY_MODIFIER_TARGETS.join(' / ')}）`)
  }
  if (!entity) return 0
  // 文本被涂白时，印刷文本带来的修正一律失效；但 declare 了 blankedThisRound 的
  // 修正本身就是「文本空白后发生的事」（02255 失去 +1[per_investigator] 生命），仍要结算。
  const blanked = hooks.entityBlanked(state, entity)
  let total = 0
  for (const row of entityModifierRows(state, entity)) {
    // 场景行（幕/议程）只提供全局修正，避免把某张幕的「此处」写成全局。
    if (row.host === 'scene' && !['enemyFight', 'enemyEvade', 'enemyHealth'].includes(target)) continue
    for (const modifier of row.list) {
      if (modifier.target !== target) continue
      if (blanked && modifier.condition?.blankedThisRound !== true) continue
      const ctx = entityModifierCtx(state, entity, row)
      if (!evaluateCondition(modifier.condition, ctx)) continue
      total += amountOf(modifier, ctx)
    }
  }
  return total
}

// 实体布尔规则（cannot:attack / cannot:beDefeated / ignore:revealText …）。
export function entityRuleActive(state, entity, target) {
  if (!ENTITY_RULE_TARGETS.includes(target)) {
    throw new Error(`未知实体规则 ${JSON.stringify(target)}（可选：${ENTITY_RULE_TARGETS.join(' / ')}）`)
  }
  if (!entity) return false
  if (hooks.entityBlanked(state, entity)) return false
  for (const row of entityModifierRows(state, entity)) {
    if (row.host === 'scene') continue
    for (const modifier of row.list) {
      if (modifier.target !== target) continue
      const ctx = entityModifierCtx(state, entity, row)
      if (!evaluateCondition(modifier.condition, ctx)) continue
      if (amountOf(modifier, ctx) !== 0) return true
    }
  }
  return false
}

// 审计/AI：某实体当前生效的修正与规则（只读摘要）。
export function describeEntityRules(state, entity) {
  return {
    modifiers: ENTITY_MODIFIER_TARGETS
      .map(target => ({ target, amount: entityModifierTotal(state, entity, target) }))
      .filter(row => row.amount !== 0),
    rules: ENTITY_RULE_TARGETS.filter(rule => entityRuleActive(state, entity, rule)),
  }
}

export function playCostDelta(state, inv, code) {
  let total = 0
  // 来源可以是场上的支援，也可以是手牌里「在手牌中时生效」的卡（如 03142 黑玛瑙扣环）。
  const sources = [
    ...(inv?.assets || []),
    ...(inv?.hand || []).filter(handCode => handCode !== code).map(handCode => ({ id: `hand:${handCode}`, code: handCode, handCode })),
  ]
  for (const source of sources) {
    for (const modifier of modifiersOf(source.code)) {
      if (modifier.target !== 'playCost') continue
      if (!evaluateCondition(modifier.condition, { state, inv, controller: inv, source })) continue
      total += amountOf(modifier, { state, inv, controller: inv, source, cardCode: code })
    }
  }
  return total
}

// 便于测试与审计：列出某张卡当前声明的全部修正。
export function declaredModifiers(code) {
  return modifiersOf(code).map(modifier => ({
    target: modifier.target,
    kind: modifier.kind,
    amount: typeof modifier.amount === 'function' ? '<function>' : modifier.amount,
    value: modifier.value || undefined,
    audience: modifier.audience,
    condition: modifier.condition,
  }))
}

// ---------------------------------------------------------------------------
// C1：布尔修正的读点（capability:* / ignore:*）
//
// 与数值修正共用同一份来源枚举与同一个条件求值器，因此「文本空白」「同地点受益」
// 「效果到期」这些口径不需要在布尔读点里再实现一遍。
// ---------------------------------------------------------------------------

function booleanModifierActive(state, inv, target, { subject = null } = {}) {
  for (const row of modifierSourceRows(state)) {
    for (const modifier of row.list) {
      if (modifier.target !== target) continue
      const ctx = { state, inv, controller: row.controller, source: row.source, effect: row.effect, subject }
      if (!appliesTo(modifier, ctx)) continue
      if (!evaluateCondition(modifier.condition, ctx)) continue
      if (amountOf(modifier, ctx) !== 0) return true
    }
  }
  return false
}

// 「这项能力现在被禁止了吗」。
export function capabilityBlocked(state, inv, capability) {
  if (!BLOCKABLE_CAPABILITIES.includes(capability)) {
    throw new Error(`未知能力 ${JSON.stringify(capability)}（可选：${BLOCKABLE_CAPABILITIES.join(' / ')}）`)
  }
  return booleanModifierActive(state, inv, capabilityTarget(capability))
}

// 「这条规则元素对该调查员无效了吗」。
export function ruleIgnored(state, inv, rule, { subject = null } = {}) {
  if (!IGNORABLE_RULES.includes(rule)) {
    throw new Error(`未知可无视规则 ${JSON.stringify(rule)}（可选：${IGNORABLE_RULES.join(' / ')}）`)
  }
  return booleanModifierActive(state, inv, ignoreTarget(rule), { subject })
}

// 通用入口：参数直接写 'capability:investigate' / 'ignore:retaliate'。
// 一次性汇总点，供审计与 AI 上下文展示「你为什么不能做这个」。
export function modifierBlocked(state, inv, target) {
  const kind = modifierTargetKind(target)
  if (kind !== 'capability' && kind !== 'ignore') {
    throw new Error(`modifierBlocked 只接受 capability:* / ignore:*（收到 ${JSON.stringify(target)}）`)
  }
  return booleanModifierActive(state, inv, target)
}

// 当前对某个调查员生效的全部能力禁止 / 规则无视（供审计与展示）。
export function blockedCapabilities(state, inv) {
  const out = []
  for (const capability of BLOCKABLE_CAPABILITIES) if (capabilityBlocked(state, inv, capability)) out.push(capability)
  for (const rule of IGNORABLE_RULES) if (ruleIgnored(state, inv, rule)) out.push(`ignore:${rule}`)
  return out
}

// ---------------------------------------------------------------------------
// C2：授予读点（add:trait / add:keyword / add:slot / add:skillIcon）
//
// 授予是"卡在运行期获得卡面数据之外的东西"。读点返回 Set<string>，
// 引擎在对应位置合并（特性判定、关键词判定、槽位计算、技能图标计数）。
// ---------------------------------------------------------------------------

const GRANT_KINDS = Object.freeze({
  trait: 'add:trait',
  keyword: 'add:keyword',
  slot: 'add:slot',
  skillIcon: 'add:skillIcon',
})

export function collectGrants(state, inv, kind, { code = null } = {}) {
  const target = GRANT_KINDS[kind]
  if (!target) throw new Error(`未知授予类型 ${JSON.stringify(kind)}（可选：${Object.keys(GRANT_KINDS).join(' / ')}）`)
  const out = new Set()
  for (const row of modifierSourceRows(state)) {
    // code 过滤：授予是"这张卡自己获得某特性/图标"，因此来源必须就是那张卡。
    // 持续效果的来源是效果记录，它的卡号在 sourceCode 上（A1 与 C2 的两个来源形状不同）。
    if (code != null && (row.source?.code ?? row.source?.sourceCode) !== code) continue
    for (const modifier of row.list) {
      if (modifier.target !== target || !modifier.value) continue
      const ctx = { state, inv, controller: row.controller, source: row.source, effect: row.effect }
      if (!appliesTo(modifier, ctx)) continue
      if (!evaluateCondition(modifier.condition, ctx)) continue
      if (amountOf(modifier, ctx) === 0) continue
      out.add(modifier.value)
    }
  }
  return out
}
