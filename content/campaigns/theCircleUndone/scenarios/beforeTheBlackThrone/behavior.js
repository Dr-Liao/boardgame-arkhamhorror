// 《黑色王座》· 引擎钩子。
//
// 参考实现：Scenario/Scenarios/TheCircleUndone/BeforeTheBlackThrone.hs + Helpers.hs + Cosmos.hs。
// 关键近似（全部登记在 scenarioApproximations）：
//   · Cosmos 网格 → P2.13 地点牌库 + scenarioFlags.cosmosOrder 的「放置顺序 + 方向表」线性模型；
//     右/下接最近放置的地点，上接最早放置的地点，任意方向由玩家选；
//   · 虚空格子不建地点卡，只记 emptySpaceCount；
//   · 阿撒托斯不建场上敌人实体：毁灭记 scenarioFlags.azathothDoom，「攻击你」= 3 伤害 + 3 恐惧；
//   · 冒险参考卡资源记 scenarioFlags.referenceResources。
// 卡面规则写在各单卡条目的 actRule / agendaRule / locationRule.onEnter 数据里；
// 本文件只读 actRuleFor / agendaRuleFor 与引擎直读的 locationRule 分派，不含按卡号的规则分支。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor } from '../../../../../src/cards/card-rules.js'
import { buildScenarioLocationDeck } from '../../../../../src/engine/alt-decks.js'
import { encounterRules } from '../../encounter-rules.js'
import {
  A_WORLD_IN_DARKNESS, ACT_CODES, AZATHOTH, BLACK_THRONE, COSMIC_GATE, COSMIC_INGRESS, COSMOS_DECK_IDS,
  COURT, DAEMONIC_PIPING, DANCERS_MIST, FLIGHT, HIDEOUS_PALACE, INFINITY, MIND_DANCER, PATHWAY, PIPER,
  THE_END_IS_NIGH, ULTIMATE_CHAOS, WHISPERED_BARGAIN,
} from './definition.js'
import { azathothDoomOf, bbtChaosToken, skullX } from './chaos.js'

const original = card => card?.originalCode || card?.code
const active = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const flagsOf = state => (state.scenarioFlags ||= {})
const locationById = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locationByOriginal = (state, code) =>
  (state.locations || []).find(location => original(location) === String(code)) || null
const traitsOf = code => (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())
const hasTraitCode = (code, trait) => traitsOf(code).includes(String(trait).toLowerCase())
const isVoidLocation = location => hasTraitCode(original(location), 'Void')
const currentAgenda = state => (state.agendas || [])[state.agendaIndex] || null
const currentAct = state => (state.acts || [])[state.actIndex] || null
const leadSeat = state => state.campaign?.leadSeat ?? 0
const leadInvestigator = state => state.investigators?.[leadSeat(state)] || state.investigators?.[0]

function unique(list) {
  return [...new Set(list.filter(Boolean))]
}

function chooseOption(api, request) {
  if (typeof api.choose === 'function') return api.choose(request)
  return request.options[0]?.id
}

// ---------------------------------------------------------------------------
// 阿撒托斯计时（不在任何地点的「无所不能」存在）
// ---------------------------------------------------------------------------
export function azathothDoom(state) {
  return azathothDoomOf(state)
}

export function addAzathothDoom(state, api, amount = 1) {
  const value = Math.max(0, Math.floor(amount))
  if (!value) return azathothDoom(state)
  const flags = flagsOf(state)
  flags.azathothDoom = Number(flags.azathothDoom || 0) + value
  api.info?.(`🌌 在阿撒托斯上放置 ${value} 点毁灭（共 ${flags.azathothDoom} 点）。`)
  if (flags.azathothDoom >= 10) api.finish?.('r1')
  return flags.azathothDoom
}

export function azathothAttack(state, api, seat) {
  const inv = state.investigators?.[seat]
  if (!inv) return
  api.info?.(`💀 阿撒托斯攻击 ${inv.name}：受到 3 点伤害与 3 点恐惧。`)
  api.damage?.(seat, 3)
  api.horror?.(seat, 3)
}

// ---------------------------------------------------------------------------
// 宇宙：地点牌库 + 放置顺序/方向表
// ---------------------------------------------------------------------------
export function cosmosOrder(state) {
  const flags = flagsOf(state)
  flags.cosmosOrder ||= []
  return flags.cosmosOrder
}

export function placedCosmosIds(state) {
  return cosmosOrder(state).filter(id => !!locationById(state, id))
}

export function currentHubId(state) {
  const flags = state.scenarioFlags || {}
  // 幕推进时先更新 stageHub，再放新地点（引擎在 actReveal 之后才推进 actIndex）。
  if (flags.stageHub && locationById(state, flags.stageHub)) return flags.stageHub
  if ((state.actIndex || 0) >= 2) return BLACK_THRONE
  if ((state.actIndex || 0) === 1) return COURT
  return HIDEOUS_PALACE
}

function hubInPlay(state) {
  const hub = currentHubId(state)
  return locationById(state, hub) ? hub : (locationById(state, HIDEOUS_PALACE)?.id || COSMIC_GATE)
}

// 「宇宙 -」放置指令表：方向 → 候选连接点（线性近似）。
export function directionTargets(state, direction) {
  const placed = placedCosmosIds(state)
  if (!placed.length) return []
  if (direction === 'up') return [placed[0]]
  if (direction === 'down' || direction === 'right') return [placed[placed.length - 1]]
  return [...placed]
}

