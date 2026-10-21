import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor } from '../../../../../src/cards/card-rules.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { syncSymbolConnections } from '../../card-data.js'
import {
  DESCENT_TO_YOTH, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES, HARBINGER,
} from './definition.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const flagsFor = state => (state.scenarioFlags ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const locationById = (state, id) => state.locations.find(location => location.id === id)
const isPoisoned = inv => (inv?.threat || []).some(card => card.code === '04102') || inv?.poisoned === true
const attachmentsWith = (location, code) =>
  (location?.attachments || []).filter(attachment => original(attachment) === code)

// 本章实现（或本地补齐）印刷效果的敌人／诡计原卡号。共享遭遇组里只做近似的一律不列，
// 由迁移审计的 remaining 记录（见交付说明）。
export const implementedEncounterCodes = [
  '04062', // 瓦卢西亚的预示者：共享钩子
  '04083', '04084', '04088', '04092', '04093', '04094', '04100', '04101', '04102',
  '04215', '04216', '04228',
]

// tfa-chaos.js 把久远腹地上下两半写成同一条 `heartOfTheElders` 分支，并接受
// `heartOfTheEldersPart1/Part2` 两个 id 作为别名；本章直接用自己的 id 调用。
export const CHAOS_CHAPTER_ID = 'heartOfTheEldersPart2'

function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  if (typeof helper?.random === 'function') return shuffleWith(list, helper.random)
  return [...list]
}

function shuffleWith(list, random) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function shuffleWithApi(state, api, list) {
  if (typeof api?.random === 'function') return shuffleWith(list, api.random)
  return [...list]
}

// 某地点上的调查员是否带有某个补给（宽阔步道的双筒望远镜等）。
function locationHasSupply(state, locationId, name) {
  return state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === locationId
    && ((state.campaign?.supplies || {})[inv.seat] || []).includes(name))
}

