// 食梦者（The Dream-Eaters）· 两套基础混乱袋与共享取值工具（P8 战役层）。
//
// 事实源：参考实现 `Campaigns/TheDreamEaters/ChaosBag.hs`（CB:8-42）——
//   · A 线（The Dream-Quest）**没有 Skull、没有 ElderThing**，固定带 Cultist + 2×Tablet；
//   · B 线（The Web of Dreams）**没有 Tablet**，固定带 2×Skull + Cultist + 2×ElderThing；
//   · ElderThing / Tablet 的跨线增删换由三幕间（`interludes.js` 的 effects）动态执行。
// 逐章符号取值（`getChaosTokenValue` / 揭示与检定后果）在参考实现里分散在
// `Scenario/Scenarios/TheDreamEaters/<章>.hs`；本仓库按 TCU 实践放到各章的
// `scenarios/<章>/chaos.js`（随章节走、可独立测试）。本模块只提供**共享读点与工具**：
// 基础袋、难度分组、当前/两袋的增删换、以及逐章「哪些符号在本章有专门取值」的对照表。
//
// 内容层可以 import 引擎模块（TCU 的 tcu-chaos.js 已 import changeChaosBag），
// 引擎绝不反向 import 本文件。token 面值与引擎一致：`+1`/`0`/`-1`…、`skull`/`cultist`/
// `tablet`/`elderthing`/`autofail`/`eldersign`（小写、无下划线）。
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
import { mutateBothBags } from '../../../src/campaign/campaign-parts.js'

export const TDE_BAG_DIFFICULTIES = Object.freeze(['easy', 'standard', 'hard', 'expert'])

