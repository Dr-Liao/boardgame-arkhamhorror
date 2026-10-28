import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createGameState, applyMove, validateMove, legalMoves, performTest, getStat, placeLocation, actionPreview, describeState, actObjectiveContext, discoverClueAt, spawnEnemy } from '../src/engine/engine.js'
import { modifierTotal } from '../src/engine/modifiers.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getAvailability, canSelectInvestigator } from '../src/deck/availability.js'
import { effects } from '../content/packs/dunwichPlayer/effects.js'
import { abilityLayerCodes } from '../content/packs/dunwichPlayer/manifest.js'
import { registeredEntry } from '../src/engine/ability.js'
import { chapterSpecs, locationId as L } from '../content/campaigns/theDunwichLegacy/chapters.js'
import { laterBehavior, summonHorror, resolveSurvivors, chooseBroodRandomLocation } from '../content/campaigns/theDunwichLegacy/later-behaviors.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { encounterRules } from '../content/campaigns/theDunwichLegacy/encounter-rules.js'
import { CHAOS_BAGS } from '../content/campaigns/theDunwichLegacy/shared.js'
import { dunwichChaosToken, dunwichChaosAfterTest } from '../content/campaigns/theDunwichLegacy/dunwich-chaos.js'
import { cardRuleIds, ruleById } from '../web/rulebook-data.js'
import { viewState } from '../src/integration/observation.js'
import { availablePurchases, campaignCardChange, purchaseCard, replacementOptions, settleExiledCards } from '../src/campaign/campaign.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import * as university from '../content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/index.js'
import * as club from '../content/campaigns/theDunwichLegacy/scenarios/theHouseAlwaysWins/index.js'

const clone = s => JSON.parse(JSON.stringify(s))
function move(s, m) { const seat = s.pendingChoice?.seat ?? s.currentSeat; assert.equal(validateMove(s, seat, m), null); applyMove(s, seat, m) }
function settle(s, choose = () => null) {
  for (let n = 0; s.pendingChoice; n++) {
    assert.ok(n < 100, 'choice loop')
    const p = s.pendingChoice
    const id = choose(p) || p.options.find(o => ['done', 'skip'].includes(o.id))?.id || p.options[0].id
    move(s, { action: 'choose', choiceId: p.id, optionId: id })
  }
}
function fixture(count = 1) {
  const s = createGameState({ seed: 'd2-card', playerInvestigator: '01001' }, Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(s)
  for (const inv of s.investigators) { inv.actionsLeft = 20; inv.hand = []; inv.assets = []; inv.threat = []; inv.deck = Array(30).fill('01088'); inv.resources = 20 }
  s.chaosBag = ['0']; s.enemies = []; s.acts[0].objective = null
  return s
}
const trialIds = {}
registerContentBundle({ packs: [{ ...contentRegistry.getPack('dunwichCampaign'), id: 'dunwichRulesTestPack', status: 'playable' }] })
for (const id of Object.keys(chapterSpecs)) {
  const scenarioId = `${id}RulesTest`, campaignId = `${id}CampaignTest`
  const production = contentRegistry.getBehavior(id)
  trialIds[id] = campaignId
  registerContentBundle({
    campaigns: [{ ...contentRegistry.getCampaign('nightOfTheZealot'), id: campaignId, chaosBags: CHAOS_BAGS,
      scenarioIds: [scenarioId], unlock: { [scenarioId]: [] }, requiredPackIds: ['core', 'dunwichRulesTestPack'],
      flow: { start: scenarioId, nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } } } }],
    scenarios: [{ scenario: { ...contentRegistry.getScenarioData(id), id: scenarioId },
      behavior: { ...production, id: scenarioId,
        actions(state, inv) { return [...production.actions(state, inv), ...['d9Encounter', 'd9EnemyMove', 'd9Agenda', 'd9Damage', 'd9RemoveLocation'].map(rule => ({ action: 'scenarioAction', rule, actions: 0, label: '隔离测试入口' }))] },
        performAction(state, inv, move, api) {
          if (move.rule === 'd9Encounter') return api.drawEncounter(inv.seat)
          if (move.rule === 'd9EnemyMove') return api.moveEnemy(state.enemies.find(enemy => enemy.id === move.enemyId), move.destination)
          if (move.rule === 'd9Agenda') return api.advanceAgenda()
          if (move.rule === 'd9Damage') return api.damage(inv.seat, move.amount)
          if (move.rule === 'd9RemoveLocation') return api.remove(move.locationId)
          return production.performAction(state, inv, move, api)
        } },
      manifest: { ...contentRegistry.getScenario(id), id: scenarioId, campaignId, status: 'playable', requiredMechanicIds: [],
        requiredPackIds: ['core', 'dunwichRulesTestPack'], behaviorIds: [scenarioId] } }],
  })
}
function chapterFixture(id, seed = 'd2-scenario') {
  const s = createGameState({ campaignId: trialIds[id], seed, playerInvestigator: '01001' }, [{ seat: 0 }, { seat: 1 }])
  settle(s); return s
}

const universityTrial = 'extracurricularActivityRulesTest'
const universityCampaign = 'extracurricularActivityCampaignTest'
registerContentBundle({
  campaigns: [{ ...contentRegistry.getCampaign('theDunwichLegacy'), id: universityCampaign,
    status: 'playable', scenarioIds: [universityTrial], unlock: { [universityTrial]: [] }, requiredPackIds: ['core', 'dunwichRulesTestPack'],
    flow: { start: universityTrial, nodes: { [universityTrial]: { type: 'scenario', scenarioId: universityTrial, next: 'end' }, end: { type: 'end' } } } }],
  scenarios: [{ scenario: { ...university.scenario, id: universityTrial },
    behavior: { ...university.behavior, id: universityTrial },
    manifest: { ...university.manifest, id: universityTrial, campaignId: universityCampaign,
      status: 'playable', requiredMechanicIds: [], requiredEncounterGroupIds: [],
      requiredPackIds: ['core', 'dunwichRulesTestPack'], behaviorIds: [universityTrial] } }],
})
function universityFixture(seed = 'd3-university') {
  const s = createGameState({ campaignId: universityCampaign, seed, playerInvestigator: '01001' }, [{ seat: 0 }])
  settle(s)
  s.chaosBag = ['0']
  s.investigators[0].actionsLeft = 12
  return s
}

test('D6 University: Humanities and Administration mill at turn end; Orne Library costs two actions', () => {
  for (const [location, horror, expected] of [['humanitiesBuilding', 2, 2], ['administrationBuilding', 0, 1]]) {
    const s = createGameState({ campaignId: universityCampaign, seed: `d6-${location}`, playerInvestigator: '01001' }, [{ seat: 0 }, { seat: 1 }])
    settle(s)
    const inv = s.investigators[0]
    inv.location = location; inv.horror = horror; inv.deck = Array(20).fill('01088'); inv.discard = []
    s.enemies = []
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].discard.filter(code => code === '01088').length, expected)
  }
  const s = universityFixture('d6-library'), inv = s.investigators[0]
  inv.location = 'orneLibrary'; inv.actionsLeft = 3; inv.intellect = 10
  s.locations.find(loc => loc.id === 'orneLibrary').clues = 2
  move(s, { action: 'investigate' }); settle(s)
  assert.equal(s.investigators[0].actionsLeft, 1)
})

test('D6 University: alchemy investigation finds the concoction, then its intellect attack defeats the Experiment', () => {
  const s = universityFixture('d6-alchemy'), inv = s.investigators[0]
  s.locations.push({ ...structuredClone(s.scenario.locations.alchemyLabs), id: 'alchemyLabs', revealed: true, clues: 0 })
  inv.location = 'alchemyLabs'; inv.intellect = 10
  s.scenarioZones.underLocations = { alchemyLabs: '02059' }
  move(s, { action: 'scenarioAction', rule: 'searchConcoction' }); settle(s)
  assert.ok(s.investigators[0].assets.some(asset => asset.code === '02059'))
  const enemy = { id: 'experiment-test', code: '02058', name: '实验体', location: 'alchemyLabs',
    fight: 3, evade: 2, health: 7, damageTaken: 0, traits: ['Monster'], massive: true, exhausted: false }
  s.enemies.push(enemy)
  move(s, { action: 'scenarioAction', rule: 'concoctionAttack', enemyId: enemy.id }); settle(s)
  assert.ok(s.victoryDisplay.some(card => card.code === '02058'))
  assert.ok(!s.investigators[0].assets.some(asset => asset.code === '02059'))
})

test('D6 University: 冷漠敌人未交战时，炼金试剂攻击不列出、提交被拒绝', () => {
  const s = universityFixture('d6-alchemy-aloof'), inv = s.investigators[0]
  s.locations.push({ ...structuredClone(s.scenario.locations.alchemyLabs), id: 'alchemyLabs', revealed: true, clues: 0 })
  inv.location = 'alchemyLabs'; inv.intellect = 10
  s.scenarioZones.underLocations = { alchemyLabs: '02059' }
  move(s, { action: 'scenarioAction', rule: 'searchConcoction' }); settle(s)
  const hero = s.investigators[0]
  assert.ok(hero.assets.some(asset => asset.code === '02059'), '先取得炼金试剂')
  const whippoorwill = { id: 'whippoorwill-test', code: '02090', name: '夜鹰', location: 'alchemyLabs',
    fight: 2, evade: 4, health: 1, damageTaken: 0, damage: 0, horror: 1, traits: ['Creature'],
    aloof: true, printedAloof: true, engagedSeat: null, exhausted: false }
  s.enemies = [whippoorwill]
  // 未交战：剧本自己的攻击行动也不能绕过冷漠——列表里没有它，伪造提交被拒绝。
  assert.ok(!legalMoves(s).some(item => item.rule === 'concoctionAttack' && item.enemyId === whippoorwill.id),
    '未交战的冷漠敌人不能成为炼金试剂攻击目标')
  assert.match(validateMove(s, s.currentSeat, { action: 'scenarioAction', rule: 'concoctionAttack', enemyId: whippoorwill.id }) ?? '',
    /冷漠|目标/)
  // 主动交战之后重新可用（冷漠只禁止未交战时的直接攻击）。
  whippoorwill.engagedSeat = 0; hero.engaged.push(whippoorwill.id)
  assert.ok(legalMoves(s).some(item => item.rule === 'concoctionAttack' && item.enemyId === whippoorwill.id))
})

test('D6 University: a second-opening save recovers a missing concoction marker exactly once', () => {
  const s = universityFixture('d6-alchemy-recovery'), inv = s.investigators[0]
  s.campaign.scenarioResults.push({ scenarioId: 'theHouseAlwaysWins', resolution: 'r1' })
  s.actIndex = 2
  s.locations.push({ ...structuredClone(s.scenario.locations.alchemyLabs), id: 'alchemyLabs', revealed: true, clues: 0 })
  inv.location = 'alchemyLabs'; inv.intellect = 10
  s.scenarioZones.underLocations = {}
  move(s, { action: 'scenarioAction', rule: 'searchConcoction' }); settle(s)
  assert.equal(s.investigators[0].assets.filter(asset => asset.code === '02059').length, 1)
  assert.match(s.log.at(-1), /取得了「炼金试剂」/)

  s.investigators[0].actionsLeft = 1
  move(s, { action: 'scenarioAction', rule: 'searchConcoction' }); settle(s)
  assert.equal(s.investigators[0].assets.filter(asset => asset.code === '02059').length, 1)
  assert.ok(s.log.some(line => /没有可取得的炼金试剂/.test(line)))
})

const clubTrial = 'theHouseAlwaysWinsRulesTest'
const clubCampaign = 'theHouseAlwaysWinsCampaignTest'
registerContentBundle({
  campaigns: [{ ...contentRegistry.getCampaign('theDunwichLegacy'), id: clubCampaign,
    status: 'playable', scenarioIds: [clubTrial], unlock: { [clubTrial]: [] }, requiredPackIds: ['core', 'dunwichRulesTestPack'],
    flow: { start: clubTrial, nodes: { [clubTrial]: { type: 'scenario', scenarioId: clubTrial, next: 'end' }, end: { type: 'end' } } } }],
  scenarios: [{ scenario: { ...club.scenario, id: clubTrial }, behavior: { ...club.behavior, id: clubTrial },
    manifest: { ...club.manifest, id: clubTrial, campaignId: clubCampaign, status: 'playable',
      requiredMechanicIds: [], requiredEncounterGroupIds: [], requiredPackIds: ['core', 'dunwichRulesTestPack'],
      behaviorIds: [clubTrial] } }],
})
function clubFixture(seed = 'd4-club') {
  const s = createGameState({ campaignId: clubCampaign, seed, playerInvestigator: '01001' }, [{ seat: 0 }])
  settle(s); s.chaosBag = ['0']; s.investigators[0].actionsLeft = 20; return s
}

test('D6 Club: gaining clues at the Pit Boss location readies, engages and attacks', () => {
  const s = clubFixture('d6-boss'), inv = s.investigators[0]
  inv.location = 'cloverClubLounge'; inv.intellect = 10
  s.locations.find(loc => loc.id === 'cloverClubLounge').clues = 2
  s.enemies[0].exhausted = true
  move(s, { action: 'investigate' }); settle(s)
  assert.equal(s.enemies[0].exhausted, false)
  assert.equal(s.enemies[0].engagedSeat, 0)
  assert.ok(s.investigators[0].damage + s.investigators[0].horror > 0)
})

test('D6 Club: VIP Area denies upkeep card and resource income', () => {
  const s = clubFixture('d6-vip'), inv = s.investigators[0]
  s.locations.push({ ...structuredClone(s.scenario.locations.vipArea), id: 'vipArea', revealed: true, clues: 0 })
  inv.location = 'vipArea'; inv.deck = Array(20).fill('01088'); inv.hand = []; inv.resources = 5
  s.enemies = []; s.encounterDeck = [Object.keys(s.scenario.enemies)[0]]
  move(s, { action: 'endTurn' }); settle(s)
  assert.equal(s.investigators[0].resources, 5)
  assert.equal(s.investigators[0].hand.length, 0)
})

test('D4 Club: opening clues open the hall, revealing it places the three side locations', () => {
  const s = clubFixture()
  assert.equal(s.acts[0].objective.perInvestigator, 4)
  s.investigators[0].clues = 4
  move(s, { action: 'advanceAct' }); settle(s)
  assert.equal(s.actIndex, 1)
  assert.ok(s.locations.some(loc => loc.id === 'darkenedHall'))
  assert.equal(s.investigators[0].clues, 0)
  s.investigators[0].location = 'cloverClubCardroom'
  move(s, { action: 'move', locationId: 'darkenedHall' }); settle(s)
  for (const id of ['artGallery', 'vipArea', 'backAlley']) assert.ok(s.locations.some(loc => loc.id === id))
})

test('D4 Club: VIP objective branches to Morgan; parley and resign rescue him', () => {
  const s = clubFixture('d4-morgan')
  s.investigators[0].clues = 4
  move(s, { action: 'advanceAct' }); settle(s)
  s.investigators[0].location = 'cloverClubCardroom'
  move(s, { action: 'move', locationId: 'darkenedHall' }); settle(s)
  move(s, { action: 'move', locationId: 'vipArea' }); settle(s)
  s.investigators[0].clues = 2
  move(s, { action: 'advanceAct' }); settle(s)
  assert.equal(s.acts[s.actIndex].originalCode, '02068')
  assert.ok(s.storyAssets.some(asset => asset.code === '02080'))
  assert.equal(legalMoves(s).find(m => m.rule === 'parleyGuest')?.scriptCard, 'act')
  move(s, { action: 'scenarioAction', rule: 'parleyGuest' }); settle(s)
  assert.ok(s.investigators[0].assets.some(asset => asset.code === '02080'))
  move(s, { action: 'move', locationId: 'darkenedHall' }); settle(s)
  move(s, { action: 'move', locationId: 'backAlley' }); settle(s)
  move(s, { action: 'resign' }); settle(s)
  assert.equal(s.campaign.records.theInvestigatorsRescuedDrFrancisMorgan, true)
})

