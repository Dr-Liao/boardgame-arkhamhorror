// 《疯狂迷宫》（The Labyrinths of Lunacy · 70001）· 章节数据。
//
// 参考：Scenario/Scenarios/TheLabyrinthsOfLunacy.hs + Act/Agenda/Location/Enemy/Treachery/Story/CardDefs
// 与 frontend/src/locales/en/standalone/theLabyrinthsOfLunacy.json。
//
// 单桌等价（Single Group Mode）：三组各用一套 act 1/2 + 共用 act 3；共享
// in_the_labyrinths_of_lunacy 组，单桌组用 single_group 变体、剔除 epic_multiplayer 变体。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'theLabyrinthsOfLunacy'
export const REFERENCE_CODE = '70001'
export const GROUP_IDS = Object.freeze(['A', 'B', 'C'])

const card = code => {
  const data = ALL_CARDS[code]
  if (!data) throw new Error(`疯狂迷宫缺少卡面数据：${code}`)
  return data
}
export function printed(code) {
  const data = card(code)
  return {
    code, originalCode: code, name: data.nameZh || data.name, nameEn: data.name,
    text: data.textZh || data.text || '', traits: [...(data.traits || [])],
    flavor: data.flavorZh || data.flavor || '',
  }
}
export function location(id, code, connections, extra = {}) {
  const data = card(code)
  return {
    ...printed(code), id, shroud: data.shroud, cluesPerInvestigator: data.clues || 0,
    victory: data.victory || 0, connections, ...(data.backNameZh ? { unrevealedName: data.backNameZh } : {}), ...extra,
  }
}
export function stage(code, type, number, extra = {}) {
  const data = card(code)
  return {
    ...printed(code), id: `${type}${code}`, stage: `${number}a`,
    ...(type === 'agenda' ? { doomThreshold: data.doom || 3 } : {}),
    advanceText: data.backTextZh || data.backText || '',
    reveal: { type: 'campaignRule' }, ...extra,
  }
}

// ---------------------------------------------------------------------------
// 组 → act / 议程 / 初始地点 / 放一边
// ---------------------------------------------------------------------------
export const GROUP_TABLE = Object.freeze({
  A: Object.freeze({
    label: 'A 组', actCodes: ['70007', '70011', '70015'],
    initialLocations: ['chamberOfSecrets'], startLocations: { primary: 'chamberOfSecrets' },
    setAsideLocations: ['chamberOfDecay'], placeKeyAtSecrets: true,
  }),
  B: Object.freeze({
    label: 'B 组', actCodes: ['70008', '70012', '70015'],
    initialLocations: ['chamberOfRain', 'chamberOfSorrows'],
    startLocations: { primary: 'chamberOfRain', secondary: 'chamberOfSorrows', split: true },
    setAsideLocations: ['chamberOfRot', 'chamberOfPoison'], placeKeyAtSecrets: true,
  }),
  C: Object.freeze({
    label: 'C 组', actCodes: ['70010', '70013', '70015'],
    initialLocations: ['chamberOfNight', 'chamberOfRegret'],
    startLocations: { primary: 'chamberOfNight' },
    setAsideLocations: ['chamberOfHunger'], placeKeyAtSecrets: true,
  }),
})

export const ACT_CODES = GROUP_TABLE.A.actCodes
export const AGENDA_CODES = Object.freeze(['70003', '70005', '70006'])
export const ESCAPE_ACT_CODE = '70015'
export const ALL_ACT_CODES = Object.freeze(['70007', '70008', '70010', '70011', '70012', '70013', '70015'])
export const EPIC_ONLY_ACT_CODES = Object.freeze(['70009', '70014'])
export const EPIC_ONLY_AGENDA_CODES = Object.freeze(['70002', '70004'])

