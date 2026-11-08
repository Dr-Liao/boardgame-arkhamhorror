// 致命幻景 · 引擎钩子（章节流程：三次重入、记忆/放逐、伙伴与坚毅形态、幻景翻面、结局记录）。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs、
//       Scenarios/EdgeOfTheEarth/FatalMirage/Helpers.hs（mirage / mirageRunner / handleMemory / mayAdvance）、
//       Location|Story|Enemy|Agenda|Act 的 CardDefs/EdgeOfTheEarth/FatalMirage.hs 与 Cards 实现。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   setupLocations → 布置（版本化的幕/议程牌库、幻景地点、记忆敌人、放逐/发现记忆）
//   locationPlaced → Mirage 关键词：入场时按「已入场/已放逐的目标数」扣减线索
//   actions / performAction → 「花线索翻面」行动（GroupClueCost）+「推进当前幕」选择
//   locationStory → performAction 调 api.flipLocation 后由引擎回调，转 flipStoryFace
//   enemyDefeated → 记忆敌人被击败时翻面读记忆剧情（enemyRule.flipOnDefeat 的真实读点）
//   agendaReveal → 密谋背面（击败剩余调查员 + 忒咳哩-哩/精神创伤）
//   actReveal → 幕背面（→R1 结局）
//   resolution → 结局记录写入 campaign.records（fatalMirageTimes/Resolution/memories*/…）
//   resolveChaosToken / afterTest → 08549 混乱标记数值与失败追加效果
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags, enemyRuleFor } from '../../../../../src/cards/card-rules.js'
import {
  partnerState, setPartnerStatus, resoluteFormOf, isPartnerAlive, initializePartners,
} from '../../../../../src/campaign/eote-partners.js'
import { initializeTekeliDeck, tekeliDeckSize, tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import { fatalMirageChaosToken, fatalMirageChaosTokenValue, storyVictoryCount, currentAgendaNumber } from './chaos.js'
import {
  ACT_VERSION_CODES, AGENDA_VERSION_CODES, LOCATIONS, MEMORY_ENEMY_CODES, MEMORY_LINKS,
  MIRAGE_CHOICES, PARTNER_CODES, actStageForVersion, agendaStageForVersion, scenario,
  TEKELI_COPIES, TEKELI_FACES,
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

// 坚毅伙伴 →「直面内心恶魔」的战役记录布尔键（Key.hs 的 9 项；旧存档仍写 partnersFacedInnerDemon 数组镜像）。
const CONFRONTED_RECORD = Object.freeze({
  '08587': 'dyerHasConfrontedHisDemons',
  '08588': 'danforthHasConfrontedHisDemons',
  '08589': 'eliyahHasConfrontedHisDemons',
  '08590': 'drSinhaHasConfrontedHerDemons',
  '08591': 'claypoolHasConfrontedHisDemons',
  '08592': 'cookieHasConfrontedHisDemons',
  '08593': 'drKenslerHasConfrontedHerDemons',
  '08594': 'ellsworthHasConfrontedHisDemons',
  '08595': 'takadaHasConfrontedHerDemons',
})

const CHAPTER_ID = 'fatalMirage'
const START_LOCATION = 'prisonOfMemories'
const PRISON_CODE = LOCATIONS[START_LOCATION].code
const LOCATION_BY_CODE = Object.fromEntries(Object.entries(LOCATIONS).map(([id, loc]) => [String(loc.code), id]))
const LOCATION_STORY_CODES = new Set(Object.values(LOCATIONS).map(location => location.storyCode))
const STORY_CODE_RE = /^085(5[6-9]|6\d|7\d|8[0-3])b$/

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const hasTrait = (code, trait) => (ALL_CARDS[code]?.traits || [])
  .some(value => String(value).toLowerCase() === String(trait).toLowerCase())
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const setIn = (state, key) => {
  const records = recordsFor(state)
  if (!Array.isArray(records[key])) records[key] = []
  return records[key]
}
const info = (api, text) => api?.info?.(text)

// 「这是第几次致命幻景」= 已完成次数 + 1；单测/独立游玩可用 scenarioFlags.fatalMirageVersion 覆盖。
// 完成次数取「战役结果 / 已完成步骤 / records.fatalMirageTimes」三者最大值，避免 resolution 写入记录后重复计数。
export function fatalMirageVersion(state) {
  const override = Number(state.scenarioFlags?.fatalMirageVersion)
  if (Number.isInteger(override) && override >= 1 && override <= 3) return override
  const part = Number(state.scenarioFlags?.fatalMiragePart)
  if (Number.isInteger(part) && part >= 1 && part <= 3) return Math.min(3, part)
  const completed = Array.isArray(state.campaign?.completedSteps) ? state.campaign.completedSteps : []
  const results = Array.isArray(state.campaign?.scenarioResults) ? state.campaign.scenarioResults : []
  const times = Math.max(
    completed.filter(step => step === CHAPTER_ID).length,
    results.filter(result => result?.scenarioId === CHAPTER_ID).length,
    Number(state.campaign?.records?.fatalMirageTimes) || 0,
  )
  return Math.min(3, times + 1)
}

export function agendaCodeForVersion(version) {
  return AGENDA_VERSION_CODES[version] || AGENDA_VERSION_CODES[1]
}
export function actCodeForVersion(version) {
  return ACT_VERSION_CODES[version] || ACT_VERSION_CODES[1]
}

// ---------------------------------------------------------------------------
// 幻景（Mirage）关键词：目标 / 线索 / 翻面费用
// ---------------------------------------------------------------------------

// 某地点「Mirage」括号里指示的卡（地点 id 或记忆敌人卡号）——读单卡条目声明的 storyFlip 数据。
export function mirageTargets(locationId) {
  const location = LOCATIONS[locationId]
  if (!location?.storyCode) return []
  const flip = entryFlags(location.storyCode)?.storyFlip || {}
  if (flip.memoryEnemy) return [{ kind: 'enemy', code: String(flip.memoryEnemy) }]
  const choices = Array.isArray(flip.choices) ? flip.choices : (MIRAGE_CHOICES[locationId] || [])
  return choices.filter(id => LOCATIONS[id]).map(id => ({ kind: 'location', id }))
}

function victoryCodesOf(state) {
  const codes = new Set()
  for (const entry of state.victoryDisplay || []) {
    const code = typeof entry === 'string' ? entry : entry?.code
    if (code) codes.add(String(code))
  }
  return codes
}

// 「这张指示卡是否已经入场或进入胜利区」（Mirage 减线索与 cleared 判定共用）。
function targetActive(state, target) {
  const victory = victoryCodesOf(state)
  if (target.kind === 'enemy') {
    if ((state.enemies || []).some(enemy => String(enemy.originalCode || enemy.code) === target.code)) return true
    return victory.has(`${target.code}b`) || victory.has(target.code)
  }
  const location = LOCATIONS[target.id]
  if (!location) return false
  if ((state.locations || []).some(item => item.id === target.id)) return true
  return victory.has(`${location.code}b`) || victory.has(location.code)
}

function mirageTier(locationId) {
  const flagTier = Number(entryFlags(LOCATIONS[locationId]?.code)?.tier)
  if (Number.isInteger(flagTier) && flagTier > 0) return flagTier
  return Number(LOCATIONS[locationId]?.mirage) || 1
}

// Mirage 入场线索：每玩家（印刷基础值 - 幻景值 × 已入场/已放逐的目标数），下限 0。
export function mirageClueTotal(state, locationId) {
  const location = LOCATIONS[locationId]
  if (!location) return 0
  const base = Number(location.cluesPerInvestigator ?? location.clues) || 0
  const tier = mirageTier(locationId)
  const active = mirageTargets(locationId).filter(target => targetActive(state, target)).length
  const perPlayer = Math.max(0, base - tier * active)
  return perPlayer * investigatorCount(state)
}

export function isClearedOfMirages(state, locationId) {
  const targets = mirageTargets(locationId)
  return targets.length > 0 && targets.every(target => targetActive(state, target))
}

// 未被翻出的目标（用于行动文本/合法性）：记忆剧情只有一个目标（记忆敌人）。
export function pendingMirageTargets(state, locationId) {
  return mirageTargets(locationId).filter(target => !targetActive(state, target))
}

// 翻面费用 = Mirage N [per_investigator]：地点上每位存活调查员 N 个线索（GroupClueCost）。
export function mirageFlipCost(state, locationId) {
  const atLocation = activeInvestigators(state).filter(inv => inv.location === locationId)
  return mirageTier(locationId) * Math.max(1, atLocation.length)
}

function groupCluesAt(state, locationId) {
  return activeInvestigators(state).filter(inv => inv.location === locationId)
    .reduce((sum, inv) => sum + (inv.clues || 0), 0)
}

const targetLabel = target => target.kind === 'enemy'
  ? (ALL_CARDS[target.code]?.nameZh || ALL_CARDS[target.code]?.name || target.code)
  : (LOCATIONS[target.id]?.name || target.id)

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------

export function setupScenario(state, api = {}) {
  prepareScenario(state, api)
  return arrangeSetup(state, api, { engine: false })
}

// 引擎真实入口：setup.js 的 setupLocations 钩子。只准备状态并返回要由引擎入场的地点 id
// （入场/揭示由引擎走 placeLocation/revealLocation，locationPlaced 钩子完成 Mirage 线索扣减）。
export function setupLocations(state, events, helper = {}) {
  const api = { info: text => helper.info?.(state, events, text) }
  prepareScenario(state, api)
  return arrangeSetup(state, api, { engine: true }).placedIds
}

// 版本化的幕/议程牌库 + 忒咳哩-哩牌库 + 伙伴名册（幂等）。
function prepareScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  const version = fatalMirageVersion(state)
  state.scenarioFlags.fatalMirageVersion = version
  state.scenarioFlags.agendaCode = agendaCodeForVersion(version)
  state.scenarioFlags.actCode = actCodeForVersion(version)
  // 参考 Setup：重入时「只使用对应版本的幕/议程，其余移出游戏」。
  state.agendas = [{ ...agendaStageForVersion(version), originalCode: agendaCodeForVersion(version) }]
  state.acts = [{ ...actStageForVersion(version), originalCode: actCodeForVersion(version) }]
  state.agendaIndex = 0
  state.actIndex = 0

  // 忒咳哩-哩牌库（7 个卡面 × 印刷份数；gather 的 7 张弱点不进主遭遇牌库）。
  try {
    if (tekeliDeckSize(state) === 0) {
      initializeTekeliDeck(state, { cards: [...TEKELI_FACES], copies: [...TEKELI_COPIES] })
    }
  } catch (error) {
    if (!/已经初始化/.test(String(error?.message || error))) throw error
  }

  // 伙伴名册可能已由序幕/幕间/检查点初始化（伙伴是战役级实体）；已初始化则复用。
  try {
    initializePartners?.(state, {
      partners: Object.values(BASE_BY_NAME).map(code => ({ code, damage: 0, horror: 0 })),
      resoluteForms: Object.values(BASE_BY_NAME).filter(code => RESOLUTE_BY_BASE[code])
        .map(code => [code, RESOLUTE_BY_BASE[code]]),
    })
  } catch (error) {
    if (!/已初始化|已经初始化/.test(String(error?.message || error))) throw error
  }
  state.scenarioFlags.fatalMiragePrepared = true
  return version
}

// 记录归一化：支持参考实现的卡号口径与旧存档的地点 id 口径。
function discoveredIds(state) {
  const out = new Set()
  for (const item of recordsFor(state).memoriesDiscovered || []) {
    const value = String(item)
    const id = LOCATIONS[value] ? value : LOCATION_BY_CODE[value]
    if (id) out.add(id)
  }
  return [...out]
}

function banishedStoryCodes(state) {
  const out = new Set()
  for (const item of recordsFor(state).memoriesBanished || []) {
    const value = String(item)
    if (/b$/.test(value)) out.add(value)
    else if (LOCATIONS[value]) out.add(`${LOCATIONS[value].code}b`)
    else if (LOCATION_BY_CODE[value]) out.add(`${value}b`)
  }
  return [...out]
}

function banishedLocationIds(state) {
  const out = new Set()
  for (const code of banishedStoryCodes(state)) {
    const id = LOCATION_BY_CODE[String(code).replace(/b$/, '')]
    if (id) out.add(id)
  }
  return out
}

function arrangeSetup(state, api, { engine }) {
  const version = state.scenarioFlags.fatalMirageVersion
  const records = recordsFor(state)
  const discovered = discoveredIds(state).filter(id => id !== START_LOCATION)
  const banishedIds = banishedLocationIds(state)
  const banishedCodes = banishedStoryCodes(state)

  // 已发现记忆（参考：入场并 revealed 面朝上）+ 记忆囚笼。放置顺序：先已发现地点，
  // 后记忆囚笼——记忆囚笼入场时按「已经入场/胜利区」的目标数扣减线索（指南 Mirage 例）。
  // 引擎路径返回列表由引擎 placeLocation；揭示走 pendingSetupReveals（引擎在布置末期统一 reveal）。
  state.locations = []
  const placedIds = [...discovered.filter(id => LOCATIONS[id]), START_LOCATION]
  if (engine) {
    state.scenarioFlags.pendingSetupReveals = placedIds.filter(id => id !== START_LOCATION)
  } else {
    for (const id of placedIds) placeMirageLocation(state, id, {}, { revealed: true })
  }

  // 其余地点放一边（已放逐记忆不再出现）。
  state.scenarioZones.setAsideLocations = Object.keys(LOCATIONS)
    .filter(id => !placedIds.includes(id) && !banishedIds.has(id))

  // 已放逐记忆：剧情卡（b 面）放进胜利区；已经记录过 → victory 记 0，避免结局重复发 XP。
  state.victoryDisplay ||= []
  for (const code of banishedCodes) pushStoryVictory(state, code, { victory: 0, from: 'memoriesBanished' })

  // 记忆敌人：默认放一边；其地点已放逐（伙伴被划掉）则 b 面剧情进胜利区、本轮不出现。
  const setAside = []
  for (const code of MEMORY_ENEMY_CODES) {
    const link = Object.entries(MEMORY_LINKS).find(([, value]) => value.enemy === code)
    const linkLocationId = link?.[0]
    if (linkLocationId && banishedIds.has(linkLocationId)) {
      pushStoryVictory(state, `${code}b`, { victory: 0, from: 'memoriesBanished' })
      continue
    }
    setAside.push(code)
  }
  state.scenarioZones.setAside = setAside
  state.scenarioZones.setAsideResolute = [...PARTNER_CODES]

  for (const inv of activeInvestigators(state)) inv.location = START_LOCATION
  if (['hard', 'expert'].includes(String(state.difficulty || 'standard'))) {
    state.doom = (Number(state.doom) || 0) + (state.difficulty === 'expert' ? 2 : 1)
  }
  if (!engine) state.encounterDeck = [...(scenario.encounterDeck || [])]
  info(api, `🌫️ 致命幻景（第 ${version} 次）：记忆囚笼开始；${state.scenarioZones.setAsideLocations.length} 个幻景地点放一边。`)
  return {
    version,
    agendaCode: agendaCodeForVersion(version),
    actCode: actCodeForVersion(version),
    startLocation: START_LOCATION,
    placedIds,
    setAsideLocations: [...state.scenarioZones.setAsideLocations],
    memoryEnemies: [...setAside],
    setAsideResolute: [...PARTNER_CODES],
  }
}

// 直接放置（单测/直调路径）：幻景地点没有未揭示面，入场即揭示并按 Mirage 规则给线索。
function placeMirageLocation(state, id, api, { revealed = true, started = false } = {}) {
  const data = LOCATIONS[id]
  if (!data || (state.locations || []).some(location => location.id === id)) return null
  const clues = revealed ? mirageClueTotal(state, id) : 0
  const locationState = { ...structuredClone(data), id, clues, maxClues: revealed ? clues : mirageClueTotal(state, id), doom: 0, revealed,
    ...(started ? { startedAt: true } : {}) }
  state.locations.push(locationState)
  state.scenarioZones ||= {}
  state.scenarioZones.setAsideLocations = (state.scenarioZones.setAsideLocations || [])
    .filter(locationId => locationId !== id)
  return locationState
}

// 兼容旧导出：测试/其它模块直接放地点时用（不经过引擎）。
export function placeLocation(state, id, { revealed = true, started = false } = {}) {
  return placeMirageLocation(state, id, {}, { revealed, started })
}

// 引擎读点：地点入场。Mirage 关键词按「已经入场/胜利区的目标数」扣减线索值。
export function locationPlaced(state, location, api = {}) {
  const id = location?.id
  if (!id || !LOCATIONS[id]?.mirage) return
  const clues = mirageClueTotal(state, id)
  if (location.revealed) {
    location.clues = clues
    location.maxClues = clues
  } else {
    location.maxClues = clues
  }
  info(api, `🌫️ 「${location.name}」按 Mirage 规则获得 ${clues} 个线索。`)
}

// 引擎读点：地点帷幕修正（actions.js/moves.js/engine.js 的 locationShroudModifier）。
// 记忆囚笼的帷幕是 X = 当前密谋编号（参考 withXShroud）。
export function locationShroudModifier(state, location) {
  const id = location?.id
  if (id !== START_LOCATION) return 0
  return currentAgendaNumber(state)
}

// 引擎读点：地点翻面（performAction → api.flipLocation → locationStory）。
// 从 pendingMirageFlip 读取玩家在合法行动里选择的「揭示哪张记忆」，再执行剧情卡背面的结算。
export function locationStory(state, location, api = {}, seat = null) {
  const id = location?.id
  if (!id || !LOCATIONS[id]?.storyCode) return null
  if (isClearedOfMirages(state, id)) return null
  const pending = state.scenarioFlags?.pendingMirageFlip
  const choice = pending && pending.locationId === id ? pending.choice : null
  const inv = seat == null ? activeInvestigators(state)[0] : state.investigators?.[seat]
  return flipStoryFace(state, LOCATIONS[id].storyCode, api, { location: id, inv, choice })
}

// 引擎读点：记忆敌人被击败 → 翻面读记忆剧情（enemyRule.flipOnDefeat / flags.flipOnDefeat）。
export function enemyDefeated(state, enemy, api = {}) {
  const code = String(enemy?.originalCode || enemy?.code || '')
  if (!MEMORY_ENEMY_CODES.includes(code)) return false
  const rule = enemyRuleFor(code)
  if (rule?.flipOnDefeat !== true && entryFlags(code)?.flipOnDefeat !== true) return false
  const storyCode = ALL_CARDS[code]?.linkedCardCode || `${code}b`
  const locationId = enemy.location || null
  const defeatedBy = Number(enemy.defeatedBy)
  flipStoryFace(state, storyCode, api, {
    location: locationId,
    inv: Number.isInteger(defeatedBy) ? state.investigators?.[defeatedBy] : undefined,
  })
  info(api, `🌫️ 记忆敌人「${enemy.name}」被击败：翻开记忆剧情卡（直面内心恶魔）。`)
  return true
}

// ---------------------------------------------------------------------------
// 翻面（flipStoryFace）：地点剧情（揭示记忆/生成或放逐记忆敌人）与记忆剧情（直面恶魔）
// ---------------------------------------------------------------------------

function partnerOfMemoryEnemy(enemyCode) {
  return Object.values(MEMORY_LINKS).find(link => link.enemy === enemyCode)?.partner
    || entryFlags(`${enemyCode}b`)?.resolutePartner || null
}

function stillSetAside(state, code) {
  return (state.scenarioZones?.setAside || []).some(item => String(item) === String(code))
}

function takeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside
  if (!Array.isArray(list)) return false
  const index = list.findIndex(item => String(item) === String(code))
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

function pushStoryVictory(state, code, options = {}) {
  state.victoryDisplay ||= []
  const id = String(code)
  if (state.victoryDisplay.some(entry => String(typeof entry === 'string' ? entry : entry?.code) === id)) return false
  const card = ALL_CARDS[id]
  state.victoryDisplay.push({
    code: id,
    originalCode: id,
    type: 'story',
    name: card?.nameZh || card?.name || id,
    victory: options.victory != null ? options.victory : (Number(card?.victory) || 0),
    ...(options.from ? { from: options.from } : {}),
  })
  return true
}

function spawnMemoryEnemy(state, code, locationId, api) {
  takeFromSetAside(state, code)
  if (api?.spawn) return api.spawn(code, locationId)
  const definition = ALL_CARDS[code] || {}
  state.enemies ||= []
  const health = definition.healthPerInvestigator
    ? (Number(definition.health) || 0) * investigatorCount(state)
    : (Number(definition.health) || 0)
  const enemy = {
    id: `memory-${code}`, code, originalCode: code,
    name: definition.nameZh || definition.name || code,
    location: locationId,
    fight: definition.fight ?? 4, evade: definition.evade ?? 4,
    health, damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])],
    exhausted: false, eidolon: true, engagedSeat: null,
  }
  state.enemies.push(enemy)
  return enemy
}

