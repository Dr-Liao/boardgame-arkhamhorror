// 精益酒店谋杀案（Murder at the Excelsior Hotel · 84001）· 独立单章战役清单。
//
// 参考：Scenario/Scenarios/MurderAtTheExcelsiorHotel.hs + Arkham/SideStory.hs（插入费用 84001=3）+
//       frontend/src/arkham/data/side-stories.json（独立难度 Standard/Hard 与袋内标记）+
//       frontend/src/locales/en/standalone/murderAtTheExcelsiorHotel.json。
//
// opening.experience = side-stories.json 的 xp 字段（每人 3 XP，与插入费用同额；批次 2 Lead 裁决口径）。
// chaosBags 只声明 standard / hard。flow: scenario → aftermath(choice，含 R2/R3 首次的「再玩一次」) → end。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CHAOS_BAGS = Object.freeze({
  standard: Object.freeze([
    '+1', '0', '-1', '-1', '-2', '-3', '-3', '-4',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '-1', '-2', '-3', '-4', '-4', '-5', '-6',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

export const RECORD_TYPES = Object.freeze({
  theExcelsiorIsQuietForNow: 'boolean',
  theMurdersContinueUnsolved: 'boolean',
  theInvestigatorsFledTheSceneOfTheCrime: 'boolean',
  theExcelsiorClaimsAnotherVictim: 'boolean',
  thePoliceAreOnYourSide: 'boolean',
  theTrueCulpritWasIdentified: 'string',
  excelsiorReplays: 'boolean',
})

export const RECORD_LABELS = Object.freeze({
  theExcelsiorIsQuietForNow: '艾肖希尔酒店暂时恢复了平静',
  theMurdersContinueUnsolved: '谋杀仍未解决',
  theInvestigatorsFledTheSceneOfTheCrime: '调查员逃离了犯罪现场',
  theExcelsiorClaimsAnotherVictim: '艾肖希尔酒店又添一名受害者',
  thePoliceAreOnYourSide: '警察站在你这边',
  theTrueCulpritWasIdentified: '已查明真凶',
  excelsiorReplays: '已重玩过一次本关',
})

export const SCENARIO_ID = 'murderAtTheExcelsiorHotel'
export const OPENING_EXPERIENCE = 3

const RESOLUTION = value => Object.freeze({
  resolution: Object.freeze({ scenarioId: SCENARIO_ID, value }),
})
// 「再玩一次」：R2/R3 且尚未重玩过（hasRecord 为假）。
const REPLAY_WHEN = Object.freeze({
  all: Object.freeze([
    Object.freeze({ any: Object.freeze([RESOLUTION('resolution2'), RESOLUTION('resolution3')]) }),
    Object.freeze({ not: Object.freeze({ hasRecord: Object.freeze({ key: 'excelsiorReplays' }) }) }),
  ]),
})

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'murderAtTheExcelsiorHotel',
  name: '精益酒店谋杀案',
  nameEn: 'Murder at the Excelsior Hotel',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'hotelCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'murderAtTheExcelsiorHotelInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3']),
  flow: Object.freeze({
    start: SCENARIO_ID,
    nodes: Object.freeze({
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'aftermath' }),
      aftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({
            id: 'replay', label: '再玩一次（重置本关，追查另一名真凶）',
            when: REPLAY_WHEN,
            effects: Object.freeze([Object.freeze({ type: 'record', key: 'excelsiorReplays', value: true })]),
            next: SCENARIO_ID,
          }),
          Object.freeze({
            id: 'recordedQuiet', label: '记录「艾肖希尔酒店暂时平静」，结束支线',
            when: RESOLUTION('resolution1'), next: 'end',
          }),
          Object.freeze({
            id: 'recordedUnsolved', label: '记录「谋杀仍未解决」，结束支线',
            when: RESOLUTION('resolution2'), next: 'end',
          }),
          Object.freeze({
            id: 'recordedFled', label: '记录「调查员逃离了犯罪现场」，结束支线',
            when: RESOLUTION('resolution3'), next: 'end',
          }),
          Object.freeze({
            id: 'recordedVictim', label: '记录「又添一名受害者」，结束支线',
            when: RESOLUTION('noResolution'), next: 'end',
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
