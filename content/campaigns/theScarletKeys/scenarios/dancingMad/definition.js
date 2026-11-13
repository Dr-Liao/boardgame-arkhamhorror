// 疯星乱舞（Dancing Mad · 09591）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：参考实现 `Scenario/Scenarios/TheScarletKeys/DancingMad.hs`（两种布置版本 v.I/v.II、
// 德西交涉、隐匿迷你卡、空洞与存在抹除）、`Act|Agenda|Location|Enemy|Treachery/CardDefs/TheScarletKeys/DancingMad.hs`
// （阶段/地点符号/胜利点）、locale `scenarios/dancingMad.json`（setup/tokens/resolutions）。
// 卡面数据来自 `src/cards/cards-data.js`（TSK 卡面入口 `../../card-data.js`），
// 卡牌行为在 `src/cards/encounter-entries/theScarletKeys/dancingMad/<code>.js`。
//
// 文本来源（P7）：`content/campaigns/theScarletKeys/story-access.js` 的 `chapterStory`;
// 本章不写死剧情正文（缺失时回退到卡片印刷文本）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  encounterDefinitions, identitiesFor, location, printed, stage,
} from '../../card-data.js'
import { chapterStory, flattenStory, resolutionText, storyText } from '../../story-access.js'
import { ENCOUNTER_GROUP_CODES } from '../../shared.js'
import { DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY } from './chaos.js'

export const CHAPTER_ID = 'dancingMad'
export const REFERENCE_CODE = '09591'
export const CAMPAIGN_ID = 'theScarletKeys'
// 参考实现 PreScenarioSetup：时间 < 20 走 v.I（与德西达成交易），≥ 20 走 v.II（遭伏击）。
export const TIME_THRESHOLD = 20
export const HARVANA_MAP_NODE = 'Havana'

// —— 卡号常量（只做命名，不按卡号写流程分支）——
export const RAW_CODES = Object.freeze({
  scenario: '09591',
  agenda1: '09592', agenda2: '09593', agenda3: '09594',
  act1v1: '09595', act2v1: '09596', act1v2: '09597', act2v2: '09598', act3: '09599',
  cafeLunaBastion: '09600b', cafeLunaHaunt: '09600a',
  elMalecon: '09601', jardinesDeLaTropical: '09602', granTeatroDeLaHabana: '09603',
  miramarYachtClub: '09604', plazaHotel: '09605',
  desiderioEncounter: '09606a', desiderioLinkedEnemy: '09607a', desiderioAsset: '09607b',
  bodySnatched: '09608',
})

// 两种开局版本：`deal`（与德西达成交易，v.I）/ `ambush`（遭伏击，v.II）。
export const MODES = Object.freeze({ deal: 'deal', ambush: 'ambush' })
export const MODE_VERSIONS = Object.freeze({ deal: 'version1', ambush: 'version2' })
export const MODE_LABELS = Object.freeze({
  deal: '交涉潜入（与德西达成交易 · v.I）',
  ambush: '战斗警报（俱乐部遭伏击 · v.II）',
})

// 本章遭遇组（参考 Setup 的 gather 组合）。
export const GATHER_GROUPS = Object.freeze([
  'dancingMad', 'agentsOfTheOutside', 'cleanupCrew', 'crimsonConspiracy', 'secretWar', 'shadowOfADoubt',
])
export const SHARED_GROUPS = Object.freeze([
  'agentsOfTheOutside', 'cleanupCrew', 'crimsonConspiracy', 'secretWar', 'shadowOfADoubt',
])

// —— 地点（6 张物理地点卡；月下餐厅双面）——
// 印刷符号与相连符号来自 `Location/CardDefs/TheScarletKeys/DancingMad.hs`；
// 连接由符号表推导（同一条规则只写一次），运行期仍由引擎 `linkLocationBySymbols` 复核。
const SYMBOL_LINKS = Object.freeze({
  spade: Object.freeze(['squiggle', 't']),
  t: Object.freeze(['spade', 'squiggle', 'equals']),
  squiggle: Object.freeze(['spade', 't', 'square']),
  square: Object.freeze(['hourglass', 'equals', 'squiggle']),
  equals: Object.freeze(['hourglass', 'square', 't']),
  hourglass: Object.freeze(['equals', 'square']),
})
const SYMBOL_LABELS = Object.freeze({
  spade: { id: 'spade', label: '黑桃', glyph: '♠' },
  t: { id: 't', label: 'T 字', glyph: '⊥' },
  squiggle: { id: 'squiggle', label: '波浪', glyph: '∿' },
  square: { id: 'square', label: '方形', glyph: '■' },
  equals: { id: 'equals', label: '等号', glyph: '＝' },
  hourglass: { id: 'hourglass', label: '沙漏', glyph: '⧗' },
})
export const locationSymbols = symbol => ({
  front: { symbol, links: [...SYMBOL_LINKS[symbol]], label: SYMBOL_LABELS[symbol]?.label || symbol },
  back: { symbol, links: [...SYMBOL_LINKS[symbol]] },
})

