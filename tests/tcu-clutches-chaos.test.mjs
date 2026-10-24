// 《混沌魔掌》（05284）章节测试：钩子级。覆盖裂口/入侵、双变体、幕议程、5 张诡计、
// 地点行动、混乱标记四难度、结局记录、存档往返与确定性。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as clutches from '../content/campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/index.js'
import {
  scenario as definition, VARIANT, VARIANT_ACTS, LOCATIONS, LOCATION_PAIRS, deckCodesForVariant,
} from '../content/campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/definition.js'
import { addBreach, removeBreach, breachTotal, locationSkullValue } from '../src/engine/location-state.js'

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
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'southsideA',
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
    campaign: {
      leadSeat: 0,
      records: { ...records },
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

function placeLocations(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    assert.ok(base, `缺少地点定义 ${id}`)
    state.locations.push({
      ...clone(base), id, revealed: true, doom: 0, clues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
    })
  }
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)
const byCode = (state, code) => state.locations.find(location =>
  (location.originalCode || location.code) === code)

function setup(state, { seed = 41, place = true, breaches = true } = {}) {
  const rng = setupApi(seed)
  const placed = clutches.behavior.setupLocations(state, [], rng)
  if (place) placeLocations(state, placed)
  if (breaches && place) {
    clutches.behavior.afterDeckSetup(state, [], {
      randomValue: rng.randomValue, shuffle: rng.shuffle, info: () => {},
    })
  }
  return { state, placed, rng }
}

function apiFor(state, options = {}) {
  const choices = [...(options.choices || [])]
  const log = []
  const testResult = options.testResult || { success: true, value: 3, difficulty: 3 }
  const api = {
    log,
    info: text => log.push(String(text)),
    random: options.random || (() => 0.37),
    shuffle: list => [...list],
    choose: request => (choices.length
      ? choices.shift()
      : (request?.options?.[0]?.id ?? 'skip')),
    test: (seat, skill, difficulty, resolve) => {
      const result = { ...testResult, difficulty, skill }
      if (result.value == null) result.value = difficulty
      resolve(result)
      return result
    },
    breach: (id, amount = 1) => addBreach(state, id, amount),
    removeBreach: (id, amount = 1) => removeBreach(state, id, amount),
    breachTotal: () => breachTotal(state),
    skullValue: id => locationSkullValue(state, id),
    spawn: (code, locationId) => {
      const enemy = { id: `enemy-${state.enemies.length}`, code, originalCode: code, location: locationId, doom: 0 }
      state.enemies.push(enemy)
      return enemy
    },
    finish: key => { state.scenarioFlags.finishedKey = key },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    resign: seat => { state.investigators[seat].resigned = true },
    drawEncounter: seat => {
      const code = state.encounterDeck.pop()
      if (code) state.encounterDiscard.push(code)
      return code
    },
    shuffleEncounterDeck: () => {},
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    place: id => { if (!loc(state, id)) placeLocations(state, [id]) },
    remove: id => { const index = state.locations.findIndex(item => item.id === id); if (index >= 0) state.locations.splice(index, 1) },
  }
  return api
}

function fillBreaches(state, location, amount) {
  for (let index = 0; index < amount; index++) addBreach(state, location.id, 1)
}

function southside(state) {
  return byCode(state, '05294') || byCode(state, '05295')
}

// ---------------------------------------------------------------------------
// 结构 / 身份
// ---------------------------------------------------------------------------

