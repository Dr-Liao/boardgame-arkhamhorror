// 深渊守卫 · 第一章《永恒沉睡》（The Eternal Slumber · 83001）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/GuardiansOfTheAbyss/TheEternalSlumber.hs（Setup / 混乱标记 / 三个结局）
//   Act|Agenda|Location|Enemy|Treachery|Story/CardDefs/GuardiansOfTheAbyss/*.hs
//   frontend/src/locales/en/standalone/{guardiansOfTheAbyss,theEternalSlumber}.json（指南英文底本）
//
// 本章特有口径（详见 behavior.js 文件头）：
//   1. 深渊之力 = scenarioFlags.guardians.strength，开局等于调查员人数（参考 Setup 的 ScenarioCountSet）。
//   2. 兄弟会 6 名双面敌人洗混后置于剧本参考卡下方；被击败/谈判后翻面为「证据」故事卡进入胜利区。
//   3. 幕 1 目标 = 胜利区 6 张证据；幕 1 背面构建探索牌库（7 张探险地点 + 5 张诡计）。
//   4. 幕 2 目标 = 7 张探险地点全部入场；幕 2 背面放沉梦者并生成奈斯。
//   5. 幕 3 目标 = 奈斯被击败；幕 3 背面二选一（消灭/饶恕）→ 结局 1 / 结局 2。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  BROTHERHOOD_ENEMY_CODES, BROTHERHOOD_PAIRS, BROTHERHOOD_STORY_BY_ENEMY, BROTHERHOOD_STORY_CODES,
  DREAMER_LOCATIONS, bindIdentities, connectionsFromSymbols, encounterDefinitions, location,
  printed, stage,
} from '../../shared.js'

// 兄弟会双面卡映射直接透传给章节装配与测试（单一来源在 shared.js）。
export {
  BROTHERHOOD_ENEMY_CODES, BROTHERHOOD_PAIRS, BROTHERHOOD_STORY_BY_ENEMY, BROTHERHOOD_STORY_CODES,
} from '../../shared.js'

