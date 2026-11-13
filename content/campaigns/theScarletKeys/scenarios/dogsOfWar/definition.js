// 战争疮痍（Dogs of War · 09635 · 亚历山大 / 档案 #38-N）· 剧本数据。
//
// 参考实现（只读来源）：
//   · `Scenarios/TheScarletKeys/DogsOfWar.hs`（四行地图、PreScenarioSetup 的 1→2/3→4/5/6/7 分支、
//     三个 Setup 版本的收组/放置、混乱标记、R1–R8 与 NoResolution 的版本分流）；
//   · `Act/Cards/.../DogsOfWar/RabbitsWhoRunV1–V3.hs`（幕 1 正面无目标、背面 R1/R2/R5/R6）；
//   · `Agenda/Cards/.../DogsOfWar/BrewingCatastropheV1–V3.hs`（毁灭阈值 12/14/14、
//     版本一「其它卡上的毁灭改为扣减」、版本二/三背面「创伤或撤退 + 翻回 + 10 毁灭」）；
//   · `Location/CardDefs|Cards/.../DogsOfWar/*`（七张地图地点 + 证券交易所/亚历山大地下陵墓的三种版本、
//     符号连接、封锁与钥匙节点字样）；
//   · `Enemy/CardDefs|Cards/.../DogsOfWar/*`（暗红骑士、深红斗篷的恶兽两面、猩红野兽、结社煽动者）；
//   · `Asset/Assets/KeyLocusLastBastion|KeyLocusDefensiveBarrier|TheClaretKnightHerSwornChampion`；
//   · 密钥 `Keys`（法罗斯之光：稳定/动荡两面、资源与「3 资源后由调查员控制」）；
//   · locale `scenarios/dogsOfWar.json`（tokens / intro 1–7 / version1–3 setup / resolutions 1–8）。
//
// 本文件只从 `../../card-data.js`（= `src/cards/cards-data.js`）取印刷数据，不抄第二份事实源；
// 卡牌行为在 `src/cards/encounter-entries/theScarletKeys/dogsOfWar/<code>.js` 单卡文件里。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterDefinitions, encounterGroupCards, encounterGroupDeck, identitiesFor, location, stage } from '../../card-data.js'
import { chapterSection, chapterStory, flattenResolution, flattenStory } from '../../story-access.js'
import { DOGS_OF_WAR_TOKEN_MEANINGS, tokenMeaningLines } from './chaos.js'

export const CHAPTER_ID = 'dogsOfWar'
export const REFERENCE_CODE = '09635'

export const RAW_CODES = Object.freeze({
  scenario: '09635',
  agendaV1: '09636', agendaV2: '09637', agendaV3: '09638',
  actV1: '09639', actV2: '09640', actV3: '09641',
  bourseLocusSafeguard: '09642', bourseCoteriePost: '09643', bourseCommercialCenter: '09644',
  windsorPalaceHotel: '09645', victoriaCollege: '09646', qaitbayCitadel: '09647',
  theCorniche: '09648', zanEtElSettat: '09649',
  catacombsDenOfTheBeast: '09650', catacombsBloodyNexus: '09651', catacombsAncientTomb: '09652',
  keyLocusDefensiveBarrier: '09653a', keyLocusLastBastion: '09653b',
  claretKnightEnemy: '09654a', claretKnightAsset: '09654b',
  beastRavager: '09655a', beastWolf: '09655b',
  scarletBeast: '09656', coterieProvocateur: '09657',
  locusPulse: '09658',
  lightOfPharosStable: '09659a', lightOfPharosUnstable: '09659b',
})

// ---------------------------------------------------------------------------
// 版本（v. I / v. II / v. III）
// ---------------------------------------------------------------------------
// 版本由开场 Intro 决定：流逝时间 < 20 → Intro 2（接受 = 版本一，拒绝 = 版本二）；
// 流逝时间 ≥ 20 → Intro 3（接受 = 版本三 + 与骑士交易，拒绝 = 版本三 + 帮助西里）。
export const VERSIONS = Object.freeze(['v1', 'v2', 'v3'])
export const VERSION_LABELS = Object.freeze({ v1: '版本一', v2: '版本二', v3: '版本三' })
export const VERSION_SETUP_TITLES = Object.freeze({
  v1: '冒险设置(版本一)', v2: '冒险设置(版本二)', v3: '冒险设置(版本三)',
})

