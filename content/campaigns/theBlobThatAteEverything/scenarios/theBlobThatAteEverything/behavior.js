// 吞噬万物（The Blob That Ate Everything · 85001）· 单桌流程引擎钩子。
//
// 参考（权威）：
//   Scenario/Scenarios/TheBlobThatAteEverything.hs
//   Act|Agenda|Location|Enemy|Treachery|Story/Cards/TheBlobThatAteEverything/*.hs
//
// 引擎读点（全部走既有 scenarioBehavior 钩子，不改引擎）：
//   preScenarioSetup / startLocation / setupLocations / locationPlaced / afterDeckSetup
//     → 13 格网格布置（随机槽位）、正交连接、Subject 8L-08 全局放置、反制措施初始化
//   actions / performAction → 地点行动（陨石坑/研究站/临时总部/真菌堆/下水道/桥/水塔/教堂）、
//     剧情行动（化学家/样本/炸药）、幕 1 团队支付线索推进
//   roundEnded → 幕 2/3「轮末强制推进」记账、陨石坑轮末伤害、干枯农田/粘脚轮末结算
//   checkObjectives → 轮末强制推进的兑现（advanceAct 读点）+ 幕 1 提示
//   actReveal → 幕 1 背面（暴露心脏）/幕 2 背面（心脏伤害转为遭遇牌）/幕 3 背面（随机读 Part 1 剧情并重置幕牌库）
//   agendaReveal → 议程 1/2 背面（吞噬 2 张软泥污染地点 + 洗入放一边的软泥）；议程 3 背面 → 结局 1
//   enemySpawned / enemyDefeated / enemyDamaged / enemyDamageAllowed → Blob X、Oozy Lakebed、Old Burial Hill、
//     Subject 8L-08、Vulnerable Heart、剧情敌人、ELSE! 复制异变体
//   enemyPhaseStart → 剧情敌人移动与「研究」进度、Mi-Go Drone 线索、炸药/装甲车结算
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 本关混乱袋
//   resolution → 结局 1/2 记录 + 奖励资产 + 额外经验
//   canGainResources / turnEnded → 干枯农田
//   cluesGained → 粘稠街道
import { spliceHand } from '../../../../../src/engine/hand-icons.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  ACTS, AGENDAS, ACT_STAGES, AGENDA_STAGES, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  LOCATIONS, LOCATION_TABLE, QUARANTINE_TABLE, FIXED_LOCATION_TABLE, GRID_SLOTS, REMOVED_SLOTS,
  START_LOCATION, SUBJECT_CODE, VULNERABLE_HEART_CODE, STORY_CODES, STORY_RULES,
  MIGO_GENERAL_CODE, MIGO_DRONE_CODE, MIGO_HARVESTER_CODE, MIGO_MEDDLER_CODE, MIGO_ABDUCTOR_CODE,
  OOZELING_CODE, GRASPING_OOZE_CODE, CUBIC_OOZE_CODE, OOZEWRAITH_CODE, BLOB_X,
  CHEMIST_CODE, SAMPLE_CODE, MILITARY_PLAN_CODE, REWARD_ASSET_CODES,
  SET_ASIDE_ALIASES, SCENARIO_TEXT,
} from './definition.js'

const CHAPTER_ID = 'theBlobThatAteEverything'
const MANIFOLD_TRAIT = 'manifold'
const OOZE_TRAIT = 'ooze'
const OOZIFIED_TRAIT = 'oozified'

