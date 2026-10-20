import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createGameState, applyMove, validateMove, legalMoves, getStat } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapterSpecs, locationId as L } from '../content/campaigns/theDunwichLegacy/chapters.js'
import { encounterRules } from '../content/campaigns/theDunwichLegacy/encounter-rules.js'
import { laterBehavior, summonHorror } from '../content/campaigns/theDunwichLegacy/later-behaviors.js'
import { behavior as university } from '../content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/behavior.js'
import { behavior as club } from '../content/campaigns/theDunwichLegacy/scenarios/theHouseAlwaysWins/behavior.js'
import { CHAOS_BAGS, chapters } from '../content/campaigns/theDunwichLegacy/shared.js'

const ENEMIES = [
  '02058', '02078', '02086', '02087', '02090', '02094', '02095', '02097', '02098', '02103', '02104', '02141',
  '02182', '02183', '02216', '02224', '02255', '02293', '02294', '02295', '02323', '02329', '02330',
]
const TREACHERIES = [
  '02081', '02082', '02083', '02084', '02085', '02088', '02089', '02091', '02092', '02093', '02096', '02099',
  '02100', '02101', '02102', '02142', '02143', '02144', '02145', '02146', '02178', '02180', '02181', '02220',
  '02221', '02222', '02223', '02256', '02257', '02258', '02259', '02296', '02297', '02298', '02331', '02332', '02333',
]
const STORY_ASSETS = [
  '02040', '02059', '02060', '02061', '02079', '02080', '02138', '02139', '02140', '02179', '02215', '02217',
  '02218', '02219', '02254',
]
assert.equal(ENEMIES.length, 23)
assert.equal(TREACHERIES.length, 37)
assert.equal(STORY_ASSETS.length, 15)
assert.equal(new Set([...ENEMIES, ...TREACHERIES, ...STORY_ASSETS]).size, 75)

const clone = value => structuredClone(value)
function move(state, action) {
  const seat = state.pendingChoice?.seat ?? state.currentSeat
  assert.equal(validateMove(state, seat, action), null)
  applyMove(state, seat, action)
}
function settle(state, choose = () => null) {
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 100, 'choice loop')
    const pending = state.pendingChoice
    const optionId = choose(pending) || pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0].id
    move(state, { action: 'choose', choiceId: pending.id, optionId })
  }
}

const trialCampaigns = {}
registerContentBundle({ packs: [{ ...contentRegistry.getPack('dunwichCampaign'), id: 'dunwichEncounterAcceptancePack', status: 'playable' }] })
for (const { id } of chapters) {
  const scenarioId = `${id}EncounterAcceptance`
  const campaignId = `${id}EncounterAcceptanceCampaign`
  const production = contentRegistry.getBehavior(id)
  trialCampaigns[id] = campaignId
  registerContentBundle({
    campaigns: [{
      ...contentRegistry.getCampaign('theDunwichLegacy'), id: campaignId, status: 'playable', chaosBags: CHAOS_BAGS,
      scenarioIds: [scenarioId], unlock: { [scenarioId]: [] }, requiredPackIds: ['core', 'dunwichEncounterAcceptancePack'],
      flow: { start: scenarioId, nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } } },
    }],
    scenarios: [{
      scenario: { ...contentRegistry.getScenarioData(id), id: scenarioId },
      behavior: {
        ...production, id: scenarioId,
        actions(state, inv) {
          return [...(production.actions?.(state, inv) || []),
            { action: 'scenarioAction', rule: 'acceptanceEncounter', actions: 0, label: '验收抽遭遇' },
            { action: 'scenarioAction', rule: 'acceptanceDamage', actions: 0, label: '验收伤害' }]
        },
        performAction(state, inv, action, api) {
          if (action.rule === 'acceptanceEncounter') return api.drawEncounter(inv.seat)
          if (action.rule === 'acceptanceDamage') return api.damage(inv.seat, action.amount)
          return production.performAction?.(state, inv, action, api)
        },
      },
      manifest: {
        ...contentRegistry.getScenario(id), id: scenarioId, campaignId, status: 'playable',
        requiredMechanicIds: [], requiredEncounterGroupIds: [], requiredPackIds: ['core', 'dunwichEncounterAcceptancePack'],
        behaviorIds: [scenarioId],
      },
    }],
  })
}

function chapter(id, players = 2, seed = `acceptance-${id}`) {
  const state = createGameState({ campaignId: trialCampaigns[id], seed, playerInvestigator: '01001' },
    Array.from({ length: players }, (_, seat) => ({ seat })))
  settle(state)
  for (const inv of state.investigators) {
    inv.actionsLeft = 12
    inv.hand = []
    inv.assets = []
    inv.threat = []
    inv.deck = Array(20).fill('01088')
    inv.discard = []
    inv.resources = 10
  }
  state.chaosBag = ['0']
  return state
}
function draw(state, code, choose = () => null) {
  state.encounterDeck = [code]
  state.encounterDiscard = []
  move(state, { action: 'scenarioAction', rule: 'acceptanceEncounter' })
  settle(state, choose)
}
function definition(category, code) {
  for (const id of contentRegistry.getCampaign('theDunwichLegacy').scenarioIds) {
    const found = Object.values(contentRegistry.getScenarioData(id)[category] || {}).find(card => (card.originalCode || card.code) === code)
    if (found) return found
  }
  assert.fail(`missing ${category} ${code}`)
}
const active = (seat = 0, location = 'a') => ({
  seat, location, hand: [], assets: [], threat: [], deck: [], discard: [], clues: 0, resources: 5, actionsLeft: 3,
  damage: 0, horror: 0, defeated: false, resigned: false,
})
const simpleState = (players = 1) => ({
  numInvestigators: players,
  investigators: Array.from({ length: players }, (_, seat) => active(seat)),
  locations: [{ id: 'a', originalCode: 'x', name: 'A', connections: ['b'], clues: 0, traits: [] },
    { id: 'b', originalCode: 'y', name: 'B', connections: ['a'], clues: 0, traits: [] }],
  enemies: [], encounterDeck: [], encounterDiscard: [], storyAssets: [], victoryDisplay: [],
  scenarioFlags: {}, scenarioZones: { setAside: [], removed: [], sacrificed: [], sacrifices: [] },
  campaign: { leadSeat: 0, records: {}, chaosBag: ['0'], investigators: { 0: { status: 'alive', deck: [] }, 1: { status: 'alive', deck: [] } } },
  round: 1, phase: 'mythos', actIndex: 0, agendaIndex: 0, acts: [{ originalCode: 'act' }], agendas: [{ originalCode: 'agenda' }],
  scenario: { id: 'probe', enemies: {}, treacheries: {}, storyAssets: {} }, chaosBag: ['0'], doom: 0,
})

