// 05197《崇高利益》（For the Greater Good）
//
// 规则事实源：参考实现 `Scenario/Scenarios/TheCircleUndone/ForTheGreaterGood.hs` +
// `{Act,Agenda,Enemy,Treachery}/CardDefs|Cards/TheCircleUndone/ForTheGreaterGood` +
// `Asset/Assets/{PuzzleBox,AugustLindquist}.hs`。印刷数据只从战役 card-data.js 读取。
//
// 本章要点（规格见 artifacts/migration/tcu/p8/specs/forTheGreaterGood.md）：
//   · 秘社内斗：按 `theInvestigatorsAreMembersOfTheLodge` 记录切换场景 1a 与地点/移除卡；
//   · 南森·威克（双面）+ 机关盒：幕 1 背面生成并附属，幕 2 目标进胜利区后交给调查员；
//   · 四把钥匙：参考实现用混乱标记钥匙（Arkham.Key），本仓库无此原语 → state.scenarioKeys 纯 JSON；
//   · 银暮秘社敌人身上的毁灭会被议程强制移到当前议程（behavior 的 enemyDefeated）；
//   · 陷阱守卫者：议程 2 背面生成，敌军阶段开始吞噬同地点类人敌人。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'
import {
  INTRO, SETUP, RESOLUTION_NO, RESOLUTION_1, RESOLUTION_2, RESOLUTION_3,
} from './story-text.js'

// ---- 卡号常量 -----------------------------------------------------------------
export const SCENARIO_CARD = '05197'
// 地点（成员分支 / 非成员分支各有三处双版本）
export const LODGE_GATES_MEMBERS = '05205'
export const LODGE_GATES_WEVE = '05204'
export const LOBBY_MEMBERS = '05207'
export const LOBBY_WEVE = '05206'
export const LODGE_CELLAR_MEMBERS = '05209'
export const LODGE_CELLAR_WEVE = '05208'
export const LOUNGE = '05210'
export const VAULT = '05211'
export const LIBRARY = '05212'
export const LODGE_CATACOMBS = '05213'
export const SANCTUM_DOORWAY_CEREMONY = '05214'
export const SANCTUM_DOORWAY_HOLDING = '05215'
export const INNER_SANCTUM = '05216'
// 敌人 / 资产
export const NATHAN_WICK_INITIATION = '05217'
export const NATHAN_WICK_INDOCTRINATION = '05217b'
export const LODGE_JAILOR = '05218'
export const CELL_KEEPER = '05219'
export const SUMMONED_BEAST = '05220'
export const KNIGHT_INNER_CIRCLE = '05221'
export const KNIGHT_OUTER_VOID = '05222'
export const PUZZLE_BOX = '05228'
export const AUGUST_LINDQUIST = '05227'
// 幕 / 议程
export const ACT_WARM_WELCOME = '05200'
export const ACT_INFILTRATING = '05201'
export const ACT_OBTAINING_DEVICE = '05202'
export const ACT_FOUR_KEYS = '05203'
export const AGENDA_HIEROPHANT = '05198'
export const AGENDA_ENDS_AND_MEANS = '05199'
// 四把钥匙 id（参考实现 = 4 种混乱标记；本仓库为纯 JSON 状态）
export const KEY_IDS = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
export const KEY_LABELS = Object.freeze({
  skull: '骷髅钥匙', cultist: '异教徒钥匙', tablet: '石板钥匙', elderthing: '古神钥匙',
})

// ---- 地点 id（运行期 id 与卡号分离；双版本地点各占一个 id） ----------------------
export const LOCATIONS = Object.freeze({
  lodgeGatesMembers: 'lodgeGatesMembers',
  lodgeGatesWeve: 'lodgeGatesWeve',
  lobbyMembers: 'lobbyMembers',
  lobbyWeve: 'lobbyWeve',
  lodgeCellarMembers: 'lodgeCellarMembers',
  lodgeCellarWeve: 'lodgeCellarWeve',
  lounge: 'lounge',
  vault: 'vault',
  library: 'library',
  lodgeCatacombs: 'lodgeCatacombs',
  sanctumDoorwayCeremony: 'sanctumDoorwayCeremonyRoom',
  sanctumDoorwayHolding: 'sanctumDoorwayHoldingCells',
  innerSanctum: 'innerSanctum',
})

