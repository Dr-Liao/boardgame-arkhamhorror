// 恐怖狂欢节（Carnevale of Horrors · 82001）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/CarnevaleOfHorrors.hs（Setup / 地点环 / 混乱袋 / additionalRewards / 结局）
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/CarnevaleOfHorrors.hs
//   Act|Agenda|Enemy|Treachery/Cards/CarnevaleOfHorrors/*.hs
//   frontend/src/locales/en/standalone/carnevaleOfHorrors.json（intro/setup/specialRules/resolutions）
//
// 本关三条特有口径（参考实现）：
//   1. 地点围成随机圆环：随机移除 1 张（圣马可 / 运河畔除外），其余 8 张以随机圆环入场；
//      每张地点与环上左右相邻地点相连（behavior.setupLocations 重写 connections）。
//   2. 7 名「戴面具的狂欢节行人」Masked side 面朝上放在除圣马可外的每张地点；翻面时若另一面是
//      「无辜的狂欢者」则把它放到议程牌库下方（本实现按计数记账，见 behavior 注释）。
//   3. 奈达斯奎（82027）在幕 1 背面入场：「视为在场但不在任何地点」，可以如同位于你所在地点一样攻击；
//      幕 3「划船！」目标为贡多拉上 4[per_investigator] 资源。
//
// 剧情/指南正文由 `content/scenario-guide-sources/carnevaleOfHorrors.json` 提供。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'carnevaleOfHorrors'
export const REFERENCE_CODE = '82001'
export const ENCOUNTER_CODE = 'venice'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT1_CODE = '82005' // The Carnevale Conspiracy
export const ACT2_CODE = '82006' // Get to the Boats!
export const ACT3_CODE = '82007' // Row!
export const ACT_CODES = Object.freeze([ACT1_CODE, ACT2_CODE, ACT3_CODE])
export const AGENDA1_CODE = '82002' // The Festivities Begin
export const AGENDA2_CODE = '82003' // The Shadow of the Eclipse
export const AGENDA3_CODE = '82004' // Chaos at the Carnevale
export const AGENDA_CODES = Object.freeze([AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])
export const CNIDATHQUA_CODE = '82027'
export const MASKED_GOER_CODE = '82017b'
export const INNOCENT_REVELER_CODE = '82021'
export const ABBESS_CODE = '82022'
export const WRITHING_APPENDAGE_CODE = '82030'
export const BALEFUL_REVELER_CODE = '82002b'
export const GONDOLA_CODE = '82006b'
export const MASK_CODES = Object.freeze(['82023', '82024', '82025', '82026'])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'sanMarcoBasilica'
export const CANAL_SIDE = 'canalSide'

// 圆环默认顺序（运行时 behavior 会按随机圆环重写 connections）：
// San Marco Basilica → Canal-side → Streets of Venice → Rialto Bridge → Venetian Garden →
// Bridge of Sighs → Flooded Square → Accademia Bridge → The Guardian → (回到圣马可)。
export const RING_ORDER = Object.freeze([
  'sanMarcoBasilica', 'canalSide', 'streetsOfVenice', 'rialtoBridge', 'venetianGarden',
  'bridgeOfSighs', 'floodedSquare', 'accademiaBridge', 'theGuardian',
])

export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['sanMarcoBasilica', '82008', false]),
  Object.freeze(['canalSide', '82009', false]),
  Object.freeze(['streetsOfVenice', '82010', true]),
  Object.freeze(['rialtoBridge', '82011', true]),
  Object.freeze(['venetianGarden', '82012', true]),
  Object.freeze(['bridgeOfSighs', '82013', true]),
  Object.freeze(['floodedSquare', '82014', true]),
  Object.freeze(['accademiaBridge', '82015', true]),
  Object.freeze(['theGuardian', '82016', true]),
  Object.freeze(['gondola', '82006b', false]),
])

export const LOCATION_COORDINATES = Object.freeze({
  sanMarcoBasilica: { x: 1, y: 2 },
  canalSide: { x: 0, y: 2 },
  streetsOfVenice: { x: 0, y: 1 },
  rialtoBridge: { x: 1, y: 0 },
  venetianGarden: { x: 2, y: 0 },
  bridgeOfSighs: { x: 3, y: 1 },
  floodedSquare: { x: 3, y: 2 },
  accademiaBridge: { x: 3, y: 3 },
  theGuardian: { x: 1, y: 3 },
  gondola: { x: -1, y: 2 },
})

