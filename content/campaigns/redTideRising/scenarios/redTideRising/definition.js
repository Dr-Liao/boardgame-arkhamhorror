// 红潮涌起（Red Tide Rising · 90041）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/RedTideRising.hs（setup / 混乱袋 / token / 结局）；
//   Act|Agenda|Asset/Cards/RedTideRising.hs；The Vanishing of Elina Harper 的
//   6 Suspect 敌人（07076–07081）与 6 Hideout 地点（07070–07075）；
//   frontend/src/locales/en/standalone/redTideRising.json（intro / setup / tokens / resolutions）。
//
// 本关是「独立单章挑战战役」：平行温蒂·亚当斯（90037）必须在场（1P 单开）。
// 核心机制：Leads deck（6 嫌疑犯 + 6 藏身处洗混，作为「迹象」牌堆）、两面神秘相片（90045a/b）
// 把无线索的嫌疑犯/藏身处加入胜利区、议程 1 的「将要推进 → 移除毁灭并洗入一只放一边的怪物」。
//
// 复用卡说明：嫌疑犯/藏身处/怪物/地点全部复用 The Innsmouth Conspiracy 战役已注册的全局定义与
// 单卡条目；本文件只新增 90041–90045b 的专属数据。Leads deck 使用引擎通用 scenarioDecks 原语
// （id = 'leads'），因此复用条目的「查看/洗入迹象牌堆」读点可直接工作。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'redTideRising'
export const REFERENCE_CODE = '90041'
export const ENCOUNTER_CODE = 'red_tide_rising'
export const KEY_INVESTIGATOR = '90037' // 平行温蒂·亚当斯
export const WENDY_TITLE = 'Wendy Adams'
export const LEADS_DECK_ID = 'leads'

export const ACT_CODE = '90044' // Searching for Dad / 寻找父亲
export const AGENDA_CODES = Object.freeze(['90042', '90043']) // The New Girl → Trail Goes Cold
export const AGENDA1_CODE = '90042'
export const AGENDA2_CODE = '90043'
export const PHOTO_FRONT = '90045a' // Mysterious Photo（嫌疑犯面）
export const PHOTO_BACK = '90045b' // Mysterious Photo（藏身处面）
export const PHOTO_CODES = Object.freeze([PHOTO_FRONT, PHOTO_BACK])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// ---------------------------------------------------------------------------
// 地点：7 个固定地点 + 6 个藏身处（藏身处开局在一边，抽到迹象时入场）。
// 连接取 The Innsmouth Conspiracy「The Vanishing of Elina Harper」地图符号图
// （content/campaigns/theInnsmouthConspiracy/chapter-data.json#symbolGraph，双向去重）。
// ---------------------------------------------------------------------------
export const START_LOCATION = 'innsmouthSquare'
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['marshRefinery', '07063', Object.freeze(['innsmouthSquare', 'fishStreetBridge', 'innsmouthHarbour', 'newChurchGreen', 'theHouseOnWaterStreet'])]),
  Object.freeze(['gilmanHouse', '07064', Object.freeze(['innsmouthSquare', 'theLittleBookshop', 'firstNationalGrocery', 'sawboneAlley', 'innsmouthJail'])]),
  Object.freeze(['innsmouthSquare', '07065', Object.freeze(['marshRefinery', 'gilmanHouse', 'firstNationalGrocery', 'fishStreetBridge', 'newChurchGreen', 'innsmouthJail'])]),
  Object.freeze(['innsmouthHarbour', '07066', Object.freeze(['marshRefinery', 'fishStreetBridge', 'shorewardSlums', 'theHouseOnWaterStreet'])]),
  Object.freeze(['firstNationalGrocery', '07067', Object.freeze(['innsmouthSquare', 'gilmanHouse', 'theLittleBookshop', 'newChurchGreen', 'esotericOrderOfDagon'])]),
  Object.freeze(['fishStreetBridge', '07068', Object.freeze(['innsmouthSquare', 'marshRefinery', 'innsmouthHarbour', 'shorewardSlums', 'innsmouthJail'])]),
  Object.freeze(['theLittleBookshop', '07069', Object.freeze(['gilmanHouse', 'firstNationalGrocery', 'sawboneAlley', 'esotericOrderOfDagon'])]),
  Object.freeze(['esotericOrderOfDagon', '07070', Object.freeze(['theLittleBookshop', 'firstNationalGrocery'])]),
  Object.freeze(['sawboneAlley', '07071', Object.freeze(['theLittleBookshop', 'gilmanHouse'])]),
  Object.freeze(['shorewardSlums', '07072', Object.freeze(['fishStreetBridge', 'innsmouthHarbour'])]),
  Object.freeze(['theHouseOnWaterStreet', '07073', Object.freeze(['marshRefinery', 'innsmouthHarbour'])]),
  Object.freeze(['innsmouthJail', '07074', Object.freeze(['gilmanHouse', 'innsmouthSquare', 'fishStreetBridge'])]),
  Object.freeze(['newChurchGreen', '07075', Object.freeze(['marshRefinery', 'innsmouthSquare', 'firstNationalGrocery'])]),
])

