// 狼人诅咒（Curse of the Rougarou · 81001）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/CurseOfTheRougarou.hs（Setup / 地点堆随机 / 混乱袋 / 结局）
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/CurseOfTheRougarou.hs（连接图标、特性、胜利点）
//   Act|Agenda|Enemy|Treachery/Cards/CurseOfTheRougarou/*.hs（幕/议程背面与卡牌规则）
//   frontend/src/locales/en/standalone/curseOfTheRougarou.json（intro/setup/resolutions 印刷文本）
//
// 本关三条特有口径（参考实现）：
//   1. 12 张地点分 4 堆（New Orleans / Riverside / Wilderness / Unhallowed，每堆 3 张、其中 1 张带
//      [[Bayou]] 特性）：Setup 随机移除 1 堆、随机选 1 堆入场（该堆的 [[Bayou]] 地点为起始地点），
//      其余 2 堆放一边；幕 1 背面把放一边的 6 张地点全部放入场。
//   2. 幕 1 背面：Lady Esprit 入场、生成狼人（非河口地点）、把 Curse of the Rougarou 弱点放进队长威胁区，
//      并把狼人遭遇组洗入遭遇牌库（参考 shuffleEncounterDiscardBackIn + shuffleCardsIntoDeck）。
//   3. 幕 2 背面需要同时满足 4 个条件才进入结局 3，否则翻回幕 2a（参考 RevertAct）。
//
// 剧情/指南正文由 `content/scenario-guide-sources/curseOfTheRougarou.json` 提供；
// 本文件 SCENARIO_TEXT 只放布置步骤与结局的忠实中译，方便设置面板在指南落地前可用。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'curseOfTheRougarou'
export const REFERENCE_CODE = '81001'
export const ENCOUNTER_CODE = 'bayou'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT1_CODE = '81005' // Finding Lady Esprit
export const ACT2_CODE = '81006' // Hunting the Rougarou
export const ACT_CODES = Object.freeze([ACT1_CODE, ACT2_CODE])
export const AGENDA1_CODE = '81002' // A Creature of the Bayou
export const AGENDA2_CODE = '81003' // The Rougarou Feeds
export const AGENDA3_CODE = '81004' // The Curse Spreads
export const AGENDA_CODES = Object.freeze([AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3'])

// 狼人遭遇组（81028–81036）：Setup 放一边，幕 1 背面洗入遭遇牌库（狼人本体直接生成）。
export const ROUGAROU_SET_CODES = Object.freeze([
  '81028', '81029', '81030', '81031', '81032', '81033', '81034', '81035', '81036',
])
export const ROUGAROU_ENEMY_CODE = '81028'
export const CURSE_WEAKNESS_CODE = '81029'
export const ROUGAROU_SET_DECK_CODES = Object.freeze(
  ROUGAROU_SET_CODES.filter(code => ALL_CARDS[code]?.type === 'treachery' || ALL_CARDS[code]?.type === 'enemy')
    .filter(code => code !== ROUGAROU_ENEMY_CODE))

// 剧情资产（Setup 放一边；幕 1 背面 / 地点行动取得）。
export const LADY_ESPIRIT_CODE = '81019'
export const BEAR_TRAP_CODE = '81020'
export const FISHING_NET_CODE = '81021'
export const MONSTROUS_TRANSFORMATION_CODE = '81030'
export const SET_ASIDE_ASSET_CODES = Object.freeze([LADY_ESPIRIT_CODE, BEAR_TRAP_CODE, FISHING_NET_CODE])

// ---------------------------------------------------------------------------
// 地点（12 张；按特性分 4 堆，每堆 1 张 [[Bayou]]）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'cursedShores'
export const START_LOCATION_IDS = Object.freeze([])

// [id, 卡号, 特性堆, 连接, 额外字段]
// 连接按参考 Location/CardDefs 的图标集合（每个地点列出「自身图标 + 可连图标」）：
//   New Orleans: cursedShores(Square)→[Plus,Triangle,Diamond,Hourglass]；garden/broadmoor(Plus)→[Square,Plus]
//   Riverside: brackish(Triangle)→[Squiggle,Square,Diamond,Hourglass]；audubon/faubourg(Squiggle)→[Triangle,Squiggle]
//   Wilderness: forgottenMarsh(Diamond)→[Moon,Square,Triangle,Hourglass]；trapper/twisted(Moon)→[Diamond,Moon]
//   Unhallowed: foulSwamp(Hourglass)→[Equals,Square,Triangle,Diamond]；cairns/ritual(Equals)→[Hourglass,Equals]
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['ritualGrounds', '81017', 'unhallowed',
    Object.freeze(['foulSwamp', 'overgrownCairns']), Object.freeze({ resign: false })]),
  Object.freeze(['gardenDistrict', '81008', 'newOrleans',
    Object.freeze(['cursedShores', 'broadmoor']), null]),
  Object.freeze(['overgrownCairns', '81018', 'unhallowed',
    Object.freeze(['foulSwamp', 'ritualGrounds']), null]),
  Object.freeze(['foulSwamp', '81016', 'unhallowed',
    Object.freeze(['ritualGrounds', 'overgrownCairns', 'cursedShores', 'brackishWaters', 'forgottenMarsh']), null]),
  Object.freeze(['cursedShores', '81007', 'newOrleans',
    Object.freeze(['gardenDistrict', 'broadmoor', 'brackishWaters', 'forgottenMarsh', 'foulSwamp']), null]),
  Object.freeze(['broadmoor', '81009', 'newOrleans',
    Object.freeze(['cursedShores', 'gardenDistrict']), Object.freeze({ resign: true })]),
  Object.freeze(['faubourgMarigny', '81012', 'riverside',
    Object.freeze(['brackishWaters', 'audubonPark']), Object.freeze({ resign: true })]),
  Object.freeze(['brackishWaters', '81010', 'riverside',
    Object.freeze(['audubonPark', 'faubourgMarigny', 'cursedShores', 'forgottenMarsh', 'foulSwamp']), null]),
  Object.freeze(['forgottenMarsh', '81013', 'wilderness',
    Object.freeze(['trappersCabin', 'twistedUnderbrush', 'cursedShores', 'brackishWaters', 'foulSwamp']), null]),
  Object.freeze(['trappersCabin', '81014', 'wilderness',
    Object.freeze(['forgottenMarsh', 'twistedUnderbrush']), null]),
  Object.freeze(['audubonPark', '81011', 'riverside',
    Object.freeze(['brackishWaters', 'faubourgMarigny']), null]),
  Object.freeze(['twistedUnderbrush', '81015', 'wilderness',
    Object.freeze(['forgottenMarsh', 'trappersCabin']), null]),
])

