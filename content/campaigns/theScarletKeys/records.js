// 绯红密钥（The Scarlet Keys）· 战役记录/常量与正文读取辅助（P7）。
//
// 事实源（锁定）：
//   · 记录键与标签：参考实现 `Campaigns/TheScarletKeys/Key.hs` + 本地 zh locale（story-text 的
//     campaign sections）；按键集合来自 guide 源 base.json 的 `key` 标签表（Campaign Log 复选框）。
//   · 时间/旅行/状况报告/密档/快捷旅票：content/campaigns/theScarletKeys/shared.js 与
//     src/engine/tsk-map.js（P2 原语），本文件只提供可序列化数据与只读辅助。
//   · 存在抹除失效卡：audit/tsk-scope#campaignFlow.invalidCards（P0 锁定）。
//
// 本文件不写 state、不注册效果、不依赖引擎状态形状。
import { flattenStory } from './story-access.js'
import { TSK_STORY_KEYS } from './story-text.js'
import { EXPEDITED_TICKET_CODE } from './shared.js'

export const CAMPAIGN_ID = 'theScarletKeys'

// ---------------------------------------------------------------------------
// 正文读取（P7 统一口径）：流程节点只存 key，正文由 story-access 提供。
// campaign 段落路径如 `prologue.body` / `interlude1.title` / `worldMap.dossiers.0.title`。
// ---------------------------------------------------------------------------
// 正文源是含 HTML 的 locale 文本：运行时展示前统一转纯文本（与指南生成器的 guideText 同口径）。
function plainText(value) {
  return String(value ?? '')
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim()
}

const textOf = value => {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value !== 'object') return ''
  if (typeof value.body === 'string') return plainText(value.body)
  if (typeof value.title === 'string') return plainText(value.title)
  return plainText(flattenStory(value))
}

function campaignNode(path) {
  const segments = String(path || '').split('.').filter(Boolean)
  if (!segments.length) return null
  const [group, ...rest] = segments
  let cursor = TSK_STORY_KEYS[group] ?? null
  if (cursor == null) return null
  for (const language of ['zh', 'en']) {
    let nested = cursor[language]
    let ok = true
    for (const segment of rest) {
      if (nested == null || typeof nested !== 'object') { ok = false; break }
      nested = Array.isArray(nested) ? nested[Number(segment)] : nested[segment]
    }
    if (ok && nested != null) return nested
  }
  return cursor
}

/** 战役正文（`prologue.body` / `interlude1` / `worldMap.dossiers.0` …）。 */
export function storyBody(path) {
  return textOf(campaignNode(path))
}

/** 战役小标题（缺失返回空串，流程层回退节点自身 label）。 */
export function storyHeading(path) {
  const node = campaignNode(`${path}.title`) ?? campaignNode(path)
  return textOf(node?.title ?? node) || ''
}

/** 任意 campaign 分组的展示层（interlude/statusReport/dossier 等）。 */
export function campaignSection(group) {
  return campaignNode(group)
}

// ---------------------------------------------------------------------------
// 记录键（Campaign Log 复选框）
// ---------------------------------------------------------------------------
const KEY_LABELS_EN = Object.freeze(TSK_STORY_KEYS.key?.en || {})
const KEY_LABELS_ZH = Object.freeze(TSK_STORY_KEYS.key?.zh || {})

/** Campaign Log 复选框键表（Key.hs#Key 的本地化标签）。 */
export const CAMP_RECORD_KEYS = Object.freeze(Object.keys(KEY_LABELS_EN).sort())

// 流程层自己维护的数值/集合记录（不在印刷复选框里，但跨章读写）。
export const FLOW_RECORD_KEYS = Object.freeze([
  'time', 'xp', 'totalXp', 'statusReportsRead', 'dossiersRead', 'sideStoriesCompleted',
  'keysHeld', 'coterieStatus', 'conspiracyStatus', 'chaptersCompleted', 'scenarioOrder',
  'erasedCards', 'trauma', 'expeditedTickets',
])