// 引擎路径优先用 api.place/api.reveal（触发 locationPlaced 的 Mirage 扣减与地点入场钩子）；
// 单测/直调路径退回本地放置。
function placeRevealedLocation(state, id, api) {
  if (api?.place) {
    api.place(id)
    if (api.reveal) api.reveal(id)
    return (state.locations || []).find(location => location.id === id) || null
  }
  return placeMirageLocation(state, id, api, { revealed: true })
}

function banishMemoryLocation(state, storyCode, locationId, api) {
  for (const inv of activeInvestigators(state)) {
    if (inv.location !== locationId) continue
    if (api?.moveInvestigator) api.moveInvestigator(inv.seat, START_LOCATION)
    else inv.location = START_LOCATION
  }
  for (const enemy of [...(state.enemies || [])]) {
    if (enemy.location !== locationId) continue
    if (api?.moveEnemy) api.moveEnemy(enemy, START_LOCATION)
    else enemy.location = START_LOCATION
  }
  pushStoryVictory(state, storyCode)
  // 剧情卡进胜利区 = 该地点物理卡离场（参考 handleMemory 的 removeLocation）。
  if (api?.remove) api.remove(locationId)
  else state.locations = (state.locations || []).filter(location => location.id !== locationId)
  state.scenarioFlags ||= {}
  state.scenarioFlags.fatalMirageMayAdvance = true
}

