// 重返聚集于此（returnToTheGathering · 场景参考卡 50011，Return to Night of the Zealot 第一章）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/ReturnToNightOfTheZealot/ReturnToTheGathering.hs（包装 + 布局）
//   Scenario/Scenarios/NightOfTheZealot/TheGathering.hs（setup 的 whenReturnTo / isReturnTo /
//     orSampleIfReturnTo 分支 = 差异清单）
//   Act|Agenda|Enemy|Location|Treachery/CardDefs|Cards/ReturnToNightOfTheZealot/**（新卡行为）
//   src/cards/cards-data.js 中 pack=rtnotz 的 50011–50024（印刷数据：shroud/clues/victory/doom/quantity）。
//
// 与基础章节（nightOfTheZealot/theGathering）的差异：
//   1. 遭遇组追加 returnToTheGathering，ghouls 替换为 ghoulsOfUmordhoth；
//   2. 幕 1 用 50012「神秘通道」替换 01108「被困于此」；幕 2/3 与密谋 1–3 不变；
//   3. 起始地点改为 50013「书房（异常通道）」；新增 50014 会客厅、50015 卧室、50016 浴室；
//   4. 原版书房 01111 与原版走廊 01112 移出游戏；阁楼/地窖各从两张中随机取一张（另一张移出游戏）；
//      新增放一边区地点 50017「墙上的洞」、50019「远在房屋之上」、50021「远在房屋之下」。
//
// 引擎读点：behavior.js（setup/幕背面/密谋背面/目标/结局）；地点揭示在单卡条目的
// locationRule.onReveal（50017–50021）；诡计 50024 在 behavior.resolveEncounterCard。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'returnToTheGathering'
export const REFERENCE_CODE = '50011'
export const ENCOUNTER_CODE = 'return_to_the_gathering'

// ---------------------------------------------------------------------------
// 幕 / 密谋
// ---------------------------------------------------------------------------
export const ACT1_CODE = '50012' // Mysterious Gateway（替换 01108 Trapped）
export const ACT2_CODE = '01109' // The Barrier
export const ACT3_CODE = '01110' // What Have You Done?
export const ACT_CODES = ([ACT1_CODE, ACT2_CODE, ACT3_CODE])
export const AGENDA1_CODE = '01105' // What's Going On?!
export const AGENDA2_CODE = '01106' // Rise of the Ghouls
export const AGENDA3_CODE = '01107' // They're Getting Out!
export const AGENDA_CODES = ([AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE])
export const RESOLUTION_KEYS = (['noResolution', 'r1', 'r2', 'r3'])

// ---------------------------------------------------------------------------
// 遭遇组（id → 印刷 encounterCode）
// ---------------------------------------------------------------------------
export const GROUP_ENCOUNTER_CODES = ({
  returnToTheGathering: 'return_to_the_gathering',
  theGathering: 'torch',
  rats: 'rats',
  ghoulsOfUmordhoth: 'ghouls_of_umôrdhoth',
  strikingFear: 'striking_fear',
  ancientEvils: 'ancient_evils',
  chillingCold: 'chilling_cold',
})
export const ENCOUNTER_GROUP_IDS = (Object.keys(GROUP_ENCOUNTER_CODES))
// Setup：Ghoul Priest（01116）与 Lita（01117）放一边，不进遭遇牌库。
export const SET_ASIDE_CODES = (['01116', '01117'])
const DECK_EXCLUDES = (['01116'])
const DECK_TYPES = (['enemy', 'treachery'])

function expand(cards) {
  return cards.sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}