export const ALL_RECORD_KEYS = Object.freeze([...FLOW_RECORD_KEYS, ...CAMP_RECORD_KEYS])

const KEY_LABEL_FALLBACK = Object.freeze({
  time: 'Time', xp: 'Experience', totalXp: 'Total Experience',
  statusReportsRead: 'Status Reports read', dossiersRead: 'Dossiers read',
  sideStoriesCompleted: 'Side stories completed', keysHeld: 'Keys held',
  coterieStatus: 'Coterie standing', conspiracyStatus: 'Conspiracy status',
  chaptersCompleted: 'Chapters completed', scenarioOrder: 'Scenario order',
  erasedCards: 'Erased from existence', trauma: 'Trauma', expeditedTickets: 'Expedited tickets',
})

/** 记录键 → 中文标签（缺译回退英文标签，不冒充官方中文）。 */
export function recordLabel(key) {
  return KEY_LABELS_ZH[key]?.zh || KEY_LABELS_ZH[key] || KEY_LABEL_FALLBACK[key] || key
}

export function recordLabels() {
  return Object.freeze(Object.fromEntries(ALL_RECORD_KEYS.map(key => {
    const label = KEY_LABELS_ZH[key]
    return [key, typeof label === 'string' ? label : (label?.zh || KEY_LABEL_FALLBACK[key] || key)]
  })))
}

const NUMBER_KEYS = new Set(['time', 'xp', 'totalXp', 'expeditedTickets', 'trauma'])
const ARRAY_KEYS = new Set(['keysHeld', 'coterieStatus', 'chaptersCompleted', 'scenarioOrder', 'erasedCards'])

/** 引擎记录 schema（campaign-flow 校验与大厅读写共用）。 */
export const recordSchema = Object.freeze({
  ...Object.fromEntries(FLOW_RECORD_KEYS.map(key => [key,
    NUMBER_KEYS.has(key) ? { type: 'number', default: 0 } : ARRAY_KEYS.has(key) ? { type: 'string[]', default: [] } : { type: 'string', default: '' }])),
  ...Object.fromEntries(CAMP_RECORD_KEYS.map(key => [key, { type: 'boolean', default: false }])),
})

export const recordDefaults = Object.freeze(Object.fromEntries(ALL_RECORD_KEYS.map(key => [key, recordSchema[key].default])))

// ---------------------------------------------------------------------------
// 战役常量与只读辅助
// ---------------------------------------------------------------------------
export const EXPEDITED_TICKET = EXPEDITED_TICKET_CODE
export const FORCED_ENDGAME_TIME_LIMIT = 35

/** P0 锁定的「存在抹除」失效卡（战役构筑禁用）。 */
export const ERASED_CAMPAIGN_CARDS = Object.freeze(['02310'])

/** 记录 → 已拜访章节集合（世界地图/进度展示用；缺失返回空集）。 */
export function completedChapters(records = {}) {
  return new Set(Array.isArray(records.chaptersCompleted) ? records.chaptersCompleted : [])
}

/** 记录 → 时间消耗（数值，缺省 0）。 */
export function campaignTime(records = {}) {
  return Number(records.time) || 0
}

/** 记录 → 是否已触发强制终局。 */
export function forcedEndgame(records = {}) {
  return campaignTime(records) >= FORCED_ENDGAME_TIME_LIMIT
}

/** 记录 → 上级记录的复合展示（供大厅/审计读取；纯只读）。 */
export function recordsSnapshot(records = {}) {
  return Object.freeze({
    time: campaignTime(records),
    forcedEndgame: forcedEndgame(records),
    chapters: [...completedChapters(records)].sort(),
    keysHeld: [...(Array.isArray(records.keysHeld) ? records.keysHeld : [])].sort(),
    statusReportsRead: Number(records.statusReportsRead) || 0,
    dossiersRead: Array.isArray(records.dossiersRead) ? records.dossiersRead.length : 0,
    expeditedTickets: Number(records.expeditedTickets) || 0,
    coterieStatus: Array.isArray(records.coterieStatus) ? [...records.coterieStatus].sort() : [],
  })
}

