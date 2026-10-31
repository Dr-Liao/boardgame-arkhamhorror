import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { advanceAct, applyMove, createGameState, startScenario } from '../src/engine/engine.js'
import { maskHiddenLocations } from '../src/integration/presentation-state.js'
import { settle } from './core-fixture.mjs'
import { mapGeometry } from '../web/map-layout.js'
import * as phantom from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/index.js'
import * as mask from '../content/campaigns/thePathToCarcosa/scenarios/thePallidMask/index.js'
import { layout as pallidLayout } from '../content/campaigns/thePathToCarcosa/scenarios/thePallidMask/layout.js'

const clone = value => structuredClone(value)

function fixture(entry, records = {}) {
  return {
    scenario: clone(entry.scenario),
    acts: clone(entry.scenario.acts),
    agendas: clone(entry.scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    difficulty: 'standard',
    numInvestigators: 2,
    currentSeat: 0,
    round: 1,
    doom: 0,
    chaosBag: ['0', 'cultist', 'tablet', 'elderthing'],
    campaign: {
      leadSeat: 0,
      records: clone(records),
      chaosBag: ['0', 'cultist', 'tablet', 'elderthing'],
      investigators: {
        0: { id: 'investigator-1', seat: 0, deck: [] },
        1: { id: 'investigator-2', seat: 1, deck: [] },
      },
    },
    investigators: [
      { seat: 0, name: '一号', deck: [], hand: [], resources: 5, clues: 0, location: entry.scenario.startLocation },
      { seat: 1, name: '二号', deck: [], hand: [], resources: 5, clues: 0, location: entry.scenario.startLocation },
    ],
    locations: [],
    enemies: [],
    encounterDeck: clone(entry.scenario.encounterDeck),
    encounterDiscard: [],
    victoryDisplay: [],
    locationVariants: {},
    scenarioFlags: {},
    scenarioZones: {},
  }
}

const deterministic = {
  randomValue: () => 0,
  shuffle: values => [...values],
}

test('M3 manifests are verified while the campaign remains independently gated', () => {
  assert.equal(phantom.manifest.status, 'verified')
  assert.equal(mask.manifest.status, 'verified')
  assert.equal(phantom.manifest.campaignId, 'thePathToCarcosa')
  assert.equal(mask.manifest.campaignId, 'thePathToCarcosa')
})

test('A Phantom of Truth resolves the dream before setup and selects the printed route', () => {
  const conviction = fixture(phantom, {
    conviction: 2,
    doubt: 1,
    chasingTheStranger: 4,
    vipsInterviewed: ['03077'],
  })
  const choices = []
  phantom.behavior.preScenarioSetup(conviction, [], {
    choose(request) {
      choices.push(request)
      return 'conviction'
    },
  })
  assert.equal(conviction.campaign.records.conviction, 3)
  assert.ok(conviction.investigators.every(inv => inv.resources === 8 && inv.deck.includes('03227')))
  assert.equal(choices[0].source, 'aPhantomOfTruthDream10')
  phantom.behavior.setupLocations(conviction, [], deterministic)
  assert.deepEqual(conviction.acts.map(act => act.originalCode), ['03205', '03207'])
  assert.equal(phantom.behavior.startLocation(conviction), 'montparnasse')

  const doubt = fixture(phantom, { conviction: 1, doubt: 1 })
  phantom.behavior.setupLocations(doubt, [], deterministic)
  assert.deepEqual(doubt.acts.map(act => act.originalCode), ['03204', '03206'])
  assert.ok(phantom.behavior.modifyDeck(doubt, doubt.encounterDeck).every(code => !['03223', '01135'].includes(code)))
})

test('A Phantom of Truth successful attacks can place clues on the organist', () => {
  const state = createGameState({ seed: 'phantom-organist-attack' }, [{ seat: 0 }])
  const inv = state.investigators[0]
  const definition = ALL_CARDS['03221b']
  state.scenario = { ...state.scenario, id: 'aPhantomOfTruth' }
  state.acts = [{ originalCode: '03206' }]
  state.actIndex = 0
  state.scenarioFlags = {}
  state.phase = 'investigation'
  state.currentSeat = 0
  state.pendingChoice = null
  state.continuation = null
  state.chaosBag = ['elder_sign']
  Object.assign(inv, { location: 'paris', actionsLeft: 3, clues: 1, combat: 99, hand: [] })
  state.locations = [{ id: 'paris', name: '巴黎', revealed: true, clues: 0, connections: [] }]
  state.enemies = [{
    id: 'organist', code: '03221b', originalCode: '03221b', name: definition.nameZh || definition.name,
    location: 'paris', fight: definition.fight || 1, evade: definition.evade || 1,
    health: 99, damageTaken: 0, traits: definition.traits || [], engagedSeat: 0, exhausted: false,
  }]

  applyMove(state, 0, { action: 'fight', enemyId: 'organist' })
  applyMove(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'done' })
  assert.equal(state.pendingChoice.kind, 'reaction')
  applyMove(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'place' })
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.enemies[0].clues, 1)
})

