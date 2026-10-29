// 《食梦者》开局模式策略（P5 批次 1）：四模式可用性、默认分线与座位计划。
//
// 口径：docs/tde-migration-roadmap.md §1.4.1（四模式）、§7.2.2（座位映射）、§11.2 门禁 2。
// 本模块只做**纯策略**，不写状态、不 import engine：
//   · 哪些模式在当前人数下可用（奇数禁并行、1 人只能单线）；
//   · 每个模式的默认 seatParts（并行等分、分选交替）；
//   · 座位改线（仅分选）与改线后的合法校验；
//   · 给 hub / 观察投影用的说明文案。
//
// 与 `campaign-parts.js` 的分工：那边是数据模型与通用校验（`validateModeSeats`），
// 这边是「开局时怎么选、默认怎么分、改线怎么拦」的策略层；hub 接线属 P5 批次 2。

import { laneCounts, normalizeSeatParts, seatsOfLane, validateModeSeats } from './campaign-parts.js'

export const MODE_ORDER = Object.freeze(['singleA', 'singleB', 'pick', 'parallel'])

export const MODE_LABELS = Object.freeze({
  singleA: Object.freeze({ label: '单线 A（梦寻）', detail: '全部座位在 A 线，只跑 A 的 4 章' }),
  singleB: Object.freeze({ label: '单线 B（梦网）', detail: '全部座位在 B 线，只跑 B 的 4 章' }),
  pick: Object.freeze({ label: '分选双线', detail: '座位自由分线；同一时刻只跑一条线，每个章对独立选择先手' }),
  parallel: Object.freeze({ label: '并行双线', detail: '座位等分两组，两线同时推进；人数必须是偶数' }),
})

/** 战役是否声明了双线（A/B 各带章节）。返回归一化后的 parts 或 null。 */
export function campaignPartsManifest(manifest) {
  const parts = manifest?.parts
  if (!parts || typeof parts !== 'object') return null
  const normalized = {}
  for (const part of ['A', 'B']) {
    const entry = parts[part]
    if (!entry || typeof entry !== 'object') return null
    const chapters = Array.isArray(entry.chapters) ? entry.chapters : []
    if (!chapters.length) return null
    normalized[part] = Object.freeze({
      name: String(entry.name || part),
      chapters: Object.freeze(chapters.map((chapter, index) => {
        const scenarioId = typeof chapter === 'string' ? chapter : chapter?.scenarioId
        if (!scenarioId) throw new Error(`战役 parts.${part}.chapters[${index}] 缺少 scenarioId`)
        return Object.freeze({
          scenarioId: String(scenarioId),
          pair: Number.isInteger(chapter?.pair) ? chapter.pair : index + 1,
          name: chapter?.name ? String(chapter.name) : String(scenarioId),
        })
      })),
    })
  }
  return Object.freeze(normalized)
}

/** 战役是否启用四模式选择（未声明 parts 的战役不出现该界面）。 */
export function supportsModeSelection(manifest) {
  return Boolean(campaignPartsManifest(manifest))
}

/** 模式的默认分线（并行等分、分选交替、单线全在一侧）。 */
export function defaultSeatParts(mode, playerCount) {
  const count = normalizePlayerCount(playerCount)
  if (mode === 'singleA') return Object.freeze(Array(count).fill('A'))
  if (mode === 'singleB') return Object.freeze(Array(count).fill('B'))
  if (mode === 'parallel') {
    const half = count / 2
    return Object.freeze(Array.from({ length: count }, (_, seat) => (seat < half ? 'A' : 'B')))
  }
  if (mode === 'pick') return Object.freeze(Array.from({ length: count }, (_, seat) => (seat % 2 === 0 ? 'A' : 'B')))
  throw new Error(`未知开局模式：${String(mode)}`)
}

function normalizePlayerCount(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 4) {
    throw new Error(`席位数必须是 1–4 的整数：${String(playerCount)}`)
  }
  return playerCount
}

/**
 * 当前人数下四个模式的可用性。
 * 未声明 parts 的战役返回 `null`（调用方据此不显示模式选择）。
 * 不可用时 `reason` 是给玩家看的中文原因（hub 置灰用，不是错误信息）。
 */
export function modeOptions({ playerCount, parts = null }) {
  const count = normalizePlayerCount(playerCount)
  if (!parts) return null
  return MODE_ORDER.map(mode => {
    const seatParts = defaultSeatParts(mode, count)
    const decision = validateModeSeats({ mode, seatParts })
    let reason = decision.ok ? '' : decision.reason
    if (!reason && mode === 'parallel' && count % 2 !== 0) reason = '并行双线需要两组人数相等（人数为奇数时不可用）'
    if (!reason && mode !== 'singleA' && mode !== 'singleB' && count < 2) reason = '只有一名调查员时只能进行单线'
    return Object.freeze({
      mode,
      label: MODE_LABELS[mode].label,
      detail: MODE_LABELS[mode].detail,
      enabled: !reason,
      reason,
      seatParts,
    })
  })
}