test('混沌魔掌：playable 清单、原卡身份与幕/议程/结局', () => {
  assert.equal(clutches.manifest.status, 'playable')
  assert.equal(clutches.manifest.campaignId, 'theCircleUndone')
  assert.equal(clutches.manifest.catalogReferenceOnly, undefined)
  assert.equal(clutches.manifest.contentVersion, '1.0.0')
  assert.equal(clutches.scenario.originalCode, '05284')
  assert.equal(clutches.behavior.id, 'inTheClutchesOfChaos')
  assert.equal(clutches.manifest.locations.length, 16)
  assert.deepEqual(clutches.manifest.acts.map(act => act.id), ['act1', 'act2'])
  assert.deepEqual(clutches.manifest.agendas.map(agenda => agenda.id), ['agenda1'])
  assert.deepEqual(Object.keys(clutches.scenario.resolutions),
    ['noResolution', 'r1', 'r2', 'r3', 'r4'])
  assert.deepEqual(clutches.manifest.resolutionIds, Object.keys(clutches.scenario.resolutions))
  assert.deepEqual(clutches.manifest.zones.setAside, [{ cardCode: '05088', count: 1 }])
  assert.equal(clutches.manifest.recordWrites.includes('doomDrawsEverCloser'), true)
  for (const group of clutches.manifest.requiredEncounterGroupIds) {
    assert.match(group, /^[a-z][A-Za-z0-9]+$/, `组 id 必须是 camelCase：${group}`)
  }
})

test('16 个地点都映射到本章两个共享组的原卡', () => {
  const codes = Object.values(LOCATIONS)
  assert.equal(new Set(codes).size, 16)
  for (const [id, code] of Object.entries(LOCATIONS)) {
    assert.equal(clutches.identities.locations[id].originalCode, code)
    assert.equal(clutches.identities.locations[id].identityStatus, 'mapped')
  }
  const musicLocations = ['hangmansHillMusic', 'silverTwilightMusic']
  const secretsLocations = ['hangmansHillSecrets', 'silverTwilightSecrets']
  assert.deepEqual(musicLocations.map(id => LOCATIONS[id]), ['05302', '05303'])
  assert.deepEqual(secretsLocations.map(id => LOCATIONS[id]), ['05304', '05305'])
})

test('印刷符号地图：南区连接五个地点，绞刑者山丘只连住宅区', () => {
  const connections = Object.fromEntries(Object.entries(definition.locations)
    .map(([id, entry]) => [id, entry.connections]))
  assert.ok(connections.southsideA.includes('rivertownA'))
  assert.ok(connections.southsideA.includes('rivertownB'))
  assert.ok(connections.southsideA.includes('southChurchA'))
  assert.ok(connections.southsideA.includes('merchantDistrictA'))
  assert.deepEqual([...connections.southChurchA].sort(), ['southsideA', 'southsideB'])
  assert.deepEqual([...connections.hangmansHillMusic].sort(), ['uptownA', 'uptownB'])
  assert.deepEqual([...connections.silverTwilightMusic].sort(), ['frenchHillA', 'frenchHillB'])
  // 同名地点的两个版本之间没有印刷连接。
  assert.equal(connections.frenchHillA.includes('frenchHillB'), false)
})

// ---------------------------------------------------------------------------
// 布置 / 双变体
// ---------------------------------------------------------------------------

test('Anette 线：幕牌库换成黑暗知识(一)/坟墓彼端，放终焉之地两地点', () => {
  const state = stateFor(2, { anetteMasonIsPossessedByEvil: true })
  const { placed } = setup(state)
  assert.equal(state.scenarioFlags.variant, 'music')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['05286a', '05287'])
  assert.deepEqual(state.acts.map(act => act.id), ['act1', 'act2'])
  assert.equal(placed.length, 8)
  assert.equal(state.scenarioFlags.chosenLocations.includes('hangmansHillMusic'), true)
  assert.equal(state.scenarioFlags.chosenLocations.includes('silverTwilightMusic'), true)
  assert.equal(state.scenarioFlags.chosenLocations.includes('hangmansHillSecrets'), false)
  assert.deepEqual(state.scenarioZones.setAside, ['05088'])
  // 六对地点各只放一个版本，未放置版本被移出游戏。
  for (const pair of LOCATION_PAIRS) {
    const inPlay = pair.ids.filter(id => placed.includes(id))
    assert.equal(inPlay.length, 1, `${pair.ids.join('/')} 应恰好放一个版本`)
  }
})

test('默认（无 Anette 记录）走宇宙之秘线：黑暗知识(二)/世界新秩序 + 银暮秘社终焉之地', () => {
  const state = stateFor(2)
  setup(state)
  assert.equal(state.scenarioFlags.variant, 'secrets')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['05288a', '05289'])
  assert.equal(state.scenarioFlags.chosenLocations.includes('hangmansHillSecrets'), true)
  assert.equal(state.scenarioFlags.chosenLocations.includes('silverTwilightSecrets'), true)
  assert.equal(state.scenarioFlags.chosenLocations.includes('hangmansHillMusic'), false)
})

