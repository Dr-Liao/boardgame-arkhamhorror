// 批次 2：「重返」战役清单的共享构造。
//
// 前三套「重返」（参考战役 50/51/52）与基础战役共用剧情结构、混乱袋、战役记录与
// 幕间流程；差异只在章节内容与关卡 id。这里从基础战役清单深拷贝 flow，并把
// 「关卡 id」字符串整体重映射到重返章节 id，避免手工维护两份 100+ 行的流程图。
//
// 只替换「与基础关卡 id 完全相等的字符串」，因此剧情正文、节点 id（prologue/end 等）
// 与 label 文案不会被误改；后续若新增需要重映射的字符串字段，仍走同一规则。
import { CONTENT_SCHEMA_VERSION } from '../schema.js'

// 批次 2：关间可插入的独立支线（每人支付 cost 经验；结算后回到原定下一章）。
// 与基础战役 manifest 的同名声明保持一致；后续支线（批次 3/4）在这里追加。
export const INSERTABLE_SIDE_STORIES = Object.freeze([
  Object.freeze({ campaignId: 'curseOfTheRougarou', cost: 1 }),
  Object.freeze({ campaignId: 'carnevaleOfHorrors', cost: 3 }),
  Object.freeze({ campaignId: 'murderAtTheExcelsiorHotel', cost: 3 }),
])

function remapValue(value, scenarioIdMap) {
  if (typeof value === 'string') return scenarioIdMap[value] ?? value
  if (Array.isArray(value)) return value.map(item => remapValue(item, scenarioIdMap))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapValue(item, scenarioIdMap)]))
  }
  return value
}

export function remapFlow(flow, scenarioIdMap) {
  const remapped = remapValue(structuredClone(flow), scenarioIdMap)
  // 部分战役（如《卡尔克萨之路》）的流程图节点 id 与关卡 id 同名：值重映射后必须把
  // 节点键也换成重返 id，否则 next 指向的键在 nodes 里不存在。节点 id 不改名。
  remapped.nodes = Object.fromEntries(Object.entries(remapped.nodes)
    .map(([id, node]) => [scenarioIdMap[id] ?? id, node]))
  return remapped
}

export function returnCampaignManifest(base, {
  id, name, nameEn, scenarioIdMap, requiredPackIds, contentVersion = '1.0.0', minRulesVersion = 'n6.0',
}) {
  const scenarioIds = base.scenarioIds.map(scenarioId => {
    const mapped = scenarioIdMap[scenarioId]
    if (!mapped) throw new Error(`${id}: 缺少关卡 ${scenarioId} 的重返 id`)
    return mapped
  })
  const unlock = Object.fromEntries(Object.entries(base.unlock).map(([scenarioId, prerequisites]) =>
    [scenarioIdMap[scenarioId], prerequisites.map(prerequisite => scenarioIdMap[prerequisite])]))
  const manifest = {
    ...remapValue(structuredClone(base), scenarioIdMap),
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id,
    name,
    ...(nameEn ? { nameEn } : {}),
    contentVersion,
    minRulesVersion,
    status: 'playable',
    requiredPackIds: [...requiredPackIds],
    scenarioIds,
    unlock,
    sideStories: INSERTABLE_SIDE_STORIES.map(entry => ({ ...entry })),
    // 开局配置：不额外发放经验、不限制调查员；难度与混乱袋沿用基础战役。
    opening: { experience: 0 },
    flow: remapFlow(base.flow, scenarioIdMap),
  }
  // 基础清单的 `scenarioIds` 顺序与 unlock 已重映射；名称/记录字段沿用基础。
  return manifest
}

// 桌面剧本提示卡映射的批量来源：重返章节 id → 印刷剧本参考卡号。
export function returnScenarioCards(scenarioIdMap, codes) {
  return Object.fromEntries(Object.entries(scenarioIdMap).map(([baseId, returnId]) => {
    const code = codes[baseId]
    if (!code) throw new Error(`重返章节 ${returnId} 缺少剧本参考卡号`)
    return [returnId, code]
  }))
}
