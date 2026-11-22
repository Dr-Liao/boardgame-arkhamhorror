// 重返卡城幽影（returnToDimCarcosa · 印刷剧本参考卡 52059）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToDimCarcosa.hs +
//       Scenario/Scenarios/ThePathToCarcosa/DimCarcosa.hs 的 `whenReturnTo` 分支。
//
// 重返差异：
//   - 额外收集 New Encounter Sets for Return to Dim Carcosa（52060–52064）；
//   - 妄想组 → 发狂妄想，哈斯塔的使者 → 哈斯塔的使节，恐惧打击 → 神经质恐惧；
//   - 原版王之宫殿（03331）移出游戏，用 52060「王之宫殿（哈斯塔的领域）」替换；
//   - 你的内心深处（52061）、王座之间（52062）、沃德剧院舞台（52063）放在一边；
//   - 52064 哈斯塔的高阶祭司进入遭遇牌库。
import { scenario as baseScenario, actTwoVariants } from '../../../thePathToCarcosa/scenarios/dimCarcosa/definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  deriveScenario, finishScenario, gather, returnToGroups, location, encounterDeck, stages, printed,
} from '../../scenario-utils.js'

export const BASE_ID = 'dimCarcosa'
export const REFERENCE_CODE = '52059'
export const SCENARIO_ID = 'returnToDimCarcosa'

export const ENCOUNTER_GROUPS = returnToGroups(
  ['dim_carcosa', 'delusions', 'cult_of_the_yellow_sign', 'inhabitants_of_carcosa',
    'agents_of_hastur', 'striking_fear'],
  {
    replace: {
      delusions: 'maddening_delusions',
      agents_of_hastur: 'hasturs_envoys',
      striking_fear: 'neurotic_fear',
    },
    add: ['return_to_dim_carcosa'],
  },
)

export const PALACE_OF_THE_KING = '52060'
export const REMOVED_PALACE = '03331'
export const RETURN_LOCATIONS = Object.freeze({
  recessesOfYourOwnMind: '52061',
  theThroneRoom: '52062',
  stageOfTheWardTheatre: '52063',
})
export const HIGH_PRIEST = '52064'
// 52060b：三种哈斯塔版本 → 从放在一边置入的地点。
export const HASTUR_STORY_LOCATION = Object.freeze({
  '03332': 'recessesOfYourOwnMind', // 黄衣之王
  '03333': 'theThroneRoom', // 卡尔克萨领主
  '03334': 'stageOfTheWardTheatre', // 褴褛之王
})
export const RETURN_STORY_CODES = Object.freeze(['52060b', '52061b', '52062b', '52063b'])

const gathered = gather(ENCOUNTER_GROUPS)
const returnCards = gather(['return_to_dim_carcosa'])
const palaceConnections = baseScenario.locations.palaceOfTheKing.connections

const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 卡城幽影',
  nameEn: 'Return to Dim Carcosa',
  intro: baseScenario.intro,
  setup: '收集“卡城幽影、发狂妄想、黄色印记使徒、卡尔克萨的居民、哈斯塔的使节、神经质恐惧、重返卡城幽影”遭遇组。根据疑惑与确信选择场景 2 版本，随机选择四组异界地点。将原版王之宫殿移出游戏，改以 52060「王之宫殿（哈斯塔的领域）」入场；把你的内心深处、王座之间、沃德剧院舞台放在一边。本场冒险中，除非有调查员“知道了秘密”，哈斯塔的生命值不能低于每位调查员 2 点。',
  setupNote: '按照重返剧本参考卡 52059 的布置步骤：原版王之宫殿移出游戏并由 52060 替换；52061–52063 放在一边，等哈斯塔的末路剧情置入。',
  locations: {
    ...baseScenario.locations,
    palaceOfTheKing: location('palaceOfTheKing', PALACE_OF_THE_KING, palaceConnections, { otherworld: true }),
    recessesOfYourOwnMind: location('recessesOfYourOwnMind', RETURN_LOCATIONS.recessesOfYourOwnMind, [], { otherworld: true }),
    theThroneRoom: location('theThroneRoom', RETURN_LOCATIONS.theThroneRoom, [], { otherworld: true }),
    stageOfTheWardTheatre: location('stageOfTheWardTheatre', RETURN_LOCATIONS.stageOfTheWardTheatre, [], {}),
  },
  storyAssets: {
    ...(baseScenario.storyAssets || {}),
    '52060b': printed('52060b'),
    '52061b': printed('52061b'),
    '52062b': printed('52062b'),
    '52063b': printed('52063b'),
  },
  acts: [
    { ...stages(['03320'], 'act')[0], id: 'act1', stage: '1a',
      objective: { type: 'clues', perInvestigator: 2 }, reveal: { type: 'campaignRule' } },
    actTwoVariants[0],
    { ...stages(['03324'], 'act')[0], id: 'act3', stage: '3a', reveal: { type: 'campaignRule' } },
  ],
  agendas: baseScenario.agendas,
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
    r3: baseScenario.resolutions.r3,
    r4: baseScenario.resolutions.r4,
    r5: baseScenario.resolutions.r5,
  },
}, returnCards)

export const scenario = {
  ...definitionsScenario,
  // 按重返遭遇组重建牌库（基础章节会把 03088/03332–03334 放在一边，不进牌库）。
  encounterDeck: encounterDeck(gathered.filter(card =>
    !['03088', '03332', '03333', '03334'].includes(card.code))),
}

// 52064 哈斯塔的高阶祭司：生成 - 王之宫殿；猎物 - 手牌最多。
if (scenario.enemies[HIGH_PRIEST]) {
  Object.assign(scenario.enemies[HIGH_PRIEST], { spawn: 'palaceOfTheKing', prey: 'mostCardsInHand' })
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS, PALACE_OF_THE_KING, REMOVED_PALACE,
  RETURN_LOCATIONS, HIGH_PRIEST, HASTUR_STORY_LOCATION, RETURN_STORY_CODES,
})
