// 重返博物馆之夜（Return to The Miskatonic Museum · 51020）· 章节数据。
//
// 参考：ReturnToTheMiskatonicMuseum.hs。差异：
//   1. 遭遇组用 secret_doors(51065) 替换 locked_doors，用 creeping_cold(51066-67) 替换 chilling_cold；
//   2. 新诡计黑暗指令(51023)/混沌夜色(51024) 加入遭遇牌库；
//   3. 展厅候选从 5 张扩为 7 张（加入 51021 中世纪展厅 / 51022 档案馆），随机移出 2 张后分上 3/下 3；
//   4. 幕牌库保留 4 张（含强行闯入 02124）。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToTheMiskatonicMuseum
const base = BASE_SCENARIOS.theMiskatonicMuseum
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToTheMiskatonicMuseum
const asideCodes = ['02138', '02139', '02140', '02142']

const cards = retEncounterCards(groups)
const definitions = retEncounterDefinitions(cards)

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '博物馆的展厅在夜色中显得比记忆中更加幽深。新的展厅被加了进来，而其中一条走廊通向不该存在的黑暗。',
  setup: '从博物馆大门开始。布置博物馆大厅，并在两张保安室/管理办公室中各随机选一张入场。'
    + '将展厅洗混后随机移出 2 张，其余分上、下两叠（限制展厅在底部）；把哈罗德、亚当、死灵之书与暗影之子放在一边。',
  setupNote: '按照重返剧本参考卡 51020 的布置步骤放置地点、遭遇组与放一边区：在七张展厅候选中随机移出两张，再把限制展厅洗入展厅牌库底部。',
  startLocation: 'location02126',
  locations: {
    ...base.locations,
    location51021: location('location51021', '51021', ['location02127'], { victory: 1 }),
    location51022: location('location51022', '51022', ['location02127'], { victory: 1, cluesPerInvestigator: 0, cluesFixed: 0 }),
  },
  acts: base.acts,
  agendas: base.agendas,
  ...definitions,
  storyAssets: base.storyAssets,
  encounterDeck: retEncounterDeck(cards.filter(card => !asideCodes.includes(card.code))),
  setAsideLocations: [...base.setAsideLocations, 'location51021', 'location51022'],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = ['02138', '02139', '02140', '02142']
export const RECORDS = {
  reads: [],
  writes: ['theInvestigatorsFailedToRecoverTheNecronomicon', 'theInvestigatorsDestroyedTheNecronomicon',
    'theInvestigatorsTookCustodyOfTheNecronomicon', 'theNecronomiconWasStolen'],
}
export const REFERENCE_CODE = chapter.code
export const EXHIBIT_CANDIDATES = ['02132', '02133', '02134', '02135', '02136', '51021', '51022']
export const RESTRICTED_HALL = '02137'
