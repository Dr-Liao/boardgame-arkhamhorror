// 钥匙议会（Congress of the Keys · 09694 · 通古斯卡 · 档案 #59-Z）· 剧本数据。
//
// 参考（锁定来源，P0 已登记哈希）：
//   · `Scenario/Scenarios/TheScarletKeys/CongressOfTheKeys.hs`：开场审判的 11 票计票（增量规则）、
//     三种冒险设置版本（v.I 逃离 / v.II 主动出发 / v.III 同志会内乱）、异界牌库与残骸之城迷你卡、
//     结局 1/2 与「存在抹除」；
//   · `Act|Agenda|Location|Enemy/CardDefs/TheScarletKeys/CongressOfTheKeys.hs`：11 张地点（4 组
//     圣堂/巢穴双面 + 3 张异界高塔）、6 张幕（秘密与谎言 v.I/II/III + 登塔 + 登顶 + 最后的疏忽）、
//     3 张密谋、拟态克星；
//   · `Campaigns/TheScarletKeys/Key/Cards.hs`：本章审判会把「跳过的章节」对应的钥匙判给同志会成员
//     （末绽之花 09544 / 恸哭女士 09565 / 玄丧之镜 09634 / 法罗斯之光 09659 / 影穑 09680 / 镜刃 09768）；
//   · locale `scenarios/congressOfTheKeys.json`（intro/tokens/version1-3 setup/resolutions）。
//
// 本文件只放**数据**（地点定义、幕/密谋定义、投票表、密钥归属表、正文），不含函数式流程；
// 流程与计票在 `behavior.js`，混乱符号在 `chaos.js`，桌面坐标在 `layout.js`。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterDefinitions, encounterGroupDeck, identitiesFor, location, stage } from '../../card-data.js'
import { chapterSection, flattenStory, resolutionText } from '../../story-access.js'
import { CONGRESS_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'congressOfTheKeys'
export const REFERENCE_CODE = '09694'
export const CAMPAIGN_ID = 'theScarletKeys'

// 本章 22 张印刷记录：1 提示卡 + 3 密谋 + 6 幕 + 11 地点 + 1 敌人。
export const RAW_CODES = Object.freeze({
  scenario: '09694',
  agenda1: '09695', agenda2: '09696', agenda3: '09697',
  act1v1: '09698', act1v2: '09699', act1v3: '09700',
  act2: '09701', act3: '09702', act4: '09703',
  scarletHallsSanctum: '09704', scarletHallsLair: '09705',
  congressChamberSanctum: '09706', congressChamberLair: '09707',
  coterieLibrarySanctum: '09708', coterieLibraryLair: '09709',
  keyReliquarySanctum: '09710', keyReliquaryLair: '09711',
  knottedTower: '09712', gravityDefyingClimb: '09713', toweringVertex: '09714',
  mimeticNemesis: '09715',
})

// 本章直接使用的遭遇组。
//   · congressOfTheKeys —— 专属组（本章 11 地点 + 3 幕 + 3 密谋 + 拟态克星）；
//   · redCoterie        —— 审判的 10 位同志会成员（敌人面）与戴红手套的男子；
//   · beyondTheBeyond   —— 异界牌库（残骸之城）与超维恐怖；
//   · globetrotting     —— 判给同志的六把绯红密钥（镜刃 09768 的条目在此组）；
//   · 其余为参考 setup 的 gather 组（有的只取子集，见 EXTERNAL_SUBSETS）。
export const GATHER_GROUPS = Object.freeze([
  'congressOfTheKeys', 'redCoterie', 'scarletSorcery', 'spatialAnomaly', 'spreadingCorruption',
  'lockedDoors', 'agentsOfTheOutside', 'beyondTheBeyond', 'outsiders', 'secretWar', 'ancientEvils',
  'strikingFear', 'globetrotting',
])
export const SHARED_GROUPS = Object.freeze(GATHER_GROUPS.filter(group => group !== 'congressOfTheKeys'))
// 参考 setup 的 gatherJust 子集：恐惧打击只取「呆若木鸡」与「刺耳之声」。
export const EXTERNAL_SUBSETS = Object.freeze({
  strikingFear: Object.freeze(['01164', '01165']),
})

// 参考 setup 的三个版本各收哪些组（v.II/v.III 相同；v.I 另有独立第二遭遇牌库）。
export const VERSION_GATHER_GROUPS = Object.freeze({
  1: Object.freeze(['congressOfTheKeys', 'redCoterie', 'scarletSorcery', 'spatialAnomaly', 'spreadingCorruption', 'lockedDoors']),
  2: Object.freeze(['congressOfTheKeys', 'agentsOfTheOutside', 'beyondTheBeyond', 'outsiders', 'redCoterie',
    'secretWar', 'spreadingCorruption', 'ancientEvils', 'strikingFear']),
  3: Object.freeze(['congressOfTheKeys', 'agentsOfTheOutside', 'beyondTheBeyond', 'outsiders', 'redCoterie',
    'secretWar', 'spreadingCorruption', 'ancientEvils', 'strikingFear']),
})
// v.I 的第二遭遇牌库（域外篇）：幕 1 推进后才换上（behavior.enterOutside）。
export const SECOND_GATHER_GROUPS = Object.freeze([
  'agentsOfTheOutside', 'beyondTheBeyond', 'outsiders', 'secretWar', 'ancientEvils', 'strikingFear',
])

// ---------------------------------------------------------------------------
// 地点（11 张）
// ---------------------------------------------------------------------------
// 4 组「圣堂 / 巢穴」双面地点：两种版本的布置只放其中一面，另一面从游戏中移除。
// 三个「同志会圣所」在布置时随机分配到三个槽位（参考实现 placeInGrid 洗牌）。
export const SANCTUARY_SLOTS = Object.freeze(['congressChamber', 'coterieLibrary', 'keyReliquary'])
export const HALL_SLOTS = Object.freeze(['scarletHalls'])
export const SANCTUM_GROUP_SLOTS = Object.freeze([...HALL_SLOTS, ...SANCTUARY_SLOTS])
export const TOWER_LOCATION_IDS = Object.freeze(['knottedTower', 'gravityDefyingClimb', 'toweringVertex'])
export const SANCTUM_FACE_IDS = Object.freeze(Object.fromEntries(
  SANCTUM_GROUP_SLOTS.map(slot => [`${slot}Sanctum`, slot])))
export const LAIR_FACE_IDS = Object.freeze(Object.fromEntries(
  SANCTUM_GROUP_SLOTS.map(slot => [`${slot}Lair`, slot])))
export const LOCATION_IDS = Object.freeze([...Object.keys(SANCTUM_FACE_IDS), ...Object.keys(LAIR_FACE_IDS), ...TOWER_LOCATION_IDS])
export const START_LOCATION_BY_VERSION = Object.freeze({ 1: 'scarletHallsLair', 2: 'scarletHallsSanctum', 3: 'scarletHallsSanctum' })
// 默认起始地点（manifest 的 startLocationId 只能是一个；运行时按版本改写，见 behavior.setupLocations）。
export const START_LOCATION = START_LOCATION_BY_VERSION[2]

// 地点连接（卡面连接符号）：
//   · 猩红走廊（波浪）↔ 三张同志会圣所（正面方形/三角/菱形、背面圆形，均含波浪）；
//   · 同志会圣所彼此也以「波浪」互连；
//   · 万千纠结之塔（月牙）↔ 悖逆重力之阶（等号）↔ 睥睨众生之巅（星形）。
// 圣堂面与巢穴面是同一地点的两个印刷面，两个 id 都保留同一组连接，布置时只有一面在场。
export function staticConnections() {
  const out = {}
  for (const id of LOCATION_IDS) out[id] = []
  const sanctumIds = LOCATION_IDS.filter(id => SANCTUM_FACE_IDS[id] || LAIR_FACE_IDS[id])
  for (const from of sanctumIds) for (const to of sanctumIds) if (from !== to) out[from].push(to)
  out.knottedTower.push('gravityDefyingClimb')
  out.gravityDefyingClimb.push('knottedTower', 'toweringVertex')
  out.toweringVertex.push('gravityDefyingClimb')
  return out
}
const staticEdges = staticConnections()

// 印刷线索：猩红走廊 0；三张圣所 1/调查员；藏钥馆圣堂 1/调查员；三张异界高塔 0（高塔不产生线索）。
const LOCATION_SPECS = Object.freeze([
  ['scarletHallsSanctum', RAW_CODES.scarletHallsSanctum, { clues: 0, cluesFixed: true }],
  ['scarletHallsLair', RAW_CODES.scarletHallsLair, { clues: 0, cluesFixed: true }],
  ['congressChamberSanctum', RAW_CODES.congressChamberSanctum, { clues: 1, cluesFixed: false }],
  ['congressChamberLair', RAW_CODES.congressChamberLair, { clues: 1, cluesFixed: false }],
  ['coterieLibrarySanctum', RAW_CODES.coterieLibrarySanctum, { clues: 1, cluesFixed: false }],
  ['coterieLibraryLair', RAW_CODES.coterieLibraryLair, { clues: 1, cluesFixed: false }],
  ['keyReliquarySanctum', RAW_CODES.keyReliquarySanctum, { clues: 1, cluesFixed: false }],
  ['keyReliquaryLair', RAW_CODES.keyReliquaryLair, { clues: 1, cluesFixed: false }],
  ['knottedTower', RAW_CODES.knottedTower, { clues: 0, cluesFixed: true }],
  ['gravityDefyingClimb', RAW_CODES.gravityDefyingClimb, { clues: 0, cluesFixed: true }],
  ['toweringVertex', RAW_CODES.toweringVertex, { clues: 0, cluesFixed: true }],
])

const locationData = ([id, code, spec]) => location({
  id, code, cluesFixed: spec.cluesFixed, clues: spec.clues,
  connections: [...staticEdges[id]],
})
export const LOCATIONS = Object.freeze(Object.fromEntries(
  LOCATION_SPECS.map(spec => [spec[0], Object.freeze(locationData(spec))])))

export function clueValueOf(state, locationId) {
  const definition = LOCATIONS[locationId]
  if (!definition) return 0
  const count = Math.max(1, Number(state?.numInvestigators) || (state?.investigators || []).length || 1)
  if (definition.cluesFixed != null && definition.cluesFixed !== false) return Number(definition.cluesFixed) || 0
  return (Number(definition.cluesPerInvestigator ?? definition.clues) || 0) * count
}

// 地点规则**数据**（地点不建单卡条目；behavior 按这些键分派，键名即读点）。
//   · sanctum / lair 双面：同一格子两种布置版本各放一面；
//   · 圣堂面偏「行动/反应」，巢穴面偏「强制/常驻」——与参考 CardDefs 逐张对应。
export const LOCATION_RULES = Object.freeze({
  scarletHallsSanctum: Object.freeze({ action: 'fastExhaustConspiratorMove' }),
  scarletHallsLair: Object.freeze({ forced: 'enterMoveExtraCost' }),
  congressChamberSanctum: Object.freeze({ action: 'searchTopSixForAsset' }),
  congressChamberLair: Object.freeze({ constant: 'readyCoterieAssetCostPlusTwo' }),
  coterieLibrarySanctum: Object.freeze({ action: 'reduceNextAssetCostTwo', fastOption: 'exhaustConspirator' }),
  coterieLibraryLair: Object.freeze({ forced: 'investigateFailShiftNearestCoterieKeys' }),
  keyReliquarySanctum: Object.freeze({ reaction: 'empowerKeyInsteadOfClues' }),
  keyReliquaryLair: Object.freeze({ constant: 'shroudPlusTwoPerUnstableKey' }),
  knottedTower: Object.freeze({ reaction: 'moveToLocationPlacedAdjacent' }),
  gravityDefyingClimb: Object.freeze({ forced: 'cityOfRemnantsSequence', enterCost: Object.freeze({ cluesPerInvestigator: 4 }) }),
  toweringVertex: Object.freeze({ forced: 'vertexMiniCardSequence', cannotEnterUntilSequence: true, redGlovedManCannotBeDefeated: true }),
})

// 阴影位置（残骸之城迷你卡的方位；异界高塔旁的迷你卡按左/中/右摆放）。
export const SHADOW_POSITIONS = Object.freeze(['left', 'middle', 'right'])
export const CITY_OF_REMNANTS_KINDS = Object.freeze({
  left: 'CityOfRemnantsL', middle: 'CityOfRemnantsM', right: 'CityOfRemnantsR',
})
// 本仓库卡表只收录 8 张残骸之城记录（09747a/b/c、09748a/b、09749a/b、09750），
// 印刷组共 9 张；异界牌库按这 8 条洗牌（差异记在 scenarioGaps）。
export const OTHERWORLD_LOCATION_CODES = Object.freeze([
  '09747a', '09747b', '09747c', '09748a', '09748b', '09749a', '09749b', '09750',
])
// 隐藏迷你卡的 kind：原语要求字母开头的稳定标识（不能是纯数字卡号），因此按卡号映射。
export const CONCEALED_KINDS = Object.freeze({
  '09752': 'RedGlovedMan',
  '09715': 'MimeticNemesis',
})
export const DECOY_KIND = 'Decoy'
// 隐匿 X：戴红手套的男子 1/调查员；拟态克星 2/调查员（参考 act 1a / act 3b 的布置）。
export const CONCEALED_PER_INVESTIGATOR = Object.freeze({
  '09752': 1,
  '09715': 2,
})

// ---------------------------------------------------------------------------
// 同志会成员（审判的 11 票）
// ---------------------------------------------------------------------------
// 戴红手套的男子永远「诡异地沉默」，不是投票者以外的第 12 人：参考实现的 votes 表把它固定为
// EerilySilent（他既不是 yea 也不是 nay，且没有敌人卡的成员——马萨伊/阿巴冉/拉辛——也有票）。
// `enemyCode` 为 null 表示该成员没有敌人卡（只计票、不生成敌人）。
export const COTERIE_MEMBERS = Object.freeze([
  Object.freeze({ id: 'redGlovedMan', name: '戴红手套的男子', nameEn: 'The Red-Gloved Man', enemyCode: '09752', conspiratorCode: null, fixedVote: 'eerilySilent' }),
  Object.freeze({ id: 'laChicaRoja', name: '红衣女郎', nameEn: 'La Chica Roja', enemyCode: '09753', conspiratorCode: null }),
  Object.freeze({ id: 'sanguineWatcher', name: '血色监视者', nameEn: 'The Sanguine Watcher', enemyCode: '09754', conspiratorCode: null }),
  Object.freeze({ id: 'beast', name: '深红斗篷的恶兽', nameEn: 'The Beast in a Cowl of Crimson', enemyCode: '09755', conspiratorCode: null }),
  Object.freeze({ id: 'claretKnight', name: '暗红骑士', nameEn: 'The Claret Knight', enemyCode: '09756', conspiratorCode: null }),
  Object.freeze({ id: 'thorne', name: '索恩', nameEn: 'Thorne', enemyCode: '09757', conspiratorCode: null }),
  Object.freeze({ id: 'desiderio', name: '德西德柔·戴佳多·欧瓦瑞兹', nameEn: 'Desiderio Delgado Álvarez', enemyCode: '09758', conspiratorCode: null }),
  Object.freeze({ id: 'amaranth', name: '苋', nameEn: 'Amaranth', enemyCode: '09759', conspiratorCode: null }),
  Object.freeze({ id: 'tzuSanNiang', name: '朱三娘', nameEn: 'Tzu San Niang', enemyCode: '09760', conspiratorCode: null }),
  Object.freeze({ id: 'aliki', name: '艾里奇·佐尼·奥佩勒曲亚', nameEn: 'Aliki Zoni Uperetria', enemyCode: '09761', conspiratorCode: null }),
  Object.freeze({ id: 'ece', name: '艾婕·萨辛', nameEn: 'Ece Şahin', enemyCode: null, conspiratorCode: '09584' }),
])
export const MEMBER_BY_ID = Object.freeze(Object.fromEntries(COTERIE_MEMBERS.map(member => [member.id, member])))
export const MEMBER_BY_ENEMY_CODE = Object.freeze(Object.fromEntries(
  COTERIE_MEMBERS.filter(member => member.enemyCode).map(member => [member.enemyCode, member])))

// 参考实现里「有敌人卡」的同志会成员（可被布置进场/洗入遭遇牌库）。
export const COTERIE_ENEMY_CODES = Object.freeze(COTERIE_MEMBERS.map(member => member.enemyCode).filter(Boolean))
export const RED_GLOVED_MAN = '09752'

// ---------------------------------------------------------------------------
// 绯红密钥（审判时按「跳过的章节」判给同志会成员）
// ---------------------------------------------------------------------------
// 六把密钥的物理卡号与两面：实体由 `api.mechanics.tsk.keys` 登记，章节行为在审判时把它们绑给
// 对应敌人；本章**不新建**密钥条目（密钥面条目落在各自章节目录），只读 `assetRule.keyShift`。
export const CONGRESS_KEYS = Object.freeze([
  Object.freeze({ id: '09659', stableFace: '09659a', unstableFace: '09659b', chapterId: 'dogsOfWar', enemyCode: '09756', alternateEnemyCode: '09755' }),
  Object.freeze({ id: '09544', stableFace: '09544a', unstableFace: '09544b', chapterId: 'deadHeat', enemyCode: '09759' }),
  Object.freeze({ id: '09634', stableFace: '09634a', unstableFace: '09634b', chapterId: 'onThinIce', enemyCode: '09757' }),
  Object.freeze({ id: '09768', stableFace: '09768a', unstableFace: '09768b', chapterId: 'dancingMad', enemyCode: '09758' }),
  Object.freeze({ id: '09565', stableFace: '09565a', unstableFace: '09565b', chapterId: 'sanguineShadows', enemyCode: '09754' }),
  Object.freeze({ id: '09680', stableFace: '09680a', unstableFace: '09680b', chapterId: 'shadesOfSuffering', enemyCode: '09760' }),
])
export const KEY_BY_ID = Object.freeze(Object.fromEntries(CONGRESS_KEYS.map(key => [key.id, key])))

// ---------------------------------------------------------------------------
// 遭遇牌
// ---------------------------------------------------------------------------
// 专属组只有拟态克星一张非地点/幕/密谋卡（09715）；它按 setup 放在一边，不进遭遇牌库。
export const ENEMY_CODES = Object.freeze([RAW_CODES.mimeticNemesis])
export const TREACHERY_CODES = Object.freeze([])
// 剧情资产：艾婕·萨辛（09584，唯一在卡表里的同志会同谋支援；其余同谋版本不在本仓库卡表，
// 见 scenarioGaps）。
export const STORY_ASSET_CODES = Object.freeze(['09584'])
// 放在一边：三张异界地点 + 拟态克星（参考 `toSetAside`）。
export const SET_ASIDE_LOCATION_CODES = Object.freeze([RAW_CODES.knottedTower, RAW_CODES.gravityDefyingClimb, RAW_CODES.toweringVertex])
export const SET_ASIDE_CODES = Object.freeze([RAW_CODES.mimeticNemesis])
// 开局在场：无固定卡（同志会成员由投票动态决定）。
export const IN_PLAY_CODES = Object.freeze([])

// 2026-11-13 P0：遭遇牌库按版本由 gather 组展开（见上方 VERSION_GATHER_GROUPS）。
// redCoterie 敌人按审判结论在 setup 阶段动态加入（behavior.modifyDeck 读 coterieIntoDeck）；
// 旧实现是空数组，导致神话阶段永远抽不到遭遇卡。
function deckForGroups(groups) {
  const baseGroups = groups.filter(group => group !== 'strikingFear' && group !== 'redCoterie')
  const deck = encounterGroupDeck(baseGroups, { exclude: [...SET_ASIDE_CODES, ...SET_ASIDE_LOCATION_CODES] })
  // 恐惧打击只取「呆若木鸡 / 刺耳之声」各印刷份数，不取「腐烂遗骸」。
  if (groups.includes('strikingFear')) {
    for (const code of EXTERNAL_SUBSETS.strikingFear) {
      const quantity = Math.max(1, Number(ALL_CARDS[code].quantity) || 1)
      for (let index = 0; index < quantity; index += 1) deck.push(code)
    }
  }
  return deck.sort()
}
export function encounterDeckForVersion(version = 2) {
  return Object.freeze(deckForGroups(VERSION_GATHER_GROUPS[version] || VERSION_GATHER_GROUPS[2]))
}
export const ENCOUNTER_DECK = encounterDeckForVersion(2)
// v.I 第二遭遇牌库；写入口在 behavior.setupLocations（campaign.tsk.outsideEncounterDeck）。
export const SECOND_ENCOUNTER_DECK = Object.freeze(deckForGroups(SECOND_GATHER_GROUPS))

// 需要注册进全局遭遇表的卡号：所有版本牌库 + 动态同志会敌人 + 拟态克星/剧情资产。
export const ENCOUNTER_DEFINITION_CODES = Object.freeze([...new Set([
  ...ENCOUNTER_DECK, ...SECOND_ENCOUNTER_DECK, ...COTERIE_ENEMY_CODES, ...SET_ASIDE_CODES,
  ...SET_ASIDE_LOCATION_CODES, ...STORY_ASSET_CODES,
])])
const sharedPrinted = encounterDefinitions(ENCOUNTER_DEFINITION_CODES)

const printedEncounters = encounterDefinitions([...ENEMY_CODES, ...STORY_ASSET_CODES])
const enemyDefinition = code => ({
  ...printedEncounters.enemies[code],
  code, originalCode: code,
  traits: [...(ALL_CARDS[code].traits || [])],
})
export const enemies = Object.freeze({
  ...sharedPrinted.enemies,
  ...Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)])),
})
export const treacheries = Object.freeze({ ...sharedPrinted.treacheries })
export const storyAssets = Object.freeze(Object.fromEntries(STORY_ASSET_CODES.map(code => [code,
  { ...printedEncounters.storyAssets[code], code, originalCode: code }])))
