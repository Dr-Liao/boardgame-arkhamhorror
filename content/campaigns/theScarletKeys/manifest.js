// 《绯红密钥》战役清单（P0/M0 catalog-only 占位）。
//
// 与 EotE P0 同一路径：本清单只登记身份、十章顺序与四档混乱袋，供测试用本地注册表复算；
// **不进生产组合根**（content/registered.js 只注册三个 catalog-only 内容包），
// 因此战役不会出现在大厅/选人/构筑/指南流程里。
// P7 逐章交付真实 flow / 幕间 / 记录键 / 结局后，整份清单替换为 playable 版本并登记进组合根。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import {
  CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_NAME_ZH, CHAOS_BAGS, chapters, SHARED_ENCOUNTER_GROUPS,
} from './shared.js'

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: CAMPAIGN_ID,
  name: CAMPAIGN_NAME_ZH,
  nameEn: CAMPAIGN_NAME,
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'catalog-only',
  requiredPackIds: ['core', 'tskCampaign', 'tskInvestigators', 'tskPlayer'],
  scenarioIds: Object.freeze(chapters.map(chapter => chapter.id)),
  sharedEncounterGroupIds: SHARED_ENCOUNTER_GROUPS,
  // 线性 unlock 只是 catalog-only 占位：真实战役是世界地图自由航线（P7 用 flow 表达）。
  unlock: Object.freeze(Object.fromEntries(chapters.map((chapter, index) => [
    chapter.id, index ? Object.freeze([chapters[index - 1].id]) : Object.freeze([]),
  ]))),
  chaosBags: CHAOS_BAGS,
  // 记录键与结局在 P7/P8 按参考 Key.hs 与尾声分支交付；P0 不预建空壳。
  recordSchema: Object.freeze({}),
  interludeHandlerId: 'scarletKeysInterludes',
  resolutionIds: Object.freeze(['victory', 'defeat']),
})