// ---------------------------------------------------------------------------
// 地点（印刷连接图标；参考 Location/CardDefs/TheLabyrinthsOfLunacy.hs）
// ---------------------------------------------------------------------------
const SYMBOL = Object.freeze({
  chamberOfSecrets: { symbol: 'Circle', links: ['Equals'] },
  chamberOfSecretsMysterious: { symbol: 'Circle', links: ['Equals'] },
  chamberOfSecretsEnshrouded: { symbol: 'Circle', links: ['Equals'] },
  chamberOfRain: { symbol: 'Hourglass', links: ['Heart'] },
  chamberOfSorrows: { symbol: 'Heart', links: ['Hourglass', 'Equals'] },
  chamberOfNight: { symbol: 'Square', links: ['Triangle', 'Equals'] },
  chamberOfRegret: { symbol: 'Triangle', links: ['Square'] },
  labyrinthineHalls1: { symbol: 'Equals', links: ['Circle', 'Square', 'Heart', 'Equals'] },
  labyrinthineHalls2: { symbol: 'Equals', links: ['Circle', 'Square', 'Heart', 'Equals'] },
  labyrinthineHalls3: { symbol: 'Equals', links: ['Circle', 'Square', 'Heart', 'Equals'] },
  chamberOfDecay: { symbol: 'Moon', links: ['Equals', 'T'] },
  chamberOfRot: { symbol: 'Diamond', links: ['Equals', 'Squiggle', 'T'] },
  chamberOfPoison: { symbol: 'Squiggle', links: ['Diamond'] },
  chamberOfHunger: { symbol: 'Star', links: ['Equals', 'T'] },
  abandonedWarehouse: { symbol: 'T', links: ['Diamond', 'Moon', 'Star'] },
})
const LOCATION_CODES = Object.freeze({
  chamberOfSecrets: '70016', chamberOfSecretsMysterious: '70017', chamberOfSecretsEnshrouded: '70018',
  chamberOfRain: '70019', chamberOfSorrows: '70021', chamberOfNight: '70023', chamberOfRegret: '70024',
  labyrinthineHalls1: '70025', labyrinthineHalls2: '70026', labyrinthineHalls3: '70027',
  chamberOfDecay: '70029', chamberOfRot: '70030', chamberOfPoison: '70031', chamberOfHunger: '70028',
  abandonedWarehouse: '70032',
})
const idsOfSymbol = symbol => Object.keys(SYMBOL).filter(id => SYMBOL[id].symbol === symbol)
function connectionsFor(id) {
  const links = new Set()
  for (const linkedSymbol of SYMBOL[id].links) {
    for (const other of idsOfSymbol(linkedSymbol)) if (other !== id) links.add(other)
  }
  for (const other of Object.keys(SYMBOL)) {
    if (other !== id && SYMBOL[other].links.includes(SYMBOL[id].symbol)) links.add(other)
  }
  return [...links]
}
export const LOCATIONS = Object.fromEntries(
  Object.entries(LOCATION_CODES).map(([id, code]) => [id, location(id, code, connectionsFor(id))]),
)
export const SECRETS_VARIANTS = Object.freeze(['chamberOfSecrets', 'chamberOfSecretsMysterious', 'chamberOfSecretsEnshrouded'])
export const HALL_IDS = Object.freeze(['labyrinthineHalls1', 'labyrinthineHalls2', 'labyrinthineHalls3'])
export const START_LOCATION = 'chamberOfSecrets'

// ---------------------------------------------------------------------------
// 幕 / 密谋
// ---------------------------------------------------------------------------
export const ACTS = Object.freeze(ACT_CODES.map((code, index) => stage(code, 'act', index + 1)))
export const AGENDAS = Object.freeze(AGENDA_CODES.map((code, index) => stage(code, 'agenda', index + 1)))
export const STAGE_CARDS = {}
for (const code of [...ALL_ACT_CODES, ...AGENDA_CODES, ...EPIC_ONLY_ACT_CODES, ...EPIC_ONLY_AGENDA_CODES]) {
  const isAct = ALL_ACT_CODES.includes(code) || EPIC_ONLY_ACT_CODES.includes(code)
  const number = isAct ? ALL_ACT_CODES.indexOf(code) + 1 : AGENDA_CODES.indexOf(code) + 1
  STAGE_CARDS[code] = stage(code, isAct ? 'act' : 'agenda', number)
}

// ---------------------------------------------------------------------------
// 敌人 / 诡计（数据驱动；规则读点在 encounter-entries/theLabyrinthsOfLunacy/）
// ---------------------------------------------------------------------------
const enemyDefinition = code => {
  const data = card(code)
  return {
    ...printed(code), rulesPending: true,
    fight: data.fight, evade: data.evade, health: data.health,
    ...(data.healthPerInvestigator ? { healthPerInvestigator: data.health } : {}),
    damage: data.damage ?? 0, horror: data.horror ?? 0,
    hunter: /Hunter\./.test(data.text || ''), retaliate: /Retaliate\./.test(data.text || ''),
    aloof: /Aloof[. ]/.test(data.text || ''), massive: /Massive\./.test(data.text || ''),
    elite: (data.traits || []).includes('Elite'), victory: data.victory || 0,
  }
}
const treacheryDefinition = code => ({ ...printed(code), rulesPending: true, effect: { kind: 'campaignRule' } })
export const ENEMY_CODES = Object.freeze(['70048', '70050', '70052', '70053', '70054'])
export const TREACHERY_CODES = Object.freeze(['70055', '70056', '70057', '70058', '70060', '70061'])
export const enemies = Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)]))
export const treacheries = Object.fromEntries(TREACHERY_CODES.map(code => [code, treacheryDefinition(code)]))

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边 / 剧情资产
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze(['in_the_labyrinths_of_lunacy', 'single_group'])
const deckCounts = Object.freeze({
  70053: 3, 70054: 3, 70055: 3, 70056: 3, 70057: 3, 70058: 3, 70060: 3, 70061: 3,
})
export const ENCOUNTER_DECK = Object.freeze(Object.entries(deckCounts)
  .flatMap(([code, count]) => Array(count).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])
