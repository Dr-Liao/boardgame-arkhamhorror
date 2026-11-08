// 疯狂之心 第 I 部分（The Heart of Madness, Part I · 08648a / 提示卡 08648）· 剧本数据。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/TheHeartOfMadnessPart1.hs、
// CardDefs/EdgeOfTheEarth/{Act,Agenda,Location,Enemy,Treachery}/TheHeartOfMadness.hs、
// Scenarios/TheHeartOfMadness/Helpers.hs（theHeartOfMadnessLayout/spokes/rings）。
// 文本来源（P7）：`content/campaigns/edgeOfTheEarth/story-text.js` →
// `chapterStory('theHeartOfMadnessPart1')`（中文优先、en 回退；本文件不写死剧情正文）。
//
// 术语：十五座「古代设施」按参考地图排成三环五辐；五枚封印（A–E）是**战役级实体**
// （src/campaign/eote-seals.js），不进遭遇牌库，也不建卡条目。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { chapterStory } from '../../story-access.js'

const originalCode = code => String(code)
const cardOf = code => {
  const card = ALL_CARDS[originalCode(code)]
  if (!card) throw new RangeError(`《疯狂之心 I》缺少印刷卡 ${code}`)
  return card
}
const ENCOUNTER_GROUPS = Object.freeze(['the_heart_of_madness', 'the_great_seal', 'miasma', 'nameless_horrors',
  'penguins', 'shoggoths', 'tekelili', 'ancient_evils', 'locked_doors'])
export const GATHER_GROUPS = Object.freeze(['theHeartOfMadness', 'theGreatSeal', 'miasma', 'namelessHorrors',
  'penguins', 'shoggoths', 'tekelili', 'ancientEvils', 'lockedDoors'])

const printedOf = code => {
  const card = cardOf(code)
  return {
    code: String(code), originalCode: String(code),
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', textEn: card.text || '',
    ...(card.backText ? { backText: card.backTextZh || card.backText, backTextEn: card.backText } : {}),
    ...(card.backNameZh || card.backName ? { backName: card.backNameZh || card.backName, backNameEn: card.backName || '' } : {}),
    traits: [...(card.traits || [])],
  }
}

/** 地点：印刷帷幕/线索/胜利点 + 地图槽位与连接。 */
function location(id, code, extra = {}) {
  const card = cardOf(code)
  const base = printedOf(code)
  return {
    ...base, id, type: 'location',
    shroud: card.shroud || 0,
    cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues || 0 } : {}),
    victory: card.victory || 0,
    connections: [...(extra.connections || [])],
    unrevealedName: card.backNameZh || card.backName || card.nameZh || card.name,
    unrevealedNameEn: card.backName || card.name,
    ...extra,
  }
}

/** 幕/议程：印刷阶段号 + 章节流程字段（behavior 读 chapterFlow/objective，不按卡号分支）。 */
function stage(code, type, extra = {}) {
  const card = cardOf(code)
  const base = printedOf(code)
  return {
    ...base, id: `${type}${code}`, type,
    stage: `${card.stage ?? extra.number ?? 1}a`,
    ...(type === 'agenda' ? { doomThreshold: card.doom || 0 } : {}),
    reveal: { type: 'campaignRule' },
    advanceText: card.backTextZh || card.backText || '',
    ...extra,
  }
}

// 十五座设施的印刷卡号：Great Seal 组 5 张 + Heart of Madness 组 10 张（含 2 张 Subnautical Sprawl、
// 3 张 Vaulted Corridor）。槽位按参考地图 facility1–facility15 命名，卡面在 setup 时随机分配。
export const FACILITY_SLOT_CODES = Object.freeze([
  '08664', '08665', '08666', '08667', '08668', // The Great Seal：Glacial Grotto/Sculptured Crypt/Undercity Altar/Ichor-Laden Tunnels/Limestone Caverns
  '08650', '08651', '08652', '08653', '08654', // The Heart of Madness
  '08655', '08655', // Subnautical Sprawl ×2
  '08656', '08656', '08656', // Vaulted Corridor ×3
])

