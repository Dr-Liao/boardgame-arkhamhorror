# 章节 theHeartOfMadnessPart1 · The Heart of Madness, Part I · 参考卡 08648

## 文件清单
- definition: content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js (10852B)
- behavior: content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js (13882B)
- chaos: content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/chaos.js (4564B)
- index: content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js (1273B)
- layout: content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/layout.js (2458B)
- texts: content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/texts.js (1414B)

## 章节卡号
08659 08660 08661 08662 08663 08664 08665 08666 08667 08668 08669 08670

## 指南来源
- en: frontend/src/locales/en/edgeOfTheEarth/scenarios/theHeartOfMadness.json (51410B, keys=64)
- zh: frontend/src/locales/zh/edgeOfTheEarth/scenarios/theHeartOfMadness.json (39307B, keys=53)

## 相关测试
- tests/eote-scenario-theHeartOfMadnessPart1.test.mjs

## content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js
```js
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

```

## content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
```js
// 疯狂之心 第 I 部分 · 引擎钩子（章节流程 + 大封印机械）。
// 约定：逐卡规则在各单卡条目（locationRule/actRule/agendaRule/enemyScript/flags）；
// behavior 只做分派与本章专属机械（随机布置、休眠封印、大封印目标、爆炸即败、结局记录）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor, entryFlags, enemyScriptFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { initializeSeals, placeDormantSeal, recoverSeal, sealsOf, sealsAt } from '../../../../../src/campaign/eote-seals.js'
import { HEART_OF_MADNESS_TOKEN_MEANINGS, heartOfMadnessChaosAfterTest, heartOfMadnessChaosToken, isMistPylon, locationSeals } from './chaos.js'
import { RAW_CODES, SEAL_LOCATION_CODES } from './definition.js'

export const scenarioApproximations = Object.freeze([
  '原质团「敌人阶段结束时再次重整并结算敌人阶段」按重整+提示近似。',
  '石板标记抽忒咳哩-哩牌直接取牌库顶放入弃牌堆（P5 弱点管线近似）。',
  'cultist 视为寒霜只声明 asFrost 字段。',
])
export const scenarioGaps = Object.freeze([])

const CHAPTER_ID = 'theHeartOfMadnessPart1'
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)
const recordsFor = state => { state.campaign ||= {}; state.campaign.records ||= {}; return state.campaign.records }
const flagsOf = state => (state.scenarioFlags ||= {})

function shuffled(state, list) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const target = Math.floor(randomValue(state) * (index + 1))
    ;[out[index], out[target]] = [out[target], out[index]]
  }
  return out
}

function randomizeFacilityFaces(state) {
  const scenario = state.scenario
  const slots = scenario.facilitySlots || []
  const pool = shuffled(state, slots.map(slot => ({ ...scenario.locations[slot] })))
  slots.forEach((slot, index) => {
    const definition = scenario.locations[slot]
    const face = pool[index]
    Object.assign(definition, {
      code: face.originalCode, originalCode: face.originalCode,
      name: face.name, nameEn: face.nameEn, text: face.text, textEn: face.textEn,
      backText: face.backText, backTextEn: face.backTextEn,
      backName: face.backName, backNameEn: face.backNameEn,
      unrevealedName: face.unrevealedName, unrevealedNameEn: face.unrevealedNameEn,
      shroud: face.shroud, cluesPerInvestigator: face.cluesPerInvestigator,
      victory: face.victory, traits: [...(face.traits || [])], slot: definition.slot,
    })
    if (face.cluesFixed == null) delete definition.cluesFixed
    else definition.cluesFixed = face.cluesFixed
  })
}

function sealKindAtLocation(state, locationId) {
  const code = codeOf(locationOf(state, locationId))
  return Object.keys(SEAL_LOCATION_CODES).find(kind => SEAL_LOCATION_CODES[kind] === code) || null
}
function sealsHeld(state, seat) {
  return sealsOf(state).filter(entry => entry.locationId == null && entry.placedBySeat === seat)
}
function activatedSealsAtLocation(state, locationId) {
  return sealsAt(state, locationId).filter(entry => entry.active)
}
function gateSeals(state) {
  return activatedSealsAtLocation(state, state.scenario.startLocation)
}

function checkDetonation(state, api) {
  if (state.status !== 'playing') return false
  const counts = new Map()
  for (const inv of activeInvestigators(state)) {
    const active = sealsHeld(state, inv.seat).filter(entry => entry.active).length
    if (active) counts.set(inv.location, (counts.get(inv.location) || 0) + active)
  }
  if (![...counts.values()].some(count => count >= 2)) return false
  api.info?.('💥 同一地点两名调查员控制 2 枚激活封印：静电爆炸毁灭一切（→R3）。')
  api.finish?.('resolution3', state)
  return true
}

export const behavior = {
  id: CHAPTER_ID,
  name: '疯狂之心 第 I 部分',

  preScenarioSetup(state, events, api) {
    const flags = flagsOf(state)
    if (!flags.sealsInitialized) {
      try { initializeSeals(state) } catch (error) { if (!/已初始化/.test(String(error))) throw error }
      flags.sealsInitialized = true
    }
    api.info?.('🫀 疯狂之心 I：十五座古代设施按三环五辐随机布置；五枚封印放在一边。')
    if (state.difficulty === 'hard') api.addDoom?.(1)
    if (state.difficulty === 'expert') api.addDoom?.(2)
  },

  setupLocations(state, events, helper = {}) {
    randomizeFacilityFaces(state)
    flagsOf(state).locationsRandomized = true
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = state.scenarioZones.setAside || []
    state.encounterDeck = state.encounterDeck?.length ? state.encounterDeck : [...(state.scenario.encounterDeck || [])]
    helper.info?.(state, events, '🫀 古代设施已随机布置；伊夸之门已揭示，调查员从门开始。')
    return ['theGateOfYquaa', ...(state.scenario.facilitySlots || [])]
  },

  afterDeckSetup(state, events, helper = {}) {
    helper.info?.(state, events, `🫀 遭遇牌库 ${state.encounterDeck?.length || 0} 张。`)
  },

  locationRevealed(state, location, api) {
    const kind = sealKindAtLocation(state, location?.id)
    if (!kind) return
    if (placeDormantSeal(state, kind, location.id)) api.info?.(`🫀 「${location.name}」揭示：休眠封印 ${kind} 放到此地。`)
  },

  actions(state, inv) {
    const location = locationOf(state, inv?.location)
    if (!location) return []
    const moves = []
    locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    return moves
  },

  fastActions(state, inv) {
    const location = locationOf(state, inv?.location)
    if (!location) return []
    const moves = []
    locationRuleFor(codeOf(location))?.fastActions?.({ moves, state, inv, location })
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move) return false
    const location = locationOf(state, inv?.location)
    if (!location) return false
    if (typeof move.rule === 'string' && move.rule.startsWith('heartOfMadnessSeal:')) {
      const kind = move.rule.slice('heartOfMadnessSeal:'.length)
      const flags = entryFlags(codeOf(location)) || {}
      const perInvestigator = Number(state.numInvestigators) || (state.investigators || []).length || 1
      const atLocation = activeInvestigators(state).filter(other => other.location === location.id)
      const resourcesNeeded = (flags.recoverResourcesPerInvestigator || 0) * perInvestigator
      if (resourcesNeeded > 0 && atLocation.reduce((sum, other) => sum + (Number(other.resources) || 0), 0) < resourcesNeeded) {
        api.info?.(`🫀 封印 ${kind}：团队资源不足（需要 ${resourcesNeeded}）。`)
        return true
      }
      const recover = () => {
        if (api.payGroupClues?.(perInvestigator, { atLocation: location.id }) === false) {
          api.info?.(`🫀 封印 ${kind}：团队线索不足（需要 ${perInvestigator}）。`)
          return
        }
        if (resourcesNeeded > 0) {
          let remaining = resourcesNeeded
          for (const other of atLocation) {
            const taken = Math.min(remaining, Number(other.resources) || 0)
            other.resources = (Number(other.resources) || 0) - taken
            remaining -= taken
          }
        }
        if (recoverSeal(state, kind, { seat: inv.seat })) api.info?.(`🫀 ${inv.name || '调查员'} 取得封印 ${kind} 的控制权（休眠）。`)
      }
      if (flags.recoverSkill) api.test?.(inv.seat, flags.recoverSkill, flags.recoverDifficulty || 2, recover)
      else recover()
      return true
    }
    const handled = locationRuleFor(codeOf(location))?.performAction?.(state, inv, move, api)
    if (handled) return true
    return checkDetonation(state, api)
  },

  resolveEncounter(state, inv, treachery, api) {
    const flags = entryFlags(codeOf(treachery)) || {}
    if (flags.revelation === 'electrostaticDischarge') {
      const here = locationOf(state, inv?.location)
      const seal = here ? locationSeals(state, here.id).find(entry => entry.active) : null
      api.horror?.(inv.seat, 1)
      if (seal) api.damage?.(inv.seat, 1)
      api.info?.(`⚡ 静电放电：与封印同地点的调查员受 ${seal ? '1 伤害与 1' : '1'} 恐惧。`)
      return true
    }
    return false
  },

  checkObjectives(state, api) {
    if (state.status !== 'playing') return
    if (checkDetonation(state, api)) return
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const objective = actRuleFor(codeOf(act))?.objective
    if (!objective) return
    const placed = gateSeals(state).length
    if (objective.type === 'activatedSealOnGate' && placed >= 1) {
      api.info?.('🫀 幕 1 目标达成：有激活封印放在伊夸之门上，推进幕。')
      api.advanceAct?.()
      return
    }
    if (objective.type === 'allSealsOnGate' && placed >= 5) {
      api.info?.('🫀 五枚激活封印全部放上伊夸之门：大封印完成（→R1）。')
      api.finish?.('resolution1', state)
    }
  },

  agendaForced(state, when, api, forcedType) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return undefined
    return agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.forced?.[when]?.(state, agenda, api, forcedType)
  },

  actReveal(state, act, api) {
    actRuleFor(codeOf(act))?.onReveal?.(state, act, api)
    return true
  },

  agendaReveal(state, agenda, api) {
    agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.onReveal?.(state, agenda, api)
    return true
  },

  agendaLeftPlay(state, agenda, api) {
    agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.onLeave?.(state, agenda, api)
    checkDetonation(state, api)
  },

  actLeftPlay(state, act, api) {
    actRuleFor(codeOf(act))?.onLeave?.(state, act, api)
  },

  afterTest(state, inv, result, api) {
    for (const effect of heartOfMadnessChaosAfterTest(state, inv, result)) {
      if (effect.type === 'drawTekeli') {
        const deck = state.scenarioDecks?.tekeli?.deck
        if (Array.isArray(deck) && deck.length) {
          const code = deck.pop()
          inv.discard.push(code)
          api.info?.(`🟣 石板标记：抽取忒咳哩-哩牌库顶（「${ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code}」进入弃牌堆）。`)
        } else api.info?.('🟣 石板标记：忒咳哩-哩牌库为空。')
      } else if (effect.type === 'addDoom') {
        api.addDoom?.(effect.amount)
        api.info?.('🌑 旧日支配者标记：失败 3 点或更多，在当先议程放置 1 毁灭。')
      }
    }
    checkDetonation(state, api)
  },

  resolveChaosToken(state, inv, token) {
    return heartOfMadnessChaosToken(state, inv, token)
  },

  applyTokenEffect(state, context) {
    if (context?.token !== 'frost') return undefined
    const seat = context?.seat
    const location = locationOf(state, seat != null ? state.investigators?.[seat]?.location : context?.location)
    if (!location || codeOf(location) !== '08655') return undefined
    const flags = flagsOf(state)
    const key = `${state.round}:${location.id}`
    if (flags.frostTreatRound === key) return undefined
    flags.frostTreatRound = key
    return { modifier: -3, once: true }
  },

  enemyPhaseEnd(state, api) {
    const mass = (state.enemies || []).find(enemy => codeOf(enemy) === RAW_CODES.protoplasmicMass)
    if (!mass || mass.readiedAgainRound === state.round) return
    const anyActivated = activeInvestigators(state).some(inv => sealsHeld(state, inv.seat).some(entry => entry.active))
    if (!anyActivated) return
    mass.readiedAgainRound = state.round
    mass.exhausted = false
    api.info?.('🫀 原质团在敌人阶段结束时重整（近似：不重复整段敌人阶段）。')
  },

  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const gate = state.scenario?.startLocation
    const placed = activatedSealsAtLocation(state, gate).map(entry => entry.kind)
    const recovered = sealsOf(state).filter(entry => entry.placedBySeat != null).map(entry => entry.kind)
    if (placed.length) records.sealsPlaced = placed
    if (recovered.length) records.sealsRecovered = recovered
    const activeCount = sealsOf(state).filter(entry => entry.active).length
    if (key === 'resolution3' || key === 'r3') {
      records.theSealWasUsedImproperly = true
      for (const inv of state.investigators || []) {
        if (!inv.defeated && !inv.resigned) { inv.defeated = true; inv.defeatCause = 'killed' }
      }
      api.info?.('💀 静电爆炸：调查员全部被击败（R3）。')
      return { award: true, bonus: 0 }
    }
    if (key === 'noResolution') {
      records.theSealWasUsedImproperly = true
      api.info?.('🫀 无结局：转为 R2 结算。')
      return { award: true, bonus: activeCount }
    }
    if (['resolution1', 'r1', 'resolution2', 'r2'].includes(key)) {
      api.info?.(`🫀 大封印结算：激活封印 ${activeCount} 枚 → +${activeCount} 经验。`)
      return { award: true, bonus: activeCount }
    }
    return { award: true, bonus: 0 }
  },
}

export const implementedEncounterCodes = Object.freeze([
  '08659', '08660', '08661', '08662', '08663', '08664', '08665', '08666', '08667', '08668',
  '08669', '08670',
])

export const HEART_OF_MADNESS_RULES = Object.freeze({
  tokenMeanings: HEART_OF_MADNESS_TOKEN_MEANINGS,
  sealLocationCodes: SEAL_LOCATION_CODES,
})

void isMistPylon
void enemyScriptFor
void leadSeat
```

