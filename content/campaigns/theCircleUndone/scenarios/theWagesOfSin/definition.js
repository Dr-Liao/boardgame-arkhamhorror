// 《万象无终 · 恶罪报应》（The Wages of Sin，05161）· 卡面数据装配。
//
// 规则事实源：参考实现 `Scenario/Scenarios/TheCircleUndone/TheWagesOfSin.hs` +
// `{Act,Agenda,Enemy,Story,Treachery,Location,Asset}/CardDefs|Cards/TheCircleUndone/TheWagesOfSin*`。
// 本文件只做「本章怎么用这些卡」：印刷数值/卡文全部来自 `../card-data.js`。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  spectralLocation, stages, encounterCards, encounterDefinitions, encounterDeck,
  storyCards, identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

export const HANGMANS_BROOK = '05166'
export const HAUNTED_FIELDS = '05167'
export const ABANDONED_CHAPEL = '05168'
export const THE_GALLOWS = '05169'
export const HERETICS_GRAVES = '05171'
export const CHAPEL_CRYPT = '05173'
export const CHAPEL_ATTIC = '05175'
export const SPECTRAL_WEB = '05177'
export const SPECTRAL_WATCHER = '05086'
export const WATCHERS_GRASP = '05087'

// 异端者 6 张双面卡：敌人面 → 未了之事面。setup 时随机 4 张放一边、其余 2 张移出游戏。
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

// 未了之事的驱除条件/强制能力（数据表）：behavior 只按 `forced.kind` / `immediate.kind`
// 分派，不写卡号分支。`enemyCode` 是翻回敌人面时要恢复的卡号。
export const UNFINISHED_BUSINESS_RULES = Object.freeze({
  '05178b': {
    enemyCode: '05178a', locationName: '教堂地下室', skills: ['intellect', 'combat'], storyVictory: 1,
    forced: { kind: 'horror', amount: 1, text: '受到 1 点恐惧' },
  },
  '05178d': {
    enemyCode: '05178c', locationName: '绞刑架', skills: ['willpower', 'agility'], storyVictory: 1,
    forced: { kind: 'damage', amount: 1, text: '受到 1 点伤害' },
  },
  '05178f': {
    enemyCode: '05178e', locationName: '教堂阁楼', skills: ['intellect', 'agility'], storyVictory: 1,
    forced: { kind: 'resources', amount: 2, text: '失去 2 点资源' },
  },
  '05178h': {
    enemyCode: '05178g', locationName: '异端者的墓地', skills: ['willpower', 'combat'], storyVictory: 1,
    forced: { kind: 'discard', amount: 2, text: '选择并弃掉 2 张手牌' },
  },
  '05178j': {
    enemyCode: '05178i',
    // 卡面：谈判「花费 +1[per_investigator] 个线索」= 基础 1 + 人数；不再另加 parleyClueBonus
    // （旧数据额外 +1 导致人数+2，05178j 审计近似修复）。
    immediate: { kind: 'cannotBeDefeated', spectralParleyOnly: true },
  },
  '05178l': {
    enemyCode: '05178k',
    immediate: { kind: 'banishNextDefeat' },
  },
})
// 「翻回敌人面并立即攻击」的两张未了之事（J/L）：不解锁威胁区，结算后立刻翻回。
export const IMMEDIATE_UNFINISHED_BUSINESS = Object.freeze(
  Object.entries(UNFINISHED_BUSINESS_RULES)
    .filter(([, rule]) => Boolean(rule.immediate))
    .map(([code]) => code),
)

// 11 对双面地点的符号/连接（location-map.json）。每一对是同一张地图位置的两种版本：
// setup 时每组随机选 1 张入场，另一张移出游戏（Haskell placeOneOf_）。
export const LOCATION_VARIANTS = Object.freeze({
  theGallows: ['05169', '05170'],
  hereticsGraves: ['05171', '05172'],
  chapelCrypt: ['05173', '05174'],
  chapelAttic: ['05175', '05176'],
})
export const SINGLE_LOCATIONS = Object.freeze(['05166', '05167', '05168'])

