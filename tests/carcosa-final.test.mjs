import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTransaction, requestChoice } from '../src/engine/resolution.js'
import { randomValue } from '../src/engine/rules-state.js'
import { advanceAct, applyMove, createGameState, investigatorEntryError, startScenario } from '../src/engine/engine.js'
import { settle, fixture, legalMoves, validateMove } from './core-fixture.mjs'
import { manifest as campaignManifest } from '../content/campaigns/thePathToCarcosa/manifest.js'
import * as blackStars from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/index.js'
import {
  setupPlan as blackStarsPlan, advanceAgendaDeck, placeAgendaDoom,
} from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js'
import { campaignProjection } from '../src/cards/campaign-view.js'
import { createTableRegions } from '../web/table-regions.js'
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

test('Black Stars Rise intro splash shows the right-hand agenda beside the story', () => {
  const game = createGameState({
    campaignId: 'thePathToCarcosa',
    playerInvestigator: '05004',
    seed: 'black-stars-intro-splash',
    seatInvestigators: ['05004'],
  }, [{ seat: 0, role: 'human' }])
  settle(game)
  const events = []
  startScenario(game, 6, events)
  const intro = events.find(event => event.presentation?.intro)?.presentation
  assert.ok(intro, '故事导入拍脸应当发出')
  assert.equal(intro.code, game.scenarioFlags.agendaDecks.a.cards[0])
  assert.equal(intro.asideCode, game.scenarioFlags.agendaDecks.c.cards[0])
  assert.equal(intro.asideCode, '03278')
  assert.equal(game.acts.length, 0)
})

test('placing doom that advances either agenda shows a flip splash and the new card', () => {
  const draft = state()
  draft.status = 'playing'
  draft.scenarioFlags = {
    route: 'below',
    agendaDecks: {
      a: { id: 'a', index: 0, doom: 4, cards: ['03275', '03276b', '03277'] },
      c: { id: 'c', index: 0, doom: 4, cards: ['03278', '03279a', '03280'] },
    },
  }
  draft.doom = 4
  const cues = []
  const api = { present: (_text, cue) => cues.push(cue), shuffleEncounterDeck() {} }
  placeAgendaDoom(draft, 'c', 1, api)
  assert.deepEqual(cues.map(cue => [cue.title, cue.code, cue.face || 'front', cue.flip || false]), [
    ['密谋推进', '03278', 'back', true],
    ['新的密谋', '03279a', 'front', false],
  ])
  cues.length = 0
  placeAgendaDoom(draft, 'a', 1, api)
  assert.deepEqual(cues.map(cue => [cue.title, cue.code]), [
    ['密谋推进', '03275'],
    ['新的密谋', '03276b'],
  ])
})

