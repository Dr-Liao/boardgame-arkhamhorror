// 安魂镇息（Laid to Rest · 90054）· 独立单章挑战战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/LaidToRest.hs（setup / 混乱袋 / 结局）；
//   SideStory.hs（challengeScenarioInvestigator：90054 → Jim Culver；getSideStoryCost 90054 = 3）；
//   frontend/src/arkham/data/side-stories.json（90054：requiredInvestigator=Jim Culver、
//     standaloneDifficulties=Easy/Standard/Hard/Expert、xp=3）。
//
// 本战役是「独立单章挑战战役」：opening 声明起始构筑经验（side-stories.json 的 xp=3）。
// 调查员限制：吉姆·卡尔弗（平行 90049）必须在场；本批交付 1P 单开路径，多人语义留批次 4 后续。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { KEY_INVESTIGATOR } from './scenarios/laidToRest/definition.js'

// side-stories.json 90054 的四档袋（逐字转成引擎 token 字符串）。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-5', '-6',
    'skull', 'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
    'skull', 'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

// 战役记录：结局 id、被驱除的未了之事数量、结局时灵魂牌库剩余张数。
export const RECORD_TYPES = Object.freeze({
  laidToRestResolution: 'string',
  laidToRestUnfinishedBusinessBanished: 'number',
  laidToRestSpiritDeckRemaining: 'number',
})

export const RECORD_LABELS = Object.freeze({
  laidToRestResolution: '安魂镇息结局',
  laidToRestUnfinishedBusinessBanished: '被驱除的未了之事数量',
  laidToRestSpiritDeckRemaining: '结局时灵魂牌库剩余张数',
})

export const SCENARIO_ID = 'laidToRest'
export const OPENING_EXPERIENCE = 3

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'laidToRest',
  name: '安魂镇息',
  nameEn: 'Laid to Rest',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'ltrCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE, investigators: Object.freeze([KEY_INVESTIGATOR]), anyInvestigators: true }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'laidToRestInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2']),
  flow: Object.freeze({
    start: SCENARIO_ID,
    nodes: Object.freeze({
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'end' }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

// 兼容旧战役引擎的形状。
export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
