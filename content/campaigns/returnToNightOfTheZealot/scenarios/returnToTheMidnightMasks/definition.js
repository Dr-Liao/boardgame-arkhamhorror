// 重返午夜假面（returnToTheMidnightMasks · 场景参考卡 50025，Return to Night of the Zealot 第二章）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/ReturnToNightOfTheZealot/ReturnToTheMidnightMasks.hs（包装 + 布局）
//   Scenario/Scenarios/NightOfTheZealot/TheMidnightMasks.hs（whenReturnTo 分支 = 差异清单）
//   Agenda|Enemy|Location|Treachery/CardDefs|Cards/ReturnToNightOfTheZealot/**（新卡行为）
//   src/cards/cards-data.js 中 pack=rtnotz 的 50025–50031、50044–50046。
//
// 与基础章节的差异：
//   1. 遭遇组追加 returnToTheMidnightMasks，darkCult 替换为 theDevourersCult；
//   2. 密谋 1 从 01121a / 50026a 两张中随机取一（另一张移出游戏），50026a 背面生成 50026b 纳罗加斯；
//   3. 东城区/北区/河岸城/米斯卡塔尼克大学各从原版与新版地点中随机取一，另一版移出游戏；
//   4. 异教徒牌堆 = 原版 5 名独特异教徒 + returnCult 三张（50044/50045/50046），混洗后随机移除 3 张；
//   5. 祭司替换为 50041 噬魔信徒（按人数-1 生成在南区/商业区/墓地）；
//   6. 房屋已烧毁仍从河岸城开始；食尸鬼祭司仍存活则洗入遭遇牌库。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'returnToTheMidnightMasks'
export const REFERENCE_CODE = '50025'
export const ENCOUNTER_CODE = 'return_to_the_midnight_masks'

// ---------------------------------------------------------------------------
// 幕 / 密谋
// ---------------------------------------------------------------------------
export const ACT1_CODE = '01123' // Uncovering the Conspiracy（不变）
export const ACT_CODES = Object.freeze([ACT1_CODE])
export const AGENDA1_BASE_CODE = '01121a' // Predator or Prey?
export const AGENDA1_RETURN_CODE = '50026a' // Predator or Prey?（重返版）
export const AGENDA1_LINKED_CODE = '01121b' // The Masked Hunter
export const NAROGATH_CODE = '50026b'
export const AGENDA2_CODE = '01122' // Time Is Running Short
export const AGENDA_CODES = Object.freeze([AGENDA1_RETURN_CODE, AGENDA2_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'r1', 'r2'])
export const CULTIST_DECK_REMOVE = 3

// ---------------------------------------------------------------------------
// 遭遇组（id → 印刷 encounterCode）
// ---------------------------------------------------------------------------
export const GROUP_ENCOUNTER_CODES = Object.freeze({
  returnToTheMidnightMasks: 'return_to_the_midnight_masks',
  theMidnightMasks: 'arkham',
  chillingCold: 'chilling_cold',
  nightgaunts: 'nightgaunts',
  lockedDoors: 'locked_doors',
  theDevourersCult: 'the_devourers_cult',
  returnCult: 'return_cult',
})
export const ENCOUNTER_GROUP_IDS = Object.freeze([
  'returnToTheMidnightMasks', 'theMidnightMasks', 'chillingCold', 'nightgaunts', 'lockedDoors',
  'theDevourersCult',
])
export const CULTIST_GROUP_IDS = Object.freeze(['returnCult'])
// 议程背面生成的敌人不是遭遇牌库成员。
export const DECK_EXCLUDES = Object.freeze(['01121b', '50026b'])
const DECK_TYPES = Object.freeze(['enemy', 'treachery'])

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
export const ENCOUNTER_DECK = Object.freeze(groupDeck(ENCOUNTER_GROUP_IDS, DECK_EXCLUDES))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 独立异教徒牌堆：原版 5 + returnCult 3，混洗后随机移除 3 张（最后 5 张，运行时由 behavior 处理）。
export const CULTIST_DECK = Object.freeze(Object.entries(ALL_CARDS)
  .filter(([, card]) => card.encounterCode === 'cultists' && card.type === 'enemy')
  .map(([code]) => code)
  .concat(groupDeck(CULTIST_GROUP_IDS))
  .sort())