// 五枚休眠封印所在地点（按印刷卡号；setup 随机分配后由 behavior 把封印放到对应槽位）。
export const SEAL_LOCATION_CODES = Object.freeze({
  A: '08664', B: '08665', C: '08666', D: '08667', E: '08668',
})
// 五座「激活封印」的地点（印刷卡号 → 封印种类）。
export const ACTIVATE_LOCATION_CODES = Object.freeze({
  '08650': 'A', '08652': 'B', '08651': 'C', '08653': 'D', '08654': 'E',
})

const facilitySlots = Object.fromEntries(FACILITY_SLOT_CODES.map((code, index) => {
  const slot = `facility${index + 1}`
  return [slot, location(slot, code, { slot: index + 1 })]
}))

// 参考 theHeartOfMadnessLayout：facility1 在正上，gate 在中心；连接由环/辐在 layout.js 计算。
const locations = {
  theGateOfYquaa: location('theGateOfYquaa', '08649', { gate: true }),
  ...facilitySlots,
}

// 环/辐（设施槽位编号）：ring1 外环、ring2 中环、ring3 内环；spoke1–5 从门向外辐射。
export const RINGS = Object.freeze([
  [1, 2, 3, 14, 15],
  [4, 5, 6, 12, 13],
  [7, 8, 9, 10, 11],
])
export const SPOKES = Object.freeze([
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
  [10, 12, 14],
  [11, 13, 15],
])

// 连接：环上相邻成环、辐上相邻成链；门与最近的内环设施（spoke1–3 的内端点 7/8/9）相连。
for (const group of [...RINGS, ...SPOKES]) {
  group.forEach((slot, index) => {
    const next = group[(index + 1) % group.length]
    const from = locations[`facility${slot}`]
    const to = locations[`facility${next}`]
    if (!from || !to || slot === next) return
    if (group.length === 3 && index === group.length - 1) return // 辐是链，不是环
    if (!from.connections.includes(to.id)) from.connections.push(to.id)
    if (!to.connections.includes(from.id)) to.connections.push(from.id)
  })
}
for (const inner of ['facility7', 'facility8', 'facility9']) {
  locations.theGateOfYquaa.connections.push(inner)
  locations[inner].connections.push('theGateOfYquaa')
}

// 遭遇卡：收齐九个组后剔除 act/agenda/location/story，按印刷份数展开成初始遭遇牌库。
const encounterCodes = new Set()
for (const card of Object.values(ALL_CARDS)) {
  if (!ENCOUNTER_GROUPS.includes(card.encounterCode)) continue
  if (!['enemy', 'treachery'].includes(card.type)) continue
  encounterCodes.add(card.code)
}
const enemyDefinitions = {}
const treacheryDefinitions = {}
for (const code of [...encounterCodes].sort()) {
  const card = cardOf(code)
  const base = printedOf(code)
  if (card.type === 'enemy') {
    enemyDefinitions[code] = {
      ...base, type: 'enemy', fight: card.fight ?? 0, evade: card.evade ?? 0,
      health: card.health ?? 1, damage: card.damage ?? 0, horror: card.horror ?? 0,
      ...(card.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
      ...Object.fromEntries(['hunter', 'aloof', 'massive', 'retaliate', 'alert'].filter(key =>
        new RegExp(`\\b${key[0].toUpperCase()}${key.slice(1)}\\b`).test(card.text || '')).map(key => [key, true])),
      ...(card.victory != null ? { victory: card.victory } : {}),
    }
  } else {
    treacheryDefinitions[code] = { ...base, type: 'treachery', entryRevelation: true,
      surge: /^Surge\./m.test(card.text || '') }
  }
}
export const ENCOUNTER_DECK = Object.freeze([...encounterCodes].sort()
  .flatMap(code => Array(cardOf(code).quantity || 1).fill(code)))

const story = chapterStory('theHeartOfMadnessPart1')

function resolutionTexts(chapter) {
  return Object.fromEntries(Object.entries(chapter.resolutions || {}).map(([key, value]) => {
    if (typeof value === 'string') return [key, value]
    const parts = [value?.title, value?.body].filter(Boolean)
    return [key, parts.join('\n')]
  }))
}

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: story.status === 'present' ? 'translated' : 'mixed (en fallback for missing leaves)',
  title: story.title,
  intro: typeof story.intro === 'string' ? story.intro : '',
  setup: typeof story.setup === 'string' ? story.setup : '',
  resolutions: Object.freeze(resolutionTexts(story)),
})