const enemyChecks = {
  '02058'() {
    const def = definition('enemies', '02058')
    assert.equal(def.massive, true)
    assert.equal(def.healthPerPlayerBonus, 3)
    const state = { enemies: [{ code: '02058', exhausted: true }] }
    university.enemyPhaseStart(state)
    assert.equal(state.enemies[0].exhausted, false)
    let advanced = 0
    university.checkObjectives({ actIndex: 2, agendaIndex: 0, victoryDisplay: [{ code: '02058' }], enemies: [] }, { advanceAct: () => advanced++ })
    assert.equal(advanced, 1)
  },
  '02078'() {
    const state = simpleState()
    const boss = { id: 'boss', code: '02078', location: 'a', exhausted: true }
    state.enemies = [boss]
    let engaged = null, attacked = 0
    club.cluesGained(state, state.investigators[0], 1, { engage: (_enemy, seat) => { engaged = seat }, attack: () => attacked++ })
    assert.equal(boss.exhausted, false)
    assert.equal(engaged, 0)
    assert.equal(attacked, 1)
  },
  '02086'() {
    const state = simpleState()
    state.locations[1].clues = 4
    assert.equal(encounterRules.spawnLocation(state, '02086', 'a', 0, {}), 'b')
    assert.equal(definition('enemies', '02086').retaliate, true)
  },
  '02087'() {
    const state = simpleState()
    state.enemies = [{ code: '02087', engagedSeat: 0 }]
    let attacks = 0
    encounterRules.encounterDrawn(state, state.investigators[0], '02296', { attack: () => attacks++ })
    encounterRules.encounterDrawn(state, state.investigators[0], '02081', { attack: () => attacks++ })
    assert.equal(attacks, 1)
    assert.equal(definition('enemies', '02087').prey, 'fewestHand')
  },
  '02090'() {
    const state = simpleState()
    state.enemies = [{ code: '02090', location: 'a' }, { code: '02090', location: 'b' }]
    for (const skill of ['willpower', 'intellect', 'combat', 'agility'])
      assert.equal(encounterRules.statModifier(state, state.investigators[0], skill), -1)
    assert.equal(definition('enemies', '02090').aloof, true)
  },
  '02094'() {
    const state = chapter('undimensionedAndUnseen', 1)
    const inv = state.investigators[0]
    inv.assets = [{ id: 'gun', code: '01016', uses: 4, exhausted: false }]
    state.enemies = [{ id: 'bird', code: '02094', originalCode: '02094', name: '禽鸟奴隶', location: inv.location,
      fight: 4, evade: 2, health: 9, damageTaken: 0, damage: 1, horror: 1, traits: ['Monster'], exhausted: true }]
    move(state, { action: 'ability', assetId: 'gun', abilityIndex: 0, targetId: 'bird' })
    assert.equal(state.skillTest.difficulty, 1)
    settle(state)
  },
  '02095'() {
    const state = simpleState()
    state.locations.push({ id: 'c', connections: ['b'], clues: 0 })
    state.locations[1].connections.push('c')
    assert.equal(encounterRules.spawnLocation(state, '02095', 'a', 0, {}), 'c')
    assert.equal(definition('enemies', '02095').retaliate, true)
  },
  '02097'() {
    const state = simpleState()
    state.enemies = [{ code: '02097', engagedSeat: 0 }]
    assert.equal(encounterRules.canGainResources(state, state.investigators[0]), false)
    state.enemies[0].engagedSeat = null
    assert.equal(encounterRules.canGainResources(state, state.investigators[0]), true)
  },
  '02098'() {
    const state = simpleState()
    const inv = state.investigators[0]
    encounterRules.enemyAttackResolved(state, { code: '02098' }, inv)
    assert.equal(inv.resources, 4)
    inv.resources = 0
    encounterRules.enemyAttackResolved(state, { code: '02098' }, inv)
    assert.equal(inv.resources, 0)
  },
  '02103'() {
    const state = chapter('lostInTimeAndSpace', 1)
    const inv = state.investigators[0]
    inv.assets = [{ id: 'knife', code: '01086', exhausted: false }]
    state.enemies = [{ id: 'spheres', code: '02103', name: '球体聚合', location: inv.location, engagedSeat: 0,
      fight: 1, evade: 1, health: 9, damageTaken: 0, damage: 1, horror: 1, traits: ['Monster'], exhausted: true }]
    inv.engaged = ['spheres']
    move(state, legalMoves(state).find(action => action.action === 'ability' && action.assetId === 'knife'))
    settle(state)
    assert.ok(!state.investigators[0].assets.some(asset => asset.id === 'knife'))
    assert.equal(state.investigators[0].discard.filter(code => code === '01086').length, 1)
  },
  '02104'() {
    const state = simpleState()
    state.investigators[0].deck = ['a', 'b', 'c']
    let discarded = 0
    encounterRules.enemyAttackStarted(state, { code: '02104' }, state.investigators[0], { discardTop: (_seat, n) => { discarded = n } })
    assert.equal(discarded, 2)
    assert.equal(definition('enemies', '02104').prey, 'lowestAgility')
  },
  '02141'() {
    const state = simpleState()
    state.scenarioZones = { void: { code: '02141', resources: 2 }, setAside: [] }
    state.encounterDeck = ['02141']
    const enemy = summonHorror(state, 'a', {
      spawn: (code, location) => {
        const spawned = { code, location, fight: 2, evade: 2, health: 3 }
        state.enemies.push(spawned)
        return spawned
      },
    })
    assert.equal(enemy.health, 6)
    assert.equal(enemy.shadowResources, 3)
    assert.equal(enemy.massive, true)
    assert.ok(!state.encounterDeck.includes('02141'))
  },
  '02182'() {
    const state = simpleState()
    state.scenarioZones.train = []
    state.enemies = [{ code: '02182', engagedSeat: 0 }]
    assert.match(laterBehavior('theEssexCountyExpress').investigatorEntryError(state, state.locations[1], state.investigators[0]), /不能移动/)
    state.enemies[0].engagedSeat = null
    assert.equal(laterBehavior('theEssexCountyExpress').investigatorEntryError(state, state.locations[1], state.investigators[0]), null)
  },
  '02183'() {
    const state = simpleState()
    state.scenarioZones.train = ['a', 'b']
    const enemy = { code: '02183', exhausted: false }
    assert.equal(encounterRules.spawnLocation(state, '02183', 'a', 0, {}), 'b')
    encounterRules.enemySpawned(state, enemy, {})
    assert.equal(enemy.exhausted, true)
  },
  '02216'() {
    const state = simpleState()
    assert.equal(laterBehavior('bloodOnTheAltar').canOpportunityAttack(state, { code: '02216' }), false)
    assert.equal(definition('enemies', '02216').massive, true)
  },
  '02224'() {
    const state = simpleState()
    state.locations[1].clues = 2
    state.investigators[0].location = 'a'
    assert.equal(encounterRules.spawnLocation(state, '02224', 'a', 0, {}), 'b')
    let gained = 0
    laterBehavior('bloodOnTheAltar').enemyDefeated(state, { code: '02224', defeatedBy: 0 },
      { choose: () => 'b', gainClues: (_seat, n) => { gained += n } })
    assert.equal(state.locations[1].clues, 1)
    assert.equal(gained, 1)
  },
  '02255'() {
    const state = chapter('undimensionedAndUnseen', 1)
    const inv = state.investigators[0], brood = state.enemies.find(enemy => enemy.code === '02255')
    brood.location = inv.location
    inv.hand = ['01024']
    inv.resources = 10
    const before = brood.damageTaken || 0
    move(state, { action: 'play', cardId: '01024' })
    settle(state, pending => pending.options.some(option => option.id === inv.location) ? inv.location : null)
    assert.equal(brood.damageTaken || 0, before)
    assert.equal(definition('enemies', '02255').healthPerPlayerBonus, 1)
  },
  '02293'() {
    const def = definition('enemies', '02293')
    const state = chapter('whereDoomAwaits', 1)
    const inv = state.investigators[0]
    const enemy = { ...clone(def), id: 'seth', location: inv.location, engagedSeat: 0, damageTaken: 0, exhausted: false }
    state.enemies = [enemy]
    inv.engaged = [enemy.id]
    inv.combat = 0
    state.chaosBag = ['autofail']
    const before = inv.damage + inv.horror
    move(state, { action: 'fight', enemyId: enemy.id })
    settle(state)
    assert.equal(state.investigators[0].damage + state.investigators[0].horror, before + enemy.damage + enemy.horror)
  },
  '02294'() {
    const state = simpleState()
    state.locations[0].id = L('02282')
    state.locations[1].id = L('02284')
    state.locations[0].connections = [L('02284')]
    state.locations[1].connections = [L('02282')]
    const enemy = { id: 'devotee', code: '02294', location: L('02282') }
    state.enemies = [enemy]
    laterBehavior('whereDoomAwaits').enemyPhaseEnd(state, { random: () => 0, moveEnemy: (target, destination) => { target.location = destination } })
    assert.equal(enemy.location, L('02284'))
    laterBehavior('whereDoomAwaits').enemyPhaseEnd(state, {})
    assert.equal(state.enemies.length, 0)
    assert.equal(state.doom, 2)
    assert.deepEqual(state.encounterDiscard, ['02294'])
  },
  '02295'() {
    const state = simpleState()
    state.locations[1].traits = ['Altered']
    assert.equal(encounterRules.spawnLocation(state, '02295', 'a', 0, {}), 'b')
    state.investigators[0].defeated = true
    laterBehavior('whereDoomAwaits').enemyAttackResolved(state, { code: '02295' }, state.investigators[0])
    assert.equal(state.campaign.investigators[0].status, 'killed')
  },
  '02323'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.deck = ['a', 'b']
    const behavior = laterBehavior('lostInTimeAndSpace')
    assert.equal(behavior.canEvadeEnemy(state, inv, { code: '02323' }), false)
    assert.equal(behavior.canOpportunityAttack(state, { code: '02323' }), false)
    const result = behavior.beforeEnemyHarm(state, { code: '02323' }, inv, { horror: 2 },
      { choose: () => '1', discardTop: (_seat, n) => inv.deck.splice(-n), defeat: () => assert.fail('deck remains') })
    assert.deepEqual(result, { horror: 1 })
    assert.equal(inv.deck.length, 1)
  },
  '02329'() {
    const state = simpleState()
    state.locations[1].traits = ['Extradimensional']
    state.locations[1].clues = 2
    assert.equal(encounterRules.spawnLocation(state, '02329', 'a', 0, {}), 'b')
    const enemy = { code: '02329', location: 'b', doom: 0 }
    encounterRules.enemyMoved(state, enemy, 'a', {})
    assert.equal(state.locations[1].clues, 1)
    assert.equal(enemy.doom, 1)
  },
  '02330'() {
    const state = simpleState()
    state.locations[1].originalCode = '02320'
    assert.equal(encounterRules.spawnLocation(state, '02330', 'a', 0, {}), 'b')
    const enemy = { code: '02330', doom: 0 }
    state.investigators[0].discard = Array(11).fill('x')
    encounterRules.enemyAttackStarted(state, enemy, state.investigators[0], {})
    assert.equal(enemy.doom, 1)
  },
}

