// Main only: copy to Mod/tests. Actual three entries, tests/frames and APIs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, asset, move } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { randomValue } from '../src/engine/rules-state.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import pit from '../src/cards/encounter-entries/theInnsmouthConspiracy/thePitOfDespair/07041.js'
import deep from '../src/cards/encounter-entries/theInnsmouthConspiracy/inTooDeep/07123.js'
import reef from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07163.js'
import coastline from '../src/cards/encounter-entries/theInnsmouthConspiracy/inTooDeep/07143.js'

const cancel = { code: 'testTicFinalRefCancel', abilities: [{ kind: 'forced', trigger: 'chaosTokenRevealed', cost: { exhaust: true },
  criteria: ({ source, context }) => source.cancelFace === context.token,
  resolve: ({ context, api }) => api.chaosTokens.treat({ index: context.tokenIndex, cancel: true }) }] }
const engagement = { code: 'testTicFinalRefEngagement', abilities: [{ kind: 'forced', trigger: 'enemyEngaged',
  limit: { scope: 'perWindow', owner: 'instance' },
  criteria: ({ source, context }) => source.enemyId === context.enemyId || source.enemyId === context.enemy?.id,
  resolve: ({ state, api }) => api.setScenarioFlag('referenceEngagements', (state.scenarioFlags.referenceEngagements || 0) + 1) }] }
registerCardAbilities([pit, deep, reef, coastline, cancel, engagement].filter(entry => !registeredEntry(entry.code)))
const difficulties = ['easy', 'standard', 'hard', 'expert']
const harder = difficulty => ['hard', 'expert'].includes(difficulty)
const scenarios = [['07041', 'thePitOfDespair'], ['07123', 'inTooDeep'], ['07163', 'devilReef']]
const codeOf = card => card.originalCode || card.code

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testFinalReference' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 100, 'Final reference choice loop')
    Object.assign(s, JSON.parse(JSON.stringify(s)))
    const c = s.pendingChoice
    const optionId = select(c, s) ?? c.options.find(o => ['done', 'skip', 'self'].includes(o.id))?.id ?? c.options[0].id
    resolveTransaction(s, c.seat, { action: 'choose', choiceId: c.id, optionId }, execute)
  }
}
function setDraws(s, draws) {
  s.chaosBag = [...draws]
  for (let seed = 0; seed < 100000; seed++) {
    const rng = { rngState: seed }, bag = [...draws], observed = []
    while (bag.length) observed.push(bag.splice(Math.floor(randomValue(rng) * bag.length), 1)[0])
    if (draws.every((face, index) => observed[index] === face)) { s.rngState = seed; return }
  }
  throw new Error('No deterministic token sequence')
}
function fixture(id, difficulty = 'standard', { prepareDepths = true } = {}) {
  const s = chapterFixture(id), api = createMechanicsApi(s)
  s.difficulty = difficulty
  s.enemies = []
  for (const [color, key] of Object.entries(s.scenarioFlags.mechanics.keys || {})) api.keys.transfer(color, key.holder, 'setAside', { reveal: true })
  if (!s.scenarioFlags.mechanics.keys) api.keys.initialize(['red', 'yellow', 'green', 'blue', 'purple', 'white', 'black'].map(color => ({ color, holder: 'setAside', revealed: true })))
  for (const inv of s.investigators) Object.assign(inv, { willpower: 20, combat: 20, agility: 20,
    assets: [], threat: [], engaged: [], hand: [], damage: 0, horror: 0, maxHealth: 99, maxSanity: 99, clues: 0 })
  s.agendas[s.agendaIndex].doomThreshold = 99
  if (id === 'thePitOfDespair') {
    api.water.set(s.investigators[0].location, 1, { ignoreRestrictions: true })
    if (prepareDepths) transaction(s, d => {
      const runtime = scenarioRuntime(d, []), amalgam = runtime.spawn('07053', d.investigators[0].location)
      assert.ok(amalgam)
      runtime.mechanics.enemyZones.enter(amalgam, 'depths', { preserveKeys: true })
    })
    createMechanicsApi(s).keys.transfer('red', 'setAside', 'investigator:0', { reveal: true })
  }
  if (id === 'inTooDeep') {
    // Real chapter reference with neutral locations isolates its printed rules
    // from unrelated city card forced abilities. Coordinates use real grid API.
    s.locations = ['west', 'here', 'east', 'farEast', 'north'].map(id => ({ id, name: id, revealed: true, traits: [], clues: 0, connections: [] }))
    s.scenarioFlags.mechanics.grid = {}
    const positions = { west: [-1, 0], here: [0, 0], east: [1, 0], farEast: [2, 0], north: [0, 1] }
    const map = createMechanicsApi(s)
    map.map.configure({ adjacency: 'orthogonal' })
    for (const [id, [x, y]] of Object.entries(positions)) map.map.place(id, x, y)
    s.investigators[0].location = 'here'
    s.scenarioFlags.mechanics.barriers = []
    map.barriers.set('here', 'east', 2)
    map.barriers.set('here', 'north', 1)
  }
  if (id === 'devilReef') {
    const vehicle = api.vehicles.of(0)
    if (vehicle) api.vehicles.leave(0, vehicle, { forced: true })
    api.keys.transfer('blue', 'setAside', 'investigator:0', { reveal: true })
    api.keys.transfer('red', 'setAside', `location:${s.investigators[0].location}`, { reveal: true })
    api.water.set(s.investigators[0].location, 0, { ignoreRestrictions: true })
  }
  return s
}
function run(s, draws, fail = false, { enemyId, fight = false, select = () => null } = {}) {
  setDraws(s, Array.isArray(draws) ? draws : [draws])
  transaction(s, d => {
    const runtime = scenarioRuntime(d, [])
    if (fight) return runtime.fight(0, enemyId)
    return runtime.test(0, 'willpower', fail ? 99 : 0, () => {})
  }, select)
  return s.lastTestResult
}
function delta(code, difficulty, face) {
  const h = harder(difficulty)
  if (code === '07041') return { skull: h ? -3 : -2, cultist: -2, tablet: -2, elderthing: -3 }[face]
  if (code === '07123') return { skull: h ? -4 : -2, cultist: h ? -4 : -2, tablet: h ? -5 : -3, elderthing: h ? -6 : -3 }[face]
  return { skull: h ? -2 : -1, cultist: h ? -3 : -2, tablet: h ? -4 : -3, elderthing: h ? -5 : -4 }[face]
}