export const CULTIST_DECK_CODES = Object.freeze([...new Set(CULTIST_DECK)])

// ---------------------------------------------------------------------------
// 地点（原版 / 重返版二选一）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'yourHouse'
export const RIVERTOWN_IF_BURNED = 'rivertown'
export const ARKHAM_LOCATION_IDS = Object.freeze([
  'yourHouse', 'rivertown', 'southside', 'stMarysHospital', 'miskatonicUniversity',
  'downtown', 'easttown', 'graveyard', 'northside',
])

// [id, 主版本卡号, 备选卡号, 连接, 额外字段]
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['yourHouse', '01124', null, Object.freeze(['southside', 'miskatonicUniversity', 'easttown', 'graveyard'])]),
  Object.freeze(['rivertown', '01125', '50030', Object.freeze(['downtown', 'southside', 'stMarysHospital', 'northside', 'miskatonicUniversity'])]),
  Object.freeze(['southside', '01126', '01127', Object.freeze(['rivertown', 'stMarysHospital', 'northside', 'miskatonicUniversity', 'easttown', 'graveyard', 'yourHouse'])]),
  Object.freeze(['stMarysHospital', '01128', null, Object.freeze(['rivertown', 'southside', 'northside', 'miskatonicUniversity'])]),
  Object.freeze(['miskatonicUniversity', '01129', '50029', Object.freeze(['rivertown', 'stMarysHospital', 'southside', 'easttown', 'graveyard', 'yourHouse', 'downtown', 'northside'])]),
  Object.freeze(['downtown', '01130', '01131', Object.freeze(['rivertown', 'miskatonicUniversity', 'northside', 'easttown'])]),
  Object.freeze(['easttown', '01132', '50027', Object.freeze(['southside', 'miskatonicUniversity', 'graveyard', 'yourHouse', 'downtown', 'northside'])]),
  Object.freeze(['graveyard', '01133', null, Object.freeze(['southside', 'miskatonicUniversity', 'easttown', 'yourHouse'])]),
  Object.freeze(['northside', '01134', '50028', Object.freeze(['rivertown', 'southside', 'stMarysHospital', 'miskatonicUniversity', 'downtown', 'easttown'])]),
])
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const VARIANT_LOCATION_IDS = Object.freeze(['rivertown', 'southside', 'miskatonicUniversity', 'downtown', 'easttown', 'northside'])
export const ENEMY_SPAWN_LOCATIONS = Object.freeze(['southside', 'downtown', 'graveyard'])

export const LOCATION_COORDINATES = Object.freeze({
  northside: { x: 0, y: 0 }, downtown: { x: 1, y: 0 }, easttown: { x: 2, y: 0 },
  miskatonicUniversity: { x: 0, y: 1 }, rivertown: { x: 1, y: 1 }, graveyard: { x: 2, y: 1 },
  stMarysHospital: { x: 0, y: 2 }, southside: { x: 1, y: 2 }, yourHouse: { x: 2, y: 2 },
})

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Midnight Masks card: ${code}`)
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

function locationData(id, code, connections, revealed = false) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Midnight Masks location: ${code}`)
  return {
    id, ...printed(code),
    shroud: c.shroud,
    connections: [...connections],
    ...(c.clues != null ? { cluesPerInvestigator: Number(c.clues) || 0 } : {}),
    ...(revealed ? { revealed: true } : {}),
    ...(c.victory != null ? { victory: c.victory } : {}),
  }
}

