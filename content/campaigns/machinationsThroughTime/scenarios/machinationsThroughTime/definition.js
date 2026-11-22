// 《时间阴谋》（Machinations Through Time · 87001）· 章节数据。
//
// 参考：Scenario/Scenarios/MachinationsThroughTime.hs + Act/Agenda/Location/Enemy/Treachery/Story/CardDefs
// （含 Enemy/CardDefs/MachinationsThroughTimeEpicMultiplayer.hs）与官方英文指南。
//
// 单桌等价（Single Group Mode）：使用 87005a Tindalos 与 87036a/87036b 艾德温·贝内特；
// epic multiplayer 变体 87005b/87037a/87037b 保留定义但不进入单桌布置。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'machinationsThroughTime'
export const REFERENCE_CODE = '87001'
export const ERAS = Object.freeze(['past', 'present', 'future'])

const card = code => {
  const data = ALL_CARDS[code]
  if (!data) throw new Error(`时间阴谋缺少卡面数据：${code}`)
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
export function location(id, code, symbol, era, links, extra = {}) {
  const data = card(code)
  return {
    ...printed(code), id, era, symbol, shroud: data.shroud, cluesPerInvestigator: data.clues || 0,
    victory: data.victory || 0, connections: [], ...extra,
  }
}
export function stage(code, type, number, extra = {}) {
  const data = card(code)
  return {
    ...printed(code), id: `${type}${code}`, stage: `${number}a`,
    ...(type === 'agenda' ? { doomThreshold: data.doom || 9 } : {}),
    advanceText: data.backTextZh || data.backText || '',
    reveal: { type: 'campaignRule' }, ...extra,
  }
}
const asset = code => ({ ...printed(code), health: card(code).health ?? null, isStoryAsset: true })

// ---------------------------------------------------------------------------
// 地点（印刷图标连接：three-era 地图，参考 .hs setup 的 setLayout 与 Location CardDefs）
// ---------------------------------------------------------------------------
const SYMBOL = Object.freeze({
  arkhamGazette: { symbol: 'Star', links: ['Hourglass'], era: 'past' },
  oMalleysWatchShop: { symbol: 'Hourglass', links: ['Star', 'Triangle'], era: 'past' },
  riverDocksPast: { symbol: 'Hourglass', links: ['Star', 'Triangle'], era: 'past' },
  miskatonicUniversityPast: { symbol: 'Triangle', links: ['Hourglass', 'Heart'], era: 'past' },
  childhoodHome: { symbol: 'Heart', links: ['Triangle'], era: 'past' },
  arkhamAdvertiserPresent: { symbol: 'Equals', links: ['Trefoil'], era: 'present' },
  tickTockClubPresent: { symbol: 'Trefoil', links: ['Equals', 'Circle'], era: 'present' },
  riverDocksPresent: { symbol: 'Trefoil', links: ['Equals', 'Circle'], era: 'present' },
  miskatonicUniversityPresent: { symbol: 'Circle', links: ['Trefoil', 'Moon'], era: 'present' },
  yeOldeMagickShoppe: { symbol: 'Moon', links: ['Circle'], era: 'present' },
  arkhamAdvertiserFuture: { symbol: 'Plus', links: ['Spade'], era: 'future' },
  tickTockClubFuture: { symbol: 'Spade', links: ['Plus', 'Diamond'], era: 'future' },
  riverDocksFuture: { symbol: 'Spade', links: ['Plus', 'Diamond'], era: 'future' },
  miskatonicUniversityFuture: { symbol: 'Diamond', links: ['Spade', 'Squiggle'], era: 'future' },
  corriganIndustries: { symbol: 'Squiggle', links: ['Diamond'], era: 'future' },
  tindalos: { symbol: 'NoSymbol', links: [], era: 'all' },
})
const LOCATION_CODES = Object.freeze({
  tindalos: '87005a',
  arkhamGazette: '87007', oMalleysWatchShop: '87008', riverDocksPast: '87009',
  miskatonicUniversityPast: '87010', childhoodHome: '87011',
  arkhamAdvertiserPresent: '87016', tickTockClubPresent: '87017', riverDocksPresent: '87018',
  miskatonicUniversityPresent: '87019', yeOldeMagickShoppe: '87020',
  arkhamAdvertiserFuture: '87025', tickTockClubFuture: '87026', riverDocksFuture: '87027',
  miskatonicUniversityFuture: '87028', corriganIndustries: '87029',
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
export const LOCATION_IDS = Object.freeze(Object.keys(LOCATION_CODES))
export const LOCATIONS = Object.fromEntries(Object.entries(LOCATION_CODES).map(([id, code]) => [id,
  location(id, code, SYMBOL[id].symbol, SYMBOL[id].era, connectionsFor(id))]))
// 参考 .hs：corriganIndustries 初始放在一边（A Noble Legacy (Present) 的成立科里根工业才入场）。
export const START_LOCATION = 'tindalos'
export const SET_ASIDE_LOCATION_IDS = Object.freeze(['corriganIndustries'])
export const ERA_LOCATIONS = Object.freeze(Object.fromEntries(ERAS.map(era => [era,
  LOCATION_IDS.filter(id => SYMBOL[id].era === era)])))

// ---------------------------------------------------------------------------
// 幕 / 密谋
// ---------------------------------------------------------------------------
export const ACT_CODES = Object.freeze(['87004'])
export const AGENDA_CODES = Object.freeze(['87002', '87003'])
export const ACTS = Object.freeze(ACT_CODES.map((code, index) => stage(code, 'act', index + 1)))
export const AGENDAS = Object.freeze(AGENDA_CODES.map((code, index) => stage(code, 'agenda', index + 1)))
const STAGE_CARDS = Object.fromEntries([
  ...ACT_CODES.map((code, index) => [code, stage(code, 'act', index + 1)]),
  ...AGENDA_CODES.map((code, index) => [code, stage(code, 'agenda', index + 1)]),
])
export { STAGE_CARDS }

// ---------------------------------------------------------------------------
// 敌人 / 诡计 / 剧情卡 / 剧情资产
// ---------------------------------------------------------------------------
const enemyDefinition = code => {
  const data = card(code)
  const text = data.textZh || data.text || ''
  return {
    ...printed(code), rulesPending: true,
    fight: data.fight, evade: data.evade, health: data.health,
    ...(String(data.health) === '-3' ? { healthPerInvestigator: true } : {}),
    damage: data.damage ?? 0, horror: data.horror ?? 0,
    hunter: /猎手|Hunter/.test(text), retaliate: /反击|Retaliate/.test(text),
    aloof: /潜行|Aloof/.test(text), massive: /巨大|Massive/.test(text),
    surge: /涌动|Surge/.test(text), patrol: /巡逻|Patrol/.test(text),
    alert: /警戒|Alert/.test(text), elite: (data.traits || []).includes('Elite'),
    victory: data.victory || 0, doubleSided: code === '87036a', otherSide: code === '87036a' ? '87036b' : null,
  }
}
const treacheryDefinition = code => ({ ...printed(code), rulesPending: true, effect: { kind: 'campaignRule' } })
export const ENEMY_CODES = Object.freeze(['87036a', '87040', '87041', '87043', '87044', '87045', '87046', '87047'])
export const EPIC_ENEMY_CODES = Object.freeze(['87037a'])
export const TREACHERY_CODES = Object.freeze(['87048', '87049', '87050', '87051', '87052', '87053', '87054', '87055', '87056', '87057'])
export const enemies = Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)]))
export const epicEnemies = Object.fromEntries(EPIC_ENEMY_CODES.map(code => [code, enemyDefinition(code)]))
export const treacheries = Object.fromEntries(TREACHERY_CODES.map(code => [code, treacheryDefinition(code)]))

