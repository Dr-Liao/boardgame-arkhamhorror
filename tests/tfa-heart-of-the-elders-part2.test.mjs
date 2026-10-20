import test from 'node:test'
import assert from 'node:assert/strict'
import * as part2 from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/index.js'
import {
  scenario as definition, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES,
} from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/definition.js'
import { CHAOS_CHAPTER_ID, implementedEncounterCodes } from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js'

const clone = value => structuredClone(value)
const behavior = part2.behavior
const PLACED_IDS = ['mouthOfKnYan', ...EXPLORATION_LOCATIONS]

function seededRandom(seed = 1) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
}

function setupApi(seed = 1) {
  const randomValue = seededRandom(seed)
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

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'mouthOfKnYan',
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
    campaign: {
      leadSeat: 0,
      records: {},
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [] })),
      chaosBag: [],
      supplies: {},
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function placed(state, ids = PLACED_IDS) {
  state.locations = ids.map(id => {
    const location = state.scenario.locations[id]
    const clues = location.cluesPerInvestigator * state.numInvestigators
    return { ...clone(location), id, revealed: true, clues, maxClues: clues, attachments: [] }
  })
  return state
}

// 与引擎一致：检查补给看同地点的全部调查员。
function supplyApi(state, extra = {}) {
  return {
    checkSupplies: (seat, name) => {
      const target = state.investigators[seat]
      return state.investigators
        .filter(other => !other.defeated && !other.resigned && other.location === target.location)
        .some(other => (state.campaign.supplies?.[other.seat] || []).includes(name))
    },
    hasSupply: (seat, name) => (state.campaign.supplies?.[seat] || []).includes(name),
    ...extra,
  }
}

// 记录所有调用的通用桩；测试按需补 test/drawEncounter 等。
function recordingApi(state, overrides = {}) {
  const calls = { info: [], damage: [], horror: [], draws: [], spawned: [], moved: [], poisoned: [] }
  const api = {
    ...supplyApi(state),
    calls,
    info: text => calls.info.push(text),
    random: seededRandom(7),
    damage: (seat, n) => { calls.damage.push([seat, n]) },
    horror: (seat, n) => { calls.horror.push([seat, n]) },
    poison: seat => { calls.poisoned.push(seat); return true },
    drawEncounter: seat => { calls.draws.push(seat) },
    spawn: (code, location) => {
      const enemy = { id: `e${calls.spawned.length + 1}`, code, originalCode: code, location, damageTaken: 0, engagedSeat: null }
      state.enemies.push(enemy)
      calls.spawned.push({ code, location })
      return enemy
    },
    remove: id => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
    },
    moveInvestigator: (seat, destination) => {
      state.investigators[seat].location = destination
      calls.moved.push(['inv', seat, destination])
    },
    moveEnemy: (enemy, destination) => {
      enemy.location = destination
      calls.moved.push(['enemy', enemy.id, destination])
    },
    trauma: (seat, kind, n) => { calls.trauma = [...(calls.trauma || []), [seat, kind, n]] },
    defeat: (inv, cause) => { inv.defeated = true; inv.defeatCause = cause ?? null },
    choose: () => '0',
    test: (seat, skill, difficulty, resolve, skillBonus, source) => {
      calls.test = [...(calls.test || []), { seat, skill, difficulty, source }]
      resolve({ success: true, value: difficulty, difficulty, skill })
    },
    ...overrides,
  }
  return api
}

