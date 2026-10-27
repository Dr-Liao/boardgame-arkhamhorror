import test from 'node:test'
import assert from 'node:assert/strict'
import * as echoes from '../content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/index.js'
import * as oath from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'
import act03125 from '../src/cards/encounter-entries/thePathToCarcosa/echoesOfThePast/03125.js'
import {
  activeLocationTraitLinks, addLocationTrait, grantedLocationTraits, removeLocationTrait,
  setLocationShroudMod, syncLocationTraitLinks,
} from '../src/engine/engine.js'

const clone = value => structuredClone(value)
const setupApi = {
  randomValue: () => 0,
  shuffle: values => [...values],
}

function fixture(entry, records = {}) {
  return {
    scenario: clone(entry.scenario),
    acts: clone(entry.scenario.acts),
    agendas: clone(entry.scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    difficulty: 'standard',
    numInvestigators: 2,
    currentSeat: 0,
    round: 1,
    phase: 'investigation',
    doom: 0,
    chaosBag: ['0', 'cultist', 'tablet', 'elderthing'],
    campaign: {
      leadSeat: 0,
      records: clone(records),
      chaosBag: ['0', 'cultist', 'tablet', 'elderthing'],
      investigators: {
        0: { seat: 0, name: '一号', status: 'active', deck: [] },
        1: { seat: 1, name: '二号', status: 'active', deck: [] },
      },
      trauma: [{ physical: 0, mental: 0 }, { physical: 0, mental: 0 }],
    },
    investigators: [
      { seat: 0, name: '一号', location: entry.scenario.startLocation, actionsLeft: 3, deck: [], hand: [], assets: [], clues: 0, resources: 5, horror: 0, damage: 0, maxHealth: 7, maxSanity: 7 },
      { seat: 1, name: '二号', location: entry.scenario.startLocation, actionsLeft: 3, deck: [], hand: [], assets: [], clues: 0, resources: 5, horror: 0, damage: 0, maxHealth: 7, maxSanity: 7 },
    ],
    locations: [],
    enemies: [],
    encounterDeck: clone(entry.scenario.encounterDeck),
    encounterDiscard: [],
    victoryDisplay: [],
    scenarioFlags: {},
    scenarioZones: {},
  }
}

test('M3 middle-A manifests are verified while the campaign gate remains external', () => {
  assert.equal(echoes.manifest.status, 'verified')
  assert.equal(oath.manifest.status, 'verified')
  assert.deepEqual(echoes.scenario.acts.map(card => card.originalCode), ['03124', '03125', '03126'])
  assert.deepEqual(echoes.scenario.agendas.map(card => card.doomThresholdPerInvestigator), [2, 2, 3])
  assert.deepEqual(oath.scenario.agendas.map(card => card.originalCode), ['03160', '03161', '03162'])
  assert.equal(Object.keys(echoes.scenario.locations).length, 13)
  assert.equal(Object.keys(oath.scenario.locations).length, 14)
})

test('Echoes setup transactionally removes one location per floor and applies Sebastien information', () => {
  const state = fixture(echoes, { vipsInterviewed: ['03079'], youFledTheDinnerParty: true })
  const placed = echoes.behavior.setupLocations(state, [], setupApi)
  assert.equal(placed.length, 9)
  assert.equal(state.scenarioZones.removed.length, 3)
  assert.equal(state.scenario.locations.entryHall.cluesFixed, 2)
  assert.ok(state.investigators.every(inv => inv.actionsLeft === 4))
})

test('Echoes uses printed doom chaos values and persists doubt/VIP/symbol results', () => {
  const state = fixture(echoes, { vipsSlain: [] })
  state.enemies = [{ id: 'a', doom: 1 }, { id: 'b', doom: 3 }]
  assert.equal(echoes.behavior.resolveChaosToken(state, state.investigators[0], 'skull', {}).delta, -3)
  state.difficulty = 'hard'
  assert.equal(echoes.behavior.resolveChaosToken(state, state.investigators[0], 'skull', {}).delta, -4)
  state.victoryDisplay = [{ originalCode: '03068b' }]
  echoes.behavior.resolution(state, 'r2')
  assert.equal(state.campaign.records.youLeftTheOnyxClaspBehind, true)
  assert.equal(state.campaign.records.doubt, 1)
  assert.deepEqual(state.campaign.records.vipsSlain, ['03068'])
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 2)
})