const locationData = (id, code, symbol, extra = {}) => location({
  id, code, clues: ALL_CARDS[code].clues || 0,
  symbols: locationSymbols(symbol), ...extra,
})

// 月下餐厅的追忆堡垒面（v.I 默认面）；结社据点面（v.II）在 behavior 里用 locationVariants 覆写。
const cafeLunaBastion = {
  ...locationData('cafeLuna', RAW_CODES.cafeLunaBastion, 'spade'),
  subnameZh: ALL_CARDS[RAW_CODES.cafeLunaBastion].subnameZh || '',
  subname: ALL_CARDS[RAW_CODES.cafeLunaBastion].subname || '',
  linkedOriginalCode: RAW_CODES.cafeLunaHaunt,
}
export const CAFE_LUNA_FACES = Object.freeze({
  // 追忆堡垒（09600b）：隐藏值 5、每人 1 线索；场上每个[[域外]]敌人隐藏值 -1。
  bastion: Object.freeze({
    code: RAW_CODES.cafeLunaBastion, originalCode: RAW_CODES.cafeLunaBastion,
    name: ALL_CARDS[RAW_CODES.cafeLunaBastion].nameZh || ALL_CARDS[RAW_CODES.cafeLunaBastion].name,
    nameEn: ALL_CARDS[RAW_CODES.cafeLunaBastion].name,
    subnameZh: ALL_CARDS[RAW_CODES.cafeLunaBastion].subnameZh || '',
    subname: ALL_CARDS[RAW_CODES.cafeLunaBastion].subname || '',
    shroud: ALL_CARDS[RAW_CODES.cafeLunaBastion].shroud, cluesPerInvestigator: 1,
    victory: ALL_CARDS[RAW_CODES.cafeLunaBastion].victory || 0,
    text: ALL_CARDS[RAW_CODES.cafeLunaBastion].textZh || ALL_CARDS[RAW_CODES.cafeLunaBastion].text || '',
    textEn: ALL_CARDS[RAW_CODES.cafeLunaBastion].text || '',
  }),
  // 结社据点（09600a）：隐藏值 3、每人 2 线索；无卡面能力。
  haunt: Object.freeze({
    code: RAW_CODES.cafeLunaHaunt, originalCode: RAW_CODES.cafeLunaHaunt,
    name: ALL_CARDS[RAW_CODES.cafeLunaHaunt].nameZh || ALL_CARDS[RAW_CODES.cafeLunaHaunt].name,
    nameEn: ALL_CARDS[RAW_CODES.cafeLunaHaunt].name,
    subnameZh: ALL_CARDS[RAW_CODES.cafeLunaHaunt].subnameZh || '',
    subname: ALL_CARDS[RAW_CODES.cafeLunaHaunt].subname || '',
    shroud: ALL_CARDS[RAW_CODES.cafeLunaHaunt].shroud, cluesPerInvestigator: 2,
    victory: ALL_CARDS[RAW_CODES.cafeLunaHaunt].victory || 0,
    text: ALL_CARDS[RAW_CODES.cafeLunaHaunt].textZh || ALL_CARDS[RAW_CODES.cafeLunaHaunt].text || '',
    textEn: ALL_CARDS[RAW_CODES.cafeLunaHaunt].text || '',
  }),
})