// 同志会敌人（共享组 redCoterie）也要能被 `api.spawn` 按 id 生成：把它们的印刷定义并进本章敌人表。
// 这些卡不属于本章遭遇组，不参与 manifest 的区域统计（只在 identities 里提供印刷身份）。
const coterieEnemyDefinitions = Object.fromEntries(COTERIE_MEMBERS.filter(member => member.enemyCode).map(member => {
  const definition = encounterDefinitions([member.enemyCode]).enemies[member.enemyCode]
  return [member.id, {
    ...definition, id: member.id, code: member.enemyCode, originalCode: member.enemyCode,
    traits: [...(ALL_CARDS[member.enemyCode].traits || [])],
  }]
}))
export const coterieEnemies = Object.freeze(coterieEnemyDefinitions)

// ---------------------------------------------------------------------------
// 幕（6 张：秘密与谎言 v.I/II/III + 登塔 + 登顶 + 最后的疏忽）
// ---------------------------------------------------------------------------
const actDefinition = (id, code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number }), id, originalCode: code, code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    chapterFlow: CHAPTER_ID, ...extra,
  }
}
// 幕 1（v.I / v.III）：回合结束时若全员与戴红手套的男子同地点，可共同支付 2/调查员 线索推进。
export const ACT1_CLUE_OBJECTIVE = Object.freeze({ type: 'clues', perInvestigator: 2 })
export const ACT1V1 = Object.freeze(actDefinition('act1v1', RAW_CODES.act1v1, 1, {
  objective: ACT1_CLUE_OBJECTIVE, version: 1,
}))
// 幕 1（v.II）：神话阶段不抽遭遇卡；任意回合结束时全员同地点即可推进（越快越好）。
export const ACT1V2 = Object.freeze(actDefinition('act1v2', RAW_CODES.act1v2, 1, {
  objective: Object.freeze({ type: 'campaignRule' }), version: 2, skipMythosDraw: true,
}))
export const ACT1V3 = Object.freeze(actDefinition('act1v3', RAW_CODES.act1v3, 1, {
  objective: ACT1_CLUE_OBJECTIVE, version: 3,
}))
export const ACT1_VERSIONS = Object.freeze({ 1: ACT1V1, 2: ACT1V2, 3: ACT1V3 })
// 幕 2 登塔：有人进入悖逆重力之阶即推进。
export const ACT2 = Object.freeze(actDefinition('act2', RAW_CODES.act2, 2, {
  objective: Object.freeze({ type: 'enterLocation', location: 'gravityDefyingClimb' }),
}))
// 幕 3 登顶：有人进入睥睨众生之巅即推进（入口被揭露顺序锁住）。
export const ACT3 = Object.freeze(actDefinition('act3', RAW_CODES.act3, 3, {
  objective: Object.freeze({ type: 'enterLocation', location: 'toweringVertex' }),
}))
// 幕 4 最后的疏忽：拟态克星被击败即推进（→ 结局 1）。
export const ACT4 = Object.freeze(actDefinition('act4', RAW_CODES.act4, 4, {
  objective: Object.freeze({ type: 'defeatEnemy', enemy: RAW_CODES.mimeticNemesis }),
}))
export const acts = Object.freeze([ACT1V1, ACT2, ACT3, ACT4])
export const ACT_CARDS = Object.freeze([ACT1V1, ACT1V2, ACT1V3, ACT2, ACT3, ACT4])

