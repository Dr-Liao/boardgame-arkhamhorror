// 《黑色王座》（05325）章节测试：钩子级。覆盖二维宇宙网格（摆盘/隐藏身份/虚空格子/连接）、
// 三幕/三议程、阿撒托斯毁灭计时、4 张诡计、地点进入/枢纽补线索、
// 混乱标记四难度、结局记录、存档往返与确定性。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as bbt from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/index.js'
import {
  scenario as definition, AZATHOTH, BLACK_THRONE, COSMIC_GATE, COSMIC_INGRESS, COSMOS_DECK_IDS,
  COSMOS_LAYOUTS, COURT, DANCERS_MIST, FLIGHT, HIDEOUS_PALACE, INFINITY, PATHWAY,
} from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/definition.js'
import {
  cellAt, gridOf, positionOf, refreshConnections, setEmptySpace, setLocationPosition,
} from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/cosmos.js'
import {
  drawScenarioLocationDeck, scenarioLocationDeckInfo, shuffleScenarioLocationIntoDeck,
} from '../src/engine/alt-decks.js'
import { locationRuleFor } from '../src/cards/card-rules.js'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items, rng = randomValue) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(rng() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function stateFor(count = 2, records = {}) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: COSMIC_INGRESS,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      // 场景 1/2/3 的摆盘会从 lead 牌库顶取 6/7/8 张卡放进虚空格子。
      deck: Array.from({ length: 12 }, (_, index) => `deck${seat}-${index}`),
      discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    locationVariants: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    doom: 0,
    skillTest: null,
    campaign: {
      leadSeat: 0,
      records: { mementosDiscovered: [], ...records },
      investigators: Array.from({ length: count }, (_, seat) => ({
        id: `inv${seat}`, deck: [], purchases: [], status: 'active',
        trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

const loc = (state, id) => state.locations.find(location => location.id === id)
const hub = (state, id) => loc(state, id)
const gridPos = (state, id) => positionOf(state, id)
const locationAt = (state, x, y) => {
  const cell = cellAt(state, x, y)
  return cell?.kind === 'location' ? loc(state, cell.id) : null
}

// 与引擎 placeLocation 相同的语义：合并 locationVariants（隐藏身份）、按在场决定是否揭示。
function placeInState(state, id, { revealed = null } = {}) {
  if (loc(state, id)) return loc(state, id)
  const base = state.scenario.locations[id]
  assert.ok(base, `缺少地点定义 ${id}`)
  const variant = state.locationVariants?.[id] || null
  const merged = { ...clone(base), ...(variant ? clone(variant) : {}) }
  const autoRevealed = revealed == null
    ? state.investigators.some(inv => inv.location === id)
    : revealed
  const totalClues = merged.cluesFixed ?? (merged.cluesPerInvestigator || 0) * state.numInvestigators
  const location = {
    ...merged, id, revealed: autoRevealed,
    clues: autoRevealed ? totalClues : 0, maxClues: totalClues,
    doom: 0,
    connections: [...(merged.connections || [])],
  }
  state.locations.push(location)
  return location
}

function setup(state, { seed = 11, place = true } = {}) {
  const rng = setupApi(seed)
  const placed = bbt.behavior.setupLocations(state, [], rng)
  if (place) for (const id of placed) placeInState(state, id)
  if (place) bbt.behavior.afterChaosBagSetup(state)
  return { rng, placed }
}

function apiFor(state, options = {}) {
  const choices = [...(options.choices || [])]
  const log = []
  const rng = options.rng || setupApi(23)
  const testResult = options.testResult || { success: true, value: 4, difficulty: 4 }
  const reveal = id => {
    const location = loc(state, id)
    if (!location || location.revealed) return
    location.revealed = true
    if (location.unrevealedActualName) {
      location.name = location.unrevealedActualName
      delete location.unrevealedActualName
    }
    delete location.hiddenIdentity
    location.clues = location.maxClues ?? 0
  }
  const remove = id => {
    const index = state.locations.findIndex(location => location.id === id)
    if (index >= 0) state.locations.splice(index, 1)
    for (const location of state.locations) location.connections = (location.connections || []).filter(c => c !== id)
  }
  const api = {
    log,
    info: text => log.push(String(text)),
    random: rng.randomValue,
    shuffle: list => rng.shuffle([...list]),
    choose: request => (choices.length ? choices.shift() : (request?.options?.[0]?.id ?? 'skip')),
    test: (seat, skill, difficulty, resolve) => {
      const result = { ...testResult, difficulty, skill }
      if (result.value == null) result.value = difficulty
      resolve(result)
      return result
    },
    cosmos: (options2 = {}) => {
      const id = options2.id || 'cosmos'
      if (options2.draw) return drawScenarioLocationDeck(state, id, options2.draw)
      if (options2.shuffle) return shuffleScenarioLocationIntoDeck(state, id, options2.shuffle)
      if (options2.take) {
        const drawn = drawScenarioLocationDeck(state, id, options2.take)
        if (!drawn.length) return null
        let picked = drawn[0]
        if (drawn.length > 1 && choices.length) {
          const answer = choices.shift()
          if (drawn.includes(answer)) picked = answer
        }
        const piles = state.extraLocationDecks?.[id]
        const rejected = drawn.filter(candidate => candidate !== picked)
        if (piles && rejected.length) piles.deck.unshift(...rejected)
        api.place(picked)
        return picked
      }
      return scenarioLocationDeckInfo(state, id)
    },
    place: id => placeInState(state, id),
    reveal: id => reveal(id),
    remove: id => remove(id),
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    trauma: (seat, kind, amount) => {
      const record = state.campaign.investigators?.[seat]
      if (record) record.trauma[kind] += amount
    },
    defeat: (inv, cause) => { inv.defeated = true; log.push(`defeat ${inv.seat} ${cause || ''}`.trim()) },
    discardEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      state.encounterDiscard.push(enemy.originalCode || enemy.code)
    },
    advanceAct: () => { state.scenarioFlags.advanced = true },
    finish: key => { state.scenarioFlags.finishedKey = key },
    drawEncounter: seat => {
      const code = state.encounterDeck.pop()
      if (code) state.encounterDiscard.push(code)
      return code
    },
    spawn: (code, locationId) => {
      const enemy = { id: `enemy-${state.enemies.length}`, code, originalCode: code, location: locationId, doom: 0 }
      state.enemies.push(enemy)
      return enemy
    },
    shuffleEncounterDeck: () => {},
  }
  return api
}

// ---------------------------------------------------------------------------
// 结构 / 身份
// ---------------------------------------------------------------------------

test('黑色王座：playable 清单、原卡身份与幕/议程/结局', () => {
  assert.equal(bbt.manifest.status, 'playable')
  assert.equal(bbt.manifest.campaignId, 'theCircleUndone')
  assert.equal(bbt.scenario.originalCode, '05325')
  assert.equal(bbt.behavior.id, 'beforeTheBlackThrone')
  assert.equal(bbt.manifest.locations.length, 16)
  assert.deepEqual(bbt.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(bbt.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(bbt.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6'])
  assert.deepEqual(bbt.manifest.zones.encounterDeck.find(entry => entry.cardCode === AZATHOTH), undefined)
  assert.deepEqual(bbt.manifest.zones.setAside.map(entry => entry.cardCode).sort(),
    ['05088', '05334', '05335'].sort())
  assert.deepEqual(bbt.manifest.zones.inPlay, [{ cardCode: AZATHOTH, count: 1 }])
  for (const group of bbt.manifest.requiredEncounterGroupIds) assert.match(group, /^[a-z][A-Za-z0-9]+$/)
  assert.deepEqual(bbt.manifest.requiredMechanicIds, ['tcuCosmos', 'tcuChaos', 'tcuHaunted'])
})

test('9 张地点卡展开为 16 个地点 id（3/3/3/2/1 张）', () => {
  const ids = Object.keys(bbt.scenario.locations)
  assert.equal(ids.length, 16)
  const counts = {}
  for (const id of ids) {
    const code = bbt.identities.locations[id].originalCode
    assert.equal(bbt.identities.locations[id].identityStatus, 'mapped')
    counts[code] = (counts[code] || 0) + 1
  }
  assert.equal(counts['05336'], 3)
  assert.equal(counts['05337'], 3)
  assert.equal(counts['05338'], 3)
  assert.equal(counts['05340'], 2)
  assert.equal(counts['05332'], 1)
  assert.equal(new Set(COSMOS_DECK_IDS).size, 12)
  assert.equal(COSMOS_DECK_IDS.length, 12)
})

test('枢纽初始主链（definition 初始数据）：宇宙入口↔憎恶宫殿↔皇廷↔黑王座', () => {
  const connections = id => bbt.scenario.locations[id].connections
  assert.ok(connections(COSMIC_INGRESS).includes(HIDEOUS_PALACE))
  assert.ok(connections(HIDEOUS_PALACE).includes(COSMIC_INGRESS))
  assert.ok(connections(HIDEOUS_PALACE).includes(COURT))
  assert.ok(connections(COURT).includes(HIDEOUS_PALACE))
  assert.ok(connections(COURT).includes(BLACK_THRONE))
  assert.ok(connections(BLACK_THRONE).includes(COURT))
})

// ---------------------------------------------------------------------------
// 布置 / Cosmos 牌库 / 二维网格
// ---------------------------------------------------------------------------

test('布置：场景 1 二维摆盘——宇宙入口 (0,0)、憎恶宫殿+1 张宇宙卡隐藏放在 (2,1)/(2,-1)、6 个虚空格', () => {
  const state = stateFor(2, { thePathWindsBeforeYou: 2 })
  const { placed } = setup(state)
  assert.equal(placed.length, 3)
  assert.equal(placed[0], COSMIC_INGRESS)
  assert.equal(new Set(placed.slice(1)).size, 2)
  assert.ok(placed.includes(HIDEOUS_PALACE), '憎恶宫殿与宇宙顶 1 张一起洗混放置')
  assert.equal(bbt.behavior.cosmosOrder(state).length, 3)
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 11, '12 张宇宙卡：1 张与憎恶宫殿一起放置')
  assert.equal(state.scenarioFlags.pathWinds, 2)
  assert.equal(state.scenarioFlags.referenceResources, 2)
  assert.equal(state.scenarioFlags.azathothDoom, 0)
  assert.deepEqual(state.scenarioZones.setAside.sort(), ['05088', '05334', '05335'].sort())
  // 宇宙入口在 (0,0)，且因调查员在场而揭示。
  assert.deepEqual(gridPos(state, COSMIC_INGRESS), { x: 0, y: 0 })
  assert.equal(loc(state, COSMIC_INGRESS).revealed, true)
  // 两张隐藏卡分别在 (2,1)/(2,-1)，名字显示为「宇宙」（揭示后恢复真名）。
  const hidden = placed.slice(1)
  assert.deepEqual(hidden.map(id => gridPos(state, id)).sort((a, b) => a.y - b.y),
    [{ x: 2, y: -1 }, { x: 2, y: 1 }])
  for (const id of hidden) {
    assert.equal(loc(state, id).revealed, false)
    assert.equal(loc(state, id).name, '宇宙')
    assert.equal(loc(state, id).hiddenIdentity, true)
  }
  // 6 个虚空格子，各自携带 lead 牌库顶的卡；lead 牌库 12→6。
  const cells = COSMOS_LAYOUTS.scene1.emptyPositions.map(position => cellAt(state, position.x, position.y))
  assert.equal(cells.length, 6)
  for (const cell of cells) {
    assert.equal(cell.kind, 'empty')
    assert.ok(String(cell.cardCode).startsWith('deck0-'), '虚空格子携带 lead 牌库顶的卡')
    assert.equal(cell.ownerSeat, 0)
  }
  assert.equal(state.investigators[0].deck.length, 6)
  // 场景 1：宇宙入口与两张隐藏卡不相邻，初始没有任何宇宙连接（靠 [action] 逐张铺路）。
  assert.deepEqual(loc(state, COSMIC_INGRESS).connections, [])
})

test('宇宙牌库 draw/shuffle 读数：抽 3 张后剩 8，洗回后恢复', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const api = apiFor(state, { rng })
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 11)
  const drawn = api.cosmos({ draw: 3 })
  assert.equal(drawn.length, 3)
  assert.equal(new Set(drawn).size, 3)
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 8)
  assert.equal(api.cosmos({ shuffle: drawn }), 11)
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 11)
})

test('幕 [action] 花费 X 线索：抽 X 选 1 按「宇宙 -」放进网格并移动过去，其余洗回宇宙', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const inv = state.investigators[0]
  inv.clues = 2
  const api = apiFor(state, { rng, choices: ['2'] })
  const moves = bbt.behavior.actions(state, inv)
  const move = moves.find(candidate => candidate.rule === 'actCosmosTake')
  assert.ok(move)
  bbt.behavior.performAction(state, inv, move, api)
  assert.equal(inv.clues, 0, '花费 2 个线索')
  assert.notEqual(inv.location, COSMIC_INGRESS, '行动者移动到放置入场的地点')
  const placed = loc(state, inv.location)
  assert.ok(placed, '所选宇宙地点已放置入场')
  // 放在行动者原所在地点（宇宙入口 (0,0)）的相邻空格。
  const placedPosition = gridPos(state, placed.id)
  assert.ok(placedPosition)
  assert.equal(Math.abs(placedPosition.x) + Math.abs(placedPosition.y), 1, '按「宇宙 -」放在四大相邻空格之一')
  // 抽出 2 张：1 张放置、1 张洗回宇宙 → 宇宙牌库 11-2+1=10。
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 10)
  // 与宇宙入口相邻 → 双向连接。
  assert.ok(loc(state, COSMIC_INGRESS).connections.includes(placed.id))
  assert.ok(placed.connections.includes(COSMIC_INGRESS))
})

