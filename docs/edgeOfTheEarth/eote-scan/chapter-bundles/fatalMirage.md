# 章节 fatalMirage · Fatal Mirage · 参考卡 08549

## 文件清单
- definition: content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js (9110B)
- behavior: content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js (15566B)
- chaos: content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js (1760B)
- index: content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js (1670B)
- layout: content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/layout.js (273B)
- texts: content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/texts.js (161B)

## 章节卡号
08549 08550 08551 08552 08553 08554 08555 08556 08556b 08557 08557b 08558 08558b 08559 08559b 08560 08560b 08561 08561b 08562 08562b 08563 08563b 08564 08564b 08565 08565b 08566 08566b 08567 08567b 08568 08568b 08569 08569b 08570 08570b 08571 08571b 08572 08572b 08573 08573b 08574 08574b 08575 08575b 08576 08576b 08577 08577b 08578 08578b 08579 08579b 08580 08580b 08581 08581b 08582 08582b 08583 08583b 08584 08585 08586 08587 08588 08589 08590 08591 08592 08593 08594 08595

## 指南来源
- en: frontend/src/locales/en/edgeOfTheEarth/scenarios/fatalMirage.json (16394B, keys=68)
- zh: frontend/src/locales/zh/edgeOfTheEarth/scenarios/fatalMirage.json (9619B, keys=34)

## 相关测试
- tests/eote-scenario-fatalMirage.test.mjs