test('调查员从被选中的南区版本开始，未放置版本的连线被剪掉', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = stateFor(2)
    const { placed } = setup(state, { seed })
    const startId = state.scenarioFlags.startLocation
    assert.ok(placed.includes(startId))
    assert.ok(['southsideA', 'southsideB'].includes(startId))
    for (const investigator of state.investigators) assert.equal(investigator.location, startId)
    for (const id of placed) {
      for (const connection of state.scenario.locations[id].connections) {
        assert.ok(placed.includes(connection), `${id} 连到了未放置的 ${connection}`)
      }
    }
  }
})

test('遭遇牌库按变体裁剪：Anette 线不含宇宙之秘组，Carl 线不含受诅咒的歌声组', () => {
  const music = stateFor(2, { anetteMasonIsPossessedByEvil: true })
  setup(music)
  const musicDeck = clutches.behavior.modifyDeck(music, clone(definition.encounterDeck))
  assert.ok(musicDeck.includes('05311'))
  assert.ok(musicDeck.includes('05312'))
  assert.ok(musicDeck.includes('05090'))
  assert.equal(musicDeck.includes('05309'), false)
  assert.equal(musicDeck.includes('05310'), false)
  assert.equal(musicDeck.includes('01135'), false)
  assert.ok(musicDeck.includes('05306'))

  const secrets = stateFor(2, { carlSanfordPossessesTheSecretsOfTheUniverse: true })
  setup(secrets)
  const secretsDeck = clutches.behavior.modifyDeck(secrets, clone(definition.encounterDeck))
  assert.ok(secretsDeck.includes('05309'))
  assert.ok(secretsDeck.includes('05310'))
  assert.ok(secretsDeck.includes('01135'))
  assert.equal(secretsDeck.includes('05311'), false)
  assert.equal(secretsDeck.includes('05312'), false)
  // 两变体并集静态声明（gap/approximation 记录在 scenarioApproximations）。
  assert.ok(definition.encounterDeck.includes('05311'))
  assert.ok(definition.encounterDeck.includes('05309'))
})

test('开局裂口：2 人局 2 轮×2 个，4 人局 3 轮×3 个', () => {
  const two = stateFor(2)
  setup(two)
  assert.equal(breachTotal(two), 2 * 2)
  const three = stateFor(3)
  setup(three)
  assert.equal(breachTotal(three), 3 * 2)
  const four = stateFor(4)
  setup(four)
  assert.equal(breachTotal(four), 3 * 3)
})

// ---------------------------------------------------------------------------
// 裂口 / 入侵
// ---------------------------------------------------------------------------

test('裂口上限 3：往第 4 个放时改为结算入侵（清空裂口、放毁灭、向连接地点扩散）', () => {
  const state = stateFor(2)
  setup(state)
  const center = southside(state)
  fillBreaches(state, center, 3)
  const api = apiFor(state)
  const before = state.locations.filter(location => location.id !== center.id && (location.breaches || 0) > 0).length
  const placed = clutches.behavior.placeBreachesAt(state, api, center.id, 1)
  assert.equal(placed, 0, '入侵不放置裂口')
  assert.equal(center.breaches || 0, 0, '入侵先移除该地点全部裂口')
  assert.equal(center.doom, 1, '入侵在该地点放 1 毁灭')
  const connectedWithBreach = (center.connections || [])
    .map(id => loc(state, id)).filter(location => location && (location.breaches || 0) > 0)
  assert.ok(connectedWithBreach.length >= 2, '连接地点各获得 1 个裂口')
  void before
})