export const ASSET_CODES = Object.freeze([
  '87012', '87013', '87014', '87021', '87022', '87023',
  '87030', '87031', '87032', '87036b',
])
export const assetCards = Object.fromEntries(ASSET_CODES.map(code => [code, asset(code)]))

// 剧情卡：3 张 A Noble Legacy + 3 张 Machination + 3 张 Plot（正反面各一张，b 为背面）。
// 条目对象不做 freeze（身份绑定会写入 originalCode）。
export const STORY_CARDS = {
  nobleLegacyPast: { code: '87006', backCode: '87006b', era: 'past', role: 'nobleLegacy' },
  nobleLegacyPresent: { code: '87015', backCode: '87015b', era: 'present', role: 'nobleLegacy' },
  nobleLegacyFuture: { code: '87024', backCode: '87024b', era: 'future', role: 'nobleLegacy' },
  aBitterRivalry: { code: '87033', backCode: '87033b', role: 'machination' },
  redeemAFormerColleague: { code: '87034', backCode: '87034b', role: 'machination' },
  uneasyAlliance: { code: '87035', backCode: '87035b', role: 'machination' },
  anomaliesInSpacetime: { code: '87038', backCode: '87038b', role: 'plot' },
  mobTroubles: { code: '87039', backCode: '87039b', role: 'plot' },
  unspeakableAbomination: { code: '87042', backCode: '87042b', role: 'plot' },
}
export const MACHINATION_CODES = Object.freeze(['87033', '87034', '87035'])
export const PLOT_CODES = Object.freeze(['87038', '87039', '87042'])
export const NOBLE_LEGACY_CODES = Object.freeze(['87006', '87015', '87024'])
export const SET_ASIDE_ALIASES = Object.freeze([
  '87036a', '87036b', '87040', '87041', '87041', '87041', '87043',
])

