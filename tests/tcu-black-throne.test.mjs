// 《黑色王座》（05325）章节测试：钩子级。覆盖 Cosmos 地点牌库（build/draw/take/shuffle）、
// 放置方向表、三幕/三议程、阿撒托斯毁灭计时、4 张诡计、地点进入/枢纽补线索、
// 混乱标记四难度、结局记录、存档往返与确定性。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as bbt from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/index.js'
import {
  scenario as definition, AZATHOTH, BLACK_THRONE, COSMIC_GATE, COSMIC_INGRESS, COSMOS_DECK_IDS,
  COURT, DANCERS_MIST, FLIGHT, HIDEOUS_PALACE, INFINITY, PATHWAY,
} from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/definition.js'
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
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
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

function placeInState(state, id, { revealed = false } = {}) {
  if (loc(state, id)) return loc(state, id)
  const base = state.scenario.locations[id]
  assert.ok(base, `缺少地点定义 ${id}`)
  const clues = revealed
    ? (base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators)
    : 0
  const location = {
    ...clone(base), id, revealed,
    clues, maxClues: base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators,
    doom: 0,
    connections: [...(base.connections || [])],
  }
  state.locations.push(location)
  return location
}

function setup(state, { seed = 11, place = true } = {}) {
  const rng = setupApi(seed)
  const placed = bbt.behavior.setupLocations(state, [], rng)
  if (place) for (const id of placed) placeInState(state, id, { revealed: true })
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
      if (options2.build) {
        const { buildScenarioLocationDeck } = options2.engine || {}
        void buildScenarioLocationDeck
      }
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
        if (options2.from) {
          for (const inv of state.investigators.filter(item => item.location === options2.from)) inv.location = picked
          for (const enemy of state.enemies.filter(item => item.location === options2.from)) enemy.location = picked
        }
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

test('枢纽主链：宇宙入口↔憎恶宫殿↔皇廷↔黑王座', () => {
  const connections = id => bbt.scenario.locations[id].connections
  assert.ok(connections(COSMIC_INGRESS).includes(HIDEOUS_PALACE))
  assert.ok(connections(HIDEOUS_PALACE).includes(COSMIC_INGRESS))
  assert.ok(connections(HIDEOUS_PALACE).includes(COURT))
  assert.ok(connections(COURT).includes(HIDEOUS_PALACE))
  assert.ok(connections(COURT).includes(BLACK_THRONE))
  assert.ok(connections(BLACK_THRONE).includes(COURT))
  assert.deepEqual(connections(COSMIC_INGRESS).filter(id => id.startsWith('dancers')), [])
})

// ---------------------------------------------------------------------------
// 布置 / Cosmos 牌库
// ---------------------------------------------------------------------------

test('布置：宇宙牌库 12 张、两个枢纽入场、参考卡资源与虚空格子记账', () => {
  const state = stateFor(2, { thePathWindsBeforeYou: 2 })
  const { placed } = setup(state)
  assert.deepEqual(placed, [COSMIC_INGRESS, HIDEOUS_PALACE])
  assert.equal(bbt.behavior.cosmosOrder(state).length, 0)
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 12)
  assert.equal(state.scenarioFlags.pathWinds, 2)
  assert.equal(state.scenarioFlags.referenceResources, 2)
  assert.equal(state.scenarioFlags.emptySpaceCount, 6)
  assert.equal(state.scenarioFlags.azathothDoom, 0)
  assert.deepEqual(state.scenarioZones.setAside.sort(), ['05088', '05334', '05335'].sort())
})

test('宇宙牌库 draw/shuffle 读数：抽 3 张后剩 9，洗回后恢复', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const api = apiFor(state, { rng })
  const drawn = api.cosmos({ draw: 3 })
  assert.equal(drawn.length, 3)
  assert.equal(new Set(drawn).size, 3)
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 9)
  assert.equal(api.cosmos({ shuffle: drawn }), 12)
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 12)
})

test('幕 [action] 花费 X 线索：抽取宇宙顶 X 选 1 放置并移动过去，其余回牌库底', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const inv = state.investigators[0]
  inv.clues = 2
  const api = apiFor(state, { rng, choices: ['2'] })
  const moves = bbt.behavior.actions(state, inv)
  const move = moves.find(candidate => candidate.rule === 'actCosmosTake')
  assert.ok(move)
  bbt.behavior.performAction(state, inv, move, api)
  assert.equal(inv.clues, 0)
  assert.equal(state.locations.length, 3, '两个枢纽 + 1 张宇宙地点')
  const placed = state.locations.find(location => !['cosmicIngress', 'hideousPalace'].includes(location.id))
  assert.ok(placed)
  assert.equal(inv.location, placed.id)
  assert.equal(placed.revealed, true)
  assert.ok(placed.connections.includes(HIDEOUS_PALACE), '应按「宇宙 -」连到当前枢纽')
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 11)
  assert.ok(bbt.behavior.cosmosOrder(state).includes(placed.id))
})

test('「宇宙 -」放置方向表：右/下接最近放置者，上接最早放置者', () => {
  const state = stateFor(2)
  setup(state)
  const api = apiFor(state)
  const place = id => {
    placeInState(state, id)
    bbt.behavior.placeCosmosLocation(state, api, id)
    return loc(state, id)
  }
  const gate = place(COSMIC_GATE)
  assert.deepEqual(gate.connections.filter(id => id === HIDEOUS_PALACE), [HIDEOUS_PALACE])
  const dancers = place(DANCERS_MIST[0])
  assert.ok(dancers.connections.includes(COSMIC_GATE), '右方连接最近放置者')
  const flight = place(FLIGHT[0])
  assert.ok(flight.connections.includes(COSMIC_GATE), '上方连接最早放置者')
  assert.equal(flight.connections.includes(dancers.id), false)
  const infinity = place(INFINITY[0])
  assert.ok(infinity.connections.includes(FLIGHT[0]), '下方连接最近放置者')
  assert.equal(bbt.behavior.cosmosOrder(state).length, 4)
  // 枢纽也获得反向连接，可从枢纽走出去。
  assert.ok(loc(state, HIDEOUS_PALACE).connections.includes(dancers.id))
})