// ---------------------------------------------------------------------------
// 密谋（3 张）
// ---------------------------------------------------------------------------
const agendaDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id: `agenda${number}`, originalCode: code, code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    chapterFlow: CHAPTER_ID, ...extra,
  }
}
// 密谋 1 因果汇流（毁灭 3）：推进时若当前是幕 2/3/4 则跳过 b 面，直接进入密谋 2a。
export const AGENDA1 = Object.freeze(agendaDefinition(RAW_CODES.agenda1, 1, { skipBackOnLaterAct: true }))
// 密谋 2 不速之界（毁灭 10）：b 面「跨维震撼」。
export const AGENDA2 = Object.freeze(agendaDefinition(RAW_CODES.agenda2, 2))
// 密谋 3 万物尽红（毁灭 7）：b 面每位调查员被击败（→ 结局 2）。
export const AGENDA3 = Object.freeze(agendaDefinition(RAW_CODES.agenda3, 3, { defeatsEveryoneOnBack: true }))
export const agendas = Object.freeze([AGENDA1, AGENDA2, AGENDA3])

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
const resolutionSection = key => chapterSection(CHAPTER_ID, `resolutions.${key}`, null)
const resolutionOf = key => {
  const text = resolutionText(CHAPTER_ID, key)
  if (text) return text
  const section = resolutionSection(key)
  return section == null ? key : flattenStory(section) || key
}
// 战败正文（DEFEATED_TEXT）先构建，供 noResolution 结局复用。
const defeatedTitle = chapterSection(CHAPTER_ID, 'resolutions.defeated.title', '调查员被击败') || '调查员被击败'
const defeatedBody = flattenStory(chapterSection(CHAPTER_ID, 'resolutions.defeated.body', '')) || ''
const defeatedStory = [defeatedTitle, defeatedBody].filter(Boolean).join('\n\n')
// 2026-11-13 P0：引擎用 finishScenario('noResolution') 表示「全员阵亡/未达成任何结局」，
// finishScenario 要求 scenario.resolutions 必须声明该键（否则抛「未知剧本结局」并中断终章）。
// behavior.resolution 已把 noResolution 与 resolution2 走同一失败分支；这里补上正文来源。
export const resolutions = Object.freeze({
  resolution1: resolutionOf('resolution1'),
  resolution2: resolutionOf('resolution2'),
  noResolution: defeatedStory || resolutionOf('resolution2'),
})
export const DEFEATED_TEXT = Object.freeze({
  title: defeatedTitle,
  body: defeatedBody,
})
// 结局 1 的奖励经验（印刷「因为其拯救了自己的维度」+5）。
export const RESOLUTION1_BONUS_XP = 5
export const RESOLUTION1_TRAUMA = Object.freeze({ physical: 2, mental: 2 })