test('D4 Club: bar and even-token gambling produce clues and record the drink', () => {
  const s = clubFixture('d4-gambling')
  s.investigators[0].location = 'cloverClubBar'; s.investigators[0].resources = 10
  move(s, { action: 'scenarioAction', rule: 'buyDrink' }); settle(s)
  assert.equal(s.investigators[0].clues, 2)
  assert.equal(s.investigators[0].resources, 8)
  s.investigators[0].location = 'cloverClubCardroom'
  const gamble = legalMoves(s).find(m => m.action === 'scenarioAction' && m.rule === 'gamble')
  assert.equal(gamble.locationId, 'cloverClubCardroom')
  move(s, gamble); settle(s)
  assert.equal(s.actIndex, 1)
  assert.equal(s.scenarioFlags.barUsed, true)
  assert.equal(s.scenarioFlags.cheated.length, 0)
})

test('D5 Club: the cheat reaction states its permanent elder-thing cost before choosing', () => {
  const s = clubFixture('d5-cheat-cost')
  s.chaosBag = ['0', '-2']
  const execute = state => performTest(state, 0, 'intellect', 1)
  resolveTransaction(s, 0, { action: 'clubTest' }, execute)
  // 先过技能投入窗口，停在「是否作弊」这个反应上。
  while (s.pendingChoice && s.pendingChoice.source !== 'clubCheat') {
    const p = s.pendingChoice
    const id = p.options.find(option => ['done', 'skip'].includes(option.id))?.id || p.options[0].id
    resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId: id }, execute)
  }
  const choice = s.pendingChoice
  assert.equal(choice?.source, 'clubCheat')
  assert.match(choice.prompt, /永久加入 1 个古神标记/)
  assert.match(choice.options.find(option => option.id === 'trigger').label, /永久 \+1 古神标记/)
  // AI 的决策提示同时给出待决选择与合法选项，代价必须在两处都看得到。
  const described = describeState(s, 0)
  assert.match(described, /作弊：改为袋中另一标记的正面/)
  assert.match(described, /永久 \+1 古神标记/)
})

test('D5 Club: cheating changes one token face per round and adds elder thing on resolution', () => {
  const s = clubFixture('d5-cheat')
  s.chaosBag = ['0', '-2']
  const execute = state => performTest(state, 0, 'intellect', 1, { resolve: result => { state.testResult = result } })
  let face = null
  const run = () => {
    resolveTransaction(s, 0, { action: 'clubTest' }, execute)
    while (s.pendingChoice) {
      const p = s.pendingChoice
      if (p.source === 'clubCheatFace') face = p.options[0].id
      const id = p.source === 'clubCheat' ? 'trigger' : p.source === 'clubCheatFace' ? face
        : p.options.find(option => ['done', 'skip'].includes(option.id))?.id || p.options[0].id
      resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId: id }, execute)
    }
  }
  run()
  assert.deepEqual(s.testResult.drawn, [face])
  assert.deepEqual(s.scenarioFlags.cheated, [0])
  assert.equal(s.scenarioFlags.cheatedRound, s.round)
  s.chaosBag = ['0']
  run()
  assert.deepEqual(s.testResult.drawn, ['0'])
  move(s, { action: 'resign' }); settle(s)
  assert.ok(s.campaign.chaosBag.includes('elderthing'))
})

test('D5 Club: elder sign gambling returns resources as well as clues', () => {
  const s = clubFixture('d5-sign')
  s.chaosBag = ['eldersign']; s.investigators[0].location = 'cloverClubCardroom'
  s.investigators[0].resources = 4
  move(s, { action: 'scenarioAction', rule: 'gamble' }); settle(s)
  assert.equal(s.investigators[0].resources, 4)
  assert.equal(s.investigators[0].clues, 2)
})

test('D3 University: paying opening clues shuffles Jazz into encounters; search and parley advance with the same asset', () => {
  const s = universityFixture()
  assert.equal(s.acts[0].objective.perInvestigator, 3)
  s.investigators[0].clues = 3
  move(s, { action: 'advanceAct' }); settle(s)
  assert.equal(s.actIndex, 1)
  assert.equal(s.investigators[0].clues, 0)
  assert.equal(s.encounterDeck.filter(code => code === '02060').length, 1)
  const jazzHint = () => viewState(s, 0).scriptActions.find(hint => hint.rule === 'searchJazz')
  assert.equal(jazzHint().reason, '需要花费 1 个线索')
  s.investigators[0].clues = 1
  s.encounterDeck = ['02060']
  assert.equal(jazzHint().reason, null)
  assert.equal(legalMoves(s).find(m => m.rule === 'searchJazz')?.scriptCard, 'act')
  move(s, { action: 'scenarioAction', rule: 'searchJazz' }); settle(s)
  assert.equal(s.investigators[0].clues, 0)
  assert.equal(s.storyAssets.filter(asset => asset.code === '02060').length, 1)
  const assetId = s.storyAssets[0].id
  move(s, { action: 'scenarioAction', rule: 'parleyJazz' }); settle(s)
  assert.equal(s.actIndex, 2)
  assert.ok(s.investigators[0].assets.some(asset => asset.id === assetId))
  assert.ok(s.locations.some(loc => loc.id === 'alchemyLabs'))
  assert.ok(s.enemies.some(enemy => enemy.code === '02058' && enemy.location === 'alchemyLabs'))
})

test('D3 University: first agenda applies discard horror and late arrival skips the second agenda', () => {
  const s = universityFixture('d3-university-agenda')
  s.investigators[0].discard = Array(10).fill('01088')
  s.campaign.scenarioResults.push({ scenarioId: 'theHouseAlwaysWins', resolution: 'r1' })
  s.doom = s.agendas[0].doomThreshold
  move(s, { action: 'endTurn' }); settle(s)
  assert.equal(s.investigators[0].horror, 2)
  assert.equal(s.agendas[s.agendaIndex].originalCode, '02044')
  // "Advance directly to 2b": agenda 2 is flipped, not removed from the deck.
  assert.ok(s.agendas.some(agenda => agenda.originalCode === '02043'))
  assert.ok(s.locations.some(loc => loc.id === 'dormitories'))
})

test('D3 University: final agenda turns doom into one step toward the dormitories', () => {
  const s = universityFixture('d3-university-beast')
  s.agendaIndex = 2
  s.locations.push({ ...s.scenario.locations.dormitories, revealed: true, clues: 0 })
  const experiment = { code: '02058', location: 'scienceBuilding' }
  s.enemies = [experiment]
  s.doom = s.agendas[2].doomThreshold
  const clearDoom = () => { s.doom = 0; for (const enemy of s.enemies) enemy.doom = 0 }
  assert.equal(university.behavior.agendaWouldAdvance(s, { clearDoom, advanceAgenda() { assert.fail('not at dormitories yet') } }), true)
  assert.equal(experiment.location, 'miskatonicQuad')
  assert.equal(s.doom, 0)
  s.doom = s.agendas[2].doomThreshold
  university.behavior.agendaWouldAdvance(s, { clearDoom, advanceAgenda() { assert.fail('not at dormitories yet') } })
  assert.equal(experiment.location, 'studentUnion')
  s.doom = s.agendas[2].doomThreshold
  let objective = 0
  university.behavior.agendaWouldAdvance(s, { clearDoom, advanceAgenda() { objective++ } })
  assert.equal(experiment.location, 'dormitories')
  assert.equal(objective, 1)
})

test('D3 University: revealing the student union opens the dormitories and its clue objective rescues the students', () => {
  const s = universityFixture('d3-university-students')
  move(s, { action: 'move', locationId: 'studentUnion' }); settle(s)
  assert.ok(s.locations.some(location => location.id === 'dormitories'))
  move(s, { action: 'move', locationId: 'dormitories' }); settle(s)
  s.investigators[0].clues = 3
  assert.ok(legalMoves(s).some(action => action.rule === 'rescueStudents'))
  move(s, { action: 'scenarioAction', rule: 'rescueStudents' }); settle(s)
  assert.equal(s.campaign.records.theStudentsWereRescued, true)
  assert.equal(s.investigators[0].clues, 0)
})

for (const id of Object.keys(chapterSpecs)) test(`D2 ${id}: production setup is deterministic, conserves cards and does not mutate registered data`, () => {
  const before = clone(contentRegistry.getScenarioData(id))
  const a = chapterFixture(id), b = chapterFixture(id)
  assert.deepEqual(clone(a), clone(b))
  assert.deepEqual(clone(contentRegistry.getScenarioData(id)), before)
  assert.ok(a.locations.some(l => l.id === a.investigators[0].location))
  assert.ok(a.acts.length >= 2 && a.agendas.length >= 2)
  assert.ok(a.encounterDeck.length > 0)
  assert.ok(!JSON.stringify(viewState(a, 0)).includes('underLocations'))
  assert.ok(!Object.hasOwn(viewState(a, 0), 'scenarioZones'))
  scenarioZoneReport(before, contentRegistry.getScenario(id))
  assert.equal(contentRegistry.getScenario(id).status, 'playable')
})

test('D2 Museum: restricted hall is in bottom three; a paid exhibit action survives choice replay', () => {
  const s = chapterFixture('theMiskatonicMuseum')
  assert.equal(s.scenarioZones.exhibits.length, 6)
  assert.ok(s.scenarioZones.exhibits.indexOf('02137') < 3)
  s.actIndex = 1
  for (const inv of s.investigators) { inv.location = L('02127'); inv.clues = 1 }
  s.currentSeat = 0
  const count = s.locations.length
  move(s, { action: 'scenarioAction', rule: 'openExhibit' })
  const saved = clone(s); settle(s); settle(saved)
  assert.deepEqual(clone(s), clone(saved))
  assert.equal(s.locations.length, count + 1)
  assert.equal(s.scenarioZones.exhibits.length, 5)
  assert.deepEqual(s.investigators.map(i => i.clues), [0, 0])
  assert.equal(s.investigators[0].actionsLeft, 2)
})

test('D2 Museum: act 2 targets the Restricted Hall and the AI sees Exhibit Hall subtitles plus entry costs', () => {
  const s = chapterFixture('theMiskatonicMuseum')
  assert.deepEqual(s.acts[1].objective, { type: 'enterLocation', location: L('02137'), scenarioAdvance: true })
  s.actIndex = 1
  placeLocation(s, L('02132'), [])
  const exhibit = s.locations.find(loc => loc.id === L('02132'))
  const hub = s.locations.find(loc => loc.id === L('02127'))
  if (!hub.connections.includes(L('02132'))) hub.connections.push(L('02132'))
  const inv = s.investigators[0]
  inv.location = L('02127'); inv.actionsLeft = 3
  s.currentSeat = 0
  const hiddenMove = legalMoves(s, 0).find(item => item.action === 'move' && item.locationId === L('02132'))
  assert.ok(hiddenMove)
  assert.ok(!hiddenMove.label.includes('进入后'), '未揭示的展厅不能泄露背面强制效果')
  assert.ok(!hiddenMove.label.includes('阿萨帕斯卡尔展区'), '未揭示的展厅不能泄露副标题')
  exhibit.revealed = true; exhibit.clues = 0
  const data = JSON.parse(aiDecisionContext(s, 0).split('\n')[2])
  assert.equal(data.locations.find(loc => loc.id === L('02132')).subname, '阿萨帕斯卡尔展区')
  assert.deepEqual(data.actObjective, {
    type: 'enterLocation', locationId: L('02137'), locationName: '展厅（禁止入内）', onMap: false,
    instruction: '进入「展厅（禁止入内）」推进场景；该地点尚未入场，需先探索或翻开。',
  })
  assert.match(describeState(s, 0), /展厅（阿萨帕斯卡尔展区）/)
  const move = legalMoves(s, 0).find(item => item.action === 'move' && item.locationId === L('02132'))
  assert.ok(move)
  assert.match(move.label, /移动到「展厅（阿萨帕斯卡尔展区）」/)
  assert.match(move.label, /进入后：失去所有剩余行动并立即结束回合/)
  assert.equal(actionPreview(s, 0, move).entryNotice, '失去所有剩余行动并立即结束回合')
  assert.equal(actObjectiveContext(s).onMap, false)
  placeLocation(s, L('02137'), [])
  assert.equal(actObjectiveContext(s).onMap, true)
})

test('D2 Museum: entering the Restricted Hall advances act 2 exactly once', () => {
  const s = chapterFixture('theMiskatonicMuseum')
  s.actIndex = 1
  placeLocation(s, L('02137'), [])
  const hall = s.locations.find(loc => loc.id === L('02137'))
  hall.revealed = false; hall.clues = 0; hall.maxClues = 2 * s.numInvestigators
  const hub = s.locations.find(loc => loc.id === L('02127'))
  if (!hub.connections.includes(L('02137'))) hub.connections.push(L('02137'))
  const inv = s.investigators[0]
  inv.location = L('02127'); inv.actionsLeft = 3
  s.currentSeat = 0
  move(s, { action: 'move', locationId: L('02137') })
  settle(s)
  assert.equal(s.actIndex, 2)
  assert.equal(s.locations.find(loc => loc.id === L('02137')).clues, 2 * s.numInvestigators)
})

test('D2 Hunting Horror returns from the void with growing stats and becomes massive after third return', () => {
  const s = chapterFixture('theMiskatonicMuseum'), behavior = laterBehavior('theMiskatonicMuseum')
  const api = { spawn(code, location) { const enemy = { code, location, fight: 2, evade: 2, health: 3 }; s.enemies.push(enemy); return enemy } }
  for (let n = 0; n <= 3; n++) {
    const enemy = summonHorror(s, L('02127'), api)
    assert.equal(enemy.health, 3 + n); assert.equal(enemy.shadowResources, n); assert.equal(enemy.massive, n >= 3)
    assert.ok(!s.encounterDeck.includes('02141'))
    assert.equal(behavior.enemyDefeated(s, enemy), true)
    s.enemies = []
  }
})

test('D2 Train: six distinct cars and one engine form a line; doom removes 1,1,2,2 cars and defeats occupants', () => {
  const s = chapterFixture('theEssexCountyExpress'), b = laterBehavior('theEssexCountyExpress')
  assert.equal(s.locations.length, 7)
  assert.equal(new Set(s.locations.map(l => l.originalCode)).size, 7)
  assert.equal(s.chaosBag.filter(t => t === '-3').length, 2)
  assert.equal(s.locations[0].connections.length, 1)
  const lost = []
  const api = { devourLocation: id => { lost.push(id); for (const inv of s.investigators.filter(i => i.location === id)) inv.defeated = true } }
  for (const code of ['02160', '02161', '02162', '02163']) b.agendaReveal(s, { originalCode: code }, api)
  assert.equal(lost.length, 6); assert.equal(s.scenarioZones.train.length, 1)
  assert.ok(s.investigators.every(i => i.defeated))
})

test('D2 Altar: five sealed locations contain exactly the key, chamber and three removed encounter cards', () => {
  const s = chapterFixture('bloodOnTheAltar')
  const under = Object.values(s.scenarioZones.underLocations)
  assert.equal(s.locations.length, 6); assert.equal(under.length, 5)
  assert.equal(under.filter(c => c === '02214').length, 1); assert.equal(under.filter(c => c === '02215').length, 1)
  assert.equal(s.encounterDeck.length, 26)
  assert.deepEqual([...s.scenarioZones.sacrifices].sort(), ['02217', '02218'])
  const api = { random: () => 0 }
  s.scenarioZones.sacrifices = ['02040', '02061', '02080', '02217', '02218']
  const b = laterBehavior('bloodOnTheAltar')
  b.agendaReveal(s, { originalCode: '02196' }, api)
  b.agendaReveal(s, { originalCode: '02197' }, api)
  assert.equal(s.scenarioZones.sacrificed.length, 2)
  assert.equal(b.resolution(s, 'noResolution', [], api).bonus, 2)
  assert.equal(s.campaign.records.sacrificedToYogSothoth.length, 5)
  assert.ok(s.campaign.records.sacrificedToYogSothoth.every(code => ALL_CARDS[code]?.unique))
})

