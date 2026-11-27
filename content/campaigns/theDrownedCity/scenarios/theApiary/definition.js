// 养育场（theApiary · 提示卡 11553）· 章节数据（scenario 只含数据）。
//
// 权威来源：
//   Scenario/Scenarios/TheDrownedCity/TheApiary.hs + Scenarios/TheDrownedCity/TheApiary/Helpers.hs +
//   Act|Agenda|Location|Enemy|Story|Treachery/CardDefs/TheDrownedCity/TheApiary.hs +
//   各卡实现（Cards/TheDrownedCity/TheApiary/*.hs）+
//   frontend/src/locales/en/theDrownedCity/theApiary.json（印刷正文）+
//   src/cards/cards-data.js（简中卡名/卡文）。
//
// 本关三条特有口径：
//   1. 东西向双 Setup：西向（远征队向西）用朝圣者线（幕 2 = 失落的朝圣者；移出主母、
//      放一边玛莉亚·里维拉；氛围牌组装入朝圣者与密会）。东向用蜂巢思维线（幕 2 = 蜂巢思维；
//      移出玛莉亚、放一边主母；只取感染星之眷族，其余星之眷族移出游戏；组装入偷渡者）。
//      两条线共用的组：养育场、宇宙遗产、古老迷雾、穷途异魔、惊惧。
//   2. 地点从遭遇牌库进入：除养育场入口外，每处地点都靠自身「显现」进入场地，
//      因此 Setup 全部放一边；增生原野与两张血肉道路改为洗入遭遇牌库。地点连接由
//      印刷符号（Circle/Triangle/Square/Heart/Droplet/Diamond/Moon/Equals/Spade/Star）
//      双向匹配给出；中央腔室只与它「面朝」的环位相连（面朝在场景元数据里旋转）。
//   3. 跳章：结局 3 强制进入结局 4；结局 4 让调查员二选一 → 淹没城区 / 西墙。
//      结局 1/2 去大秘库；无结局西向去大秘库、东向进入结局 4。
//
// 中文叙事：本地无官方中文源，SCENARIO_TEXT 为本轮自译摘要；完整叙事由 narrative-guides
// worker 的 story-text.js 提供。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { APIARY_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theApiary'
export const REFERENCE_CODE = '11553'
export const ENCOUNTER_CODE = 'the_apiary'

// ---------------------------------------------------------------------------
// 通用（印刷数据取自卡表）
// ---------------------------------------------------------------------------
function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Apiary card: ${code}`)
  return {
    code, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '',
    text: card.textZh || card.text || '', textEn: card.text || '',
    type: card.type, traits: [...(card.traits || [])],
    ...(card.backText || card.backTextZh ? { backText: card.backTextZh || card.backText } : {}),
  }
}

function location(data) {
  const { id, code, cluesFixed, hasVictory, victory, clues, connected = [], ...rest } = data
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Apiary location: ${code}`)
  const victoryValue = card.victory ?? 0
  return {
    ...printed(code), id, shroud: card.shroud, connections: [...connected], ...rest,
    ...(cluesFixed ? { cluesFixed: clues } : { cluesPerInvestigator: clues ?? card.clues ?? 0 }),
    ...(hasVictory || victoryValue ? { victory: victory ?? victoryValue } : {}),
  }
}

