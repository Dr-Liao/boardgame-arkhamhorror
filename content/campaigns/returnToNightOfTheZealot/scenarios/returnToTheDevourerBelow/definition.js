// 重返地底噬魔（returnToTheDevourerBelow · 场景参考卡 50032a，Return to Night of the Zealot 第三章）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/ReturnToNightOfTheZealot/ReturnToTheDevourerBelow.hs（包装 + 布局）
//   Scenario/Scenarios/NightOfTheZealot/TheDevourerBelow.hs（setup 的 whenReturnTo / isReturnTo /
//     orWhenReturnTo / guard isReturnTo 分支 = 差异清单）
//   Enemy|Location|Treachery/Cards/ReturnToNightOfTheZealot/** 与
//   Enemy|Treachery/Cards/NightOfTheZealot/{GhoulsOfUmordhoth,TheDevourersCult}/**（新卡行为）
//   src/cards/cards-data.js 中 pack=rtnotz 的 50032a/50032b、50033–50037、50038–50043
//   与 pack=core 的 01157/01158（印刷数值：fight/evade/health/damage/horror/doom/quantity）。
//
// 与基础章节（nightOfTheZealot/theDevourerBelow）的差异：
//   1. 遭遇组追加 returnToTheDevourerBelow；ghouls 替换为 ghoulsOfUmordhoth，
//      darkCult 替换为 theDevourersCult（参考 whenReturnTo / orWhenReturnTo）；
//   2. 阿卡姆密林池从 6 张扩到 10 张（+ 50033–50036），仍是随机 4 张；主道路固定入场。
//      因此本章声明 10 个密林地点 id（6 基础 + 4 重返），运行时只有 4 个入场，
//      未入场的 6 张返回盒中（不占 manifest 区域）；
//   3. 乌默尔多斯放一边时，把 50032b「凡尘终陨之墟」翻面附属其上（whenReturnTo createTreacheryAt_）：
//      乌默尔多斯 +X 攻击、+X 倍调查员人数的生命，X 为剩余幕数；50032b 不能离场；
//   4. 使者组固定 4 选 1（Hastur / YogSothoth / ShubNiggurath / Cthulhu），基础章节是同一规则；
//   5. 幕/密谋牌库与基础章节一致（01146–01148 / 01143–01145），结局键与记录字段沿用基础章节。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   behavior.js：
//     startLocation / preScenarioSetup / setupLocations → 主道路 + 随机 4 密林、使者组/密林随机结果
//     modifyDeck → 使者组入遭遇牌库；ghoulPriestAlive 时洗入 01116
//     afterDeckSetup → 放一边区（仪式地/乌默尔多斯/50032b）、逃跑的异教徒毁灭、50032b 附属记录
//     afterMulligan → pastMidnight 每位调查员随机弃 2 张起始手牌
//     enemySpawned / enemyStatModifier → 50032b 资源、乌默尔多斯 +X 攻击/生命；50041 生成后毁灭或线索
//     spawnLocation → 50041/50042「最远的无人地点」
//     enemyDamageAmount → 50035「本地点敌人每次被攻击至多受 1 伤」（近似：该地点敌人受到的所有伤害封顶 1）
//     enemyAttackResolved → 50038 攻击后随机弃 1 张手牌
//     canEvadeEnemy → 50039 与无手牌调查员交战时不能被躲避
//     chaosTokenRevealed → 50034 调查时额外揭示 1 个混乱标记、50036 躲避时额外揭示（每次检定一次）
//     afterTest → 50033 在本地点击败诡计的技能检定成功后该诡计获得涌动（团队每轮一次）
//     mythosEnded / enemyPhaseEnd → 50042 神话阶段末放毁灭、敌军阶段末向主道路移动/把毁灭交给密谋
//     actions / scenarioActionError / sacrificeLitaAction → 献祭丽塔（→ 结局 3）
//     actReveal / agendaReveal / agendaForcedEnemyDefeated / turnEnded → 基础章节同款幕/密谋背面
//     resolution → 基础章节同款记录/创伤/XP（r1 +5 / r2 +10）
//   单卡条目（一卡一文件）：
//     50037 乌默尔多斯的饥饿 → 本目录 ../returnToTheDevourerBelow/50037.js（entryRevelation）
//   既有条目直接复用（本章不重建）：
//     50040 地底深寒 → returnToNightOfTheZealot/_shared/ghouls_of_umôrdhoth/50040.js（RtG+RtDB 共用）
//     01151 扭曲的道路 / 01156 仪式地 → 基础章节的地点条目
//   数据化、无需条目：
//     01150 进入时意志(4)、01152/01153/01154 调查技能、01155 治愈能力 → 地点定义字段；
//     01143/01144/01145、01146/01147/01148 的背面由 behavior.actReveal/agendaReveal 结算。
//   非数据行为改在 behavior.js 结算（归属算法会把 theDevourersCult 的卡判给战役 _shared，
//   见下文 50043 注释）：
//     50032b 凡尘终陨之墟 → enemySpawned + enemyStatModifier
//     50033/50034/50035/50036 → afterTest / chaosTokenRevealed / enemyDamageAmount
//     50038/50039/50041/50042 → enemyAttackResolved / canEvadeEnemy / enemySpawned+spawnLocation / mythosEnded+enemyPhaseEnd
//     50043 乌默尔多斯的面具 → behavior.resolveEncounter（effect.kind='campaignRule'）
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'returnToTheDevourerBelow'
export const REFERENCE_CODE = '50032a'
export const VAULT_CODE = '50032b'
export const ENCOUNTER_CODE = 'return_to_the_devourer_below'

