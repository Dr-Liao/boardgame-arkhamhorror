// 破釜沉舟（All or Nothing · 90011）· 独立单章挑战战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/AllOrNothing.hs；Arkham/SideStory.hs（90011 → "Skids" O'Toole，
//     插入费用 3，指定调查员付全额、其他调查员 1 XP）；
//   frontend/src/arkham/data/side-stories.json（90011：requiredInvestigator="Skids" O'Toole、
//     standaloneDifficulties=Easy/Standard/Hard/Expert、xp=3）。
//
// 独立单章挑战战役：opening.experience = side-stories.json 的 xp 字段 3（与插入费用同额，
// 批次 2 Lead 裁决独立开局按 xp 验收）；chaosBags 只声明 standard / hard 两档。
// 调查员限制：opening.investigators 唯一可选＝平行「Skids」奥图尔（90008）；本批只交付 1P 单开。
// flow: start → scenario → end。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { KEY_INVESTIGATOR } from './scenarios/allOrNothing/definition.js'

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
  allOrNothingResolution: 'string',
  allOrNothingResourcesOnAct: 'number',
  allOrNothingNextScenarioResources: 'number',
})

export const RECORD_LABELS = Object.freeze({
  allOrNothingResolution: '破釜沉舟结局',
  allOrNothingResourcesOnAct: '结局时幕 2 上的资源',
  allOrNothingNextScenarioResources: '下一场冒险额外初始资源（参考奖励）',
})

export const SCENARIO_ID = 'allOrNothing'
export const OPENING_EXPERIENCE = 3

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'allOrNothing',
  name: '破釜沉舟',
  nameEn: 'All or Nothing',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'aonCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE, investigators: Object.freeze([KEY_INVESTIGATOR]) }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'allOrNothingInterlude',
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