// 每版只有一张幕与一张密谋（其余移出游戏）。
export const VERSION_CODES = Object.freeze({
  v1: Object.freeze({ agenda: RAW_CODES.agendaV1, act: RAW_CODES.actV1, bourse: RAW_CODES.bourseLocusSafeguard,
    catacombs: RAW_CODES.catacombsBloodyNexus, keyLocus: RAW_CODES.keyLocusLastBastion,
    boss: 'claretKnight', bourseRevealed: true, catacombsRevealed: false }),
  v2: Object.freeze({ agenda: RAW_CODES.agendaV2, act: RAW_CODES.actV2, bourse: RAW_CODES.bourseCoteriePost,
    catacombs: RAW_CODES.catacombsAncientTomb, keyLocus: RAW_CODES.keyLocusDefensiveBarrier,
    boss: 'claretKnight', bourseRevealed: false, catacombsRevealed: true }),
  v3: Object.freeze({ agenda: RAW_CODES.agendaV3, act: RAW_CODES.actV3, bourse: RAW_CODES.bourseCommercialCenter,
    catacombs: RAW_CODES.catacombsDenOfTheBeast, keyLocus: RAW_CODES.keyLocusDefensiveBarrier,
    boss: 'beast', bourseRevealed: true, catacombsRevealed: false }),
})

// 遭遇组：指南 gatherSets 点名的并集（版本一：专属 + 猩红巫术 + 空间异常 + 腐败扩散 + 黑暗异教徒；
// 版本二：专属 + 扫荡团伙 + 猩红巫术 + 空间异常 + 腐败扩散；
// 版本三：专属 + 扫荡团伙 + 猩红巫术 + 空间异常 + 腐败扩散 + 黑暗异教徒）。
export const GATHER_GROUPS = Object.freeze([
  'dogsOfWar', 'scarletSorcery', 'spatialAnomaly', 'spreadingCorruption', 'darkCult', 'cleanupCrew',
])
export const SHARED_GROUPS = Object.freeze(GATHER_GROUPS.slice(1))
export const VERSION_GATHER_GROUPS = Object.freeze({
  v1: Object.freeze(['dogsOfWar', 'scarletSorcery', 'spatialAnomaly', 'spreadingCorruption', 'darkCult']),
  v2: Object.freeze(['dogsOfWar', 'cleanupCrew', 'scarletSorcery', 'spatialAnomaly', 'spreadingCorruption']),
  v3: Object.freeze(['dogsOfWar', 'cleanupCrew', 'scarletSorcery', 'spatialAnomaly', 'spreadingCorruption', 'darkCult']),
})

export const START_LOCATION = 'qaitbayCitadel'

// ---------------------------------------------------------------------------
// 地点（七张地图牌；证券交易所与地下陵墓各有三个版本）
// ---------------------------------------------------------------------------
// 印刷连接（卡面符号；参考实现 DogsofWar.hs 的四行布局）：
//   .      triangle .       equals .
//   square triangle star    equals squiggle
//   square circle   star    moon   squiggle
//   .      circle   .       moon   .
// 即：theBourse=Square、victoriaCollege=Triangle、windsorPalaceHotel=Circle、qaitbayCitadel=Star、
//     theCorniche=Equals、zanEtElSettat=Moon、catacombs=Squiggle。
export const LOCATION_SYMBOLS = Object.freeze({
  theBourse: 'square', victoriaCollege: 'triangle', windsorPalaceHotel: 'circle', qaitbayCitadel: 'star',
  theCorniche: 'equals', zanEtElSettat: 'moon', catacombs: 'squiggle',
})

export const LOCATION_CONNECTIONS = Object.freeze({
  theBourse: Object.freeze(['victoriaCollege', 'windsorPalaceHotel']),
  victoriaCollege: Object.freeze(['theBourse', 'qaitbayCitadel', 'windsorPalaceHotel']),
  windsorPalaceHotel: Object.freeze(['qaitbayCitadel', 'theBourse', 'victoriaCollege']),
  qaitbayCitadel: Object.freeze(['theCorniche', 'victoriaCollege', 'windsorPalaceHotel', 'zanEtElSettat']),
  theCorniche: Object.freeze(['catacombs', 'qaitbayCitadel', 'zanEtElSettat']),
  zanEtElSettat: Object.freeze(['catacombs', 'qaitbayCitadel', 'theCorniche']),
  catacombs: Object.freeze(['theCorniche', 'zanEtElSettat']),
})

// 四个[[节点地]]（Locus Site）：版本一/二/三都在这些地点各放一张钥匙节点。
export const LOCUS_SITE_IDS = Object.freeze(['windsorPalaceHotel', 'victoriaCollege', 'theCorniche', 'zanEtElSettat'])