test('二维网格连接：相邻地点双向连接，隔一格不连；覆盖虚空格子时其卡洗回 lead 牌库', () => {
  const state = stateFor(2)
  setup(state)
  const api = apiFor(state)
  // 把宇宙门扉放到 (1,0)（宇宙入口右侧的虚空格子）。
  const deckBefore = state.investigators[0].deck.length
  placeInState(state, COSMIC_GATE)
  bbt.behavior.placeCosmosLocation(state, api, COSMIC_GATE, { position: { x: 1, y: 0 } })
  assert.deepEqual(gridPos(state, COSMIC_GATE), { x: 1, y: 0 })
  assert.equal(state.investigators[0].deck.length, deckBefore + 1, '被覆盖的虚空格子卡洗回 lead 牌库')
  assert.deepEqual([...loc(state, COSMIC_GATE).connections].sort(), [COSMIC_INGRESS])
  assert.ok(loc(state, COSMIC_INGRESS).connections.includes(COSMIC_GATE))
  // 把另一张放到 (2,0)：与 (1,0) 相邻、与 (0,0) 隔一格；隐藏卡可能在 (2,±1)，也算相邻。
  placeInState(state, PATHWAY[0])
  bbt.behavior.placeCosmosLocation(state, api, PATHWAY[0], { position: { x: 2, y: 0 } })
  assert.ok(loc(state, PATHWAY[0]).connections.includes(COSMIC_GATE), '与相邻地点连接')
  assert.equal(loc(state, PATHWAY[0]).connections.includes(COSMIC_INGRESS), false, '隔一格不连接')
  // 相邻的隐藏卡（(2,1)/(2,-1)）也是网格邻居 → 应连接。
  const hiddenNeighbors = [HIDEOUS_PALACE, 'infinityOfDarkness3', 'dancersMist1', 'dancersMist2', 'dancersMist3',
    'flightIntoOblivion1', 'flightIntoOblivion2', 'flightIntoOblivion3', 'pathwayIntoVoid1', 'pathwayIntoVoid2']
    .filter(id => id !== PATHWAY[0] && positionOf(state, id))
    .filter(id => {
      const position = positionOf(state, id)
      return Math.abs(position.x - 2) + Math.abs(position.y - 0) === 1
    })
  assert.deepEqual([...loc(state, PATHWAY[0]).connections].sort(), [...new Set([COSMIC_GATE, ...hiddenNeighbors])].sort())
})