// 印刷卡号 → 地点 id（setup 随机二选一时用；behavior 不写卡号分支）。
export const LOCATION_ID_BY_FRONT_CODE = Object.freeze({
  '05166': 'hangmansBrook',
  '05167': 'hauntedFields',
  '05168': 'abandonedChapel',
  '05169': 'theGallows169',
  '05170': 'theGallows170',
  '05171': 'hereticsGraves171',
  '05172': 'hereticsGraves172',
  '05173': 'chapelCrypt173',
  '05174': 'chapelCrypt174',
  '05175': 'chapelAttic175',
  '05176': 'chapelAttic176',
})

// 幽灵面闹鬼能力：按地点 id 索引（definition 的地点带 `hauntedGroup`，
// behavior.locationFlipped 只做「按声明键取数据」，不比对卡号）。
// 闭集子句表达不了的（移动敌人/弃遭遇牌/生成敌人/设定基础值）走 `script`。
export const HAUNTED_BY_LOCATION = Object.freeze({
  hangmansBrook: [{ text: '闹鬼 - 受到 1 点伤害。直到一轮结束，不能触发上述撤退能力。',
    effect: [{ kind: 'damage', amount: 1 }, { kind: 'script', id: 'lockResignThisRound' }] }],
  hauntedFields: [{ text: '闹鬼 - 将最近的幽灵敌人向闹鬼农田移动一次。',
    effect: [{ kind: 'script', id: 'moveNearestSpectralToHere' }] }],
  abandonedChapel: [{ text: '闹鬼 - 直到一轮结束，你获得每项技能 -1。',
    effect: [{ kind: 'script', id: 'roundSkillPenalty' }] }],
  theGallows169: [{ text: '闹鬼 - 弃掉基础遭遇牌库顶 3 张卡牌。如果有女巫敌人因此效果被弃掉，将其抽取。',
    effect: [{ kind: 'script', id: 'discardStandardForWitch' }] }],
  theGallows170: [{ text: '闹鬼 - 弃掉幽灵遭遇牌库顶 3 张卡牌。如果有灵怪敌人因此效果被弃掉，将其抽取。',
    effect: [{ kind: 'script', id: 'discardSpectralForGeist' }] }],
  hereticsGraves171: [{ text: '闹鬼 - 你的基础意志值减至 1，直到你下个回合结束。',
    effect: [{ kind: 'script', id: 'baseWillpowerOne' }] }],
  hereticsGraves172: [{ text: '闹鬼 - 治愈场上每个异端者和女巫敌人 1 点伤害。',
    effect: [{ kind: 'script', id: 'healHereticsAndWitches' }] }],
  chapelCrypt173: [{ text: '闹鬼 - 将你牌库顶 1 张卡牌正面朝下生成，与你交战。将该卡牌视作苏生亡者敌人（1 攻击/1 生命/1 躲避/1 伤害，[[怪物]]特性）。',
    effect: [{ kind: 'script', id: 'spawnReanimatedDead' }] }],
  chapelCrypt174: [{ text: '闹鬼 - 找出基础遭遇弃牌堆最顶部的 1 张巫术诡计，将其放置入场，放到你的威胁区域。',
    effect: [{ kind: 'script', id: 'hexFromDiscardToThreat' }] }],
  chapelAttic175: [{ text: '闹鬼 - 随机弃掉教堂阁楼底下的一张卡牌。',
    effect: [{ kind: 'script', id: 'discardBeneathAttic' }] }],
  chapelAttic176: [{ text: '闹鬼 - 随机弃掉你 1 张手牌（如果你有至少 5 张手牌，改为弃掉 2 张）。',
    effect: [{ kind: 'script', id: 'randomDiscardAtAttic' }] }],
})