// ---------------------------------------------------------------------------
// 幕 / 密谋（与基础章节同牌，另加重返版的背面差异）
// ---------------------------------------------------------------------------
export const ACT1_CODE = '01146' // Investigating the Trail
export const ACT2_CODE = '01147' // Into the Darkness
export const ACT3_CODE = '01148' // Disrupting the Ritual
export const ACT_CODES = ([ACT1_CODE, ACT2_CODE, ACT3_CODE])
export const AGENDA1_CODE = '01143' // The Arkham Woods
export const AGENDA2_CODE = '01144' // The Ritual Begins
export const AGENDA3_CODE = '01145' // Vengeance Awaits
export const AGENDA_CODES = ([AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE])
export const RESOLUTION_KEYS = (['noResolution', 'r1', 'r2', 'r3'])

// 放一边 / 场外身份（manifest.setAside 用；01157 = 乌默尔多斯，50032b = 凡尘终陨之墟）。
export const UMORDHOTH_CODE = '01157'
export const GHOUL_PRIEST_CODE = '01116'
export const LITA_CODE = '01117'
export const SET_ASIDE_ALIASES = ([UMORDHOTH_CODE, VAULT_CODE])

// ---------------------------------------------------------------------------
// 遭遇组（id → 印刷 encounterCode）
// ---------------------------------------------------------------------------
export const GROUP_ENCOUNTER_CODES = ({
  returnToTheDevourerBelow: 'return_to_the_devourer_below',
  theDevourerBelow: 'tentacles',
  ancientEvils: 'ancient_evils',
  strikingFear: 'striking_fear',
  ghoulsOfUmordhoth: 'ghouls_of_umôrdhoth',
  theDevourersCult: 'the_devourers_cult',
})
export const ENCOUNTER_GROUP_IDS = (Object.keys(GROUP_ENCOUNTER_CODES))
// 使者组同为「4 选 1」。基础章节只有 YogSothoth 在核心包登记为遭遇组，
// 但四组的印刷卡都带 encounterCode（agents_of_hastur/yog/shub/cthulhu），因此按卡表展开。
export const AGENT_SET_ENCOUNTER_CODES = ({
  agentsOfHastur: 'agents_of_hastur',
  agentsOfYogSothoth: 'agents_of_yog',
  agentsOfShubNiggurath: 'agents_of_shub',
  agentsOfCthulhu: 'agents_of_cthulhu',
})
// 01157 乌默尔多斯放一边（不是遭遇牌库成员）；50032b 在 Setup 时附属到它；
// 50032a 是场景参考卡本身。三者都不能被 groupDeck 当作牌库牌。
const DECK_EXCLUDES = ([UMORDHOTH_CODE, REFERENCE_CODE, VAULT_CODE])
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
// 固定牌库 = 地底噬魔 + 远古恶魔 + 恐惧打击 + 乌默尔多斯的食尸鬼 + 噬魔教团 + 重返地底噬魔。
// 使者组在 behavior.modifyDeck（使用 AGENT_SETS）里追加；食尸鬼祭司在 modifyDeck 里按记录追加。
export const ENCOUNTER_DECK = (groupDeck(ENCOUNTER_GROUP_IDS, DECK_EXCLUDES))
export const ENCOUNTER_DECK_CODES = ([...new Set(ENCOUNTER_DECK)])
export const AGENT_SETS = (Object.fromEntries(Object.entries(AGENT_SET_ENCOUNTER_CODES)
  .map(([id, encounterCode]) => [id, expand(Object.entries(ALL_CARDS)
    .filter(([, card]) => card.encounterCode === encounterCode)
    .filter(([, card]) => DECK_TYPES.includes(card.type)))])))
