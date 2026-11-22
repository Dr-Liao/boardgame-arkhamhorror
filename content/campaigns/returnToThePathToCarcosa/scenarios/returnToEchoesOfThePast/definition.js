// 重返往事回声（returnToEchoesOfThePast · 印刷剧本参考卡 52028）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToEchoesOfThePast.hs +
//       Scenario/Scenarios/ThePathToCarcosa/EchoesOfThePast.hs 的 `whenReturnTo` 分支。
//
// 重返差异：
//   - 额外收集 New Encounter Sets for Return to Echoes of the Past（52029–52033）；
//   - 妄想组 → 发狂妄想（maddeningDelusions）；
//   - 新增地下层：从三张新的[[地下室]]历史协会地点中随机保留 2 张、移出 1 张，
//     并把第三张「宁静的走廊」（52029）与另外两张一起入场；
//   - 两张誓约看守人（52033）放在一边；调查员推进到场景 2 或 3 后，在无人历史协会
//     地点生成其中一张。
import { scenario as baseScenario } from '../../../thePathToCarcosa/scenarios/echoesOfThePast/definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  deriveScenario, finishScenario, gather, returnToGroups, location, encounterDeck,
} from '../../scenario-utils.js'

export const BASE_ID = 'echoesOfThePast'
export const REFERENCE_CODE = '52028'
export const SCENARIO_ID = 'returnToEchoesOfThePast'

export const ENCOUNTER_GROUPS = returnToGroups(
  ['echoes_of_the_past', 'cult_of_the_yellow_sign', 'delusions', 'locked_doors', 'pentagram'],
  { replace: { delusions: 'maddening_delusions' }, add: ['return_to_echoes_of_the_past'] },
)

// 新增的地下室历史协会地点（52030 尘封档案室 / 52031 博物馆库房 / 52032 锅炉房）。
export const BASEMENT_ROOMS = Object.freeze({
  dustyArchives: '52030',
  museumStorage: '52031',
  boilerRoom: '52032',
})
export const QUIET_HALLS_BASEMENT = 'quietHallsBasement'
export const KEEPER_CODE = '52033'

// 基础 9 个历史协会房间 + 重返 3 个地下室房间（誓约看守人的「无人历史协会地点」范围）。
export const HISTORICAL_ROOMS = Object.freeze([
  '03128', '03129', '03130', '03132', '03133', '03134', '03136', '03137', '03138',
  '52030', '52031', '52032',
])

const gathered = gather(ENCOUNTER_GROUPS)
const midnightMasks = [ALL_CARDS['01136'], ALL_CARDS['01135']]
const deckCards = [...gathered, ...midnightMasks]
const returnCards = gather(['return_to_echoes_of_the_past'])

const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 往事回声',
  nameEn: 'Return to Echoes of the Past',
  intro: baseScenario.intro,
  setup: '收集“往事回声、黄色印记使徒、发狂妄想、上锁的门、五芒星、重返往事回声”遭遇组，并只取《午夜假面》的 01135/01136 诡计。每一层保留 2 个历史协会地点、移出 1 个；地下层从 52030–52032 随机保留 2 个，并放置 52029 宁静的走廊，使全部 3 张宁静的走廊一同在场。将两张誓约看守人（52033）、隐藏的图书馆、附身宣誓者、皮博迪先生、褴褛披风与黑玛瑙扣环放在一边。',
  setupNote: '按照重返剧本参考卡 52028 的布置步骤：新增地下层（三选二）并把第三张宁静的走廊放入游戏；两张誓约看守人放在一边，推进到场景 2 或 3 时生成。',
  // 基础 floorPools + 重返地下层；基础行为会按同一规则每层「留 2 移 1」。
  // 注意 floorPools 的值是**规则地点 id**，不是印刷卡号（与基础章节一致）。
  floorPools: {
    ...baseScenario.floorPools,
    basement: ['dustyArchives', 'museumStorage', 'boilerRoom'],
  },
  locations: {
    ...baseScenario.locations,
    [QUIET_HALLS_BASEMENT]: location(QUIET_HALLS_BASEMENT, '52029',
      ['entryHall', 'dustyArchives', 'museumStorage', 'boilerRoom']),
    dustyArchives: location('dustyArchives', '52030', ['entryHall', QUIET_HALLS_BASEMENT, 'meetingRoom', 'groundRecordOffice', 'groundMuseum']),
    museumStorage: location('museumStorage', '52031', ['entryHall', QUIET_HALLS_BASEMENT, 'meetingRoom', 'groundRecordOffice', 'groundMuseum']),
    boilerRoom: location('boilerRoom', '52032', ['entryHall', QUIET_HALLS_BASEMENT, 'meetingRoom', 'groundRecordOffice', 'groundMuseum']),
  },
  storyAssets: {
    ...baseScenario.storyAssets,
  },
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
    r3: baseScenario.resolutions.r3,
    r4: baseScenario.resolutions.r4,
  },
}, returnCards)

export const scenario = {
  ...definitionsScenario,
  // 03144 探求者的 3 张实体卡开局按人数生成，不进遭遇牌库；03140 也一样。
  encounterDeck: [
    ...encounterDeck(gathered.filter(card => !['03140', '03144'].includes(card.code))),
    '01136', '01136',
    '01135', '01135', '01135',
    KEEPER_CODE, KEEPER_CODE,
  ],
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS, BASEMENT_ROOMS,
  QUIET_HALLS_BASEMENT, KEEPER_CODE, HISTORICAL_ROOMS,
})
