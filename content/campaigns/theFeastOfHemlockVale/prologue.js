// 《铁杉谷盛宴》（The Feast of Hemlock Vale）· 战役准备（序幕）与开局初始化（P7）。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Arkham/Campaign/Campaigns/TheFeastOfHemlockVale.hs#CampaignStep PrologueStep`：
//     读 `prologue.title/body`（《逆天而行》）、`additionalRulesAndClarifications` 四项、`newKeywords`，
//     随后 `metaL .~ toJSON initMeta`（Day1 / Day / 空法典选择）；
//   · `Campaigns/TheFeastOfHemlockVale/Helpers.hs#initMeta / #setupHemlockDay / #campaignChaosBag`（本文件
//     不重抄卡表：四档混乱袋来自 `shared.js#CHAOS_BAGS`，由 manifest 声明）；
//   · `TokenHelpers.hs`（序曲混乱符号取值，章节 chaos.js 已各自实现）；
//   · 英文指南 `base.json#prologue` / `#specialRules` / `#additionalRulesAndClarifications` / `#newKeywords`。
//
// P7 口径：
//   · 序幕节点只存 `textKey`，正文由 flow.js 从 story-text 读取；
//   · `campaignStart` 是**幂等**的战役开局初始化：混乱袋、时钟（day/time/hemlockDate）、居民记录、
//     法典/勘察/传家宝/未花费经验容器。旧存档或非战役开局不会因为再次进入序幕而重置进度；
//   · 不新增状态字段：全部写在已声明的战役记录（`records.*`）与引擎既有容器（`campaign.chaosBag`）上。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { initializeChaosBag } from '../../../src/engine/chaos-bag.js'
import { CHAOS_BAGS } from './shared.js'
import { FHV_HEIRLOOM_CODES, FHV_RESIDENTS } from './records.js'
import {
  DATE_RECORD, DAY_RECORD, FHV_STORY_CHAPTER, TIME_RECORD, campaignStoryHeading, campaignStoryText, fhvDateString,
} from './parts.js'

export const PROLOGUE_HANDLER_ID = 'fhvPrologue'

// 传家宝（Heirlooms 组 10713–10715）：由白天序曲/幕间的法典小节发放，战役层只登记“已发放”。
// 身份表在 records.js（`FHV_HEIRLOOM_CODES`），这里再导出一次给序曲/大厅使用。
export { FHV_HEIRLOOM_CODES }

// 序幕的起始时钟：Day1 / Day（`initMeta = TheFeastOfHemlockValeMeta Day1 Day []`）。
export const FHV_START_DATE = Object.freeze({ day: 1, period: 'day' })

// ---------------------------------------------------------------------------
// 序幕子图：prologue（逆天而行 + 八条战役特别规则）→ prologueRules（附加规则/序曲规则）
// ---------------------------------------------------------------------------
const text = key => campaignStoryText(key)
const heading = (key, fallback) => campaignStoryHeading(key) || fallback

export const PROLOGUE_NODES = Object.freeze({
  prologue: {
    type: 'story',
    title: heading('prologue.title', 'Prologue'),
    textKey: 'prologue.body',
    effects: [{ type: 'registered', handler: PROLOGUE_HANDLER_ID, event: 'campaignStart' }],
    next: 'prologueRules',
  },
  prologueRules: {
    type: 'story',
    title: heading('additionalRulesAndClarifications.title', 'Additional Rules'),
    textKey: 'additionalRulesAndClarifications.theCodex',
    textKeys: [
      'additionalRulesAndClarifications.threeDaysThreeNights',
      'additionalRulesAndClarifications.residentsAndRelationshipLevels',
      'additionalRulesAndClarifications.locationAdjacency',
      'prelude1.playingPreludes.title',
      'prelude1.playingPreludes.body',
    ],
    next: 'welcomeToHemlockVale',
  },
})

// 序幕正文键（测试/账本用）：序曲正文 + 八条特别规则 + 新关键词 + 附加规则。
export const PROLOGUE_TEXT_KEYS = Object.freeze([
  'prologue.body',
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(index => `specialRules[${index}].body`),
  'newKeywords.body',
])

/** 只读：序幕/附加规则的展示文本（缺键返回空串，不写死中文）。 */
export function prologueText () {
  return {
    prologue: text('prologue.body'),
    specialRules: PROLOGUE_TEXT_KEYS.slice(1, 9).map(key => text(key)).filter(Boolean),
    newKeywords: text('newKeywords.body'),
    additionalRules: [
      'additionalRulesAndClarifications.theCodex',
      'additionalRulesAndClarifications.threeDaysThreeNights',
      'additionalRulesAndClarifications.residentsAndRelationshipLevels',
      'additionalRulesAndClarifications.locationAdjacency',
    ].map(key => text(key)).filter(Boolean),
    chapter: FHV_STORY_CHAPTER,
  }
}

