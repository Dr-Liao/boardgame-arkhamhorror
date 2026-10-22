import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { encounterRules } from '../../encounter-rules.js'
import { actRuleFor, agendaRuleFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { symbolConnections } from '../../card-data.js'
import {
  PLAYER_SET_ASIDE, POISON_CODE, CONDITIONAL_DECKS, ANCIENT_LOCATIONS, PRESENT_LOCATIONS,
  EXPLORATION_LOCATIONS, TEMPLO_MAYOR_IDS,
} from './definition.js'

// 权威来源：Arkham/Scenario/Scenarios/TheForgottenAge/TheBoundaryBeyond.hs、
// Arkham/Act|Agenda|Enemy|Treachery/Cards/.../TheBoundaryBeyond/*.hs。
//
// 地点替换（本章最核心的自定义机制）：印刷的 6 张现代地点是桌面上的「格位」；
// 12 张古代地点在探索成功（或 2b/2b 背面的强制换图）时覆盖到格位上，「取而代之」。
// 实现方式：把格位实例的卡面字段整体换成古代卡面（code/名字/帷幕/线索值/符号/
// 特性全部替换），id 保持不变，因此调查员、敌人、毁灭标记都不用移动，也不需要
// 重连 id；被盖住的现代卡面压进 location.underneath 栈，古代地点离场时再由
// unshiftSlot 复原。连线始终按「在场地点」的符号用 card-data 的 symbolConnections
// 重算，所以换成古代面后走的是古代地点的连接规则。
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const norm = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || []).map(norm)
const hasTrait = (card, trait) => traits(card).includes(norm(trait))
const isTenochtitlan = card => hasTrait(card, 'Tenochtitlan')
const isPresentDay = card => hasTrait(card, 'Present-Day')
const isAncient = card => hasTrait(card, 'Ancient')
const isPoisoned = inv => (inv?.threat || []).some(card => card.code === POISON_CODE) || inv?.poisoned === true

const TEMPLO_MAYOR_CODES = TEMPLO_MAYOR_IDS.map(id => ANCIENT_LOCATIONS[id].code)
const PADMA = '04186'
const SERPENT_OF_TENOCHTITLAN = '04187'
const HAND_OF_THE_BROTHERHOOD = '04188'
const WINDOW_TO_ANOTHER_TIME = '04189'
const TIMELINE_DESTABILIZATION = '04190'
const HARBINGER = '04062'
const RELIC_BASE = '04061'
const RELIC_FUTURE = '04191'

// 探索牌库里各放 1 张的诡计（Haskell 的 treacheries 列表）。
const EXPLORATION_TREACHERY_CODES = {
  windowToAnotherTime: '04189',
  timelineDestabilization: '04190',
  aTearInTime: '04090',
  lostInTime: '04091',
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

const definitionById = (state, id) => state.scenario.locations[id] || null
const ancientIdByCode = (state, code) => Object.keys(state.scenario.locations)
  .find(id => (state.scenario.locations[id].originalCode || state.scenario.locations[id].code) === code) || null
const symbolOf = definition => definition?.symbols?.front?.symbol || null
const clueValue = (state, definition) => definition.cluesFixed
  ?? (definition.cluesPerInvestigator || 0) * state.numInvestigators

function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  if (typeof helper?.random === 'function') return shuffleList(helper, list)
  return [...list]
}