## content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js
```js
// 致命幻景（fatalMirage · 08549）· 章节数据。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs +
//       Location/Act/Agenda/Enemy/Treachery/Asset/CardDefs/EdgeOfTheEarth/FatalMirage.hs。
// 三次可重入（版本 1/2/3）：首次是「幻景 1」；重入时按已完成次数切换密谋/幕版本，
// 并把上一轮发现的记忆（地点）与已放逐记忆（胜利区）带回来。剧情正文来自 story-access.js。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor, printed } from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution } from '../../story-access.js'
import { FATAL_MIRAGE_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'fatalMirage'
export const REFERENCE_CODE = '08549'
// 三个版本：版本 = 第几次游玩致命幻景。
export const AGENDA_VERSION_CODES = Object.freeze({ 1: '08550', 2: '08551', 3: '08552' })
export const ACT_VERSION_CODES = Object.freeze({ 1: '08553', 2: '08554', 3: '08555' })

export const GATHER_GROUPS = Object.freeze([
  'fatalMirage', 'agentsOfTheUnknown', 'leftBehind', 'miasma',
  'namelessHorrors', 'silenceAndMystery', 'tekelili',
])

// 印刷地点 08556–08574：符号 + 幻景层（tier，卡面「幻景N[per_investigator]」）。
export const LOCATION_TABLE = Object.freeze([
  ['prisonOfMemories', '08556', 'circle', 1], ['baseCamp', '08557', 'triangle', 1],
  ['deckOfTheTheodosia', '08558', 'triangle', 1], ['universityHalls', '08559', 'triangle', 1],
  ['hedgeMaze', '08560', 'diamond', 2], ['desertedStation', '08561', 'spade', 2],
  ['coastalWaters', '08562', 'square', 2], ['elderChamber', '08563', 'moon', 2],
  ['riverviewTheatre', '08564', 'trefoil', 2], ['standingStones', '08565', 'hourglass', 2],
  ['airfield', '08566', 'star', 2], ['alaskanWilds', '08567', 'heart', 2],
  ['clutteredDormitory', '08568', 't', 2], ['dyersClassroom', '08569', 'droplet', 2],
  ['infirmaryFatalMirage', '08570', 'squiggle', 2], ['drKenslersOffice', '08571', 'squiggle', 2],
  ['moaiStatues', '08572', 'equals', 2], ['ottomanFront', '08573', 'star', 2],
  ['theBlackStone', '08574', 'droplet', 2],
])

// Haskell#fatalMirageLayout（行列投影；相邻格互相连接）。
export const GRID = Object.freeze([
  '.  ottomanFront  .  desertedStation  alaskanWilds',
  'airfield  .  baseCamp  .  infirmaryFatalMirage',
  '.  coastalWaters  prisonOfMemories  riverviewTheatre  .',
  'moaiStatues  deckOfTheTheodosia  .  universityHalls  drKenslersOffice',
  '.  hedgeMaze  standingStones  elderChamber  clutteredDormitory',
  '.  dyersClassroom  .  theBlackStone  .',
])

function gridFacts(grid, table) {
  const ids = new Set(table.map(([id]) => id))
  const cells = []
  grid.forEach((line, row) => line.trim().split(/\s{2,}/).forEach((token, column) => {
    if (token && token !== '.' && ids.has(token)) cells.push({ token, row, column })
  }))
  const byId = Object.fromEntries(cells.map(cell => [cell.token, cell]))
  const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1
  const coordinates = Object.fromEntries(cells.map(cell => [cell.token, { x: cell.column * 2, y: cell.row * 2 }]))
  const connections = Object.fromEntries(cells.map(cell => [cell.token,
    cells.filter(other => other.token !== cell.token && adjacent(cell, other)).map(other => other.token)]))
  return { coordinates, connections }
}

const facts = gridFacts(GRID, LOCATION_TABLE)
export const LOCATION_COORDINATES = Object.freeze(facts.coordinates)
export const LOCATION_CONNECTIONS = Object.freeze(facts.connections)

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, symbol, tier]) => {
  const base = location({ id, code, symbol, cluesFixed: false, clues: 0 })
  return [id, { ...base, symbol, tier, connections: [...LOCATION_CONNECTIONS[id]] }]
})))

const safeChapterStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sections: { resolutions: {} } }
  }
}
const SECTIONS = safeChapterStory(CHAPTER_ID).sections || {}
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN', textStatus: 'translated (self-translated)',
  intro: blocks(SECTIONS.intro?.title, SECTIONS.intro?.body),
  intro2: blocks(SECTIONS.flavorText?.intro2?.body),
  setup: blocks(SECTIONS.setup?.body),
  resolutions: Object.freeze(Object.fromEntries(Object.entries(SECTIONS.resolutions || {})
    .map(([key, value]) => [key, flattenResolution(value)]))),
})

const groupCodes = Object.entries(ALL_CARDS)
  .filter(([, card]) => GATHER_GROUPS.some(group => card.encounterCode === group
    .replace(/([A-Z])/g, '_$1').toLowerCase()))
  .map(([code]) => code)
export const ENCOUNTER_DECK = Object.freeze(groupCodes.filter(code => {
  const card = ALL_CARDS[code]
  if (!['enemy', 'treachery'].includes(card.type)) return false
  if (/^0857[5-9]$/.test(code) || /^0858[0-3]$/.test(code)) return false // 记忆敌人放一边
  return true
}))
export const MEMORY_ENEMY_CODES = Object.freeze(['08575', '08576', '08577', '08578', '08579', '08580', '08581', '08582', '08583'])
export const HORROR_SHADOW_CODE = '08584'
export const TREACHERY_CODES = Object.freeze(['08585', '08586'])
export const PARTNER_CODES = Object.freeze(['08587', '08588', '08589', '08590', '08591', '08592', '08593', '08594', '08595'])
export const MEMORY_STORY_CODES = Object.freeze(MEMORY_ENEMY_CODES.map(code => `${code}b`))
export const LOCATION_STORY_CODES = Object.freeze(LOCATION_TABLE.map(([, code]) => `${code}b`).filter(code => code !== '08556b'))
export const ALL_STORY_CODES = Object.freeze(['08556b', ...LOCATION_STORY_CODES, ...MEMORY_STORY_CODES])

const defs = encounterDefinitions([...ENCOUNTER_DECK])
const partnerDefs = Object.fromEntries(PARTNER_CODES.map(code => [code, { ...printed(code), global: true }]))
const storyDefs = Object.fromEntries(ALL_STORY_CODES.map(code => [code, { ...printed(code), global: true }]))

// 记忆（地点→记忆敌人→伙伴）关系：剧情卡背面决定「活着的伙伴」生成记忆敌人、被划掉则放逐。
export const MEMORY_LINKS = Object.freeze({
  alaskanWilds: { enemy: '08575', partner: '08589' },
  infirmaryFatalMirage: { enemy: '08576', partner: '08590' },
  airfield: { enemy: '08577', partner: '08595' },
  ottomanFront: { enemy: '08578', partner: '08592' },
  dyersClassroom: { enemy: '08579', partner: '08587' },
  clutteredDormitory: { enemy: '08580', partner: '08588' },
  theBlackStone: { enemy: '08581', partner: '08591' },
  moaiStatues: { enemy: '08582', partner: '08594' },
  drKenslersOffice: { enemy: '08583', partner: '08593' },
})
// 幻景层 2 地点由幻景层 1 剧情卡背面的三项选择之一揭示。
export const MIRAGE_CHOICES = Object.freeze({
  baseCamp: ['coastalWaters', 'desertedStation', 'riverviewTheatre'],
  deckOfTheTheodosia: ['coastalWaters', 'hedgeMaze', 'standingStones'],
  universityHalls: ['elderChamber', 'riverviewTheatre', 'standingStones'],
  airfield: ['alaskanWilds'],
  alaskanWilds: ['clutteredDormitory'],
  coastalWaters: ['airfield', 'ottomanFront'],
  elderChamber: ['clutteredDormitory'],
  riverviewTheatre: ['drKenslersOffice', 'infirmaryFatalMirage'],
  standingStones: ['theBlackStone', 'dyersClassroom'],
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '致命幻景 · Fatal Mirage',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: 'prisonOfMemories',
  locations: LOCATIONS,
  setAsideLocations: LOCATION_TABLE.map(([id]) => id).filter(id => id !== 'prisonOfMemories'),
  acts: [stage(ACT_VERSION_CODES[1])].map(act => ({ ...act, reveal: { type: 'campaignRule' }, chapterFlow: 'fatalMirage' })),
  agendas: [stage(AGENDA_VERSION_CODES[1])].map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' }, chapterFlow: 'fatalMirage' })),
  ...defs,
  storyAssets: { ...partnerDefs, ...storyDefs },
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: {
    victory: SCENARIO_TEXT.resolutions.victory || '',
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
    defeat: SCENARIO_TEXT.resolutions.defeat || '',
  },
  tokenMeanings: {
    standard: { ...FATAL_MIRAGE_TOKEN_MEANINGS.standard }, hard: { ...FATAL_MIRAGE_TOKEN_MEANINGS.hard },
    easy: { ...FATAL_MIRAGE_TOKEN_MEANINGS.easy }, expert: { ...FATAL_MIRAGE_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries(
  [...Object.values(AGENDA_VERSION_CODES), ...Object.values(ACT_VERSION_CODES),
    ...MEMORY_ENEMY_CODES, HORROR_SHADOW_CODE, ...TREACHERY_CODES, ...PARTNER_CODES,
    ...LOCATION_TABLE.map(([, code]) => code)].map(code => [code, ALL_CARDS[code]])))

```