function canPayCost(state, seat, cost) {
  if (!cost) return false
  const inv = state.investigators?.[seat]
  if (!inv) return false
  if (cost.resources && (inv.resources || 0) < cost.resources) return false
  return true
}

function payCost(state, api, seat, cost) {
  const inv = state.investigators?.[seat]
  if (!inv || !cost) return false
  if (cost.resources) inv.resources = (inv.resources || 0) - cost.resources
  if (cost.damage) api.damage?.(seat, cost.damage)
  if (cost.horror) api.horror?.(seat, cost.horror)
  return true
}

// 放置一个宇宙地点：按卡面「宇宙 -」指令建立连接，写入放置顺序。
export function placeCosmosLocation(state, api, locationId, { seat = null } = {}) {
  const location = locationById(state, locationId)
  if (!location) return []
  const instruction = state.scenario.locations[locationId]?.cosmos || {}
  const direction = instruction.direction || 'any'
  const hub = hubInPlay(state)
  let targets = directionTargets(state, direction).slice(0, 1)
  const cost = instruction.cost
  const actingSeat = seat ?? state.currentSeat ?? leadSeat(state)
  if (cost && canPayCost(state, actingSeat, cost) && targets.length) {
    const answer = chooseOption(api, {
      kind: 'cosmos', source: `05325:${locationId}`, seat: actingSeat,
      prompt: `「${location.name}」的「宇宙 -」：按默认方向连接，或支付代价后与任意已放置地点连接。`,
      options: [
        { id: 'default', label: `按默认方向连接（${locationById(state, targets[0])?.name || targets[0]}）` },
        { id: 'pay', label: `支付代价（${cost.resources ? `${cost.resources} 资源` : cost.damage ? `${cost.damage} 伤害` : `${cost.horror} 恐惧`}），与任意已放置地点连接` },
      ],
    })
    if (answer === 'pay' && payCost(state, api, actingSeat, cost)) {
      const pool = unique([hub, ...placedCosmosIds(state)]).filter(id => locationById(state, id))
      const picked = pool.length > 1
        ? chooseOption(api, {
            kind: 'location', source: `05325:${locationId}`, seat: actingSeat,
            prompt: '选择连接的地点。', options: pool.map(id => ({ id, label: locationById(state, id).name })),
          })
        : pool[0]
      targets = [pool.includes(picked) ? picked : pool[0]].filter(Boolean)
    }
  } else if (direction === 'any' && targets.length > 1) {
    const picked = chooseOption(api, {
      kind: 'location', source: `05325:${locationId}`, seat: actingSeat,
      prompt: '「宇宙 -」：选择要连接的地点。',
      options: targets.map(id => ({ id, label: locationById(state, id).name })),
    })
    targets = [targets.includes(picked) ? picked : targets[0]]
  }
  const links = unique([hub, ...targets]).filter(id => id !== locationId && locationById(state, id))
  location.connections = unique([...(location.connections || []), ...links])
  for (const id of links) {
    const other = locationById(state, id)
    if (other) other.connections = unique([...(other.connections || []), locationId])
  }
  cosmosOrder(state).push(locationId)
  api.reveal?.(locationId)
  api.info?.(`✨ 「${location.name}」从宇宙中入场，连接到${links.map(id => `「${locationById(state, id).name}」`).join('、') || '（无）'}。`)
  return links
}

// 把地点从桌上收回宇宙牌库（虚空地点的行动 / 幕间清场）。
function returnLocationToCosmos(state, api, locationId, destinationId) {
  const location = locationById(state, locationId)
  if (!location) return false
  const destination = locationById(state, destinationId)
  if (destination) {
    for (const inv of active(state).filter(item => item.location === locationId)) {
      api.moveInvestigator?.(inv.seat, destinationId)
    }
    for (const enemy of (state.enemies || []).filter(item => item.location === locationId)) {
      api.moveEnemy?.(enemy, destinationId)
    }
  }
  api.remove?.(locationId)
  const order = cosmosOrder(state)
  const index = order.indexOf(locationId)
  if (index >= 0) order.splice(index, 1)
  api.cosmos?.({ shuffle: [locationId] })
  api.info?.(`🌀 「${location.name}」被洗回宇宙。`)
  return true
}

function rebuildForNextAct(state, api, { nextHub, drawCount, moveTo }) {
  // 清掉本幕的宇宙地点（洗回宇宙库），保留四个枢纽主链。
  for (const id of [...placedCosmosIds(state)]) returnLocationToCosmos(state, api, id, moveTo)
  flagsOf(state).cosmosOrder = []
  if (!locationById(state, nextHub)) {
    api.place?.(nextHub)
    const chain = nextHub === COURT ? [HIDEOUS_PALACE] : [COURT]
    const hub = locationById(state, nextHub)
    if (hub) hub.connections = unique([...(hub.connections || []), ...chain])
    for (const id of chain) {
      const other = locationById(state, id)
      if (other) other.connections = unique([...(other.connections || []), nextHub])
    }
    api.info?.(`📍 「${locationById(state, nextHub)?.name || nextHub}」进入游戏。`)
  }
  const drawn = api.cosmos ? api.cosmos({ draw: drawCount }) || [] : []
  for (const id of drawn) {
    api.place?.(id)
    placeCosmosLocation(state, api, id, { seat: leadSeat(state) })
  }
  for (const inv of active(state)) api.moveInvestigator?.(inv.seat, moveTo)
  const flags = flagsOf(state)
  flags.emptySpaceCount = Number(flags.emptySpaceCount || 0) + drawCount + 5
  flags.stageHub = nextHub
  api.info?.(`🌌 宇宙重新铺开：${drawn.length} 张新地点 + ${drawCount + 5} 个虚空格子（近似记账）。`)
}

