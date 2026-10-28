import test from 'node:test'
import assert from 'node:assert/strict'
import * as fate from '../content/campaigns/theForgottenAge/scenarios/threadsOfFate/index.js'
import { scenario as definition, ACTS_BY_CODE, SPECIAL_ACT_OBJECTIVES } from '../content/campaigns/theForgottenAge/scenarios/threadsOfFate/definition.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../content/campaigns/theForgottenAge/tfa-chaos.js'
import { attachLocationCard, locationAttachmentTotal } from '../src/engine/location-attachments.js'

const clone = value => structuredClone(value)
const originals = state => state.acts.map(act => act.originalCode)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return { randomValue }
}

function makeApi(state, overrides = {}) {
  const log = []
  const cleanups = []
  return {
    log,
    cleanups,
    info: text => log.push(text),
    random: () => 0.5,
    attachToAgenda(code) {
      const agenda = state.agendas?.[state.agendaIndex]
      if (!agenda) return null
      agenda.attachments ||= []
      agenda.attachments.push({ id: `a-${code}-${agenda.attachments.length + 1}`, code, originalCode: code })
      return agenda.attachments.at(-1)
    },
    addAgendaDoomThreshold(delta = 1) {
      const agenda = state.agendas?.[state.agendaIndex]
      if (!agenda) return null
      agenda.doomThreshold = Math.max(1, (agenda.doomThreshold || 0) + Number(delta || 0))
      return agenda.doomThreshold
    },
    place(id) {
      const base = state.scenario.locations[id]
      if (!base) throw new Error(`未声明地点 ${id}`)
      if (state.locations.some(location => location.id === id)) return
      state.locations.push({ ...clone(base), id, revealed: true,
        clues: base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators })
    },
    reveal: id => {
      const location = state.locations.find(entry => entry.id === id)
      if (location) location.revealed = true
    },
    spawn(code, locationId) {
      const base = state.scenario.enemies?.[code]
      if (!base) throw new Error(`未声明敌人 ${code}`)
      const enemy = { ...clone(base), id: `e-${code}-${state.enemies.length}`, originalCode: code,
        code, location: locationId, damageTaken: 0, doom: 0, exhausted: false, engagedSeat: null }
      state.enemies.push(enemy)
      return enemy
    },
    storyAsset(code, locationId) {
      state.storyAssets ||= []
      if (state.storyAssets.some(asset => asset.originalCode === code)) return
      state.storyAssets.push({ id: `story-${code}`, code, originalCode: code,
        name: code, location: locationId, clues: 0, exhausted: false, controllerSeat: null })
    },
    giveAsset(seat, code) {
      const inv = state.investigators[seat]
      inv.assets.push({ id: `a-${code}-${inv.assets.length}`, code, originalCode: code, exhausted: false })
    },
    threat(seat, code) {
      state.investigators[seat].threat.push({ id: `t-${code}`, code, originalCode: code })
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount },
    drawCards: (seat, amount) => { for (let i = 0; i < amount; i++) state.investigators[seat].hand.push('01020') },
    discardChosen: (seat, amount) => {
      for (let i = 0; i < amount; i++) state.investigators[seat].hand.pop()
    },
    discardTop: (seat, amount) => {
      const inv = state.investigators[seat]
      for (let i = 0; i < amount && inv.deck.length; i++) inv.discard.push(inv.deck.pop())
    },
    drawEncounter: seat => { state.investigators[seat].drawnEncounter = (state.investigators[seat].drawnEncounter || 0) + 1 },
    shuffleDiscard: () => { state.encounterDeck.push(...state.encounterDiscard.splice(0)) },
    addDoom: amount => { state.doom = (state.doom || 0) + amount },
    trauma: (seat, kind, amount) => {
      const inv = state.investigators[seat]
      inv.trauma ||= {}
      inv.trauma[kind] = (inv.trauma[kind] || 0) + amount
    },
    defeat: (inv) => { inv.defeated = true },
    resign: seat => { state.investigators[seat].resigned = true },
    finish: key => { state.finished = key; state.status = 'finished' },
    choose: request => (request?.options?.[0]?.id ?? '0'),
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill, drawn: [] }),
    ...overrides,
  }
}

function stateFor(count = 2, records = {}, flags = {}) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'rivertown',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: { ...flags },
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: clone(definition.encounterDeck),
    encounterDiscard: [],
    relicOfAges: null,
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [] })),
      chaosBag: [],
    },
    chaosBag: [],
    victory: 0,
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

// 布置 + 把初始地点送进场（引擎的 placeLocation 等价物）。
function setup(state, seedOrHelper = 7, overrides = {}) {
  const api = makeApi(state, overrides)
  const helper = typeof seedOrHelper === 'number' ? setupApi(seedOrHelper) : seedOrHelper
  const ids = fate.behavior.setupLocations(state, [], helper)
  for (const id of ids) api.place(id)
  return api
}

const actsOf = state => state.scenarioFlags.actDecks