export const SET_ASIDE_ALIASES = Object.freeze([
  '70039', '70040', '70041', '70043', '70045', '70047', '70048', '70050', '70052', '70052',
])
export const STORY_ASSET_CODES = Object.freeze(['70039', '70040', '70041', '70043', '70045', '70047'])
export const STORY_ASSETS = Object.fromEntries(STORY_ASSET_CODES.map(code => [code, printed(code)]))
export const STORY_CARD_CODES = Object.freeze(['70033', '70034', '70035', '70036', '70037', '70038'])

// ---------------------------------------------------------------------------
// 混乱标记含义（参考 .hs getChaosTokenValue 与官方指南 tokens 段）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ delta: -1, text: '-1。揭示另一个标记。' }),
    cultist: Object.freeze({ delta: -3, text: '-3。若失败，将你的 1 个线索放在你所在地点。' }),
    tablet: Object.freeze({ delta: -4, text: '-4。若失败，失去 2 资源。' }),
    elderthing: Object.freeze({ delta: -4, text: '-4。若失败，随机弃掉手牌中的一张卡牌。' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ delta: -1, text: '-1。揭示另一个标记。若失败，选择受到 1 点伤害或 1 点恐惧。' }),
    cultist: Object.freeze({ delta: -3, text: '-3。将你的 1 个线索放在你所在地点。' }),
    tablet: Object.freeze({ delta: -4, text: '-4。失去 2 资源。' }),
    elderthing: Object.freeze({ delta: -4, text: '-4。随机弃掉手牌中的一张卡牌。' }),
  }),
})
export const GROUP_CHAOS_TOKEN = Object.freeze({ A: 'elderthing', B: 'tablet', C: 'cultist' })