// 版本差异：证券交易所 / 亚历山大地下陵墓用哪张物理卡，以及开局是否已揭示。
export const VERSION_LOCATION_FACES = Object.freeze({
  theBourse: Object.freeze({
    v1: Object.freeze({ code: RAW_CODES.bourseLocusSafeguard, revealedAtStart: true }),
    v2: Object.freeze({ code: RAW_CODES.bourseCoteriePost, revealedAtStart: false }),
    v3: Object.freeze({ code: RAW_CODES.bourseCommercialCenter, revealedAtStart: true }),
  }),
  catacombs: Object.freeze({
    v1: Object.freeze({ code: RAW_CODES.catacombsBloodyNexus, revealedAtStart: false }),
    v2: Object.freeze({ code: RAW_CODES.catacombsAncientTomb, revealedAtStart: true }),
    v3: Object.freeze({ code: RAW_CODES.catacombsDenOfTheBeast, revealedAtStart: false }),
  }),
})

const LOCATION_SPECS = Object.freeze([
  ['theBourse', RAW_CODES.bourseLocusSafeguard, { clues: 2 }],
  ['catacombs', RAW_CODES.catacombsBloodyNexus, { clues: 2 }],
  ['windsorPalaceHotel', RAW_CODES.windsorPalaceHotel, { clues: 1 }],
  ['victoriaCollege', RAW_CODES.victoriaCollege, { clues: 1 }],
  ['qaitbayCitadel', RAW_CODES.qaitbayCitadel, { clues: 1 }],
  ['theCorniche', RAW_CODES.theCorniche, { clues: 1 }],
  ['zanEtElSettat', RAW_CODES.zanEtElSettat, { clues: 1 }],
])

const locationData = ([id, code, spec]) => location({
  id, code, clues: spec.clues, cluesFixed: false,
  connections: [...LOCATION_CONNECTIONS[id]],
  symbol: LOCATION_SYMBOLS[id],
  locusSite: LOCUS_SITE_IDS.includes(id),
})

export const LOCATIONS = Object.freeze(Object.fromEntries(
  LOCATION_SPECS.map(spec => [spec[0], Object.freeze(locationData(spec))])))

/** 某版本下某地点的印刷面（卡号/帷幕/线索/名称/卡文/胜利点/开局是否揭示）。 */
export function locationFaceFor(version, id) {
  const variant = VERSION_LOCATION_FACES[id]?.[version] || null
  const code = variant?.code || LOCATIONS[id]?.originalCode
  const card = code ? ALL_CARDS[code] : null
  if (!card) return null
  return Object.freeze({
    id, code, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '', subnameEn: card.subname || '',
    text: card.textZh || card.text || '', textEn: card.text || '',
    backText: card.backTextZh || card.backText || '', backName: card.backNameZh || card.backName || '',
    shroud: card.shroud, cluesPerInvestigator: Number(card.clues) || 0,
    victory: Number(card.victory) || 0,
    traits: [...(card.traits || [])],
    revealedAtStart: variant ? variant.revealedAtStart : true,
  })
}

/** 印刷线索值：印刷值是「每位调查员」的数值，直接 × 调查员人数。 */
export function clueValueOf(state, locationId) {
  const definition = LOCATIONS[locationId]
  if (!definition) return 0
  const count = Number(state?.numInvestigators) || (state?.investigators || []).length || 1
  return (Number(definition.cluesPerInvestigator) || 0) * count
}

/** [[节点地]]地点（按定义顺序，只返回在场的地点）。 */
export function locusSitesInPlay(state) {
  const ids = new Set((state?.locations || []).map(entry => entry.id))
  return LOCUS_SITE_IDS.filter(id => ids.has(id))
}