// ---------------------------------------------------------------------------
// 秘仪：议程推进时弃掉全部异教徒敌人并把其毁灭移到阿撒托斯
// ---------------------------------------------------------------------------
export function commitRitualSuicide(state, api) {
  const cultists = (state.enemies || []).filter(enemy => hasTraitCode(original(enemy), 'Cultist'))
  let doom = 0
  for (const enemy of cultists) {
    doom += Number(enemy.doom || 0)
    if (typeof api.discardEnemy === 'function') api.discardEnemy(enemy)
    else {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
    }
  }
  if (cultists.length) api.info?.(`🔪 弃掉 ${cultists.length} 个异教徒敌人，把 ${doom} 点毁灭移到阿撒托斯。`)
  if (doom > 0) addAzathothDoom(state, api, doom)
  return { count: cultists.length, doom }
}

function drawSpecificEncounter(state, api, seat, code) {
  const deck = state.encounterDeck || []
  const index = deck.lastIndexOf(code)
  if (index < 0) {
    api.info?.(`遭遇牌库中没有「${ALL_CARDS[code]?.nameZh || code}」。`)
    return false
  }
  deck.splice(index, 1)
  deck.push(code)
  api.drawEncounter?.(seat)
  return true
}

// ---------------------------------------------------------------------------
// 诡计
// ---------------------------------------------------------------------------
const AZATHOTH_ATTACK_OPTIONS = [{ id: 'attack', label: '阿撒托斯攻击你' }]

function resolveUltimateChaos(state, inv, api) {
  if (typeof api.test !== 'function') return false
  api.test(inv.seat, 'willpower', 4, result => {
    if (result?.success) return
    const failedBy = Math.max(0, Number(result.difficulty || 4) - Number(result.value || 0))
    const flags = flagsOf(state)
    flags.ultimateChaos = Number(flags.ultimateChaos || 0) + 1
    api.info?.(`「究极混沌」附属到阿撒托斯上（${flags.ultimateChaos}/3）。`)
    if (failedBy >= 2) {
      api.damage?.(inv.seat, 1)
      api.horror?.(inv.seat, 1)
    }
    if (failedBy >= 3) flags.pendingSurge = true
    if (flags.ultimateChaos >= 3) {
      flags.ultimateChaos = 0
      const answer = chooseOption(api, {
        kind: 'treachery', source: ULTIMATE_CHAOS, seat: inv.seat,
        prompt: '3 张「究极混沌」被弃掉：在阿撒托斯上放 1 毁灭，或阿撒托斯按顺序攻击每位调查员。',
        options: [{ id: 'doom', label: '在阿撒托斯上放 1 点毁灭' }, { id: 'attack', label: '阿撒托斯攻击每位调查员' }],
      })
      if (answer === 'doom') addAzathothDoom(state, api, 1)
      else for (const target of active(state)) azathothAttack(state, api, target.seat)
    }
  }, 0, { code: ULTIMATE_CHAOS })
  return false
}

function resolveWhisperedBargain(state, inv, api) {
  const answer = chooseOption(api, {
    kind: 'treachery', source: WHISPERED_BARGAIN, seat: inv.seat,
    prompt: '「耳语契约」：在阿撒托斯上放 1 毁灭，或阿撒托斯攻击你。',
    options: [{ id: 'doom', label: '在阿撒托斯上放 1 点毁灭' }, ...AZATHOTH_ATTACK_OPTIONS],
  })
  if (answer === 'attack') azathothAttack(state, api, inv.seat)
  else addAzathothDoom(state, api, 1)
  return false
}

function resolveEndIsNigh(state, inv, api) {
  const x = currentAgenda(state) ? state.agendaIndex + 1 : 4
  if (typeof api.test !== 'function') return false
  api.test(inv.seat, 'willpower', 1 + x, result => {
    if (result?.success) return
    const cultists = (state.enemies || []).filter(enemy => hasTraitCode(original(enemy), 'Cultist'))
    let moved = 0
    for (const enemy of cultists) {
      moved += Number(enemy.doom || 0)
      enemy.doom = 0
    }
    if (moved > 0) addAzathothDoom(state, api, moved)
    else addAzathothDoom(state, api, 1)
  }, 0, { code: THE_END_IS_NIGH })
  return false
}

function discardOneFromHand(state, inv, api, source) {
  if (!(inv.hand || []).length) return null
  let index = 0
  if (typeof api.choose === 'function') {
    const answer = api.choose({
      kind: 'card', source, seat: inv.seat, prompt: '选择并弃掉 1 张手牌。',
      options: inv.hand.map((code, position) => ({ id: String(position), label: ALL_CARDS[code]?.nameZh || code })),
    })
    index = Number(answer)
    if (!Number.isInteger(index) || index < 0 || index >= inv.hand.length) index = 0
  }
  const [code] = inv.hand.splice(index, 1)
  ;(inv.discard ||= []).push(code)
  return code
}