export const AGENT_SET_IDS = (Object.keys(AGENT_SETS))

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'mainPath'
export const RITUAL_SITE = 'ritualSite'

// [id, 真实卡号, 连接]
// 连接按印刷符号（Location/CardDefs/NightOfTheZealot|ReturnToNightOfTheZealot/TheDevourerBelow.hs）：
//   mainPath 印刷「主道路与其他每个[[树林]]地点连接」→ 连全部 10 张密林 + 仪式地；
//   基础密林按揭示面符号两两相邻（Triangle/Diamond/T/Equals/Moon/Hourglass）；
//   新版密林按揭示面符号成对：greatWillow(Heart)–lakeside(Star)、corpseRiddenClearing(Droplet)–woodenBridge(Circle)，
//   两者都连 mainPath（Squiggle）。
export const LOCATION_TABLE = ([
  (['mainPath', '01149', (['unhallowedGround', 'twistingPaths', 'oldHouse', 'cliffside', 'tangledThicket',
    'quietGlade', 'greatWillow', 'lakeside', 'corpseRiddenClearing', 'woodenBridge', 'ritualSite'])]),
  (['unhallowedGround', '01150', (['mainPath', 'cliffside', 'oldHouse'])]),
  (['twistingPaths', '01151', (['mainPath', 'oldHouse', 'tangledThicket'])]),
  (['oldHouse', '01152', (['mainPath', 'unhallowedGround', 'twistingPaths'])]),
  (['cliffside', '01153', (['mainPath', 'quietGlade', 'unhallowedGround'])]),
  (['tangledThicket', '01154', (['mainPath', 'twistingPaths', 'quietGlade'])]),
  (['quietGlade', '01155', (['mainPath', 'tangledThicket', 'cliffside'])]),
  (['greatWillow', '50033', (['mainPath', 'lakeside'])]),
  (['lakeside', '50034', (['mainPath', 'greatWillow'])]),
  (['corpseRiddenClearing', '50035', (['mainPath', 'woodenBridge'])]),
  (['woodenBridge', '50036', (['mainPath', 'corpseRiddenClearing'])]),
  (['ritualSite', '01156', (['mainPath'])]),
])
export const LOCATION_IDS = (LOCATION_TABLE.map(([id]) => id))
// Setup：主道路固定入场，阿卡姆密林从 10 张里随机取 4 张（placeGroupChooseN 4 "woods"）。
export const SETUP_LOCATION_IDS = ([START_LOCATION])
export const SET_ASIDE_LOCATION_IDS = ([RITUAL_SITE])
export const WOODS_POOL = (LOCATION_IDS.filter(id => id !== START_LOCATION && id !== RITUAL_SITE))
export const WOODS_COUNT = 4

