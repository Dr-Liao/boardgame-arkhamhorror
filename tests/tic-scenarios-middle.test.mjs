import './tic-chapter-fixture.mjs'
// Draft for the main process: copy to games/arkhamhorror/tests/tic-p7-middle.test.mjs.
// Workers must not run this module or import/register the engine themselves.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { viewState } from '../src/integration/observation.js'
import bootleggerWhite from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07174a.js'
import bootleggerBlack from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07174b.js'
import idol from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07179.js'
import shapes from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07184.js'
import horrors from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07186.js'
import bumpyRide from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07216.js'
import cantSee from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07217.js'
import eyes from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07218.js'
import headdress from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07181.js'
import mantle from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07180.js'
import lonelyIsle from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07169.js'
import hiddenCove from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07170.js'
import wavewornIsland from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07171.js'
import blackReef from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07173.js'
import saltMarshes from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07172.js'
import forkA from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07206a.js'
import forkB from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07206b.js'
import intersectionA from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07207a.js'
import intersectionB from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07207b.js'
import approach from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07203.js'
import grottoA from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07175a.js'
import grottoB from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07175b.js'
import ruinsA from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07176a.js'
import ruinsB from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07176b.js'
import templeA from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07177a.js'
import templeB from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07177b.js'

const helpers = [
  { code: 'testTicMiddleDraw', cannotLeavePlay: true, abilities: [{ kind: 'action', label: '实际抽取遭遇卡',
    resolve: ({ inv, api }) => api.scenario.drawEncounter(inv.seat) }] },
  { code: 'testTicMiddleWater', abilities: [{ kind: 'action', label: '实际改变水位',
    resolve: ({ inv, source, api }) => api.water.change(source.locationId || inv.location, 1) }] },
  { code: 'testTicMiddleReveal', abilities: [{ kind: 'action', label: '实际揭示地点',
    resolve: ({ inv, source, api }) => api.scenario.reveal(source.locationId || inv.location) }] },
  { code: 'testTicMiddleSpawn', abilities: [{ kind: 'action', label: '实际生成敌人',
    resolve: ({ inv, source, api }) => api.spawnEnemyAt(source.enemyCode || 'ghoulMinion', source.locationId || inv.location) }] },
  { code: 'testTicMiddleInvestigate', abilities: [{ kind: 'action', label: '实际调查指定地点',
    resolve: ({ inv, source, api }) => api.scenario.investigate(inv.seat, { locationId: source.locationId || inv.location }) }] },
  { code: 'testTicMiddleDefeatOther', abilities: [{ kind: 'action', label: '实际击败另一个调查员',
    resolve: ({ api }) => api.scenario.directDamage(1, 100) }] },
  { code: 'testTicMiddleCombinedInvestigate', abilities: [{ kind: 'action', label: '实际复合技能调查',
    resolve: ({ inv, api }) => api.scenario.investigate(inv.seat, { skill: ['intellect', 'agility'] }) }] },
]
registerCardAbilities([lonelyIsle, hiddenCove, wavewornIsland, saltMarshes, blackReef, bootleggerWhite, bootleggerBlack, idol, mantle, headdress, shapes, horrors, bumpyRide, cantSee, eyes, forkA, forkB, intersectionA, intersectionB, approach, grottoA, grottoB, ruinsA, ruinsB, templeA, templeB, ...helpers].filter(entry => !registeredEntry(entry.code)))

function use(s, source, select = () => null) {
  const command = legalMoves(s).find(m => m.assetId === source.id)
  assert.ok(command, `Missing real legal action for ${source.code}`)
  move(s, command)
  settle(s, select)
}
function draw(s, code, seat = 0) {
  s.currentSeat = seat
  s.encounterDeck = [code]
  use(s, asset(s, 'testTicMiddleDraw', {}, seat))
}
function chooseImmediateResource(c) {
  if (c.kind === 'reaction') return c.options.find(o => !['skip', 'done'].includes(o.id))?.id
  if (c.kind === 'action' && /立即进行/.test(c.prompt)) {
    const option = c.options.find(o => /resource|获得.*资源|获取.*资源/.test(o.label))
    assert.ok(option, JSON.stringify(c))
    return option.id
  }
  return null
}

