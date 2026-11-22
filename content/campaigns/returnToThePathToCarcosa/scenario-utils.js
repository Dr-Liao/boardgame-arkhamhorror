// 「重返卡尔克萨之路」八章的共享数据助手。
//
// 设计口径：重返盒是基础《卡尔克萨之路》的**差异补丁**，不是另一套战役内容：
//   - 遭遇组：基础组 + 本盒新组（遭遇组替换见每章 definition.js 的 replace 表）；
//   - 地点：基础地点 + 本盒新地点/地点变体；
//   - 幕/密谋：基础牌 + 本盒替换版本（如 52015–52017「陌生人」、52022「宁缺毋迟」）；
//   - 剧情记录键、混乱袋与幕间流程由 `manifest.js` 从基础战役深拷贝（Lead 维护）。
// 因此章节数据直接从基础章节派生，只把「重返」差异显式声明在这里；同一份基础规则
// 只有一处事实源，避免八章与基础战役各自漂移。行为层同理：`behavior.js` 用
// `...baseBehavior` 复用基础章节的完整规则，只覆盖布置/结局等差异钩子。
//
// 依赖方向：本文件 → 基础战役内容 / 卡片目录 / content 通用工具；不得 import 引擎。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../identities.js'
import {
  printed, location, stages, encounterCards, encounterDefinitions, encounterDeck,
  storyCards, identitiesFor,
} from '../thePathToCarcosa/card-data.js'

export {
  printed, location, stages, encounterCards, encounterDefinitions, encounterDeck,
  storyCards, identitiesFor,
}

// 变音符号只出现在英文卡名/组名里；本盒的遭遇组 id 统一 camelCase（与 rtptcCampaign 卡包一致）。
export function camelGroup(encounterCode) {
  const ascii = String(encounterCode || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const parts = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (!parts.length) throw new Error(`无法从遭遇组编码生成 ID：${encounterCode}`)
  return parts[0].toLowerCase() + parts.slice(1).map(part => part[0].toUpperCase() + part.slice(1)).join('')
}

// 基础遭遇组 → 重返遭遇组：`replace` 是整组替换（参考实现 `orWhenReturnTo`），
// `add` 是额外收集的新组（参考实现 `whenReturnTo $ gather Set.ReturnToXxx`）。
export function returnToGroups(baseGroups, { replace = {}, add = [] } = {}) {
  return [...new Set([...baseGroups.map(group => replace[group] || group), ...add])]
}

// 从遭遇组收集可进遭遇牌库的卡（敌人/诡计）。
export function gather(groups) {
  return encounterCards(groups)
}

// 合并基础章节的敌人/诡计定义与「重返」新卡定义。
export function mergeDefinitions(baseScenario, cards) {
  const added = encounterDefinitions(cards)
  return {
    enemies: { ...(baseScenario.enemies || {}), ...added.enemies },
    treacheries: { ...(baseScenario.treacheries || {}), ...added.treacheries },
  }
}

// 按卡号去重后组成遭遇牌库（quantity 由 encounterDeck 处理）。
export function deckFrom(cards) {
  return encounterDeck(cards)
}

// 生成章节对象：浅合并基础章节，深合并 locations / locationVariants / storyAssets / 卡牌定义。
// `overrides` 里显式给出的字段优先生效；`cards` 是「重返」新卡（会先经 encounterDefinitions）。
export function deriveScenario(baseScenario, overrides = {}, cards = []) {
  const definitions = mergeDefinitions(baseScenario, cards)
  const scenario = {
    ...baseScenario,
    ...overrides,
    locations: { ...baseScenario.locations, ...(overrides.locations || {}) },
    locationVariants: { ...(baseScenario.locationVariants || {}), ...(overrides.locationVariants || {}) },
    storyAssets: { ...(baseScenario.storyAssets || {}), ...(overrides.storyAssets || {}) },
    ...definitions,
  }
  if (overrides.enemies) scenario.enemies = { ...definitions.enemies, ...overrides.enemies }
  if (overrides.treacheries) scenario.treacheries = { ...definitions.treacheries, ...overrides.treacheries }
  return scenario
}

// 绑定规则 id ↔ 印刷卡号，返回 { scenario, identities }。
export function finishScenario(scenario) {
  const identities = identitiesFor(scenario)
  bindScenarioIdentities(scenario, identities)
  return { scenario, identities }
}

// 按卡号读取卡面（用于 storyAssets / 剧情卡）。
export function card(code) {
  const value = ALL_CARDS[code]
  if (!value) throw new RangeError(`重返卡尔克萨：未知卡号 ${code}`)
  return value
}

// 「重返」卡牌组：本盒新卡按遭遇组过滤（只取敌人/诡计用于遭遇牌库定义）。
export function returnGroupCards(groups) {
  return encounterCards(groups)
}