test('A Phantom of Truth exposes and resolves all five printed Paris location abilities', () => {
  const state = fixture(phantom)
  const inv = state.investigators[0]
  const place = (id, code = phantom.scenario.locations[id]?.originalCode) => {
    const base = Object.values(phantom.scenario.locations).find(location => location.originalCode === code)
      || Object.values(phantom.scenario.locationVariants).flat().find(location => location.originalCode === code)
    state.locations = [{ ...clone(base), id, originalCode: code, revealed: true, clues: 0 }]
    inv.location = id
    state.scenarioFlags = {}
  }

  place('montparnasse', '03208')
  inv.hand = ['01089']
  inv.discard = []
  const before = inv.resources
  phantom.behavior.performAction(state, inv,
    phantom.behavior.actions(state, inv).find(move => move.rule === 'montparnasseDiscard'),
    { choose: () => '0' })
  assert.equal(inv.resources, before + (ALL_CARDS['01089'].icons.willpower || 0))
  assert.deepEqual(inv.discard, ['01089'])

  place('montmartre', '03209')
  inv.deck = ['01018']
  state.investigators[1].deck = ['01088']
  let played = null
  phantom.behavior.performAction(state, inv,
    phantom.behavior.actions(state, inv).find(move => move.rule === 'montmartrePlay'), {
      info() {}, canPlayAsset: (_seat, code) => code === '01018',
      choose: () => 'seat:0', playAsset: (_seat, code) => { played = code },
      random: () => 0,
    })
  assert.equal(played, '01018')
  assert.equal(inv.deck.length, 0)

  place('montmartre', '03210')
  inv.resources = 2
  inv.assets = [{ id: 'gun', code: '01016', uses: 1, usesType: 'ammo' }]
  phantom.behavior.performAction(state, inv,
    phantom.behavior.actions(state, inv).find(move => move.rule === 'montmartreReload'), {})
  assert.equal(inv.resources, 1)
  assert.equal(inv.assets[0].uses, 2)

  place('gareDOrsay', '03214')
  state.locations.push({ ...clone(phantom.scenario.locations.montparnasse), revealed: true, clues: 0 })
  inv.resources = 2
  let destination = null
  phantom.behavior.performAction(state, inv,
    phantom.behavior.actions(state, inv).find(move => move.rule === 'gareRailMove'), {
      moveInvestigator(_seat, id) { destination = id },
    })
  assert.equal(destination, 'montparnasse')
  assert.equal(inv.resources, 1)

  place('notreDame', '03219')
  state.doom = 1
  phantom.behavior.performAction(state, inv,
    phantom.behavior.actions(state, inv).find(move => move.rule === 'notreDameDoom'), {
      test(_seat, _skill, _difficulty, resolve) { resolve({ success: true }) },
      choose: () => 'remove',
    })
  assert.equal(state.doom, 0)
  assert.equal(state.scenarioFlags.notreDameUsed, true)
})

test('The Pallid Mask creates a conserved random catacombs deck with the two exits in its bottom five', () => {
  const state = fixture(mask, { youEnteredTheCatacombsOnYourOwn: true })
  mask.behavior.preScenarioSetup(state)
  const placed = mask.behavior.setupLocations(state, [], deterministic)
  const allCodes = [
    state.scenarioZones.catacombStartCode,
    ...state.scenarioZones.catacombsDeck,
    ...placed.slice(1).map(id => state.locationVariants[id].originalCode),
  ]
  assert.equal(allCodes.length, 14)
  assert.equal(allCodes.filter(code => code === '03256').length, 1)
  assert.equal(allCodes.filter(code => code === '03257').length, 1)
  assert.ok(state.scenarioZones.catacombsDeck.slice(0, 5).includes('03256'))
  assert.ok(state.scenarioZones.catacombsDeck.slice(0, 5).includes('03257'))
})