// ---- 遭遇牌库 -----------------------------------------------------------------
// 参考实现收齐：FGG + 罪恶之城 + 银暮秘社 + 远古恶魔 + 黑暗异教徒 + 上锁的门。
// 后三个核组不在 TCU 21 个遭遇组里（见 gaps），本章只用 TCU 的 3 组。
const deckGroups = ['forTheGreaterGood', 'cityOfSins', 'silverTwilightLodge']
// 放在一边（场外）的遭遇卡：双面南森·威克（两版都登记，实际按分支只用一版）、响应召唤的怪兽。
const setAsideCodes = [NATHAN_WICK_INITIATION, NATHAN_WICK_INDOCTRINATION, SUMMONED_BEAST]
const setAside = new Set(setAsideCodes)
const gathered = encounterCards(deckGroups).filter(card => !setAside.has(card.code))
const definitions = encounterDefinitions([
  ...gathered,
  ...[...setAside].map(code => ALL_CARDS[code]),
])

// 印刷卡面修正（共享遭遇表字段不完整时按卡面覆盖；数值仍来自 ALL_CARDS）。
Object.assign(definitions.enemies[SUMMONED_BEAST], { healthPerInvestigator: 6 })
Object.assign(definitions.enemies[NATHAN_WICK_INITIATION], { prey: null })
Object.assign(definitions.enemies[NATHAN_WICK_INDOCTRINATION], { prey: null })
// 核心圈骑士的「猎物 - 控制最多钥匙」由 behavior.preyTarget 按 scenarioKeys 计算。
Object.assign(definitions.enemies[KNIGHT_INNER_CIRCLE], { prey: 'mostKeys' })