function resolveWorldInDarkness(state, inv, api) {
  const doom = azathothDoom(state)
  if (doom === 0) {
    flagsOf(state).pendingSurge = true
    api.info?.('「黑暗世界」：阿撒托斯上没有毁灭，获得涌动。')
    return false
  }
  for (let index = 0; index < doom; index++) {
    const options = [
      { id: 'resource', label: '失去 1 点资源' },
      { id: 'hand', label: '选择并弃掉 1 张手牌' },
      { id: 'horror', label: '受到 1 点恐惧' },
      { id: 'damage', label: '受到 1 点伤害' },
    ]
    const answer = chooseOption(api, {
      kind: 'treachery', source: A_WORLD_IN_DARKNESS, seat: inv.seat,
      prompt: `「黑暗世界」：阿撒托斯上每点毁灭选一项（${index + 1}/${doom}）。`, options,
    })
    if (answer === 'resource') inv.resources = Math.max(0, (inv.resources || 0) - 1)
    else if (answer === 'hand') discardOneFromHand(state, inv, api, A_WORLD_IN_DARKNESS)
    else if (answer === 'horror') api.horror?.(inv.seat, 1)
    else api.damage?.(inv.seat, 1)
  }
  return false
}

const TREACHERY_RESOLVERS = Object.freeze({
  [ULTIMATE_CHAOS]: resolveUltimateChaos,
  [WHISPERED_BARGAIN]: resolveWhisperedBargain,
  [THE_END_IS_NIGH]: resolveEndIsNigh,
  [A_WORLD_IN_DARKNESS]: resolveWorldInDarkness,
})

// ---------------------------------------------------------------------------
// 幕/议程推进：数据在单卡条目的 actRule.advance / agendaRule.advance 里，
// 这里只按数据类型分派（rebuild / resolutionChoice / ritualSuicide / ...），无卡号分支。
// ---------------------------------------------------------------------------
function actRevealFor(state, act, api) {
  const advance = actRuleFor(String(original(act)))?.advance
  if (!advance) return
  if (advance.rebuild) {
    rebuildForNextAct(state, api, advance.rebuild)
    return
  }
  if (advance.resolutionChoice) resolveActThreeAdvance(state, api)
}

// 必竟之事背面：按 Memento/记录选择 R2 / R3 / R4；R4 再选 R5 或 R1。
function resolveActThreeAdvance(state, api) {
  const records = recordsFor(state)
  const mementos = new Set(records.mementosDiscovered || [])
  const accepted = [records.youHaveAcceptedYourFate === true,
    mementos.has('mesmerizingFlute'), mementos.has('ritualComponents')].filter(Boolean).length
  const rejected = [records.youHaveRejectedYourFate === true,
    mementos.has('scrapOfTornShadow'), mementos.has('wispOfSpectralMist')].filter(Boolean).length
  const options = []
  if (accepted >= 2) options.push({ id: 'r2', label: '结局 2（你接受了自己的命运）' })
  if (rejected >= 2) options.push({ id: 'r3', label: '结局 3（你拒绝了自己的命运）' })
  options.push({ id: 'r4', label: '结局 4（翻开黑书）' })
  const answer = chooseOption(api, {
    kind: 'story', source: String(original(currentAct(state))), seat: leadSeat(state),
    prompt: '「必竟之事」：选择要结算的结局。', options,
  })
  if (answer === 'r2' || answer === 'r3') {
    api.finish?.(answer)
    return
  }
  const picked = chooseOption(api, {
    kind: 'story', source: String(original(currentAct(state))), seat: leadSeat(state),
    prompt: '你必须在阿撒托斯的黑书上签名，或者拒绝。',
    options: [{ id: 'r5', label: 'It must be done.（签名 → 结局 5）' }, { id: 'r1', label: 'I refuse.（拒绝 → 结局 1）' }],
  })
  api.finish?.(picked === 'r5' ? 'r5' : 'r1')
}