for (const [code, skill, harm] of [['07184', 'willpower', 'horror'], ['07186', 'agility', 'damage']]) {
  for (const level of [0, 1, 2]) test(`${code}: real draw uses flood ${level}, then applies exactly two ${harm} on failure`, () => {
    const s = fixture()
    createMechanicsApi(s).water.set(s.investigators[0].location, level)
    s.chaosBag = ['autofail']
    draw(s, code)
    assert.equal(s.lastTestResult.skill, skill)
    assert.equal(s.lastTestResult.difficulty, 2 + level)
    assert.equal(s.lastTestResult.success, false)
    assert.equal(s.investigators[0][harm], 2)
    assert.equal(s.investigators[0][harm === 'damage' ? 'horror' : 'damage'], 0)
    assert.equal(s.encounterDiscard.filter(item => item === code).length, 1)
    assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
  })
  test(`${code}: a successful real revelation test applies no harm`, () => {
    const s = fixture()
    s.investigators[0][skill] = 10
    s.chaosBag = ['0']
    createMechanicsApi(s).water.set(s.investigators[0].location, 2)
    draw(s, code)
    assert.equal(s.lastTestResult.success, true)
    assert.equal(s.investigators[0].damage, 0)
    assert.equal(s.investigators[0].horror, 0)
  })
  test(`${code}: Fishing Vessel protection changes test difficulty but preserves full physical flood after JSON`, () => {
    let s = fixture()
    const api = createMechanicsApi(s), location = s.investigators[0].location
    api.water.set(location, 2)
    api.vehicles.register('07178', { location, capacity: 4, running: true, protectsFromFlood: true })
    assert.equal(api.vehicles.enter(0, '07178'), true)
    s = JSON.parse(JSON.stringify(s))
    s.chaosBag = ['autofail']
    draw(s, code)
    assert.equal(s.lastTestResult.difficulty, 2)
    assert.equal(createMechanicsApi(s).water.level(location), 2)
    assert.equal(createMechanicsApi(s).vehicles.of(0), '07178')
  })
}

test('07179: actual floodChanged grants an immediate action, exhausts only the Idol and preserves normal action pool', () => {
  const s = fixture(), relic = asset(s, '07179'), lever = asset(s, 'testTicMiddleWater')
  const actions = s.investigators[0].actionsLeft, resources = s.investigators[0].resources
  use(s, lever, chooseImmediateResource)
  assert.equal(s.investigators[0].resources, resources + 1)
  assert.equal(s.investigators[0].actionsLeft, actions - 1)
  assert.equal(s.investigators[0].assets.find(a => a.id === relic.id).exhausted, true)
  assert.equal(createMechanicsApi(s).water.level(s.investigators[0].location), 1)
  assert.equal(s.immediateAction, undefined)
  use(s, lever, () => assert.fail('Exhausted Idol must not open a reaction'))
  assert.equal(s.investigators[0].resources, resources + 1)
})

test('07179: remote water change and capped no-op water change do not grant actions', () => {
  let s = fixture()
  s.locations.push({ id: 'middle-remote', revealed: true, connections: [] })
  const relic = asset(s, '07179'), lever = asset(s, 'testTicMiddleWater', { locationId: 'middle-remote' })
  s = JSON.parse(JSON.stringify(s))
  use(s, lever, () => assert.fail('Remote flood must not offer Idol'))
  createMechanicsApi(s).water.set(s.investigators[0].location, 2)
  const localLever = asset(s, 'testTicMiddleWater')
  use(s, localLever, () => assert.fail('Capped flood must not offer Idol'))
  assert.equal(s.investigators[0].assets.find(a => a.id === relic.id).exhausted, false)
  assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
})

test('07179: an uncontrolled Idol beside a key holder cannot be exhausted for an investigator action', () => {
  const s = fixture(), location = s.investigators[0].location
  s.storyAssets.push({ id: 'middle-uncontrolled-idol', code: '07179', location, controllerSeat: null, exhausted: false })
  use(s, asset(s, 'testTicMiddleWater'), () => assert.fail('Uncontrolled Idol cannot react'))
  assert.equal(s.storyAssets.find(a => a.id === 'middle-uncontrolled-idol').exhausted, false)
})

test('07179: actual Deep One spawn at controller location grants an action, another trait does not', () => {
  for (const deepOne of [false, true]) {
    const s = fixture(), relic = asset(s, '07179')
    const enemyCode = deepOne ? '07089' : 'ghoulMinion'
    const spawner = asset(s, 'testTicMiddleSpawn', { enemyCode })
    const before = s.investigators[0].resources
    use(s, spawner, deepOne ? chooseImmediateResource : () => assert.fail('Wrong trait cannot trigger Idol'))
    assert.equal(s.enemies.filter(enemy => enemy.code === enemyCode || enemy.originalCode === enemyCode).length, 1)
    assert.equal(s.investigators[0].resources, before + Number(deepOne))
    assert.equal(s.investigators[0].assets.find(a => a.id === relic.id).exhausted, deepOne)
  }
})