// ---------------------------------------------------------------------------
// 遭遇牌库：24 张诡计 + 9 张普通敌人 = 33（与官方「剩余 33 张」一致）；
// 3 张 Machination/Plot 敌人（老萨迪/帮派/提尔斯哈）与艾德温放在一边。
// ---------------------------------------------------------------------------
const encounterCount = code => card(code).quantity || 1
export const ENCOUNTER_DECK = Object.freeze([
  ...TREACHERY_CODES.flatMap(code => Array(encounterCount(code)).fill(code)),
  ...['87044', '87045', '87046', '87047'].flatMap(code => Array(encounterCount(code)).fill(code)),
])
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])
export const PLOT_ENEMY_CODES = Object.freeze({ mobTroubles: ['87040', '87041', '87041', '87041'], unspeakableAbomination: ['87043'], anomaliesInSpacetime: [] })

// ---------------------------------------------------------------------------
// 混乱标记（参考 .hs getChaosTokenValue；动态 X 在 behavior 里附加读点）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ delta: -1, text: '-X，X=1+胜利区剧情卡数量。' }),
    cultist: Object.freeze({ delta: -1, text: '-1。若你在廷达洛斯，自动失败。' }),
    tablet: Object.freeze({ delta: -2, text: '-2（若你所在地点有科学家支援则 -4）。' }),
    elderthing: Object.freeze({ delta: -3, text: '-3。若失败，对你所在地点的一张盟友支援造成 1 伤害或 1 恐惧。' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ delta: -1, text: '-X，X=1+胜利区剧情卡数量。' }),
    cultist: Object.freeze({ delta: -1, text: '-1。若你在廷达洛斯，自动失败。' }),
    tablet: Object.freeze({ delta: -2, text: '-2（若你所在地点有科学家支援则 -4）。' }),
    elderthing: Object.freeze({ delta: -3, text: '-3。若失败，对你所在地点的一张盟友支援造成 1 伤害或 1 恐惧。' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ delta: -2, text: '-X，X=2+胜利区剧情卡数量。' }),
    cultist: Object.freeze({ delta: -2, text: '-2。若你在廷达洛斯，自动失败。' }),
    tablet: Object.freeze({ delta: -3, text: '-3（若你所在地点有科学家支援则 -6）。' }),
    elderthing: Object.freeze({ delta: -4, text: '-4。若失败，对你所在地点的一张盟友支援造成 1 伤害或 1 恐惧。' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ delta: -2, text: '-X，X=2+胜利区剧情卡数量。' }),
    cultist: Object.freeze({ delta: -2, text: '-2。若你在廷达洛斯，自动失败。' }),
    tablet: Object.freeze({ delta: -3, text: '-3（若你所在地点有科学家支援则 -6）。' }),
    elderthing: Object.freeze({ delta: -4, text: '-4。若失败，对你所在地点的一张盟友支援造成 1 伤害或 1 恐惧。' }),
  }),
})

