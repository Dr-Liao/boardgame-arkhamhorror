// 安魂镇息（Laid to Rest · 90054）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/LaidToRest.hs（setup / 混乱袋 / 结局 / 幽灵遭遇牌库）
//   Act|Agenda|Enemy|Location|Story CardDefs（LaidToRest / TheWagesOfSin / Standalone）
//   frontend/src/locales/en/standalone/laidToRest.json（intro / setup / tokens / resolutions）
//
// 归属：本关专属卡 90054–90058（90054 为剧本提示卡），遭遇组 laid_to_rest；
// 地点与异端者复用《万象无终·恶罪报应》（The Wages of Sin，05166–05176）；
// 额外遭遇牌库 group：the_wages_of_sin / anettes_coven / city_of_sins / inexorable_fate /
// realm_of_death / trapped_spirits / witchcraft。幽灵遭遇牌库 = 这些组里带 [[幽灵]] 特性的
// 非地点单面卡；其余进基础遭遇牌库（双牌堆运行时由 alt-decks 的 spectral 槽承载）。
//
// 本关口径（近似项见 behavior.js 文件头）：
//   1. 吉姆·卡尔弗（平行 90049）必须在场；全员从绞刑者河开始。
//   2. 每组双面地点随机选 1 张入场（非幽灵面）；地点全部已揭示。
//   3. 6 张异端者敌人随机 2 张移出游戏，其余 4 张洗入灵魂牌库；彼端（90052）放在吉姆场上。
//   4. 4 个饥饿之魂暗置在绞刑架 / 异端者墓地 / 教堂阁楼 / 教堂地下室下方。
//   5. 让·德弗罗（90057a Seeking Closure）生成在绞刑者河。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  spectralLocation, linkSymbolLocations, stages, encounterCards, encounterDefinitions,
  encounterDeck, storyCards, identitiesFor, printed,
} from '../../../theCircleUndone/card-data.js'

export const CHAPTER_ID = 'laidToRest'
export const REFERENCE_CODE = '90054'
export const ENCOUNTER_CODE = 'laid_to_rest'
export const KEY_INVESTIGATOR = '90049' // 平行吉姆·卡尔弗
export const ACT_CODE = '90056'
export const AGENDA_CODE = '90055'
export const JEAN_SEEKING_CODE = '90057a'
export const JEAN_POSSESSED_CODE = '90057b'
export const RAVENOUS_CODE = '90058'
export const BEYOND_CODE = '90052'
export const VENGEFUL_SHADE_CODE = '90053'
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// 异端者：敌人面 ↔ 未了之事面（6 对；setup 随机 2 张移出、4 张洗入灵魂牌库）。
export const HERETIC_FACES = Object.freeze([
  { enemy: '05178a', story: '05178b' },
  { enemy: '05178c', story: '05178d' },
  { enemy: '05178e', story: '05178f' },
  { enemy: '05178g', story: '05178h' },
  { enemy: '05178i', story: '05178j' },
  { enemy: '05178k', story: '05178l' },
])
export const HERETIC_ENEMY_CODES = HERETIC_FACES.map(face => face.enemy)
export const UNFINISHED_BUSINESS_CODES = HERETIC_FACES.map(face => face.story)

// 灵魂牌库候选：9 张不同的 [[盟友]] 支援（任意职介、0–2 级），按参考构筑建议固定一组，
// 使独立剧本无需玩家牌组也能开局（近似：真实规则由玩家从收藏挑选）。
export const SPIRIT_ALLY_CODES = Object.freeze([
  '01018', '01021', '01032', '01033', '01048', '01055', '01063', '01076', '01082',
])

// 遭遇组（snake_case 由 tcu card-data 归一化）。
export const ENCOUNTER_GROUPS = Object.freeze([
  'laid_to_rest', 'the_wages_of_sin', 'anettes_coven', 'city_of_sins',
  'inexorable_fate', 'realm_of_death', 'trapped_spirits', 'witchcraft',
])

// 地点：每组双面地点随机选 1 张；教堂阁楼固定 C176a（C175a 移出游戏）。
export const LOCATION_PAIRS = Object.freeze({
  theGallows: Object.freeze(['theGallows169', 'theGallows170']),
  hereticsGraves: Object.freeze(['hereticsGraves171', 'hereticsGraves172']),
  chapelCrypt: Object.freeze(['chapelCrypt173', 'chapelCrypt174']),
})
export const FIXED_LOCATION_IDS = Object.freeze(['hangmansBrook', 'hauntedFields', 'abandonedChapel', 'chapelAttic176'])
export const START_LOCATION = 'hangmansBrook'