test('久远腹地（下）已从占位升级为 playable，并保留原卡身份', () => {
  assert.equal(part2.manifest.status, 'playable')
  assert.equal(part2.manifest.catalogReferenceOnly, undefined)
  assert.equal(part2.manifest.referenceCode, undefined)
  assert.equal(part2.scenario.originalCode, '04205')
  assert.equal(part2.scenario.startLocation, 'mouthOfKnYan')
  assert.equal(part2.manifest.locations.length, 7)
  assert.deepEqual(part2.manifest.acts.map(act => act.id), ['act1', 'act2'])
  assert.deepEqual(part2.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(part2.manifest.resolutionIds, ['noResolution', 'r1', 'r2'])
  assert.deepEqual(part2.manifest.requiredMechanicIds,
    ['tfaExploration', 'tfaSupplies', 'tfaPoisoned', 'tfaVengeance'])
  assert.equal(part2.manifest.campaignId, 'theForgottenAge')
  assert.equal(part2.manifest.contentVersion, '1.0.0')
  // 放在一边：深入幽嘶、预示者、4 张中毒弱点。
  const aside = Object.fromEntries(part2.manifest.zones.setAside.map(entry => [entry.cardCode, entry.count]))
  assert.equal(aside['04227'], 1)
  assert.equal(aside['04062'], 1)
  assert.equal(aside['04102'], 4)
  assert.deepEqual(part2.manifest.behaviorIds, ['heartOfTheEldersPart2'])
})

test('地点符号按印刷连线（昆扬之口使用 04206 的背面「深藏其下」）', () => {
  const locations = Object.fromEntries(part2.manifest.locations.map(location => [location.id, location]))
  assert.equal(locations.mouthOfKnYan.frontCode, '04206b')
  assert.equal(locations.mouthOfKnYan.backCode, '04206')
  assert.deepEqual([...locations.mouthOfKnYan.connections].sort(),
    ['darkHollow', 'perilousGulch', 'vastPassages'])
  assert.deepEqual([...locations.descentToYoth.connections].sort(), ['crystalPillars', 'hallOfIdolatry'])
  assert.deepEqual([...locations.crystalPillars.connections].sort(),
    ['descentToYoth', 'perilousGulch', 'vastPassages'])
  assert.equal(locations.hallOfIdolatry.connections.includes('descentToYoth'), true)
  assert.equal(locations.darkHollow.connections.includes('hallOfIdolatry'), true)
  assert.deepEqual(part2.manifest.layout.locations.perilousGulch, { x: 1, y: 0 })
})

test('布置是确定性的：同一种子给出同一探索牌库，且不重复', () => {
  const build = seed => {
    const state = stateFor()
    behavior.setupLocations(state, [], setupApi(seed))
    return state.explorationDeck
  }
  const first = build(17)
  assert.deepEqual(first, build(17))
  assert.notDeepEqual(first, build(18))
  assert.equal(first.length, 9)
  assert.deepEqual([...first].sort(),
    [...EXPLORATION_LOCATIONS, ...Object.values(EXPLORATION_TREACHERIES)].sort())
})

test('布置把深入幽嘶、预示者与 4 张中毒放在一边，并从昆扬之口开始', () => {
  const state = placed(stateFor())
  const ids = behavior.setupLocations(state, [], setupApi(3))
  assert.deepEqual(ids, ['mouthOfKnYan'])
  const aside = state.scenarioZones.setAside
  assert.ok(aside.includes('04227'), '深入幽嘶放在一边')
  assert.ok(aside.includes('04062'), '瓦卢西亚的预示者放在一边')
  assert.equal(aside.filter(code => code === '04102').length, 4)
  // 已经在调查员牌组里的中毒弱点不再放在一边。
  const withDeck = stateFor()
  withDeck.campaign.investigators[0].deck = ['04102']
  behavior.setupLocations(withDeck, [], setupApi(3))
  assert.equal(withDeck.scenarioZones.setAside.filter(code => code === '04102').length, 3)
})

test('「丛林在注视」列出的卡牌在布置时进入胜利区', () => {
  const state = stateFor()
  state.campaign.records.theJungleWatches = ['04220', '04217']
  behavior.setupLocations(state, [], setupApi(5))
  const snake = state.victoryDisplay.find(card => card.originalCode === '04220')
  const woods = state.victoryDisplay.find(card => card.originalCode === '04217')
  assert.ok(snake, '蛇怪被放进胜利区')
  assert.equal(snake.vengeance, 2)
  assert.ok(woods, '错时林地被放进胜利区')
  assert.equal(woods.victory, 1)
  assert.equal(state.victoryDisplay.length, 2)
})

test('密谋 1b：预示者按日志记录的伤害在离所有调查员最远的地点出现', () => {
  const state = placed(stateFor(2), [...PLACED_IDS, 'descentToYoth'])
  behavior.setupLocations(state, [], setupApi(7))
  state.campaign.records.theHarbingerIsStillAlive = 6
  const api = recordingApi(state)
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(api.calls.spawned.length, 1)
  const enemy = state.enemies[0]
  assert.equal(enemy.code, '04062')
  assert.equal(enemy.location, 'descentToYoth', '最远的地点是深入幽嘶')
  assert.equal(enemy.damageTaken, 6)
  assert.equal(state.scenarioFlags.harbingerSpawned, true)
})

test('密谋 1b：伊格之怒至少 8 笔勾时改为在队长所在地点出现', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(11))
  state.campaign.records.theHarbingerIsStillAlive = 3
  state.campaign.records.yigsFury = 8
  state.investigators[0].location = 'darkHollow'
  state.investigators[1].location = 'vastPassages'
  const api = recordingApi(state)
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.enemies[0].location, 'darkHollow')
  // 记录为 0（预示者已死）时不出现。
  const dead = placed(stateFor(2))
  behavior.setupLocations(dead, [], setupApi(11))
  const deadApi = recordingApi(dead)
  behavior.agendaReveal(dead, dead.agendas[0], deadApi)
  assert.equal(deadApi.calls.spawned.length, 0)
  assert.equal(dead.enemies.length, 0)
})

