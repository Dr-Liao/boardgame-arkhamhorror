import test from 'node:test'
import assert from 'node:assert/strict'
import * as curtain from '../content/campaigns/thePathToCarcosa/scenarios/curtainCall/index.js'
import * as lastKing from '../content/campaigns/thePathToCarcosa/scenarios/theLastKing/index.js'
import * as echoes from '../content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/index.js'
import * as oath from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'
import * as phantom from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/index.js'
import * as pallid from '../content/campaigns/thePathToCarcosa/scenarios/thePallidMask/index.js'
import * as blackStars from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/index.js'
import * as dim from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/index.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { manifest as campaign } from '../content/campaigns/thePathToCarcosa/manifest.js'
import { applyMove, createGameState, decisionSeat, legalMoves, startScenario } from '../src/engine/engine.js'
import { viewEvents } from '../src/integration/observation.js'
import { settle } from './core-fixture.mjs'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items, rng = randomValue) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(rng() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function curtainState() {
  return {
    scenario: clone(curtain.scenario),
    acts: clone(curtain.scenario.acts),
    investigators: [
      { seat: 0, code: '03006', location: 'theatre', horror: 0, engaged: [] },
      { seat: 1, code: '01001', location: 'theatre', horror: 0, engaged: [] },
    ],
    scenarioFlags: {},
    scenarioZones: {},
    campaign: { leadSeat: 0, records: {}, investigators: [
      { id: 'investigator-1', deck: [] }, { id: 'investigator-2', deck: [] },
    ], chaosBag: [] },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: 2,
  }
}

function lastKingState() {
  return {
    scenario: clone(lastKing.scenario),
    investigators: [{ seat: 0, location: 'foyer', clues: 0, hand: [], resources: 5 }],
    locations: Object.values(lastKing.scenario.locations).map(location => ({
      ...clone(location), revealed: true, clues: location.cluesFixed ?? location.cluesPerInvestigator,
    })),
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    campaign: { leadSeat: 0, records: {}, investigators: [{ deck: [] }], chaosBag: ['skull'] },
    chaosBag: ['skull'],
    difficulty: 'standard',
    numInvestigators: 1,
    actClues: 0,
    victoryDisplay: [],
    agendas: clone(lastKing.scenario.agendas),
    agendaIndex: 1,
    round: 1,
    phase: 'investigation',
  }
}

test('Carcosa opening manifests are verified and the campaign is playable', () => {
  assert.equal(curtain.manifest.status, 'verified')
  assert.equal(lastKing.manifest.status, 'verified')
  assert.equal(campaign.status, 'playable')
  assert.deepEqual(curtain.scenario.agendas.map(card => card.originalCode), ['03044', '03045'])
  assert.deepEqual(lastKing.scenario.agendas.map(card => card.originalCode), ['03062', '03063'])
  assert.equal(Object.keys(curtain.scenario.locations).length, 10)
  assert.equal(Object.keys(lastKing.scenario.locations).length, 6)
})

test('Curtain Call setup is deterministic, selects one original act II and starts Lola backstage', () => {
  const first = curtainState()
  const second = clone(first)
  curtain.behavior.setupLocations(first, [], setupApi(23))
  curtain.behavior.setupLocations(second, [], setupApi(23))
  assert.deepEqual(first, second)
  assert.equal(first.acts.length, 3)
  assert.ok(['03047a', '03047b', '03047c'].includes(first.acts[1].originalCode))
  // 卡面三张都是「场景 2a·陌生人」，剧本收尾是「场景 3a·谢幕」：推进日志里的阶段号
  // 必须来自卡面，不能被定义数组的下标（会把 03047b/c 标成 3a/4a、03048 标成 5a）带偏。
  assert.deepEqual(first.acts.map(act => act.stage), ['1a', '2a', '3a'])
  assert.equal(first.investigators[0].location, 'backstage')
  assert.equal(first.investigators[1].location, 'theatre')
})

test('Carcosa 幕/议程的 stage 编号与卡面一致（版本卡按印刷阶段号，不按数组下标）', () => {
  const scenarios = [curtain, lastKing, echoes, oath, phantom, pallid, blackStars, dim]
    .map(entry => entry.scenario)
  for (const scenario of scenarios) {
    for (const kind of ['acts', 'agendas']) {
      for (const card of scenario[kind] || []) {
        const printed = ALL_CARDS[card.originalCode || card.code]
        assert.ok(printed?.stage, `${scenario.id} ${kind} ${card.originalCode} 缺卡面 stage`)
        assert.equal(card.stage, `${printed.stage}a`,
          `${scenario.id} ${kind} ${card.originalCode}「${card.name}」应显示 ${printed.stage}a，实际 ${card.stage}`)
      }
    }
  }
})

test('Curtain Call uses the printed chaos table and persists its resolution records', () => {
  const state = curtainState()
  const inv = state.investigators[0]
  const location = { id: 'theatre', horror: 0 }
  state.locations = [location]
  let horror = 0
  const api = { horror: (seat, amount) => { horror += amount } }
  assert.equal(curtain.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -1)
  inv.horror = 3
  assert.equal(curtain.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -3)
  assert.equal(curtain.behavior.resolveChaosToken(state, inv, 'cultist', api).delta, -4)
  assert.equal(location.horror, 1)
  curtain.behavior.resolveChaosToken(state, inv, 'tablet', api)
  assert.equal(horror, 1)
  state.scenarioFlags = { stoleFromBoxOffice: true }
  curtain.behavior.resolution(state, 'r1')
  assert.equal(state.campaign.records.youTriedToWarnThePolice, true)
  assert.equal(state.campaign.records.thePoliceAreSuspiciousOfYou, true)
  assert.equal(state.campaign.records.conviction, 1)
  assert.equal(state.campaign.records.chasingTheStranger, 2)
  assert.equal(state.campaign.records.pallidMaskBearer, 'investigator-1')
  assert.ok(state.campaign.investigators[0].deck.includes('03059'))
})

test('The Last King setup assigns each bystander once and survives save replay', () => {
  const first = lastKingState()
  const second = clone(first)
  lastKing.behavior.setupLocations(first, [], setupApi(41))
  lastKing.behavior.setupEnemies(first)
  lastKing.behavior.setupLocations(second, [], setupApi(41))
  lastKing.behavior.setupEnemies(second)
  assert.deepEqual(first, second)
  assert.equal(first.storyAssets.length, 5)
  assert.equal(new Set(first.storyAssets.map(asset => asset.code)).size, 5)
  assert.equal(new Set(first.storyAssets.map(asset => asset.location)).size, 5)
  assert.ok(first.storyAssets.every(asset => asset.clues === 2))
  assert.deepEqual(first.scenarioZones.sickeningReality, ['03065', '03066', '03067', '03068', '03069'])
})

test('The Terrifying Truth randomly transforms one matching bystander and is replayable', () => {
  const make = () => {
    const state = lastKingState()
    lastKing.behavior.setupLocations(state, [], setupApi(9))
    lastKing.behavior.setupEnemies(state)
    state.investigators[0].location = state.storyAssets[0].location
    return state
  }
  const first = make()
  const second = clone(first)
  const execute = state => {
    const spawned = []
    const revealed = []
    const api = {
      random: () => 0,
      cardReveal: (code, title) => { revealed.push({ code, title }) },
      clearDoom: () => {},
      horror: (seat, amount) => { state.investigators[seat].horror = (state.investigators[seat].horror || 0) + amount },
      spawn: (code, location) => { spawned.push({ code, location }) },
      advanceAgenda: () => assert.fail('five realities remain'),
    }
    assert.equal(lastKing.behavior.agendaWouldAdvance(state, api), true)
    return { spawned, revealed }
  }
  const result = execute(first)
  assert.deepEqual(result, execute(second))
  assert.deepEqual(first, second)
  assert.equal(first.scenarioZones.sickeningReality.length, 4)
  assert.equal(first.storyAssets.length, 4)
  assert.equal(result.spawned[0].code, '03065b')
  assert.deepEqual(result.revealed, [
    { code: '03063', title: '密谋强制效果' },
    { code: '03065', title: '令人作呕的现实' },
  ])
})

test('The Last King flips and resolves a bystander when its last clue is removed', () => {
  const state = lastKingState()
  const inv = state.investigators[0]
  state.scenarioFlags.toughCrowd = []
  state.storyAssets = [{
    ...clone(lastKing.scenario.storyAssets['03076a']),
    id: 'constance',
    code: '03076a',
    location: inv.location,
    clues: 1,
  }]
  const flips = []
  const api = {
    test(_seat, _skill, _difficulty, resolve) { resolve({ success: true }) },
    gainClues(seat, amount) { state.investigators[seat].clues += amount },
    cardFlip(code, title) { flips.push({ code, title }) },
  }
  const move = lastKing.behavior.actions(state, inv)
    .find(action => action.rule === 'interviewGuest')
  assert.ok(move)
  lastKing.behavior.performAction(state, inv, move, api)
  assert.equal(state.storyAssets[0].clues, 0)
  assert.equal(inv.clues, 1)
  assert.deepEqual(state.scenarioFlags.interviewed, ['03076a'])
  assert.deepEqual(flips, [{ code: '03076a', title: '会谈完成 · 翻牌结算' }])
})

test('The Last King chaos and resolution preserve clues, VIPs and symbol reset', () => {
  const state = lastKingState()
  state.scenarioFlags = { interviewed: ['03076a'], toughCrowd: [] }
  state.actClues = 5
  state.victoryDisplay = [{ code: '03066b' }]
  state.chaosBag = ['cultist', 'cultist', 'tablet', 'elderthing', 'elderthing', 'skull']
  state.campaign.chaosBag = [...state.chaosBag]
  const inv = state.investigators[0]
  inv.clues = 1
  const location = state.locations.find(item => item.id === inv.location)
  const api = {
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount },
    horror: () => {},
  }
  state.difficulty = 'hard'
  assert.deepEqual(lastKing.behavior.resolveChaosToken(state, inv, 'skull', api), { delta: 0, drawAnother: true })
  assert.equal(lastKing.behavior.resolveChaosToken(state, inv, 'cultist', api).delta, -3)
  assert.equal(inv.clues, 0)
  assert.equal(location.clues, 2)
  const result = lastKing.behavior.resolution(state, 'r2')
  assert.deepEqual(state.campaign.records.vipsInterviewed, ['03076a'])
  assert.deepEqual(state.campaign.records.vipsSlain, ['03066'])
  for (const token of ['cultist', 'tablet', 'elderthing']) {
    assert.equal(state.campaign.chaosBag.filter(value => value === token).length, 1)
  }
  assert.equal(result.seatBonus(0), 2)
})