test('Echoes R1 transactionally assigns the Black Onyx Clasp and marks conviction', () => {
  const state = fixture(echoes)
  echoes.behavior.resolution(state, 'r1', [], { choose: () => '1' })
  assert.equal(state.campaign.records.youTookTheOnyxClasp, true)
  assert.equal(state.campaign.records.conviction, 1)
  assert.ok(state.campaign.investigators[1].deck.includes('03142'))
  assert.equal(state.chaosBag.filter(token => token === 'cultist').length, 2)
})

test('Echoes meeting room exhausts an Ally and discovers one clue once per investigator each round', () => {
  const state = fixture(echoes)
  state.locations = [{ ...clone(echoes.scenario.locations.meetingRoom), revealed: true, clues: 2 }]
  const inv = state.investigators[0]
  inv.location = 'meetingRoom'
  inv.assets = [{ id: 'ally-1', code: '01018', exhausted: false }]
  const move = echoes.behavior.actions(state, inv).find(action => action.rule === 'meetingRoomAlly')
  assert.ok(move)
  echoes.behavior.performAction(state, inv, move, {
    gainClues(seat, amount) { state.investigators[seat].clues += amount },
  })
  assert.equal(inv.assets[0].exhausted, true)
  assert.equal(inv.clues, 1)
  assert.equal(state.locations[0].clues, 1)
  assert.ok(!echoes.behavior.actions(state, inv).some(action => action.rule === 'meetingRoomAlly'))
})

test('Unspeakable Oath conserves both side decks and selects the original act II', () => {
  const state = fixture(oath, { youTookTheOnyxClasp: false })
  const placed = oath.behavior.setupLocations(state, [], setupApi)
  assert.equal(placed.length, 8)
  assert.equal(state.scenarioZones.removed.length, 2)
  assert.equal(state.scenarioZones.monsters.length, 7)
  assert.equal(state.scenarioZones.lunatics.length, 7)
  assert.equal(state.acts[1].originalCode, '03165')
})

test('Unspeakable Oath Courage keeps its own identity while restoring the underlying card', () => {
  const state = fixture(oath, { vipsInterviewed: ['03076a'] })
  const inv = state.investigators[0]
  inv.deck = ['01024']
  oath.behavior.afterMulligan(state)
  const courage = inv.assets[0]
  assert.equal(courage.code, 'xcourage')
  assert.equal(courage.underlyingCode, '01024')
  assert.ok(!Object.hasOwn(courage, 'originalCode'))
  oath.behavior.assetLeftPlay(state, inv, courage)
  assert.equal(courage.code, '01024')
  assert.ok(!Object.hasOwn(courage, 'underlyingCode'))
})

test('Unspeakable Oath writes Daniel state, escape facts, trauma, VIP and symbols', () => {
  const state = fixture(oath, { vipsSlain: [] })
  state.investigators[0].resigned = true
  state.investigators[0].assets.push({ code: '03182a' })
  state.victoryDisplay = [{ originalCode: '03065b' }]
  const traumas = []
  oath.behavior.resolution(state, 'r2', [], {
    addTrauma(_state, seat, kind, amount) { traumas.push({ seat, kind, amount }) },
  })
  assert.equal(state.campaign.records.danielStatus, 'survived')
  assert.equal(state.campaign.records.theInvestigatorsWereAttackedAsTheyEscapedTheAsylum, true)
  assert.deepEqual(state.campaign.records.vipsSlain, ['03065'])
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 2)
  assert.deepEqual(traumas, [
    { seat: 0, kind: 'physical', amount: 1 },
    { seat: 1, kind: 'physical', amount: 1 },
  ])
})

test('Unspeakable Oath preserves all three Daniel states for conditional Interlude II', () => {
  const possessed = fixture(oath)
  possessed.victoryDisplay = [{ originalCode: '03182b' }]
  oath.behavior.resolution(possessed, 'r3', [], {})
  assert.equal(possessed.campaign.records.danielStatus, 'possessed')

  const missing = fixture(oath)
  oath.behavior.resolution(missing, 'r3', [], {})
  assert.equal(missing.campaign.records.danielStatus, 'didNotSurvive')
})