test('场景 1b：深入幽嘶洗入探索牌库，侦查员带粉笔时不受负面效果', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(13))
  state.investigators[0].location = 'vastPassages'
  state.campaign.supplies[0] = ['chalk']
  const before = state.locations.map(location => location.clues)
  const api = recordingApi(state)
  behavior.actReveal(state, state.acts[0], api)
  assert.ok(state.explorationDeck.includes('04227'), '深入幽嘶进入探索牌库')
  assert.equal(state.scenarioZones.setAside.includes('04227'), false)
  assert.deepEqual(state.locations.map(location => location.clues), before, '有粉笔不放线索')
  assert.equal(api.calls.moved.length, 0)
})

test('场景 1b：没有粉笔时每个地点放 1 个线索，单面地点被洗回并退到最近昆扬之口的地点', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(13))
  state.investigators[0].location = 'crystalPillars'
  state.investigators[1].location = 'crystalPillars'
  state.enemies.push({ id: 'e1', code: '04083', originalCode: '04083', location: 'crystalPillars', engagedSeat: null })
  const before = new Map(state.locations.map(location => [location.id, location.clues]))
  const api = recordingApi(state)
  behavior.actReveal(state, state.acts[0], api)
  assert.ok(state.explorationDeck.includes('04227'), '深入幽嘶进入探索牌库')
  assert.equal(state.scenarioZones.setAside.includes('04227'), false)
  for (const location of state.locations) {
    if (location.id === 'mouthOfKnYan' || location.id === 'crystalPillars') continue
    assert.equal(location.clues, before.get(location.id) + 1, `${location.id} 多 1 个线索`)
  }
  assert.equal(state.locations.some(location => location.id === 'crystalPillars'), false, '晶体柱群被移出')
  assert.ok(state.explorationDeck.includes('crystalPillars'), '晶体柱群被洗回探索牌库')
  const destination = state.investigators[0].location
  assert.equal(state.investigators[1].location, destination, '两位调查员一起后退')
  assert.equal(state.enemies[0].location, destination, '敌人一起后退')
  const mouth = state.locations.find(location => location.id === 'mouthOfKnYan')
  assert.ok(mouth.connections.includes(destination), '退到与昆扬之口相连的地点')
  // 侦查员本来就在与昆扬之口相连的地点时，直接退回昆扬之口。
  const direct = placed(stateFor(1))
  behavior.setupLocations(direct, [], setupApi(13))
  direct.investigators[0].location = 'vastPassages'
  behavior.actReveal(direct, direct.acts[0], recordingApi(direct))
  assert.equal(direct.investigators[0].location, 'mouthOfKnYan')
  // 移动被效果挡住时（强制移动），也不会把人留在被洗回牌库的地点上。
  const forced = placed(stateFor(1))
  behavior.setupLocations(forced, [], setupApi(13))
  forced.investigators[0].location = 'vastPassages'
  behavior.actReveal(forced, forced.acts[0], recordingApi(forced, { moveInvestigator: () => {} }))
  assert.equal(forced.investigators[0].location, 'mouthOfKnYan')
})

test('场景 2 目标：全员在深入幽嘶且没有毁灭时可推进，并按日志进入结局 1／2', () => {
  const finishWith = records => {
    const state = placed(stateFor(2), [...PLACED_IDS, 'descentToYoth'])
    behavior.setupLocations(state, [], setupApi(19))
    state.actIndex = 1
    for (const inv of state.investigators) inv.location = 'descentToYoth'
    Object.assign(state.campaign.records, records)
    const finished = []
    const api = {
      advanceAct: () => {
        const act = state.acts[state.actIndex]
        state.actIndex += 1
        behavior.actReveal(state, act, { finish: key => finished.push(key) })
      },
    }
    const advanced = behavior.checkObjectives(state, api)
    return { advanced, finished, state }
  }
  const rescued = finishWith({ theInvestigatorsRescuedAlejandro: true })
  assert.equal(rescued.advanced, true)
  assert.deepEqual(rescued.finished, ['r1'])
  const missing = finishWith({ theInvestigatorsRescuedAlejandro: false })
  assert.deepEqual(missing.finished, ['r2'])
  // 有毁灭标记时不能推进。
  const blocked = finishWith({})
  blocked.state.actIndex = 1
  blocked.state.locations.find(location => location.id === 'descentToYoth').doom = 1
  const advanced = behavior.checkObjectives(blocked.state, { advanceAct: () => { throw new Error('不应推进') } })
  assert.equal(advanced, false)
})