// 本章逐卡规则键（数据驱动）：单卡条目的 `flags` 携带同一份键；behavior 先读条目
// （entryFlags），条目索引尚未重建时回退到本表，因此章节行为不写卡号分支。
export const CARD_RULES = Object.freeze({
  // 幕 / 议程推进（behavior.actReveal / agendaReveal 按 advanceRule 分派）
  '05162': { advanceRule: 'theHangedManXII' },
  '05163': { advanceRule: 'deathsApproach' },
  '05164': { advanceRule: 'inPursuitOfTheDead' },
  '05165': { advanceRule: 'inPursuitOfTheLiving' },
  // 诡计（behavior.resolveEncounter / encounterGainsSurge 按 rule 分派）
  '05181': { resolveRule: 'punishment' },
  '05182': { resolveRule: 'burdensOfThePast', surgeRule: 'noUnfinishedBusiness' },
  '05183': { resolveRule: 'ominousPortents' },
  '05184': { resolveRule: 'graveLight', surgeRule: 'graveLightStandardDraw' },
  '05185': { resolveRule: 'baneOfTheLiving' },
  // 敌人（behavior.spawnLocation / enemySpawned / enemyDefeated / enemyDamaged 按 role 分派）
  '05179': { enemyRole: 'vengefulWitch', spawnRule: 'gallowsOrHereticsGraves' },
  '05180': { enemyRole: 'malevolentSpirit', spawnRule: 'chapelAtticOrCrypt' },
  ...Object.fromEntries(HERETIC_FACES.map(face => [face.enemy, { enemyRole: 'heretic' }])),
})

// 幽灵面印刷数据（05166b 等）：用 spectralLocation() 读 backFace 的 name/clues。
const makeSpectralLocation = (id, frontCode, extra = {}) => {
  const backCode = ALL_CARDS[frontCode].linkedCardCode
  return spectralLocation(id, frontCode, backCode, extra)
}

// 每个地点的本章规则键（behavior 读实例上的这些字段分派，不比对卡号）：
//   hauntedGroup   幽灵面 haunted 数据键（HAUNTED_BY_LOCATION）
//   resignAction   [action] 撤退的行动 rule id
//   shroudRule     隐藏值动态规则
//   statRule       常驻技能修正规则
//   investigateBonus 调查时追加的技能值来源
//   beneathRule    抽牌后放到地点底下的规则
//   horrorAura     给同地点幽灵敌人的恐惧值加成
//   defeatRule     敌人被击败后的地点强制
const locations = {
  hangmansBrook: makeSpectralLocation('hangmansBrook', HANGMANS_BROOK, {
    symbol: 'squiggle', links: ['circle', 'plus'],
    hauntedGroup: 'hangmansBrook', resignAction: 'resignHangmansBrook',
  }),
  hauntedFields: makeSpectralLocation('hauntedFields', HAUNTED_FIELDS, {
    symbol: 'circle', links: ['squiggle', 'plus', 'triangle', 'square'],
    hauntedGroup: 'hauntedFields', horrorAura: true,
  }),
  abandonedChapel: makeSpectralLocation('abandonedChapel', ABANDONED_CHAPEL, {
    symbol: 'plus', links: ['squiggle', 'circle', 'diamond', 'moon'],
    hauntedGroup: 'abandonedChapel', statRule: 'mythosPenalty',
  }),
  theGallows169: makeSpectralLocation('theGallows169', '05169', {
    symbol: 'triangle', links: ['circle', 'square'],
    hauntedGroup: 'theGallows169', shroudRule: 'perWitch',
  }),
  theGallows170: makeSpectralLocation('theGallows170', '05170', {
    symbol: 'triangle', links: ['circle', 'square'],
    hauntedGroup: 'theGallows170', shroudRule: 'perGeist',
  }),
  hereticsGraves171: makeSpectralLocation('hereticsGraves171', '05171', {
    symbol: 'square', links: ['triangle', 'circle'],
    hauntedGroup: 'hereticsGraves171', investigateBonus: 'willpower',
  }),
  hereticsGraves172: makeSpectralLocation('hereticsGraves172', '05172', {
    symbol: 'square', links: ['triangle', 'circle'],
    hauntedGroup: 'hereticsGraves172', defeatRule: 'discardStandardTwoOnWitchDefeat',
  }),
  chapelCrypt173: makeSpectralLocation('chapelCrypt173', '05173', {
    symbol: 'diamond', links: ['plus', 'moon'],
    hauntedGroup: 'chapelCrypt173', shroudRule: 'noReadyEnemy',
  }),
  chapelCrypt174: makeSpectralLocation('chapelCrypt174', '05174', {
    symbol: 'diamond', links: ['plus', 'moon'],
    hauntedGroup: 'chapelCrypt174', shroudRule: 'noHexThreat',
  }),
  chapelAttic175: makeSpectralLocation('chapelAttic175', '05175', {
    symbol: 'moon', links: ['plus', 'diamond'],
    hauntedGroup: 'chapelAttic175', beneathRule: 'atticBottom',
    // 卡面 [reaction]「在你成功调查教堂阁楼后」：此地印刷 0 线索，引擎默认禁止调查 0 线索地点；
    // 用引擎第四轮地点字段 investigateWithoutClues 允许（src/engine/moves.js:318-321,712-716）。
    investigateWithoutClues: true,
  }),
  chapelAttic176: makeSpectralLocation('chapelAttic176', '05176', {
    symbol: 'moon', links: ['plus', 'diamond'],
    hauntedGroup: 'chapelAttic176', investigateBonus: 'handCount',
  }),
}
// 05170/05170b 的隐藏值 X = 场上[[灵怪]]敌人数量：卡面把 X 印成“-2”占位，
// 这里按参考实现 withXShroud 归零，由 behavior.locationShroudModifier 给出 X。
locations.theGallows170.shroud = 0
locations.theGallows170.back = { ...locations.theGallows170.back, shroud: 0 }
// 这两面的印表 shroud 是“X”的 -2 占位；翻面回填 shroud 时必须跳过（否则幽灵面变成 -2 + X）。
export const X_SHROUD_PLACEHOLDER_CODES = Object.freeze(['05170', '05170b'])
linkSymbolLocations(locations)