test('D6 Altar: revealing the chamber and key allows attaching the key and entering', () => {
  const s = chapterFixture('bloodOnTheAltar')
  const sites = s.locations.filter(loc => loc.id !== L('02201'))
  s.scenarioZones.underLocations[sites[0].id] = '02214'
  s.scenarioZones.underLocations[sites[1].id] = '02215'
  s.investigators[0].location = sites[0].id; sites[0].clues = 0
  move(s, { action: 'scenarioAction', rule: 'searchUnderLocation' }); settle(s)
  assert.ok(s.locations.some(loc => loc.id === L('02214')))
  assert.ok(s.locations.find(loc => loc.id === sites[0].id).connections.includes(L('02214')))
  assert.equal(laterBehavior('bloodOnTheAltar').investigatorEntryError(s, s.locations.find(loc => loc.id === L('02214'))), '密室尚未用钥匙打开')
  s.investigators[0].location = sites[1].id; sites[1].clues = 0
  move(s, { action: 'scenarioAction', rule: 'searchUnderLocation' }); settle(s)
  assert.ok(s.investigators[0].assets.some(asset => asset.code === '02215'))
  s.investigators[0].location = sites[0].id
  move(s, { action: 'scenarioAction', rule: 'attachChamberKey' }); settle(s)
  assert.equal(s.scenarioFlags.chamberUnlocked, true)
  assert.equal(laterBehavior('bloodOnTheAltar').investigatorEntryError(s, s.locations.find(loc => loc.id === L('02214'))), null)
})

test('D6 Brood: village marks a distant brood and clue totals stay synchronized', () => {
  const s = chapterFixture('undimensionedAndUnseen')
  const inv = s.investigators[0], village = s.locations[0], enemy = s.enemies.find(item => item.code === '02255')
  village.originalCode = '02242'; inv.location = village.id; inv.clues = 2; s.clues = 2
  assert.notEqual(enemy.location, inv.location)
  assert.ok(legalMoves(s).some(action => action.rule === 'markBrood' && action.enemyId === enemy.id))
  move(s, { action: 'scenarioAction', rule: 'markBrood', enemyId: enemy.id, amount: 1 }); settle(s)
  assert.equal(s.enemies.find(item => item.id === enemy.id).clues, 1)
  assert.equal(s.investigators[0].clues, 1); assert.equal(s.clues, 1)
})

test('D6 chaos references: all eight scenarios use difficulty-specific modifiers', () => {
  const cases = [
    ['extracurricularActivity', 'skull', [-1, -1, -2, -2]],
    ['theHouseAlwaysWins', 'skull', [-2, -2, -3, -3]],
    ['theMiskatonicMuseum', 'skull', [-1, -1, -2, -2]],
    ['theEssexCountyExpress', 'skull', [-1, -1, -2, -2]],
    ['bloodOnTheAltar', 'cultist', [-2, -2, -4, -4]],
    ['undimensionedAndUnseen', 'elderthing', [-3, -3, -5, -5]],
    ['whereDoomAwaits', 'skull', [-1, -1, -2, -2]],
    ['lostInTimeAndSpace', 'tablet', [-3, -3, -5, -5]],
  ]
  const inv = { seat: 0, location: 'here', resources: 0, deck: [], discard: [] }
  const api = { choose: () => 'keep', discardTop: () => {} }
  for (const [scenario, token, expected] of cases) for (const [index, difficulty] of ['easy', 'standard', 'hard', 'expert'].entries()) {
    const state = { difficulty, agendaIndex: 0, locations: [{ id: 'here', originalCode: '02201', traits: [], shroud: 2 }],
      enemies: [], scenarioZones: { underLocations: {} } }
    assert.equal(dunwichChaosToken(scenario, state, inv, token, api).delta, expected[index], `${scenario}/${difficulty}/${token}`)
  }
  assert.equal(dunwichChaosToken('whereDoomAwaits',
    { difficulty: 'hard', agendaIndex: 0, locations: [{ id: 'here', traits: [] }] }, inv, 'cultist', api).cancelCommitted, true)
  let attacks = 0
  dunwichChaosToken('undimensionedAndUnseen',
    { difficulty: 'standard', locations: [{ id: 'here' }], enemies: [{ code: '02255', location: 'here' }],
      skillTest: { source: { label: '攻击', code: '02255' } } }, inv, 'elderthing',
    { attack: () => { attacks++ } })
  assert.equal(attacks, 1)
})

test('D6 Train chaos tablet targets the nearest Cultist; elder thing discards chosen hand cards', () => {
  const state = { difficulty: 'standard', locations: [
    { id: 'a', connections: ['b'] }, { id: 'b', connections: ['a', 'c'] }, { id: 'c', connections: ['b'] }],
  enemies: [{ id: 'near', name: '近处', location: 'b', traits: ['Cultist'], doom: 0 },
    { id: 'far', name: '远处', location: 'c', traits: ['Cultist'], doom: 0 }] }
  const inv = { seat: 0, location: 'a', hand: ['01088', '01089'], discard: [] }
  const api = { choose: () => '1' }
  dunwichChaosToken('theEssexCountyExpress', state, inv, 'tablet', api)
  assert.equal(state.enemies[0].doom, 1); assert.equal(state.enemies[1].doom, 0)
  dunwichChaosAfterTest('theEssexCountyExpress', state, inv,
    { success: false, drawn: ['elderthing'], cancelledTokens: [], difficulty: 4, value: 0 }, api)
  assert.deepEqual(inv.hand, ['01088']); assert.ok(inv.discard.includes('01089'))
})

test('D6 Train: parlor clues cost resources and passenger entry enforces its printed harm', () => {
  const s = chapterFixture('theEssexCountyExpress'), inv = s.investigators[0], loc = s.locations[0]
  loc.originalCode = '02174'; loc.clues = 2; inv.location = loc.id; inv.resources = 3
  assert.ok(legalMoves(s).some(action => action.rule === 'parlorClue'))
  assert.ok(!legalMoves(s).some(action => action.action === 'investigate'))
  move(s, { action: 'scenarioAction', rule: 'parlorClue' }); settle(s)
  assert.equal(s.investigators[0].resources, 0)
  assert.equal(s.investigators[0].clues, 1)
  const before = s.investigators[0].damage
  // 第 68 轮：旅客车厢规则已条目化；这里直接验证条目 effect（引擎会在进入时派发）。
  registeredEntry('02167').locationRule.onEnter.effect(s, { originalCode: '02167' },
    { choose: () => 'harm', damage: (seat, amount) => { s.investigators[seat].damage += amount } }, s.investigators[0])
  assert.equal(s.investigators[0].damage, before + 2)
})

test('D6 Museum security office searches once per investigator turn', () => {
  const s = chapterFixture('theMiskatonicMuseum'), inv = s.investigators[0], loc = s.locations[0]
  loc.originalCode = '02128'; inv.location = loc.id; inv.actionsLeft = 3
  inv.deck = ['01088', '01089', '01090', '01091', '01092', '01093']
  const handBefore = inv.hand.length
  assert.ok(legalMoves(s).some(action => action.rule === 'searchSecurityOffice' && action.actions === 2))
  move(s, { action: 'scenarioAction', rule: 'searchSecurityOffice' }); settle(s)
  assert.equal(s.investigators[0].hand.length, handBefore + 1)
  assert.equal(s.investigators[0].deck.length, 5)
  assert.ok(!legalMoves(s).some(action => action.rule === 'searchSecurityOffice'))
})

test('D6 Altar school and reeds enforce card restrictions', () => {
  const s = chapterFixture('bloodOnTheAltar'), inv = s.investigators[0], b = laterBehavior('bloodOnTheAltar')
  const site = s.locations[0]
  site.originalCode = '02210'; inv.location = site.id
  assert.equal(b.canPlayCard(s, inv, { type: 'event' }), false)
  assert.equal(b.canPlayCard(s, inv, { type: 'asset' }), true)
  site.originalCode = '02212'
  assert.equal(b.canCommitCard(s, inv, '02150'), false)
  assert.equal(b.canCommitCard(s, inv, '02149'), true)
})

test('D6 Lost: encounter locations force doom, resource payment and relocation on removal', () => {
  const s = chapterFixture('lostInTimeAndSpace'), b = laterBehavior('lostInTimeAndSpace')
  const inv = s.investigators[0], dimension = s.locations.find(loc => loc.originalCode === '02320')
  const tear = { id: 'tear-test', originalCode: '02324', doom: 0, connections: [], clues: 0 }
  s.locations.push(tear); inv.location = tear.id
  const api = { choose: () => 'doom', remove: id => { s.locations.splice(s.locations.findIndex(loc => loc.id === id), 1) },
    shuffleEncounterDeck: () => {} }
  b.roundEnded(s, api)
  assert.equal(tear.doom, 1)
  const doorway = { id: 'door-test', originalCode: '02328', connections: [], clues: 0 }
  s.locations.push(doorway); inv.location = doorway.id; inv.resources = 2
  b.turnEnded(s, inv, { ...api, choose: () => 'pay' })
  assert.equal(inv.resources, 0)
  const steps = { id: 'steps-test', originalCode: '02327', connections: [dimension.id], clues: 0, revealed: true }
  s.locations.push(steps); inv.location = steps.id
  inv.hand = []; inv.assets = []; inv.willpower = 0; inv.actionsLeft = 5; s.chaosBag = ['0']
  move(s, { action: 'move', locationId: dimension.id }); settle(s)
  assert.equal(s.investigators[0].location, dimension.id)
  assert.ok(!s.locations.some(loc => loc.id === steps.id))
  assert.ok(s.encounterDeck.includes('02327'))
})

test('D6 Hill: drawing a Hex at Sentinel Peak deals one damage', () => {
  const s = chapterFixture('whereDoomAwaits'), b = laterBehavior('whereDoomAwaits'), inv = s.investigators[0]
  const peak = s.locations.find(loc => loc.originalCode === '02284') || { id: 'peak-test', originalCode: '02284' }
  if (!s.locations.includes(peak)) s.locations.push(peak)
  inv.location = peak.id
  let harm = 0
  b.encounterDrawn(s, inv, '02296', { damage: (seat, amount) => { harm += amount } })
  assert.equal(harm, 1)
})

test('D6 unique enemies: Yog-Sothoth cannot be evaded or make opportunity attacks', () => {
  const s = chapterFixture('lostInTimeAndSpace'), inv = s.investigators[0]
  const yog = { id: 'yog-test', code: '02323', name: '犹格·索托斯', location: inv.location,
    fight: 6, evade: 6, damage: 1, horror: 1, massive: true, exhausted: false }
  s.enemies.push(yog)
  assert.ok(!legalMoves(s).some(action => action.action === 'evade' && action.enemyId === yog.id))
  assert.equal(validateMove(s, s.currentSeat, { action: 'evade', enemyId: yog.id }), '该敌人不能被躲避')
  assert.equal(laterBehavior('lostInTimeAndSpace').canOpportunityAttack(s, yog), false)
})

test('D7 Brood encounters attach stat boosts, move toward the drawer, and spend set-aside brood', () => {
  const s = chapterFixture('undimensionedAndUnseen'), b = laterBehavior('undimensionedAndUnseen')
  const inv = s.investigators[0], brood = s.enemies.find(enemy => enemy.code === '02255')
  assert.ok(brood)
  assert.deepEqual(s.scenario.treacheries['02256'].effect, { kind: 'campaignRule' })
  brood.location = inv.location
  const other = s.investigators[1]
  other.location = inv.location
  const harm = [], tests = [], draws = []
  const api = { choose: request => request.source === '02256' ? brood.id
    : request.source === '02258' ? request.options[0].id : 'spawn', random: () => 0,
    damage: (seat, n) => harm.push([seat, n]), horror: (seat, n) => harm.push([seat, `h${n}`]),
    drawEncounter: seat => draws.push(seat),
    test: (seat, skill, difficulty, resolve) => { tests.push([seat, skill, difficulty]); resolve({ success: false, value: 1 }) },
    spawn: (code, loc) => { const enemy = { id: 'spawned-brood', code, location: loc, health: 1 }; s.enemies.push(enemy); return enemy } }
  const baseHealth = brood.health
  assert.equal(b.resolveEncounter(s, inv, { code: '02256' }, api), true)
  assert.equal(brood.health, baseHealth + 1)
  assert.equal(b.enemyStatModifier(s, brood, 'fight'), 1)
  assert.deepEqual(harm.shift(), [inv.seat, 1])
  b.resolveEncounter(s, inv, { code: '02257' }, api)
  assert.equal(tests.length, 2)
  assert.deepEqual(harm, [[inv.seat, 2], [other.seat, 2]])
  const remaining = s.scenarioZones.brood.remaining
  b.resolveEncounter(s, inv, { code: '02259' }, api)
  assert.equal(s.scenarioZones.brood.remaining, remaining - 1)
  assert.equal(s.enemies.find(enemy => enemy.id === 'spawned-brood').health, 1 + s.numInvestigators)
  b.enemyDefeated(s, brood, api)
  assert.ok(s.encounterDiscard.includes('02256'))
  assert.ok(cardRuleIds(ALL_CARDS['02258']).includes('dunwichBrood'))
  b.resolveEncounter(s, inv, { code: '02258' }, api)
  assert.deepEqual(draws, [inv.seat])
})

test('D7 attracting attention moves each brood one connection, then surges', () => {
  const s = chapterFixture('undimensionedAndUnseen'), b = laterBehavior('undimensionedAndUnseen')
  const [from, to] = s.locations
  from.connections = [to.id]; to.connections = [from.id]
  s.enemies = [{ id: 'brood-test', code: '02255', location: from.id }]
  const inv = s.investigators[0]; inv.location = to.id
  const draws = []
  b.resolveEncounter(s, inv, { code: '02258' }, { random: () => 0, drawEncounter: seat => draws.push(seat) })
  assert.equal(s.enemies[0].location, to.id)
  assert.deepEqual(draws, [inv.seat])
})

test('D7 shared Cursed Luck threat is discarded after a successful test by one', () => {
  const s = chapterFixture('undimensionedAndUnseen'), b = laterBehavior('undimensionedAndUnseen')
  const inv = s.investigators[0]
  inv.threat.push({ id: 'threat-test', code: '02092' })
  b.afterTest(s, inv, { success: true, value: 4, difficulty: 3, drawn: [], cancelledTokens: [] }, {})
  assert.ok(!inv.threat.some(card => card.code === '02092'))
  assert.ok(s.encounterDiscard.includes('02092'))
})

test('D8 ten scenario treacheries use the encounter-rule entry point', () => {
  for (const [id, codes] of [
    ['theMiskatonicMuseum', ['02143', '02145', '02146']],
    ['theEssexCountyExpress', ['02178']],
    ['bloodOnTheAltar', ['02222', '02223']],
    ['whereDoomAwaits', ['02296', '02298']], ['lostInTimeAndSpace', ['02331', '02333']],
  ]) {
    const s = chapterFixture(id)
    for (const code of codes) {
      assert.equal(s.scenario.treacheries[code].rulesPending, false, code)
      assert.deepEqual(s.scenario.treacheries[code].effect, { kind: 'campaignRule' }, code)
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes('dunwichEncounters'), code)
    }
  }
  assert.ok(ruleById('dunwichEncounters').body.length > 0)
})