// ---------------------------------------------------------------------------
// 往事回声 · 隐藏的图书馆 / [[通道]]（03126 幕 3 正面规则、03139、03141）
// ---------------------------------------------------------------------------
// 规则（实体卡 / FAQ）：
//   · 03139 隐藏的图书馆印刷特性 []、印刷连接 []；「敌人移动时获得[[通道]]特性」。
//   · 03126 幕 3 正面：「带有[[通道]]特性的地点互相连接」——动态、双向：特性出现/消失时
//     连接随之出现/消失；印刷连接永远保留。规则本身由 03126 条目声明
//     actRule.locationTraitLinks，引擎（src/engine/location-traits.js）随幕自动安装/撤销；
//     章节 behavior 不再维护任何私有实现。
//   · 03141 皮博迪先生：[action]横置：选择一个地点（任意在场地点，含自己所在地点与隐藏的
//     图书馆）；直到他重整，该地点隐藏值 -1 并获得[[通道]]特性；他重整时效果结束。
//
// 这里用合成 state + 引擎原语导出（syncLocationTraitLinks / addLocationTrait / ...）验证；
// 直接调章节 behavior 钩子时，api 桩把特性/帷幕原语转发给引擎，和真实引擎同源。

const PASSAGEWAY = 'Passageway'
const originalOf = card => card?.originalCode || card?.code
const hasPassageway = location => (location?.traits || [])
  .some(trait => String(trait).toLowerCase() === PASSAGEWAY.toLowerCase())
const locationById = (state, id) => state.locations.find(location => location.id === id)
const connectionsOf = (state, id) => locationById(state, id)?.connections || []
const traitGrantsOf = state => state.locationTraitLinks || null

// 用剧本自己的 setupLocations 选出确定性的 9 个在场地点（setupApi.shuffle 保持原顺序），
// 再手工铺成 state.locations 实例——不依赖引擎开局，也不依赖随机数。
function echoesBoard(records = {}) {
  const state = fixture(echoes, records)
  echoes.behavior.setupLocations(state, [], setupApi)
  state.locations = echoes.behavior.setupPlan(state).locations.map(id => ({
    ...clone(echoes.scenario.locations[id]), id, revealed: false, clues: 0, maxClues: 0,
  }))
  return state
}

function addHiddenLibrary(state) {
  const location = { ...clone(echoes.scenario.locations.hiddenLibrary), id: 'hiddenLibrary', revealed: false, clues: 0, maxClues: 0 }
  state.locations.push(location)
  return location
}

// 引擎接线：幕 3 成为当前幕后重算「特性连接规则」（真实引擎在 advanceAct 里做同一件事）。
function activateActThree(state) {
  state.actIndex = 2
  syncLocationTraitLinks(state)
  return activeLocationTraitLinks(state)
}

function givePeabody(state, seat = 0) {
  const inv = state.investigators[seat]
  inv.assets.push({ id: `peabody-${seat}`, code: '03141', exhausted: false })
  return inv
}

// 直接调章节 behavior 时的 api 桩：原语转发给引擎导出（与 scenario-runtime 同源）。
function primitiveApi(state, overrides = {}) {
  return {
    addLocationTrait: (location, trait, options = {}) => addLocationTrait(state, location, trait, options),
    removeLocationTrait: (location, trait, options = {}) => removeLocationTrait(state, location, trait, options),
    grantedLocationTraits: location => grantedLocationTraits(location),
    setShroudMod: (location, amount) => setLocationShroudMod(location, amount),
    ...overrides,
  }
}

function peabodyApi(state, targetId) {
  const logs = []
  const requests = []
  return {
    logs,
    requests,
    api: primitiveApi(state, {
      choose(request) {
        requests.push(request)
        const option = request.options.find(candidate => candidate.id === targetId)
        assert.ok(option, `皮博迪先生的选项应包含 ${targetId}（实际：${request.options.map(item => item.id).join(',')}）`)
        return option.id
      },
      info: text => logs.push(text),
    }),
  }
}

function reachDistance(state, from, to) {
  if (from === to) return 0
  const queue = [[from, 0]]
  const seen = new Set([from])
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of connectionsOf(state, id)) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Infinity
}