// 两套基础袋（顺序即参考实现的字面量顺序；难度键对齐引擎的 state.difficulty）。
// Easy 一档在 P8 任务口径里未点名，但参考实现完整给出（CB:10-13 / CB:27-30），
// 一并登记，避免 easy 难度回落成别的循环的袋。
export const TDE_CHAOS_BAGS = Object.freeze({
  A: Object.freeze({
    easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-2', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
    standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
    hard: Object.freeze(['0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
    expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-4', '-4', '-5', '-6', '-8', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
  }),
  B: Object.freeze({
    easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', 'skull', 'skull', 'cultist', 'elderthing', 'elderthing', 'autofail', 'eldersign']),
    standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'elderthing', 'elderthing', 'autofail', 'eldersign']),
    hard: Object.freeze(['0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'skull', 'skull', 'cultist', 'elderthing', 'elderthing', 'autofail', 'eldersign']),
    expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', 'skull', 'skull', 'cultist', 'elderthing', 'elderthing', 'autofail', 'eldersign']),
  }),
})

// `manifest.chaosBags` 的兼容形状：内容 schema 只接受「难度 → token 数组」的扁平表，
// 而 TDE 真正的两袋按线区分。manifest 用 A 袋作未选线前的默认表（单线 A 建局即正确；
// 单线 B / 双线由序章或章节 setup 用 `baseBagFor('B', difficulty)` 安装），
// 两袋完整表在 `manifest.partChaosBags` 里随内容下发。
export const TDE_DEFAULT_CHAOS_BAGS = TDE_CHAOS_BAGS.A

/** 引擎认识的所有 token 面值（含符号）。 */
export const CHAOS_TOKEN_FACES = Object.freeze([
  '+1', '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
  'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign', 'bless', 'curse',
])

const SYMBOL_ALIASES = Object.freeze({
  elderThing: 'elderthing',
  elder_thing: 'elderthing',
  elder_sign: 'eldersign',
  elderSign: 'eldersign',
  auto_fail: 'autofail',
  autoFail: 'autofail',
})

export function normalizeChaosToken(token) {
  const raw = String(token ?? '').trim()
  return SYMBOL_ALIASES[raw] || raw.toLowerCase()
}

/** 取某个难度档的组名；未知难度回落 standard。 */
export function difficultyOf(state) {
  return TDE_BAG_DIFFICULTIES.includes(state?.difficulty) ? state.difficulty : 'standard'
}

export const hardSide = state => ['hard', 'expert'].includes(difficultyOf(state))
export const easySide = state => !hardSide(state)

/** 两段取值（简单/普通 vs 困难/专家）；章节 chaos.js 的常规写法。 */
export function byDifficulty(state, easyValue, hardValue) {
  return hardSide(state) ? hardValue : easyValue
}

/** 按人数缩放（数字段）。 */
export function perInvestigator(state, easyValue, hardValue = easyValue) {
  return (hardSide(state) ? hardValue : easyValue) * (Number(state?.numInvestigators) || 1)
}

/** 某条线某难度的基础袋（返回副本，调用方可继续增删）。 */
export function baseBagFor(part, difficulty = 'standard') {
  const bag = TDE_CHAOS_BAGS[part]
  if (!bag) throw new Error(`未知战役线：${String(part)}`)
  const tokens = bag[TDE_BAG_DIFFICULTIES.includes(difficulty) ? difficulty : 'standard']
  return [...tokens]
}

/** 某条线某难度的固定符号张数（测试与 setup 对账用）。 */
export function symbolCountsFor(part, difficulty = 'standard') {
  const counts = {}
  for (const token of baseBagFor(part, difficulty)) counts[token] = (counts[token] || 0) + 1
  return counts
}

// scenarioRuntime.resolveChaosToken 只消费这些字段：delta / autoFail / drawAnother / onDraw / onFail。
export const chaosFx = (delta, extra = {}) => ({ delta, ...extra })

/** 当前活动袋里某个 token 的张数。 */
export function chaosTokenCount(state, token) {
  const face = normalizeChaosToken(token)
  return (state?.chaosBag || []).filter(value => value === face).length
}

/**
 * 往当前活动线袋里加 token。
 * `permanent=false`（默认）只改本局，true 同时写战役袋（跨章保留，幕间效果）。
 */
export function addChaosToken(state, token, amount = 1, { permanent = false } = {}) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('加入混乱标记的数量必须是正整数')
  changeChaosBag(state, normalizeChaosToken(token), amount, { permanent })
}

/** 从当前活动线袋里移除 token（不足会抛错，与引擎 changeChaosBag 一致）。 */
export function removeChaosToken(state, token, amount = 1, { permanent = false } = {}) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('移除混乱标记的数量必须是正整数')
  changeChaosBag(state, normalizeChaosToken(token), -amount, { permanent })
}

/**
 * 替换当前活动线袋里的一个符号：from → to（例如幕间的 ElderThing→Tablet）。
 * 袋里没有 from 时抛错（调用方应先查 `chaosTokenCount`，或用 `swapChaosTokensInBoth` 的容错版）。
 */
export function swapChaosTokens(state, from, to, { permanent = false } = {}) {
  const source = normalizeChaosToken(from)
  const target = normalizeChaosToken(to)
  changeChaosBag(state, source, -1, { permanent })
  changeChaosBag(state, target, 1, { permanent })
  return { from: source, to: target }
}

/** 按难度取符号修正：`tokenValue(state, { standard: -2, hard: -3 })` 这类表的便捷读点。 */
export function tokenValue(state, values) {
  return values?.[difficultyOf(state)] ?? values?.standard ?? 0
}

// ---------------------------------------------------------------------------
// 双线袋：三幕间的跨线增删换（等价参考实现的 pushBoth AddChaosToken / SwapChaosToken /
// RemoveChaosToken）。走 campaign-parts 的 `mutateBothBags`：当前线直接改顶层，
// 另一线写 parts 快照，并把当前线的 bag 与 campaign.chaosBag 同步。
// ---------------------------------------------------------------------------

