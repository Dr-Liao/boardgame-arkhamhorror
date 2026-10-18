import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle, validateMove } from './core-fixture.mjs'
import { getStat, legalMoves } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { behavior as phantom } from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js'
import { scenario as phantomScenario } from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/definition.js'
import { behavior as echoes } from '../content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js'
import { scenario as echoesScenario } from '../content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/definition.js'
import { behavior as oath } from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js'
import { behavior as king } from '../content/campaigns/thePathToCarcosa/scenarios/theLastKing/behavior.js'
import { behavior as stars, placeAgendaDoom } from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js'
import { scenario as starsScenario } from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/definition.js'
import { behavior as curtain } from '../content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js'
import { scenario as curtainScenario } from '../content/campaigns/thePathToCarcosa/scenarios/curtainCall/definition.js'
import { scenario as pallidScenario } from '../content/campaigns/thePathToCarcosa/scenarios/thePallidMask/definition.js'

function finish(state, select = () => null) {
  for (let index = 0; index < 60 && state.pendingChoice; index++) {
    const choice = state.pendingChoice
    const id = select(choice) ?? choice.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    move(state, { action: 'choose', choiceId: choice.id, optionId: id })
  }
}

test('03024 Fieldwork opens its reaction window after a move to a location with a clue', () => {
  const state = fixture()
  asset(state, '03024')
  const here = state.locations[0]
  state.locations.push({ ...structuredClone(here), id: 'next', name: '邻室', clues: 1, connections: ['study'] })
  here.connections = ['next']
  move(state, { action: 'move', locationId: 'next' })
  assert.ok(state.pendingChoice)
  assert.match(state.pendingChoice.prompt, /实地调查/)
  move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'trigger' })
  assert.ok(state.investigators[0].fieldwork)
})

test('03030 Daring Maneuver is playable on the would-succeed window and adds +2', () => {
  const state = fixture()
  state.investigators[0].hand = ['03030']
  state.investigators[0].intellect = 5
  state.locations[0].shroud = 5
  state.locations[0].clues = 1
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  finish(state, choice => choice.options.find(option => option.cardCode === '03030')?.id)
  assert.ok(state.investigators[0].discard.includes('03030'))
  assert.equal(state.investigators[0].clues, 1)
})

test('03267 Narrow Escape cancels an attack of opportunity', () => {
  const state = fixture()
  state.investigators[0].hand = ['03267']
  enemy(state, { id: 'e1', engagedSeat: 0, damage: 2 })
  move(state, { action: 'draw' })
  finish(state, choice => choice.options.find(option => option.cardCode === '03267')?.id)
  assert.equal(state.investigators[0].damage, 0)
  assert.ok(state.investigators[0].narrowEscape)
})

test('03269 St. Hubert Key heals horror instead of being defeated', () => {
  const state = fixture()
  asset(state, '03269')
  state.investigators[0].horror = state.investigators[0].maxSanity
  enemy(state, { id: 'e1', engagedSeat: 0, horror: 1, damage: 0 })
  move(state, { action: 'draw' })
  finish(state, choice => choice.options.find(option => option.id === 'trigger')?.id)
  assert.equal(state.investigators[0].defeated, false)
})

test('03304 Eat Lead spends extra ammo and reveals extra chaos tokens', () => {
  const state = fixture()
  const gun = asset(state, '03190')
  enemy(state, { id: 'e1', engagedSeat: 0, fight: 1, health: 20 })
  state.investigators[0].hand = ['03304']
  state.investigators[0].combat = 6
  state.chaosBag = ['0', '-1', '-2']
  move(state, { action: 'ability', assetId: gun.id, abilityIndex: 0, enemyId: 'e1' })
  let sawTokenChoice = false
  finish(state, choice => {
    if (choice.kind === 'token') { sawTokenChoice = true; return choice.options[0].id }
    return choice.options.find(option => option.cardCode === '03304')?.id
      ?? choice.options.find(option => option.id === '1')?.id
  })
  assert.equal(sawTokenChoice, true)
  assert.equal(state.investigators[0].assets.find(item => item.code === '03190').uses, 2)
})

test('03305 Armor of Ardennes cancels one assigned damage', () => {
  const state = fixture()
  const armor = asset(state, '03305')
  enemy(state, { id: 'e1', engagedSeat: 0, damage: 2 })
  move(state, { action: 'draw' })
  finish(state, choice => {
    if (choice.kind === 'assign-damage') return armor.id
    if (choice.options.some(option => option.id === 'trigger')) return 'trigger'
    return null
  })
  const live = state.investigators[0].assets.find(item => item.code === '03305')
  assert.equal(live.exhausted, true)
  assert.equal(live.damage, 1)
})

