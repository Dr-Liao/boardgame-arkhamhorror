// 《沉没之城》（The Drowned City）· 战役准备（序幕）与开局初始化（P7）。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Campaigns/TheDrownedCity.hs#CampaignStep PrologueStep`：
//     读 `intro.title/body`（题词 + 4 月 15 日日志）、`additionalRulesAndClarifications`
//     三条（floodTokens / artifacts / alienGlyphs）、`newKeywords`、`prologue`；
//     同时在 `StartCampaign` 里把 R'lyeh 地图的 7 个场景全部登记进 `RlyehMap` 集合；
//   · `Campaigns/TheDrownedCity/ChaosBag.hs#chaosBagContents`（四档初始袋，shared.js 已镜像）；
//   · `Campaigns/TheDrownedCity/Key.hs`（`RlyehMap`、`DiscoveredGlyphs` 等集合记录）。
//
// P7 口径：
//   · 序幕节点只存 `textKey`，正文由 shared.js 的叙事桥（story-text，缺失回退空串）提供；
//   · `campaignStart` 是**幂等**的战役开局初始化：混乱袋、R'lyeh 地图、字形/淹没街区容器。
//     旧存档或非战役开局不会因为再次进入序幕而重置进度；
//   · 不新增状态字段：全部写在已声明的战役记录（`records.*`）与引擎既有容器（`campaign.chaosBag`）上。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { initializeChaosBag } from '../../../src/engine/chaos-bag.js'
import { CHAOS_BAGS } from './shared.js'
import { TDC_RLYEH_MAP_IDS } from './records.js'

export const PROLOGUE_HANDLER_ID = 'tdcPrologue'

// 序幕正文键（base.json；顺序 = 参考 PrologueStep 的 scope 顺序）。
export const PROLOGUE_TEXT_KEYS = Object.freeze([
  'intro.title',
  'intro.body',
  'additionalRulesAndClarifications.title',
  'additionalRulesAndClarifications.floodTokens',
  'additionalRulesAndClarifications.artifacts',
  'additionalRulesAndClarifications.alienGlyphs',
  'newKeywords.title',
  'newKeywords.body',
  'prologue.title',
  'prologue.body',
])

// 战役特别规则标签（base.json#specialRules[0..3]，印刷提示卡摘要；正文由 prose 节点承载）。
export const PROLOGUE_SPECIAL_RULE_KEYS = Object.freeze(
  [0, 1, 2, 3].map(index => `specialRules[${index}].body`))

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

/**
 * 战役开局初始化（幂等）。返回可测试快照：混乱袋规模 / R'lyeh 地图条目 / 字形容器。
 * 重复调用只补缺失容器，不重置已经推进的地图与记录。
 */
export function startTdcCampaign (state, log) {
  const campaign = state?.campaign
  if (!campaign) return null
  campaign.records ||= {}
  const records = campaign.records

  // 1) 战役混乱袋（四档见 shared.js#CHAOS_BAGS；manifest.chaosBags 同源）。
  const tokens = CHAOS_BAGS[state?.difficulty] || CHAOS_BAGS.standard
  const freshBag = !Array.isArray(campaign.chaosBag) || campaign.chaosBag.length === 0
  if (freshBag) {
    initializeChaosBag(state, [...tokens])
    logLine(log, `🎒 战役混乱袋：${tokens.length} 枚标记（难度 ${state?.difficulty || 'standard'}）。`)
  }

  // 2) R'lyeh 地图：开局登记全部 7 个场景（参考 `recordSetInsert RlyehMap [minBound ..]`）。
  const rlyehMap = Array.isArray(records.rlyehMap) ? records.rlyehMap : []
  const missingMap = TDC_RLYEH_MAP_IDS.filter(id => !rlyehMap.includes(id))
  if (missingMap.length) records.rlyehMap = [...rlyehMap, ...missingMap]

  // 3) 集合容器（字形页 / 被淹没街区）。
  if (!Array.isArray(records.discoveredGlyphs)) records.discoveredGlyphs = []
  if (!Array.isArray(records.floodedNeighborhoods)) records.floodedNeighborhoods = []

  const snapshot = {
    chaosBag: Array.isArray(campaign.chaosBag) ? campaign.chaosBag.length : 0,
    rlyehMap: [...records.rlyehMap],
    glyphs: [...records.discoveredGlyphs],
    floodedNeighborhoods: [...records.floodedNeighborhoods],
    resumed: !freshBag,
  }
  logLine(log, `🎬 《沉没之城》战役准备完成：混乱袋 ${snapshot.chaosBag} 枚标记；`
    + `R'lyeh 地图 ${snapshot.rlyehMap.length} 个场景已登记；字形页 ${snapshot.glyphs.length} 个已翻译字形。`)
  return snapshot
}

/** 序幕效果分派（`campaignStart`；未知事件直接抛错，注册期 fail closed）。 */
export function runPrologueEffect (state, effect, log) {
  if (effect.event === 'campaignStart') return startTdcCampaign(state, log)
  throw new Error(`未知序幕效果：${String(effect.event)}`)
}

// ---------------------------------------------------------------------------
// 序幕子图：prologue（题词 + 附加规则 + 新关键词 + 序言）→ 第一关《金盆洗手》
// ---------------------------------------------------------------------------
// 序幕用 `interlude` 节点（引擎会停下并展示整段题词；`upgrades:false` 不在此开购牌窗）。
export const TDC_PROLOGUE_NODES = Object.freeze({
  prologue: {
    type: 'interlude',
    upgrades: false,
    titleKey: 'prologue.title',
    textKeys: [...PROLOGUE_TEXT_KEYS.filter(key => !key.endsWith('.title'))],
    effects: [{ type: 'registered', handler: PROLOGUE_HANDLER_ID, event: 'campaignStart' }],
    next: 'oneLastJob',
  },
})

registerCampaignEffectHandler(PROLOGUE_HANDLER_ID, runPrologueEffect)
