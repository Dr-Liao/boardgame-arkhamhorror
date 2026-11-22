// 读书至死（Read or Die · 90004）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/ReadOrDie.hs（setup / 混乱袋 / 结局 / 151 场景）；
//   Act|Agenda|Enemy|Location/CardDefs/ReadOrDie.hs 与 ExtracurricularActivity 复用卡；
//   frontend/src/locales/en/standalone/readOrDie.json（intro / setup / tokens / resolutions）。
//
// 归属：本关专属卡 90004–90007（90004 为剧本提示卡本身），遭遇组 read_or_die；
// 复用 Extracurricular Activity 的地点 02048–02056（02055/02057 与三张卡移出游戏）、
// 故事资产 02060 "Jazz" Mulligan、02040 Dr. Henry Armitage；遭遇牌库来自
// sorcery / the_beyond / bishops_thralls / whippoorwills / ancient_evils / locked_doors /
// agents_of_yog（Extracurricular Activity 组只有被移除的 The Experiment，不进牌库）。
//
// 本关口径：
//   1. 黛西·沃克（平行正面 90001）必须在场且从 Orne Library 开始；其他调查员从 Miskatonic Quad 开始。
//   2. 黛西牌组里每张非弱点[[书卷]]资产被移出牌组、暗置在各地点下方（离 Orne Library 最远者优先）；
//      幕 1 的 [fast] 行动可以把本地点下方的一张洗回牌组。
//   3. 地点上的 Objective 文本一律忽略（幕 1 正面）；Dormitories/Faculty Offices 的
//      「放入场」强制效果忽略（地点已入场）。
//   4. 若「死书之灵」将被击败：改为治愈、横置并移回 Orne Library（behavior.enemyDefeated）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'readOrDie'
export const REFERENCE_CODE = '90004'
export const ENCOUNTER_CODE = 'read_or_die'
export const KEY_INVESTIGATOR = '90001' // 平行黛西·沃克
export const DAISY_TITLE = 'Daisy Walker'

export const ACT_CODE = '90006' // Speed Reading / 快速阅读
export const AGENDA_CODE = '90005' // Mortal Inquiry / 凡人求索
export const NAMER_CODE = '90007' // Namer of the Dead / 死书之灵
export const JAZZ_CODE = '02060' // "Jazz" Mulligan
export const ARMITAGE_CODE = '02040' // Dr. Henry Armitage
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// ---------------------------------------------------------------------------
// gather 组与遭遇牌库
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'read_or_die', 'sorcery', 'the_beyond', 'bishops_thralls',
  'whippoorwills', 'ancient_evils', 'locked_doors', 'agents_of_yog',
])

// 从游戏中移除：Extracurricular Activity 的剧本/幕/议程（本关用新卡）、
// Faculty Offices（The Hour is Late）、Alchemy Labs、Alchemical Concoction、
// The Experiment、Professor Warren Rice。
export const REMOVED_CODES = Object.freeze([
  '02041', '02042', '02043', '02044', '02045', '02046', '02047',
  '02055', '02057', '02058', '02059', '02061',
])

const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const deckTypes = ['enemy', 'treachery']

export function expandEncounterDeck(cards) {
  return cards
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}

export function groupDeck(groups, exclude = []) {
  const wanted = new Set(groups.map(snake))
  const excluded = new Set(exclude)
  return expandEncounterDeck(Object.entries(ALL_CARDS)
    .filter(([code, card]) => !excluded.has(code))
    .filter(([, card]) => wanted.has(card.encounterCode))
    .filter(([, card]) => deckTypes.includes(card.type)))
}

export const ENCOUNTER_DECK = Object.freeze(groupDeck(ENCOUNTER_GROUPS, [NAMER_CODE]))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点（Extracurricular Activity 印刷连接图标）
// ---------------------------------------------------------------------------
// Orne Library(Triangle)↔Miskatonic Quad(Plus)；Quad(Plus)↔[Triangle Hourglass Square Diamond Circle]；
// Humanities(Square)↔[Plus Triangle]；Science(Hourglass)↔[Plus Squiggle(Alchemy Labs 移出)]；
// Student Union(Diamond)↔[Plus Equals(Dormitories)]；Administration(Circle)↔[Plus T(Faculty)]。
export const START_LOCATION = 'orneLibrary'
export const OTHER_START_LOCATION = 'miskatonicQuad'