// ---------------------------------------------------------------------------
// 遭遇牌（专属组 dogsOfWar）
// ---------------------------------------------------------------------------
const printedOf = code => {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Scarlet Keys card: ${code}`)
  return {
    code, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '', subnameEn: card.subname || '',
    text: card.textZh || card.text || '', textEn: card.text || '',
    traits: [...(card.traits || [])],
  }
}

export const ENEMY_CODES = Object.freeze([RAW_CODES.claretKnightEnemy, RAW_CODES.beastRavager,
  RAW_CODES.beastWolf, RAW_CODES.scarletBeast, RAW_CODES.coterieProvocateur])
export const TREACHERY_CODES = Object.freeze([RAW_CODES.locusPulse])
export const STORY_ASSET_CODES = Object.freeze([RAW_CODES.claretKnightAsset,
  RAW_CODES.keyLocusDefensiveBarrier, RAW_CODES.keyLocusLastBastion])
export const KEY_CODES = Object.freeze([RAW_CODES.lightOfPharosStable, RAW_CODES.lightOfPharosUnstable])

// 遭遇牌库按版本构造，见下方 V1_IN_PLAY_CODES 之后的 encounterDeckForVersion / ENCOUNTER_DECK。

// 放在一边（不进遭遇牌库）：版本一不用的首领面/钥匙节点面（09654a 敌人面、09655b 另一面、09653a 防御屏障面）、
// 法罗斯之光的两面，以及三个版本里「本局不使用」的地点变体（印刷规则：把其它版本的证券交易所/地下陵墓移出游戏）。
// 注意：清单按版本一登记，已经放在 `V1_IN_PLAY_CODES` 里的卡号不能再出现在这里（区域守恒）。
export const SET_ASIDE_CODES = Object.freeze([
  RAW_CODES.claretKnightEnemy,
  RAW_CODES.beastWolf,
  RAW_CODES.keyLocusDefensiveBarrier,
  RAW_CODES.lightOfPharosStable, RAW_CODES.lightOfPharosUnstable,
  RAW_CODES.bourseCoteriePost, RAW_CODES.bourseCommercialCenter,
  RAW_CODES.catacombsDenOfTheBeast, RAW_CODES.catacombsAncientTomb,
])

// 版本一开局就在场（清单/区域守恒用）：七张地点 + 四张钥匙节点 + 暗红骑士 + 深红斗篷的恶兽。
export const V1_IN_PLAY_CODES = Object.freeze([
  RAW_CODES.bourseLocusSafeguard, RAW_CODES.catacombsBloodyNexus,
  RAW_CODES.windsorPalaceHotel, RAW_CODES.victoriaCollege, RAW_CODES.qaitbayCitadel,
  RAW_CODES.theCorniche, RAW_CODES.zanEtElSettat,
  ...Array(4).fill(RAW_CODES.keyLocusLastBastion),
  RAW_CODES.claretKnightAsset, RAW_CODES.beastRavager,
])

// 2026-11-13 P0：遭遇牌库=本章专属组 + 版本要求的共享组（v.II/III 换扫荡团伙、黑暗异教等）。
// 旧实现只放本章 6 张；引擎 setupScenarioDecks 只读 scenario.encounterDeck，requiredEncounterGroupIds
// 在 src 没有读点 → 五个共享组从未进入牌库。真实开局由 behavior.modifyDeck 按版本替换这份缺省。
export function encounterDeckForVersion(version = 'v1') {
  const groups = VERSION_GATHER_GROUPS[version] || VERSION_GATHER_GROUPS.v1
  return Object.freeze(encounterGroupDeck(groups, { exclude: [...SET_ASIDE_CODES, ...V1_IN_PLAY_CODES] }))
}
export const ENCOUNTER_DECK = encounterDeckForVersion('v1')
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 全部版本可能用到的共享组卡（注册进本章 enemies/treacheries，生产组合根据此填全局遭遇表）。
const SHARED_DEFINITION_CODES = Object.freeze(encounterGroupCards(GATHER_GROUPS, {
  exclude: [...SET_ASIDE_CODES, ...V1_IN_PLAY_CODES],
}))
const sharedDefinitions = encounterDefinitions(SHARED_DEFINITION_CODES)

// 钥匙节点：09653b「最后堡垒」（版本一，固定 6 生命，被击败移出游戏）；
// 09653a「防御屏障」（版本二/三，3×人数生命，可被攻击，被击败加入胜利区）。
export const KEY_LOCUS_DATA = Object.freeze({
  [RAW_CODES.keyLocusDefensiveBarrier]: Object.freeze({
    face: 'defensiveBarrier', name: '钥匙节点（防御屏障）', fight: 4, health: 3, healthPerInvestigator: true,
    victory: 1, defeatedToVictory: true, action: 'damage',
  }),
  [RAW_CODES.keyLocusLastBastion]: Object.freeze({
    face: 'lastBastion', name: '钥匙节点（最后堡垒）', fight: 4, health: 6, healthPerInvestigator: false,
    victory: 1, defeatedToVictory: false, action: 'heal',
  }),
})

const enemyDefinition = code => {
  const card = ALL_CARDS[code]
  const base = printedOf(code)
  const health = Number(card.health) || 1
  return Object.freeze({
    ...base,
    code, originalCode: code,
    fight: card.fight ?? null, evade: card.evade ?? null,
    health: card.healthPerInvestigator ? null : health,
    ...(card.healthPerInvestigator ? { healthPerInvestigator: health } : {}),
    damage: Number(card.damage) || 0, horror: Number(card.horror) || 0,
    victory: Number(card.victory) || 0,
    unique: card.unique === true,
    elite: (card.traits || []).includes('Elite'),
    ...(code === RAW_CODES.beastRavager ? { patrol: true } : {}),
    ...(code === RAW_CODES.beastWolf ? { hiddenSide: true } : {}),
    ...(code === RAW_CODES.claretKnightEnemy ? { hiddenSide: true } : {}),
  })
}

// 钥匙节点也用「可攻击实体」建模（见 behavior.scenarioApproximations）：印刷是剧情支援，
// 但引擎没有「把在场支援当作敌人攻击」的读点，用敌人实例承载战斗值/伤害/击败。
const keyLocusEnemyDefinition = code => {
  const spec = KEY_LOCUS_DATA[code]
  const base = printedOf(code)
  return Object.freeze({
    ...base,
    code, originalCode: code,
    fight: spec.fight, evade: null,
    health: spec.healthPerInvestigator ? null : spec.health,
    ...(spec.healthPerInvestigator ? { healthPerInvestigator: spec.health } : {}),
    damage: 0, horror: 0,
    victory: spec.victory,
    unique: false, elite: false,
    keyLocus: true, keyLocusFace: spec.face,
  })
}

export const KEY_LOCUS_CODES = Object.freeze([RAW_CODES.keyLocusDefensiveBarrier,
  RAW_CODES.keyLocusLastBastion])

export const enemies = Object.freeze({
  ...sharedDefinitions.enemies,
  ...Object.fromEntries([
    ...ENEMY_CODES.map(code => [code, enemyDefinition(code)]),
    ...KEY_LOCUS_CODES.map(code => [code, keyLocusEnemyDefinition(code)]),
  ]),
})

const treacheryDefinition = code => ({
  ...printedOf(code),
  code, originalCode: code,
  entryRevelation: true,
  surge: false,
  // 引擎 `treachery-tokens.js#resolveTreacheryBody` 只对 `effect.kind === 'campaignRule'` 走内容结算：
  // 本章专属诡计由条目 `encounterResolve` 分派（behavior.resolveEncounter）。
  effect: { kind: 'campaignRule' },
})
export const treacheries = Object.freeze({
  ...sharedDefinitions.treacheries,
  ...Object.fromEntries(TREACHERY_CODES.map(code => [code, Object.freeze(treacheryDefinition(code))])),
})