for (const [code, color, reward] of [['07174a', 'white', 'draw'], ['07174b', 'black', 'resource']]) {
  test(`${code}: only local controller of the correct key can use the once-per-group reward; JSON preserves usage`, () => {
    let s = fixture('01001', 2)
    const location = s.locations.find(l => l.id === s.investigators[0].location)
    Object.assign(location, { code, originalCode: code, revealed: true })
    const api = createMechanicsApi(s)
    api.keys.initialize([{ color, holder: 'investigator:1', revealed: true }])
    assert.equal(legalMoves(s).some(m => m.entityId === location.id), false)
    api.keys.transfer(color, 'investigator:1', 'investigator:0')
    const command = legalMoves(s).find(m => m.entityId === location.id)
    assert.ok(command)
    const hand = s.investigators[0].hand.length, resources = s.investigators[0].resources
    move(s, command); settle(s)
    assert.equal(s.investigators[0].hand.length, hand + (reward === 'draw' ? 3 : 0))
    assert.equal(s.investigators[0].resources, resources + (reward === 'resource' ? 5 : 0))
    s = JSON.parse(JSON.stringify(s))
    assert.equal(legalMoves(s).some(m => m.entityId === location.id), false)
    assert.equal(validateMechanicState(s), undefined)
  })

  test(`${code}: actual reveal places one concealed random key; public state does not disclose its color`, () => {
    const s = fixture(), location = s.locations.find(l => l.id === s.investigators[0].location)
    Object.assign(location, { code, originalCode: code, revealed: false })
    const api = createMechanicsApi(s)
    api.keys.initialize(['red', 'yellow', 'green', 'blue'].map(color => ({ color, holder: 'setAside', revealed: false })))
    use(s, asset(s, 'testTicMiddleReveal'))
    assert.equal(s.locations.find(l => l.id === location.id).revealed, true)
    assert.deepEqual(createMechanicsApi(s).keys.at(`location:${location.id}`), ['unrevealed'])
    assert.equal(Object.values(s.scenarioFlags.mechanics.keys).filter(key => key.holder === `location:${location.id}`).length, 1)
    const publicKeys = viewState(s, null).mechanics.keys
    assert.ok(publicKeys)
    assert.equal(JSON.stringify(publicKeys).includes('"color":"red"'), false)
    assert.equal(JSON.stringify(publicKeys).includes('"color":"yellow"'), false)
    assert.equal(JSON.stringify(publicKeys).includes('"color":"green"'), false)
    assert.equal(JSON.stringify(publicKeys).includes('"color":"blue"'), false)
  })
}

for (const [code, skill, harm] of [['07216', 'agility', 'damage'], ['07217', 'willpower', 'horror']]) {
  test(`${code}: passenger draw tests the actual driver and harms only this vehicle on failure after JSON`, () => {
    let s = fixture('01001', 3)
    const api = createMechanicsApi(s), location = s.investigators[0].location
    api.vehicles.register('middle-car', { location, capacity: 2, running: false })
    assert.equal(api.vehicles.enter(0, 'middle-car'), true)
    assert.equal(api.vehicles.enter(1, 'middle-car'), true)
    s.chaosBag = ['autofail']
    s = JSON.parse(JSON.stringify(s))
    draw(s, code, 1)
    assert.equal(s.lastTestResult.seat, 0)
    assert.equal(s.lastTestResult.skill, skill)
    assert.equal(s.lastTestResult.difficulty, 3)
    assert.deepEqual(s.investigators.map(inv => inv[harm]), [2, 2, 0])
    assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
  })
  test(`${code}: successful driver test uses driver's skill rather than drawer skill and causes no passenger harm`, () => {
    const s = fixture('01001', 2), api = createMechanicsApi(s)
    api.vehicles.register('middle-car', { location: s.investigators[0].location, capacity: 2, running: false })
    api.vehicles.enter(0, 'middle-car'); api.vehicles.enter(1, 'middle-car')
    s.investigators[0][skill] = 10; s.investigators[1][skill] = 0; s.chaosBag = ['0']
    draw(s, code, 1)
    assert.equal(s.lastTestResult.seat, 0)
    assert.equal(s.lastTestResult.success, true)
    assert.deepEqual(s.investigators.map(inv => inv[harm]), [0, 0])
  })
  test(`${code}: drawer outside every vehicle tests difficulty five and receives fixed three harm on failure`, () => {
    const s = fixture('01001', 2)
    s.chaosBag = ['autofail']
    draw(s, code, 1)
    assert.equal(s.lastTestResult.seat, 1)
    assert.equal(s.lastTestResult.difficulty, 5)
    assert.deepEqual(s.investigators.map(inv => inv[harm]), [0, 3])
  })
}

test('07218: one actual drawer test makes each same-car passenger discard failure-margin hand cards; others unaffected', () => {
  let s = fixture('01001', 3), api = createMechanicsApi(s)
  api.vehicles.register('middle-car', { location: s.investigators[0].location, capacity: 2, running: false })
  api.vehicles.enter(0, 'middle-car'); api.vehicles.enter(1, 'middle-car')
  for (const inv of s.investigators) inv.hand = ['01088', '01088']
  s.chaosBag = ['autofail']
  s = JSON.parse(JSON.stringify(s))
  draw(s, '07218', 0)
  assert.equal(s.lastTestResult.seat, 0)
  assert.equal(s.lastTestResult.difficulty, 4)
  assert.equal(s.lastTestResult.failedBy, 4)
  assert.deepEqual(s.investigators.map(inv => inv.hand.length), [0, 0, 2])
  assert.deepEqual(s.investigators.map(inv => inv.discard.filter(code => code === '01088').length), [2, 2, 0])
  assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
})