test('opening the correct agenda path splashes that flip and the act that replaces it', () => {
  const draft = state()
  draft.scenario = clone(blackStars.scenario)
  draft.locationVariants = {}
  draft.scenarioZones = { setAside: [] }
  draft.numInvestigators = 1
  blackStars.behavior.setupLocations(draft, [], { random: () => 0 })
  const cues = []
  const api = { present: (_text, cue) => cues.push(cue), shuffleEncounterDeck() {}, info() {}, spawn() {} }
  advanceAgendaDeck(draft, 'a', api)
  advanceAgendaDeck(draft, 'a', api)
  assert.equal(draft.scenarioFlags.openPath, true)
  assert.ok(cues.some(cue => cue.title === '密谋推进' && cue.code === '03276b' && cue.face === 'back' && cue.flip === true))
  assert.ok(cues.some(cue => cue.title === '新的场景' && cue.code === '03281'))
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
  assert.equal(blackStars.behavior.investigateWithoutClues(draft, inv, draft.locations[0]), true)
  assert.equal(blackStars.behavior.investigateSkill(draft, inv, draft.locations[0]), 'agility')
  assert.equal(blackStars.behavior.investigateResult(draft, inv, draft.locations[0], { success: true }), false)
  assert.equal(draft.scenarioFlags.foundTowerKey, true)
  draft.locations[0].clues = 1
  draft.scenarioFlags.foundTowerKey = false
  assert.equal(blackStars.behavior.investigateSkill(draft, inv, draft.locations[0]), null)
  assert.equal(blackStars.behavior.investigateResult(draft, inv, draft.locations[0], { success: true }), undefined)

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
  draft.round = 1
  for (const code of ['03296', '03297']) {
    draft.locations = [{ id: 'chapelOfStAubert', originalCode: code, revealed: false }]
    assert.match(investigatorEntryError(draft, 'chapelOfStAubert', 0), /向导/)
    draft.locations[0].revealed = true
    assert.equal(investigatorEntryError(draft, 'chapelOfStAubert', 0), null)
  }
  for (const code of ['03298', '03299']) {
    draft.locations = [{ id: 'abbeyTower', originalCode: code, revealed: false }]
    assert.match(investigatorEntryError(draft, 'abbeyTower', 0), /钥匙/)
    draft.locations[0].revealed = true
    assert.equal(investigatorEntryError(draft, 'abbeyTower', 0), null)
  }
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

test('Black Stars Rise keeps the act set aside and shows both agenda dooms', () => {
  const draft = state()
  draft.scenario = clone(blackStars.scenario)
  draft.locationVariants = {}
  draft.scenarioZones = { setAside: [] }
  draft.round = 1
  draft.numInvestigators = 3
  blackStars.behavior.setupLocations(draft, [], { random: () => 0 })
  assert.equal(draft.scenarioFlags.route, 'below')
  assert.deepEqual(draft.acts, [])
  assert.equal(draft.scenarioFlags.pendingAct.originalCode, '03281')
  assert.ok(draft.scenarioZones.setAside.includes('03281'))
  assert.ok(draft.scenarioZones.setAside.includes('03282'))

  const hasten = () => blackStars.behavior.actions(draft, draft.investigators[0]).filter(move => move.rule === 'hastenAgenda')
  const opening = hasten()
  assert.deepEqual(opening.map(move => move.deckId), ['a', 'c'])
  assert.match(opening[0].label, /获得2资源/)
  assert.match(opening[1].label, /抽取1张牌/)
  assert.ok(opening.every(move => move.scriptCard === 'agenda'))

  draft.scenarioFlags.agendaDecks.a.doom = 6
  draft.scenarioFlags.agendaDecks.c.doom = 1
  const view = campaignProjection(draft)
  assert.equal(view.blackStarsRise.route, undefined)
  assert.equal(view.blackStarsRise.decks.a.current, '03275')
  assert.equal(view.blackStarsRise.decks.a.nameZh, '浪潮汹涌')
  assert.equal(view.blackStarsRise.decks.a.doom, 6)
  assert.equal(view.blackStarsRise.decks.a.doomThreshold, 5)
  assert.equal(view.blackStarsRise.decks.c.current, '03278')
  assert.equal(view.blackStarsRise.decks.c.nameZh, '仪式开始')
  assert.equal(view.blackStarsRise.decks.c.doom, 1)
  assert.equal(view.blackStarsRise.decks.c.doomThreshold, 5)
  assert.match(blackStars.behavior.describe(draft).join('\n'), /浪潮汹涌.*6\/5/)
  assert.match(blackStars.behavior.describe(draft).join('\n'), /仪式开始.*1\/5/)
  draft.scenarioFlags.agendaDecks.a.index = 2
  const onlyC = hasten()
  assert.deepEqual(onlyC.map(move => move.deckId), ['c'])
  assert.equal(onlyC[0].scriptCard, 'agenda')
  draft.scenarioFlags.agendaDecks.a.index = 0

  const quiet = { shuffleEncounterDeck() {}, info() {}, spawn() {} }
  advanceAgendaDeck(draft, 'a', quiet)
  advanceAgendaDeck(draft, 'a', quiet)
  assert.equal(draft.scenarioFlags.openPath, true)
  assert.equal(draft.scenarioFlags.pathOpenedBy, 'a')
  assert.equal(draft.acts[0].originalCode, '03281')
  assert.equal(draft.scenarioFlags.pendingAct, undefined)
  assert.equal(campaignProjection(draft).blackStarsRise.route, 'below')

  const svg = () => ({ setAttribute() {}, append() {}, style: {}, namespaceURI: 'http://www.w3.org/2000/svg' })
  const previousDocument = globalThis.document
  globalThis.document = { createElementNS: () => svg() }
  try {
    const regions = createTableRegions((tag, props, ...children) => ({ tag, props: props || {}, children }), { openDetail() {}, openChaosBag() {} })
    const tree = regions.script({
      status: 'playing', difficulty: 'standard', investigators: [], chaosBag: [], clues: 0,
      scenario: { id: 'blackStarsRise', name: '卡尔克萨之路 · 黑星升起' },
      blackStarsRise: view.blackStarsRise,
    }, null, null, [], null, {}, null, {})
    const flat = []
    const walk = node => {
      if (node == null || node === false) return
      if (Array.isArray(node)) { node.forEach(walk); return }
      flat.push(node)
      ;(node.children || []).forEach(walk)
    }
    walk(tree)
    const text = flat.flatMap(node => (node.children || []).filter(child => typeof child === 'string')).join('\n')
    assert.match(text, /“a” 毁灭 6\/5/)
    assert.match(text, /“c” 毁灭 1\/5/)
    const art = flat.map(node => node.props?.['data-art-code']).filter(Boolean)
    assert.ok(art.includes('03275'))
    assert.ok(art.includes('03278'))
    assert.ok(!art.includes('03281'))
    assert.equal(flat.find(node => node.props?.['data-story-pages'])?.props['data-story-pages'], 'agendas')
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})

test('Black Stars Rise counts doom on cards in play toward both agendas', () => {
  const draft = state()
  draft.scenario = clone(blackStars.scenario)
  draft.doom = 2
  draft.scenarioFlags = {
    route: 'below',
    agendaDecks: {
      a: { id: 'a', index: 0, doom: 2, cards: ['03275', '03276b', '03277'] },
      c: { id: 'c', index: 0, doom: 1, cards: ['03278', '03279a', '03280'] },
    },
  }
  draft.enemies = [{ id: 'byakhee', doom: 1 }]
  draft.locations = [{ id: 'grandRue', doom: 1, attachments: [{ id: 'mark', doom: 0 }] }]
  draft.investigators[0].assets = [{ id: 'asset', doom: 0 }]
  const view = campaignProjection(draft)
  assert.equal(view.blackStarsRise.decks.a.doom, 4)
  assert.equal(view.blackStarsRise.decks.c.doom, 3)
  const text = blackStars.behavior.describe(draft).join('\n')
  assert.match(text, /浪潮汹涌.*4\/5（含场上 2）/)
  assert.match(text, /仪式开始.*3\/5（含场上 2）/)

  draft.investigators[0].assets[0].doom = 1
  const api = {
    shuffleEncounterDeck() {}, info() {}, spawn() {}, finish() {},
    choose() { throw new Error('只有一套达到阈值，不应询问') },
  }
  blackStars.behavior.doomPlaced(draft, { target: draft.investigators[0].assets[0], amount: 1, agenda: false }, api)
  assert.equal(draft.scenarioFlags.agendaDecks.a.index, 1)
  assert.equal(draft.scenarioFlags.agendaDecks.a.doom, 0)
  assert.equal(draft.doom, 0)
  assert.equal(draft.scenarioFlags.agendaDecks.c.index, 0)
  assert.equal(draft.scenarioFlags.agendaDecks.c.doom, 1)
  assert.equal(draft.enemies[0].doom, 0)
  assert.equal(draft.locations[0].doom, 0)
  assert.equal(draft.investigators[0].assets[0].doom, 0)
  assert.equal(draft.campaign.records.conviction, 1)
  assert.equal(draft.campaign.records.doubt, 0)
})

test('Black Stars Rise lets the lead choose which agenda advances when field doom fills both', () => {
  const draft = state()
  draft.scenario = clone(blackStars.scenario)
  draft.scenarioFlags = {
    route: 'below',
    agendaDecks: {
      a: { id: 'a', index: 0, doom: 0, cards: ['03275', '03276b', '03277'] },
      c: { id: 'c', index: 0, doom: 0, cards: ['03278', '03279a', '03280'] },
    },
  }
  draft.enemies = [{ id: 'byakhee', doom: 5 }]
  let asked = false
  const api = {
    shuffleEncounterDeck() {}, info() {}, spawn() {}, finish() {},
    choose(spec) {
      asked = true
      assert.deepEqual(spec.options.map(option => option.id), ['a', 'c'])
      return 'c'
    },
  }
  blackStars.behavior.doomPlaced(draft, { target: draft.enemies[0], amount: 5, agenda: false }, api)
  assert.equal(asked, true)
  assert.equal(draft.scenarioFlags.agendaDecks.c.index, 1)
  assert.equal(draft.scenarioFlags.agendaDecks.c.doom, 0)
  assert.equal(draft.scenarioFlags.agendaDecks.a.index, 0)
  assert.equal(draft.scenarioFlags.agendaDecks.a.doom, 0)
  assert.equal(draft.enemies[0].doom, 0)
  assert.equal(draft.campaign.records.conviction, 1)
})

test('Black Stars Rise Ashleigh doom names the agenda deck when either pile has doom', () => {
  const decks = (a, c) => ({
    a: { id: 'a', index: 0, doom: a, cards: ['03275', '03276b', '03277'] },
    c: { id: 'c', index: 0, doom: c, cards: ['03278', '03279a', '03280'] },
  })
  const draft = state()
  draft.scenario = clone(blackStars.scenario)
  draft.scenarioFlags = { ashleighDoomAbility: true, agendaDecks: decks(2, 1) }
  draft.doom = 2
  const inv = draft.investigators[0]
  const offered = () => blackStars.behavior.actions(draft, inv).filter(move => move.rule === 'ashleighDoom')
  assert.deepEqual(offered().map(move => move.deckId), ['a', 'c'])
  assert.equal(offered().every(move => !move.reason), true)
  assert.throws(
    () => blackStars.behavior.performAction(draft, inv, { action: 'scenarioAction', rule: 'ashleighDoom' }, {}),
    /必须选择有毁灭标记的密谋牌堆/,
  )
  blackStars.behavior.performAction(draft, inv, { action: 'scenarioAction', rule: 'ashleighDoom', deckId: 'c' }, {})
  assert.equal(draft.scenarioFlags.agendaDecks.c.doom, 0)
  assert.equal(draft.scenarioFlags.agendaDecks.a.doom, 2)
  assert.equal(draft.doom, 2)
  assert.equal(draft.scenarioFlags.ashleighDoomUsed, true)

  draft.scenarioFlags.ashleighDoomUsed = false
  draft.scenarioFlags.agendaDecks = decks(0, 1)
  assert.deepEqual(offered().map(move => move.deckId), ['c'])
  blackStars.behavior.performAction(draft, inv, { action: 'scenarioAction', rule: 'ashleighDoom' }, {})
  assert.equal(draft.scenarioFlags.agendaDecks.c.doom, 0)

  draft.scenarioFlags.ashleighDoomUsed = false
  draft.scenarioFlags.agendaDecks = decks(1, 0)
  blackStars.behavior.performAction(draft, inv, { action: 'scenarioAction', rule: 'ashleighDoom', deckId: 'a' }, {})
  assert.equal(draft.scenarioFlags.agendaDecks.a.doom, 0)
  assert.equal(draft.doom, 0)

  draft.scenarioFlags.ashleighDoomUsed = false
  draft.scenarioFlags.agendaDecks = decks(0, 0)
  assert.equal(offered().length, 1)
  assert.match(offered()[0].reason, /没有毁灭/)
  assert.equal(offered()[0].deckId, undefined)

  const game = fixture()
  game.scenario = { id: 'blackStarsRise', name: '黑星升起' }
  game.investigators[0].location = 'nave'
  game.locations = [{ id: 'nave', code: 'test-loc', revealed: true, clues: 0, shroud: 1, connections: [] }]
  game.scenarioFlags = { ashleighDoomAbility: true, agendaDecks: decks(2, 1) }
  game.investigators[0].clues = game.numInvestigators
  game.pendingChoice = null
  game.currentSeat = 0
  game.phase = 'investigation'
  const legal = legalMoves(game).filter(move => move.rule === 'ashleighDoom')
  assert.deepEqual(legal.map(move => move.deckId), ['a', 'c'])
  assert.match(validateMove(game, 0, { action: 'scenarioAction', rule: 'ashleighDoom', actions: 0 }), /必须选择密谋牌堆/)
  assert.equal(validateMove(game, 0, { action: 'scenarioAction', rule: 'ashleighDoom', deckId: 'a', actions: 0 }), null)
  assert.equal(validateMove(game, 0, legal.find(move => move.deckId === 'c')), null)
  assert.match(validateMove(game, 0, { action: 'scenarioAction', rule: 'hastenAgenda', actions: 0 }), /必须选择密谋牌堆/)
  applyMove(game, 0, legal.find(move => move.deckId === 'c'))
  assert.equal(game.scenarioFlags.agendaDecks.c.doom, 0)
  assert.equal(game.scenarioFlags.agendaDecks.a.doom, 2)
  assert.equal(game.scenarioFlags.ashleighDoomUsed, true)
  assert.equal(legalMoves(game).some(move => move.rule === 'ashleighDoom'), false)
})