const storyAssetDefinition = code => {
  const card = ALL_CARDS[code]
  return Object.freeze({
    ...printedOf(code),
    code, originalCode: code,
    type: 'asset',
    ...(code === RAW_CODES.claretKnightAsset
      ? { health: Number(card.health) || 4, sanity: Number(card.sanity) || 2, slots: [], controlledByAll: true }
      : {}),
  })
}
export const storyAssets = Object.freeze(Object.fromEntries(
  STORY_ASSET_CODES.map(code => [code, storyAssetDefinition(code)])))

// ---------------------------------------------------------------------------
// 幕 / 密谋（每版各一张）
// ---------------------------------------------------------------------------
const stageDefinition = (kind, version, code, number) => {
  const card = ALL_CARDS[code]
  return Object.freeze({
    ...stage(code, { number }),
    id: `${kind}1`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', textEn: card.text || '',
    backText: card.backTextZh || card.backText || '', backName: card.backNameZh || card.backName || '',
    backTextEn: card.backText || '', backNameEn: card.backName || '',
    chapterFlow: CHAPTER_ID, version,
    reveal: { type: 'campaignRule' },
    objective: { type: 'campaignRule' },
  })
}

const actDefinition = version => stageDefinition('act', version, VERSION_CODES[version].act, 1)
const agendaDefinition = version => {
  const base = stageDefinition('agenda', version, VERSION_CODES[version].agenda, 1)
  const card = ALL_CARDS[VERSION_CODES[version].agenda]
  return Object.freeze({
    ...base,
    doomThreshold: Number(card.doom) || 14,
    // 版本一：其它卡上的毁灭改为「扣减」总毁灭（behavior.doomPlaced 读）。
    ...(version === 'v1' ? { otherDoomSubtracts: true } : {}),
  })
}