test('D8 Train weakness and Hill rites discard deck cards; altered investigators return weaknesses', () => {
  const train = chapterFixture('theEssexCountyExpress'), tb = laterBehavior('theEssexCountyExpress')
  const traveler = train.investigators[0]
  traveler.deck = ['01088', '01089', '01090', '01091']
  const discardTop = (state, seat, n) => {
    const inv = state.investigators[seat]
    for (let i = 0; i < n && inv.deck.length; i++) inv.discard.push(inv.deck.pop())
  }
  tb.resolveEncounter(train, traveler, { code: '02178' }, { discardTopOfDeck: (seat, n) => discardTop(train, seat, n) })
  assert.deepEqual(traveler.deck, ['01088'])

  const hill = chapterFixture('whereDoomAwaits'), hb = laterBehavior('whereDoomAwaits')
  const altered = { id: 'altered-test', traits: ['Altered'] }
  hill.locations.push(altered)
  const first = hill.investigators[0], second = hill.investigators[1]
  first.location = altered.id
  first.deck = ['01088', '01089', '01090', '01091']
  first.discard = ['01096']
  second.deck = ['01088', '01089', '01090', '01091']
  hb.resolveEncounter(hill, first, { code: '02296' }, {
    discardTop: (seat, n) => discardTop(hill, seat, n), random: () => 0,
    shuffleDiscardWeaknessesIntoDeck: seat => {
      const owner = hill.investigators[seat]
      const weaknesses = owner.discard.filter(code =>
        ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype))
      owner.discard = owner.discard.filter(code => !weaknesses.includes(code))
      owner.deck.push(...weaknesses)
      for (let index = owner.deck.length - 1; index > 0; index--) {
        const swap = 0
        ;[owner.deck[index], owner.deck[swap]] = [owner.deck[swap], owner.deck[index]]
      }
      return weaknesses.length
    },
  })
  assert.equal(first.deck.length, 2)
  assert.ok(first.deck.includes('01096'))
  assert.ok(!first.discard.includes('01096'))
  assert.equal(second.deck.length, 1)
})

test('D8 Collapsing Reality discards an extradimensional location and relocates occupants', () => {
  const s = chapterFixture('lostInTimeAndSpace')
  const inv = s.investigators[0], dimension = s.locations.find(loc => loc.originalCode === '02320')
  const extra = { id: 'extra-reality', originalCode: '02324', traits: ['Extradimensional'], connections: [] }
  s.locations.push(extra)
  inv.location = extra.id
  inv.assets = []; inv.hand = []
  drawD9(s, '02331')
  assert.equal(s.investigators[0].location, dimension.id)
  assert.equal(s.investigators[0].damage, 1)
  assert.ok(s.encounterDiscard.includes('02324'))
  drawD9(s, '02331')
  assert.equal(s.investigators[0].damage, 3)
})

test('D8 Terror from Beyond expands to two card types on the second draw of a phase', () => {
  const s = chapterFixture('theMiskatonicMuseum'), b = laterBehavior('theMiskatonicMuseum')
  const [first, second] = s.investigators
  assert.equal(s.scenario.treacheries['02101'].rulesPending, false)
  assert.ok(cardRuleIds(ALL_CARDS['02101']).includes('dunwichEncounters'))
  first.hand = ['01016', '01088', '01092']
  second.hand = ['01030', '01088', '01089']
  const optionCounts = [], api = {
    choose: request => {
      optionCounts.push(request.options.length)
      return optionCounts.length === 1 ? 'asset' : 'event,skill'
    },
    discardHandOfTypes: (seat, types) => {
      const owner = s.investigators[seat]
      const wanted = new Set(types)
      const discarded = owner.hand.filter(code => wanted.has(ALL_CARDS[code]?.type))
      owner.hand = owner.hand.filter(code => !wanted.has(ALL_CARDS[code]?.type))
      owner.discard.push(...discarded)
      return discarded.length
    },
  }
  b.encounterDrawn(s, first, '02101', {})
  b.resolveEncounter(s, first, { code: '02101' }, api)
  assert.deepEqual(first.hand, ['01088', '01092'])
  assert.deepEqual(second.hand, ['01088', '01089'])
  b.encounterDrawn(s, first, '02101', {})
  b.resolveEncounter(s, first, { code: '02101' }, api)
  assert.deepEqual(first.hand, [])
  assert.deepEqual(second.hand, [])
  assert.deepEqual(optionCounts, [3, 3])
  assert.deepEqual(first.discard.slice(-3), ['01016', '01088', '01092'])
})

test('D8 a cancelled Terror from Beyond still counts as the first drawn copy', () => {
  const s = chapterFixture('theMiskatonicMuseum'), b = laterBehavior('theMiskatonicMuseum')
  const inv = s.investigators[0]
  inv.hand = ['01016', '01088', '01092']
  b.encounterDrawn(s, inv, '02101', {}) // Its revelation was cancelled.
  b.encounterDrawn(s, inv, '02101', {})
  let offered
  b.resolveEncounter(s, inv, { code: '02101' }, {
    choose: request => {
      offered = request.options.map(option => option.id); return 'asset,event'
    },
    discardHandOfTypes: (seat, types) => {
      const owner = s.investigators[seat]
      const wanted = new Set(types)
      const discarded = owner.hand.filter(code => wanted.has(ALL_CARDS[code]?.type))
      owner.hand = owner.hand.filter(code => !wanted.has(ALL_CARDS[code]?.type))
      owner.discard.push(...discarded)
      return discarded.length
    },
  })
  assert.ok(offered.includes('asset,event'))
  assert.deepEqual(inv.hand, ['01092'])
})

function drawD9(s, code, choose = () => null) {
  s.encounterDeck = [code]; s.encounterDiscard = []
  move(s, { action: 'scenarioAction', rule: 'd9Encounter' }); settle(s, choose)
}

test('D9 all 47 distinct treacheries have executable handlers', () => {
  const cards = new Map(contentRegistry.getCampaign('theDunwichLegacy').scenarioIds.flatMap(id => Object.values(contentRegistry.getScenarioData(id).treacheries)).map(card => [card.code, card]))
  assert.equal(cards.size, 47)
  assert.deepEqual([...cards.values()].filter(card => card.rulesPending).map(card => card.code), [])
  for (const code of ['02085', '02088', '02089', '02096', '02099', '02100', '02102', '02142', '02144', '02180', '02181', '02220', '02221', '02297', '02332'])
    assert.ok(cardRuleIds(ALL_CARDS[code]).includes('dunwichEncounters'), code)
})

test('D9 disappearing locations evacuate engaged enemies too, even when the investigator cannot normally move', () => {
  const s = chapterFixture('lostInTimeAndSpace'), inv = s.investigators[0]
  const extra = { id: 'vanishing', originalCode: '02326', connections: [], clues: 0, revealed: true }
  s.locations.push(extra); inv.location = extra.id; inv.steamImmobileRound = s.round
  s.enemies.push({ id: 'held', code: '02182', name: '攫取恐怖', location: extra.id, engagedSeat: 0, exhausted: true, damage: 1, horror: 1 })
  inv.engaged = ['held']
  move(s, { action: 'scenarioAction', rule: 'd9RemoveLocation', locationId: extra.id }); settle(s)
  assert.equal(s.investigators[0].location, L('02320'))
  assert.equal(s.enemies[0].location, L('02320')); assert.equal(s.enemies[0].engagedSeat, 0)
  assert.ok(!s.locations.some(loc => loc.id === extra.id))
})

test('D9 Arcane Barrier success discards attachment; failure cancels or pays five cards, including replay', () => {
  for (const choice of ['success', 'cancel', 'mill']) {
    const s = chapterFixture('theMiskatonicMuseum'), inv = s.investigators[0]
    inv.hand = []; inv.assets = []; inv.deck = Array(15).fill('01088'); inv.willpower = choice === 'success' ? 6 : 0
    inv.actionsLeft = 8; s.chaosBag = ['0']; s.enemies = []
    const destination = s.locations.find(loc => loc.id === L('02128'))
    inv.location = L('02126'); s.locations.find(loc => loc.id === inv.location).connections.push(destination.id)
    drawD9(s, '02102')
    move(s, { action: 'move', locationId: destination.id })
    const saved = clone(s)
    for (const replay of [s, saved]) settle(replay, p => p.source === '02102' && p.kind === 'encounter' ? choice : null)
    assert.deepEqual(s, saved)
    assert.equal(s.investigators[0].location, choice === 'cancel' ? L('02126') : destination.id)
    assert.equal(s.locations.find(loc => loc.id === L('02126')).arcaneBarriers, choice === 'success' ? 0 : 1)
    assert.equal(s.investigators[0].deck.length, choice === 'mill' ? 10 : 15)
  }
})

test('D9 Light of Aforgomon makes damage direct until its attached agenda leaves play', () => {
  const s = chapterFixture('theEssexCountyExpress')
  for (const inv of s.investigators) { inv.location = s.locations.at(-1).id; inv.assets = [{ id: `ally-${inv.seat}`, code: '01018', damage: 0 }]; inv.hand = [] }
  drawD9(s, '02085', p => p.source === '02085' ? 'agenda' : null)
  s.currentSeat = 0
  assert.deepEqual(viewState(s, 0).scriptAttachments, { act: [], agenda: ['02085'] })
  move(s, { action: 'scenarioAction', rule: 'd9Damage', amount: 1 }); settle(s, p => p.kind === 'assign-damage' ? 'ally-0' : null)
  assert.equal(s.investigators[0].damage, 1); assert.equal(s.investigators[0].assets[0].damage, 0)
  assert.ok(s.log.some(line => String(line?.text ?? line).includes('不能分配给支援卡')))
  move(s, { action: 'scenarioAction', rule: 'd9Agenda' }); settle(s)
  assert.equal(s.scenarioFlags.lightOfAforgomon.length, 0)
  assert.deepEqual(viewState(s, 0).scriptAttachments, { act: [], agenda: [] })
  s.currentSeat = 0
  move(s, { action: 'scenarioAction', rule: 'd9Damage', amount: 1 }); settle(s, p => p.kind === 'assign-damage' ? 'ally-0' : null)
  assert.equal(s.investigators[0].damage, 1); assert.equal(s.investigators[0].assets[0].damage, 1)
})

test('D9 Claws of Steam assigns damage to assets first and blocks both action and card movement', () => {
  const s = chapterFixture('theEssexCountyExpress'), inv = s.investigators[0]
  inv.willpower = 0; inv.hand = []; inv.assets = [{ id: 'dog', code: '01021', damage: 0 }]; s.chaosBag = ['0']
  drawD9(s, '02180')
  assert.equal(s.investigators[0].damage, 0)
  assert.equal(s.investigators[0].assets[0].damage, 2)
  assert.ok(!legalMoves(s).some(action => action.action === 'move'))
  assert.match(validateMove(s, 0, { action: 'move', locationId: s.locations[1].id }), /蒸汽/)
})

test('D9 Unhallowed Country blanks ally stats and abilities, blocks ally play, and expires on a successful end-turn test', () => {
  const s = chapterFixture('bloodOnTheAltar'), inv = s.investigators[0]
  inv.assets = [{ id: 'cop', code: '01018' }]; inv.hand = ['01018']; inv.resources = 10; inv.willpower = 9; s.chaosBag = ['0']
  const before = getStat(s, inv, 'combat')
  drawD9(s, '02088')
  assert.equal(getStat(s, s.investigators[0], 'combat'), before - 1)
  assert.ok(!legalMoves(s).some(action => action.assetId === 'cop'))
  assert.ok(validateMove(s, 0, { action: 'play', cardId: '01018' }))
  move(s, { action: 'endTurn' }); settle(s)
  assert.ok(!s.investigators[0].threat.some(card => card.code === '02088'))
  assert.equal(getStat(s, s.investigators[0], 'combat'), before)
})

test('D9 Kidnapped attaches only on failed test with ally and sacrifices randomly when agenda advances', () => {
  const s = chapterFixture('bloodOnTheAltar'), inv = s.investigators[0]
  inv.assets = [{ id: 'ally', code: '01018' }]; inv.hand = []; inv.willpower = 0; s.chaosBag = ['0']
  s.scenarioZones.sacrifices = []
  drawD9(s, '02220', p => p.kind === 'skill' ? 'willpower' : null)
  assert.deepEqual(s.scenarioZones.sacrifices, ['01018']); assert.equal(s.investigators[0].assets.length, 0)
  assert.ok(!s.encounterDiscard.includes('02220'))
  assert.deepEqual(viewState(s, 0).scriptAttachments.agenda, ['02220'])
  move(s, { action: 'scenarioAction', rule: 'd9Agenda' }); settle(s)
  assert.deepEqual(s.scenarioZones.sacrificed, ['01018']); assert.ok(s.encounterDiscard.includes('02220'))
  assert.deepEqual(viewState(s, 0).scriptAttachments.agenda, [])
})

test('D9 Psychopomp Song triggers once, adds two damage, and discards before harm', () => {
  const s = chapterFixture('bloodOnTheAltar'); s.investigators[0].assets = []; s.investigators[0].hand = []
  drawD9(s, '02221', p => p.kind === 'investigator' ? '0' : null)
  move(s, { action: 'scenarioAction', rule: 'd9Damage', amount: 1 }); settle(s)
  assert.equal(s.investigators[0].damage, 3); assert.ok(!s.investigators[0].threat.some(card => card.code === '02221'))
  move(s, { action: 'scenarioAction', rule: 'd9Damage', amount: 1 }); settle(s)
  assert.equal(s.investigators[0].damage, 4)
})

test('D9 Altered Beast heals brood and triggers on enemy and investigator movement; event damage remains prohibited', () => {
  const s = chapterFixture('undimensionedAndUnseen'), inv = s.investigators[0]
  inv.assets = []; inv.hand = []; const enemy = s.enemies[0]; enemy.damageTaken = 2
  drawD9(s, '02096', p => p.kind === 'target' ? enemy.id : null)
  assert.equal(s.enemies[0].damageTaken, 0)
  move(s, { action: 'scenarioAction', rule: 'd9EnemyMove', enemyId: enemy.id, destination: inv.location }); settle(s)
  assert.equal(s.investigators[0].horror, 1)
  const before = s.enemies[0].damageTaken
  s.investigators[0].hand = ['01024']; s.investigators[0].resources = 20; s.investigators[0].actionsLeft = 9
  move(s, { action: 'play', cardId: '01024' }); settle(s, p => p.options.some(option => option.id === s.investigators[0].location) ? s.investigators[0].location : null)
  assert.equal(s.enemies[0].damageTaken, before)
})

test('D9 Cold Spring Glen successful reaction chooses a different random destination', () => {
  const s = chapterFixture('undimensionedAndUnseen')
  s.locations[0].originalCode = '02245'; s.investigators[0].location = s.locations[0].id
  const chosen = chooseBroodRandomLocation(s, { random: () => 0, choose: () => 'trigger', test: (seat, skill, difficulty, resolve) => resolve({ success: true }) })
  assert.notEqual(chosen.id, s.locations[0].id)
})

test('D9 Mind Wipe removes brood printed immunity and health bonus; an already damaged brood is defeated', () => {
  const s = chapterFixture('undimensionedAndUnseen'), inv = s.investigators[0], enemy = s.enemies[0]
  inv.location = enemy.location; inv.assets = []; inv.hand = ['01068']; inv.resources = 10
  s.investigators[1].hand = []; s.investigators[1].assets = []; enemy.damageTaken = 1
  s.encounterDeck = []; s.encounterDiscard = []
  move(s, { action: 'endTurn' }); settle(s)
  move(s, { action: 'endTurn' }); settle(s, p => p.source?.when === 'phaseBegins' && p.options.some(option => option.id === '0') ? '0'
    : p.kind === 'target' && p.options.some(option => option.id === enemy.id) ? enemy.id : null)
  assert.ok(!s.enemies.some(item => item.id === enemy.id))
  assert.ok(s.investigators[0].discard.includes('01068'))
})

test('D9 Wormhole discards intervening cards, resolves location revelation, then moves the investigator', () => {
  const s = chapterFixture('lostInTimeAndSpace'), inv = s.investigators[0]
  inv.resources = 8; inv.hand = []; s.encounterDiscard = []; s.encounterDeck = ['02326', '02083', '02332']
  move(s, { action: 'scenarioAction', rule: 'd9Encounter' }); settle(s)
  assert.equal(s.investigators[0].resources, 6)
  const location = s.locations.find(loc => loc.id === s.investigators[0].location)
  assert.equal(location.originalCode, '02326')
  assert.ok(s.encounterDiscard.includes('02083')); assert.ok(s.encounterDiscard.includes('02332'))
})