/** 运行时变体（placeLocation 会合并 state.locationVariants[id] 到定义上）。 */
export function locationVariant(id, code) {
  const base = locationData(id, code, LOCATION_TABLE.find(row => row[0] === id)?.[3] || [], true)
  return {
    ...base,
    code,
    originalCode: code,
    name: ALL_CARDS[code].nameZh || ALL_CARDS[code].name,
    nameEn: ALL_CARDS[code].name,
    ...(ALL_CARDS[code].subname ? { subname: ALL_CARDS[code].subnameZh || ALL_CARDS[code].subname } : {}),
  }
}

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, primary, alternate, connections]) => {
  const definition = locationData(id, primary, connections, id === START_LOCATION)
  if (alternate) definition.variantCodes = [primary, alternate]
  return [id, definition]
})))

// ---------------------------------------------------------------------------
// 敌人 / 诡计
// ---------------------------------------------------------------------------
const KEYWORDS = Object.freeze(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert'])
const PREY_KEYS = Object.freeze({
  'Most clues': 'mostClues', 'Fewest clues': 'fewestClues',
  'Most cards in hand': 'mostCardsInHand', 'Fewest cards in hand': 'fewestCardsInHand',
})

function enemyDefinition(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Midnight Masks enemy: ${code}`)
  const text = String(c.text || '')
  const preyText = /(?:^|\n)Prey\s*-\s*([^.]+)\./.exec(text)?.[1]?.trim()
  return {
    ...printed(code),
    fight: c.fight ?? null, evade: c.evade ?? null, health: c.health ?? null,
    ...(c.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
    damage: c.damage || 0, horror: c.horror || 0,
    ...(PREY_KEYS[preyText] ? { prey: PREY_KEYS[preyText] } : {}),
    ...Object.fromEntries(KEYWORDS.filter(keyword => new RegExp(`\\b${keyword}\\.`).test(text))
      .map(keyword => [keyword.toLowerCase(), true])),
    elite: (c.traits || []).includes('Elite'),
    ...extra,
  }
}

export const ENEMIES = Object.freeze({
  // 异教徒牌堆（原版 + returnCult）
  '01137': enemyDefinition('01137', { spawn: 'downtown', unique: true, uniqueCultist: true, parley: { cost: null, label: '谈判' } }),
  '01138': enemyDefinition('01138', { spawn: 'graveyard', unique: true, uniqueCultist: true, parley: { cost: { discardHand: 4 }, label: '弃 4 张手牌谈判' } }),
  '01139': enemyDefinition('01139', { spawn: 'miskatonicUniversity', unique: true, uniqueCultist: true, parley: { cost: { clues: 2 }, label: '花 2 线索谈判' } }),
  '01140': enemyDefinition('01140', { spawn: 'northside', unique: true, uniqueCultist: true, parley: { cost: { resources: 5 }, label: '花 5 资源谈判' } }),
  '01141': enemyDefinition('01141', { spawn: 'stMarysHospital', unique: true, uniqueCultist: true, evadeToVictory: true }),
  '50044': enemyDefinition('50044', { spawn: 'yourHouse', unique: true, uniqueCultist: true }),
  '50045': enemyDefinition('50045', { spawn: 'easttown', unique: true, uniqueCultist: true }),
  '50046': enemyDefinition('50046', { spawn: 'southside', unique: true, uniqueCultist: true }),
  // 遭遇牌库敌人
  '50041': enemyDefinition('50041'),
  '50042': enemyDefinition('50042'),
  // 议程背面生成
  '50026b': enemyDefinition('50026b', { hunter: true, elite: true, unique: true }),
})

export function treacheryDefinition(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Midnight Masks treachery: ${code}`)
  return {
    ...printed(code), entryRevelation: true,
    surge: /^Surge\./m.test(String(c.text || '')),
    ...extra,
  }
}