// ---------------------------------------------------------------------------
// 剧情文本 / 结局（官方英文指南的精简中译；供设置面板与指南生成）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'translated',
  intro: Object.freeze({
    title: '疯狂迷宫',
    chooseGroupSingle: '单桌模式下，你们可以扮演 A、B 或 C 组中的任意一组。请按所选组的设置指示进行布置。哪一组被困在迷宫的这部分？',
    groupA: '你在一个陌生的地方醒来，完全不记得自己是怎么到这里的。你被密封在一间没有窗户的密室里，四周是铜制管道。地上留着一张便笺。',
    groupB: '你被密封在一个高大的玻璃水箱里，水漫过脚踝；玻璃外还有更多同样的水箱，笼罩在雾气中。水箱外的地上留着一张便笺。',
    groupC: '你身处一间昏暗的房间，只有几根蜡烛照明，堆满旧木桶、板条箱与腐朽的货架。地上留着一张便笺。',
    note: '便笺上写着：“你们好。我把你们聚在这里做一场实验。你们会活下来，或者会死去。你们并不孤单，另外两组与你们同命运。”',
  }),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集《疯狂迷宫》遭遇组；单桌模式再收集 Single Group 组（single_group），并把 Epic Multiplayer 组从游戏中移除。' },
    { key: 'actDeck', text: '只用所选组的幕 1 与幕 2 版本组建幕牌库；三组共用幕 3「逃出生天」。' },
    { key: 'placeInitial', text: 'A 组：随机选择 1 张密室放入场并在该地点放置奥秘之钥；B 组：放置雨之密室与悲哀密室并分开调查员；C 组：放置夜之密室与悔恨密室，所有调查员从夜之密室开始，并随机把 1 张密室压在剧本参考卡下方。' },
    { key: 'setAside', text: '把奥秘之钥、神秘注射器、艾克索多隆、艾克索多隆的宠物、三张图样、2 张无面掳掠者及其余地点放在一边。' },
    { key: 'note', text: '队长控制艾克索多隆的便笺。' },
    { key: 'addTokens', text: '把 2 枚本组的混乱标记加入混乱袋（A 组：古神；B 组：石板；C 组：邪教徒）。' },
  ]),
  specialRules: Object.freeze([
    '混乱标记：skull -1 并额外揭示 1 个标记（困难/专家失败时选择 1 伤害或 1 恐惧）；cultist -3 / tablet -4 / elderthing -4，简单/普通失败后结算，困难/专家揭示时结算。',
    '幕 1 收到指示前不能推进；幕 1 背面结算「幕 2 设置」，幕 2 背面结算「幕 3 设置」。',
    '幕 2 设置：洗入无面掳掠者与遭遇弃牌堆；放置 3 张迷宫走廊与各组对应密室；移除场上毁灭标记。',
    '幕 3 设置：放置废弃仓库，幸存调查员移动到仓库，生成艾克索多隆，移除毁灭标记。',
    '密谋 1/2：轮末若密谋上有毁灭且尚无组触发，A 组队长随机选择 1 张场景剧情卡并抽取，其他组抽取同一张。',
    '结局按逃出迷宫的组数决定：0→结局1、1→结局2、2→结局3、3→结局4。',
  ]),
  resolutions: Object.freeze({
    noResolution: '没有达成任何结局（每位调查员均被击败）：进入结局 1。',
    resolution1: '结局 1：你们的痛苦成为主人的武器，仪式完成，世界将感受到这份恐惧与绝望。调查员失败。',
    resolution2: '结局 2：主谋倒下，你们砸开仓库铁门逃到米斯卡塔尼克河畔。你们活了下来，但在另一条时间线里，迷宫又迎来了新的客人。',
    resolution3: '结局 3：你们逃出了迷宫，但主谋临死前的话仍在耳边回响——他无处不在、无时不在，艾克索多隆仍活着。',
    resolution4: '结局 4：仪式失败。三组同时推开沉重的铁门，在河畔看着夕阳落下。调查员获胜！',
  }),
  resolutionBranches: Object.freeze({
    resolution1: '记录本组覆灭（theGroupPerished）；单桌模式下支线失败。',
    resolution2: '记录本组逃出迷宫（escapedGroups + groupXOutcome=escaped）；获得胜利区经验。',
    resolution3: '记录本组逃出迷宫（escapedGroups + groupXOutcome=escaped），但艾克索多隆仍活着。',
    resolution4: '记录三组全部逃出迷宫（escapedGroups 含 A/B/C）；获得胜利区经验。',
  }),
})

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '疯狂迷宫',
  nameEn: 'The Labyrinths of Lunacy',
  intro: SCENARIO_TEXT.intro.chooseGroupSingle,
  setup: '收集《疯狂迷宫》与单桌组遭遇卡；按所选组组建幕牌库并布置初始密室；把其余地点、剧情资产与敌人放在一边；加入 2 枚本组混乱标记。',
  setupNote: '单桌模式下按所选 A/B/C 组的布置步骤：A 组随机密室+奥秘之钥，B 组雨之密室与悲哀密室分坐，C 组夜之密室+暗置密室；三组共用幕 3。',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: Object.freeze([
    'labyrinthineHalls1', 'labyrinthineHalls2', 'labyrinthineHalls3', 'abandonedWarehouse',
    'chamberOfDecay', 'chamberOfRot', 'chamberOfPoison', 'chamberOfHunger',
    'chamberOfSecretsMysterious', 'chamberOfSecretsEnshrouded',
  ]),
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  enemies,
  treacheries,
  storyAssets: STORY_ASSETS,
  storyCards: Object.fromEntries(STORY_CARD_CODES.map(code => [code, printed(code)])),
  encounterDeck: ENCOUNTER_DECK,
  setAsideAliases: SET_ASIDE_ALIASES,
  resolutions: SCENARIO_TEXT.resolutions,
  resolutionBranches: SCENARIO_TEXT.resolutionBranches,
  tokens: TOKEN_MEANINGS,
  tokenMeanings: Object.freeze({
    standard: 'skull -1 并额外揭示 1 个；cultist -3 / tablet -4 / elderthing -4（失败后结算）。',
    hard: 'skull -1 并额外揭示 1 个；cultist/tablet/elderthing 的失败效果改为失败前立即结算。',
  }),
  groups: GROUP_TABLE,
  mechanics: Object.freeze({}),
}

const identitiesByCategory = { scenario: { [scenario.id]: { originalCode: scenario.originalCode } } }
for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
  identitiesByCategory[category] = Object.fromEntries(Object.values(scenario[category] || {})
    .map(item => [item.id || item.code, { originalCode: item.originalCode }]))
}
export const identities = identitiesByCategory
bindScenarioIdentities(scenario, identities)

export const SCENARIO_ID = CHAPTER_ID
export default scenario