test('「宇宙 -」按行动者位置选格位：05340 任意方向 = 行动者四方向空格', () => {
  const state = stateFor(2)
  setup(state)
  const api = apiFor(state)
  placeInState(state, PATHWAY[0])
  bbt.behavior.placeCosmosLocation(state, api, PATHWAY[0], { seat: 0 })
  // 行动者在宇宙入口 (0,0)；候选顺序 up/down/left/right 的第一个 → (0,1)。
  assert.deepEqual(gridPos(state, PATHWAY[0]), { x: 0, y: 1 })
  assert.ok(loc(state, PATHWAY[0]).connections.includes(COSMIC_INGRESS))
})

test('「宇宙 -」付代价改方向：舞者之雾右方被占时花 2 资源改放到相邻空位', () => {
  const state = stateFor(2)
  setup(state)
  // 先把宇宙门扉放到 (1,0)，占住宇宙入口右方的空格。
  placeInState(state, COSMIC_GATE)
  bbt.behavior.placeCosmosLocation(state, apiFor(state), COSMIC_GATE, { position: { x: 1, y: 0 } })
  const inv = state.investigators[0]
  inv.resources = 5
  placeInState(state, DANCERS_MIST[0])
  // choices：先选支付 2 资源，再选格位 (1,1)。
  const api = apiFor(state, { choices: ['pay', '1,1'] })
  bbt.behavior.placeCosmosLocation(state, api, DANCERS_MIST[0], { seat: 0 })
  assert.equal(inv.resources, 3)
  assert.deepEqual(gridPos(state, DANCERS_MIST[0]), { x: 1, y: 1 })
  assert.ok(loc(state, DANCERS_MIST[0]).connections.includes(COSMIC_GATE))
})

test('「宇宙 -」无法放置时移出游戏并洗回宇宙（参考 cosmosFail）', () => {
  const state = stateFor(2)
  setup(state)
  const api = apiFor(state)
  const deckBefore = scenarioLocationDeckInfo(state, 'cosmos').deck
  const fill = (id, x, y) => {
    placeInState(state, id)
    bbt.behavior.placeCosmosLocation(state, api, id, { position: { x, y } })
  }
  // 把宇宙入口 (0,0) 的四个相邻格位都填成地点：默认方向与「相邻已揭示地点的空位」都没有候选。
  fill(COSMIC_GATE, 0, 1)
  fill(PATHWAY[0], 0, -1)
  fill(PATHWAY[1], 1, 0)
  fill(DANCERS_MIST[0], -1, 0)
  placeInState(state, FLIGHT[1])
  bbt.behavior.placeCosmosLocation(state, api, FLIGHT[1], { seat: 0 })
  assert.equal(loc(state, FLIGHT[1]), undefined, '无合法放置位置 → 移出游戏')
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, deckBefore + 1, '并被洗回宇宙牌库')
})

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------

test('三个枢纽回合结束补线索到 3/4/6', () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, COURT)
  for (const id of [COSMIC_INGRESS, HIDEOUS_PALACE, COURT]) {
    const location = loc(state, id)
    location.clues = 0
  }
  bbt.behavior.roundEnded(state, apiFor(state))
  assert.equal(loc(state, COSMIC_INGRESS).clues, 3)
  assert.equal(loc(state, HIDEOUS_PALACE).clues, 4)
  assert.equal(loc(state, COURT).clues, 6)
})

test('黑色王座：隐藏值 +ceil(阿撒托斯毁灭/2)；闹鬼可选放毁灭或被打', () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, BLACK_THRONE)
  state.scenarioFlags.azathothDoom = 5
  assert.equal(bbt.behavior.locationShroudModifier(state, loc(state, BLACK_THRONE)), 3)
  // 闹鬼：选择攻击 → 3 伤害 3 恐惧。
  const api = apiFor(state, { choices: ['attack'] })
  bbt.behavior.hauntedScript(state, { scriptId: 'blackThroneHaunt', seat: 0, investigator: state.investigators[0] }, api)
  assert.equal(state.investigators[0].damage, 3)
  assert.equal(state.investigators[0].horror, 3)
  // 选择毁灭 → 阿撒托斯 +1。
  bbt.behavior.hauntedScript(state, { scriptId: 'blackThroneHaunt', seat: 0, investigator: state.investigators[1] },
    apiFor(state, { choices: ['doom'] }))
  assert.equal(state.scenarioFlags.azathothDoom, 6)
})

test('地点进入效果（条目 locationRule.onEnter）：宇宙门扉花线索/恐惧，虚空之路弃牌/伤害', () => {
  const gate = stateFor(2)
  setup(gate)
  placeInState(gate, COSMIC_GATE)
  const gateInv = gate.investigators[0]
  gateInv.clues = 1
  gateInv.location = COSMIC_GATE
  locationRuleFor('05339').onEnter.effect(gate, loc(gate, COSMIC_GATE), apiFor(gate, { choices: ['clue'] }), gateInv)
  assert.equal(gateInv.clues, 0)

  const pathway = stateFor(2)
  setup(pathway)
  placeInState(pathway, PATHWAY[0])
  const pathInv = pathway.investigators[0]
  pathInv.location = PATHWAY[0]
  locationRuleFor('05340').onEnter.effect(pathway, loc(pathway, PATHWAY[0]),
    apiFor(pathway, { choices: ['damage'] }), pathInv)
  assert.equal(pathInv.damage, 1)
})