export const TREACHERIES = Object.freeze({
  // 基础章节复用（arkham / chilling cold / nightgaunts / locked doors）
  '01135': treacheryDefinition('01135', { effect: { kind: 'chooseCluesOrDamage', clues: 1, damage: 2 }, peril: true }),
  '01136': treacheryDefinition('01136', { test: { skill: 'intellect', difficulty: 4 }, fail: { kind: 'cluesByAmount' } }),
  '01167': treacheryDefinition('01167', { test: { skill: 'willpower', difficulty: 4 }, fail: { kind: 'discardAssetOrDamage', damage: 2 } }),
  '01168': treacheryDefinition('01168', { effect: { kind: 'attachShroud', amount: 2 } }),
  '01173': treacheryDefinition('01173', { test: { skill: 'agility', difficulty: 4 }, fail: { kind: 'onWingsOfDarkness', damage: 1, horror: 1 } }),
  '01174': treacheryDefinition('01174', { effect: { kind: 'attachLockedDoor' } }),
  '50031': treacheryDefinition('50031'),
})

// Lita 与食尸鬼祭司在战役记录中被引用。
export const LITA_CODE = '01117'
export const GHOUL_PRIEST_CODE = '01116'

// ---------------------------------------------------------------------------
// 幕 / 密谋阶段
// ---------------------------------------------------------------------------
export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Return to the Midnight Masks stage: ${code}`)
  const { number, doom, reveal, ...rest } = extra
  return {
    ...printed(code), id: `${c.type}${code}`, type: c.type,
    stage: `${number ?? c.stage ?? 1}a`,
    ...(reveal ? { reveal } : {}),
    ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? c.doom } : {}),
  }
}

export const ACT_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(ACT1_CODE, { number: 1, reveal: { type: 'resolutionChoice' } }),
    objective: { type: 'uniqueCultists', amount: 6 } }),
})
export const AGENDA1_STAGE = Object.freeze({
  ...stage(AGENDA1_RETURN_CODE, { number: 1, reveal: { type: 'spawnNarogath' } }),
})
export const AGENDA1_BASE_STAGE = Object.freeze({
  ...stage(AGENDA1_BASE_CODE, { number: 1, reveal: { type: 'spawnMaskedHunter' } }),
})
export const AGENDA2_STAGE = Object.freeze({ ...stage(AGENDA2_CODE, { number: 2, reveal: { type: 'resolution2' } }) })
export const AGENDAS = Object.freeze([structuredClone(AGENDA1_STAGE), structuredClone(AGENDA2_STAGE)])
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1])])
export const AGENDA_VARIANTS = Object.freeze({
  default: structuredClone(AGENDA1_STAGE),
  alternate: structuredClone(AGENDA1_BASE_STAGE),
})
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  [ACT1_CODE, structuredClone(ACT_STAGES[1])],
  [AGENDA1_BASE_CODE, structuredClone(AGENDA1_BASE_STAGE)],
  [AGENDA1_RETURN_CODE, structuredClone(AGENDA1_STAGE)],
  [AGENDA2_CODE, structuredClone(AGENDA2_STAGE)],
]))

// ---------------------------------------------------------------------------
// 剧情正文
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English; guide source carries the full bilingual text)',
  heading: '重返午夜假面',
  intro: '你决定在午夜前找到尽可能多的异教徒，揭开他们的假面，查明那场亵渎仪式的计划……',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '找出以下遭遇组全部卡牌：重返午夜假面、午夜假面、寒冷刺骨、夜魇、上锁的门、'
      + '乌默尔多斯的教团。' },
    { key: 'agenda', text: '从两张密谋 1a「猎人还是猎物？」中随机选取一张构建密谋牌库（另一张移出游戏）。' },
    { key: 'locations', text: '东城区、北区、河岸城、米斯卡塔尼克大学各从原版与新版地点中随机取一，'
      + '连同南区、商业区（各自随机一张）、圣玛丽医院、墓地一起放置入场；其它版本移出游戏。' },
    { key: 'house', text: '若房屋尚未烧毁，将「你的房子」放置入场并从那里开始；若已烧毁，改为从河岸城开始。' },
    { key: 'cultistDeck', text: '将原版 5 名独特异教徒与重返版的 3 张乌默尔多斯教团新卡混洗成异教徒牌堆，'
      + '再随机移除 3 张（不查看）。' },
    { key: 'acolytes', text: '按人数-1 在南区、商业区、墓地生成噬魔信徒（重返版祭司）。' },
    { key: 'priest', text: '若食尸鬼祭司仍存活，将其洗入遭遇牌库。' },
    { key: 'readyToBegin', text: '现在可以开始游戏了。' },
  ]),
  rules: Object.freeze({
    narogath: '纳罗加斯：每有一位调查员 +3 生命；处于重整状态时，其所在地点和连接地点的调查员不能与[[异教徒]]敌人谈判。',
    locationVariants: '重返版地点（50027–50030）的每场游戏一次能力见卡面。',
  }),
  resolutions: Object.freeze({
    noResolution: '你们未能查明真相，但至少活了下来。',
    r1: '你成功获取了邪教计划的信息。但愿这一些够用。（结局 1：盘问到的异教徒记录在案。）',
    r2: '钟声响起，午夜已至。你们已经没有时间了……（结局 2：记录午夜已至。）',
  }),
  resolutionBranches: Object.freeze({ proceed: '前往幕间 II：地底噬魔。' }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT1_CODE]: '目标 - 将尽可能多的独特异教徒敌人加入胜利区；胜利区有 6 个独特异教徒则推进。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, AGENDA1_BASE_CODE, AGENDA1_RETURN_CODE, NAROGATH_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...Object.keys(ENEMIES), ...Object.keys(TREACHERIES), LITA_CODE, GHOUL_PRIEST_CODE,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '重返午夜假面 · Return to The Midnight Masks',
  nameEn: 'Return to The Midnight Masks',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: {},
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '按照重返剧本参考卡 50025 的布置步骤：随机选择一份密谋 1a，东城区/北区/河岸城/米斯卡塔尼克大学各随机取一版，异教徒牌堆混入重返版新卡后随机移除三张，并按人数生成噬魔信徒。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: [],
  rules: SCENARIO_TEXT.rules,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  enemies: ENEMIES,
  treacheries: TREACHERIES,
  storyAssets: {},
  encounterDeck: [...ENCOUNTER_DECK],
  cultistDeck: [...CULTIST_DECK_CODES],
  agendaVariants: AGENDA_VARIANTS,
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  setAsideLocations: [],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = {
  scenario: {
    [CHAPTER_ID]: {
      originalCode: REFERENCE_CODE, approximation: true,
      identityReason: '剧本容器汇总场景参考卡、设置与结局；50025 只标识场景参考卡。',
    },
  },
  locations: Object.fromEntries(LOCATION_TABLE.map(([id, primary]) => [id, { originalCode: primary }])),
  acts: { [`act${ACT1_CODE}`]: { originalCode: ACT1_CODE } },
  agendas: {
    [`agenda${AGENDA1_RETURN_CODE}`]: { originalCode: AGENDA1_RETURN_CODE, linkedOriginalCode: NAROGATH_CODE },
    [`agenda${AGENDA2_CODE}`]: { originalCode: AGENDA2_CODE },
  },
  enemies: Object.fromEntries(Object.keys(ENEMIES).map(code => [code, {
    originalCode: code,
    ...(code === NAROGATH_CODE ? { linkedOriginalCode: AGENDA1_RETURN_CODE } : {}),
    ...(code === AGENDA1_LINKED_CODE ? { linkedOriginalCode: AGENDA1_BASE_CODE } : {}),
  }])),
  treacheries: Object.fromEntries(Object.keys(TREACHERIES).map(code => [code, { originalCode: code }])),
  storyAssets: {},
}

bindScenarioIdentities(scenario, identities)

export default scenario
