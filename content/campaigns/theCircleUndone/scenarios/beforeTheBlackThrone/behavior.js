// 《黑色王座》· 引擎钩子。
//
// 参考实现：Scenario/Scenarios/TheCircleUndone/BeforeTheBlackThrone.hs + Helpers.hs + Cosmos.hs。
// 宇宙模型：二维网格见 cosmos.js（格位/方向/四邻接连接/虚空格子携带玩家卡）；三张摆盘位置表见
// definition.COSMOS_LAYOUTS（照搬参考实现的三幕固定摆盘）；「宇宙 -」放置指令的候选格位按参考
// 各地点 RunCosmos 分支实现（DancersMist/FlightIntoOblivion/InfinityOfDarkness/CosmicGate/PathwayIntoVoid）。
// 其余登记近似（见 scenarioApproximations）：
//   · 虚空格子不建「地点卡」实体（参考实现用 xempty 特殊地点卡），只作为网格格位数据；
//   · 阿撒托斯不建场上敌人实体：毁灭记 scenarioFlags.azathothDoom，「攻击你」= 3 伤害 + 3 恐惧；
//   · 冒险参考卡资源记 scenarioFlags.referenceResources；界面地图用静态 layout 坐标。
// 卡面规则写在各单卡条目的 actRule / agendaRule / locationRule.onEnter 数据里；
// 本文件只读 actRuleFor / agendaRuleFor 与引擎直读的 locationRule 分派，不含按卡号的规则分支。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor } from '../../../../../src/cards/card-rules.js'
import { buildScenarioLocationDeck, drawScenarioLocationDeck } from '../../../../../src/engine/alt-decks.js'
import { encounterRules } from '../../encounter-rules.js'
import {
  A_WORLD_IN_DARKNESS, ACT_CODES, AZATHOTH, BLACK_THRONE, COSMIC_GATE, COSMIC_INGRESS, COSMOS_DECK_IDS,
  COSMOS_LAYOUTS, COURT, DAEMONIC_PIPING, DANCERS_MIST, FLIGHT, HIDEOUS_PALACE, INFINITY, MIND_DANCER,
  PATHWAY, PIPER, THE_END_IS_NIGH, ULTIMATE_CHAOS, WHISPERED_BARGAIN,
} from './definition.js'
import {
  ALL_DIRECTIONS, DIRECTIONS, OPPOSITE, adjacentLocationIds, bottommostRevealedPositions, cellAt, emptySpacePositionsInDirections,
  gridOf, gridPositionKey, isLocationCell, isEmptySpaceCell, locationIdAt, openPositionsAroundRevealed,
  openPositionsInDirections, parseKey, placedGridIds, positionOf, refreshConnections, removeLocationFromGrid,
  returnEmptySpaceCard, setEmptySpace, setLocationPosition, takeDeckCards, topmostRevealedPositions,
} from './cosmos.js'
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
const HUB_IDS = Object.freeze([COSMIC_INGRESS, HIDEOUS_PALACE, COURT, BLACK_THRONE])
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

// 05346 阿撒托斯：≥10 毁灭即吞食宇宙（→R1）。读 azathothDoom()（含 05328 后吸收的场上毁灭），
// 避免旧实现只读 flags.azathothDoom 而漏掉 05328 之后的毁灭来源。
function maybeDevoured(state, api) {
  const flags = flagsOf(state)
  if (flags.azathothDevoured) return false
  if (azathothDoom(state) < 10) return false
  flags.azathothDevoured = true
  api?.info?.('💀 阿撒托斯上有至少 10 个毁灭标记：盲目痴愚之神吞食宇宙（→R1）。')
  api?.finish?.('r1')
  return true
}

