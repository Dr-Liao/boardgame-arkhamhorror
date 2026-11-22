// 循规蹈矩（By the Book · 90032）· 独立单章挑战战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/ByTheBook.hs + Scenarios/ByTheBook/Helpers.hs；
//   Arkham/SideStory.hs（90032 → Roland Banks，插入费用 3）；
//   frontend/src/arkham/data/side-stories.json（90032：requiredInvestigator=Roland Banks、
//     standaloneDifficulties=Easy/Standard/Hard/Expert、xp=3）。
//
// 独立单章挑战战役：opening.experience = side-stories.json 的 xp 字段 3；
// chaosBags 声明四档难度袋；唯一可选调查员＝平行罗兰·班克斯（90024，含 3 张 Directive），1P 单开。
// flow: start → scenario → end。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { KEY_INVESTIGATOR } from './scenarios/byTheBook/definition.js'

export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-5', '-6',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

export const RECORD_TYPES = Object.freeze({
  byTheBookResolution: 'string',
  byTheBookCultistsCaptured: 'number',
})

export const RECORD_LABELS = Object.freeze({
  byTheBookResolution: '循规蹈矩结局',
  byTheBookCultistsCaptured: '胜利区异教徒数量',
})

export const SCENARIO_ID = 'byTheBook'
export const OPENING_EXPERIENCE = 3

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'byTheBook',
  name: '循规蹈矩',
  nameEn: 'By the Book',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'btbCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE, investigators: Object.freeze([KEY_INVESTIGATOR]) }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'byTheBookInterlude',
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