// 四堆定义：堆名 → 地点 id 列表（Setup 随机移除 1 堆、随机 1 堆入场、其余放一边）。
export const PILE_TRAITS = Object.freeze(['newOrleans', 'riverside', 'wilderness', 'unhallowed'])
export const PILE_LOCATIONS = Object.freeze(Object.fromEntries(PILE_TRAITS.map(trait => [
  trait, Object.freeze(LOCATION_TABLE.filter(([, , pile]) => pile === trait).map(([id]) => id)),
])))

// 桌面坐标：按参考布局 4 行 4 列摆放（每堆 1 张在上/左、1 张在中、1 张在下/右）。
export const LOCATION_COORDINATES = Object.freeze({
  ritualGrounds: { x: 1, y: 0 },
  gardenDistrict: { x: 2, y: 0 },
  overgrownCairns: { x: 0, y: 1 },
  foulSwamp: { x: 1, y: 1 },
  cursedShores: { x: 2, y: 1 },
  broadmoor: { x: 3, y: 1 },
  faubourgMarigny: { x: 0, y: 2 },
  brackishWaters: { x: 1, y: 2 },
  forgottenMarsh: { x: 2, y: 2 },
  trappersCabin: { x: 3, y: 2 },
  audubonPark: { x: 1, y: 3 },
  twistedUnderbrush: { x: 2, y: 3 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手（本地实现，不依赖战役层 card-data.js）
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Curse of the Rougarou card: ${code}`)
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
  const { id, code, cluesFixed, clues, hasVictory, connections, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Curse of the Rougarou location: ${code}`)
  return {
    ...printed(code), id, shroud: c.shroud,
    connections: [...(connections || [])],
    ...rest,
    ...(cluesFixed ? { cluesFixed } : { cluesPerInvestigator: clues ?? c.clues ?? 0 }),
    ...(hasVictory ? { victory: c.victory ?? 0 } : {}),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name,
  }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Curse of the Rougarou stage: ${code}`)
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
  'Lowest [agility]': 'lowestAgility',
  'Lowest remaining health': 'lowestRemainingHealth',
  'Most clues': 'mostClues',
})

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown Curse of the Rougarou encounter definition: ${code}`)
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
  const identity = value => ({
    originalCode: value.originalCode || value.code,
    artCode: value.originalCode || value.code,
  })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 遭遇牌库
// ---------------------------------------------------------------------------
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const deckTypes = ['enemy', 'treachery']

// 初始遭遇牌库 = The Bayou 组的敌人/诡计（81022–81027）；狼人组 Setup 放一边、幕 1 背面洗入。
export const ENCOUNTER_GROUPS = Object.freeze(['bayou', 'rougarou'])
export const ENCOUNTER_DECK = Object.freeze(Object.entries(ALL_CARDS)
  .filter(([, card]) => snake(card.encounterCode) === 'bayou' && deckTypes.includes(card.type)
    && !SET_ASIDE_ASSET_CODES.includes(card.code))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 放一边：9 张地点（其中 3 张在入场堆里，运行时按堆随机决定）、狼人组 9 张、
// 3 张剧情资产；狼人组在幕 1 背面洗入/生成。
export const SET_ASIDE_ALIASES = Object.freeze([
  ...LOCATION_TABLE.map(([, code]) => code),
  ...ROUGAROU_SET_CODES,
  ...SET_ASIDE_ASSET_CODES,
])

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  // 目标：仅位于 [[Bayou]] 地点的调查员可作为团队花费每调查员 1 个线索推进（atLocation 由
  // behavior.prepareScenario 按随机入场堆的 Bayou 地点填写）。
  [ACT1_CODE]: Object.freeze({
    ...stage(ACT1_CODE, { number: 1 }),
    objective: { type: 'clues', perInvestigator: 1, atLocation: START_LOCATION },
  }),
  // 目标（行为实现在 behavior.checkObjectives）：
  //  · 狼人被击败 → 结局 2；
  //  · 与狼人交战的调查员可选择推进（每阶段一次）→ 检查 4 项条件，满足进结局 3，否则翻回 2a。
  [ACT2_CODE]: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'custom' } }),
})