const makeSpectralLocation = (id, frontCode, extra = {}) =>
  spectralLocation(id, frontCode, ALL_CARDS[frontCode].linkedCardCode, extra)

// 闹鬼面文本（印刷）；近似：由 behavior.locationFlipped 把文本/效果挂到地点实例。
export const HAUNTED_BY_LOCATION = Object.freeze({
  hangmansBrook: [{ text: '闹鬼 - 受到 1 点伤害。直到一轮结束，不能触发上述撤退能力。', effect: [{ kind: 'damage', amount: 1 }] }],
  hauntedFields: [{ text: '闹鬼 - 将最近的幽灵敌人向闹鬼农田移动一次。', effect: [{ kind: 'moveNearestSpectral' }] }],
  abandonedChapel: [{ text: '闹鬼 - 直到一轮结束，你获得每项技能 -1。', effect: [{ kind: 'roundSkillPenalty' }] }],
  theGallows169: [{ text: '闹鬼 - 弃掉基础遭遇牌库顶 3 张卡牌；若有女巫敌人因此被弃，将其抽取。', effect: [{ kind: 'discardStandard' }] }],
  theGallows170: [{ text: '闹鬼 - 弃掉幽灵遭遇牌库顶 3 张卡牌；若有灵怪敌人因此被弃，将其抽取。', effect: [{ kind: 'discardSpectral' }] }],
  hereticsGraves171: [{ text: '闹鬼 - 你的基础意志值减至 1，直到你下个回合结束。', effect: [{ kind: 'baseWillpowerOne' }] }],
  hereticsGraves172: [{ text: '闹鬼 - 治愈场上每个异端者和女巫敌人 1 点伤害。', effect: [{ kind: 'healHeretics' }] }],
  chapelCrypt173: [{ text: '闹鬼 - 生成一个苏生亡者敌人（1/1/1/1，[[怪物]]）与你交战。', effect: [{ kind: 'spawnReanimated' }] }],
  chapelCrypt174: [{ text: '闹鬼 - 找出基础遭遇弃牌堆顶部的 1 张巫术诡计，放进你的威胁区域。', effect: [{ kind: 'hexToThreat' }] }],
  chapelAttic176: [{ text: '闹鬼 - 随机弃掉你 1 张手牌（如果你有至少 5 张手牌，改为弃 2 张）。', effect: [{ kind: 'randomDiscard' }] }],
})

// 桌面坐标：绞刑者河为起点，按印刷符号连接就近展开（只服务展示）。
export const LOCATION_COORDINATES = Object.freeze({
  hauntedFields: { x: 0, y: 0 },
  abandonedChapel: { x: 2, y: 0 },
  hangmansBrook: { x: 1, y: 1 },
  theGallows169: { x: 1, y: 2 },
  theGallows170: { x: 1, y: 2 },
  hereticsGraves171: { x: 2, y: 1 },
  hereticsGraves172: { x: 2, y: 1 },
  chapelCrypt173: { x: 0, y: 2 },
  chapelCrypt174: { x: 0, y: 2 },
  chapelAttic176: { x: 0, y: 1 },
})

const locations = {
  hangmansBrook: makeSpectralLocation('hangmansBrook', '05166', {
    symbol: 'squiggle', links: ['circle', 'plus'], hauntedGroup: 'hangmansBrook', resignAction: 'resignHangmansBrook',
  }),
  hauntedFields: makeSpectralLocation('hauntedFields', '05167', {
    symbol: 'circle', links: ['squiggle', 'plus', 'triangle', 'square'], hauntedGroup: 'hauntedFields',
  }),
  abandonedChapel: makeSpectralLocation('abandonedChapel', '05168', {
    symbol: 'plus', links: ['squiggle', 'circle', 'diamond', 'moon'], hauntedGroup: 'abandonedChapel',
  }),
  theGallows169: makeSpectralLocation('theGallows169', '05169', {
    symbol: 'triangle', links: ['circle', 'square'], hauntedGroup: 'theGallows169',
  }),
  theGallows170: makeSpectralLocation('theGallows170', '05170', {
    symbol: 'triangle', links: ['circle', 'square'], hauntedGroup: 'theGallows170',
  }),
  hereticsGraves171: makeSpectralLocation('hereticsGraves171', '05171', {
    symbol: 'square', links: ['triangle', 'circle'], hauntedGroup: 'hereticsGraves171',
  }),
  hereticsGraves172: makeSpectralLocation('hereticsGraves172', '05172', {
    symbol: 'square', links: ['triangle', 'circle'], hauntedGroup: 'hereticsGraves172',
  }),
  chapelCrypt173: makeSpectralLocation('chapelCrypt173', '05173', {
    symbol: 'diamond', links: ['plus', 'moon'], hauntedGroup: 'chapelCrypt173',
  }),
  chapelCrypt174: makeSpectralLocation('chapelCrypt174', '05174', {
    symbol: 'diamond', links: ['plus', 'moon'], hauntedGroup: 'chapelCrypt174',
  }),
  chapelAttic176: makeSpectralLocation('chapelAttic176', '05176', {
    symbol: 'moon', links: ['plus', 'diamond'], hauntedGroup: 'chapelAttic176',
  }),
}
// 05170 的印表隐藏值 X 按 0 占位（由 behavior.locationShroudModifier 给出）。
locations.theGallows170.shroud = 0
if (locations.theGallows170.back) locations.theGallows170.back.shroud = 0
linkSymbolLocations(locations)
export const LOCATIONS = Object.freeze(locations)