export function addAzathothDoom(state, api, amount = 1) {
  const value = Math.max(0, Math.floor(amount))
  if (!value) return azathothDoom(state)
  const flags = flagsOf(state)
  flags.azathothDoom = Number(flags.azathothDoom || 0) + value
  api.info?.(`🌌 在阿撒托斯上放置 ${value} 点毁灭（共 ${azathothDoom(state)} 点）。`)
  maybeDevoured(state, api)
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
// 宇宙：二维网格（见 cosmos.js）与「宇宙 -」放置指令
// ---------------------------------------------------------------------------
// 兼容旧读点：网格模型没有「放置顺序」，返回当前已放置的宇宙地点 id。
export function cosmosOrder(state) {
  return placedGridIds(state)
}

export function placedCosmosIds(state) {
  return placedGridIds(state).filter(id => !!locationById(state, id))
}

// 宇宙牌库剩余张数（含弃牌堆，引擎的 drawScenarioLocationDeck 会在牌库空时把弃牌堆洗回）。
function cosmosDeckSize(state) {
  const piles = state.extraLocationDecks?.cosmos
  const deck = Array.isArray(piles?.deck) ? piles.deck.length : 0
  const discard = Array.isArray(piles?.discard) ? piles.discard.length : 0
  return deck + discard
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

// 「宇宙面朝上」的隐藏身份：引擎 placeLocation 会合并 locationVariants 里的字段（名字显示为「宇宙」），
// revealLocation 时再用 unrevealedActualName 恢复真名（src/engine/locations.js:227-252）。
function prepareHiddenVariant(state, locationId) {
  const id = String(locationId)
  const base = state.scenario?.locations?.[id]
  if (!base) return
  state.locationVariants ||= {}
  if (state.locationVariants[id]?.hiddenIdentity) return
  state.locationVariants[id] = {
    name: '宇宙',
    hiddenIdentity: true,
    unrevealedActualName: ALL_CARDS[original(base)]?.nameZh || ALL_CARDS[original(base)]?.name || base.name,
  }
}

function actingPosition(state, seat) {
  const inv = state.investigators?.[seat ?? leadSeat(state)]
  return inv ? positionOf(state, inv.location) : null
}

// 参考 Cosmos.hs 与各地点条目 RunCosmos 分支：mode='default' 是按默认方向的候选格位，
// mode='cost' 是支付代价后可选的候选格位。
function instructionCandidates(state, locationId, { seat = null, mode = 'default' } = {}) {
  const instruction = state.scenario?.locations?.[String(locationId)]?.cosmos || {}
  const direction = instruction.direction || 'any'
  const anchor = actingPosition(state, seat)
  if (mode === 'cost') {
    if (direction === 'up') {
      // 参考 FlightIntoOblivion.hs：位置最靠上的已揭示地点周边的空格（不排除方向）。
      return topmostRevealedPositions(state).flatMap(position => openPositionsInDirections(state, position))
    }
    if (direction === 'down') {
      // 参考 InfinityOfDarkness.hs：位置最靠下的已揭示地点周边的空格。
      return bottommostRevealedPositions(state).flatMap(position => openPositionsInDirections(state, position))
    }
    if (direction === 'right') {
      // 参考 DancersMist.hs：行动者四方向上「有地点」的方向，取该相邻地点的空格（排除走回去的反方向）。
      const out = []
      for (const directionName of ALL_DIRECTIONS) {
        const [dx, dy] = DIRECTIONS[directionName]
        const neighbor = anchor ? { x: anchor.x + dx, y: anchor.y + dy } : null
        if (!neighbor || !isLocationCell(cellAt(state, neighbor.x, neighbor.y))) continue
        const exclude = OPPOSITE[directionName]
        out.push(...openPositionsInDirections(state, neighbor, ALL_DIRECTIONS.filter(item => item !== exclude)))
      }
      return out
    }
    return instruction.mode === 'revealed'
      ? openPositionsAroundRevealed(state)
      : (anchor ? openPositionsInDirections(state, anchor) : [])
  }
  if (direction === 'any') {
    // 05339 宇宙门扉：与「任意一个已揭示地点的任意方向」相邻的空格；
    // 05340 虚空之路：与「行动者所在地点的任意方向」相邻的空格。
    return instruction.mode === 'revealed'
      ? openPositionsAroundRevealed(state)
      : (anchor ? openPositionsInDirections(state, anchor) : [])
  }
  if (!anchor) return []
  const [dx, dy] = DIRECTIONS[direction] || [0, 0]
  return openPositionsInDirections(state, anchor, [direction])
}

function chooseGridPosition(api, { seat, prompt, candidates, source }) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const answer = chooseOption(api, {
    kind: 'cosmos', source, seat, prompt,
    options: candidates.map(position => ({
      id: gridPositionKey(position.x, position.y),
      label: `格位 (${position.x}, ${position.y})`,
    })),
  })
  return candidates.find(position => gridPositionKey(position.x, position.y) === String(answer)) || candidates[0]
}

// 参考 cosmosFail：没有合法「宇宙 -」位置时，把该地点移出游戏并洗回宇宙牌库。
function cosmosFail(state, api, locationId) {
  const id = String(locationId)
  const location = locationById(state, id)
  api.remove?.(id)
  removeLocationFromGrid(state, id)
  refreshConnections(state)
  api.cosmos?.({ shuffle: [id] })
  api.info?.(`🌌 「${location?.unrevealedActualName || location?.name || id}」没有合法的「宇宙 -」放置位置：移出游戏并洗回宇宙。`)
  return false
}

// 把一张地点卡放到网格的指定格位；目标格位是虚空格子时，其玩家卡先洗回所有者牌库。
function placeLocationOnGrid(state, api, locationId, position, { hidden = false, seat = null } = {}) {
  const id = String(locationId)
  if (!position) return false
  const existing = cellAt(state, position.x, position.y)
  if (isLocationCell(existing)) return false
  if (existing && existing.kind === 'empty' && returnEmptySpaceCard(state, existing)) {
    const owner = state.investigators?.[existing.ownerSeat]
    if (owner && typeof api?.shuffle === 'function') owner.deck = api.shuffle(owner.deck)
  }
  if (hidden) prepareHiddenVariant(state, id)
  setLocationPosition(state, id, position.x, position.y)
  refreshConnections(state)
  const location = locationById(state, id)
  const label = hidden ? '一个宇宙面朝上的地点' : `「${location?.unrevealedActualName || location?.name || id}」`
  api?.info?.(`✨ ${label}进入宇宙 (${position.x}, ${position.y}) 格位。`)
  return true
}

// 按卡面「宇宙 -」指令放置（含支付代价改方向的分支）；返回放置的格位或 null（失败=洗回宇宙）。
export function placeCosmosByInstruction(state, api, locationId, { seat = null } = {}) {
  const id = String(locationId)
  const instruction = state.scenario?.locations?.[id]?.cosmos || {}
  const actingSeat = seat ?? state.currentSeat ?? leadSeat(state)
  const defaultCandidates = instructionCandidates(state, id, { seat: actingSeat, mode: 'default' })
  const costCandidates = instruction.cost ? instructionCandidates(state, id, { seat: actingSeat, mode: 'cost' }) : []
  const canPay = Boolean(instruction.cost) && costCandidates.length > 0 && canPayCost(state, actingSeat, instruction.cost)
  let mode = 'default'
  if (canPay) {
    const costLabel = instruction.cost.resources
      ? `${instruction.cost.resources} 资源`
      : instruction.cost.damage ? `${instruction.cost.damage} 伤害` : `${instruction.cost.horror} 恐惧`
    const options = []
    if (defaultCandidates.length) options.push({ id: 'default', label: '按默认方向放置' })
    options.push({ id: 'pay', label: `支付 ${costLabel}，改在相邻空位放置（方向自选）` })
    const answer = chooseOption(api, {
      kind: 'cosmos', source: `05325:${id}`, seat: actingSeat,
      prompt: '「宇宙 -」：按默认方向放置，或支付代价改变连接方向。',
      options,
    })
    mode = answer === 'pay' ? 'pay' : (defaultCandidates.length ? 'default' : 'pay')
  }
  const pool = mode === 'pay' ? costCandidates : defaultCandidates
  if (!pool.length) { cosmosFail(state, api, id); return null }
  const position = chooseGridPosition(api, {
    seat: actingSeat, source: `05325:${id}`,
    prompt: '「宇宙 -」：选择放置的格位。', candidates: pool,
  })
  if (!position) { cosmosFail(state, api, id); return null }
  if (mode === 'pay' && !payCost(state, api, actingSeat, instruction.cost)) { cosmosFail(state, api, id); return null }
  return placeLocationOnGrid(state, api, id, position, { seat: actingSeat }) ? position : null
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

// 兼容旧的读点/测试：显式格位放置或按「宇宙 -」指令自动放置，返回新连接的邻接地点。
export function placeCosmosLocation(state, api, locationId, { seat = null, position = null } = {}) {
  if (!locationById(state, locationId) && typeof api?.place === 'function') api.place(locationId)
  const placedPosition = position
    ? (placeLocationOnGrid(state, api, locationId, position, { seat }) ? position : null)
    : placeCosmosByInstruction(state, api, locationId, { seat })
  if (!placedPosition) return []
  return adjacentLocationIds(state, locationId)
}

// 把宇宙地点向指定方向移动一格：原位置变成虚空格子，并放入一张移动者牌库顶的卡
// （参考 WheelOfFortuneX.hs / FlightIntoOblivion.hs / PathwayIntoVoid.hs 的「draw 1 → EmptySpace」）。
function slideCosmosLocation(state, api, locationId, direction, { seat = null } = {}) {
  const id = String(locationId)
  const position = positionOf(state, id)
  if (!position) return false
  const [dx, dy] = DIRECTIONS[direction]
  const target = { x: position.x + dx, y: position.y + dy }
  if (isLocationCell(cellAt(state, target.x, target.y))) return false
  const overlaid = cellAt(state, target.x, target.y)
  if (overlaid && overlaid.kind === 'empty' && returnEmptySpaceCard(state, overlaid)) {
    const owner = state.investigators?.[overlaid.ownerSeat]
    if (owner && typeof api.shuffle === 'function') owner.deck = api.shuffle(owner.deck)
  }
  const mover = state.investigators?.[seat ?? state.currentSeat ?? leadSeat(state)]
  const [cardCode] = takeDeckCards(mover, 1)
  setLocationPosition(state, id, target.x, target.y)
  setEmptySpace(state, position.x, position.y, {
    cardCode: cardCode ?? null,
    ownerSeat: mover?.seat ?? null,
  })
  refreshConnections(state)
  const location = locationById(state, id)
  api.info?.(`↔️ 「${location?.unrevealedActualName || location?.name || id}」向${direction}移动一格，原位置留下一个虚空格子。`)
  return true
}

// 把地点从桌上收回宇宙牌库（虚空地点的行动 / 幕间清场）。
function returnLocationToCosmos(state, api, locationId, destinationId = null) {
  const location = locationById(state, locationId)
  if (!location) return false
  const destination = destinationId ? locationById(state, destinationId) : null
  if (destination) {
    for (const inv of active(state).filter(item => item.location === locationId)) {
      api.moveInvestigator?.(inv.seat, destinationId)
    }
    for (const enemy of (state.enemies || []).filter(item => item.location === locationId)) {
      api.moveEnemy?.(enemy, destinationId)
    }
  }
  api.remove?.(locationId)
  removeLocationFromGrid(state, locationId)
  refreshConnections(state)
  api.cosmos?.({ shuffle: [String(locationId)] })
  api.info?.(`🌀 「${location.unrevealedActualName || location.name}」被洗回宇宙。`)
  return true
}

// 玩家顺序：从队长起按座位环绕。
function playerOrder(state) {
  const count = state.numInvestigators || (state.investigators || []).length
  const seats = []
  for (let offset = 0; offset < count; offset++) {
    const seat = (leadSeat(state) + offset) % count
    if (state.investigators?.[seat]) seats.push(seat)
  }
  return seats
}

// 卡背「位于这些地点的调查员被抛弃并阵亡」。
function killAbandonedInvestigators(state, api, removedIds) {
  const killed = []
  for (const inv of active(state).filter(item => removedIds.includes(item.location))) {
    killed.push(inv.seat)
    api.defeat?.(inv, 'abandoned')
    api.info?.(`💀 ${inv.name} 被抛在正在消散的地点，阵亡。`)
  }
  return killed
}

// 卡背「这些地点的每个敌人与遭遇牌库顶 5 张混洗后放到遭遇牌库顶」。
function shuffleAbandonedEnemiesIntoEncounterDeck(state, api, removedIds) {
  const abandoned = (state.enemies || []).filter(enemy => removedIds.includes(enemy.location))
  if (!abandoned.length) return []
  const codes = abandoned.map(enemy => String(original(enemy)))
  for (const enemy of abandoned) {
    state.enemies = state.enemies.filter(candidate => candidate !== enemy)
    for (const inv of state.investigators || []) {
      inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
    }
  }
  const top = []
  for (let index = 0; index < 5 && state.encounterDeck.length; index++) top.push(state.encounterDeck.pop())
  const merged = [...top, ...codes]
  const shuffled = typeof api.shuffle === 'function' ? api.shuffle(merged) : merged
  state.encounterDeck.push(...shuffled)
  api.info?.(`🎴 ${codes.length} 个敌人与遭遇牌库顶 ${top.length} 张混洗后放回遭遇牌库顶。`)
  return codes
}

// 从「放在一边」区取走一张卡（卡号）。
function takeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside || []
  const index = list.indexOf(String(code))
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

// 幕推进的清场与重摆（05329/05330 背面）：按 definition.COSMOS_LAYOUTS 的摆盘表重建宇宙。
// 卡面步骤：移除上一幕枢纽、虚空格子的卡洗回所有者牌库、其余地点洗回宇宙（其上调查员阵亡、
// 敌人与遭遇牌库顶 5 张混洗）、把「放在一边的枢纽 + 宇宙顶 N 张」混洗后隐藏摆放、
// 虚空格子（从 lead 牌库顶取卡）、按玩家顺序抽遭遇。
function rebuildForNextAct(state, api, { scene, nextHub, moveTo }) {
  const layout = COSMOS_LAYOUTS[scene]
  if (!layout) throw new Error(`未知黑色王座摆盘：${scene}`)
  const flags = flagsOf(state)
  // 1) 虚空格子的卡洗入其所有者牌库。
  const grid = gridOf(state)
  for (const [key, cell] of Object.entries(grid.cells)) {
    if (cell.kind !== 'empty') continue
    if (returnEmptySpaceCard(state, cell)) {
      const owner = state.investigators?.[cell.ownerSeat]
      if (owner && typeof api.shuffle === 'function') owner.deck = api.shuffle(owner.deck)
    }
    delete grid.cells[key]
  }
  // 2) 旧枢纽移出游戏；其余地点洗回宇宙（其上调查员阵亡、敌人混洗进遭遇牌库顶）。
  const kept = new Set(layout.kept.map(String))
  const removedIds = (state.locations || [])
    .map(location => String(location.id))
    .filter(id => !kept.has(id))
  killAbandonedInvestigators(state, api, removedIds)
  shuffleAbandonedEnemiesIntoEncounterDeck(state, api, removedIds)
  for (const id of removedIds) {
    const location = locationById(state, id)
    if (!location) continue
    const code = String(original(location))
    if (layout.removedFromGame.includes(code) || layout.removedFromGame.includes(String(id))) {
      api.remove?.(id)
      removeLocationFromGrid(state, id)
      api.info?.(`🌀 「${location.name}」被移出游戏。`)
    } else {
      returnLocationToCosmos(state, api, id)
    }
  }
  refreshConnections(state)
  // 3) 保留的枢纽放到本场景的枢纽格位 (0,0)。
  const keptHub = locationById(state, String(layout.hub))
  if (keptHub) setLocationPosition(state, String(layout.hub), layout.hubPosition.x, layout.hubPosition.y)
  // 4) 「放在一边的枢纽 + 宇宙顶 N 张」洗混后按位置表隐藏放置。
  const shuffledCards = []
  for (const id of layout.shuffledCards) {
    const base = state.scenario.locations?.[id]
    takeFromSetAside(state, String(original(base) || id))
    shuffledCards.push(String(id))
  }
  const drawn = api.cosmos?.({ draw: layout.cosmosDraw }) || []
  shuffledCards.push(...drawn.map(String))
  const shuffled = typeof api.shuffle === 'function' ? api.shuffle(shuffledCards) : shuffledCards
  for (const id of shuffled) {
    prepareHiddenVariant(state, id)
    if (!locationById(state, id)) api.place?.(id)
  }
  shuffled.forEach((id, index) => {
    const position = layout.shuffledPositions[index]
    // hidden=true：播报只说「一个宇宙面朝上的地点」，不在日志里泄露摆的是哪张卡。
    if (position) placeLocationOnGrid(state, api, id, position, { hidden: true })
  })
  // 5) 虚空格子：从 lead 牌库顶取卡（参考实现：draw N → EmptySpace 携带该卡）。
  const lead = leadInvestigator(state)
  const leadCards = takeDeckCards(lead, layout.emptyCards)
  layout.emptyPositions.forEach((position, index) => {
    setEmptySpace(state, position.x, position.y, {
      cardCode: leadCards[index] ?? null,
      ownerSeat: lead?.seat ?? 0,
    })
  })
  refreshConnections(state)
  // 6) 调查员移到保留的枢纽；按玩家顺序每位调查员抽取遭遇牌库顶 1 张。
  for (const inv of active(state)) api.moveInvestigator?.(inv.seat, moveTo)
  for (const seat of playerOrder(state)) {
    const inv = state.investigators?.[seat]
    if (!inv || inv.defeated || inv.resigned) continue
    api.drawEncounter?.(seat)
  }
  flags.scene = scene
  flags.stageHub = nextHub
  api.info?.(`🌌 宇宙重新铺开（场景 ${scene}）：${shuffled.length} 张宇宙卡隐藏放置、${layout.emptyCards} 个虚空格子。`)
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
  const discard = state.encounterDiscard || []
  let index = deck.lastIndexOf(code)
  if (index >= 0) {
    deck.splice(index, 1)
    deck.push(code)
  } else {
    // 卡面「查找遭遇牌库和遭遇弃牌堆」：弃牌堆里的同名卡也要能找到。
    index = discard.lastIndexOf(code)
    if (index < 0) {
      api.info?.(`遭遇牌库与遭遇弃牌堆中都没有「${ALL_CARDS[code]?.nameZh || code}」。`)
      return false
    }
    discard.splice(index, 1)
    deck.push(code)
  }
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
      // 卡面：「…阿撒托斯按玩家顺序攻击每位调查员」——顺序从队长起算（参考 eachInvestigator），
      // 不是座位顺序；被击败/撤退的调查员跳过。
      else {
        for (const seat of playerOrder(state)) {
          const target = state.investigators?.[seat]
          if (!target || target.defeated || target.resigned) continue
          azathothAttack(state, api, seat)
        }
      }
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
    // 卡面：只有场上没有[[异教徒]]敌人时，才改为在阿撒托斯上放 1 点（旧实现按「没移走毁灭」判断）。
    if (!cultists.length) addAzathothDoom(state, api, 1)
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

// 必竟之事背面：两组条件任一满足时可「前往」R2/R3；否则（→R4）。参考实现无条件提供
// 「(→R4)」选项——满足条件时也可以拒绝前往 R2/R3 而选择 R4，因此 R4 始终在选项里，
// 只由独立结局卡 applyResolution('r4') 结算「翻开黑书 → 签名(R5) 或拒绝(R1)」。
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
  const r4 = { id: 'r4', label: '结局 4（你既未接受也未拒绝：翻开黑书）' }
  if (!options.length) {
    api.finish?.('r4')
    return
  }
  options.push(r4)
  const answer = chooseOption(api, {
    kind: 'story', source: String(original(currentAct(state))), seat: leadSeat(state),
    prompt: '「必竟之事」：选择要结算的结局（也可以拒绝前往 R2/R3，选择 R4）。', options,
  })
  api.finish?.(options.some(option => option.id === answer) ? answer : 'r4')
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
    // 命运之轮·X 背面：每位在宇宙中的调查员「移动到其左方的地点」或「将其地点向左移动一次
    // （在其原来的位置放置一个虚空格子）」；「一个地点不能通过本效果移动超过一次」→
    // flags.cosmosMovedByWheel 记录本议程实例已移动过的地点。
    const flags = flagsOf(state)
    flags.cosmosMovedByWheel ||= []
    for (const inv of active(state)) {
      const position = positionOf(state, inv.location)
      if (!position) continue
      const leftPosition = { x: position.x - 1, y: position.y }
      const leftLocationId = locationIdAt(state, leftPosition.x, leftPosition.y)
      const canMoveLocationLeft = !isLocationCell(cellAt(state, leftPosition.x, leftPosition.y))
        && !flags.cosmosMovedByWheel.includes(inv.location)
      const options = []
      if (leftLocationId) options.push({ id: 'moveLeft', label: '移动到左方的宇宙地点' })
      if (canMoveLocationLeft) options.push({ id: 'moveLocationLeft', label: '把所在地点向左移动一次（原位置放置虚空格子）' })
      if (!options.length) continue
      const answer = chooseOption(api, {
        kind: 'agenda', source: String(original(agenda)), seat: inv.seat,
        prompt: '「命运之轮·X」：在宇宙中向左移动，或把你的地点向左移动一次。', options,
      })
      if (answer === 'moveLeft' && leftLocationId) {
        api.moveInvestigator?.(inv.seat, leftLocationId)
      } else if (canMoveLocationLeft) {
        if (slideCosmosLocation(state, api, inv.location, 'left', { seat: inv.seat })) {
          flags.cosmosMovedByWheel.push(inv.location)
        }
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
  if (advance.discardSelf) {
    // 05328 背面：此后没有议程牌库；毁灭改为放到阿撒托斯，且场上所有毁灭视为在阿撒托斯上。
    flagsOf(state).azathothAbsorbsAllDoom = true
    api.info?.('⏳ 最后的倒计时被弃掉——此后毁灭直接落到阿撒托斯上，场上的毁灭也视为在阿撒托斯上。')
  }
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

// ---------------------------------------------------------------------------
// 05341 盲目舞者：用现有 cosmos 二维网格承载「虚空格子」
// 虚空格子在本仓库只是网格格位数据（不是可站立的 location 实体）。参考实现里虚空格是
// 特殊地点卡 xempty，猎手可以停在上面；本实现把「进入虚空格 → 再次结算猎手」折叠成
// 一次穿越（虚空格 → 下一格），以覆盖参考实现的净移动结果；把「Spawn - Farthest empty
// space」表达为「离所有调查员最远的虚空格旁边的在场地点」。仍登记为近似（见
// scenarioApproximations）。
// ---------------------------------------------------------------------------
function gridNeighbourCells(state, position) {
  const out = []
  for (const direction of ALL_DIRECTIONS) {
    const [dx, dy] = DIRECTIONS[direction]
    const x = position.x + dx
    const y = position.y + dy
    const cell = cellAt(state, x, y)
    if (cell) out.push({ x, y, cell })
  }
  return out
}

// 以若干格位为源，在 cosmos 网格上做多源 BFS（虚空格/地点都算可走格位）。
function gridDistanceFromPositions(state, sources) {
  const keyOfPos = position => gridPositionKey(position.x, position.y)
  const distance = new Map()
  const queue = []
  for (const source of sources) {
    if (!source) continue
    const key = keyOfPos(source)
    if (distance.has(key)) continue
    distance.set(key, 0)
    queue.push(source)
  }
  while (queue.length) {
    const position = queue.shift()
    const current = distance.get(keyOfPos(position))
    for (const neighbour of gridNeighbourCells(state, position)) {
      const key = keyOfPos(neighbour)
      if (distance.has(key)) continue
      distance.set(key, current + 1)
      queue.push({ x: neighbour.x, y: neighbour.y })
    }
  }
  return distance
}

function emptySpaceGridPositions(state) {
  const cells = gridOf(state).cells || {}
  return Object.keys(cells)
    .map(key => ({ position: parseKey(key), cell: cells[key] }))
    .filter(entry => entry.position && isEmptySpaceCell(entry.cell))
}

// 05341「Spawn - Farthest empty space」：找离所有调查员最远的虚空格，并返回离它最近的在场地点。
function farthestEmptySpace(state) {
  const empties = emptySpaceGridPositions(state)
  if (!empties.length) return null
  const keyOfPos = position => gridPositionKey(position.x, position.y)
  const investigatorPositions = active(state).map(inv => positionOf(state, inv.location)).filter(Boolean)
  if (!investigatorPositions.length) return null
  const fromInvestigators = gridDistanceFromPositions(state, investigatorPositions)
  let farthest = null
  for (const empty of empties) {
    const distance = fromInvestigators.get(keyOfPos(empty.position))
    if (distance === undefined) continue
    if (!farthest || distance > farthest.distance
      || (distance === farthest.distance && keyOfPos(empty.position) < keyOfPos(farthest.position))) {
      farthest = { position: empty.position, distance }
    }
  }
  if (!farthest) return null
  const fromEmptySpace = gridDistanceFromPositions(state, [farthest.position])
  let pick = null
  for (const location of state.locations || []) {
    const position = positionOf(state, location.id)
    if (!position) continue
    const distance = fromEmptySpace.get(keyOfPos(position))
    if (distance === undefined) continue
    if (!pick || distance < pick.distance
      || (distance === pick.distance && String(location.id) < String(pick.location.id))) {
      pick = { location, distance }
    }
  }
  return pick?.location ? { position: farthest.position, location: pick.location } : null
}

// 盲目舞者的网格猎手步：返回「朝最近调查员的下一格」候选。虚空格与地点都算可走格位。
function gridHunterCandidates(state, startPosition) {
  const keyOfPos = position => gridPositionKey(position.x, position.y)
  const targetPositions = active(state)
    .map(inv => (inv.location ? positionOf(state, inv.location) : null))
    .filter(Boolean)
  if (!targetPositions.length) return null
  const fromStart = gridDistanceFromPositions(state, [startPosition])
  const targetDistances = targetPositions
    .map(position => fromStart.get(keyOfPos(position)))
    .filter(value => value !== undefined)
  if (!targetDistances.length) return null
  const nearestDistance = Math.min(...targetDistances)
  const nearestTargets = targetPositions.filter(position => fromStart.get(keyOfPos(position)) === nearestDistance)
  const fromTargets = gridDistanceFromPositions(state, nearestTargets)
  const candidates = gridNeighbourCells(state, startPosition)
    .filter(neighbour => fromTargets.get(keyOfPos(neighbour)) === nearestDistance - 1)
  if (!candidates.length) return null
  return { candidates, nearestDistance }
}

// 05341：舞者「在虚空格中」用 scenarioFlags.dancerVoidCell 记录格位（虚空格不是可站立的
// location 实体，仍以最近地点作为引擎侧的锚点位置；位置相关读点用本标记修正）。
function dancerVoidCell(state) {
  const cell = flagsOf(state).dancerVoidCell
  if (!cell || !Number.isFinite(Number(cell.x)) || !Number.isFinite(Number(cell.y))) return null
  return { x: Number(cell.x), y: Number(cell.y) }
}
function setDancerVoidCell(state, cell) {
  const flags = flagsOf(state)
  if (cell) flags.dancerVoidCell = { x: cell.x, y: cell.y }
  else delete flags.dancerVoidCell
}
function dancerStartPosition(state, enemy) {
  return dancerVoidCell(state) || positionOf(state, enemy.location)
}

// 05341 猎手移动：参考实现里舞者可进入虚空格（如同地点），若经猎手关键词进入虚空格则
// 再结算一次猎手（每轮一次）。本模型用网格格位承载：
//   · 进入虚空格 → 写 dancerVoidCell（可停留在虚空格中，直到下一次猎手移动）；
//   · 强制再结算 → 同一结算内再走一格（可能落到地点并清标记，或落到第二个虚空格）；
//   · 若本轮强制已用 → 进入虚空格后停住（不再移动）。
// 只有最短路线涉及虚空格时才接管；纯地点的路线仍交回引擎 hunterStep（保留猎物/等距裁决）。
function dancerHuntMove(state, enemy, api) {
  const flags = flagsOf(state)
  const start = dancerStartPosition(state, enemy)
  if (!start) return false
  const inVoid = Boolean(dancerVoidCell(state))
  const firstPlan = gridHunterCandidates(state, start)
  if (!firstPlan) return false
  const firstHasLocation = firstPlan.candidates.some(candidate => isLocationCell(candidate.cell))
  if (!inVoid && firstHasLocation) return false
  let current = start
  let moved = false
  let forcedUsed = false
  for (let step = 0; step < 2; step++) {
    const plan = gridHunterCandidates(state, current)
    if (!plan) break
    // 同距时优先走到地点；否则进入虚空格。
    const chosen = plan.candidates.find(candidate => isLocationCell(candidate.cell))
      || plan.candidates[0]
    if (!chosen) break
    if (isLocationCell(chosen.cell)) {
      api.moveEnemy?.(enemy, chosen.cell.id)
      setDancerVoidCell(state, null)
      api.info?.(`💃 盲目舞者移动到「${locationById(state, chosen.cell.id)?.name || chosen.cell.id}」。`)
      return true
    }
    current = { x: chosen.x, y: chosen.y }
    setDancerVoidCell(state, current)
    moved = true
    const alreadyUsed = forcedUsed || flags.dancerVoidRound === state.round
    if (alreadyUsed) {
      api.info?.('💃 盲目舞者停在虚空格中（cosmos 格位表达）：本轮「再次结算猎手」已用过。')
      return true
    }
    flags.dancerVoidRound = state.round
    forcedUsed = true
    api.info?.('💃 盲目舞者进入虚空格（cosmos 格位表达）：再次结算猎手关键词（每轮一次）。')
  }
  return moved
}

function spawnLocationFor(state, code) {
  if (code !== MIND_DANCER) return null
  const pool = state.locations || []
  if (!pool.length) return null
  // 05341「Spawn - Farthest empty space」：按网格找最远虚空格；生成时在 enemySpawned 里把
  // 「舞者其实位于该虚空格」写进 flags.dancerVoidCell，锚点地点只作为引擎侧位置。
  const gridSpawn = farthestEmptySpace(state)
  if (gridSpawn) {
    flagsOf(state).pendingDancerVoidCell = { x: gridSpawn.position.x, y: gridSpawn.position.y }
    return gridSpawn.location.id
  }
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
        rule: 'gateMove', label: '🚪 移除冒险参考卡 1 资源：把宇宙门扉的任意数量调查员移到任意其他虚空地点',
      }]
    },
    // 参考 CosmicGate.hs:75-85：chooseSome1M——逐个选择要移动的调查员（可随时停止），
    // 每个被选者由行动者选择目的地；不是把该处全部调查员搬走。
    perform: (state, inv, api, location) => {
      if (Number(flagsOf(state).referenceResources || 0) < 1) return
      const voids = (state.locations || []).filter(candidate =>
        candidate.id !== location.id && isVoidLocation(candidate))
      if (!voids.length) return
      flagsOf(state).referenceResources -= 1
      const remaining = active(state).filter(candidate => candidate.location === location.id).map(candidate => candidate.seat)
      let moved = 0
      while (remaining.length) {
        const answer = chooseOption(api, {
          kind: 'investigator', source: COSMIC_GATE, seat: inv.seat,
          prompt: '选择要移动的调查员（可以停止，任意数量）。',
          options: [
            { id: 'done', label: '停止，不再移动调查员' },
            ...remaining.map(seat => ({ id: String(seat), label: state.investigators[seat].name })),
          ],
        })
        if (String(answer) === 'done' || answer == null) break
        const seat = Number(answer)
        if (!remaining.includes(seat)) break
        const destPicked = chooseOption(api, {
          kind: 'location', source: COSMIC_GATE, seat: inv.seat,
          prompt: '选择该调查员要移动到的其他虚空地点。',
          options: voids.map(candidate => ({ id: candidate.id, label: candidate.name })),
        })
        const destination = voids.find(candidate => candidate.id === destPicked) || voids[0]
        api.moveInvestigator?.(seat, destination.id)
        remaining.splice(remaining.indexOf(seat), 1)
        moved += 1
        api.info?.(`🚪 宇宙门扉把「${state.investigators[seat].name}」送到「${destination.name}」。`)
      }
      if (!moved) api.info?.('🚪 宇宙门扉：没有调查员被移动。')
    },
  },
}

// 可把该宇宙地点移入的方向：目标格位不是另一个地点（空格或虚空格子都可，参考
// PathwayIntoVoid.hs 的 validDirections = getLocationInDirection 为 Nothing 的方向）。
function validSlideDirections(state, locationId) {
  const position = positionOf(state, locationId)
  if (!position) return []
  const out = []
  for (const direction of ALL_DIRECTIONS) {
    const [dx, dy] = DIRECTIONS[direction]
    if (!isLocationCell(cellAt(state, position.x + dx, position.y + dy))) out.push(direction)
  }
  return out
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
  placeCosmosByInstruction,
  slideCosmosLocation,
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
    flags.ultimateChaos = 0
    flags.pendingSurge = false
    flags.teamUsed = {}
    flags.stageHub = null
    flags.cosmos = { cells: {}, posOf: {}, scene: 'scene1' }
    flags.cosmosMovedByWheel = []
    // 宇宙牌库：12 张宇宙面地点（按印刷张数展开）；场景 1 顶 1 张与憎恶宫殿洗混后隐藏放置。
    // 引擎 setup 的 helper 是 { randomValue(state), shuffle(list, rng), info }：randomValue 必须带 state。
    buildScenarioLocationDeck(state, 'cosmos', COSMOS_DECK_IDS, {
      shuffle: list => (helper.shuffle
        ? helper.shuffle([...list], () => helper.randomValue(state))
        : [...list]),
    })
    const layout = COSMOS_LAYOUTS.scene1
    const topCosmosCard = drawScenarioLocationDeck(state, 'cosmos', 1)[0]
    const shuffled = helper.shuffle
      ? helper.shuffle([...layout.shuffledCards, topCosmosCard].filter(Boolean), () => helper.randomValue(state))
      : [...layout.shuffledCards, topCosmosCard].filter(Boolean)
    const placements = []
    shuffled.forEach((id, index) => {
      const position = layout.shuffledPositions[index]
      if (!position) return
      prepareHiddenVariant(state, id)
      placements.push({ id: String(id), position })
    })
    const lead = leadInvestigator(state)
    flags.pendingScene = {
      scene: 'scene1',
      placements,
      emptyPositions: layout.emptyPositions,
      emptyCards: takeDeckCards(lead, layout.emptyCards),
      leadSeat: lead?.seat ?? 0,
    }
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      state.scenario.locations[COURT]?.originalCode,
      state.scenario.locations[BLACK_THRONE]?.originalCode,
      PIPER,
    ].filter(Boolean)
    state.scenarioZones.removed = []
    flags.usedLocations = []
    return [COSMIC_INGRESS, ...placements.map(entry => entry.id)]
  },

  // 引擎在放置地点之后、开局收尾时调用：把场景 1 的固定摆盘写进网格、放入虚空格子并重算连接。
  afterChaosBagSetup(state) {
    const flags = flagsOf(state)
    const pending = flags.pendingScene
    if (!pending) return
    const layout = COSMOS_LAYOUTS[pending.scene] || COSMOS_LAYOUTS.scene1
    // 场景 1 的起始枢纽固定在自己格位（(0,0)），且由调查员入场揭示。
    if (locationById(state, String(layout.hub))) {
      setLocationPosition(state, String(layout.hub), layout.hubPosition.x, layout.hubPosition.y)
    }
    for (const entry of pending.placements) {
      const location = locationById(state, entry.id)
      if (!location) continue
      setLocationPosition(state, entry.id, entry.position.x, entry.position.y)
      location.revealed = false
      location.clues = 0
      refreshConnections(state)
    }
    pending.emptyPositions.forEach((position, index) => {
      setEmptySpace(state, position.x, position.y, {
        cardCode: pending.emptyCards[index] ?? null,
        ownerSeat: pending.leadSeat ?? 0,
      })
    })
    refreshConnections(state)
    flags.scene = pending.scene
    delete flags.pendingScene
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    actRevealFor(state, act, api)
    maybeDevoured(state, api)
  },

  agendaReveal(state, agenda, api) {
    agendaRevealFor(state, agenda, api)
    maybeDevoured(state, api)
  },

  checkObjectives(state, api) {
    if (String(original(currentAct(state))) !== '05331') return
    const lead = leadInvestigator(state)
    const throne = locationById(state, BLACK_THRONE)
    if (lead && throne && lead.location === BLACK_THRONE && (throne.clues || 0) === 0) api.advanceAct?.()
  },

  // 没有议程时，神话阶段的毁灭直接落到阿撒托斯上（引擎先加 state.doom 再通知）；
  // 无论毁灭放在哪里，都检查 05346「阿撒托斯上 ≥10 毁灭 → 吞食宇宙」。
  doomPlaced(state, payload, api) {
    if (!payload) return
    if (payload.agenda && !payload.target && !currentAgenda(state)) {
      const amount = Math.max(0, Number(payload.amount) || 0)
      if (amount) {
        state.doom = Math.max(0, Number(state.doom || 0) - amount)
        addAzathothDoom(state, api, amount)
      }
    }
    maybeDevoured(state, api)
  },

  // ---- 地点 ----
  // 进入效果写在单卡条目的 locationRule.onEnter.effect 里（引擎直读，同 02132 等核心卡），
  // 剧本不再写代码分支：05339 花线索/恐惧、05340 弃牌/伤害、05336 舞者之雾反应。

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    refillClues(state, api, COSMIC_INGRESS, 3)
    refillClues(state, api, HIDEOUS_PALACE, 4)
    refillClues(state, api, COURT, 6)
    maybeDevoured(state, api)
  },

  // 05346 的毁灭可能来自这些时点的卡牌效果：低频轮询覆盖所有窗口（避免 state-based forced 原语）。
  phaseBegan(state, phase, api) {
    encounterRules.phaseBegan?.(state, phase, api)
    maybeDevoured(state, api)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    maybeDevoured(state, api)
  },

  mythosEnded(state, api) {
    encounterRules.mythosEnded?.(state, api)
    maybeDevoured(state, api)
  },

  enemyPhaseEnd(state, api) {
    encounterRules.enemyPhaseEnd?.(state, api)
    maybeDevoured(state, api)
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
  // 05346 阿撒托斯：免疫所有玩家卡牌效果/调查员行动，且不能被任何方式击败。
  // 它不建场上敌人实体（见 spawnLocation）；参考实现用 Omnipotent 把普通「敌人」匹配器排除在
  // 所有玩家卡效果之外，本引擎没有该匹配器语义，因此改用「不生成实体」表达免疫（不成为任何
  // 卡牌效果的目标），并保留以下防御性钩子：即便被某个异常路径生成实体，也拒绝攻击/击败/伤害。
  // 05341 盲目舞者在虚空格中时也无法被正常攻击/躲避（锚点地点只是引擎侧位置，见 dancerVoidCell）。
  // 读点：enemyCanBeDefeated（hidden-rules.js:139-142）、enemyCannotBeAttacked/enemyCannotAttack/
  // canOpportunityAttack（hidden-rules.js:136-138 对应的 scenarioBehavior 钩子）、enemyDamageAllowed
  // （enemies.js:452-454）。
  enemyCanBeDefeated(state, enemy) {
    if (String(original(enemy)) === AZATHOTH) return false
    return encounterRules.enemyCanBeDefeated?.(state, enemy)
  },
  canFightEnemy(state, inv, enemy) {
    if (String(original(enemy)) === AZATHOTH) return false
    if (String(original(enemy)) === MIND_DANCER && dancerVoidCell(state)) return false
    return encounterRules.canFightEnemy?.(state, inv, enemy)
  },
  canEvadeEnemy(state, inv, enemy) {
    if (String(original(enemy)) === AZATHOTH) return false
    if (String(original(enemy)) === MIND_DANCER && dancerVoidCell(state)) return false
    return encounterRules.canEvadeEnemy?.(state, inv, enemy)
  },
  // 盲目舞者在虚空格中时「如同地点」的进入权只属于它自己：调查员不能与锚点位置上的它交战
  // （虚空格不是可进入的 location；参考实现里调查员需要 CanEnterEmptySpace 才能进入）。
  canEngageEnemy(state, inv, enemy) {
    if (String(original(enemy)) === AZATHOTH) return false
    if (String(original(enemy)) === MIND_DANCER && dancerVoidCell(state)) return false
    return encounterRules.canEngageEnemy?.(state, inv, enemy)
  },
  enemyCannotBeAttacked(state, enemy) {
    if (String(original(enemy)) === AZATHOTH) return true
    if (String(original(enemy)) === MIND_DANCER && dancerVoidCell(state)) return true
    return encounterRules.enemyCannotBeAttacked?.(state, enemy)
  },
  enemyCannotAttack(state, enemy) {
    if (String(original(enemy)) === AZATHOTH) return true
    return encounterRules.enemyCannotAttack?.(state, enemy)
  },
  canOpportunityAttack(state, enemy) {
    if (String(original(enemy)) === AZATHOTH) return false
    return encounterRules.canOpportunityAttack?.(state, enemy)
  },
  enemyDamageAllowed(state, enemy) {
    if (String(original(enemy)) === AZATHOTH) return false
    return encounterRules.enemyDamageAllowed?.(state, enemy)
  },

  spawnLocation(state, code, fallbackLoc) {
    // 05346 阿撒托斯：免疫所有玩家卡牌效果/调查员行动、不能被击败；它不建场上实体
    // （定义上 cannotBeDefeated/immuneToPlayerCards/omnipotent 已声明）。任何生成路径直接判失败。
    if (String(code) === AZATHOTH) return null
    // 引擎语义：spawnLocation 返回 null = 生成失败。只有盲目舞者的「最远虚空格子」需要改道，
    // 其余敌人必须回退到引擎地点，否则整关敌人无法生成。
    return spawnLocationFor(state, code) || fallbackLoc || null
  },

  // 05341 spawn 落在「最远虚空格」：spawnLocation 只能返回地点 id（引擎锚点），
  // 真正的虚空格位置在敌人实体生成后补写进 flags.dancerVoidCell。
  enemySpawned(state, enemy, api) {
    const flags = flagsOf(state)
    if (String(original(enemy)) === MIND_DANCER && flags.pendingDancerVoidCell) {
      setDancerVoidCell(state, flags.pendingDancerVoidCell)
      delete flags.pendingDancerVoidCell
      api?.info?.(`💃 盲目舞者在最远的虚空格中生成（cosmos 格位表达；引擎锚点「${locationById(state, enemy.location)?.name || enemy.location}」）。`)
    }
    encounterRules.enemySpawned?.(state, enemy, api)
  },

  // 05341 盲目舞者：「可以进入虚空格子，如同其进入一个地点」+「经猎手关键词移动到虚空格子后
  // 再次结算猎手关键词（每轮仅限一次）」。虚空格不是可站立的 location 实体，用
  // flags.dancerVoidCell 记录实际格位（可停留在虚空格中，下一次猎手移动继续从该格位出发）；
  // 只有最短路线涉及虚空格时接管（纯地点路线交回引擎 hunterStep 的猎物/等距裁决）。
  hunterMove(state, enemy, api) {
    if (String(original(enemy)) !== MIND_DANCER) return false
    if (enemy.exhausted || !enemy.hunter) return true
    if (dancerHuntMove(state, enemy, api)) return true
    if (active(state).some(inv => inv.location === enemy.location)) return true
    const target = api.hunterStep?.(enemy, {})
    if (target && target !== enemy.location) api.moveEnemy?.(enemy, target)
    return true
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token, api) {
    const result = bbtChaosToken(state, inv, token)
    if (!result) return null
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
    // 05325 [elder_thing]：卡面判「本次检定经过修正后的技能值是否为 0」——必须在结果落定后
    // 用最终 value 判断（旧实现在 token 揭示时读修正前的值，漏掉 -4/-6 把值压到 0 的情形）。
    if (tokens.includes('elderthing') && Number(result?.value) === 0) {
      addAzathothDoom(state, api, 1)
      api.info?.('古神标记：本次检定修正后的技能值为 0，在阿撒托斯上放置 1 个毁灭。')
    }
    maybeDevoured(state, api)
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
    if (ACT_CODES.includes(actCode) && (inv.clues || 0) >= 1 && cosmosDeckSize(state) > 0) {
      moves.push({
        action: 'scenarioAction', rule: 'actCosmosTake',
        label: `🌌 花费 X 个线索：抽取宇宙顶 X 张，选 1 张按「宇宙 -」放置并移动过去（现有线索 ${inv.clues}）`,
      })
    }
    const here = locationById(state, inv.location)
    if (!here) return moves
    // 每个虚空地点获得「洗入宇宙并搬到枢纽」的行动（由在场的每个枢纽卡授予）。
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
    // LOCATION_ACTIONS 以地点 id（'cosmicGate'）为键；这里不能用卡号 '05339' 查找。
    const handler = LOCATION_ACTIONS[here.id]
    if (handler) {
      for (const action of handler.actions(state, inv, here)) {
        moves.push({ action: 'scenarioAction', locationId: here.id, ...action })
      }
    }
    const flags = flagsOf(state)
    // 05337 飞入湮灭 / 05338 无尽黑暗：[action] 上/下移动一格（团队每场游戏仅限一次）。
    if (FLIGHT.includes(here.id) && validSlideDirections(state, here.id).includes('up')
      && Number(flags.referenceResources || 0) >= 1 && !flags.teamUsed?.[`up:${here.id}`]) {
      moves.push({
        action: 'scenarioAction', locationId: here.id, rule: 'moveLocationUp',
        label: `⬆️ 移除冒险参考卡 1 资源：把「${here.name}」向上移动一格（原位置放置虚空格子，团队每场一次）`,
      })
    }
    if (INFINITY.includes(here.id) && validSlideDirections(state, here.id).includes('down')
      && Number(flags.referenceResources || 0) >= 1 && !flags.teamUsed?.[`down:${here.id}`]) {
      moves.push({
        action: 'scenarioAction', locationId: here.id, rule: 'moveLocationDown',
        label: `⬇️ 移除冒险参考卡 1 资源：把「${here.name}」向下移动一格（原位置放置虚空格子，团队每场一次）`,
      })
    }
    // 05340 虚空之路：[action] 移动到任意一个相邻位置（团队每轮仅限一次）。
    if (PATHWAY.includes(here.id) && validSlideDirections(state, here.id).length > 0
      && Number(flags.referenceResources || 0) >= 1
      && flags.roundAdjacentUsed?.[here.id] !== state.round) {
      moves.push({
        action: 'scenarioAction', locationId: here.id, rule: 'moveLocationAdjacent',
        label: `↔️ 移除冒险参考卡 1 资源：把「${here.name}」移动到任意相邻位置（原位置放置虚空格子，团队每轮一次）`,
      })
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
      const drawn = (api.cosmos?.({ draw: count }) || []).map(String)
      if (!drawn.length) {
        api.info?.('宇宙牌库是空的。')
        return
      }
      inv.clues -= count
      // 卡面：「选择其中一张卡牌，按照其『宇宙 -』指示放置入场，并移动到其上。将其余卡牌洗回『宇宙』。」
      const picked = drawn.length === 1 ? drawn[0] : chooseOption(api, {
        kind: 'cosmos', source: 'actCosmosTake', seat: inv.seat,
        prompt: '选择 1 张要按「宇宙 -」放置入场的宇宙地点。',
        options: drawn.map(id => ({ id, label: `宇宙地点（${id}）` })),
      })
      const chosenId = drawn.includes(String(picked)) ? String(picked) : drawn[0]
      if (!locationById(state, chosenId)) api.place?.(chosenId)
      // 注意：不传 from —— 卡面只要求「行动者本人移动到其上」；引擎的 cosmos({from}) 会把该地点的
      // 所有调查员与敌人一起搬过去（src/engine/scenario-runtime.js:357-368），那会放大移动范围。
      const position = placeCosmosByInstruction(state, api, chosenId, { seat: inv.seat })
      if (position && locationById(state, chosenId)) api.moveInvestigator?.(inv.seat, chosenId)
      const rejected = drawn.filter(id => id !== chosenId)
      if (rejected.length) api.cosmos?.({ shuffle: rejected })
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
      if (here && here.id === COSMIC_GATE) handler.perform(state, inv, api, here)
      return
    }
    if (move.rule === 'moveLocationUp') {
      if (!here || !FLIGHT.includes(here.id)) return
      if (Number(flagsOf(state).referenceResources || 0) < 1) return
      if (!validSlideDirections(state, here.id).includes('up')) {
        api.info?.('「飞入湮灭」上方没有可移入的相邻位置。')
        return
      }
      flagsOf(state).referenceResources -= 1
      flagsOf(state).teamUsed ||= {}
      flagsOf(state).teamUsed[`up:${here.id}`] = true
      slideCosmosLocation(state, api, here.id, 'up', { seat: inv.seat })
      return
    }
    if (move.rule === 'moveLocationDown') {
      if (!here || !INFINITY.includes(here.id)) return
      if (Number(flagsOf(state).referenceResources || 0) < 1) return
      if (!validSlideDirections(state, here.id).includes('down')) {
        api.info?.('「无尽黑暗」下方没有可移入的相邻位置。')
        return
      }
      flagsOf(state).referenceResources -= 1
      flagsOf(state).teamUsed ||= {}
      flagsOf(state).teamUsed[`down:${here.id}`] = true
      slideCosmosLocation(state, api, here.id, 'down', { seat: inv.seat })
      return
    }
    if (move.rule === 'moveLocationAdjacent') {
      if (!here || !PATHWAY.includes(here.id)) return
      if (Number(flagsOf(state).referenceResources || 0) < 1) return
      const directions = validSlideDirections(state, here.id)
      if (!directions.length) {
        api.info?.('「虚空之路」没有可移入的相邻位置。')
        return
      }
      const labels = { up: '向上', down: '向下', left: '向左', right: '向右' }
      const direction = directions.length === 1 ? directions[0] : chooseOption(api, {
        kind: 'location', source: here.id, seat: inv.seat,
        prompt: '选择把「虚空之路」移动的方向。',
        options: directions.map(item => ({ id: item, label: `${labels[item] || item}移动一格` })),
      })
      if (!directions.includes(direction)) return
      flagsOf(state).referenceResources -= 1
      flagsOf(state).roundAdjacentUsed ||= {}
      flagsOf(state).roundAdjacentUsed[here.id] = state.round
      slideCosmosLocation(state, api, here.id, direction, { seat: inv.seat })
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
    '宇宙用二维网格承载（见 cosmos.js）：格位/方向/四邻接连接/虚空格子（携带一张玩家卡）均按参考 Cosmos.hs 与各地点 RunCosmos 实现；虚空格子不建「地点卡」实体（参考实现用 xempty 特殊地点卡），因此敌我目标枚举里不会把虚空格子当地点（05341 盲目舞者的「进入虚空格子」用网格格位 flags.dancerVoidCell 承载，见下一行）。',
    '盲目舞者（05341）的「可以进入虚空格子，如同其进入一个地点」用 cosmos 二维网格承载：最短路线下一格是虚空格时舞者进入并记录 flags.dancerVoidCell（可停留在虚空格中，下一次猎手移动从该格位继续），若经猎手进入虚空格则同一结算内再走一格（每轮一次，flags.dancerVoidRound）；生成时按网格取离所有调查员最远的虚空格，dancerVoidCell 记录该格位、引擎锚点取离它最近的在场地点（farthestEmptySpace/dancerHuntMove/spawnLocationFor/enemySpawned）。残余表示层：虚空格仍不是可站立的 location 实体——舞者在虚空格中时引擎侧位置仍锚定在最近地点（攻击/交战类读点已由 canFightEnemy/canEvadeEnemy/enemyCannotBeAttacked 按 dancerVoidCell 拒绝，但「按地点统计/检索敌人」的效果会把它算在锚点地点；引擎猎手循环在锚点地点有调查员时会跳过本卡，属同源残余）；等距多条路线仍取确定顺序而非队长选择。tests/tcu-black-throne.test.mjs 覆盖穿越/停留/连续两虚空格/生成。',
    '阿撒托斯不建场上敌人实体（参考实现是 Omnipotent 的 Global 敌人；普通「敌人」匹配器在参考实现里会因 Omnipotent 被排除在玩家卡效果之外，本引擎没有该匹配器语义，故用「不生成实体」表达「免疫所有玩家卡牌效果/调查员行动」）。毁灭记 scenarioFlags.azathothDoom，「阿撒托斯攻击你」= 3 伤害 + 3 恐惧；免疫/不可击败由「不在场」成立，并已由 behavior.enemyCanBeDefeated/canFightEnemy/canEvadeEnemy/canEngageEnemy/enemyCannotBeAttacked/enemyCannotAttack/canOpportunityAttack/enemyDamageAllowed 防御性拒绝（即便被异常路径生成也不会被攻击/击败/躲避/交战/伤害）。唯一行为差异是「统计场上敌人」的效果会少算它：R6 评估过内容侧「替代计数读点」（behavior.enemyCountOverride 等）不可行——现有玩家卡/引擎效果直接读 state.enemies，没有可插入的引擎读点，内容钩子只会是死代码；要消除此差异需要引擎支持 Global/不在任何地点的真实敌人实体（本轮不做）。05328 背面推进后置 flags.azathothAbsorbsAllDoom，此时阿撒托斯毁灭 = 累积计数 + 场上所有卡牌/当前密谋上的毁灭（等价 CountAllDoomInPlay），skull X / 黑色王座隐藏值 / 05344·05345 都读同一口径；≥10 毁灭在 addAzathothDoom/doomPlaced/各阶段钩子末轮询判「吞食宇宙（→R1）」。',
    '冒险参考卡资源用 scenarioFlags.referenceResources 记账；「移除参考卡 1 资源」的能力在资源不足时不出现。',
    '幕推进时的清场重建（05329/05330 背面）按 definition.COSMOS_LAYOUTS 的固定摆盘表实现：旧枢纽移出游戏、虚空格子的卡洗回所有者牌库、其余地点洗回宇宙（其上调查员阵亡、敌人与遭遇牌库顶 5 张混洗）、「放在一边的枢纽 + 宇宙顶 N 张」洗混后隐藏摆放在手册位置、虚空格子从 lead 牌库顶取卡、按玩家顺序每人抽 1 张遭遇。仍属表示层近似：地点卡以「宇宙」面朝上摆放但引擎不区分卡背图案，二维坐标只存于 scenarioFlags（界面地图仍用静态 layout 坐标，不随移动变化）。',
    '调查员被击败的「调查员被击败」段落只记日志 + 1 点精神创伤（参考实现的 drivenInsane 会改写战役记录状态）。',
    'DarkCult 遭遇组：本仓库卡表把 Acolyte/Wizard of the Order/Mysterious Chanting 归在 pentagram 组，遭遇牌库用 pentagram 组近似。',
    'ReturnTo 专属内容（夜魇坐骑 54061 等 4 张变体卡）不在本次非 ReturnTo 剧本的卡表范围内，未实现。',
  ],
  scenarioGaps: [],
}

function afterAvailable(state, inv) {
  return (inv.clues || 0) >= 1
}