for (const [code, id] of scenarios) for (const difficulty of difficulties) for (const face of ['skull', 'cultist', 'tablet', 'elderthing']) for (const fail of [false, true]) {
  test(`${code} ${difficulty} ${face} ${fail ? 'failure' : 'success'} actual printed value/effect and JSON`, () => {
    const s = fixture(id, difficulty), h = harder(difficulty), original = s.investigators[0].location
    const retainedId = code === '07041' ? scenarioRuntime(s, []).mechanics.enemyZones.list('depths')[0].id : null
    let target
    if (code === '07163' && face === 'cultist') {
      target = enemy(s, { traits: ['Deep One'], health: 99, fight: fail ? 99 : 1, damage: 0, horror: 0 })
      asset(s, 'testTicFinalRefEngagement', { enemyId: target.id })
    }
    const result = run(s, face, fail, target ? { enemyId: target.id, fight: true } : {})
    assert.equal(result.value, 20 + delta(code, difficulty, face))
    assert.equal(result.success, !fail)
    const effect = h || fail
    if (code === '07041') {
      assert.equal(s.investigators[0].damage, face === 'cultist' && effect ? 1 : 0)
      assert.equal(s.investigators[0].horror, face === 'tablet' && effect ? 1 : 0)
      const restored = face === 'elderthing' && effect
      assert.equal(s.enemies.some(e => e.id === retainedId), restored)
      assert.equal(Boolean(scenarioRuntime(s, []).mechanics.enemyZones.get('depths', retainedId)), !restored)
      if (restored) {
        const physical = s.enemies.find(e => e.id === retainedId)
        assert.equal(physical.location, original)
        assert.equal(physical.engagedSeat, 0)
        assert.equal(physical.exhausted, false)
      }
    } else if (code === '07123') {
      const api = createMechanicsApi(s)
      assert.equal(s.investigators[0].location, face === 'cultist' && fail ? 'east' : 'here')
      assert.equal(api.barriers.count('here', 'west'), face === 'tablet' && fail ? 1 : 0)
      assert.equal(api.barriers.count('here', 'east'), 2)
    } else {
      assert.equal(s.investigators[0].damage, face === 'tablet' && effect ? 1 : 0)
      assert.equal(s.investigators[0].horror, face === 'elderthing' && effect ? 1 : 0)
      assert.equal(s.scenarioFlags.referenceEngagements || 0, face === 'cultist' && effect ? 1 : 0)
    }
  })
}