test('07218: without a vehicle only drawer is affected; hidden cards and permanent assets cannot satisfy discard', () => {
  const s = fixture('01001', 2)
  s.investigators[0].hand = ['06319']; s.investigators[0].hiddenCards = ['06319']
  s.investigators[1].hand = ['01088']
  const permanent = asset(s, '06010')
  s.chaosBag = ['autofail']
  draw(s, '07218', 0)
  assert.deepEqual(s.investigators[0].hand, ['06319'])
  assert.deepEqual(s.investigators[1].hand, ['01088'])
  assert.ok(s.investigators[0].assets.some(item => item.id === permanent.id))
})

test('07218: forced available asset branch discards only chosen controlled asset; success discards neither branch', () => {
  for (const success of [false, true]) {
    const s = fixture(), dog = asset(s, '01023')
    s.investigators[0].willpower = success ? 10 : 1
    s.chaosBag = [success ? '0' : 'autofail']
    draw(s, '07218')
    assert.equal(s.investigators[0].assets.some(item => item.id === dog.id), success)
    assert.equal(s.investigators[0].discard.includes('01023'), !success)
  }
})

for (const action of ['investigate', 'fight', 'evade']) {
  test(`07181: real ${action} receives exactly one skill value for flooded target; dry target has no bonus`, () => {
    for (const level of [0, 1, 2]) {
      const s = fixture(), inv = s.investigators[0]
      asset(s, '07181')
      const location = s.locations.find(loc => loc.id === inv.location)
      location.clues = 4; location.shroud = 1
      createMechanicsApi(s).water.set(location.id, level)
      s.chaosBag = ['0']
      const target = action === 'investigate' ? null : enemy(s, { fight: 1, evade: 1 })
      move(s, { action, ...(target ? { enemyId: target.id } : {}) }); settle(s)
      const skill = action === 'investigate' ? 'intellect' : action === 'fight' ? 'combat' : 'agility'
      assert.equal(s.lastTestResult.value, s.investigators[0][skill] + Number(level > 0))
    }
  })
}

test('07181: Fishing Vessel suppresses local flood bonus, but remote investigation still benefits from target flood after JSON', () => {
  let s = fixture(), location = s.investigators[0].location
  asset(s, '07181')
  s.locations.find(loc => loc.id === location).clues = 5
  s.locations.push({ id: 'middle-remote-target:2', code: '01112', originalCode: '01112', name: '目标副本',
    connections: [location], revealed: true, clues: 4, shroud: 0 })
  const api = createMechanicsApi(s)
  api.water.set(location, 2); api.water.set('middle-remote-target:2', 2)
  api.vehicles.register('middle-protecting-boat', { location, capacity: 4, running: true, protectsFromFlood: true })
  api.vehicles.enter(0, 'middle-protecting-boat')
  s = JSON.parse(JSON.stringify(s)); s.chaosBag = ['0']
  move(s, { action: 'investigate' }); settle(s)
  assert.equal(s.lastTestResult.value, s.investigators[0].intellect)
  use(s, asset(s, 'testTicMiddleInvestigate', { locationId: 'middle-remote-target:2' }))
  assert.equal(s.lastTestResult.value, s.investigators[0].intellect + 1)
  assert.equal(s.investigators[0].location, location)
  assert.equal(createMechanicsApi(s).water.level(location), 2)
  assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
})

test('07181: combined-skill real investigation adds one total skill value, not one per underlying skill', () => {
  const s = fixture(), inv = s.investigators[0]
  asset(s, '07181')
  s.locations.find(loc => loc.id === inv.location).clues = 4
  createMechanicsApi(s).water.set(inv.location, 1)
  s.chaosBag = ['0']
  use(s, asset(s, 'testTicMiddleCombinedInvestigate'))
  assert.deepEqual(s.lastTestResult.skill, ['intellect', 'agility'])
  assert.equal(s.lastTestResult.value, s.investigators[0].intellect + s.investigators[0].agility + 1)
})

test('07181: actual 05029 Money Talks investigation still gets one total skill value after its half-resource base', () => {
  const s = fixture(), inv = s.investigators[0]
  asset(s, '07181')
  s.locations.find(loc => loc.id === inv.location).clues = 4
  createMechanicsApi(s).water.set(inv.location, 1)
  inv.resources = 14; inv.hand = ['05029']; s.chaosBag = ['0']
  move(s, { action: 'investigate' })
  let converted = false
  settle(s, c => {
    if (c.kind !== 'reaction') return null
    const option = c.options.find(item => item.cardCode === '05029')
    if (!option) return null
    converted = true
    return option.id
  })
  assert.equal(converted, true)
  assert.ok(s.investigators[0].discard.includes('05029'))
  assert.equal(s.lastTestResult.value, 8)
})