function stage(code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Apiary stage: ${code}`)
  const { doom, stage: number, ...rest } = extra
  return {
    ...printed(code), id: `${card.type}${code}`, type: card.type, stage: `${number ?? card.stage ?? 1}a`,
    reveal: { type: 'campaignRule' }, ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
  }
}

function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown encounter definition: ${code}`)
    const base = printed(code)
    const text = card.text || ''
    if (card.type === 'enemy') {
      enemies[code] = {
        ...base, surge: /^Surge\./m.test(text), fight: card.fight ?? null, evade: card.evade ?? null,
        health: card.health ?? null, damage: card.damage || 0, horror: card.horror || 0,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
        ...(Object.hasOwn(card, 'victory') ? { victory: card.victory } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert', 'Patrol', 'Relentless']
          .filter(keyword => new RegExp(`\\b${keyword}`).test(text))
          .map(keyword => [keyword.toLowerCase(), true])),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = {
        ...base, entryRevelation: true, surge: /^Surge\./m.test(text),
        peril: /(?:^|\n|\. )Peril\./.test(text),
        ...(card.type === 'treachery' && (card.traits || []).includes('Curse') ? { weakness: true } : {}),
      }
    } else if (card.type === 'story' || card.type === 'asset') {
      storyAssets[code] = {
        ...base,
        ...(card.type === 'asset' ? {
          slots: [...(card.slots || [])],
          ...(card.health != null ? { health: card.health } : {}),
          ...(card.sanity != null ? { sanity: card.sanity } : {}),
        } : { global: false }),
      }
    }
  }
  return { enemies, treacheries, storyAssets }
}

function identitiesFor(scenario) {
  const identity = value => ({
    originalCode: value.originalCode || value.code,
    artCode: value.originalCode || value.code,
    ...(value.linkedCode ? { linkedOriginalCode: value.linkedCode } : {}),
  })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category,
      Object.fromEntries(Object.values(scenario[category] || {}).map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局键
// ---------------------------------------------------------------------------
export const ACT_CODES = Object.freeze(['11556', '11557', '11558'])
export const ACT1_CODE = '11556'
export const ACT2_WEST_CODE = '11557'
export const ACT2_EAST_CODE = '11558'
export const AGENDA_CODES = Object.freeze(['11554', '11555'])
export const AGENDA1_CODE = '11554'
export const AGENDA2_CODE = '11555'
export const ACT_CODES_BY_DIRECTION = Object.freeze({
  west: Object.freeze([ACT1_CODE, ACT2_WEST_CODE]),
  east: Object.freeze([ACT1_CODE, ACT2_EAST_CODE]),
})
export const RESOLUTION_KEYS = Object.freeze([
  'noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4',
])
// 印刷结局链：1/2 → 下一章；3 → 4；4 → 淹没城区或西墙；无结局 → 西向大秘库 / 东向结局 4。
export const RESOLUTION_NEXT = Object.freeze({
  west: Object.freeze({ noResolution: 'theGrandVault', resolution1: 'theGrandVault', resolution2: 'theGrandVault' }),
  east: Object.freeze({ noResolution: 'resolution4', resolution1: 'theGrandVault', resolution2: 'theGrandVault' }),
})
export const RESOLUTION4_NEXT = Object.freeze({
  drownedQuarter: 'theDrownedQuarter',
  westernWall: 'theWesternWall',
})

// ---------------------------------------------------------------------------
// 地点（连接由印刷符号双向匹配；中央腔室动态面朝）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'apiaryEntrance'

// [id, code, 印刷符号, 连接的其它符号, 额外数据]
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['apiaryEntrance', '11559', 'diamond',
    Object.freeze(['moon', 'equals', 'spade', 'circle', 'square']), Object.freeze({ linkedCode: '11559b', central: true, start: true })]),
  Object.freeze(['fleshyPathsEasternBurrows', '11560', 'moon', Object.freeze(['diamond']), Object.freeze({})]),
  Object.freeze(['fleshyPathsWesternBurrows', '11561', 'equals', Object.freeze(['diamond']), Object.freeze({})]),
  Object.freeze(['growingFields', '11562', 'spade', Object.freeze(['diamond', 'star']), Object.freeze({})]),
  Object.freeze(['hiddenVault', '11579', 'star', Object.freeze(['spade']), Object.freeze({ linkedCode: '11579b' })]),
  Object.freeze(['luminousTunnels', '11565', 'circle', Object.freeze(['diamond', 'heart', 'triangle']), Object.freeze({})]),
  Object.freeze(['graspingCorridor', '11569', 'circle', Object.freeze(['diamond', 'heart', 'triangle']), Object.freeze({})]),
  Object.freeze(['corruptedVault', '11564', 'triangle', Object.freeze(['circle']), Object.freeze({})]),
  Object.freeze(['spawningGrounds', '11566', 'heart', Object.freeze(['circle', 'square', 'droplet']), Object.freeze({})]),
  Object.freeze(['starvingCorridor', '11570', 'heart', Object.freeze(['circle', 'square', 'droplet']), Object.freeze({})]),
  Object.freeze(['lostCampsite', '11567', 'square', Object.freeze(['heart']), Object.freeze({})]),
  Object.freeze(['acidicCoelom', '11571', 'square', Object.freeze(['heart', 'diamond']), Object.freeze({})]),
  Object.freeze(['churningChasm', '11563', 'droplet', Object.freeze(['heart']), Object.freeze({})]),
  Object.freeze(['centralChamber', '11572', null, Object.freeze([]), Object.freeze({ central: true, dynamic: true })]),
])
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const SYMBOL_BY_LOCATION = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [id, symbol])))