test('命运之线 M5：章节升级为 playable，保留原卡身份', () => {
  assert.equal(fate.manifest.status, 'playable')
  assert.equal(fate.manifest.catalogReferenceOnly, undefined)
  assert.equal(fate.scenario.originalCode, '04113')
  assert.equal(fate.manifest.locations.length, 12)
  assert.equal(fate.manifest.acts.length, 24)
  assert.deepEqual(fate.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(fate.manifest.resolutionIds, ['noResolution', 'r1'])
  assert.ok(Array.isArray(fate.behavior.implementedEncounterCodes))
  for (const code of ['04122b', '04130b', '04137b', '04144', '04146', '01135', '01136',
    '01170', '01171', '01173', '01174']) {
    assert.ok(fate.behavior.implementedEncounterCodes.includes(code), code)
  }
  for (const code of ['04145', '01169', '01172']) {
    assert.equal(fate.behavior.implementedEncounterCodes.includes(code), true,
      `${code} 已由共享钩子/本章行为接上，应列入逐条实现清单`)
  }
})

test('阿卡姆地图：符号连线与卡面文字连线都成立', () => {
  const locations = Object.fromEntries(fate.manifest.locations.map(location => [location.id, location]))
  assert.ok(locations.rivertown.connections.includes('easttown'))
  assert.ok(locations.rivertown.connections.includes('miskatonicUniversity'))
  assert.ok(locations.rivertown.connections.includes('blackCave'))
  assert.ok(locations.northside.connections.includes('trainTracks'))
  assert.ok(locations.northside.connections.includes('curiositieShoppe'))
  assert.ok(locations.downtown.connections.includes('townHall'))
  assert.ok(locations.easttown.connections.includes('velmasDiner'))
  assert.ok(locations.easttown.connections.includes('arkhamPoliceStation'))
  assert.ok(locations.miskatonicUniversity.connections.includes('eztliExhibit'))
  assert.equal(locations.rivertown.connections.length, 3)
  assert.equal(locations.eztliExhibit.connections.length, 1)
  // 无符号地点靠卡面文字相连：两个方向都要有边。
  assert.deepEqual(locations.velmasDiner.connections, ['easttown'])
  assert.deepEqual(locations.curiositieShoppe.connections, ['northside'])
  assert.deepEqual(locations.townHall.connections, ['downtown'])
  assert.deepEqual(locations.arkhamPoliceStation.connections, ['easttown'])
  assert.deepEqual(locations.trainTracks.connections, ['northside'])
  for (const location of fate.manifest.locations) {
    assert.ok(location.connections.length > 0, `${location.id} 没有连线`)
  }
})

test('布置是确定性的：同种子给出同一幕牌库', () => {
  const build = (seedOrHelper, records = {}, flags = {}) => {
    const state = stateFor(2, records, flags)
    setup(state, seedOrHelper)
    return state.scenarioFlags.actDecks
  }
  assert.deepEqual(build(11), build(11))
  const low = build({ randomValue: () => 0.05 })
  const high = build({ randomValue: () => 0.95 })
  assert.notDeepEqual(low, high, '随机样本在 2 选 1 时会给出不同牌组')
  assert.ok(low.ab.cards[1] !== high.ab.cards[1] || low.cd.cards[1] !== high.cd.cards[1])
  const deck = build(11)
  for (const thread of ['ab', 'cd', 'ef']) {
    assert.equal(deck[thread].cards.length, 3)
    assert.equal(deck[thread].index, 0)
    assert.equal(deck[thread].completed, false)
    const last = deck[thread].cards[2]
    assert.equal(ACTS_BY_CODE[deck[thread].cards[1]].next, last)
  }
})

test('战役记录驱动 A/B 线：遗物失窃 vs 哈伦保管', () => {
  const stolen = stateFor(2)
  setup(stolen, 5)
  assert.equal(actsOf(stolen).ab.cards[0], '04117a')
  assert.ok(['04119', '04120'].includes(actsOf(stolen).ab.cards[1]))

  const harlan = stateFor(2, { theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone: true })
  setup(harlan, 5)
  assert.equal(actsOf(harlan).ab.cards[0], '04118a')
  assert.ok(['04121', '04122'].includes(actsOf(harlan).ab.cards[1]))
})

test('序章标记驱动 C/D 与 E/F 线', () => {
  const police = stateFor(2, {}, { gotoPolice: true, listenedToIchtacasTale: true })
  setup(police, 9)
  assert.equal(actsOf(police).cd.cards[0], '04126a')
  assert.equal(actsOf(police).ef.cards[0], '04134a')

  const alone = stateFor(2, {}, { gotoPolice: false, listenedToIchtacasTale: false })
  setup(alone, 9)
  assert.equal(actsOf(alone).cd.cards[0], '04125a')
  assert.equal(actsOf(alone).ef.cards[0], '04133a')
  assert.ok(['04135', '04136'].includes(actsOf(alone).ef.cards[1]))
})

test('布置把市政厅、伊塔卡、探险日志、亚历山卓、古代遗物放在一边', () => {
  const state = stateFor(2)
  const api = makeApi(state)
  const ids = fate.behavior.setupLocations(state, [], setupApi(3))
  assert.deepEqual(ids, ['rivertown', 'northside', 'downtown', 'easttown',
    'miskatonicUniversity', 'velmasDiner', 'curiositieShoppe'])
  assert.deepEqual(state.scenarioZones.setAside, ['04143', '04051', '04061', '04147', '04148'])
  assert.equal(state.relicOfAges.setAside, true)
  assert.equal(state.relicOfAges.code, '04061')
  assert.deepEqual(originals(state), ['04117a', '04126a', '04134a'])
  assert.equal(state.acts.length, 3)
  assert.equal(state.actIndex, 0)
  assert.equal(state.acts[0].objective.type, 'clues')
  assert.equal(state.acts[0].objective.atLocation, 'miskatonicUniversity')
  assert.equal(state.acts[0].objective.perInvestigator, 1)
  void api
})

test('A/B 线：遗物不见了 → 埃兹特里展厅 → 市政厅 + 遗物 → 寻找遗物', () => {
  const state = stateFor(2, {}, { listenedToIchtacasTale: false, gotoPolice: true })
  const api = setup(state, 5)
  state.scenarioFlags.actDecks.ab = { cards: ['04117a', '04119', '04123'], index: 0, completed: false }
  fate.behavior.checkObjectives(state, api)
  assert.equal(actsOf(state).ab.index, 0, '线索目标交给引擎 advanceAct，行为侧不重复推进')
  fate.behavior.actReveal(state, state.acts[0], api)
  assert.ok(state.locations.some(location => location.id === 'eztliExhibit'))
  assert.deepEqual(originals(state), ['04119', '04126a', '04133a'])

  fate.behavior.actReveal(state, state.acts[0], api)
  const hall = state.locations.find(location => location.id === 'townHall')
  assert.ok(hall, '市政厅放置入场')
  assert.equal(state.relicOfAges.location, 'townHall')
  assert.equal(state.relicOfAges.enemyId, undefined)
  assert.equal(hall.clues, 2, '三本幕牌库俱在（>2）时不再加额外线索')
  assert.equal(originals(state)[0], '04123')
  assert.equal(state.acts[0].objective.type, 'actRule')

  hall.clues = 0
  fate.behavior.checkObjectives(state, api)
  assert.equal(actsOf(state).ab.completed, true)
  assert.equal(state.relicOfAges.seat, 0)
  assert.ok(state.investigators[0].assets.some(asset => asset.code === '04061'))
  assert.equal(state.scenarioZones.removed.includes('04123'), true)
  assert.equal(state.finished, undefined, '还有另外两本幕牌库，继续游戏')
})

test('A/B 线：哈伦遇险 → 哈伦的诅咒（敌人）→ 夺回遗物', () => {
  const state = stateFor(2, { theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone: true })
  const api = setup(state, 5)
  state.scenarioFlags.actDecks.ab = { cards: ['04118a', '04122', '04124'], index: 0, completed: false }
  fate.behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.storyAssets.some(asset => asset.originalCode === '04118b'), true)
  assert.equal(state.storyAssets.find(asset => asset.originalCode === '04118b').location, 'easttown')

  fate.behavior.actReveal(state, state.acts[0], api)
  const harlan = state.enemies.find(enemy => enemy.originalCode === '04122b')
  assert.ok(harlan, '哈伦翻面成敌人')
  assert.equal(state.relicOfAges.enemyId, harlan.id)
  assert.equal(state.storyAssets.some(asset => asset.originalCode === '04118b'), false)
  assert.equal(originals(state)[0], '04124')

  harlan.damageTaken = 2
  fate.behavior.actReveal(state, state.acts[0], api)
  assert.equal(actsOf(state).ab.completed, true)
  assert.equal(state.relicOfAges.seat, 0)
})