// ---------------------------------------------------------------------------
// 通用助手
// ---------------------------------------------------------------------------
const clone = value => structuredClone(value)
const codeOf = value => String(value?.originalCode || value?.code || '')
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
const shuffleWith = (api, list) => {
  if (typeof api?.shuffle === 'function') return api.shuffle([...list])
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomOf(api) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function blobState(state) {
  state.scenarioFlags ||= {}
  state.scenarioFlags.blob ||= {}
  return state.scenarioFlags.blob
}
function patchBlob(state, patch) {
  const data = blobState(state)
  Object.assign(data, patch)
  return data
}
const facts = state => (blobState(state).remembered ||= [])
function rememberFact(state, api, fact) {
  const list = facts(state)
  if (list.includes(fact)) return false
  list.push(fact)
  if (typeof api?.remember === 'function') api.remember(fact)
  return true
}
const hasFact = (state, fact) => facts(state).includes(fact)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const locName = (state, id) => locationOf(state, id)?.name || LOCATIONS[id]?.name || id
const currentActCode = state => codeOf((state.acts || [])[state.actIndex ?? 0])
const currentAgendaCode = state => codeOf((state.agendas || [])[state.agendaIndex ?? 0])
const isHardSide = state => state.difficulty === 'hard' || state.difficulty === 'expert'
const traitsOf = code => (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())
const isManifold = entity => entity && (entity.traits
  ? entity.traits.map(trait => String(trait).toLowerCase()).includes(MANIFOLD_TRAIT)
  : traitsOf(codeOf(entity)).includes(MANIFOLD_TRAIT))
const isOoze = entity => entity && (entity.traits
  ? entity.traits.map(trait => String(trait).toLowerCase()).includes(OOZE_TRAIT)
  : traitsOf(codeOf(entity)).includes(OOZE_TRAIT))
const enemyList = state => (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.resigned)
const subjectOf = state => enemyList(state).find(enemy => codeOf(enemy) === SUBJECT_CODE) || null
const oozifiedLocations = state => (state.locations || []).filter(location => location.revealed !== false
  && (LOCATIONS[location.id]?.oozified || LOCATIONS[location.id]?.traits?.includes?.('Oozified')
    || traitsOf(codeOf(location)).includes(OOZIFIED_TRAIT)))
const leadSeatOf = state => {
  const active = activeInvestigators(state)
  const lead = state.campaign?.leadSeat
  return active.some(inv => inv.seat === lead) ? lead : active[0]?.seat ?? 0
}
const leadInvestigator = state => state.investigators?.[leadSeatOf(state)] || activeInvestigators(state)[0] || null

function connectionMap(state) {
  const map = new Map()
  for (const location of state.locations || []) map.set(location.id, [...(location.connections || [])])
  return map
}
function distancesFrom(state, fromId) {
  const connections = connectionMap(state)
  const distance = new Map([[fromId, 0]])
  const queue = [fromId]
  while (queue.length) {
    const current = queue.shift()
    for (const next of connections.get(current) || []) {
      if (!distance.has(next)) { distance.set(next, distance.get(current) + 1); queue.push(next) }
    }
  }
  return distance
}
function farthestLocationFrom(state, ids) {
  const active = activeInvestigators(state)
  const anchors = active.length ? active.map(inv => inv.location) : [START_LOCATION]
  const score = new Map()
  for (const location of state.locations || []) {
    const candidates = anchors.map(anchor => distancesFrom(state, anchor).get(location.id) ?? 0)
    score.set(location.id, Math.min(...candidates))
  }
  const pool = (ids || [...score.keys()]).filter(id => score.has(id))
  if (!pool.length) return null
  return pool.sort((a, b) => (score.get(b) || 0) - (score.get(a) || 0))[0]
}

// ---------------------------------------------------------------------------
// 反制措施 / 吞噬 / Blob X
// ---------------------------------------------------------------------------
const countermeasuresOf = state => Math.max(0, Number(blobState(state).countermeasures) || 0)
function addCountermeasures(state, api, amount) {
  const value = countermeasuresOf(state) + amount
  patchBlob(state, { countermeasures: value })
  info(api, `🧪 反制措施 ${amount > 0 ? '+' : ''}${amount}（当前 ${value}）。`)
  return value
}
function devouredCount(state) {
  return Number(blobState(state).devoured) || 0
}
function devourCards(state, api, codes, reason = null) {
  const list = (codes || []).filter(Boolean)
  if (!list.length) return 0
  patchBlob(state, { devoured: devouredCount(state) + list.length, devouredCards: [...(blobState(state).devouredCards || []), ...list] })
  const names = list.slice(0, 4).map(code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code).join('、')
  info(api, `🕳️ 个体代号8L-08吞噬了 ${list.length} 张卡牌${names ? `（${names}${list.length > 4 ? ' 等' : ''}）` : ''}${reason ? `：${reason}` : ''}。`)
  return list.length
}
function devourInvestigator(state, api, inv) {
  if (!inv || inv.defeated) return false
  info(api, `💀 ${inv.name} 被个体代号8L-08吞噬：该调查员阵亡。`)
  inv.defeated = true
  inv.defeatCause = 'devoured'
  if (typeof state.checkDefeatedHook === 'function') state.checkDefeatedHook(inv.seat)
  return true
}
function dealSubjectDamage(state, api, amount, source = '吞噬万物') {
  const damage = Math.max(0, Number(amount) || 0)
  if (!damage) return 0
  const subject = subjectOf(state)
  if (!subject) return 0
  info(api, `💥 个体代号8L-08 受到 ${damage} 点伤害（${source}）。`)
  if (typeof api?.damageEnemy === 'function') api.damageEnemy(subject.id, damage, null, source)
  else subject.damageTaken = (Number(subject.damageTaken) || 0) + damage
  const health = Number(subject.health) || (15 * investigatorCount(state))
  if ((Number(subject.damageTaken) || 0) >= health && !subject.defeated) {
    subject.defeated = true
    info(api, '☄️ 个体代号8L-08 被击败！→ 结局 2。')
    safeCall(api, 'finish', 'resolution2')
  }
  return damage
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function baseSetup(state, api, { elseMode = false, extraQuarantine = [] } = {}) {
  const existing = blobState(state).setup
  if (existing) return existing
  const invCount = investigatorCount(state)
  const extra = extraQuarantine.length
    ? extraQuarantine
    : (elseMode ? (state.scenario?.elseQuarantineIds || []) : [])
  const quarantineCodes = [...QUARANTINE_TABLE.map(([id]) => id), ...extra]
  const removeCount = elseMode ? 5 : 1
  const shuffled = shuffleWith(api, quarantineCodes)
  const removed = shuffled.slice(0, removeCount)
  const remaining = shuffleWith(api, shuffled.slice(removeCount))
  const slotMap = {}
  for (const [id, , slot] of FIXED_LOCATION_TABLE) slotMap[id] = slot
  const innerSlots = ['east', 'west']
  const outerSlots = ['southOuter', 'eastOuter', 'westOuter']
  const cornerSlots = ['northEast', 'northWest', 'southEast', 'southWest']
  const placements = []
  innerSlots.forEach((slot, index) => {
    const id = remaining[index]
    if (id) { slotMap[id] = slot; placements.push([id, slot]) }
  })
  outerSlots.forEach((slot, index) => {
    const id = remaining[2 + index]
    if (id) { slotMap[id] = slot; placements.push([id, slot]) }
  })
  cornerSlots.forEach((slot, index) => {
    const id = remaining[5 + index]
    if (id) { slotMap[id] = slot; placements.push([id, slot]) }
  })
  const setup = {
    elseMode, removed, quarantine: remaining, slots: slotMap, placements,
    countermeasures: invCount >= 3 ? 2 : 1, devoured: 0, devouredCards: [], remembered: [],
    cycle: 0, story: null, explosives: [], planDamage: 0, active: true,
    waterTowerUsed: false, bridgeUsed: false, churchUsed: false,
    subjectSpawned: false, oozyLakebedClues: {}, oldBurialHill: {},
  }
  if (elseMode) {
    patchBlob(state, { elseMode: true })
  }
  patchBlob(state, setup)
  return setup
}

export function prepareScenario(state, api = {}, options = {}) {
  const setup = blobState(state).setup
  if (setup) return setup
  const invCount = investigatorCount(state)
  const actSource = state.scenario?.stageCards || ACT_STAGES
  state.acts = [ACT1_CODE, ACT2_CODE, ACT3_CODE].map(code => clone(actSource[code] || ACT_STAGES[code]))
  state.agendas = [AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE].map(code => clone(AGENDA_STAGES[code]))
  state.actIndex = 0
  state.agendaIndex = 0
  const report = baseSetup(state, api, options)
  info(api, `吞噬万物：${report.placements.length + FIXED_LOCATION_TABLE.length} 张地点入场（随机移除 ${report.removed.length} 张隔离区）；`
    + `个体代号8L-08 置于密谋牌库旁；初始反制措施 ${report.countermeasures}（${invCount} 名调查员）。`)
  return report
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api, { elseMode: false })
}

export function startLocation() {
  return START_LOCATION
}

function applyGridConnections(state, setup) {
  const slotOf = new Map(Object.entries(setup.slots || {}))
  const idAtSlot = new Map()
  for (const [id, slot] of slotOf) idAtSlot.set(slot, id)
  const neighbors = {
    center: ['north', 'south', 'east', 'west'],
    north: ['center', 'northOuter', 'northEast', 'northWest'],
    south: ['center', 'southOuter', 'southEast', 'southWest'],
    east: ['center', 'eastOuter', 'northEast', 'southEast'],
    west: ['center', 'westOuter', 'northWest', 'southWest'],
    northOuter: ['north'], southOuter: ['south'], eastOuter: ['east'], westOuter: ['west'],
    northEast: ['north', 'east'], northWest: ['north', 'west'],
    southEast: ['south', 'east'], southWest: ['south', 'west'],
  }
  for (const location of state.locations || []) {
    const slot = slotOf.get(location.id)
    location.connections = slot
      ? (neighbors[slot] || []).map(otherSlot => idAtSlot.get(otherSlot)).filter(Boolean)
      : []
  }
}

function spawnSubject(state, api) {
  const data = blobState(state)
  if (data.subjectSpawned) {
    const existing = subjectOf(state)
    if (existing) return existing
  }
  let subject = subjectOf(state)
  if (!subject) {
    subject = safeCall(api, 'spawn', SUBJECT_CODE, null)
    if (!subject) {
      const health = 15 * investigatorCount(state)
      subject = {
        id: `${SUBJECT_CODE}-${state.round || 0}-${(state.enemies || []).length + 1}`, code: SUBJECT_CODE,
        originalCode: SUBJECT_CODE, name: '个体代号8L-08', location: null, engagedSeat: null,
        fight: null, evade: null, health, damageTaken: 0, damage: 0, horror: 0, doom: 0,
        exhausted: false, global: true,
      }
      state.enemies ||= []
      state.enemies.push(subject)
    }
  }
  if (subject) {
    subject.location = null
    subject.global = true
    if (!Number(subject.health)) subject.health = 15 * investigatorCount(state)
    patchBlob(state, { subjectSpawned: true, subjectId: subject.id })
    info(api, `☄️ 个体代号8L-08 进入场景区（不在任何地点；全局血量 ${subject.health}）。`)
  }
  return subject
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api, { elseMode: blobState(state).elseMode === true })
  state.scenarioZones ||= {}
  if (!state.scenarioZones.setAside?.length) state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  spawnSubject(state, api)
  const ordered = [...FIXED_LOCATION_TABLE.map(([id]) => id), ...(report.placements || []).map(([id]) => id)]
  patchBlob(state, { placedIds: ordered })
  return ordered
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void api
  void seat
  if (!location) return
  location.revealed = true
  const definition = LOCATIONS[location.id]
  const perInvestigator = Number(definition?.cluesPerInvestigator ?? 0)
  const fixed = Number(definition?.cluesFixed)
  if (Number.isFinite(fixed)) location.clues = Math.max(0, fixed)
  else location.clues = Math.max(0, perInvestigator * investigatorCount(state))
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api, { elseMode: blobState(state).elseMode === true })
  applyGridConnections(state, report)
  spawnSubject(state, api)
  state.scenarioZones ||= {}
  if (!state.scenarioZones.setAside?.length) state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  // Setup：紧噬软泥 / 方体软泥各 1 张从「放一边」洗入遭遇牌库（静态分区见 definition 注释）。
  if (!blobState(state).startingOozesShuffled) {
    const setAside = state.scenarioZones.setAside
    let added = false
    for (const code of [GRASPING_OOZE_CODE, CUBIC_OOZE_CODE]) {
      const index = setAside.indexOf(code)
      if (index < 0) continue
      setAside.splice(index, 1)
      state.encounterDeck.push(code)
      added = true
    }
    if (added) {
      state.encounterDeck.sort(() => randomOf(api) - 0.5)
      info(api, '🃏 将 1 张紧噬软泥与 1 张方体软泥洗入遭遇牌库。')
    }
    patchBlob(state, { startingOozesShuffled: true })
  }
  info(api, '吞噬万物布置完成：内环/外环/角落连接已按正交相邻建立。')
  return { slots: { ...report.slots }, removed: [...report.removed] }
}