function removeOne(list, value) {  const index = (list || []).indexOf(value)
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

// 印刷的胜利／复仇点数：优先读本章的遭遇牌定义（保留卡片结构规则），再回落到目录。
function cardPoints(state, code) {
  const definition = state.scenario?.enemies?.[code] || state.scenario?.treacheries?.[code]
  const card = ALL_CARDS[code]
  return {
    victory: definition?.victory ?? card?.victory ?? 0,
    vengeance: definition?.vengeance ?? card?.vengeance ?? 0,
  }
}

function vengeanceInVictory(state) {
  return (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
}

function yigsFuryOf(state) {
  return Number(recordsFor(state).yigsFury || 0)
}

// 「未进入牌组的中毒弱点」——印刷的 4 张减去各调查员牌组里的张数。
function setAsidePoisonedCount(state) {
  const records = Object.values(state.campaign?.investigators || {})
  const inDecks = records.reduce((sum, record) =>
    sum + (record?.deck || []).filter(code => code === '04102').length, 0)
  return Math.max(0, Math.min(4, 4 - inDecks))
}

// 剧本日志「丛林在注视」列出的卡牌在布置时直接放进胜利区。
function placeTheJungleWatches(state) {
  const records = recordsFor(state)
  const watched = Array.isArray(records.theJungleWatches) ? records.theJungleWatches : []
  state.victoryDisplay ||= []
  const placed = []
  for (const code of watched) {
    if (!ALL_CARDS[code]) continue
    if (state.victoryDisplay.some(entry => original(entry) === code)) continue
    const points = cardPoints(state, code)
    state.victoryDisplay.push({
      id: `jungleWatches:${code}`, code, originalCode: code,
      victory: points.victory, vengeance: points.vengeance,
    })
    placed.push(code)
  }
  return placed
}

function distancesFrom(state, startId) {
  const distance = new Map([[startId, 0]])
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()
    for (const next of locationById(state, id)?.connections || []) {
      if (distance.has(next) || !locationById(state, next)) continue
      distance.set(next, (distance.get(id) || 0) + 1)
      queue.push(next)
    }
  }
  return distance
}

// 距离所有调查员最远的地点（密谋 1b：伊格之怒少于 8 笔勾时的预示者出生点）。
function farthestFromInvestigators(state) {
  const alive = active(state)
  if (!state.locations.length) return null
  const scored = state.locations.map(location => {
    const nearest = alive.length
      ? Math.min(...alive.map(inv => distancesFrom(state, inv.location).get(location.id) ?? Infinity))
      : Infinity
    return { id: location.id, nearest }
  }).filter(entry => Number.isFinite(entry.nearest))
  if (!scored.length) return state.locations[0].id
  scored.sort((left, right) => right.nearest - left.nearest)
  return scored[0].id
}

// 距离昆扬之口最近的、与给定地点相连的地点（场景 1b 的绕圈结算）。
function nearestToMouth(state, locationId) {
  const mouth = state.locations.find(location => location.id === 'mouthOfKnYan')
  if (!mouth) return null
  const connections = locationById(state, locationId)?.connections || []
  if (connections.includes(mouth.id)) return mouth.id
  const distance = distancesFrom(state, mouth.id)
  const candidates = connections
    .map(id => ({ id, distance: distance.get(id) ?? Infinity }))
    .filter(entry => Number.isFinite(entry.distance) && locationById(state, entry.id))
    .sort((left, right) => left.distance - right.distance)
  return candidates.length ? candidates[0].id : null
}

export function setupPlan(state, helper = {}) {
  const locations = [...EXPLORATION_LOCATIONS]
  const treacheries = Object.values(EXPLORATION_TREACHERIES)
  return {
    explorationDeck: mix(state, helper, [...locations, ...treacheries]),
    locations,
    treacheries,
  }
}

// ---- 地点强制效果 -----------------------------------------------------------

// 崇拜礼堂：探索成功后按「伊格之怒」的勾数抽取遭遇牌。
function resolveHallOfIdolatry(state, inv, api) {
  const fury = yigsFuryOf(state)
  const draws = fury >= 10 ? 2 : fury >= 5 ? 1 : 0
  if (!draws) return 0
  api.info?.(`崇拜礼堂：剧本日志“伊格之怒”有 ${fury} 笔勾，${inv.name} 抽取遭遇牌库顶 ${draws} 张。`)
  for (let index = 0; index < draws; index++) {
    if (inv.defeated || inv.resigned) break
    api.drawEncounter(inv.seat)
  }
  return draws
}

// 漆黑洞窟：入场后检查补给，没人带地图就额外放每位调查员 1 个线索。
function resolveDarkHollow(state, inv, api) {
  const location = state.locations.find(entry => entry.id === 'darkHollow')
  if (!location) return false
  // 每次入场只结算一次（跟着地点实例走；若地点被洗回探索牌库后再入场，会重新结算）。
  if (location.darkHollowResolved) return false
  location.darkHollowResolved = true
  state.scenarioFlags ||= {}
  state.scenarioFlags.darkHollowResolved = true
  // 卡面：如果没有任何调查员带有地图（看全队，不只是进入者所在地点）。
  const anyMap = active(state).some(entry => api.checkSupplies?.(entry.seat, 'map'))
  if (anyMap) return false
  const extra = state.numInvestigators
  location.maxClues = (location.maxClues || 0) + extra
  location.clues = (location.clues || 0) + extra
  api.info?.(`漆黑洞窟：没有人带地图，额外放置 ${extra} 个线索。`)
  return true
}

// 深入幽嘶：入场后每位调查员二选一（放 1 个毁灭，或抽取遭遇牌库顶 2 张）。
function resolveDescentToYoth(state, api) {
  const location = state.locations.find(entry => entry.id === 'descentToYoth')
  if (!location) return
  flagsFor(state)
  if (state.scenarioFlags.descentResolved) return
  state.scenarioFlags.descentResolved = true
  for (const inv of active(state)) {
    if (inv.defeated || inv.resigned) continue
    const answer = api.choose({
      kind: 'location', source: DESCENT_TO_YOTH, seat: inv.seat,
      prompt: '深入幽嘶入场：在深入幽嘶上放置 1 个毁灭标记，或抽取遭遇牌库顶 2 张卡牌。',
      options: [
        { id: 'doom', label: '在深入幽嘶上放置 1 个毁灭标记' },
        { id: 'draw', label: '抽取遭遇牌库顶 2 张卡牌' },
      ],
    })
    if (answer === 'draw') {
      api.drawEncounter(inv.seat)
      if (!inv.defeated && !inv.resigned) api.drawEncounter(inv.seat)
    } else {
      location.doom = (location.doom || 0) + 1
    }
  }
}

// ---- 本地补齐的共享遭遇组诡计 ----------------------------------------------

// 落入陷阱（04215）：险境；要么检定敏捷(3)，要么洗回探索牌库（从探索牌库抽出时不能选）。
function resolvePitfall(state, inv, api) {
  const flags = flagsFor(state)
  const fromExploration = flags.exploringSeat === inv.seat
  const options = [{ id: 'test', label: '检定敏捷(3)：每低于难度 1 点受到 1 点伤害' }]
  if (!fromExploration) options.push({ id: 'shuffle', label: '将落入陷阱洗入探索牌库' })
  const answer = options.length === 1 ? 'test' : api.choose({
    kind: 'treachery', source: '04215', seat: inv.seat, peril: true,
    prompt: '落入陷阱：跳过这条裂隙，还是把它洗回探索牌库？', options,
  })
  if (answer === 'shuffle') {
    state.explorationDeck ||= []
    state.explorationDeck = shuffleWithApi(state, api, [...state.explorationDeck, '04215'])
    api.info?.('落入陷阱被洗入探索牌库。')
    return true
  }
  api.test(inv.seat, 'agility', 3, result => {
    if (result.success) return
    const failedBy = Math.max(1, 3 - result.value)
    for (let index = 0; index < failedBy; index++) api.damage(inv.seat, 1)
  })
  return false
}

// 有毒孢子（04216）：附属到你所在地点；一轮结束时结算并弃掉。
function resolvePoisonousSpores(state, inv, api) {
  const location = here(state, inv)
  if (!location) return false
  location.attachments ||= []
  location.attachments.push({
    id: `poisonousSpores:${state.round}:${inv.seat}:${location.attachments.length}`,
    code: '04216', originalCode: '04216',
  })
  api.info?.('有毒孢子附属到此地点：一轮结束时，此地点的中毒者受到 2 点恐惧。')
  return true
}

function resolvePoisonousSporesEnd(state, location, attachment, api) {
  const targets = active(state).filter(inv => inv.location === location.id)
  for (const inv of targets.filter(isPoisoned)) api.horror(inv.seat, 2)
  for (const inv of targets.filter(target => !isPoisoned(target))) api.poison(inv.seat)
  removeOne(location.attachments || [], attachment)
  state.encounterDiscard = state.encounterDiscard || []
  state.encounterDiscard.push('04216')
}

// 无路可退（04228）：附属到你的地点或一个相连地点；被附属地点不能进出。
function resolveNoTurningBack(state, inv, api) {
  const location = here(state, inv)
  if (!location) return false
  const candidates = [location, ...(location.connections || []).map(id => locationById(state, id))]
    .filter(entry => entry && !attachmentsWith(entry, '04228').length)
  if (!candidates.length) return false
  const targetId = candidates.length === 1 ? candidates[0].id : api.choose({
    kind: 'location', source: '04228', seat: inv.seat,
    prompt: '无路可退：选择附属的地点（你的地点或一个相连地点，每个地点仅限 1 张）。',
    options: candidates.map(entry => ({ id: entry.id, label: entry.name })),
  })
  const target = candidates.find(entry => entry.id === targetId) || candidates[0]
  target.attachments ||= []
  target.attachments.push({
    id: `noTurningBack:${state.round}:${inv.seat}:${target.id}`,
    code: '04228', originalCode: '04228',
  })
  api.info?.(`无路可退附属到「${target.name}」：调查员不能进入或离开该地点。`)
  return true
}

function sealedByNoTurningBack(location) {
  return attachmentsWith(location, '04228').length > 0
}

// 调查深入幽嘶的难度：帷幕 + 地点修正 + 迷雾。
function descentDifficulty(state, location) {
  return (location?.shroud || 0) + (location?.shroudMod || 0) + (state.fogMod || 0)
}

function clearNoTurningBack(state, inv, move, api) {
  const location = locationById(state, move.locationId)
  const attachment = (location?.attachments || []).find(entry => entry.id === move.attachmentId)
  if (!attachment) return false
  const discard = () => {
    removeOne(location.attachments || [], attachment)
    state.encounterDiscard = state.encounterDiscard || []
    state.encounterDiscard.push('04228')
    api.info?.(`「${location.name}」上的无路可退被弃掉。`)
  }
  // 印刷：检定战斗(3)成功，或你带有鹤嘴锄。
  if (api.checkSupplies(inv.seat, 'pickaxe')) {
    discard()
    return true
  }
  api.test(inv.seat, 'combat', 3, result => { if (result.success) discard() })
  return true
}

// ---- 场景 1b：原地绕圈 -----------------------------------------------------

function resolveGoingInCircles(state, api) {
  // 将深入幽嘶洗入探索牌库。
  state.explorationDeck ||= []
  removeOne(state.scenarioZones?.setAside || [], DESCENT_TO_YOTH)
  state.explorationDeck = shuffleWithApi(state, api, [...state.explorationDeck, DESCENT_TO_YOTH])
  api.info?.('场景 1b：深入幽嘶被洗入探索牌库。')

  const alive = active(state)
  if (!alive.length) return null
  const leadSeat = state.campaign?.leadSeat ?? alive[0].seat
  const answer = alive.length === 1 ? String(alive[0].seat) : api.choose({
    kind: 'investigator', source: '04213', seat: leadSeat,
    prompt: '队长选择一位调查员担任队伍的侦查员。',
    options: alive.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  const scout = alive.find(inv => String(inv.seat) === String(answer)) || alive[0]
  if (api.hasSupply(scout.seat, 'chalk')) {
    api.info?.(`${scout.name} 带有粉笔，避免了原地绕圈。`)
    return { scout: scout.seat, chalk: true, moved: null }
  }
  // 没有粉笔：在场上每个地点放置 1 个线索。
  for (const location of state.locations) {
    location.maxClues = (location.maxClues || 0) + 1
    location.clues = (location.clues || 0) + 1
  }
  api.info?.('没有粉笔：在场上每个地点上放置 1 个线索，然后队伍在单面地点上原地绕圈。')
  const scoutLocation = locationById(state, scout.location)
  const singleSided = scoutLocation && scoutLocation.id !== 'mouthOfKnYan'
  if (!singleSided) return { scout: scout.seat, chalk: false, moved: null }
  const destination = nearestToMouth(state, scoutLocation.id)
  if (!destination) return { scout: scout.seat, chalk: false, moved: null }
  for (const inv of active(state).filter(entry => entry.location === scoutLocation.id)) {
    api.moveInvestigator(inv.seat, destination)
    // 强制移动（不是移动行动）：即使移动被某些效果挡住，也不能把人留在一张被
    // 洗回探索牌库的地点上。
    if (inv.location === scoutLocation.id) inv.location = destination
  }
  for (const enemy of state.enemies.filter(entry => entry.location === scoutLocation.id)) {
    api.moveEnemy(enemy, destination)
    if (enemy.location === scoutLocation.id) enemy.location = destination
  }
  const lost = scoutLocation.id
  api.remove(lost)
  state.explorationDeck = shuffleWithApi(state, api, [...state.explorationDeck, lost])
  api.info?.(`「${scoutLocation.name}」被洗回探索牌库，队伍退到「${locationById(state, destination)?.name || destination}」。`)
  return { scout: scout.seat, chalk: false, moved: destination, reshuffled: lost }
}

// ---- 密谋 1b：蛇族的复仇（预示者） ----------------------------------------

function spawnHarbinger(state, api) {
  const records = recordsFor(state)
  const damage = Number(records.theHarbingerIsStillAlive || 0)
  if (!(damage > 0)) {
    api.info?.('剧本日志里预示者已经不在人世，密谋背面没有敌人入场。')
    return null
  }
  const leadSeat = state.campaign?.leadSeat ?? active(state)[0]?.seat
  const lead = state.investigators?.[leadSeat]
  const atLead = yigsFuryOf(state) >= 8 && lead && !lead.defeated && !lead.resigned
  const targetId = atLead ? lead.location : farthestFromInvestigators(state)
  if (!targetId) return null
  const enemy = api.spawn(HARBINGER, targetId)
  if (!enemy) return null
  enemy.damageTaken = damage
  flagsFor(state).harbingerSpawned = true
  api.info?.(`瓦卢西亚的预示者在「${locationById(state, targetId)?.name || targetId}」出现，带 ${damage} 点伤害。`)
  return enemy
}

// ---- 结局分流 -------------------------------------------------------------

// 密谋／场景把「没有结局」分流到结局 1／2：调查员解救了亚历山卓走结局 1，否则结局 2。
export function reachedResolutionKey(state, key) {
  if (key !== 'noResolution') return key
  return recordsFor(state).theInvestigatorsRescuedAlejandro ? 'r1' : 'r2'
}

export const behavior = {
  ...encounterRules,
  id: 'heartOfTheEldersPart2',

  setupPlan,

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      DESCENT_TO_YOTH, HARBINGER, ...Array(setAsidePoisonedCount(state)).fill('04102'),
    ]
    state.scenarioZones.removed = []
    state.scenarioZones.explorationLocations = [...plan.locations]
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    state.scenarioFlags ||= {}
    state.scenarioFlags.harbingerSpawned = false
    state.scenarioFlags.darkHollowResolved = false
    state.scenarioFlags.descentResolved = false
    // 密谋 2「黑暗中的眼睛」：+1[per_investigator] 毁灭阈值。
    const eyesInTheDark = (state.agendas || []).find(agenda => original(agenda) === '04212')
    if (eyesInTheDark) eyesInTheDark.doomThreshold = 12 + state.numInvestigators
    placeTheJungleWatches(state)
    return ['mouthOfKnYan']
  },

  setupEnemies() {
    // 开场没有敌人：预示者是密谋 1 推进时才回到游戏的战役敌人。
  },

  // 幕／密谋提供「所在地点没有线索时才能探索」的行动。
  canExplore(state, inv) {
    if (encounterRules.canExplore(state, inv) === false) return false
    const location = here(state, inv)
    if ((location?.clues || 0) > 0) return false
    // 宽阔步道：没有双筒望远镜要额外花 1 个行动，行动不足时不要给出探索按钮，
    // 否则点下去会先扣掉这 1 个行动、再被 beforeExplore 取消（白丢行动）。
    if (original(location) === '04222' && !locationHasSupply(state, location.id, 'binoculars')
      && (inv.actionsLeft || 0) < 2) return false
    return true
  },

  beforeExplore(state, inv, api) {
    const location = here(state, inv)
    const code = original(location)
    // 宽阔步道：没有双筒望远镜必须额外花费 1 个行动。
    if (code === '04222' && !api.checkSupplies(inv.seat, 'binoculars')) {
      if ((inv.actionsLeft || 0) < 1) {
        api.info?.('宽阔步道：本地点没有人带双筒望远镜，需要额外 1 个行动，你的行动不足。')
        return false
      }
      inv.actionsLeft -= 1
      api.info?.('宽阔步道：本地点没有人带双筒望远镜，额外花费 1 个行动。')
    }
    // 记录本次探索，用于「落入陷阱」的「从探索牌库抽出」判断。
    flagsFor(state).exploringSeat = inv.seat
    return true
  },

  afterExplore(state, inv, context) {
    syncSymbolConnections(state)
    const api = context?.runtime
    const code = context?.code
    const kind = context?.kind
    delete flagsFor(state).exploringSeat
    if (kind !== 'location') return
    inv.tfaExploredThisTurn = true
    if (code === 'hallOfIdolatry') resolveHallOfIdolatry(state, inv, api)
    if (code === 'darkHollow') resolveDarkHollow(state, inv, api)
    if (code === 'descentToYoth') resolveDescentToYoth(state, api)
  },

  // 晶体柱群：进入后检定意志(1+复仇)。
  locationEntered(state, inv, location, api) {
    encounterRules.locationEntered?.(state, inv, location, api)
    if (original(location) !== '04226') return
    const vengeance = vengeanceInVictory(state)
    api.test(inv.seat, 'willpower', 1 + vengeance, result => {
      if (result.success) return
      api.damage(inv.seat, 1)
      api.horror(inv.seat, 1)
    })
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest(CHAOS_CHAPTER_ID, state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
    const location = here(state, inv)
    const code = original(location)
    // 危险峡谷：调查检定失败后，本地点没人带绳索就放 1 个毁灭。
    if (code === '04225' && !result.success && result.source?.label === '调查'
      && !api.checkSupplies(inv.seat, 'rope')) {
      location.doom = (location.doom || 0) + 1
      api.info?.('危险峡谷：本地点没有人带绳索，放置 1 个毁灭标记。')
    }
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken(CHAOS_CHAPTER_ID, state, inv, token, api)
  },

  // 共享遭遇组效果先结算，再本地补齐落入陷阱／有毒孢子／无路可退。
  // 如果 part 1 的实现者把 04215／04216 也写进共享规则（implementedTreacheries 声明），
  // 就完全交给共享规则，避免本章的本地补齐重复结算。
  resolveEncounter(state, inv, t, api) {
    const code = original(t)
    const locallyImplemented = code === '04215' || code === '04216'
    if (locallyImplemented && encounterRules.implementedTreacheries?.has(code)) {
      return encounterRules.resolveEncounter(state, inv, t, api)
    }
    const handled = encounterRules.resolveEncounter?.(state, inv, t, api)
    if (code === '04215') return resolvePitfall(state, inv, api)
    if (code === '04216') return resolvePoisonousSpores(state, inv, api)
    if (code === '04228') return resolveNoTurningBack(state, inv, api)
    return handled
  },

  // 无路可退：被附属地点不能进入。
  investigatorEntryError(state, location, inv) {
    if (sealedByNoTurningBack(location)) return '「无路可退」：你不能进入被附属的地点'
    return null
  },

  movementError(state, inv) {
    const shared = encounterRules.movementError?.(state, inv)
    if (shared) return shared
    if (sealedByNoTurningBack(here(state, inv))) return '「无路可退」：你不能离开被附属的地点'
    return null
  },

  encounterActions(state, inv) {
    const moves = [...(encounterRules.encounterActions?.(state, inv) || [])]
    const reachable = new Set([inv.location, ...(here(state, inv)?.connections || [])])
    for (const location of state.locations) {
      if (!reachable.has(location.id)) continue
      for (const attachment of attachmentsWith(location, '04228')) {
        moves.push({
          action: 'encounterAction', rule: 'clearNoTurningBack',
          attachmentId: attachment.id, locationId: location.id, actions: 1,
          label: `⛏️ 检定战斗(3)或检查鹤嘴锄，弃掉「无路可退」（${location.name}）`,
        })
      }
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    if (move.rule === 'clearNoTurningBack') return clearNoTurningBack(state, inv, move, api)
    return encounterRules.performEncounterAction?.(state, inv, move, api) || false
  },

  // 昆扬之口（深藏其下）：检查补给，带地图就查看探索牌库顶 2 张并弃掉其中的诡计。
  // 深入幽嘶：印刷的「成功调查后改为翻面」在这里做成 1 个行动的调查替代——
  // 引擎只在有线索的地点提供调查行动，而深入幽嘶的线索正是由毁灭标记翻面而来。
  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (original(location) === '04206b') {
      moves.push({
        action: 'scenarioAction', rule: 'scoutDepths',
        label: '🗺️ 检查补给：查看探索牌库顶 2 张，弃掉其中的诡计并混洗探索牌库',
      })
    }
    if (original(location) === DESCENT_TO_YOTH) {
      moves.push({
        action: 'scenarioAction', rule: 'flipDescentDoom', actions: 1,
        label: `🕳️ 调查深入幽嘶：检定智识(${descentDifficulty(state, location)})，把 1 个毁灭标记翻至线索面`,
        reason: (location?.doom || 0) > 0 ? null : '深入幽嘶上没有毁灭标记可翻面',
      })
    }
    // 04212 黑暗中的眼睛：[action] 如果所在地点没有线索，探索。
    const agenda = state.agendas?.[state.agendaIndex]
    if (original(agenda) === '04212' && (location?.clues || 0) === 0) {
      moves.push({
        action: 'scenarioAction', rule: 'eyesExplore',
        label: '👁️ 探索（所在地点没有线索）',
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'eyesExplore') {
      api.explore?.(inv.seat)
      return
    }
    if (move.rule === 'flipDescentDoom') {
      const location = here(state, inv)
      if (!location || (location.doom || 0) <= 0) return
      api.test(inv.seat, 'intellect', descentDifficulty(state, location), result => {
        if (!result.success) return
        location.doom -= 1
        location.clues = (location.clues || 0) + 1
        api.info?.('深入幽嘶：1 个毁灭标记翻至线索面。')
      }, 0, { label: '调查', name: location.name, code: DESCENT_TO_YOTH })
      return
    }
    if (move.rule === 'scoutDepths') {
      if (!api.checkSupplies(inv.seat, 'map')) {
        api.info?.('昆扬之口：队伍中没有地图，这次行动没有效果。')
        return
      }
      const deck = state.explorationDeck || []
      const top = deck.slice(Math.max(0, deck.length - 2))
      const rest = deck.slice(0, Math.max(0, deck.length - 2))
      const kept = []
      for (const code of top) {
        const isTreachery = Boolean(state.scenario?.treacheries?.[code]) || ALL_CARDS[code]?.type === 'treachery'
        if (isTreachery) {
          state.encounterDiscard = state.encounterDiscard || []
          state.encounterDiscard.push(code)
          api.info?.(`地图：弃掉探索牌库顶的诡计「${ALL_CARDS[code]?.nameZh || code}」。`)
        } else kept.push(code)
      }
      state.explorationDeck = shuffleWithApi(state, api, [...rest, ...kept])
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知久远腹地（下）行动：${move.rule}`)
  },

  actReveal(state, act, api) {
    const code = original(act)
    const entry = actRuleFor(code)
    if (entry?.onReveal) { entry.onReveal(state, act, api); return }
    if (code === '04213') {
      resolveGoingInCircles(state, api)
      return
    }
    if (code === '04214') {
      api.finish(recordsFor(state).theInvestigatorsRescuedAlejandro ? 'r1' : 'r2')
      return
    }
    throw new Error(`未知久远腹地（下）场景：${code}`)
  },

  agendaReveal(state, agenda, api) {
    const code = original(agenda)
    const entry = agendaRuleFor(code)
    if (entry?.onReveal) { entry.onReveal(state, agenda, api); return }
    if (code === '04211') {
      spawnHarbinger(state, api)
      return
    }
    throw new Error(`未知久远腹地（下）密谋：${code}`)
  },

  // 场景 2 目标：每位幸存调查员都在深入幽嘶，且该地点没有毁灭标记。
  checkObjectives(state, api) {
    encounterRules.checkObjectives?.(state, api)
    const act = state.acts?.[state.actIndex]
    if (original(act) !== '04214') return false
    const descent = locationById(state, 'descentToYoth')
    if (!descent) return false
    const alive = active(state)
    if (!alive.length) return false
    if (!alive.every(inv => inv.location === descent.id)) return false
    if ((descent.doom || 0) > 0) return false
    // 卡面是「你可以推进」：给出推进/再等等的选择，同一轮不重复询问。
    const flags = flagsFor(state)
    if (flags.descentOfferedRound === state.round) return false
    if (typeof api.choose === 'function') {
      const seat = alive.find(inv => inv.location === descent.id)?.seat ?? 0
      const answer = api.choose({
        kind: 'story', source: '04214', seat,
        prompt: '所有幸存调查员都在深入幽嘶，且此地没有毁灭标记。要推进场景吗？',
        options: [
          { id: 'advance', label: '推进场景（进入幽嘶的下一幕）' },
          { id: 'wait', label: '再等等（本轮不再询问）' },
        ],
      })
      flags.descentOfferedRound = state.round
      if (answer !== 'advance') return false
    }
    api.advanceAct()
    return true
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 有毒孢子：一轮结束时结算并弃掉。
    for (const location of state.locations) {
      for (const attachment of attachmentsWith(location, '04216').slice()) {
        resolvePoisonousSporesEnd(state, location, attachment, api)
      }
    }
    delete flagsFor(state).exploringSeat
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  storyResolutionKey(state, key) {
    return reachedResolutionKey(state, key)
  },

  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知久远腹地（下）结局')
    const records = recordsFor(state)
    // 结局 1／2：胜利区每有 1 点复仇，在「伊格之怒」下记 1 笔勾。
    const vengeance = vengeanceInVictory(state)
    if (vengeance > 0) records.yigsFury = yigsFuryOf(state) + vengeance
    // 预示者：在胜利区则划掉记录；留在场上／一边则记下它受到的伤害。
    if (flagsFor(state).harbingerSpawned) {
      const inVictory = (state.victoryDisplay || []).some(card => original(card) === HARBINGER)
      if (inVictory) {
        records.theHarbingerIsStillAlive = 0
      } else {
        const enemy = (state.enemies || []).find(entry => original(entry) === HARBINGER)
        const damage = enemy ? enemy.damageTaken : records.theHarbingerIsStillAlive
        records.theHarbingerIsStillAlive = Math.max(0, Number(damage || 0))
      }
    }
    return { award: true, bonus: 0 }
  },
}