test('The Pallid Mask lays the gate above and below, and unrevealed catacombs use the encounter back', () => {
  const state = fixture(mask, { youEnteredTheCatacombsOnYourOwn: true })
  mask.behavior.preScenarioSetup(state)
  const placed = mask.behavior.setupLocations(state, [], deterministic)
  const gate = state.locationVariants.catacomb0
  assert.equal(gate.originalCode, '03247')
  assert.deepEqual(gate.grid, { x: 0, y: 0 })
  const neighbors = placed.slice(1).map(id => state.locationVariants[id])
  assert.deepEqual(neighbors.map(loc => loc.grid).sort((a, b) => a.y - b.y), [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ])
  const visible = maskHiddenLocations(placed.map(id => ({ ...state.locationVariants[id], id, connections: [] })))
  const geometry = mapGeometry(visible, pallidLayout)
  const above = visible.find(loc => loc.grid.y === -1)
  const below = visible.find(loc => loc.grid.y === 1)
  assert.equal(geometry.positions[above.id].x, geometry.positions.catacomb0.x)
  assert.equal(geometry.positions[below.id].x, geometry.positions.catacomb0.x)
  assert.ok(geometry.positions[above.id].y < geometry.positions.catacomb0.y)
  assert.ok(geometry.positions[below.id].y > geometry.positions.catacomb0.y)
  for (const loc of visible.filter(item => item.id !== 'catacomb0')) {
    assert.equal(loc.name, '地下墓穴')
    assert.equal(loc.nameEn, 'Catacombs')
    assert.equal(loc.encounterBack, true)
    assert.match(loc.backTextZh, /共同花费1/)
    assert.equal(loc.artCode, undefined)
    assert.equal(loc.originalCode, undefined)
    assert.equal(loc.unrevealedActualName, undefined)
  }
  const path = maskHiddenLocations([{
    id: 'path', hiddenIdentity: true, revealed: false, originalCode: '02285', name: '屠杀之森',
    connections: [], grid: { x: 2, y: 3 },
  }])[0]
  assert.equal(path.name, '分岔路')
  assert.equal(path.nameEn, 'Diverging Path')
  assert.equal(path.artCode, '02285')
  assert.equal(path.encounterBack, undefined)
  assert.ok(path.backFlavorZh)
  assert.equal(path.originalCode, undefined)
  assert.deepEqual(path.grid, { x: 2, y: 3 })
})

test('The Pallid Mask candlelit tunnels tests intellect and privately reveals a catacomb face once per game', () => {
  const state = fixture(mask)
  const inv = state.investigators[0]
  state.locations = [
    { id: 'tunnels', originalCode: '03252', name: '烛光隧道', revealed: true, clues: 0 },
    { id: 'hidden', originalCode: '03253', name: '地下墓穴', revealed: false, clues: 0 },
  ]
  inv.location = 'tunnels'
  const move = mask.behavior.actions(state, inv).find(action => action.rule === 'readAncientSign')
  assert.ok(move)
  let privateText = ''
  mask.behavior.performAction(state, inv, move, {
    test(_seat, skill, difficulty, resolve) {
      assert.equal(skill, 'intellect')
      assert.equal(difficulty, 3)
      resolve({ success: true })
    },
    choose: () => 'hidden',
    privateInfo(_seat, text) { privateText = text },
  })
  assert.match(privateText, /03253|骸骨|地下墓穴/)
  assert.ok(!mask.behavior.actions(state, inv).some(action => action.rule === 'readAncientSign'))
})

test('The Pallid Mask act II branches write exactly two conviction or doubt', () => {
  for (const [mode, key, next] of [
    ['defeat', 'conviction', '03245'],
    ['clues', 'doubt', '03246'],
  ]) {
    const state = fixture(mask, { conviction: 1, doubt: 2 })
    state.scenarioFlags.actTwoAdvancedWith = mode
    state.actIndex = 1
    state.acts = clone(mask.scenario.acts.slice(0, 3))
    mask.behavior.actReveal(state, state.acts[1], {})
    assert.equal(state.campaign.records[key], (key === 'conviction' ? 1 : 2) + 2)
    assert.equal(state.acts[2].originalCode, next)
  }
})