// ---------------------------------------------------------------------------
// 正文：开场（两条入口）、审判 8 段、三套设置、特别规则
// ---------------------------------------------------------------------------
const introSection = chapterSection(CHAPTER_ID, 'intro', {}) || {}
const trialText = index => flattenStory(chapterSection(CHAPTER_ID, `intro.theTrial${index}`, ''))
const setupSection = version => chapterSection(CHAPTER_ID, `version${version}.setup`, {}) || {}

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  introTitle: introSection.title || '档案#59-Z：钥匙议会',
  // 因时间耗尽被押来（时间 ≥ 35）与主动前往通古斯的分岔。
  introForced: flattenStory(introSection.intro1 || ''),
  introVoluntary: flattenStory(introSection.intro2 || ''),
  intro: flattenStory(introSection.intro2 || ''),
  introChoices: Object.freeze([
    { id: 'deemedALiability', label: introSection.label?.deemedALiability || '进入审判 2（被判为负担）' },
    { id: 'overthrow', label: introSection.label?.overthrow || '进入审判 3（颠覆同志会）' },
    { id: 'join', label: introSection.label?.join || '进入审判 4（加入同志会）' },
    { id: 'deemedAnAsset', label: introSection.label?.deemedAnAsset || '进入审判 5（被判为可用资产）' },
  ]),
  trialTitle: flattenStory(chapterSection(CHAPTER_ID, 'intro.theTrial1', '')),
  trialParagraphs: Object.freeze(Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [index + 1, trialText(index + 1)]))),
  trialResult: flattenStory(chapterSection(CHAPTER_ID, 'intro.trialResult', '')),
  trialEarlyExits: Object.freeze({
    theCellKnowsTheTrueNatureOfTheCoterie: flattenStory(chapterSection(CHAPTER_ID, 'intro.theCellKnowsTheTrueNatureOfTheCoterie', '')),
    eerilySilent: flattenStory(chapterSection(CHAPTER_ID, 'intro.eerilySilent', '')),
    continueTheTrial: flattenStory(chapterSection(CHAPTER_ID, 'intro.continueTheTrial', '')),
    noMatterWhat: flattenStory(chapterSection(CHAPTER_ID, 'intro.noMatterWhat', '')),
  }),
  setupVersion1: flattenStory(setupSection(1)),
  setupVersion2: flattenStory(setupSection(2)),
  setupVersion3: flattenStory(setupSection(3)),
  setup: flattenStory(setupSection(2)),
  specialRules: [
    '【特别规则：审判投票（Yea / Nay）】开场按剧本日志逐段计票：赞成票要看你去死，反对票要护你周全，'
      + '弃权与「诡异地沉默」既非赞成也非反对。赞成 ≥ 反对 → 被判有罪（设置版本一）；'
      + '反对居多 → 可尝试颠覆（版本二）、加入（版本二）或被视为可用工具（版本二）；'
      + '若已知同志会真相、或有至少 3 位成员诡异地沉默，则立即跳到版本三。',
    '【特别规则：同志会（Coterie）】戴红手套的男子诡异地沉默；投票决定哪些同志会敌人进场、'
      + '哪些同谋支援在场。本章圣堂/巢穴双面地点只放置与版本相符的一面。',
    '【特别规则：异界与阴影】幕 1 背面把场上地点全部移出游戏，改放万千纠结之塔、悖逆重力之阶、'
      + '睥睨众生之巅成一竖列，并把残骸之城迷你卡按左/中/右摆放在高塔旁；'
      + '环绕悖逆重力之阶的迷你卡必须按 左 → 中 → 右 的顺序揭露才能进入睥睨众生之巅。',
    '【特别规则：绯红密钥】审判把「被跳过的章节」对应的密钥判给同志会成员；'
      + '敌人变换钥匙时结算该面的效果。玩家侧可每轮变换一次自己控制的密钥。',
    '【特别规则：空洞与存在抹除】[elderthing] 把投入本次检定的每张卡放到一边作为空洞；'
      + '结局 2「特别小组成为空洞」会把队伍的空洞卡永久抹除（战役构筑禁用）。',
    `【特别规则：混乱标记】${Object.entries(CONGRESS_TOKEN_MEANINGS.standard).map(([token, entry]) => `[${token}] ${entry.text}`).join('；')}`,
  ].join('\n\n'),
  resolutions: Object.freeze({
    resolution1: resolutions.resolution1,
    resolution2: resolutions.resolution2,
    // 与上方导出的 resolutions 保持同一份（含 noResolution）；SCENARIO_TEXT 在 scenario 里后展开，
    // 漏掉这个键会覆盖掉正确的结局表并让全灭结算抛「未知剧本结局」。
    noResolution: resolutions.noResolution,
  }),
})

