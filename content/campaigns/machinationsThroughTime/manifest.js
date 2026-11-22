// 《时间阴谋》（Machinations Through Time · 87001）· 独立支线战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/MachinationsThroughTime.hs（Setup / 三时代地图 / 双面 Edwin / 结局分派）
//   frontend/src/locales/en/standalone/machinationsThroughTime.json（intro/setup/tokens/resolutions/remembered）
//   frontend/src/arkham/data/side-stories.json：epicMultiplayer=true / xp=2 / 四档难度袋
//
// 单桌普通流程先交付（Single Group Mode 地点/敌人变体）；多时代与跨桌同步由 primitive request 排队。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'machinationsThroughTime'
export const SCENARIO_ID = 'machinationsThroughTime'

// side-stories.json difficultyLevels → 引擎 token 字符串（同 .hs easyTokens/standardTokens/hardTokens/expertTokens）。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '+1', '0', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '-1', '-1', '-1', '-2', '-3', '-4', '-6',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-1', '-2', '-3', '-4', '-5', '-6', '-8',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'elderthing', 'autofail', 'eldersign',
  ]),
})

// 指南 remembered 段的 11 个进展记录（本战役无正式 Campaign Log，只服务剧情链/结局判定）。
export const REMEMBERED_KEYS = Object.freeze([
  'thomasAndMaryHaveMet',
  'thomasAndMaryAreInspiredByNikolaTesla',
  'fundingForAnObservatoryHasBegun',
  'theObservatoryIsBuilt',
  'teleportationResearchHasBegun',
  'corriganIndustriesHasBeenFounded',
  'thomasAndMaryHaveMadeAHistoricDiscovery',
  'thomasAndMaryHaveWonANobelPrize',
  'aTreeSeedHasBeenPlanted',
  'thomasAndMaryHaveMarried',
  'theDebtHasBeenPaid',
])
export const RECORD_TYPES = Object.freeze(Object.fromEntries(REMEMBERED_KEYS.map(key => [key, 'boolean'])))
export const RECORD_LABELS = Object.freeze({
  thomasAndMaryHaveMet: '托马斯和玛丽相识了',
  thomasAndMaryAreInspiredByNikolaTesla: '托马斯和玛丽受尼古拉·特斯拉启发',
  fundingForAnObservatoryHasBegun: '天文台开始筹建',
  theObservatoryIsBuilt: '天文台建成了',
  teleportationResearchHasBegun: '传送研究开始了',
  corriganIndustriesHasBeenFounded: '科里根工业成立了',
  thomasAndMaryHaveMadeAHistoricDiscovery: '托马斯和玛丽取得了一项历史性发现',
  thomasAndMaryHaveWonANobelPrize: '托马斯和玛丽获得了诺贝尔奖',
  aTreeSeedHasBeenPlanted: '种下了一颗树种子',
  thomasAndMaryHaveMarried: '托马斯和玛丽结婚了',
  theDebtHasBeenPaid: '债务已偿还',
})

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: CAMPAIGN_ID,
  name: '时间阴谋',
  nameEn: 'Machinations Through Time',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: Object.freeze(['core', 'mttCampaign']),
  opening: Object.freeze({ experience: 2 }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'machinationsThroughTimeInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4']),
  epicMultiplayer: Object.freeze({
    enabled: true, tables: 3, eraTables: Object.freeze(['past', 'present', 'future']),
    sharedScenarioId: SCENARIO_ID, sharedEraVictoryDisplay: true,
  }),
  flow: Object.freeze({
    start: 'machinations',
    nodes: Object.freeze({
      machinations: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'aftermath' }),
      aftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({ id: 'finish', label: '结束本次时空冒险（结算结局）', next: 'end' }),
        ]),
      }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