test('A/B 线：哈伦的诅咒（珍品店）——谈判在资产上放线索后推进', () => {
  const state = stateFor(1, { theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone: true })
  const api = setup(state, 7)
  state.scenarioFlags.actDecks.ab = { cards: ['04118a', '04121', '04123'], index: 0, completed: false }
  fate.behavior.actReveal(state, state.acts[0], api)
  const harlan = state.storyAssets.find(asset => asset.originalCode === '04118b')
  assert.equal(harlan.location, 'easttown')
  assert.equal(originals(state)[0], '04121')

  const inv = state.investigators[0]
  inv.location = 'easttown'
  const parley = fate.behavior.actions(state, inv).find(move => move.rule === 'parleyHarlan')
  assert.ok(parley, '同地点的哈伦可以谈判')
  fate.behavior.performAction(state, inv, parley, {
    ...api,
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty }),
  })
  assert.equal(harlan.clues, 1)

  fate.behavior.checkObjectives(state, api)
  assert.equal(originals(state)[0], '04123')
  assert.equal(state.relicOfAges.location, 'curiositieShoppe', '哈伦的诅咒把遗物附属到珍品店')
})

test('C/D 线：警局 → 火车轨道 + 亚历山卓 → 亚历山卓被关押', () => {
  const state = stateFor(2)
  const api = setup(state, 5)
  state.scenarioFlags.actDecks.cd = { cards: ['04126a', '04128a', '04131'], index: 0, completed: false }
  state.scenarioFlags.focusThread = 'cd'
  fate.behavior.rebuildActs(state)
  fate.behavior.actReveal(state, state.acts[1], api)
  assert.ok(state.locations.some(location => location.id === 'arkhamPoliceStation'))

  fate.behavior.actReveal(state, state.acts[1], api)
  assert.ok(state.locations.some(location => location.id === 'trainTracks'))
  assert.equal(state.scenarioFlags.alejandro.location, 'trainTracks')
  assert.equal(originals(state)[1], '04131')

  state.locations.find(location => location.id === 'trainTracks').clues = 0
  fate.behavior.checkObjectives(state, api)
  assert.equal(actsOf(state).cd.completed, true)
  assert.equal(state.scenarioFlags.alejandro.seat, 0)
  assert.ok(state.investigators[0].assets.some(asset => asset.code === '04051'))
})

