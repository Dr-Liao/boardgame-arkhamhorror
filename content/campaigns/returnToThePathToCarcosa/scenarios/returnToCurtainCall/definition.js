// 重返谢幕（returnToCurtainCall · 印刷剧本参考卡 52014）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToCurtainCall.hs（包装 + 布局）+
//   Scenario/Scenarios/ThePathToCarcosa/CurtainCall.hs 的 `whenReturnTo` 分支（差异清单）。
//
// 重返差异（参考 52014 卡面 + 包装实现）：
//   - 额外收集 New Encounter Sets for Return to Curtain Call（52020 伯爵夫人）；
//   - 妄想组 → 发狂妄想（maddeningDelusions），恐惧打击 → 神经质恐惧（neuroticFear）；
//   - 使用全部六张场景 2a ——「陌生人」（03047a/b/c + 52015/52016/52017）；
//   - 剧院休息室（52018）与道具间（52019）放到一边，作为新的前厅/后台门道；
//   - 将提示卡（52014 背面规则）附属到皇家密使；皇家密使加入胜利区后每次 +1 生命。
import { scenario as baseScenario, identities as baseIdentities } from '../../../thePathToCarcosa/scenarios/curtainCall/definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor } from '../../../../../src/cards/card-rules.js'
import {
  deriveScenario, finishScenario, gather, returnToGroups, encounterDeck, location, stages,
} from '../../scenario-utils.js'

export const BASE_ID = 'curtainCall'
export const REFERENCE_CODE = '52014'
export const SCENARIO_ID = 'returnToCurtainCall'

// 基础遭遇组 + 重返差异（整组替换由参考 setup 的 orWhenReturnTo 决定）。
export const ENCOUNTER_GROUPS = returnToGroups(
  ['curtain_call', 'evil_portents', 'delusions', 'hauntings', 'cult_of_the_yellow_sign', 'striking_fear', 'rats'],
  {
    replace: { delusions: 'maddening_delusions', striking_fear: 'neurotic_fear' },
    add: ['return_to_curtain_call'],
  },
)
const returnCards = gather(['return_to_curtain_call'])
const gathered = gather(ENCOUNTER_GROUPS)
const deckCards = gathered.filter(card => !['03059', '03060'].includes(card.code))

// 六张「场景 2a·陌生人」：基础三张 + 重返三张（52015–52017 各印一张背面危险）。
export const STRANGER_ACT_CODES = Object.freeze(['03047a', '03047b', '03047c', '52015', '52016', '52017'])
export const ACT_CODES = Object.freeze(['03046', ...STRANGER_ACT_CODES, '03048'])
export const AGENDA_CODES = Object.freeze(['03044', '03045'])

export const LOCATION_IDS = Object.freeze([
  'theatre', 'lobby', 'balcony', 'backstage',
  'lightingBox', 'boxOffice', 'greenRoom', 'dressingRoom', 'rehearsalRoom', 'trapRoom',
  'theatreLounge', 'propShop',
])

// 红鲱鱼（03059）与皇家密使（03060）由条目提供关键字；52020 生成在楼座。
const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 谢幕',
  nameEn: 'Return to Curtain Call',
  intro: '你被一股看不见的力量摇醒。观众席只剩下几名观众，舞台空无一人，而你很快发现自己正在向一具尸体问话。这一次，剧院里还多了一些本不该存在的东西。',
  setup: '收集“谢幕、邪兆、发狂妄想、如影随形、黄色印记使徒、神经质恐惧、老鼠、重返谢幕”遭遇组。使用全部六张场景 2a ——「陌生人」来创建场景牌库。布置剧院、前厅、楼座与后台；将苍白面具下的男子、皇家密使、六个私密地点以及剧院休息室、道具间放在一边。调查员从剧院开始，萝拉·海耶斯改从后台开始。',
  setupNote: '按照重返剧本参考卡 52014 的布置步骤：额外收集本盒新遭遇组，并使用全部六张「场景 2a·陌生人」；剧院休息室与道具间是本盒新增的门道地点。',
  setAsideLocations: [
    'lightingBox', 'boxOffice', 'greenRoom', 'dressingRoom', 'rehearsalRoom', 'trapRoom',
    'theatreLounge', 'propShop',
  ],
  locations: {
    ...baseScenario.locations,
    theatreLounge: location('theatreLounge', '52018', ['lobby']),
    propShop: location('propShop', '52019', ['backstage']),
  },
  acts: (() => {
    const cards = stages([...ACT_CODES], 'act')
    const firstObjective = actRuleFor('03046')?.objective
    return cards.map(card => ({
      ...card,
      reveal: { type: 'campaignRule' },
      ...(card.originalCode === '03046' && firstObjective ? { objective: firstObjective } : {}),
    }))
  })(),
  agendas: stages([...AGENDA_CODES], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
  },
}, returnCards)

// 52020 伯爵夫人：生成 - 楼座（卡面印「Spawn - Balcony」）。
if (definitionsScenario.enemies['52020']) {
  Object.assign(definitionsScenario.enemies['52020'], { spawn: 'balcony' })
}

export const scenario = {
  ...definitionsScenario,
  encounterDeck: encounterDeck(deckCards),
  // 皇家密使留在胜利区；提示卡（52014 背面）随胜利区警告数加生命，记在 scenarioFlags。
  royalEmissaryReference: { referenceCode: REFERENCE_CODE, attachedTo: '03060' },
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS, ACT_CODES, AGENDA_CODES, LOCATION_IDS,
})