test('03310 Cheat Death prevents defeat and heals 2 damage/horror', () => {
  const state = fixture()
  state.investigators[0].hand = ['03310']
  state.investigators[0].damage = state.investigators[0].maxHealth - 1
  enemy(state, { id: 'e1', engagedSeat: 0, damage: 2 })
  move(state, { action: 'draw' })
  finish(state, choice => choice.options.find(option => option.cardCode === '03310')?.id)
  assert.equal(state.investigators[0].defeated, false)
})

test('03311 Time Warp restores the state before the action', () => {
  const state = fixture()
  state.investigators[0].hand = ['03311']
  const here = state.locations[0]
  state.locations.push({ ...structuredClone(here), id: 'next', name: '邻室', clues: 1, connections: ['study'] })
  here.connections = ['next']
  move(state, { action: 'move', locationId: 'next' })
  finish(state, choice => choice.options.find(option => option.cardCode === '03311')?.id)
  assert.equal(state.investigators[0].location, 'study')
  assert.equal(state.investigators[0].hand.includes('03311'), false)
})

test('03313 Newspaper discovers an additional clue when the investigator has none', () => {
  const state = fixture()
  asset(state, '03313')
  state.investigators[0].intellect = 6
  state.locations[0].shroud = 1
  state.locations[0].clues = 2
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  finish(state, choice => choice.options.find(option => option.id === 'trigger')?.id)
  assert.equal(state.investigators[0].clues, 2)
})

test('03314 Infighting prevents non-elite enemy attacks in the enemy phase', () => {
  const state = fixture()
  state.investigators[0].hand = ['03314']
  enemy(state, { id: 'e1', engagedSeat: 0, damage: 2 })
  move(state, { action: 'endTurn' })
  finish(state, choice => choice.options.find(option => option.cardCode === '03314')?.id)
  assert.equal(state.investigators[0].damage, 0)
})

test('03190 ignores retaliate and 03309 does not provoke on play', () => {
  const retaliate = fixture()
  const gun = asset(retaliate, '03190')
  enemy(retaliate, { id: 'e1', retaliate: true, fight: 5, damage: 1 })
  retaliate.chaosBag = ['-5']
  move(retaliate, { action: 'ability', assetId: gun.id, abilityIndex: 0, enemyId: 'e1' })
  settle(retaliate)
  assert.equal(retaliate.investigators[0].damage, 0)

  const play = fixture()
  play.investigators[0].hand = ['03309']
  enemy(play, { id: 'e2', engagedSeat: 0, damage: 1 })
  move(play, { action: 'play', cardId: '03309' })
  settle(play)
  assert.equal(play.investigators[0].damage, 0)
})

test('03194 automatically evades on success by 2', () => {
  const state = fixture()
  enemy(state, { id: 'e1', engagedSeat: 0, fight: 1, evade: 1, health: 10 })
  state.investigators[0].hand = ['03194']
  state.investigators[0].combat = 6
  state.investigators[0].agility = 6
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '03194' })
  settle(state)
  const live = state.enemies[0]
  assert.equal(live.exhausted, true)
  assert.equal(live.engagedSeat, null)
})

test('03229 cannot be played after another action', () => {
  const state = fixture()
  enemy(state, { id: 'e1', engagedSeat: 0 })
  state.investigators[0].hand = ['03229']
  move(state, { action: 'draw' })
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '03229' }), '只能作为本回合的第一个行动打出')
})

test('03149 Charles Ross provides a one-use item discount', () => {
  const state = fixture()
  const charles = asset(state, '03149')
  state.investigators[0].hand = ['03020']
  move(state, { action: 'ability', assetId: charles.id, abilityIndex: 0 })
  const before = state.investigators[0].resources
  move(state, { action: 'play', cardId: '03020' })
  assert.equal(before - state.investigators[0].resources, 2)
})

test('03232 Shortcut grants a location move ability', () => {
  const state = fixture()
  state.investigators[0].hand = ['03232']
  const here = state.locations[0]
  state.locations.push({ ...structuredClone(here), id: 'next', name: '邻室', connections: ['study'] })
  here.connections = ['next']
  move(state, { action: 'play', cardId: '03232' })
  const shortcut = legalMoves(state).find(item => item.action === 'shortcutMove')
  assert.ok(shortcut)
  move(state, shortcut)
  assert.equal(state.investigators[0].location, 'next')
})

test('03236 Scrying can target the encounter deck', () => {
  const state = fixture()
  const scrying = asset(state, '03236')
  state.encounterDeck = ['ghoulMinion', 'dissonantVoices', 'ghoulMinion']
  move(state, { action: 'ability', assetId: scrying.id, abilityIndex: 0 })
  assert.equal(state.pendingChoice.kind, 'deck')
  assert.ok(state.pendingChoice.options.some(option => option.id === 'encounter'))
})