// 对称连接：a 的符号出现在 b 的连接符号表里，且 b 的符号出现在 a 的表里。
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , symbol, links]) => [id,
  Object.freeze(LOCATION_TABLE
    .filter(([, , otherSymbol, otherLinks]) => otherLinks.includes(symbol) && links.includes(otherSymbol))
    .map(([otherId]) => otherId).filter(otherId => otherId !== id))])))

// 真实网格坐标（Scenarios/TheDrownedCity/TheApiary/Helpers.hs#apiaryPositions）：
// 西部/东部两种变体的同名环位共用一格（同一局只会有一套），中央腔室在环心。
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries([
  ['apiaryEntrance', Object.freeze({ x: 0, y: 0 })],
  ['growingFields', Object.freeze({ x: 0, y: 1 })],
  ['hiddenVault', Object.freeze({ x: 0, y: 2 })],
  ['fleshyPathsWesternBurrows', Object.freeze({ x: -1, y: 0 })],
  ['fleshyPathsEasternBurrows', Object.freeze({ x: 1, y: 0 })],
  ['luminousTunnels', Object.freeze({ x: 0, y: -1 })],
  ['graspingCorridor', Object.freeze({ x: 0, y: -1 })],
  ['corruptedVault', Object.freeze({ x: -1, y: -2 })],
  ['centralChamber', Object.freeze({ x: 0, y: -2 })],
  ['spawningGrounds', Object.freeze({ x: 1, y: -2 })],
  ['starvingCorridor', Object.freeze({ x: 1, y: -2 })],
  ['churningChasm', Object.freeze({ x: 2, y: -2 })],
  ['lostCampsite', Object.freeze({ x: 1, y: -1 })],
  ['acidicCoelom', Object.freeze({ x: 1, y: -1 })],
]))

// 中央腔室旋转：蜂巢思维幕一轮末掷币顺/逆时针转一次。面朝顺序（顺时针）：
// 初始朝下 = 酸性体腔（Helpres.hs：initApiaryMeta = GridDown，剧情把底边朝向酸性体腔）。
export const CENTRAL_CHAMBER_ID = 'centralChamber'
export const FACING_RING = Object.freeze(['acidicCoelom', 'graspingCorridor', 'starvingCorridor', 'apiaryEntrance'])
export const INITIAL_FACING = 'acidicCoelom'

