// 苦痛之影（Shades of Suffering · 09660）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考实现（只读事实源）：
//   · `Scenarios/TheScarletKeys/ShadesOfSuffering.hs`（PreScenarioSetup 两分支、Setup 的地点/灵怪/朱三娘/
//     时间充能、混乱标记取值、四个结局与时间/密钥归属）；
//   · `Act|Agenda|Enemy|Location|Story|Treachery/Cards/TheScarletKeys/ShadesOfSuffering/*.hs`
//     （幕/密谋正反面、灵怪双面翻面、朱三娘「离场返阴影」与「血债血偿」、七张地点的卡面能力）；
//   · `Location/CardDefs/.../ShadesOfSuffering.hs`（地点连接符号：East Wing=菱形、
//     West Wing=三角、Selangor Club=圆、Padang=方、Melati's Shop=波浪、Tin Mine=星、Wayang Kulit=月）；
//   · locale `scenarios/shadesOfSuffering.json`（intro/setup/theBomoh/resolutions）与 `zh/`；
//   · 卡面事实源 `src/cards/cards-data.js`（08 号段唯一印刷事实源）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterDefinitions, encounterGroupDeck, identitiesFor, location, stage } from '../../card-data.js'
import { chapterSection, flattenResolution, flattenStory } from '../../story-access.js'
import { CHARGE_FLAG, SHADES_OF_SUFFERING_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'shadesOfSuffering'
export const REFERENCE_CODE = '09660'

export const RAW_CODES = Object.freeze({
  scenario: '09660',
  agenda1: '09661', agenda2: '09662', agenda3: '09663',
  act1: '09664', act2: '09665', act3: '09666',
  stationEastWing: '09667', stationWestWing: '09668',
  selangorClub: '09669', selangorClubPadang: '09670',
  melatisShop: '09671', wayangKulitTheater: '09672', tinMine: '09673',
  uncannyShadowPlayful: '09674a', playfulShadows: '09674b',
  uncannyShadowTimorous: '09674c', timorousShadows: '09674d',
  buriedMinerMemento: '09675a', aLostMemento: '09675b',
  buriedMinerBones: '09675c', exhumeTheBones: '09675d',
  slainForemanSympathy: '09676a', sympathyPain: '09676b',
  slainForemanFamilial: '09676c', familialPain: '09676d',
  excruciate: '09677', spiritHarvest: '09678',
  tzuSanNiang: '09679a', tzuSanNiangOutForBlood: '09679b',
  shadeReaperStable: '09680a', shadeReaperUnstable: '09680b',
})

// 遭遇组：专属组 + 五个共享组（guide 的 gatherSets；共享组的行为由共享组 worker 交付，
// 本章只声明 requiredEncounterGroupIds 并在本地遭遇牌库里按印刷份数展开）。
export const GATHER_GROUPS = Object.freeze([
  'shadesOfSuffering', 'darkVeiling', 'mysteriesAbound', 'scarletSorcery', 'spreadingCorruption',
  'strikingFear',
])
export const SHARED_GROUPS = Object.freeze(GATHER_GROUPS.slice(1))

// —— 地点 ——
// 连接符号 → 静态连接（参考 `Location/CardDefs/...` 的 own/connects 表；两两互为对侧符号，无随机）。
//   East Wing ⇄ West Wing / Melati's Shop / Tin Mine / Wayang Kulit
//   West Wing ⇄ Selangor Club / Selangor Club Padang；Selangor Club ⇄ Padang
export const STATION_EAST_WING = 'stationEastWing'
export const STATION_WEST_WING = 'stationWestWing'
export const SELANGOR_CLUB = 'selangorClub'
export const SELANGOR_CLUB_PADANG = 'selangorClubPadang'
export const MELATIS_SHOP = 'melatisShop'
export const WAYANG_KULIT_THEATER = 'wayangKulitTheater'
export const TIN_MINE = 'tinMine'

export const START_LOCATION = STATION_WEST_WING
// Setup 在场：West Wing、Selangor Club、East Wing、Padang；放一边：Melati's Shop、Tin Mine、Wayang Kulit。
export const SETUP_LOCATION_IDS = Object.freeze([STATION_EAST_WING, STATION_WEST_WING, SELANGOR_CLUB, SELANGOR_CLUB_PADANG])
export const SET_ASIDE_LOCATION_IDS = Object.freeze([MELATIS_SHOP, WAYANG_KULIT_THEATER, TIN_MINE])
export const LOCATION_IDS = Object.freeze([...SETUP_LOCATION_IDS, ...SET_ASIDE_LOCATION_IDS])

export const LOCATION_SYMBOLS = Object.freeze({
  stationEastWing: Object.freeze({ own: 'diamond', connects: Object.freeze(['moon', 'star', 'triangle', 'squiggle']) }),
  stationWestWing: Object.freeze({ own: 'triangle', connects: Object.freeze(['diamond', 'circle', 'square']), haunted: true }),
  selangorClub: Object.freeze({ own: 'circle', connects: Object.freeze(['triangle', 'square']) }),
  selangorClubPadang: Object.freeze({ own: 'square', connects: Object.freeze(['triangle', 'circle']) }),
  melatisShop: Object.freeze({ own: 'squiggle', connects: Object.freeze(['diamond']) }),
  wayangKulitTheater: Object.freeze({ own: 'moon', connects: Object.freeze(['diamond']), haunted: true }),
  tinMine: Object.freeze({ own: 'star', connects: Object.freeze(['diamond']), haunted: true }),
})

export function staticConnections() {
  const out = Object.fromEntries(LOCATION_IDS.map(id => [id, []]))
  for (const id of LOCATION_IDS) {
    const own = LOCATION_SYMBOLS[id]?.own
    if (!own) continue
    for (const other of LOCATION_IDS) {
      if (other === id) continue
      if ((LOCATION_SYMBOLS[other]?.connects || []).includes(own)) out[id].push(other)
    }
  }
  return out
}
const staticEdges = staticConnections()

// 地点的印刷线索值：perPlayer = 印刷值 × 调查员人数；melatisShop 固定 0。
// 帷幕取印刷值；Wayang Kulit 的印刷「X」在 definition 里写成基础 0，
// 运行时由 behavior.locationShroudModifier 追加 X = ⌈影穑充能数 / 2⌉（上限 8）。
const LOCATION_SPECS = Object.freeze([
  ['stationEastWing', RAW_CODES.stationEastWing, { clues: 1, cluesFixed: false }],
  ['stationWestWing', RAW_CODES.stationWestWing, { clues: 1, cluesFixed: false, hasVictory: true, victory: 1 }],
  ['selangorClub', RAW_CODES.selangorClub, { clues: 1, cluesFixed: false }],
  ['selangorClubPadang', RAW_CODES.selangorClubPadang, { clues: 2, cluesFixed: false, hasVictory: true, victory: 1 }],
  ['melatisShop', RAW_CODES.melatisShop, { clues: 0, cluesFixed: true }],
  ['wayangKulitTheater', RAW_CODES.wayangKulitTheater, { clues: 1, cluesFixed: false, hasVictory: true, victory: 1, shroud: 0 }],
  ['tinMine', RAW_CODES.tinMine, { clues: 2, cluesFixed: false, hasVictory: true, victory: 1 }],
])

const locationData = ([id, code, spec]) => location({
  id, code, cluesFixed: spec.cluesFixed, clues: spec.clues,
  ...(spec.hasVictory ? { hasVictory: true, victory: spec.victory } : {}),
  ...(spec.shroud != null ? { shroud: spec.shroud } : {}),
  connections: [...staticEdges[id]],
})
export const LOCATIONS = Object.freeze(Object.fromEntries(
  LOCATION_SPECS.map(spec => [spec[0], Object.freeze(locationData(spec))])))

/** 该地点的印刷线索值（固定值或印刷值 × 人数）。 */
export function clueValueOf(state, locationId) {
  const definition = LOCATIONS[locationId]
  if (!definition) return 0
  const count = Number(state?.numInvestigators) || (state?.investigators || []).length || 1
  if (definition.cluesFixed != null && definition.cluesFixed !== false) return Number(definition.cluesFixed) || 0
  return (Number(definition.cluesPerInvestigator ?? definition.clues) || 0) * count
}

// —— 「记住」的事实（六张剧情卡的解锁条件；locale `remembered` 的键名） ——
export const REMEMBERED = Object.freeze({
  tradedForAKitten: 'tradedForAKitten',
  foundACheapMemento: 'foundACheapMemento',
  embarrassedTheConsulate: 'embarrassedTheConsulate',
  peeredBeyond: 'peeredBeyond',
  sharedADeepPain: 'sharedADeepPain',
  foundHiddenBones: 'foundHiddenBones',
})

// —— 灵怪（Geist）：三对双面敌人（敌人面 ↔ 剧情面），每对随机留一张、另一张移出游戏 ——
// parley 是每张灵怪自己的行动：费用与技能按卡面（弃随机手牌 / 承受恐惧 / 弃支援），
// 难度 6 减去费用支付的量；成功或「将要被击败」时翻面结算剧情面。
export const GEIST_PAIRS = Object.freeze([
  Object.freeze({
    enemy: '09674a', story: '09674b', name: 'Uncanny Shadow', nameZh: '诡怪的阴影',
    fact: REMEMBERED.embarrassedTheConsulate, storyName: 'Playful Shadows',
    parley: Object.freeze({ cost: 'discardRandomCards', min: 1, max: 3, skill: 'willpower', difficulty: 6 }),
  }),
  Object.freeze({
    enemy: '09674c', story: '09674d', name: 'Uncanny Shadow', nameZh: '诡怪的阴影',
    fact: REMEMBERED.peeredBeyond, storyName: 'Timorous Shadows',
    parley: Object.freeze({ cost: 'discardRandomCards', min: 1, max: 3, skill: 'willpower', difficulty: 6 }),
  }),
  Object.freeze({
    enemy: '09675a', story: '09675b', name: 'Buried Miner', nameZh: '被掩埋的矿工',
    fact: REMEMBERED.foundACheapMemento, storyName: 'A Lost Memento',
    parley: Object.freeze({ cost: 'takeHorror', min: 1, max: 3, skill: 'combat', difficulty: 6 }),
  }),
  Object.freeze({
    enemy: '09675c', story: '09675d', name: 'Buried Miner', nameZh: '被掩埋的矿工',
    fact: REMEMBERED.foundHiddenBones, storyName: 'Exhume the Bones',
    parley: Object.freeze({ cost: 'takeHorror', min: 1, max: 3, skill: 'combat', difficulty: 6 }),
  }),
  Object.freeze({
    enemy: '09676a', story: '09676b', name: 'Slain Foreman', nameZh: '被杀害的工头',
    fact: REMEMBERED.sharedADeepPain, storyName: 'Sympathy Pain',
    parley: Object.freeze({ cost: 'discardAsset', min: 1, max: 1, skill: 'intellect', difficulty: 6 }),
  }),
  Object.freeze({
    enemy: '09676c', story: '09676d', name: 'Slain Foreman', nameZh: '被杀害的工头',
    fact: REMEMBERED.tradedForAKitten, storyName: 'Familial Pain',
    parley: Object.freeze({ cost: 'discardAsset', min: 1, max: 1, skill: 'intellect', difficulty: 6 }),
  }),
])

export const GEIST_ENEMY_CODES = Object.freeze(GEIST_PAIRS.map(pair => pair.enemy))
export const STORY_CODES = Object.freeze(GEIST_PAIRS.map(pair => pair.story))
export const geistPairOf = code => GEIST_PAIRS.find(pair => pair.enemy === code || pair.story === code) || null
export const geistEnemyOfStory = storyCode => GEIST_PAIRS.find(pair => pair.story === storyCode) || null

// —— 朱三娘 / 影穑 ——
export const TZU_SAN_NIANG = RAW_CODES.tzuSanNiang
export const TZU_SAN_NIANG_OUT_FOR_BLOOD = RAW_CODES.tzuSanNiangOutForBlood
export const TZU_FACE_CODES = Object.freeze([TZU_SAN_NIANG, TZU_SAN_NIANG_OUT_FOR_BLOOD])
// 隐匿 2：2 张诱饵 + 真身（分配到「起始地点以外」的地点）。
export const CONCEALED_AMOUNT = 2
export const DECOY_KIND = 'Decoy'
// 绯红密钥「影穑」：物理 09680，稳定面 09680a / 动荡面 09680b，Setup 时以动荡面附属在朱三娘身上。
export const SHADE_REAPER_KEY = Object.freeze({
  id: '09680',
  stableFace: RAW_CODES.shadeReaperStable,
  unstableFace: RAW_CODES.shadeReaperUnstable,
  name: ALL_CARDS[RAW_CODES.shadeReaperStable]?.nameZh || ALL_CARDS[RAW_CODES.shadeReaperStable]?.name || '影穑',
})
export const KEY_CODES = Object.freeze([RAW_CODES.shadeReaperStable, RAW_CODES.shadeReaperUnstable])
// 影穑的充能计数（[skull]、折磨、魂灵收割与多个卡面效果都读写它）。
// 密钥原语（tsk-scarlet-keys）只登记持有者/面，不提供计数器，因此本章把充能记在场景旗标
// `scenarioFlags.shadeReaperCharges`（卡条目经 `api.scenarioFlag/setScenarioFlag` 读写同一键）。
// 键名定义在 chaos.js（本章唯一的标记/充能口径），这里转出给 behavior 与测试使用。
// 见 primitive-requests/extend-scarlet-key-charges.json 与 behavior.scenarioApproximations。
export { CHARGE_FLAG }

// —— 遭遇牌：专属组的诡计（2+3 份）与五个共享组按印刷份数展开；灵怪/朱三娘/密钥都不是遭遇牌 ——
export const TREACHERY_CODES = Object.freeze([RAW_CODES.excruciate, RAW_CODES.spiritHarvest])
const SET_ASIDE_ENEMY_SET = new Set(GEIST_ENEMY_CODES)
// 2026-11-13 P0：共享组统一走 card-data.js#encounterGroupDeck（camelCase 组名 → 卡表 encounterCode），
// 旧实现自建 snake 转换且 definitions 没并入牌库里的共享组（09720/09721 从未注册 → 抽到即崩）。
export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, {
  exclude: [...SET_ASIDE_ENEMY_SET, RAW_CODES.tzuSanNiang, RAW_CODES.tzuSanNiangOutForBlood],
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 遭遇定义：全部灵怪 + 朱三娘两面 + 诡计 + 六张剧情卡（灵怪背面）+ 牌库里的共享组卡。
// 双面卡（灵怪 ↔ 剧情、朱三娘 a/b、影穑 a/b）都各有一条单卡条目。
// 共享组卡必须在此注册（生产组合根按章展开 definitions），否则真实抽取会报「未知遭遇卡」。
const definitions = encounterDefinitions([
  ...new Set([...ENCOUNTER_DECK_CODES, ...GEIST_ENEMY_CODES, ...TZU_FACE_CODES, ...TREACHERY_CODES, ...STORY_CODES]),
])
const enemyDefinition = code => ({
  ...definitions.enemies[code],
  code, originalCode: code,
  // 灵怪卡面「得到 +1[per_investigator]生命值」；朱三娘（血债血偿）「+2[per_investigator] 生命值」。
  // 引擎 spawnEnemy 读 `healthPerPlayerBonus`（enemies.js:529-531），这里是唯一声明点。
  ...(SET_ASIDE_ENEMY_SET.has(code) ? { healthPerPlayerBonus: 1 } : {}),
  ...(code === RAW_CODES.tzuSanNiangOutForBlood ? { healthPerPlayerBonus: 2 } : {}),
  traits: [...(ALL_CARDS[code].traits || [])],
})
const treacheryDefinition = code => ({
  ...definitions.treacheries[code],
  code, originalCode: code,
  // 引擎 `treachery-tokens.js#resolveTreacheryBody` 只对 `effect.kind === 'campaignRule'`
  // （或 entry.encounterResolve / treacheryRule.test）走内容结算；本章两张专属诡计由
  // behavior.resolveEncounter 按 `treacheryRule.resolveKind` 分派，因此声明 campaignRule。
  effect: { kind: 'campaignRule' },
})
const storyDefinition = code => ({ ...definitions.storyAssets[code], code, originalCode: code })
// 共享组卡（谜雨/黑暗笼罩/猩红巫术/腐败扩散/恐惧打击）也要进 scenario.enemies/treacheries：
// 生产组合根按章 Object.assign 到全局遭遇表，漏掉就会在真实抽取时「未知遭遇卡」。
const OWN_ENEMY_CODES = new Set([...GEIST_ENEMY_CODES, ...TZU_FACE_CODES])
const sharedEnemies = Object.fromEntries(Object.entries(definitions.enemies)
  .filter(([code]) => !OWN_ENEMY_CODES.has(code))
  .map(([code, definition]) => [code, Object.freeze({ ...definition, code, originalCode: code })]))
const sharedTreacheries = Object.fromEntries(Object.entries(definitions.treacheries)
  .filter(([code]) => !TREACHERY_CODES.includes(code))
  .map(([code, definition]) => [code, Object.freeze({ ...definition, code, originalCode: code })]))
export const enemies = Object.freeze({
  ...sharedEnemies,
  ...Object.fromEntries([...GEIST_ENEMY_CODES, ...TZU_FACE_CODES]
    .map(code => [code, Object.freeze(enemyDefinition(code))])),
})
export const treacheries = Object.freeze({
  ...sharedTreacheries,
  ...Object.fromEntries(TREACHERY_CODES.map(code => [code, Object.freeze(treacheryDefinition(code))])),
})
export const storyAssets = Object.freeze(Object.fromEntries(STORY_CODES
  .map(code => [code, Object.freeze(storyDefinition(code))])))

// —— 幕 / 议程 ——
const actDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number }), id: `act${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    chapterFlow: CHAPTER_ID, objective: { type: 'campaignRule' }, ...extra,
  }
}
const agendaDefinition = (code, number, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id: `agenda${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    chapterFlow: CHAPTER_ID, ...extra,
  }
}
export const ACT1 = Object.freeze(actDefinition(RAW_CODES.act1, 1))
export const ACT2 = Object.freeze(actDefinition(RAW_CODES.act2, 2))
export const ACT3 = Object.freeze(actDefinition(RAW_CODES.act3, 3))
// 密谋 2 在单人游戏里毁灭阈值 +1（卡面）。阈值在 Setup 时按人数改写（behavior.setupLocations）。
export const AGENDA1 = Object.freeze(agendaDefinition(RAW_CODES.agenda1, 1))
export const AGENDA2 = Object.freeze(agendaDefinition(RAW_CODES.agenda2, 2))
export const AGENDA3 = Object.freeze(agendaDefinition(RAW_CODES.agenda3, 3))
export const acts = Object.freeze([ACT1, ACT2, ACT3])
export const agendas = Object.freeze([AGENDA1, AGENDA2, AGENDA3])