/** 两条线的袋同时加 token；返回两条线的新袋。 */
export function addChaosTokenToBoth(state, token, amount = 1) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('加入混乱标记的数量必须是正整数')
  const face = normalizeChaosToken(token)
  return mutateBothBags(state, bag => {
    for (let n = 0; n < amount; n += 1) bag.push(face)
    return bag
  })
}

/** 两条线的袋同时移除 token（容错：没有就跳过）；返回实际移除张数 `{ A, B }`。 */
export function removeChaosTokenFromBoth(state, token, amount = 1) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('移除混乱标记的数量必须是正整数')
  const face = normalizeChaosToken(token)
  const removed = {}
  mutateBothBags(state, (bag, part) => {
    for (let n = 0; n < amount; n += 1) {
      const index = bag.indexOf(face)
      if (index < 0) break
      bag.splice(index, 1)
      removed[part] = (removed[part] || 0) + 1
    }
    return bag
  })
  return { A: removed.A || 0, B: removed.B || 0 }
}

/** 两条线的袋同时替换一个符号（容错：该线没有 from 就跳过）；返回两条线各自是否替换。 */
export function swapChaosTokensInBoth(state, from, to) {
  const source = normalizeChaosToken(from)
  const target = normalizeChaosToken(to)
  const swapped = {}
  mutateBothBags(state, (bag, part) => {
    const index = bag.indexOf(source)
    if (index < 0) return bag
    bag.splice(index, 1, target)
    swapped[part] = true
    return bag
  })
  return { A: Boolean(swapped.A), B: Boolean(swapped.B), from: source, to: target }
}

/** 读某条线的袋（当前线读顶层，非活动线读 parts 快照）。 */
export function chaosBagOfPart(state, part) {
  if (!state?.campaign) throw new Error('chaosBagOfPart 需要带 campaign 的状态')
  if ((state.campaign.currentPart ?? null) === part) return state.campaign.chaosBag || []
  return state.campaign.parts?.[part]?.chaosBag || []
}

// ---------------------------------------------------------------------------
// 逐章符号表：哪些符号在哪些章有专门取值（§3.3）。
// 具体数值/揭示后果在章节 chaos.js；这里只给章节作者与测试一个稳定的对照表，
// 防止把 A 线章也写出 ElderThing 取值、或把 B 线章写出 Tablet 取值。
// 兼容标签：`tablet` = 混乱袋里的 Tablet 符号（中文规则书「石板」）。
// ---------------------------------------------------------------------------
export const TDE_CHAPTER_SYMBOLS = Object.freeze({
  beyondTheGatesOfSleep: Object.freeze({ part: 'A', symbols: Object.freeze(['skull', 'cultist', 'tablet']) }),
  wakingNightmare: Object.freeze({ part: 'B', symbols: Object.freeze(['skull', 'cultist', 'elderthing']) }),
  theSearchForKadath: Object.freeze({ part: 'A', symbols: Object.freeze(['skull', 'cultist', 'tablet', 'elderthing']) }),
  aThousandShapesOfHorror: Object.freeze({ part: 'B', symbols: Object.freeze(['skull', 'cultist', 'tablet', 'elderthing']) }),
  darkSideOfTheMoon: Object.freeze({ part: 'A', symbols: Object.freeze(['skull', 'cultist', 'tablet', 'elderthing']) }),
  pointOfNoReturn: Object.freeze({ part: 'B', symbols: Object.freeze(['skull', 'cultist', 'tablet', 'elderthing']) }),
  whereTheGodsDwell: Object.freeze({ part: 'A', symbols: Object.freeze(['skull', 'cultist', 'tablet', 'elderthing']) }),
  weaverOfTheCosmos: Object.freeze({ part: 'B', symbols: Object.freeze(['skull', 'cultist', 'tablet', 'elderthing']) }),
})

/** 某章是否有某个符号的专门取值（ElderSign 一律走默认，不在此表）。 */
export function chapterHasSymbol(scenarioId, token) {
  return Boolean(TDE_CHAPTER_SYMBOLS[scenarioId]?.symbols?.includes(normalizeChaosToken(token)))
}