test('虚空地点行动：洗回宇宙并把调查员与敌人移到所选枢纽', () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, DANCERS_MIST[0])
  bbt.behavior.placeCosmosLocation(state, apiFor(state), DANCERS_MIST[0], { position: { x: 2, y: 0 } })
  const inv = state.investigators[0]
  inv.location = DANCERS_MIST[0]
  state.enemies.push({ id: 'e-void', code: '05341', originalCode: '05341', location: DANCERS_MIST[0], doom: 0 })
  const moves = bbt.behavior.actions(state, inv)
  const move = moves.find(candidate => candidate.rule === `voidTo:${COSMIC_INGRESS}`)
  assert.ok(move, '虚空地点应获得「洗入宇宙并搬到枢纽」的行动')
  bbt.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(inv.location, COSMIC_INGRESS)
  assert.equal(state.enemies.find(enemy => enemy.id === 'e-void').location, COSMIC_INGRESS, '敌人一起搬到枢纽')
  assert.equal(loc(state, DANCERS_MIST[0]), undefined)
  assert.equal(positionOf(state, DANCERS_MIST[0]), null, '网格格位清空')
  assert.ok(state.extraLocationDecks.cosmos.deck.includes(DANCERS_MIST[0]))
})

// ---------------------------------------------------------------------------
// 幕 / 议程 / 阿撒托斯
// ---------------------------------------------------------------------------

test('幕 1 背面（05329）：场景 2 摆盘——皇廷+宇宙顶 2 张隐藏放 (1,2)/(1,-2)/(2,0)、7 虚空格、移到憎恶宫殿', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const api = apiFor(state, { rng })
  // 真实流程里憎恶宫殿在本幕目标达成时已被揭示；这里先揭示它，模拟「保留的枢纽」。
  api.reveal(HIDEOUS_PALACE)
  state.investigators.forEach(inv => { inv.location = HIDEOUS_PALACE })
  const draws = []
  const drawEncounter = api.drawEncounter
  api.drawEncounter = seat => { draws.push(seat); return drawEncounter(seat) }
  bbt.behavior.actReveal(state, state.acts[0], api)
  // 宇宙入口移出游戏；憎恶宫殿保留并移到 (0,0)。
  assert.equal(loc(state, COSMIC_INGRESS), undefined, '宇宙入口应移出游戏')
  assert.equal(positionOf(state, COSMIC_INGRESS), null)
  assert.deepEqual(gridPos(state, HIDEOUS_PALACE), { x: 0, y: 0 }, '保留的枢纽移到 (0,0)')
  assert.equal(bbt.behavior.currentHubId(state), COURT)
  // 3 张新卡隐藏放在场景 2 位置表，其中一张是皇廷（卡号 05334）。
  const placed = COSMOS_LAYOUTS.scene2.shuffledPositions
    .map(position => locationAt(state, position.x, position.y))
    .filter(Boolean)
  assert.equal(placed.length, 3)
  const originalCodeOf = location => String(location?.originalCode || location?.code)
  assert.equal(placed.filter(location => originalCodeOf(location) === '05334').length, 1, '皇廷在这 3 张之中')
  for (const location of placed) {
    assert.equal(location.revealed, false, '隐藏摆放在宇宙面')
    assert.equal(location.name, '宇宙')
  }
  // 7 个虚空格子：场景 1 的 6 张虚空格卡先洗回 lead 牌库（12 张），本场景取 7 张 → 剩 5 张。
  const empties = COSMOS_LAYOUTS.scene2.emptyPositions.map(position => cellAt(state, position.x, position.y))
  assert.equal(empties.length, 7)
  assert.ok(empties.every(cell => cell.kind === 'empty'))
  assert.equal(empties.filter(cell => cell.cardCode).length, 7, '每个虚空格子都放进 lead 牌库顶的卡')
  assert.equal(state.investigators[0].deck.length, 5)
  // 宇宙牌库：11 - 2（本场景抽 2 张）+ 1（场景 1 放置的宇宙卡洗回）= 10。
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 10)
  for (const inv of state.investigators) assert.equal(inv.location, HIDEOUS_PALACE)
  assert.deepEqual(draws, [0, 1])
})

test('幕 1 背面：被洗回宇宙地点的调查员阵亡、虚空格子卡洗回 lead 牌库、敌人混洗进遭遇牌库顶', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  // 把一个宇宙地点放进场、把一名调查员和一名敌人放在那里；再在遭遇牌库顶放 2 张。
  placeInState(state, DANCERS_MIST[0], { revealed: true })
  bbt.behavior.placeCosmosLocation(state, apiFor(state), DANCERS_MIST[0], { position: { x: 2, y: 0 } })
  state.investigators[0].location = HIDEOUS_PALACE // 保留的枢纽：不会被抛下
  state.investigators[1].location = DANCERS_MIST[0]
  state.enemies.push({ id: 'e1', code: '05341', originalCode: '05341', location: DANCERS_MIST[0], doom: 0 })
  state.encounterDeck.push('01166', '01167', '01168', '01169')
  const defeated = []
  const draws = []
  const api = apiFor(state, { rng })
  api.defeat = (inv, cause) => { defeated.push({ seat: inv.seat, cause }); inv.defeated = true }
  api.drawEncounter = seat => { draws.push(seat); const code = state.encounterDeck.pop(); if (code) state.encounterDiscard.push(code) }
  bbt.behavior.actReveal(state, state.acts[0], api)
  assert.deepEqual(defeated, [{ seat: 1, cause: 'abandoned' }], '被抛下的调查员阵亡')
  assert.ok(api.log.some(line => line.includes('被洗回宇宙')), '被洗回宇宙的地点离开原有实例')
  assert.equal(loc(state, COSMIC_INGRESS), undefined, '宇宙入口移出游戏')
  assert.ok(!state.enemies.some(enemy => enemy.id === 'e1'), '敌人离开场上')
  // 敌人卡与遭遇牌库顶 5 张混洗后放回顶；随后按玩家顺序的遭遇抽牌可能把顶牌抽走，
  // 因此断言「牌库+弃牌堆里恰有 1 张该敌人卡」。
  assert.equal([...state.encounterDeck, ...state.encounterDiscard].filter(code => code === '05341').length, 1, '敌人卡进入遭遇牌库')
  assert.deepEqual(draws, [0], '按玩家顺序每人抽 1 张（阵亡者不再抽）')
})

test('幕 2 背面（05330）：场景 3 摆盘——黑色王座+宇宙顶 3 张隐藏放 (1,2)/(1,-2)/(3,1)/(3,-1)、8 虚空格、移到皇廷', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const api = apiFor(state, { rng })
  api.reveal(HIDEOUS_PALACE)
  state.investigators.forEach(inv => { inv.location = HIDEOUS_PALACE })
  // 先结算幕 1 背面进入场景 2。
  bbt.behavior.actReveal(state, state.acts[0], api)
  // 找到场景 2 里那张皇廷并揭示（幕 2 目标需要它在场/被发现）。
  const court = state.locations.find(location => String(location.originalCode || location.code) === '05334')
  assert.ok(court)
  api.reveal(court.id)
  state.investigators.forEach(inv => { inv.location = court.id })
  state.actIndex = 1
  const draws = []
  const drawEncounter = api.drawEncounter
  api.drawEncounter = seat => { draws.push(seat); return drawEncounter(seat) }
  bbt.behavior.actReveal(state, state.acts[1], api)
  // 憎恶宫殿移出游戏；皇廷保留并移到 (0,0)。
  assert.equal(loc(state, HIDEOUS_PALACE), undefined, '憎恶宫殿应移出游戏')
  assert.deepEqual(gridPos(state, COURT), { x: 0, y: 0 }, '保留的皇廷移到 (0,0)')
  assert.equal(bbt.behavior.currentHubId(state), BLACK_THRONE)
  // 4 张新卡隐藏放在场景 3 位置表，其中一张是黑色王座（卡号 05335）。
  const placed = COSMOS_LAYOUTS.scene3.shuffledPositions
    .map(position => locationAt(state, position.x, position.y))
    .filter(Boolean)
  assert.equal(placed.length, 4)
  const originalCodeOf = location => String(location?.originalCode || location?.code)
  assert.equal(placed.filter(location => originalCodeOf(location) === '05335').length, 1, '黑色王座在这 4 张之中')
  for (const location of placed) {
    assert.equal(location.revealed, false)
    assert.equal(location.name, '宇宙')
  }
  // 8 个虚空格子；宇宙牌库 10 - 3（本场景抽 3 张）+ 2（场景 2 的 2 张宇宙卡洗回）= 9；
  // 调查员移到皇廷；按玩家顺序抽遭遇。
  const empties = COSMOS_LAYOUTS.scene3.emptyPositions.map(position => cellAt(state, position.x, position.y))
  assert.equal(empties.length, 8)
  assert.ok(empties.every(cell => cell.kind === 'empty'))
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 9)
  for (const inv of state.investigators) assert.equal(inv.location, COURT)
  assert.deepEqual(draws, [0, 1])
})