export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['miskatonicQuad', '02048', Object.freeze(['orneLibrary', 'humanitiesBuilding', 'scienceBuilding', 'studentUnion', 'administrationBuilding'])]),
  Object.freeze(['orneLibrary', '02050', Object.freeze(['miskatonicQuad', 'humanitiesBuilding'])]),
  Object.freeze(['humanitiesBuilding', '02049', Object.freeze(['miskatonicQuad', 'orneLibrary'])]),
  Object.freeze(['scienceBuilding', '02056', Object.freeze(['miskatonicQuad'])]),
  Object.freeze(['studentUnion', '02051', Object.freeze(['miskatonicQuad', 'dormitories'])]),
  Object.freeze(['administrationBuilding', '02053', Object.freeze(['miskatonicQuad', 'facultyOffices'])]),
  Object.freeze(['dormitories', '02052', Object.freeze(['studentUnion'])]),
  Object.freeze(['facultyOffices', '02054', Object.freeze(['administrationBuilding'])]),
])

export const START_LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const LOCATION_CODES = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code]) => [id, code])))

// 桌面坐标：Orne/Quad 为起始两格，其余按印刷连接就近展开。
export const LOCATION_COORDINATES = Object.freeze({
  humanitiesBuilding: { x: 1, y: 0 },
  scienceBuilding: { x: 2, y: 0 },
  orneLibrary: { x: 0, y: 1 },
  miskatonicQuad: { x: 1, y: 1 },
  studentUnion: { x: 2, y: 1 },
  dormitories: { x: 2, y: 2 },
  administrationBuilding: { x: 1, y: 2 },
  facultyOffices: { x: 0, y: 2 },
})

// Jazz Mulligan 固定放在 Science Building。
export const JAZZ_LOCATION = 'scienceBuilding'

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Read or Die card: ${code}`)
  return {
    code,
    originalCode: code,
    name: card.nameZh || card.name,
    nameEn: card.name,
    subname: card.subnameZh || card.subname || '',
    subnameEn: card.subname || '',
    text: card.textZh || card.text || '',
    textEn: card.text || '',
    backText: card.backTextZh || card.backText || '',
    backTextEn: card.backText || '',
    type: card.type,
    traits: [...(card.traits || [])],
    ...(card.victory != null ? { victory: card.victory } : {}),
  }
}

export function location(data) {
  const { id, code, connections, ...rest } = data
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Read or Die location: ${code}`)
  return {
    ...printed(code),
    id,
    shroud: card.shroud,
    connections: [...(connections || [])],
    ...rest,
    cluesPerInvestigator: Number(card.clues) || 0,
    unrevealedName: card.backNameZh || card.backName || card.nameZh || card.name,
    unrevealedNameEn: card.backName || card.name,
  }
}

export function stage(code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Read or Die stage card: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${card.type}${code}`,
    type: card.type,
    stage: `${number ?? card.stage ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
    ...(card.type === 'act' ? { objective: { type: 'manual' } } : {}),
  }
}

// 敌人定义（本关专属）。复用卡直接使用其它已注册剧本的全局定义，避免覆盖既有规则。
export function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown Read or Die encounter definition: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      enemies[code] = {
        ...base,
        fight: card.fight ?? null,
        evade: card.evade ?? null,
        health: card.health ?? null,
        damage: card.damage || 0,
        horror: card.horror || 0,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        ...(card.victory != null ? { victory: card.victory } : {}),
        ...(/\bhunter\b/i.test(String(card.text || '')) ? { hunter: true } : {}),
        ...(/Prey - ([^.]+)\./.test(String(card.text || '')) ? { prey: 'bearer' } : {}),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = {
        ...base,
        entryRevelation: true,
        surge: /^Surge\./m.test(card.text || ''),
        peril: /(?:^|\n|\. )Peril\./.test(card.text || ''),
      }
    } else if (card.type === 'asset' || card.type === 'story') {
      storyAssets[code] = { ...base, global: false }
    }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenarioData) {
  const identity = value => ({
    originalCode: value.originalCode || value.code,
    artCode: value.originalCode || value.code,
  })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT_STAGE = Object.freeze({ ...stage(ACT_CODE, { number: 1 }), objective: { type: 'manual' } })
export const AGENDA_STAGE = Object.freeze(stage(AGENDA_CODE, { number: 1 }))
export const ACTS = Object.freeze([structuredClone(ACT_STAGE)])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGE)])
export const STAGE_CARDS = Object.freeze({
  [ACT_CODE]: structuredClone(ACT_STAGE),
  [AGENDA_CODE]: structuredClone(AGENDA_STAGE),
})