// 遭遇牌：异端者 / 饥饿之魂 / 让 / 幽灵迷网不进两个牌库。
const DECK_EXCLUDED = new Set([
  ...HERETIC_ENEMY_CODES, RAVENOUS_CODE, JEAN_SEEKING_CODE, JEAN_POSSESSED_CODE,
  '05177', // Spectral Web：setup 移出游戏
])
const gathered = encounterCards(ENCOUNTER_GROUPS).filter(card => !DECK_EXCLUDED.has(card.code))
const isSpectralCard = card => (card.traits || []).some(trait => String(trait).toLowerCase() === 'spectral')
export const SPECTRAL_DECK_CODES = Object.freeze(encounterDeck(gathered.filter(isSpectralCard)))
const standardCards = gathered.filter(card => !isSpectralCard(card))
export const STANDARD_DECK_CODES = Object.freeze(encounterDeck(standardCards))

const extraEnemyRules = {
  [RAVENOUS_CODE]: { keywords: ['aloof', 'patrol', 'retaliate'], healthPerPlayerBonus: 2, victory: 1 },
  [JEAN_SEEKING_CODE]: { keywords: ['aloof', 'patrol'], healthPerPlayerBonus: 0 },
  [JEAN_POSSESSED_CODE]: { keywords: ['hunter'], healthPerPlayerBonus: 0 },
  ...Object.fromEntries(HERETIC_FACES.map(face => [face.enemy, { healthPerPlayerBonus: 2 }])),
}
const definitions = encounterDefinitions([
  ...gathered,
  ...HERETIC_ENEMY_CODES.map(code => ALL_CARDS[code]),
  ALL_CARDS[RAVENOUS_CODE], ALL_CARDS[JEAN_SEEKING_CODE], ALL_CARDS[JEAN_POSSESSED_CODE],
  ALL_CARDS['05177'],
].filter(Boolean), extraEnemyRules)