test('D9 Hunted Down moves a ready unengaged Criminal, engages and attacks immediately', () => {
  const s = chapterFixture('bloodOnTheAltar'), inv = s.investigators[0]
  inv.hand = []; inv.assets = []
  const enemy = { id: 'criminal', code: '02097', name: '打手', location: s.locations[1].id, traits: ['Criminal'],
    health: 4, damageTaken: 0, damage: 1, horror: 0, engagedSeat: null, exhausted: false }
  s.enemies = [enemy]; s.locations[1].connections = [inv.location]
  drawD9(s, '02099')
  assert.equal(s.enemies[0].location, s.investigators[0].location)
  assert.equal(s.enemies[0].engagedSeat, 0); assert.equal(s.investigators[0].damage, 1)
  s.investigators[0].hand = ['01088']; s.investigators[0].resources = 10
  move(s, { action: 'play', cardId: '01088' }); settle(s)
  assert.equal(s.investigators[0].resources, 10, 'Emergency Cache cannot bypass the resource prohibition')
})

test('D9 Sordid and Silent harms all occupants at round end and is discarded after agenda advance', () => {
  const s = chapterFixture('bloodOnTheAltar'), b = laterBehavior('bloodOnTheAltar')
  for (const inv of s.investigators) { inv.hand = []; inv.assets = []; inv.location = s.locations[0].id }
  drawD9(s, '02089')
  const hit = []
  b.roundEnded(s, { horror: (seat, amount) => hit.push([seat, amount]) })
  assert.deepEqual(hit, [[0, 1], [1, 1]])
  move(s, { action: 'scenarioAction', rule: 'd9Agenda' }); settle(s)
  assert.ok(s.encounterDiscard.includes('02089'))
  b.roundEnded(s, { horror: (seat, amount) => hit.push([seat, amount]) })
  assert.equal(hit.length, 2)
})

test('D9 story ally defeated in harm assignment is removed and adds a permanent tablet exactly once', () => {
  const s = chapterFixture('theMiskatonicMuseum'), inv = s.investigators[0]
  inv.hand = []; inv.assets = [{ id: 'harold', code: '02138', damage: ALL_CARDS['02138'].health - 1 }]
  const before = s.campaign.chaosBag.filter(token => token === 'tablet').length
  move(s, { action: 'scenarioAction', rule: 'd9Damage', amount: 1 }); settle(s, p => p.kind === 'assign-damage' ? 'harold' : null)
  assert.equal(s.campaign.chaosBag.filter(token => token === 'tablet').length, before + 1)
  assert.ok(s.scenarioZones.removed.includes('02138'))
  assert.ok(!s.investigators[0].discard.includes('02138')); assert.equal(s.investigators[0].assets.length, 0)
})

test('D9 awarded story allies can be played in later chapters without opening them to deckbuilding', () => {
  const s = chapterFixture('whereDoomAwaits'), inv = s.investigators[0]
  inv.assets = []; inv.hand = ['02217']; inv.resources = 10
  assert.ok(validateMove(s, 0, { action: 'play', cardId: '02217' }))
  s.campaign.investigators[0].deck.push('02217')
  const before = getStat(s, inv, 'willpower')
  move(s, { action: 'play', cardId: '02217' }); settle(s)
  assert.equal(getStat(s, s.investigators[0], 'willpower'), before + 1)
  assert.equal(getAvailability('02217').deckbuilding, false)
})

test('D9 brood clue contributions can come entirely from a teammate and per-investigator contributions may be declined', () => {
  for (const site of ['02244', '02247', '02250']) {
    const s = chapterFixture('undimensionedAndUnseen'), [first, second] = s.investigators
    const loc = s.locations[0], enemy = s.enemies[0]
    loc.originalCode = site; enemy.location = loc.id; first.location = second.location = loc.id
    first.clues = 1; second.clues = 3; s.clues = 4; first.assets = second.assets = []; first.hand = []
    move(s, { action: 'scenarioAction', rule: 'markBrood', enemyId: enemy.id, amount: site === '02250' ? 3 : 2 })
    settle(s, p => p.kind === 'payment' ? (site === '02247' ? p.seat === 0 ? 'no' : 'yes' : p.seat === 0 ? '0' : '2') : p.kind === 'investigator' ? '1' : null)
    assert.equal(s.investigators[0].clues, 1)
    assert.equal(s.enemies[0].clues, site === '02250' ? 3 : site === '02247' ? 1 : 2)
    assert.equal(s.clues, 4 - s.enemies[0].clues)
  }
})

test('D9 Sentinel Peak charges shared clues only on its unrevealed side', () => {
  const s = chapterFixture('whereDoomAwaits'), inv = s.investigators[0]
  s.actIndex = 1; s.acts[1].objective = null; inv.actionsLeft = 9; inv.hand = []; inv.assets = []; inv.clues = 4; s.clues = 4
  inv.location = L('02283'); const from = s.locations.find(loc => loc.id === inv.location), peak = s.locations.find(loc => loc.id === L('02284'))
  from.connections.push(peak.id)
  move(s, { action: 'move', locationId: peak.id }); settle(s, p => p.kind === 'payment' ? '4' : null)
  assert.equal(s.investigators[0].clues, 0); assert.equal(s.locations.find(loc => loc.id === peak.id).revealed, true)
})

test('D9 train spawn enters exhausted to the right; Interstellar Traveler takes location clue as doom', () => {
  const train = chapterFixture('theEssexCountyExpress'); train.investigators[0].hand = []
  drawD9(train, '02183')
  assert.equal(train.enemies[0].location, train.locations[1].id); assert.equal(train.enemies[0].exhausted, true)
  const s = chapterFixture('lostInTimeAndSpace'); s.investigators[0].hand = []
  s.encounterDeck = ['02325']; move(s, { action: 'scenarioAction', rule: 'd9Encounter' }); settle(s)
  const extra = s.locations.find(loc => loc.originalCode === '02325'), clues = extra.clues
  drawD9(s, '02329')
  assert.equal(s.enemies[0].location, extra.id); assert.equal(s.enemies[0].doom, 1)
  assert.equal(s.locations.find(loc => loc.id === extra.id).clues, clues - 1)
})

for (const difficulty of ['easy', 'standard', 'hard', 'expert']) test(`D9 ${difficulty} chaos effects execute at reveal and are not applied again after test`, () => {
  const s = chapterFixture('bloodOnTheAltar'), inv = s.investigators[0]
  s.difficulty = difficulty; const hard = ['hard', 'expert'].includes(difficulty), before = s.doom
  const tablet = dunwichChaosToken('bloodOnTheAltar', s, inv, 'tablet', {})
  assert.equal(tablet.drawAnother, hard)
  dunwichChaosToken('bloodOnTheAltar', s, inv, 'elderthing', {})
  assert.equal(s.doom, before + Number(hard))
  dunwichChaosAfterTest('bloodOnTheAltar', s, inv, { success: false, drawn: ['elderthing'] }, {})
  assert.equal(s.doom, before + 1)
})

test('D9 Spaces Between flips and shuffles paths, evacuates occupants, and hides card identities in public state', () => {
  const s = chapterFixture('whereDoomAwaits')
  for (const code of ['02285', '02286', '02289', '02290']) s.locations.push({ ...clone(s.scenario.locations[L(code)]), revealed: true, clues: 4, maxClues: 4, connections: [L('02282')] })
  s.investigators[0].location = L('02285'); s.investigators[0].hand = []; s.investigators[0].assets = []
  drawD9(s, '02297')
  assert.equal(s.investigators[0].location, L('02282'))
  for (const loc of s.locations.filter(loc => loc.hiddenIdentity)) { assert.equal(loc.revealed, false); assert.equal(loc.clues, 0) }
  assert.ok(s.locations.filter(loc => [L('02285'), L('02286')].includes(loc.id)).every(loc => ['02285', '02286', '02287', '02288'].includes(loc.originalCode)))
  assert.ok(s.locations.filter(loc => [L('02289'), L('02290')].includes(loc.id)).every(loc => ['02289', '02290', '02291', '02292'].includes(loc.originalCode)))
  for (const loc of s.locations.filter(loc => loc.hiddenIdentity)) delete loc.artCode // Compatibility with saves made before public back art was recorded.
  const visible = viewState(s, 0).locations.filter(loc => [L('02285'), L('02286'), L('02289'), L('02290')].includes(loc.id))
  assert.ok(visible.every(loc => !loc.originalCode && !loc.code && loc.name === '未知小径'))
  assert.deepEqual(visible.map(loc => loc.artCode), ['02285', '02285', '02289', '02289'])
})

test('D9 discovering an already printed path connection exposes one move only', () => {
  const s = chapterFixture('whereDoomAwaits'), inv = s.investigators[0]
  inv.location = L('02282'); inv.intellect = 8; inv.hand = []; inv.assets = []; s.chaosBag = ['0']
  const action = legalMoves(s).find(item => item.action === 'scenarioAction' && item.rule === 'divergingPaths')
  assert.ok(action)
  move(s, action); settle(s)
  const path = s.locations.find(loc => ['02285', '02286', '02287', '02288'].includes(loc.originalCode))
  assert.ok(path)
  const base = s.locations.find(loc => loc.id === L('02282'))
  assert.equal(base.connections.filter(id => id === path.id).length, 1)
  assert.equal(legalMoves(s).filter(item => item.action === 'move' && item.locationId === path.id).length, 1)
  base.connections.push(path.id) // Old saves may already contain the duplicate.
  assert.equal(legalMoves(s).filter(item => item.action === 'move' && item.locationId === path.id).length, 1)
})

test('D9 cultist cancels only committed skill cards, preserves asset icons and discards each card exactly once', () => {
  const s = chapterFixture('whereDoomAwaits'), inv = s.investigators[0]
  inv.assets = []; inv.hand = ['01090', '01030']; inv.intellect = 1; s.chaosBag = ['cultist', '0']; s.rngState = 0
  const execute = state => performTest(state, 0, 'intellect', 2, { resolve: result => { state.d9Result = result } })
  resolveTransaction(s, 0, { action: 'd9Test' }, execute)
  while (s.pendingChoice) {
    const p = s.pendingChoice
    const id = p.kind === 'commit' && p.options.some(o => o.id === '0') ? '0' : p.options.find(o => ['done', 'skip'].includes(o.id))?.id || p.options[0].id
    resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId: id }, execute)
  }
  assert.ok(s.d9Result.drawn.includes('cultist'))
  assert.equal(s.d9Result.value, 2)
  assert.equal(s.investigators[0].discard.filter(code => code === '01090').length, 1)
  assert.equal(s.investigators[0].discard.filter(code => code === '01030').length, 1)
})

test('D9 Pushed into the Beyond returns a non-story asset and checks the three discarded cards', () => {
  const s = chapterFixture('theMiskatonicMuseum'), inv = s.investigators[0]
  inv.assets = [{ id: 'ordinary', code: '01016' }, { id: 'story', code: '02138' }]
  let choices
  const api = { choose: request => { choices = request.options; return 'ordinary' },
    shuffleAssetIntoDeck: (seat, id) => { inv.assets.splice(inv.assets.findIndex(a => a.id === id), 1); return '01016' },
    discardTop: () => ['01016', '01088', '01089'], horror: (seat, n) => { inv.horror += n } }
  encounterRules.resolveEncounter(s, inv, { code: '02100' }, api)
  assert.deepEqual(choices.map(item => item.id), ['ordinary'])
  assert.equal(inv.horror, 2)
})

test('D9 Passage into the Veil deals direct harm to investigator and one damage to every ally', () => {
  const s = chapterFixture('theMiskatonicMuseum'), b = laterBehavior('theMiskatonicMuseum')
  const inv = s.investigators[0]
  inv.assets = [{ id: 'ally', code: '02149' }, { id: 'weapon', code: '01016' }]
  const harm = [], assets = []
  b.resolveEncounter(s, inv, { code: '02144' }, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false }),
    choose: () => 'damage', directDamage: (seat, n) => harm.push([seat, n]),
    damageAsset: (seat, id, n) => assets.push([seat, id, n]),
  })
  assert.deepEqual(harm, [[inv.seat, 1]])
  assert.deepEqual(assets, [[inv.seat, 'ally', 1]])
})

test('D9 Broken Rails affects everyone at the location and makes damaged investigators discard assets', () => {
  const s = chapterFixture('theEssexCountyExpress'), b = laterBehavior('theEssexCountyExpress')
  const [first, second] = s.investigators
  second.location = first.location
  first.actionsLeft = second.actionsLeft = 2
  first.damage = 4; second.damage = 3
  first.assets = [{ id: 'weapon', code: '01016' }]
  const discarded = []
  b.resolveEncounter(s, first, { code: '02181' }, {
    choose: request => request.options[0].id,
    discardAsset: (seat, id) => discarded.push([seat, id]),
  })
  assert.equal(first.actionsLeft, 1); assert.equal(second.actionsLeft, 1)
  assert.deepEqual(discarded, [[first.seat, 'weapon']])
})

test('D8 Museum treacheries ready and attack with Horror, lose actions on a failed test, or summon from void', () => {
  const s = chapterFixture('theMiskatonicMuseum'), b = laterBehavior('theMiskatonicMuseum')
  const inv = s.investigators[0], attacked = [], drawn = []
  let shuffleCount = 0
  const api = { drawEncounter: seat => drawn.push(seat), engage: () => {},
    attack: (enemy, target) => attacked.push(target.seat),
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 1 }),
    loseActions: (seat, amount) => { s.investigators[seat].actionsLeft = Math.max(0, s.investigators[seat].actionsLeft - amount) },
    shuffleEncounterDeck: () => { shuffleCount++ } }
  b.resolveEncounter(s, inv, { code: '02143' }, api)
  assert.deepEqual(drawn, [inv.seat])
  const horror = { id: 'horror-test', code: '02141', location: s.locations.at(-1).id, exhausted: true, doom: 0 }
  s.enemies.push(horror)
  s.investigators[1].location = inv.location
  // Stalked in the Dark readies/engages only where the Horror already is.
  b.resolveEncounter(s, inv, { code: '02143' }, api)
  assert.equal(horror.location, s.locations.at(-1).id)
  assert.equal(horror.exhausted, false)
  assert.deepEqual(attacked, [])
  horror.location = inv.location
  b.resolveEncounter(s, inv, { code: '02143' }, api)
  assert.equal(horror.exhausted, false)
  assert.deepEqual(attacked.sort(), [0, 1])
  inv.actionsLeft = 3
  b.resolveEncounter(s, inv, { code: '02145' }, api)
  assert.equal(inv.actionsLeft, 1)
  b.resolveEncounter(s, inv, { code: '02146' }, api)
  assert.equal(horror.doom, 1)
  assert.equal(shuffleCount, 1)
  s.enemies = []
  let shuffled = false, engaged = false
  b.resolveEncounter(s, inv, { code: '02146' }, { ...api,
    spawn: (code, location) => { const enemy = { id: 'new-horror', code, location }; s.enemies.push(enemy); return enemy },
    engage: () => { engaged = true }, shuffleEncounterDeck: () => { shuffled = true } })
  assert.equal(s.enemies[0].code, '02141')
  assert.equal(engaged, true); assert.equal(shuffled, true)
})