export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.blob
  const report = prepareScenario(state, api, { elseMode: false })
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  for (const id of [...FIXED_LOCATION_TABLE.map(([value]) => value), ...(report.placements || []).map(([value]) => value)]) {
    const definition = LOCATIONS[id]
    if (!definition) continue
    const instance = { ...clone(definition), clues: 0, revealed: true, connections: [] }
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  applyGridConnections(state, report)
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  state.encounterDeck = [...ENCOUNTER_DECK]
  spawnSubject(state, api)
  afterDeckSetup(state, null, { api })
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 剧情卡（Part 1）
// ---------------------------------------------------------------------------
// 所有 Part 1 剧情卡：普通流程 4 张；ELSE! 变体额外 3 张（89011/89014/89017）。
const ALL_STORY_CODES = Object.freeze([...STORY_CODES, '89011', '89014', '89017'])

function spawnStory(state, api, code) {
  const rule = STORY_RULES[code]
  const data = blobState(state)
  if (!rule || data.story?.code === code) return data.story || null
  const fungusMound = locationOf(state, 'fungusMound')
  const story = { code, enemyId: null, assetId: null, resolved: false, data: {}, elseStory: data.elseMode === true }
  const spawnEnemyAt = placement => {
    const locationId = placement === 'farthest'
      ? farthestLocationFrom(state)
      : (fungusMound?.id || null)
    return safeCall(api, 'spawn', rule.enemy || rule.extraEnemies?.[0]?.code, locationId)
  }
  if (rule.enemy) {
    const enemy = spawnEnemyAt(rule.enemyPlacement || 'fungusMound')
    if (enemy) story.enemyId = enemy.id
  }
  for (const extra of rule.extraEnemies || []) {
    const enemy = safeCall(api, 'spawn', extra.code, extra.placement === 'farthest'
      ? farthestLocationFrom(state) : (fungusMound?.id || null))
    if (enemy) story.extraEnemyIds = [...(story.extraEnemyIds || []), enemy.id]
  }
  if (rule.asset && rule.assetPlacement === 'farthest') {
    const target = farthestLocationFrom(state)
    const asset = safeCall(api, 'storyAsset', rule.asset, target)
    if (asset) story.assetId = asset.id
    if (rule.asset === CHEMIST_CODE) patchBlob(state, { chemist: { resources: 0, controlled: false, locationId: target } })
  } else if (rule.asset && rule.assetPlacement === 'crater') {
    const asset = safeCall(api, 'storyAsset', rule.asset, 'theCrater')
    if (asset) story.assetId = asset.id
  } else if (rule.asset && rule.assetPlacement === 'global') {
    const asset = safeCall(api, 'storyAsset', rule.asset, null)
    if (asset) story.assetId = asset.id
    if (rule.asset === MILITARY_PLAN_CODE) {
      patchBlob(state, { planDamage: 5 })
      const explosiveCount = 1 * investigatorCount(state)
      const crater = locationOf(state, 'theCrater')
      const distances = crater ? distancesFrom(state, 'theCrater') : new Map()
      const candidates = oozifiedLocations(state)
        .filter(location => location.id !== 'theCrater' && location.id !== 'fungusMound')
        .sort((a, b) => (distances.get(b.id) || 0) - (distances.get(a.id) || 0))
      const explosives = candidates.slice(0, explosiveCount).map(location => location.id)
      patchBlob(state, { explosives })
      info(api, `🧨 炸药已布置在 ${explosives.length} 张[[软泥污染]]地点上（${explosives.map(id => locName(state, id)).join('、')}）。`)
    }
  } else if (rule.asset && rule.assetPlacement === 'farthestFromFungus') {
    const candidates = (state.locations || []).filter(location => location.id !== 'fungusMound')
    const distances = fungusMound ? distancesFrom(state, 'fungusMound') : new Map()
    const target = candidates.sort((a, b) => (distances.get(b.id) || 0) - (distances.get(a.id) || 0))[0]
    const asset = safeCall(api, 'storyAsset', rule.asset, target?.id || null)
    if (asset) story.assetId = asset.id
    patchBlob(state, { carLocation: target?.id || null })
  } else if (rule.asset && rule.assetPlacement === 'attachedToEnemy') {
    const enemy = (state.enemies || []).find(item => item.id === story.enemyId)
    if (enemy && typeof api?.attachStoryAssetToEnemy === 'function') {
      const asset = api.attachStoryAssetToEnemy(rule.asset, enemy.id)
      if (asset) story.assetId = asset.id
    }
  }
  if (code === '85023') {
    const mound = locationOf(state, 'fungusMound')
    if (mound) mound.clues = (Number(mound.clues) || 0) + investigatorCount(state)
  }
  patchBlob(state, { story })
  if (typeof api?.attachToAct === 'function') api.attachToAct(code)
  else patchBlob(state, { storyAside: code })
  info(api, `📖 剧情卡「${rule.titleZh || rule.title}」进入场景区（放在幕牌库旁）。`)
  return story
}

function resolveStory(state, api, success) {
  const data = blobState(state)
  const story = data.story
  if (!story || story.resolved) return false
  const rule = STORY_RULES[story.code]
  if (!rule) return false
  story.resolved = true
  patchBlob(state, { story })
  if (success) {
    rememberFact(state, api, rule.successFact)
    info(api, `📖 ${rule.successText}`)
    if (rule.reward) {
      const investigator = leadInvestigator(state)
      if (investigator && typeof api?.giveAsset === 'function') {
        api.giveAsset(investigator.seat, rule.reward)
        info(api, `🎁 ${investigator.name} 获得奖励资产「${ALL_CARDS[rule.reward]?.nameZh || rule.reward}」。`)
      }
    }
    if (story.enemyId) {
      const enemy = (state.enemies || []).find(item => item.id === story.enemyId)
      if (enemy && !enemy.defeated) info(api, '剧情敌人留在场上，但剧情目标已完成。')
    }
  } else if (rule.failureFact) {
    rememberFact(state, api, rule.failureFact)
    info(api, `📖 ${rule.failureText}`)
  }
  return true
}

// 剧情资产离场 → 失败分支（化学家被击败/吞噬、装甲车被击败）。
export function storyAssetLeftPlay(state, asset, api = {}) {
  const code = codeOf(asset)
  const story = blobState(state).story
  if (!story || story.resolved) return false
  if (story.code === '85021' && code === CHEMIST_CODE) return resolveStory(state, api, false)
  if (story.code === '89011' && code === '89012') return resolveStory(state, api, false)
  return false
}

function checkStoryTriggers(state, api) {
  const data = blobState(state)
  const story = data.story
  if (!story || story.resolved) return false
  if (story.code === '85021') {
    const chemist = data.chemist || {}
    if (chemist.controlled && activeInvestigators(state).some(inv => inv.location === 'temporaryHQ')) {
      return resolveStory(state, api, true)
    }
    if (!(state.storyAssets || []).some(asset => codeOf(asset) === CHEMIST_CODE)
      && !(state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === CHEMIST_CODE))) {
      if ((blobState(state).chemist?.inPlay) === false) return resolveStory(state, api, false)
    }
  }
  if (story.code === '85022') {
    if (data.sampleDelivered) return resolveStory(state, api, true)
  }
  if (story.code === '85023') {
    const mound = locationOf(state, 'fungusMound')
    const general = enemyList(state).find(enemy => codeOf(enemy) === MIGO_GENERAL_CODE)
    if (!general) return resolveStory(state, api, true)
    if (mound && Number(mound.clues) <= 0) return resolveStory(state, api, true)
    if (mound && Number(mound.clues) >= 4 * investigatorCount(state)) return resolveStory(state, api, false)
  }
  if (story.code === '85024') {
    if (!(data.explosives || []).length) return resolveStory(state, api, true)
    if ((Number(data.planDamage) || 0) <= 0) return resolveStory(state, api, false)
  }
  return false
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
function makeMove(rule, label, inv, extra = {}) {
  return { action: 'scenarioAction', rule, label, locationId: inv?.location ?? null, actions: 1, ...extra }
}

function groupClueTotal(state, locationId = null) {
  return activeInvestigators(state)
    .filter(inv => !locationId || inv.location === locationId)
    .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const actCode = currentActCode(state)
  const data = blobState(state)
  const here = inv.location
  const countermeasures = countermeasuresOf(state)
  const oozifiedHere = LOCATIONS[here]?.oozified || traitsOf(codeOf(locationOf(state, here))).includes(OOZIFIED_TRAIT)

  // 幕 1：团队花费 2[per_investigator] 线索推进（普通流程）。
  if (actCode === ACT1_CODE) {
    const required = 2 * investigatorCount(state)
    const available = groupClueTotal(state)
    moves.push(makeMove('blobAdvanceAct1', `团队花费 ${required} 个线索推进幕 1（暴露异变！）`, inv, {
      reason: available >= required ? null : `团队需要 ${required} 个线索（现有 ${available}）`,
    }))
  }
  if (here === 'theCrater') {
    const targets = enemyList(state).filter(enemy => codeOf(enemy) === SUBJECT_CODE || isManifold(enemy))
    moves.push(makeMove('blobCraterDamage', '花费 1 反制措施：对个体代号8L-08或任意地点的[[异质]]敌人造成 3 伤害', inv, {
      reason: countermeasures > 0 ? (targets.length ? null : '场上没有有效目标') : '需要 1 个反制措施',
    }))
  }
  if (here === 'researchSite') {
    moves.push(makeMove('blobResearchClues', '花费 2 线索：获得 1 个反制措施', inv, {
      reason: Number(inv.clues) >= 2 ? null : '需要 2 个线索',
    }))
    moves.push(makeMove('blobResearchGainClue', '花费 1 反制措施：在 研究站 上放置 2 个线索', inv, {
      reason: countermeasures > 0 ? null : '需要 1 个反制措施',
    }))
  }
  if (here === 'temporaryHQ') {
    moves.push(makeMove('blobTempHQ', '花费 1 反制措施：治疗 3 伤害 / 3 恐惧 / 获得 5 资源 / 抽 3 张牌', inv, {
      reason: countermeasures > 0 ? null : '需要 1 个反制措施',
    }))
  }
  if (here === 'fungusMound') {
    const migo = enemyList(state).filter(enemy => traitsOf(codeOf(enemy)).includes('mi-go'))
    moves.push(makeMove('blobFungusMound', '花费 1 反制措施：选择任意地点的米·戈敌人并检定智识(0)，每成功 1 点造成 1 伤害（最多 5）', inv, {
      reason: countermeasures > 0 ? (migo.length ? null : '场上没有米·戈敌人') : '需要 1 个反制措施',
    }))
  }
  if (here === 'sewer') {
    moves.push(makeMove('blobSewer', '检定智识(1)：成功后移动到至多 X 条连接外的地点（X = 成功值）', inv))
  }
  if (here === 'bridge' && !data.bridgeUsed) {
    const target = enemyList(state).find(enemy => enemy.location === 'bridge' && enemy.exhausted && isManifold(enemy))
    moves.push(makeMove('blobBridge', '[fast] 检定智识(X)：击败 桥 上一名横置的[[异质]]敌人（X = 其躲避值；每局仅限一次成功）', inv, {
      reason: target ? null : '桥 上没有横置的[[异质]]敌人',
    }))
  }
  if (here === 'waterTower' && !data.waterTowerUsed && Number(locationOf(state, 'waterTower')?.clues) === 0) {
    moves.push(makeMove('blobWaterTower', '检定智识(3)：对 水塔 与连接地点的每名[[软泥]]敌人造成 3 伤害（每局仅限一次成功）', inv))
  }
  if (here === 'church' && !data.churchUsed && Number(locationOf(state, 'church')?.clues) === 0) {
    moves.push(makeMove('blobChurch', '选择 教堂 或连接地点的一名[[软泥]]敌人：将其移向远离教堂的一处地点并自动躲避（团队每局仅限一次）', inv))
  }
  // 剧情行动
  const story = data.story
  if (story && !story.resolved) {
    if (story.code === '85021' && here === 'temporaryHQ') {
      moves.push(makeMove('blobRescueChemist', '剧情：把化学家带到临时总部完成救援', inv, { reason: null }))
    }
    if (story.code === '85021' && data.chemist && !data.chemist.controlled) {
      const chemistLocation = data.chemist.locationId
      if (here === chemistLocation) {
        moves.push(makeMove('blobParleyChemist', '谈判：检定意志或智识(3)；成功在化学家上放 1 资源，集齐后取得控制', inv))
      }
    }
    if (story.code === '85022') {
      const sampleAsset = (state.storyAssets || []).find(asset => codeOf(asset) === SAMPLE_CODE)
      if (sampleAsset && sampleAsset.location === here) {
        moves.push(makeMove('blobTakeSample', '检定意志或敏捷(6)：取得陨石样本', inv, {
          reason: Number(locationOf(state, here)?.clues) === 0 ? null : '此地仍有线索',
        }))
      }
      if (here === 'researchSite' && data.sampleTaken) {
        moves.push(makeMove('blobDeliverSample', '剧情：把陨石样本送到研究站完成回收', inv))
      }
    }
    if (story.code === '85024') {
      const explosives = data.explosives || []
      if (explosives.includes(here)) {
        moves.push(makeMove('blobDefuseExplosive', '检定智识或敏捷(3)：拆除此地的炸药', inv))
      }
    }
    if (story.code === '89011' && here === 'fungusMound') {
      moves.push(makeMove('blobEscortArrive', '剧情：装甲车已抵达真菌堆', inv))
    }
    if (story.code === '89014') {
      const scientist = enemyList(state).find(enemy => codeOf(enemy) === '89015')
      if (scientist && scientist.location === here) {
        moves.push(makeMove('blobTakeBrain', '检定智识或敏捷(6)：夺得脑匣', inv))
      }
      if (here === 'researchSite' && data.brainTaken) {
        moves.push(makeMove('blobDeliverBrain', '剧情：把脑匣送到研究站完成回收', inv))
      }
    }
  }
  return moves
}

function actAdvance1(state, inv, api) {
  const required = 2 * investigatorCount(state)
  if (!safeCall(api, 'payGroupClues', required)) return false
  info(api, `📜 团队花费 ${required} 个线索，推进幕 1。`)
  safeCall(api, 'advanceAct')
  return true
}

function chooseOne(api, state, seat, prompt, options) {
  if (!options.length) return null
  if (options.length === 1) return options[0].id
  return api?.choice?.({
    kind: 'choice', source: 'theBlobThatAteEverything', seat,
    prompt, options,
  }) ?? options[0].id
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  const data = blobState(state)
  const rule = move.rule
  if (rule === 'blobAdvanceAct1') return actAdvance1(state, inv, api)
  if (rule === 'blobCraterDamage') {
    if (countermeasuresOf(state) < 1) return false
    const targets = enemyList(state).filter(enemy => codeOf(enemy) === SUBJECT_CODE || isManifold(enemy))
    const id = chooseOne(api, state, inv.seat, '选择目标：', targets.map(enemy => ({ id: enemy.id, label: enemy.name })))
    if (!id) return false
    addCountermeasures(state, api, -1)
    const target = targets.find(enemy => enemy.id === id)
    if (!target) return false
    if (codeOf(target) === SUBJECT_CODE) dealSubjectDamage(state, api, 3, '陨石坑的反制措施')
    else safeCall(api, 'damageEnemy', target.id, 3, inv.seat)
    return true
  }
  if (rule === 'blobResearchClues') {
    if (Number(inv.clues) < 2) return false
    safeCall(api, 'spendClues', inv.seat, 2)
    addCountermeasures(state, api, 1)
    return true
  }
  if (rule === 'blobResearchGainClue') {
    if (countermeasuresOf(state) < 1) return false
    addCountermeasures(state, api, -1)
    const site = locationOf(state, 'researchSite')
    if (site) { site.clues = (Number(site.clues) || 0) + 2; info(api, '🔬 研究站 上放置 2 个线索。') }
    return true
  }
  if (rule === 'blobTempHQ') {
    if (countermeasuresOf(state) < 1) return false
    const id = chooseOne(api, state, inv.seat, '选择临时总部的效果：', [
      { id: 'damage', label: '治疗 3 点伤害' },
      { id: 'horror', label: '治疗 3 点恐惧' },
      { id: 'resources', label: '获得 5 资源' },
      { id: 'cards', label: '抽 3 张牌' },
    ])
    addCountermeasures(state, api, -1)
    if (id === 'damage') safeCall(api, 'healDamage', inv.seat, 3)
    else if (id === 'horror') safeCall(api, 'healHorror', inv.seat, 3)
    else if (id === 'resources') safeCall(api, 'gainResources', inv.seat, 5)
    else safeCall(api, 'drawCards', inv.seat, 3)
    return true
  }
  if (rule === 'blobFungusMound') {
    if (countermeasuresOf(state) < 1) return false
    const migo = enemyList(state).filter(enemy => traitsOf(codeOf(enemy)).includes('mi-go'))
    const id = chooseOne(api, state, inv.seat, '选择米·戈敌人：', migo.map(enemy => ({ id: enemy.id, label: enemy.name })))
    if (!id) return false
    addCountermeasures(state, api, -1)
    safeCall(api, 'test', inv.seat, 'intellect', 0, result => {
      if (!result?.success) return
      const damage = Math.min(5, Math.max(0, Number(result.successBy) || 0))
      if (damage > 0) safeCall(api, 'damageEnemy', id, damage, inv.seat)
      info(api, `🍄 真菌堆：对目标造成 ${damage} 点伤害。`)
    })
    return true
  }
  if (rule === 'blobSewer') {
    safeCall(api, 'test', inv.seat, 'intellect', 1, result => {
      if (!result?.success) return
      const maxDistance = Math.max(0, Number(result.successBy) || 0)
      const distances = distancesFrom(state, inv.location)
      const candidates = [...distances].filter(([id, distance]) => id !== inv.location && distance <= maxDistance)
      if (!candidates.length) return
      const id = chooseOne(api, state, inv.seat, '选择移动目的地：',
        candidates.map(([locationId]) => ({ id: locationId, label: locName(state, locationId) })))
      if (id) safeCall(api, 'moveInvestigator', inv.seat, id)
    })
    return true
  }
  if (rule === 'blobBridge') {
    const target = enemyList(state).find(enemy => enemy.location === 'bridge' && enemy.exhausted && isManifold(enemy))
    if (!target) return false
    safeCall(api, 'test', inv.seat, 'intellect', Number(target.evade) || 1, result => {
      if (!result?.success) return
      safeCall(api, 'defeatEnemy', target)
      patchBlob(state, { bridgeUsed: true })
      info(api, '🌉 桥：目标被击败（本局仅限一次成功）。')
    })
    return true
  }
  if (rule === 'blobWaterTower') {
    safeCall(api, 'test', inv.seat, 'intellect', 3, result => {
      if (!result?.success) return
      patchBlob(state, { waterTowerUsed: true })
      const tower = locationOf(state, 'waterTower')
      const locationIds = ['waterTower', ...(tower?.connections || [])]
      const oozes = enemyList(state).filter(enemy => locationIds.includes(enemy.location) && isOoze(enemy))
      for (const enemy of oozes) safeCall(api, 'damageEnemy', enemy.id, 3, inv.seat)
      info(api, `🗼 水塔倒塌：${oozes.length} 名[[软泥]]敌人各受到 3 点伤害。`)
    })
    return true
  }
  if (rule === 'blobChurch') {
    const church = locationOf(state, 'church')
    const locationIds = ['church', ...(church?.connections || [])]
    const oozes = enemyList(state).filter(enemy => locationIds.includes(enemy.location) && isOoze(enemy))
    const id = chooseOne(api, state, inv.seat, '选择[[软泥]]敌人：', oozes.map(enemy => ({ id: enemy.id, label: enemy.name })))
    if (!id) return false
    patchBlob(state, { churchUsed: true })
    const enemy = oozes.find(item => item.id === id)
    const churchNeighbors = church?.connections || []
    const destination = churchNeighbors.find(neighbor => neighbor !== enemy?.location) || churchNeighbors[0]
    if (enemy && destination) {
      safeCall(api, 'moveEnemy', enemy, destination)
      safeCall(api, 'evadeEnemy', enemy, {})
      info(api, '⛪ 教堂：目标被移走并自动躲避（团队每局仅限一次）。')
    }
    return true
  }
  if (rule === 'blobRescueChemist') {
    const chemist = data.chemist || {}
    if (!chemist.controlled) {
      chemist.controlled = true
      patchBlob(state, { chemist })
    }
    rememberFact(state, api, 'theChemistWasSaved')
    resolveStory(state, api, true)
    return true
  }
  if (rule === 'blobParleyChemist') {
    safeCall(api, 'test', inv.seat, 'willpower', 3, result => {
      if (!result?.success) return
      const chemist = blobState(state).chemist || { resources: 0 }
      chemist.resources = (Number(chemist.resources) || 0) + 1
      const needed = investigatorCount(state)
      info(api, `🧪 化学家上放置 1 资源（${chemist.resources}/${needed}）。`)
      if (chemist.resources >= needed) {
        chemist.controlled = true
        info(api, '🧪 化学家被调查员控制。')
      }
      patchBlob(state, { chemist })
    })
    return true
  }
  if (rule === 'blobTakeSample') {
    safeCall(api, 'test', inv.seat, 'willpower', 6, result => {
      if (!result?.success) return
      patchBlob(state, { sampleTaken: true })
      safeCall(api, 'giveAsset', inv.seat, SAMPLE_CODE)
      info(api, '☄️ 陨石样本被取得。')
    })
    return true
  }
  if (rule === 'blobDeliverSample') {
    patchBlob(state, { sampleDelivered: true })
    resolveStory(state, api, true)
    return true
  }
  if (rule === 'blobDefuseExplosive') {
    safeCall(api, 'test', inv.seat, 'intellect', 3, result => {
      if (!result?.success) return
      const explosives = (blobState(state).explosives || []).filter(id => id !== inv.location)
      patchBlob(state, { explosives })
      info(api, `🧨 拆除了 ${locName(state, inv.location)} 的炸药（剩余 ${explosives.length}）。`)
      checkStoryTriggers(state, api)
    })
    return true
  }
  if (rule === 'blobEscortArrive') {
    resolveStory(state, api, true)
    return true
  }
  if (rule === 'blobTakeBrain') {
    safeCall(api, 'test', inv.seat, 'intellect', 6, result => {
      if (!result?.success) return
      patchBlob(state, { brainTaken: true })
      safeCall(api, 'giveAsset', inv.seat, '89016')
      info(api, '🧠 脑匣被取得。')
    })
    return true
  }
  if (rule === 'blobDeliverBrain') {
    resolveStory(state, api, true)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) {
    const oozified = oozifiedLocations(state)
    const id = chooseOne(api, state, leadSeatOf(state), '选择生成脆弱心脏的[[软泥污染]]地点：',
      oozified.map(location => ({ id: location.id, label: location.name })))
    const target = oozified.find(location => location.id === id) || oozified[0]
    if (target) {
      const heart = safeCall(api, 'spawn', VULNERABLE_HEART_CODE, target.id)
      patchBlob(state, { vulnerableHeartId: heart?.id || null })
      info(api, `❤️ 脆弱心脏在「${target.name}」生成。`)
    }
    return true
  }
  if (code === ACT2_CODE) {
    const data = blobState(state)
    const heart = (state.enemies || []).find(enemy => codeOf(enemy) === VULNERABLE_HEART_CODE)
    const damage = Number(heart?.damageTaken) || 0
    if (heart) {
      info(api, `❤️ 脆弱心脏离场（带走 ${damage} 点伤害）。`)
      state.enemies = (state.enemies || []).filter(enemy => enemy !== heart)
    }
    patchBlob(state, { vulnerableHeartId: null })
    const discarded = []
    while (discarded.length < damage && state.encounterDeck?.length) {
      const card = state.encounterDeck.pop()
      discarded.push(card)
      state.encounterDiscard.push(card)
    }
    if (discarded.length) {
      info(api, `🃏 从遭遇牌库顶弃掉 ${discarded.length} 张牌（近似「弃到总血量 ≥ X 的[[异质]]敌人」）。`)
    }
    return true
  }
  if (code === ACT3_CODE) {
    const data = blobState(state)
    const candidates = ALL_STORY_CODES.filter(storyCode => data.elseMode || STORY_CODES.includes(storyCode))
      .filter(storyCode => !(data.usedStories || []).includes(storyCode))
    const pool = candidates.length ? candidates : ALL_STORY_CODES.filter(storyCode => data.elseMode || STORY_CODES.includes(storyCode))
    const chosen = pool[Math.floor(randomOf(api) * pool.length)] || pool[0]
    patchBlob(state, { usedStories: [...(data.usedStories || []), chosen], cycle: (Number(data.cycle) || 0) + 1 })
    spawnStory(state, api, chosen)
    info(api, '📖 幕 3 背面：读取一张 Part 1 剧情卡，然后幕牌库重置回第 1 幕。')
    state.acts = [ACT1_CODE, ACT2_CODE, ACT3_CODE].map(stageCode => clone(STAGE_LOOKUP[stageCode]))
    return true
  }
  return false
}

const STAGE_LOOKUP = Object.fromEntries([...Object.entries(ACT_STAGES), ...Object.entries(AGENDA_STAGES)])

export function actIndexAfterAdvance(state, act) {
  if (codeOf(act) !== ACT3_CODE) return undefined
  patchBlob(state, { act3EnteredRound: null, pendingActAdvance: false })
  return 0
}

function devourLocations(state, api, count) {
  const candidates = oozifiedLocations(state).filter(location => location.id !== 'theCrater'
    && !(Number(location.clues) >= 0 && (state.enemies || []).some(enemy => codeOf(enemy) === VULNERABLE_HEART_CODE
      && enemy.location === location.id)))
  const chosen = []
  const pool = shuffleWith(api, candidates)
  for (const location of pool) {
    if (chosen.length >= count) break
    chosen.push(location)
  }
  for (const location of chosen) {
    const enemies = (state.enemies || []).filter(enemy => enemy.location === location.id && !enemy.defeated)
    for (const enemy of enemies) {
      if (isOoze(enemy)) safeCall(api, 'defeatEnemy', enemy)
      else safeCall(api, 'devourEnemy', enemy) ?? dealSubjectDamage(state, api, 0)
    }
    for (const owner of state.investigators || []) {
      for (const asset of (owner.assets || []).filter(item => item.location === location.id)) {
        devourCards(state, api, [asset.code], '地点上的支援')
      }
    }
    state.enemies = (state.enemies || []).filter(enemy => enemy.location !== location.id)
    info(api, `🕳️ 个体代号8L-08 吞噬了地点「${location.name}」。`)
    if (typeof api?.removeLocationFromGame === 'function') api.removeLocationFromGame(location.id, { force: true })
    else state.locations = state.locations.filter(item => item !== location)
  }
  return chosen.map(location => location.id)
}

function reshuffleEncounterDiscard(state) {
  if (!state.encounterDiscard?.length) return
  state.encounterDeck = [...(state.encounterDeck || []), ...state.encounterDiscard]
  state.encounterDiscard = []
  if (typeof state.encounterDeck === 'object') {
    // 洗回由引擎的随机源在 behavior 之外不可见；用一次本地 Fisher-Yates 保证顺序被打乱。
    for (let i = state.encounterDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[state.encounterDeck[i], state.encounterDeck[j]] = [state.encounterDeck[j], state.encounterDeck[i]]
    }
  }
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) {
    devourLocations(state, api, 2)
    reshuffleEncounterDiscard(state)
    if (typeof api?.shuffleIntoEncounterDeck === 'function') {
      api.shuffleIntoEncounterDeck([CUBIC_OOZE_CODE, GRASPING_OOZE_CODE])
    } else {
      state.encounterDeck.push(CUBIC_OOZE_CODE, GRASPING_OOZE_CODE)
    }
    info(api, '🌍 议程 1 背面：将方体软泥与紧噬软泥洗入遭遇牌库。')
    return true
  }
  if (code === AGENDA2_CODE) {
    devourLocations(state, api, 2)
    reshuffleEncounterDiscard(state)
    if (typeof api?.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck([OOZEWRAITH_CODE, OOZEWRAITH_CODE])
    else state.encounterDeck.push(OOZEWRAITH_CODE, OOZEWRAITH_CODE)
    info(api, '🌍 议程 2 背面：将 2 张软泥幽灵洗入遭遇牌库。')
    return true
  }
  if (code === AGENDA3_CODE) {
    info(api, '🌑 议程 3 背面：个体代号8L-08 吞噬了所有卡牌——调查员输掉本战役。（→结局 1）')
    safeCall(api, 'finish', 'resolution1')
    return true
  }
  return false
}

export function roundEnded(state, api = {}) {
  checkStoryTriggers(state, api)
  const data = blobState(state)
  const actCode = currentActCode(state)
  // 幕 2/3：轮末强制推进（在下一轮开始后的 checkObjectives 兑现）。
  if (actCode === ACT2_CODE) patchBlob(state, { pendingActAdvance: true })
  else if (actCode === ACT3_CODE) {
    const entered = Number(data.act3EnteredRound ?? state.round)
    patchBlob(state, { act3EnteredRound: entered })
    if (state.round > entered) patchBlob(state, { pendingActAdvance: true })
    else info(api, '⏳ 黑水之灾：进入本轮的幕 3 不会在轮末推进（等待下一轮）。')
  }
  // 陨石坑轮末：所在地点的每名调查员受到 1 点伤害。
  const crater = locationOf(state, 'theCrater')
  if (crater) {
    for (const inv of activeInvestigators(state).filter(item => item.location === 'theCrater')) {
      safeCall(api, 'damage', inv.seat, 1)
    }
  }
  // 「它抓住我了！」（85052）轮末：放 1 资源，达到 6 则被吞噬。
  for (const inv of activeInvestigatorList(state)) {
    const threat = (inv.threat || []).find(card => codeOf(card) === '85052')
    if (!threat) continue
    threat.resources = (Number(threat.resources) || 0) + 1
    info(api, `🕸️ 「它抓住我了！」上的资源：${threat.resources}/6。`)
    if (threat.resources >= 6) devourInvestigator(state, api, inv)
  }
  return true
}

const activeInvestigatorList = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)

