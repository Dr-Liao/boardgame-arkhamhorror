// 重返课外活动（Return to Extracurricular Activities · 51012）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToTheDunwichLegacy/ReturnToExtracurricularActivities.hs
// 与基础章 ExtracurricularActivity.hs。布置差异：
//   1. 奥恩图书馆(02050) / 沃伦天文台(51013) 随机二选一，另一张移出游戏；
//   2. 教师办公室按是否完成「重返百赌百胜」二选一（基础 02054/02055）；
//   3. 若已完成重返百赌百胜，从遭遇组找出 1 张被奴役的保安(51014)生成在管理大楼；
//   4. 收集新遭遇组 return_to_extracurricular_activities 与四个替换组。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToExtracurricularActivities
const base = BASE_SCENARIOS.extracurricularActivity
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToExtracurricularActivities
const asideCodes = ['02058']

const cards = retEncounterCards(groups)
const definitions = retEncounterDefinitions(cards)
// 实验体沿用基础章的重置数值。
Object.assign(definitions.enemies['02058'], { massive: true, healthPerPlayerBonus: 3 })

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '莱斯教授最后出现在米斯卡塔尼克大学。重返调查让校园的每个角落都变得更危险——天文台里也藏着线索，而保安已经不再是你们这边的人。',
  setup: '从大学广场开始。布置人文学大楼、学生会、科学大楼与管理大楼；在奥恩图书馆和沃伦天文台之间随机选一张入场，另一张移出游戏。'
    + '按是否完成重返百赌百胜选择教师办公室版本，并将宿舍、炼金实验室、实验体及剧情资产放在一边。',
  setupNote: '按照重返剧本参考卡 51012 的布置步骤放置地点、遭遇组与放一边区：随机选用奥恩图书馆或沃伦天文台，并按是否完成重返百赌百胜决定教师办公室版本与保安生成。',
  startLocation: 'miskatonicQuad',
  locations: {
    ...base.locations,
    warrenObservatory: location('warrenObservatory', '51013', ['miskatonicQuad'], { victory: 1 }),
  },
  locationVariants: {
    ...base.locationVariants,
    orneLibrary: [base.locations.orneLibrary, location('warrenObservatory', '51013', ['miskatonicQuad'], { victory: 1 })],
  },
  acts: base.acts,
  agendas: base.agendas,
  ...definitions,
  storyAssets: base.storyAssets,
  encounterDeck: retEncounterDeck(cards.filter(card => !asideCodes.includes(card.code))),
  setAsideEncounterCards: retEncounterDeck(cards.filter(card => asideCodes.includes(card.code))),
  setAsideLocations: [...base.setAsideLocations],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = ['02055', '02058', '02059', '02060', '02061']
export const RECORDS = {
  reads: [],
  writes: ['professorWarrenRiceWasKidnapped', 'theInvestigatorsRescuedProfessorWarrenRice',
    'theInvestigatorsFailedToSaveTheStudents', 'theStudentsWereRescued', 'theExperimentWasDefeated',
    'investigatorsWereUnconsciousForSeveralHours'],
}
export const REFERENCE_CODE = chapter.code