export const CHAPTER_ID = 'theEternalSlumber'
export const REFERENCE_CODE = '83001'
export const ENCOUNTER_CODE = 'the_eternal_slumber'
export const START_LOCATION = 'streetsOfCairo'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT1_CODE = '83005' // Curse of Endless Sleep
export const ACT2_CODE = '83006' // Secrets in the Sand
export const ACT3_CODE = '83007' // The Hour of Judgment
export const ACT_CODES = Object.freeze([ACT1_CODE, ACT2_CODE, ACT3_CODE])
export const AGENDA1_CODE = '83002' // Jessie's Request
export const AGENDA2_CODE = '83003' // Curse of the Abyss
export const AGENDA3_CODE = '83004' // Garden of Shadows
export const AGENDA_CODES = Object.freeze([AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

export const NEITH_CODE = '83013'
export const HUMBLE_SUPPLICANT_CODE = '83014'
export const CREATURE_CODE = '83015'
export const ABYSSAL_REVENANT_CODE = '83045'
export const THING_IN_SARCOPHAGUS_CODE = '83046'
export const JOHN_AND_JESSIE_CODE = '83055'
export const ANCIENT_ANKH_CODE = '83056'

export const EXPEDITION_LOCATION_IDS = Object.freeze([
  'nileRiver', 'sandsOfDashur', 'dunesOfTheSahara', 'untouchedVault', 'facelessSphinx', 'desertOasis', 'sandsweptRuins',
])
export const CAIRO_LOCATION_IDS = Object.freeze(['streetsOfCairo', 'cairoBazaar', 'museumOfEgyptianAntiquities', 'outskirtsOfCairo', 'templeCourtyard'])
export const SETUP_LOCATION_IDS = Object.freeze([...CAIRO_LOCATION_IDS, 'expeditionCamp'])

// ---------------------------------------------------------------------------
// 地点（id 为稳定 ASCII ID；符号连接图来自 Location/CardDefs/GuardiansOfTheAbyss/*.hs）
// ---------------------------------------------------------------------------
export const LOCATION_ROWS = Object.freeze([
  Object.freeze({ id: 'streetsOfCairo', code: '83008', symbol: 'equals', links: Object.freeze(['diamond', 'triangle', 'square', 'trefoil']) }),
  Object.freeze({ id: 'cairoBazaar', code: '83009', symbol: 'square', links: Object.freeze(['triangle', 'equals', 'trefoil']) }),
  Object.freeze({ id: 'museumOfEgyptianAntiquities', code: '83010', symbol: 'triangle', links: Object.freeze(['diamond', 'equals', 'square']) }),
  Object.freeze({ id: 'outskirtsOfCairo', code: '83011', symbol: 'diamond', links: Object.freeze(['circle', 'triangle', 'equals', 'trefoil']) }),
  Object.freeze({ id: 'templeCourtyard', code: '83012', symbol: 'trefoil', links: Object.freeze(['diamond', 'equals', 'square']) }),
  Object.freeze({ id: 'expeditionCamp', code: '83037', symbol: 'circle', links: Object.freeze(['diamond', 'hourglass', 'moon', 'plus']) }),
  Object.freeze({ id: 'nileRiver', code: '83038', symbol: 'moon', links: Object.freeze(['circle', 'star', 'heart', 'hourglass']) }),
  Object.freeze({ id: 'sandsOfDashur', code: '83039', symbol: 'hourglass', links: Object.freeze(['circle', 'plus', 't', 'squiggle', 'heart', 'moon']) }),
  Object.freeze({ id: 'dunesOfTheSahara', code: '83040', symbol: 'plus', links: Object.freeze(['circle', 'hourglass', 't', 'droplet']) }),
  Object.freeze({ id: 'untouchedVault', code: '83041', symbol: 'droplet', links: Object.freeze(['plus', 't']) }),
  Object.freeze({ id: 'facelessSphinx', code: '83042', symbol: 'star', links: Object.freeze(['moon', 'heart']) }),
  Object.freeze({ id: 'desertOasis', code: '83043', symbol: 'heart', links: Object.freeze(['star', 'moon', 'hourglass', 'squiggle']) }),
  Object.freeze({ id: 'sandsweptRuins', code: '83044', symbol: 't', links: Object.freeze(['droplet', 'plus', 'hourglass', 'squiggle']) }),
])
const CONNECTION_MAP = connectionsFromSymbols(LOCATION_ROWS)
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_ROWS.map(row =>
  [row.id, location({ id: row.id, code: row.code, symbol: row.symbol, links: row.links, connections: CONNECTION_MAP[row.id] })])))

export const LOCATION_COORDINATES = Object.freeze({
  streetsOfCairo: { x: 1, y: 1 },
  cairoBazaar: { x: 2, y: 0 },
  museumOfEgyptianAntiquities: { x: 3, y: 1 },
  outskirtsOfCairo: { x: 0, y: 1 },
  templeCourtyard: { x: 1, y: 0 },
  expeditionCamp: { x: 2, y: 2 },
  nileRiver: { x: 3, y: 2 },
  sandsOfDashur: { x: 4, y: 2 },
  dunesOfTheSahara: { x: 2, y: 3 },
  untouchedVault: { x: 3, y: 3 },
  facelessSphinx: { x: 4, y: 3 },
  desertOasis: { x: 3, y: 4 },
  sandsweptRuins: { x: 4, y: 4 },
})

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边
// ---------------------------------------------------------------------------
const SANDS_TREACHERY_CODES = Object.freeze(['83047', '83048', '83049', '83050', '83051', '83052', '83053', '83054'])
const ENCOUNTER_POOL = Object.freeze([
  HUMBLE_SUPPLICANT_CODE, CREATURE_CODE,
  ABYSSAL_REVENANT_CODE, THING_IN_SARCOPHAGUS_CODE,
  ...SANDS_TREACHERY_CODES,
])
export const ENCOUNTER_DECK = Object.freeze(ENCOUNTER_POOL.flatMap(code =>
  Array(Math.max(1, Number(ALL_CARDS[code]?.quantity) || 1)).fill(code)))