// —— 结局：未达成 / 1（用伞对付她）/ 2（放她走）/ 3（被她控制） ——
const resolutionSection = key => chapterSection(CHAPTER_ID, `resolutions.${key}`, null)
const resolutionOf = key => {
  const section = resolutionSection(key)
  const text = section == null ? '' : flattenResolution(section)
  return text || key
}
export const resolutions = Object.freeze({
  noResolution: resolutionOf('noResolution'),
  resolution1: resolutionOf('resolution1'),
  resolution2: resolutionOf('resolution2'),
  resolution3: resolutionOf('resolution3'),
})

// —— 正文：intro（两分支）/ setup / theBomoh 幕间 / specialRules ——
const introSection = chapterSection(CHAPTER_ID, 'intro', {}) || {}
const setupSection = chapterSection(CHAPTER_ID, 'setup', {}) || {}
const bomohSection = chapterSection(CHAPTER_ID, 'theBomoh', {}) || {}
const tokenMeanings = SHADES_OF_SUFFERING_TOKEN_MEANINGS
const specialRulesText = [
  '【特别规则：影穑（The Shade Reaper）】影穑是本章的绯红密钥，Setup 时以[[动荡]]面附属在朱三娘身上；'
    + '它的充能数决定 [skull] 的负修正（简单/普通：充能数一半向上取整，上限 6；困难/专家：等于充能数）。'
    + '充能会在折磨、魂灵收割、痛苦的记忆、血债血偿与结局之间累积/移除。',
  '【特别规则：灵怪（Geist）】三张灵怪敌人都是双面卡，背面是剧情卡。与灵怪谈判成功、或灵怪将要被击败时，'
    + '把它翻到剧情面并结算：如果队伍已经「记住」对应的事实（换到小猫 / 找到纪念品 / 让领事蒙羞 / '
    + '眺望彼端 / 分担深沉的痛苦 / 找到掩埋的遗骨），剧情卡加入胜利区（胜利 1）；否则灵怪翻回敌人面、'
    + '治愈全部伤害、解除交战并横置。',
  '【特别规则：隐匿 2（朱三娘）】朱三娘以隐匿形式在阴影中：2 张诱饵 + 1 张真身迷你卡，'
    + '平均分配到「起始地点以外」的地点；揭露真身时她入场，迷你卡回到她身边的方式见密谋 2 背面。',
  `【特别规则：混乱标记】${Object.entries(tokenMeanings.standard)
    .map(([token, entry]) => `[${token}] ${entry.text}`).join('；')}`,
].join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  introTitle: introSection.title || '档案#46-Q：苦痛之影',
  // 开场两分支：Flint 曾前往吉隆坡 → intro 1（他重归特别小组）；否则 intro 2（他失踪）。
  introBranches: Object.freeze({
    flintTraveledToKualaLumpur: flattenStory(introSection.intro1 || ''),
    agentFlintIsMissing: flattenStory(introSection.intro2 || ''),
  }),
  intro: flattenStory(introSection.intro2 || introSection.intro1 || ''),
  setup: flattenStory(setupSection),
  specialRules: specialRulesText,
  theBomoh: Object.freeze({
    title: bomohSection.title || '幕间：降头师',
    intro: [bomohSection.theBomoh1Part1, bomohSection.sorcererOrClairvoyant, bomohSection.theBomoh1Part2]
      .map(flattenStory).filter(Boolean),
    rejoined: flattenStory(bomohSection.theBomoh2 || ''),
    missing: flattenStory(bomohSection.theBomoh3 || ''),
    aftermath: flattenStory(bomohSection.theBomoh4 || ''),
  }),
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  referenceCode: REFERENCE_CODE,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings,
  ...SCENARIO_TEXT,
})

