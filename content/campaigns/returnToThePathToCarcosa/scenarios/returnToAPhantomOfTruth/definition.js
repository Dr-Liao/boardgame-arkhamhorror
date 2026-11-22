// 重返真相幻影（returnToAPhantomOfTruth · 印刷剧本参考卡 52040）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToAPhantomOfTruth.hs +
//       Scenario/Scenarios/ThePathToCarcosa/APhantomOfTruth.hs 的 `whenReturnTo` 分支。
//
// 重返差异：
//   - 额外收集 New Encounter Sets for Return to A Phantom of Truth（52041–52047）；
//   - 哈斯塔的使者 → 哈斯塔的使节（hastursEnvoys）；
//   - 六组巴黎地点各印两个版本（基础卡 + 52041–52046），设置时每组随机选一张，
//     另一张移出游戏；
//   - 两张影中身形（52047）放在一边；风琴手入场后，把遭遇弃牌堆与这两张洗入遭遇牌库。
import { scenario as baseScenario } from '../../../thePathToCarcosa/scenarios/aPhantomOfTruth/definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  deriveScenario, finishScenario, gather, returnToGroups, location, encounterDeck,
} from '../../scenario-utils.js'

export const BASE_ID = 'aPhantomOfTruth'
export const REFERENCE_CODE = '52040'
export const SCENARIO_ID = 'returnToAPhantomOfTruth'

export const ENCOUNTER_GROUPS = returnToGroups(
  ['a_phantom_of_truth', 'evil_portents', 'byakhee', 'the_stranger', 'agents_of_hastur'],
  { replace: { agents_of_hastur: 'hasturs_envoys' }, add: ['return_to_a_phantom_of_truth'] },
)

export const FIGURE_IN_THE_SHADOWS = '52047'
export const ORGANIST_CODES = Object.freeze(['03221', '03221b'])

// 六组「基础版 + 重返版」巴黎地点：连接与基础卡一致，仅卡面效果不同。
export const RETURN_LOCATION_VARIANTS = Object.freeze({
  montparnasse: { base: '03208', back: '52041',
    connections: ['gareDOrsay', 'gardensOfLuxembourg', 'notreDame'] },
  grandGuignol: { base: '03211', back: '52042',
    connections: ['operaGarnier', 'montmartre'] },
  pereLachaiseCemetery: { base: '03215', back: '52043',
    connections: ['canalSaintMartin', 'leMarais'] },
  canalSaintMartin: { base: '03216', back: '52044',
    connections: ['montmartre', 'pereLachaiseCemetery', 'leMarais'] },
  notreDame: { base: '03219', back: '52045',
    connections: ['montparnasse', 'leMarais', 'gardensOfLuxembourg'] },
  gardensOfLuxembourg: { base: '03220', back: '52046',
    connections: ['montparnasse', 'gareDOrsay', 'notreDame'] },
})

const gathered = gather(ENCOUNTER_GROUPS)
const returnCards = gather(['return_to_a_phantom_of_truth'])
const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 真相幻影',
  nameEn: 'Return to A Phantom of Truth',
  intro: baseScenario.intro,
  setup: '收集“真相幻影、邪兆、拜亚基、陌生人、哈斯塔的使节、重返真相幻影”遭遇组。按照疑惑/确信路线结算前导梦境并选择场景版本。六组巴黎地点各随机选择基础版或重返版其中一张放置入场，另一张移出游戏。将两张影中身形（52047）放在一边；本场冒险中，风琴手入场后把遭遇弃牌堆与这两张洗入遭遇牌库。',
  setupNote: '按照重返剧本参考卡 52040 的布置步骤：六组巴黎地点各印两个版本，设置时每组随机保留一张、另一张移出游戏；影中身形放在一边。',
  locationVariants: Object.fromEntries(Object.entries(RETURN_LOCATION_VARIANTS).map(([id, spec]) => [
    id,
    [
      location(id, spec.base, spec.connections),
      location(id, spec.back, spec.connections),
    ],
  ])),
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
    r3: baseScenario.resolutions.r3,
  },
}, returnCards)

export const scenario = {
  ...definitionsScenario,
  // 基础遭遇牌库结构（含《午夜假面》01135 ×3 / 01136 ×2）+ 两张影中身形；
  // 基础 behavior.modifyDeck 仍会按确信/疑惑路线移除对应诡计。
  encounterDeck: [
    ...encounterDeck(gathered.filter(card => !['03221', '03221b'].includes(card.code))),
    ...Array(3).fill('01135'),
    ...Array(2).fill('01136'),
    FIGURE_IN_THE_SHADOWS,
    FIGURE_IN_THE_SHADOWS,
  ],
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS,
  FIGURE_IN_THE_SHADOWS, ORGANIST_CODES, RETURN_LOCATION_VARIANTS,
})
