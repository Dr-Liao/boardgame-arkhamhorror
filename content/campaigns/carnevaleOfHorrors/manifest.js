// 恐怖狂欢节（Carnevale of Horrors · 82001）· 独立单章战役清单。
//
// 参考：Scenario/Scenarios/CarnevaleOfHorrors.hs + Arkham/SideStory.hs（插入费用 82001=3）+
//       frontend/src/arkham/data/side-stories.json（独立难度 Standard/Hard 与袋内标记）+
//       frontend/src/locales/en/standalone/carnevaleOfHorrors.json（intro/setup/resolutions）。
//
// opening.experience = side-stories.json 的 xp 字段（每人 3 XP，与插入主战役时的费用同额；
// 批次 2 Lead 裁决口径）。chaosBags 只声明 standard / hard。flow: scenario → aftermath(choice) → end。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CHAOS_BAGS = Object.freeze({
  standard: Object.freeze([
    '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-3', '-4', '-6',
    'skull', 'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '+1', '0', '0', '0', '-1', '-1', '-3', '-4', '-5', '-6', '-7',
    'skull', 'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

export const RECORD_TYPES = Object.freeze({
  manyWereSacrificedToCnidathquaDuringTheCarnivale: 'boolean',
  theSunBanishedCnidathquaIntoTheDepths: 'boolean',
  cnidathquaRetreatedToNurseItsWounds: 'boolean',
  theInvestigatorsKeptTheirMasks: 'boolean',
})

export const RECORD_LABELS = Object.freeze({
  manyWereSacrificedToCnidathquaDuringTheCarnivale: '狂欢节期间许多人被献祭给了奈达斯奎',
  theSunBanishedCnidathquaIntoTheDepths: '太阳把奈达斯奎驱逐回深渊',
  cnidathquaRetreatedToNurseItsWounds: '奈达斯奎退回去养伤',
  theInvestigatorsKeptTheirMasks: '调查员保留了狂欢节面具',
})

export const SCENARIO_ID = 'carnevaleOfHorrors'
export const OPENING_EXPERIENCE = 3

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'carnevaleOfHorrors',
  name: '恐怖狂欢节',
  nameEn: 'Carnevale of Horrors',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'cohCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'carnevaleOfHorrorsInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2']),
  flow: Object.freeze({
    start: SCENARIO_ID,
    nodes: Object.freeze({
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'aftermath' }),
      aftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({
            id: 'recordedSacrificed', label: '记录「许多人被献祭」，结束支线',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value: 'noResolution' }) }),
            next: 'end',
          }),
          Object.freeze({
            id: 'recordedSun', label: '记录「太阳驱逐了奈达斯奎」，结束支线',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value: 'resolution1' }) }),
            next: 'end',
          }),
          Object.freeze({
            id: 'recordedRetreat', label: '记录「奈达斯奎退回养伤」，结束支线',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value: 'resolution2' }) }),
            next: 'end',
          }),
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