test('密谋 2b：幸存的每位调查员被击败并承受 1 点肉体创伤', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(23))
  const api = recordingApi(state)
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.deepEqual(api.calls.trauma, [[0, 'physical', 1], [1, 'physical', 1]])
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  assert.equal(state.agendas[1].doomThreshold, 12 + state.numInvestigators)
})

test('落入陷阱：要么检定敏捷并按差额受伤，要么洗回探索牌库', () => {
  const chasm = (answer, exploring) => {
    const state = placed(stateFor(1))
    behavior.setupLocations(state, [], setupApi(29))
    const inv = state.investigators[0]
    state.scenarioFlags.exploringSeat = exploring ? inv.seat : null
    state.explorationDeck = ['crystalPillars']
    const api = recordingApi(state, {
      choose: request => {
        assert.equal(request.options.length, exploring ? 1 : 2)
        return answer
      },
      test: (seat, skill, difficulty, resolve) => {
        assert.equal(skill, 'agility')
        assert.equal(difficulty, 3)
        resolve({ success: false, value: 1, difficulty, skill })
      },
    })
    const placedCard = behavior.resolveEncounter(state, inv, { code: '04215' }, api)
    return { state, placedCard, inv, api }
  }
  const tested = chasm('test', false)
  assert.equal(tested.placedCard, false, '检定分支把卡牌放进遭遇弃牌堆')
  assert.deepEqual(tested.api.calls.damage, [[0, 1], [0, 1]], '低于难度 2 点受 2 点伤害')
  const shuffled = chasm('shuffle', false)
  assert.equal(shuffled.placedCard, true)
  assert.ok(shuffled.state.explorationDeck.includes('04215'))
  const forced = chasm('test', true)
  assert.equal(forced.placedCard, false)
})

test('有毒孢子：附属地点，轮末让中毒者受恐惧、未中毒者中毒并弃掉', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(31))
  const [first, second] = state.investigators
  first.threat.push({ id: 'p1', code: '04102', permanent: true })
  const api = recordingApi(state)
  assert.equal(behavior.resolveEncounter(state, first, { code: '04216' }, api), true)
  const location = state.locations.find(entry => entry.id === 'mouthOfKnYan')
  assert.equal(location.attachments.filter(entry => entry.code === '04216').length, 1)
  behavior.roundEnded(state, api)
  assert.deepEqual(api.calls.horror, [[0, 2]], '中毒者受到 2 点恐惧')
  assert.deepEqual(api.calls.poisoned, [1], '未中毒者获得中毒弱点')
  assert.equal(location.attachments.filter(entry => entry.code === '04216').length, 0)
  assert.deepEqual(state.encounterDiscard, ['04216'])
  assert.equal(second.threat.some(card => card.code === '04102'), false, '桩不会真的放卡')
})

test('无路可退：附属地点不能进出，可通过检定战斗或鹤嘴锄弃掉', () => {
  const state = placed(stateFor(1))
  behavior.setupLocations(state, [], setupApi(37))
  const inv = state.investigators[0]
  const api = recordingApi(state, { choose: () => 'vastPassages' })
  assert.equal(behavior.resolveEncounter(state, inv, { code: '04228' }, api), true)
  const sealed = state.locations.find(location => location.id === 'vastPassages')
  assert.equal(sealed.attachments.filter(entry => entry.code === '04228').length, 1)
  assert.equal(behavior.movementError(state, inv), null, '离开未被附属的昆扬之口不受影响')
  assert.match(behavior.investigatorEntryError(state, sealed, inv) || '', /无路可退/, '不能进入被附属的地点')
  inv.location = 'vastPassages'
  assert.match(behavior.movementError(state, inv) || '', /无路可退/, '不能离开被附属的地点')
  const moves = behavior.encounterActions(state, inv).filter(move => move.rule === 'clearNoTurningBack')
  assert.equal(moves.length, 1)
  assert.equal(moves[0].actions, 1)
  // 没有鹤嘴锄：检定战斗(3)，成功即弃掉。
  behavior.performEncounterAction(state, inv, moves[0], recordingApi(state, {
    test: (seat, skill, difficulty, resolve) => {
      assert.equal(skill, 'combat')
      assert.equal(difficulty, 3)
      resolve({ success: true, value: 4, difficulty, skill })
    },
  }))
  assert.equal(sealed.attachments.length, 0)
  assert.ok(state.encounterDiscard.includes('04228'))
  assert.equal(behavior.movementError(state, inv), null)
  // 带鹤嘴锄时直接弃掉。
  const withPickaxe = placed(stateFor(1))
  behavior.setupLocations(withPickaxe, [], setupApi(37))
  withPickaxe.investigators[0].location = 'vastPassages'
  withPickaxe.campaign.supplies[0] = ['pickaxe']
  const pickaxeApi = recordingApi(withPickaxe, { choose: () => 'vastPassages', test: () => { throw new Error('带鹤嘴锄不应检定') } })
  behavior.resolveEncounter(withPickaxe, withPickaxe.investigators[0], { code: '04228' }, pickaxeApi)
  const pickaxeLocation = withPickaxe.locations.find(location => location.id === 'vastPassages')
  const pickaxeMoves = behavior.encounterActions(withPickaxe, withPickaxe.investigators[0])
  behavior.performEncounterAction(withPickaxe, withPickaxe.investigators[0],
    pickaxeMoves.find(move => move.rule === 'clearNoTurningBack'), pickaxeApi)
  assert.equal(pickaxeLocation.attachments.length, 0)
})