export function checkObjectives(state, api = {}) {
  const data = blobState(state)
  if (data.pendingActAdvance) {
    const actCode = currentActCode(state)
    if (actCode === ACT2_CODE || actCode === ACT3_CODE) {
      patchBlob(state, { pendingActAdvance: false })
      safeCall(api, 'info', `📜 ${actCode === ACT2_CODE ? '外星生理学' : '黑水之灾'}：轮末强制推进。`)
      safeCall(api, 'advanceAct')
      return true
    }
  }
  const actCode = currentActCode(state)
  if (actCode === ACT1_CODE) {
    const required = 2 * investigatorCount(state)
    if (groupClueTotal(state) >= required) {
      safeCall(api, 'info', `📜 幕 1：团队可以花费 ${required} 个线索推进（使用场景行动）。`)
    }
  }
  return false
}

export function phaseBegan(state, phase, api = {}) {
  void state
  void phase
  void api
  return false
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return false
  const code = codeOf(enemy)
  if (code === SUBJECT_CODE) {
    enemy.location = null
    enemy.global = true
    patchBlob(state, { subjectSpawned: true, subjectId: enemy.id })
    return true
  }
  const data = blobState(state)
  if (isManifold(enemy) && enemy.location === 'oozyLakebed1' || isManifold(enemy) && enemy.location === 'oozyLakebed2') {
    const location = locationOf(state, enemy.location)
    if (location) { location.clues = (Number(location.clues) || 0) + 1 }
    const clues = { ...(data.oozyLakebedClues || {}), [enemy.id]: state.round }
    patchBlob(state, { oozyLakebedClues: clues })
    info(api, '🌊 黏糊湖床：生成[[异质]]敌人后，此地点放置 1 个线索；该敌人本回合不能受到伤害。')
    return true
  }
  if (isManifold(enemy) && (enemy.location === 'oldBurialHill')) {
    enemy.exhausted = true
    const marks = { ...(data.oldBurialHill || {}), [enemy.id]: state.round }
    patchBlob(state, { oldBurialHill: marks })
    info(api, '⛰️ 旧墓山：[[异质]]敌人横置；本回合被击败时改为在旧墓山发现线索。')
    return true
  }
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy) return false
  const code = codeOf(enemy)
  if (code === SUBJECT_CODE) {
    info(api, '☄️ 个体代号8L-08 被击败！→ 结局 2。')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  if (code === VULNERABLE_HEART_CODE) {
    info(api, '❤️ 脆弱心脏不能被击败（伤害会转移给个体代号8L-08）。')
    return false
  }
  const data = blobState(state)
  const blobX = BLOB_X[code]
  if (blobX) {
    const early = data.oldBurialHill?.[enemy.id] != null
    if (early) {
      const target = locationOf(state, 'oldBurialHill')
      const amount = blobX
      if (target) {
        info(api, `⛰️ 旧墓山：改为在旧墓山发现 ${amount} 个线索。`)
        for (const inv of activeInvestigatorList(state)) {
          if (inv.location === 'oldBurialHill') safeCall(api, 'discoverClue', inv.seat, amount, 'oldBurialHill')
        }
      }
    } else {
      dealSubjectDamage(state, api, blobX, `击败「${enemy.name || code}」的 Blob ${blobX}`)
    }
  }
  // 剧情敌人 defeated 触发
  const story = data.story
  if (story && !story.resolved) {
    if (story.code === '85023' && code === MIGO_GENERAL_CODE) resolveStory(state, api, true)
    if (story.code === '89017' && code === '89018') {
      const researchers = enemyList(state).filter(item => codeOf(item) === '89018')
      if (!researchers.length) resolveStory(state, api, true)
    }
  }
  // ELSE! 复制异变体：[[异质]]敌人被击败时，队长可花 1 反制措施阻止复制，否则生成复制异变体。
  if (data.elseMode && isManifold(enemy)) {
    const aberrationCodes = ['89010a', '89010b', '89010c', '89010d', '89010e', '89010f', '89010g', '89010h', '89010i']
    const aberration = aberrationCodes[Math.floor(randomOf(api) * aberrationCodes.length)]
    const location = enemy.location || null
    if (countermeasuresOf(state) > 0) {
      const answer = chooseOne(api, state, leadSeatOf(state), '复制异变体：花费 1 反制措施阻止复制？', [
        { id: 'prevent', label: '花费 1 反制措施阻止复制' },
        { id: 'allow', label: '允许复制异变体生成' },
      ])
      if (answer === 'prevent') {
        addCountermeasures(state, api, -1)
        info(api, '🧪 花费 1 反制措施阻止了复制。')
      } else {
        const spawned = safeCall(api, 'spawn', aberration, location)
        if (spawned) { spawned.exhausted = true; info(api, `🧬 复制异变体在「${locName(state, location)}」生成（横置）。`) }
      }
    } else {
      const spawned = safeCall(api, 'spawn', aberration, location)
      if (spawned) { spawned.exhausted = true; info(api, `🧬 复制异变体在「${locName(state, location)}」生成（横置）。`) }
    }
  }
  return true
}

