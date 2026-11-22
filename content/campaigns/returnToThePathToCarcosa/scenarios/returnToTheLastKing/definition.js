// 重返最后的王者（returnToTheLastKing · 印刷剧本参考卡 52021）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToTheLastKing.hs +
//       Scenario/Scenarios/ThePathToCarcosa/TheLastKing.hs 的 `whenReturnTo` 分支。
//
// 重返差异：
//   - 额外收集 New Encounter Sets for Return to The Last King（52023–52027）；
//   - 衰败与汙秽 → 衰败现实（decayingReality），远古邪恶 → 虚妄之邪（delusoryEvils）；
//   - 密谋 1a 使用 52022「宁缺毋迟」替换 03062「礼节性迟到」；
//   - 把 52025（黛安娜·迪瓦恩支援面）与 52027（令人震惊的一幕）放在一边，
//     并把基础敌人 03081 移出游戏；
//   - 冒险参考卡下增加三张「令人作呕的现实」：52023b、52024b、52024b。
import { scenario as baseScenario } from '../../../thePathToCarcosa/scenarios/theLastKing/definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  deriveScenario, finishScenario, gather, returnToGroups, encounterDeck, printed, stages,
} from '../../scenario-utils.js'

export const BASE_ID = 'theLastKing'
export const REFERENCE_CODE = '52021'
export const SCENARIO_ID = 'returnToTheLastKing'

export const BYSTANDERS = Object.freeze(['03076a', '03077', '03078', '03079', '03080'])
export const TRANSFORMED = Object.freeze(['03065b', '03066b', '03067b', '03068b', '03069b'])
export const REMOVED_ENEMY_CODE = '03081'
// 冒险参考卡下的「令人作呕的现实」：基础五张 + 重返三张（52024b 两张）。
export const SICKENING_REALITY_CARDS = Object.freeze([
  '03065', '03066', '03067', '03068', '03069', '52023b', '52024b', '52024b',
])

export const ENCOUNTER_GROUPS = returnToGroups(
  ['the_last_king', 'hasturs_gift', 'decay', 'stranger', 'ancient_evils'],
  {
    replace: { decay: 'decaying_reality', ancient_evils: 'delusory_evils' },
    add: ['return_to_the_last_king'],
  },
)
const gathered = gather(ENCOUNTER_GROUPS)
// 被移出游戏的 03081 不进遭遇牌库；变身版敌人与 52026 宴会宾客按基础/重返 setup 另行处理。
const deckCards = gathered.filter(card => ![...TRANSFORMED, REMOVED_ENEMY_CODE].includes(card.code))
const returnCards = gather(['return_to_the_last_king'])

const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 最后的王者',
  nameEn: 'Return to The Last King',
  intro: baseScenario.intro,
  setup: '收集“最后的王者、哈斯塔的馈赠、衰败现实、陌生人、虚妄之邪、重返最后的王者”遭遇组。布置门厅与五个房间，五名旁人各带（调查员数 +1）个线索随机放置。将 52025 黛安娜·迪瓦恩（支援面）与 52027 令人震惊的一幕放在一边，并将基础敌人 03081 移出游戏。使用 52022「宁缺毋迟」组建密谋牌库。冒险参考卡下放置八张「令人作呕的现实」（基础五张 + 52023b + 52024b ×2）。',
  setupNote: '按照重返剧本参考卡 52021 的布置步骤：密谋 1 换成 52022，冒险参考卡下多放三张「令人作呕的现实」，并把基础敌人 03081 移出游戏。',
  acts: stages(['03064'], 'act').map(act => ({ ...act, reveal: { type: 'campaignRule' } })),
  agendas: stages(['52022', '03063'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  storyAssets: {
    ...baseScenario.storyAssets,
    '52025': { ...printed('52025') },
    '52026': { ...printed('52026') },
  },
  sickeningRealityCards: [...SICKENING_REALITY_CARDS],
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
    r3: baseScenario.resolutions.r3,
  },
}, returnCards)

export const scenario = {
  ...definitionsScenario,
  // 52026 宴会宾客（2 张）从遭遇牌库打出；52023/52024/52027 由遭遇组收集。
  encounterDeck: [
    ...encounterDeck(deckCards.filter(card => !['52026'].includes(card.code))),
    '52026', '52026',
  ],
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS, BYSTANDERS, TRANSFORMED,
  REMOVED_ENEMY_CODE, SICKENING_REALITY_CARDS,
})
