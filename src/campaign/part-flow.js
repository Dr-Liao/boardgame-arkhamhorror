// 《食梦者》双线战役流程生成器（P5 批次 1）：章对门（partGate）+ 单线/双线流。
//
// 口径：docs/tde-migration-roadmap.md §7.2.2「配对屏障」与 §1.4「四对配对」：
//   · 每一对（A1/B1、A2/B2、A3/B3、A4/B4）都要两边完成才进幕间；
//   · 同一对里可以先 A 也可以先 B —— 开局 + 3 次幕间 = 16 种合法排列；
//   · 单线（singleA / singleB）只跑自己那 4 章，章间读幕间，不进双线矩阵。
//
// 本模块只生成**可序列化的 flow 数据**（纯数据、无函数、无 engine 依赖）：
//   · `partGate` 节点：本对的章都完成 → 走 `next`（幕间/结局）；只有一个未完成 → 自动进入；
//     两个都未完成 → 由玩家选择先手（`walkCampaign` 里的 partGate 分支）。
//   · manifest.parts 的形状（§8.3）：
//       { A: { name, chapters: [{ scenarioId, pair?, name? } | 'scenarioId' ] }, B: { … } }
//
// 生成结果由 `campaignGraph`（src/campaign/campaign-flow.js）直接消费；P8 的战役 manifest
// 用 `partFlow(manifest, { mode })` 写进 `manifest.flow`。

export const PART_GATE = 'partGate'

const PARTS = ['A', 'B']

/** 归一化 chapters：允许字符串数组或 {scenarioId,pair,name} 数组。 */
function normalizeChapters(part, value) {
  if (!Array.isArray(value)) throw new Error(`战役 parts.${part}.chapters 必须是数组`)
  return value.map((chapter, index) => {
    const scenarioId = typeof chapter === 'string' ? chapter : chapter?.scenarioId
    if (!scenarioId) throw new Error(`战役 parts.${part}.chapters[${index}] 缺少 scenarioId`)
    const pair = Number.isInteger(chapter?.pair) ? chapter.pair : index + 1
    if (pair < 1) throw new Error(`战役 parts.${part}.chapters[${index}] 的 pair 必须是正整数`)
    return { scenarioId: String(scenarioId), pair, name: chapter?.name ? String(chapter.name) : String(scenarioId) }
  })
}

/**
 * 把 manifest.parts 归一化成按章对排列的列表：
 *   [{ pair: 1, A: { scenarioId, name }, B: { scenarioId, name } }, …]
 * 校验：两侧章对数相同、同一 pair 恰好各一章、pair 从 1 连续。
 */
export function normalizePartPairs(parts) {
  if (!parts || typeof parts !== 'object') throw new Error('战役没有声明 parts')
  const byPart = {}
  for (const part of PARTS) byPart[part] = normalizeChapters(part, parts[part]?.chapters)
  const pairCount = byPart.A.length
  if (byPart.B.length !== pairCount) throw new Error(`战役 parts 的 A/B 章对数不一致：${byPart.A.length} / ${byPart.B.length}`)
  if (pairCount < 1) throw new Error('战役 parts 至少需要一章对')
  const pairs = []
  for (let pair = 1; pair <= pairCount; pair += 1) {
    const a = byPart.A.filter(chapter => chapter.pair === pair)
    const b = byPart.B.filter(chapter => chapter.pair === pair)
    if (a.length !== 1 || b.length !== 1) throw new Error(`第 ${pair} 对必须 A/B 各恰好一章（收到 ${a.length} / ${b.length}）`)
    pairs.push(Object.freeze({ pair, A: a[0], B: b[0] }))
  }
  if (byPart.A.some(chapter => chapter.pair > pairCount) || byPart.B.some(chapter => chapter.pair > pairCount)) {
    throw new Error(`章对的 pair 必须从 1 连续（共 ${pairCount} 对）`)
  }
  const all = [...byPart.A, ...byPart.B].map(chapter => chapter.scenarioId)
  if (new Set(all).size !== all.length) throw new Error('同一关卡不能同时属于多个章对/线')
  return Object.freeze(pairs)
}

/**
 * 双线流程：每个章对一个 partGate，场景结算后回到本对的 gate。
 * 两章都完成后进入幕间（最后一对直接进 end）。
 */
export function dualPartFlow(parts) {
  const pairs = normalizePartPairs(parts)
  const nodes = {}
  const gateId = pair => `gate${pair}`
  const interludeId = pair => `interlude${pair}`
  for (const entry of pairs) {
    const last = entry.pair === pairs.length
    const options = ['A', 'B'].map(part => {
      const chapter = entry[part]
      return {
        id: chapter.scenarioId,
        label: `${part}${entry.pair} ${chapter.name}`,
        next: chapter.scenarioId,
        when: { not: { completed: chapter.scenarioId } },
      }
    })
    nodes[gateId(entry.pair)] = {
      type: PART_GATE,
      pair: entry.pair,
      prompt: `第 ${entry.pair} 对：《${entry.A.name}》与《${entry.B.name}》。选择先进行哪一章。`,
      options,
      next: last ? 'end' : interludeId(entry.pair),
    }
    for (const part of PARTS) {
      const chapter = entry[part]
      nodes[chapter.scenarioId] = { type: 'scenario', scenarioId: chapter.scenarioId, next: gateId(entry.pair) }
    }
    if (!last) nodes[interludeId(entry.pair)] = { type: 'interlude', next: gateId(entry.pair + 1) }
  }
  nodes.end = { type: 'end' }
  return { start: gateId(1), nodes }
}

