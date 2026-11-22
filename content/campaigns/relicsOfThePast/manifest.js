// 往昔遗物（Relics of the Past · 90065）· 独立单章战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/RelicsOfThePast.hs（setup / 探索牌库 / token / 结局）；
//   Arkham/SideStory.hs（challengeScenarioInvestigator: 90065 → Monterey Jack；getSideStoryCost = 3）；
//   frontend/src/arkham/data/side-stories.json（90065：requiredInvestigator=Monterey Jack、
//     standaloneDifficulties=Easy/Standard/Hard/Expert、xp=3）。
//
// 本战役是「独立单章挑战战役」：opening.investigators 声明唯一可选调查员＝蒙特雷·杰克（90062）。
// 起始构筑经验 = side-stories.json 的 xp 字段 3。chaosBags 四档逐字取 RelicsOfThePast.hs
// （easy 16 / standard 16 / hard 16 / expert 17 枚）。flow: start → scenario → end。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { KEY_INVESTIGATOR } from './scenarios/relicsOfThePast/definition.js'

export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-3',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '0', '-1', '-2', '-2', '-3', '-5',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '+1', '0', '0', '-1', '-2', '-3', '-3', '-4', '-6',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-6', '-8',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

export const RECORD_TYPES = Object.freeze({
  relicsOfThePastResolution: 'string',
  relicsOfThePastRelics: 'number',
})

export const RECORD_LABELS = Object.freeze({
  relicsOfThePastResolution: '往昔遗物结局',
  relicsOfThePastRelics: '带出的古代遗物数量',
})

export const SCENARIO_ID = 'relicsOfThePast'
export const OPENING_EXPERIENCE = 3

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'relicsOfThePast',
  name: '往昔遗物',
  nameEn: 'Relics of the Past',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'notz', 'tfaCampaign', 'ropCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE, investigators: Object.freeze([KEY_INVESTIGATOR]), anyInvestigators: true }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'relicsOfThePastInterlude',
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