// 遭遇组：参考实现 gather（The Watcher 是 gatherAndSetAside）。
const GATHER_GROUPS = [
  'theWagesOfSin', 'anettesCoven', 'cityOfSins', 'inexorableFate', 'realmOfDeath',
  'trappedSpirits', 'witchcraft',
]
// 异端者 / 幽灵迷网 / 看守人组不进两个遭遇牌库（放一边或移出游戏）。
const SET_ASIDE_CODES = [
  ...HERETIC_ENEMY_CODES,
  SPECTRAL_WEB, SPECTRAL_WEB, SPECTRAL_WEB, SPECTRAL_WEB,
  SPECTRAL_WATCHER, WATCHERS_GRASP, WATCHERS_GRASP,
]
// 异端者 faces：敌人面 + 未了之事面（P2.12 数据形状；spawnEnemy 只拷已知字段，
// behavior.enemySpawned 会把 faces 挂到实例上）。生命值「+2[per_investigator]」用
// healthPerPlayerBonus 表达（health = 2 + 2×人数）。
const hereticExtraRules = Object.fromEntries(HERETIC_FACES.map(face => [face.enemy, {
  healthPerPlayerBonus: 2,
  faces: [
    { code: face.enemy, side: 'enemy' },
    { code: face.story, side: 'unfinishedBusiness' },
  ],
}]))

// 定义表要包含「放在一边」的敌人/诡计（生成/洗回时引擎按 definition 结算）。
const setAside = new Set(SET_ASIDE_CODES)
const gatheredAll = encounterCards(GATHER_GROUPS)
const gathered = gatheredAll.filter(card => !setAside.has(card.code))
const definitions = encounterDefinitions([
  ...gatheredAll,
  ALL_CARDS[SPECTRAL_WATCHER],
  ALL_CARDS[WATCHERS_GRASP],
], { enemies: hereticExtraRules })