// ---------------------------------------------------------------------------
// 混乱标记（90004 正面 = 简单/普通，背面 = 困难/专家）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为黛西·沃克控制的[[书卷]]支援数量。', delta: 0 }),
    cultist: Object.freeze({ text: '再揭示一个混乱标记。如果你失败，弃掉你牌库顶的 2 张牌。', delta: 0, drawAnother: true }),
    tablet: Object.freeze({ text: '-2。如果这是对「死书之灵」的攻击或躲避检定且你没有至少成功 2 点，它攻击你。', delta: -2 }),
    elderthing: Object.freeze({ text: '-3。如果你失败，黛西·沃克受到 1 点恐惧。', delta: -3 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为黛西·沃克控制的[[书卷]]支援数量 +1。', delta: 0 }),
    cultist: Object.freeze({ text: '再揭示一个混乱标记。如果你失败，弃掉你牌库顶的 3 张牌。', delta: 0, drawAnother: true }),
    tablet: Object.freeze({ text: '-3。如果这是对「死书之灵」的攻击或躲避检定且你没有至少成功 3 点，它攻击你。', delta: -3 }),
    elderthing: Object.freeze({ text: '-5。如果你失败，黛西·沃克受到 1 点恐惧。', delta: -5 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

// ---------------------------------------------------------------------------
// 剧情正文（忠实中译；英文正文见指南源）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '读书至死',
  intro: '你这一生都在读书。儿时那只是一种对无害故事的兴趣——当然，那些故事挺阴森，但终究无害。'
    + '你对恐怖与死亡主题的着迷让你在朋友和同学中得了个「幽灵」的绰号。可随着你长大，这份着迷也在生长，'
    + '直到近乎痴迷。你对恐怖的胃口从悬疑与虚构，变成了更真实的东西。'
    + '当你发现约翰·迪伊译本的《死灵之书》时，你以为自己终于找到了秘密渴望的、真正的恐怖。'
    + '要是你早知道读完那本可怕的书会发生什么就好了——你会把它锁回奥恩图书馆亨利·阿米蒂奇博士的禁书区，'
    + '再也不打开。或者你愿意这样相信。但即便是你，也无法质疑《基塔布·阿尔-阿齐夫》的诱惑。《死者之书》。'
    + '所以当阿米蒂奇博士把你召到奥恩图书馆时，你骨子里的恐惧已经预示了发生的一切。'
    + '「我不明白这怎么会发生。」阿米蒂奇博士审视着狼藉的现场说道。整个禁书区一片碎片与撕碎的书页。'
    + '《死灵之书》摊开在旁边的桌上，金属搭扣断裂。你用手指抚过那皮革般、如同皮肤的书页。'
    + '你的目光以熟悉的舞步掠过字句：「他们在孤独之处无形而污秽地行走，言语已被说出，仪式已在其季节中嚎叫。」'
    + '你的喉咙收紧，意识到发生了什么。有什么东西被释放了出来，而你是唯一能弄清如何阻止它的人。',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的全部卡牌：读书至死、课外活动、巫术、彼界、主教之奴、夜鹰、远古邪恶、上锁的门、约格·索托斯之仆、阿米蒂奇的命运。除「读书至死」外均可从《敦威治遗产》豪华扩展找到。' },
    { key: 'newCards', text: '将「课外活动」遭遇组原有的剧本提示卡、幕牌库与议程牌库移出游戏；改用「读书至死」扩展提供的新提示卡、议程与幕。' },
    { key: 'removeCards', text: '将「教师办公室（时已晚）」地点、「炼金实验室」地点、「炼金药剂」故事资产、「实验体」敌人与「沃伦·赖斯教授」故事资产移出游戏。' },
    { key: 'placeLocations', text: '将其余每个地点放入场：大学广场、奥恩图书馆、人文学大楼、学生会、科学大楼、管理大楼、宿舍、教师办公室（夜仍年轻）。' },
    { key: 'daisyWalker', text: '黛西·沃克从奥恩图书馆开始。' },
    { key: 'otherInvestigators', text: '其他每位调查员从大学广场开始。' },
    { key: 'ignoreForced', text: '由于宿舍与教师办公室已在场、炼金实验室已被移出游戏，忽略任何会把这些地点放入场的强制能力。' },
    { key: 'placeTomes', text: '把先前从黛西·沃克牌组移出、已放到一边的[[书卷]]资产洗混，从离奥恩图书馆最远的地点开始，在每个地点（大学广场除外）下方各暗置 1 张。剩余书卷全部暗置在奥恩图书馆下方。' },
    { key: 'jazzMulligan', text: '将「爵士」马利根故事资产放入科学大楼。' },
    { key: 'namerOfTheDead', text: '将「死书之灵」敌人（由「读书至死」扩展提供）放入奥恩图书馆，未交战且横置。' },
    { key: 'drHenryArmitage', text: '黛西·沃克获得「亨利·阿米蒂奇博士」故事资产的控制权。（若亨利·阿米蒂奇博士已在某位调查员的牌组中，从该调查员的牌组中找出并置于黛西·沃克控制下。）' },
  ]),
  specialRules: Object.freeze([
    {
      title: '挑战剧本',
      text: '挑战剧本是特殊的「打印即玩」剧本，利用《诡镇奇谈：卡牌版》收藏中已有的产品与额外的打印卡，创造新内容。'
        + '「读书至死」挑战剧本围绕调查员黛西·沃克展开，因此有以下前置要求：'
        + '黛西·沃克必须作为本剧本的调查员之一被选择；黛西·沃克的牌组必须包含至少 4 张非弱点[[书卷]]资产（弱点中的书卷不计入此数）。',
    },
    {
      title: '忽略地点目标',
      text: '幕 1 正面声明：忽略地点上的所有 Objective（目标）文本。因此宿舍与教师办公室等地点不会把本关带入其它结局。',
    },
  ]),
  rules: Object.freeze({
    namer: '「死书之灵」将被击败时改为：治愈它所有伤害、横置它，并把它移回奥恩图书馆。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若没有任何调查员达成结局（全员被击败或撤退）：按结局 2 结算。'
      + '你把书塞回手提包。你只能希望被释放的实体不会再造成更多伤害……'
      + '黛西·沃克获得的经验等于胜利区所有卡牌的胜利点数总和，或游戏结束时她场上[[书卷]]支援数量，二者取高。'
      + '其他每位调查员只获得胜利区卡牌的胜利点数总和。黛西·沃克必须把《死灵之书》升级为进阶版，'
      + '或把黛西的手提包进阶版降级为原本版本。',
    resolution1: '结局 1：你醒来时，图书馆的地板上散落着纸屑与被撕碎的书。'
      + '《死灵之书》就在你面前，金属搭扣再次将它封住。但愿被释放的存在已被安全地封存其中。'
      + '但你不能冒险把这本魔法书留在这里——它太危险了。你把它塞进手提包，知道只有你才能保护它……或者保护他人不受它伤害。'
      + '黛西·沃克获得的经验等于胜利区所有卡牌的胜利点数总和，或游戏结束时她场上[[书卷]]支援数量，二者取高。'
      + '其他每位调查员只获得胜利区卡牌的胜利点数总和。'
      + '黛西·沃克可以把黛西的手提包升级为进阶版，或把《死灵之书》（约翰·迪伊译本）进阶版降级为原本版本。',
    resolution2: '结局 2：你把书塞回手提包。你只能希望被释放的实体不会再造成更多伤害……'
      + '黛西·沃克获得的经验等于胜利区所有卡牌的胜利点数总和，或游戏结束时她场上[[书卷]]支援数量，二者取高。'
      + '其他每位调查员只获得胜利区卡牌的胜利点数总和。'
      + '黛西·沃克必须把《死灵之书》（约翰·迪伊译本）升级为进阶版，或把黛西的手提包进阶版降级为原本版本。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT_CODE]: '忽略地点上的所有 Objective。'
    + '[fast] 如果你是黛西·沃克，你所在地点的调查员们花费 1[per_investigator] 个线索：把此地点下方 1 张暗置的玩家卡洗回你的牌组。'
    + 'Objective - 在一切太迟之前，找到放逐「死书之灵」的方法。',
})
export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA_CODE]: '亨利·阿米蒂奇博士不占用盟友槽，并获得：「你有 2 个额外手部槽位，这些槽位只能用于放置[[书卷]]资产。」'
    + '「爵士」马利根获得：「[action]：移动到一个至多 3 个连接距离内的[[米斯卡塔尼克]]地点。」',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, connections]) => {
  const card = ALL_CARDS[code]
  return [id, location({
    id,
    code,
    connections,
    ...(card.victory != null ? { hasVictory: true } : {}),
  })]
})))

const definitions = encounterDefinitions([...ENCOUNTER_DECK_CODES, NAMER_CODE])
// 故事资产：复用卡 02060/02040 的定义补齐（02040 在已注册剧本里没有遭遇定义）。
Object.assign(definitions.storyAssets, encounterDefinitions([JAZZ_CODE, ARMITAGE_CODE]).storyAssets)
// 90007「死书之灵」的关键字/生成信息在卡面与 reference 里。
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT_CODE, AGENDA_CODE, NAMER_CODE, JAZZ_CODE, ARMITAGE_CODE,
  ...START_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DECK_CODES,
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '读书至死 · Read or Die',
  nameEn: 'Read or Die',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：黛西·沃克必须在场且牌组至少 4 张非弱点书卷；本批为 1 人独立开局。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  removedCodes: [...REMOVED_CODES],
  actText: SCENARIO_ACT_TEXT,
  agendaText: SCENARIO_AGENDA_TEXT,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