// 「直面内心恶魔」：记录战役日志布尔键、伙伴切换坚毅形态、剧情卡进胜利区、允许推进当前幕。
function confrontInnerDemon(state, storyCode, partnerCode, api) {
  const resoluteCode = String(partnerCode || entryFlags(storyCode)?.storyFlip?.resolutePartner || '')
  const baseCode = BASE_BY_RESOLUTE[resoluteCode] || (BASE_BY_NAME[ALL_CARDS[resoluteCode]?.nameZh] || null)
  const recordKey = CONFRONTED_RECORD[resoluteCode] || CONFRONTED_RECORD[Object.keys(BASE_BY_RESOLUTE).find(key => BASE_BY_RESOLUTE[key] === baseCode)]
  const records = recordsFor(state)
  if (recordKey) records[recordKey] = true
  const faced = setIn(state, 'partnersFacedInnerDemon')
  if (resoluteCode && !faced.includes(resoluteCode)) faced.push(resoluteCode)
  state.campaign.resolutePartners ||= []
  if (resoluteCode && !state.campaign.resolutePartners.includes(resoluteCode)) state.campaign.resolutePartners.push(resoluteCode)
  if (baseCode) {
    try { setPartnerStatus(state, baseCode, 'resolute') } catch { /* 已划掉/未初始化时不阻塞剧情 */ }
  }
  pushStoryVictory(state, storyCode)
  state.scenarioFlags ||= {}
  state.scenarioFlags.fatalMirageMayAdvance = true
  const resolute = resoluteFormOf?.(state, baseCode) || resoluteCode
  return { partner: baseCode || resoluteCode, resolute }
}

