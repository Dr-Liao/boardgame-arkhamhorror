// 诡镇奇谈：卡牌版 · 持续效果实体（缺口 A1，Phase 1）
//
// 此前的症状：没有 Effect 实体。"直到本阶段结束"全靠手写 `inv.phaseStatBonus`
// 并指望某处记得清除；临时修正不进存档、不可枚举，replay 也覆盖不到。
//
// 本模块把「一个有时长的效果」变成 state 里的记录：
//   state.effects = [{
//     id, sourceCode, sourceInstanceId, controllerSeat,
//     duration: 'endOfTest' | 'endOfTurn' | 'endOfPhase' | 'endOfRound'
//             | 'whilstAttached' | 'untilLeavesPlay',
//     label, modifiers: [...], abilities: [...], createdAt: { round, phase, turnSerial },
//   }]
//
// 三条约定：
//   1. 记录只写进 state，纯 JSON，随存档往返；重放时由同一串动作产生，不需要额外快照。
//   2. 过期只有一个入口 `expireEffects(state, timing)`：时长链 endOfTest < endOfTurn <
//      endOfPhase < endOfRound，到点连同「更短的」一起清掉，避免漏钩子时留下僵尸修正。
//   3. 修正由 modifiers.js 的读点读取；能力由引擎的 descriptorSources 枚举——
//      两条读点都只读 activeEffects()，没有第二份缓存。
//
// 来源绑定（whilstAttached / untilLeavesPlay）：效果记录带 sourceInstanceId，
// 支援离场时引擎调用 removeEffectsFromSource()，读到「来源已不在场」也会顺手清理。

import { nextInstanceId } from './rules-state.js'
import { normalizeTrigger } from './windows.js'
import { modifierTargetKind } from './modifiers.js'

// 与 ability.js 的 LIMITS 同集合；效果能力沿用同一套上限记账。
const LIMIT_VALUES = new Set(['oncePerTest', 'oncePerPhase', 'oncePerRound', 'oncePerTurn', 'oncePerGame'])

export const EFFECT_DURATIONS = Object.freeze([
  'endOfAction', 'endOfTest', 'endOfTurn', 'endOfPhase', 'endOfRound', 'whilstAttached', 'untilLeavesPlay',
])

// 时长链：在 timing 过期时，把「等长或更短」的时长一起清掉。
const DURATION_ORDER = Object.freeze({
  endOfAction: 0,
  endOfTest: 1,
  endOfTurn: 2,
  endOfPhase: 3,
  endOfRound: 4,
})

export const EFFECT_DURATION_LABELS = Object.freeze({
  endOfAction: '本次行动结束',
  endOfTest: '本次检定结束',
  endOfTurn: '本回合结束',
  endOfPhase: '本阶段结束',
  endOfRound: '本轮结束',
  whilstAttached: '附属期间',
  untilLeavesPlay: '直到离场',
})

// 效果记录里的能力与卡片描述子共享窗口/条件/上限语义，但**必须是纯 JSON**：
// state.effects 随存档往返、参与 stateHash、还要能重放，所以只能带 `effect` 数据体，
// 不能带 resolve 闭包（上一版试过，事务 JSON 克隆会把函数悄悄丢掉）。
const EFFECT_ABILITIES_KEYS = new Set(['kind', 'trigger', 'label', 'effect', 'criteria', 'cost', 'limit'])
const EFFECT_ABILITY_KINDS = new Set(['reaction', 'forced'])
const EFFECT_KEYS = new Set(['duration', 'sourceCode', 'sourceInstanceId', 'controllerSeat', 'label',
  'modifiers', 'abilities', 'createdAt'])
// Phase 2（C1/C2）：布尔修正与授予类修正也可以挂在持续效果上，因此 value 与 target 的超集
// 一起进入白名单；具体目标是否已知由 modifiers.js 的 normalizeModifier 判定（单一事实源）。
const MODIFIER_KEYS = new Set(['target', 'amount', 'condition', 'audience', 'value'])
const MAX_EFFECTS = 200

function assertKnownKeys(object, allowed, origin) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw new Error(`${origin}: 未知字段 ${key}`)
  }
}