test('07180: free move enumerates only connected flooded enterable targets and rejects forged barrier target atomically', () => {
  let s = fixture(), here = s.investigators[0].location
  s.locations.find(loc => loc.id === here).connections = ['middle-wet', 'middle-dry', 'middle-blocked']
  for (const id of ['middle-wet', 'middle-dry', 'middle-blocked']) s.locations.push({
    id, name: id, revealed: true, connections: [here], clues: 0, shroud: 0,
  })
  const api = createMechanicsApi(s)
  api.water.set(here, 1); api.water.set('middle-wet', 1); api.water.set('middle-blocked', 2)
  api.barriers.set(here, 'middle-blocked', 1)
  const relic = asset(s, '07180')
  s = JSON.parse(JSON.stringify(s))
  const commands = legalMoves(s).filter(m => m.assetId === relic.id)
  assert.deepEqual(commands.map(m => m.targetId), ['middle-wet'])
  const before = JSON.stringify(s)
  assert.notEqual(validateMove(s, 0, { ...commands[0], targetId: 'middle-blocked' }), null)
  assert.equal(JSON.stringify(s), before)
  const actions = s.investigators[0].actionsLeft
  move(s, commands[0]); settle(s)
  assert.equal(s.investigators[0].location, 'middle-wet')
  assert.equal(s.investigators[0].actionsLeft, actions)
  assert.equal(s.investigators[0].assets.find(a => a.id === relic.id).exhausted, true)
})

test('07180: unflooded or boat-protected origin and uncontrolled Mantle offer no movement', () => {
  for (const condition of ['dry', 'boat', 'uncontrolled']) {
    const s = fixture(), here = s.investigators[0].location
    s.locations.find(loc => loc.id === here).connections = ['middle-wet']
    s.locations.push({ id: 'middle-wet', name: 'flooded', revealed: true, connections: [here], clues: 0, shroud: 0 })
    const api = createMechanicsApi(s)
    api.water.set('middle-wet', 1)
    if (condition !== 'dry') api.water.set(here, 2)
    if (condition === 'boat') {
      api.vehicles.register('middle-boat', { location: here, capacity: 4, running: true, protectsFromFlood: true })
      api.vehicles.enter(0, 'middle-boat')
    }
    const relic = condition === 'uncontrolled'
      ? { id: 'middle-uncontrolled-mantle', code: '07180', location: here, controllerSeat: null, exhausted: false }
      : asset(s, '07180')
    if (condition === 'uncontrolled') s.storyAssets.push(relic)
    assert.equal(legalMoves(s).some(m => m.assetId === relic.id || m.entityId === relic.id), false)
    assert.equal(relic.exhausted, false)
  }
})

// Absolute source positions, ordered tunnel(s), then depths. These come from the
// five explicit Pos branches in the bound Haskell implementations.
const ISLAND_EXPECTED = {
  '07169': {
    '0,3': [[-1, 3], [1, 3]], '4,2': [[5, 2], [4, 1]], '4,-2': [[5, -2], [4, -1]],
    '-4,2': [[-5, 2], [-4, 1]], '-4,-2': [[-5, -2], [-4, -1]],
  },
  '07170': {
    '0,3': [[0, 4], [1, 4]], '4,2': [[5, 2], [6, 2]], '4,-2': [[5, -2], [6, -2]],
    '-4,2': [[-5, 2], [-6, 2]], '-4,-2': [[-5, -2], [-6, -2]],
  },
  '07171': {
    '0,3': [[-1, 3], [1, 3], [0, 4]], '4,2': [[5, 2], [4, 1], [3, 2]],
    '4,-2': [[5, -2], [4, -1], [3, -2]], '-4,2': [[-5, 2], [-4, 1], [-3, 2]],
    '-4,-2': [[-5, -2], [-4, -1], [-3, -2]],
  },
  '07173': {
    '0,3': [[1, 3], [0, 4], [1, 4]], '4,2': [[5, 2], [4, 1], [5, 1]],
    '4,-2': [[5, -2], [4, -1], [5, -1]], '-4,2': [[-5, 2], [-4, 1], [-5, 1]],
    '-4,-2': [[-5, -2], [-4, -1], [-5, -1]],
  },
  '07172': {
    '0,3': [[-1, 3]], '4,2': [[5, 2]], '4,-2': [[5, -2]],
    '-4,2': [[-5, 2]], '-4,-2': [[-5, -2]],
  },
}
for (const [code, positions] of Object.entries(ISLAND_EXPECTED)) {
  for (const [anchor, expected] of Object.entries(positions)) {
    test(`${code}: actual reveal at ${anchor} conserves opaque physical tiles, matches exact map and does not repeat`, () => {
      let s = fixture(), location = s.locations.find(loc => loc.id === s.investigators[0].location)
      Object.assign(location, { code, originalCode: code, revealed: false, maxClues: 0 })
      const physical = ['middle-tunnel-A', 'middle-tunnel-B', 'middle-depth-C']
      for (const id of physical) s.scenario.locations[id] = {
        code: id === physical[2] ? '07175b' : '07174a', originalCode: id === physical[2] ? '07175b' : '07174a',
        name: id === physical[2] ? 'Unfathomable Depths' : 'Tidal Tunnel', clues: 0, shroud: 0,
        connections: [], hiddenIdentity: true,
      }
      const api = createMechanicsApi(s)
      const [x, y] = anchor.split(',').map(Number)
      api.map.place(location.id, x, y)
      api.scenarioDecks.initialize('tidalTunnels', [physical[1], physical[0]], { shuffle: false })
      api.scenarioDecks.initialize('unfathomableDepths', [physical[2]], { shuffle: false })
      const lever = asset(s, 'testTicMiddleReveal')
      use(s, lever)
      const used = code === '07172' ? [physical[0]] : code === '07169' ? physical.slice(0, 2) : code === '07170' ? [physical[0], physical[2]] : physical
      assert.deepEqual(used.map(id => {
        const pos = createMechanicsApi(s).map.position(id)
        return [pos.x, pos.y]
      }), expected)
      assert.equal(new Set(s.locations.map(loc => loc.id)).size, s.locations.length)
      assert.equal(createMechanicsApi(s).water.level(location.id), ['07171', '07172', '07173'].includes(code) ? 1 : 0)
      assert.equal(createMechanicsApi(s).scenarioDecks.size('tidalTunnels'), ['07170', '07172'].includes(code) ? 1 : 0)
      assert.equal(createMechanicsApi(s).scenarioDecks.size('unfathomableDepths'), ['07169', '07172'].includes(code) ? 1 : 0)
      for (const id of used) assert.equal(s.locations.find(loc => loc.id === id).revealed, false)
      if (code === '07169' || code === '07171') {
        for (const id of used) assert.ok(s.locations.find(loc => loc.id === location.id).connections.includes(id))
        for (const id of used) assert.equal(s.locations.find(loc => loc.id === id).connections.some(other => used.includes(other)), false)
      }
      if (code === '07173') {
        assert.equal(s.locations.find(loc => loc.id === location.id).connections.includes(physical[2]), false)
        for (const id of physical.slice(0, 2)) assert.ok(s.locations.find(loc => loc.id === id).connections.includes(physical[2]))
      }
      const counts = { locations: s.locations.length, tunnels: createMechanicsApi(s).scenarioDecks.size('tidalTunnels') }
      s = JSON.parse(JSON.stringify(s))
      use(s, lever)
      assert.equal(s.locations.length, counts.locations)
      assert.equal(createMechanicsApi(s).scenarioDecks.size('tidalTunnels'), counts.tunnels)
      assert.equal(validateMechanicState(s), undefined)
    })
  }
}