for (const code of ENEMIES) test(`Dunwich ${code} 敌人主要卡文与边界`, enemyChecks[code])

const treacheryChecks = {
  '02081'() {
    const state = simpleState(2)
    state.scenarioFlags.hadDrink = [1]
    let surged = null
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02081' }, { drawEncounter: seat => { surged = seat } })
    assert.equal(state.investigators[0].actionsLeft, 3)
    assert.equal(state.investigators[1].actionsLeft, 2)
    assert.equal(surged, 0)
  },
  '02082'() {
    const state = simpleState()
    state.enemies = [{ traits: ['Criminal'], location: 'a', doom: 0 }]
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02082' }, {})
    assert.equal(state.enemies[0].doom, 1)
    state.enemies = []
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02082' }, {})
    assert.equal(state.investigators[0].resources, 3)
  },
  '02083'() {
    const state = simpleState()
    let request
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02083' }, {
      test: (seat, skill, difficulty, resolve) => { request = [seat, skill, difficulty]; resolve({ success: false, value: 2 }) },
      discardTop: (seat, amount) => { request.push(seat, amount) },
    })
    assert.deepEqual(request, [0, 'willpower', 5, 0, 3])
  },
  '02084'() {
    const state = simpleState()
    let damage = 0, surge = 0
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02084' },
      { threat: (seat, code) => state.investigators[seat].threat.push({ code }), damage: (_seat, n) => { damage += n }, drawEncounter: () => surge++ })
    assert.equal(state.investigators[0].threat.length, 0)
    assert.equal(damage, 10)
    assert.equal(surge, 1)
    assert.equal(state.encounterDiscard.filter(code => code === '02084').length, 1)
  },
  '02085'() {
    const state = simpleState()
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02085' }, { choose: () => 'agenda' })
    assert.deepEqual(encounterRules.publicAttachments(state).agenda, ['02085'])
    encounterRules.agendaLeftPlay(state)
    assert.deepEqual(encounterRules.publicAttachments(state).agenda, [])
    assert.deepEqual(state.encounterDiscard, ['02085'])
  },
  '02088'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ code: '02061' }]
    encounterRules.resolveEncounter(state, inv, { code: '02088' }, { threat: (seat, code) => state.investigators[seat].threat.push({ code }) })
    assert.equal(encounterRules.statModifier(state, inv, 'intellect'), 0)
    encounterRules.turnEnded(state, inv, { test: (_seat, _skill, difficulty, resolve) => { assert.equal(difficulty, 3); resolve({ success: true }) } })
    assert.equal(inv.threat.length, 0)
    assert.deepEqual(state.encounterDiscard, ['02088'])
  },
  '02089'() {
    const state = simpleState(2)
    const behavior = laterBehavior('bloodOnTheAltar')
    behavior.resolveEncounter(state, state.investigators[0], { code: '02089' }, {})
    assert.equal(state.locations[0].sordidAndSilent, 1)
    const horror = []
    behavior.roundEnded(state, { horror: (seat, n) => horror.push([seat, n]) })
    assert.deepEqual(horror, [[0, 1], [1, 1]])
    behavior.agendaLeftPlay(state, {}, {})
    assert.equal(state.locations[0].sordidAndSilent, undefined)
    assert.deepEqual(state.encounterDiscard, ['02089'])
  },
  '02091'() {
    const state = simpleState()
    state.investigators[0].damage = 2
    let horror = 0
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02091' }, {
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'willpower'); assert.equal(difficulty, 4); resolve({ success: false }) },
      horror: (_seat, n) => { horror += n },
    })
    assert.equal(horror, 2)
  },
  '02092'() {
    const state = simpleState()
    const inv = state.investigators[0]
    encounterRules.resolveEncounter(state, inv, { code: '02092' }, { threat: (seat, code) => state.investigators[seat].threat.push({ code }) })
    encounterRules.afterTest(state, inv, { success: true, value: 4, difficulty: 3 })
    assert.equal(inv.threat.length, 0)
    assert.deepEqual(state.encounterDiscard, ['02092'])
  },
  '02093'() {
    const state = simpleState()
    state.chaosBag = ['skull']
    let horror = 0, damage = 0
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02093' },
      { random: () => 0, horror: (_seat, n) => { horror += n }, damage: (_seat, n) => { damage += n } })
    assert.equal(horror, 2)
    assert.equal(damage, 0)
  },
  '02096'() {
    const state = chapter('undimensionedAndUnseen')
    const targets = state.enemies.filter(enemy => enemy.traits?.includes('Abomination'))
    assert.ok(targets.length >= 2)
    targets[1].damageTaken = 3
    state.encounterDeck = ['02096']
    move(state, { action: 'scenarioAction', rule: 'acceptanceEncounter' })
    assert.equal(state.pendingChoice?.source, '02096')
    const saved = clone(state)
    for (const replay of [state, saved]) settle(replay, pending => pending.source === '02096' ? targets[1].id : null)
    assert.deepEqual(state, saved)
    const attached = state.enemies.find(enemy => enemy.id === targets[1].id)
    assert.equal(attached.damageTaken, 0)
    assert.deepEqual(attached.attachedTreacheries, ['02096'])
    laterBehavior('undimensionedAndUnseen').enemyDefeated(state, attached, {})
    assert.ok(state.encounterDiscard.includes('02096'))
  },
  '02099'() {
    const state = simpleState()
    const enemy = { traits: ['Criminal'], location: 'b', engagedSeat: null }
    state.enemies = [enemy]
    let attacked = 0
    encounterRules.resolveEncounter(state, state.investigators[0], { code: '02099' }, {
      stepToward: () => 'a', moveEnemy: target => { target.location = 'a'; target.engagedSeat = 0 }, attack: () => attacked++, drawEncounter: () => assert.fail('criminal exists'),
    })
    assert.equal(enemy.location, 'a')
    assert.equal(attacked, 1)
  },
  '02100'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ id: 'ordinary', code: '01016' }, { id: 'story', code: '02138' }]
    state.scenario.storyAssets['02138'] = { code: '02138' }
    let offered, horror = 0
    encounterRules.resolveEncounter(state, inv, { code: '02100' }, {
      choose: request => { offered = request.options; return 'ordinary' },
      shuffleAssetIntoDeck: () => '01016', discardTop: () => ['01016', 'x', 'y'], horror: (_seat, n) => { horror += n },
    })
    assert.deepEqual(offered.map(option => option.id), ['ordinary'])
    assert.equal(horror, 2)
  },
  '02101'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.hand = ['01016', '01088', '01092']
    encounterRules.encounterDrawn(state, inv, '02101', {})
    encounterRules.resolveEncounter(state, inv, { code: '02101' }, { choose: () => 'asset' })
    assert.deepEqual(inv.hand, ['01088', '01092'])
    encounterRules.encounterDrawn(state, inv, '02101', {})
    let options
    encounterRules.resolveEncounter(state, inv, { code: '02101' }, { choose: request => { options = request.options.map(option => option.id); return 'event,skill' } })
    assert.ok(options.every(option => option.includes(',')))
    assert.deepEqual(inv.hand, [])
  },
  '02102'() {
    const state = chapter('theMiskatonicMuseum', 1)
    const inv = state.investigators[0]
    inv.willpower = 9
    const destination = state.locations.find(loc => loc.id === L('02128'))
    inv.location = L('02126')
    state.locations.find(loc => loc.id === inv.location).connections.push(destination.id)
    draw(state, '02102')
    assert.equal(state.locations.find(loc => loc.id === inv.location).arcaneBarriers, 1)
    move(state, { action: 'move', locationId: destination.id })
    const saved = clone(state)
    settle(state)
    settle(saved)
    assert.deepEqual(state, saved)
    assert.equal(state.investigators[0].location, destination.id)
    assert.equal(state.locations.find(loc => loc.id === L('02126')).arcaneBarriers, 0)
  },
  '02142'() {
    const state = simpleState()
    const horror = { code: '02141' }
    state.enemies = [horror]
    assert.equal(laterBehavior('theMiskatonicMuseum').resolveEncounter(state, state.investigators[0], { code: '02142' }, {}), true)
    assert.equal(horror.shadowSpawned, true)
  },
  '02143'() {
    const state = simpleState(2)
    const horror = { code: '02141', exhausted: true, location: 'b' }
    state.enemies = [horror]
    let engaged = 0, attacked = 0
    laterBehavior('theMiskatonicMuseum').resolveEncounter(state, state.investigators[0], { code: '02143' },
      { engage: () => engaged++, attack: () => attacked++ })
    // The Horror does not teleport; away from the investigator only readies.
    assert.equal(horror.location, 'b')
    assert.equal(horror.exhausted, false)
    assert.equal(engaged, 0)
    assert.equal(attacked, 0)
    horror.location = state.investigators[0].location
    horror.exhausted = true
    laterBehavior('theMiskatonicMuseum').resolveEncounter(state, state.investigators[0], { code: '02143' },
      { engage: () => engaged++, attack: () => attacked++ })
    assert.equal(horror.exhausted, false)
    assert.equal(engaged, 1)
    assert.equal(attacked, 2)
  },
  '02144'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ id: 'ally', code: '02149' }, { id: 'weapon', code: '01016' }]
    const assets = []
    let direct = 0
    laterBehavior('theMiskatonicMuseum').resolveEncounter(state, inv, { code: '02144' }, {
      test: (_seat, _skill, difficulty, resolve) => { assert.equal(difficulty, 3); resolve({ success: false }) },
      choose: () => 'damage', directDamage: (_seat, n) => { direct += n }, damageAsset: (_seat, id, n) => assets.push([id, n]),
    })
    assert.equal(direct, 1)
    assert.deepEqual(assets, [['ally', 1]])
  },
  '02145'() {
    const state = simpleState()
    laterBehavior('theMiskatonicMuseum').resolveEncounter(state, state.investigators[0], { code: '02145' }, {
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'intellect'); assert.equal(difficulty, 3); resolve({ success: false, value: 1 }) },
    })
    assert.equal(state.investigators[0].actionsLeft, 1)
  },
  '02146'() {
    const state = simpleState()
    const horror = { code: '02141', doom: 0 }
    state.enemies = [horror]
    let shuffled = 0
    laterBehavior('theMiskatonicMuseum').resolveEncounter(state, state.investigators[0], { code: '02146' }, { shuffleEncounterDeck: () => shuffled++ })
    assert.equal(horror.doom, 1)
    assert.equal(shuffled, 1)
  },
  '02178'() {
    const state = simpleState()
    let milled = 0
    laterBehavior('theEssexCountyExpress').resolveEncounter(state, state.investigators[0], { code: '02178' },
      { discardTop: (_seat, n) => { milled = n } })
    assert.equal(milled, 3)
  },
  '02180'() {
    const state = simpleState()
    let assetsFirst = 0
    laterBehavior('theEssexCountyExpress').resolveEncounter(state, state.investigators[0], { code: '02180' }, {
      test: (_seat, _skill, difficulty, resolve) => { assert.equal(difficulty, 3); resolve({ success: false }) },
      assetsFirstDamage: (_seat, n) => { assetsFirst = n },
    })
    assert.equal(state.investigators[0].steamImmobileRound, state.round)
    assert.equal(assetsFirst, 2)
  },
  '02181'() {
    const state = simpleState(2)
    state.investigators[0].damage = 4
    state.investigators[0].assets = [{ id: 'asset', code: '01016' }]
    const discarded = []
    laterBehavior('theEssexCountyExpress').resolveEncounter(state, state.investigators[0], { code: '02181' }, {
      choose: request => request.options[0].id, discardAsset: (seat, id) => discarded.push([seat, id]),
    })
    assert.deepEqual(state.investigators.map(inv => inv.actionsLeft), [2, 2])
    assert.deepEqual(discarded, [[0, 'asset']])
  },
  '02220'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ id: 'ally', code: '01018' }]
    let removed = null
    laterBehavior('bloodOnTheAltar').resolveEncounter(state, inv, { code: '02220' }, {
      choose: request => request.kind === 'skill' ? 'willpower' : 'ally',
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'willpower'); assert.equal(difficulty, 4); resolve({ success: false }) },
      removeAsset: (_seat, id) => { removed = id; return '01018' },
    })
    assert.equal(removed, 'ally')
    assert.deepEqual(state.scenarioZones.sacrifices, ['01018'])
    assert.equal(state.scenarioFlags.kidnapped, 1)
  },
  '02221'() {
    const state = chapter('bloodOnTheAltar')
    state.encounterDeck = ['02090', '02221']
    move(state, { action: 'scenarioAction', rule: 'acceptanceEncounter' })
    assert.equal(state.pendingChoice?.source, '02221')
    const saved = clone(state)
    for (const replay of [state, saved]) settle(replay, pending => pending.source === '02221' ? '1' : null)
    assert.deepEqual(state, saved)
    assert.deepEqual(state.investigators[1].threat.map(card => card.code), ['02221'])
    assert.ok(state.enemies.some(enemy => enemy.code === '02090'), 'surge resolved exactly once after choosing the target')
  },
  '02222'() {
    const state = simpleState(3)
    laterBehavior('bloodOnTheAltar').resolveEncounter(state, state.investigators[0], { code: '02222' }, {
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'intellect'); assert.equal(difficulty, 3); resolve({ success: false }) },
    })
    assert.equal(state.locations[0].clues, 2)
  },
  '02223'() {
    const state = simpleState()
    let horror = 0
    laterBehavior('bloodOnTheAltar').resolveEncounter(state, state.investigators[0], { code: '02223' }, {
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'willpower'); assert.equal(difficulty, 3); resolve({ success: false, value: 1 }) },
      horror: (_seat, n) => { horror = n },
    })
    assert.equal(horror, 2)
  },
  '02256'() {
    const state = chapter('undimensionedAndUnseen')
    const broods = state.enemies.filter(enemy => enemy.code === '02255')
    assert.ok(broods.length >= 2)
    const target = broods[1]
    target.location = state.investigators[0].location
    const beforeHealth = target.health
    state.encounterDeck = ['02256']
    move(state, { action: 'scenarioAction', rule: 'acceptanceEncounter' })
    assert.equal(state.pendingChoice?.source, '02256')
    const saved = clone(state)
    for (const replay of [state, saved]) settle(replay, pending => pending.source === '02256' ? target.id : null)
    assert.deepEqual(state, saved)
    const attached = state.enemies.find(enemy => enemy.id === target.id)
    const behavior = laterBehavior('undimensionedAndUnseen')
    assert.equal(attached.health, beforeHealth + 1)
    assert.equal(behavior.enemyStatModifier(state, attached, 'fight'), 1)
    assert.equal(state.investigators[0].damage, 1)
  },
  '02257'() {
    const state = simpleState(2)
    state.enemies = [{ code: '02255', location: 'a' }]
    const damage = []
    laterBehavior('undimensionedAndUnseen').resolveEncounter(state, state.investigators[0], { code: '02257' }, {
      test: (seat, skill, difficulty, resolve) => { assert.equal(skill, 'agility'); assert.equal(difficulty, 3); resolve({ success: false, value: seat + 1 }) },
      damage: (seat, n) => damage.push([seat, n]),
    })
    assert.deepEqual(damage, [[0, 2], [1, 1]])
  },
  '02258'() {
    const state = chapter('undimensionedAndUnseen')
    const broods = state.enemies.filter(enemy => enemy.code === '02255')
    assert.ok(broods.length >= 2)
    state.encounterDeck = ['02090', '02258']
    move(state, { action: 'scenarioAction', rule: 'acceptanceEncounter' })
    assert.equal(state.pendingChoice?.source, '02258')
    const saved = clone(state)
    const chooseReverse = pending => pending.source === '02258' ? pending.options.at(-1).id : null
    settle(state, chooseReverse)
    settle(saved, chooseReverse)
    assert.deepEqual(state, saved)
    assert.ok(state.enemies.some(enemy => enemy.code === '02090'), 'all brood moves finish before the surge draw')
  },
  '02259'() {
    const state = simpleState()
    state.scenarioZones.brood = { remaining: 1 }
    state.scenarioZones.setAside = ['02255']
    let spawned
    laterBehavior('undimensionedAndUnseen').resolveEncounter(state, state.investigators[0], { code: '02259' }, {
      choose: () => 'spawn', random: () => 0, spawn: (code, location) => { spawned = { code, location }; return spawned },
    })
    assert.deepEqual(spawned, { code: '02255', location: 'a', health: 2 })
    assert.equal(state.scenarioZones.brood.remaining, 0)
    assert.deepEqual(state.scenarioZones.setAside, [])
  },
  '02296'() {
    const state = simpleState(2)
    state.locations[0].traits = ['Altered']
    state.investigators[0].discard = ['01096']
    const milled = []
    laterBehavior('whereDoomAwaits').resolveEncounter(state, state.investigators[0], { code: '02296' }, {
      discardTop: (seat, n) => milled.push([seat, n]), random: () => 0,
    })
    assert.deepEqual(milled, [[0, 3], [1, 3]])
    assert.ok(state.investigators[0].deck.includes('01096'))
    assert.ok(!state.investigators[0].discard.includes('01096'))
  },
  '02297'() {
    const state = simpleState()
    state.locationVariants = {}
    state.locations[0].traits = []
    state.locations[1].traits = ['Sentinel Hill']
    state.investigators[0].location = 'a'
    laterBehavior('whereDoomAwaits').resolveEncounter(state, state.investigators[0], { code: '02297' }, {
      random: () => 0, moveInvestigator: (seat, location) => { state.investigators[seat].location = location },
      moveEnemy: () => {},
    })
    assert.equal(state.investigators[0].location, 'b')
    assert.equal(state.locations[0].revealed, false)
    assert.equal(state.locations[0].hiddenIdentity, true)
    assert.equal(state.locations[0].name, '未知小径')
  },
  '02298'() {
    const state = simpleState(2)
    state.locations[0].traits = ['Sentinel Hill']
    const damaged = []
    laterBehavior('whereDoomAwaits').resolveEncounter(state, state.investigators[0], { code: '02298' }, {
      test: (seat, skill, difficulty, resolve) => { assert.equal(skill, 'willpower'); assert.equal(difficulty, 4); resolve({ success: false }) },
      damage: (seat, n) => damaged.push([seat, n]),
    })
    assert.deepEqual(damaged, [[0, 2], [1, 2]])
  },
  '02331'() {
    const state = simpleState()
    state.locations[0].traits = ['Extradimensional']
    const removed = []
    let damage = 0
    laterBehavior('lostInTimeAndSpace').resolveEncounter(state, state.investigators[0], { code: '02331' }, {
      remove: id => removed.push(id), damage: (_seat, n) => { damage += n },
    })
    assert.deepEqual(removed, ['a'])
    assert.deepEqual(state.encounterDiscard, ['x'])
    assert.equal(damage, 1)
  },
  '02332'() {
    const state = chapter('lostInTimeAndSpace', 1)
    const inv = state.investigators[0]
    state.agendaIndex = 0
    state.agendas[0].originalCode = '02312'
    state.encounterDeck = ['02325', '02083', '02332']
    const before = inv.horror
    move(state, { action: 'scenarioAction', rule: 'acceptanceEncounter' })
    settle(state)
    assert.equal(state.locations.find(loc => loc.id === state.investigators[0].location)?.originalCode, '02325')
    assert.ok(state.encounterDiscard.includes('02083'))
    assert.equal(state.investigators[0].horror, before + 1)
  },
  '02333'() {
    const state = simpleState()
    state.locations.push(...Array.from({ length: 7 }, (_, index) => ({ id: `x${index}`, traits: ['Extradimensional'] })))
    let horror = 0
    laterBehavior('lostInTimeAndSpace').resolveEncounter(state, state.investigators[0], { code: '02333' }, {
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'willpower'); assert.equal(difficulty, 5); resolve({ success: false, value: 2 }) },
      horror: (_seat, n) => { horror = n }, drawEncounter: () => assert.fail('locations exist'),
    })
    assert.equal(horror, 3)
  },
}