function normalizeModifierRecord(raw, origin) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${origin}: 修正必须是对象`)
  assertKnownKeys(raw, MODIFIER_KEYS, origin)
  if (typeof raw.target !== 'string' || !raw.target) throw new Error(`${origin}: 修正缺少 target`)
  // Phase 2（C1/C2）：布尔修正（capability:/ignore:）与授予修正（add:*）可以省略 amount，
  // 但目标本身仍要在 modifiers.js 的已知集合里——否则效果会在读点静默失效。
  const kind = modifierTargetKind(raw.target)
  if (!kind) throw new Error(`${origin}: 未知修正目标 ${JSON.stringify(raw.target)}`)
  if (kind === 'grant' && raw.value == null) throw new Error(`${origin}: ${raw.target} 必须声明 value`)
  const amount = raw.amount ?? 1
  if (typeof amount !== 'number' && typeof amount !== 'function') {
    throw new Error(`${origin}: 修正 amount 必须是数字或函数`)
  }
  return Object.freeze({ ...raw, amount })
}

// 描述子里的 `effect:` 字段在效果实体上叫 abilities；这里规范化成「窗口可枚举的纯数据描述子」，
// 结构对齐 ability.js 的 normalizeDescriptor，但 reject 闭包（见上面的约束注释）。
function normalizeEffectAbilities(rawList, origin, code, effectId) {
  if (rawList == null) return Object.freeze([])
  if (!Array.isArray(rawList)) throw new Error(`${origin}: abilities 必须是数组`)
  return Object.freeze(rawList.map((raw, index) => {
    const abilityOrigin = `${origin} 的 abilities[${index}]`
    if (!raw || typeof raw !== 'object') throw new Error(`${abilityOrigin} 必须是对象`)
    if (typeof raw.resolve === 'function') {
      throw new Error(`${abilityOrigin}: 效果能力不能带 resolve——state.effects 随存档往返，只能写 effect 数据`)
    }
    assertKnownKeys(raw, EFFECT_ABILITIES_KEYS, abilityOrigin)
    if (!EFFECT_ABILITY_KINDS.has(raw.kind)) {
      throw new Error(`${abilityOrigin}: 效果能力只支持 ${[...EFFECT_ABILITY_KINDS].join(' / ')}（收到 ${JSON.stringify(raw.kind)}）`)
    }
    if (!raw.label) throw new Error(`${abilityOrigin}: 缺少 label`)
    const trigger = normalizeTrigger(raw.trigger)
    if (!trigger.length) throw new Error(`${abilityOrigin}: ${raw.kind} 必须声明 trigger`)
    if (!raw.effect || typeof raw.effect !== 'object') {
      throw new Error(`${abilityOrigin}: 缺少 effect（效果解释器的纯数据描述）`)
    }
    if (raw.limit != null && !LIMIT_VALUES.has(raw.limit)) throw new Error(`${abilityOrigin}: 未知 limit ${raw.limit}`)
    return Object.freeze({
      id: `effect:${effectId}#${index}`,
      code,
      index,
      kind: raw.kind,
      label: String(raw.label),
      text: null,
      trigger,
      criteria: raw.criteria ?? null,
      target: null,
      cost: Object.freeze({ ...(raw.cost || {}) }),
      limit: raw.limit || null,
      fromHand: false,
      noPlayCost: true,
      duringOwnSkillTest: false,
      requiresNoClues: false,
      maximumInvestigatorDamage: null,
      effect: raw.effect,
      skill: null,
      weakness: null,
      entersPlay: null,
      leavesPlay: null,
      source: 'effect',
      simplified: false,
      note: null,
      resolve: null,
    })
  }))
}

export function effectList(state) {
  return state?.effects || []
}

// 读点：行动中的效果（未过期）。过期记录会被 expireEffects 直接移除，
// 所以这里不需要再过滤时间戳。
export function activeEffects(state, seat = null) {
  const list = effectList(state)
  if (seat == null) return list
  return list.filter(effect => effect.controllerSeat === seat)
}

/**
 * 创建一条持续效果。
 * @param {object} state 权威状态（会被原地追加 effects）
 * @param {object} raw { duration, sourceCode?, sourceInstanceId?, controllerSeat?, label?, modifiers?, abilities? }
 * @returns {object} 冻结后的效果记录（也已在 state.effects 里）
 */