## content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js
```js
// 致命幻景 · 引擎钩子（章节流程：三次重入、记忆/放逐、伙伴与坚毅形态、幻景翻面、结局记录）。
//
// 约定同 TDE 章节：behavior 只做章节分派与本章机械；逐卡规则在单卡条目。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'
import {
  partnerState, setPartnerStatus, resoluteFormOf, isPartnerAlive, initializePartners,
} from '../../../../../src/campaign/eote-partners.js'
import { fatalMirageChaosTokenValue, storyVictoryCount } from './chaos.js'
import {
  ACT_VERSION_CODES, AGENDA_VERSION_CODES, LOCATIONS, MEMORY_ENEMY_CODES, MEMORY_LINKS,
  MIRAGE_CHOICES, PARTNER_CODES, scenario,
} from './definition.js'

// 坚毅伙伴（08587–08595）↔ 探险队遭遇组里的基础伙伴（按中文名反查，战役 266 张里唯一）。
const RESOLUTE_ONLY = new Set(PARTNER_CODES)
const BASE_BY_NAME = Object.fromEntries(Object.entries(ALL_CARDS)
  .filter(([, card]) => !RESOLUTE_ONLY.has(card.code) && card.encounterCode === 'expedition_team'
    && card.type === 'asset')
  .map(([code, card]) => [card.nameZh || card.name, code]))
const RESOLUTE_BY_BASE = Object.fromEntries(PARTNER_CODES
  .map(code => [BASE_BY_NAME[ALL_CARDS[code].nameZh || ALL_CARDS[code].name], code])
  .filter(([base]) => Boolean(base)))
const BASE_BY_RESOLUTE = Object.fromEntries(Object.entries(RESOLUTE_BY_BASE).map(([base, resolute]) => [resolute, base]))

const CHAPTER_ID = 'fatalMirage'
const activeInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const hasTrait = (code, trait) => (ALL_CARDS[code]?.traits || [])
  .some(value => String(value).toLowerCase() === String(trait).toLowerCase())
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const setIn = (state, key) => {
  const records = recordsFor(state)
  records[key] = Array.isArray(records[key]) ? records[key] : []
  return records[key]
}

// 「这是第几次致命幻景」：战役已完成次数 + 1；单测/独立游玩可用 scenarioFlags.fatalMirageVersion 覆盖。
export function fatalMirageVersion(state) {
  const override = Number(state.scenarioFlags?.fatalMirageVersion)
  if (Number.isInteger(override) && override >= 1 && override <= 3) return override
  if (state.scenarioFlags?.fatalMiragePart) return Math.min(3, Number(state.scenarioFlags.fatalMiragePart) || 1)
  const completed = Array.isArray(state.campaign?.completedSteps) ? state.campaign.completedSteps : []
  const times = completed.filter(step => step === CHAPTER_ID).length
    + (Number(state.campaign?.records?.fatalMirageTimes) || 0)
  return Math.min(3, times + 1)
}

export function agendaCodeForVersion(version) {
  return AGENDA_VERSION_CODES[version] || AGENDA_VERSION_CODES[1]
}
export function actCodeForVersion(version) {
  return ACT_VERSION_CODES[version] || ACT_VERSION_CODES[1]
}

// 记忆敌人 → 幻灵；名称与地点剧情卡背面对应（见 definition.MEMORY_LINKS）。
const memoryEnemyName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code

// Haskell#Setup（版本 1）：收集小组，建立遭遇牌库；从记忆囚笼开始；其余地点放一边；
// 记忆敌人与坚毅（伙伴）支援放一边；困难/专家额外放毁灭；已放逐记忆放胜利区。
export function setupScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  const version = fatalMirageVersion(state)
  state.scenarioFlags.fatalMirageVersion = version
  state.scenarioFlags.agendaCode = agendaCodeForVersion(version)
  state.scenarioFlags.actCode = actCodeForVersion(version)
  state.agendas = [{ ...scenario.agendas[0], originalCode: agendaCodeForVersion(version) }]
  state.acts = [{ ...scenario.acts[0], originalCode: actCodeForVersion(version) }]
  state.agendaIndex = (Number(state.agendaIndex) || 0) + version - 1
  state.actIndex = 0

  state.encounterDeck = [...scenario.encounterDeck]
  state.encounterDiscard ||= []
  state.victoryDisplay ||= []

  const records = recordsFor(state)
  const discovered = new Set(Array.isArray(records.memoriesDiscovered) ? records.memoriesDiscovered : [])
  const banished = setIn(state, 'memoriesBanished')

  // 版本 1：记忆囚笼开始，其余地点全部放一边；重入：上一轮发现的地点直接入场。
  state.locations = []
  const startId = 'prisonOfMemories'
  placeLocation(state, startId, { revealed: true, started: true })
  for (const id of discovered) if (LOCATIONS[id] && id !== startId) placeLocation(state, id, { revealed: true })
  const kept = new Set(state.locations.map(location => location.id))
  state.scenarioZones.setAsideLocations = Object.keys(LOCATIONS).filter(id => !kept.has(id)
    && !banished.includes(id))

  // 已放逐记忆：地点正面朝下放进胜利区，本轮不再出现。
  for (const id of banished) {
    const entry = LOCATIONS[id]
    if (entry) state.victoryDisplay.push({ code: LOCATIONS[id].code, type: 'story', from: 'memoriesBanished' })
  }

  // 记忆敌人：版本 1 全部放一边；对应伙伴已被划掉则直接进胜利区。
  const memoryEnemies = []
  for (const code of MEMORY_ENEMY_CODES) {
    const link = Object.entries(MEMORY_LINKS).find(([, value]) => value.enemy === code)
    const partnerCode = link?.[1]?.partner
    const alive = partnerCode ? isAlive(state, partnerCode) : true
    if (banished.includes(link?.[0])) {
      state.victoryDisplay.push({ code: `${code}b`, type: 'story', from: 'memoriesBanished' })
      continue
    }
    memoryEnemies.push(code)
    state.scenarioFlags[`memoryAlive:${code}`] = alive
  }
  state.scenarioZones.setAside = [...memoryEnemies]
  state.scenarioZones.setAsideResolute = [...PARTNER_CODES]

  for (const inv of activeInvestigators(state)) inv.location = startId
  if (['hard', 'expert'].includes(String(state.difficulty || 'standard'))) {
    state.doom = (Number(state.doom) || 0) + (state.difficulty === 'expert' ? 2 : 1)
  }
  // 伙伴名册可能已由序幕/幕间/检查点初始化（例如从幕间切入幻景）；P2 原语对重复创建会抛错，
  // 这里按「已初始化则复用」处理（与 initializeSeals 的守卫同口径）。
  try {
    initializePartners?.(state, {
      partners: Object.values(BASE_BY_NAME).map(code => ({ code, damage: 0, horror: 0 })),
      resoluteForms: Object.values(BASE_BY_NAME).filter(code => RESOLUTE_BY_BASE[code])
        .map(code => [code, RESOLUTE_BY_BASE[code]]),
    })
  } catch (error) {
    if (!/已初始化/.test(String(error))) throw error
  }
  api.info?.(`🌫️ 致命幻景（第 ${version} 次）：记忆囚笼开始；${state.scenarioZones.setAsideLocations.length} 个幻景地点放一边。`)
  return {
    version, agendaCode: agendaCodeForVersion(version), actCode: actCodeForVersion(version),
    startLocation: startId, setAsideLocations: [...state.scenarioZones.setAsideLocations],
    memoryEnemies: [...memoryEnemies], setAsideResolute: [...PARTNER_CODES],
  }
}

export function placeLocation(state, id, { revealed = true, started = false } = {}) {
  const data = LOCATIONS[id]
  if (!data || (state.locations || []).some(location => location.id === id)) return null
  const locationState = { ...data, id, clues: 0, maxClues: 0, doom: 0, revealed,
    ...(started ? { startedAt: true } : {}) }
  state.locations.push(locationState)
  state.scenarioZones ||= {}
  state.scenarioZones.setAsideLocations = (state.scenarioZones.setAsideLocations || [])
    .filter(locationId => locationId !== id)
  return locationState
}

export function isAlive(state, partnerCode) {
  const base = BASE_BY_RESOLUTE[partnerCode] || partnerCode
  try {
    const entry = partnerState?.(state, base)
    if (entry) return isPartnerAlive?.(state, base) === true
  } catch {
    // 未初始化/不在名册里时走战役记录兜底（单测/旧存档兼容）。
  }
  return state.campaign?.partners?.[partnerCode]?.status !== 'crossedOut'
    && state.campaign?.partners?.[partnerCode]?.status !== 'dead'
}

// 把「被划掉的伙伴」写进战役记录（eliminated）；未知卡号不抛错，返回 false。
export function eliminatePartner(state, baseCode) {
  try {
    setPartnerStatus(state, baseCode, 'eliminated')
    return true
  } catch {
    return false
  }
}

// 伙伴选择：把坚毅版本（08587–08595）交给调查员；恢复伙伴在上次冒险中的伤害/恐惧。
export function choosePartner(state, seat, cardCode, api = {}) {
  const inv = state.investigators?.[seat]
  if (!inv || !PARTNER_CODES.includes(cardCode)) return null
  state.campaign ||= {}
  state.campaign.partners ||= {}
  const entry = { code: cardCode, baseCode: BASE_BY_RESOLUTE[cardCode] || null,
    resoluteCode: cardCode, status: 'alive', damage: 0, horror: 0 }
  state.campaign.partners[cardCode] = entry
  if (entry.baseCode) {
    const base = partnerState?.(state, entry.baseCode)
    if (base) {
      entry.damage = base.damage
      entry.horror = base.horror
    }
  }
  state.campaign.partnersBySeat ||= {}
  state.campaign.partnersBySeat[seat] = cardCode
  inv.assets ||= []
  const asset = { id: `partner-${cardCode}`, code: cardCode, exhausted: false, uses: ALL_CARDS[cardCode]?.uses ?? undefined }
  inv.assets.push(asset)
  api.info?.(`🤝 ${inv.name} 带上伙伴「${ALL_CARDS[cardCode]?.nameZh || cardCode}」。`)
  return asset
}

// 幻景卡翻面：按条目的 flags.storyFlip 数据执行
//   1) 揭示一个/多个放在一边的幻景地点；2) 记忆敌人面：伙伴活着→在本地点生成记忆敌人，
//      否则把本地所有调查员/敌人移到记忆囚笼、弃掉本地附属、把该剧情卡放进胜利区；
//   3) 记录「直面内心恶魔」并把该伙伴切换为坚毅形态。
export function flipStoryFace(state, cardCode, api = {}, options = {}) {
  const flags = entryFlags(cardCode) || {}
  const flip = flags.storyFlip || {}
  const inv = options.inv || activeInvestigators(state)[0]
  const here = options.location || inv?.location || state.locations[0]?.id
  const placed = []
  const choices = Array.isArray(flip.choices) ? flip.choices
    : (flip.choices?.[here] || MIRAGE_CHOICES[here] || [])
  const pick = options.choice && choices.includes(options.choice) ? options.choice : choices[0]
  if (pick) {
    const location = placeLocation(state, pick, { revealed: true })
    if (location) {
      placed.push(pick)
      for (const other of activeInvestigators(state)) if (other.location === here) other.location = pick
    }
  }
  const result = { cardCode, placed, spawnEnemy: null, banished: false, resolute: null, victory: false }
  if (flip.memoryEnemy) {
    const partnerCode = flip.partner || Object.values(MEMORY_LINKS).find(link => link.enemy === flip.memoryEnemy)?.partner
    const alive = partnerCode ? isAlive(state, partnerCode) : false
    if (alive) {
      state.enemies ||= []
      const definition = ALL_CARDS[flip.memoryEnemy]
      state.enemies.push({
        id: `memory-${flip.memoryEnemy}`, code: flip.memoryEnemy,
        name: definition?.nameZh || memoryEnemyName(flip.memoryEnemy),
        location: here, fight: definition?.fight ?? 4, evade: definition?.evade ?? 4,
        health: definition?.health ?? 6, damage: definition?.damage ?? 1, horror: definition?.horror ?? 1,
        exhausted: false, eidolon: true,
      })
      result.spawnEnemy = flip.memoryEnemy
    } else {
      for (const other of activeInvestigators(state)) if (other.location === here) other.location = 'prisonOfMemories'
      for (const enemy of state.enemies || []) if (enemy.location === here) enemy.location = 'prisonOfMemories'
      for (const other of state.investigators || []) {
        for (const asset of [...(other.assets || [])]) {
          if (asset.location === here) { other.assets = other.assets.filter(item => item !== asset); other.discard.push(asset.code) }
        }
      }
      state.victoryDisplay ||= []
      state.victoryDisplay.push({ code: cardCode, type: 'story' })
      result.banished = true
      result.victory = true
    }
    // 直面内心恶魔：战役记录 + 该伙伴改挂坚毅版本。
    if (partnerCode) {
      const faced = setIn(state, 'partnersFacedInnerDemon')
      if (!faced.includes(partnerCode)) faced.push(partnerCode)
      const base = BASE_BY_RESOLUTE[partnerCode] || partnerCode
      const resolute = resoluteFormOf?.(state, base) || RESOLUTE_BY_BASE[base] || partnerCode
      state.campaign ||= {}
      state.campaign.resolutePartners ||= []
      if (resolute && !state.campaign.resolutePartners.includes(partnerCode)) state.campaign.resolutePartners.push(partnerCode)
      result.resolute = resolute || partnerCode
      state.scenarioFlags ||= {}
      state.scenarioFlags.partnerSwitch = { partner: partnerCode, from: partnerCode, to: result.resolute }
    }
  } else if (flip.victory) {
    state.victoryDisplay ||= []
    state.victoryDisplay.push({ code: cardCode, type: 'story' })
    result.victory = true
  }
  api.info?.(`🌫️ 幻景翻面：「${ALL_CARDS[cardCode]?.nameZh || cardCode}」。`)
  return result
}

// 普通（探险队遭遇组）伙伴 → 坚毅版本；反向查询供测试/其它分片使用。
export function resoluteVersionOf(normalCode) {
  return RESOLUTE_BY_BASE[normalCode] || null
}
export function basePartnerOf(resoluteCode) {
  return BASE_BY_RESOLUTE[resoluteCode] || null
}

// 结局：结算胜利/无结局。记录放逐/发现的记忆、直面恶魔的伙伴、XP。
export function scenarioResolution(state, resolution = 'victory') {
  const records = recordsFor(state)
  const display = state.victoryDisplay || []
  const memoryCards = display.map(entry => (typeof entry === 'string' ? entry : entry.code))
    .filter(code => /^085(5[6-9]|6\d|7[0-4])b$/.test(String(code)))
  setIn(state, 'memoriesBanished').push(...memoryCards.filter(code => !setIn(state, 'memoriesBanished').includes(code)))
  const banished = new Set(setIn(state, 'memoriesBanished'))
  const discovered = (state.locations || []).map(location => location.id)
    .filter(id => !['prisonOfMemories'].includes(id))
  records.memoriesDiscovered = [...new Set([...(records.memoriesDiscovered || []), ...discovered])]
  records.memoriesBanished = [...banished]
  records.fatalMirageResolution = resolution
  records.fatalMirageTimes = (records.fatalMirageTimes || 0) + 1
  if (resolution === 'victory') records.fatalMirageCompleted = true
  const xp = (records.xp || 0) + memoryCards.length
  records.xp = xp
  return {
    resolution, memoriesBanished: [...banished], memoriesDiscovered: records.memoriesDiscovered,
    times: records.fatalMirageTimes, xp,
  }
}

export function chaosTokenValue(state, tokenFace, inv) {
  return fatalMirageChaosTokenValue(state, tokenFace, inv)
}

export const behavior = {
  id: CHAPTER_ID,
  fatalMirageVersion,
  agendaCodeForVersion,
  actCodeForVersion,
  setupScenario,
  // 引擎真实路径入口：setupScenario 已建立地点/幕/议程，引擎不再重复放置。
  setupLocations(state, events, helper = {}) {
    setupScenario(state, { info: text => helper.info?.(state, events, text) })
    return []
  },
  placeLocation,
  choosePartner,
  isAlive,
  eliminatePartner,
  flipStoryFace,
  resoluteVersionOf,
  basePartnerOf,
  scenarioResolution,
  chaosTokenValue,
  storyVictoryCount,
}

export function implementedEntryFlags(code) {
  return entryFlags(code) || {}
}

```