export const identities = Object.freeze(identitiesFor(scenario))

// 需要单卡条目的卡号（灵怪 6 / 朱三娘 2 / 诡计 2 / 剧情 6 / 密钥 2，共 18）；
// 地点、幕、议程、剧本参考卡不建条目。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  ...GEIST_ENEMY_CODES, ...TZU_FACE_CODES, ...TREACHERY_CODES, ...STORY_CODES, ...KEY_CODES,
])
// 放一边 / 开局在场的别名（manifest zones；三对灵怪里的三张会在运行时进「移出游戏」）。
export const SET_ASIDE_CODES = Object.freeze([...GEIST_ENEMY_CODES])
export const IN_PLAY_CODES = Object.freeze([RAW_CODES.tzuSanNiang, RAW_CODES.shadeReaperStable])
// 福林特工状态与时间/结局记录。
export const RECORD_READS = Object.freeze([
  'flintTraveledToKualaLumpur', 'flintRejoinedTheCell', 'agentFlintIsMissing', 'agentFlintIsDead', 'time',
])
export const RECORD_WRITES = Object.freeze([
  'flintRejoinedTheCell', 'agentFlintIsMissing', 'agentFlintIsDead',
  'youHaventSeenTheLastOfTzuSanNiang', 'tzuSanNiangIsUnderYourSway', 'tzuSanNiangHasYouUnderHerSway',
  'shadeReaperBearer', 'time',
])