// 幻景卡翻面：按条目的 flags.storyFlip 数据执行
//   1) 地点剧情（choices）：揭示一个放在一边的幻景地点；
//   2) 地点剧情（memoryEnemy）：伙伴活着 → 在本地点生成记忆敌人；否则放逐本地记忆（回记忆囚笼、进胜利区、可推进幕）；
//   3) 记忆剧情（resolutePartner/record）：记录「直面内心恶魔」、切坚毅形态、进胜利区、可推进幕。
export function flipStoryFace(state, cardCode, api = {}, options = {}) {
  const flags = entryFlags(cardCode) || {}
  const flip = flags.storyFlip || {}
  const inv = options.inv || activeInvestigators(state)[0]
  const here = options.location || inv?.location || state.locations?.[0]?.id
  const result = { cardCode, placed: [], spawnEnemy: null, banished: false, confronted: null, victory: false }

  if (flip.memoryEnemy) {
    const enemyCode = String(flip.memoryEnemy)
    const partnerCode = flip.partner || partnerOfMemoryEnemy(enemyCode)
    const alive = partnerCode ? isAlive(state, partnerCode) : false
    if (alive && stillSetAside(state, enemyCode)) {
      const spawned = spawnMemoryEnemy(state, enemyCode, here, api)
      if (spawned) result.spawnEnemy = enemyCode
      info(api, `🌫️ 「${ALL_CARDS[cardCode]?.nameZh || cardCode}」：伙伴仍然活着，生成记忆敌人「${ALL_CARDS[enemyCode]?.nameZh || enemyCode}」。`)
    } else if (alive) {
      info(api, `🌫️ 「${ALL_CARDS[cardCode]?.nameZh || cardCode}」：对应的记忆敌人已不在放一边区域。`)
    } else {
      banishMemoryLocation(state, cardCode, here, api)
      result.banished = true
      result.victory = true
      info(api, `🌫️ 「${ALL_CARDS[cardCode]?.nameZh || cardCode}」：伙伴已被划掉，本地记忆被放逐（全员回到记忆囚笼）。`)
    }
    return result
  }

  // 地点剧情的「揭示下一层记忆」只在卡号确属某地点背面时执行；记忆敌人背面 08575b–08583b
  // 不是任何地点的 storyCode（其 Mirage 括号里是记忆敌人），不能套用地点 id 的选择表。
  const choices = LOCATION_STORY_CODES.has(String(cardCode))
    ? (Array.isArray(flip.choices) ? flip.choices : (MIRAGE_CHOICES[here] || []))
    : []
  const available = choices.filter(id => LOCATIONS[id] && !(state.locations || []).some(location => location.id === id))
  if (available.length) {
    const pick = options.choice && available.includes(options.choice) ? options.choice : available[0]
    const placed = placeRevealedLocation(state, pick, api)
    if (placed) result.placed.push(pick)
    info(api, `🌫️ 幻景翻面：「${ALL_CARDS[cardCode]?.nameZh || cardCode}」揭示记忆地点「${placed?.name || pick}」。`)
  }

  const isMemoryStory = Boolean(flip.resolutePartner || flip.record)
  if (isMemoryStory) {
    const partnerCode = flip.resolutePartner || partnerOfMemoryEnemy(String(cardCode).replace(/b$/, ''))
    const confronted = confrontInnerDemon(state, cardCode, partnerCode, api)
    result.confronted = confronted
    result.victory = true
    info(api, `🌫️「${ALL_CARDS[cardCode]?.nameZh || cardCode}」：记录直面内心恶魔，伙伴切换为坚毅形态。`)
  } else if (flip.victory) {
    pushStoryVictory(state, cardCode)
    result.victory = true
  }
  return result
}