// 地点：月下餐厅 + 五处哈瓦那地点（印刷符号、隐藏值、每人线索、胜利点直接取卡表）。
// 连接由符号表推导（同一条规则只写一次），运行期仍由引擎 `linkLocationBySymbols` 复核。
const LOCATION_BUILD = {
  cafeLuna: cafeLunaBastion,
  elMalecon: locationData('elMalecon', RAW_CODES.elMalecon, 't', { hasVictory: true, victory: 1 }),
  jardinesDeLaTropical: locationData('jardinesDeLaTropical', RAW_CODES.jardinesDeLaTropical, 'squiggle',
    { hasVictory: true, victory: 1 }),
  granTeatroDeLaHabana: locationData('granTeatroDeLaHabana', RAW_CODES.granTeatroDeLaHabana,
    'square', { hasVictory: true, victory: 1 }),
  miramarYachtClub: locationData('miramarYachtClub', RAW_CODES.miramarYachtClub, 'equals'),
  plazaHotel: locationData('plazaHotel', RAW_CODES.plazaHotel, 'hourglass',
    { hasVictory: true, victory: 1 }),
}

// 符号连接：两个地点互为「印刷符号 ↔ 相连符号」即连接（双向任一即可）。
export const linkedLocationIds = (fromId, locations = LOCATION_BUILD) => {
  const from = locations[fromId]?.symbols?.front
  if (!from) return []
  return Object.values(locations)
    .filter(other => other.id !== fromId && other.symbols?.front)
    .filter(other => from.links.includes(other.symbols.front.symbol)
      || other.symbols.front.links.includes(from.symbol))
    .map(other => other.id)
}
for (const [id, entry] of Object.entries(LOCATION_BUILD)) entry.connections.push(...linkedLocationIds(id))
export const LOCATIONS = Object.freeze(Object.fromEntries(
  Object.entries(LOCATION_BUILD).map(([id, entry]) => [id, Object.freeze(entry)])))

export const START_LOCATION = 'cafeLuna'
export const HAVANA_LOCATION_IDS = Object.freeze(Object.keys(LOCATIONS))
// v.II（战斗警报）只把月下餐厅放上场，其余五处放一边；v.I 六处全入场。
export const SET_ASIDE_LOCATION_IDS = Object.freeze(HAVANA_LOCATION_IDS.filter(id => id !== START_LOCATION))

// —— 场外 / 放一边 ——
// 两张德西（09606a 遭遇牌背、09607a 与剧情资产 09607b 同面）始终放一边；
// v.II 额外把 4 张 [[域外]] 敌人（2 异界仿体 + 2 常态颠扑者）放一边（参考 setup.setOutOfPlay）。
export const OUTSIDER_ENEMY_CODES = Object.freeze(['09734', '09737'])
export const DESIDERIO_ENEMY_CODES = Object.freeze([RAW_CODES.desiderioEncounter, RAW_CODES.desiderioLinkedEnemy])
// v.I 把 [[扫荡团伙]] 与 [[猩红阴谋]] 两个遭遇组整组放一边（act 1 v.I 背面才洗回）。
export const SET_ASIDE_GROUPS_DEAL = Object.freeze(['cleanupCrew', 'crimsonConspiracy'])

// 遭遇组 camelCase → 卡池 encounterCode（snake_case）：唯一映射来自战役 `shared.js`，
// 章节不再手写第二份（`shadowOfADoubt` 这类含大写缩写是手写转换的坑）。
const groupSnake = group => ENCOUNTER_GROUP_CODES[group] || group
const GATHER_SNAKES = new Set(GATHER_GROUPS.map(groupSnake))
export const GROUP_SNAKES = Object.freeze(Object.fromEntries(GATHER_GROUPS.map(group => [group, groupSnake(group)])))
const SET_ASIDE_SNAKES_DEAL = new Set(SET_ASIDE_GROUPS_DEAL.map(groupSnake))

// 本章 + 共享组的敌人/诡计（印刷份数在 ENCOUNTER_DECK 里展开）。
const gatheredCards = Object.entries(ALL_CARDS).filter(([, card]) =>
  card.pack === 'tskc' && GATHER_SNAKES.has(card.encounterCode)
  && ['enemy', 'treachery'].includes(card.type))

// —— 遭遇牌定义 ——
const definitions = encounterDefinitions([...gatheredCards.map(([code]) => code), RAW_CODES.desiderioAsset])
export const enemies = Object.freeze({ ...definitions.enemies })
// 本章专属诡计（09608）不写 encounterResolve/test 之外的数据：定义里声明
// `effect.kind: "campaignRule"`，引擎的 treachery-tokens.js 才会把显现交给章节 behavior ——
// 否则真实遭遇零结算。共享组诡计的结算仍由它们自己的条目负责。
export const treacheries = Object.freeze(Object.fromEntries(Object.entries(definitions.treacheries).map(
  ([code, definition]) => [code, code === RAW_CODES.bodySnatched
    ? { ...definition, effect: { kind: 'campaignRule' } }
    : definition])))