function shuffleList(source, list) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(source.random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function shuffleIntoExploration(state, api, ids) {
  if (!ids.length) return
  state.explorationDeck = shuffleList(api, [...(state.explorationDeck || []), ...ids])
}

function distance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of state.locations.find(entry => entry.id === id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

// ---------------------------------------------------------------------------
// 地点替换
// ---------------------------------------------------------------------------

const FACE_FIELDS = [
  'code', 'originalCode', 'name', 'text', 'textEn', 'traits', 'traitsZh', 'subname', 'flavor',
  'shroud', 'cluesPerInvestigator', 'cluesFixed', 'victory', 'symbols', 'revealed', 'clues',
  'maxClues', 'doom', 'ruleId', 'identityStatus',
]

function faceSnapshot(location) {
  const snapshot = {}
  for (const key of FACE_FIELDS) {
    if (location[key] === undefined) continue
    snapshot[key] = structuredClone(location[key])
  }
  return snapshot
}

function updateConnections(state) {
  const wanted = symbolConnections(state.locations)
  for (const location of state.locations) location.connections = [...(wanted[location.id] || [])]
}

function shiftSlot(state, api, slotId, ancientId, explorer = null) {
  const index = state.locations.findIndex(location => location.id === slotId)
  const current = state.locations[index]
  const ancient = definitionById(state, ancientId)
  if (!current || !ancient) return null
  const clues = clueValue(state, ancient)
  const next = {
    ...structuredClone(ancient),
    id: slotId,
    revealed: true,
    clues,
    maxClues: clues,
    doom: current.doom || 0,
    underneath: [...(current.underneath || []), faceSnapshot(current)],
    shiftedRound: state.round,
    shiftedCode: ancient.originalCode || ancient.code,
  }
  if (current.attachments?.length) next.attachments = structuredClone(current.attachments)
  state.locations[index] = next
  updateConnections(state)
  api.info?.(`🕳️ 时间在「${current.name}」上折叠，「${next.name}」覆盖了这个位置。`)
  // 12 张古代地点的强制入场效果（P2）。只有「探索」带来的入场才有「你」，
  // 2b 的批量覆盖用 null。
  enterAncientFace(state, api, next, explorer)
  return next
}

function unshiftSlot(state, api, slotId) {
  const index = state.locations.findIndex(location => location.id === slotId)
  const current = state.locations[index]
  const stack = [...(current?.underneath || [])]
  if (!stack.length) return null
  const previous = stack.pop()
  const next = {
    ...structuredClone(previous),
    id: slotId,
    underneath: stack,
    doom: current.doom || 0,
    clues: previous.clues ?? 0,
    maxClues: previous.maxClues ?? 0,
  }
  if (current.attachments?.length) next.attachments = structuredClone(current.attachments)
  state.locations[index] = next
  updateConnections(state)
  api.info?.(`🕳️ 「${current.name}」离开，其下方的「${next.name}」重新取代了这个位置。`)
  return next
}

function addLocationToVictory(state, location) {
  state.victoryDisplay ||= []
  if (state.victoryDisplay.some(card => card.id === location.id)) return
  state.victoryDisplay.push({
    id: location.id,
    code: original(location),
    originalCode: original(location),
    name: location.name,
    victory: location.victory || 0,
    vengeance: 0,
    traits: [...(location.traits || [])],
    locationVictory: true,
  })
}

const tenochtitlanInPlay = state => state.locations.filter(isTenochtitlan)
const tenochtitlanInVictory = state => (state.victoryDisplay || []).filter(card => hasTrait(card, 'Tenochtitlan'))

// 把场上没有线索的特诺奇蒂特兰地点放进胜利区，并让被盖住的现代地点重新就位。
function sweepTenochtitlan(state, api, { onlyCleared = true } = {}) {
  for (const location of [...state.locations]) {
    if (!isTenochtitlan(location)) continue
    if (onlyCleared && (location.clues || 0) > 0) continue
    addLocationToVictory(state, location)
    if (location.underneath?.length) unshiftSlot(state, api, location.id)
  }
}

// 2b / 2b 背面：对每个在场的现代地点，从探索牌库找一张同符号的古代地点覆盖上去。
function shiftRemainingPresentDay(state, api, source = '04163') {
  for (const slot of [...state.locations]) {
    if (!isPresentDay(slot)) continue
    const symbol = symbolOf(slot)
    const matches = (state.explorationDeck || []).filter(entry => {
      const definition = definitionById(state, entry)
      return definition && symbolOf(definition) === symbol
    })
    if (!matches.length) {
      api.info?.(`🧭 探索牌库里已没有与「${slot.name}」同符号的古代地点。`)
      continue
    }
    const picked = matches.length === 1 ? matches[0] : (() => {
      const answer = api.choose({
        kind: 'location', source, seat: state.campaign.leadSeat,
        prompt: `探索牌库中有 ${matches.length} 张与「${slot.name}」同符号的古代地点，选择覆盖的那一张。`,
        options: matches.map(entry => ({
          id: entry, label: definitionById(state, entry)?.name || entry,
        })),
      })
      return matches.includes(answer) ? answer : matches[matches.length - 1]
    })()
    const deckIndex = state.explorationDeck.indexOf(picked)
    if (deckIndex >= 0) state.explorationDeck.splice(deckIndex, 1)
    shiftSlot(state, api, slot.id, picked)
  }
}

function loseAllClues(state) {
  for (const inv of active(state)) inv.clues = 0
  state.clues = 0
}

// 场景 2b / 密谋 2b 的背面都会「移除当前场景牌库与密谋牌库，把放在一边的场景 3a
// 与密谋 3a 放进场」。两个背面各自的调用方正在推进，所以只补上对侧的槽位：
//   - 场景 2b 触发时，引擎随后会把 actIndex 从 1 加到 2，因此不碰 actIndex；
//     密谋 3a 直接成为当前密谋（agendaIndex = 2）。
//   - 密谋 2b 触发时同理反过来：agendaIndex 由引擎加到 2，场景 3a 直接成为当前场景。
function enterFinalStage(state, api, { advanceAct = false, advanceAgenda = false } = {}) {
  const actThree = state.scenario.acts.find(card => original(card) === '04167')
  const agendaThree = state.scenario.agendas.find(card => original(card) === '04164')
  state.acts = [state.acts[0], state.acts[1], structuredClone(actThree)].filter(Boolean)
  state.agendas = [state.agendas[0], state.agendas[1], structuredClone(agendaThree)].filter(Boolean)
  // 新的密谋 3a 进场时从 0 点毁灭开始：不要带着旧密谋的毁灭开局（P2）。
  if (state.doom) {
    api.info?.(`🌑 旧密谋上剩余的 ${state.doom} 点毁灭被清除。`)
    state.doom = 0
  }
  if (advanceAgenda) {
    state.actIndex = 2
    api.info?.('📜 当前场景牌库被移除，「归家之旅」成为当前场景。')
  } else if (advanceAct) {
    state.agendaIndex = 2
    api.info?.('🌑 当前密谋牌库被移除，「时间坍塌」成为当前密谋。')
  }
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

function refreshSerpent(state, enemy) {
  if (original(enemy) !== SERPENT_OF_TENOCHTITLAN) return
  const location = state.locations.find(entry => entry.id === enemy.location)
  const armed = isAncient(location) && (location.clues || 0) > 0
  enemy.retaliate = armed
  enemy.alert = armed
  enemy.hunter = !armed
}

function readyHandAt(state, location) {
  return state.enemies.some(enemy => original(enemy) === HAND_OF_THE_BROTHERHOOD
    && !enemy.exhausted && (enemy.location === location.id || (location.connections || []).includes(enemy.location)))
}

function spawnPadma(state, api) {
  const slot = state.locations.find(location => TEMPLO_MAYOR_CODES.includes(original(location)))
    || state.locations.find(location => original(location) === PRESENT_LOCATIONS.templeRuins.code)
  if (!slot) return null
  const setAside = state.scenarioZones?.setAside || []
  const index = setAside.indexOf(PADMA)
  if (index >= 0) setAside.splice(index, 1)
  const padma = api.spawn(PADMA, slot.id)
  if (padma) {
    padma.health = 3 * state.numInvestigators
    padma.victory = 2
    padma.vengeance = 2
    padma.alert = true
    padma.retaliate = true
    padma.hunter = true
    state.scenarioFlags.padmaSpawned = true
    api.info?.(`🐍 帕德玛·阿姆丽塔在「${slot.name}」现身。`)
  }
  return padma
}

function farthestFromInvestigators(state) {
  const alive = active(state)
  if (!alive.length) return state.locations[0] || null
  let best = null
  let bestScore = -1
  for (const location of state.locations) {
    const score = Math.min(...alive.map(inv => distance(state, location.id, inv.location)))
    if (!Number.isFinite(score)) continue
    if (score > bestScore) {
      best = location
      bestScore = score
    }
  }
  return best
}

function spawnHarbinger(state, api) {
  const records = recordsFor(state)
  const damage = Number(records.theHarbingerIsStillAlive || 0)
  const lead = state.investigators[state.campaign?.leadSeat ?? 0] || active(state)[0]
  const target = Number(records.yigsFury || 0) >= 6
    ? (lead ? here(state, lead) : null)
    : farthestFromInvestigators(state)
  if (!target) return null
  const harbinger = api.spawn(HARBINGER, target.id)
  if (harbinger) {
    harbinger.damageTaken = damage
    state.scenarioFlags.harbingerEnteredPlay = true
    // 04162：预示者一旦进场就从「放在一边」移除（否则会被重复生成/统计）。
    const zones = (state.scenarioZones ||= {})
    zones.setAside = (zones.setAside || []).filter(code => code !== HARBINGER)
    api.info?.(`🐍 瓦卢西亚的预示者从裂缝中钻出，落在「${target.name}」${damage ? `（已带 ${damage} 点伤害）` : ''}。`)
  }
  return harbinger
}

// ---------------------------------------------------------------------------
// 探索
// ---------------------------------------------------------------------------

// 现代地点各自的「探索」行动（卡面文字逐条）：行动数、额外代价、前置检定。
const EXPLORE_SPECS = {
  '04168': { actions: 2, label: '探索（2 个行动）' },
  '04169': { actions: 1, label: '探索（需 6 张以上手牌）', requiresHand: 6 },
  '04170': { actions: 1, label: '探索（先检定意志 3）', test: { skill: 'willpower', difficulty: 3 } },
  '04171': { actions: 1, label: '探索（弃掉费用合计 5 以上的手牌）', discardCost: 5 },
  '04172': { actions: 1, label: '探索（花 3 资源）', resources: 3 },
  '04173': { actions: 1, label: '探索（受到 1 点伤害或恐惧）', harm: true },
}

const handCost = code => Number(ALL_CARDS[code]?.cost || 0)

function exploreUsable(state, inv, spec) {
  if (!spec) return false
  if (!(state.explorationDeck || []).length) return false
  if (encounterRules.canExplore(state, inv) === false) return false
  if (spec.requiresHand && (inv.hand || []).length < spec.requiresHand) return false
  if (spec.discardCost && (inv.hand || []).reduce((sum, code) => sum + handCost(code), 0) < spec.discardCost) return false
  if (spec.resources && (inv.resources || 0) < spec.resources) return false
  return true
}

// 探索不可用时的缺口文案；返回 null 表示可用。顺序与 exploreUsable 一致。
function exploreBlockReason(state, inv, spec) {
  if (!(state.explorationDeck || []).length) return '探索牌库已空'
  if (encounterRules.canExplore(state, inv) === false) return '当前不能探索'
  const hand = (inv.hand || []).length
  if (spec.requiresHand && hand < spec.requiresHand) return `需要至少 ${spec.requiresHand} 张手牌（当前 ${hand} 张）`
  if (spec.discardCost) {
    const total = (inv.hand || []).reduce((sum, code) => sum + handCost(code), 0)
    if (total < spec.discardCost) return `需要弃掉费用合计 ${spec.discardCost} 的手牌（当前合计 ${total}）`
  }
  if (spec.resources && (inv.resources || 0) < spec.resources) return `需要 ${spec.resources} 资源（当前 ${inv.resources || 0}）`
  return null
}

// 探索牌库抽牌：抽到同符号的古代地点就覆盖当前格位（成功的探索），异符号地点先
// 放到牌库旁继续抽，最后把放一旁的牌洗回探索牌库；抽到诡计时按遭遇牌结算。
function exploreFrom(state, inv, api) {
  const slot = here(state, inv)
  if (!slot) return null
  const symbol = symbolOf(slot)
  const aside = []
  let outcome = null
  while ((state.explorationDeck || []).length) {
    const entry = state.explorationDeck.pop()
    const definition = definitionById(state, entry)
    if (!definition) {
      state.encounterDeck.push(entry)
      outcome = { kind: 'treachery', code: entry }
      api.drawEncounter(inv.seat)
      break
    }
    if (symbolOf(definition) === symbol) {
      shiftSlot(state, api, slot.id, entry, inv)
      state.scenarioFlags.ancientPlacerSeat = inv.seat
      inv.tfaExploredThisTurn = true
      outcome = { kind: 'location', code: definition.originalCode || definition.code }
      break
    }
    aside.push(entry)
    api.info?.(`🧭 「${definition.name}」的符号与本地点不符，先放到探索牌库旁。`)
  }
  if (aside.length) {
    shuffleIntoExploration(state, api, aside)
    api.info?.(`🧭 ${aside.length} 张符号不符的地点洗回探索牌库。`)
  }
  if (!outcome) api.info?.('🧭 探索牌库已经空了。')
  return outcome
}

// ---------------------------------------------------------------------------
// 12 张古代地点的印刷效果（P2）
//
// 古代地点是覆盖在 6 个现代格位上的「面」，所以规则按地点卡实例的 originalCode
// 查表；id 仍是格位 id，调查员/敌人不需要移动。
// ---------------------------------------------------------------------------

const isWeaknessCode = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)

// 每场 / 每阶段 / 每轮「团队仅限一次」的标记。key 由效果自己给，scope 决定按轮还是按阶段。
function teamOnce(state, key, scope = 'phase') {
  const flags = state.scenarioFlags ||= {}
  const bucket = (flags.teamOnce ||= {})
  const tag = `${key}:${state.round}:${scope === 'round' ? 'r' : state.phase}`
  if (bucket[tag]) return false
  bucket[tag] = true
  return true
}

// 「发现本地点的 N 个线索」：从地点搬到调查员的线索池（与引擎调查成功同一口径）。
function discoverAt(state, api, inv, location, amount) {
  if (!inv || !location) return 0
  // 04186 帕德玛重整时，任何[[古代]]地点的线索均不能被发现（含地点卡自身的发现效果）。
  if (isAncient(location)
    && state.enemies.some(enemy => original(enemy) === PADMA && !enemy.exhausted)) return 0
  const found = Math.min(Math.max(0, amount), location.clues || 0)
  if (found <= 0) return 0
  location.clues -= found
  api.gainClues(inv.seat, found)
  notifyAncientLastClue(state, location, api)
  return found
}

function nearestEnemyTo(state, locationId) {
  const candidates = state.enemies.filter(enemy => !enemy.defeated)
  if (!candidates.length) return null
  return candidates.map(enemy => ({ enemy, steps: distance(state, locationId, enemy.location) }))
    .sort((left, right) => left.steps - right.steps)[0].enemy
}

function shuffleDeckWith(state, inv, api) {
  const random = () => api.random?.() ?? 0.5
  for (let index = inv.deck.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[inv.deck[index], inv.deck[target]] = [inv.deck[target], inv.deck[index]]
  }
}

const ANCIENT_STATIC = Object.freeze({
  // 04185 圣林：你位于此处时，打出每张卡牌的费用 +2（引擎读 loc.playCostIncrease）。
  '04185': { playCostIncrease: 2 },
})

// 入场强制效果。04174/04175 的「你」由 explorer 提供；批量覆盖时没有「你」。
const ANCIENT_ENTRY = {
  '04174'(state, api, location) {
    state.encounterDeck = shuffleList({ random: () => api.random?.() ?? 0.5 },
      [...(state.encounterDeck || []), ...(state.encounterDiscard || [])])
    state.encounterDiscard = []
    const discarded = []
    let found = null
    while (state.encounterDeck.length) {
      const code = state.encounterDeck.pop()
      if (hasTrait({ code }, 'Serpent')) { found = code; break }
      discarded.push(code)
    }
    state.encounterDiscard.push(...discarded)
    if (!found) { api.info?.('🗿 大神庙：遭遇牌库里没有蛇族敌人。'); return }
    const enemy = api.spawn(found, location.id)
    api.info?.(`🐍 大神庙：从遭遇牌库弃出「${enemy?.name || ALL_CARDS[found]?.nameZh || found}」，并在本地生成。`)
  },

  '04175'(state, api, location, explorer) {
    if (!explorer) { api.info?.('🗿 特诺奇蒂特兰神庙：这次入场没有可结算「你的牌库」的调查员。'); return }
    explorer.deck = [...(explorer.deck || []), ...(explorer.discard || [])]
    explorer.discard = []
    shuffleDeckWith(state, explorer, api)
    const discarded = []
    while (explorer.deck.length) {
      const code = explorer.deck.pop()
      if (isWeaknessCode(code)) {
        explorer.deck.push(code)
        api.drawCards(explorer.seat, 1)
        api.info?.(`🃏 特诺奇蒂特兰神庙：弃到弱点「${ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code}」并抽到它。`)
        break
      }
      discarded.push(code)
    }
    explorer.discard.push(...discarded)
  },

  '04176'(state, api, location) {
    for (const inv of active(state).filter(entry => entry.location === location.id)) api.directDamage(inv.seat, 1)
  },

  '04177'(state, api, location) {
    const enemy = nearestEnemyTo(state, location.id)
    if (!enemy) { api.info?.('🗿 特诺奇蒂特兰神庙：场上没有敌人，不放毁灭。'); return }
    api.doomOn?.(enemy, 1)
    api.info?.(`🌑 特诺奇蒂特兰神庙：在「${enemy.name}」上放置 1 个毁灭标记。`)
  },

  '04178'(state, api, location) {
    for (const inv of active(state).filter(entry => entry.location === location.id)) api.discardRandom(inv.seat, 2)
  },

  '04181'(state, api, location) {
    location.resources = (location.resources || 0) + 4
  },

  '04182'(state, api, location) {
    for (const inv of active(state).filter(entry => entry.location === location.id)) api.loseActions(inv.seat, 99)
  },

  '04183'(state, api, location) {
    for (const inv of active(state).filter(entry => entry.location === location.id)) api.directHorror(inv.seat, 1)
  },

  '04184'(state, api, location) {
    for (const inv of active(state).filter(entry => entry.location === location.id)) api.discardTop(inv.seat, 10)
  },
}

function enterAncientFace(state, api, location, explorer = null) {
  const code = original(location)
  const statics = ANCIENT_STATIC[code]
  if (statics) Object.assign(location, statics)
  const entry = ANCIENT_ENTRY[code]
  if (!entry) return
  entry(state, api, location, explorer)
  api.info?.(`🗿 「${location.name}」的入场强制效果已结算。`)
}

function brotherhoodHandBlocks(state, locationId) {
  const hand = state.enemies.find(enemy => original(enemy) === HAND_OF_THE_BROTHERHOOD
    && !enemy.exhausted && !enemy.defeated)
  if (!hand || hand.location == null) return false
  if (hand.location === locationId) return true
  const handLocation = state.locations.find(entry => entry.id === hand.location)
  const here = state.locations.find(entry => entry.id === locationId)
  return (handLocation?.connections || []).includes(locationId)
    || (here?.connections || []).includes(hand.location)
}

function notifyAncientLastClue(state, location, api) {
  if (!isAncient(location) || (location.clues || 0) > 0) return
  const hand = state.enemies.find(enemy => original(enemy) === HAND_OF_THE_BROTHERHOOD
    && !enemy.exhausted && !enemy.defeated)
  if (!hand) return
  hand.doom = (hand.doom || 0) + 1
  api.info?.(`🌑 古代地点的最后一个线索被发现：兄弟会之手上放置 1 个毁灭标记。`)
}

// 04174 的反应：在本地点击败或躲避蛇族后，发现本地点的 1 个线索（团队每阶段一次）。
function temploMayorReaction(state, api, enemy, seat) {
  if (!enemy || !hasTrait(enemy, 'Serpent')) return
  const location = state.locations.find(entry => entry.id === enemy.location)
  if (!location || original(location) !== '04174') return
  if (brotherhoodHandBlocks(state, location.id)) return
  if (!teamOnce(state, '04174clue')) return
  const inv = state.investigators[Number.isInteger(seat) ? seat : state.currentSeat]
  const found = discoverAt(state, api, inv, location, 1)
  if (found) api.info?.(`🏛️ 大神庙：${inv.name} 击败或躲避蛇族后发现了 ${found} 个线索。`)
}

// 第 92 轮：古代地点的 [action] 由地点条目 ancientAction 声明。
function ancientActions(state, inv, location) {
  const action = locationRuleFor(original(location))?.ancientAction
  if (!action?.available?.(state, inv, location)) return []
  return [{ action: 'scenarioAction', rule: 'ancientClue', label: action.label }]
}

function useAncientAction(state, inv, api, location, code) {
  return locationRuleFor(code)?.ancientAction?.perform?.(state, inv, api, location) === true
}

// 第 115 轮：幕后条目（04162/04163/04166）通过这个 hooks 对象调用本章的换图实现，
// 保证「时间线换图」只有一份实现（条目只编排顺序，不再复制 helper）。
function boundaryHooks(state, api) {
  return {
    sweep: options => sweepTenochtitlan(state, api, options),
    shiftPresentDay: source => shiftRemainingPresentDay(state, api, source),
    loseAllClues: () => loseAllClues(state),
    spawnPadma: () => spawnPadma(state, api),
    spawnHarbinger: () => spawnHarbinger(state, api),
    enterFinalStage: options => enterFinalStage(state, api, options),
    records: () => recordsFor(state),
  }
}

export function setupPlan(state, helper = {}) {
  const deck = mix(state, helper, [...EXPLORATION_LOCATIONS, ...Object.values(EXPLORATION_TREACHERY_CODES)])
  return {
    explorationDeck: deck,
    locations: [...EXPLORATION_LOCATIONS],
    treacheries: [...Object.values(EXPLORATION_TREACHERY_CODES)],
  }
}

function poisonedAlreadyInDecks(state) {
  let count = 0
  // 引擎里 campaign.investigators 是按座位索引的对象，测试夹具里可能是数组。
  for (const record of Object.values(state.campaign?.investigators || {})) {
    for (const code of record?.deck || []) if (code === POISON_CODE) count += 1
  }
  for (const inv of state.investigators || []) {
    for (const code of [...(inv.deck || []), ...(inv.discard || [])]) if (code === POISON_CODE) count += 1
    for (const threat of inv.threat || []) if (threat?.code === POISON_CODE) count += 1
  }
  return Math.min(4, count)
}

// 本章已经逐条实现印刷效果的遭遇卡（供迁移审计读取）。
export const implementedEncounterCodes = [
  PADMA, SERPENT_OF_TENOCHTITLAN, HAND_OF_THE_BROTHERHOOD, WINDOW_TO_ANOTHER_TIME, TIMELINE_DESTABILIZATION,
]

export const behavior = {
  ...encounterRules,
  id: 'theBoundaryBeyond',
  // 迁移审计从 behavior 对象上读取这份清单（tools/audit-tfa-scenarios.mjs）。
  implementedEncounterCodes,

  setupPlan,

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    state.scenarioFlags ||= {}
    state.scenarioFlags.firstAncientPlaced = false
    state.scenarioZones ||= {}
    state.scenarioZones.removed = []
    state.scenarioZones.explorationTreacheries = [...plan.treacheries]
    state.scenarioZones.setAside = [
      ...PLAYER_SET_ASIDE,
      ...Array(4 - poisonedAlreadyInDecks(state)).fill(POISON_CODE),
    ]
    if (Number(state.campaign.records?.theHarbingerIsStillAlive || 0) > 0) {
      state.scenarioZones.setAside.push(HARBINGER)
    }
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    state.locationVariants = {}
    // 场景 3a 与密谋 3a 放在一边；当前牌库只有 1a/2a。
    state.acts = state.scenario.acts.slice(0, 2).map(card => structuredClone(card))
    state.agendas = state.scenario.agendas.slice(0, 2).map(card => structuredClone(card))
    return Object.keys(PRESENT_LOCATIONS)
  },

  setupEnemies() {
    // 帕德玛、预示者都放在一边，开场没有敌人。
  },

  // 混乱袋建好之后才决定条件遭遇组（Haskell 先拿 chaosBagTokens 再 gather）：
  // 2 个以上 cultist → 兄弟会；2 个以上 tablet → 伊格之毒 + 时间守卫者；都不满足
  // → 兄弟会 + 时间守卫者。
  afterChaosBagSetup(state) {
    const bag = state.chaosBag?.length ? state.chaosBag : (state.campaign?.chaosBag || [])
    const count = token => bag.filter(value => value === token).length
    const cultist = count('cultist')
    const tablet = count('tablet')
    const groups = []
    const cards = []
    if (cultist >= 2) { groups.push('brotherhood'); cards.push(...CONDITIONAL_DECKS.brotherhood) }
    if (tablet >= 2) { groups.push('time'); cards.push(...CONDITIONAL_DECKS.time) }
    if (cultist < 2 && tablet < 2) { groups.push('fallback'); cards.push(...CONDITIONAL_DECKS.fallback) }
    state.scenarioZones ||= {}
    state.scenarioZones.conditionalGroups = groups
    if (!cards.length) return
    const rng = { random: () => randomValue(state) }
    state.encounterDeck = shuffleList(rng, [...state.encounterDeck, ...cards])
  },

  // 布置时的战役记录分支（Haskell 的 PreScenarioSetup）。
  preScenarioSetup(state, events, api) {
    const records = recordsFor(state)
    state.scenarioFlags ||= {}
    // 卡面：调查员从索卡洛广场或科约阿坎区开始——每位调查员各自选择。
    for (const inv of active(state)) {
      const answer = typeof api?.choose === 'function'
        ? api.choose({
          kind: 'location', source: '04161', seat: inv.seat,
          prompt: '选择你的起始地点（索卡洛广场或科约阿坎区）。',
          options: [
            { id: 'zocalo', label: '索卡洛广场' },
            { id: 'coyoacan', label: '科约阿坎区' },
          ],
        })
        : 'zocalo'
      inv.location = answer === 'coyoacan' ? 'coyoacan' : 'zocalo'
      api?.info?.(`📍 ${inv.name} 从「${inv.location === 'coyoacan' ? '科约阿坎区' : '索卡洛广场'}」开始。`)
    }
    let crossed = false
    // 卡面：任何一位带汽油的调查员都可以划掉 1 个汽油；多人都有时由玩家选。
    const gasolineHolders = active(state).filter(inv =>
      (state.campaign?.supplies?.[inv.seat] || []).includes('gasoline'))
    if (gasolineHolders.length) {
      let holder = gasolineHolders[0]
      if (gasolineHolders.length > 1 && typeof api?.choose === 'function') {
        const answer = api.choose({
          kind: 'investigator', source: '04161', seat: state.campaign?.leadSeat ?? 0,
          prompt: '选择一位调查员划掉自己的 1 个汽油。',
          options: gasolineHolders.map(inv => ({ id: String(inv.seat), label: inv.name })),
        })
        holder = gasolineHolders.find(inv => String(inv.seat) === String(answer)) || holder
      }
      crossed = api?.crossOffSupply?.(holder.seat, 'gasoline') || false
    }
    state.scenarioFlags.outOfGas = !crossed
    if (records.theInvestigatorsRescuedAlejandro) {
      for (const inv of state.investigators) inv.resources = (inv.resources || 0) + 2
      api?.info?.('亚历山卓的记述：每位调查员以额外 2 资源开始。')
    }
    if (!records.theInvestigatorsForgedABondWithIchtaca) {
      // 原卡：每位调查员起始手牌 -2。起始手牌已在 prepareInvestigator 抽好，
      // 这里把 2 张手牌放回牌库底以对齐数量（Haskell 的 StartingHand (-2)）。
      state.scenarioFlags.silentJourney = true
      for (const inv of state.investigators || []) {
        const returned = (inv.hand || []).splice(0, 2)
        if (!returned.length) continue
        inv.deck ||= []
        inv.deck.unshift(...returned)
      }
      api?.info?.('🌫️ 与伊塔卡没有纽带：每位调查员起始手牌 -2。')
    }
    if (state.scenarioFlags.outOfGas) {
      // 没有汽油：参考实现给每位调查员 CannotMulligan。
      for (const inv of active(state)) inv.cannotMulligan = true
      api?.info?.('⛽ 没有汽油：本场冒险不能重抽起始手牌。')
    }
    if (records.theInvestigatorsFoundTheMissingRelic) swapRelicOfAges(state, api)
    return { outOfGas: state.scenarioFlags.outOfGas }
  },

  // 本章的探索是各地点的「行动：探索」，通用探索行动一律不开放（古代地点不再有
  // 探索能力，覆盖之后符号也不再匹配）。
  canExplore() {
    return false
  },

  canGainResources(state, inv) {
    return original(here(state, inv)) !== '04172'
  },

  // 帕德玛处于重整状态时，古代地点的线索不能被探查。
  canDiscoverClues(state, inv) {    if (encounterRules.canDiscoverClues?.(state, inv) === false) return false
    const padma = state.enemies.some(enemy => original(enemy) === PADMA && !enemy.exhausted)
    return !(padma && isAncient(here(state, inv)))
  },

  // 引擎调查路径拿掉最后一个线索时也要通知（04188）。
  cluesRemoved(state, location, amount, api) {
    if ((amount || 0) > 0) notifyAncientLastClue(state, location, api)
  },

  actions(state, inv) {
    // 关键：恶蛇的关键词是持续效果（古代地点有线索 → 反击/警戒，否则猎手）。
    // 每次生成合法行动（玩家决策前）都重算一遍，避免只在 5 个时点更新。
    for (const enemy of state.enemies) refreshSerpent(state, enemy)
    const location = here(state, inv)
    if (!location) return []
    // 兄弟会之手处于重整状态时，其所在地点与连接地点的行动能力不能触发。
    if (readyHandAt(state, location)) return []
    const moves = []
    const code = original(location)
    const spec = EXPLORE_SPECS[code]
    if (spec) {
      moves.push({
        action: 'scenarioAction', rule: 'exploreHere', actions: spec.actions || 1,
        label: `🧭 ${spec.label}（探索牌库 ${state.explorationDeck.length} 张）`,
        // 条件不满足时仍列出来，让 AI 知道差什么（带 reason 的条目不进 legalMoves）。
        reason: exploreBlockReason(state, inv, spec),
      })
    }
    // 第 91 轮：04169 的特拉洛克大教堂行动在地点条目。
    locationRuleFor(code)?.actions?.({ state, inv, location, moves })
    // 12 张古代地点的 [action]（P2）。
    moves.push(...ancientActions(state, inv, location))
    return moves
  },

  // 12 张古代地点的常驻修正（P2）：帷幕、属性、敌人躲避。
  locationShroudModifier(state, location, inv = null) {
    const base = encounterRules.locationShroudModifier?.(state, location) || 0
    const who = inv || state.investigators?.[state.currentSeat] || null
    // 第 84 轮：六张古代地点的帷幕修正在地点条目 shroudModifier。
    const modifier = locationRuleFor(original(location))?.shroudModifier?.(state, location, who)
    return base + (modifier || 0)
  },

  statModifier(state, inv, skill) {
    const base = encounterRules.statModifier?.(state, inv, skill) || 0
    // 04179 查普尔特佩克山：位于此地的每位调查员 -2 意志。
    if (skill === 'willpower' && original(here(state, inv)) === '04179') return base - 2
    return base
  },

  enemyStatModifier(state, enemy, stat) {
    const base = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    // 04180 特诺奇蒂特兰运河：位于此地的每个敌人 +2 躲避值。
    const location = state.locations.find(entry => entry.id === enemy.location)
    if (stat === 'evade' && original(location) === '04180') return base + 2
    return base
  },

  // 04179 的反应：抽取一张巫术卡牌后发现本地点的 1 个线索（团队每阶段一次）。
  cardDrawn(state, inv, code, api) {
    encounterRules.cardDrawn?.(state, inv, code, api)
    if (original(here(state, inv)) !== '04179' || !hasTrait({ code }, 'Hex')) return
    if (brotherhoodHandBlocks(state, inv.location)) return
    if (!teamOnce(state, '04179clue')) return
    const found = discoverAt(state, api, inv, here(state, inv), 1)
    if (found) api.info?.(`🌿 查普尔特佩克山：${inv.name} 抽到巫术卡牌后发现了 ${found} 个线索。`)
  },

  // 04174 的反应：在本地点击败蛇族后，发现本地点的 1 个线索（团队每阶段一次）。
  enemyDefeated(state, enemy, api) {
    const replaced = encounterRules.enemyDefeated?.(state, enemy, api)
    temploMayorReaction(state, api, enemy, enemy.defeatedBy)
    return replaced
  },

  afterEvade(state, inv, enemy, result, api) {
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
    temploMayorReaction(state, api, enemy, inv?.seat)
  },

  performAction(state, inv, move, api) {
    const location = here(state, inv)
    const code = original(location)
    // 第 91 轮：地点条目先接管自己的场景行动。
    if (locationRuleFor(code)?.performAction?.(state, inv, move, api)) return
    if (move.rule === 'exploreHere') {
      const spec = EXPLORE_SPECS[code]
      if (!exploreUsable(state, inv, spec)) throw new Error('探索当前不可用')
      if (spec.discardCost) discardForCost(state, inv, spec.discardCost, api)
      if (spec.resources) {
        if ((inv.resources || 0) < spec.resources) throw new Error('资源不足')
        inv.resources -= spec.resources
        api.info?.(`💸 ${inv.name} 花费 ${spec.resources} 资源探索。`)
      }
      if (spec.harm) {
        const answer = api.choose({
          kind: 'harm', source: code, seat: inv.seat,
          prompt: '科约阿坎区：受到 1 点伤害或 1 点恐惧。',
          options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
        })
        if (answer === 'horror') api.horror(inv.seat, 1)
        else api.damage(inv.seat, 1)
      }
      if (spec.test) {
        api.test(inv.seat, spec.test.skill, spec.test.difficulty, result => {
          if (!result.success) {
            api.info?.('🧭 检定失败，本次探索没有翻开任何卡牌。')
            return
          }
          exploreFrom(state, inv, api)
        })
        return
      }
      exploreFrom(state, inv, api)
      return
    }
    if (move.rule === 'ancientClue') {
      const handled = useAncientAction(state, inv, api, location, code)
      if (!handled) throw new Error('这个行动现在不能结算')
      return
    }
    throw new Error(`未知界限彼端行动：${move.rule}`)
  },

  afterExplore(state, inv, context) {
    if (context?.kind === 'location') inv.tfaExploredThisTurn = true
  },

  // 查普尔特佩克公园的强制效果：在此地意志检定失败后受到 1 点恐惧。
  afterTest(state, inv, result, api) {
    tfaChaosAfterTest('theBoundaryBeyond', state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('theBoundaryBeyond', state, inv, token, api)
  },

  // ---- 幕 / 密谋 ----

  actReveal(state, act, api) {
    const code = original(act)
    // 第 115 轮：04165/04166/04167 的翻面效果在幕条目；条目通过 hooks 调用本章的换图实现。
    const entry = actRuleFor(code)?.onReveal
    if (entry) { entry(state, act, api, boundaryHooks(state, api)); return }
    throw new Error(`未知界限彼端场景：${code}`)
  },

  agendaReveal(state, agenda, api) {
    const code = original(agenda)
    // 第 115 轮：04162/04163/04164 的翻面效果在密谋条目。
    const entry = agendaRuleFor(code)?.onReveal
    if (entry) { entry(state, agenda, api, boundaryHooks(state, api)); return }
    throw new Error(`未知界限彼端密谋：${code}`)
  },

  checkObjectives(state, api) {
    const act = original(state.acts[state.actIndex])
    const flags = (state.scenarioFlags ||= {})
    if (act === '04165') {
      const placed = state.locations.some(location => isTenochtitlan(location))
      if (placed && !flags.firstAncientPlaced) {
        flags.firstAncientPlaced = true
        api.advanceAct()
      }
      return
    }
    if (act === '04166') {
      const cleared = tenochtitlanInPlay(state).filter(location => (location.clues || 0) === 0)
      if (cleared.length >= 6) api.advanceAct()
      return
    }
    if (act === '04167') {
      const padma = state.enemies.some(enemy => original(enemy) === PADMA)
      if (flags.padmaSpawned && !padma) api.advanceAct()
    }
  },

  // ---- 遭遇卡（本章五张） ----

  resolveEncounter(state, inv, t, api) {
    const code = original(t)
    if (code === WINDOW_TO_ANOTHER_TIME) {
      // 险境：把一张古代地点洗回探索牌库（其下方的现代地点取而代之），或
      // 在当前密谋上放置 1 点毁灭（可以导致密谋推进）。
      const ancients = state.locations.filter(location => isAncient(location) && location.underneath?.length)
      const options = [{ id: 'doom', label: '在当前密谋上放置 1 点毁灭' },
        ...ancients.map(location => ({ id: location.id, label: `把「${location.name}」洗回探索牌库` }))]
      const answer = api.choose({
        kind: 'treachery', source: code, seat: inv.seat, peril: true,
        prompt: '异时空之窗：选择一项。', options,
      })
      if (answer === 'doom') api.addDoom(1)
      else {
        const target = ancients.find(location => location.id === answer) || ancients[0]
        if (target) {
          const ancientCode = original(target)
          const ancientId = ancientIdByCode(state, ancientCode)
          unshiftSlot(state, api, target.id)
          if (ancientId) shuffleIntoExploration(state, api, [ancientId])
        } else {
          api.addDoom(1)
        }
      }
      return false
    }
    if (code === TIMELINE_DESTABILIZATION) {
      // 显现：检定意志，难度 1 + 场上每个古代地点、失败受到 1 伤害 1 恐惧并把
      // 本卡洗入探索牌库。
      const difficulty = 1 + state.locations.filter(isAncient).length
      let failed = false
      api.test(inv.seat, 'willpower', difficulty, result => {
        if (result.success) return
        failed = true
        api.damage(inv.seat, 1)
        api.horror(inv.seat, 1)
      })
      if (failed) {
        shuffleIntoExploration(state, api, [code])
        api.info?.('🕳️ 时间线失稳被洗回探索牌库。')
        return true
      }
      return false
    }
    return encounterRules.resolveEncounter(state, inv, t, api)
  },

  // ---- 敌人 ----

  // 04188 兄弟会之手：生成 - 任意无人地点（由抽到它的调查员选择）。
  spawnLocation(state, code, loc, engagedSeat, api) {
    if (original({ code }) !== HAND_OF_THE_BROTHERHOOD) return loc
    const empty = state.locations.filter(location =>
      !active(state).some(inv => inv.location === location.id))
    if (!empty.length) return null
    if (empty.length === 1) return empty[0].id
    const answer = api?.choose?.({
      kind: 'location', source: HAND_OF_THE_BROTHERHOOD, seat: engagedSeat ?? 0,
      prompt: '选择兄弟会之手的生成地点（必须是无人地点）。',
      options: empty.map(location => ({ id: location.id, label: location.name })),
    })
    return empty.find(location => location.id === answer)?.id || empty[0].id
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    refreshSerpent(state, enemy)
  },

  // 04062 瓦卢西亚的预示者由本章的 04162 生成：资源累积 / 遁去身影 / 横置反击
  // 都走共享解析器（P2，跨章一致）。
  enemyAttackedSuccessfully(state, inv, enemy, api) {
    return encounterRules.enemyAttackedSuccessfully?.(state, inv, enemy, api)
  },

  enemyMoved(state, enemy) {
    refreshSerpent(state, enemy)
  },

  beforeEnemyHarm(state, enemy, inv, harm, api) {
    return encounterRules.beforeEnemyHarm?.(state, enemy, inv, harm, api)
  },

  enemyAttackResolved(state, enemy, inv, api, attack) {
    encounterRules.enemyAttackResolved?.(state, enemy, inv, api, attack)
    const code = original(enemy)
    if (code === PADMA) {
      // 强制：帕德玛攻击你后，若有线索则把你的 1 个线索翻到毁灭面（放到所在地点，
      // 成为可见的地点毁灭标记），否则受到 3 点恐惧。
      if ((inv.clues || 0) > 0) {
        inv.clues -= 1
        const location = state.locations.find(entry => entry.id === inv.location)
        if (location) location.doom = (location.doom || 0) + 1
        api.info?.(`🌑 ${inv.name} 的 1 个线索被翻到毁灭面，放在「${location?.name || inv.location}」上。`)
      } else {
        api.horror(inv.seat, 3)
      }
    }
    if (code === SERPENT_OF_TENOCHTITLAN && (attack?.damage || 0) > 0 && !isPoisoned(inv)) {
      // 只有真的对调查员造成伤害才中毒（伤害被取消/被支援完全吸收时不触发）。
      const setAside = state.scenarioZones?.setAside || []
      const index = setAside.indexOf(POISON_CODE)
      if (index >= 0) setAside.splice(index, 1)
      api.poison(inv.seat)
    }
    delete enemy.tfaDealsDamage
  },

  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
    for (const enemy of state.enemies) refreshSerpent(state, enemy)
  },

  // 强制：古代地点的最后一个线索被探查后，处于重整状态的兄弟会之手放置 1 点毁灭。
  cluesRemoved(state, location, amount, api) {
    for (const enemy of state.enemies) refreshSerpent(state, enemy)
    if (!isAncient(location) || (location.clues || 0) > 0) return
    for (const hand of state.enemies.filter(enemy => original(enemy) === HAND_OF_THE_BROTHERHOOD && !enemy.exhausted)) {
      hand.doom = (hand.doom || 0) + 1
      api.info?.(`🌑 古代地点的最后一个线索被探查，兄弟会之手放置 1 点毁灭。`)
    }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    for (const enemy of state.enemies) refreshSerpent(state, enemy)
    // 04181 特诺奇蒂特兰运河：轮末弃掉本地点上的 1 个资源（帷幕随之下降）。
    for (const location of state.locations) {
      if (original(location) !== '04181' || (location.resources || 0) <= 0) continue
      location.resources -= 1
      api.info?.(`🌊 特诺奇蒂特兰运河：轮末弃掉 1 个资源（剩余 ${location.resources}，帷幕 +${location.resources}）。`)
    }
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  // ---- 结局 ----

  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知界限彼端结局')
    const records = recordsFor(state)
    // 游戏结束时仍是场景 2：把场上没有线索的特诺奇蒂特兰地点加入胜利区。
    if (state.actIndex === 1) sweepTenochtitlan(state, { info: () => {} }, { onlyCleared: true })
    const paths = tenochtitlanInVictory(state).length
    records.pathsAreKnownToYou = paths
    if (paths >= 3 && key === 'r1') records.ichtacaHasConfidenceInYou = true
    const vengeance = (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
    if (vengeance > 0) records.yigsFury = Number(records.yigsFury || 0) + vengeance
    if (state.scenarioFlags?.harbingerEnteredPlay) {
      const inVictory = (state.victoryDisplay || []).some(card => (card.originalCode || card.code) === HARBINGER)
      if (inVictory) {
        // 划掉「预示者还活着」：本战役记录是数字，0 表示已划掉。
        records.theHarbingerIsStillAlive = 0
      } else {
        const harbinger = state.enemies.find(enemy => original(enemy) === HARBINGER)
        records.theHarbingerIsStillAlive = harbinger
          ? Number(harbinger.damageTaken || 0)
          : Number(records.theHarbingerIsStillAlive || 0)
      }
    }
    api?.info?.(`已知 ${paths} 条道路；获得胜利点经验，并额外 ${paths} 点。`)
    return { award: true, bonus: paths }
  },
}

// 古代遗物：找到失落的遗物后，牌库里的《某种装置》版本换成《阻断未来》版本。
function swapRelicOfAges(state, api) {
  for (const inv of state.investigators) {
    for (const zone of ['deck', 'discard', 'hand']) {
      const index = (inv[zone] || []).indexOf(RELIC_BASE)
      if (index < 0) continue
      inv[zone][index] = RELIC_FUTURE
      api?.moveRelicOfAges?.({ code: RELIC_FUTURE, seat: inv.seat })
      api?.info?.('🏺 失落的遗物换成了《古代遗物（阻断未来）》。')
      return true
    }
    const asset = (inv.assets || []).find(entry => (entry.originalCode || entry.code) === RELIC_BASE)
    if (!asset) continue
    asset.code = RELIC_FUTURE
    asset.originalCode = RELIC_FUTURE
    api?.moveRelicOfAges?.({ code: RELIC_FUTURE, seat: inv.seat })
    return true
  }
  return false
}

// 索卡洛广场：弃掉费用合计至少 5 的手牌。为免每次探索都要逐张询问，按费用从高
// 到低自动弃牌凑够总额（玩家可以自己先弃牌来改变结果）。
function discardForCost(state, inv, required, api) {
  const remaining = [...(inv.hand || [])]
  let total = 0
  // 卡面：弃掉费用合计「至少」5 的手牌——由玩家逐张选择，而不是自动按费用降序弃到 7。
  while (total < required && remaining.length) {
    const options = remaining.map((code, index) => ({
      id: String(index), label: `${ALL_CARDS[code]?.nameZh || code}（费用 ${handCost(code)}）`,
    }))
    const answer = typeof api.choose === 'function'
      ? api.choose({
        kind: 'discard', source: '04171', seat: inv.seat,
        prompt: `弃掉费用合计至少 ${required} 的手牌（已选 ${total}）。`,
        options,
      })
      : '0'
    const picked = remaining[Number(answer)] || remaining[0]
    remaining.splice(remaining.indexOf(picked), 1)
    const index = inv.hand.indexOf(picked)
    if (index >= 0) inv.hand.splice(index, 1)
    inv.discard.push(picked)
    total += handCost(picked)
  }
  api.info?.(`💸 ${inv.name} 弃掉费用合计 ${total} 的手牌以探索索卡洛广场。`)
  return total
}