// 西部（Enclave）/ 东部（Nest）环位、圣所、胜利地点与「离入口最远」查询用表。
export const ENCLAVE_LOCATION_IDS = Object.freeze(['luminousTunnels', 'spawningGrounds', 'lostCampsite'])
export const NEST_LOCATION_IDS = Object.freeze(['graspingCorridor', 'starvingCorridor', 'acidicCoelom'])
export const SANCTUM_LOCATION_IDS = Object.freeze(['lostCampsite', 'acidicCoelom'])
export const VICTORY_LOCATION_IDS = Object.freeze([
  'hiddenVault', 'corruptedVault', 'fleshyPathsWesternBurrows', 'lostCampsite', 'acidicCoelom',
])
// 从遭遇牌库洗入的 3 处地点（Setup 直接进遭遇牌库，不先放一边）。
export const DECK_LOCATION_IDS = Object.freeze(['growingFields', 'fleshyPathsEasternBurrows', 'fleshyPathsWesternBurrows'])
// Setup 放一边的地点（其余全部靠显现进入场地）。
export const SET_ASIDE_LOCATION_IDS = Object.freeze(LOCATION_IDS.filter(id => id !== START_LOCATION
  && !DECK_LOCATION_IDS.includes(id)))
// 隐藏地点：西部 = 荧光通道；东部 = 攫噬长廊（Setup 后洗入遭遇牌库底 10 张）。
export const HIDDEN_LOCATION_BY_DIRECTION = Object.freeze({ west: 'luminousTunnels', east: 'graspingCorridor' })

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, symbol, links, extra]) => {
  const data = location({
    id, code, connected: LOCATION_CONNECTIONS[id], ...extra,
    printedName: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name,
    printedTraits: [...(ALL_CARDS[code]?.traits || [])],
    symbol,
    symbols: { front: { symbol, links: [...links] }, back: { symbol, links: [...links] } },
  })
  if (id === START_LOCATION) Object.assign(data, { resign: true, revealed: true, start: true })
  return [id, data]
})))

// ---------------------------------------------------------------------------
// 剧情资产 / 敌人 / 诡计
// ---------------------------------------------------------------------------
export const ENEMY_CODES = Object.freeze(['11573', '11574', '11575', '11580'])
export const MOTHER_CODE = '11573'
export const GROTESQUE_AMALGAM_CODE = '11574'
export const APIARY_TENDER_CODE = '11575'
export const SQUAMOUS_PARASITE_CODE = '11580'
export const SQUAMOUS_PARASITE_STORY_CODE = '11580b'
export const MARIA_RIVERA_CODE = '11568'
export const ANCIENT_RELIC_CODE = '11581'
export const ANCIENT_RELIC_STORY_CODE = '11581b'
export const GRISLY_MASK_CODE = '11582'
export const HIDDEN_VAULT_STORY_CODE = '11579b'
export const PARASITIC_TRANSFORMATION_CODE = '11583'
export const TREACHERY_CODES = Object.freeze(['11576', '11577', '11578', '11583'])
export const THE_INESCAPABLE_CODES = Object.freeze(['11744', '11745'])

export const SET_ASIDE_ENEMY_CODES = Object.freeze([GROTESQUE_AMALGAM_CODE, SQUAMOUS_PARASITE_CODE])
export const SET_ASIDE_ASSET_CODES = Object.freeze([ANCIENT_RELIC_CODE, GRISLY_MASK_CODE, MARIA_RIVERA_CODE])
export const SET_ASIDE_ALIASES = Object.freeze([
  GROTESQUE_AMALGAM_CODE, SQUAMOUS_PARASITE_CODE, ANCIENT_RELIC_CODE, GRISLY_MASK_CODE, MARIA_RIVERA_CODE,
  PARASITIC_TRANSFORMATION_CODE, PARASITIC_TRANSFORMATION_CODE, PARASITIC_TRANSFORMATION_CODE,
  PARASITIC_TRANSFORMATION_CODE,
  THE_INESCAPABLE_CODES[0], THE_INESCAPABLE_CODES[1], THE_INESCAPABLE_CODES[1], THE_INESCAPABLE_CODES[1],
  '11723', '11723', '11723', '11724',
])
// 西向移出主母；东向移出玛莉亚。manifest 以默认西向为准。
export const REMOVED_BY_DIRECTION = Object.freeze({
  west: Object.freeze([MOTHER_CODE]),
  east: Object.freeze([MARIA_RIVERA_CODE]),
})

