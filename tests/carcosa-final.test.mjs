import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTransaction, requestChoice } from '../src/engine/resolution.js'
import { randomValue } from '../src/engine/rules-state.js'
import { advanceAct, applyMove, createGameState, startScenario } from '../src/engine/engine.js'
import { settle } from './core-fixture.mjs'
import { manifest as campaignManifest } from '../content/campaigns/thePathToCarcosa/manifest.js'
import * as blackStars from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/index.js'
import {
  setupPlan as blackStarsPlan, advanceAgendaDeck,
} from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js'
import * as dimCarcosa from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/index.js'
import {
  actTwoVersion, setupPlan as dimCarcosaPlan,
} from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js'

const clone = value => JSON.parse(JSON.stringify(value))

function campaign(records = {}) {
  return {
    leadSeat: 0,
    records: { doubt: 0, conviction: 0, ...records },
    investigators: {
      0: { id: 'investigator-7', seat: 0, name: '甲', status: 'active', trauma: { physical: 0, mental: 0 } },
      1: { id: 'investigator-11', seat: 1, name: '乙', status: 'active', trauma: { physical: 0, mental: 0 } },
    },
    trauma: {
      0: { physical: 0, mental: 0 },
      1: { physical: 0, mental: 0 },
    },
  }
}

function state(records = {}) {
  return {
    revision: 0,
    rngState: 12345,
    campaign: campaign(records),
    investigators: [
      { seat: 0, campaignId: 'investigator-7', hand: [], deck: [], discard: [], sanity: 7, horror: 0 },
      { seat: 1, campaignId: 'investigator-11', hand: [], deck: [], discard: [], sanity: 6, horror: 0 },
    ],
    scenarioFlags: {},
    scenarioZones: {},
    encounterDeck: [],
    encounterDiscard: [],
    enemies: [],
    locations: [],
    chaosBag: [],
    numInvestigators: 2,
  }
}

test('M3 verifies the two final scenarios and the full campaign is open', () => {
  assert.equal(blackStars.manifest.status, 'verified')
  assert.equal(dimCarcosa.manifest.status, 'verified')
  assert.equal(campaignManifest.status, 'playable')
  assert.equal(blackStars.manifest.catalogReferenceOnly, undefined)
  assert.equal(dimCarcosa.manifest.catalogReferenceOnly, undefined)
})

test('Black Stars Rise transactionally selects one internally consistent hidden route and two agenda decks', () => {
  const first = state()
  const second = clone(first)
  const execute = draft => {
    const plan = blackStarsPlan(draft, { random: () => randomValue(draft) })
    draft.result = clone(plan)
  }
  resolveTransaction(first, 0, { action: 'setup' }, execute)
  resolveTransaction(second, 0, { action: 'setup' }, execute)
  assert.deepEqual(second, first)
  assert.deepEqual(Object.keys(first.result.agendaDecks), ['a', 'c'])
  assert.equal(first.result.agendaDecks.a.cards.length, 3)
  assert.equal(first.result.agendaDecks.c.cards.length, 3)
  if (first.result.route === 'below') {
    assert.equal(first.result.variants.chapelOfStAubert, '03296')
    assert.equal(first.result.variants.abbeyTower, '03299')
    assert.equal(first.result.agendaDecks.a.cards[1], '03276b')
    assert.equal(first.result.agendaDecks.c.cards[1], '03279a')
  } else {
    assert.equal(first.result.variants.chapelOfStAubert, '03297')
    assert.equal(first.result.variants.abbeyTower, '03298')
    assert.equal(first.result.agendaDecks.a.cards[1], '03276a')
    assert.equal(first.result.agendaDecks.c.cards[1], '03279b')
  }
})

test('Black Stars Rise checks the opposing agenda at the printed 3/4 doom boundary', () => {
  for (const [doom, record] of [[2, 'conviction'], [3, 'doubt'], [4, 'doubt']]) {
    const draft = state()
    draft.scenarioFlags = {
      route: 'below',
      agendaDecks: {
        a: { id: 'a', index: 0, doom: 0, cards: ['03275', '03276b', '03277'] },
        c: { id: 'c', index: 0, doom, cards: ['03278', '03279a', '03280'] },
      },
    }
    const api = { shuffleEncounterDeck() {}, finish() {}, spawn() {} }
    advanceAgendaDeck(draft, 'a', api)
    assert.equal(draft.campaign.records[record], 1)
    assert.equal(draft.campaign.records[record === 'doubt' ? 'conviction' : 'doubt'], 0)
  }
})

test('Black Stars Rise stores Ashleigh using the distinct interviewed/slain card ids', () => {
  const interviewed = state({ vipsInterviewed: ['03080'], vipsSlain: [] })
  interviewed.locationVariants = {}
  interviewed.scenario = clone(blackStars.scenario)
  blackStars.behavior.setupLocations(interviewed, [], { random: () => 0 })
  assert.equal(interviewed.scenarioFlags.ashleighDoomAbility, true)

  const slain = state({ vipsInterviewed: [], vipsSlain: [] })
  slain.victoryDisplay = [{ originalCode: '03069b' }]
  slain.chaosBag = ['0']
  slain.campaign.chaosBag = ['0']
  blackStars.behavior.resolution(slain, 'r1')
  assert.deepEqual(slain.campaign.records.vipsSlain, ['03069'])
})