export const ACTS = Object.freeze(Object.fromEntries(VERSIONS.map(version => [version, actDefinition(version)])))
export const AGENDAS = Object.freeze(Object.fromEntries(VERSIONS.map(version => [version, agendaDefinition(version)])))
// 静态定义（清单/身份表用版本一；开局按版本替换 `state.acts` / `state.agendas`）。
export const acts = Object.freeze([ACTS.v1])
export const agendas = Object.freeze([AGENDAS.v1])

// ---------------------------------------------------------------------------
// 绯红密钥：法罗斯之光（09659a 稳定面 / 09659b 动荡面）
// ---------------------------------------------------------------------------
export const LIGHT_OF_PHAROS = Object.freeze({
  id: '09659',
  stableFace: RAW_CODES.lightOfPharosStable,
  unstableFace: RAW_CODES.lightOfPharosUnstable,
  name: ALL_CARDS[RAW_CODES.lightOfPharosStable].nameZh || ALL_CARDS[RAW_CODES.lightOfPharosStable].name,
  resourcesToControl: 3,
})

// ---------------------------------------------------------------------------
// 正文 / 结局 / 特别规则（全部经 story-access 读取生成物）
// ---------------------------------------------------------------------------
const resolutionSection = key => chapterSection(CHAPTER_ID, `resolutions.${key}`, null)
const resolutionOf = key => {
  const section = resolutionSection(key)
  const text = section == null ? '' : flattenResolution(section)
  return text || key
}
const noResolutionSection = chapterSection(CHAPTER_ID, 'resolutions.noResolution', {}) || {}
export const NO_RESOLUTION_TEXT = Object.freeze({
  v1: flattenStory(noResolutionSection.version1),
  v2: flattenStory(noResolutionSection.version2),
  v3: flattenStory(noResolutionSection.version3),
})

export const resolutions = Object.freeze({
  noResolution: [NO_RESOLUTION_TEXT.v1, NO_RESOLUTION_TEXT.v2, NO_RESOLUTION_TEXT.v3].filter(Boolean).join('\n\n'),
  resolution1: resolutionOf('resolution1'),
  resolution2: resolutionOf('resolution2'),
  resolution3: resolutionOf('resolution3'),
  resolution4: resolutionOf('resolution4'),
  resolution5: resolutionOf('resolution5'),
  resolution6: resolutionOf('resolution6'),
  resolution7: resolutionOf('resolution7'),
  resolution8: resolutionOf('resolution8'),
})

// NoResolution 的版本分流（参考实现 ScenarioResolution NoResolution）。
export const NO_RESOLUTION_TARGET = Object.freeze({
  v1: 'resolution3', v2: 'resolution4', v3: 'resolution7',
})

const introSection = chapterSection(CHAPTER_ID, 'intro', {}) || {}
const setupSection = version => chapterSection(CHAPTER_ID, `version${version.slice(1)}.setup`, {}) || {}

export const INTRO = Object.freeze({
  title: introSection.title || '档案#38-N: 战争疮痍',
  checkTime: Object.freeze({
    fewerThanTwenty: flattenStory(introSection.fewerThanTwentyTime),
    twentyOrMore: flattenStory(introSection.twentyOrMoreTime),
  }),
  intro1: flattenStory(introSection.intro1),
  knightMeeting: Object.freeze({
    part1: flattenStory(introSection.intro2Part1),
    miskatonicOrScholar: flattenStory(introSection.miskatonicOrScholar),
    part2: flattenStory(introSection.intro2Part2),
  }),
  knightAlreadyRobbed: flattenStory(introSection.intro3),
  labels: Object.freeze({
    accept: '很好，我们接受。',
    refuse: '拒绝。',
  }),
  outcomes: Object.freeze({
    v1: flattenStory(introSection.intro4),
    v2: flattenStory(introSection.intro5),
    v3Deal: flattenStory(introSection.intro6),
    v3Sirry: flattenStory(introSection.intro7),
  }),
})