test('入侵阶段保护：同一阶段已结算入侵的地点不再接收裂口', () => {
  const state = stateFor(2)
  setup(state)
  const center = southside(state)
  fillBreaches(state, center, 3)
  const api = apiFor(state)
  clutches.behavior.placeBreachesAt(state, api, center.id, 1)
  assert.equal(center.breaches || 0, 0)
  const doom = center.doom
  // 再来一次：guard 命中，不再放裂口/毁灭。
  clutches.behavior.placeBreachesAt(state, api, center.id, 1)
  assert.equal(center.doom, doom)
  // 新阶段开始时清理保护集。
  state.phase = 'mythos'
  clutches.behavior.phaseBegan(state, 'mythos')
  assert.deepEqual(state.scenarioFlags.incursionGuard.ids, [])
})

test('骷髅值 = 地点裂口 + 毁灭；困难难度骷髅标记再 -1', () => {
  const state = stateFor(2)
  setup(state)
  const target = southside(state)
  fillBreaches(state, target, 2)
  target.doom = 1
  assert.equal(locationSkullValue(state, target.id), 3)
  const inv = state.investigators[0]
  inv.location = target.id
  for (const difficulty of ['easy', 'standard']) {
    state.difficulty = difficulty
    assert.deepEqual(clutches.behavior.resolveChaosToken(state, inv, 'skull', apiFor(state)), { delta: -3 })
  }
  for (const difficulty of ['hard', 'expert']) {
    state.difficulty = difficulty
    assert.deepEqual(clutches.behavior.resolveChaosToken(state, inv, 'skull', apiFor(state)), { delta: -4 })
  }
})

test('异教徒标记：再揭示 1 个，裂口 < 3 时在所在地点补 1 裂口', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const target = loc(state, inv.location)
  fillBreaches(state, target, 2)
  const api = apiFor(state)
  const result = clutches.behavior.resolveChaosToken(state, inv, 'cultist', api)
  assert.equal(result.delta, 0)
  assert.equal(result.drawAnother, true)
  assert.equal(target.breaches, 3)
  // 已有 3 个裂口时不再放置。
  clutches.behavior.resolveChaosToken(state, inv, 'cultist', api)
  assert.equal(target.breaches, 3)
})

test('石板/古神标记按难度取值；石板失败按低于难度点数移除幕裂口', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  state.scenarioFlags.actBreaches = 2
  for (const difficulty of ['easy', 'hard']) {
    state.difficulty = difficulty
    assert.equal(clutches.behavior.resolveChaosToken(state, inv, 'tablet', apiFor(state)).delta,
      difficulty === 'hard' ? -3 : -2)
    assert.equal(clutches.behavior.resolveChaosToken(state, inv, 'elderthing', apiFor(state)).delta,
      difficulty === 'hard' ? -4 : -3)
  }
  clutches.behavior.afterTest(state, inv, {
    success: false, difficulty: 3, value: 1, drawn: ['tablet'], cancelledTokens: [],
  }, apiFor(state))
  assert.equal(state.scenarioFlags.actBreaches, 0)
})

test('古神标记失败后在随机地点放 1 裂口', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const before = breachTotal(state)
  clutches.behavior.afterTest(state, inv, {
    success: false, difficulty: 2, value: 1, drawn: ['elderthing'], cancelledTokens: [],
  }, apiFor(state))
  assert.equal(breachTotal(state), before + 1)
})

test('议程 05285：毁灭将要放到密谋时改为在「人数+1」个随机地点各放 1 裂口', () => {
  const state = stateFor(2)
  setup(state)
  const api = apiFor(state)
  const before = breachTotal(state)
  state.doom = 1
  clutches.behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, api)
  assert.equal(state.doom, 0, '毁灭被回退')
  assert.equal(breachTotal(state), before + 3, '2 人局 = 人数 + 1 = 3 个裂口')
  assert.equal(state.locations.filter(location => (location.breaches || 0) > 0).length >= 3, true)
})

// ---------------------------------------------------------------------------
// 幕 / 议程 / 首领
// ---------------------------------------------------------------------------

test('黑暗知识(一)背面：生成安妮特于绞刑者山丘并把幕裂口移到下一张幕', () => {
  const state = stateFor(2, { anetteMasonIsPossessedByEvil: true })
  setup(state)
  state.scenarioFlags.actBreaches = 2
  const api = apiFor(state)
  clutches.behavior.actReveal(state, state.acts[0], api)
  const boss = state.enemies.find(enemy => enemy.originalCode === '05286b')
  assert.ok(boss, '安妮特应生成')
  assert.equal(boss.location, clutches.behavior && state.locations.find(location =>
    location.originalCode === '05302')?.id)
  assert.equal(state.scenarioFlags.actBreaches, 2, '幕裂口随当前幕保留（移到下一张幕）')
})