test('C/D 线：亨利·德沃翻面成敌人并带走亚历山卓', () => {
  const state = stateFor(2, {}, { gotoPolice: false })
  const api = setup(state, 13)
  state.scenarioFlags.actDecks.cd = { cards: ['04125a', '04130a', '04132'], index: 0, completed: false }
  state.scenarioFlags.focusThread = 'cd'
  fate.behavior.rebuildActs(state)
  fate.behavior.actReveal(state, state.acts[1], api)
  assert.equal(state.storyAssets.find(asset => asset.originalCode === '04125b').location, 'velmasDiner')

  fate.behavior.actReveal(state, state.acts[1], api)
  const henry = state.enemies.find(enemy => enemy.originalCode === '04130b')
  assert.ok(henry)
  assert.equal(state.scenarioFlags.alejandro.enemyId, henry.id)
  assert.equal(originals(state)[1], '04132')

  state.enemies = state.enemies.filter(enemy => enemy.id !== henry.id)
  fate.behavior.checkObjectives(state, api)
  assert.equal(actsOf(state).cd.completed, true)
  assert.equal(state.scenarioFlags.alejandro.seat, 0)
})

test('E/F 线：玛利亚的古怪遗物 → 兄弟会暴露 → 伊塔卡', () => {
  const state = stateFor(2, {}, { listenedToIchtacasTale: true })
  const api = setup(state, 17)
  state.scenarioFlags.actDecks.ef = { cards: ['04134a', '04137a', '04140'], index: 0, completed: false }
  state.scenarioFlags.focusThread = 'ef'
  fate.behavior.rebuildActs(state)
  fate.behavior.actReveal(state, state.acts[2], api)
  assert.equal(state.storyAssets.find(asset => asset.originalCode === '04134b').location, 'curiositieShoppe')

  fate.behavior.actReveal(state, state.acts[2], api)
  const maria = state.enemies.find(enemy => enemy.originalCode === '04137b')
  assert.ok(maria)
  assert.deepEqual(state.scenarioFlags.ichtacasPrey, [maria.id])
  assert.equal(originals(state)[2], '04140')
  assert.equal(fate.behavior.enemyStatModifier(state, maria, 'fight'), 0, '所在地点有线索时不加值')

  const cave = state.locations.find(location => location.id === 'blackCave')
    || state.locations.find(location => location.id === 'rivertown')
  assert.ok(cave)
  cave.clues = 0
  maria.location = cave.id
  assert.equal(fate.behavior.enemyStatModifier(state, maria, 'fight'), 1)
  assert.equal(fate.behavior.enemyStatModifier(state, maria, 'evade'), 1)

  state.enemies = state.enemies.filter(enemy => enemy.id !== maria.id)
  fate.behavior.checkObjectives(state, api)
  assert.equal(actsOf(state).ef.completed, true)
  assert.ok(state.investigators.some(inv => inv.assets.some(asset => asset.code === '04147')))
})

test('E/F 线：漆黑的洞穴需要先清空洞穴线索再共同支付 2/人', () => {
  const state = stateFor(2, {}, { listenedToIchtacasTale: false })
  const api = setup(state, 19)
  state.scenarioFlags.actDecks.ef = { cards: ['04133a', '04135', '04140'], index: 0, completed: false }
  state.scenarioFlags.focusThread = 'ef'
  fate.behavior.rebuildActs(state)
  fate.behavior.actReveal(state, state.acts[2], api)
  const cave = state.locations.find(location => location.id === 'blackCave')
  assert.ok(cave, '幽暗洞穴放置入场')

  fate.behavior.actReveal(state, state.acts[2], api)
  assert.equal(originals(state)[2], '04140')
  assert.ok((state.scenarioFlags.ichtacasPrey || []).length >= 1, '记住伊塔卡的猎物')

  // 再造一个 04135 场景，检查支付条件。
  const second = stateFor(2, {}, { listenedToIchtacasTale: false })
  const secondApi = setup(second, 19)
  second.scenarioFlags.actDecks.ef = { cards: ['04133a', '04135', '04140'], index: 0, completed: false }
  second.scenarioFlags.focusThread = 'ef'
  fate.behavior.rebuildActs(second)
  fate.behavior.actReveal(second, second.acts[2], secondApi)
  const secondCave = second.locations.find(location => location.id === 'blackCave')
  assert.ok(secondCave)
  secondCave.clues = 2
  second.investigators[0].clues = 4
  second.investigators[0].location = 'blackCave'
  fate.behavior.checkObjectives(second, secondApi)
  assert.equal(second.investigators[0].clues, 4, '洞穴里还有线索时不能推进')
  secondCave.clues = 0
  fate.behavior.checkObjectives(second, secondApi)
  assert.equal(second.investigators[0].clues, 0, '共同支付 2/人')
  assert.equal(originals(second)[2], '04140', '漆黑的洞穴背面点名「兄弟会暴露」')
  assert.equal(second.scenarioFlags.actDecks.ef.completed, false)
})