test('The Last King R3 crosses out only interviews completed in this play', () => {
  const state = lastKingState()
  state.campaign.records.vipsInterviewed = ['03077']
  state.scenarioFlags = { interviewed: ['03076a'], toughCrowd: [] }
  lastKing.behavior.resolution(state, 'r3')
  assert.deepEqual(state.campaign.records.vipsInterviewed, ['03077'])
})

test('AI 完成会谈触发的翻面是公开演出，所有座位都能收到翻开的卡面', () => {
  // 翻面发生在技能检定的成功结算内；info() 在检定期间默认按 privateSeat 只发给执行者，
  // AI 座位没有界面，人类玩家就完全看不到这张翻开的贵宾卡。翻面/揭示是摆在桌上的公开事实。
  const state = createGameState({
    campaignId: 'thePathToCarcosa',
    playerInvestigator: '05004',
    seed: 'last-king-ai-flip-public',
    seatInvestigators: ['05004', '01001'],
  }, [{ seat: 0, role: 'human' }, { seat: 1 }])
  settle(state)
  startScenario(state, 1, [])
  assert.equal(state.scenario.id, 'theLastKing')

  const ai = state.investigators[1]
  ai.actionsLeft = 3
  ai.intellect = 99
  ai.hand = []
  state.investigators[0].hand = []
  const guest = state.storyAssets.find(asset => asset.code === '03076a')
  assert.ok(guest, '康斯坦丝在场上')
  guest.location = ai.location
  guest.clues = 1
  state.currentSeat = 1
  state.phase = 'investigation'
  state.chaosBag = ['0']
  state.encounterDeck = []

  const move = legalMoves(state).find(candidate => candidate.rule === 'interviewGuest')
  assert.ok(move, 'AI 可以发起最后一次会谈')
  const events = [...applyMove(state, 1, move)]
  for (let index = 0; index < 20 && state.pendingChoice; index++) {
    const choice = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0]?.id
    events.push(...applyMove(state, decisionSeat(state), { action: 'choose', choiceId: choice.id, optionId }))
  }
  assert.deepEqual(state.scenarioFlags.interviewed, ['03076a'], '会谈已完成并触发翻面')

  for (const observerSeat of [0, 1, null]) {
    const cue = viewEvents(events, observerSeat)
      .find(event => event.type === 'info' && event.presentation?.flip && event.presentation.code === '03076a')
    assert.ok(cue, `观察者 ${observerSeat} 应收到翻面演出`)
    assert.equal(cue.presentation.face, 'back')
    assert.equal(cue.presentation.name, '英格兰姆的誓约')
    assert.equal(cue.privateSeat, undefined, '翻面演出不能带 privateSeat')
  }
})