// ---------------------------------------------------------------------------
// scenario / identities
// ---------------------------------------------------------------------------
export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  referenceCode: REFERENCE_CODE,
  migrationStatus: 'development',
  archiveLabel: 'File #59-Z',
  mapLocationId: 'Tunguska',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  // `setAsideLocations` 用**地点 id**（manifest 会翻成印刷卡号）；三张异界高塔开局放在一边。
  setAsideLocations: [...TOWER_LOCATION_IDS],
  // 专属组敌人（09715）+ 同志会敌人（按成员 id 建定义；`api.spawn` 也接受印刷卡号）。
  enemies: Object.freeze({ ...enemies, ...coterieEnemies }),
  treacheries,
  storyAssets,
  acts,
  agendas,
  resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings: CONGRESS_TOKEN_MEANINGS,
  ...SCENARIO_TEXT,
})

export const identities = Object.freeze(identitiesFor(scenario))

// 需要单卡条目的卡号：本章专属组里只有拟态克星（09715）。
// 地点/幕/密谋/提示卡不建条目；六把密钥的条目落在各自章节目录（本章只读 assetRule.keyShift）。
export const CHAPTER_ENTRY_CODES = Object.freeze([...ENEMY_CODES])

// ---------------------------------------------------------------------------
// 战役记录
// ---------------------------------------------------------------------------
// 读：审判的输入全部来自剧本日志（前九章与密档写入的记录键）。
export const RECORD_READS = Object.freeze([
  'theCellAidedTheKnight', 'theCellFailedToFendOffTheBeast', 'youHaventSeenTheLastOfTheClaretKnight',
  'theDogsAreAtWar', 'eceTrustsTheCell', 'eceDoesNotTrustTheCell', 'youHaventSeenTheLastOfAmaranth',
  'theLoversAreReunited', 'amaranthHasLeftTheCoterie', 'youHaventSeenTheLastOfThorne',
  'theCellMadeADealWithThorne', 'thorneDisappeared', 'alikiIsOnYourSide',
  'youHaventSeenTheLastOfAlikiZoniUperetria', 'theCellMeddledInAbarransAffairs',
  'theCellKnowsTheTrueNatureOfTheCoterie', 'youHaventSeenTheLastOfLaChicaRoja',
  'youHaventSeenTheLastOfTheSanguineWatcher', 'theSanguineWatchersTormentContinues',
  'youHaventSeenTheLastOfTzuSanNiang', 'tzuSanNiangHasYouUnderHerSway', 'tzuSanNiangIsUnderYourSway',
  'tuwileMasaiIsOnYourSide', 'youHaventSeenTheLastOfDesiderioDelgadoAlvarez', 'desiIsInYourDebt',
  'theCellMadeADealWithDesi', 'theRedCoterieSparedTheCell', 'time', 'keysHeld', 'erasedCards',
])
// 写：审判结论、结局记录、密钥归属、空洞抹除与章节完成。
export const RECORD_WRITES = Object.freeze([
  'theCellEscapedTheRedCoterie', 'theCellOverthrewTheRedCoterie', 'theCellJoinedTheRedCoterie',
  'theRedCoterieSparedTheCell', 'theRedCoterieWasDestroyedFromWithin',
  'theOutsidersWereStopped', 'theCellWasHollowed', 'keysHeld', 'erasedCards',
  'erasedFromExistence', 'chaptersCompleted', 'time',
])

// 审判结论 → 记录键（结局链与尾声按这些记录分支）。
export const TRIAL_OUTCOME_RECORDS = Object.freeze({
  deemedALiability: 'theCellEscapedTheRedCoterie',
  overthrow: 'theCellOverthrewTheRedCoterie',
  join: 'theCellJoinedTheRedCoterie',
  deemedAnAsset: 'theRedCoterieSparedTheCell',
  knowsTrueNature: 'theRedCoterieSparedTheCell',
  eerilySilent: 'theRedCoterieWasDestroyedFromWithin',
})

/** 印刷名（日志/测试用；缺失回退卡号）。 */
export function cardNameOf(code) {
  const card = ALL_CARDS[code]
  return card?.nameZh || card?.name || String(code)
}