export const VERSION_SETUPS = Object.freeze(Object.fromEntries(VERSIONS.map(version => {
  const section = setupSection(version)
  return [version, Object.freeze({
    title: section.title || VERSION_SETUP_TITLES[version],
    gatherSets: flattenStory(section.gatherSets),
    placeLocations: flattenStory(section.placeLocations),
    startAt: flattenStory(section.startAt),
    agendaDeck: flattenStory(section.agendaDeck),
    actDeck: flattenStory(section.actDeck),
    keyLocus: flattenStory(section.keyLocus),
    ...(section.doom ? { doom: flattenStory(section.doom) } : {}),
    otherLocations: flattenStory(section.otherLocations),
    ...(section.theClaretKnight ? { theClaretKnight: flattenStory(section.theClaretKnight) } : {}),
    ...(section.theBeast ? { theBeast: flattenStory(section.theBeast) } : {}),
    ...(section.miniCards ? { miniCards: flattenStory(section.miniCards) } : {}),
    ...(section.coterieAssassin ? { coterieAssassin: flattenStory(section.coterieAssassin) } : {}),
  })]
})))

const tokenLines = tokenMeaningLines(DOGS_OF_WAR_TOKEN_MEANINGS.standard)

const SPECIAL_RULES = [
  '【特别规则：版本选择】开场检查剧本日志里已经流逝的 time：小于 20 时走 Intro 2（接受骑士的提议 → 版本一；'
    + '拒绝 → 版本二）；大于等于 20 时走 Intro 3（接受 → 版本三 + 记录「特别小组与暗红骑士达成交易」；'
    + '拒绝 → 版本三 + 记录「特别小组帮助西里特工」）。版本决定本局使用哪一张幕、哪一张密谋、'
    + '证券交易所/地下陵墓的正面，以及暗红骑士与恶兽谁在场。',
  '【特别规则：钥匙节点（Key Locus）】四个[[节点地]]地点各放一张钥匙节点。版本一是「最后堡垒」面'
    + '（6 生命，只能被花费线索的行动治愈，被击败时移出游戏）；版本二/三是「防御屏障」面'
    + '（3×人数生命，可以当作攻击值 4 的敌人攻击，被击败时加入胜利区）。'
    + '场上没有其它钥匙节点时，暗红骑士（版本一/二）或地下陵墓（版本三）按卡牌能力算作钥匙节点。',
  '【特别规则：摧毁/守护钥匙节点】版本一的目标是保卫钥匙节点直到密谋推进；版本二/三的目标是摧毁钥匙节点，'
    + '直到证券交易所（版本二）或地下陵墓（版本三）成为场上唯一的钥匙节点，然后进入其中夺回法罗斯之光。',
  '【特别规则：巡逻（Patrol）】有巡逻关键词的敌人（深红斗篷的恶兽、结社煽动者）在敌军阶段开始时不追调查员，'
    + '改为按最短路径向「最近的、有钥匙节点的地点」移动一步；结社煽动者生成时也放在那个地点。',
  '【特别规则：绯红密钥·法罗斯之光】法罗斯之光是双面密钥（[[稳定]]/[[动荡]]）。版本一附属到暗红骑士'
    + '（剧情支援面），版本二附属到暗红骑士（敌人面），版本三附属到深红斗篷的恶兽。'
    + '证券交易所（版本二）与地下陵墓（版本三）的行动可以共同花费线索在上面放置资源；'
    + '有 3 个资源时，选择本地点的 1 位调查员取得它的控制权（密钥转交调查员即视为「调查员控制了法罗斯之光」）。',
  '【特别规则：隐匿迷你卡（版本二）】收齐诱饵迷你卡与「结社刺客 A/B」「结社打手 A/B」放在一边。'
    + '调查员队长抽出结社刺客 (A) 并结算其隐匿关键词：1 张真身迷你卡 + 每位调查员 1 张诱饵，'
    + '正面朝下混洗后分配到它所在地点与连接地点。',
  `【特别规则：混乱标记】${tokenLines.join('；')}`,
  '【特别规则：时间与结局】结局 2/6 各记 2 点时间，结局 1/5 接结局 8 记 3 点；结局 3/4/7 各记 1 点。'
    + '未达成任何结局时按版本跳至结局 3（版本一）/结局 4（版本二）/结局 7（版本三）。',
].join('\n\n')

const setupV1 = VERSION_SETUPS.v1
const setupChecklist = Object.freeze({
  gatherSets: setupV1.gatherSets,
  placeLocations: setupV1.placeLocations,
  startAt: setupV1.startAt,
  agendaDeck: setupV1.agendaDeck,
  actDeck: setupV1.actDeck,
  keyLocus: setupV1.keyLocus,
  doom: setupV1.doom,
  otherLocations: setupV1.otherLocations,
  theClaretKnight: setupV1.theClaretKnight,
  theBeast: setupV1.theBeast,
})