function agendaRevealFor(state, agenda, api) {
  const advance = agendaRuleFor(String(original(agenda)), state.scenario.id)?.advance
  if (!advance) return
  const lead = leadInvestigator(state)
  if (advance.ritualSuicide) commitRitualSuicide(state, api)
  if (advance.daemonicPiping && lead) drawSpecificEncounter(state, api, lead.seat, DAEMONIC_PIPING)
  const mementos = new Set(recordsFor(state).mementosDiscovered || [])
  if (advance.skipMemento && mementos.has(advance.skipMemento)) return
  if (advance.moveLeft) {
    // 命运之轮·X 背面：每人在宇宙中向左移动一次，或把所在地点向左移动一次。
    for (const inv of active(state)) {
      const order = placedCosmosIds(state)
      const index = order.indexOf(inv.location)
      if (index < 0) continue
      const options = []
      if (index > 0) options.push({ id: 'moveLeft', label: '移动到左侧的宇宙地点' })
      options.push({ id: 'moveLocationLeft', label: '把所在地点向左移动一次' })
      const answer = chooseOption(api, {
        kind: 'agenda', source: String(original(agenda)), seat: inv.seat,
        prompt: '「命运之轮·X」：在宇宙中向左移动，或把你的地点向左移动一次。', options,
      })
      if (answer === 'moveLeft' && index > 0) {
        api.moveInvestigator?.(inv.seat, order[index - 1])
      } else if (index > 0) {
        ;[order[index - 1], order[index]] = [order[index], order[index - 1]]
        api.info?.(`↔️ 「${locationById(state, inv.location)?.name || inv.location}」向左移动一格。`)
      }
    }
    return
  }
  for (const test of advance.tests || []) {
    for (const inv of active(state)) {
      api.test?.(inv.seat, test.skill, test.difficulty, result => {
        if (result?.success) return
        const fail = test.fail || {}
        if (fail.damage) api.damage?.(inv.seat, fail.damage)
        if (fail.horror) api.horror?.(inv.seat, fail.horror)
      }, 0, { code: String(original(agenda)) })
    }
  }
  if (advance.removeDoomMemento && mementos.has(advance.removeDoomMemento)) {
    const flags = flagsOf(state)
    flags.azathothDoom = Math.max(0, Number(flags.azathothDoom || 0) - 1)
    api.info?.(`🌽 「${advance.removeDoomMemento}」让阿撒托斯失去 1 点毁灭。`)
  }
  if (advance.discardSelf) api.info?.('⏳ 最后的倒计时被弃掉——此后毁灭将直接落在阿撒托斯上。')
}

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
function refillClues(state, api, locationId, target) {
  const location = locationById(state, locationId)
  if (!location) return
  const wanted = Math.max(0, target)
  if ((location.clues || 0) < wanted) {
    location.clues = wanted
    api.info?.(`🔍 「${location.name}」的线索补至 ${wanted}。`)
  }
}