test('07172: purple key looks at an arbitrary distant hidden tunnel/depth without revealing it; group use survives JSON', () => {
  let s = fixture('01001', 2), here = s.investigators[0].location
  Object.assign(s.locations.find(loc => loc.id === here), { code: '07172', originalCode: '07172', revealed: true })
  s.locations.push({ id: 'middle-distant-depth', code: '07176b', originalCode: '07176b', revealed: false,
    name: 'Unfathomable Depths', connections: [], clues: 0, shroud: 1 })
  s.locations.push({ id: 'middle-wrong-back', code: '07169', originalCode: '07169', revealed: false,
    name: 'Devil Reef', connections: [], clues: 0, shroud: 1 })
  createMechanicsApi(s).keys.initialize([{ color: 'purple', holder: 'investigator:1', revealed: true }])
  assert.equal(legalMoves(s).some(m => m.entityId === here), false)
  createMechanicsApi(s).keys.transfer('purple', 'investigator:1', 'investigator:0')
  const commands = legalMoves(s).filter(m => m.entityId === here)
  assert.deepEqual(commands.map(m => m.targetId), ['middle-distant-depth'])
  const actions = s.investigators[0].actionsLeft
  move(s, commands[0])
  assert.equal(s.pendingChoice.source, 'peekLocation')
  assert.equal(s.pendingChoice.seat, 0)
  assert.equal(s.pendingChoice.options[0].cardCode, '07176b')
  assert.deepEqual(viewState(s, 1).pendingChoice?.options, [])
  assert.deepEqual(viewState(s, null).pendingChoice?.options, [])
  assert.equal(JSON.stringify(viewState(s, 1).pendingChoice).includes('07176b'), false)
  assert.equal(JSON.stringify(viewState(s, null).pendingChoice).includes('07176b'), false)
  settle(s)
  assert.equal(s.locations.find(loc => loc.id === 'middle-distant-depth').revealed, false)
  assert.equal(s.investigators[0].actionsLeft, actions - 1)
  s = JSON.parse(JSON.stringify(s))
  assert.equal(legalMoves(s).some(m => m.entityId === here), false)
})