for (const code of TREACHERIES) test(`Dunwich ${code} 诡计主要卡文、目标及时机`, treacheryChecks[code])

const storyChecks = {
  '02040'() {
    const state = simpleState()
    const inv = state.investigators[0]
    const armitage = { code: '02040', exhausted: false }
    inv.assets = [armitage]
    inv.hand = ['01088']
    encounterRules.cardDrawn(state, inv, '01088', { choose: () => 'trigger' })
    assert.equal(armitage.exhausted, true)
    assert.equal(inv.resources, 8)
    assert.deepEqual(inv.hand, [])
    assert.deepEqual(inv.discard, ['01088'])
  },
  '02059'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ code: '02059' }]
    state.scenarioZones.removed = []
    state.enemies = [{ id: 'experiment', code: '02058', location: 'a', fight: 4 }]
    let damage
    university.performAction(state, inv, { rule: 'concoctionAttack', enemyId: 'experiment' }, {
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'intellect'); assert.equal(difficulty, 4); resolve({ success: true }) },
      damageEnemy: (id, n, seat, source) => { damage = [id, n, seat, source] },
    })
    assert.deepEqual(damage, ['experiment', 7, 0, '02059'])
    assert.deepEqual(inv.assets, [])
    assert.deepEqual(state.scenarioZones.removed, ['02059'])
  },
  '02060'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.clues = 1
    state.numInvestigators = 1
    state.actIndex = 1
    state.encounterDeck = ['x', '02060']
    university.performAction(state, inv, { rule: 'searchJazz' }, { storyAsset: (code, location) => state.storyAssets.push({ code, location }) })
    assert.equal(inv.clues, 0)
    assert.deepEqual(state.storyAssets, [{ code: '02060', location: 'a' }])
    university.performAction(state, inv, { rule: 'parleyJazz' }, {
      test: (_seat, skill, difficulty, resolve) => { assert.equal(skill, 'intellect'); assert.equal(difficulty, 3); resolve({ success: true }) },
      advanceAct: () => state.actIndex++,
    })
    assert.ok(inv.assets.some(asset => asset.code === '02060'))
    assert.equal(state.actIndex, 2)
  },
  '02061'() {
    const state = simpleState()
    const inv = state.investigators[0]
    const rice = { code: '02061', exhausted: false }
    inv.assets = [rice]
    let drawn = 0
    encounterRules.cluesGained(state, inv, 1, { choose: () => 'trigger', drawCards: (_seat, n) => { drawn += n } })
    assert.equal(rice.exhausted, true)
    assert.equal(drawn, 1)
    assert.equal(encounterRules.statModifier(state, inv, 'intellect'), 1)
  },
  '02079'() {
    const state = simpleState()
    const inv = state.investigators[0]
    const peter = { code: '02079', exhausted: false, controllerSeat: 0 }
    inv.assets = [peter]
    state.enemies = [{ id: 'criminal', location: 'a', traits: ['Criminal'], exhausted: false }]
    assert.ok(club.actions(state, inv).some(action => action.rule === 'peterEvade'))
    let evaded = false
    club.performAction(state, inv, { rule: 'peterEvade', enemyId: 'criminal' }, { evadeEnemy: () => { evaded = true } })
    assert.equal(peter.exhausted, true)
    assert.equal(evaded, true)
    state.storyAssets = [{ code: '02079', controllerSeat: null, damage: 2 }]
    club.enemyPhaseStart(state, {})
    assert.deepEqual(state.storyAssets, [])
    assert.deepEqual(state.scenarioZones.removed, ['02079'])
  },
  '02080'() {
    const state = simpleState()
    const inv = state.investigators[0]
    const morgan = { code: '02080', exhausted: false }
    inv.assets = [morgan]
    let drawn = 0
    encounterRules.enemyDefeated(state, { defeatedBy: 0 }, { choose: () => 'trigger', drawCards: (_seat, n) => { drawn += n } })
    assert.equal(morgan.exhausted, true)
    assert.equal(drawn, 1)
    assert.equal(encounterRules.statModifier(state, inv, 'combat'), 1)
  },
  '02138'() {
    const state = simpleState()
    const inv = state.investigators[0]
    state.locations[0].traits = ['Miskatonic']
    state.skillTest = { source: { label: '调查' } }
    inv.assets = [{ code: '02138' }]
    assert.equal(laterBehavior('theMiskatonicMuseum').statModifier(state, inv, 'intellect'), 2)
    encounterRules.assetLeftPlay(state, inv, inv.assets[0])
    assert.deepEqual(state.scenarioZones.removed, ['02138'])
    assert.ok(state.campaign.chaosBag?.includes('tablet') || state.chaosBag.includes('tablet'))
  },
  '02139'() {
    const state = simpleState()
    const inv = state.investigators[0]
    state.locations[0].originalCode = '02128'
    inv.assets = [{ code: '02139' }]
    const action = laterBehavior('theMiskatonicMuseum').actions(state, inv).find(item => item.rule === 'searchSecurityOffice')
    assert.equal(action.actions, 1)
    encounterRules.assetLeftPlay(state, inv, inv.assets[0])
    assert.deepEqual(state.scenarioZones.removed, ['02139'])
  },
  '02140'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ code: '02140' }]
    const behavior = laterBehavior('theMiskatonicMuseum')
    assert.ok(behavior.actions(state, inv).some(action => action.rule === 'necronomiconResource'))
    behavior.performAction(state, inv, { rule: 'necronomiconResource' }, {})
    assert.equal(inv.resources, 7)
    state.enemies = [{ code: '02097', engagedSeat: 0 }]
    // 空无之地不能获得资源：条目仍在 actions() 里，但带 reason，因而不进 legalMoves。
    const blocked = behavior.actions(state, inv).find(action => action.rule === 'necronomiconResource')
    assert.ok(blocked?.reason, '不可执行时必须给出 reason')
    assert.ok(!legalMoves(state).some(action => action.rule === 'necronomiconResource'))
  },
  '02179'() {
    const state = simpleState(2)
    state.scenarioZones.train = ['a', 'b']
    state.investigators[0].location = 'b'
    let surged = 0
    const behavior = laterBehavior('theEssexCountyExpress')
    behavior.drawStoryAsset(state, state.investigators[0], '02179', { drawEncounter: () => surged++ })
    assert.equal(state.storyAssets[0].location, 'a')
    assert.equal(surged, 1)
    state.investigators[0].location = 'a'
    behavior.performAction(state, state.investigators[0], { rule: 'parleyPassenger', assetId: state.storyAssets[0].id }, {})
    const owned = state.investigators[0].assets[0]
    const horror = []
    behavior.assetLeftPlay(state, state.investigators[0], owned, { horror: (seat, n) => horror.push([seat, n]) })
    assert.deepEqual(horror, [[0, 1], [1, 1]])
    assert.deepEqual(state.encounterDiscard, ['02179'])
  },
  '02215'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ code: '02215' }]
    state.locations[0].connections = [L('02214')]
    state.locations.push({ id: L('02214'), connections: ['a'] })
    const behavior = laterBehavior('bloodOnTheAltar')
    behavior.performAction(state, inv, { rule: 'attachChamberKey' }, {})
    assert.equal(state.scenarioFlags.chamberUnlocked, true)
    assert.deepEqual(inv.assets, [])
    assert.deepEqual(behavior.publicAttachments(state).locations[L('02214')], ['02215'])
  },
  '02217'() {
    const state = simpleState()
    const inv = state.investigators[0]
    const zebulon = { code: '02217', exhausted: false }
    inv.assets = [zebulon]
    state.scenario.treacheries.hex = {}
    let drawn = 0
    const behavior = laterBehavior('bloodOnTheAltar')
    assert.equal(behavior.statModifier(state, inv, 'willpower'), 1)
    behavior.afterTest(state, inv, { success: true, skill: 'willpower', value: 4, difficulty: 3, drawn: [], cancelledTokens: [],
      source: { type: 'encounter', code: 'hex' } },
      { choose: () => 'yes', drawCards: (_seat, n) => { drawn += n } })
    assert.equal(zebulon.exhausted, true)
    assert.equal(drawn, 1)
  },
  '02218'() {
    const state = simpleState()
    const inv = state.investigators[0]
    const earl = { code: '02218', exhausted: false }
    inv.assets = [earl]
    let drawn = 0
    const behavior = laterBehavior('bloodOnTheAltar')
    assert.equal(behavior.statModifier(state, inv, 'agility'), 1)
    behavior.afterEvade(state, inv, {}, null, { choose: () => 'yes', drawCards: (_seat, n) => { drawn += n } })
    assert.equal(earl.exhausted, true)
    assert.equal(drawn, 1)
  },
  '02219'() {
    const state = simpleState()
    const inv = state.investigators[0]
    Object.assign(state.campaign.records, {
      professorWarrenRiceSurvivedTheDunwichLegacy: true,
      drFrancisMorganSurvivedTheDunwichLegacy: true,
      zebulonWhateleySurvivedTheDunwichLegacy: true,
      earlSawyerSurvivedTheDunwichLegacy: true,
    })
    const powder = { code: '02219' }
    encounterRules.assetEntered(state, inv, powder)
    assert.equal(powder.clues, 4)
    inv.assets = [powder]
    const brood = { id: 'brood', code: '02255', traits: ['Abomination'], location: 'a', exhausted: true, clues: 0 }
    state.enemies = [brood]
    laterBehavior('undimensionedAndUnseen').performAction(state, inv, { rule: 'powderBrood', enemyId: 'brood' }, {})
    assert.equal(powder.clues, 3)
    assert.equal(brood.clues, 1)
  },
  '02254'() {
    const state = simpleState()
    const inv = state.investigators[0]
    inv.assets = [{ code: '02254' }]
    const brood = { id: 'brood', code: '02255', traits: ['Abomination'], location: 'a', fight: 3, clues: 2 }
    state.enemies = [brood]
    let test, damage
    laterBehavior('undimensionedAndUnseen').performAction(state, inv, { rule: 'castFormula', enemyId: 'brood' }, {
      test: (seat, skill, difficulty, resolve, bonus, source) => { test = [seat, skill, difficulty, bonus(), source.code]; resolve({ success: true, damageBonus: 1 }) },
      damageEnemy: (id, amount, seat, source) => { damage = [id, amount, seat, source] },
    })
    assert.deepEqual(test, [0, 'willpower', 3, 4, '02255'])
    assert.deepEqual(damage, ['brood', 2, 0, '02254'])
  },
}

for (const code of STORY_ASSETS) test(`Dunwich ${code} 剧情支援主要效果与离场边界`, storyChecks[code])