// ---------------------------------------------------------------------------
// 战役开局初始化（幂等）
// ---------------------------------------------------------------------------
const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function ensureRecords (campaign) {
  campaign.records ||= {}
  return campaign.records
}

function ensureContainer (records, key, value) {
  if (records[key] == null || (typeof records[key] !== 'object' && value && typeof value === 'object')) {
    records[key] = value
  }
  return records[key]
}

/**
 * 战役开局初始化（幂等）。返回可测试快照：时钟 / 混乱袋规模 / 居民数 / 记录容器。
 * 重复调用只补缺失容器，不重置已经推进过的时钟与关系。
 */
export function startFhvCampaign (state, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  const records = ensureRecords(campaign)
  const alreadyStarted = typeof records[DATE_RECORD] === 'string' && records[DATE_RECORD].length > 0

  // 1) 战役混乱袋：`campaignChaosBag`（四档见 shared.js#CHAOS_BAGS，manifest.chaosBags 同源）。
  //    已初始化时 `initializeChaosBag` 幂等（只保留既有袋内容）。
  const tokens = CHAOS_BAGS[state?.difficulty] || CHAOS_BAGS.standard
  if (!Array.isArray(campaign.chaosBag) || campaign.chaosBag.length === 0) {
    initializeChaosBag(state, [...tokens])
    logLine(log, `🎒 战役混乱袋：${tokens.length} 枚标记（难度 ${state?.difficulty || 'standard'}）。`)
  }

  // 2) 时钟：Day1 / Day（`initMeta`）。旧存档保留已推进的日期。
  if (!alreadyStarted) {
    records[DATE_RECORD] = fhvDateString(FHV_START_DATE)
    records[DAY_RECORD] = FHV_START_DATE.day
    records[TIME_RECORD] = FHV_START_DATE.period
  }

  // 3) 居民记录：8 张印刷 Campaign Log 条目 + 3 名无日志条目居民（等级 0 / 无笔记 / 未划掉）。
  for (const row of FHV_RESIDENTS) {
    if (typeof records[row.record.level] !== 'number') records[row.record.level] = 0
    if (!Array.isArray(records[row.record.notes])) records[row.record.notes] = []
    if (typeof records[row.record.crossedOut] !== 'boolean') records[row.record.crossedOut] = false
  }
  // 对象 Map 容器（章节行为用 `||= {}` 写；这里先建成对象，避免默认值不是对象时的退化）。
  for (const key of ['relationships', 'residentRelationships', 'remembered']) {
    if (!records[key] || typeof records[key] !== 'object' || Array.isArray(records[key])) records[key] = {}
  }

  // 4) 勘察 / 法典 / 传家宝 / 结局容器（集合一律用 record-sets 口径的字符串数组）。
  for (const key of ['areasSurveyed', 'codexRead', 'crossedOutResidents', 'heirloomsAwarded', 'investigatorDefeat']) {
    if (!Array.isArray(records[key])) records[key] = []
  }
  if (typeof records.campaignOutcome !== 'string') records.campaignOutcome = ''

  // 5) 未花费经验投影：开局为 0（权威值仍是 `campaign.investigators[seat].xp`）。
  if (typeof records.xp !== 'number') records.xp = 0
  records.unspentXp = unspentXpOf(campaign)

  const snapshot = {
    date: records[DATE_RECORD],
    day: records[DAY_RECORD],
    time: records[TIME_RECORD],
    chaosBag: Array.isArray(campaign.chaosBag) ? campaign.chaosBag.length : 0,
    residents: FHV_RESIDENTS.length,
    areasSurveyed: records.areasSurveyed.length,
    codexRead: records.codexRead.length,
    unspentXp: records.unspentXp,
    resumed: alreadyStarted,
  }
  logLine(log, `🎬 《铁杉谷盛宴》战役准备完成：${snapshot.date}（第 ${snapshot.day} 日 / ${snapshot.time}）；`
    + `混乱袋 ${snapshot.chaosBag} 枚标记；${snapshot.residents} 名居民进入 Campaign Log；`
    + `未花费经验 ${snapshot.unspentXp}。`)
  return snapshot
}

/** 当前各席位未花费经验之和（只读；引擎不存在该聚合值时返回 0）。 */
export function unspentXpOf (campaign) {
  const investigators = campaign?.investigators || {}
  return Object.values(investigators)
    .reduce((total, record) => total + Math.max(0, Number(record?.xp) || 0), 0)
}

/** 序幕效果分派（`campaignStart`；未知事件直接抛错，注册期 fail closed）。 */
export function runPrologueEffect (state, effect, log) {
  if (effect.event === 'campaignStart') return startFhvCampaign(state, log)
  throw new Error(`未知序幕效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(PROLOGUE_HANDLER_ID, runPrologueEffect)
