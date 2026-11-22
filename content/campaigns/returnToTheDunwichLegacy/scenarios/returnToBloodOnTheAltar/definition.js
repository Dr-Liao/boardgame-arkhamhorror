// 重返血色祭坛（Return to Blood on the Altar · 51032）· 章节数据。
//
// 参考：ReturnToBloodOnTheAltar.hs。差异：
//   1. 起始地点改为「公共空地·寂静衰败」(51033)；6 个村庄地点各自在
//      [重返版, 基础版 A, 基础版 B] 三选一，随机抽出 1 张不放置；
//   2. 隐藏密室(02214) 与密室的钥匙(02215) + 3 张随机遭遇卡洗混后各压在 5 个村庄地点下；
//   3. 新敌人受雇枪手(51040)×2 放在一边；若欧巴尼恩帮怀恨在心，加入娜奥米的船员并生成 1 名枪手；
//   4. 遭遇组用 resurgent_evils(51064) 替换 ancient_evils。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToBloodOnTheAltar
const base = BASE_SCENARIOS.bloodOnTheAltar
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToBloodOnTheAltar
const asideCodes = ['02214', '02215', '02216', '02217', '02218', '02219', '51040']

const cards = retEncounterCards(groups)
const definitions = retEncounterDefinitions(cards)

// 6 组「重返版 / 基础版 A / 基础版 B」三选一。
export const VILLAGE_SLOTS = [
  { id: 'location02202', codes: ['51034', '02202', '02203'] },
  { id: 'location02204', codes: ['51035', '02204', '02205'] },
  { id: 'location02206', codes: ['51036', '02206', '02207'] },
  { id: 'location02208', codes: ['51037', '02208', '02209'] },
  { id: 'location02210', codes: ['51038', '02210', '02211'] },
  { id: 'location02212', codes: ['51039', '02212', '02213'] },
]
const retLocations = Object.fromEntries(VILLAGE_SLOTS.flatMap(slot => slot.codes.filter(code => code.startsWith('510'))
  .map(code => [`location${code}`, location(`location${code}`, code, [], {})])))

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '敦威治的村庄已经沉入沉默的疯狂。公共空地成了唯一的退路，而祭坛之下的密室正在等待下一位祭品。',
  setup: '从公共空地·寂静衰败(51033)开始。6 个村庄地点各自由重返版与两张基础版中随机选一张，随机一张不放置；'
    + '在其余 5 个村庄地点下各压 1 张牌：洗混后的隐藏密室、密室的钥匙与 3 张遭遇牌。受雇枪手放在一边。',
  setupNote: '按照重返剧本参考卡 51032 的布置步骤放置地点、遭遇组与放一边区：六个村庄地点各从三张候选地中选一张，并把隐藏密室与钥匙压在地点下。',
  startLocation: 'location51033',
  locations: {
    ...base.locations,
    location51033: location('location51033', '51033', [], { central: true }),
    ...retLocations,
  },
  acts: base.acts,
  agendas: base.agendas,
  ...definitions,
  storyAssets: base.storyAssets,
  encounterDeck: retEncounterDeck(cards.filter(card => !asideCodes.includes(card.code))),
  setAsideLocations: [...base.setAsideLocations],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = ['02215', '02216', '02217', '02218', '02219', '51040', '51040']
export const RECORDS = {
  reads: ['professorWarrenRiceWasKidnapped', 'drFrancisMorganWasKidnapped', 'drHenryArmitageWasKidnapped',
    'oBannionGangHasABoneToPickWithTheInvestigators', 'theInvestigatorsWereDelayedOnTheirWayToDunwich'],
  writes: ['sacrificedToYogSothoth', 'oBannionGangHasABoneToPickWithTheInvestigators',
    'theInvestigatorsWereDelayedOnTheirWayToDunwich', 'investigatorsWereUnconsciousForSeveralHours'],
}
export const REFERENCE_CODE = chapter.code
export const UNDER_LOCATION_CODES = ['02214', '02215']
export const HIRED_GUN_CODE = '51040'