export const FIXED_LOCATION_IDS = Object.freeze([
  'innsmouthSquare', 'marshRefinery', 'innsmouthHarbour', 'fishStreetBridge',
  'firstNationalGrocery', 'gilmanHouse', 'theLittleBookshop',
])
export const HIDEOUT_LOCATION_IDS = Object.freeze([
  'esotericOrderOfDagon', 'sawboneAlley', 'shorewardSlums',
  'theHouseOnWaterStreet', 'innsmouthJail', 'newChurchGreen',
])
export const HIDEOUT_CODES = Object.freeze(HIDEOUT_LOCATION_IDS.map(id =>
  LOCATION_TABLE.find(([locationId]) => locationId === id)[1]))

export const LOCATION_COORDINATES = Object.freeze({
  innsmouthSquare: { x: 2, y: 2 },
  marshRefinery: { x: 1, y: 2 },
  fishStreetBridge: { x: 3, y: 2 },
  innsmouthHarbour: { x: 4, y: 2 },
  theLittleBookshop: { x: 0, y: 2 },
  firstNationalGrocery: { x: 2, y: 1 },
  gilmanHouse: { x: 1, y: 1 },
  esotericOrderOfDagon: { x: 0, y: 3 },
  sawboneAlley: { x: 0, y: 1 },
  shorewardSlums: { x: 4, y: 1 },
  theHouseOnWaterStreet: { x: 4, y: 3 },
  innsmouthJail: { x: 2, y: 3 },
  newChurchGreen: { x: 3, y: 3 },
})

// ---------------------------------------------------------------------------
// Leads deck：6 嫌疑犯（07076–07081）+ 6 藏身处（07070–07075）；Angry Mob 与
// 3 只怪物放一边（怪物在议程 1「将要推进」时逐只洗入迹象牌堆）。
// ---------------------------------------------------------------------------
export const SUSPECT_CODES = Object.freeze(['07076', '07077', '07078', '07079', '07080', '07081'])
export const SUSPECT_HOME_LOCATIONS = Object.freeze({
  '07076': 'innsmouthHarbour', // Robert Friendly
  '07077': 'fishStreetBridge', // Zadok Allen
  '07078': 'firstNationalGrocery', // Brian Burnham
  '07079': 'marshRefinery', // Barnabas Marsh
  '07080': 'theLittleBookshop', // Joyce Little
  '07081': 'gilmanHouse', // Othera Gilman
})
export const LEADS_CARDS = Object.freeze([...SUSPECT_CODES, ...HIDEOUT_CODES])

export const ANGRY_MOB_CODE = '07062b'
export const MONSTER_CODES = Object.freeze(['07094', '01172', '01172']) // Winged One + Hunting Nightgaunt ×2
export const FOG_LOCATION_CODE = '07095' // Fog over Innsmouth（遭遇组同名牌之外的那张）
export const REMOVED_CODES = Object.freeze([
  // The Vanishing of Elina Harper 的剧本参考/幕/议程/故事资产（本关全部替换）
  '07056', '07057', '07058', '07059', '07060', '07061', '07062a',
  // 本关移除的故事资产
  '07082', '07083',
])

// ---------------------------------------------------------------------------
// 遭遇牌库：The Innsmouth Conspiracy 的四个组 + 核心组 + 午夜假面伪线索。
// 嫌疑犯/藏身处/怪物/Angry Mob 不进遭遇牌库（Leads deck 或放一边）。
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'agents_of_dagon', 'fog_over_innsmouth', 'the_locals',
  'chilling_cold', 'locked_doors', 'nightgaunts',
])

const deckTypes = ['enemy', 'treachery']
const excluded = new Set([
  ...SUSPECT_CODES, ...HIDEOUT_CODES, ...MONSTER_CODES, ANGRY_MOB_CODE,
  ...REMOVED_CODES,
])

function expand(cards) {
  return cards.sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}

export const MIDNIGHT_MASKS_EXTRAS = Object.freeze({ '01135': 3, '01136': 2 })