test('03230 First Aid can heal an Ally asset', () => {
  const state = fixture()
  const aid = asset(state, '03230')
  asset(state, '01033', { damage: 1 })
  move(state, { action: 'ability', assetId: aid.id, abilityIndex: 0 })
  assert.ok(state.pendingChoice.options.some(option => String(option.id).startsWith('asset:')))
})

test('03306 Eidetic Memory pays the copied event cost', () => {
  const state = fixture()
  state.investigators[0].hand = ['03306']
  state.investigators[0].discard = ['01037']
  state.investigators[0].resources = 10
  move(state, { action: 'play', cardId: '03306' })
  move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: state.pendingChoice.options[0].id })
  assert.equal(state.investigators[0].resources, 8)
})

test('03223 Twin Suns resolves its test and choice', () => {
  const calls = []
  const state = {
    round: 1, phase: 'investigation', actIndex: 0, doom: 2, numInvestigators: 1,
    campaign: { leadSeat: 0, records: { doubt: 0, conviction: 0 } },
    investigators: [{ seat: 0, name: '甲', location: 'a', horror: 0, damage: 0, clues: 1, resources: 5, assets: [], threat: [], intellect: 3, willpower: 4 }],
    locations: [{ id: 'a', shroud: 3, clues: 1, attachments: [] }], enemies: [],
    encounterDeck: [], encounterDiscard: [], scenarioFlags: {},
  }
  const api = {
    test: (seat, skill, difficulty, resolve) => { calls.push(['test', skill, difficulty]); resolve({ success: false, difficulty, value: 0 }) },
    choose: request => { calls.push(['choose', request.prompt]); return request.options[0].id },
    horror: (seat, amount) => { calls.push(['horror', amount]) },
    damage: (seat, amount) => { calls.push(['damage', amount]) },
  }
  phantom.resolveEncounter(state, state.investigators[0], { code: '03223', originalCode: '03223' }, api)
  assert.equal(calls[0][0], 'test')
  assert.equal(state.doom, 1)
})

test('03227 Haunted checks Doubt/Conviction and tests the opposite stat', () => {
  const calls = []
  const state = {
    round: 1, phase: 'investigation', actIndex: 0, doom: 0, numInvestigators: 1,
    campaign: { leadSeat: 0, records: { doubt: 0, conviction: 2 } },
    investigators: [{ seat: 0, name: '甲', location: 'a', horror: 0, damage: 0, clues: 0, resources: 5, assets: [], threat: [], intellect: 3, willpower: 4 }],
    locations: [{ id: 'a', shroud: 3, clues: 0, attachments: [] }], enemies: [],
    encounterDeck: [], encounterDiscard: [], scenarioFlags: {},
  }
  const api = {
    test: (seat, skill, difficulty, resolve) => { calls.push([skill, difficulty]); resolve({ success: false, difficulty, value: 0 }) },
    damage: (seat, amount) => { calls.push(['damage', amount]) },
    horror: () => {},
  }
  phantom.resolveEncounter(state, state.investigators[0], { code: '03227', originalCode: '03227' }, api)
  assert.deepEqual(calls[0], ['willpower', 3])
  assert.deepEqual(calls[1], ['damage', 2])
})

test('Paris location abilities are represented in definitions and behavior', () => {
  const opera = phantomScenario.locationVariants.operaGarnier
  assert.equal(opera.find(location => location.originalCode === '03212').commitIconMultiplier, 2)
  assert.equal(opera.find(location => location.originalCode === '03213').doubleBaseSkill, true)
  const state = {
    round: 1, scenarioFlags: {}, campaign: { records: {} },
    investigators: [{ seat: 0, location: 'canalSaintMartin', defeated: false, resigned: false }],
    locations: [
      { id: 'canalSaintMartin', originalCode: '03216', connections: ['leMarais'], revealed: true },
      { id: 'leMarais', originalCode: '03217', connections: [], revealed: true },
    ],
  }
  let moved = null
  phantom.afterEvade(state, state.investigators[0], { id: 'e' }, { success: true }, {
    choose: request => request.options[0].id, moveEnemy: (enemy, destination) => { moved = destination },
  })
  assert.equal(moved, 'leMarais')
  state.investigators[0].location = 'gardensOfLuxembourg'
  assert.deepEqual(phantom.enemyConnections(state, { traits: ['Byakhee'] }, { id: 'x' }), ['gardensOfLuxembourg'])
})