export function createEffect(state, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('效果必须是对象')
  const origin = `效果 ${raw.sourceCode || raw.label || '<无来源>'}`
  assertKnownKeys(raw, EFFECT_KEYS, origin)
  if (!EFFECT_DURATIONS.includes(raw.duration)) {
    throw new Error(`${origin}: 未知 duration ${JSON.stringify(raw.duration)}（可选：${EFFECT_DURATIONS.join(' / ')}）`)
  }
  const controllerSeat = raw.controllerSeat ?? state.currentSeat
  if (!Number.isInteger(controllerSeat)) throw new Error(`${origin}: 缺少 controllerSeat`)
  state.effects ||= []
  if (state.effects.length >= MAX_EFFECTS) throw new Error(`${origin}: 效果记录超过 ${MAX_EFFECTS} 条，可能存在未过期/重复叠加`)
  const modifiers = (raw.modifiers || []).map((modifier, index) =>
    normalizeModifierRecord(modifier, `${origin} 的 modifiers[${index}]`))
  // 能力 id 用效果实例 id（而不是卡号）：同一张卡产生的两条效果各自有一次上限。
  // 先校验再取号，避免校验失败也消耗实例序号。
  const pendingId = `f${(state.instanceSeq?.f || 0) + 1}`
  const abilities = normalizeEffectAbilities(raw.abilities, origin, raw.sourceCode || 'effect', pendingId)
  const id = nextInstanceId(state, 'f')
  const record = Object.freeze({
    id,
    sourceCode: raw.sourceCode || null,
    sourceInstanceId: raw.sourceInstanceId || null,
    controllerSeat,
    duration: raw.duration,
    label: raw.label ? String(raw.label) : null,
    modifiers: Object.freeze(modifiers),
    abilities,
    createdAt: {
      round: state.round ?? 0,
      phase: state.phase ?? null,
      turnSerial: state.turnSerial ?? 0,
    },
  })
  state.effects.push(record)
  return record
}

// 修正读点：modifiers.js 只关心「谁在什么条件下加多少」。
export function effectModifiers(state) {
  const rows = []
  for (const effect of activeEffects(state)) {
    for (const modifier of effect.modifiers || []) rows.push({ modifier, effect })
  }
  return rows
}

// 能力读点：引擎的 descriptorSources 用它把效果上的反应/强制能力挂进窗口。
export function effectAbilitySources(state, seat) {
  const rows = []
  for (const effect of activeEffects(state, seat)) {
    if (!effect.abilities?.length) continue
    rows.push({ effect, abilities: effect.abilities })
  }
  return rows
}

function sourceStillThere(state, effect) {
  if (!effect.sourceInstanceId) return true
  for (const inv of state?.investigators || []) {
    if ((inv.assets || []).some(card => card.id === effect.sourceInstanceId)) return true
    if ((inv.threat || []).some(card => card.id === effect.sourceInstanceId)) return true
  }
  return false
}

/**
 * 统一过期点：时长链上不晚于 timing 的效果在这里被移除。
 * 同时清理「来源已不在场」的 whilstAttached / untilLeavesPlay 记录。
 * @returns {object[]} 被移除的记录（供日志/测试断言）
 */
export function expireEffects(state, timing) {
  if (!state?.effects?.length) return []
  const order = DURATION_ORDER[timing]
  const removed = []
  state.effects = state.effects.filter(effect => {
    const bound = DURATION_ORDER[effect.duration] == null
    const expired = bound
      ? !sourceStillThere(state, effect)
      : (order != null && DURATION_ORDER[effect.duration] <= order)
    if (expired) removed.push(effect)
    return !expired
  })
  return removed
}

// 来源离场：显式清掉绑定到这张卡的效果（leaveAsset 调用）。
export function removeEffectsFromSource(state, sourceInstanceId) {
  if (!state?.effects?.length || !sourceInstanceId) return []
  const removed = []
  state.effects = state.effects.filter(effect => {
    if (effect.sourceInstanceId !== sourceInstanceId) return true
    removed.push(effect)
    return false
  })
  return removed
}

// 场景切换/重开时清空（不写日志：调用方负责说明）。
export function clearEffects(state) {
  if (!state?.effects?.length) return []
  const removed = state.effects
  state.effects = []
  return removed
}

// 审计/测试：当前效果的稳定摘要（不含函数）。
export function describeEffects(state) {
  return activeEffects(state).map(effect => ({
    id: effect.id,
    sourceCode: effect.sourceCode,
    duration: effect.duration,
    label: effect.label,
    modifiers: (effect.modifiers || []).map(modifier => ({
      target: modifier.target,
      amount: typeof modifier.amount === 'function' ? '<function>' : modifier.amount,
    })),
    abilities: (effect.abilities || []).map(ability => ability.kind),
  }))
}