test('D8 Altar, Hill and Beyond treacheries apply each printed test and surge condition', () => {
  const altar = chapterFixture('bloodOnTheAltar'), ab = laterBehavior('bloodOnTheAltar')
  const inv = altar.investigators[0], loc = altar.locations.find(item => item.id === inv.location)
  const damage = [], horror = []
  const testApi = { test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 1 }),
    damage: (seat, amount) => damage.push([seat, amount]), horror: (seat, amount) => horror.push([seat, amount]),
    // 声明式检定（treacheryRule.test）的失败分支走 api.applyPenalty。
    applyPenalty: (seat, fail, failedBy) => {
      if (fail.kind === 'horrorByAmount') horror.push([seat, failedBy])
      else if (fail.kind === 'damageByAmount') damage.push([seat, failedBy])
      else if (fail.kind === 'takeHorror') horror.push([seat, fail.amount])
      else if (fail.kind === 'takeDamage') damage.push([seat, fail.amount])
    } }
  const before = loc.clues
  ab.resolveEncounter(altar, inv, { code: '02222' }, testApi)
  assert.equal(loc.clues, before + 1)
  ab.resolveEncounter(altar, inv, { code: '02223' }, testApi)
  assert.deepEqual(horror, [[inv.seat, 2]])

  const hill = chapterFixture('whereDoomAwaits'), hb = laterBehavior('whereDoomAwaits')
  const peak = hill.locations.find(item => item.traits?.includes('Sentinel Hill'))
  assert.ok(peak)
  hill.investigators.forEach(target => { target.location = peak.id })
  hb.resolveEncounter(hill, hill.investigators[0], { code: '02298' }, testApi)
  assert.deepEqual(damage, [[0, 2], [1, 2]])

  const beyond = chapterFixture('lostInTimeAndSpace'), bb = laterBehavior('lostInTimeAndSpace')
  const drawer = beyond.investigators[0], draws = []
  bb.resolveEncounter(beyond, drawer, { code: '02333' }, { ...testApi, drawEncounter: seat => draws.push(seat) })
  assert.deepEqual(draws, [drawer.seat])
  beyond.locations.push({ id: 'extra-test', traits: ['Extradimensional'] })
  bb.resolveEncounter(beyond, drawer, { code: '02333' }, { ...testApi,
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0 }),
    drawEncounter: seat => draws.push(seat) })
  assert.deepEqual(horror.at(-1), [drawer.seat, 1])
})

test('D6 story allies react to treachery tests and evasion; Servant grants a distant clue', () => {
  const s = chapterFixture('bloodOnTheAltar'), b = laterBehavior('bloodOnTheAltar'), inv = s.investigators[0]
  const zebulon = { code: '02217', exhausted: false }, earl = { code: '02218', exhausted: false }
  inv.assets.push(zebulon, earl)
  assert.equal(modifierTotal(s, inv, 'skill:willpower'), 1)
  assert.equal(modifierTotal(s, inv, 'skill:agility'), 1)
  let drawn = 0
  const api = { choose: () => 'yes', drawCards: (seat, n) => { drawn += n }, gainClues: (seat, n) => { s.investigators[seat].clues += n },
    canDiscoverClueAt: (_seat, id) => (s.locations.find(loc => loc.id === id)?.clues || 0) > 0,
    discoverClue: (seat, n, id) => {
      s.locations.find(loc => loc.id === id).clues -= n
      s.investigators[seat].clues += n
    } }
  const treachery = Object.keys(s.scenario.treacheries)[0]
  b.afterTest(s, inv, { success: true, skill: 'willpower', drawn: [], source: { type: 'encounter', code: treachery } }, api)
  b.afterEvade(s, inv, {}, null, api)
  assert.equal(drawn, 2); assert.equal(zebulon.exhausted, true); assert.equal(earl.exhausted, true)
  const target = s.locations[0]; target.clues = 2
  const before = target.clues
  b.enemyDefeated(s, { code: '02224', defeatedBy: inv.seat }, { ...api, choose: () => target.id })
  assert.equal(target.clues, before - 1); assert.equal(inv.clues, 1)
})

test('D6 学校（02213）只能通过调查发现线索：百口之物的仆人也不能从这里拿线索', () => {
  const s = chapterFixture('bloodOnTheAltar'), inv = s.investigators[0]
  const school = s.locations[0], elsewhere = s.locations[1]
  school.code = '02213'; school.originalCode = '02213'; school.clues = 1
  const events = []
  // 1）站在学校里、不通过调查：发现被拒绝。
  inv.location = school.id
  assert.equal(discoverClueAt(s, inv, 1, events), false)
  assert.equal(school.clues, 1)
  // 2）远程发现（02224「发现任意地点的 1 个线索」）：限制跟着目标地点，同样被拒绝。
  inv.location = elsewhere.id
  assert.equal(discoverClueAt(s, inv, 1, events, { locationId: school.id }), false)
  assert.equal(school.clues, 1)
  // 3）只有「调查」这条路径能拿到线索。
  s.skillTest = { source: { label: '调查' } }
  assert.equal(discoverClueAt(s, inv, 1, events, { locationId: school.id }), true)
  assert.equal(school.clues, 0)
  delete s.skillTest
})

test('D6 百口之物的仆人击败后只能从合法地点发现线索（学校不在候选里）', () => {
  const s = chapterFixture('bloodOnTheAltar'), inv = s.investigators[0]
  const school = s.locations.find(loc => loc.originalCode === '02212')
  const elsewhere = s.locations.find(loc => loc !== school)
  school.code = '02213'; school.originalCode = '02213'; school.clues = 1
  elsewhere.clues = 1
  inv.location = elsewhere.id
  inv.actionsLeft = 5
  s.chaosBag = ['0']
  const servant = spawnEnemy(s, '02224', elsewhere.id, null, true)
  let offered = null
  const pick = pending => {
    if (pending.source !== '02224') return null
    offered = pending.options.map(option => option.id)
    return offered.find(id => id !== 'skip') || 'skip'
  }
  move(s, { action: 'fight', enemyId: servant.id }); settle(s, pick)
  move(s, { action: 'fight', enemyId: servant.id }); settle(s, pick)
  assert.ok(offered, '击败百口之物的仆人后应询问从哪个地点发现线索')
  assert.ok(!offered.includes(school.id), '02213 学校只能通过调查发现线索，不应出现在候选里')
  assert.equal(school.clues, 1)
})

test('D6 Across Space and Time mills three cards when drawn as a weakness', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.deck = ['01088', '01089', '01090', '01091', '02178']
  move(s, { action: 'draw' }); settle(s)
  assert.deepEqual(s.investigators[0].deck, ['01088'])
  assert.ok(s.investigators[0].discard.includes('02178'))
  assert.ok(['01089', '01090', '01091'].every(code => s.investigators[0].discard.includes(code)))
})

test('D6 Yog-Sothoth can trade deck cards for horror; an empty deck causes insanity', () => {
  const s = chapterFixture('lostInTimeAndSpace'), b = laterBehavior('lostInTimeAndSpace'), inv = s.investigators[0]
  inv.deck = ['01088', '01089']
  let defeated = false
  const api = { choose: () => '1', discardTop: (seat, n) => { for (let i = 0; i < n; i++) inv.discard.push(inv.deck.pop()) },
    defeat: () => { defeated = true } }
  assert.deepEqual(b.beforeEnemyHarm(s, { code: '02323' }, inv, { horror: 2 }, api), { horror: 1 })
  assert.equal(inv.deck.length, 1); assert.equal(defeated, false)
  b.beforeEnemyHarm(s, { code: '02323' }, inv, { horror: 1 }, api)
  assert.equal(defeated, true)
  assert.equal(s.campaign.investigators[inv.seat].status, 'insane')
})

test('D6 new scenario mechanics link from their cards to the rulebook', () => {
  for (const [code, rule] of [['02214', 'dunwichChamber'], ['02215', 'dunwichChamber'],
    ['02254', 'dunwichBrood'], ['02255', 'dunwichBrood'], ['02118', 'dunwichChaos'],
    ['02128', 'dunwichZones'], ['02287', 'dunwichZones'], ['02323', 'dunwichBeyond']]) {
    assert.ok(cardRuleIds(ALL_CARDS[code]).includes(rule), code)
    assert.ok(ruleById(rule).body.length > 0)
  }
})

for (const [sacrificed, total, initial] of [[0, 5, 2], [1, 5, 2], [2, 4, 1], [3, 3, 1], [4, 2, 0], [5, 2, 0]]) {
  test(`D2 Brood: ${sacrificed} sacrifices produce ${total} brood, ${initial} initially in play`, () => {
    const s = chapterFixture('undimensionedAndUnseen'), b = laterBehavior('undimensionedAndUnseen')
    s.campaign.records.sacrificedToYogSothoth = Array(sacrificed).fill('person')
    b.setupLocations(s, [], { randomValue: () => 0.5, shuffle: a => [...a] })
    assert.equal(s.scenarioZones.brood.total, total)
    assert.equal(s.scenarioZones.brood.initial.length, initial)
    assert.equal(s.scenarioZones.brood.remaining, total - initial)
  })
}

test('D2 Hill: campaign records select act II; failure ends the campaign without awarding XP', () => {
  const base = contentRegistry.getScenarioData('whereDoomAwaits'), b = laterBehavior('whereDoomAwaits')
  for (const [records, expected] of [[{ theInvestigatorsRestoredSilasBishop: true }, '02278'], [{ theNecronomiconWasStolen: true }, '02279'], [{}, '02280']]) {
    const s = chapterFixture('whereDoomAwaits')
    s.acts = clone(base.acts); s.campaign.records = { broodEscapedIntoTheWild: 3, ...records }
    b.setupLocations(s, [], { randomValue: () => 0.5, shuffle: a => [...a] })
    assert.equal(s.acts[1].originalCode, expected); assert.equal(s.doom, 3)
    assert.equal(b.resolution(s, 'r2', [], {}).award, false)
    assert.equal(s.campaign.failed, true)
    assert.ok(Object.values(s.campaign.investigators).every(i => i.status === 'insane'))
  }
})

test('D2 Survivors: sacrificed allies cannot return; saved choices do not duplicate campaign cards', () => {
  const s = fixture(), execute = state => resolveSurvivors(state)
  s.campaign.records.sacrificedToYogSothoth = ['02040', '02061', '02217', '02218']
  resolveTransaction(s, 0, { action: 'survivorsTest' }, execute)
  const saved = clone(s)
  for (const state of [s, saved]) while (state.pendingChoice) resolveTransaction(state, state.pendingChoice.seat,
    { action: 'choose', choiceId: state.pendingChoice.id, optionId: '0' }, execute)
  assert.deepEqual(clone(s), clone(saved))
  assert.equal(s.campaign.investigators[0].deck.filter(c => c === '02080').length, 1)
  assert.equal(s.campaign.investigators[0].deck.filter(c => c === '02219').length, 1)
  assert.ok(!s.campaign.investigators[0].deck.includes('02040'))
})

test('D2 Beyond the Veil triggers only at empty deck, is discarded before damage, and does not repeat', () => {
  const s = fixture(), inv = s.investigators[0], harm = []
  inv.threat = [{ id: 'veil', code: '02084' }]
  const api = { damage: (seat, n) => { harm.push(n); assert.ok(!inv.threat.some(t => t.code === '02084')) } }
  encounterRules.deckEmptied(s, inv, api); assert.deepEqual(harm, [])
  inv.deck = []; encounterRules.deckEmptied(s, inv, api); encounterRules.deckEmptied(s, inv, api)
  assert.deepEqual(harm, [10]); assert.equal(s.encounterDiscard.filter(c => c === '02084').length, 1)
})

test('D10 complete Dunwich player pool and five investigators are available', () => {
  // Phase 1 起「有实现」= 旧 DSL 条目 ∪ 能力层描述子（played/commit 等），可用性口径也如此。
  const pool = [...new Set([...Object.keys(effects), ...abilityLayerCodes])].sort()
  assert.equal(pool.length, 91)
  for (const code of pool) assert.equal(getAvailability(code).deckbuilding, true, code)
  for (const code of ['02001', '02002', '02003', '02004', '02005']) assert.equal(canSelectInvestigator(code), true)
  for (const code of ['02021', '02026', '02305']) assert.equal(getAvailability(code).deckbuilding, true)
})

test('D10 Strange Solution research persists and unlocks all three researched upgrades', () => {
  const s = createGameState({ seed: 'd10-research', playerInvestigator: '02002' }, [{ seat: 0 }])
  settle(s)
  const inv = s.investigators[0], record = s.campaign.investigators[0]
  inv.actionsLeft = 3; inv.resources = 10; inv.hand = []; inv.deck = ['01088', '01088']; inv.discard = []
  inv.assets = [{ id: 'solution', code: '02021', exhausted: false }]
  s.chaosBag = ['0']; s.acts[0].objective = null
  record.xp = 20
  for (const code of ['02262', '02263', '02264']) assert.deepEqual(replacementOptions(record, code), [])
  move(s, { action: 'ability', assetId: 'solution', abilityIndex: 0 }); settle(s)
  const updatedRecord = s.campaign.investigators[0]
  assert.equal(updatedRecord.research.identifiedStrangeSolution, true)
  assert.equal(s.campaign.records.identifiedStrangeSolution, true)
  assert.ok(s.investigators[0].discard.includes('02021')); assert.equal(s.investigators[0].hand.length, 2)
  updatedRecord.xp = 20
  for (const code of ['02262', '02263', '02264']) assert.ok(replacementOptions(updatedRecord, code).length > 0)
  const replacement = structuredClone(updatedRecord)
  delete replacement.research
  for (const code of ['02262', '02263', '02264']) {
    assert.deepEqual(replacementOptions(replacement, code), [])
    assert.ok(replacementOptions(replacement, code, s.campaign.records).length > 0)
  }
})

test('D10 exile tracks its owner, leaves the campaign deck, and opens a replacement slot', () => {
  const s = createGameState({ seed: 'd10-exile', playerInvestigator: '02005' }, [{ seat: 0 }])
  settle(s)
  const inv = s.investigators[0], record = s.campaign.investigators[0]
  inv.actionsLeft = 3; inv.resources = 10; s.acts[0].objective = null
  inv.assets = [{ id: 'extinguisher', code: '02114', exhausted: false }]
  s.enemies = [{ id: 'rat', code: 'swarmOfRats', name: '鼠群', location: inv.location,
    engagedSeat: 0, health: 1, damageTaken: 0, fight: 1, evade: 1, exhausted: false, traits: [] }]
  inv.engaged = ['rat']; record.deck[0] = '02114'; s.chaosBag = ['0']
  move(s, { action: 'ability', assetId: 'extinguisher', abilityIndex: 1, targetId: 'rat' }); settle(s)
  assert.deepEqual(s.exiledBySeat, [{ seat: 0, code: '02114' }])
  assert.ok(!s.investigators[0].assets.some(asset => asset.code === '02114'))
  assert.deepEqual(settleExiledCards(s.campaign, s.exiledBySeat), [{ seat: 0, code: '02114' }])
  const updatedRecord = s.campaign.investigators[0]
  assert.ok(!updatedRecord.deck.includes('02114'))
  updatedRecord.xp = 10
  assert.ok(replacementOptions(updatedRecord, '02114').some(option => option.code === null))
})

test('D10 each Dunwich investigator initializes with signature dependencies and legal deck rules', () => {
  for (const code of ['02001', '02002', '02003', '02004', '02005']) {
    const s = createGameState({ seed: `d10-${code}`, playerInvestigator: code }, [{ seat: 0 }])
    const record = s.campaign.investigators[0]
    assert.equal(record.code, code)
    for (const signature of INVESTIGATORS[code].deckRequirements.signatureCards) {
      assert.ok(record.deck.includes(signature), `${code} missing ${signature}`)
    }
    if (code === '02005') assert.ok(s.investigators[0].assets.some(asset => asset.code === '02014'))
  }
})

test('D3 Emergency Aid heals a chosen investigator at the same location', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.damage = 3; inv.hand = ['02105']
  move(s, { action: 'play', cardId: '02105' }); settle(s)
  assert.equal(s.investigators[0].damage, 1)
  assert.equal(s.investigators[0].resources, 18)
})

test('D3 Emergency Aid can heal a damaged Ally without healing its owner', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.damage = 1; inv.hand = ['02105']
  inv.assets = [{ id: 'cop', code: '01018', damage: 2, horror: 0, exhausted: false }]
  move(s, { action: 'play', cardId: '02105' })
  settle(s, choice => choice.source === 'healDamageAtLocation' ? 'asset:cop' : null)
  assert.equal(s.investigators[0].damage, 1)
  assert.equal(s.investigators[0].assets[0].damage, 0)
})