/** 单线流程：只跑本线的章，章间用幕间节点隔开（不进双线矩阵）。 */
export function singlePartFlow(parts, part) {
  if (!PARTS.includes(part)) throw new Error(`part 必须是 A 或 B：${String(part)}`)
  const pairs = normalizePartPairs(parts)
  const chapters = pairs.map(entry => entry[part])
  const nodes = {}
  chapters.forEach((chapter, index) => {
    const last = index === chapters.length - 1
    nodes[chapter.scenarioId] = {
      type: 'scenario',
      scenarioId: chapter.scenarioId,
      next: last ? 'end' : `interlude${index + 1}`,
    }
    if (!last) nodes[`interlude${index + 1}`] = { type: 'interlude', next: chapters[index + 1].scenarioId }
  })
  nodes.end = { type: 'end' }
  return { start: chapters[0].scenarioId, nodes }
}

/** 按模式生成 flow：单线两条走 `singlePartFlow`，分选/并行走 `dualPartFlow`。 */
export function partFlow(parts, { mode }) {
  if (mode === 'singleA') return singlePartFlow(parts, 'A')
  if (mode === 'singleB') return singlePartFlow(parts, 'B')
  if (mode === 'pick' || mode === 'parallel') return dualPartFlow(parts)
  throw new Error(`未知开局模式：${String(mode)}`)
}

/**
 * 注册期校验（P8 战役加载时调用；P5 测试也用同一判据）：
 *   · parts 只有 A/B 两侧、章对连续、章都在 scenarioIds 里；
 *   · 若声明 modes，必须是四模式的子集且至少含所声明 parts 能跑的模式；
 *   · 声明的 interludeIds（可选）与 flow 引用一致。
 * 返回 `{ ok, problems, pairs }`，不抛错（调用方决定拒绝方式）。
 */
export function validatePartManifest(manifest) {
  const problems = []
  let pairs = []
  try {
    pairs = normalizePartPairs(manifest?.parts)
  } catch (error) {
    return { ok: false, problems: [error.message], pairs: [] }
  }
  const scenarios = Array.isArray(manifest?.scenarioIds) ? manifest.scenarioIds : []
  for (const chapter of pairs.flatMap(entry => [entry.A, entry.B])) {
    if (!scenarios.includes(chapter.scenarioId)) problems.push(`parts 引用了未登记的关卡：${chapter.scenarioId}`)
  }
  const declared = Array.isArray(manifest?.modes) ? manifest.modes : null
  if (declared) {
    const allowed = new Set(['singleA', 'singleB', 'pick', 'parallel'])
    for (const mode of declared) if (!allowed.has(mode)) problems.push(`未知开局模式声明：${String(mode)}`)
    if (!declared.some(mode => ['singleA', 'singleB', 'pick', 'parallel'].includes(mode))) problems.push('modes 至少声明一个模式')
  }
  if (manifest?.parts?.A?.name == null) problems.push('parts.A 缺少 name')
  if (manifest?.parts?.B?.name == null) problems.push('parts.B 缺少 name')
  return { ok: problems.length === 0, problems, pairs }
}

/** 某个 partGate 当前可用的出口（未完成的章）。hub/测试用；不做交互选择。 */
export function partGateOptions(node, isCompleted) {
  return (node?.options || []).filter(option => !isCompleted(option.id))
}

/**
 * 模式化的战役清单：P5 批次 2 的读点。
 * 声明了 parts 的战役在选定模式后，用本函数把 manifest 变成「该模式的 flow + scenarioIds」：
 *   · singleA / singleB：章节顺序是本线的章对顺序，flow 是单线流程；
 *   · pick / parallel：章节顺序是 A/B 交错（A1,B1,A2,B2…），flow 是双线流程。
 * 未声明 parts 或被显式清空模式时原样返回，既有战役状态与行为不变。
 */
export function partManifest(manifest, mode) {
  if (!manifest || !manifest.parts || !mode) return manifest
  const pairs = normalizePartPairs(manifest.parts)
  const interleaved = pairs.flatMap(entry => [entry.A.scenarioId, entry.B.scenarioId])
  const scenarioIds = mode === 'singleA' ? pairs.map(entry => entry.A.scenarioId)
    : mode === 'singleB' ? pairs.map(entry => entry.B.scenarioId)
      : interleaved
  return { ...manifest, flow: partFlow(manifest.parts, { mode }), scenarioIds }
}

/** 某个关卡属于哪条线（未声明 parts / 未知关卡返回 null）。 */
export function partOfScenario(parts, scenarioId) {
  if (!parts || !scenarioId) return null
  let pairs
  try { pairs = normalizePartPairs(parts) } catch { return null }
  for (const entry of pairs) {
    for (const part of ['A', 'B']) if (entry[part].scenarioId === scenarioId) return part
  }
  return null
}