// ---------------------------------------------------------------------------
// 遭遇牌库（东西向两套）
// ---------------------------------------------------------------------------
const snake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase()
const cardsOfGroups = groups => {
  const codes = new Set(groups.map(snake))
  return Object.entries(ALL_CARDS).filter(([, card]) => codes.has(card.encounterCode))
}
const deckCardTypes = ['enemy', 'treachery']
const expand = rows => rows
  .sort(([left], [right]) => left.localeCompare(right))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))

export const GATHER_GROUPS_BY_DIRECTION = Object.freeze({
  west: Object.freeze(['theApiary', 'cosmicLegacy', 'elderMist', 'theInescapable', 'pilgrims', 'pentagram', 'strikingFear']),
  east: Object.freeze(['theApiary', 'cosmicLegacy', 'elderMist', 'theInescapable', 'starSpawn', 'stowaways', 'strikingFear']),
})
// 放一边 / 移出游戏而不进遭遇牌库的剧情卡与地点（按卡号）。
export const DECK_EXCLUDE_CODES = Object.freeze([
  MOTHER_CODE, GROTESQUE_AMALGAM_CODE, SQUAMOUS_PARASITE_CODE, PARASITIC_TRANSFORMATION_CODE,
  MARIA_RIVERA_CODE, ANCIENT_RELIC_CODE, GRISLY_MASK_CODE,
  ...THE_INESCAPABLE_CODES, '11723', '11724', '11725', '11727', '11728',
])
const baseDeck = direction => expand(cardsOfGroups(GATHER_GROUPS_BY_DIRECTION[direction])
  .filter(([, card]) => deckCardTypes.includes(card.type))
  .filter(([code]) => !DECK_EXCLUDE_CODES.includes(code)))
export const ENCOUNTER_DECK_WEST = Object.freeze(baseDeck('west'))
export const ENCOUNTER_DECK_EAST = Object.freeze(baseDeck('east'))
export const DECK_LOCATION_CODES = Object.freeze(DECK_LOCATION_IDS.map(id => LOCATIONS[id].code))
export function encounterDeckFor(direction = 'west') {
  return [...(direction === 'east' ? ENCOUNTER_DECK_EAST : ENCOUNTER_DECK_WEST), ...DECK_LOCATION_CODES]
}
// manifest / 默认（西向）牌库。
export const ENCOUNTER_DECK = Object.freeze(encounterDeckFor('west'))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])
export const ENCOUNTER_DECK_BY_DIRECTION = Object.freeze({
  west: Object.freeze([...ENCOUNTER_DECK_WEST, ...DECK_LOCATION_CODES]),
  east: Object.freeze([...ENCOUNTER_DECK_EAST, ...DECK_LOCATION_CODES]),
})