test('Echoes 03125 背面：隐藏的图书馆入场时无特性/无连接（静态通道清单已删除）', () => {
  const state = echoesBoard()
  assert.equal(echoes.scenario.passagewayLocations, undefined, 'definition 不再有静态 passagewayLocations')
  // 幕 2（03125）当前：没有声明任何特性连接规则。
  state.actIndex = 1
  const placed = []
  const given = []
  const api = {
    choose: () => '0',
    giveAsset(seat, code) {
      given.push({ seat, code })
      state.investigators[seat].assets.push({ id: 'peabody-given', code })
    },
    place(id) {
      placed.push(id)
      addHiddenLibrary(state)
      syncLocationTraitLinks(state) // 真实引擎 placeLocation 后会同步，这里模拟同一时点
    },
  }
  act03125.actRule.onReveal(state, { originalCode: '03125' }, api)

  assert.deepEqual(placed, ['hiddenLibrary'])
  assert.deepEqual(given, [{ seat: 0, code: '03141' }])
  const hidden = locationById(state, 'hiddenLibrary')
  assert.ok(hidden, '隐藏的图书馆已放入场')
  assert.equal(hidden.revealed, false)
  assert.deepEqual(hidden.traits, [])
  assert.deepEqual(hidden.connections, [])
  assert.equal(activeLocationTraitLinks(state), null, '幕 2 背面不应提前激活幕 3 规则')
  assert.equal(traitGrantsOf(state), null, '没有规则时不写 state.locationTraitLinks')
  for (const id of ['meetingRoom', 'secondLibrary', 'thirdLibrary', 'peabodysOffice']) {
    assert.equal(connectionsOf(state, id).includes('hiddenLibrary'), false, `${id} 不应连到隐藏的图书馆`)
    assert.equal(connectionsOf(state, 'hiddenLibrary').includes(id), false, `隐藏的图书馆不应连到 ${id}`)
  }
})

test('Echoes 幕 3：actRule.locationTraitLinks 声明让带[[通道]]特性的地点动态互相连接（双向、幂等、保留印刷连接）', () => {
  const state = echoesBoard()
  // 幕 1/2 当前：没有声明规则，也不应新增任何自动连线。
  syncLocationTraitLinks(state)
  assert.equal(activeLocationTraitLinks(state), null)
  assert.equal(locationById(state, 'meetingRoom').connections.includes('secondLibrary'), false,
    '规则激活前印刷连接之外不应有通道连线')

  const links = activateActThree(state)
  assert.deepEqual(links.rules, [{ id: 'act:03126:Passageway', trait: PASSAGEWAY }],
    '03126 条目的 actRule.locationTraitLinks 声明被引擎读到')
  assert.deepEqual(links.added.map(([from, to]) => `${from}→${to}`).sort(), [
    'meetingRoom→peabodysOffice', 'meetingRoom→secondLibrary', 'meetingRoom→thirdLibrary',
    'peabodysOffice→meetingRoom', 'peabodysOffice→secondLibrary', 'peabodysOffice→thirdLibrary',
    'secondLibrary→meetingRoom', 'secondLibrary→peabodysOffice', 'secondLibrary→thirdLibrary',
    'thirdLibrary→meetingRoom', 'thirdLibrary→peabodysOffice', 'thirdLibrary→secondLibrary',
  ].sort(), '规则只加「两个[[通道]]地点之间」的有向边，并按固定顺序记账')

  const passageways = state.locations.filter(hasPassageway).map(location => location.id).sort()
  assert.deepEqual(passageways, ['meetingRoom', 'peabodysOffice', 'secondLibrary', 'thirdLibrary'])
  for (const id of passageways) {
    const connections = connectionsOf(state, id)
    for (const other of passageways) {
      if (other === id) continue
      assert.equal(connections.includes(other), true, `${id} → ${other}`)
      assert.equal(connectionsOf(state, other).includes(id), true, `${other} → ${id}`)
    }
    assert.deepEqual(grantedLocationTraits(locationById(state, id)), [], '印刷特性不算运行期授予')
  }
  // 非[[通道]]地点既不被规则连上，也没被改写（印刷连接保持原样）。
  for (const location of state.locations.filter(candidate => !hasPassageway(candidate))) {
    assert.deepEqual(location.connections, echoes.scenario.locations[location.id].connections,
      `${location.id} 的印刷连接不应被规则改写`)
  }
  // 印刷连接保留：会议室印着通往入口大厅/宁静走廊的出口。
  assert.ok(connectionsOf(state, 'meetingRoom').includes('entryHall'))
  assert.ok(connectionsOf(state, 'meetingRoom').includes('quietHallsSecond'))

  // 幂等：重复同步不应重复追加、改变顺序或改写记账。
  const snapshot = JSON.stringify(state)
  syncLocationTraitLinks(state)
  assert.equal(JSON.stringify(state), snapshot, '重复同步幂等')

  // 离开幕 3：只撤销规则自己加过的边，印刷连接（含单向）与印刷特性保留。
  state.actIndex = 1
  syncLocationTraitLinks(state)
  assert.equal(activeLocationTraitLinks(state), null, '规则失效后不保留状态键')
  for (const location of state.locations) {
    assert.deepEqual(location.connections, echoes.scenario.locations[location.id].connections,
      `${location.id} 恢复为印刷连接`)
  }
  assert.deepEqual(state.locations.filter(hasPassageway).map(location => location.id).sort(),
    ['meetingRoom', 'peabodysOffice', 'secondLibrary', 'thirdLibrary'], '印刷[[通道]]特性永不撤销')
})