function locationClues(state, id, patch) {
  const location = loc(state, id)
  if (location) Object.assign(location, patch)
  return location
}

test('幕 3 目标：队长在黑色王座且该地点没有线索时推进', () => {
  const state = stateFor(2)
  setup(state)
  state.actIndex = 2
  placeInState(state, COURT)
  placeInState(state, BLACK_THRONE)
  const api = apiFor(state)
  state.investigators[0].location = BLACK_THRONE
  loc(state, BLACK_THRONE).clues = 1
  bbt.behavior.checkObjectives(state, api)
  assert.equal(state.scenarioFlags.advanced, undefined)
  loc(state, BLACK_THRONE).clues = 0
  bbt.behavior.checkObjectives(state, api)
  assert.equal(state.scenarioFlags.advanced, true)
})

test('议程推进：弃异教徒敌人并把毁灭移到阿撒托斯、抽取魔鬼的笛声', () => {
  const state = stateFor(2)
  setup(state)
  state.encounterDeck.push('05089', '01166', '05107')
  state.enemies.push({ id: 'cultist', code: '05309', originalCode: '05309', location: HIDEOUS_PALACE, doom: 2 })
  bbt.behavior.agendaReveal(state, state.agendas[0], apiFor(state, { choices: ['moveLeft'] }))
  assert.equal(state.scenarioFlags.azathothDoom, 2)
  assert.equal(state.enemies.length, 0)
  assert.ok(state.encounterDiscard.includes('05089'))
})

test('议程 05327：意志(4) 失败受到 1 伤害与 1 恐惧', () => {
  const state = stateFor(2)
  setup(state)
  bbt.behavior.agendaReveal(state, state.agendas[1], apiFor(state, {
    testResult: { success: false, value: 1, difficulty: 4 },
  }))
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].damage, 1)
})

test('议程 05328：玉米壳娃娃从阿撒托斯移除 1 点毁灭', () => {
  const state = stateFor(2, { mementosDiscovered: ['cornHuskDoll'] })
  setup(state)
  state.scenarioFlags.azathothDoom = 3
  bbt.behavior.agendaReveal(state, state.agendas[2], apiFor(state))
  assert.equal(state.scenarioFlags.azathothDoom, 2)
})

test('没有议程时：神话阶段的毁灭直接落到阿撒托斯上', () => {
  const state = stateFor(2)
  setup(state)
  state.agendaIndex = state.agendas.length
  state.doom = 1
  bbt.behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, apiFor(state))
  assert.equal(state.doom, 0)
  assert.equal(state.scenarioFlags.azathothDoom, 1)
})

test('阿撒托斯上 ≥10 毁灭：直接进入结局 1', () => {
  const state = stateFor(2)
  setup(state)
  bbt.behavior.addAzathothDoom(state, apiFor(state), 10)
  assert.equal(state.scenarioFlags.finishedKey, 'r1')
})

// 05346 阿撒托斯（reaudit-b 修复回归）：05328 背面之后「场上所有毁灭视为在阿撒托斯上」，
// 任何毁灭变化窗口把总量推到 ≥10 都必须触发吞食宇宙（→R1），不能只读 flags.azathothDoom。
test('05346：05328 吸收场上毁灭后 doomPlaced 把总量推到 10 → 结局 1', () => {
  const state = stateFor(2)
  setup(state)
  state.scenarioFlags.azathothAbsorbsAllDoom = true
  state.enemies.push({ id: 'doomed', code: '05341', originalCode: '05341', location: HIDEOUS_PALACE, doom: 9 })
  assert.equal(bbt.behavior.azathothDoom(state), 9, '吸收后阿撒托斯毁灭含场上卡牌的毁灭')
  // 模拟引擎 placeDoomOnCard：先写卡上的毁灭，再派发 doomPlaced 钩子。
  state.enemies[0].doom = 10
  bbt.behavior.doomPlaced(state, { target: state.enemies[0], amount: 1, agenda: false }, apiFor(state))
  assert.equal(bbt.behavior.azathothDoom(state), 10)
  assert.equal(state.scenarioFlags.finishedKey, 'r1')
  assert.equal(state.scenarioFlags.azathothDevoured, true)
})

test('05346：agendaReveal 置 azathothAbsorbsAllDoom 且总量已 ≥10 → 立即结局 1', () => {
  const state = stateFor(2)
  setup(state)
  state.agendaIndex = 2
  state.scenarioFlags.azathothDoom = 4
  state.enemies.push({ id: 'doomed', code: '05341', originalCode: '05341', location: HIDEOUS_PALACE, doom: 6 })
  bbt.behavior.agendaReveal(state, state.agendas[2], apiFor(state))
  assert.equal(state.scenarioFlags.azathothAbsorbsAllDoom, true)
  assert.equal(bbt.behavior.azathothDoom(state) >= 10, true)
  assert.equal(state.scenarioFlags.finishedKey, 'r1')
})

test('05346：总量 <10 不触发；已触发后不重复结算', () => {
  const state = stateFor(2)
  setup(state)
  bbt.behavior.addAzathothDoom(state, apiFor(state), 9)
  assert.equal(state.scenarioFlags.finishedKey, undefined, '9 点毁灭不触发')
  bbt.behavior.addAzathothDoom(state, apiFor(state), 1)
  assert.equal(state.scenarioFlags.finishedKey, 'r1')
  let finished = 0
  const api = apiFor(state)
  api.finish = () => { finished += 1 }
  bbt.behavior.addAzathothDoom(state, api, 1)
  assert.equal(finished, 0, '已吞食宇宙后不再重复 finish')
})