function distanceBetween(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of locationById(state, id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

function spawnLocationFor(state, code) {
  if (code !== MIND_DANCER) return null
  const pool = state.locations || []
  if (!pool.length) return null
  const investigators = active(state)
  if (!investigators.length) return pool[pool.length - 1].id
  // 近似「最远的虚空格子」：离所有调查员最远的在场地点。
  let best = null
  let bestDistance = -1
  for (const location of pool) {
    const distance = Math.min(...investigators.map(inv => distanceBetween(state, inv.location, location.id)))
    if (Number.isFinite(distance) && distance > bestDistance) {
      bestDistance = distance
      best = location
    }
  }
  return best?.id || null
}

const LOCATION_ACTIONS = {
  [COSMIC_GATE]: {
    actions: (state, inv, location) => {
      if (inv.location !== location.id || Number(flagsOf(state).referenceResources || 0) < 1) return []
      const voids = (state.locations || []).filter(candidate =>
        candidate.id !== location.id && isVoidLocation(candidate))
      if (!voids.length) return []
      return [{
        rule: 'gateMove', label: '🚪 移除冒险参考卡 1 资源：把宇宙门扉的调查员移到任意其他虚空地点',
      }]
    },
    perform: (state, inv, api, location) => {
      if (Number(flagsOf(state).referenceResources || 0) < 1) return
      flagsOf(state).referenceResources -= 1
      const voids = (state.locations || []).filter(candidate =>
        candidate.id !== location.id && isVoidLocation(candidate))
      if (!voids.length) return
      const picked = chooseOption(api, {
        kind: 'location', source: COSMIC_GATE, seat: inv.seat,
        prompt: '选择要移动到的其他虚空地点。',
        options: voids.map(candidate => ({ id: candidate.id, label: candidate.name })),
      })
      const destination = voids.find(candidate => candidate.id === picked) || voids[0]
      for (const target of active(state).filter(candidate => candidate.location === location.id)) {
        api.moveInvestigator?.(target.seat, destination.id)
      }
      api.info?.(`🚪 宇宙门扉把调查员送到「${destination.name}」。`)
    },
  },
}

function moveLocationInOrder(state, api, locationId, offset, source) {
  const order = cosmosOrder(state)
  const index = order.indexOf(locationId)
  if (index < 0) return false
  const target = index + offset
  if (target < 0 || target >= order.length) {
    api.info?.('已经到宇宙的尽头，无法再移动。')
    return false
  }
  if (Number(flagsOf(state).referenceResources || 0) < 1) {
    api.info?.('冒险参考卡上没有资源可移除。')
    return false
  }
  flagsOf(state).referenceResources -= 1
  ;[order[index], order[target]] = [order[target], order[index]]
  const flags = flagsOf(state)
  flags.teamUsed ||= {}
  flags.teamUsed[`${source}:${locationId}`] = true
  api.info?.(`↔️ 「${locationById(state, locationId)?.name || locationId}」在宇宙中移动一格（${source}）。`)
  return true
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
function readInvestigatorDefeat(state, api) {
  const defeated = state.investigators.filter(inv => inv.defeated && !inv.resigned)
  for (const inv of defeated) {
    api.info?.(`💀 ${inv.name} 被击败：坐骑没有接住你，你坠入无尽虚空（近似：追加 1 点精神创伤）。`)
    api.trauma?.(inv.seat, 'mental', 1)
  }
  return defeated
}

function applyResolution(state, key, events, api) {
  const known = ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6']
  if (!known.includes(key)) throw new Error(`未知黑色王座结局：${key}`)
  const records = recordsFor(state)
  if (key === 'noResolution') return applyResolution(state, 'r1', events, api)
  if (key === 'r1') {
    records.azathothDevouredTheUniverse = true
    state.campaign.failed = true
    for (const inv of state.investigators) {
      const record = state.campaign.investigators?.[inv.seat]
      if (record) record.status = 'killed'
    }
    api.info?.('💀 阿撒托斯吞食了宇宙。')
    return { award: false, bonus: 0 }
  }
  readInvestigatorDefeat(state, api)
  if (key === 'r2') {
    records.theLeadInvestigatorHasJoinedThePipersOfAzathoth = true
    records.azathothSlumbersForNow = true
    // 参考实现的 drivenInsane(lead) 会改写战役记录状态；这里用日志 + 2 点精神创伤近似。
    const lead = leadInvestigator(state)
    if (lead) api.info?.(`🎼 队长 ${lead.name} 加入了阿撒托斯的吹笛人，陷入疯狂。`)
    for (const inv of state.investigators) api.trauma?.(inv.seat, 'mental', 2)
    return { award: true, bonus: 5 }
  }
  if (key === 'r3') {
    records.azathothSlumbersForNow = true
    for (const inv of state.investigators) api.trauma?.(inv.seat, 'physical', 2)
    return { award: true, bonus: 5 }
  }
  if (key === 'r4') {
    const answer = chooseOption(api, {
      kind: 'story', source: '05331', seat: leadSeat(state),
      prompt: '你必须在黑书上签名，或者拒绝。',
      options: [{ id: 'r5', label: 'It must be done.' }, { id: 'r1', label: 'I refuse.' }],
    })
    return applyResolution(state, answer === 'r5' ? 'r5' : 'r1', events, api)
  }
  if (key === 'r5') {
    records.theInvestigatorsSignedTheBlackBookOfAzathoth = true
    records.azathothSlumbersForNow = true
    for (const inv of state.investigators) {
      api.trauma?.(inv.seat, 'physical', 2)
      api.trauma?.(inv.seat, 'mental', 2)
    }
    return { award: true, bonus: 10 }
  }
  records.theInvestigatorsReversedTheIncantation = true
  records.azathothSlumbersForNow = true
  for (const inv of state.investigators) {
    api.trauma?.(inv.seat, 'physical', 1)
    api.trauma?.(inv.seat, 'mental', 1)
  }
  return { award: true, bonus: 5 }
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------
export const implementedEncounterCodes = [
  AZATHOTH, MIND_DANCER, ULTIMATE_CHAOS, WHISPERED_BARGAIN, THE_END_IS_NIGH, A_WORLD_IN_DARKNESS,
]

export const behavior = {
  ...encounterRules,
  id: 'beforeTheBlackThrone',
  implementedEncounterCodes,
  // 供测试/其他章节复用的纯钩子（不是引擎钩子）。
  addAzathothDoom,
  azathothAttack,
  commitRitualSuicide,
  placeCosmosLocation,
  directionTargets,
  placedCosmosIds,
  cosmosOrder,
  currentHubId,
  azathothDoom,

  // ---- 布置 ----
  startLocation: () => COSMIC_INGRESS,

  setupLocations(state, events, helper = {}) {
    const flags = flagsOf(state)
    const records = recordsFor(state)
    flags.pathWinds = Number(records.thePathWindsBeforeYou || 0)
    flags.referenceResources = flags.pathWinds
    flags.azathothDoom = 0
    flags.emptySpaceCount = 6
    flags.cosmosOrder = []
    flags.ultimateChaos = 0
    flags.pendingSurge = false
    flags.teamUsed = {}
    flags.stageHub = HIDEOUS_PALACE
    // 宇宙牌库：12 张地点（按印刷张数展开成 16 个地点 id 中的 12 个）。
    // 引擎 setup 的 helper 是 { randomValue(state), shuffle(list, rng), info }：randomValue 必须带 state。
    buildScenarioLocationDeck(state, 'cosmos', COSMOS_DECK_IDS, {
      shuffle: list => (helper.shuffle
        ? helper.shuffle([...list], () => helper.randomValue(state))
        : [...list]),
    })
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      state.scenario.locations[COURT]?.originalCode,
      state.scenario.locations[BLACK_THRONE]?.originalCode,
      PIPER,
    ].filter(Boolean)
    state.scenarioZones.removed = []
    flags.usedLocations = []
    return [COSMIC_INGRESS, HIDEOUS_PALACE]
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    actRevealFor(state, act, api)
  },

  agendaReveal(state, agenda, api) {
    agendaRevealFor(state, agenda, api)
  },

  checkObjectives(state, api) {
    if (String(original(currentAct(state))) !== '05331') return
    const lead = leadInvestigator(state)
    const throne = locationById(state, BLACK_THRONE)
    if (lead && throne && lead.location === BLACK_THRONE && (throne.clues || 0) === 0) api.advanceAct?.()
  },

  // 没有议程时，神话阶段的毁灭直接落到阿撒托斯上（引擎先加 state.doom 再通知）。
  doomPlaced(state, payload, api) {
    if (!payload || !payload.agenda || payload.target) return
    if (currentAgenda(state)) return
    const amount = Math.max(0, Number(payload.amount) || 0)
    if (!amount) return
    state.doom = Math.max(0, Number(state.doom || 0) - amount)
    addAzathothDoom(state, api, amount)
  },

  // ---- 地点 ----
  // 进入效果写在单卡条目的 locationRule.onEnter.effect 里（引擎直读，同 02132 等核心卡），
  // 剧本不再写代码分支：05339 花线索/恐惧、05340 弃牌/伤害、05336 舞者之雾反应。

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    refillClues(state, api, COSMIC_INGRESS, 3)
    refillClues(state, api, HIDEOUS_PALACE, 4)
    refillClues(state, api, COURT, 6)
  },

  // 黑色王座：隐藏值 + ceil(阿撒托斯毁灭 / 2)（比较 definition 声明的地点 id，不比较卡号）。
  locationShroudModifier(state, location) {
    if (location?.id !== BLACK_THRONE) return 0
    return Math.ceil(azathothDoom(state) / 2)
  },

  hauntedScript(state, payload, api) {
    if (payload?.scriptId !== 'blackThroneHaunt') return false
    const inv = payload.investigator
    const answer = chooseOption(api, {
      kind: 'haunted', source: '05335', seat: payload.seat,
      prompt: '黑色王座闹鬼：在阿撒托斯上放 1 点毁灭，或阿撒托斯攻击你。',
      options: [{ id: 'doom', label: '在阿撒托斯上放 1 点毁灭' }, ...AZATHOTH_ATTACK_OPTIONS],
    })
    if (answer === 'attack') azathothAttack(state, api, inv.seat)
    else addAzathothDoom(state, api, 1)
    return true
  },

  // ---- 敌人 ----
  spawnLocation(state, code) {
    return spawnLocationFor(state, code)
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token, api) {
    const result = bbtChaosToken(state, inv, token)
    if (!result) return null
    if (result.azathothIfZeroSkill && Number(state.skillTest?.value ?? 1) === 0) {
      addAzathothDoom(state, api, 1)
    }
    return {
      delta: result.delta,
      ...(result.drawAnother ? { drawAnother: true } : {}),
      ...(result.onFail ? { onFail: result.onFail } : {}),
    }
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    const tokens = (result?.drawn || []).filter(token => !(result?.cancelledTokens || []).includes(token))
    if (result?.success === false && tokens.includes('tablet')) azathothAttack(state, api, inv.seat)
  },

  encounterGainsSurge(state) {
    if (flagsOf(state).pendingSurge) {
      flagsOf(state).pendingSurge = false
      return true
    }
    return false
  },

  // ---- 诡计 ----
  resolveEncounter(state, inv, treachery, api) {
    const code = String(original(treachery))
    const resolver = TREACHERY_RESOLVERS[code]
    if (resolver) return resolver(state, inv, api)
    return encounterRules.resolveEncounter?.(state, inv, treachery, api) ?? false
  },

  // ---- 玩家行动 ----
  actions(state, inv) {
    const moves = [...(encounterRules.actions?.(state, inv) || [])]
    const actCode = String(original(currentAct(state)))
    // 三张幕都印 [action]：花费 X 个线索 → 抽取宇宙顶 X 张，选 1 按「宇宙 -」放置并移动过去。
    if (ACT_CODES.includes(actCode) && (inv.clues || 0) >= 1) {
      moves.push({
        action: 'scenarioAction', rule: 'actCosmosTake',
        label: `🌌 花费 X 个线索：抽取宇宙顶 X 张，选 1 张按「宇宙 -」放置并移动过去（现有线索 ${inv.clues}）`,
      })
    }
    const here = locationById(state, inv.location)
    if (!here) return moves
    // 每个虚空地点获得「洗入宇宙并搬到枢纽」的行动。
    if (isVoidLocation(here)) {
      for (const hubId of [COSMIC_INGRESS, HIDEOUS_PALACE, COURT, BLACK_THRONE]) {
        const hub = locationById(state, hubId)
        if (!hub) continue
        moves.push({
          action: 'scenarioAction', locationId: here.id, rule: `voidTo:${hubId}`,
          label: `🌀 将「${here.name}」洗回宇宙，把此处的调查员与敌人移到「${hub.name}」`,
        })
      }
    }
    const handler = LOCATION_ACTIONS[String(original(here))]
    if (handler) {
      for (const action of handler.actions(state, inv, here)) {
        moves.push({ action: 'scenarioAction', locationId: here.id, ...action })
      }
    }
    // 三个可移动的虚空地点：移除参考卡 1 资源把本地点移动一格（无网格的线性近似）。
    if (FLIGHT.includes(here.id)) {
      const flags = flagsOf(state)
      if (Number(flags.referenceResources || 0) >= 1 && !flags.teamUsed?.[`up:${here.id}`]) {
        moves.push({
          action: 'scenarioAction', locationId: here.id, rule: 'moveLocationUp',
          label: `⬆️ 移除冒险参考卡 1 资源：把「${here.name}」向上移动一格（团队每场一次）`, actions: 0,
        })
      }
    }
    if (INFINITY.includes(here.id)) {
      const flags = flagsOf(state)
      if (Number(flags.referenceResources || 0) >= 1 && !flags.teamUsed?.[`down:${here.id}`]) {
        moves.push({
          action: 'scenarioAction', locationId: here.id, rule: 'moveLocationDown',
          label: `⬇️ 移除冒险参考卡 1 资源：把「${here.name}」向下移动一格（团队每场一次）`, actions: 0,
        })
      }
    }
    if (PATHWAY.includes(here.id)) {
      const flags = flagsOf(state)
      if (Number(flags.referenceResources || 0) >= 1 && !flags.teamUsed?.[`roundAdjacent:${here.id}`]) {
        moves.push({
          action: 'scenarioAction', locationId: here.id, rule: 'moveLocationAdjacent',
          label: `↔️ 移除冒险参考卡 1 资源：把「${here.name}」移动到任意相邻位置（团队每轮一次）`, actions: 0,
        })
      }
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const here = locationById(state, inv.location)
    if (move.rule === 'actCosmosTake') {
      if (!afterAvailable(state, inv)) return
      const options = Array.from({ length: Math.floor(inv.clues) }, (_, index) => ({
        id: String(index + 1), label: `花费 ${index + 1} 个线索`,
      }))
      const answer = chooseOption(api, {
        kind: 'number', source: 'actCosmosTake', seat: inv.seat,
        prompt: '花费 X 个线索抽取宇宙顶 X 张。', options,
      })
      const count = Math.max(1, Math.min(Number(answer) || 1, Math.floor(inv.clues)))
      inv.clues -= count
      const placedId = api.cosmos?.({ take: count, from: inv.location, prompt: '选择要放置入场的宇宙地点。' })
      if (!placedId) {
        api.info?.('宇宙牌库是空的。')
        return
      }
      if (!locationById(state, placedId)) {
        api.place?.(placedId)
      }
      placeCosmosLocation(state, api, placedId, { seat: inv.seat })
      api.moveInvestigator?.(inv.seat, placedId)
      return
    }
    if (move.rule?.startsWith('voidTo:')) {
      const destinationId = move.rule.slice('voidTo:'.length)
      if (here && isVoidLocation(here) && locationById(state, destinationId)) {
        returnLocationToCosmos(state, api, here.id, destinationId)
      }
      return
    }
    if (move.rule === 'gateMove') {
      const handler = LOCATION_ACTIONS[COSMIC_GATE]
      if (here && String(original(here)) === COSMIC_GATE) handler.perform(state, inv, api, here)
      return
    }
    if (move.rule === 'moveLocationUp') {
      if (here && FLIGHT.includes(here.id)) moveLocationInOrder(state, api, here.id, -1, 'up')
      return
    }
    if (move.rule === 'moveLocationDown') {
      if (here && INFINITY.includes(here.id)) moveLocationInOrder(state, api, here.id, 1, 'down')
      return
    }
    if (move.rule === 'moveLocationAdjacent') {
      if (here && PATHWAY.includes(here.id)) {
        const direction = chooseOption(api, {
          kind: 'location', source: here.id, seat: inv.seat,
          prompt: '选择把虚空之路移动的方向。',
          options: [{ id: 'up', label: '向上移动一格' }, { id: 'down', label: '向下移动一格' }],
        })
        moveLocationInOrder(state, api, here.id, direction === 'up' ? -1 : 1, 'roundAdjacent')
      }
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知黑色王座行动：${move.rule}`)
  },

  // ---- 结局 ----
  resolution(state, key, events, api) {
    return applyResolution(state, key, events, api)
  },

  // ---- 诚实边界 ----
  scenarioApproximations: [
    '宇宙网格：用 P2.13 地点牌库 + scenarioFlags.cosmosOrder「放置顺序」承载；「右/下」连接最近放置者、「上」连接最早放置者、「任意方向」由玩家选；没有二维坐标与滑动。',
    '「宇宙 -」放置指令表在 definition.locations[*].cosmos（direction/cost），behavior.placeCosmosLocation 按表建立连接；支付代价后与任意已放置地点连接的替代选项已实现。',
    '虚空格子：不建地点卡，只用 scenarioFlags.emptySpaceCount 记账（不参与移动/连接/猎手目标；盲目舞者的相关子句因此近似为「离调查员最远的在场地点」）。',
    '阿撒托斯不建场上敌人实体（参考实现里它也不在任何地点）：毁灭记 scenarioFlags.azathothDoom，「阿撒托斯攻击你」= 3 伤害 + 3 恐惧；免疫/不可击败因此自动成立。',
    '冒险参考卡资源用 scenarioFlags.referenceResources 记账；宇宙门扉的「移动任意数量调查员」实现为移动该处全部调查员；三个地点的「把本地点上/下/左/右移动一格」用放置顺序交换近似。',
    '幕推进时的清场重建：不搬动虚空格子上的玩家卡、不重建二维布局；改为把本幕宇宙地点洗回宇宙牌库、放置新枢纽并抽 2/3 张新地点，同时把调查员移到安全的枢纽。',
    '「命运之轮·X」的「在宇宙中向左移动 / 把地点向左移动」用放置顺序的相邻位置承载；「它在等待」的意志检定与「最后的倒计时」的娃娃效果按卡面实现。',
    '调查员被击败的「调查员被击败」段落只记日志 + 1 点精神创伤（参考实现的 drivenInsane 会改写战役记录状态）。',
    'DarkCult 遭遇组：本仓库卡表把 Acolyte/Wizard of the Order/Mysterious Chanting 归在 pentagram 组，遭遇牌库用 pentagram 组近似。',
    'ReturnTo 专属内容（夜魇坐骑 54061 等 4 张变体卡）不在本次非 ReturnTo 剧本的卡表范围内，未实现。',
  ],
  scenarioGaps: [],
}

function afterAvailable(state, inv) {
  return (inv.clues || 0) >= 1
}