function ringConnections(order) {
  const connections = {}
  const n = order.length
  for (let i = 0; i < n; i++) connections[order[i]] = [order[(i + n - 1) % n], order[(i + 1) % n]]
  connections.canalSide = [...(connections.canalSide || []), 'gondola']
  connections.gondola = ['canalSide']
  return connections
}

export const STATIC_CONNECTIONS = Object.freeze(ringConnections(RING_ORDER))

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Carnevale of Horrors card: ${code}`)
  return {
    code, originalCode: code,
    name: c.nameZh || c.name, nameEn: c.name,
    subname: c.subnameZh || c.subname || '', subnameEn: c.subname || '',
    text: c.textZh || c.text || '', textEn: c.text || '',
    backText: c.backTextZh || c.backText || '', backTextEn: c.backText || '',
    type: c.type, traits: [...(c.traits || [])],
    ...(c.victory != null ? { victory: c.victory } : {}),
  }
}

export function location(data) {
  const { id, code, cluesFixed, clues, connections, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Carnevale of Horrors location: ${code}`)
  return {
    ...printed(code), id, shroud: c.shroud,
    connections: [...(connections || [])],
    ...rest,
    ...(cluesFixed ? { cluesFixed } : { cluesPerInvestigator: clues ?? c.clues ?? 0 }),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name,
  }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Carnevale of Horrors stage: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${c.type}${code}`,
    type: c.type,
    stage: `${number ?? c.stage ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? c.doom } : {}),
  }
}

