import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { legalMoves, validateMove, getMaxSanity } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { keyedFlashbackAbility } from '../src/cards/encounter-entries/_shared.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'

registerCardAbilities([
  { code: 'testTicEncounterActionCost', scope: 'location', abilities: [{ kind: 'action', actionKind: 'parley',
    cost: { action: 2, drawEncounter: 1 }, resolve: ({ inv, api }) => api.gainResources(inv.seat, 4) }] },
  { code: 'testTicActorFlashback', scope: 'location', abilities: [keyedFlashbackAbility({ key: 'red', flashback: 'flashback2', label: '回想过去' })] },
  { code: 'testTicGroupFlashback', scope: 'location', abilities: [keyedFlashbackAbility({ keyCount: 2, requiresNoClues: false,
    flashback: 'flashback2', label: '以全组钥匙回想过去' })] },
])
function board(code, count = 1) {
  const s = fixture('01001', count), here = s.investigators[0].location
  s.humanSeats = s.investigators.map(inv => inv.seat)
  Object.assign(s.locations.find(loc => loc.id === here), { code, originalCode: code, revealed: true, clues: 0 })
  return s
}

test('P7 encounter-card action cost: draw the actual enemy, then resolve the ability and charge two actions once', () => {
  const s = board('testTicEncounterActionCost'), inv = s.investigators[0], before = inv.resources, actions = inv.actionsLeft
  s.encounterDeck = ['ghoulMinion']; s.encounterDiscard = []
  move(s, legalMoves(s).find(m => m.action === 'entityAbility')); settle(s)
  assert.equal(s.encounterDeck.length, 0); assert.equal(s.enemies.filter(e => e.code === 'ghoulMinion').length, 1)
  assert.equal(s.enemies[0].engagedSeat, 0)
  assert.equal(s.investigators[0].resources, before + 4); assert.equal(s.investigators[0].actionsLeft, actions - 2)
})

test('P7 encounter-card cost: empty piles and insufficient actions reject before payment', () => {
  for (const reason of ['empty', 'one-action']) {
    const s = board('testTicEncounterActionCost')
    s.encounterDeck = reason === 'empty' ? [] : ['ghoulMinion']; s.encounterDiscard = []
    if (reason === 'one-action') s.investigators[0].actionsLeft = 1
    const before = JSON.stringify(s)
    assert.equal(legalMoves(s).some(m => m.action === 'entityAbility'), false)
    assert.notEqual(validateMove(s, 0, { action: 'entityAbility', entityId: s.investigators[0].location, abilityIndex: 0 }), null)
    assert.equal(JSON.stringify(s), before)
  }
})

test('P7 encounter-card cost: an actual lethal revelation cannot continue into the activation effect', () => {
  const s = board('testTicEncounterActionCost', 2), inv = s.investigators[0], before = inv.resources
  inv.horror = getMaxSanity(inv) - 1; s.encounterDeck = ['rottingRemains']; s.encounterDiscard = []; s.chaosBag = ['autofail']
  move(s, legalMoves(s).find(m => m.action === 'entityAbility')); settle(s)
  assert.equal(s.investigators[0].defeated, true)
  assert.equal(s.investigators[0].resources, before)
})

const testScenarioId = 'testTicFlashbackPrimitive'
const baseCampaign = structuredClone(contentRegistry.getCampaign('nightOfTheZealot'))
Object.assign(baseCampaign, { id: testScenarioId, scenarioIds: [testScenarioId], status: 'development', unlock: { [testScenarioId]: [] } })
delete baseCampaign.flow
const baseScenario = structuredClone(contentRegistry.getScenarioData('theGathering'))
Object.assign(baseScenario, { id: testScenarioId, campaignId: testScenarioId })
const baseManifest = structuredClone(contentRegistry.getScenario('theGathering'))
Object.assign(baseManifest, { id: testScenarioId, campaignId: testScenarioId, status: 'development', behaviorIds: [testScenarioId] })
registerContentBundle({ campaigns: [baseCampaign], scenarios: [{ scenario: baseScenario, manifest: baseManifest,
  behavior: { id: testScenarioId, resolveFlashback(state, seat, id, api) {
    assert.equal(id, 'flashback2')
    api.setScenarioFlag('primitiveFlashbackRewards', (state.scenarioFlags.primitiveFlashbackRewards || 0) + 1)
  } } }] })