test('黑暗知识(二)背面：生成卡尔于银暮秘社(终焉之地)', () => {
  const state = stateFor(2)
  setup(state)
  clutches.behavior.actReveal(state, state.acts[0], apiFor(state))
  const boss = state.enemies.find(enemy => enemy.originalCode === '05288b')
  assert.ok(boss)
  const lodge = byCode(state, '05305')
  assert.equal(boss.location, lodge.id)
})

test('坟墓彼端/世界新秩序背面：推进后进入结局 1/2', () => {
  const music = stateFor(2, { anetteMasonIsPossessedByEvil: true })
  setup(music)
  clutches.behavior.actReveal(music, music.acts[1], apiFor(music))
  assert.equal(music.scenarioFlags.finishedKey, 'r1')

  const secrets = stateFor(2)
  setup(secrets)
  clutches.behavior.actReveal(secrets, secrets.acts[1], apiFor(secrets))
  assert.equal(secrets.scenarioFlags.finishedKey, 'r2')
})

test('幕 [fast]：移除本幕 3 个裂口 → 随机地点放 1 线索', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  state.scenarioFlags.actBreaches = 4
  const moves = clutches.behavior.actions(state, inv)
  const move = moves.find(candidate => candidate.rule === 'removeActBreaches')
  assert.ok(move, '幕上有 ≥3 裂口时应出现 [fast] 行动')
  assert.equal(move.actions, 0)
  const beforeClues = state.locations.reduce((sum, location) => sum + (location.clues || 0), 0)
  clutches.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(state.scenarioFlags.actBreaches, 1)
  assert.equal(state.locations.reduce((sum, location) => sum + (location.clues || 0), 0), beforeClues + 1)
  assert.equal(clutches.behavior.actions(state, inv).some(candidate => candidate.rule === 'removeActBreaches'), false)
})

test('首领生命修正：每有 1 个被调查员控制的线索，生命 -2', () => {
  const state = stateFor(2)
  setup(state)
  const enemy = { id: 'boss', code: '05286b', originalCode: '05286b' }
  state.investigators[0].clues = 2
  state.investigators[1].clues = 1
  assert.equal(clutches.behavior.enemyStatModifier(state, enemy, 'health'), -6)
  assert.equal(clutches.behavior.enemyStatModifier(state, { originalCode: '05311' }, 'health'), 0)
})

test('敌人生成位置：秘社打手去裂口最多的地点，混沌见证者去裂口最少的地点', () => {
  const state = stateFor(2)
  setup(state)
  const [first, second, third] = state.locations
  first.breaches = 2
  second.breaches = 1
  third.breaches = 0
  assert.equal(clutches.behavior.spawnLocation(state, '05309'), first.id)
  const fewest = state.locations.filter(location => (location.breaches || 0) === 0)[0]
  assert.equal(clutches.behavior.spawnLocation(state, '05311'), fewest.id)
})

// ---------------------------------------------------------------------------
// 地点能力
// ---------------------------------------------------------------------------

test('法兰西山：弃手牌/检定成功把裂口移到当前幕', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const hill = state.locations.find(location => ['05290', '05291'].includes(location.originalCode))
  assert.ok(hill, '法兰西山应在场')
  inv.location = hill.id
  fillBreaches(state, hill, 2)
  inv.hand.push('01020')
  state.scenarioFlags.actBreaches = 0
  const beforeBreaches = hill.breaches || 0
  const moves = clutches.behavior.actions(state, inv)
  const move = moves.find(candidate => candidate.rule.startsWith('loc'))
  assert.ok(move, '有裂口时应出现地点行动')
  clutches.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal((hill.breaches || 0) < beforeBreaches, true, '裂口应被移除')
  assert.equal(state.scenarioFlags.actBreaches >= 1, true, '裂口应被移到当前幕')
})