const PREY_KEYS = Object.freeze({
  'Most clues': 'mostClues', 'Fewest clues': 'fewestClues',
  'Most cards in hand': 'mostCardsInHand', 'Fewest cards in hand': 'fewestCardsInHand',
  'Highest [willpower]': 'highestWillpower', 'Lowest [willpower]': 'lowestWillpower',
})

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown Carnevale of Horrors encounter definition: ${code}`)
    const base = printed(code)
    if (c.type === 'enemy') {
      const keywords = String(c.text || '')
      const preyText = /Prey - ([^.]+)\./.exec(keywords)?.[1]?.trim()
      enemies[code] = {
        ...base,
        fight: c.fight ?? null, evade: c.evade ?? null,
        health: c.health ?? null, damage: c.damage || 0, horror: c.horror || 0,
        ...(c.victory != null ? { victory: c.victory } : {}),
        ...(PREY_KEYS[preyText] ? { prey: PREY_KEYS[preyText] } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert']
          .filter(k => new RegExp(`\\b${k}\\.`).test(keywords)).map(k => [k.toLowerCase(), true])),
        elite: (c.traits || []).includes('Elite'),
        ...(c.code === CNIDATHQUA_CODE ? { global: true, cannotBeEvaded: true } : {}),
      }
    } else if (c.type === 'treachery') {
      treacheries[code] = {
        ...base, entryRevelation: true,
        surge: /^Surge\./m.test(c.text || ''),
      }
    } else if (c.type === 'asset' || c.type === 'story') {
      storyAssets[code] = { ...base, global: true, ...(c.health != null ? { health: c.health } : {}) }
    }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenarioData) {
  const identity = value => ({ originalCode: value.originalCode || value.code, artCode: value.originalCode || value.code })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze(['venice'])
export const SET_ASIDE_CODES = Object.freeze([
  CNIDATHQUA_CODE, ...MASK_CODES, MASKED_GOER_CODE, INNOCENT_REVELER_CODE, ABBESS_CODE, GONDOLA_CODE,
])
export const ENCOUNTER_DECK = Object.freeze(Object.entries(ALL_CARDS)
  .filter(([, card]) => String(card.encounterCode).toLowerCase() === 'venice'
    && ['enemy', 'treachery'].includes(card.type) && !SET_ASIDE_CODES.includes(card.code))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])
export const SET_ASIDE_ALIASES = Object.freeze([...SET_ASIDE_CODES])

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  // 目标：场景牌库和/或密谋牌库下方共有 3 名无辜的狂欢者时推进（behavior.checkObjectives）。
  [ACT1_CODE]: Object.freeze({ ...stage(ACT1_CODE, { number: 1 }), objective: { type: 'custom' } }),
  // 目标：每位未被击败的调查员均位于运河畔时推进（behavior.checkObjectives）。
  [ACT2_CODE]: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'custom' } }),
  // 目标：贡多拉上有 4[per_investigator] 资源时推进（behavior.checkObjectives）。
  [ACT3_CODE]: Object.freeze({ ...stage(ACT3_CODE, { number: 3 }), objective: { type: 'custom' } }),
})
export const AGENDA_STAGES = Object.freeze({
  [AGENDA1_CODE]: Object.freeze({ ...stage(AGENDA1_CODE, { number: 1 }), doomThreshold: 8 }),
  [AGENDA2_CODE]: Object.freeze({ ...stage(AGENDA2_CODE, { number: 2 }), doomThreshold: 3 }),
  [AGENDA3_CODE]: Object.freeze({ ...stage(AGENDA3_CODE, { number: 3 }), doomThreshold: 3 }),
})
export const ACTS = Object.freeze(ACT_CODES.map(code => structuredClone(ACT_STAGES[code])))
export const AGENDAS = Object.freeze(AGENDA_CODES.map(code => structuredClone(AGENDA_STAGES[code])))
export const STAGE_CARDS = Object.freeze(Object.fromEntries([...Object.entries(ACT_STAGES), ...Object.entries(AGENDA_STAGES)]))

// ---------------------------------------------------------------------------
// 地点定义
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code]) =>
  [id, location({ id, code, connections: STATIC_CONNECTIONS[id] || [] })])))

// ---------------------------------------------------------------------------
// 剧情正文
// ---------------------------------------------------------------------------
const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: { delta: -2, kind: 'count', count: 'carnevaleInnocents', base: 2,
      text: '-2；议程牌库下方的每名无辜的狂欢者再 -1' },
    cultist: { delta: 0, drawAnother: true, text: '再揭示一个混乱标记；若本次检定失败，抽取遭遇牌库顶 1 张' },
    tablet: { delta: -3, text: '-3；若失败，对最近的在场无辜的狂欢者造成 1 伤害或 1 恐惧' },
    elderthing: { delta: -4, text: '-4；若失败且奈达斯奎在场，它攻击你' },
  }),
  hard: Object.freeze({
    skull: { delta: -2, kind: 'count', count: 'carnevaleInnocentsHard', base: 2,
      text: '-2；场景/密谋牌库下方的每名无辜的狂欢者再 -1' },
    cultist: { delta: 0, drawAnother: true, text: '同普通；失败时抽取遭遇牌库顶 1 张' },
    tablet: { delta: -4, text: '-4；对最近的在场无辜的狂欢者造成 1 伤害或 1 恐惧' },
    elderthing: { delta: -6, text: '-6；若失败且奈达斯奎在场，它攻击你' },
  }),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; guide source is authoritative)',
  heading: '恐怖狂欢节',
  intro: '“听着，”恩格尔警长坚持道，“我知道这听起来很疯狂，但真的就是这样。”他叹了口气，坐回椅子，'
    + '给你和他自己各倒了一杯咖啡。“上城的一位女士看见一个裂开的鸡蛋戴着这张面具，手里拿着血淋淋的剁肉刀，”'
    + '他指着桌上那副黑色皮面具说。面具上有可笑的长鼻子，额头用黄色涂着一个奇怪的符号。'
    + '“她报了警，我和手下在萨尔顿斯托尔与加里森街角抓住了他。”警长讲述时下颌紧绷、眉头紧锁。'
    + '“那家伙被铐上时只是笑，自称‘赞尼’，别的什么都不说，只反复说‘狂欢节要来了’，谁知道那是什么意思。'
    + '直到第二天我们才发现受害者的尸体。辩护律师想让他进精神病院，我们欣然照办。”'
    + '时间不多了。如果你的研究没错，这案子另有隐情：这个“赞尼”说的不是达克狂欢节，而是威尼斯狂欢节——'
    + '就在下一个满月前开幕……',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集恐怖狂欢节遭遇组的所有卡牌。' },
    { key: 'removeLocation', text: '随机选择 1 张地点，从游戏中移除。若选中圣马可大教堂或运河畔，改随机选择另一张地点。' },
    { key: 'placeLocations', text: '把其余 8 张地点以随机圆形阵型放入场。' },
    { key: 'abbess', text: '把院长阿莱格里娅·迪·比亚塞放入圣马可大教堂。' },
    { key: 'startAt', text: '每位调查员从圣马可大教堂开始游戏。' },
    { key: 'carnevaleGoers', text: '洗混 7 名「戴面具的狂欢节行人」，在除圣马可大教堂外的每张地点各放 1 名，'
      + '戴面具的一面朝上。不要查看它们的另一面。' },
    { key: 'setAside', text: '把以下卡牌放到一边（场外）：奈达斯奎、潘塔洛内、瘟疫医生、包塔、镀金沃尔托。' },
  ]),
  specialRules: Object.freeze([
    '逆时针：部分卡牌让你寻找「逆时针方向最近的地点」。这是对常规规则的例外，视同地点按逆时针相连来处理。',
    '“对面”：某地点“对面”的位置是指与它距离最远、沿顺/逆时针都等距的地点。本剧本中“你所在地点的对面”与“你的对面”同义。',
    '幕 1 背面：把放一边的奈达斯奎敌人生成在所有地点的中心。本剧本余下时间内，奈达斯奎视为在场，但不在任何地点。'
      + '队长选择场上一名戴面具的狂欢节行人并把它翻面。',
    '幕 2 背面：队长抽取遭遇卡「贡多拉」并放入场（本实现直接放入场）。',
  ]),
  rules: Object.freeze({}),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '没有达成任何结局（每位调查员都被击败）：你在船桨轻拍肩膀时呛咳着醒来。“Tutto bene？”'
      + '握着船桨的贡多拉船夫关切地说。你点点头，从船上拖着自己爬上码头，浑身湿透、疼痛难忍。'
      + '城市满目疮痍：运河里大部分船只已毁，街道上覆盖的不是彩纸，而是鲜血……',
    resolution1: '结局 1：日食期间事件过后，城市仍在恢复。几乎所有的生物痕迹都被烈日融化，'
      + '许多人把狂欢节期间的暴力归咎于本地犯罪头目卡西奥·迪·博埃里奥及其团伙。知道真相的人则讳莫如深，'
      + '不敢谈论那生活在威尼斯潟湖中的上古生物。但愿它的名字再也不会被提起。',
    resolution2: '结局 2：那生物退缩了，果冻般的肉块从它身上撕裂、剥落，溅入潟湖。它没有发出任何声音，'
      + '破碎的身躯沉入深处。城中的吟唱陷入哀伤的死寂。当你们回到运河畔的街道时，黑色羽毛从天空飘落，'
      + '落在曾经五彩缤纷的彩纸飘舞之处。你只能猜想，它需要多久才能恢复。',
  }),
  resolutionBranches: Object.freeze({
    noResolution: '在剧本日志中记录「狂欢节期间许多人被献祭给了奈达斯奎」。每位调查员获得胜利区经验。'
      + '若可能，把 1 名无辜的狂欢者从场景牌库下方移到密谋牌库下方。前往「额外奖励」。',
    resolution1: '在剧本日志中记录「太阳把奈达斯奎驱逐回深渊」。每位调查员获得胜利区经验。前往「额外奖励」。',
    resolution2: '在剧本日志中记录「奈达斯奎退回去养伤」。每位调查员获得胜利区经验。前往「额外奖励」。',
    additionalRewards: '额外奖励：按玩家顺序，每位调查员可选择 1 张面具卡加入牌组（不计入牌组张数）：'
      + '潘塔洛内、瘟疫医生、包塔、镀金沃尔托。若场景牌库下方没有无辜的狂欢者且密谋牌库下方至少有 1 名，'
      + '进入「献祭已成」；若密谋牌库下方没有且场景牌库下方有 3 名，进入「院长满意」。',
    sacrificeMade: '献祭已成：日食期间死去的人太多了，未能阻止奈达斯奎仆从的阴谋。野兽已被喂饱，'
      + '它的爪牙更加强大。每位调查员从收藏中随机获得 1 个基础弱点（疯狂/创伤/怪物）。',
    abbessSatisfied: '院长满意：“Grazie mille——谢谢你们的帮助。”阿莱格里娅在你们回到大教堂时说。'
      + '“多亏了你们，伤亡很少。我不敢想象如果你们没来会怎样。若你们需要帮助，请随时开口。”'
      + '任意一位调查员可选择把院长阿莱格里娅·迪·比亚塞加入其牌组（不计入牌组张数）。',
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, CNIDATHQUA_CODE, BALEFUL_REVELER_CODE,
  MASKED_GOER_CODE, INNOCENT_REVELER_CODE, ABBESS_CODE, ...MASK_CODES,
])
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_TABLE.map(([, code]) => code),
  ...ENCOUNTER_DECK_CODES, CNIDATHQUA_CODE, BALEFUL_REVELER_CODE,
  MASKED_GOER_CODE, INNOCENT_REVELER_CODE, ABBESS_CODE, ...MASK_CODES,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '恐怖狂欢节 · Carnevale of Horrors',
  nameEn: 'Carnevale of Horrors',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: "依照剧本参考卡 82001 与参考侧支线的设置页布置：8 处威尼斯地点随机圆环连接、面具行人组与运河遭遇组随机入场；独立开局每人 3 XP。",
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: Object.freeze([...SCENARIO_TEXT.specialRules]),
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  connectByIcons: true,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  setAsideAliases: [...SET_ASIDE_ALIASES],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