// ---------------------------------------------------------------------------
// 英文正文（同一份生成物的 `sectionsEn`，仍经 story-access 读取）
// ---------------------------------------------------------------------------
const chapterRaw = chapterStory(CHAPTER_ID) || {}
const enSections = chapterRaw.sectionsEn || {}
const enIntro = enSections.intro || {}
const enVersion = version => enSections[`version${version.slice(1)}`]?.setup || {}
const enResolutions = enSections.resolutions || {}
const enResolutionOf = key => {
  const section = enResolutions[key]
  if (section == null) return ''
  return flattenResolution(section) || ''
}

export const INTRO_EN = Object.freeze({
  title: enIntro.title || '',
  intro1: flattenStory(enIntro.intro1),
  knightMeetingPart1: flattenStory(enIntro.intro2Part1),
  knightMeetingPart2: flattenStory(enIntro.intro2Part2),
  knightAlreadyRobbed: flattenStory(enIntro.intro3),
  outcomes: Object.freeze({
    v1: flattenStory(enIntro.intro4),
    v2: flattenStory(enIntro.intro5),
    v3Deal: flattenStory(enIntro.intro6),
    v3Sirry: flattenStory(enIntro.intro7),
  }),
  checkTime: Object.freeze({
    fewerThanTwenty: flattenStory(enIntro.fewerThanTwentyTime),
    twentyOrMore: flattenStory(enIntro.twentyOrMoreTime),
  }),
})

export const VERSION_SETUPS_EN = Object.freeze(Object.fromEntries(VERSIONS.map(version => {
  const section = enVersion(version)
  return [version, Object.freeze({
    title: section.title || `Setup (v. ${version.slice(1)})`,
    gatherSets: flattenStory(section.gatherSets),
    placeLocations: flattenStory(section.placeLocations),
    startAt: flattenStory(section.startAt),
    keyLocus: flattenStory(section.keyLocus),
    otherLocations: flattenStory(section.otherLocations),
  })]
})))

export const RESOLUTIONS_EN = Object.freeze(Object.fromEntries(
  Object.keys(resolutions).map(key => [key, enResolutionOf(key)])))

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (reference-zh)',
  introTitle: INTRO.title,
  intro: INTRO.intro1,
  setup: Object.values(setupChecklist).filter(Boolean).join('\n'),
  setupChecklist,
  setupByVersion: Object.freeze(Object.fromEntries(VERSIONS.map(version => [version,
    Object.values(VERSION_SETUPS[version]).filter(value => typeof value === 'string' && value !==
      VERSION_SETUPS[version].title).join('\n')]))),
  specialRules: SPECIAL_RULES,
  // 英文正文（同一份 story-text 生成物的 sectionsEn，经 story-access 读取）。
  introEn: INTRO_EN,
  setupByVersionEn: VERSION_SETUPS_EN,
  resolutionsEn: RESOLUTIONS_EN,
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings: DOGS_OF_WAR_TOKEN_MEANINGS,
  ...SCENARIO_TEXT,
})

// 身份映射：地点/敌人/诡计/剧情资产/幕/密谋（地点按版本一的物理卡号登记）。
export const identities = Object.freeze(identitiesFor(scenario))

// 需要单卡条目的卡号（敌人/诡计/剧情支援/密钥）；地点/幕/密谋/参考卡不建条目。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  ...ENEMY_CODES, ...TREACHERY_CODES, ...STORY_ASSET_CODES, ...KEY_CODES,
])

// 战役记录键（Campaign Log 复选框的真实键名）。
export const RECORD_KEYS = Object.freeze({
  time: 'time',
  dealWithKnight: 'theCellMadeADealWithTheClaretKnight',
  assistingSirry: 'theCellIsAssistingAgentSirry',
  failedToFendOffTheBeast: 'theCellFailedToFendOffTheBeast',
  youHaventSeenTheLastOfTheClaretKnight: 'youHaventSeenTheLastOfTheClaretKnight',
  youHaventSeenTheLastOfTheBeast: 'youHaventSeenTheLastOfTheBeastInACowlOfCrimson',
  theDogsAreAtWar: 'theDogsAreAtWar',
  theCellAidedTheKnight: 'theCellAidedTheKnight',
})
export const RECORD_READS = Object.freeze([RECORD_KEYS.time, RECORD_KEYS.dealWithKnight,
  RECORD_KEYS.assistingSirry, RECORD_KEYS.theCellAidedTheKnight])
export const RECORD_WRITES = Object.freeze([...Object.values(RECORD_KEYS)])