// 放一边（场外）区：仪式地 + 乌默尔多斯 + 凡尘终陨之墟。未入场的 6 张密林返回盒中（不进任何区域）。
export const REMOVED_CARD_CODES = ([])

// 5×3 桌面格位：mainPath / ritualSite 固定在中列，10 张密林按列分布（只有 4 张会入场）。
export const LOCATION_COORDINATES = ({
  unhallowedGround: { x: 0, y: 0 },
  twistingPaths: { x: 1, y: 0 },
  oldHouse: { x: 3, y: 0 },
  cliffside: { x: 4, y: 0 },
  tangledThicket: { x: 0, y: 1 },
  quietGlade: { x: 1, y: 1 },
  mainPath: { x: 2, y: 1 },
  greatWillow: { x: 3, y: 1 },
  lakeside: { x: 4, y: 1 },
  corpseRiddenClearing: { x: 1, y: 2 },
  ritualSite: { x: 2, y: 2 },
  woodenBridge: { x: 3, y: 2 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手（本地实现，不依赖战役层 card-data.js）
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Devourer Below card: ${code}`)
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

// 阿卡姆密林是双面同名卡：10 张的卡面名都是「阿卡姆密林」，靠 subname 区分。
// 桌面/日志只用 name，因此与基础章节一样把 subname 并进显示名（卡面原文仍在 subname/text）。
function woodsDisplayName(c, english) {
  const name = english ? c.name : (c.nameZh || c.name)
  const sub = english ? c.subname : (c.subnameZh || c.subname)
  return sub ? `${name} · ${sub}` : name
}

export function location(data) {
  const { id, code, connections, revealed, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Devourer Below location: ${code}`)
  const woods = (c.traits || []).includes('Woods') && c.subname
  return {
    ...printed(code), id,
    ...(woods ? { name: woodsDisplayName(c, false), nameEn: woodsDisplayName(c, true) } : {}),
    shroud: c.shroud,
    connections: [...(connections || [])],
    ...(c.clues != null ? { cluesPerInvestigator: Number(c.clues) || 0 } : {}),
    ...(revealed ? { revealed: true } : {}),
    ...rest,
  }
}

// 印刷规则的声明式数据（引擎读点：movement.js#location.onEnter/onLeave、moves.js#investigateSkill、
// actions-extra.js#locationAbility）。
const LOCATION_RULES = ({
  // 01150：强制 - 进入后：意志(4)检定，失败受到 1 点伤害和 1 点恐惧。
  unhallowedGround: { onEnter: { test: { skill: 'willpower', difficulty: 4 }, fail: { kind: 'damageAndHorror', damage: 1, horror: 1 } } },
  // 01152/01153/01154：在本地点调查改为使用意志/敏捷/战斗。
  oldHouse: { investigateSkill: 'willpower' },
  cliffside: { investigateSkill: 'agility' },
  tangledThicket: { investigateSkill: 'combat' },
  // 01155：[action]：治愈 1 点伤害或 1 点恐惧。（每回合仅限一次）
  quietGlade: {
    ability: {
      id: 'quietGladeHeal', label: '治愈 1 点伤害或 1 点恐惧（每回合仅限一次）',
      limit: 'player-turn',
      effect: {
        type: 'chooseOne',
        options: [
          { label: '治愈 1 点伤害', effect: { type: 'heal', amount: 1, what: 'damage' } },
          { label: '治愈 1 点恐惧', effect: { type: 'heal', amount: 1, what: 'horror' } },
        ],
      },
    },
  },
})

export const LOCATIONS = (Object.fromEntries(LOCATION_TABLE.map(([id, code, connections]) => [id, location({
  id, code, connections, ...(LOCATION_RULES[id] || {}),
})])))

// ---------------------------------------------------------------------------
// 敌人 / 诡计（数值取印刷数据；关键词按印刷文本解析）
// ---------------------------------------------------------------------------
// 只映射引擎 preyTarget 已登记的读取键（src/engine/card-ops.js#PREY_RANK）。
const PREY_KEYS = ({
  'Most clues': 'mostClues',
  'Most cards in hand': 'mostCardsInHand', 'Fewest cards in hand': 'fewestCardsInHand',
  'Highest [combat]': 'highestCombat', 'Lowest [combat]': 'lowestCombat',
  'Lowest [agility]': 'lowestAgility',
  'Lowest remaining sanity': 'lowestSanity', 'Highest remaining sanity': 'mostRemainingSanity',
})
const KEYWORDS = (['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert'])

export function enemyDefinition(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Devourer Below enemy: ${code}`)
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
  if (!c) throw new RangeError(`Unknown Return to the Devourer Below treachery: ${code}`)
  return {
    ...printed(code), entryRevelation: true,
    surge: /^Surge\./m.test(String(c.text || '')),
    peril: /(?:^|\n|\. )Peril\./.test(String(c.text || '')),
    ...extra,
  }
}

export const ENEMIES = ({
  // 放一边的首领：印刷 6 生命 +4/调查员（基础章节同款 healthPerPlayerBonus）。
  [UMORDHOTH_CODE]: (enemyDefinition(UMORDHOTH_CODE, {
    hunter: true, massive: true, elite: true, unique: true, healthPerPlayerBonus: 4, victory: 0,
  })),
  // 食尸鬼祭司（ghoulPriestAlive 时洗入遭遇牌库）。
  [GHOUL_PRIEST_CODE]: ({
    ...enemyDefinition(GHOUL_PRIEST_CODE, {
      hunter: true, retaliate: true, prey: 'highestCombat', elite: true, unique: true,
    }),
    healthPerInvestigator: true,
  }),
  // ghoulsOfUmordhoth
  '50038': (enemyDefinition('50038')),
  '50039': (enemyDefinition('50039', { prey: 'fewestCardsInHand' })),
  // theDevourersCult（生成点由 behavior.spawnLocation 给「最远的无人地点」）
  '50041': (enemyDefinition('50041')),
  '50042': (enemyDefinition('50042')),
  // 使者组（4 选 1）
  '01175': (enemyDefinition('01175', { hunter: true })),
  '01177': (enemyDefinition('01177', { prey: 'fewestCardsInHand' })),
  '01179': (enemyDefinition('01179', { prey: 'lowestAgility' })),
  '01180': (enemyDefinition('01180', { hunter: true, retaliate: true })),
  '01181': (enemyDefinition('01181', { hunter: true, prey: 'lowestCombat' })),
})

export const TREACHERIES = ({
  // theDevourerBelow
  '01158': (treacheryDefinition('01158', {
    test: { skill: 'willpower', difficulty: 5 }, fail: { kind: 'wrathByAmount' },
  })),
  // ancientEvils
  '01166': (treacheryDefinition('01166', { effect: { kind: 'addDoom', amount: 1 } })),
  // strikingFear
  '01163': (treacheryDefinition('01163', {
    test: { skill: 'willpower', difficulty: 3 }, fail: { kind: 'horrorByAmount' },
  })),
  '01164': (treacheryDefinition('01164', {
    threat: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
  })),
  '01165': (treacheryDefinition('01165', {
    threat: { cannotPlay: ['asset', 'event'], roundEndDiscard: true },
  })),
  // returnToTheDevourerBelow
  '50037': (treacheryDefinition('50037')), // 显现由单卡条目 50037.js 结算
  // ghoulsOfUmordhoth（50040 的显现由既有条目 returnToTheGathering/50040.js 结算）
  '50040': (treacheryDefinition('50040')),
  // theDevourersCult
  // 50043 乌默尔多斯的面具：显现要「附属到最远的[[异教徒]]敌人」并改敌人属性，属于非数据行为。
  // 归属算法会把同组卡判给 returnToNightOfTheZealot/_shared（RtMM 也用 theDevourersCult），
  // 因此不为它建单卡条目，改在 behavior.resolveEncounter 结算（effect.kind='campaignRule'，
  // 与 EotE《远古之物之城》同款内容结算通道）；读点见 behavior.js#maskRevelation。
  '50043': (treacheryDefinition('50043', {
    entryRevelation: false, effect: { kind: 'campaignRule' },
  })),
  // 使者组（4 选 1）
  '01176': (treacheryDefinition('01176', {
    test: { skill: 'willpower', difficulty: 4 }, fail: { kind: 'horrorAndDrawMadness', horror: 2 },
  })),
  '01178': (treacheryDefinition('01178', {
    effect: { kind: 'choosePowerOrHorror', draw: 2, doom: 2, horror: 2 },
  })),
  '01182': (treacheryDefinition('01182', {
    threat: {
      statModifiers: { willpower: -1 }, sanityModifier: -1,
      discardCost: { action: 1 }, discardTest: { skill: 'willpower', difficulty: 3 },
      sameLocationAction: true,
    },
  }))
})

export const STORY_ASSETS = ({})

// ---------------------------------------------------------------------------
// 幕 / 密谋阶段
// ---------------------------------------------------------------------------
export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Devourer Below stage: ${code}`)
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
  // 01146b：放仪式地入场 + 把逃脱的异教徒生成在主道路。
  1: ({ ...stage(ACT1_CODE, { number: 1, reveal: { type: 'revealRitualSite' } }),
    objective: { type: 'clues', perInvestigator: 3 } }),
  // 01147b：遭遇弃牌堆洗回，弃到 1 个敌人（3+ 调查员时 2 个）在仪式地生成。
  2: ({ ...stage(ACT2_CODE, { number: 2, reveal: { type: 'drawEnemyAtRitualSite' } }),
    objective: { type: 'enterLocation', location: RITUAL_SITE } }),
  // 01148b：(→R1)
  3: ({ ...stage(ACT3_CODE, { number: 3, reveal: { type: 'resolution1' } }),
    objective: { type: 'actClues', perInvestigator: 2 } }),
})
export const AGENDA_STAGES = ({
  // 01143b：遭遇弃牌堆洗回，弃到 1 个[[怪物]]敌人在主道路生成并放 1 毁灭。
  1: ({ ...stage(AGENDA1_CODE, { number: 1, reveal: { type: 'drawMonsterAtMainPath' } }) }),
  // 01144b：意志(6)，失败获得随机基础疯狂弱点。
  2: ({ ...stage(AGENDA2_CODE, { number: 2, reveal: { type: 'madnessTest' } }) }),
  // 01145b：以地底噬魔替代当前幕/密谋；生成乌默尔多斯（附 50032b）。
  3: ({ ...stage(AGENDA3_CODE, { number: 3, reveal: { type: 'spawnUmordhoth' } }),
    forced: { enemyDefeated: { type: 'umordhothDefeated' } } }),
})
export const ACTS = ([structuredClone(ACT_STAGES[1]), structuredClone(ACT_STAGES[2]), structuredClone(ACT_STAGES[3])])
export const AGENDAS = ([structuredClone(AGENDA_STAGES[1]), structuredClone(AGENDA_STAGES[2]), structuredClone(AGENDA_STAGES[3])])
export const STAGE_CARDS = (Object.fromEntries([
  [ACT1_CODE, structuredClone(ACT_STAGES[1])], [ACT2_CODE, structuredClone(ACT_STAGES[2])],
  [ACT3_CODE, structuredClone(ACT_STAGES[3])],
  [AGENDA1_CODE, structuredClone(AGENDA_STAGES[1])], [AGENDA2_CODE, structuredClone(AGENDA_STAGES[2])],
  [AGENDA3_CODE, structuredClone(AGENDA_STAGES[3])],
]))