test('宽阔步道：没有双筒望远镜必须额外花费 1 个行动', () => {
  const make = supplies => {
    const state = placed(stateFor(1))
    behavior.setupLocations(state, [], setupApi(41))
    const inv = state.investigators[0]
    inv.location = 'vastPassages'
    state.campaign.supplies[0] = supplies
    const api = recordingApi(state)
    const allowed = behavior.beforeExplore(state, inv, api)
    return { allowed, inv, state }
  }
  const without = make([])
  assert.equal(without.allowed, true)
  assert.equal(without.inv.actionsLeft, 2)
  const withBinoculars = make(['binoculars'])
  assert.equal(withBinoculars.inv.actionsLeft, 3, '有双筒望远镜不额外收费')
  const broke = make([])
  broke.inv.actionsLeft = 0
  const blocked = behavior.beforeExplore(broke.state, broke.inv, recordingApi(broke.state))
  assert.equal(blocked, false, '没有额外行动时不能探索')
})

test('地点强制效果：危险峡谷、晶体柱群、漆黑洞窟、崇拜礼堂', () => {
  // 危险峡谷：调查失败且没有绳索 -> 1 毁灭。
  {
    const state = placed(stateFor(1))
    behavior.setupLocations(state, [], setupApi(43))
    const inv = state.investigators[0]
    inv.location = 'perilousGulch'
    const api = recordingApi(state)
    behavior.afterTest(state, inv, { success: false, value: 1, difficulty: 4, skill: 'intellect', source: { label: '调查' } }, api)
    assert.equal(state.locations.find(location => location.id === 'perilousGulch').doom, 1)
    // 有绳索就不再放毁灭。
    state.campaign.supplies[0] = ['rope']
    behavior.afterTest(state, inv, { success: false, value: 1, difficulty: 4, skill: 'intellect', source: { label: '调查' } }, recordingApi(state))
    assert.equal(state.locations.find(location => location.id === 'perilousGulch').doom, 1)
  }
  // 晶体柱群：进入后检定意志，难度 = 1 + 胜利区复仇。
  {
    const state = placed(stateFor(1))
    behavior.setupLocations(state, [], setupApi(43))
    state.victoryDisplay.push({ id: 'v1', code: '04220', originalCode: '04220', vengeance: 2, victory: 0 })
    const inv = state.investigators[0]
    const location = state.locations.find(entry => entry.id === 'crystalPillars')
    const api = recordingApi(state, {
      test: (seat, skill, difficulty, resolve) => {
        assert.equal(skill, 'willpower')
        assert.equal(difficulty, 3)
        resolve({ success: false, value: 0, difficulty, skill })
      },
    })
    behavior.locationEntered(state, inv, location, api)
    assert.deepEqual(api.calls.damage, [[0, 1]])
    assert.deepEqual(api.calls.horror, [[0, 1]])
  }
  // 漆黑洞窟：没人带地图 -> 每位调查员额外 1 个线索。
  {
    const state = placed(stateFor(2))
    behavior.setupLocations(state, [], setupApi(43))
    const inv = state.investigators[0]
    inv.location = 'darkHollow'
    const location = state.locations.find(entry => entry.id === 'darkHollow')
    const before = location.clues
    behavior.afterExplore(state, inv, { code: 'darkHollow', kind: 'location', runtime: recordingApi(state) })
    assert.equal(location.clues, before + state.numInvestigators)
    // 第二次不再叠加。
    behavior.afterExplore(state, inv, { code: 'darkHollow', kind: 'location', runtime: recordingApi(state) })
    assert.equal(location.clues, before + state.numInvestigators)
  }
  // 崇拜礼堂：伊格之怒 5／10 笔勾分别抽 1／2 张。
  {
    const draws = fury => {
      const state = placed(stateFor(1))
      behavior.setupLocations(state, [], setupApi(43))
      state.campaign.records.yigsFury = fury
      const inv = state.investigators[0]
      inv.location = 'hallOfIdolatry'
      const api = recordingApi(state)
      behavior.afterExplore(state, inv, { code: 'hallOfIdolatry', kind: 'location', runtime: api })
      return api.calls.draws.length
    }
    assert.equal(draws(4), 0)
    assert.equal(draws(5), 1)
    assert.equal(draws(10), 2)
  }
})