export const storyAssets = Object.freeze({ ...definitions.storyAssets })

// 遭遇牌库（v.II 战斗警报口径 = 全组收齐；v.I 在 behavior 里剔除扫荡团伙/猩红阴谋）：
// 两张德西与 4 张 [[域外]] 敌人放一边，不进牌库。
const SET_ASIDE_CARD_CODES = new Set([...DESIDERIO_ENEMY_CODES, ...OUTSIDER_ENEMY_CODES])
export const ENCOUNTER_DECK = Object.freeze(gatheredCards
  .filter(([code]) => !SET_ASIDE_CARD_CODES.has(code))
  .flatMap(([code, card]) => Array(card.quantity || 1).fill(code)))
export const DEAL_SET_ASIDE_DECK_CODES = Object.freeze(gatheredCards
  .filter(([code, card]) => !SET_ASIDE_CARD_CODES.has(code) && SET_ASIDE_SNAKES_DEAL.has(card.encounterCode))
  .flatMap(([code, card]) => Array(card.quantity || 1).fill(code)))

// 放一边的实体卡：两张德西 + 4 张域外敌人（manifest 的 setAside 区域按卡号统计）。
export const SET_ASIDE_CODES = Object.freeze([...DESIDERIO_ENEMY_CODES, ...OUTSIDER_ENEMY_CODES])

// —— 隐匿迷你卡（Concealed X）——
// 毒刺/诱饵不是卡表卡号，kind 命名取参考实现 `Concealed/Kind.hs` 的种类名。
export const DECOY_MINI_KIND = 'Decoy'
// 同志会成员的迷你卡种类由印刷卡名推导（`Coterie Agent (A)` → `CoterieAgentA`），
// 卡号作为键的数据表只在这里出现一次，behavior 只按 kind 反查卡号。
const COTERIE_MINI_KINDS = (() => {
  const table = {}
  for (const [code, card] of Object.entries(ALL_CARDS)) {
    if (card.pack !== 'tskc' || card.type !== 'enemy') continue
    const match = /^Coterie (Agent|Assassin|Enforcer) \(([ABC])\)$/.exec(String(card.name || ''))
    if (!match) continue
    table[code] = `Coterie${match[1]}${match[2]}`
  }
  return table
})()
// 敌人卡号 → 隐匿迷你卡 kind（参考 setup.miniCards 列出的九种真身）。
export const CONCEALED_MINI_KINDS = Object.freeze({
  [RAW_CODES.desiderioEncounter]: 'DesiderioDelgadoAlvarez',
  [RAW_CODES.desiderioLinkedEnemy]: 'DesiderioDelgadoAlvarez',
  ...COTERIE_MINI_KINDS,
})
export const MINI_KIND_ENEMY_CODES = Object.freeze({
  // 阴影里的德西只按「遭遇牌背版本」入场（剧情资产面 09607b 是另一面，不是敌人）。
  DesiderioDelgadoAlvarez: RAW_CODES.desiderioEncounter,
  ...Object.fromEntries(Object.entries(COTERIE_MINI_KINDS).map(([code, kind]) => [kind, code])),
})
export const miniKindOf = code => CONCEALED_MINI_KINDS[code] || null
export const enemyCodeOfMiniKind = kind => MINI_KIND_ENEMY_CODES[kind] || null
// 隐匿 X：「Concealed 1 [per_investigator]」（德西）与「Concealed 1/2」（同志会成员）。
export const concealedXOf = code => {
  const card = ALL_CARDS[code]
  const match = /Concealed (\d+)([^\n]*)/.exec(String(card?.text || ''))
  if (!match) return null
  const perInvestigator = /per_investigator/.test(match[2] || '')
  return { value: Number(match[1]), perInvestigator, x: null }
}

// —— 幕 / 议程 ——
// 幕牌按开局版本分两套（v.I / v.II），幕 3 共用；两侧卡面都要能推进到背面结算。
const actDefinition = (id, code, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number: extra.number ?? 1 }), id, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    ...extra,
  }
}
const agendaDefinition = (id, number, code, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    ...extra,
  }
}