test('M3 resolutions replace symbol tokens and record VIP deaths and outcomes', () => {
  const phantomState = fixture(phantom)
  phantomState.victoryDisplay = [{ code: '03066b' }]
  phantom.behavior.resolution(phantomState, 'r2', [], { trauma() {} })
  assert.equal(phantomState.campaign.records.youFoundNigelEngram, true)
  assert.deepEqual(phantomState.campaign.records.vipsSlain, ['03066'])
  assert.equal(phantomState.chaosBag.filter(token => token === 'tablet').length, 2)

  const maskState = fixture(mask, { chasingTheStranger: 3 })
  maskState.victoryDisplay = [{ code: '03067b' }]
  mask.behavior.resolution(maskState, 'r2', [], {})
  assert.equal(maskState.campaign.records.youKnowTheSiteOfTheGate, true)
  assert.equal(maskState.campaign.records.chasingTheStranger, 5)
  assert.deepEqual(maskState.campaign.records.vipsSlain, ['03067'])
  assert.equal(maskState.chaosBag.filter(token => token === 'tablet').length, 2)
})

test('The Pallid Mask stores Act II readers as stable campaign investigator ids', () => {
  const state = fixture(mask)
  mask.behavior.resolution(state, 'noResolution', [], {
    choose({ seat }) { return seat === 0 ? 'read' : 'skip' },
  })
  assert.deepEqual(state.campaign.records.readActII, ['investigator-1'])
})

test('苍白面具：击败苍白面具下的男子推进场景并移出游戏（不再抛「弱点敌人缺少牌组归属」）', () => {
  // 复现：03059 是第一幕背面从「放到一边」生成的弱点敌人，没有交战座位。
  // 此前击败时 addVictory 找不到 bearerSeat 会抛错，整次行动中止（截图里的报错）。
  const state = createGameState({
    campaignId: 'thePathToCarcosa',
    playerInvestigator: '05004',
    seed: 'pallid-mask-defeat-regression',
    seatInvestigators: ['05004'],
  }, [{ seat: 0, role: 'human' }])
  settle(state)
  // 《谢幕》结尾会把 03059 作为战役弱点放进承受者牌组。
  state.campaign.investigators[0].deck.push('03059')
  startScenario(state, 5, [])
  settle(state)
  assert.deepEqual(state.scenarioZones.setAside, ['03059'])
  assert.ok(!state.investigators[0].deck.includes('03059'), '本关把 03059 从牌库拿出来放到一边')

  // 暗影坟墓揭示会推进第一幕；03243 的背面在暗影坟墓生成苍白面具下的男子。
  state.locations.push({
    id: 'tomb', name: '暗影坟墓', originalCode: '03257', revealed: true, clues: 0,
    connections: [], grid: { x: 9, y: 9 },
  })
  state.actIndex = 0
  advanceAct(state, [])
  settle(state)
  const man = state.enemies.find(enemy => enemy.code === '03059')
  assert.ok(man, '第一幕背面应生成苍白面具下的男子')
  assert.equal(man.bearerSeat, 0, '生成时按战役牌组补上弱点归属')
  assert.equal(man.location, 'tomb')

  const inv = state.investigators[0]
  inv.location = man.location
  inv.combat = 99
  inv.actionsLeft = 10
  state.currentSeat = 0
  state.phase = 'investigation'
  state.chaosBag = ['0']
  state.encounterDeck = []
  // 暗影坟墓让男子生命值 +每位调查员 1；这里只保留最后一次攻击。
  man.engagedSeat = 0
  inv.engaged.push(man.id)
  man.damageTaken = 3
  applyMove(state, 0, { action: 'fight', enemyId: man.id })
  settle(state)

  assert.ok(!state.enemies.some(enemy => enemy.code === '03059'), '男子已被击败')
  assert.equal(state.scenarioFlags.actTwoAdvancedWith, 'defeat')
  assert.equal(state.actIndex, 2)
  assert.deepEqual(state.acts.map(act => act.originalCode), ['03243', '03244', '03245'])
  assert.equal(state.campaign.records.conviction, 2, '击败分支记 2 点确信')
  assert.deepEqual(state.scenarioZones.removed, ['03059'], '按幕背面把男子移出游戏')
  assert.ok(!state.encounterDiscard.includes('03059'), '不再掉进遭遇弃牌堆')
  assert.ok(!inv.discard.includes('03059'))
})
