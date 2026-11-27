import { ALL_CARDS, entryDistance, originalOf } from '../../../_shared.js'

const RAMBLING_ROUTE_USED = 'ramblingRouteLookUsed'
const ALIEN_FRONTIER_USED = 'alienFrontierLookUsed'
const WEALD_SWAP_USED = 'wealdSwapUsed'
const OTHERWORLD_DECK = 'otherworld'
const CHAPTER_KEY = 'withoutATrace'
const SHADOW_LABELS = { left: '左侧', middle: '中间', right: '右侧' }
const SHADOW_POSITION_OF_KIND = { CityOfRemnantsL: 'left', CityOfRemnantsM: 'middle', CityOfRemnantsR: 'right' }

const concealedCards = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
const chapter = state => state.scenarioFlags?.[CHAPTER_KEY]
const shadowPlacements = state => Object.entries(chapter(state)?.shadows || {})
  .filter(([, id]) => id)
const hasDeckTop = state => Boolean(state.scenarioFlags?.mechanics?.scenarioDecks?.[OTHERWORLD_DECK]?.deck?.length)
const pointKey = ({ x, y }) => `${x},${y}`
const adjacent = (a, b) => Boolean(a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1)

function showFace(api, seat, code) {
  const card = ALL_CARDS[code]
  if (!card) return false
  const name = api.cardName(code)
  const text = card.textZh || card.text
  api.privateInfo(seat, `你查看了「${name}」的已揭示面。`, { kind: 'story', code, face: 'front', name, text })
  return true
}

function ramblingRouteTargets(state, inv) {
  const grid = state.scenarioFlags?.mechanics?.grid || {}
  return concealedCards(state).filter(card => !card.flipped).flatMap(card => {
    const point = chapter(state)?.spots?.[card.id]
    const adjacentLocations = point
      ? state.locations.filter(location => adjacent(grid[location.id], point)).map(location => location.id)
      : [card.locationId]
    const costs = [...new Set(adjacentLocations.map(id => entryDistance(state, inv.location, id)))]
      .filter(Number.isFinite).sort((a, b) => a - b)
    return costs.map(cost => ({ card, cost, id: `${card.id}:${cost}`, point }))
  })
}

export function ramblingRouteLook(code) {
  return {
    kind: 'action', actionKind: 'activate',
    label: '花费 X 资源：查看一张隐匿迷你卡牌的已揭示面（团队每场游戏一次）',
    criteria: ({ state, inv }) => !state.scenarioFlags?.[RAMBLING_ROUTE_USED] && ramblingRouteTargets(state, inv).length > 0,
    resolve: ({ state, inv, api }) => {
      if (state.scenarioFlags?.[RAMBLING_ROUTE_USED]) return false
      const available = api.availableResources(inv.seat)
      const targets = ramblingRouteTargets(state, inv).filter(target => target.cost <= available)
      if (!targets.length) return false
      const pickedId = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'effect', source: code, seat: inv.seat,
        prompt: '选择要查看的隐匿迷你卡牌，费用等于到它相邻地点的连接数。',
        options: targets.map(({ card, cost, id, point }) => ({
          id, label: `隐匿迷你卡（${point ? pointKey(point) : api.locationName(card.locationId)} · ${cost} 资源）`,
        })),
      })
      const picked = targets.find(target => target.id === pickedId)
      if (!picked) return false
      if (picked.cost > 0) api.spendResources(inv.seat, picked.cost)
      const card = api.tsk.concealed.markKnown(picked.card.id, [inv.seat])
      if (!card) return false
      api.setScenarioFlag(RAMBLING_ROUTE_USED, true)
      const identity = card.decoy ? '诱饵' : card.code ? api.cardName(card.code) : card.kind
      api.privateInfo(inv.seat, `隐匿迷你卡牌的已揭示面是「${identity}」。`)
      return true
    },
  }
}

export function alienFrontierLook(code) {
  return {
    kind: 'action', actionKind: 'activate',
    label: '受到 1 点恐惧：查看阴影地点或异界牌库顶的已揭示面（团队每场游戏一次）',
    cost: { action: 1, horror: 1 },
    criteria: ({ state }) => !state.scenarioFlags?.[ALIEN_FRONTIER_USED]
      && (shadowPlacements(state).length > 0 || hasDeckTop(state)),
    resolve: ({ state, inv, api }) => {
      if (state.scenarioFlags?.[ALIEN_FRONTIER_USED]) return false
      const targets = shadowPlacements(state).map(([position, id]) => ({
        id: position, locationId: id, label: `阴影中的${SHADOW_LABELS[position]}地点`,
      }))
      if (hasDeckTop(state)) targets.push({ id: 'deck', label: '异界牌库顶牌' })
      if (!targets.length) return false
      const pickedId = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'effect', source: code, seat: inv.seat,
        prompt: '选择要查看的阴影地点或异界牌库顶牌。',
        options: targets.map(({ id, label }) => ({ id, label })),
      })
      const picked = targets.find(target => target.id === pickedId)
      if (!picked) return false
      const locationId = picked.id === 'deck' ? api.mechanics.scenarioDecks.top(OTHERWORLD_DECK)?.[0] : picked.locationId
      const location = state.locations.find(item => item.id === locationId) || state.scenario?.locations?.[locationId]
      if (!showFace(api, inv.seat, originalOf(location) || locationId)) return false
      api.setScenarioFlag(ALIEN_FRONTIER_USED, true)
      return true
    },
  }
}

