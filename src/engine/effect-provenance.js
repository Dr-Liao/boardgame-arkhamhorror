// effect-provenance.js · 效果来源 provenance（进程内帧，不写 state）
//
// 为什么要它：印斯茅斯的沉睡 bosses（07292a/07330a/07331a 等）印着「不能攻击、不能与调查员
// 交战、免疫调查员行动和玩家卡牌效果」，但剧本地点/密谋造成的自动躲避、横置、翻面仍要生效。
// 引擎必须能回答「现在这条效果来自哪张卡、是哪一类来源」，而不是拿 actor 座位、阵营或敌人
// 检定里的展示卡当来源。
//
// 权威口径（来自参考实现 Arkham/Helpers/Source.hs）：
//   · AssetSource / EventSource / SkillSource / InvestigatorSource 都是玩家卡来源，
//     与阵营、控制者无关；**无人控制的剧情资产（story）也算玩家卡来源**；
//   · 嵌套的 AbilitySource / PaymentSource 要还原到真正的来源，而不是外层动作；
//   · 被取消/跳过的分支不改变来源栈。
//
// 状态形状：帧存在进程内 WeakMap（键是 state），**不写 state 字段**，因此不改变存档与
// 重放指纹；只有真正参与结算的来源才入栈，未知/无法分类时返回 null（调用方决定 fail-closed）。
//
// 读点：
//   currentEffectSource(state)                     —— 当前来源（无则 null）
//   withEffectSource(state, raw, resolve)          —— 以某个来源执行一段结算（可嵌套）
//   cardEffectSource(state, source, descriptor…)   —— 由实体实例 + 描述子算来源
//   enemyIsSlumbering / enemyEffectAllowed         —— 沉睡敌人的免疫读点
//
// 约定：不按 actor 座位、不按 trait/阵营、不按「敌人检定里拿到的卡」推断来源。

const frames = new WeakMap()

const KINDS = new Set(['basicAction', 'playerCard', 'encounterCard', 'scenarioRule'])
// 玩家卡来源：注意 'story'（剧情资产）也在这里——无人控制的剧情资产同样是玩家卡效果。
const PLAYER_TYPES = new Set(['asset', 'event', 'skill', 'investigator', 'story'])
// 非玩家/遭遇来源：敌人、地点、幕、密谋、诡计、剧本参考卡。
const ENCOUNTER_TYPES = new Set(['enemy', 'location', 'act', 'agenda', 'treachery', 'scenario', 'enemy_location'])

/** 卡面 type → 来源类别；未知类型返回 null（不猜）。 */
export function effectSourceKindOfType(type) {
  if (PLAYER_TYPES.has(type)) return 'playerCard'
  if (ENCOUNTER_TYPES.has(type)) return 'encounterCard'
  return null
}

/** 规范化一条来源；缺 kind 或未知 kind 直接拒绝（调用方必须给出真实类别）。 */
export function normalizeEffectSource(raw) {
  if (!raw || !KINDS.has(raw.kind)) throw new TypeError('Missing authoritative effect source')
  return Object.freeze({
    kind: raw.kind,
    code: raw.code == null ? null : String(raw.code),
    sourceId: raw.sourceId == null ? null : String(raw.sourceId),
    controllerSeat: Number.isInteger(raw.controllerSeat) ? raw.controllerSeat : null,
  })
}

/**
 * 由「正在结算的描述子 + 它的实体实例」算出来源。
 * 分类只认卡面 type（含剧情资产）；分类不出来返回 null，绝不退回 actor 座位。
 * 显式 `source.effectSource` 优先（转账/嵌套原语可以把真实来源带下来）。
 */