const isSpectralCard = card => (card.traits || []).some(trait => String(trait).toLowerCase() === 'spectral')
// 幽灵遭遇牌库：收齐组里带[[幽灵]]特性、不是地点的单面卡（参考实现 amongGathered）。
export const SPECTRAL_DECK_CODES = Object.freeze(
  encounterDeck(gathered.filter(card => isSpectralCard(card))),
)
// 基础遭遇牌库：其余敌人/诡计。
const standardCards = gathered.filter(card => !isSpectralCard(card))
export const STANDARD_DECK_CODES = Object.freeze(encounterDeck(standardCards))

export const scenario = {
  id: 'theWagesOfSin',
  originalCode: '05161',
  name: '万象无终 · 恶罪报应',
  intro: '自从在巫宅遇鬼，你不得不重新思考你对生与死的一切认知。凯夏·梅森死了两百多年，'
    + '她的灵魂却仍留在鬼灵迷雾之中。报纸上说，有人在绞刑者河边看见了幽灵的身影——'
    + '如果那就是你要找的女巫集会，那么你唯一确定能找到她们的地方，就在绞刑者山丘的地下六英尺。',
  setup: '收齐“恶罪报应”“安妮特的女巫集会”“罪恶之城”“在劫难逃”“冥界”“被困的灵魂”“巫法”'
    + '遭遇组，把“看守人”组放在一边。混洗 6 张异端者，随机 4 张放一边、2 张移出游戏；'
    + '4 张幽灵迷网放一边。从 11 对双面地点中每组随机选 1 张入场（非幽灵面），'
    + '再加闹鬼农田、废弃教堂、绞刑者河；全员从绞刑者河开始。构建基础遭遇牌库与幽灵遭遇牌库两个独立牌库。',
  startLocation: 'hangmansBrook',
  locations,
  acts: stages(['05164', '05165'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    advanceRule: CARD_RULES[act.originalCode]?.advanceRule || null,
    // 05164 追寻死者：团队共同支付 3×人数线索。
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
  })),
  agendas: stages(['05162', '05163'], 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
    advanceRule: CARD_RULES[agenda.originalCode]?.advanceRule || null,
  })),
  scriptCards: {},
  ...definitions,
  storyAssets: storyCards([SPECTRAL_WEB, ...UNFINISHED_BUSINESS_CODES]),
  encounterDeck: [...STANDARD_DECK_CODES],
  chaosBagExtra: ['cultist', 'tablet', 'elderthing'],
  // 所有地点两面都是「已揭示」面（参考实现的 location 卡没有未揭示面）。
  locationsStartRevealed: true,
  resolutions: {
    noResolution: '未达成任何结局：至少一位调查员撤退时转结局 1，每位调查员都被击败时转结局 2。',
    r1: '结局 1：阳光穿透薄雾，怪雾最终消散，绞刑者山丘恢复原样。剧本日志记录“有 X 名异端者被释放到阿卡姆”'
      + '（若当前为场景 1，改为记录 4 名；X 不超过 3 时在“遗留记忆”下方记录“一缕鬼灵迷雾”）。'
      + '每位调查员获得等于胜利区卡牌胜利点之和的经验。',
    r2: '结局 2：迷雾开始分离，看守人现身，时间仿佛变慢。你闭上眼，再睁开时怪物与迷雾一同消失。'
      + '剧本日志记录“调查员从看守人之拥下存活”，并记录“有 X 名异端者被释放到阿卡姆”'
      + '（若当前为场景 1，改为 4 名；X 不超过 3 时记录“一缕鬼灵迷雾”）。获得胜利点经验。',
    r3: '结局 3：你带着情报与力量离开绞刑者山丘，身后的雾气仍未散去。'
      + '剧本日志记录“有 1 名异端者被释放到阿卡姆”、在“遗留记忆”下方记录“血染树雕”，'
      + '并记录“艾琳加入了调查员”；一位调查员可以把艾琳·麦克奥伊德加入牌组（不计入 30 张）。获得胜利点经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
