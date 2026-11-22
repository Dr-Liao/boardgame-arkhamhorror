// 外神之战（War of the Outer Gods · 86001）· 独立 Beta 支线清单。
//
// 参考：Scenario/Scenarios/WarOfTheOuterGods.hs + frontend/src/arkham/data/side-stories.json
//       （86001：xp 3、Easy/Standard/Hard/Expert、epicMultiplayer、beta）+ locales/en/standalone/warOfTheOuterGods.json。
//
// opening.experience = side-stories.json 的 xp 字段（每人 3 XP）。
// 结局：noResolution（按领先阵营映射 5/6/7）、resolution1–7；flow: scenario → aftermath(choice) → end。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const tokens = list => Object.freeze(list)
export const CHAOS_BAGS = Object.freeze({
  easy: tokens(['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', 'skull', 'skull', 'skull', 'autofail', 'eldersign']),
  standard: tokens(['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'skull', 'autofail', 'eldersign']),
  hard: tokens(['0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-5', '-6', 'skull', 'skull', 'skull', 'autofail', 'eldersign']),
  expert: tokens(['0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8', 'skull', 'skull', 'skull', 'autofail', 'eldersign']),
})

export const RECORD_TYPES = Object.freeze({
  preventedAllOuterGods: 'boolean',
  theSwarmOfEzelScattered: 'boolean',
  silenusBanished: 'boolean',
  maghanArkatDestroyed: 'boolean',
  redFactionWon: 'boolean',
  blueFactionWon: 'boolean',
  greenFactionWon: 'boolean',
})

export const RECORD_LABELS = Object.freeze({
  preventedAllOuterGods: '阻止了所有外神的阴谋',
  theSwarmOfEzelScattered: '埃泽尔的虫群被驱散',
  silenusBanished: '西勒诺斯被逐回虚空',
  maghanArkatDestroyed: '玛格汗·阿卡特被消灭',
  redFactionWon: '红色阵营赢得战争',
  blueFactionWon: '蓝色阵营赢得战争',
  greenFactionWon: '绿色阵营赢得战争',
})

export const SCENARIO_ID = 'warOfTheOuterGods'
export const OPENING_EXPERIENCE = 3

const aftermathOptions = [
  ['recordedPrevented', '记录「阻止了所有外神」，结束支线', 'resolution1'],
  ['recordedSwarm', '记录「虫群被驱散」，结束支线', 'resolution2'],
  ['recordedSilenus', '记录「西勒诺斯被逐回」，结束支线', 'resolution3'],
  ['recordedArkat', '记录「玛格汗·阿卡特被消灭」，结束支线', 'resolution4'],
  ['recordedRed', '记录「红色阵营获胜」，结束支线', 'resolution5'],
  ['recordedBlue', '记录「蓝色阵营获胜」，结束支线', 'resolution6'],
  ['recordedGreen', '记录「绿色阵营获胜」，结束支线', 'resolution7'],
]

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'warOfTheOuterGods',
  name: '外神之战',
  nameEn: 'War of the Outer Gods',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'wogCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'warOfTheOuterGodsInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3',
    'resolution4', 'resolution5', 'resolution6', 'resolution7']),
  flow: Object.freeze({
    start: SCENARIO_ID,
    nodes: Object.freeze({
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'aftermath' }),
      aftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze(aftermathOptions.map(([id, label, value]) => Object.freeze({
          id, label,
          when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value }) }),
          next: 'end',
        }))),
      }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