test('E/F 线：隧道的黑暗记住伊塔卡的目的地并连上幽暗洞穴', () => {
  const state = stateFor(2, {}, { listenedToIchtacasTale: false })
  const api = setup(state, 21)
  state.scenarioFlags.actDecks.ef = { cards: ['04133a', '04136', '04139'], index: 0, completed: false }
  state.scenarioFlags.focusThread = 'ef'
  fate.behavior.rebuildActs(state)
  fate.behavior.actReveal(state, state.acts[2], api)
  const drawn = []
  fate.behavior.actReveal(state, state.acts[2], {
    ...api, threat: (seat, code) => drawn.push({ seat, code }),
  })
  assert.deepEqual(state.scenarioFlags.ichtacasDestinations, ['townHall'])
  const hall = state.locations.find(location => location.id === 'townHall')
  const cave = state.locations.find(location => location.id === 'blackCave')
  assert.ok(hall.connections.includes('blackCave'), '隧道把市政厅与幽暗洞穴连起来')
  assert.ok(cave.connections.includes('townHall'))
  assert.equal(originals(state)[2], '04139')

  // 玛利亚的消息：记住商业区与河岸城两个目的地。
  const other = stateFor(2)
  const otherApi = setup(other, 21)
  other.scenarioFlags.actDecks.ef = { cards: ['04134a', '04138', '04139'], index: 0, completed: false }
  other.scenarioFlags.focusThread = 'ef'
  fate.behavior.rebuildActs(other)
  fate.behavior.actReveal(other, other.acts[2], otherApi)
  fate.behavior.actReveal(other, other.acts[2], otherApi)
  assert.deepEqual(other.scenarioFlags.ichtacasDestinations.sort(), ['downtown', 'rivertown'])
  assert.equal(originals(other)[2], '04139')
})

test('三条线都完成后进入结局 1，并写入战役记录与战役卡', () => {
  const state = stateFor(2)
  const api = setup(state, 23)
  const decks = state.scenarioFlags.actDecks
  for (const thread of ['ab', 'cd', 'ef']) {
    decks[thread].index = decks[thread].cards.length - 1
    decks[thread].completed = true
  }
  fate.behavior.rebuildActs(state)
  assert.equal(state.acts.every(act => act.completed), true)
  assert.equal(state.acts.every(act => act.objective === undefined), true)

  const result = fate.behavior.resolution(state, 'r1', [], api)
  assert.deepEqual(result, { award: true, bonus: 3 })
  const records = state.campaign.records
  assert.equal(records.theInvestigatorsFoundTheMissingRelic, true)
  assert.equal(records.theInvestigatorsRescuedAlejandro, true)
  assert.equal(records.theInvestigatorsForgedABondWithIchtaca, true)
  assert.equal(records.theRelicIsMissing, undefined)
  assert.equal(state.campaign.campaignCards.sort().join(','), '04051,04061,04147,04148')
  assert.ok(state.campaign.investigators.every(entry => entry.deck.includes('04061')))
  assert.ok(state.campaign.investigators[0].deck.includes('04148'))
  // 伊塔卡与探险日志是「一位调查员」的奖励：另一人不应也被复制一份。
  assert.equal(state.campaign.investigators[1].deck.includes('04148'), false)
  assert.equal(state.campaign.investigators[1].deck.includes('04147'), false)
})

test('没有完成的线写入「缺失」记录，开辟自己的道路时不给战役卡', () => {
  const state = stateFor(2)
  const api = setup(state, 29)
  state.campaign.records.youAreForgingYourOwnWay = true
  const decks = state.scenarioFlags.actDecks
  decks.ab.index = 1
  fate.behavior.resolution(state, 'noResolution', [], api)
  const records = state.campaign.records
  assert.equal(records.theRelicIsMissing, true)
  assert.equal(records.alejandroIsMissing, true)
  assert.equal(records.ichtacaIsInTheDark, true)
  assert.equal(records.theInvestigatorsFoundTheMissingRelic, undefined)
  assert.equal(state.campaign.campaignCards.includes('04051'), false)
  assert.equal(state.campaign.campaignCards.includes('04061'), false)
  assert.equal(state.campaign.campaignCards.includes('04148'), true)
  assert.throws(() => fate.behavior.resolution(state, 'r9', [], api), /未知命运之线结局/)
})

test('密谋推进：洗回遭遇弃牌并在场上有 2 本幕牌库时放置毁灭', () => {
  const state = stateFor(2)
  const api = setup(state, 31)
  state.encounterDiscard = ['04144']
  state.scenarioFlags.actDecks.ab.completed = true
  fate.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.encounterDeck.includes('04144'), true)
  assert.deepEqual(state.encounterDiscard, [])
  assert.equal(state.doom, 1)
  state.scenarioFlags.actDecks.cd.completed = true
  state.doom = 0
  fate.behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.doom, 2, '只有 1 本幕牌库时放置 2 点毁灭')
})