/**
 * 校验并生成一份开局计划（四个模式的统一出口）。
 * `seatParts` 省略时用默认分线；分选允许调用方传入自定义分线。
 * 返回 `{ ok, mode, playerCount, seatParts, activeParts, currentPart, laneCounts, reason }`。
 */
export function modePlan({ mode, playerCount, seatParts = null }) {
  const count = normalizePlayerCount(playerCount)
  if (!MODE_ORDER.includes(mode)) return { ok: false, mode: String(mode), reason: `未知开局模式：${String(mode)}` }
  if (mode !== 'singleA' && mode !== 'singleB' && count < 2) {
    return { ok: false, mode, playerCount: count, reason: '只有一名调查员时只能进行单线' }
  }
  const parts = seatParts ? normalizeSeatParts(seatParts) : defaultSeatParts(mode, count)
  if (parts.length !== count) return { ok: false, mode, reason: `分线长度 ${parts.length} 与席位数 ${count} 不一致` }
  const decision = validateModeSeats({ mode, seatParts: parts })
  if (!decision.ok) return { ok: false, mode, playerCount: count, seatParts: parts, reason: decision.reason }
  if (mode === 'parallel' && count % 2 !== 0) return { ok: false, mode, reason: '并行双线需要两组人数相等（人数为奇数时不可用）' }
  return {
    ok: true,
    mode,
    playerCount: count,
    seatParts: parts,
    activeParts: mode === 'parallel' ? ['A', 'B'] : [laneCounts(parts).A > 0 ? 'A' : 'B'],
    currentPart: mode === 'parallel' ? null : (laneCounts(parts).A > 0 ? 'A' : 'B'),
    laneCounts: laneCounts(parts),
    reason: '',
  }
}

/**
 * 分选模式下的座位改线：只允许 `pick`（并行等分由默认分线决定，单线不允许跨线）。
 * 改线后必须仍满足「两线各 ≥1」；否则拒绝并给出原因。
 * 返回 `{ ok, seatParts, reason }`，不修改入参。
 */
export function assignSeatPart({ mode, seatParts, seat, part }) {
  if (!['pick', 'parallel'].includes(mode)) return { ok: false, reason: '只有分选/并行双线允许手动改线' }
  if (!['A', 'B'].includes(part)) return { ok: false, reason: `线必须是 A 或 B：${String(part)}` }
  const parts = [...normalizeSeatParts(seatParts)]
  if (!Number.isInteger(seat) || seat < 0 || seat >= parts.length) return { ok: false, reason: `座位越界：${String(seat)}` }
  if (parts[seat] === part) return { ok: true, seatParts: parts, reason: '' }
  parts[seat] = part
  const counts = laneCounts(parts)
  // 并行允许「暂时不平衡」：自由换线后可能出现 3:1，必须在开始前调回相等（由 hubBeginScenario 拦截）。
  if (counts.A === 0) return { ok: false, reason: '改线后 A 线没有座位：双线要求两线各至少 1 个座位' }
  if (counts.B === 0) return { ok: false, reason: '改线后 B 线没有座位：双线要求两线各至少 1 个座位' }
  return { ok: true, seatParts: parts, reason: '' }
}

/** 两线各自的默认队长：每条线第一个真人座位（房间座位）。 */
export function defaultPartLeads(seatParts, humanSeats = null) {
  const humans = Array.isArray(humanSeats) ? humanSeats : null
  const leads = {}
  for (const part of ['A', 'B']) {
    const seats = seatParts.reduce((out, value, seat) => (value === part ? [...out, seat] : out), [])
    leads[part] = humans ? (seats.find(seat => humans.includes(seat)) ?? seats[0] ?? null) : (seats[0] ?? null)
  }
  return leads
}

/** 两线人数摘要：并行开始前必须相等（且各 ≥1）。 */
export function laneBalance(seatParts) {
  const counts = laneCounts(seatParts)
  const total = counts.A + counts.B
  return { ...counts, total, balanced: counts.A > 0 && counts.A === counts.B }
}

/** 开局计划的可读摘要（hub 提示、观察投影与测试共用）。 */
export function describeModePlan(plan) {
  if (!plan?.ok) return plan?.reason || '开局计划无效'
  const counts = plan.laneCounts || laneCounts(plan.seatParts)
  const seats = lane => seatsOfLane(plan.seatParts, lane).map(seat => seat + 1).join('、') || '—'
  const head = plan.mode === 'parallel'
    ? `并行双线：A 线座位 ${seats('A')}，B 线座位 ${seats('B')}（同时推进）`
    : plan.mode === 'pick'
      ? `分选双线：A 线座位 ${seats('A')}，B 线座位 ${seats('B')}（同一时刻只跑一条线）`
      : `${plan.mode === 'singleA' ? '单线 A' : '单线 B'}：全部 ${plan.playerCount} 个座位在本线`
  return `${head}；每座位只建一套牌组（A ${counts.A} / B ${counts.B}）`
}