export function groupDeck(groupIds, exclude = []) {
  const codes = new Set(groupIds.map(id => GROUP_ENCOUNTER_CODES[id]).filter(Boolean))
  const excluded = new Set(exclude)
  return expand(Object.entries(ALL_CARDS)
    .filter(([code, card]) => !excluded.has(code))
    .filter(([, card]) => codes.has(card.encounterCode))
    .filter(([, card]) => DECK_TYPES.includes(card.type)))
}
export const ENCOUNTER_DECK = (groupDeck(ENCOUNTER_GROUP_IDS, DECK_EXCLUDES))
export const ENCOUNTER_DECK_CODES = ([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'study'
export const GUEST_HALL = 'guestHall'

// [id, 真实卡号, 连接]
// 图标连接依据 ReturnToTheGathering.hs 布局与 Location/CardDefs/ReturnToNightOfTheZealot：
//   study(Circle)–guestHall(T)；guestHall(T)–bedroom(Heart)/bathroom(Star)；
//   holeInTheWall 区字面 Square（揭示后为「走廊」，连 T/Triangle/Plus/Diamond）；
//   attic 三角（揭示后连 Square/Moon）；cellar 加号（揭示后连 Square/Squiggle）；
//   parlor 菱形连 Square；farAbove(Moon)–attic；deepBelow(Squiggle)–cellar。
export const LOCATION_TABLE = ([
  (['study', '50013', (['guestHall'])]),
  (['guestHall', '50014', (['study', 'bedroom', 'bathroom', 'holeInTheWall'])]),
  (['bedroom', '50015', (['guestHall'])]),
  (['bathroom', '50016', (['guestHall'])]),
  (['holeInTheWall', '50017', (['guestHall', 'attic', 'atticReturn', 'cellar', 'cellarReturn', 'parlor'])]),
  (['attic', '01113', (['holeInTheWall'])]),
  (['atticReturn', '50018', (['holeInTheWall', 'farAboveYourHouse'])]),
  (['cellar', '01114', (['holeInTheWall'])]),
  (['cellarReturn', '50020', (['holeInTheWall', 'deepBelowYourHouse'])]),
  (['parlor', '01115', (['holeInTheWall'])]),
  (['farAboveYourHouse', '50019', (['atticReturn', 'attic'])]),
  (['deepBelowYourHouse', '50021', (['cellarReturn', 'cellar'])]),
])
export const LOCATION_IDS = (LOCATION_TABLE.map(([id]) => id))
export const SETUP_LOCATION_IDS = (['study', 'guestHall', 'bedroom', 'bathroom'])
// 放一边（场外）：另两处阁楼/地窖随机取一，故四张都列为放一边候选；未选中者在 setup 移出游戏。
export const SET_ASIDE_LOCATION_IDS = ([
  'holeInTheWall', 'parlor', 'attic', 'atticReturn', 'cellar', 'cellarReturn',
  'farAboveYourHouse', 'deepBelowYourHouse',
])
// 原版书房 01111 与原版走廊 01112 移出游戏（印刷 50011 背面）。
export const REMOVED_CARD_CODES = (['01111', '01112'])

export const LOCATION_COORDINATES = ({
  farAboveYourHouse: { x: 2, y: 0 },
  bedroom: { x: 1, y: 1 },
  attic: { x: 2, y: 1 },
  atticReturn: { x: 2, y: 1 },
  study: { x: 0, y: 2 },
  guestHall: { x: 1, y: 2 },
  holeInTheWall: { x: 2, y: 2 },
  parlor: { x: 3, y: 2 },
  bathroom: { x: 1, y: 3 },
  cellar: { x: 2, y: 3 },
  cellarReturn: { x: 2, y: 3 },
  deepBelowYourHouse: { x: 2, y: 4 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手（本地实现，不依赖战役层 card-data.js）
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to Night of the Zealot card: ${code}`)
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

// 双面地点卡：cards-data 的 name 是揭示面，backName 是未揭示面（50017/50019/50021）。
function unrevealedNameOf(card) {
  if (card.backName && card.backName !== card.name) {
    return { name: card.backNameZh || card.backName, nameEn: card.backName }
  }
  return null
}

export function location(data) {
  const { id, code, connections, revealed, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Gathering location: ${code}`)
  const front = unrevealedNameOf(c)
  return {
    ...printed(code), id,
    shroud: c.shroud,
    connections: [...(connections || [])],
    ...front,
    ...(front ? { unrevealedActualName: c.nameZh || c.name, unrevealedActualNameEn: c.name } : {}),
    ...(c.clues != null ? { cluesPerInvestigator: Number(c.clues) || 0 } : {}),
    ...(rest.resign ? { resign: true } : {}),
    ...(rest.parley ? { parley: true } : {}),
    ...(revealed ? { revealed: true } : {}),
    ...rest,
  }
}

export const LOCATIONS = (Object.fromEntries(LOCATION_TABLE.map(([id, code, connections]) => {
  const card = ALL_CARDS[code]
  return [id, location({
    id, code, connections,
    ...(id === 'parlor' ? { resign: true, parley: true } : {}),
  })]
})))

// ---------------------------------------------------------------------------
// 敌人 / 诡计（数值取印刷数据；关键词按印刷文本解析）
// ---------------------------------------------------------------------------
const PREY_KEYS = ({
  'Most clues': 'mostClues', 'Fewest clues': 'fewestClues',
  'Most cards in hand': 'mostCardsInHand', 'Fewest cards in hand': 'fewestCardsInHand',
  'Highest [combat]': 'highestCombat', 'Lowest [combat]': 'lowestCombat',
  'Highest [agility]': 'highestAgility', 'Lowest [agility]': 'lowestAgility',
  'Highest [willpower]': 'highestWillpower', 'Lowest [willpower]': 'lowestWillpower',
})
const KEYWORDS = (['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert'])

export function enemyDefinition(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Gathering enemy: ${code}`)
  const text = String(c.text || '')
  const preyText = /(?:^|\n)Prey\s*-\s*([^.]+)\./.exec(text)?.[1]?.trim()
  return {
    ...printed(code),
    fight: c.fight ?? null, evade: c.evade ?? null,
    health: c.health ?? null,
    ...(c.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
    damage: c.damage || 0, horror: c.horror || 0,
    traits: [...(c.traits || [])],
    ...(PREY_KEYS[preyText] ? { prey: PREY_KEYS[preyText] } : {}),
    ...Object.fromEntries(KEYWORDS
      .filter(keyword => new RegExp(`\\b${keyword}\\.`).test(text))
      .map(keyword => [keyword.toLowerCase(), true])),
    elite: (c.traits || []).includes('Elite'),
    ...extra,
  }
}

export function treacheryDefinition(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Gathering treachery: ${code}`)
  return {
    ...printed(code), entryRevelation: true,
    surge: /^Surge\./m.test(String(c.text || '')),
    peril: /(?:^|\n|\. )Peril\./.test(String(c.text || '')),
    ...extra,
  }
}

// 基础章节复用卡（遭遇牌库中出现的 01xxx）沿用基础章节的数值与效果数据；
// 新卡（500xx）从印刷文本解析关键词，特殊规则在 behavior.resolveEncounterCard。
export const ENEMIES = ({
  '01116': ({
    ...enemyDefinition('01116', { hunter: true, retaliate: true, prey: 'highestCombat', elite: true, unique: true }),
    healthPerInvestigator: true,
  }),
  '01118': (enemyDefinition('01118', { spawn: 'attic' })),
  '01119': (enemyDefinition('01119', { spawn: 'cellar' })),
  '01159': (enemyDefinition('01159', { hunter: true })),
  '50022': (enemyDefinition('50022', { spawn: 'bedroom', hunter: true })),
  '50023': (enemyDefinition('50023', { spawn: 'bathroom', retaliate: true })),
  '50038': (enemyDefinition('50038')),
  '50039': (enemyDefinition('50039', { prey: 'fewestCardsInHand' })),
})
export const TREACHERIES = ({
  '01162': (treacheryDefinition('01162', {
    test: { skill: 'agility', difficulty: 3 }, fail: { kind: 'damageByAmount' },
  })),
  '01163': (treacheryDefinition('01163', {
    test: { skill: 'willpower', difficulty: 3 }, fail: { kind: 'horrorByAmount' },
  })),
  '01164': (treacheryDefinition('01164', {
    threat: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
  })),
  '01165': (treacheryDefinition('01165', {
    threat: { cannotPlay: ['asset', 'event'], roundEndDiscard: true },
  })),
  '01166': (treacheryDefinition('01166', { effect: { kind: 'addDoom', amount: 1 } })),
  '01167': (treacheryDefinition('01167', {
    test: { skill: 'willpower', difficulty: 4 },
    fail: { kind: 'discardAssetOrDamage', damage: 2 },
  })),
  '01168': (treacheryDefinition('01168', { effect: { kind: 'attachShroud', amount: 2 } })),
  '50024': (treacheryDefinition('50024')),
  '50040': (treacheryDefinition('50040')),
})

// Lita Chantler（01117）剧情资产：印刷数值 + 引擎读点（全局剧情资产）。
export const STORY_ASSETS = ({
  '01117': ({
    code: '01117', name: '丽塔·钱德勒', nameEn: 'Lita Chantler',
    subname: '狂热者', subnameEn: 'The Zealot', cost: 0, slot: 'Ally', unique: true,
    text: ALL_CARDS['01117'].textZh || '', textEn: ALL_CARDS['01117'].text || '',
    traits: [...(ALL_CARDS['01117'].traits || [])], global: true,
  }),
})

// ---------------------------------------------------------------------------
// 幕 / 密谋阶段
// ---------------------------------------------------------------------------
export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Gathering stage: ${code}`)
  const { number, doom, reveal, ...rest } = extra
  return {
    ...printed(code),
    id: `${c.type}${code}`,
    type: c.type,
    stage: `${number ?? c.stage ?? 1}a`,
    ...(reveal ? { reveal } : {}),
    ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? c.doom } : {}),
  }
}

export const ACT_STAGES = ({
  // 50012 目标：只有会客厅的调查员可以共同花费所需线索推进（3/人，权威参考 PerPlayer 3）。
  1: ({ ...stage(ACT1_CODE, { number: 1, reveal: { type: 'mysteriousGateway' } }),
    objective: { type: 'clues', perInvestigator: 3, atLocation: GUEST_HALL } }),
  2: ({ ...stage(ACT2_CODE, { number: 2, reveal: { type: 'revealParlor' } }),
    objective: { type: 'clues', perInvestigator: 3, atLocation: 'holeInTheWall' } }),
  3: ({ ...stage(ACT3_CODE, { number: 3, reveal: { type: 'resolutionChoice' } }),
    objective: { type: 'defeatEnemy', enemy: '01116' } }),
})
export const AGENDA_STAGES = ({
  1: ({ ...stage(AGENDA1_CODE, { number: 1, reveal: { type: 'lapseInTime' } }) }),
  2: ({ ...stage(AGENDA2_CODE, { number: 2, reveal: { type: 'tunnelsBelow' } }) }),
  3: ({ ...stage(AGENDA3_CODE, { number: 3, reveal: { type: 'ghoulsBreakFree' } }),
    forced: {
      enemyPhaseEnd: { type: 'ghoulsMoveToParlor' },
      roundEnd: { type: 'doomPerGhoulAtParlorHallway' },
    } }),
})
export const ACTS = ([structuredClone(ACT_STAGES[1]), structuredClone(ACT_STAGES[2]), structuredClone(ACT_STAGES[3])])
export const AGENDAS = ([structuredClone(AGENDA_STAGES[1]), structuredClone(AGENDA_STAGES[2]), structuredClone(AGENDA_STAGES[3])])
export const STAGE_CARDS = (Object.fromEntries([
  [ACT1_CODE, structuredClone(ACT_STAGES[1])], [ACT2_CODE, structuredClone(ACT_STAGES[2])],
  [ACT3_CODE, structuredClone(ACT_STAGES[3])],
  [AGENDA1_CODE, structuredClone(AGENDA_STAGES[1])], [AGENDA2_CODE, structuredClone(AGENDA_STAGES[2])],
  [AGENDA3_CODE, structuredClone(AGENDA_STAGES[3])],
]))

// ---------------------------------------------------------------------------
// 剧情正文（忠实中译；指南由 content/scenario-guide-sources 提供）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = ({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English; guide source carries the full bilingual text)',
  heading: '重返聚集于此',
  intro: '你和你的搭档们在故乡马萨诸塞州的阿卡姆市调查着一系列奇怪事件。过去几周内多起市民神秘失踪，'
    + '最近他们的尸体出现在树林里，被什么动物啃得面目全非。警察和报纸都说那是野兽所为，但你并不买账。'
    + '你们决定到队长家中讨论这些怪异的事件……',
  setupSteps: ([
    { key: 'gatherSets', text: '找出以下遭遇组全部卡牌：重返聚集于此、聚集于此、老鼠、乌默尔多斯的食尸鬼、'
      + '恐惧打击、远古恶魔、寒冷刺骨。' },
    { key: 'study', text: '将原版书房移出游戏，以新版书房（异常通道）替换。将书房（异常通道）放置入场，'
      + '每位调查员从那里开始游戏。' },
    { key: 'newRooms', text: '将新版会客厅、卧室和浴室放置入场。' },
    { key: 'hallway', text: '将原版走廊移出游戏。' },
    { key: 'atticCellar', text: '分别从两张阁楼和两张地窖中随机各选一张，放在一边（场外）；'
      + '将其它版本移出游戏。' },
    { key: 'setAside', text: '将墙上的洞、远在房屋之上、远在房屋之下、客厅以及选中的阁楼、地窖放在一边；'
      + '将食尸鬼祭司与丽塔·钱德勒放在一边。' },
    { key: 'readyToBegin', text: '现在可以开始游戏了。' },
  ]),
  rules: ({
    guestHall: '位于会客厅的调查员不能进行抽取行动。',
    study: '书房（异常通道）：[action][action] 抽取 3 张卡牌（仅队长可用）；有敌人要生成在不在场上的地点时，'
      + '改为将该地点放置入场并在那里生成该敌人。',
    bedroom: '强制 - 你调查卧室时技能检定失败后：从你的手牌中随机弃掉 1 张卡牌。',
    bathroom: '强制 - 你调查浴室时揭示 [skull]、[cultist]、[tablet] 或 [auto_fail] 后：失去所有剩余行动并结束你的回合。',
    parlor: '客厅的撤退行动与丽塔谈判规则同基础章节。',
  }),
  resolutions: ({
    noResolution: '你们活着逃出了房子，那个女人跟着你们冲入雨夜。（记录：房屋还在、食尸鬼祭司还活着。）',
    r1: '你点头同意，红发女人将火炬丢在地上，屋子瞬间化为火海。你看着自己的一切被火焰吞没。'
      + '（记录：房屋已烧毁；队长受到 1 点精神创伤。）',
    r2: '你拒不服从，把那疯女人赶了出去。或许她说得对，但这里毕竟是你的家。（记录：房屋还在；队长获得额外 1 点经验。）',
    r3: '你们跑到走廊，那巨大滚烫的屏障依然挡着去路。凶残的入侵者已把你们团团包围，无处可逃……',
  }),
  resolutionBranches: ({
    proceed: '前往幕间 I：午夜假面。',
  }),
})

// 当前幕/密谋印刷文本（50012 背面与 01105–01107、01109–01110 同基础章节）。
export const SCENARIO_ACT_TEXT = ({
  [ACT1_CODE]: '目标 - 只有会客厅的调查员可以共同花费所需数量的线索以推进。',
  [ACT2_CODE]: '目标 - 在一轮结束时，走廊（墙上的洞）内的调查员可以共同花费所需数量的线索以推进。',
  [ACT3_CODE]: '目标 - 如果食尸鬼祭司被击败，推进。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const definitions = {
  enemies: { ...ENEMIES },
  treacheries: { ...TREACHERIES },
  storyAssets: { ...STORY_ASSETS },
}

export const CARD_DATA = (Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...Object.keys(ENEMIES), ...Object.keys(TREACHERIES), ...Object.keys(STORY_ASSETS),
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '重返聚集于此 · Return to The Gathering',
  nameEn: 'Return to The Gathering',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: {},
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '按照重返剧本参考卡 50011 的布置步骤：新版书房、会客厅、卧室、浴室入场，阁楼与地窖随机二选一放在一边，食尸鬼祭司与丽塔·钱德勒放在一边，遭遇牌库加入重返聚集于此组并以乌默尔多斯的食尸鬼替换食尸鬼组。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: ([]),
  rules: SCENARIO_TEXT.rules,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  removedCodes: [...REMOVED_CARD_CODES],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = {
  scenario: {
    [CHAPTER_ID]: {
      originalCode: REFERENCE_CODE, approximation: true,
      identityReason: '剧本容器汇总场景参考卡、设置与结局；50011 只标识场景参考卡，不把全部容器内容当作一张卡的规则。',
    },
  },
  locations: Object.fromEntries(LOCATION_TABLE.map(([id, code]) => [id, { originalCode: code }])),
  acts: {
    [`act${ACT1_CODE}`]: { originalCode: ACT1_CODE },
    [`act${ACT2_CODE}`]: { originalCode: ACT2_CODE },
    [`act${ACT3_CODE}`]: { originalCode: ACT3_CODE },
  },
  agendas: {
    [`agenda${AGENDA1_CODE}`]: { originalCode: AGENDA1_CODE },
    [`agenda${AGENDA2_CODE}`]: { originalCode: AGENDA2_CODE },
    [`agenda${AGENDA3_CODE}`]: { originalCode: AGENDA3_CODE },
  },
  enemies: Object.fromEntries(Object.keys(ENEMIES).map(code => [code, { originalCode: code }])),
  treacheries: Object.fromEntries(Object.keys(TREACHERIES).map(code => [code, { originalCode: code }])),
  storyAssets: { '01117': { originalCode: '01117' } },
}

bindScenarioIdentities(scenario, identities)

export default scenario
