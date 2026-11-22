// 重返黑星升起（returnToBlackStarsRise · 印刷剧本参考卡 52054）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToBlackStarsRise.hs +
//       Scenario/Scenarios/ThePathToCarcosa/BlackStarsRise.hs 的 `whenReturnTo` 分支。
//
// 重返差异：
//   - 额外收集 New Encounter Sets for Return to Black Stars Rise（52055–52058）；
//   - 远古邪恶 → 虚妄之邪（delusoryEvils）；
//   - 回廊/骑士大厅各有两个版本（基础 03294/03295 与重返 52055/52056）：把四张牌
//     分成「原版 / 新版」两堆并随机移出其中一堆，另一堆在本场冒险使用。
import { scenario as baseScenario, agendaVariants, actVariants } from '../../../thePathToCarcosa/scenarios/blackStarsRise/definition.js'
import {
  location, deriveScenario, finishScenario, gather, returnToGroups, encounterDeck, stages,
} from '../../scenario-utils.js'

export const BASE_ID = 'blackStarsRise'
export const REFERENCE_CODE = '52054'
export const SCENARIO_ID = 'returnToBlackStarsRise'

export const ENCOUNTER_GROUPS = returnToGroups(
  ['black_stars_rise', 'evil_portents', 'byakhee', 'inhabitants_of_carcosa',
    'stranger', 'pentagram', 'ancient_evils'],
  { replace: { ancient_evils: 'delusory_evils' }, add: ['return_to_black_stars_rise'] },
)

export const CLOISTER_VARIANTS = Object.freeze({
  cloister: ['03294', '52055'],
  knightsHall: ['03295', '52056'],
})
export const HIDDEN_TERACHERY_CODES = Object.freeze({ hastursGaze: '52057', hastursGrasp: '52058' })

const CLOISTER_CONNECTIONS = ['abbeyChurch', 'knightsHall']
const KNIGHTS_HALL_CONNECTIONS = ['abbeyChurch', 'cloister']

const gathered = gather(ENCOUNTER_GROUPS)
const returnCards = gather(['return_to_black_stars_rise'])
// 基础 setup 把 03088/03300/03301（往返兽 / 裂隙搜寻者 / 露天通路幕）放在一边。
const SET_ASIDE_ENCOUNTER_CODES = new Set(['03088', '03300', '03301'])

const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 黑星升起',
  nameEn: 'Return to Black Stars Rise',
  intro: baseScenario.intro,
  setup: '收集“黑星升起、邪兆、拜亚基、卡尔克萨的居民、陌生人、五芒星、虚妄之邪、重返黑星升起”遭遇组。把回廊/骑士大厅的原版与重返版各两张分成两堆，背面朝上混洗后随机移出其中一堆，另一堆在本场使用。随机保留“地底洪流”或“空中漩涡”路线，布置两个彼此独立的密谋牌堆，并从晋升之门开始。',
  setupNote: '按照重返剧本参考卡 52054 的布置步骤：回廊与骑士大厅各有原版/重返版两张，随机移出一堆后只用另一堆；其他设置按基础指南。',
  locationVariants: {
    ...baseScenario.locationVariants,
    cloister: CLOISTER_VARIANTS.cloister.map(code => location('cloister', code, CLOISTER_CONNECTIONS)),
    knightsHall: CLOISTER_VARIANTS.knightsHall.map(code => location('knightsHall', code, KNIGHTS_HALL_CONNECTIONS)),
  },
  acts: actVariants,
  agendas: [
    { ...agendaVariants.tide[0], reveal: { type: 'campaignRule' } },
    { ...agendaVariants.tide[1], reveal: { type: 'campaignRule' } },
    { ...agendaVariants.tide[3], reveal: { type: 'campaignRule' } },
  ],
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
    r3: baseScenario.resolutions.r3,
  },
}, returnCards)

export const scenario = {
  ...definitionsScenario,
  encounterDeck: encounterDeck(gathered.filter(card => !SET_ASIDE_ENCOUNTER_CODES.has(card.code))),
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS, CLOISTER_VARIANTS, HIDDEN_TERACHERY_CODES,
})