// ---------------------------------------------------------------------------
// 伙伴
// ---------------------------------------------------------------------------

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
    && state.campaign?.partners?.[partnerCode]?.status !== 'eliminated'
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
  info(api, `🤝 ${inv.name} 带上伙伴「${ALL_CARDS[cardCode]?.nameZh || cardCode}」。`)
  return asset
}

// 普通（探险队遭遇组）伙伴 → 坚毅版本；反向查询供测试/其它分片使用。
export function resoluteVersionOf(normalCode) {
  return RESOLUTE_BY_BASE[normalCode] || null
}
export function basePartnerOf(resoluteCode) {
  return BASE_BY_RESOLUTE[resoluteCode] || null
}

// ---------------------------------------------------------------------------
// 行动（真实引擎入口：actions → legalMoves → performAction）
// ---------------------------------------------------------------------------

function mirageFlipMoves(state, inv) {
  const moves = []
  const locationId = inv?.location
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location?.revealed || !LOCATIONS[locationId]?.storyCode) return moves
  if (isClearedOfMirages(state, locationId)) return moves
  const cost = mirageFlipCost(state, locationId)
  const available = groupCluesAt(state, locationId) >= cost
  const targets = pendingMirageTargets(state, locationId)
  const rule = `mirageFlip:${locationId}`
  if (!available) {
    moves.push({ action: 'scenarioAction', rule, locationId, actions: 1,
      reason: `线索不足：翻面需要 ${cost} 个线索（本地点现有 ${groupCluesAt(state, locationId)} 个）` })
    return moves
  }
  for (const target of targets) {
    moves.push({ action: 'scenarioAction', rule, locationId, choice: target.kind === 'location' ? target.id : target.code,
      actions: 1, label: `🌫️ 幻景翻面「${location.name}」：共同支付 ${cost} 个线索 → 揭示「${targetLabel(target)}」` })
  }
  return moves
}