// 混乱标记（与基础章节同一场景，数值/附加效果一致；Haskell 的 getChaosTokenValue 未改）。
export const TOKEN_MEANINGS = ({
  easy: {
    skull: { kind: 'count', count: 'monsters', base: 0 },
    cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnNearestEnemy: 1 } },
    tablet: { kind: 'static', mod: -3, ifMonsterAtLocation: { damage: 1, horror: 0 } },
    elderthing: { kind: 'static', mod: -5, drawAnotherIf: 'ancientOne' },
  },
  standard: {
    skull: { kind: 'count', count: 'monsters', base: 0 },
    cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnNearestEnemy: 1 } },
    tablet: { kind: 'static', mod: -3, ifMonsterAtLocation: { damage: 1, horror: 0 } },
    elderthing: { kind: 'static', mod: -5, drawAnotherIf: 'ancientOne' },
  },
  hard: {
    skull: { kind: 'static', mod: -3, onFail: { drawEnemyTrait: 'Monster' } },
    cultist: { kind: 'static', mod: -4, onDraw: { placeDoomOnNearestEnemy: 2 } },
    tablet: { kind: 'static', mod: -5, ifMonsterAtLocation: { damage: 1, horror: 1 } },
    elderthing: { kind: 'static', mod: -7, drawAnotherIf: 'ancientOne' },
  },
  expert: {
    skull: { kind: 'static', mod: -3, onFail: { drawEnemyTrait: 'Monster' } },
    cultist: { kind: 'static', mod: -4, onDraw: { placeDoomOnNearestEnemy: 2 } },
    tablet: { kind: 'static', mod: -5, ifMonsterAtLocation: { damage: 1, horror: 1 } },
    elderthing: { kind: 'static', mod: -7, drawAnotherIf: 'ancientOne' },
  },
})