test('南区教堂：提供撤退行动', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const church = state.locations.find(location => ['05298', '05299'].includes(location.originalCode))
  assert.ok(church, '南区教堂应在场')
  inv.location = church.id
  const resign = clutches.behavior.actions(state, inv).find(candidate => candidate.rule === 'locResign')
  assert.ok(resign)
  clutches.behavior.performAction(state, inv, resign, apiFor(state))
  assert.equal(inv.resigned, true)
})

test('商人区(3/0)：支付 2 资源把 1 个裂口移到当前幕', () => {
  const state = stateFor(2)
  setup(state)
  const market = byCode(state, '05301')
  if (!market) {
    // 另一版本 05300 是弃牌库顶行动；此测试只针对 3 版本。
    return
  }
  const inv = state.investigators[0]
  inv.location = market.id
  fillBreaches(state, market, 2)
  const move = clutches.behavior.actions(state, inv).find(candidate => candidate.rule === 'locMerchantPay')
  assert.ok(move)
  clutches.behavior.performAction(state, inv, move, apiFor(state))
  assert.equal(inv.resources, 3)
  assert.equal(market.breaches, 1)
  assert.equal(state.scenarioFlags.actBreaches, 1)
})

// ---------------------------------------------------------------------------
// 诡计
// ---------------------------------------------------------------------------

test('05306 混沌幽现：意志检定失败按低于难度点数在随机地点放裂口', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const before = breachTotal(state)
  clutches.behavior.resolveEncounter(state, inv, { originalCode: '05306' }, apiFor(state, {
    testResult: { success: false, value: 1, difficulty: 3 },
  }))
  assert.equal(breachTotal(state), before + 2)
})

test('05308 猛鬼出笼：先补 1 裂口，再按裂口+毁灭受到伤害或恐惧', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const hereLoc = loc(state, inv.location)
  hereLoc.breaches = 0
  hereLoc.doom = 1
  clutches.behavior.resolveEncounter(state, inv, { originalCode: '05308' }, apiFor(state, {
    choices: ['damage', 'horror'],
  }))
  assert.equal(hereLoc.breaches, 1, '无裂口时先补 1')
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
})

test('05312 不惮辛劳不惮烦：选择结算所在地点入侵', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const hereLoc = loc(state, inv.location)
  fillBreaches(state, hereLoc, 3)
  clutches.behavior.resolveEncounter(state, inv, { originalCode: '05312' }, apiFor(state, {
    choices: ['incursion'],
  }))
  assert.equal(hereLoc.breaches || 0, 0)
  assert.equal(hereLoc.doom, 1)
})

test('05312：选择重演遭遇弃牌堆最顶部的力量诡计', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  state.encounterDiscard.push('05306')
  const api = apiFor(state, { choices: ['power'] })
  clutches.behavior.resolveEncounter(state, inv, { originalCode: '05312' }, api)
  assert.equal(api.log.some(text => text.includes('重演遭遇弃牌堆')), true)
})

test('05310 异界之秘：按异教徒敌人上的毁灭放裂口；无目标时获得涌动', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  const target = state.locations.find(location => (location.breaches || 0) === 0) || state.locations[2]
  state.enemies.push({
    id: 'cultist', code: '05309', originalCode: '05309', location: target.id, doom: 2,
  })
  clutches.behavior.resolveEncounter(state, inv, { originalCode: '05310' }, apiFor(state))
  assert.equal(target.breaches, 2)
  // 无目标 → 涌动标记，下一次 encounterGainsSurge 返回 true 并消耗。
  state.enemies = []
  state.locations.forEach(location => { delete location.breaches })
  clutches.behavior.resolveEncounter(state, inv, { originalCode: '05310' }, apiFor(state))
  assert.equal(clutches.behavior.encounterGainsSurge(state), true)
  assert.equal(clutches.behavior.encounterGainsSurge(state), false)
})