export const AGENDA_STAGES = Object.freeze({
  [AGENDA1_CODE]: Object.freeze({ ...stage(AGENDA1_CODE, { number: 1 }), doomThreshold: 5 }),
  [AGENDA2_CODE]: Object.freeze({ ...stage(AGENDA2_CODE, { number: 2 }), doomThreshold: 6 }),
  [AGENDA3_CODE]: Object.freeze({ ...stage(AGENDA3_CODE, { number: 3 }), doomThreshold: 8 }),
})

export const ACTS = Object.freeze([structuredClone(ACT_STAGES[ACT1_CODE]), structuredClone(ACT_STAGES[ACT2_CODE])])
export const AGENDAS = Object.freeze(AGENDA_CODES.map(code => structuredClone(AGENDA_STAGES[code])))
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  ...Object.entries(ACT_STAGES), ...Object.entries(AGENDA_STAGES),
]))

// ---------------------------------------------------------------------------
// 地点定义
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, pile, connections, extra]) => {
  const card = ALL_CARDS[code]
  return [id, {
    ...location({ id, code, connections, ...(extra || {}), ...(card.victory != null ? { hasVictory: true } : {}) }),
    traits: [...(card.traits || [])],
    pile,
  }]
})))

// ---------------------------------------------------------------------------
// 剧情正文（忠实中译；指南生成物以 content/scenario-guide-sources 为准）
// ---------------------------------------------------------------------------
const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: { delta: -2, text: '-2（若你在[[河口]]地点改为 -4）' },
    cultist: { delta: -2, drawAnother: true, text: '-2；若狼人位于你所在地点，再揭示一个混乱标记' },
    tablet: { delta: 0, drawAnother: true, text: '再揭示一个混乱标记；若检定失败，本轮结束前你不能移动' },
    elderthing: { delta: -4, text: '-4；若狼人位于你所在地点，它攻击你' },
  }),
  hard: Object.freeze({
    skull: { delta: -3, text: '-3（若你在[[河口]]地点改为 -6）' },
    cultist: { delta: -3, drawAnother: true, text: '-3；若狼人位于你所在地点，再揭示一个混乱标记' },
    tablet: { delta: 0, drawAnother: true, text: '再揭示一个混乱标记；若检定失败，本轮结束前你不能移动' },
    elderthing: { delta: -4, text: '-4；若狼人在你所在地点或连接地点，它攻击你' },
  }),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; guide source is authoritative)',
  heading: '狼人诅咒',
  intro: '《阿卡姆广告报》的敏妮·克莱因在维尔玛餐厅喝咖啡时，把一篇报道草稿塞给了你。'
    + '若不是主编多伊尔·杰弗里斯嗤之以鼻，这篇报道本已付印。“我敢说他原话是：‘我才不会把某个巫毒疯子的胡言乱语'
    + '当成新闻印出来。’”她解释道。从她脸上蔓延开的狡黠笑容，你能看出她嗅到了一个大新闻。'
    + '标题很耸动：九天之内三起命案，确实足以让一座城心惊胆战。但你怀疑整个新奥尔良并未被恐惧攫住。'
    + '然而有些东西勾起了你的兴趣：报道里那位巫毒女祭司“埃斯普利女士”声称，一道恶毒的诅咒已在河口扎根。'
    + '“这里面有东西，对吧？我认得你那个表情。”敏妮说。埃斯普利女士若没说错，这头“鲁加鲁”绝不会只杀三个人。'
    + '但诅咒？狼人？这种事怎会是真的？只能亲自去看。你披上外套，前往北站……',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的所有卡牌：狼人诅咒（Curse of the Rougarou）与河口（The Bayou）。' },
    { key: 'setAsideEncounterSets', text: '把狼人诅咒遭遇组放到一边（场外）。' },
    { key: 'placeLocations', text: '按特性把每个地点分成 4 堆（新奥尔良、河畔、荒野、不洁之地）。随机选择 1 堆，'
      + '从游戏中移除；再随机选择 1 堆，把它们放入场。其余 2 堆放一边（场外）。每位调查员从场上带 [[Bayou]] 的地点开始游戏。' },
    { key: 'setAside', text: '把以下卡牌放到一边（场外）：埃斯普利女士、捕熊陷阱、渔网。' },
    { key: 'shuffleRemainder', text: '洗混其余卡牌，组成遭遇牌库。' },
  ]),
  specialRules: Object.freeze([
    '幕 1 背面：把放一边的埃斯普利女士放入一个 [[Bayou]] 地点；把放一边的每个地点放入场；'
      + '把放一边的狼人敌人生成在任意非 [[Bayou]] 地点；把遭遇弃牌堆与狼人诅咒遭遇组的每张卡洗入遭遇牌库；'
      + '队长把放一边的“狼人诅咒”弱点放入其威胁区域。',
    '幕 2 背面（翻回判定）：若同时满足「调查员作为团队有 4[per_investigator] 个线索」「狼人上附属着 1 张 [[陷阱]] 卡」'
      + '「狼人上至少有 1[per_investigator] 点伤害」「调查员记得找到过束缚之石或奇怪的玩偶」，则进入结局 3；'
      + '否则翻回幕 2a。',
  ]),
  rules: Object.freeze({
    tokenMeanings: '混乱标记含义见提示卡；[tablet] 检定失败后本轮结束前不能移动。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '没有达成任何结局（每位调查员都撤退或被击败）：你们设法在黎明前回到安全之处，睡到午后。'
      + '第二天去找埃斯普利女士时，你才得知昨夜遇害的是谁。怀着沉重的心情与挥之不去的恐惧，'
      + '你选择埋葬她的尸体而非通知当局——越少人深入这片河口越好。',
    resolution1: '结局 1：你们设法在黎明前回到安全之处，睡到午后。第二天去找埃斯普利女士时，你才得知昨夜遇害的是谁。'
      + '怀着沉重的心情与挥之不去的恐惧，你选择埋葬她的尸体而非通知当局。',
    resolution2: '结局 2：随着漆黑的泥血从伤口渗出，那生物发出一声可怜的哀嚎。当它的身体瘫倒在泥里时，'
      + '已变回原本的模样——一个年轻、深色皮肤的男人，表情扭曲在痛苦中。你把他的尸体带回埃斯普利女士那里，'
      + '她施展奇异法术，洗净了大地上的诅咒污痕。“若你需要我的帮助，随时呼唤我。”这位神秘女子说。',
    resolution3: '结局 3：你们设法平息了那生物体内诅咒的愤怒与嗜血，片刻之后，一个年轻、深色皮肤的男人站在你们面前，'
      + '喘息着、汗流浃背。他仿佛此刻才明白自己做过的一切，同意逃到大地某个偏僻角落，再不能伤害任何人。'
      + '然而诅咒并未消失：他在你眼中看到了它，紧紧抓住你的手臂。“别让它控制你。”他警告道。“我曾软弱，但你——'
      + '我看得出你很坚强。像我未能做到的那样，控制住这诅咒。”',
  }),
  resolutionBranches: Object.freeze({
    resolution1: '在剧本日志中记录「狼人继续在河口出没」。每位调查员获得等同于胜利区每张卡牌胜利 X 值的经验。',
    resolution2: '在剧本日志中记录「狼人已被消灭，诅咒已解除」。移除持有者牌组中的“狼人诅咒”弱点。'
      + '任意一位调查员可选择把埃斯普利女士加入其牌组（不计入牌组张数）。每位调查员获得胜利区经验。',
    resolution3: '在剧本日志中记录「狼人逃走，你拥抱了诅咒」。诅咒持有者必须把“兽性变化”加入其牌组（不计入牌组张数）。'
      + '每位调查员获得胜利区经验。',
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...ROUGAROU_SET_CODES,
])
// 81029「狼人诅咒」是诡计型弱点：显现后进入威胁区域（参考 CreateWeaknessInThreatArea）。
// 通用揭示分支读 definition.treacheries[code].threat（treachery-tokens.js）。
definitions.treacheries[CURSE_WEAKNESS_CODE].threat = true
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_TABLE.map(([, code]) => code),
  ...ENCOUNTER_DECK_CODES, ...ROUGAROU_SET_CODES, ...SET_ASIDE_ASSET_CODES,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '狼人诅咒 · Curse of the Rougarou',
  nameEn: 'Curse of the Rougarou',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: "依照剧本参考卡 81001 与参考侧支线的设置页布置：地点按四堆随机抽放、放一边组与狼人组按幕 1 背面洗入；独立开局每人 1 XP。",
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