for (const [code, count] of [['07206a', 2], ['07206b', 2], ['07207a', 3], ['07207b', 3]]) {
  test(`${code}: actual front-road reveal creates Road ${count} physical choices, conserves pool and never extends twice`, () => {
    const s = fixture(), here = s.investigators[0].location
    Object.assign(s.locations.find(loc => loc.id === here), { code, originalCode: code, revealed: false })
    for (const id of ['middle-road-A', 'middle-road-B', 'middle-detour-A', 'middle-detour-B']) {
      s.scenario.locations[id] = { code: id.includes('detour') ? '07210' : '07209a', originalCode: id.includes('detour') ? '07210' : '07209a',
        name: 'Old Innsmouth Road', connections: [], clues: 0, shroud: 1 }
    }
    createMechanicsApi(s).map.initializeRoad({ deck: ['middle-road-B', 'middle-road-A'],
      detours: ['middle-detour-A', 'middle-detour-B'], columns: { [here]: 0 } })
    const revealer = asset(s, 'testTicMiddleReveal')
    use(s, revealer)
    const road = s.scenarioFlags.mechanics.road
    assert.equal(Object.values(road.columns).filter(column => column === 1).length, count)
    assert.ok(Object.hasOwn(road.columns, 'middle-road-A'))
    assert.equal(road.deck.length, 1)
    assert.equal(road.detours.length, 3 - count)
    assert.equal(s.locations.find(loc => loc.id === here).connections.length, count)
    for (const [id, column] of Object.entries(road.columns)) if (column === 1) {
      assert.deepEqual(s.locations.find(loc => loc.id === id).connections, [here])
      assert.equal(s.locations.find(loc => loc.id === id).revealed, false)
    }
    use(s, revealer)
    assert.equal(s.scenarioFlags.mechanics.road.deck.length, 1)
    assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
  })

  test(`${code}: real free look pays only local group, includes far and revealed future targets, no action or opportunity attack`, () => {
    let s = fixture('01001', 2), here = s.investigators[0].location
    Object.assign(s.locations.find(loc => loc.id === here), { code, originalCode: code, revealed: true })
    for (const [id, revealed] of [['middle-behind', false], ['middle-same', false], ['middle-near', false], ['middle-far', true]]) {
      s.locations.push({ id, code: '07209a', originalCode: '07209a', name: 'Old Innsmouth Road',
        revealed, clues: 0, shroud: 1, connections: [] })
    }
    createMechanicsApi(s).map.initializeRoad({ deck: [], detours: [], columns: {
      [here]: 1, 'middle-behind': 0, 'middle-same': 1, 'middle-near': 2, 'middle-far': 4,
    } })
    s.investigators[0].clues = 1; s.investigators[1].clues = 1
    enemy(s, { damage: 2 })
    s = JSON.parse(JSON.stringify(s))
    const commands = legalMoves(s).filter(m => m.entityId === here)
    assert.deepEqual(commands.map(m => m.targetId).sort(), ['middle-far', 'middle-near'])
    const before = JSON.stringify(s)
    assert.notEqual(validateMove(s, 0, { ...commands[0], targetId: 'middle-same' }), null)
    assert.equal(JSON.stringify(s), before)
    const actions = s.investigators[0].actionsLeft
    move(s, commands.find(m => m.targetId === 'middle-near'))
    let looked = false
    settle(s, c => {
      if (c.source !== 'peekLocation') return null
      looked = true
      assert.equal(c.options[0].cardCode, '07209a')
      assert.deepEqual(viewState(s, 1).pendingChoice?.options, [])
      assert.equal(JSON.stringify(viewState(s, 1).pendingChoice).includes('07209a'), false)
      return 'done'
    })
    assert.equal(looked, true)
    assert.deepEqual(s.investigators.map(inv => inv.clues), [0, 0])
    assert.equal(s.investigators[0].actionsLeft, actions)
    assert.equal(s.investigators[0].damage, 0)
    assert.equal(s.locations.find(loc => loc.id === 'middle-near').revealed, false)
  })

  test(`${code}: remote clues cannot fund this local look ability`, () => {
    const s = fixture('01001', 2), here = s.investigators[0].location
    Object.assign(s.locations.find(loc => loc.id === here), { code, originalCode: code, revealed: true })
    s.locations.push({ id: 'middle-future', code: '07203', originalCode: '07203', name: 'Old Innsmouth Road',
      revealed: false, clues: 0, shroud: 1, connections: [] })
    createMechanicsApi(s).map.initializeRoad({ deck: [], columns: { [here]: 0, 'middle-future': 1 } })
    s.investigators[0].clues = 1; s.investigators[1].clues = 5; s.investigators[1].location = 'middle-future'
    assert.equal(legalMoves(s).some(m => m.entityId === here), false)
    assert.deepEqual(s.investigators.map(inv => inv.clues), [1, 5])
  })
}

function objectiveFixture(revealed = true) {
  const s = fixture('01001', 2), here = s.investigators[0].location
  Object.assign(s.locations.find(loc => loc.id === here), { code: '07203', originalCode: '07203', revealed })
  s.acts = [{ code: '07202', originalCode: '07202', name: '踩尽油门', stage: 1, text: '' },
    { code: 'testTicMiddleAfterChase', name: '目标之后', stage: 2, text: '' }]
  s.actIndex = 0
  s.locations.push({ id: 'middle-absent', name: '后方地点', connections: [here], revealed: true, clues: 0, shroud: 0 })
  s.locations.find(loc => loc.id === here).connections = ['middle-absent']
  return s
}