export const ENCOUNTER_DECK = Object.freeze([
  ...expand(Object.entries(ALL_CARDS)
    .filter(([code, card]) => !excluded.has(code)
      && ENCOUNTER_GROUPS.includes(card.encounterCode)
      && deckTypes.includes(card.type))),
  ...Object.entries(MIDNIGHT_MASKS_EXTRAS).flatMap(([code, count]) => Array(count).fill(code)),
])
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 藏身处从迹象牌堆抽到即入场（revelation），所以它们的定义用 location() 生成。
export const SET_ASIDE_CODES = Object.freeze([
  ANGRY_MOB_CODE, ...MONSTER_CODES, ...PHOTO_CODES, ...LOCATION_TABLE.map(([, code]) => code),
])

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Red Tide Rising card: ${code}`)
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
  if (!card) throw new RangeError(`Unknown Red Tide Rising location: ${code}`)
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
  if (!card) throw new RangeError(`Unknown Red Tide Rising stage card: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${card.type}${code}`,
    type: card.type,
    stage: `${number ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
    ...(card.type === 'act' ? { objective: { type: 'manual' } } : {}),
  }
}

// 复用卡只声明本关用到的敌人/诡计/故事资产定义（避免覆盖其它战役的全局定义）。
export function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown Red Tide Rising encounter definition: ${code}`)
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
export const AGENDA_STAGE_1 = Object.freeze(stage(AGENDA1_CODE, { number: 1, doom: 12 }))
export const AGENDA_STAGE_2 = Object.freeze(stage(AGENDA2_CODE, { number: 2, doom: 10 }))
export const ACTS = Object.freeze([structuredClone(ACT_STAGE)])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGE_1), structuredClone(AGENDA_STAGE_2)])
export const STAGE_CARDS = Object.freeze({
  [ACT_CODE]: structuredClone(ACT_STAGE),
  [AGENDA1_CODE]: structuredClone(AGENDA_STAGE_1),
  [AGENDA2_CODE]: structuredClone(AGENDA_STAGE_2),
})

// ---------------------------------------------------------------------------
// 混乱标记（90041 正面 = 简单/普通，背面 = 困难/专家）
// ---------------------------------------------------------------------------
export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为胜利区[[嫌犯]]与[[窝点]]卡牌数量总和的一半（向上取整）。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。（与[[嫌犯]]敌人谈判或调查[[窝点]]地点时改为 -4。）', delta: -2 }),
    tablet: Object.freeze({ text: '-3。如果你检定成功，查看迹象牌堆顶的牌，你可以选择是否混洗迹象牌堆。', delta: -3 }),
    elderthing: Object.freeze({ text: '-1。如果你检定失败，将遭遇牌库顶的牌洗入迹象牌堆。', delta: -1 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为胜利区[[嫌犯]]与[[窝点]]卡牌数量总和。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。（与[[嫌犯]]敌人谈判或调查[[窝点]]地点时改为 -5。）', delta: -3 }),
    tablet: Object.freeze({ text: '-4。如果你检定成功，查看迹象牌堆顶的牌，你可以选择是否混洗迹象牌堆。', delta: -4 }),
    elderthing: Object.freeze({ text: '-2。如果你检定失败，将遭遇牌库顶的牌洗入迹象牌堆。', delta: -2 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

// ---------------------------------------------------------------------------
// 剧情正文（中文；英文正文见指南源）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '红潮涌起',
  intro: '人们从不在乎被落下的人。这是你离开孤儿院后，在街头学到的第一件事。你只能靠自己，用尽一切办法勉强过活。'
    + '到目前为止，凭着你的机灵和妈妈被他们带走前留给你的护身符，你总算活了下来。偶尔会有人发善心，往你的杯子里丢一两个硬币；'
    + '某个美好的早晨，一位从维尔玛餐厅出来的好心女士给了你她吃剩的香肠和鸡蛋。但大多数时候，你能依靠的只有你自己。'
    + '其他街头小混混也许和你同坐一条船，但你几乎不会称他们为朋友——也许詹姆斯算一个，那也已经很勉强。'
    + '不，饥饿、孤独、无聊和怀疑才是你最好的、也是仅有的朋友。而且尽管如此，这一切还是比孤儿院要好。'
    + '然后，那个决定命运的日子来了。它开始得和别的日子没什么两样：你和詹姆斯在河滨区转悠，「收集」任何能卖给奥利弗·托马斯的东西。'
    + '剩下的无疑会落到马文的帮派手里——那群抱团的街头孩子欺负其余所有人——但你的收获里有一样小玩意儿吸引了你的目光：一张照片。'
    + '不是普通的照片，而是你父亲的照片。绝不会认错。你心里没有任何怀疑。照片里，父亲站在一栋你不认识的建筑前。'
    + '他身后的招牌看起来是另一种语言，所以那大概是在很远很远的地方。无法判断照片是多久以前拍的。它破旧、肮脏，好几处都有缺口。'
    + '你把它翻过来，那里用熟悉的笔迹写着：「红潮就要涌起了。保护好自己，我的小女孩。」'
    + '你求詹姆斯告诉你照片从哪来，他说一个穿长羊毛外套、戴深棕色圆顶礼帽的男人在你撞上马文的帮派之前把它丢进了你的杯子。'
    + '你立刻出发，四处打听那个戴圆顶礼帽的人。你……',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的全部卡牌：红潮涌起、艾莲娜·哈珀失踪案、达贡的代理人、印斯茅斯之雾、本地人、地窖寒风、上锁的门、夜鹰、午夜假面。' },
    { key: 'midnightMasks', text: '收集午夜假面遭遇组时，只收集五张诡计牌（2 张虚假线索与 3 张猎影）。不要收集该组的其它卡牌。' },
    { key: 'scenarioReference', text: '将「艾莲娜·哈珀失踪案」遭遇组原有的剧本提示卡移出游戏；改用「红潮涌起」遭遇组提供的新提示卡。' },
    { key: 'actAgendaDeck', text: '将「艾莲娜·哈珀失踪案」遭遇组的所有幕与议程移出游戏；仅用「红潮涌起」遭遇组提供的新幕与议程组成幕牌库与议程牌库。' },
    { key: 'placeLocations', text: '将以下地点放入场：印斯茅斯广场、沼泽精炼厂、印斯茅斯港、鱼街桥、第一国民杂货店、吉尔曼宅邸、小书店。' },
    { key: 'leadsDeck', text: '准备迹象牌堆：找出带有[[嫌犯]]特性的 6 名独特敌人，以及带有[[窝点]]特性的 6 处单面地点，将这 12 张卡牌洗混成迹象牌堆，放在剧本提示卡旁。' },
    { key: 'drawLead', text: '抽取迹象牌堆顶的卡牌并结算其显现能力。如果它是地点，温蒂·亚当斯从该地点开始；如果它是敌人，温蒂·亚当斯从该敌人的所在地点开始。其他每位调查员从印斯茅斯广场开始。' },
    { key: 'setAsideMonsters', text: '将以下每名[[怪物]]敌人放在一边：翼魔（Winged One）与 2 张夜鹰猎手（Hunting Nightgaunt）。' },
    { key: 'setAsideAngryMob', text: '将愤怒暴民放在一边。' },
    { key: 'adjustments', text: '根据调查员人数（困难难度人数 +1，专家难度人数 +2）：2 名调查员时，在议程 1 上放置 1 点毁灭；3 名调查员时放置 2 点；4 名调查员时，将 1 张随机放一边的[[怪物]]敌人洗入迹象牌堆。' },
    { key: 'removeStoryAssets', text: '将托马斯·道森与艾莲娜·哈珀这两张故事资产移出游戏。' },
    { key: 'mysteriousPhoto', text: '将双面神秘相片故事资产放入场，置于温蒂·亚当斯的控制之下；温蒂可以选择它以哪一面朝上入场。除温蒂·亚当斯被淘汰外，神秘相片不能离场。' },
    { key: 'shuffleRemainder', text: '将其余遭遇卡洗混，组成遭遇牌库。' },
    { key: 'readyToBegin', text: '准备开始。' },
  ]),
  specialRules: Object.freeze([
    {
      title: '寻找父亲',
      text: '本剧本中，温蒂正在印斯茅斯寻找父亲的任何线索。迹象牌堆包含 6 名[[嫌犯]]敌人与 6 处[[窝点]]地点。'
        + '当[[嫌犯]]与[[窝点]]卡牌离场时，温蒂必须从迹象牌堆抽取新的线索。目标是在议程 2b 之前清空迹象牌堆——牌堆剩下的牌越少越好。',
    },
    {
      title: '神秘相片',
      text: '除使用温蒂控制的双面神秘相片故事资产外，[[嫌犯]]与[[窝点]]卡牌不能加入胜利区。'
        + '其正面能力让温蒂与[[嫌犯]]敌人谈判，并让所在地点的调查员共同花费线索，把没有线索的[[嫌犯]]加入胜利区；'
        + '其背面能力通过调查对[[窝点]]地点做同样的事。每张以此法加入胜利区的卡牌都会提高剧本结束时的经验。',
    },
  ]),
  rules: Object.freeze({
    leadsDeck: '迹象牌堆使用引擎通用 scenarioDecks（id = leads）：顶牌在数组末尾；查看/洗入/移出都走同一原语。',
    photo: '神秘相片以剧本标记记录当前面与横置状态：每轮可发动一次（近似：印刷的「横置」代价用每轮一次代替）。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若没有任何调查员达成结局：如果全员被击败，按结局 2 结算；否则按结局 1 结算。'
      + '你不会获得[[嫌犯]]与[[窝点]]卡牌的胜利点数；改为温蒂·亚当斯从胜利区第 3 张卡之后每张获得 1 点经验，'
      + '其他调查员从第 5 张之后每张获得 1 点经验。',
    resolution1: '结局 1：你没有找到父亲，但找到了退而求其次的东西：那个戴棕色圆顶礼帽的男人。'
      + '他告诉你父亲卷入了很糟糕的人，但想脱身；他不能回家，否则你和自己都会有危险。'
      + '你不会获得[[嫌犯]]与[[窝点]]卡牌的胜利点数；改为温蒂·亚当斯从胜利区第 3 张卡之后每张获得 1 点经验，'
      + '其他调查员从第 5 张之后每张获得 1 点经验。'
      + '若温蒂·亚当斯被击败，她必须将《被遗弃与被孤立》升级为进阶版，或把温蒂的护身符进阶版降级为原本版本；'
      + '若她未被击败，她可以将温蒂的护身符升级为进阶版，或把《被遗弃与被孤立》进阶版降级为原本版本。',
    resolution2: '结局 2：你等追兵转过街角，悄悄回到公交站，搭上下一班回阿卡姆的车。你愤怒地揉皱父亲照片的边缘。'
      + '一滴眼泪滑下脸颊。你仍然没有真正的线索。那个戴圆顶礼帽和穿羊毛外套的男人是谁？你卷入了什么？'
      + '但再看一眼照片，一个希望仍留在你心中：父亲还活着。他一定还活着。'
      + '你不会获得[[嫌犯]]与[[窝点]]卡牌的胜利点数；改为温蒂·亚当斯从胜利区第 3 张卡之后每张获得 1 点经验，'
      + '其他调查员从第 5 张之后每张获得 1 点经验。'
      + '温蒂·亚当斯必须将《被遗弃与被孤立》升级为进阶版，或把温蒂的护身符进阶版降级为原本版本。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT_CODE]: '[[嫌犯]]与[[窝点]]卡牌不能加入胜利区，除非使用神秘相片。'
    + '强制 - 如果场上没有[[嫌犯]]或[[窝点]]卡牌：温蒂·亚当斯必须从迹象牌堆顶依次抽卡，直到抽到一张[[嫌犯]]或[[窝点]]卡牌。'
    + '目标 - 使用神秘相片寻找父亲。迹象牌堆剩余的卡牌越少越好；如果它为空，推进。',
})

export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA1_CODE]: '强制 - 在本密谋将因达到毁灭阈值而推进时：改为移除场上所有毁灭标记，并将随机一张放在一边的[[怪物]]敌人洗入迹象牌堆。'
    + '然后，如果没有[[怪物]]敌人被放在一边，推进至密谋 1b。',
  [AGENDA2_CODE]: '愤怒暴民不能被击败。'
    + '[reaction] 当温蒂·亚当斯躲避愤怒暴民后：她可以发现其所在地点的 1 个线索。'
    + '所有[[嫌犯]]敌人失去冷漠，且入场时额外带有 1[per_investigator] 个线索。'
    + '所有[[窝点]]地点获得 +1[per_investigator] 个线索数量。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, connections]) => [
  id,
  location({ id, code, connections, ...(HIDEOUT_LOCATION_IDS.includes(id) ? { hideout: true } : {}) }),
])))

export const LOCATION_CODES = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code]) => [id, code])))

const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES,
  ...SUSPECT_CODES, ANGRY_MOB_CODE, ...MONSTER_CODES,
])
Object.assign(definitions.storyAssets, encounterDefinitions(PHOTO_CODES).storyAssets)
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT_CODE, ...AGENDA_CODES, ...PHOTO_CODES,
  ...LOCATION_TABLE.map(([, code]) => code),
  ...SUSPECT_CODES, ANGRY_MOB_CODE, ...MONSTER_CODES,
  ...ENCOUNTER_DECK_CODES,
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '红潮涌起 · Red Tide Rising',
  nameEn: 'Red Tide Rising',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：平行温蒂·亚当斯必须在场（本批 1 人独立开局）；Leads deck 用引擎 scenarioDecks 原语（id=leads）。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...HIDEOUT_LOCATION_IDS],
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