## content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/chaos.js
```js
// 疯狂之心 第 I 部分 · 混乱标记取值与后果（参考 08648 参考卡 + 剧本卡面）。
//
// 口径：`behavior.resolveChaosToken` 负责符号标记的**动态数值**（ treachery-tokens 的单一读点），
// 主检定的静态文本/默认值来自 `scenario.tokenMeanings`（本文件导出）；
// 失败后的强制（石板抽 Tekeli-li、旧日支配者失败 3+ 放毁灭、异教徒标记视为寒霜）在
// `behavior.afterTest` / `resolveChaosToken` 里按卡面执行，behavior 必须幂等。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

export const chaosFx = (delta, extra = {}) => ({ delta, ...extra })

const TOKEN_TEXT = Object.freeze({
  standard: Object.freeze({
    skull: { text: '-1（如果你所在地点有[[旧日支配者]]敌人，改为-3）。', delta: 0 },
    cultist: { text: '-1。如果你所在地点有封印，或你所在地点是迷雾高塔，改为把该标记视为寒霜标记。', delta: 0 },
    tablet: { text: '-3。如果你失败，抽取忒咳哩-哩牌库顶的卡牌。', delta: 0 },
    elderthing: { text: '-4。如果你失败 3 点或更多，在当先议程上放置 1 毁灭。', delta: 0 },
  }),
  hard: Object.freeze({
    skull: { text: '-2（如果你所在地点有[[旧日支配者]]敌人，改为-4）。', delta: 0 },
    cultist: { text: '-1。如果你所在地点有封印，或你所在地点是迷雾高塔，该标记额外视为寒霜标记。', delta: 0 },
    tablet: { text: '-3。抽取忒咳哩-哩牌库顶的卡牌。', delta: 0 },
    elderthing: { text: '-5。如果你失败 3 点或更多，在当先议程上放置 1 毁灭。', delta: 0 },
  }),
})

export const HEART_OF_MADNESS_TOKEN_MEANINGS = TOKEN_TEXT
export const TOKEN_MEANING_SOURCE = 'cards-data:08648'

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

const traitsOf = card => (ALL_CARDS[card?.originalCode || card?.code]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())

function locationOf(state, id) {
  return (state?.locations || []).find(location => location.id === id) || null
}

export function locationSeals(state, locationId) {
  const seals = state?.campaign?.eote?.seals?.entries || []
  return seals.filter(entry => entry && entry.locationId === locationId)
}

export function isMistPylon(state, location) {
  return Boolean(location && (location.mistPylon === true
    || String(location.name || '').toLowerCase().includes('mist-pylon')))
}

/** [cultist] 是否按寒霜处理：地点上有封印，或地点是迷雾高塔。 */
export function cultistCountsAsFrost(state, inv) {
  const here = locationOf(state, inv?.location)
  if (!here) return false
  return isMistPylon(state, here) || locationSeals(state, here.id).length > 0
}

/** [skull] 动态数值：所在地点有 Ancient One 敌人时加深；返回 null 交回默认 tokenMeanings。 */
export function heartOfMadnessChaosToken(state, inv, token) {
  if (token === 'skull') {
    const here = locationOf(state, inv?.location)
    const ancientOne = (state?.enemies || []).some(enemy => enemy && enemy.location === here?.id
      && traitsOf(enemy).includes('ancient one'))
    return chaosFx(hardSide(state) ? (ancientOne ? -4 : -2) : (ancientOne ? -3 : -1))
  }
  if (token === 'cultist') {
    return chaosFx(-1, cultistCountsAsFrost(state, inv) ? { asFrost: true } : {})
  }
  if (token === 'tablet') return chaosFx(-3, { drawTekeliOnFail: true })
  if (token === 'elderthing') return chaosFx(hardSide(state) ? -5 : -4, { doomOnFailBy: 3 })
  return null
}

/**
 * 检定后的符号后果（behavior.afterTest 调用；必须幂等）：
 *   · [tablet] 失败：抽忒咳哩-哩牌库顶 1 张（简单/标准；困难/专家无论成败都抽）；
 *   · [elderthing] 失败 3 点或更多：在当先议程上放 1 毁灭。
 * 具体执行交给 api（drawTekeliCard / addDoom），本函数只返回要结算的后果列表。
 */
export function heartOfMadnessChaosAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const failedBy = Math.max(0, Number(result.failedBy) || 0)
  const effects = []
  if (tokens.includes('tablet') && (hardSide(state) || !result.success)) effects.push({ type: 'drawTekeli' })
  if (tokens.includes('elderthing') && !result.success && failedBy >= 3) effects.push({ type: 'addDoom', amount: 1 })
  return effects
}

```