export function enemyDamaged(state, enemy, api = {}, seat = null, sourceCode = null) {
  void seat
  void sourceCode
  if (!enemy) return false
  if (codeOf(enemy) === VULNERABLE_HEART_CODE) {
    const data = blobState(state)
    const previous = Number(data.vulnerableHeartDamage) || 0
    const current = Math.min(15, Number(enemy.damageTaken) || 0)
    const delta = Math.max(0, current - previous)
    if (delta > 0) {
      if (current >= 15) info(api, '❤️ 脆弱心脏最多容纳 15 点伤害，多余伤害被取消。')
      info(api, `❤️ 脆弱心脏受到伤害：对个体代号8L-08 放置双倍伤害。`)
      dealSubjectDamage(state, api, delta * 2, '脆弱心脏的伤害转移')
    }
    patchBlob(state, { vulnerableHeartDamage: current })
    return true
  }
  return false
}

export function enemyDamageAllowed(state, enemy) {
  if (!enemy) return true
  const data = blobState(state)
  const round = data.oozyLakebedClues?.[enemy.id]
  if (round != null && Number(round) === Number(state.round)) return false
  return true
}

export function enemyPhaseStart(state, api = {}) {
  const data = blobState(state)
  const story = data.story
  const fungus = locationOf(state, 'fungusMound')
  const enemies = enemyList(state)
  // 米·戈无人机：准备状态→从所在地点移 1 线索到真菌堆。
  for (const drone of enemies.filter(enemy => codeOf(enemy) === MIGO_DRONE_CODE && !enemy.exhausted)) {
    const location = locationOf(state, drone.location)
    if (location && Number(location.clues) > 0 && fungus) {
      location.clues -= 1
      fungus.clues = (Number(fungus.clues) || 0) + 1
      info(api, '🛸 米·戈无人机：转移 1 个线索到真菌堆。')
    }
  }
  // 剧情敌人移动
  for (const enemy of enemies) {
    const code = codeOf(enemy)
    if (enemy.exhausted) continue
    if (code === MIGO_ABDUCTOR_CODE) {
      const chemist = (state.storyAssets || []).find(asset => codeOf(asset) === CHEMIST_CODE)
      if (chemist && chemist.location && chemist.location === enemy.location) {
        info(api, '🧪 米·戈绑架者攻击化学家。')
        if (typeof api?.damageAsset === 'function') {
          const owner = activeInvestigatorList(state).find(inv => (inv.assets || []).some(asset => asset.code === CHEMIST_CODE))
          if (owner) api.damageAsset(owner.seat, chemist.id, 1, { presentation: { code, sourceEnemyId: enemy.id } })
        }
      } else if (chemist?.location) safeCall(api, 'moveEnemyToward', enemy, chemist.location)
    }
    if (code === MIGO_HARVESTER_CODE) {
      const sample = (state.storyAssets || []).find(asset => codeOf(asset) === SAMPLE_CODE)
      if (sample?.location) safeCall(api, 'moveEnemyToward', enemy, sample.location)
    }
    if (code === MIGO_MEDDLER_CODE) {
      const explosives = data.explosives || []
      if (explosives.includes(enemy.location)) {
        const planDamage = Math.max(0, (Number(data.planDamage) || 5) - 1)
        patchBlob(state, { planDamage })
        info(api, `🧨 米·戈干涉者破坏军事计划（剩余 ${planDamage}/5）。`)
        if (planDamage <= 0) checkStoryTriggers(state, api)
      } else if (explosives.length) {
        safeCall(api, 'moveEnemyToward', enemy, explosives[0])
      }
    }
    if (code === MIGO_GENERAL_CODE && fungus && Number(fungus.clues) >= 4 * investigatorCount(state)) {
      checkStoryTriggers(state, api)
    }
    if (code === '89015') {
      const brain = (state.storyAssets || []).find(asset => codeOf(asset) === '89016')
      if (brain?.location) safeCall(api, 'moveEnemyToward', enemy, brain.location)
    }
    if (code === '89013') {
      const car = (state.storyAssets || []).find(asset => codeOf(asset) === '89012')
      if (car?.location === enemy.location) {
        info(api, '🚚 米·戈驱逐者攻击装甲车（+2 伤害）。')
        if (typeof api?.damageAsset === 'function') {
          const owner = activeInvestigatorList(state).find(inv => (inv.assets || []).some(asset => asset.code === '89012'))
          if (owner) api.damageAsset(owner.seat, car.id, 3)
        }
      } else if (car?.location) safeCall(api, 'moveEnemyToward', enemy, car.location)
    }
    if (code === '89018') {
      const target = enemies.find(ooze => isOoze(ooze) && !data.researchedOozes?.[ooze.id] && ooze !== enemy)
      if (target) {
        if (target.location === enemy.location) {
          const researched = { ...(data.researchedOozes || {}), [target.id]: true }
          patchBlob(state, { researchedOozes: researched, researchResources: (Number(data.researchResources) || 0) + 1 })
          info(api, `🔬 米·戈研究者研究了[[软泥]]敌人（研究进度 ${data.researchResources + 1}/6）。`)
          if ((Number(data.researchResources) || 0) + 1 >= 6) checkStoryTriggers(state, api)
        } else {
          safeCall(api, 'moveEnemyToward', enemy, target.location)
        }
      }
    }
  }
  // 纤维异常体（Armored Car）在敌人在场时被攻击的近似：每个准备敌人攻击它。
  const car = (state.storyAssets || []).find(asset => codeOf(asset) === '89012')
  if (car?.location) {
    const attackers = enemies.filter(enemy => enemy.location === car.location && !enemy.exhausted)
    for (const attacker of attackers) {
      info(api, `🚚 「${attacker.name || codeOf(attacker)}」攻击装甲车。`)
      if (typeof api?.damageAsset === 'function') {
        const owner = activeInvestigatorList(state).find(inv => (inv.assets || []).some(asset => asset.code === '89012'))
        if (owner) api.damageAsset(owner.seat, car.id, 1)
        else car.damage = (Number(car.damage) || 0) + 1
      }
    }
    if (car.global && Number(car.damage) >= 5) resolveStory(state, api, false)
  }
  // 装甲车抵达真菌堆（ELSE! 剧情）
  if (story && !story.resolved && story.code === '89011' && car?.location === 'fungusMound') {
    resolveStory(state, api, true)
  }
  // 脑匣被夺走（ELSE! 剧情失败分支）：米·戈科学家带着脑匣抵达真菌堆。
  if (story && !story.resolved && story.code === '89014') {
    const scientist = enemies.find(enemy => codeOf(enemy) === '89015')
    const brain = (state.storyAssets || []).find(asset => codeOf(asset) === '89016')
    const attached = brain && (brain.attachedToEnemyId === scientist?.id || brain.hostEnemyId === scientist?.id)
    if (scientist && scientist.location === 'fungusMound' && attached) resolveStory(state, api, false)
  }
  void fungus
  return true
}