export function actions(state, inv) {
  if (!inv || state.status !== 'playing') return []
  const moves = [...mirageFlipMoves(state, inv)]
  if (state.scenarioFlags?.fatalMirageMayAdvance) {
    moves.push({ action: 'scenarioAction', rule: 'fatalMirageAdvanceAct', actions: 0,
      label: '📜 推进当前幕（已直面内心恶魔）' })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move) return false
  if (move.rule === 'fatalMirageAdvanceAct') {
    if (!state.scenarioFlags?.fatalMirageMayAdvance) return false
    info(api, '📜 调查员选择推进当前幕（直面内心恶魔之后）。')
    api.advanceAct?.()
    return true
  }
  if (typeof move.rule === 'string' && move.rule.startsWith('mirageFlip:')) {
    const locationId = move.rule.slice('mirageFlip:'.length)
    if (inv?.location !== locationId) return false
    const location = (state.locations || []).find(item => item.id === locationId)
    if (!location?.revealed || isClearedOfMirages(state, locationId)) return false
    const cost = mirageFlipCost(state, locationId)
    if (groupCluesAt(state, locationId) < cost) return false
    api.payGroupClues?.(cost, { atLocation: locationId })
    state.scenarioFlags ||= {}
    state.scenarioFlags.pendingMirageFlip = { locationId, choice: move.choice ?? null, seat: inv.seat }
    try {
      if (api.flipLocation) api.flipLocation(locationId, inv.seat)
      else locationStory(state, location, api, inv.seat)
    } finally {
      delete state.scenarioFlags.pendingMirageFlip
    }
    info(api, `🌫️ 调查员翻开「${location.name}」的幻景剧情卡（共同支付 ${cost} 个线索）。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕/议程揭示
// ---------------------------------------------------------------------------

// 幕背面（→R1）：本关幕牌库只有一张，推进即进入结局。
export function actReveal(state, act, api = {}) {
  info(api, `📜 「${act?.name || '旧事阴影'}」背面：直面内心恶魔的记忆消散，故事走向结局 1。`)
  const resolutions = state.scenario?.resolutions || {}
  const key = Object.hasOwn(resolutions, 'victory') ? 'victory' : Object.keys(resolutions)[0]
  if (typeof api.finish === 'function') {
    api.finish(key)
    return true
  }
  state.resolution = key
  return true
}

function addCampaignTrauma(state, seat, kind = 'mental', amount = 1) {
  state.campaign ||= {}
  state.campaign.trauma ||= {}
  const record = state.campaign.trauma[seat] ||= { physical: 0, mental: 0, supernatural: 0 }
  record[kind] = (Number(record[kind]) || 0) + amount
  return record
}

function defeatInvestigator(state, seat, api) {
  if (typeof api.defeatInvestigator === 'function') return api.defeatInvestigator(seat)
  const inv = state.investigators?.[seat]
  if (!inv || inv.defeated || inv.resigned) return false
  inv.defeated = true
  inv.defeatCause ||= 'killed'
  return true
}

// 议程背面：剩余的每位调查员被击败，并按版本结算忒咳哩-哩 / 精神创伤。
// 参考 EtherealTangleV1/V2/V3 的 AdvanceAgenda(side B)。
export function agendaReveal(state, agenda, api = {}) {
  const code = String(agenda?.originalCode || agenda?.code || '')
  const version = Number(Object.entries(AGENDA_VERSION_CODES).find(([, value]) => value === code)?.[0])
    || Number(state.scenarioFlags?.fatalMirageVersion) || 1
  const active = activeInvestigators(state)
  for (const inv of active) {
    if (version === 1) {
      try { tekeliShuffleIn(state, inv.seat, 1) } catch { /* 牌库未初始化/牌数不足时忽略 */ }
    } else if (version === 2) {
      const choice = typeof api.choose === 'function'
        ? api.choose({ kind: 'agenda', source: code, seat: inv.seat,
          prompt: '密谋背面：选择承受 1 点精神创伤，或将忒咳哩-哩牌库顶 2 张卡牌洗入牌库。',
          options: [{ id: 'trauma', label: '承受 1 点精神创伤' }, { id: 'tekelili', label: '洗入忒咳哩-哩牌库顶 2 张' }] })
        : 'tekelili'
      if (choice === 'trauma') addCampaignTrauma(state, inv.seat, 'mental', 1)
      else {
        try { tekeliShuffleIn(state, inv.seat, 2) } catch { /* 同上 */ }
      }
    } else {
      addCampaignTrauma(state, inv.seat, 'mental', 1)
    }
    defeatInvestigator(state, inv.seat, api)
    info(api, `🌑 密谋背面：${inv.name} 被击败。`)
  }
  info(api, `🌑 「${agenda?.name || '虚灵纠缠'}」背面：剩余的每位调查员被击败。`)
  // 规则：背面结算后没有存活的调查员 → 本关立即以「无结局」结束。不依赖 advanceAgenda 之后的
  // checkOutcome（它只在议程牌库耗尽时兜底；且原始事务/手搓状态入口不一定走到那里）。
  const aliveAfter = activeInvestigators(state)
  if (!aliveAfter.length) {
    if (typeof api.finish === 'function') {
      api.finish('noResolution')
      return true
    }
    state.resolution = 'noResolution'
  }
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记（08549）
// ---------------------------------------------------------------------------

export function resolveChaosToken(state, inv, token) {
  return fatalMirageChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv) {
  return fatalMirageChaosTokenValue(state, tokenFace, inv)
}

function placeOneClueOnLocation(state, inv) {
  const location = (state.locations || []).find(item => item.id === inv.location)
  if (!location || (inv.clues || 0) <= 0) return 0
  inv.clues -= 1
  location.clues = (location.clues || 0) + 1
  location.maxClues = Math.max(location.maxClues || 0, location.clues)
  return 1
}

function moveToPrison(state, seat, api) {
  if (state.investigators?.[seat]?.location === START_LOCATION) return false
  if (typeof api.moveInvestigator === 'function') api.moveInvestigator(seat, START_LOCATION)
  else if (state.investigators?.[seat]) state.investigators[seat].location = START_LOCATION
  return true
}

function shuffleTekeliIn(state, seat, count = 1) {
  try { return tekeliShuffleIn(state, seat, count) !== false } catch { return false }
}

// 08549 的失败追加效果（cultist/tablet/elder_thing）。
function applyChaosRider(state, inv, rider, { failedBy, successBy }, api) {
  if (!inv || inv.defeated || inv.resigned) return
  if (rider === 'clueOnLocation' || rider === 'clueOnLocationUnlessSucceedBy2') {
    if (rider === 'clueOnLocationUnlessSucceedBy2' && successBy != null && successBy >= 2) return
    const placed = placeOneClueOnLocation(state, inv)
    if (placed) info(api, `🃏 [cultist]：${inv.name} 将 1 个线索放到「${LOCATIONS[(state.locations || []).find(loc => loc.id === inv.location)?.id]?.name || inv.location}」。`)
    return
  }
  if (rider === 'prisonOrTekeli' || rider === 'prisonOrTekeliBothIfFailBy2') {
    const both = rider === 'prisonOrTekeliBothIfFailBy2' && failedBy >= 2
    const canMove = inv.location !== START_LOCATION
    const canShuffle = tekeliDeckSize(state) > 0
    const actions = []
    if (canMove) actions.push('prison')
    if (canShuffle) actions.push('tekelili')
    if (!actions.length) return
    let pick = both ? null : actions[0]
    if (!both && actions.length > 1) {
      pick = typeof api.choose === 'function'
        ? api.choose({ kind: 'chaosToken', source: '08549', seat: inv.seat,
          prompt: '[tablet] 检定失败：选择移动到记忆囚笼，或将忒咳哩-哩牌库顶 1 张洗入牌库。',
          options: [{ id: 'prison', label: '移动到记忆囚笼' }, { id: 'tekelili', label: '洗入忒咳哩-哩牌库顶 1 张' }] })
        : actions[0]
    }
    const doMove = both || pick === 'prison'
    const doShuffle = both || pick === 'tekelili'
    if (doMove && canMove) {
      moveToPrison(state, inv.seat, api)
      info(api, `🃏 [tablet]：${inv.name} 移动到记忆囚笼。`)
    }
    if (doShuffle && canShuffle) {
      shuffleTekeliIn(state, inv.seat, 1)
      info(api, `🃏 [tablet]：${inv.name} 将忒咳哩-哩牌库顶 1 张洗入牌库。`)
    }
    return
  }
  if (rider === 'doomOnEidolon') {
    const candidates = (state.enemies || []).filter(enemy => !enemy.defeated
      && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'eidolon'))
    if (!candidates.length) return
    const target = candidates.length > 1 && typeof api.choose === 'function'
      ? candidates.find(enemy => enemy.id === api.choose({ kind: 'chaosToken', source: '08549', seat: inv.seat,
        prompt: '[elder_thing] 检定失败：选择 1 个[[幻灵]]敌人放置 1 个毁灭标记。',
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })) || candidates[0]
      : candidates[0]
    if (typeof api.doomOn === 'function') api.doomOn(target, 1)
    else target.doom = (Number(target.doom) || 0) + 1
    info(api, `🃏 [elder_thing]：在「${target.name}」上放置 1 个毁灭标记。`)
  }
}

// 引擎读点：检定结束后结算 08549 的符号失败追加效果（成功路径与自动失败路径各调用一次）。
export function afterTest(state, inv, result, api = {}, extra = {}) {
  if (!inv || !result) return []
  const tokens = Array.isArray(extra?.resolvedTokens) ? extra.resolvedTokens : (result.drawn || [])
  const difficulty = Number(result.difficulty) || 0
  const value = Number(result.value) || 0
  const failedBy = Number.isFinite(extra?.test?.failedBy) ? extra.test.failedBy : Math.max(0, difficulty - value)
  const successBy = result.success ? Math.max(0, value - difficulty) : null
  const applied = []
  for (const token of tokens) {
    const effect = fatalMirageChaosToken(state, inv, token)
    if (!effect?.rider) continue
    const failCondition = effect.rider === 'clueOnLocationUnlessSucceedBy2'
      ? (!result.success || (successBy != null && successBy < 2))
      : !result.success
    if (!failCondition) continue
    applyChaosRider(state, inv, effect.rider, { failedBy, successBy }, api)
    applied.push({ token, rider: effect.rider })
  }
  return applied
}

// ---------------------------------------------------------------------------
// 结局（引擎读点：campaign-flow.js#applyResolutionEffects）
// ---------------------------------------------------------------------------

function isNonOtherworldLocation(location) {
  const card = ALL_CARDS[location?.originalCode || location?.code]
  const traits = (card?.traits || location?.traits || []).map(trait => String(trait).toLowerCase())
  return !traits.includes('otherworld')
}

export function resolution(state, key, events, api = {}) {
  const records = recordsFor(state)
  const display = (state.victoryDisplay || []).map(entry => typeof entry === 'string' ? entry : entry?.code).filter(Boolean)
  const storyCards = display.filter(code => STORY_CODE_RE.test(String(code)))
  // Memories Banished：胜利区里的剧情卡（参考 ScenarioResolution 的 recordSetInsert MemoriesBanished）。
  const previouslyBanished = new Set(records.memoriesBanished || [])
  records.memoriesBanished = [...new Set([...previouslyBanished, ...storyCards])]
  // Memories Discovered：场上每个非 Otherworld 地点（参考记录卡号；旧存档兼容地点 id）。
  const discoveredCodes = (state.locations || []).filter(isNonOtherworldLocation).map(location => String(location.originalCode || location.code))
  const priorDiscovered = new Set((records.memoriesDiscovered || []).map(item => {
    const value = String(item)
    return LOCATIONS[value] ? String(LOCATIONS[value].code) : value
  }))
  records.memoriesDiscovered = [...new Set([...priorDiscovered, ...discoveredCodes])]

  records.fatalMirageResolution = key
  records.fatalMirageTimes = (Number(records.fatalMirageTimes) || 0) + 1
  if (['victory', 'resolution1', 'r1'].includes(String(key))) records.fatalMirageCompleted = true
  records.xp = (Number(records.xp) || 0) + (Number(state.victory) || 0)
  // 伙伴伤害/恐惧跨关持久由战役伙伴记录负责；这里只同步坚毅名册镜像。
  records.resolutePartners = [...new Set([
    ...(Array.isArray(records.resolutePartners) ? records.resolutePartners : []),
    ...(state.campaign?.resolutePartners || []),
  ])]
  info(api, `📖 致命幻景结算（${key}）：第 ${records.fatalMirageTimes} 次；放逐记忆 ${records.memoriesBanished.length} 张，发现记忆 ${records.memoriesDiscovered.length} 处。`)
  return { award: true, bonus: 0 }
}

// 兼容导出（旧测试直调）：把结算记录写入逻辑与 resolution 共用。
export function scenarioResolution(state, resolutionKey = 'victory') {
  resolution(state, resolutionKey, [], {})
  const records = recordsFor(state)
  return {
    resolution: resolutionKey,
    memoriesBanished: [...(records.memoriesBanished || [])],
    memoriesDiscovered: [...(records.memoriesDiscovered || [])],
    times: records.fatalMirageTimes,
    xp: records.xp,
  }
}

export const behavior = {
  id: CHAPTER_ID,
  fatalMirageVersion,
  agendaCodeForVersion,
  actCodeForVersion,
  setupScenario,
  // 引擎真实路径入口：setupLocations 准备状态并返回要由引擎放置的地点（揭示走 pendingSetupReveals）。
  setupLocations,
  startLocation: () => START_LOCATION,
  locationPlaced,
  locationShroudModifier,
  locationStory,
  placeLocation,
  actions,
  performAction,
  enemyDefeated,
  agendaReveal,
  actReveal,
  afterTest,
  resolveChaosToken,
  chaosTokenValue,
  resolution,
  scenarioResolution,
  flipStoryFace,
  choosePartner,
  isAlive,
  eliminatePartner,
  resoluteVersionOf,
  basePartnerOf,
  mirageTargets,
  mirageClueTotal,
  mirageFlipCost,
  pendingMirageTargets,
  isClearedOfMirages,
  storyVictoryCount,
}

export function implementedEntryFlags(code) {
  return entryFlags(code) || {}
}