test('07203: actual last investigator movement advances current chase act exactly once, despite enemies at Approach', () => {
  let s = objectiveFixture(), here = s.investigators[0].location
  s.investigators[1].location = 'middle-absent'; s.currentSeat = 1
  enemy(s, { engagedSeat: null, damage: 0, location: here })
  s = JSON.parse(JSON.stringify(s))
  move(s, { action: 'move', locationId: here }); settle(s)
  assert.equal(s.actIndex, 1)
  move(s, { action: 'resource' }); settle(s)
  assert.equal(s.actIndex, 1)
})

test('07203: an absent undefeated investigator prevents objective; actual defeat removes that requirement', () => {
  const s = objectiveFixture()
  s.investigators[1].location = 'middle-absent'
  move(s, { action: 'resource' }); settle(s)
  assert.equal(s.actIndex, 0)
  use(s, asset(s, 'testTicMiddleDefeatOther'))
  assert.equal(s.investigators[1].defeated, true)
  assert.equal(s.actIndex, 1)
})

test('07203: unrevealed location, wrong act and empty undefeated group never advance', () => {
  const s = objectiveFixture(false), location = s.locations.find(loc => loc.id === s.investigators[0].location)
  move(s, { action: 'resource' }); settle(s)
  assert.equal(s.actIndex, 0)
  location.revealed = true; s.acts[0].code = 'testWrongAct'; s.acts[0].originalCode = 'testWrongAct'
  move(s, { action: 'resource' }); settle(s)
  assert.equal(s.actIndex, 0)
  s.acts[0].code = '07202'; s.acts[0].originalCode = '07202'
  for (const inv of s.investigators) inv.defeated = true
  assert.equal(approach.locationRule.objective(s, location), false)
})

// These tests intentionally stop before the successful claim. Full claim,
// flashback text/memory, relic transfer and once-per-game integration require
// the main process's real Devil Reef setup and flashback handler.
for (const [code, color, required, clues, flood] of [
  ['07175a', 'purple', ['red', 'blue'], 2, 1], ['07175b', 'purple', ['green', 'yellow'], 3, 1],
  ['07176a', 'white', ['red', 'yellow'], 2, 2], ['07176b', 'white', ['blue', 'green'], 3, 2],
  ['07177a', 'black', ['red', 'green'], 2, 0], ['07177b', 'black', ['blue', 'yellow'], 3, 0],
]) {
  test(`${code}: actual reveal sets printed flood and key; split local required keys and local clue cost make free claim available`, () => {
    const s = fixture('01001', 2), location = s.locations.find(loc => loc.id === s.investigators[0].location)
    Object.assign(location, { code, originalCode: code, revealed: false, maxClues: 5 })
    createMechanicsApi(s).keys.initialize([
      { color, holder: 'setAside', revealed: true },
      { color: required[0], holder: 'investigator:0', revealed: true },
      { color: required[1], holder: 'investigator:1', revealed: true },
    ])
    s.investigators[0].clues = clues; s.investigators[1].clues = clues
    use(s, asset(s, 'testTicMiddleReveal'))
    assert.equal(createMechanicsApi(s).water.level(location.id), flood)
    assert.deepEqual(createMechanicsApi(s).keys.at(`location:${location.id}`), [color])
    assert.ok(s.locations.find(loc => loc.id === location.id).clues > 0)
    const command = legalMoves(s).find(m => m.action === 'entityAbility' && m.entityId === location.id)
    assert.ok(command)
    assert.equal(validateMove(s, 0, command), null)
    assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
  })
  test(`${code}: remote or eliminated key holder and insufficient local clues prevent claim without spending`, () => {
    let s = fixture('01001', 2), location = s.locations.find(loc => loc.id === s.investigators[0].location)
    Object.assign(location, { code, originalCode: code, revealed: true })
    s.locations.push({ id: 'middle-key-remote', name: '另一地点', revealed: true, connections: [] })
    s.investigators[1].location = 'middle-key-remote'
    s.investigators[0].clues = clues * 2; s.investigators[1].clues = 100
    createMechanicsApi(s).keys.initialize([
      { color, holder: `location:${location.id}`, revealed: true },
      { color: required[0], holder: 'investigator:0', revealed: true },
      { color: required[1], holder: 'investigator:1', revealed: true },
    ])
    const available = () => legalMoves(s).some(m => m.action === 'entityAbility' && m.entityId === location.id)
    assert.equal(available(), false)
    s.investigators[1].location = location.id; s.investigators[1].defeated = true
    assert.equal(available(), false)
    createMechanicsApi(s).keys.transfer(required[1], 'investigator:1', 'investigator:0')
    assert.equal(available(), true)
    s.investigators[0].clues = 0
    s = JSON.parse(JSON.stringify(s))
    assert.equal(available(), false)
    assert.equal(s.investigators[1].clues, 100)
  })
}