test('Black Stars Rise resolves all seven printed location actions and their access conditions', () => {
  const draft = state()
  draft.scenario = clone(blackStars.scenario)
  draft.doom = 2
  draft.scenarioFlags = {
    route: 'below',
    agendaDecks: {
      a: { id: 'a', index: 0, doom: 2, cards: ['03275', '03276b', '03277'] },
      c: { id: 'c', index: 0, doom: 0, cards: ['03278', '03279a', '03280'] },
    },
  }
  const inv = draft.investigators[0]
  Object.assign(inv, { location: 'porteDeLAvancee', resources: 5, clues: 0,
    damage: 2, horror: 0, maxSanity: 7, hand: ['01088', '01089', '01090'], assets: [] })
  const setLocation = (id, code, clues = 0, shroud = 2) => {
    draft.locations = [{ id, originalCode: code, name: id, revealed: true, clues, shroud, connections: [] }]
    inv.location = id
  }
  const action = rule => blackStars.behavior.actions(draft, inv).find(move => move.rule === rule)

  setLocation('porteDeLAvancee', '03283')
  blackStars.behavior.performAction(draft, inv, action('shiftAgendaDoom'), {})
  assert.equal(draft.scenarioFlags.agendaDecks.a.doom, 1)
  assert.equal(draft.scenarioFlags.agendaDecks.c.doom, 1)
  assert.equal(draft.locations[0].clues, 2)

  setLocation('choeurGothique', '03292')
  blackStars.behavior.performAction(draft, inv, action('choeurGothiqueHeal'), {
    healDamage(_seat, amount) { inv.damage = Math.max(0, inv.damage - amount) },
  })
  assert.equal(inv.damage, 0)
  assert.equal(draft.scenarioFlags.choeurGothiqueUsed, true)

  setLocation('cloister', '03294')
  blackStars.behavior.performAction(draft, inv, action('findGuide'), {
    test(_seat, skill, difficulty, resolve) {
      assert.deepEqual([skill, difficulty], ['willpower', 3])
      resolve({ success: true })
    },
  })
  assert.equal(draft.scenarioFlags.foundGuide, true)

  setLocation('knightsHall', '03295')
  blackStars.behavior.performAction(draft, inv, action('findTowerKey'), {
    test(_seat, skill, difficulty, resolve) {
      assert.deepEqual([skill, difficulty], ['agility', 2])
      resolve({ success: true })
    },
  })
  assert.equal(draft.scenarioFlags.foundTowerKey, true)

  setLocation('chapelOfStAubert', '03296')
  blackStars.behavior.performAction(draft, inv, action('takeChapelHorror'), {
    choose: () => '2', horror(_seat, amount) { inv.horror += amount },
  })
  assert.equal(inv.horror, 2)
  inv.horror = 4
  assert.equal(blackStars.behavior.investigationError(draft, inv, draft.locations[0]), null)

  setLocation('abbeyTower', '03298')
  blackStars.behavior.performAction(draft, inv, action('discardTowerCards'), {
    choose: () => '3', discardChosen(_seat, amount) { inv.hand.splice(0, amount) },
  })
  assert.equal(inv.hand.length, 0)
  assert.equal(blackStars.behavior.investigationError(draft, inv, draft.locations[0]), null)

  draft.scenarioFlags.foundGuide = false
  draft.scenarioFlags.foundTowerKey = false
  assert.match(blackStars.behavior.investigatorEntryError(draft, { originalCode: '03296' }), /向导/)
  assert.match(blackStars.behavior.investigatorEntryError(draft, { originalCode: '03298' }), /钥匙/)
})

test('Dim Carcosa selects act II at 5/6 and majority boundaries', () => {
  assert.equal(actTwoVersion(state({ doubt: 3, conviction: 2 })), 1)
  assert.equal(actTwoVersion(state({ doubt: 4, conviction: 2 })), 2)
  assert.equal(actTwoVersion(state({ doubt: 2, conviction: 4 })), 3)
})

test('Dim Carcosa lead tie choice and random setup survive JSON save/replay', () => {
  const original = state({ doubt: 3, conviction: 3 })
  const execute = draft => {
    const plan = dimCarcosaPlan(draft, {
      choose: request => requestChoice(draft, request),
      random: () => randomValue(draft),
    })
    draft.result = clone(plan)
  }
  resolveTransaction(original, 0, { action: 'setup' }, execute)
  assert.equal(original.pendingChoice.seat, 0)
  const restored = clone(original)
  const answer = { action: 'choose', choiceId: original.pendingChoice.id, optionId: '3' }
  resolveTransaction(original, 0, answer, execute)
  resolveTransaction(restored, 0, answer, execute)
  assert.deepEqual(restored, original)
  assert.equal(original.result.version, 3)
})

