// 惑人返场（Enthralling Encore · 90094）· 独立单章挑战战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/EnthrallingEncore.hs（setup / 混乱袋 / 结局 / 签名卡交换）；
//   SideStory.hs（90094 → Lola Hayes；getSideStoryCost 90094 = 2）；
//   frontend/src/arkham/data/side-stories.json（90094：standaloneDifficulties=Easy/Standard/Hard/Expert、
//     xp=2、deckRequirements=「Requires investigator with parallel content」）。
//
// 独立开局：起始构筑经验 2；萝拉·海耶斯（平行 90087）必须在场；本批交付 1P 单开路径。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { KEY_INVESTIGATOR } from './scenarios/enthrallingEncore/definition.js'

// side-stories.json 90094 的四档袋（逐字转成引擎 token 字符串）。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5',
    'skull', 'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8',
    'skull', 'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

export const RECORD_TYPES = Object.freeze({
  enthrallingEncoreResolution: 'string',
  enthrallingEncoreMeasures: 'number',
  enthrallingEncoreSignatureSwap: 'string',
})

export const RECORD_LABELS = Object.freeze({
  enthrallingEncoreResolution: '惑人返场结局',
  enthrallingEncoreMeasures: '结局时小节数量',
  enthrallingEncoreSignatureSwap: '签名卡交换方向（optional/forced）',
})

export const SCENARIO_ID = 'enthrallingEncore'
export const OPENING_EXPERIENCE = 2

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'enthrallingEncore',
  name: '惑人返场',
  nameEn: 'Enthralling Encore',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'encCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE, investigators: Object.freeze([KEY_INVESTIGATOR]), anyInvestigators: true }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'enthrallingEncoreInterlude',
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