test('必竟之事背面：满足条件时也给 R4 选项（可拒绝前往 R2/R3）；否则（→R4）', () => {
  // 只满足「接受命运」两项 → R2 可用，但玩家仍可拒绝并选 R4。
  const accepted = stateFor(2, { youHaveAcceptedYourFate: true, mementosDiscovered: ['mesmerizingFlute'] })
  setup(accepted)
  bbt.behavior.actReveal(accepted, accepted.acts[2], apiFor(accepted, { choices: ['r2'] }))
  assert.equal(accepted.scenarioFlags.finishedKey, 'r2')

  const acceptedDecline = stateFor(2, { youHaveAcceptedYourFate: true, mementosDiscovered: ['mesmerizingFlute'] })
  setup(acceptedDecline)
  bbt.behavior.actReveal(acceptedDecline, acceptedDecline.acts[2], apiFor(acceptedDecline, { choices: ['r4'] }))
  assert.equal(acceptedDecline.scenarioFlags.finishedKey, 'r4', 'R2 可用时也能选择拒绝前往（→R4）')

  // 两组都满足 → 提供 R2/R3/R4 三选一。
  const both = stateFor(2, {
    youHaveAcceptedYourFate: true, youHaveRejectedYourFate: true,
    mementosDiscovered: ['mesmerizingFlute', 'scrapOfTornShadow'],
  })
  setup(both)
  bbt.behavior.actReveal(both, both.acts[2], apiFor(both, { choices: ['r3'] }))
  assert.equal(both.scenarioFlags.finishedKey, 'r3')

  const bothDecline = stateFor(2, {
    youHaveAcceptedYourFate: true, youHaveRejectedYourFate: true,
    mementosDiscovered: ['mesmerizingFlute', 'scrapOfTornShadow'],
  })
  setup(bothDecline)
  bbt.behavior.actReveal(bothDecline, bothDecline.acts[2], apiFor(bothDecline, { choices: ['r4'] }))
  assert.equal(bothDecline.scenarioFlags.finishedKey, 'r4', '两组都满足时也能选择 R4')

  // 两组都不满足 → （→R4），不再直接弹 R5/R1；由 resolution('r4') 结算黑书。
  const neither = stateFor(2)
  setup(neither)
  bbt.behavior.actReveal(neither, neither.acts[2], apiFor(neither, { choices: ['r4', 'r1'] }))
  assert.equal(neither.scenarioFlags.finishedKey, 'r4')
  // R4：签名 → 记录黑书 + 全员 2/2 创伤。
  const sign = stateFor(2)
  setup(sign)
  const result = bbt.behavior.resolution(sign, 'r4', [], apiFor(sign, { choices: ['r5'] }))
  assert.equal(sign.campaign.records.theInvestigatorsSignedTheBlackBookOfAzathoth, true)
  assert.equal(result.award, true)
  assert.equal(result.bonus, 10)
})

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------

test('骷髅标记：max(2, ceil(毁灭/2))，困难为 max(2, 毁灭)', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  for (const difficulty of ['easy', 'standard']) {
    state.difficulty = difficulty
    state.scenarioFlags.azathothDoom = 0
    assert.equal(bbt.behavior.resolveChaosToken(state, inv, 'skull', apiFor(state)).delta, -2)
    state.scenarioFlags.azathothDoom = 7
    assert.equal(bbt.behavior.resolveChaosToken(state, inv, 'skull', apiFor(state)).delta, -4)
  }
  for (const difficulty of ['hard', 'expert']) {
    state.difficulty = difficulty
    state.scenarioFlags.azathothDoom = 7
    assert.equal(bbt.behavior.resolveChaosToken(state, inv, 'skull', apiFor(state)).delta, -7)
    state.scenarioFlags.azathothDoom = 20
    assert.equal(bbt.behavior.resolveChaosToken(state, inv, 'skull', apiFor(state)).delta, -20)
  }
})

test('异教徒标记：再揭示 1 个；失败时查找异教徒敌人并抽取', () => {
  const state = stateFor(2)
  setup(state)
  const result = bbt.behavior.resolveChaosToken(state, state.investigators[0], 'cultist', apiFor(state))
  assert.equal(result.delta, 0)
  assert.equal(result.drawAnother, true)
  assert.deepEqual(result.onFail, [{ type: 'drawEnemyTrait', amount: 'Cultist' }])
})

test('石板/古神标记：难度取值；石板失败时阿撒托斯攻击你', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  for (const difficulty of ['easy', 'hard']) {
    state.difficulty = difficulty
    assert.equal(bbt.behavior.resolveChaosToken(state, inv, 'tablet', apiFor(state)).delta,
      difficulty === 'hard' ? -3 : -2)
    assert.equal(bbt.behavior.resolveChaosToken(state, inv, 'elderthing', apiFor(state)).delta,
      difficulty === 'hard' ? -6 : -4)
  }
  bbt.behavior.afterTest(state, inv, {
    success: false, difficulty: 3, value: 1, drawn: ['tablet'], cancelledTokens: [],
  }, apiFor(state))
  assert.equal(inv.damage, 3)
  assert.equal(inv.horror, 3)
  // 成功时不攻击。
  bbt.behavior.afterTest(state, state.investigators[1], {
    success: true, difficulty: 3, value: 4, drawn: ['tablet'], cancelledTokens: [],
  }, apiFor(state))
  assert.equal(state.investigators[1].damage, 0)
})

test('古神标记：本次检定修正技能值为 0 时在阿撒托斯上放 1 毁灭', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const token = bbt.behavior.resolveChaosToken(state, inv, 'elderthing', apiFor(state))
  assert.equal(token.delta, -4, '标准难度 -4')
  // 卡面判「本次检定经过修正后的技能值是否为 0」：在结果落定后判定（afterTest），
  // 旧实现在 token 揭示时读修正前的值，会漏掉 -4/-6 把最终值压到 0 的情形。
  bbt.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 4, drawn: ['elderthing'], cancelledTokens: [] }, apiFor(state))
  assert.equal(state.scenarioFlags.azathothDoom, 1)
  bbt.behavior.afterTest(state, inv,
    { success: true, value: 2, difficulty: 4, drawn: ['elderthing'], cancelledTokens: [] }, apiFor(state))
  assert.equal(state.scenarioFlags.azathothDoom, 1, '最终值非 0 时不再放毁灭')
})

// ---------------------------------------------------------------------------
// 诡计
// ---------------------------------------------------------------------------

test('05342 究极混沌：失败附属计时，3 张时放毁灭或攻击全员', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const failApi = apiFor(state, { testResult: { success: false, value: 1, difficulty: 4 } })
  bbt.behavior.resolveEncounter(state, inv, { originalCode: '05342' }, failApi)
  assert.equal(state.scenarioFlags.ultimateChaos, 1)
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
  assert.equal(state.scenarioFlags.pendingSurge, true)
  bbt.behavior.resolveEncounter(state, inv, { originalCode: '05342' }, failApi)
  bbt.behavior.resolveEncounter(state, inv, { originalCode: '05342' }, apiFor(state, {
    testResult: { success: false, value: 1, difficulty: 4 }, choices: ['doom'],
  }))
  assert.equal(state.scenarioFlags.ultimateChaos, 0)
  assert.equal(state.scenarioFlags.azathothDoom, 1)
})

test('05343 耳语契约：放 1 毁灭或阿撒托斯攻击你', () => {
  const doom = stateFor(2)
  setup(doom)
  bbt.behavior.resolveEncounter(doom, doom.investigators[0], { originalCode: '05343' },
    apiFor(doom, { choices: ['doom'] }))
  assert.equal(doom.scenarioFlags.azathothDoom, 1)

  const attack = stateFor(2)
  setup(attack)
  bbt.behavior.resolveEncounter(attack, attack.investigators[0], { originalCode: '05343' },
    apiFor(attack, { choices: ['attack'] }))
  assert.equal(attack.investigators[0].damage, 3)
})