test('Dim Carcosa falling story choice survives save/replay and refusal stays reversible', () => {
  const original = state()
  original.locations = [{ id: 'spire', originalCode: '03330', revealed: true, clues: 0 }]
  original.investigators[0].location = 'spire'
  const execute = draft => dimCarcosa.behavior.locationStory(draft, draft.locations[0], {
    choose: request => requestChoice(draft, request),
    horror: (seat, amount) => { draft.investigators[seat].horror += amount },
    damageEnemy() {},
  }, 0)
  resolveTransaction(original, 0, { action: 'flip' }, execute)
  assert.ok(original.pendingChoice)
  const restored = clone(original)
  const refuse = { action: 'choose', choiceId: original.pendingChoice.id, optionId: 'refuse' }
  resolveTransaction(original, 0, refuse, execute)
  resolveTransaction(restored, 0, refuse, execute)
  assert.deepEqual(restored, original)
  assert.equal(original.locations[0].storyRefused, true)
  assert.equal(original.locations[0].cannotFlipAgain, undefined)

  resolveTransaction(original, 0, { action: 'flip' }, execute)
  const push = { action: 'choose', choiceId: original.pendingChoice.id, optionId: 'push' }
  resolveTransaction(original, 0, push, execute)
  assert.equal(original.locations[0].cannotFlipAgain, true)
  assert.equal(original.investigators[0].horror, 2)
})

test('Dim Carcosa R1-R3 record possessed stable IDs and private epilogues', () => {
  for (const key of ['r1', 'r2', 'r3']) {
    const draft = state()
    draft.investigators[0].hand = ['01001', '03341']
    draft.investigators[1].hand = ['01002']
    const api = {
      addTrauma(target, seat, kind, amount) {
        target.campaign.trauma[seat][kind] += amount
        target.campaign.investigators[seat].trauma[kind] += amount
      },
    }
    const result = dimCarcosa.behavior.resolution(draft, key, [], api)
    assert.deepEqual(draft.campaign.records.possessed, ['investigator-7'])
    assert.equal(draft.campaign.privateEpiloguesByInvestigatorId['investigator-7'].private, true)
    assert.equal(draft.campaign.privateEpiloguesByInvestigatorId['investigator-11'], undefined)
    assert.equal(result.bonus, 5)
  }
})

test('Dim Carcosa failure tie routes to R4, otherwise doubt leads to R5', () => {
  const tied = state({ doubt: 4, conviction: 4 })
  dimCarcosa.behavior.resolution(tied, 'noResolution')
  assert.equal(tied.campaign.records.theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth, true)
  assert.equal(tied.campaign.records.hasturHasYouInHisGrasp, undefined)

  const doubt = state({ doubt: 5, conviction: 4 })
  dimCarcosa.behavior.resolution(doubt, 'noResolution')
  assert.equal(doubt.campaign.records.hasturHasYouInHisGrasp, true)
})

test('卡城幽影：版本三击败苍白面具下的男子推进场景并移出游戏（不再中止行动）', () => {
  // 03059 是从「放到一边」生成的弱点敌人，没有交战座位；此前击败时 addVictory
  // 找不到牌组归属会抛错，整次攻击行动中止。版本三的幕背面要求把它移出游戏。
  const game = createGameState({
    campaignId: 'thePathToCarcosa',
    playerInvestigator: '05004',
    seed: 'dim-carcosa-defeat-regression',
    seatInvestigators: ['05004'],
  }, [{ seat: 0, role: 'human' }])
  settle(game)
  game.campaign.records.conviction = 6 // 确信高于疑惑且总数 > 5：幕二使用版本三（只能因伤害被击败）
  game.campaign.investigators[0].deck.push('03059')
  startScenario(game, 7, [])
  settle(game)
  assert.equal(game.scenarioFlags.actTwoVersion, 3)
  // 03320 的背面在王之宫殿生成苍白面具下的男子。
  game.actIndex = 0
  advanceAct(game, [])
  settle(game)
  const man = game.enemies.find(enemy => enemy.code === '03059')
  assert.ok(man, '第一幕背面应生成苍白面具下的男子')
  assert.equal(man.bearerSeat, 0, '生成时按战役牌组补上弱点归属')

  const inv = game.investigators[0]
  inv.location = man.location
  inv.combat = 99
  inv.actionsLeft = 10
  game.currentSeat = 0
  game.phase = 'investigation'
  game.chaosBag = ['0']
  game.encounterDeck = []
  man.engagedSeat = 0
  inv.engaged.push(man.id)
  man.damageTaken = man.health - 1
  applyMove(game, 0, { action: 'fight', enemyId: man.id })
  settle(game)

  assert.equal(game.scenarioFlags.strangerDefeated, true)
  assert.equal(game.actIndex, 2)
  assert.equal(game.acts[2].originalCode, '03324', '推进到「褴褛之王」')
  assert.ok(game.enemies.some(enemy => enemy.code === '03333'), '版本三背面生成哈斯塔（卡尔克萨领主）')
  assert.ok(game.removedFromGame.includes('03059'), '男子按幕背移出游戏')
  assert.ok(!game.encounterDiscard.includes('03059'), '不再掉进遭遇弃牌堆')
})