export const ACT_VARIANTS = Object.freeze({
  // v.I：幕 1/2 是「一失足/一失色」（交涉潜入线），目标为线索支付 + 阴影无敌人。
  deal: Object.freeze([
    actDefinition('act1', RAW_CODES.act1v1, { number: 1, target: 3,
      objective: { type: 'clues', perInvestigator: 3 } }),
    actDefinition('act2', RAW_CODES.act2v1, { number: 2, target: 1,
      objective: { type: 'campaignRule', kind: 'noEnemiesInShadows', perInvestigator: 1 } }),
    actDefinition('act3', RAW_CODES.act3, { number: 3, objective: { type: 'campaignRule', kind: 'desiderioDefeated' } }),
  ]),
  // v.II：幕 1/2 是「一失足/一失色（版本二）」（战斗警报线），目标为线索支付 + 敌人身上的线索。
  ambush: Object.freeze([
    actDefinition('act1', RAW_CODES.act1v2, { number: 1, target: 2,
      objective: { type: 'clues', perInvestigator: 2 } }),
    actDefinition('act2', RAW_CODES.act2v2, { number: 2,
      objective: { type: 'campaignRule', kind: 'cluesOnCoterieEnemies', perInvestigator: 4 } }),
    actDefinition('act3', RAW_CODES.act3, { number: 3, objective: { type: 'campaignRule', kind: 'desiderioDefeated' } }),
  ]),
})
export const acts = ACT_VARIANTS.deal

// 议程固定三张：沉默之声（6 毁灭）/ 笼中鸟（6）/ 眼见为虚（5）。
// 正面强制：放一边的空洞达到 5/4/3 每人时，移除 3/2/1 每人并放 1 毁灭（可因此推进）。
export const AGENDA_HOLLOW_THRESHOLDS = Object.freeze({
  agenda1: { perInvestigator: 5, remove: 3 },
  agenda2: { perInvestigator: 4, remove: 2 },
  agenda3: { perInvestigator: 3, remove: 1 },
})
export const agendas = Object.freeze([
  agendaDefinition('agenda1', 1, RAW_CODES.agenda1,
    { hollowForced: AGENDA_HOLLOW_THRESHOLDS.agenda1, backAction: 'chooseConcealedOrHollow' }),
  agendaDefinition('agenda2', 2, RAW_CODES.agenda2,
    { hollowForced: AGENDA_HOLLOW_THRESHOLDS.agenda2, backAction: 'chooseConcealedOrHollow' }),
  agendaDefinition('agenda3', 3, RAW_CODES.agenda3,
    { hollowForced: AGENDA_HOLLOW_THRESHOLDS.agenda3, backAction: 'erasure' }),
])

