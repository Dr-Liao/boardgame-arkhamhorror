// 卡牌 / 敌人定义查找（从 engine.js 拆出的第一个模块 · Phase 6）。
//
// 这些函数是「卡号 → 定义」的唯一入口：cards-data.js ∪ 所有剧本遭遇牌。
// 拆出来的理由：
//   1. 它们是**纯查询**（不写 state、不触发事件），依赖只有几张数据表；
//   2. engine.js 里被调用得极频繁，但调用方不需要知道数据表怎么拼；
//   3. 把数据表的拼接与优先级集中在一个文件里，新增剧本/卡包时只改这里。
//
// 注意：本文件的导出**仍然由 engine.js 转出**（`export { cardDef, … } from './card-lookup.js'`），
// 外部模块的 import 路径保持不变。
import { ALL_CARDS } from '../cards/cards-data.js'
import { EFFECTS } from '../cards/card-effects.js'
import { enemyWeaknessExtra } from '../cards/card-rules.js'
import { registeredEntry } from './ability.js'
import { contentRegistry } from '../../content/registered.js'

// 合并剧本注册表（遭遇牌 code 全局唯一，跨剧本合并后可按 code 直查）。
// 与 engine.js 里的构建方式完全一致；搬来这里后 engine 不再需要自己拼表。
export const ALL_ENEMIES = {}
export const ALL_TREACHERIES = {}
export const ALL_STORY_ASSETS = {}
const SCENARIO_DATA = Object.fromEntries(contentRegistry.listScenarios()
  .filter(entry => ['playable', 'verified'].includes(entry.status))
  .map(entry => [entry.id, contentRegistry.getScenarioData(entry.id)]))
for (const sc of Object.values(SCENARIO_DATA)) {
  Object.assign(ALL_ENEMIES, sc.enemies || {})
  Object.assign(ALL_TREACHERIES, sc.treacheries || {})
  Object.assign(ALL_STORY_ASSETS, sc.storyAssets || {})
}

export function cardDef(code) {
  const rule = ALL_ENEMIES[code] || ALL_TREACHERIES[code] || ALL_STORY_ASSETS[code]
  if (rule) {
    const metadata = ALL_CARDS[rule.originalCode || code]
    return { ...metadata, ...rule, code, type: ALL_STORY_ASSETS[code] ? 'asset' : metadata?.type || rule.type }
  }
  return Object.hasOwn(ALL_CARDS, code) ? ALL_CARDS[code] : null
}

export function cardName(code) {
  const c = cardDef(code)
  if (!c) return code
  return c.nameZh || c.name || code
}

export function originalCardCode(ruleCode) {
  return ALL_ENEMIES[ruleCode]?.originalCode || ruleCode
}

export function ruleCodeForOriginal(originalCode) {
  return Object.keys(ALL_ENEMIES).find((ruleCode) => originalCardCode(ruleCode) === originalCode) || originalCode
}

export function isWeaknessCard(c) {
  return !!(c && (c.subtype === 'weakness' || c.subtype === 'basicweakness'))
}

export function isWeaknessCode(code) {
  return isWeaknessCard(cardDef(code))
}

// 弱点牌的牌组归属：战役牌组记录里持有该卡号的调查员座位。
//
// 弱点敌人的 `bearerSeat` 通常等于「抽到它的座位」。但剧本也可能直接从「放到一边」
// 或承受者牌库生成弱点敌人（例如 03059 苍白面具下的男子），这条路径没有交战座位，
// 于是生成时补查战役牌组；击败结算据此把弱点牌放回归属者的弃牌堆，而不是报错/进遭遇弃牌堆。
export function weaknessOwnerSeat(state, code) {
  for (const record of Object.values(state?.campaign?.investigators || {})) {
    if (!(record?.deck || []).includes(code)) continue
    return Number.isInteger(record.seat) ? record.seat : null
  }
  return null
}

// 敌人定义：优先剧本敌人（合并注册表），其次 cards-data.js 的敌人型卡（弱化敌人）。
export function enemyDef(code) {
  if (ALL_ENEMIES[code]) return ALL_ENEMIES[code]
  const c = ALL_CARDS[code]
  if (c && c.type === 'enemy') {
    const extra = { ...enemyWeaknessExtra(code), ...(registeredEntry(code)?.enemyWeakness || {}) }
    return {
      code,
      name: c.nameZh || c.name,
      fight: c.fight ?? 0,
      evade: c.evade ?? 0,
      health: c.health ?? 1,
      damage: c.damage ?? 0,
      horror: c.horror ?? 0,
      hunter: !!extra.hunter,
      retaliate: !!extra.retaliate,
      alert: !!extra.alert,
      elite: !!extra.elite,
      prey: extra.prey ? 'bearer' : null,
      forcedDoom: !!extra.forcedDoom,
      parleyCost: extra.parleyCost ?? 0,
      victory: c.victory ?? 0,
      vengeance: c.vengeance ?? 0,
      traits: c.traits || [],
      text: c.textZh || '',
    }
  }
  return null
}