test('Echoes locations and Tattered Cloak apply their modifiers', () => {
  assert.equal(echoesScenario.locations.groundMuseum.noIntellectBoost, true)
  assert.equal(echoesScenario.locations.secondMuseum.noIntellectBoost, true)
  const state = {
    investigators: [{ location: 'peabodysOffice', assets: [{ code: '03141' }] }],
  }
  assert.equal(echoes.locationShroudModifier(state, { id: 'peabodysOffice', originalCode: '03137' }), -2)
  const game = fixture()
  asset(game, '03143')
  game.investigators[0].horror = game.investigators[0].maxSanity - 2
  assert.equal(getStat(game, game.investigators[0], 'willpower'), game.investigators[0].willpower + 1)
})

test('Asylum halls apply their Possessed bonuses', () => {
  const state = {
    round: 2, scenarioFlags: {},
    investigators: [{ seat: 0, location: 'westernHall168', defeated: false, resigned: false }],
    locations: [{ id: 'westernHall168', originalCode: '03168' }, { id: 'westernHall169', originalCode: '03169' }],
  }
  assert.deepEqual(oath.enemyAttackModifier(state, {
    location: 'westernHall169', traits: ['Possessed'], code: 'x', damage: 1, horror: 1,
  }), { horror: 1 })
  const drawn = []
  oath.enemyDefeated(state, { location: 'westernHall168', traits: ['Possessed'], code: 'x', defeatedBy: 0 }, {
    drawCards: (seat, amount) => drawn.push([seat, amount]),
  })
  assert.deepEqual(drawn, [[0, 1]])
})

test('03064 places eliminated investigators clues on the act', () => {
  const state = {
    actClues: 0,
    investigators: [{ seat: 0, clues: 3 }, { seat: 1, clues: 1 }],
  }
  assert.equal(king.investigatorEliminated(state, state.investigators[0], 3), true)
  assert.equal(state.actClues, 3)
  assert.equal(state.investigators[0].clues, 0)
})

test('Black Stars Rise static and location effects are wired', () => {
  assert.equal(stars.encounterGainsSurge({ agendas: [{ originalCode: '03276a' }], agendaIndex: 0 }, '01136'), true)
  assert.equal(stars.enemyStatModifier({ agendas: [{ originalCode: '03280' }], agendaIndex: 0 },
    { traits: ['Monster'] }, 'fight'), 1)
  assert.equal(stars.commitIconMultiplier({ scenarioFlags: { agendaDecks: { a: { doom: 1 }, c: { doom: 2 } } } },
    {}, { originalCode: '03286' }), 2)
  assert.equal(stars.locationShroudModifier({ scenarioFlags: { agendaDecks: { a: { doom: 2 }, c: { doom: 1 } } } },
    { originalCode: '03288' }), -1)

  const state = {
    scenarioFlags: { route: 'below', agendaDecks: { a: { id: 'a', doom: 0, index: 0, cards: [] }, c: { id: 'c', doom: 0, index: 0, cards: [] } } },
    locations: [{ id: 'outerWall', originalCode: '03285' }, { id: 'northTower', originalCode: '03287' }],
    investigators: [{ seat: 0, location: 'outerWall', defeated: false, resigned: false }],
    scenario: starsScenario,
  }
  const events = []
  placeAgendaDoom(state, 'a', 1, { damage: (seat, amount) => events.push(['damage', seat, amount]) })
  assert.deepEqual(events, [['damage', 0, 1]])
})

test('Curtain Call act 3c advances when the Pallid Mask is discarded', () => {
  const state = {
    actIndex: 0,
    acts: [{ originalCode: '03047c' }],
    advance: 0,
  }
  curtain.enemyDiscarded(state, { code: '03059', originalCode: '03059' }, { advanceAct: () => { state.advance++ } })
  assert.equal(state.advance, 1)
})

test('03150 Forewarned is not offered for a non-treachery encounter card', () => {
  const state = fixture()
  state.investigators[0].hand = ['03150']
  state.encounterDeck = ['ghoulMinion']
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.pendingChoice, null)
  assert.ok(state.investigators[0].hand.includes('03150'))
})

test('Lighting Box, museum and catacomb definition flags are present', () => {
  assert.equal(curtainScenario.locations.lightingBox.playCostIncrease, 2)
  assert.equal(echoesScenario.locations.groundMuseum.noIntellectBoost, true)
  assert.equal(echoesScenario.locations.secondMuseum.noIntellectBoost, true)
  assert.equal(pallidScenario.locations.catacomb3.investigateSkill, 'willpower')
  assert.equal(pallidScenario.locations.catacomb4.handSlotsPenalty, 1)
  assert.equal(starsScenario.locations.outerWall.originalCode, '03285')
})