for (const [code, id] of scenarios) for (const difficulty of difficulties) for (const face of ['skull', 'cultist', 'tablet', 'elderthing']) {
  test(`${code} ${difficulty} canceled ${face} has neither modifier nor scenario side effect`, () => {
    const s = fixture(id, difficulty), before = s.investigators[0].location
    asset(s, 'testTicFinalRefCancel', { cancelFace: face })
    let target
    if (code === '07163' && face === 'cultist') {
      target = enemy(s, { traits: ['Deep One'], health: 99, fight: 99, damage: 0, horror: 0 })
      asset(s, 'testTicFinalRefEngagement', { enemyId: target.id })
    }
    const result = run(s, [face, '0'], true, target ? { enemyId: target.id, fight: true } : {})
    assert.equal(result.value, 20)
    assert.deepEqual(result.drawn, ['0'])
    assert.equal(s.investigators[0].damage, 0)
    assert.equal(s.investigators[0].horror, 0)
    assert.equal(s.investigators[0].location, before)
    assert.equal(s.scenarioFlags.referenceEngagements || 0, 0)
    if (code === '07041') assert.equal(scenarioRuntime(s, []).mechanics.enemyZones.list('depths').length, 1)
    if (code === '07123') assert.equal(createMechanicsApi(s).barriers.count('here', 'west'), 0)
  })
}

for (const difficulty of difficulties) for (const level of [0, 1, 2]) test(`07041 ${difficulty} exact flood${level} skull and cultist condition`, () => {
  const s = fixture('thePitOfDespair', difficulty), api = createMechanicsApi(s), loc = s.investigators[0].location
  api.water.set(loc, level, { ignoreRestrictions: true })
  assert.equal(run(s, 'skull').value, 20 - 1 - Number(harder(difficulty)) - level)
  run(s, 'cultist', true)
  assert.equal(s.investigators[0].damage, level > 0 ? 1 : 0)
})
for (const difficulty of difficulties) test(`07041 ${difficulty} no controlled key and normal setAside Amalgam do not meet riders`, () => {
  const s = fixture('thePitOfDespair', difficulty, { prepareDepths: false }), api = createMechanicsApi(s)
  api.keys.transfer('red', 'investigator:0', `location:${s.investigators[0].location}`, { reveal: true })
  run(s, 'tablet', true)
  assert.equal(s.investigators[0].horror, 0)
  run(s, 'elderthing', true)
  assert.equal(s.enemies.some(e => codeOf(e) === '07053'), false)
  assert.equal(scenarioRuntime(s, []).mechanics.enemyZones.list('depths').length, 0)
})
for (const difficulty of difficulties) test(`07123 ${difficulty} barrier ignore retains independent cannot-leave restriction`, () => {
  const s = fixture('inTooDeep', difficulty)
  s.locations.find(loc => loc.id === 'here').cannotLeaveRound = s.round
  run(s, 'cultist', true)
  assert.equal(s.investigators[0].location, 'here')
  assert.equal(createMechanicsApi(s).barriers.count('here', 'east'), 2)
})
for (const difficulty of difficulties) test(`07123 ${difficulty} no east location and no payable barrier candidates terminate without choice`, () => {
  const s = fixture('inTooDeep', difficulty), api = createMechanicsApi(s)
  s.investigators[0].location = 'farEast'
  assert.equal(run(s, 'skull').value, 20)
  run(s, 'cultist', true)
  assert.equal(s.investigators[0].location, 'farEast')
  api.barriers.set('farEast', 'east', 1)
  run(s, 'tablet', true)
  assert.equal(api.barriers.count('farEast', 'east'), 1)
})
for (const difficulty of difficulties) test(`07163 ${difficulty} vehicle tablet prevention and carried-only key elderthing exclusion`, () => {
  const s = fixture('devilReef', difficulty), api = createMechanicsApi(s), vehicle = Object.keys(s.scenarioFlags.mechanics.vehicles)[0]
  api.vehicles.enter(0, vehicle, { setup: true })
  run(s, 'tablet', true)
  assert.equal(s.investigators[0].damage, 0)
  const location = s.investigators[0].location
  api.keys.transfer('red', `location:${location}`, 'investigator:0', { reveal: true })
  run(s, 'elderthing', true)
  assert.equal(s.investigators[0].horror, 0)
})