test('05344 终结将至：难度 = 1 + 当前议程编号；失败把异教徒毁灭移到阿撒托斯', () => {
  const state = stateFor(2)
  setup(state)
  state.agendaIndex = 1
  state.enemies.push({ id: 'cultist', code: '05309', originalCode: '05309', location: HIDEOUS_PALACE, doom: 2 })
  const api = apiFor(state, { testResult: { success: false, value: 0, difficulty: 3 } })
  bbt.behavior.resolveEncounter(state, state.investigators[0], { originalCode: '05344' }, api)
  assert.equal(state.scenarioFlags.azathothDoom, 2)
  assert.equal(state.enemies[0].doom, 0)
})

test('05345 黑暗世界：按阿撒托斯毁灭逐项选择；无毁灭时获得涌动', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  state.scenarioFlags.azathothDoom = 2
  bbt.behavior.resolveEncounter(state, inv, { originalCode: '05345' }, apiFor(state, {
    choices: ['resource', 'damage'],
  }))
  assert.equal(inv.resources, 4)
  assert.equal(inv.damage, 1)

  const empty = stateFor(2)
  setup(empty)
  bbt.behavior.resolveEncounter(empty, empty.investigators[0], { originalCode: '05345' }, apiFor(empty))
  assert.equal(empty.scenarioFlags.pendingSurge, true)
  assert.equal(bbt.behavior.encounterGainsSurge(empty), true)
  assert.equal(bbt.behavior.encounterGainsSurge(empty), false)
})

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------

test('结局 1：吞食宇宙，全员死亡且战役失败', () => {
  const state = stateFor(2)
  setup(state)
  const result = bbt.behavior.resolution(state, 'r1', [], apiFor(state))
  assert.deepEqual(result, { award: false, bonus: 0 })
  assert.equal(state.campaign.records.azathothDevouredTheUniverse, true)
  assert.equal(state.campaign.failed, true)
  assert.deepEqual(state.campaign.investigators.map(record => record.status), ['killed', 'killed'])
})

test('结局 2：记录队长加入吹笛人、全员 2 点精神创伤、+5 XP', () => {
  const state = stateFor(2)
  setup(state)
  const result = bbt.behavior.resolution(state, 'r2', [], apiFor(state))
  assert.deepEqual(result, { award: true, bonus: 5 })
  assert.equal(state.campaign.records.theLeadInvestigatorHasJoinedThePipersOfAzathoth, true)
  assert.equal(state.campaign.records.azathothSlumbersForNow, true)
  assert.deepEqual(state.campaign.investigators.map(record => record.trauma.mental), [2, 2])
})

test('结局 4 选择签名 → 结局 5；拒绝 → 结局 1', () => {
  const signed = stateFor(2)
  setup(signed)
  bbt.behavior.resolution(signed, 'r4', [], apiFor(signed, { choices: ['r5'] }))
  assert.equal(signed.campaign.records.theInvestigatorsSignedTheBlackBookOfAzathoth, true)
  assert.deepEqual(signed.campaign.investigators.map(record => record.trauma),
    [{ physical: 2, mental: 2 }, { physical: 2, mental: 2 }])

  const refused = stateFor(2)
  setup(refused)
  bbt.behavior.resolution(refused, 'r4', [], apiFor(refused, { choices: ['r1'] }))
  assert.equal(refused.campaign.records.azathothDevouredTheUniverse, true)
})

test('结局 6：逆转咒语记录 + 全员 1/1 创伤；未知结局抛错', () => {
  const state = stateFor(2)
  setup(state)
  bbt.behavior.resolution(state, 'r6', [], apiFor(state))
  assert.equal(state.campaign.records.theInvestigatorsReversedTheIncantation, true)
  assert.deepEqual(state.campaign.investigators.map(record => record.trauma),
    [{ physical: 1, mental: 1 }, { physical: 1, mental: 1 }])
  assert.throws(() => bbt.behavior.resolution(state, 'r9', [], apiFor(state)), /未知黑色王座结局/)
})

// ---------------------------------------------------------------------------
// 存档 / 确定性
// ---------------------------------------------------------------------------

test('同一路线确定性 + 存档往返（JSON.stringify / deepEqual）', () => {
  const build = () => {
    const state = stateFor(2, { thePathWindsBeforeYou: 1 })
    const { rng } = setup(state, { seed: 91 })
    const api = apiFor(state, { rng })
    placeInState(state, DANCERS_MIST[0])
    bbt.behavior.placeCosmosLocation(state, api, DANCERS_MIST[0], { position: { x: 2, y: 0 } })
    state.encounterDeck.push('05089')
    state.enemies.push({ id: 'cultist', code: '05309', originalCode: '05309', location: DANCERS_MIST[0], doom: 1 })
    bbt.behavior.agendaReveal(state, state.agendas[0], apiFor(state, { rng }))
    bbt.behavior.addAzathothDoom(state, api, 3)
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同一路线必须产生相同状态')
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.extraLocationDecks, first.extraLocationDecks)
  assert.deepEqual(restored.locations.map(location => [location.id, location.revealed, location.clues]),
    first.locations.map(location => [location.id, location.revealed, location.clues]))
  // 网格状态是纯 JSON：存档往返后位置/虚空格子保持一致。
  assert.deepEqual(gridOf(restored), gridOf(first))
  // 恢复后的状态可以继续跑同一个钩子。
  const inv = restored.investigators[0]
  assert.doesNotThrow(() => bbt.behavior.resolveChaosToken(restored, inv, 'skull', apiFor(restored)))
})

test('第四轮接线：05342 不可取消声明与玩家顺序攻击、05346 防御性免疫钩子', () => {
  // 05342 卡面「不能被取消」：state.scenario.treacheries[05342].cannotBeCanceledRevelation。
  assert.equal(definition.treacheries['05342'].cannotBeCanceledRevelation, true)
  // 05346 阿撒托斯：即便被错误生成到场，也不能被击败/攻击/躲避（防御性内容钩子）。
  const state = stateFor(3)
  state.campaign.leadSeat = 1
  const azathoth = { originalCode: AZATHOTH, code: AZATHOTH, name: '阿撒托斯' }
  assert.equal(bbt.behavior.enemyCanBeDefeated(state, azathoth), false)
  assert.equal(bbt.behavior.canFightEnemy(state, state.investigators[0], azathoth), false)
  assert.equal(bbt.behavior.canEvadeEnemy(state, state.investigators[0], azathoth), false)
  // 05346 免疫：即便被异常路径生成实体，也拒绝被攻击/反击/受到伤害（content 防御钩子）。
  assert.equal(bbt.behavior.enemyCannotBeAttacked(state, azathoth), true)
  assert.equal(bbt.behavior.enemyCannotAttack(state, azathoth), true)
  assert.equal(bbt.behavior.canOpportunityAttack(state, azathoth), false)
  assert.equal(bbt.behavior.enemyDamageAllowed(state, azathoth), false)
  assert.equal(bbt.behavior.canEngageEnemy(state, state.investigators[0], azathoth), false)
  // 05342 第三张触发：阿撒托斯按玩家顺序攻击（队长 seat1 → 2 → 0），不是座位顺序。
  state.scenarioFlags.ultimateChaos = 2
  const api = apiFor(state, { testResult: { success: false, value: 0, difficulty: 4 }, choices: ['attack'] })
  bbt.behavior.resolveEncounter(state, state.investigators[0],
    { originalCode: '05342', code: '05342', name: '究极混沌' }, api)
  const attacks = api.log.filter(line => line.includes('阿撒托斯攻击'))
  assert.deepEqual(attacks.map(line => line.match(/调查员(\d)/)?.[1]), ['2', '3', '1'])
})