test('「宇宙 -」付代价改方向：舞者之雾可花 2 资源连到任意已放置地点', () => {
  const state = stateFor(2)
  setup(state)
  const api = apiFor(state, { choices: ['pay', COSMIC_GATE] })
  placeInState(state, COSMIC_GATE)
  bbt.behavior.placeCosmosLocation(state, apiFor(state), COSMIC_GATE)
  const inv = state.investigators[0]
  inv.resources = 5
  placeInState(state, DANCERS_MIST[0])
  bbt.behavior.placeCosmosLocation(state, api, DANCERS_MIST[0], { seat: 0 })
  assert.equal(inv.resources, 3)
  assert.ok(loc(state, DANCERS_MIST[0]).connections.includes(COSMIC_GATE))
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

test('虚空地点行动：洗回宇宙并把调查员移到所选枢纽', () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, DANCERS_MIST[0])
  bbt.behavior.placeCosmosLocation(state, apiFor(state), DANCERS_MIST[0])
  const inv = state.investigators[0]
  inv.location = DANCERS_MIST[0]
  const moves = bbt.behavior.actions(state, inv)
  const move = moves.find(candidate => candidate.rule === `voidTo:${COSMIC_INGRESS}`)
  assert.ok(move, '虚空地点应获得「洗入宇宙并搬到枢纽」的行动')
  bbt.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(inv.location, COSMIC_INGRESS)
  assert.equal(loc(state, DANCERS_MIST[0]), undefined)
  assert.ok(state.extraLocationDecks.cosmos.deck.includes(DANCERS_MIST[0]))
})

// ---------------------------------------------------------------------------
// 幕 / 议程 / 阿撒托斯
// ---------------------------------------------------------------------------

test('幕 1 背面：标记皇廷为枢纽、抽 2 张宇宙地点、调查员移到憎恶宫殿', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const api = apiFor(state, { rng })
  bbt.behavior.actReveal(state, state.acts[0], api)
  assert.ok(loc(state, COURT), '皇廷应入场')
  assert.equal(bbt.behavior.currentHubId(state), COURT)
  assert.equal(bbt.behavior.cosmosOrder(state).length, 2)
  for (const inv of state.investigators) assert.equal(inv.location, HIDEOUS_PALACE)
  // 05329 背面：宇宙入口移出游戏；虚空格子数按卡面放置图（7 个）。
  assert.equal(loc(state, COSMIC_INGRESS), undefined, '宇宙入口应移出游戏')
  assert.equal(state.scenarioFlags.emptySpaceCount, 7)
})

test('幕 1 背面：被洗回宇宙地点的调查员阵亡、敌人混洗进遭遇牌库顶、按玩家顺序抽遭遇', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  // 把一个地点放进场、把一名调查员和一名敌人放在那里；再在遭遇牌库顶放 2 张。
  placeInState(state, DANCERS_MIST[0], { revealed: true })
  state.investigators[0].location = HIDEOUS_PALACE // 例外地点：不会被抛下
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

test('幕 2 背面：标记黑色王座为枢纽、抽 3 张宇宙地点、调查员移到皇廷', () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const api = apiFor(state, { rng })
  state.actIndex = 1
  placeInState(state, COURT, { revealed: true })
  locationClues(state, COURT, { clues: 0 })
  bbt.behavior.actReveal(state, state.acts[1], api)
  assert.ok(loc(state, BLACK_THRONE))
  assert.equal(bbt.behavior.currentHubId(state), BLACK_THRONE)
  assert.equal(bbt.behavior.cosmosOrder(state).length, 3)
  for (const inv of state.investigators) assert.equal(inv.location, COURT)
  assert.equal(loc(state, HIDEOUS_PALACE), undefined, '憎恶宫殿应移出游戏')
  assert.equal(state.scenarioFlags.emptySpaceCount, 8)
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

test('必竟之事背面：满足条件才给 R2/R3，否则（→R4）；R4 由独立结局卡结算签名/拒绝', () => {
  // 只满足「接受命运」两项 → 只提供 R2。
  const accepted = stateFor(2, { youHaveAcceptedYourFate: true, mementosDiscovered: ['mesmerizingFlute'] })
  setup(accepted)
  bbt.behavior.actReveal(accepted, accepted.acts[2], apiFor(accepted, { choices: ['r2'] }))
  assert.equal(accepted.scenarioFlags.finishedKey, 'r2')

  // 两组都满足 → 提供 R2/R3 二选一。
  const both = stateFor(2, {
    youHaveAcceptedYourFate: true, youHaveRejectedYourFate: true,
    mementosDiscovered: ['mesmerizingFlute', 'scrapOfTornShadow'],
  })
  setup(both)
  bbt.behavior.actReveal(both, both.acts[2], apiFor(both, { choices: ['r3'] }))
  assert.equal(both.scenarioFlags.finishedKey, 'r3')

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
    bbt.behavior.placeCosmosLocation(state, api, DANCERS_MIST[0])
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
  // 恢复后的状态可以继续跑同一个钩子。
  const inv = restored.investigators[0]
  assert.doesNotThrow(() => bbt.behavior.resolveChaosToken(restored, inv, 'skull', apiFor(restored)))
})