for (const [code, harm, healed] of [['02116', 'damage', 'horror'], ['02117', 'horror', 'damage']]) {
  test(`D3 ${code} pays its harm, exhausts and consumes one supply to heal`, () => {
    const s = fixture(), inv = s.investigators[0]
    inv.damage = 2; inv.horror = 2; inv.hand = [code]
    move(s, { action: 'play', cardId: code }); settle(s)
    const asset = s.investigators[0].assets.find(item => item.code === code)
    assert.equal(asset.uses, 3)
    move(s, { action: 'ability', assetId: asset.id, abilityIndex: 0 }); settle(s)
    assert.equal(s.investigators[0][harm], 3)
    assert.equal(s.investigators[0][healed], 1)
    assert.equal(s.investigators[0].assets.find(item => item.id === asset.id).uses, 2)
    assert.equal(s.investigators[0].assets.find(item => item.id === asset.id).exhausted, true)
  })
}

test('D3 Newspaper boosts investigation only before its owner has any clues', () => {
  const s = fixture(), inv = s.investigators[0], loc = s.locations.find(item => item.id === inv.location)
  inv.assets.push({ id: 'newspaper', code: '02155', exhausted: false })
  loc.shroud = 4; loc.clues = 2
  move(s, { action: 'investigate' }); settle(s)
  assert.equal(s.investigators[0].clues, 1)
  move(s, { action: 'investigate' }); settle(s)
  assert.equal(s.investigators[0].clues, 1)
  assert.equal(s.locations.find(item => item.id === loc.id).clues, 1)
})

for (const [code, bonus, damage] of [['02152', 2, 2], ['02154', 2, 2], ['02301', 5, 3], ['02306', 3, 3]]) test(`D2 ${code}: actual play and asset attack pay resources, actions and charges`, () => {
  const s = fixture(), inv = s.investigators[0]
  inv.hand = [code]
  s.enemies = [{ id: 'target', code: 'swarmOfRats', name: '目标', location: inv.location, fight: 1, evade: 1, health: 30, damageTaken: 0, traits: [], exhausted: true }]
  move(s, { action: 'play', cardId: code }); settle(s)
  const asset = s.investigators[0].assets[0]
  move(s, { action: 'ability', assetId: asset.id, abilityIndex: 0, targetId: 'target' }); settle(s)
  assert.equal(s.enemies[0].damageTaken, damage)
  assert.equal(s.investigators[0].resources, 20 - ALL_CARDS[code].cost)
  // Phase 5：uses 已搬到注册表条目（effects 表里不再有这些卡）。
  const profiles = effects[code] || registeredEntry(code) || {}
  if (profiles.uses) assert.equal(s.investigators[0].assets[0].uses, profiles.uses - 1)
})

for (const [code, kind] of [['02150', 'clue'], ['02268', 'horror'], ['02299', 'damage']]) test(`D2 ${code}: success by two applies the additional skill reward`, () => {
  const s = fixture(), inv = s.investigators[0]
  inv.hand = [code]; inv.horror = 3
  const execute = state => performTest(state, 0, kind === 'clue' ? 'intellect' : kind === 'damage' ? 'combat' : 'willpower', 1,
    { resolve: result => { state.testResult = result } })
  resolveTransaction(s, 0, { action: 'skillTestFixture' }, execute)
  let committed = false
  while (s.pendingChoice) {
    const p = s.pendingChoice, id = !committed && p.kind === 'commit' && p.options.some(o => o.id === '0') ? '0' : p.options.find(o => ['done', 'skip'].includes(o.id))?.id || p.options[0].id
    if (id === '0') committed = true
    resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId: id }, execute)
  }
  assert.equal(s.testResult.success, true)
  if (kind === 'horror') assert.equal(s.investigators[0].horror, 1)
  else assert.equal(s.testResult[kind === 'clue' ? 'clueBonus' : 'damageBonus'], 2)
})

test('D2 Emergency Cache (2), Sketches and Moment of Respite enforce their play conditions', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.hand = ['02194', '02186', '02273']; inv.horror = 4
  move(s, { action: 'play', cardId: '02194' }); settle(s)
  assert.equal(s.investigators[0].resources, 23); assert.equal(s.investigators[0].hand.length, 3)
  s.locations[0].clues = 0
  assert.match(validateMove(s, 0, { action: 'play', cardId: '02186' }), /线索/)
  move(s, { action: 'play', cardId: '02273' }); settle(s)
  assert.equal(s.investigators[0].horror, 1)
})

test('D2 upgrade pool includes expansion XP cards and rejects them in zero-XP play', () => {
  const s = fixture(), cp = s.campaign
  cp.phase = 'interlude'; cp.investigators[0].xp = 5
  const removable = cp.investigators[0].deck.find(code => getAvailability(code).deckbuilding && !ALL_CARDS[code].permanent)
  const purchased = purchaseCard(cp, 0, '02301', removable)
  assert.equal(purchased.cost, 5); assert.equal(cp.investigators[0].xp, 0)
  assert.ok(cp.investigators[0].deck.includes('02301'))
  const deck = buildDeck(INVESTIGATORS['01001'], { seed: 'xp-gate' }).playerCards
  assert.ok(buildDeckFromList(INVESTIGATORS['01001'], ['02301', ...deck.slice(1)]).errors.length)
})

test('D2 permanent cards start in play before opening hand and leave the campaign deck intact', () => {
  const s = createGameState({ campaignHub: true, seed: 'd2-permanent' }, [{ seat: 0, role: 'human' }])
  move(s, { action: 'hubGoSetup' }); move(s, { action: 'hubSelectInvestigator', code: '01001' }); move(s, { action: 'hubAutoDeck' })
  for (const code of ['02157', '02158', '02187', '02189', '02193']) campaignCardChange(s.campaign, 0, code, 'add', 'fixture-upgrades')
  move(s, { action: 'hubDoneSeat' }); move(s, { action: 'hubBeginScenario' }); settle(s)
  for (const code of ['02157', '02158', '02187', '02189', '02193']) {
    assert.ok(s.investigators[0].assets.some(a => a.code === code))
    assert.ok(s.campaign.investigators[0].deck.includes(code))
    assert.ok(!s.investigators[0].hand.includes(code) && !s.investigators[0].deck.includes(code))
  }
  assert.equal(s.investigators[0].hand.length, 5)
})

test('D2 Shortcut moves a teammate without spending their action; Art Student discovers only on its own entry', () => {
  const s = fixture(2)
  s.locations.push({ id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true })
  s.locations[0].connections = ['hallway']; s.investigators[0].hand = ['02022', '02149']
  move(s, { action: 'play', cardId: '02022' })
  settle(s, p => p.kind === 'investigator' ? '1' : null)
  assert.equal(s.investigators[1].location, 'hallway')
  assert.equal(s.investigators[0].actionsLeft, 20); assert.equal(s.investigators[1].actionsLeft, 20)
  move(s, { action: 'play', cardId: '02149' }); settle(s, p => p.source === 'artStudent' ? 'trigger' : null)
  assert.equal(s.investigators[0].clues, 1)
})

test('D2 Prepared for the Worst only offers Weapons among the top nine, then shuffles unchosen cards', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.hand = ['02184']; inv.deck = ['01016', ...Array(8).fill('01088'), '01086']
  move(s, { action: 'play', cardId: '02184' })
  assert.ok(s.pendingChoice)
  const encoded = JSON.stringify(s.pendingChoice)
  assert.ok(!encoded.includes('01016'))
  settle(s, p => p.options.find(o => o.cardCode === '01086')?.id || p.options.find(o => o.label.includes('小刀') || o.label.includes('刀子'))?.id)
  assert.equal(s.investigators[0].hand.includes('01086'), true)
  assert.equal(s.investigators[0].deck.length, 9)
})

test('D2 Blackjack misses do not injure an engaged teammate', () => {
  const s = fixture(2), inv = s.investigators[0]
  inv.assets = [{ id: 'blackjack', code: '02016' }]; s.chaosBag = ['autofail']
  s.enemies = [{ id: 'target', code: 'swarmOfRats', location: 'study', name: '目标', health: 9, fight: 3, evade: 1,
    damageTaken: 0, exhausted: true, engagedSeat: 1 }]
  s.investigators[1].engaged = ['target']
  move(s, { action: 'ability', assetId: 'blackjack', abilityIndex: 0, targetId: 'target' }); settle(s)
  assert.equal(s.investigators[1].damage, 0)
})

test('D10 Bind Monster attaches after its test and remains outside the discard pile', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.hand = ['02031']; inv.willpower = 5
  s.enemies = [{ id: 'monster', code: 'swarmOfRats', name: '目标怪物', location: inv.location,
    fight: 1, evade: 1, health: 3, damage: 1, horror: 0, damageTaken: 0, traits: ['Monster'], exhausted: true }]
  move(s, { action: 'play', cardId: '02031' }); settle(s)
  assert.deepEqual(s.enemies[0].bindMonster, { ownerSeat: 0, code: '02031' })
  assert.equal(inv.discard.includes('02031'), false)
})

test('D10 Oops redirects a narrowly failed attack to another enemy', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.hand = ['02113']; inv.combat = 4; s.chaosBag = ['-1']
  s.enemies = [
    { id: 'target', code: 'swarmOfRats', name: '原目标', location: inv.location, fight: 5, evade: 1, health: 5, damageTaken: 0, traits: [], exhausted: true, engagedSeat: 0 },
    { id: 'other', code: 'swarmOfRats', name: '另一敌人', location: inv.location, fight: 1, evade: 1, health: 5, damageTaken: 0, traits: [], exhausted: true },
  ]
  move(s, { action: 'fight', enemyId: 'target' })
  settle(s, p => p.options.find(option => option.cardCode === '02113')?.id || (p.source === '02113' ? 'other' : null))
  assert.equal(s.enemies.find(enemy => enemy.id === 'other').damageTaken, 1)
})

test('D10 Lucky Dice returns a token, redraws it and charges two resources', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.assets = [{ id: 'dice', code: '02230', exhausted: false }]; s.chaosBag = ['-1']
  const execute = state => performTest(state, 0, 'intellect', 2, { resolve: result => { state.testResult = result } })
  resolveTransaction(s, 0, { action: 'luckyDiceFixture' }, execute)
  let used = false
  while (s.pendingChoice) {
    const p = s.pendingChoice
    const optionId = p.source === 'dice' && !used ? (used = true, 'trigger')
      : p.options.find(option => ['done', 'skip'].includes(option.id))?.id || p.options[0].id
    resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId }, execute)
  }
  assert.equal(s.investigators[0].resources, 18)
  assert.deepEqual(s.testResult.cancelledTokens, ['-1'])
})

test('D10 I Have Had Worse cancels assigned harm and converts it to resources', () => {
  const s = chapterFixture('theMiskatonicMuseum'), inv = s.investigators[0]
  inv.hand = ['02261']; inv.resources = 5; inv.damage = 0
  move(s, { action: 'scenarioAction', rule: 'd9Damage', amount: 3 })
  settle(s, p => p.options.find(option => option.cardCode === '02261')?.id || (p.source === '02261' ? '3:0' : null))
  assert.equal(s.investigators[0].damage, 0)
  assert.equal(s.investigators[0].resources, 8)
})

test('D10 Maleson returns a clue to the location and redraws the encounter card', () => {
  const s = chapterFixture('theMiskatonicMuseum'), inv = s.investigators[0]
  inv.assets.push({ id: 'maleson-asset', code: '02302', exhausted: false })
  inv.clues = 1; s.clues = 1
  const loc = s.locations.find(item => item.id === inv.location), before = loc.clues || 0
  const original = s.encounterDeck.at(-1)
  move(s, { action: 'scenarioAction', rule: 'd9Encounter' })
  settle(s, p => p.source === 'maleson' ? 'trigger' : null)
  assert.equal(s.investigators[0].clues, 0)
  assert.equal(s.locations.find(item => item.id === s.investigators[0].location).clues, before + 1)
  assert.equal(s.investigators[0].assets.find(asset => asset.id === 'maleson-asset').exhausted, true)
  assert.ok(s.log.some(line => String(line).includes('混洗回遭遇牌库')), '取消的遭遇卡应混洗回牌库')
  assert.ok(s.encounterDeck.includes(original) || s.encounterDiscard.includes(original))
})

test('D10 Double or Nothing doubles both difficulty and investigation reward', () => {
  const s = fixture(), inv = s.investigators[0], loc = s.locations.find(item => item.id === inv.location)
  inv.hand = ['02026']; inv.intellect = 5; loc.shroud = 1; loc.clues = 3
  move(s, { action: 'investigate' })
  let committed = false
  settle(s, p => {
    const card = p.kind === 'commit' ? p.options.find(option => !['done', 'help'].includes(option.id)) : null
    if (card && !committed) { committed = true; return card.id }
    return null
  })
  assert.equal(s.investigators[0].clues, 2)
  assert.equal(s.locations.find(item => item.id === loc.id).clues, 1)
})

test('D10 Adaptable grants exactly two zero-level swaps per interlude without XP', () => {
  const s = createGameState({ seed: 'adaptable', playerInvestigator: '02003' }, [{ seat: 0 }])
  settle(s)
  const campaign = s.campaign, record = campaign.investigators[0]
  campaign.phase = 'interlude'; campaign.upgradesAllowed = true; record.xp = 0; record.currentScenarioIndex = campaign.scenarioIndex
  campaignCardChange(campaign, 0, '02110', 'add', 'fixture')
  for (let count = 0; count < 2; count++) {
    const added = availablePurchases(record).find(code => replacementOptions(record, code).some(option => option.adaptable))
    assert.ok(added)
    const option = replacementOptions(record, added).find(item => item.adaptable)
    const purchase = purchaseCard(campaign, 0, added, option.code)
    assert.equal(purchase.cost, 0); assert.equal(purchase.adaptable, true)
  }
  assert.equal(record.xp, 0)
  assert.equal(availablePurchases(record).some(code => replacementOptions(record, code).some(option => option.adaptable)), false)
})

test('D10 Gold Pocket Watch can repeat the investigation phase and leaves the game', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.assets = [{ id: 'gold-watch', code: '02305', exhausted: false }]
  const round = s.round
  move(s, { action: 'endTurn' })
  settle(s, p => p.source === 'gold-watch' ? 'trigger' : null)
  assert.equal(s.phase, 'investigation')
  assert.equal(s.round, round)
  assert.equal(s.investigators[0].actionsLeft, 3)
  assert.equal(s.investigators[0].assets.some(asset => asset.code === '02305'), false)
  assert.ok(s.removedFromGame.includes('02305'))
})

test('D10 Blood Pact places one doom and boosts a matching test once', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.assets = [{ id: 'blood-pact', code: '02191', exhausted: false, doom: 0 }]
  const execute = state => performTest(state, 0, 'willpower', 2, { resolve: result => { state.testResult = result } })
  resolveTransaction(s, 0, { action: 'bloodPactFixture' }, execute)
  while (s.pendingChoice) {
    const p = s.pendingChoice
    resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id,
      optionId: p.source === 'blood-pact' ? 'pay' : p.options.find(option => ['done', 'skip'].includes(option.id))?.id || p.options[0].id }, execute)
  }
  assert.equal(s.investigators[0].assets[0].doom, 1)
  assert.equal(s.testResult.value, 6)
})

test('D10 Bait and Switch moves an evaded non-elite enemy to a connecting location', () => {
  const s = fixture(), inv = s.investigators[0]
  s.locations.push({ id: 'next', name: '连接地点', connections: [inv.location], clues: 0, revealed: true })
  s.locations.find(loc => loc.id === inv.location).connections.push('next')
  inv.hand = ['02034']; inv.agility = 5
  s.enemies = [{ id: 'bait', code: 'swarmOfRats', name: '目标', location: inv.location, engagedSeat: 0,
    fight: 1, evade: 1, health: 3, damage: 1, horror: 0, damageTaken: 0, traits: [], exhausted: false }]
  inv.engaged = ['bait']
  move(s, { action: 'play', cardId: '02034' }); settle(s, p => p.source === '02034' ? 'next' : null)
  assert.equal(s.enemies[0].location, 'next')
  assert.equal(s.enemies[0].exhausted, true)
})