test('密谋 3 推进：幸存调查员被击败并承受 1 点精神创伤', () => {
  const state = stateFor(2)
  const api = setup(state, 37)
  fate.behavior.agendaReveal(state, state.agendas[2], api)
  assert.ok(state.investigators.every(inv => inv.defeated === true))
  assert.ok(state.investigators.every(inv => inv.trauma.mental === 1))
})

test('本章遭遇卡：密不可泄的难度与伤害随幕牌库数量变化', () => {
  const state = stateFor(2)
  const api = setup(state, 41)
  const trick = { code: '04144', originalCode: '04144' }
  let difficulty = null
  fate.behavior.resolveEncounter(state, state.investigators[0], trick, {
    ...api,
    test: (seat, skill, value, resolve) => { difficulty = value; resolve({ success: false, value: 0 }) },
  })
  assert.equal(difficulty, 3, '三本幕牌库时难度 3')
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)

  state.scenarioFlags.actDecks.ab.completed = true
  fate.behavior.resolveEncounter(state, state.investigators[0], trick, {
    ...api,
    test: (seat, skill, value, resolve) => { difficulty = value; resolve({ success: false, value: 0 }) },
  })
  assert.equal(difficulty, 4)
  assert.equal(state.investigators[0].damage, 3)
  assert.equal(state.investigators[0].horror, 3)
})

test('本章遭遇卡：鲜血阴谋附属密谋、降低毁灭阈值并提供谈判行动', () => {
  const state = stateFor(1)
  const api = setup(state, 43)
  const inv = state.investigators[0]
  const threshold = state.agendas[0].doomThreshold
  assert.equal(fate.behavior.resolveEncounter(state, inv, { code: '04146', originalCode: '04146' }, api), true)
  assert.equal(state.agendas[0].doomThreshold, threshold - 1)

  const cultist = api.spawn('04095', inv.location)
  const moves = fate.behavior.actions(state, inv)
  const parley = moves.find(move => move.rule === 'parleyConspiracy')
  assert.ok(parley, '同一地点的异教徒可以谈判')
  assert.equal(parley.enemyId, cultist.id)

  fate.behavior.performAction(state, inv, parley, {
    ...api,
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty }),
  })
  assert.equal(state.agendas[0].doomThreshold, threshold)
  assert.equal(state.agendas[0].attachments.length, 0)

  const fail = api.spawn('04095', inv.location)
  assert.equal(fate.behavior.resolveEncounter(state, inv, { code: '04146', originalCode: '04146' }, api), true)
  fate.behavior.performAction(state, inv, { ...parley, enemyId: fail.id }, {
    ...api,
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0 }),
  })
  assert.equal(fail.doom, 1)
})

test('本章遭遇卡：追猎鬼影与错误指示', () => {
  const state = stateFor(1)
  const api = setup(state, 47)
  const inv = state.investigators[0]
  inv.clues = 1
  fate.behavior.resolveEncounter(state, inv, { code: '01135', originalCode: '01135' }, {
    ...api, choose: () => 'damage',
  })
  assert.equal(inv.damage, 2)
  fate.behavior.resolveEncounter(state, inv, { code: '01135', originalCode: '01135' }, {
    ...api, choose: () => 'clue',
  })
  assert.equal(inv.clues, 0)

  inv.clues = 0
  let surged = 0
  fate.behavior.resolveEncounter(state, inv, { code: '01136', originalCode: '01136' }, {
    ...api, drawEncounter: () => { surged += 1 },
  })
  assert.equal(surged, 1, '没有线索时获得涌动')

  inv.clues = 2
  fate.behavior.resolveEncounter(state, inv, { code: '01136', originalCode: '01136' }, {
    ...api,
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 1 }),
  })
  assert.equal(inv.clues, 0)
  assert.equal(state.locations.find(location => location.id === 'rivertown').clues, 3)
})

test('哈伦·恩斯通被躲避超过 3 点后加入胜利区', () => {
  const state = stateFor(1)
  const api = setup(state, 53)
  const harlan = api.spawn('04122b', 'easttown')
  fate.behavior.afterEvade(state, state.investigators[0], harlan, { success: true, value: 6, difficulty: 3 }, api)
  assert.equal(state.enemies.length, 0)
  assert.deepEqual(state.victoryDisplay.map(card => card.originalCode), ['04122b'])

  const other = api.spawn('04122b', 'easttown')
  fate.behavior.afterEvade(state, state.investigators[0], other, { success: true, value: 5, difficulty: 3 }, api)
  assert.equal(state.enemies.length, 1, '只超过 2 点不算')
})

test('地点与混乱标记：埃兹特里展厅的强制恐惧、幽暗洞穴的回合末选择', () => {
  const state = stateFor(1)
  const api = setup(state, 59)
  const inv = state.investigators[0]
  api.place('eztliExhibit')
  inv.location = 'eztliExhibit'
  fate.behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 2, skill: 'intellect',
    source: { label: '调查' }, drawn: ['skull'],
  }, api)
  assert.equal(inv.horror, 1)

  inv.location = 'rivertown'
  fate.behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 2, skill: 'intellect',
    source: { label: '调查' }, drawn: ['skull'],
  }, api)
  assert.equal(inv.horror, 1, '不在展厅不触发')

  api.place('blackCave')
  inv.location = 'blackCave'
  inv.hand = ['a', 'b', 'c']
  fate.behavior.turnEnded(state, inv, { ...api, choose: () => 'discard' })
  assert.equal(inv.hand.length, 1)
  fate.behavior.turnEnded(state, inv, { ...api, choose: () => 'horror' })
  assert.equal(inv.horror, 2)
})