test('05341 盲目舞者：进入虚空格用 cosmos 格位表达（穿越虚空格后再次猎手，每轮一次）', () => {
  const state = stateFor(1)
  state.scenarioFlags.cosmos = { cells: {}, posOf: {}, scene: 'scene1' }
  placeInState(state, COSMIC_INGRESS, { revealed: true })
  placeInState(state, COURT, { revealed: true })
  setLocationPosition(state, COSMIC_INGRESS, 0, 0)
  setLocationPosition(state, COURT, 2, 0)
  // 起点与目标之间只隔一个虚空格（参考实现里舞者可进入它并因此再结算一次猎手）。
  setEmptySpace(state, 1, 0, { cardCode: 'deck0-0', ownerSeat: 0 })
  refreshConnections(state)
  const investigator = state.investigators[0]
  investigator.location = COURT
  const dancer = {
    id: 'dancer', code: '05341', originalCode: '05341', name: '盲目舞者',
    location: COSMIC_INGRESS, traits: ['Monster'], hunter: true, exhausted: false, damage: 2, doom: 0,
  }
  state.enemies.push(dancer)
  const api = apiFor(state)
  assert.equal(bbt.behavior.hunterMove(state, dancer, api), true)
  assert.equal(dancer.location, COURT, '穿过虚空格后到达远端地点（进入虚空格 + 再次猎手的净结果）')
  assert.ok(api.log.some(line => line.includes('虚空格')), '日志标注虚空格表达')
  assert.equal(state.scenarioFlags.dancerVoidRound, state.round, '每轮一次记账')
  assert.equal(state.scenarioFlags.dancerVoidCell, undefined, '落到地点后清空虚空格标记')
})

test('05341 盲目舞者：本轮再次猎手已用 → 进入虚空格并停住，下一轮从虚空格继续移动', () => {
  const state = stateFor(1)
  state.scenarioFlags.cosmos = { cells: {}, posOf: {}, scene: 'scene1' }
  placeInState(state, COSMIC_INGRESS, { revealed: true })
  placeInState(state, COURT, { revealed: true })
  setLocationPosition(state, COSMIC_INGRESS, 0, 0)
  setLocationPosition(state, COURT, 2, 0)
  setEmptySpace(state, 1, 0, { cardCode: 'deck0-0', ownerSeat: 0 })
  refreshConnections(state)
  state.investigators[0].location = COURT
  const dancer = {
    id: 'dancer', code: '05341', originalCode: '05341', name: '盲目舞者',
    location: COSMIC_INGRESS, traits: ['Monster'], hunter: true, exhausted: false, damage: 2, doom: 0,
  }
  state.enemies.push(dancer)
  state.scenarioFlags.dancerVoidRound = state.round // 本轮强制已用
  assert.equal(bbt.behavior.hunterMove(state, dancer, apiFor(state)), true)
  assert.equal(dancer.location, COSMIC_INGRESS, '虚空格不是 location：锚点位置暂不变')
  assert.deepEqual(state.scenarioFlags.dancerVoidCell, { x: 1, y: 0 }, '停在虚空格中（格位表达）')
  // 在虚空格中时：调查员无法在锚点位置攻击/躲避/交战它（虚空格不是可进入的 location）。
  assert.equal(bbt.behavior.canFightEnemy(state, state.investigators[0], dancer), false)
  assert.equal(bbt.behavior.canEvadeEnemy(state, state.investigators[0], dancer), false)
  assert.equal(bbt.behavior.canEngageEnemy(state, state.investigators[0], dancer), false)
  assert.equal(bbt.behavior.enemyCannotBeAttacked(state, dancer), true)
  // 下一轮：从虚空格继续猎手移动，一步落到地点并清空标记。
  state.round += 1
  assert.equal(bbt.behavior.hunterMove(state, dancer, apiFor(state)), true)
  assert.equal(dancer.location, COURT, '下一轮从虚空格继续移动到地点')
  assert.equal(state.scenarioFlags.dancerVoidCell, undefined)
  assert.notEqual(bbt.behavior.canFightEnemy(state, state.investigators[0], dancer), false)
})

test('05341 盲目舞者：连续两格虚空格时停在第二格，下一轮继续（不再原地不动）', () => {
  const state = stateFor(1)
  state.scenarioFlags.cosmos = { cells: {}, posOf: {}, scene: 'scene1' }
  placeInState(state, COSMIC_INGRESS, { revealed: true })
  placeInState(state, COURT, { revealed: true })
  setLocationPosition(state, COSMIC_INGRESS, 0, 0)
  setLocationPosition(state, COURT, 3, 0)
  setEmptySpace(state, 1, 0, { cardCode: 'deck0-0', ownerSeat: 0 })
  setEmptySpace(state, 2, 0, { cardCode: 'deck0-1', ownerSeat: 0 })
  refreshConnections(state)
  state.investigators[0].location = COURT
  const dancer = {
    id: 'dancer', code: '05341', originalCode: '05341', name: '盲目舞者',
    location: COSMIC_INGRESS, traits: ['Monster'], hunter: true, exhausted: false, damage: 2, doom: 0,
  }
  state.enemies.push(dancer)
  assert.equal(bbt.behavior.hunterMove(state, dancer, apiFor(state)), true)
  assert.equal(dancer.location, COSMIC_INGRESS)
  assert.deepEqual(state.scenarioFlags.dancerVoidCell, { x: 2, y: 0 }, '进入+再次猎手共走两格，停在第二格虚空格')
  state.round += 1
  assert.equal(bbt.behavior.hunterMove(state, dancer, apiFor(state)), true)
  assert.equal(dancer.location, COURT, '下一轮从第二格虚空格继续移动到地点')
})

test('05341 盲目舞者：Spawn - Farthest empty space（锚点地点 + 虚空格位置记录）', () => {
  const state = stateFor(1)
  state.scenarioFlags.cosmos = { cells: {}, posOf: {}, scene: 'scene1' }
  placeInState(state, COSMIC_INGRESS, { revealed: true })
  placeInState(state, COURT, { revealed: true })
  setLocationPosition(state, COSMIC_INGRESS, 0, 0)
  setLocationPosition(state, COURT, 3, 0)
  setEmptySpace(state, 1, 0, { cardCode: 'deck0-0', ownerSeat: 0 })
  setEmptySpace(state, 2, 0, { cardCode: 'deck0-1', ownerSeat: 0 })
  refreshConnections(state)
  state.investigators[0].location = COSMIC_INGRESS
  // 最远虚空格是 (2,0)（离调查员 2 格）；离它最近的在场地点是皇廷（1 格）。
  assert.equal(bbt.behavior.spawnLocation(state, '05341', 'fallback'), COURT,
    '引擎锚点 = 离最远虚空格最近的在场地点')
  assert.deepEqual(state.scenarioFlags.pendingDancerVoidCell, { x: 2, y: 0 })
  const dancer = {
    id: 'dancer', code: '05341', originalCode: '05341', name: '盲目舞者',
    location: COURT, traits: ['Monster'], hunter: true, exhausted: false, damage: 2, doom: 0,
  }
  state.enemies.push(dancer)
  bbt.behavior.enemySpawned(state, dancer, apiFor(state))
  assert.deepEqual(state.scenarioFlags.dancerVoidCell, { x: 2, y: 0 }, '舞者实际位于最远虚空格')
  assert.equal(state.scenarioFlags.pendingDancerVoidCell, undefined)
})