test('Echoes 皮博迪先生：隐藏的图书馆获得[[通道]] + 隐藏值 -1 + 双向连接，轮末撤销', () => {
  const state = echoesBoard()
  const hidden = addHiddenLibrary(state)
  const inv = givePeabody(state)
  activateActThree(state)
  const { logs, requests, api } = peabodyApi(state, 'hiddenLibrary')
  const move = echoes.behavior.actions(state, inv).find(candidate => candidate.rule === 'peabodyPassage')
  assert.ok(move, '皮博迪先生的行动在合法列表里')

  echoes.behavior.performAction(state, inv, move, api)
  // 目标 = 全部在场地点（含调查员所在地点与隐藏的图书馆）。
  assert.deepEqual(requests[0].options.map(option => option.id).sort(),
    state.locations.map(location => location.id).sort())
  assert.ok(requests[0].options.some(option => option.id === inv.location), '包含行动调查员所在地点')
  assert.equal(inv.assets.find(asset => originalOf(asset) === '03141').exhausted, true)
  assert.deepEqual(state.scenarioFlags.peabodyPassage, { locationId: 'hiddenLibrary' })
  assert.equal(hasPassageway(hidden), true)
  assert.equal(hidden.shroudMod, -1, '隐藏值 -1 走地点帷幕原语（不再写 peabodyShroud）')
  assert.deepEqual(grantedLocationTraits(hidden), [PASSAGEWAY], '运行期授予按来源记在地点实例上')
  assert.deepEqual(hidden.traitGrants, { Passageway: ['03141'] })
  assert.ok(logs.some(text => text.includes('皮博迪先生') && text.includes('隐藏的图书馆')))

  const printedPassageways = state.locations.filter(location =>
    location.id !== 'hiddenLibrary' && hasPassageway(location))
  assert.ok(printedPassageways.length >= 1)
  for (const location of printedPassageways) {
    assert.equal(connectionsOf(state, 'hiddenLibrary').includes(location.id), true, `隐藏的图书馆 → ${location.id}`)
    assert.equal(connectionsOf(state, location.id).includes('hiddenLibrary'), true, `${location.id} → 隐藏的图书馆`)
  }

  echoes.behavior.roundEnded(state, primitiveApi(state, { info() {} }))
  assert.equal(hasPassageway(hidden), false, '轮末撤销授予的[[通道]]')
  assert.deepEqual(grantedLocationTraits(hidden), [])
  assert.equal(hidden.shroudMod, 0, '隐藏值修正在轮末反向撤销')
  assert.deepEqual(hidden.connections, [], '轮末撤销隐藏的图书馆的自动连接')
  assert.equal(state.scenarioFlags.peabodyPassage, undefined)
  // 幕 3 规则仍在：印刷[[通道]]地点之间依旧互相连接。
  const remaining = state.locations.filter(hasPassageway).map(location => location.id)
  for (const id of remaining) for (const other of remaining) {
    if (id === other) continue
    assert.equal(connectionsOf(state, id).includes(other), true)
  }
})

test('Echoes 皮博迪先生：指向印刷[[通道]]地点时，轮末只撤销授予、不删印刷特性', () => {
  const state = echoesBoard()
  addHiddenLibrary(state)
  activateActThree(state)
  const inv = givePeabody(state)
  const printed = locationById(state, 'meetingRoom')
  const { api } = peabodyApi(state, 'meetingRoom')

  echoes.behavior.performAction(state, inv, echoes.behavior.actions(state, inv)
    .find(candidate => candidate.rule === 'peabodyPassage'), api)
  assert.deepEqual(grantedLocationTraits(printed), [PASSAGEWAY])
  assert.deepEqual(printed.traitGrants, { Passageway: ['03141'] })
  assert.equal(printed.shroudMod, -1)
  assert.equal(hasPassageway(printed), true)

  echoes.behavior.roundEnded(state, primitiveApi(state, { info() {} }))
  assert.equal(hasPassageway(printed), true, '印刷[[通道]]特性不能被误删')
  assert.deepEqual(grantedLocationTraits(printed), [])
  assert.equal(printed.traitGrants, undefined, '来源清空后删除记账字段（不污染存档）')
  assert.equal(printed.shroudMod, 0)
  assert.equal(state.scenarioFlags.peabodyPassage, undefined)
  // 规则连接保留（双向）。
  for (const other of state.locations.filter(hasPassageway)) {
    if (other.id === printed.id) continue
    assert.equal(connectionsOf(state, printed.id).includes(other.id), true)
    assert.equal(connectionsOf(state, other.id).includes(printed.id), true)
  }
})