## content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js
```js
// 致命幻景（fatalMirage · 08549）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs#HasChaosTokenValue。
//   [skull]：简单/普通 = 胜利区中剧情卡牌数量；困难/专家 = 该数量 + 当前密谋编号。
//   [cultist]：-2；[tablet]：简单/普通 -3、困难/专家 -4；[elder_thing]：-4 / -5。
export const FATAL_MIRAGE_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({ skull: '胜利区剧情卡牌数', cultist: -2, tablet: -3, elderthing: -4 }),
  standard: Object.freeze({ skull: '胜利区剧情卡牌数', cultist: -2, tablet: -3, elderthing: -4 }),
  hard: Object.freeze({ skull: '胜利区剧情卡牌数 + 当前密谋编号', cultist: -2, tablet: -4, elderthing: -5 }),
  expert: Object.freeze({ skull: '胜利区剧情卡牌数 + 当前密谋编号', cultist: -2, tablet: -4, elderthing: -5 }),
})

// 胜利区中的剧情卡（story）：引擎里普通剧情卡在 victoryDisplay 里以卡号字符串/对象两种形态出现。
export function storyVictoryCount(state) {
  const display = state.victoryDisplay || []
  return display.filter(entry => {
    const code = typeof entry === 'string' ? entry : entry?.code
    return /^\d{5}b?$/.test(String(code || '')) && String(code).endsWith('b')
  }).length
}

export function fatalMirageChaosTokenValue(state, tokenFace, inv) {
  const hard = ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
  switch (tokenFace) {
    case 'skull': {
      const base = storyVictoryCount(state)
      return hard ? base + (Number(state?.agendaIndex) || 0) + 1 : base
    }
    case 'cultist': return -2
    case 'tablet': return hard ? -4 : -3
    case 'elderthing': return hard ? -5 : -4
    default: return null
  }
}

```