const ACT_EXTRA = Object.freeze({
  '08662': { chapterFlow: 'dormancy', objective: { type: 'activatedSealOnGate' } },
  '08663': { chapterFlow: 'greatSeal', objective: { type: 'allSealsOnGate' } },
})
const AGENDA_EXTRA = Object.freeze({
  '08659': { chapterFlow: 'beatingHeart', detonation: true },
  '08660': { chapterFlow: 'miasmaBeckons', detonation: true },
  '08661': { chapterFlow: 'callOfMadness', detonation: true },
})

export const scenario = {
  id: 'theHeartOfMadnessPart1',
  // 桌面提示卡 = 08648 正面；08648a/b 是双面剧本卡的背面身份，卡表不单列。
  originalCode: '08648',
  referenceCode: '08648',
  name: '疯狂之心 第 I 部分 · The Heart of Madness, Part I',
  nameEn: 'The Heart of Madness, Part I',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: 'theGateOfYquaa',
  locations,
  facilitySlots: Object.freeze(Object.keys(facilitySlots)),
  facilitySlotCodes: FACILITY_SLOT_CODES,
  sealLocationCodes: SEAL_LOCATION_CODES,
  activateLocationCodes: ACTIVATE_LOCATION_CODES,
  rings: RINGS,
  spokes: SPOKES,
  acts: [stage('08662', 'act', ACT_EXTRA['08662']), stage('08663', 'act', ACT_EXTRA['08663'])],
  agendas: [stage('08659', 'agenda', AGENDA_EXTRA['08659']),
    stage('08660', 'agenda', AGENDA_EXTRA['08660']), stage('08661', 'agenda', AGENDA_EXTRA['08661'])],
  enemies: enemyDefinitions,
  treacheries: treacheryDefinitions,
  storyAssets: {},
  encounterDeck: ENCOUNTER_DECK,
  resolutions: SCENARIO_TEXT.resolutions,
  tokenMeanings: {},
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = {
  locations: Object.fromEntries(Object.values(locations).map(entry => [entry.id,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  acts: Object.fromEntries(scenario.acts.map(entry => [entry.id,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  agendas: Object.fromEntries(scenario.agendas.map(entry => [entry.id,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  enemies: Object.fromEntries(Object.values(enemyDefinitions).map(entry => [entry.code,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  treacheries: Object.fromEntries(Object.values(treacheryDefinitions).map(entry => [entry.code,
    { originalCode: entry.originalCode, artCode: entry.originalCode }])),
  storyAssets: {},
}
bindScenarioIdentities(scenario, identities)

export { story }

// behavior.js 引用的印刷卡号统一放数据表（章节流程不写裸卡号字面量）。
export const RAW_CODES = Object.freeze({
  gate: '08649',
  agendas: Object.freeze(['08659', '08660', '08661']),
  acts: Object.freeze(['08662', '08663']),
  protoplasmicMass: '08669',
  electrostaticDischarge: '08670',
  primevalTerror: '08657',
  rootsOfTheEarth: '08658',
  ...Object.fromEntries(Object.entries(SEAL_LOCATION_CODES).map(([kind, code]) => [`seal${kind}`, code])),
})