test('D10 Chicago Typewriter converts its action cost and extra actions into combat', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.assets = [{ id: 'typewriter', code: '02304', exhausted: false, uses: 4, usesType: 'ammo' }]
  s.enemies = [{ id: 'target', code: 'swarmOfRats', name: '目标', location: inv.location,
    fight: 8, evade: 1, health: 10, damageTaken: 0, traits: [], exhausted: true }]
  move(s, { action: 'ability', assetId: 'typewriter', abilityIndex: 0, targetId: 'target' })
  settle(s, p => p.source === 'typewriter' && p.kind === 'action' ? '2' : null)
  assert.equal(s.investigators[0].actionsLeft, 17)
  assert.equal(s.enemies[0].damageTaken, 3)
  assert.equal(s.investigators[0].assets[0].uses, 3)
})

test('D2 Zoey gains a resource on engagement and Rex discovers an extra clue on investigate success by two', () => {
  const zoey = fixture(); zoey.investigators[0].code = '02001'
  zoey.enemies = [{ id: 'rat', code: 'swarmOfRats', name: '鼠群', location: 'study', health: 1, fight: 1, evade: 1, exhausted: true }]
  move(zoey, { action: 'engage', enemyId: 'rat' }); settle(zoey, p => p.source === 'zoeyResource' ? 'trigger' : null)
  assert.equal(zoey.investigators[0].resources, 21)
  const rex = fixture(); rex.investigators[0].code = '02002'; rex.investigators[0].intellect = 4
  rex.locations[0].shroud = 2; rex.locations[0].clues = 3
  move(rex, { action: 'investigate' }); settle(rex, p => p.source === 'rexClue' ? 'trigger' : null)
  assert.equal(rex.investigators[0].clues, 2)
})

for (const [code, token, expected] of [['02003', 'eldersign', 24], ['02004', 'skull', 4], ['02005', 'eldersign', 6]]) test(`D2 investigator ${code}: elder sign / skull modifier executes in the engine`, () => {
  const s = fixture(), inv = s.investigators[0]
  inv.code = code; inv.combat = 4; inv.assets = [{ id: 'duke', code: '02014', exhausted: true }]
  s.chaosBag = [token]
  const execute = state => performTest(state, 0, 'combat', 1, { resolve: r => { state.testResult = r } })
  resolveTransaction(s, 0, { action: 'investigatorTest' }, execute)
  while (s.pendingChoice) {
    const p = s.pendingChoice
    resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id,
      optionId: p.options.find(o => ['done', 'skip'].includes(o.id))?.id || p.options[0].id }, execute)
  }
  assert.equal(s.testResult.value, expected)
  if (code === '02005') assert.equal(s.investigators[0].assets[0].exhausted, false)
})

test('D2 Pete: hand discard readies an asset once per round and survives save/replay', () => {
  const s = fixture(); s.investigators[0].code = '02005'
  s.investigators[0].hand = ['01088']; s.investigators[0].assets = [{ id: 'flashlight', code: '01087', exhausted: true }]
  move(s, { action: 'freeAction' }); const restored = clone(s); settle(s); settle(restored)
  assert.deepEqual(clone(s), clone(restored))
  assert.equal(s.investigators[0].assets[0].exhausted, false)
  assert.equal(s.investigators[0].actionsLeft, 20)
  assert.equal(s.investigators[0].discard.filter(c => c === '01088').length, 1)
  assert.ok(validateMove(s, 0, { action: 'freeAction' }))
})

test('02316–02319 的幕行动弃顶3张并选择地点结算显现', () => {
  const behavior = laterBehavior('lostInTimeAndSpace')
  const inv = { seat: 0, name: '调查员', location: 'start', assets: [], clues: 0 }
  const state = {
    acts: [{ originalCode: '02316' }],
    actIndex: 0,
    encounterDeck: ['02329', '02325', '02326'],
    encounterDiscard: [],
    investigators: [inv],
    locations: [{ id: 'start', originalCode: '02320' }],
    enemies: [],
    scenarioZones: {},
    scenarioFlags: {},
    campaign: { records: {} },
    numInvestigators: 1,
  }
  for (const code of ['02316', '02317', '02318', '02319']) {
    state.acts[0].originalCode = code
    assert.ok(behavior.actions(state, inv).some(move => move.rule === 'searchEncounterLocations'), code)
  }
  state.acts[0].originalCode = '02316'
  let placed = null
  let discarded = 0
  behavior.performAction(state, inv, { rule: 'searchEncounterLocations' }, {
    choose(request) {
      assert.equal(request.source, '02316')
      return '1'
    },
    placeEncounterLocation(code) {
      placed = code
      const location = { id: `drawn-${code}`, originalCode: code }
      state.locations.push(location)
      return location
    },
    discardRandom(_seat, amount) { discarded += amount },
  })
  assert.equal(placed, '02325')
  assert.equal(discarded, 1)
  assert.deepEqual(state.encounterDeck, [])
  assert.deepEqual(state.encounterDiscard, ['02326', '02329'])
})

// --- Regression tests for the 2026 card-implementation audit fixes ---

test('fix: Clover Club agenda 1b advances directly to 2b without deleting agenda 2', () => {
  const s = clubFixture('fix-club-chain')
  s.campaign.scenarioResults.push({ scenarioId: 'extracurricularActivity', resolution: 'r2' })
  s.doom = s.agendas[0].doomThreshold
  move(s, { action: 'endTurn' })
  settle(s)
  assert.equal(s.agendas[s.agendaIndex].originalCode, '02065')
  assert.ok(s.agendas.some(agenda => agenda.originalCode === '02064'))
  assert.ok(!s.locations.some(location => location.id === 'laBellaLuna'))
})

test('fix: Where Doom Awaits act 2 cannot place clues on non-Altered locations', () => {
  const s = chapterFixture('whereDoomAwaits')
  const behavior = laterBehavior('whereDoomAwaits')
  s.actIndex = 1
  const plain = { id: 'plain', originalCode: '02285', traits: ['Dunwich', 'Woods'] }
  const altered = { id: 'altered', originalCode: '02289', traits: ['Dunwich', 'Woods', 'Altered'] }
  assert.equal(behavior.cluesOnReveal(s, plain), 0)
  assert.equal(behavior.cluesOnReveal(s, altered), null)
})

test('fix: Doom Awaits paths hide whether they are Altered until revealed', () => {
  const s = chapterFixture('whereDoomAwaits')
  const paths = Object.values(s.scenario.locations).filter(loc => ['02285', '02289'].includes(loc.originalCode))
  assert.ok(paths.length >= 2)
  assert.ok(paths.every(path => path.unrevealedActualName && ['分歧之路', '异变之路'].includes(path.name)))
})

test('fix: Kidnapped pools only unique characters as Yog-Sothoth sacrifices', () => {
  const s = chapterFixture('bloodOnTheAltar')
  s.scenarioZones.sacrifices = ['02149', '02217', '02218']
  s.scenarioZones.sacrificed = []
  const behavior = laterBehavior('bloodOnTheAltar')
  const api = { random: () => 0 }
  behavior.agendaReveal(s, { originalCode: '02196' }, api)
  behavior.agendaReveal(s, { originalCode: '02197' }, api)
  assert.equal(s.scenarioZones.sacrificed.length, 2)
  behavior.resolution(s, 'noResolution', [], api)
  assert.ok(!s.campaign.records.sacrificedToYogSothoth.includes('02149'))
  assert.ok(s.campaign.records.sacrificedToYogSothoth.every(code => ALL_CARDS[code]?.unique))
})

test('fix: Hunting Horror attaches Shadow-spawned when drawn from the encounter deck', () => {
  const s = chapterFixture('theMiskatonicMuseum')
  s.scenarioZones.void = { code: '02141', resources: 2 }
  s.encounterDeck = [...Array(5).fill('02083'), '02141']
  move(s, { action: 'scenarioAction', rule: 'd9Encounter' })
  settle(s)
  const horror = s.enemies.find(enemy => enemy.code === '02141')
  assert.ok(horror)
  assert.equal(horror.shadowSpawned, true)
  assert.equal(horror.shadowResources, 3)
  assert.equal(horror.massive, true)
})

test('fix: Museum cultist token does not teleport an in-play Hunting Horror', () => {
  const s = chapterFixture('theMiskatonicMuseum')
  const horror = { id: 'horror-fix', code: '02141', location: s.locations.at(-1).id, shadowResources: 1 }
  s.enemies = [horror]
  const before = horror.location
  dunwichChaosAfterTest('theMiskatonicMuseum', s, s.investigators[0], { success: false, drawn: ['cultist'] }, {
    spawn: () => assert.fail('must not spawn another Horror'), info() {},
  })
  assert.equal(horror.location, before)
})

test('fix: Passage into the Veil damages story allies without a slot field', () => {
  const s = chapterFixture('theMiskatonicMuseum')
  const inv = s.investigators[0]
  inv.assets = [{ id: 'harold', code: '02138' }, { id: 'student', code: '02149' }]
  const damaged = []
  laterBehavior('theMiskatonicMuseum').resolveEncounter(s, inv, { code: '02144' }, {
    test: (_seat, _skill, _difficulty, resolve) => resolve({ success: false, value: 1 }),
    choose: () => 'damage',
    directDamage: () => {},
    damageAsset: (_seat, id, n) => damaged.push([id, n]),
  })
  assert.ok(damaged.some(([id]) => id === 'harold'))
})

test('fix: Exhibit Hall entry ends the turn', () => {
  const s = chapterFixture('theMiskatonicMuseum')
  let endedSeat = null
  const inv = s.investigators[0]
  const rule = registeredEntry('02132').locationRule
  rule.onEnter.effect(s, { id: 'exhibit', originalCode: '02132', traits: ['Miskatonic'] },
    { endTurn: seat => { endedSeat = seat } }, inv)
  assert.equal(endedSeat, inv.seat)
})

test('fix: Undimensioned and Unseen records calming or warning the townsfolk', () => {
  const s = chapterFixture('undimensionedAndUnseen')
  assert.ok(s.campaign.records.youCalmedTheTownsfolk || s.campaign.records.youWarnedTheTownsfolk)
})

test('fix: Prismatic Cascade is discarded when its last clue is removed', () => {
  const s = chapterFixture('lostInTimeAndSpace')
  const loc = { id: 'prismatic', name: '菱柱瀑布', originalCode: '02325', clues: 0 }
  s.locations.push(loc)
  const removed = []
  laterBehavior('lostInTimeAndSpace').cluesRemoved(s, loc, 1, { remove: id => removed.push(id), info() {} })
  assert.deepEqual(removed, ['prismatic'])
  assert.ok(s.encounterDiscard.includes('02325'))
})

test('fix: Wizard of Yog-Sothoth attacks when a Hex is drawn from a player deck', () => {
  const s = fixture()
  const inv = s.investigators[0]
  const wizard = { id: 'wizard', code: '02087', location: inv.location, engagedSeat: 0, fight: 1, evade: 1,
    health: 5, damage: 2, horror: 0, traits: ['Humanoid', 'Cultist'] }
  s.enemies = [wizard]
  inv.engaged = ['wizard']
  inv.deck = ['01171', '01088']
  inv.damage = 0
  move(s, { action: 'draw' })
  settle(s)
  assert.equal(s.investigators[0].damage, 2)
})

test('fix: attached weaknesses are not duplicated in the discard pile on reveal', () => {
  const s = fixture()
  s.investigators[0].deck = ['02007', '01088', '01088']
  s.encounterDeck = ['ghoulMinion']
  move(s, { action: 'draw' })
  settle(s)
  assert.equal(s.investigators[0].discard.filter(code => code === '02007').length, 0)
})

test('fix: Beginner\'s Luck discards until a Criminal enemy is discarded', () => {
  const s = chapterFixture('theHouseAlwaysWins')
  s.agendaIndex = 0
  const seen = []
  const spawned = []
  club.behavior.actReveal(s, { originalCode: '02066' }, {
    place() {},
    discardUntilEnemy: (seat, predicate) => { seen.push([seat, predicate]); return '02078' },
    spawn: (code, location) => spawned.push([code, location]),
    shuffleEncounterDeck() {},
  })
  assert.equal(seen.length, 1)
  const criminal = { traits: ['Criminal'] }
  assert.equal(seen[0][1](criminal), true)
  assert.equal(seen[0][1]({ traits: ['Monster'] }), false)
  assert.deepEqual(spawned, [['02078', 'darkenedHall']])
})

test('fix: 迷失时空剧情地点入场即与在场遭遇地点按印刷符号双向相连（不补单向印刷连接）', () => {
  const s = chapterFixture('lostInTimeAndSpace')
  const inv = s.investigators[0]
  // 遭遇地点由 placeEncounterLocation 放入场，实例 id 带序号。
  const stepsDef = Object.values(s.scenario.locations).find(loc => loc.originalCode === '02327')
  const steps = { ...JSON.parse(JSON.stringify(stepsDef)), id: 'location02327-99', revealed: true, clues: 1 }
  s.locations.push(steps)
  inv.location = 'location02320'

  // 幕 1 推进：把「宇宙的边缘」放入场（02316 onReveal）。
  placeLocation(s, 'location02321', [])
  const edge = s.locations.find(loc => loc.id === 'location02321')
  assert.ok(edge.connections.includes(steps.id), '宇宙的边缘 → 伊哈格尔的阶梯 缺失')
  assert.ok(steps.connections.includes(edge.id), '伊哈格尔的阶梯 → 宇宙的边缘 缺失')
  inv.clues = 2
  inv.location = steps.id
  inv.actionsLeft = 3
  assert.equal(validateMove(s, inv.seat, { action: 'move', locationId: edge.id }), null)

  // 幕 3 推进：把「时间缝隙」放入场（02318 onReveal）。
  placeLocation(s, 'location02322', [])
  const tear = s.locations.find(loc => loc.id === 'location02322')
  assert.ok(tear.connections.includes(steps.id), '时间缝隙 → 伊哈格尔的阶梯 缺失')
  assert.ok(steps.connections.includes(tear.id), '伊哈格尔的阶梯 → 时间缝隙 缺失')
  // 印刷上「另一个次元」只连 Square/Diamond/Triangle，不能补成 hub ↔ 时间缝隙。
  const hub = s.locations.find(loc => loc.id === 'location02320')
  assert.equal(hub.connections.includes(tear.id), false)
  // 站上时间缝隙、持有 2 线索时可以撤退（幕 4 的达成条件）。
  inv.location = tear.id
  inv.clues = 2
  assert.ok(legalMoves(s, inv.seat).some(move => move.action === 'scenarioAction' && move.rule === 'resignBeyond'))

  // 旧的 placeEncounterLocation 会重算并覆盖所有连接，把手写连接冲掉；
  // 现在只剪掉失效 id、再增量补符号边，手写连接必须存活。
  edge.connections.push(hub.id)
  s.encounterDeck = ['02327', '02327', '02327']
  inv.location = hub.id
  move(s, { action: 'scenarioAction', rule: 'searchEncounterLocations' })
  settle(s)
  assert.ok(s.locations.some(loc => loc.id === 'location02327-1'), '幕行动应放入一张遭遇地点')
  // 引擎在待决选择回放后会重建 state，重新取一次对象再断言。
  const edgeAfter = s.locations.find(loc => loc.id === 'location02321')
  assert.ok(edgeAfter.connections.includes(hub.id), '放置遭遇地点时手写连接被冲掉了')
  assert.equal(edgeAfter.connections.includes('location02327'), false, '失效的基础 id 应被剪掉')
})