// ---------------------------------------------------------------------------
// 遭遇定义
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES,
  '11723', '11724',
  ...ENEMY_CODES, SQUAMOUS_PARASITE_STORY_CODE, ANCIENT_RELIC_STORY_CODE, HIDDEN_VAULT_STORY_CODE,
  MARIA_RIVERA_CODE, GRISLY_MASK_CODE,
])
if (definitions.enemies[MOTHER_CODE]) {
  Object.assign(definitions.enemies[MOTHER_CODE], { healthPerInvestigator: true, massive: true, relentless: true })
}
if (definitions.enemies[SQUAMOUS_PARASITE_CODE]) {
  Object.assign(definitions.enemies[SQUAMOUS_PARASITE_CODE], { healthPerInvestigator: true, retaliate: true })
}
if (definitions.storyAssets[GRISLY_MASK_CODE]) {
  Object.assign(definitions.storyAssets[GRISLY_MASK_CODE], {
    artifact: true, exhaustToDisengage: true, glyphLine: ['j', 'm', 's', 'c', 'b'],
  })
}

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT1_CODE),
    action: { kind: 'discardEncounterForLocations', perClue: 5, perClueSingleInvestigator: 10 },
    objective: { type: 'allAtSanctum', maySpendClues: true },
  }),
  2: Object.freeze({
    ...stage(ACT2_WEST_CODE),
    parley: { skills: ['intellect', 'combat'], difficulty: 2 },
    cultistsGainAloof: true,
    cultistsGainVictoryZero: true,
    enemyPhaseEndCultistDamage: 'perStowawayAtLocation',
    objective: { type: 'cultistCardsAtLeast', amount: 5 },
  }),
  3: Object.freeze({
    ...stage(ACT2_EAST_CODE),
    fastAction: { kind: 'cluesForDamage' },
    roundEndCoinRotate: 'centralChamber',
    objective: { type: 'motherDefeated', enemy: MOTHER_CODE },
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(AGENDA1_CODE, { doom: 12 }),
    backPlacesClues: true,
    backShufflesGrotesque: true,
  }),
  2: Object.freeze({
    ...stage(AGENDA2_CODE, { doom: 6 }),
    spawnEnemyOnDoomIfNoNonElite: true,
    backDefeatsAll: true,
  }),
})
export const ACTS = Object.freeze([
  structuredClone(ACT_STAGES[1]), structuredClone(ACT_STAGES[2]), structuredClone(ACT_STAGES[3]),
])
export const AGENDAS = Object.freeze([
  structuredClone(AGENDA_STAGES[1]), structuredClone(AGENDA_STAGES[2]),
])
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  [ACT1_CODE, structuredClone(ACT_STAGES[1])],
  [ACT2_WEST_CODE, structuredClone(ACT_STAGES[2])],
  [ACT2_EAST_CODE, structuredClone(ACT_STAGES[3])],
  [AGENDA1_CODE, structuredClone(AGENDA_STAGES[1])],
  [AGENDA2_CODE, structuredClone(AGENDA_STAGES[2])],
]))