// 探索牌库：7 张探险地点 + 1 张各（金字塔下的恐怖/蝗虫成群/深渊领域/日蚀/沙尘暴）。
export const EXPLORATION_TREACHERY_CODES = Object.freeze(['83049', '83050', '83054', '83047', '83048'])
export const EXPLORATION_DECK = Object.freeze([...EXPEDITION_LOCATION_IDS, ...EXPLORATION_TREACHERY_CODES])

export const SET_ASIDE_LOCATION_IDS = Object.freeze([...EXPEDITION_LOCATION_IDS])
export const SET_ASIDE_CODES = Object.freeze([
  NEITH_CODE, JOHN_AND_JESSIE_CODE, ANCIENT_ANKH_CODE,
  ABYSSAL_REVENANT_CODE, ABYSSAL_REVENANT_CODE,
  ...BROTHERHOOD_ENEMY_CODES,
  ...EXPEDITION_LOCATION_IDS.map(id => LOCATIONS[id].code),
])
export const SET_ASIDE_ALIASES = Object.freeze([...new Set(SET_ASIDE_CODES)])
export const ENCOUNTER_GROUPS = Object.freeze(['theEternalSlumber', 'theNightsUsurper'])

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  [ACT1_CODE]: Object.freeze({ ...stage(ACT1_CODE, { number: 1 }), objective: { type: 'custom' } }),
  [ACT2_CODE]: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'custom' } }),
  [ACT3_CODE]: Object.freeze({ ...stage(ACT3_CODE, { number: 3 }), objective: { type: 'custom' } }),
})
export const AGENDA_STAGES = Object.freeze({
  [AGENDA1_CODE]: stage(AGENDA1_CODE, { number: 1 }),
  [AGENDA2_CODE]: stage(AGENDA2_CODE, { number: 2 }),
  [AGENDA3_CODE]: stage(AGENDA3_CODE, { number: 3 }),
})
export const ACTS = Object.freeze(ACT_CODES.map(code => structuredClone(ACT_STAGES[code])))
export const AGENDAS = Object.freeze(AGENDA_CODES.map(code => structuredClone(AGENDA_STAGES[code])))
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  ...Object.entries(ACT_STAGES), ...Object.entries(AGENDA_STAGES),
]))

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: { delta: 'X', text: '-X（X = 深渊之力）' },
    cultist: { delta: 0, text: '再抽 1 个标记；若失败且深渊之力 ≤3，深渊之力 +1' },
    tablet: { delta: 0, text: '0；本次检定无视所有技能值正面修正' },
    elderthing: { delta: -5, text: '-5；可改为深渊之力 +1 来自动成功' },
  }),
  hard: Object.freeze({
    skull: { delta: 'X+1', text: '-X（X = 深渊之力 +1）' },
    cultist: { delta: 0, text: '再抽 1 个标记；若失败且深渊之力 ≤5，深渊之力 +1' },
    tablet: { delta: -2, text: '-2；本次检定无视所有技能值正面修正' },
    elderthing: { delta: -6, text: '-6；可改为深渊之力 +1 来自动成功' },
  }),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; guide source is authoritative)',
  heading: '永恒沉睡',
  intro: '「亲爱的朋友：很抱歉这么久没有写信。我现在身在开罗，除了你们，我不知道还能信任谁。'
    + '这座城市出了事：埃及古物博物馆的馆长睡下后就再没醒来。起初只当是医学奇闻，'
    + '可接下来越来越多人陷入昏迷——现在每夜都有。写这封信时，他们正把我的丈夫约翰送往医院。'
    + '我害怕。我不只是怕自己一睡不醒，我更担心有人刻意在散播这诅咒。求求你们，帮帮我。——杰西·伯克」',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集遭遇组：永恒沉睡、埃及之沙、野兽兄弟会、深渊献祭。' },
    { key: 'placeLocations', text: '将开罗街道、开罗集市、埃及古物博物馆、开罗城郊、神庙庭院、探险营地放入场。' },
    { key: 'startAt', text: '每名调查员从开罗街道开始游戏。' },
    { key: 'setAside', text: '将奈斯、约翰和杰西·伯克、古老圣甲虫护符、2 张深渊亡魂，以及 7 张单面探险地点放到一边（场外）。' },
    { key: 'brotherhood', text: '把 6 名双面兄弟会敌人洗混，背面朝上置于剧本参考卡下方。' },
    { key: 'strengthOfTheAbyss', text: '在剧本参考卡「深渊之力」处放置等同调查员人数的资源标记。' },
  ]),
  specialRules: Object.freeze([
    '故事卡：本支线出现背面为「故事卡」的双面卡；被指示结算故事卡时，读出其故事与游戏文本即可。'
      + '（翻到故事卡时，该地点/敌人仍视为在场。）',
    '深渊之力：剧本参考卡上的资源标记代表深渊之力的当前强度；按卡面指示增减。某些遭遇卡会随深渊之力变强。',
    '被深渊吞没：当调查员或[[盟友]]支援被「深渊吞没」时，先深渊之力 +1；若为独特卡，在战役日志记录「（卡名）被深渊吞没」。'
      + '被吞没的调查员视为被杀/发疯；战役余下时间不能打出被吞没的独特[[盟友]]支援的副本。',
    '探索：部分能力带「探索」行动标记。组建探索牌库后，从探索牌库顶逐张翻牌，直到翻出与所在地点符号相连的地点（成功：入场并移动），'
      + '或翻出诡计（失败：按正常流程结算）。途中翻出的其他地点先放在探索牌库旁，本次探索结束后洗回。',
  ]),
  rules: Object.freeze({}),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '没有达成结局：开罗陷入永眠，再也不会醒来。兄弟会在西方欢庆，因为预言即将实现；'
      + '而在梦境的深处，他们选中的「选民」第一次握紧了武器。记录「深渊中的沉梦者（X）」与「逃脱的兄弟会特工」，'
      + '并记录「兄弟会的阴谋仍在继续」。（→无结局）',
    resolution1: '结局 1：杰西·伯克喜极而泣——数周来第一次，她的丈夫睁开了眼睛。「杰西……？」约翰颤抖着想站起来。'
      + '「若不是你们，我还在沉睡。」他转向你们，神情凝重：「那么，你们就是唯一能阻止将要到来之事的人了。'
      + '在梦里，我见到了他——他们称作伊扎法拉的那个存在。」记录「长眠诅咒已被解除」，划掉所有「被深渊吞没」的记录；'
      + '任意一名调查员可将约翰和杰西·伯克加入牌组（不计入牌组张数）。',
    resolution2: '结局 2：奈斯站起身。她的力量已被抽走大半，但数名沉梦者仍在维持着她。「他们谋划了几个世纪。'
      + '清算之日即将到来，没有什么能阻止。不是我，更不是你们。」她的影子膨胀、扭曲——「他要的是深渊。'
      + '若想阻止他，就向西去。伊扎法拉在门后等着。」影子吞没了她的身体，只留下她的护符。'
      + '记录「你们已知晓伊扎法拉的阴谋」；任意一名调查员可将古老圣甲虫护符加入牌组（不计入牌组张数）。',
  }),
  resolutionBranches: Object.freeze({
    noResolution: '记录「深渊中的沉梦者（X）」「逃脱的兄弟会特工」与「兄弟会的阴谋仍在继续」；结算经验；所有被深渊吞没的调查员被杀。',
    resolution1: '记录「长眠诅咒已被解除」，划掉所有「被深渊吞没」；任意一名调查员获得约翰和杰西·伯克；结算经验。',
    resolution2: '记录「你们已知晓伊扎法拉的阴谋」；任意一名调查员获得古老圣甲虫护符；结算经验；所有被深渊吞没的调查员被杀。',
  }),
  evidenceBenefits: Object.freeze({
    83031: '你把石板带给艾尔·马斯里博士，她尽力翻译：「当选择作出时，他将借圣地的一千份献祭获得力量。」'
      + '她眨了眨眼，努力消化这句话，然后睁大眼睛问：「现在有多少昏迷病人？」',
    83032: '你设法在摩尔博士徒步逃离时截住了他。「很聪明，」他承认，「但你们已经来不及了。'
      + '关起我也没用——沉梦者将被献祭，我们的选民将引领我们走向新时代。」数小时后，他反过来哀求放他出城：「死神来了！奈斯来了！' +
      '我们都会被献祭——你我都一样！趁还来得及，我们都得逃！」',
    83033: '用纳迪娅给你的钥匙，你进入了那间被标记的住宅。里面空无一人，只有腐臭与旧皮革的气味。'
      + '地下室堆满了旧书与兄弟会及其众多特工的记录。整理它们需要时间，但线索就是线索。',
    83034: '法里德一边把金像扫进背包一边咧嘴大笑。在他兴奋过头前，你逼问情报。「他们答应给我难以想象的财富。'
      + '连我也有价码，你知道的。」他举手投降，「给你看我的账本——这几个月我做了不少『生意』。那会给你们指明方向。」',
    83035: '尽管身负致命伤，刺客仍阴冷地笑着。「日子就要到了，」他在咳嗽间说道，「你们以为杀了我就能阻止它？'
      + '蠢货！巨兽会把你们全都吞掉！」他狂笑着咽下最后一口气。你迅速翻找他的遗物，在一本皮面小册子里发现一段隐晦的铭文：' +
      '「我们的献祭浸透深渊之刃，千个灵魂永不再醒；我们的选民将由此崛起，而日子已永远临近！」',
    83036: '你把小饰物放在教授的桌上。他戴上单片眼镜仔细端详。「有趣！」他惊呼，「这只能来自王室墓穴中某座特定的墓——' +
      '多数学者认为它根本不存在。」他起身与你握手，「给我些时间研究。也许我们都能活着出去，我还能重交论文。」他阴郁地笑了笑。',
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const CARD_CODES = Object.freeze([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_ROWS.map(row => row.code),
  ...BROTHERHOOD_ENEMY_CODES, ...BROTHERHOOD_STORY_CODES,
  ...ENCOUNTER_POOL,
  NEITH_CODE, JOHN_AND_JESSIE_CODE, ANCIENT_ANKH_CODE,
  ABYSSAL_REVENANT_CODE, THING_IN_SARCOPHAGUS_CODE,
])
export const CARD_DATA = Object.freeze(Object.fromEntries(CARD_CODES.map(code => [code, ALL_CARDS[code]])))

const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK, NEITH_CODE, ...BROTHERHOOD_ENEMY_CODES, ...BROTHERHOOD_STORY_CODES,
  JOHN_AND_JESSIE_CODE, ANCIENT_ANKH_CODE,
])
const evidence = encounterDefinitions([
  ...BROTHERHOOD_STORY_CODES, ...BROTHERHOOD_STORY_CODES.map(code => code),
])

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '永恒沉睡 · The Eternal Slumber',
  nameEn: 'The Eternal Slumber',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '依照剧本参考卡 83001 与参考支线的设置页布置：6 名兄弟会双面敌人置于剧本参考卡下方；'
    + '深渊之力初始 = 调查员人数；独立开局每人 2 XP。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: Object.freeze([...SCENARIO_TEXT.specialRules]),
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  evidenceCards: { ...evidence.storyAssets },
  evidenceBenefits: SCENARIO_TEXT.evidenceBenefits,
  brotherhoodPairs: BROTHERHOOD_PAIRS,
  brotherhoodStoryByEnemy: BROTHERHOOD_STORY_BY_ENEMY,
  encounterDeck: [...ENCOUNTER_DECK],
  explorationDeck: [...EXPLORATION_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
  cardData: CARD_DATA,
}

export const identities = bindIdentities(scenario)
export default scenario