// ---------------------------------------------------------------------------
// 剧情正文（忠实中译；指南由 content/scenario-guide-sources 提供）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = ({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English; guide source carries the full bilingual text)',
  heading: '重返地底噬魔',
  intro: '异教徒们在阿卡姆南边的密林深处聚集，准备完成召唤「乌默尔多斯」的仪式。'
    + '你和同伴循着林间小径追了进去——必须赶在仪式完成之前阻止他们，否则阿卡姆将被地底噬魔吞噬。',
  setupSteps: ([
    { key: 'gatherSets', text: '找出以下遭遇组全部卡牌：重返地底噬魔、地底噬魔、远古恶魔、恐惧打击、'
      + '乌默尔多斯的食尸鬼、噬魔教团。' },
    { key: 'agentSet', text: '从哈斯塔的使者、约格·索托斯的使者、莎布·尼古拉丝的使者、克苏鲁的使者中'
      + '随机选择 1 组，将其卡牌加入遭遇牌库。' },
    { key: 'woods', text: '将主道路放置入场。将 10 张阿卡姆密林（基础 6 张 + 重返版 4 张）混洗，'
      + '随机抽出 4 张放置入场；其余密林返回盒中。' },
    { key: 'setAside', text: '将仪式地与乌默尔多斯放在一边。将「凡尘终陨之墟」（50032b）翻面附属到乌默尔多斯。' },
    { key: 'cultistsWhoGotAway', text: '按剧本日志「未落网的异教徒」人数，在当前密谋上放置毁灭标记：'
      + '人数 +1 后除以 2 取整（1–2 名放 1 点，3–4 名放 2 点，5–6 名放 3 点）。' },
    { key: 'pastMidnight', text: '若剧本日志已记录「已过午夜」，每位调查员从起始手牌中随机弃掉 2 张。' },
    { key: 'ghoulPriest', text: '若食尸鬼祭司仍存活，将其洗入遭遇牌库。' },
    { key: 'start', text: '每位调查员从主道路开始游戏。' },
    { key: 'readyToBegin', text: '现在可以开始游戏了。' },
  ]),
  rules: ({
    mainPath: '主道路与其他每个[[树林]]地点连接。[action]：撤退。「我们根本无法阻止他们！」',
    ritualSite: '强制 - 当一轮结束时，若仪式地线索少于调查员人数的 2 倍，补至 2 倍。',
    woodsVariants: '10 张阿卡姆密林中有 4 张会入场；重返版密林（50033–50036）的强制效果见卡面，'
      + '普通/困难难度下混乱标记含义与基础章节相同。',
    vault: '凡尘终陨之墟（50032b）不能离场。乌默尔多斯得到 +X 攻击与 +X 倍调查员人数的生命，'
      + 'X 为该卡上的资源数；乌默尔多斯入场时按场景牌库剩余幕数放置资源。',
    umordhoth: '乌默尔多斯：猎手、庞大、精英。每位调查员回合结束时重整它。'
      + '控制丽塔·钱德勒且与它同地点时可以献祭丽塔（→结局 3）。',
  }),
  resolutions: ({
    noResolution: '乌默尔多斯自地底升起，阿卡姆被黑暗吞没。你们没能阻止仪式——'
      + '（记录：屈服于乌默尔多斯；所有仍活着的调查员阵亡。）',
    r1: '仪式被你们打断，乌默尔多斯退回地底深处，但它还会再来。'
      + '（记录：仪式已破坏；每位调查员 +2 精神创伤，额外 5 经验。）',
    r2: '你们在乌默尔多斯身上留下深深的伤口，将它暂时击退。'
      + '（记录：已击退乌默尔多斯；每位调查员 +2 肉体与 +2 精神创伤，额外 10 经验。）',
    r3: '你把丽塔·钱德勒推向乌默尔多斯，它满足地收下了这份祭品。你们活了下来，但代价惨痛。'
      + '（记录：已牺牲丽塔；每位调查员 +2 肉体与 +2 精神创伤。）',
  }),
  resolutionBranches: ({}),
})

