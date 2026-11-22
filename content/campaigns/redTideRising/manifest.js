// 红潮涌起（Red Tide Rising · 90041）· 独立单章战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/RedTideRising.hs（setup / 混乱袋 / token / 结局）；
//   Arkham/SideStory.hs（challengeScenarioInvestigator: 90041 → Wendy Adams；getSideStoryCost = 3）；
//   frontend/src/arkham/data/side-stories.json（90041：requiredInvestigator=Wendy Adams、
//     standaloneDifficulties=Easy/Standard/Hard/Expert、xp=3）。
//
// 本战役是「独立单章挑战战役」：opening.investigators 声明唯一可选调查员＝平行温蒂·亚当斯（90037）。
// 起始构筑经验 = side-stories.json 的 xp 字段 3（批次 2 Lead 裁决口径）。chaosBags 四档逐字取
// RedTideRising.hs 的 easy/standard/hard/expert 袋（18/18/18/17 枚）。
// flow: start → scenario → end（单章挑战，结算即战役结束）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { KEY_INVESTIGATOR } from './scenarios/redTideRising/definition.js'

export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-5', '-6',
    'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
    'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

export const RECORD_TYPES = Object.freeze({
  redTideRisingResolution: 'string',
  redTideRisingVictoryCards: 'number',
})

export const RECORD_LABELS = Object.freeze({
  redTideRisingResolution: '红潮涌起结局',
  redTideRisingVictoryCards: '加入胜利区的卡牌数量',
})

export const SCENARIO_ID = 'redTideRising'
export const OPENING_EXPERIENCE = 3

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'redTideRising',
  name: '红潮涌起',
  nameEn: 'Red Tide Rising',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'notz', 'ticCampaign', 'rtrCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE, investigators: Object.freeze([KEY_INVESTIGATOR]), anyInvestigators: true }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'redTideRisingInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2']),
  flow: Object.freeze({
    start: SCENARIO_ID,
    nodes: Object.freeze({
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'end' }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