test('05307 元初通道：附属随机地点并把裂口补到 3，可用意志检定关闭', () => {
  const state = stateFor(2)
  setup(state)
  const inv = state.investigators[0]
  clutches.behavior.resolveEncounter(state, inv, { originalCode: '05307' }, apiFor(state))
  const gateway = state.locations.find(location => location.primordialGateway === '05307')
  assert.ok(gateway, '应附属到一个地点')
  assert.equal(gateway.breaches, 3)
  inv.location = gateway.id
  const move = clutches.behavior.actions(state, inv).find(candidate => candidate.rule === 'closeGateway')
  assert.ok(move)
  clutches.behavior.performAction(state, inv, move, apiFor(state, {
    testResult: { success: true, value: 4, difficulty: 4 },
  }))
  assert.equal(gateway.primordialGateway, undefined)
  assert.ok(state.encounterDiscard.includes('05307'))
})

// ---------------------------------------------------------------------------
// 结局 / 记录
// ---------------------------------------------------------------------------

test('结局 1：按队内特性给出选项并写入剧本日志', () => {
  const state = stateFor(2, { anetteMasonIsPossessedByEvil: true })
  setup(state)
  const api = apiFor(state, { choices: ['underArrest'] })
  const result = clutches.behavior.resolution(state, 'r1', [], api)
  assert.deepEqual(result, { award: true, bonus: 0 })
  assert.equal(state.campaign.records.theInvestigatorsArrestedAnette, true)
})

test('结局 2：无对应特性时只能选择继续独自行动/求助', () => {
  const state = stateFor(2)
  state.investigators.forEach(investigator => { investigator.code = '01005' })
  setup(state)
  const api = apiFor(state, { choices: ['askedForAssistance'] })
  clutches.behavior.resolution(state, 'r2', [], api)
  assert.equal(state.campaign.records.theInvestigatorsAskedSanfordForAssistance, true)
})

test('无结局：按剧本日志转到结局 3 或结局 4 并记录末日渐近', () => {
  const music = stateFor(2, { anetteMasonIsPossessedByEvil: true })
  setup(music)
  const musicResult = clutches.behavior.resolution(music, 'noResolution', [], apiFor(music))
  assert.deepEqual(musicResult, { award: true, bonus: 0 })
  assert.equal(music.campaign.records.doomDrawsEverCloser, true)

  const secrets = stateFor(2)
  setup(secrets)
  clutches.behavior.resolution(secrets, 'r4', [], apiFor(secrets))
  assert.equal(secrets.campaign.records.doomDrawsEverCloser, true)
})

test('未知结局键与未知行动抛错', () => {
  const state = stateFor(2)
  setup(state)
  assert.throws(() => clutches.behavior.resolution(state, 'r9', [], apiFor(state)), /未知混沌魔掌结局/)
  assert.throws(() => clutches.behavior.performAction(state, state.investigators[0], { rule: 'nope' }, apiFor(state)),
    /未知混沌魔掌行动/)
})

// ---------------------------------------------------------------------------
// 存档 / 确定性
// ---------------------------------------------------------------------------

test('同一路线确定性 + 存档往返（JSON.stringify / deepEqual）', () => {
  const build = () => {
    const state = stateFor(2, { anetteMasonIsPossessedByEvil: true })
    const { rng } = setup(state, { seed: 77 })
    const inv = state.investigators[0]
    clutches.behavior.resolveEncounter(state, inv, { originalCode: '05306' }, apiFor(state, {
      testResult: { success: false, value: 2, difficulty: 3 },
      random: rng.randomValue,
    }))
    state.scenarioFlags.actBreaches = 2
    clutches.behavior.actReveal(state, state.acts[0], apiFor(state))
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同一路线必须产生相同状态')

  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.locations.map(location => [location.id, location.breaches || 0, location.doom || 0]),
    first.locations.map(location => [location.id, location.breaches || 0, location.doom || 0]))
  assert.deepEqual(restored.acts.map(act => act.originalCode), ['05286a', '05287'])
  assert.deepEqual(restored.enemies.map(enemy => enemy.originalCode), ['05286b'])
  // 恢复后的状态可以继续跑同一个钩子。
  const inv = restored.investigators[0]
  assert.doesNotThrow(() => clutches.behavior.afterTest(restored, inv, {
    success: false, difficulty: 3, value: 2, drawn: ['tablet'], cancelledTokens: [],
  }, apiFor(restored)))
})