for (const difficulty of difficulties) for (const remote of [false, true]) test(`07163 ${difficulty} actual targeted ${remote ? 'remote' : 'same actor'} DeepOne reengages exactly once`, () => {
  const s = fixture('devilReef', difficulty), location = s.investigators[0].location
  const target = enemy(s, { traits: ['Deep One'], health: 99, fight: 99, damage: 0, horror: 0 })
  if (remote) {
    target.location = s.locations.find(loc => loc.id !== location).id
    target.engagedSeat = null
    s.investigators[0].engaged = []
  }
  asset(s, 'testTicFinalRefEngagement', { enemyId: target.id })
  if (remote) {
    // 远处的深潜者无法用基础攻击行动打到，这里驱动引擎自己的「带类型目标」通道
    //（performTest 的 options.testTarget，战斗/躲避行动内部用的就是它），
    // 因此规则读点拿到的是真实带类型目标，而不是靠名字或事件标签推断。
    setDraws(s, ['cultist'])
    transaction(s, d => scenarioRuntime(d, []).test(0, 'combat', 99, () => {}, 0, null, {
      actionKind: 'fight', testTarget: { kind: 'enemy', id: target.id, actionKind: 'fight' },
    }))
  } else run(s, 'cultist', true, { enemyId: target.id, fight: true })
  const current = s.enemies.find(e => e.id === target.id)
  assert.equal(current.location, location)
  assert.equal(current.engagedSeat, 0)
  assert.equal(s.scenarioFlags.referenceEngagements, 1)
})
for (const difficulty of difficulties) test(`07163 ${difficulty} other enemy and nonfight test cannot reengage selected DeepOne`, () => {
  const s = fixture('devilReef', difficulty), target = enemy(s, { traits: ['Humanoid'], health: 99, fight: 99, damage: 0, horror: 0 })
  asset(s, 'testTicFinalRefEngagement', { enemyId: target.id })
  run(s, 'cultist', true, { enemyId: target.id, fight: true })
  assert.equal(s.scenarioFlags.referenceEngagements || 0, 0)
  s.enemies.find(e => e.id === target.id).traits = ['Deep One']
  run(s, 'cultist', true)
  assert.equal(s.scenarioFlags.referenceEngagements || 0, 0)
})
for (const difficulty of difficulties) for (const fail of [false, true]) test(`07163 ${difficulty} actual ${fail ? 'failed' : 'successful'} evade retains typed target and exactly one engagement`, () => {
  const s = fixture('devilReef', difficulty)
  const target = enemy(s, { traits: ['Deep One'], health: 99, evade: fail ? 99 : 1, damage: 0, horror: 0 })
  asset(s, 'testTicFinalRefEngagement', { enemyId: target.id })
  setDraws(s, ['cultist'])
  move(s, { action: 'evade', enemyId: target.id })
  while (s.pendingChoice) {
    Object.assign(s, JSON.parse(JSON.stringify(s)))
    const c = s.pendingChoice, option = c.options.find(o => ['skip', 'done', 'self'].includes(o.id)) || c.options[0]
    move(s, { action: 'choose', choiceId: c.id, optionId: option.id })
  }
  assert.equal(s.lastTestResult.success, !fail)
  assert.equal(s.scenarioFlags.referenceEngagements || 0, harder(difficulty) || fail ? 1 : 0)
  // 引擎的「横置」是布尔读点（enemy.exhausted === true），未横置的敌人可以没有该字段，
  // 所以这里按同口径比较，不把 undefined 当成第三种状态。
  assert.equal(s.enemies.find(e => e.id === target.id).exhausted === true, !fail)
  assert.equal(s.enemies.find(e => e.id === target.id).engagedSeat, fail ? 0 : null)
})
for (const difficulty of difficulties) test(`07123 ${difficulty} Coastline prevents the only otherwise empty edge from receiving a barrier`, () => {
  const s = fixture('inTooDeep', difficulty), west = s.locations.find(loc => loc.id === 'west')
  west.code = '07143'
  west.originalCode = '07143'
  run(s, 'tablet', true)
  assert.equal(createMechanicsApi(s).barriers.count('here', 'west'), 0)
})
for (const difficulty of difficulties) test(`07123 ${difficulty} skull counts real east cells across a gap and isolated origin counts zero`, () => {
  const s = fixture('inTooDeep', difficulty), api = createMechanicsApi(s)
  api.map.place('farEast', 4, 0)
  assert.equal(run(s, 'skull').value, 20 - (harder(difficulty) ? 4 : 2))
  api.map.place('here', 0, 0, { isolated: true })
  assert.equal(run(s, 'skull').value, 20)
})