export function cardEffectSource(state, source, descriptor, inv, { cardDef } = {}) {
  if (source?.effectSource) return normalizeEffectSource(source.effectSource)
  const code = descriptor?.code || source?.originalCode || source?.code
  const def = code && typeof cardDef === 'function' ? cardDef(code) : null
  const kind = effectSourceKindOfType(def?.type)
  if (!kind) return null
  // 控制者只对「有主的支援」有意义；剧情资产/事件没有控制者时为 null，不拿座位顶替。
  const owner = (state?.investigators || []).find(other =>
    (other.assets || []).some(item => item.id && item.id === source?.id))
  return normalizeEffectSource({
    kind,
    code,
    sourceId: source?.id ?? null,
    controllerSeat: owner ? owner.seat : (source?.controllerSeat ?? inv?.seat ?? null),
  })
}

/** 当前结算来源；没有帧就是 null。 */
export function currentEffectSource(state) {
  return frames.get(state)?.source || null
}

/** 以某来源执行一段结算；来源为 null 时不入栈（等价于「来源未知」）。 */
export function withEffectSource(state, raw, resolve) {
  if (typeof resolve !== 'function') throw new TypeError('withEffectSource needs a resolver')
  const source = raw ? normalizeEffectSource(raw) : null
  if (!source) return resolve()
  const previous = frames.get(state) || null
  frames.set(state, { source, parent: previous })
  try {
    return resolve()
  } finally {
    if (previous) frames.set(state, previous)
    else frames.delete(state)
  }
}

/** 当前来源是否玩家卡效果（含剧情资产）。来源未知时返回 false。 */
export function effectSourceIsPlayer(state) {
  return currentEffectSource(state)?.kind === 'playerCard'
}

// ---------------------------------------------------------------- 沉睡敌人

const SLUMBERING_OPS = new Set(['initiateAttack', 'engage', 'fightAction', 'evadeAction'])

/**
 * 沉睡判定读**当前印刷面**的条目（`enemyRule.slumbering`），不写 per-enemy 标记：
 * 换面/文本被抹除后立即失效，与印刷行为一致。
 */
export function enemyIsSlumbering(state, enemy, { entryOf, isBlanked } = {}) {
  if (!enemy) return false
  if (typeof isBlanked === 'function' && isBlanked(state, enemy)) return false
  const entry = typeof entryOf === 'function' ? entryOf(enemy.originalCode || enemy.code) : null
  return entry?.enemyRule?.slumbering === true
}

/**
 * 沉睡敌人的效果过滤：调查员行动与玩家卡效果一律不生效；剧本地点/密谋/遭遇来源照常。
 * 来源未知时 fail-closed（沉睡 beast 宁可不响应，也不让玩家效果漏进去）。
 * originOverride 只给引擎内部的合法目标枚举用，绝不从玩家命令字段取值。
 */
export function enemyEffectAllowed(state, enemy, operation, deps = {}, originOverride = null) {
  if (!enemyIsSlumbering(state, enemy, deps)) return true
  if (SLUMBERING_OPS.has(operation)) return false
  const origin = originOverride || currentEffectSource(state)
  if (!origin) return false
  if (origin.kind === 'playerCard') return false
  if (origin.kind === 'basicAction' && operation === 'damage') return false
  return true
}

/**
 * 动态修正行也要看**那一行自己的来源**，不能用当前帧顶替；旧式记录只有 sourceCode 时
 * 只按卡号分类，分类不出来就 fail-closed（沉睡目标宁可不加成）。
 */
export function enemyModifierAllowed(state, enemy, row, deps = {}) {
  if (!enemyIsSlumbering(state, enemy, deps)) return true
  let origin = row?.effectSource || row?.effect?.effectSource || null
  if (!origin) {
    const source = row?.source || row?.effect
    const code = source?.sourceCode || source?.originalCode || source?.code
    const def = code && typeof deps.cardDef === 'function' ? deps.cardDef(code) : null
    const kind = effectSourceKindOfType(def?.type)
    if (!kind) return false
    origin = { kind, code, sourceId: null, controllerSeat: null }
  }
  return normalizeEffectSource(origin).kind !== 'playerCard'
}