function choosePair(api, seat, source, options) {
  if (options.length < 2) return []
  if (options.length === 2) return options.map(option => option.id)
  const first = api.choose({ kind: 'effect', source, seat, prompt: '选择要交换的第一项。', options })
  const remaining = options.filter(option => option.id !== first)
  const second = api.choose({ kind: 'effect', source, seat, prompt: '选择要交换的第二项。', options: remaining })
  return [first, second]
}

const swappableMinis = state => concealedCards(state).filter(card => !card.flipped && chapter(state)?.spots?.[card.id])
const miniOptions = (state, cards) => cards.map(card => ({
  id: card.id, label: `隐匿迷你卡（${pointKey(chapter(state).spots[card.id])}）`,
}))

export function wealdSwap(code) {
  return {
    kind: 'free', actionKind: 'activate',
    label: '此地无线索时：交换两张迷你卡，或交换两个阴影地点（团队每场游戏一次）',
    criteria: ({ state, source }) => source?.clues === 0 && !state.scenarioFlags?.[WEALD_SWAP_USED]
      && (swappableMinis(state).length >= 2 || shadowPlacements(state).length >= 2),
    resolve: ({ state, inv, api }) => {
      if (state.scenarioFlags?.[WEALD_SWAP_USED]) return false
      const data = chapter(state)
      if (!data) return false
      const minis = swappableMinis(state)
      const shadows = shadowPlacements(state)
      const modes = []
      if (minis.length >= 2) modes.push({ id: 'minis', label: '交换两张隐匿迷你卡的位置' })
      if (shadows.length >= 2) modes.push({ id: 'shadows', label: '交换两个阴影地点的位置' })
      if (!modes.length) return false
      const mode = modes.length === 1 ? modes[0].id : api.choose({
        kind: 'effect', source: code, seat: inv.seat, prompt: '选择要交换的类型。', options: modes,
      })
      if (mode === 'minis') {
        const [first, second] = choosePair(api, inv.seat, code, miniOptions(state, minis))
          .map(id => minis.find(card => card.id === id))
        if (!first || !second || first.id === second.id) return false
        api.tsk.concealed.reposition([
          { id: first.id, locationId: second.locationId, position: second.position },
          { id: second.id, locationId: first.locationId, position: first.position },
        ])
        api.setScenarioFlag(CHAPTER_KEY, { ...data, spots: {
          ...data.spots, [first.id]: data.spots[second.id], [second.id]: data.spots[first.id],
        } })
      } else if (mode === 'shadows') {
        const [first, second] = choosePair(api, inv.seat, code, shadows.map(([position]) => ({
          id: position, label: `阴影中的${SHADOW_LABELS[position]}地点`,
        })))
        if (!first || !second || first === second || !data.shadows[first] || !data.shadows[second]) return false
        const placements = { ...data.shadows, [first]: data.shadows[second], [second]: data.shadows[first] }
        const updates = concealedCards(state).flatMap(card => {
          const position = SHADOW_POSITION_OF_KIND[card.kind]
          if (position !== first && position !== second) return []
          const location = state.locations.find(item => item.id === placements[position])
          return [{ id: card.id, code: originalOf(location) }]
        })
        api.tsk.concealed.setCodes(updates)
        api.setScenarioFlag(CHAPTER_KEY, { ...data, shadows: placements })
      } else return false
      api.setScenarioFlag(WEALD_SWAP_USED, true)
      return true
    },
  }
}

export function redistributeFromCliffs({ state, source, context, api }) {
  const data = chapter(state)
  const origin = api.mechanics.map.position(source.id)
  if (!data || !origin) return false
  const cards = swappableMinis(state).filter(card => adjacent(data.spots[card.id], origin))
  if (!cards.length) return false
  const map = api.mechanics.map
  const cliffs = state.locations.filter(location => originalOf(location) === originalOf(source))
  const cliffPoints = cliffs.map(location => map.position(location.id)).filter(Boolean)
  const occupied = new Set(Object.values(data.spots).map(pointKey))
  const targetByPoint = new Map()
  for (const location of map.locations()) {
    if (cliffs.includes(location)) continue
    for (const point of map.emptyAdjacent(location.id)) {
      const key = pointKey(point)
      if (occupied.has(key) || cliffPoints.some(cliff => adjacent(point, cliff)) || targetByPoint.has(key)) continue
      targetByPoint.set(key, { ...point, key, locationId: location.id })
    }
  }
  const targets = [...targetByPoint.values()]
  if (!targets.length) return false
  const balancedCount = cards.length - cards.length % targets.length
  const available = [...targets]
  const moves = cards.map((card, index) => {
    let target = targets[index % targets.length]
    if (index >= balancedCount) {
      const key = available.length === 1 ? available[0].key : api.choose({
        kind: 'effect', source: source.code, seat: context.seat,
        prompt: '选择迷你卡牌要移动到的空位。',
        options: available.map(point => ({ id: point.key, label: point.key })),
      })
      const position = available.findIndex(point => point.key === key)
      if (position < 0) throw new RangeError('无效的迷你卡目标空位')
      ;[target] = available.splice(position, 1)
    }
    return { id: card.id, locationId: target.locationId, point: { x: target.x, y: target.y } }
  })
  api.tsk.concealed.reposition(moves.map(({ id, locationId }) => ({ id, locationId })))
  api.setScenarioFlag(CHAPTER_KEY, { ...data, spots: { ...data.spots,
    ...Object.fromEntries(moves.map(move => [move.id, move.point])),
  } })
  return true
}