// ---------------------------------------------------------------------------
// 地点强制效果
// ---------------------------------------------------------------------------
export function canGainResources(state, inv) {
  if (!inv) return true
  if (inv.location === 'desiccatedFarmland1' || inv.location === 'desiccatedFarmland2') return false
  return true
}

export function turnEnded(state, inv, api = {}) {
  if (!inv || inv.defeated) return false
  if (inv.location === 'desiccatedFarmland1' || inv.location === 'desiccatedFarmland2') {
    if ((Number(inv.resources) || 0) > 0) {
      safeCall(api, 'loseResources', inv.seat, 1)
      info(api, '🌾 干枯农田：回合结束时失去 1 资源。')
      return true
    }
  }
  return false
}

export function cluesGained(state, inv, amount, locationId, api = {}) {
  void inv
  if (!amount) return false
  const location = locationOf(state, locationId)
  if (!location) return false
  const slimy = /^slimyStreets/.test(locationId)
  if (!slimy) return false
  info(api, '🛣️ 粘稠街道：每发现 1 个线索，揭示 1 个混乱标记；每个[skull]/[auto_fail]使你受到 1 伤害或 1 恐惧。')
  for (let index = 0; index < amount; index++) {
    const token = safeCall(api, 'revealToken', inv?.seat)
    const face = String(typeof token === 'string' ? token : token?.face || token || '').toLowerCase().replace('_', '')
    if (face === 'skull' || face === 'autofail') {
      if (inv) safeCall(api, 'horror', inv.seat, 1)
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  const face = String(token || '').toLowerCase().replace('_', '')
  const hard = isHardSide(state)
  if (face === 'skull') {
    const divisor = hard ? 3 : 5
    return { delta: -Math.floor(devouredCount(state) / divisor) }
  }
  if (face === 'cultist') {
    return { delta: hard ? -3 : -2, onFail: [], onDraw: [{ type: 'scenarioToken', event: 'retaliate' }] }
  }
  if (face === 'tablet') {
    return { delta: hard ? -4 : -3, onDraw: [{ type: 'scenarioToken', event: 'devourCommitted' }] }
  }
  if (face === 'elderthing') {
    return { delta: hard ? -7 : -5, onDraw: [{ type: 'scenarioToken', event: 'devourHand', max: hard ? 7 : 5 }] }
  }
  return null
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const event = effect.event
  if (event === 'retaliate') {
    info(api, '🌪️ [cultist]：若本次检定是攻击敌人，该敌人本次攻击获得「反击」。')
    return true
  }
  if (event === 'devourCommitted') {
    info(api, '🌪️ [tablet]：本次检定结束后，投入本次检定的每张卡牌被吞噬。')
    return true
  }
  if (event === 'devourHand') {
    const count = Math.min(Number(effect.max) || 5, (state.investigators?.[inv?.seat]?.hand || []).length)
    if (count > 0) {
      const hand = [...(state.investigators[inv.seat].hand || [])]
      const chosen = hand.slice(0, count)
      spliceHand(state.investigators[inv.seat], 0, count)
      devourCards(state, api, chosen, '混乱标记 [elder_thing]')
      if (typeof api?.addTestValue === 'function') api.addTestValue(count)
    }
    return true
  }
  return false
}

export function tokenMeanings() {
  return SCENARIO_TEXT.tokens
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = String(key)
  const effects = []
  if (finalKey === 'resolution1' || finalKey === 'noResolution') {
    effects.push({ record: { subject8L08DevouredTheEntireUniverse: true } })
    info(infoApi, '结局 1：记录「个体代号8L-08吞噬了整个宇宙」；调查员输掉本战役。')
    return { bonus: 0, award: true, effects, flowData: { resolution: finalKey } }
  }
  if (finalKey === 'resolution2') {
    effects.push({ record: { theAnomalyWasContained: true } })
    for (const code of REWARD_ASSET_CODES) effects.push({ storyCard: code })
    info(infoApi, '结局 2：记录「异变体已被收容」；奖励资产可选择加入牌组；每人额外获得 3 点经验。')
    return { bonus: 3, award: true, effects, flowData: { resolution: finalKey } }
  }
  return { bonus: 0, award: true, effects, flowData: { resolution: finalKey } }
}

// ---------------------------------------------------------------------------
// 只读投影 / 具名助手 / 事件
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const data = blobState(state)
  const subject = subjectOf(state)
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    cycle: Number(data.cycle) || 0,
    countermeasures: countermeasuresOf(state),
    devoured: devouredCount(state),
    subject: subject ? { id: subject.id, damage: Number(subject.damageTaken) || 0, health: Number(subject.health) || 0 } : null,
    story: data.story ? { ...data.story } : null,
    explosives: [...(data.explosives || [])],
    planDamage: Number(data.planDamage) || 0,
    elseMode: data.elseMode === true,
    remembered: [...facts(state)],
    removedLocations: [...(data.removed || [])],
    slots: { ...(data.slots || {}) },
  }
}