test('深入幽嘶：入场时每位调查员二选一，调查行动可以把毁灭翻成线索', () => {
  const state = placed(stateFor(2), [...PLACED_IDS, 'descentToYoth'])
  behavior.setupLocations(state, [], setupApi(47))
  const inv = state.investigators[0]
  inv.location = 'descentToYoth'
  const descent = state.locations.find(location => location.id === 'descentToYoth')
  assert.deepEqual(behavior.actions(state, inv).filter(move => !move.reason).map(move => move.rule), [], '没有毁灭时没有可执行的翻面行动')
  assert.equal(behavior.actions(state, inv).find(move => move.rule === 'flipDescentDoom')?.reason,
    '深入幽嘶上没有毁灭标记可翻面', '没有毁灭时给出缺口')
  let answers = ['doom', 'draw']
  const api = recordingApi(state, { choose: () => answers.shift() })
  behavior.afterExplore(state, inv, { code: 'descentToYoth', kind: 'location', runtime: api })
  assert.equal(descent.doom, 1, '第一位放毁灭')
  assert.equal(api.calls.draws.length, 2, '第二位抽 2 张')
  // 翻面行动：检定智识(帷幕 3)，成功把 1 个毁灭翻成线索。
  const moves = behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule), ['flipDescentDoom'])
  assert.equal(moves[0].actions, 1)
  behavior.performAction(state, inv, moves[0], recordingApi(state, {
    test: (seat, skill, difficulty, resolve, bonus, source) => {
      assert.equal(skill, 'intellect')
      assert.equal(difficulty, 3, '深入幽嘶帷幕 3')
      assert.equal(source?.label, '调查')
      resolve({ success: true, value: 4, difficulty, skill })
    },
  }))
  assert.equal(descent.doom, 0)
  assert.equal(descent.clues, 1)
})

test('昆扬之口（深藏其下）：带地图可查看探索牌库顶 2 张并弃掉诡计', () => {
  const run = seed => {
    const state = placed(stateFor(1))
    behavior.setupLocations(state, [], setupApi(53))
    state.explorationDeck = ['crystalPillars', '04215', 'vastPassages']
    state.campaign.supplies[0] = ['map']
    const inv = state.investigators[0]
    assert.deepEqual(behavior.actions(state, inv).map(move => move.rule), ['scoutDepths'])
    const api = recordingApi(state, { random: seededRandom(seed) })
    behavior.performAction(state, inv, { rule: 'scoutDepths' }, api)
    return state
  }
  const first = run(3)
  assert.deepEqual(first.encounterDiscard, ['04215'], '顶 2 张里的诡计被弃掉')
  assert.deepEqual([...first.explorationDeck].sort(), ['crystalPillars', 'vastPassages'])
  assert.deepEqual(run(3).explorationDeck, first.explorationDeck, '同一种子顺序一致')
  assert.deepEqual(run(4).explorationDeck, first.explorationDeck, '两张牌时顺序不受种子影响')
  // 没有地图时什么都不做。
  const state = placed(stateFor(1))
  behavior.setupLocations(state, [], setupApi(53))
  state.explorationDeck = ['crystalPillars']
  behavior.performAction(state, state.investigators[0], { rule: 'scoutDepths' }, recordingApi(state))
  assert.deepEqual(state.explorationDeck, ['crystalPillars'])
})