// ---- 地点 ---------------------------------------------------------------------
// 符号与连线取自 Location/CardDefs/TheCircleUndone/ForTheGreaterGood.hs。
// 「我们一直在等你」三处（无符号地图侧）用 explicitConnections 手写邻接，避免与
// 「秘社成员方可入内」版本互相串线；两版共用同一张桌面格位（布局坐标相同）。
const locations = {
  lodgeGatesMembers: location(LOCATIONS.lodgeGatesMembers, LODGE_GATES_MEMBERS, {
    symbol: 'diamond', links: ['t'],
  }),
  lodgeGatesWeve: location(LOCATIONS.lodgeGatesWeve, LODGE_GATES_WEVE, {
    explicitConnections: [LOCATIONS.lobbyWeve],
  }),
  lobbyMembers: location(LOCATIONS.lobbyMembers, LOBBY_MEMBERS, {
    symbol: 'circle', links: ['t', 'moon'],
  }),
  lobbyWeve: location(LOCATIONS.lobbyWeve, LOBBY_WEVE, {
    explicitConnections: [LOCATIONS.lodgeGatesWeve, LOCATIONS.lodgeCellarWeve, LOCATIONS.lounge],
  }),
  lodgeCellarMembers: location(LOCATIONS.lodgeCellarMembers, LODGE_CELLAR_MEMBERS, {
    symbol: 't', links: ['diamond', 'circle', 'squiggle'],
  }),
  lodgeCellarWeve: location(LOCATIONS.lodgeCellarWeve, LODGE_CELLAR_WEVE, {
    explicitConnections: [LOCATIONS.lobbyWeve, LOCATIONS.lodgeCatacombs],
  }),
  lounge: location(LOCATIONS.lounge, LOUNGE, {
    symbol: 'moon', links: ['circle', 'heart', 'plus'],
  }),
  vault: location(LOCATIONS.vault, VAULT, { symbol: 'plus', links: ['moon'] }),
  library: location(LOCATIONS.library, LIBRARY, { symbol: 'heart', links: ['moon'] }),
  lodgeCatacombs: location(LOCATIONS.lodgeCatacombs, LODGE_CATACOMBS, {
    symbol: 'squiggle', links: ['t', 'star', 'triangle', 'square', 'hourglass'],
  }),
  // 圣堂门廊：入场时以未揭示面（圣堂门廊 / 星形）放置，揭示后翻成典礼室（三角）/
  // 拘禁室（方形）。两面的连线都只有 squiggle（地下墓穴），因此静态邻接不受影响。
  sanctumDoorwayCeremonyRoom: location(LOCATIONS.sanctumDoorwayCeremony, SANCTUM_DOORWAY_CEREMONY, {
    symbol: 'star', links: ['squiggle'],
    unrevealed: {
      name: '圣堂门廊', subname: '', symbol: 'star', links: ['squiggle'],
      traits: ['秘社', '圣堂'],
    },
  }),
  sanctumDoorwayHoldingCells: location(LOCATIONS.sanctumDoorwayHolding, SANCTUM_DOORWAY_HOLDING, {
    symbol: 'star', links: ['squiggle'],
    unrevealed: {
      name: '圣堂门廊', subname: '', symbol: 'star', links: ['squiggle'],
      traits: ['秘社', '圣堂'],
    },
  }),
  innerSanctum: location(LOCATIONS.innerSanctum, INNER_SANCTUM, {
    symbol: 'star', links: ['squiggle'],
    // 印刷背面名同为「圣堂内室」，只是符号为沙漏；连线同样只有 squiggle。
    unrevealed: { name: '圣堂内室', subname: '', symbol: 'hourglass', links: ['squiggle'] },
  }),
}
linkSymbolLocations(locations)

// ---- 幕 / 议程 ----------------------------------------------------------------
// 默认（非成员）用「渗透秘社」；`membersAct1` 供 behavior.preScenarioSetup 按记录替换。
const actExtras = (index) => ({
  reveal: { type: 'campaignRule' },
  // 1a 目标：组队支付线索（渗透秘社 2×人数；热烈欢迎 3×人数）。
  ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 2 } } : {}),
})
export const ACT_DECK = stages([ACT_INFILTRATING, ACT_OBTAINING_DEVICE, ACT_FOUR_KEYS], 'act')
  .map((act, index) => ({ ...act, ...actExtras(index) }))
export const membersAct1 = {
  ...stages([ACT_WARM_WELCOME], 'act')[0],
  ...actExtras(0), objective: { type: 'clues', perInvestigator: 3 },
}
export const AGENDA_DECK = stages([AGENDA_HIEROPHANT, AGENDA_ENDS_AND_MEANS], 'agenda')
  .map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' } }))

// ---- 剧情资产 ----------------------------------------------------------------
export const STORY_ASSETS = storyCards([PUZZLE_BOX, AUGUST_LINDQUIST])

export const scenario = {
  id: 'forTheGreaterGood',
  originalCode: SCENARIO_CARD,
  name: '万象无终 · 崇高利益',
  intro: INTRO,
  setup: SETUP,
  startLocation: LOCATIONS.lodgeGatesMembers,
  locations,
  setAsideLocations: [
    LOCATIONS.library, LOCATIONS.vault, LOCATIONS.innerSanctum,
    LOCATIONS.sanctumDoorwayHolding, LOCATIONS.sanctumDoorwayCeremony,
  ],
  acts: ACT_DECK,
  agendas: AGENDA_DECK,
  ...definitions,
  storyAssets: STORY_ASSETS,
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: RESOLUTION_NO,
    r1: RESOLUTION_1,
    r2: RESOLUTION_2,
    r3: RESOLUTION_3,
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
