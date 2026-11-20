import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import { enemyPhase, leaveAsset, scenarioRuntime } from '../src/engine/engine.js'
import { lockFloodLevel, setFloodLevel } from '../src/engine/flood.js'
import { cardRuleIds, matchingRules, RULE_INDEX } from '../web/rulebook-data.js'
import { TDC_RULES } from '../web/tdc-rules.js'
import { asset, enemy, fixture, move, settle, validateMove } from './core-fixture.mjs'

test('TDC Relentless attempts exactly one additional attack, including after cancellation', () => {
  const state = fixture()
  const inv = state.investigators[0]
  let attempts = 0
  registerCardAbilities({ code: 'tdc-test-relentless', enemyRule: { relentless: true } })
  registerCardAbilities({ code: 'tdc-test-cancel-first', abilities: [{ kind: 'forced', trigger: 'enemyAttack',
    resolve: ({ context }) => { context.cancelled = ++attempts === 1 } }] })
  asset(state, 'tdc-test-cancel-first')
  const foe = enemy(state, { code: 'tdc-test-relentless', damage: 1 })
  const inactive = enemy(state, { code: foe.code, exhausted: true, damage: 5 })
  enemyPhase(state)
  assert.equal(attempts, 2)
  assert.equal(inv.damage, 1)
  assert.equal(foe.exhausted, true)
  assert.equal(inactive.exhausted, true)
})

test('TDC Relentless temporary grant repeats an uncanceled massive attack against both seats', () => {
  const state = fixture('01001', 2)
  const foe = enemy(state, { massive: true, damage: 1, engagedSeat: null })
  state.investigators[1].location = foe.location
  assert.equal(scenarioRuntime(state, []).setEnemyKeywords(foe, ['relentless'], { enabled: true }), true)
  enemyPhase(state)
  assert.deepEqual(state.investigators.map(inv => inv.damage), [2, 2])
  assert.equal(foe.exhausted, true)
})

test('TDC Alert attacks after a failed evade and preserves readiness', () => {
  for (const [token, exhausted, damage] of [['autofail', false, 1], ['autofail', true, 0], ['0', false, 0]]) {
    const state = fixture()
    const foe = enemy(state, { alert: true, exhausted, damage: 1 })
    state.chaosBag = [token]
    move(state, { action: 'evade', enemyId: foe.id })
    settle(state)
    assert.equal(state.investigators[0].damage, damage)
    assert.equal(state.enemies.find(item => item.id === foe.id).exhausted, exhausted || token === '0')
  }
})

test('TDC Patrol uses reachable flood, empty trait, and doom-free enemy targets during movement', () => {
  const variants = [
    { spec: { kind: 'flood', canIncrease: true }, setup: (state, near, far) => {
      lockFloodLevel(state, 'start')
      lockFloodLevel(state, near)
      setFloodLevel(state, 'bridge', 2)
      setFloodLevel(state, far, 1)
    } },
    { spec: { kind: 'nearestEmpty', trait: 'Summit' }, setup: (state, near, far) => {
      state.locations.find(loc => loc.id === near).traits = ['Summit']
      state.locations.find(loc => loc.id === far).traits = ['Summit']
      enemy(state, { engagedSeat: null, location: near, exhausted: true })
    } },
    { spec: { kind: 'enemy', maxDoom: 0 }, setup: (state, near, far) => {
      enemy(state, { engagedSeat: null, location: near, doom: 1, exhausted: true })
      enemy(state, { engagedSeat: null, location: far, exhausted: true })
    } },
  ]
  for (const [index, { spec, setup }] of variants.entries()) {
    const code = `tdc-test-patrol-${index}`
    registerCardAbilities({ code, enemyRule: { patrolTarget: spec } })
    const state = fixture()
    state.locations = [
      { id: 'start', connections: ['near', 'bridge'] },
      { id: 'near', connections: ['start'] },
      { id: 'bridge', connections: ['start', 'far'] },
      { id: 'far', connections: ['bridge'] },
      { id: 'isolated', connections: [], traits: ['Summit'] },
    ].map(loc => ({ name: loc.id, revealed: true, ...loc }))
    state.investigators[0].location = 'isolated'
    setup(state, 'near', 'far')
    const ready = enemy(state, { code, location: 'start', engagedSeat: null })
    const exhausted = enemy(state, { code, location: 'start', engagedSeat: null, exhausted: true, doom: 1 })
    enemyPhase(state)
    assert.equal(ready.location, 'bridge', spec.kind)
    assert.equal(exhausted.location, 'start')
  }
})

test('TDC Seal requires a matching token, removes one copy, and releases it on leaving play', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['04030']
  const play = { action: 'play', cardId: '04030' }
  assert.match(validateMove(state, 0, play), /封印/)
  assert.deepEqual([inv.actionsLeft, inv.resources, inv.hand], [20, 30, ['04030']])
  state.chaosBag = ['skull', 'skull', 'tablet', '0']
  move(state, play)
  settle(state, choice => {
    if (choice.kind !== 'seal') return null
    assert.deepEqual(choice.options.map(option => option.id), ['skull', 'tablet'])
    return 'skull'
  })
  assert.deepEqual(state.chaosBag, ['skull', 'tablet', '0'])
  const controller = state.investigators[0]
  leaveAsset(state, controller, controller.assets.find(item => item.code === '04030'))
  assert.deepEqual(state.chaosBag.slice().sort(), ['0', 'skull', 'skull', 'tablet'])
})

test('TDC rulebook has bilingual topics, related links and scope-wide card navigation', () => {
  const scope = JSON.parse(readFileSync(new URL('../audit/tdc-scope.json', import.meta.url), 'utf8'))
  const byId = new Map(RULE_INDEX.map(rule => [rule.id, rule]))
  const linked = new Set()
  for (const code of scope.codes) {
    const ids = cardRuleIds(ALL_CARDS[code])
    assert(ids.includes('tdcCampaign'), code)
    for (const id of ids) {
      assert(byId.has(id), `${code}: ${id}`)
      linked.add(id)
    }
  }
  for (const rule of TDC_RULES) {
    assert(rule.body.length && rule.body.length === rule.bodyEn.length, rule.id)
    assert(rule.related.every(id => byId.has(id)), rule.id)
    assert(matchingRules(rule.title).some(entry => entry.id === rule.id), rule.id)
    assert(matchingRules(rule.titleEn).some(entry => entry.id === rule.id), rule.id)
    assert(linked.has(rule.id), rule.id)
  }
})