test('混乱标记表：洞穴骷髅、异教徒毁灭、石板中毒自动失败与困难面弱点', () => {
  const state = placed(stateFor(1))
  behavior.setupLocations(state, [], setupApi(59))
  const inv = state.investigators[0]
  inv.location = 'mouthOfKnYan' // 洞穴
  assert.equal(CHAOS_CHAPTER_ID, 'heartOfTheEldersPart2', '共享标记表按别名接受本章 id')
  state.difficulty = 'standard'
  const inCave = behavior.resolveChaosToken(state, inv, 'skull', {})
  assert.equal(inCave.delta, -3)
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -4)
  state.difficulty = 'standard'
  inv.location = 'crystalPillars'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -3, '晶体柱群也是洞穴')
  assert.equal(behavior.resolveChaosToken(state, inv, 'cultist', {}).delta, -2)
  inv.threat.push({ id: 'p1', code: '04102', permanent: true })
  assert.equal(behavior.resolveChaosToken(state, inv, 'tablet', {}).autoFail, true)
  inv.threat.length = 0
  // 检定失败：异教徒在所在地点放毁灭、古老之物给恐惧。
  state.difficulty = 'standard'
  inv.location = 'vastPassages'
  const api = recordingApi(state)
  behavior.afterTest(state, inv, {
    success: false, value: 1, difficulty: 3, skill: 'willpower', drawn: ['cultist'], source: { label: '遭遇检定' },
  }, api)
  assert.equal(state.locations.find(location => location.id === 'vastPassages').doom, 1)
  behavior.afterTest(state, inv, {
    success: false, value: 1, difficulty: 3, skill: 'willpower', drawn: ['elderthing'], source: { label: '遭遇检定' },
  }, api)
  assert.deepEqual(api.calls.horror, [[0, 1]])
  // 困难／专家：未中毒且失败时把放在一边的中毒弱点放进威胁区域。
  state.difficulty = 'hard'
  const hardApi = recordingApi(state)
  behavior.afterTest(state, inv, {
    success: false, value: 1, difficulty: 3, skill: 'willpower', drawn: ['tablet'], source: { label: '遭遇检定' },
  }, hardApi)
  assert.deepEqual(hardApi.calls.poisoned, [0])
})

test('探索受幕／密谋限制：所在地点有线索时不能探索', () => {
  const state = placed(stateFor(1))
  behavior.setupLocations(state, [], setupApi(61))
  const inv = state.investigators[0]
  const mouth = state.locations.find(location => location.id === 'mouthOfKnYan')
  mouth.clues = 1
  assert.equal(behavior.canExplore(state, inv), false)
  mouth.clues = 0
  assert.equal(behavior.canExplore(state, inv), true)
})

test('结局写入伊格之怒与预示者记录，并保留存档一致性', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(67))
  state.victoryDisplay.push({ id: 'v1', code: '04220', originalCode: '04220', vengeance: 2, victory: 0 })
  state.victoryDisplay.push({ id: 'v2', code: '04227', originalCode: '04227', vengeance: 2, victory: 2 })
  state.scenarioFlags.harbingerSpawned = true
  state.enemies.push({ id: 'e1', code: '04062', originalCode: '04062', location: 'descentToYoth', damageTaken: 4 })
  state.campaign.records.theHarbingerIsStillAlive = 1
  state.campaign.records.yigsFury = 3
  const result = behavior.resolution(state, 'r1', [], {})
  assert.deepEqual(result, { award: true, bonus: 0 })
  assert.equal(state.campaign.records.yigsFury, 7, '+4 复仇')
  assert.equal(state.campaign.records.theHarbingerIsStillAlive, 4, '记下它在场上的伤害')
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.records, state.campaign.records)
  assert.deepEqual(restored.locations, state.locations)
  // 在胜利区则划掉记录。
  const defeated = clone(state)
  defeated.victoryDisplay.push({ id: 'e1', code: '04062', originalCode: '04062', victory: 0 })
  behavior.resolution(defeated, 'r2', [], {})
  assert.equal(defeated.campaign.records.theHarbingerIsStillAlive, 0)
  assert.throws(() => behavior.resolution(state, 'r9', [], {}))
})

test('「没有结局」按剧本日志分流到结局 1／2 的故事文本', () => {
  const state = placed(stateFor(1))
  behavior.setupLocations(state, [], setupApi(71))
  state.campaign.records.theInvestigatorsRescuedAlejandro = true
  assert.equal(behavior.storyResolutionKey(state, 'noResolution'), 'r1')
  state.campaign.records.theInvestigatorsRescuedAlejandro = false
  assert.equal(behavior.storyResolutionKey(state, 'noResolution'), 'r2')
  assert.equal(behavior.storyResolutionKey(state, 'r2'), 'r2')
  assert.equal(typeof state.scenario.resolutions.r1, 'string')
  assert.match(state.scenario.resolutions.r2, /预示者/)
})

test('实现清单只列出真正实现了印刷效果的遭遇卡', () => {
  assert.deepEqual([...implementedEncounterCodes].sort(),
    ['04062', '04083', '04084', '04088', '04092', '04093', '04094', '04100', '04101', '04102',
      '04215', '04216', '04228'])
  for (const code of implementedEncounterCodes) {
    const definitionCard = part2.scenario.enemies[code] || part2.scenario.treacheries[code]
    assert.ok(definitionCard, `${code} 必须在本章 encounters 里`)
  }
  // 探索牌库里各放 1 张印刷指定的诡计。
  for (const code of ['04215', '04228', '04094', '04088']) {
    assert.ok(Object.values(EXPLORATION_TREACHERIES).includes(code), `${code} 在探索牌库`)
  }
})