export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为胜利区「未了之事」数量 +1。', delta: 0 }),
    cultist: Object.freeze({ text: '-X。X 为附属在彼端上的卡牌数量。', delta: 0 }),
    tablet: Object.freeze({ text: '-X。X 为场上的[[幽灵]]地点数量。', delta: 0 }),
    elderthing: Object.freeze({ text: '-2。如果你所在地点有[[灵怪]]敌人，再揭示一个混乱标记。', delta: -2 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为胜利区「未了之事」数量 +2。', delta: 0 }),
    cultist: Object.freeze({ text: '-X。X 为附属在彼端上的卡牌数量的两倍。', delta: 0 }),
    tablet: Object.freeze({ text: '-X。X 为场上的[[幽灵]]地点数量的两倍。', delta: 0 }),
    elderthing: Object.freeze({ text: '-3。如果你所在地点有[[灵怪]]敌人，自动失败。', delta: -3 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '挑战剧本：安魂镇息',
  intro: '死者不得安息。无论你走到哪里，都能听见他们说话、低语、哭泣、尖叫。有时他们彼此交谈，有时独自絮叨。'
    + '他们反复念叨着生前所爱的人、做过的工作，或是死前藏在木地板下的钱财。最常见的总是吃喝。死者永远饥饿。'
    + '有时当他们发现你能听见，就会围拢到你耳边低语，托付最后的愿望。能帮的时候你总会帮，但他们想让你照顾的人往往也已经死了。'
    + '你许下许多空头承诺，至少这能让他们安静下来。'
    + '\n\n事情并不总是如此。死者开始说话，是在你父亲死于法语区那栋猎枪式老宅的那天。你回到家，看见他站在客厅里自己的尸体旁；'
    + '你还没来得及开口，他就消失了。从那天起，每当你吹起父亲的号角，就会听见一片嘈杂的人声。其中有些是人类。'
    + '但还有别的东西——非人唇间刺耳的哀号，喉咙深处发出的哭喊，以及从阴影里窥视的一张张微光闪烁的幽灵面孔。'
    + '\n\n让帮你理清了这一切。他在波旁街的街角停下脚步，听你卖艺，注意到你久久凝视着脚边那个幽灵。他也看见了。'
    + '让自我介绍说他是个灵媒，让你去布罗德莫区他的店里找他。他告诉你关于死者、关于坟墓彼端的一切，也告诉你与它们为伴太久要付出的代价。'
    + '\n\n是死者把你引到了阿卡姆。你靠着吹奏父亲的号角勉强维生；你吹奏时，死者的声音就更响。有时他们甚至称赞你的音乐。'
    + '昨晚，让在四叶草俱乐部外找到了正在卖艺的你，几乎就像你们初次相遇那样。你看得出他不对劲：面容枯槁，像好几天没睡。'
    + '让告诉你，你的父亲想见你……',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'spiritDeck', text: '无论使用哪个版本的吉姆·卡尔弗，都按平行版调查员卡上的构筑要求组建灵魂牌库；把彼端（90052）签名牌与灵魂牌库一起置于吉姆·卡尔弗的场上。' },
    { key: 'gatherSets', text: '收齐以下遭遇组：安魂镇息、恶罪报应、安妮特的女巫集会、罪恶之城、在劫难逃、冥界、被困的灵魂、巫法。除安魂镇息外均可在《万象无终》战役扩展中找到。' },
    { key: 'removeCards', text: '将《恶罪报应》遭遇组原本的剧本参考卡、幕与议程、以及幽灵迷网故事资产移出游戏；改用本扩展提供的剧本参考卡、幕与议程。' },
    { key: 'placeLocations', text: '从每组双面地点（绞刑架、异端者墓地、教堂地下室）中随机选 1 张入场，并放入教堂阁楼（C176a）；其余版本移出游戏。然后放入闹鬼农田、废弃教堂、绞刑者河。' },
    { key: 'nonSpectral', text: '每个地点都以非[[幽灵]]面入场（本关中途翻面不算「揭示」新的地点）。' },
    { key: 'clues', text: '在每个没有线索的地点上放置线索，直到每个地点至少有 1[per_investigator] 个线索。' },
    { key: 'startAt', text: '每位调查员从绞刑者河开始。' },
    { key: 'heretics', text: '随机将 2 张异端者敌人移出游戏；把其余每张异端者敌人（敌人面朝上）洗入灵魂牌库。' },
    { key: 'jeanDevereux', text: '将双面的让·德弗罗敌人以 Seeking Closure 面朝上生成在绞刑者河。' },
    { key: 'ravenousSpirits', text: '在以下地点下方各暗置 1 个饥饿之魂敌人：绞刑架、异端者墓地、教堂阁楼、教堂地下室。' },
    { key: 'encounterDecks', text: '本关使用两套遭遇牌库：把其余带[[幽灵]]特性的卡牌洗成幽灵遭遇牌库，其余卡牌洗成基础遭遇牌库。' },
  ]),
  specialRules: Object.freeze([
    { title: '幽灵遭遇牌库', text: '本关构筑两套遭遇牌库：基础与幽灵。调查员在带[[幽灵]]特性的地点时，使用幽灵遭遇牌库处理一切与遭遇牌库的互动；否则使用基础遭遇牌库。两套牌库各有弃牌堆。' },
    { title: '闹鬼（Haunted）', text: '「闹鬼 -」是地点上的能力。调查员调查地点时若检定失败，结算该地点上所有「闹鬼 -」能力。' },
    { title: '彼端与灵魂牌库', text: '灵魂牌库是游戏开始时洗好放在彼端旁的独立牌库；它免疫除彼端强制效果外的所有玩家卡效果。幽灵只保留名称与文本框，不占槽位、没有生命/神智值。' },
    { title: '巡逻（Patrol）', text: '敌人阶段中，每个重整、未交战的巡逻敌人沿最短路径向指定地点移动一次。' },
  ]),
  rules: Object.freeze({
    beyond: '彼端：附属的灵魂失去印刷特性并获得[[灵怪]]特性；伤害/恐惧将被分配到附属灵魂时改为放到吉姆·卡尔弗身上。你的回合开始时，把灵魂牌库顶的牌正面朝上附到彼端上作为一个灵魂；若有 4 张或更多附属灵魂，翻面彼端并结算另一面。',
    spiritDeck: '灵魂牌库顶的牌被弃置时改为放到灵魂牌库底（近似由 behavior 记账）。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若没有任何调查员达成结局（全员撤退或被击败）：按结局 2 结算。',
    resolution1: '结局 1：迷雾中幻影般的身影聚拢又消散。你握住让的手，灵媒昏死过去。黑暗里，你看见父亲的脸：他的笑纹、他和善的眼睛、他的微笑。父亲终于与你同在。这一瞬被让猛然倒吸一口气打断——他醒了，你父亲的脸随即消失，只留下你独自一人。'
      + '你扶起让，听见父亲的声音在耳边鼓励你，压过了满耳争吵的鬼魂。你希望他永远不会安静下来。'
      + '胜利区每张敌人的胜利点数之和即为吉姆·卡尔弗获得的经验；其他每位调查员获得胜利区每张地点的胜利点数之和。吉姆·卡尔弗可以把吉姆的小号升级为进阶版，或把进阶版《最终狂想曲》降级为原本版本。',
    resolution2: '结局 2：让一边咒骂一边扶着你跌跌撞撞地离开绞刑者山丘，垂着头。“抱歉，我的朋友，”他说，“死者会说话，但他们并不总是愿意听。”非人之口发出的一记阴沉呼号扫过旷野，为灵媒的话作了注脚。'
      + '胜利区每张敌人的胜利点数之和即为吉姆·卡尔弗获得的经验；其他每位调查员获得胜利区每张地点的胜利点数之和。吉姆·卡尔弗必须把《最终狂想曲》升级为进阶版，或把进阶版吉姆的小号降级为原本版本。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT_CODE]: '[free] 横置吉姆的小号，或共同花费 1[per_investigator] 个线索：将一个敌人向吉姆·卡尔弗的所在地点移动一次。'
    + '[free] 共同花费 1[per_investigator] 个线索：将你的所在地点翻面。（每个地点团队每轮仅限一次。）'
    + '目标 - 如果胜利区有 4 张「未了之事」，推进场景。',
})
export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA_CODE]: '强制 - 在敌人阶段开始时：让·德弗罗所在地点每有一个重整的饥饿之魂，对其造成 1 点伤害。'
    + '强制 - 如果吉姆·卡尔弗被击败：推进场景。'
    + '[action] 调查员共同花费 2[per_investigator] 个线索：谈判。你驱除了一个灵魂。弃掉灵魂牌库顶的牌。',
})

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
const actStage = {
  ...stages([ACT_CODE], 'act')[0],
  reveal: { type: 'campaignRule' },
  objective: { type: 'manual' },
  advanceText: ALL_CARDS[ACT_CODE].backTextZh || '',
}
const agendaBase = { ...stages([AGENDA_CODE], 'agenda')[0], reveal: { type: 'campaignRule' }, advanceText: ALL_CARDS[AGENDA_CODE].backTextZh || '' }
// 印刷的议程背面会重置/翻回本密谋，因此按 4 个副本书表达累计轨（第 4 次推进进入结局 2）。
export const ACTS = Object.freeze([actStage])
export const AGENDAS = Object.freeze([
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda1', stage: '1a' }),
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda2', stage: '2a' }),
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda3', stage: '3a' }),
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda4', stage: '4a' }),
])
export const STAGE_CARDS = Object.freeze({ [ACT_CODE]: actStage, [AGENDA_CODE]: agendaBase })

const definitionsAll = {
  ...definitions,
  storyAssets: {
    ...storyCards([BEYOND_CODE, ...UNFINISHED_BUSINESS_CODES]),
  },
}

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT_CODE, AGENDA_CODE, JEAN_SEEKING_CODE, JEAN_POSSESSED_CODE, RAVENOUS_CODE,
  BEYOND_CODE, VENGEFUL_SHADE_CODE,
  ...Object.values(locations).map(location => location.originalCode),
  ...STANDARD_DECK_CODES, ...SPECTRAL_DECK_CODES, ...HERETIC_ENEMY_CODES, ...UNFINISHED_BUSINESS_CODES,
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '安魂镇息 · Laid to Rest',
  nameEn: 'Laid to Rest',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：吉姆·卡尔弗（平行版）必须在场；本批为 1 人独立开局，起始经验 3。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations,
  locationsStartRevealed: true,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitionsAll,
  encounterDeck: [...STANDARD_DECK_CODES],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  removedCodes: ['05177', '05175', '05175b'],
  actText: SCENARIO_ACT_TEXT,
  agendaText: SCENARIO_AGENDA_TEXT,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export { printed }

export default scenario