test('混乱标记表照 04113 卡面：骷髅看异教徒身上的毁灭标记', () => {
  const state = stateFor(2)
  const api = setup(state, 61)
  const inv = state.investigators[0]
  const cultist = api.spawn('04095', inv.location)
  cultist.doom = 2
  assert.equal(fate.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -2)
  state.difficulty = 'hard'
  assert.equal(fate.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -2)
  cultist.doom = 1
  assert.equal(fate.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -1)
  assert.equal(fate.behavior.resolveChaosToken(state, inv, 'cultist', api).delta, -2)
  assert.equal(fate.behavior.resolveChaosToken(state, inv, 'tablet', api).delta, -2)
  assert.equal(fate.behavior.resolveChaosToken(state, inv, 'elderthing', api).delta, -3)
})

test('行动：撤退、维尔玛小餐馆、火车轨道与切换当前幕', () => {
  const state = stateFor(1)
  const api = setup(state, 67)
  const inv = state.investigators[0]
  api.place('velmasDiner')
  inv.location = 'velmasDiner'
  const moves = fate.behavior.actions(state, inv)
  assert.ok(moves.some(move => move.rule === 'resignAgenda'))
  assert.ok(moves.some(move => move.rule === 'focusAct' && move.thread === 'cd'))
  const gossip = moves.find(move => move.rule === 'velmasGossip')
  assert.equal(gossip.actions, 3)
  fate.behavior.performAction(state, inv, gossip, api)
  assert.equal(inv.clues, 2)
  // 用掉后不再可执行，但保留一条带 used 的提示，避免地点能力无声消失。
  const gossipAfter = fate.behavior.actions(state, inv).find(move => move.rule === 'velmasGossip')
  assert.equal(gossipAfter.used, true)
  assert.match(gossipAfter.reason, /本场游戏已使用/)
  assert.equal(fate.behavior.actions(state, inv).some(move => move.rule === 'velmasGossip' && !move.reason), false)

  api.place('trainTracks')
  inv.location = 'trainTracks'
  inv.clues = 1
  const draw = fate.behavior.actions(state, inv).find(move => move.rule === 'trainTracksDraw')
  fate.behavior.performAction(state, inv, draw, api)
  assert.equal(inv.clues, 0)
  assert.equal(inv.hand.length, 4)

  fate.behavior.performAction(state, inv, { rule: 'focusAct', thread: 'ef' }, api)
  assert.equal(state.scenarioFlags.focusThread, 'ef')
  assert.equal(state.actIndex, 2)
  const resign = fate.behavior.actions(state, inv).find(move => move.rule === 'resignAgenda')
  fate.behavior.performAction(state, inv, resign, api)
  assert.equal(inv.resigned, true)
})

test('存档一致性：两次同种子布置的 JSON 完全一致', () => {
  const build = seed => {
    const state = stateFor(2, { theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone: true })
    const api = setup(state, seed)
    state.scenarioFlags.actDecks.cd.completed = true
    fate.behavior.rebuildActs(state)
    fate.behavior.actReveal(state, state.acts[0], api)
    return JSON.stringify(state)
  }
  const first = build(71)
  assert.equal(first, build(71))
  const restored = JSON.parse(first)
  assert.equal(restored.scenario.id, 'threadsOfFate')
  assert.equal(restored.scenarioFlags.actDecks.ab.cards[0], '04118a')
  assert.equal(restored.acts.length, 3)
  assert.deepEqual(SPECIAL_ACT_OBJECTIVES['04139'], { kind: 'destinationsEmpty' })
})

test('布置三选一：C/D 与 E/F 的分支由玩家选择（P2）', () => {
  const police = stateFor(1)
  fate.behavior.preScenarioSetup(police, [], makeApi(police, { choose: request => request.options[0].id }))
  setup(police)
  assert.equal(actsOf(police).cd.cards[0], '04126a', '去警局')
  assert.equal(actsOf(police).ef.cards[0], '04134a', '听了故事')

  const own = stateFor(1)
  fate.behavior.preScenarioSetup(own, [], makeApi(own, { choose: request => request.options[1].id }))
  setup(own)
  assert.equal(actsOf(own).cd.cards[0], '04125a', '自己找')
  assert.equal(actsOf(own).ef.cards[0], '04133a', '没听故事')

  // 没有 api.choose 的旧夹具沿用默认：去警局、听故事。
  const fallback = stateFor(1)
  fate.behavior.preScenarioSetup(fallback, [], {})
  setup(fallback)
  assert.equal(actsOf(fallback).cd.cards[0], '04126a')
  assert.equal(actsOf(fallback).ef.cards[0], '04134a')
})