// ---------------------------------------------------------------------------
// 剧情文本 / 结局（官方英文指南的精简中译）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'translated',
  intro: {
    title: '时间阴谋',
    body: '报纸头条写着「本地科学家荣获诺贝尔奖！」配图是两位年迈的物理学家站在巨大的望远镜前。你瞥见报纸日期——1956 年 12 月 5 日。这怎么可能？你读到托马斯·科里根与玛丽·杰林斯基的故事：他们多年研究屡获成功，1955 年发表传送术研究，三十年后获得诺贝尔物理学奖。可当你前往米斯卡塔尼克大学拜访时，却被告知他们从未在此任职，并在多年前离奇失踪。\n世界悄然改变：著名科学家凭空消失，伟大发明不复存在，历史性发现被抹去。阿尔卡姆各处裂开传送门，门后是廷达洛斯——无数悬空的棱角路径。你必须在过去、现在与未来三个时代修复时间线。',
  },
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集《时间阴谋》与 Single Group Mode 遭遇组（单桌模式使用）。' },
    { key: 'corriganIndustries', text: '把科里根工业地点放在一边（场外）。' },
    { key: 'placeLocations', text: '使用 Single Group Mode 面放置廷达洛斯；再按其地点布置图把其余 14 个地点（过去/现在/未来三列）放入场。' },
    { key: 'startAt', text: '每位调查员从廷达洛斯开始游戏。' },
    { key: 'nobleLegacy', text: '把「伟大遗产（过去/现在/未来）」三张剧情卡依次放入场并结算各自的设置文本（过去放置尼古拉·特斯拉于过去河滨码头；现在放置埃兹拉·格雷夫斯于现在的阿卡姆广告报；未来把维度光束机器放在一边）。' },
    { key: 'machination', text: '从三张 Machination 剧情卡中随机选 1 张放入场并结算设置，其余 2 张移出游戏。' },
    { key: 'plot', text: '从三张 Plot 剧情卡中随机选 1 张放入场并结算设置，其余 2 张移出游戏。' },
    { key: 'doom', text: '在密谋 1a 上放置 1[per_investigator] 个毁灭标记；简单难度移除 1 个，困难加 1 个，专家加 2 个。' },
    { key: 'shuffleRemainder', text: '把剩余的 33 张遭遇卡洗成遭遇牌库，开始游戏。' },
  ]),
  specialRules: Object.freeze([
    '混乱标记：skull 为 -X（X=1+胜利区剧情卡数，困难/专家为 2+）；cultist 在廷达洛斯自动失败；tablet 对你所在地点有科学家支援时加重；elderthing 失败时对同地点一张盟友支援造成 1 伤害或 1 恐惧。',
    '强制（密谋 1/2）：一张科学家支援将要被击败时，改为把它绑架（放在一边，场外）。',
    '密谋 1 背面：按当前 Plot 剧情卡分别生成老萨迪·谢尔顿/谢尔顿帮、提尔斯哈或翻面处理。',
    '幕「穿行时光」：任何调查员均可触发其所在地点科学家支援上的能力；移动时可带走同地点任意数量的科学家支援。目标：三个时代中托马斯·科里根与玛丽·杰林斯基都位于非廷达洛斯地点，且每个时代都没有剧情卡位于场上，推进。',
    '密谋 2 背面：每个时代每位剩余调查员被击败并受 1 点精神创伤；若艾德温·贝内特支援在任意时代场上 → 结局 2；若艾德温·贝内特敌人在任意时代场上 → 结局 3；否则 → 结局 4。',
    '故事链（A Noble Legacy）：按过去→现在→未来的顺序完成各时代剧情卡上的能力，把每个能力标记为「已触发」；三张剧情卡全部完成时加入胜利区。',
    '三部 Machination 各自给出不同的艾德温·贝内特（支援/敌人）与科学家起点；三部 Plot 各自给出不同的敌人/异常开局与额外规则。',
  ]),
  resolutions: Object.freeze({
    noResolution: '没有结局：无数廷达洛斯猎犬从时空裂隙中涌出，剩余的每位调查员被击败并受 1 点精神创伤，然后按艾德温·贝内特的形态进入结局 2/3/4。',
    resolution1: '结局 1：科里根与杰林斯基的研究帮助你们封印了阿尔卡姆所有通往廷达洛斯的传送门，艾德温·贝内特的阴谋不再威胁世界。你们把报纸放上传送平台，闭合时间循环。玩家获得胜利区每张卡 Victory X 的经验；场上的尼古拉·特斯拉/埃兹拉·格雷夫斯/维度光束机器可供任一调查员加入牌库（不计牌库张数）。',
    resolution2: '结局 2：你们侥幸从怪兽爪下逃脱，但时间线仍破碎。你们选择相信艾德温·贝内特来修复一切——他有能力，但他有操守吗？获得胜利区经验与奖励资产。',
    resolution3: '结局 3：你们昏厥醒来，发现自己被埋在延达洛斯恶臭的土壤中，成为这里的永久居民；科里根与杰林斯基也一同被囚禁，艾德温的阴谋继续在时空中蔓延。每位幸存调查员被逼疯。',
    resolution4: '结局 4：你们逃脱了，但时间线无法修复，人类蒙受巨大损失；唯一的好消息是艾德温·贝内特不知所踪。获得胜利区经验与奖励资产。',
  }),
  resolutionBranches: Object.freeze({
    noResolution: '按场上艾德温·贝内特形态改判：支援→结局2；敌人→结局3；都没有→结局4。',
    resolution1: '胜利：奖励资产（尼古拉·特斯拉/埃兹拉·格雷夫斯/维度光束机器）+ 胜利区经验。',
    resolution2: '艾德温支援线：奖励资产 + 胜利区经验。',
    resolution3: '艾德温敌人线：无经验，幸存调查员被逼疯。',
    resolution4: '无艾德温：奖励资产 + 胜利区经验。',
  }),
  storyNotes: Object.freeze({
    nobleLegacyChain: '伟大遗产链：过去（相识/受特斯拉启发/天文台筹建）→ 现在（天文台建成/传送研究/科里根工业成立）→ 未来（历史性发现/诺贝尔奖）。',
    machinationBitter: '苦涩的竞争：玛丽·杰林斯基在过去阿卡姆公报，托马斯·科里根被绑架；艾德温·贝内特（敌人）放在一边；目标是在艾德温身上放 3 个目标并把他带到廷达洛斯。',
    machinationRedeem: '救赎旧日同事：托马斯·科里根在过去童年之家，玛丽被绑架；艾德温敌人生成在现在的米斯卡塔尼克大学；通过谈判在他身上放 3 个救赎。',
    machinationAlliance: '不安的联盟：过去科里根在童年之家、玛丽在奥马利钟表店，艾德温支援在阿卡姆公报带 12 个线索（移除 3[per_investigator]）；现在/未来科学家被绑架。',
    plotAnomalies: '时空异常：每个米斯卡塔尼克大学地点放置 1[per_investigator] 点恐惧作为异常；提尔斯哈、老萨迪与谢尔顿帮移出游戏；清除全部异常且密谋为 2a 时完成。',
    plotMob: '黑帮麻烦：老萨迪与 3 名谢尔顿帮放在一边；提尔斯哈移出游戏；现在时代调查员各获 2 资源；把 3 名谢尔顿帮加入胜利区时完成。',
    plotAbomination: '不可名状的怪物：提尔斯哈放在一边；老萨迪与谢尔顿帮移出游戏；击败提尔斯哈时完成。',
  }),
})

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '时间阴谋',
  nameEn: 'Machinations Through Time',
  intro: SCENARIO_TEXT.intro.body,
  setup: '收集《时间阴谋》与 Single Group Mode 遭遇组；放置廷达洛斯与过去/现在/未来三列共 14 个地点；三张伟大遗产依次入场；随机选 1 张 Machination 与 1 张 Plot 剧情卡；按难度在密谋 1a 放毁灭标记；剩余 33 张遭遇卡洗成牌库。',
  setupNote: '单桌模式使用 87005a 廷达洛斯与 87036a/87036b 艾德温·贝内特；三时代地图同一桌面展开。',
  startLocation: START_LOCATION,
  eras: ERAS,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  enemies,
  epicEnemies,
  treacheries,
  assets: assetCards,
  storyCards: STORY_CARDS,
  nobleLegacy: NOBLE_LEGACY_CODES.map(code => printed(code)),
  machinations: MACHINATION_CODES.map(code => printed(code)),
  plots: PLOT_CODES.map(code => printed(code)),
  encounterDeck: ENCOUNTER_DECK,
  setAsideAliases: SET_ASIDE_ALIASES,
  resolutions: SCENARIO_TEXT.resolutions,
  resolutionBranches: SCENARIO_TEXT.resolutionBranches,
  tokens: TOKEN_MEANINGS,
  tokenMeanings: Object.freeze({
    easy: 'skull -X（1+胜利区剧情卡数）；cultist 在廷达洛斯自动失败；tablet 同地点有科学家支援时加重；elderthing 失败伤害/恐惧盟友。',
    standard: 'skull -X（1+胜利区剧情卡数）；cultist 在廷达洛斯自动失败；tablet 同地点有科学家支援时加重；elderthing 失败伤害/恐惧盟友。',
    hard: 'skull -X（2+胜利区剧情卡数）；cultist 在廷达洛斯自动失败；tablet 同地点有科学家支援时加重；elderthing 失败伤害/恐惧盟友。',
    expert: 'skull -X（2+胜利区剧情卡数）；cultist 在廷达洛斯自动失败；tablet 同地点有科学家支援时加重；elderthing 失败伤害/恐惧盟友。',
  }),
  mechanics: Object.freeze({}),
}

const identitiesByCategory = { scenario: { [scenario.id]: { originalCode: scenario.originalCode } } }
for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'assets']) {
  const value = scenario[category] || {}
  identitiesByCategory[category] = Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [item.id || item.code || key, { originalCode: item.originalCode || item.code }]))
}
for (const [ruleId, story] of Object.entries(STORY_CARDS)) {
  identitiesByCategory.storyCards = { ...(identitiesByCategory.storyCards || {}), [ruleId]: { originalCode: story.code } }
}
export const identities = identitiesByCategory
bindScenarioIdentities(scenario, identities)

export const SCENARIO_ID = CHAPTER_ID
export default scenario