function withFlashbackHandler(s, run) { s.scenario.id = testScenarioId; run() }

test('P7 keyed flashback descriptor: actor-held key, cleared clues and shared once-per-game limit use real action readers', () => {
  const s = board('testTicActorFlashback', 2), api = createMechanicsApi(s), here = s.investigators[0].location
  api.keys.initialize([{ color: 'red', holder: 'investigator:1', revealed: true }])
  assert.equal(legalMoves(s).some(m => m.entityId === here), false)
  api.keys.transfer('red', 'investigator:1', 'investigator:0')
  s.locations[0].clues = 1; assert.equal(legalMoves(s).some(m => m.entityId === here), false)
  s.locations[0].clues = 0
  withFlashbackHandler(s, () => {
    move(s, legalMoves(s).find(m => m.entityId === here)); settle(s)
    assert.equal(s.scenarioFlags.primitiveFlashbackRewards, 1)
    api.keys.transfer('red', 'investigator:0', 'investigator:1'); s.currentSeat = 1
    assert.equal(legalMoves(s, 1).some(m => m.entityId === here), false)
    const saved = JSON.parse(JSON.stringify(s))
    assert.equal(legalMoves(saved, 1).some(m => m.entityId === here), false)
  })
})

test('P7 global held-key query and flashback condition include remote living holders and exclude eliminated holders', () => {
  const s = board('testTicGroupFlashback', 3), api = createMechanicsApi(s), here = s.investigators[0].location
  s.locations.push({ id: 'groupKeyRemote', code: '01112', revealed: true, connections: [] })
  s.investigators[1].location = 'groupKeyRemote'; s.investigators[2].defeated = true
  api.keys.initialize([{ color: 'blue', holder: 'investigator:0', revealed: true }, { color: 'red', holder: 'investigator:1', revealed: true },
    { color: 'black', holder: 'investigator:2', revealed: true }])
  assert.deepEqual(api.keys.heldByGroup().sort(), ['blue', 'red'])
  assert.ok(legalMoves(s).some(m => m.entityId === here))
  s.investigators[1].resigned = true
  assert.deepEqual(api.keys.heldByGroup(), ['blue']); assert.equal(legalMoves(s).some(m => m.entityId === here), false)
  s.investigators[1].resigned = false
  withFlashbackHandler(s, () => { move(s, legalMoves(s).find(m => m.entityId === here)); settle(s); assert.equal(s.scenarioFlags.primitiveFlashbackRewards, 1) })
})

registerCardAbilities([{code:'testTicActAction',scope:'act',abilities:[{kind:'free',actionKind:'activate',range:'anywhere',cost:{groupClues:2},groupClueScope:'anywhere',resolve:({inv,api})=>api.gainResources(inv.seat,1)}]}])
test('P7 only active stage action is available anywhere; remote team pays its global clues without consuming an action',()=>{
 const s=fixture('01001',2);s.humanSeats=[0,1];s.acts=[{id:'currentTicAct',code:'testTicActAction'},{id:'futureTicAct',code:'testTicActAction'}];s.actIndex=0
 s.investigators[1].location=s.locations.find(l=>l.id!==s.investigators[0].location)?.id||'remote'
 for(const inv of s.investigators)inv.clues=1;s.clues=2
 const before=s.investigators[0].resources,actions=s.investigators[0].actionsLeft
 assert.equal(legalMoves(s).some(m=>m.entityId==='futureTicAct'),false)
 assert.notEqual(validateMove(s,0,{action:'entityAbility',entityId:'futureTicAct',abilityIndex:0}),null)
 const command=legalMoves(s).find(m=>m.entityId==='currentTicAct');assert.ok(command);move(s,command);settle(s)
 assert.deepEqual(s.investigators.map(i=>i.clues),[0,0]);assert.equal(s.investigators[0].resources,before+1);assert.equal(s.investigators[0].actionsLeft,actions)
})