export function implementedEntryFlags(code) {
  return registeredEntry(String(code || ''))?.flags || {}
}

export function devourFromEvent(state, payload = {}, api = {}) {
  return devourCards(state, api, payload.cards || [], payload.reason || null)
}

export function setCountermeasuresEvent(state, payload = {}, api = {}) {
  patchBlob(state, { countermeasures: Math.max(0, Number(payload.amount) || 0) })
  info(api, `🧪 反制措施设置为 ${countermeasuresOf(state)}。`)
  return countermeasuresOf(state)
}

export const events = {
  blobDevourCards(state, payload = {}, api = {}) {
    return devourFromEvent(state, payload, api)
  },
  blobSetCountermeasures(state, payload = {}, api = {}) {
    return setCountermeasuresEvent(state, payload, api)
  },
  blobSpawnStory(state, payload = {}, api = {}) {
    return spawnStory(state, api, String(payload.code || STORY_CODES[0]))
  },
}

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  startLocation,
  preScenarioSetup,
  prepareScenario,
  setupLocations,
  locationPlaced,
  afterDeckSetup,
  setupScenario,
  actions,
  performAction,
  actReveal,
  actIndexAfterAdvance,
  agendaReveal,
  checkObjectives,
  phaseBegan,
  roundEnded,
  turnEnded,
  canGainResources,
  cluesGained,
  enemySpawned,
  enemyDefeated,
  enemyDamaged,
  enemyDamageAllowed,
  enemyPhaseStart,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  events,
  scenarioSummary,
  currentActCode,
  currentAgendaCode,
  subjectOf,
  devouredCount,
  countermeasuresOf,
  codeOf,
}

export { devouredCount as getDevouredCount, countermeasuresOf as getCountermeasures }