test('Echoes 敌人阶段：隐藏的图书馆临时获得[[通道]]，猎手可寻路进入；移动结束还原', () => {
  const state = echoesBoard()
  addHiddenLibrary(state)
  activateActThree(state)
  const hidden = locationById(state, 'hiddenLibrary')
  state.investigators[0].location = 'hiddenLibrary'
  const api = primitiveApi(state, { info() {} })

  echoes.behavior.enemyPhaseStart(state, api)
  assert.equal(state.scenarioFlags.hiddenLibraryTemporaryPassageway, undefined, '临时窗口不再需要场景标记')
  assert.equal(hasPassageway(hidden), true, '敌人移动窗口内获得[[通道]]')
  assert.deepEqual(hidden.traitGrants, { Passageway: ['03139'] }, '临时授予按来源记账（03139）')
  assert.deepEqual(grantedLocationTraits(hidden), [PASSAGEWAY])
  const printedPassageways = state.locations.filter(location =>
    location.id !== 'hiddenLibrary' && hasPassageway(location))
  for (const location of printedPassageways) {
    assert.equal(connectionsOf(state, 'hiddenLibrary').includes(location.id), true)
    assert.equal(connectionsOf(state, location.id).includes('hiddenLibrary'), true)
  }
  // 猎手（例如站在会议室）此刻能一步走进隐藏的图书馆。
  assert.equal(reachDistance(state, 'meetingRoom', 'hiddenLibrary'), 1)

  echoes.behavior.enemyPhaseAfterHunters(state, api)
  assert.equal(state.scenarioFlags.hiddenLibraryTemporaryPassageway, undefined)
  assert.equal(hasPassageway(hidden), false, '移动窗口结束后撤销临时[[通道]]')
  assert.deepEqual(hidden.traitGrants, undefined)
  assert.deepEqual(hidden.connections, [])
  assert.equal(reachDistance(state, 'meetingRoom', 'hiddenLibrary'), Infinity)
})

test('Echoes 敌人阶段：皮博迪先生已授予[[通道]]时，临时窗口不覆盖也不提前撤销', () => {
  const state = echoesBoard()
  const hidden = addHiddenLibrary(state)
  activateActThree(state)
  const inv = givePeabody(state)
  const { api: peabodyGrantApi } = peabodyApi(state, 'hiddenLibrary')
  echoes.behavior.performAction(state, inv, echoes.behavior.actions(state, inv)
    .find(candidate => candidate.rule === 'peabodyPassage'), peabodyGrantApi)

  echoes.behavior.enemyPhaseStart(state, primitiveApi(state, { info() {} }))
  assert.equal(state.scenarioFlags.hiddenLibraryTemporaryPassageway, undefined, '临时窗口不再写标记')
  assert.deepEqual(hidden.traitGrants, { Passageway: ['03139', '03141'] },
    '两个来源同时授予同一特性，互不覆盖')
  echoes.behavior.enemyPhaseAfterHunters(state, primitiveApi(state, { info() {} }))
  assert.equal(hasPassageway(hidden), true, '皮博迪先生的授予在敌人阶段结束后仍然有效')
  assert.deepEqual(grantedLocationTraits(hidden), [PASSAGEWAY])
  assert.deepEqual(hidden.traitGrants, { Passageway: ['03141'] }, '只撤销 03139 这个来源')
  assert.equal(hidden.shroudMod, -1, '皮博迪先生的 -1 隐藏值仍然有效')

  echoes.behavior.roundEnded(state, primitiveApi(state, { info() {} }))
  assert.equal(hasPassageway(hidden), false)
  assert.deepEqual(grantedLocationTraits(hidden), [])
  assert.equal(hidden.shroudMod, 0)
})