// ---------------------------------------------------------------------------
// 剧情正文（自译摘要；完整叙事见 story-text.js）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'self-translated summary (printed en in locale; full story via narrative-guides worker)',
  heading: '养育场',
  intro: '拉莱耶城下潮湿的隧道如某种巨兽的毛细血管般无尽分叉，墙上每隔一段就嵌着散发柔光的结节。'
    + '第三天夜里扎营后，安迪在笔记本上飞快记录，话题很快转到把你们带进蒂林哈斯特雇用的往事。',
  introBranches: Object.freeze({
    headedWest: '（养育场 1·西向）次日你们发现一个巨大洞窟，四壁与穹顶布满圆形孔洞，通向迷宫般的巢穴。'
      + '安迪在一条气味恶臭的隧道口捡到带血的布片：「不知道这下面住着什么，但它们大概喜欢吃人。」',
    headedEast: '（养育场 2·东向）穿过城市心脏的隧道一路向下，经过冻结在时光里的异界工厂。'
      + '数日探索后你们发现巨大洞窟，一条隧道前伏着一具披拼布斗篷的年轻男子尸体，气味令人作呕。'
      + '鲁比从他口袋里掏出一张纸，上面用血写着两个字：救命。',
  }),
  setupSteps: Object.freeze([
    Object.freeze({ key: 'gatherSetsWest', text: '（西向 v.I）收集遭遇组：养育场、宇宙遗产、古老迷雾、穷途异魔、朝圣者、黑暗教团、惊惧。', when: 'west' }),
    Object.freeze({ key: 'gatherSetsEast', text: '（东向 v.II）收集遭遇组：养育场、宇宙遗产、古老迷雾、穷途异魔、星之眷族（只取感染星之眷族）、偷渡者、惊惧。', when: 'east' }),
    Object.freeze({ key: 'buildActDeck', text: '用幕 1a「不安的兆象」+ 幕 2a「失落的朝圣者」（西）/「蜂巢思维」（东）组成幕牌库，把另一张幕移出游戏。' }),
    Object.freeze({ key: 'removeFromGame', text: '西向移出主母敌人；东向移出玛莉亚·里维拉剧情资产。' }),
    Object.freeze({ key: 'setCardsAside', text: '把每处养育场地、奇丑混种与双面带鳞寄生虫、玛莉亚·里维拉/古代遗物/骇人「面具」、'
      + '朝圣者与穷途异魔遭遇组（西向）、每张寄生变形弱点放在一边。' }),
    Object.freeze({ key: 'placeApiaryEntrance', text: '把养育场入口（引诱之光面）放入场地。' }),
    Object.freeze({ key: 'beginAtApiaryEntrance', text: '每位调查员从养育场入口开始游戏。' }),
    Object.freeze({ key: 'buildEncounterDeck', text: '把其余遭遇卡与放一边的增生原野、两张血肉道路洗成遭遇牌库；'
      + '再把放一边的荧光通道（西）/攫噬长廊（东）洗入牌库底 10 张。' }),
    Object.freeze({ key: 'readyToBegin', text: '准备开始。' }),
  ]),
  resolutions: Object.freeze({
    noResolution: Object.freeze({ title: '无结局', body: '你从颈中扯出一条扭动的虫子逃出腐臭隧道。但愿没有被感染……' }),
    resolution1: Object.freeze({ title: '结局 1', body: '最后一名幸存者走出恶臭隧道。朝圣者向你们道谢，并指出他们从「城市之心」来的隧道。'
      + '安迪擦掉镜片上的黏液：「又一卷没用的胶片。一个镜头就能让我成名……」' }),
    resolution2: Object.freeze({ title: '结局 2', body: '你们精神恍惚地走出隧道，回到最初那片巨大的前厅。若有朝圣者幸存，他们也没有停留。' }),
    resolution3: Object.freeze({ title: '结局 3', body: '远征队浑身血污地跋涉回养育场入口。你挠着后颈，希望自己没有感染。'
      + '蜂巢思维留下的破碎记忆不断侵入你的思绪。' }),
    resolution4: Object.freeze({ title: '结局 4', body: '你们终于找到旧路。几天后，一扇银行金库大小的大门在按下异星符号后滚开，露出通往柔和发光穹顶的干燥海床小径。'
      + '调查员必须做出选择：继续探索海床穹顶（淹没城区），还是攀上峭壁返回营地（西墙）。' }),
  }),
  tokens: APIARY_TOKEN_MEANINGS,
})

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '养育场 · The Apiary',
  nameEn: 'The Apiary',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: [
    { title: '地点连接', body: '地点按印刷符号相连；中央腔室只与它面朝的环位相连，并随蜂巢思维幕的掷币旋转。' },
    { title: '圣所', body: '幕 1 目标：每位存活调查员位于一处[[圣所]]地点时可共同花费所需线索推进。' },
  ],
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  actCodesByDirection: ACT_CODES_BY_DIRECTION,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  encounterDeckByDirection: ENCOUNTER_DECK_BY_DIRECTION,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionNext: RESOLUTION_NEXT,
  resolution4Next: RESOLUTION4_NEXT,
  tokenMeanings: APIARY_TOKEN_MEANINGS,
  centralChamber: {
    id: CENTRAL_CHAMBER_ID, facingRing: [...FACING_RING], initialFacing: INITIAL_FACING,
  },
  // 网格正交邻接与地点符号由 behavior 在设置阶段用 api.mechanics.map.place 建立；
  // registry 的 scenario.mechanics 不接受 map/locationSymbols 字段，故不在此声明。
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ACT_CODES, AGENDA_CODES,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...LOCATION_IDS.map(id => LOCATIONS[id].linkedCode).filter(Boolean),
  ...ENCOUNTER_DECK_CODES,
  ...ENEMY_CODES, SQUAMOUS_PARASITE_STORY_CODE, ANCIENT_RELIC_STORY_CODE, HIDDEN_VAULT_STORY_CODE,
  MARIA_RIVERA_CODE, GRISLY_MASK_CODE,
  ...TREACHERY_CODES,
].map(code => [code, ALL_CARDS[code]])))