test('04113 困难面：skull 用场上毁灭总数，cultist 不足 2 点受直接伤害，elder_thing 真正失去线索', () => {
  const state = stateFor(1)
  state.difficulty = 'hard'
  state.locations = [{ id: 'rivertown', name: '河岸城', clues: 2, doom: 2, connections: [] }]
  state.enemies = [{ id: 'c1', code: '01169', originalCode: '01169', name: '异教徒',
    traits: ['Cultist'], doom: 1, location: 'rivertown' }]
  state.victoryDisplay = []
  const inv = state.investigators[0]
  inv.clues = 2
  assert.equal(tfaChaosToken('threadsOfFate', state, inv, 'skull', {}).delta, -3,
    '地点 2 + 异教徒 1 = 场上毁灭总数 3')
  const calls = []
  tfaChaosAfterTest('threadsOfFate', state, inv,
    { success: true, difficulty: 4, value: 5, drawn: ['cultist', 'tablet'] },
    { info: () => {}, damage: (seat, n) => calls.push(['damage', n]),
      directDamage: (seat, n) => calls.push(['direct', n]) })
  assert.deepEqual(calls, [['direct', 1]], '困难面 cultist 直接伤害')
  assert.equal(state.enemies[0].doom, 2, '困难面 tablet 在每个异教徒上放毁灭')
  tfaChaosAfterTest('threadsOfFate', state, inv,
    { success: false, difficulty: 4, value: 0, drawn: ['elderthing'] },
    { info: () => {}, damage: () => {}, directDamage: () => {} })
  assert.equal(inv.clues, 1, '失败失去 1 个线索')
  assert.equal(state.locations[0].clues, 2, '不再把线索放回地点')
})

test('04127 背面没有毁灭；04139 在目的地每轮第一张诡计获得涌动', () => {
  const state = stateFor(2)
  const api = setup(state)
  const enemy = { id: 'night', code: '01172', originalCode: '01172', name: '夜魇',
    traits: ['Nightgaunt'], location: 'rivertown', damageTaken: 4, doom: 0 }
  state.enemies.push(enemy)
  const act = { ...ACTS_BY_CODE['04127'], originalCode: '04127', thread: ACTS_BY_CODE['04127'].thread }
  fate.behavior.actReveal(state, act, api)
  assert.equal(enemy.doom, 0, '04127 不加毁灭')

  state.scenarioFlags.actDecks = state.scenarioFlags.actDecks || {}
  const thread = ACTS_BY_CODE['04139'].thread
  state.scenarioFlags.actDecks[thread] = { cards: ['04139'], index: 0, completed: false }
  state.scenarioFlags.ichtacasDestinations = ['rivertown']
  const inv = state.investigators[0]
  inv.location = 'rivertown'
  state.round = 2
  assert.equal(fate.behavior.encounterGainsSurge(state, '04144', inv), true)
  assert.equal(fate.behavior.encounterGainsSurge(state, '04144', inv), false, '同一轮只一次')
  inv.tfaSurgeRound = 0
  state.round = 3
  assert.equal(fate.behavior.encounterGainsSurge(state, '04144', inv), true, '下一轮重新生效')
})

test('幕推进不会因为引擎额外 ++ 而漂移', () => {
  const state = stateFor(1)
  const api = setup(state)
  const first = state.acts[state.actIndex]
  const code = first.originalCode || first.code
  const thread = ACTS_BY_CODE[code].thread
  fate.behavior.actReveal(state, first, api)
  const idx = fate.behavior.actIndexAfterAdvance(state)
  const deck = state.scenarioFlags.actDecks[thread]
  const expected = deck.cards[Math.min(deck.index, deck.cards.length - 1)]
  assert.equal(state.acts[idx].originalCode, expected)
  assert.ok(idx >= 0 && idx < state.acts.length)
})

test('04126b 警局：多张武器由玩家选，且只拿走一张同名副本', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  inv.deck = ['01021', '01022', '01023', '01024', '01020', '01020']
  const answers = ['1']
  fate.behavior.performAction(state, inv, { rule: 'policeSearchWeapon' }, {
    info: () => {},
    choose: () => answers.shift(),
  })
  assert.deepEqual(inv.hand, ['01020'], '只加入一张武器')
  assert.equal(inv.deck.filter(code => code === '01020').length, 1, '同名第二张留在牌库')
  assert.equal(inv.deck.length, 5)
})

test('04145 屋中无人：调查 +1 行动（附属数据读点），地点无线索时轮末弃掉', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  state.locations = [{ id: 'easttown', name: '东城', clues: 2, connections: [], attachments: [] }]
  inv.location = 'easttown'
  state.encounterDiscard = []
  // 剧本卡的附属写入走引擎原语（scenario-runtime.attachToLocation），这里复用同一个写入口。
  const api = {
    info: () => {}, drawEncounter: () => {},
    attachToLocation: (locationId, fields) => attachLocationCard(state, locationId, { scope: 'location', ...fields }),
  }
  fate.behavior.resolveEncounter(state, inv, { code: '04145', originalCode: '04145' }, api)
  const location = state.locations[0]
  assert.equal(location.attachments.filter(entry => entry.code === '04145').length, 1)
  assert.equal(locationAttachmentTotal(location, 'investigateExtraActions'), 1, '额外 +1 行动由附属数据声明')
  location.clues = 0
  fate.behavior.roundEnded(state, api)
  assert.equal(location.attachments.filter(entry => entry.code === '04145').length, 0)
  assert.equal(locationAttachmentTotal(location, 'investigateExtraActions'), 0)
  assert.equal(state.encounterDiscard.filter(code => code === '04145').length, 1)
})