test('同一种子的两次布置与副流程完全一致（JSON 往返）', () => {
  const run = seed => {
    const state = placed(stateFor(2))
    behavior.setupLocations(state, [], setupApi(seed))
    state.campaign.records.theJungleWatches = ['04220']
    state.investigators[0].location = 'hallOfIdolatry'
    state.investigators[1].location = 'darkHollow'
    const api = recordingApi(state)
    behavior.afterExplore(state, state.investigators[0], { code: 'hallOfIdolatry', kind: 'location', runtime: api })
    behavior.afterExplore(state, state.investigators[1], { code: 'darkHollow', kind: 'location', runtime: api })
    behavior.roundEnded(state, api)
    return JSON.stringify(state)
  }
  assert.equal(run(97), run(97))
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(97))
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
})

test('04222 宽阔步道：没有双筒望远镜时行动不足就不给探索（不再白丢 1 行动）', () => {
  const state = placed(stateFor(1))
  state.campaign.supplies = {}
  const inv = state.investigators[0]
  inv.location = 'vastPassages'
  const location = state.locations.find(entry => entry.id === 'vastPassages')
  location.clues = 0
  inv.actionsLeft = 1
  assert.equal(behavior.canExplore(state, inv), false, '只剩 1 行动时不能探索')
  inv.actionsLeft = 2
  assert.equal(behavior.canExplore(state, inv), true)
  // 有双筒望远镜时 1 行动也能探索。
  inv.actionsLeft = 1
  state.campaign.supplies = { 0: ['binoculars'] }
  assert.equal(behavior.canExplore(state, inv), true)
})

test('04214 降入黑暗：满足条件时先询问是否推进，选「再等等」本轮不再问', () => {
  const build = answer => {
    const state = placed(stateFor(2), [...PLACED_IDS, 'descentToYoth'])
    behavior.setupLocations(state, [], setupApi(23))
    state.actIndex = 1
    for (const inv of state.investigators) inv.location = 'descentToYoth'
    const choices = []
    let advanced = 0
    const api = {
      choose: request => { choices.push(request); return answer },
      advanceAct: () => { advanced += 1 },
    }
    return { state, api, choices, get advanced() { return advanced } }
  }
  const wait = build('wait')
  assert.equal(behavior.checkObjectives(wait.state, wait.api), false)
  assert.equal(wait.advanced, 0)
  assert.equal(wait.choices.length, 1, '询问一次')
  behavior.checkObjectives(wait.state, wait.api)
  assert.equal(wait.choices.length, 1, '同一轮不重复询问')

  const go = build('advance')
  assert.equal(behavior.checkObjectives(go.state, go.api), true)
  assert.equal(go.advanced, 1)
})

test('04224 漆黑洞窟：全队没地图才加线索，每次入场重新结算', () => {
  const state = placed(stateFor(1), [...PLACED_IDS, 'darkHollow'])
  state.campaign.supplies = {}
  const inv = state.investigators[0]
  const location = state.locations.find(entry => entry.id === 'darkHollow')
  location.clues = 0
  behavior.afterExplore(state, inv, { code: 'darkHollow', kind: 'location', runtime: recordingApi(state) })
  assert.equal(location.clues, state.numInvestigators, '没人带地图：每位调查员 +1 线索')
  assert.equal(location.darkHollowResolved, true)

  const withMap = placed(stateFor(1), [...PLACED_IDS, 'darkHollow'])
  withMap.campaign.supplies = { 0: ['map'] }
  const second = withMap.locations.find(entry => entry.id === 'darkHollow')
  second.clues = 0
  behavior.afterExplore(withMap, withMap.investigators[0], { code: 'darkHollow', kind: 'location', runtime: recordingApi(withMap) })
  assert.equal(second.clues, 0, '有地图就不加')
})

test('04212 黑暗中的眼睛：所在地点没有线索时可以探索', () => {
  const state = placed(stateFor(1))
  state.agendaIndex = 1
  const inv = state.investigators[0]
  const location = state.locations.find(entry => entry.id === inv.location) || state.locations[0]
  inv.location = location.id
  location.clues = 0
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'eyesExplore')
  assert.ok(move)
  const opened = []
  behavior.performAction(state, inv, move, { explore: seat => opened.push(seat) })
  assert.deepEqual(opened, [inv.seat])
  location.clues = 1
  assert.equal(behavior.actions(state, inv).some(entry => entry.rule === 'eyesExplore'), false)
})