// —— 结局 ——
const story = (() => {
  try { return chapterStory(CHAPTER_ID) } catch { return null }
})()
const sections = story?.sections || {}
// story-text 是生成物，正文里保留源站点的 HTML 片段（`<p class='file'>`、遭遇组图标区块）；
// 章节展示文本统一去掉标签与空段落，避免剧本书/指南里露出 HTML。
const stripTags = value => String(value || '')
  .replace(/<section[^>]*>[\s\S]*?<\/section>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
const flatten = value => stripTags(flattenStory(value))
const resolutionOf = (key, fallback) => stripTags(resolutionText(CHAPTER_ID, key)) || flatten(sections.resolutions?.[key]) || fallback

export const resolutions = Object.freeze({
  noResolution: resolutionOf('noResolution', '所有调查员都被击败或撤退：特别小组没能发现哈瓦那的真相。'),
  resolution1: resolutionOf('resolution1', '结局 1：德西欠你一笔，你知道了口令。'),
  resolution2: resolutionOf('resolution2', '结局 2：特别小组没能发现哈瓦那的真相。'),
})

// 序章正文（Intro 1–4 与两种时间分支）；只做展示，不决定流程。
export const INTRO_SECTIONS = Object.freeze({
  intro1: flatten(sections.intro?.intro1Part1) + flatten(sections.intro?.intro1Part2),
  policeOrDetective: flatten(sections.intro?.policeOrDetective),
  intro2: flatten(sections.intro?.intro2),
  intro3: flatten(sections.intro?.intro3),
  intro4: flatten(sections.intro?.intro4),
  fewerThanTwentyTime: flatten(sections.intro?.fewerThanTwentyTime),
  twentyOrMoreTime: flatten(sections.intro?.twentyOrMoreTime),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  sectionCount: Object.keys(sections).length,
  introTitle: flatten(sections.heading) || '疯星乱舞',
  intro: [INTRO_SECTIONS.intro1, INTRO_SECTIONS.policeOrDetective, INTRO_SECTIONS.intro2,
    INTRO_SECTIONS.intro3, INTRO_SECTIONS.intro4].filter(Boolean).join('\n\n'),
  setup: [stripTags(storyText(CHAPTER_ID, 'setup.version1.gatherSets')), stripTags(storyText(CHAPTER_ID, 'setup.version1.actDeck'))]
    .filter(Boolean).join('\n\n'),
  specialRules: [
    '阴影与隐匿：两名德西与同志会成员（特工 A/B/C、刺客 A/B、打手 A/B）以隐匿迷你卡进入阴影，'
    + '揭露真身时按「隐匿 X」入场；未揭露的迷你卡不公开身份，轮末在原地重新混洗。',
    '空洞与存在抹除：投入本次检定的非弱点卡牌可以成为空洞；议程 1–3 正面在空洞达到阈值时移除并放毁灭；'
    + '议程 3「眼见为虚」背面把每位调查员经验值最高的空洞放逐，并记入剧本日志的「存在抹除」。',
    '交涉与谈判：幕 1/2（版本一）走交涉潜入（阴影无敌人时可共同支付线索推进）；'
    + '幕 2（版本二）用「谈判」把等于剩余生命的线索放到[[结社]]敌人身上；'
    + '幕 3 的德西失去隐匿与猎手、获得冷漠与「谈判：查看另一面」。',
    stripTags(storyText(CHAPTER_ID, 'setup.version1.miniCards')),
    stripTags(storyText(CHAPTER_ID, 'setup.version2.theShadows')),
  ].filter(Boolean).join('\n\n'),
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  referenceCode: REFERENCE_CODE,
  campaignId: CAMPAIGN_ID,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: SET_ASIDE_LOCATION_IDS,
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings: DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY,
  ...SCENARIO_TEXT,
})

// 双面月下餐厅的身份：正面 09600b（追忆堡垒）、背面 09600a（结社据点）。
export const identities = (() => {
  const base = identitiesFor(scenario)
  const cafe = base.locations.cafeLuna
  cafe.linkedOriginalCode = RAW_CODES.cafeLunaHaunt
  return Object.freeze(base)
})()

// 审计/覆盖用：本章单卡条目的原卡号（参考卡 09591 与地点/幕/议程不建条目）。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  ...DESIDERIO_ENEMY_CODES, RAW_CODES.desiderioAsset, RAW_CODES.bodySnatched,
])
export const entryCodes = () => CHAPTER_ENTRY_CODES
export const enemyCodesFor = () => DESIDERIO_ENEMY_CODES

// —— 战役记录（参考 Key.hs 的对应键，camelCase 与其它战役行为一致；键集与战役 records.js 对齐）——
// `erasedFromExistence` 是印刷复选框（布尔），被放逐的卡名记在 `erasedCards`（字符串数组）。
export const RECORD_READS = Object.freeze([
  'theCellMadeADealWithDesi', 'theCellHasBeenAmbushed', 'theCellKnowsOfDesisPast', 'erasedCards',
])
export const RECORD_WRITES = Object.freeze([
  'theCellMadeADealWithDesi', 'theCellHasBeenAmbushed', 'desiIsInYourDebt', 'youKnowThePassphrase',
  'theCellDidntDiscoverTheTruthInHavana', 'youHaventSeenTheLastOfDesiderioDelgadoAlvarez',
  'erasedFromExistence', 'erasedCards',
])
// 镜刃（09768）在结局 2/无结局时记到「德西德柔·戴佳多·欧瓦瑞兹（红字账）」名下。
export const MIRRORING_BLADE_KEY_ID = '09768'
export const DESIDERIO_BEARER_ENEMY_CODE = '09758'

// 结局记录：1 时间 / 2 时间，以及结局 1 写入的 Θ（动态状况报告，min(35, time + 6)）。
export const RESOLUTION_TIME = Object.freeze({ noResolution: 1, resolution1: 2, resolution2: 1 })
export const THETA_OFFSET = 6
export const FORCED_TIME_CAP = 35

export { printed, storyText, resolutionText }