// 当前幕/密谋印刷文本（正反面均在 cards-data；这里只补引擎不读的补充说明）。
export const SCENARIO_ACT_TEXT = ({
  [ACT1_CODE]: '目标 - 共同花费每位调查员 3 个线索以推进（在任意地点）。',
  [ACT2_CODE]: '目标 - 如果有调查员进入仪式地，推进。',
  [ACT3_CODE]: '目标 - 本场景上的线索数量达到调查员人数的 2 倍时推进。',
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
  ...Object.keys(ENEMIES), ...Object.keys(TREACHERIES), VAULT_CODE,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '重返地底噬魔 · Return to The Devourer Below',
  nameEn: 'Return to The Devourer Below',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: {},
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '按照重返剧本参考卡 50032a 的布置步骤：固定找齐重返地底噬魔等六个遭遇组，随机选 1 组「使者」'
    + '加入遭遇牌库；主道路固定入场，从 10 张阿卡姆密林（基础 6 + 重返版 4）随机抽 4 张入场；'
    + '仪式地与乌默尔多斯放在一边，并把 50032b「凡尘终陨之墟」翻面附属到乌默尔多斯；'
    + '按未落网的异教徒数量在密谋上放毁灭、按「已过午夜」随机弃起始手牌；食尸鬼祭司若存活则洗入遭遇牌库。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: [],
  rules: SCENARIO_TEXT.rules,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  agentSets: Object.fromEntries(Object.entries(AGENT_SETS).map(([id, cards]) => [id, [...cards]])),
  woodsPool: [...WOODS_POOL],
  tokenMeanings: structuredClone(TOKEN_MEANINGS),
  chaosBagExtra: ['elderthing'],
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
      identityReason: '剧本容器汇总场景参考卡、设置与结局；50032a 只标识场景参考卡（背面 50032b 是附属到乌默尔多斯的诡计），'
        + '不把全部容器内容当作一张卡的规则。',
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
  storyAssets: {},
}

bindScenarioIdentities(scenario, identities)

export default scenario
