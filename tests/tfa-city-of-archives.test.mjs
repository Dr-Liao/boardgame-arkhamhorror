import test from 'node:test'
import assert from 'node:assert/strict'
import * as archives from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/index.js'
import {
  CARD_CODES, HALLS_SLOTS, REMEMBERED_TASKS, ROOM_CODES, ROOM_SLOTS, SET_ASIDE_LOCATIONS,
  scenario as definition,
} from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/definition.js'
import {
  behavior, completedTasks, handLimit, implementedEncounterCodes,
} from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import {
  applyMove, createGameState, finishScenario, investigatorEntryError, legalMoves, placeLocation, relocateEnemy, relocateInvestigator, spawnEnemy, startScenario,
} from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { contentRegistry } from '../content/registered.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { placeDreamGate } from '../src/engine/dream-gate.js'
import {
  applyInvestigatorForm, hasInvestigatorForm, restoreInvestigatorForm,
} from '../src/engine/investigator-form.js'
import { migrateState } from '../src/engine/save-migration.js'

const clone = value => structuredClone(value)

function stateFor(count = 2, records = {}) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: CARD_CODES.bodyOfAYithian, name: `调查员${seat + 1}`, location: 'interviewRoom1',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3, yithianBody: true,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    locationVariants: {},
    victoryDisplay: [],
    removedFromGame: [],
    encounterDeck: [],
    encounterDiscard: [],
    turnsTaken: [],
    skillTest: null,
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [] })),
      chaosBag: [],
      supplies: Array.from({ length: count }, () => []),
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

test('会谈间随机换位后，真实引擎放置的卡面身份与槽位计划一致', () => {
  const state = stateFor(1)
  state.log = []
  behavior.setupLocations(state, [], setupHelper(17))
  for (const slot of ROOM_SLOTS) {
    placeLocation(state, slot, [])
    const placed = state.locations.find(location => location.id === slot)
    assert.ok(placed, slot)
    assert.equal(placed.originalCode, state.scenarioFlags.rooms[slot], slot)
    assert.equal(placed.code, state.scenarioFlags.rooms[slot], slot)
  }
  assert.deepEqual(new Set(ROOM_SLOTS.map(slot => state.locations.find(location => location.id === slot).originalCode)),
    new Set(Object.values(ROOM_CODES)))
})

function setupHelper(seed = 5) {
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

function makeApi(state, options = {}) {
  let seed = options.seed ?? 7
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const log = []
  let threatId = 0
  const record = (kind, ...rest) => log.push([kind, ...rest])
  return {
    log,
    random,
    info: text => record('info', text),
    privateInfo: (seat, text) => record('privateInfo', seat, text),
    choose: request => (options.choose ? options.choose(request) : request?.options?.[0]?.id),
    test: (seat, skill, difficulty, resolve, bonus, source) => {
      const result = (options.testResult || (() => ({ success: true, value: difficulty + 1, difficulty, skill })))(
        { seat, skill, difficulty, source })
      record('test', skill, difficulty)
      resolve(result)
    },
    place: id => {
      record('place', id)
      if (state.locations.some(location => location.id === id)) return
      const base = clone(definition.locations[id])
      const def = { ...base, ...(state.locationVariants?.[id] || {}), id }
      const clues = def.cluesFixed !== undefined ? def.cluesFixed
        : (def.cluesPerInvestigator || 0) * state.numInvestigators
      state.locations.push({ ...def, id, revealed: true, clues, maxClues: clues })
    },
    reveal: id => record('reveal', id),
    storyAsset: (code, location) => {
      record('storyAsset', code, location)
      state.storyAssets.push({ id: `story-${code}`, code, originalCode: code, controllerSeat: null, location })
    },
    spawn: (code, location) => record('spawn', code, location),
    attack: (enemy, inv) => record('attack', enemy?.code, inv?.seat),
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    directDamage: (seat, n) => { state.investigators[seat].damage += n },
    directHorror: (seat, n) => { state.investigators[seat].horror += n },
    healDamage: () => {},
    healHorror: () => {},
    moveInvestigator: (seat, destination) => {
      record('move', seat, destination)
      state.investigators[seat].location = destination
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    evadeEnemy: enemy => { enemy.exhausted = true; enemy.engagedSeat = null },
    loseActions: () => {},
    endTurn: seat => record('endTurn', seat),
    drawCards: (seat, n) => {
      record('draw', seat, n)
      for (let index = 0; index < n; index++) {
        const code = state.investigators[seat].deck.pop()
        if (code) state.investigators[seat].hand.push(code)
      }
    },
    drawEncounter: seat => record('drawEncounter', seat),
    discardRandom: (seat, n) => {
      record('discardRandom', seat, n)
      const inv = state.investigators[seat]
      for (let index = 0; index < n; index++) {
        if (!inv.hand.length) break
        inv.discard.push(inv.hand.pop())
      }
    },
    discardChosen: (seat, n, source) => {
      record('discardChosen', seat, n, source)
      const inv = state.investigators[seat]
      for (let index = 0; index < n; index++) {
        if (!inv.hand.length) break
        inv.discard.push(inv.hand.pop())
      }
    },
    spendClues: (seat, n) => {
      record('spendClues', seat, n)
      state.investigators[seat].clues -= n
    },
    payClues: (n, location) => {
      record('payClues', n, location)
      let remaining = n
      for (const inv of state.investigators.filter(entry => !location || entry.location === location)) {
        const pay = Math.min(remaining, inv.clues)
        inv.clues -= pay
        remaining -= pay
        if (!remaining) break
      }
    },
    gainClues: (seat, n) => { state.investigators[seat].clues += n },
    threat: (seat, code, extra = {}) => {
      threatId += 1
      state.investigators[seat].threat.push({ id: `threat-${threatId}`, code, originalCode: code, ...extra })
    },
    defeat: (inv, cause) => { inv.defeated = true; inv.defeatCause = cause },
    checkSupplies: (seat, name) => (state.campaign.supplies?.[seat] || []).includes(name),
    hasSupply: (seat, name) => (state.campaign.supplies?.[seat] || []).includes(name),
    shuffleDiscard: () => record('shuffleDiscard'),
    shuffleEncounterDeck: () => record('shuffleEncounterDeck'),
    advanceAct: () => record('advanceAct'),
    advanceAgenda: () => record('advanceAgenda'),
    addDoom: () => {},
    finish: key => record('finish', key),
    resign: seat => record('resign', seat),
    trauma: () => {},
  }
}

// 按 definition 的符号连线把（含会谈间变体的）地点放进场。
function placeFromSetup(state, ids = Object.keys(definition.locations)) {
  for (const id of ids) {
    const base = clone(definition.locations[id])
    const def = { ...base, ...(state.locationVariants?.[id] || {}), id }
    const clues = def.cluesFixed !== undefined ? def.cluesFixed
      : (def.cluesPerInvestigator || 0) * state.numInvestigators
    state.locations.push({ ...def, id, revealed: true, clues, maxClues: clues })
  }
  return state
}

function prepared(records = { theInvestigatorsCooperatedWithTheYithians: true }, count = 2) {
  const state = stateFor(count, records)
  behavior.preScenarioSetup(state, [], makeApi(state))
  behavior.setupLocations(state, [], setupHelper(9))
  placeFromSetup(state)
  // 真实引擎的 setupBeforeOpeningHands 分支：preScenarioSetup（放到一边）→ 起始手牌 →
  // afterOpeningHands（换身）。夹具按同一顺序补上第二步，后面的用例才看得到 04244。
  behavior.afterOpeningHands(state, [], makeApi(state))
  return state
}

function invAt(state, id, seat = 0) {
  state.investigators[seat].location = id
  return state.investigators[seat]
}

const slotOf = (state, code) => state.locations.find(location => location.originalCode === code)?.id

test('天机之城 M5：章节已升级为 playable，结构照原卡', () => {
  assert.equal(archives.manifest.status, 'playable')
  assert.equal(archives.manifest.catalogReferenceOnly, undefined)
  assert.equal(archives.manifest.referenceCode, undefined)
  assert.equal(archives.scenario.originalCode, '04237')
  assert.equal(archives.manifest.locations.length, 11)
  assert.equal(archives.manifest.acts.map(act => act.id).join(','), 'act1,act2,act3')
  assert.equal(archives.manifest.agendas.map(agenda => agenda.id).join(','), 'agenda1,agenda2,agenda3')
  assert.deepEqual(archives.manifest.resolutionIds, ['noResolution', 'r1'])
  assert.deepEqual(archives.manifest.requiredEncounterGroupIds,
    ['theCityOfArchives', 'agentsOfYogSothoth', 'lockedDoors', 'chillingCold', 'strikingFear'])
  assert.deepEqual(archives.manifest.requiredMechanicIds, ['tfaSupplies'])
  assert.equal(archives.manifest.startLocationId, 'interviewRoom1')
  assert.deepEqual(archives.scenario.agendas.map(agenda => agenda.doomThreshold), [5, 7, 7])
  assert.deepEqual(implementedEncounterCodes, [
    '01163', '01164', '01165', '01167', '01168', '01174', '01177', '01178',
    '04257', '04258', '04259', '04260', '04261', '04262', '04263',
  ])
  const report = scenarioZoneReport(archives.scenario, archives.manifest)
  assert.equal(report.encounterCards, 34)
  assert.equal(report.declaredSetAsideCards, 10)
  assert.deepEqual(report.duplicateActiveZoneCodes, [])
})

test('符号地图按印刷符号连线：会谈间只连东侧廊道', () => {
  const byId = Object.fromEntries(archives.manifest.locations.map(location => [location.id, location]))
  assert.deepEqual([...byId.interviewRoom1.connections], ['hallsEastern'])
  assert.deepEqual([...byId.interviewRoom2.connections], ['hallsEastern'])
  assert.deepEqual([...byId.interviewRoom3.connections], ['hallsEastern'])
  assert.deepEqual([...byId.yithianOrrery.connections].sort(), ['laboratory'])
  assert.deepEqual([...byId.deconstructionRoom.connections], ['laboratory'])
  assert.deepEqual([...byId.towersOfPnakotus.connections], ['hallsWestern'])
  assert.deepEqual([...byId.greatLibrary.connections], ['hallsWestern'])
  assert.deepEqual([...byId.hallsWestern.connections].sort(),
    ['greatLibrary', 'hallsEastern', 'hallsNorthern', 'towersOfPnakotus'])
  assert.deepEqual([...byId.laboratory.connections].sort(),
    ['deconstructionRoom', 'hallsNorthern', 'yithianOrrery'])
})

test('布置是确定性的，并按「合作/反抗」记录决定 1 号会谈间的卡面', () => {
  const build = (records, seed) => {
    const state = stateFor(2, records)
    behavior.preScenarioSetup(state, [], makeApi(state))
    const ids = behavior.setupLocations(state, [], setupHelper(seed))
    return { state, ids }
  }
  const first = build({ theInvestigatorsCooperatedWithTheYithians: true }, 17)
  const again = build({ theInvestigatorsCooperatedWithTheYithians: true }, 17)
  assert.deepEqual(first.ids, [...ROOM_SLOTS, ...HALLS_SLOTS])
  assert.equal(first.state.scenarioFlags.rooms.interviewRoom1, ROOM_CODES.arrival)
  assert.deepEqual(first.state.scenarioFlags.rooms, again.state.scenarioFlags.rooms)
  assert.deepEqual(first.state.locationVariants, again.state.locationVariants)
  const resisted = build({ theInvestigatorsResistedCaptivity: true }, 17)
  assert.equal(resisted.state.scenarioFlags.rooms.interviewRoom1, ROOM_CODES.restraining)
  assert.deepEqual(Object.values(resisted.state.scenarioFlags.rooms).sort(),
    [ROOM_CODES.arrival, ROOM_CODES.ichor, ROOM_CODES.restraining].sort())
})

test('放在一边的是 5 处地点、看管人与 4 张离体体验', () => {
  const state = stateFor()
  behavior.preScenarioSetup(state, [], makeApi(state))
  behavior.setupLocations(state, [], setupHelper(3))
  const aside = state.scenarioZones.setAside
  assert.equal(aside.filter(code => code === CARD_CODES.outOfBodyExperience).length, 4)
  assert.ok(aside.includes(CARD_CODES.custodian))
  assert.deepEqual(archives.manifest.zones.setAside.map(entry => entry.cardCode),
    ['04251', '04252', '04253', '04254', '04255', '04256', '04264'])
  for (const id of SET_ASIDE_LOCATIONS) assert.ok(state.scenario.locations[id], id)
})

test('开场：合作时观测者在 1 号会谈间，反抗时进胜利区，且遭遇牌库少一张', () => {
  const cooperate = stateFor(2, { theInvestigatorsCooperatedWithTheYithians: true })
  behavior.preScenarioSetup(cooperate, [], makeApi(cooperate))
  behavior.setupLocations(cooperate, [], setupHelper(11))
  placeFromSetup(cooperate, ROOM_SLOTS)
  const spawned = []
  behavior.setupEnemies(cooperate, [], {
    spawnEnemy: (state, code, location, seat) => {
      spawned.push({ code, location, seat })
      const enemy = { id: 'e1', code, originalCode: code, location, aloof: false, hunter: false, engagedSeat: null }
      state.enemies.push(enemy)
      behavior.enemySpawned(state, enemy, makeApi(state))
      return enemy
    },
    info: () => {},
  })
  assert.deepEqual(spawned, [{ code: '01177', location: 'interviewRoom1', seat: null }])
  assert.equal(cooperate.enemies[0].aloof, true, '场景 1a：伊斯观测者获得冷漠')
  // 冷漠是场景授予的，必须记在 grantedAloof 上，否则引擎在敌人移动后会按印刷关键词重算掉。
  assert.equal(cooperate.enemies[0].grantedAloof, true, '剧本授予的冷漠记在 grantedAloof')

  const resist = stateFor(2, { theInvestigatorsResistedCaptivity: true })
  behavior.preScenarioSetup(resist, [], makeApi(resist))
  behavior.setupLocations(resist, [], setupHelper(11))
  placeFromSetup(resist, ROOM_SLOTS)
  behavior.setupEnemies(resist, [], { spawnEnemy: () => { throw new Error('不应生成') }, info: () => {} })
  assert.deepEqual(resist.victoryDisplay.map(card => card.originalCode), ['01177'])
  assert.equal(resist.victoryDisplay[0].victory, 1)

  const deck = ['01178', '01177', '01177', '04257']
  behavior.modifyDeck(resist, deck)
  assert.equal(deck.filter(code => code === '01177').length, 1)
})

test('起始手牌前：写入合作记录，并把独特道具与亚历山卓放到一边（不改战役牌组）', () => {
  const state = stateFor(2)
  state.investigators[0].deck = ['01041', '01020', '04051', '01001']
  // 起始手牌在「放到一边」之后才抽：设置阶段不检查手牌（旧实现会连手牌一起清掉）。
  state.investigators[0].hand = ['01041']
  state.campaign.investigators[0].deck = ['01041', '04051', '01020']
  const api = makeApi(state, { choose: () => 'cooperate' })
  behavior.preScenarioSetup(state, [], api)
  assert.equal(state.campaign.records.theInvestigatorsCooperatedWithTheYithians, true)
  assert.deepEqual(state.investigators[0].deck, ['01020', '01001'])
  assert.deepEqual(state.investigators[0].hand, ['01041'], '设置阶段不动手牌')
  // 04237：这些卡只在本关「放在一边，位于场外」，下一关按战役牌组记录重建时回收。
  assert.deepEqual(state.campaign.investigators[0].deck, ['01041', '04051', '01020'],
    '战役牌组记录保持完整（旧实现会从记录里永久删掉）')
  assert.ok(state.scenarioFlags.removedCards.includes('01041'))
  assert.ok(state.scenarioFlags.setAsideCards.includes('04051'))
  assert.deepEqual(state.setAside.map(card => card.code).sort(), ['01041', '04051'])
  // 夹具的调查员卡号本来就是 04244；换身是否套上以 inv.form 快照为准。
  assert.equal(state.investigators[1].form, undefined, '换身在起始手牌之后（afterOpeningHands）')

  behavior.afterOpeningHands(state, [], makeApi(state))
  assert.equal(state.investigators[1].form, 'yithian')
  assert.equal(state.investigators[1].yithianBody, true)
  // 幂等：setupBeforeOpeningHands 引擎路径里 setupLocations 和 defer 分支都可能触发钩子。
  behavior.preScenarioSetup(state, [], api)
  assert.deepEqual(state.investigators[0].deck, ['01020', '01001'])

  const resisting = stateFor(1)
  behavior.preScenarioSetup(resisting, [], makeApi(resisting, { choose: () => 'resist' }))
  assert.equal(resisting.campaign.records.theInvestigatorsResistedCaptivity, true)
})

test('密谋 1a：调查员不能放置道具支援，推进后解除', () => {
  const state = prepared()
  const item = { code: '01020', type: 'asset', traits: ['Item', 'Weapon'] }
  assert.equal(behavior.canPlayCard(state, state.investigators[0], item), false)
  state.agendaIndex = 1
  assert.equal(behavior.canPlayCard(state, state.investigators[0], item), true)
})

test('场景 1b：放置 5 处地点并随机安置看管人，观测者失去冷漠', () => {
  const state = prepared()
  state.enemies.push({ id: 'e1', code: '01177', originalCode: '01177', location: 'hallsEastern', aloof: true, grantedAloof: true })
  const api = makeApi(state, { seed: 21 })
  behavior.actReveal(state, state.acts[0], api)
  for (const id of SET_ASIDE_LOCATIONS) assert.ok(state.locations.some(location => location.id === id), id)
  assert.deepEqual(state.storyAssets.map(asset => asset.code), [CARD_CODES.custodian])
  assert.ok(SET_ASIDE_LOCATIONS.includes(state.storyAssets[0].location))
  assert.equal(state.enemies[0].aloof, false)
  assert.equal(state.enemies[0].grantedAloof, false, '1b 撤掉 1a 授予的冷漠')
})

test('场景 2 的目标：六项条件满足三项即推进；2b 本卡进胜利区', () => {
  const state = prepared()
  state.actIndex = 1
  state.scenarioFlags.remembered = { foundTheProcess: true, dissectedAnOrgan: true }
  let advanced = 0
  behavior.checkObjectives(state, { advanceAct: () => { advanced += 1 } })
  assert.equal(advanced, 0, '两项任务还不够')
  state.investigators[0].assets.push({ id: 'custodian', code: CARD_CODES.custodian })
  behavior.checkObjectives(state, { advanceAct: () => { advanced += 1 } })
  assert.equal(advanced, 1)
  assert.equal(completedTasks(state), 3)
  behavior.actReveal(state, state.acts[1], makeApi(state))
  assert.ok(state.victoryDisplay.some(card => card.originalCode === CARD_CODES.act2))
})

test('场景 3 的目标：幸存者人手 10 张手牌推进，3b 直接进入结局 1', () => {
  const state = prepared()
  state.actIndex = 2
  const api = makeApi(state)
  state.investigators[0].hand = Array.from({ length: 10 }, () => '01001')
  state.investigators[1].hand = Array.from({ length: 9 }, () => '01001')
  behavior.checkObjectives(state, api)
  assert.equal(api.log.some(entry => entry[0] === 'advanceAct'), false)
  state.investigators[1].hand.push('01001')
  behavior.checkObjectives(state, api)
  assert.equal(api.log.some(entry => entry[0] === 'advanceAct'), true)
  const observer = { id: 'e1', code: '01177', originalCode: '01177', aloof: true, hunter: false }
  state.enemies.push(observer)
  behavior.actReveal(state, state.acts[2], api)
  assert.equal(api.log.some(entry => entry[0] === 'finish' && entry[1] === 'r1'), true)
  assert.equal(observer.hunter, true)
  assert.equal(observer.aloof, false)
  assert.equal(observer.grantedAloof, false, '3b 前已由 1b 撤掉剧本冷漠')
})

test('大图书馆：共同花费线索后检定智识(3)记住归位程式', () => {
  const state = prepared()
  const inv = invAt(state, 'greatLibrary')
  state.investigators[1].location = 'greatLibrary'
  state.investigators[1].clues = 2
  inv.clues = 2
  const api = makeApi(state)
  const moves = behavior.actions(state, inv)
  const move = moves.find(entry => entry.rule === 'decipherProcess')
  assert.ok(move)
  behavior.performAction(state, inv, move, api)
  assert.ok(api.log.some(entry => entry[0] === 'payClues' && entry[1] === 2))
  assert.equal(state.scenarioFlags.remembered.foundTheProcess, true)
})

// 实战回归（2026-11-10）：大图书馆地点上有 4 个线索、但调查员手里没有线索时，
// 行动不能因为「地点线索够了」而被列为可用；即使已经提交，也必须安全返回而不是抛错。
// 之前 actions/performAction 的预检读地点上的线索，引擎 groupPayment 支付读调查员手里的
// 线索，两者不一致会在支付时抛「符合地点条件的共同线索不足」：整条事务回滚，而对局
// 卡在同一个待决选择上，每次重试都在同一处抛错（AI 连续两步都失败）。
test('大图书馆：地点线索不能直接用于共同支付，调查员线索不足时安全返回', () => {
  const state = prepared()
  const inv = invAt(state, 'greatLibrary')
  inv.clues = 0
  state.investigators[1].clues = 0
  assert.equal(state.locations.find(location => location.id === 'greatLibrary').clues, 4)
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'decipherProcess')
  assert.ok(move)
  assert.match(String(move.reason), /需要共同支付 2 个线索（当前 0）/)
  const api = makeApi(state)
  assert.doesNotThrow(() => behavior.performAction(state, inv, { rule: 'decipherProcess' }, api))
  assert.equal(api.log.some(entry => entry[0] === 'payClues'), false)
  assert.equal(api.log.some(entry => entry[0] === 'test'), false)
  assert.equal((state.scenarioFlags.remembered || {}).foundTheProcess, undefined)
  // 同一地点另一名调查员手里的线索可以凑够：支付来源是调查员持有的线索。
  state.investigators[1].location = 'greatLibrary'
  state.investigators[1].clues = 2
  const payable = behavior.actions(state, inv).find(entry => entry.rule === 'decipherProcess')
  assert.equal(payable.reason, null)
})

test('实验室与解构室：成功记住任务，失败在实验室补线索并提高难度', () => {
  const lab = prepared()
  const inv = invAt(lab, 'laboratory')
  behavior.performAction(lab, inv, { rule: 'activateDevice' }, makeApi(lab))
  assert.equal(lab.scenarioFlags.remembered.activatedTheDevice, true)

  const failing = prepared()
  const inv2 = invAt(failing, 'laboratory')
  const api = makeApi(failing, {
    testResult: ({ difficulty }) => ({ success: false, value: difficulty - 1, difficulty }),
  })
  behavior.performAction(failing, inv2, { rule: 'activateDevice' }, api)
  assert.equal(failing.locations.find(location => location.id === 'laboratory').clues, 3)
  assert.equal(failing.scenarioFlags.remembered.activatedTheDevice, undefined)

  const room = prepared()
  const inv3 = invAt(room, 'deconstructionRoom')
  room.locations.find(location => location.id === 'deconstructionRoom').clues = 3
  const api3 = makeApi(room)
  const label = behavior.actions(room, inv3).find(entry => entry.rule === 'dissectOrgan').label
  assert.match(label, /战斗\(7\)/)
  behavior.performAction(room, inv3, { rule: 'dissectOrgan' }, api3)
  assert.equal(api3.log.find(entry => entry[0] === 'test')[2], 7)
  assert.equal(room.scenarioFlags.remembered.dissectedAnOrgan, true)
})

test('太阳系仪两个行动、纳克特之塔弃牌重抽、纳克特廊道免费换位', () => {
  const state = prepared()
  const inv = invAt(state, 'yithianOrrery')
  state.locations.find(location => location.id === 'yithianOrrery').clues = 0
  const api = makeApi(state)
  const orreryMove = behavior.actions(state, inv).find(entry => entry.rule === 'realizeTheYear')
  assert.equal(orreryMove.actions, 2)
  behavior.performAction(state, inv, orreryMove, api)
  assert.equal(state.scenarioFlags.remembered.realizedWhatYearItIs, true)

  const towersState = prepared()
  const towerInv = invAt(towersState, 'towersOfPnakotus')
  towerInv.hand = ['01001', '01002', '01003']
  towerInv.discard = ['01004']
  towerInv.deck = ['01005', '01006', '01007', '01008']
  const towersApi = makeApi(towersState, { choose: () => '2' })
  const towerMove = behavior.actions(towersState, towerInv).find(entry => entry.rule === 'towersOfPnakotus')
  behavior.performAction(towersState, towerInv, towerMove, towersApi)
  assert.equal(towerInv.discard.length, 0)
  assert.equal(towerInv.hand.length, 4)
  assert.equal(towerInv.deck.length, 4)
  assert.equal(towerInv.tfaTowersRound, 1)
  // 每回合一次：用掉后保留「已用」提示，但不再可执行。
  const towerAfter = behavior.actions(towersState, towerInv).find(entry => entry.rule === 'towersOfPnakotus')
  assert.equal(towerAfter.used, true)
  assert.match(towerAfter.reason, /本回合已使用/)
  assert.equal(behavior.actions(towersState, towerInv)
    .some(entry => entry.rule === 'towersOfPnakotus' && !entry.reason), false)

  const halls = prepared()
  const hallsInv = invAt(halls, 'hallsNorthern')
  hallsInv.hand = ['01001']
  const hallsApi = makeApi(halls, { choose: () => 'hallsEastern' })
  const shortcut = behavior.actions(halls, hallsInv).find(entry => entry.rule === 'hallsShortcut')
  assert.equal(shortcut.actions, 0)
  behavior.performAction(halls, hallsInv, shortcut, hallsApi)
  assert.equal(hallsInv.location, 'hallsEastern')
  assert.deepEqual(hallsInv.discard, ['01001'])
  // 换地方后仍在同一轮：提示改为「本回合已使用」。
  const shortcutAfter = behavior.actions(halls, hallsInv).find(entry => entry.rule === 'hallsShortcut')
  assert.equal(shortcutAfter?.used, true)
  assert.match(shortcutAfter.reason, /本回合已使用/)
})

test('回归自我：花 1 个线索抽取，手牌超出上限时多抽 1 张', () => {
  const state = prepared(undefined, 1)
  state.actIndex = 2
  const inv = state.investigators[0]
  inv.clues = 1
  const api = makeApi(state)
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'repossessionDraw')
  behavior.performAction(state, inv, move, api)
  assert.equal(inv.clues, 0)
  assert.ok(api.log.some(entry => entry[0] === 'draw' && entry[2] === 2))

  const cramped = prepared(undefined, 1)
  cramped.actIndex = 2
  cramped.agendaIndex = 3
  const crampedInv = cramped.investigators[0]
  crampedInv.clues = 1
  crampedInv.hand = Array.from({ length: 5 }, () => '01001')
  const crampedApi = makeApi(cramped)
  behavior.performAction(cramped, crampedInv, { rule: 'repossessionDraw' }, crampedApi)
  assert.equal(handLimit(cramped, crampedInv), 4)
  // 先抽 2 张，抽完超过上限后再抽 1 张。
  assert.deepEqual(crampedApi.log.filter(entry => entry[0] === 'draw').map(entry => entry[2]), [2, 1])
})

test('看管人：谈判成功后放线索并取得控制权', () => {
  const state = prepared(undefined, 1)
  const inv = invAt(state, 'greatLibrary')
  inv.clues = 1
  state.storyAssets.push({
    id: 'custodian', code: CARD_CODES.custodian, originalCode: CARD_CODES.custodian,
    controllerSeat: null, location: 'greatLibrary',
  })
  const api = makeApi(state)
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'parleyCustodian')
  behavior.performAction(state, inv, move, api)
  assert.equal(state.storyAssets.length, 0)
  assert.deepEqual(inv.assets.map(asset => asset.code), [CARD_CODES.custodian])
  assert.equal(inv.assets[0].clues, 1)
  assert.equal(completedTasks(state), 1)

  const drawState = prepared(undefined, 1)
  const owner = drawState.investigators[0]
  owner.assets.push({ id: 'custodian', code: CARD_CODES.custodian, controllerSeat: 0 })
  drawState.turnsTaken = [0]
  const drawApi = makeApi(drawState)
  behavior.phaseBegan(drawState, 'investigation', drawApi)
  assert.ok(drawApi.log.some(entry => entry[0] === 'draw' && entry[2] === 1))
})

test('伊斯观测者的强制：攻击时随机弃 1 张手牌，无牌则 +1 伤害 +1 恐惧', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  const enemy = { id: 'e1', code: '01177', originalCode: '01177', location: inv.location, damage: 1, horror: 1 }
  inv.hand = ['01001']
  const api = makeApi(state)
  behavior.enemyAttackStarted(state, enemy, inv, api)
  assert.deepEqual(inv.discard, ['01001'])
  assert.deepEqual(behavior.enemyAttackModifier(state, enemy, inv), {})

  inv.hand = []
  behavior.enemyAttackStarted(state, enemy, inv, api)
  assert.deepEqual(behavior.enemyAttackModifier(state, enemy, inv), { damage: 1, horror: 1 })
  behavior.enemyAttackResolved(state, enemy, inv, api)
  assert.deepEqual(behavior.enemyAttackModifier(state, enemy, inv), {})

  const scholar = { id: 'e2', code: CARD_CODES.scholar, originalCode: CARD_CODES.scholar }
  inv.hand = ['01001', '01002', '01003']
  behavior.enemyAttackStarted(state, scholar, inv, api)
  assert.equal(inv.discard.length, 3)
})

test('监守人与科学家：按卡面生成地生成，任务完成后失去冷漠并获得猎手', () => {
  const state = prepared()
  assert.equal(behavior.spawnLocation(state, CARD_CODES.keeper, 'hallsEastern'), 'greatLibrary')
  assert.equal(behavior.spawnLocation(state, CARD_CODES.scientist, 'hallsEastern'), 'laboratory')
  assert.equal(behavior.spawnLocation(state, CARD_CODES.scholar, 'hallsEastern'), 'hallsEastern')
  const keeper = { id: 'k', code: CARD_CODES.keeper, originalCode: CARD_CODES.keeper, aloof: true, hunter: false }
  const scientist = { id: 's', code: CARD_CODES.scientist, originalCode: CARD_CODES.scientist, aloof: true, hunter: false }
  state.enemies.push(keeper, scientist)
  behavior.checkObjectives(state, { advanceAct: () => {} })
  assert.equal(keeper.hunter, false, '还没找到归位程式')
  state.scenarioFlags.remembered = { foundTheProcess: true }
  behavior.checkObjectives(state, { advanceAct: () => {} })
  assert.equal(keeper.aloof, false)
  assert.equal(keeper.hunter, true)
  assert.equal(scientist.hunter, false)
  state.scenarioFlags.remembered.dissectedAnOrgan = true
  behavior.checkObjectives(state, { advanceAct: () => {} })
  assert.equal(scientist.hunter, true)

  const orphan = prepared()
  orphan.locations = orphan.locations.filter(location => location.id !== 'greatLibrary')
  assert.equal(behavior.spawnLocation(orphan, CARD_CODES.keeper, 'hallsWestern'), 'hallsWestern')
})

test('大图书馆的轮末强制：线索不足 4 个时补足', () => {
  const state = prepared()
  const library = state.locations.find(location => location.id === 'greatLibrary')
  library.clues = 1
  behavior.roundEnded(state, makeApi(state))
  assert.equal(library.clues, 4)
})

test('会谈间的卡面：到达厅抽牌、拘束室讯问、脓液房间进入恐惧', () => {
  const arrival = prepared(undefined, 1)
  const inv = arrival.investigators[0]
  inv.location = slotOf(arrival, ROOM_CODES.arrival)
  arrival.enemies.push({ id: 'e1', code: '01177', originalCode: '01177', location: inv.location })
  const api = makeApi(arrival)
  arrival.turnsTaken = [0]
  behavior.turnBegins(arrival, inv, api)
  assert.ok(api.log.some(entry => entry[0] === 'draw' && entry[2] === 1))

  const restraining = prepared(undefined, 1)
  const restInv = invAt(restraining, slotOf(restraining, ROOM_CODES.restraining))
  const restApi = makeApi(restraining, { choose: request => (request.kind === 'skill' ? 'combat' : request.options[0].id) })
  const move = behavior.actions(restraining, restInv).find(entry => entry.rule === 'interrogateSubject')
  behavior.performAction(restraining, restInv, move, restApi)
  assert.equal(restApi.log.find(entry => entry[0] === 'test')[1], 'combat')
  assert.equal(restraining.scenarioFlags.remembered.interviewedASubject, true)

  const ichor = prepared(undefined, 1)
  const ichorSlot = slotOf(ichor, ROOM_CODES.ichor)
  const ichorInv = invAt(ichor, ichorSlot)
  const ichorApi = makeApi(ichor, {
    testResult: ({ difficulty }) => ({ success: false, value: difficulty - 2, difficulty }),
  })
  behavior.locationEntered(ichor, ichorInv, ichor.locations.find(entry => entry.id === ichorSlot), ichorApi)
  assert.equal(ichorInv.horror, 2)
})

test('遭遇：伊斯人登场禁止调查并给出弃 2 张手牌的解法', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  const api = makeApi(state)
  const placed = behavior.resolveEncounter(state, inv,
    { code: CARD_CODES.yithianPresence, originalCode: CARD_CODES.yithianPresence }, api)
  assert.equal(placed, true)
  assert.equal(inv.threat.length, 1)
  assert.equal(behavior.investigationError(state, inv, state.locations[0]), null, '地点没有伊斯敌人时不限制')
  state.enemies.push({ id: 'e1', code: '01177', originalCode: '01177', location: inv.location })
  assert.match(behavior.investigationError(state, inv, state.locations.find(l => l.id === inv.location)), /伊斯/)
  assert.equal(behavior.encounterActions(state, inv).some(move => move.rule === 'endYithianPresence'), false)
  state.enemies = []
  inv.hand = ['01001', '01002']
  const moves = behavior.encounterActions(state, inv)
  assert.equal(moves.some(move => move.rule === 'endYithianPresence'), true)
  behavior.performEncounterAction(state, inv, moves.find(move => move.rule === 'endYithianPresence'), api)
  assert.equal(inv.threat.length, 0)
  assert.ok(state.encounterDiscard.includes(CARD_CODES.yithianPresence))
})

test('遭遇：残酷拷问在「进行了一次会谈」后造成恐惧并涌动', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  const quiet = makeApi(state)
  behavior.resolveEncounter(state, inv,
    { code: CARD_CODES.cruelInterrogations, originalCode: CARD_CODES.cruelInterrogations }, quiet)
  assert.equal(inv.horror, 0)
  assert.equal(quiet.log.some(entry => entry[0] === 'drawEncounter'), false)
  inv.threat = []
  state.scenarioFlags.remembered = { interviewedASubject: true }
  const api = makeApi(state)
  const result = behavior.resolveEncounter(state, inv,
    { code: CARD_CODES.cruelInterrogations, originalCode: CARD_CODES.cruelInterrogations }, api)
  assert.equal(inv.horror, 1)
  assert.deepEqual(result, { placed: true, surgeHandled: true })
  assert.equal(api.log.some(entry => entry[0] === 'drawEncounter'), true)
})

test('遭遇：丧失人性按失败差额移出牌库顶，卡牌总量不足 10 张则发疯', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  inv.deck = Array.from({ length: 13 }, (_, index) => `0100${index % 10}`)
  const api = makeApi(state, {
    testResult: ({ difficulty }) => ({ success: false, value: difficulty - 3, difficulty }),
  })
  behavior.resolveEncounter(state, inv,
    { code: CARD_CODES.lostHumanity, originalCode: CARD_CODES.lostHumanity }, api)
  assert.equal(inv.deck.length, 10)
  assert.equal(state.removedFromGame.length, 3)
  assert.equal(inv.defeated, undefined, '还有 10 张牌，不算发疯')

  const doomed = prepared(undefined, 1)
  const doomedInv = doomed.investigators[0]
  doomedInv.deck = ['01001', '01002']
  doomedInv.hand = ['01003']
  behavior.resolveEncounter(doomed, doomedInv,
    { code: CARD_CODES.lostHumanity, originalCode: CARD_CODES.lostHumanity },
    makeApi(doomed))
  assert.equal(doomedInv.defeated, true)
})

test('遭遇：被监禁的意识把弃牌堆压到修正后的技能值', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  inv.hand = ['01001', '01002', '01003', '01004']
  const api = makeApi(state, { testResult: ({ difficulty }) => ({ success: true, value: 2, difficulty }) })
  behavior.resolveEncounter(state, inv,
    { code: CARD_CODES.captiveMind, originalCode: CARD_CODES.captiveMind }, api)
  assert.equal(inv.hand.length, 2)
  assert.equal(inv.discard.length, 2)
})

test('密谋 1b：从牌库顶 9 张找道具，洗回弃牌堆并把看管人移到线索最多处', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  inv.deck = ['01001', '01002', '01003', '01041', '01020', '01004', '01005', '01006', '01007', '01008']
  state.storyAssets.push({
    id: 'custodian', code: CARD_CODES.custodian, originalCode: CARD_CODES.custodian,
    controllerSeat: null, location: inv.location,
  })
  state.locations.find(location => location.id === 'greatLibrary').clues = 3
  const api = makeApi(state, { seed: 4 })
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.deepEqual([...inv.hand].sort(), ['01020', '01041'].sort())
  assert.equal(inv.deck.length, 8)
  assert.ok(api.log.some(entry => entry[0] === 'shuffleDiscard'))
  assert.equal(state.storyAssets[0].location, 'greatLibrary')
})

test('密谋 2b：带挂坠的调查员抽 2 张并忽略手牌上限减少', () => {
  const state = prepared()
  state.campaign.supplies[1] = ['pendant']
  const api = makeApi(state)
  state.agendaIndex = 1
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.investigators[0].ignoreHandSizeReduction, undefined)
  assert.equal(state.investigators[1].ignoreHandSizeReduction, true)
  assert.ok(api.log.some(entry => entry[0] === 'draw' && entry[1] === 1 && entry[2] === 2))
  assert.equal(api.log.some(entry => entry[0] === 'draw' && entry[1] === 0), false)
  state.agendaIndex = 0
  assert.equal(handLimit(state, state.investigators[1]), 8)
  state.agendaIndex = 1
  assert.equal(handLimit(state, state.investigators[1]), 8, '挂坠忽略减少')
})

test('密谋 3b：幸存的每位调查员被击败', () => {
  const state = prepared()
  state.investigators[1].defeated = true
  behavior.agendaReveal(state, state.agendas[2], makeApi(state))
  assert.equal(state.investigators[0].defeated, true)
  assert.equal(state.investigators[1].defeated, true)
})

test('混乱标记：骷髅按手牌数、石板 -3、旧神 -2，困难面自动失败', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -1)
  inv.hand = Array.from({ length: 5 }, () => '01001')
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -3)
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).autoFail, true)
  state.difficulty = 'standard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'cultist', {}).delta, -2)
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing', {}).delta, -2)
  assert.equal(behavior.resolveChaosToken(state, inv, 'tablet', {}).delta, -3)
  assert.equal(behavior.resolveChaosToken(state, inv, 'eldersign', {}), null)
})

test('困难面的符号在检定成功时也把线索放到地点', () => {
  const state = prepared(undefined, 1)
  state.difficulty = 'hard'
  const inv = state.investigators[0]
  inv.clues = 1
  const location = state.locations.find(entry => entry.id === inv.location)
  const api = makeApi(state)
  behavior.afterTest(state, inv, {
    success: true, value: 5, difficulty: 3, skill: 'intellect', drawn: ['cultist'], cancelledTokens: [],
  }, api)
  assert.equal(inv.clues, 0)
  assert.equal(location.clues, 1)
})

test('结局：按完成任务数写入过程记录并给奖励经验', () => {
  const cases = [
    [6, 'theProcessWasPerfected', 4, 5, true],
    [5, 'theProcessWasSuccessful', 2, 5, false],
    [4, 'theProcessBackfired', 1, 4, false],
    [3, 'theProcessBackfiredSpectacularly', 0, 3, false],
  ]
  for (const [tasks, record, bonus, rememberedCount, custodian] of cases) {
    const state = prepared(undefined, 1)
    const remembered = {}
    for (const key of REMEMBERED_TASKS.slice(0, rememberedCount)) remembered[key] = true
    state.scenarioFlags.remembered = remembered
    if (custodian) state.investigators[0].assets.push({ id: 'custodian', code: CARD_CODES.custodian })
    const result = behavior.resolution(state, 'r1', [], makeApi(state))
    assert.equal(completedTasks(state), tasks)
    assert.equal(state.campaign.records[record], true, record)
    assert.equal(result.bonus, bonus)
    assert.equal(result.award, true)
  }
  const losing = prepared()
  behavior.resolution(losing, 'noResolution', [], makeApi(losing))
  assert.equal(losing.campaign.records.theInvestigatorsHadTheirMemoriesExpunged, true)
  assert.equal(losing.investigators[0].defeated, true)
  assert.throws(() => behavior.resolution(prepared(), 'r9', [], makeApi(prepared())))
})

test('伊斯人身体：投入卡牌时技能图标翻倍（每次检定一次）', () => {
  const state = prepared(undefined, 1)
  const inv = state.investigators[0]
  state.skillTest = { seat: inv.seat }
  assert.equal(behavior.commitIconMultiplier(state, inv).multiplier, 2)
  state.skillTest.tfaYithianIconDoubled = true
  assert.equal(behavior.commitIconMultiplier(state, inv), 1)
  const human = prepared(undefined, 1)
  restoreInvestigatorForm(human.investigators[0])
  human.skillTest = { seat: 0 }
  assert.equal(behavior.commitIconMultiplier(human, human.investigators[0]), 1)
})

test('同一路线两次结果一致，且状态可以 JSON 往返', () => {
  const run = () => {
    const state = stateFor(2, { theInvestigatorsCooperatedWithTheYithians: true })
    const api = makeApi(state, { seed: 31 })
    behavior.preScenarioSetup(state, [], api)
    const ids = behavior.setupLocations(state, [], setupHelper(31))
    placeFromSetup(state, ids)
    behavior.setupEnemies(state, [], {
      spawnEnemy: (target, code, location) => {
        const enemy = { id: 'e1', code, originalCode: code, location, aloof: false, hunter: false }
        target.enemies.push(enemy)
        behavior.enemySpawned(target, enemy, api)
        return enemy
      },
      info: () => {},
    })
    behavior.actReveal(state, state.acts[0], api)
    behavior.checkObjectives(state, api)
    return JSON.stringify(state)
  }
  const first = run()
  assert.equal(first, run())
  const restored = JSON.parse(first)
  assert.deepEqual(restored, JSON.parse(first))
  assert.equal(restored.scenarioFlags.rooms.interviewRoom1, ROOM_CODES.arrival)
  assert.equal(restored.locations.length, 11)
  assert.equal(restored.storyAssets.length, 1)
})

test('04260 伊斯人登场：同名威胁再抽到也再放一张', () => {
  const state = prepared(1)
  const inv = state.investigators[0]
  const api = makeApi(state)
  const card = state.scenario.treacheries['04260']
  behavior.resolveEncounter(state, inv, card, api)
  behavior.resolveEncounter(state, inv, card, api)
  assert.equal((inv.threat || []).filter(entry => entry.code === '04260').length, 2)
  assert.equal(api.log.some(entry => entry[0] === 'drawEncounter'), false, '不再白送遭遇')
})

test('04256 看管人：成功谈判先用掉自己的线索，没有线索就没有进展', () => {
  const state = prepared(2)
  const inv = state.investigators[0]
  const asset = { id: 'custodian', code: '04256', originalCode: '04256', name: '看管人', clues: 0, location: inv.location }
  state.storyAssets.push(asset)
  inv.location = inv.location
  const api = makeApi(state, { testResult: () => ({ success: true, value: 4, difficulty: 3, skill: 'intellect' }) })
  inv.clues = 0
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'parleyCustodian')
  behavior.performAction(state, inv, move, api)
  assert.equal(asset.clues, 0, '没有线索时不能放线索')
  inv.clues = 1
  behavior.performAction(state, inv, move, api)
  assert.equal(inv.clues, 0)
  assert.equal(asset.clues, 1)
})

test('04237 混乱标记：困难面石板按差值弃牌、异教徒成功也放线索', () => {
  const state = prepared(1)
  state.difficulty = 'hard'
  const inv = state.investigators[0]
  const location = state.locations.find(entry => entry.id === inv.location)
  inv.clues = 1
  inv.hand = ['01001', '01002', '01003']
  const api = makeApi(state)
  behavior.afterTest(state, inv, { success: false, drawn: ['tablet'], value: 1, difficulty: 3, skill: 'willpower' }, api)
  assert.equal(inv.hand.length, 1, '难度 3 - 结果 1 = 弃 2 张')
  behavior.afterTest(state, inv, { success: true, drawn: ['cultist'], value: 5, difficulty: 3, skill: 'willpower' }, api)
  assert.equal(inv.clues, 0, '困难面成功也放线索')
  assert.equal(location.clues, 1)
})

test('04257/04258：记录达成后失去冷漠并获得猎手（动态关键词）', () => {
  const state = prepared({}, 1)
  const api = makeApi(state)
  const keeper = { id: 'k', code: '04257', originalCode: '04257', name: '监守人', location: 'greatLibrary', aloof: true, printedAloof: true, hunter: false }
  const scientist = { id: 's', code: '04258', originalCode: '04258', name: '科学家', location: 'laboratory', aloof: true, printedAloof: true, hunter: false }
  state.enemies.push(keeper, scientist)
  behavior.enemySpawned(state, keeper, api)
  assert.equal(keeper.hunter, false, '记录未达成时仍是冷漠') 
  state.scenarioFlags.remembered = { foundTheProcess: true, dissectedAnOrgan: true }
  behavior.checkObjectives(state, api)
  assert.equal(keeper.aloof, false)
  assert.equal(keeper.hunter, true)
  assert.equal(scientist.aloof, false)
  assert.equal(scientist.hunter, true)
  // 引擎在敌人移动后会按 printedAloof 重算 aloof；剧本永久取消冷漠时必须一起改掉基值，
  // 否则猎手移动后冷漠会复位，敌人不会自动交战。
  assert.equal(keeper.printedAloof, false, '监守人的印刷冷漠基值被取消')
  assert.equal(scientist.printedAloof, false, '科学家的印刷冷漠基值被取消')
})

test('04244 图标翻倍只作用于持有者自己执行的检定', () => {
  const state = stateFor(2)
  const inv = state.investigators[0]
  // 夹具里的调查员卡号本来就是 04244（换身后）；共享钩子按 inv.form 判断换身状态。
  inv.form = 'yithian'
  state.skillTest = { seat: 0 }
  assert.equal(behavior.commitIconMultiplier(state, inv).multiplier, 2)
  state.skillTest.tfaYithianIconDoubled = true
  assert.equal(behavior.commitIconMultiplier(state, inv), 1, '每次检定一次')
  state.skillTest = { seat: 1 }
  assert.equal(behavior.commitIconMultiplier(state, inv), 1, '别人执行、别人投入的牌不翻倍')
})

test('04245 会谈间：回合开始有伊斯敌人时询问是否抽卡', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  state.locations.push({ id: 'interviewRoom', originalCode: '04245', code: '04245', name: '会谈间', revealed: true, clues: 0, connections: [] })
  inv.location = 'interviewRoom'
  state.enemies.push({ id: 'y', code: '04259', originalCode: '04259', name: '伊斯学者', traits: ['Yithian'], location: 'interviewRoom' })
  const draws = []
  behavior.turnBegins(state, inv, { choose: () => 'draw', drawCards: (seat, n) => draws.push([seat, n]) })
  assert.deepEqual(draws, [[0, 1]])
  behavior.turnBegins(state, inv, { choose: () => 'skip', drawCards: () => { throw new Error('should not draw') } })
})

test('04256 看管人：调查阶段开始抽 1 张（每轮一次，不再借回合开始）', () => {
  const state = stateFor(2)
  const inv = state.investigators[0]
  inv.assets.push({ id: 'custodian', code: '04256', originalCode: '04256', exhausted: false })
  state.round = 3
  const draws = []
  const api = { drawCards: (seat, n) => draws.push([seat, n]) }
  behavior.phaseBegan(state, 'investigation', api)
  assert.ok(draws.length >= 1, '调查阶段开始抽牌')
  const firstRound = draws.length
  behavior.phaseBegan(state, 'investigation', api)
  assert.equal(draws.length, firstRound, '同一轮只抽一次')
  state.round = 4
  behavior.phaseBegan(state, 'investigation', api)
  assert.ok(draws.length > firstRound, '下一轮重新生效')
  behavior.phaseBegan(state, 'mythos', api)
})

// ---- 真实引擎：04244「伊斯人身体」的换身与还原 ----
// 印刷设置（04237）：「将每位玩家的调查员卡牌替换为伊斯人身体调查员卡牌」。
// 玩家报告：天机之城开局时头像/名字/生命值还是原调查员。这里走真实建局，确认
// 卡面身份（卡号/名字/职业/生命理智/技能）被替换、原调查员卡文本不可用，并在下一关还原。
const TFA_SCENARIO_IDS = contentRegistry.getCampaign('theForgottenAge').scenarioIds
const BODY_CODE = CARD_CODES.bodyOfAYithian

function settleEngine(state, limit = 500) {
  for (let guard = 0; state.pendingChoice && guard < limit; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self', 'cooperate'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

// 大厅的真实开局路径在规则事务里执行（设置阶段的 choose 才合法）。直接调 startScenario 的
// 用例都预置了合作记录；需要走「合作/反抗」选择的用例用这个外壳，按事务模型重放到完成。
function startCityOfArchivesInTransaction(state) {
  const index = TFA_SCENARIO_IDS.indexOf('theCityOfArchives')
  const execute = current => startScenario(current, index, [])
  resolveTransaction(state, 0, { action: 'tfaCityStart' }, execute)
  for (let guard = 0; state.pendingChoice && guard < 100; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self', 'cooperate', '0']
      .find(id => pending.options.some(option => option.id === id)) ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
  settleEngine(state)
  return state
}

// 从大厅流程直接落到「天机之城」：真实建局（第一关自动开局）→ 补上剧情记录 → 起本章。
function engineAtCityOfArchives(seed = 'tcoa-form', investigator = '06004') {
  const state = createGameState({
    campaignId: 'theForgottenAge', playerInvestigator: investigator, seed, campaignHub: false,
    seatInvestigators: [investigator, '04002'],
  }, [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }])
  settleEngine(state)
  state.campaign.records.theInvestigatorsCooperatedWithTheYithians = true
  startScenario(state, TFA_SCENARIO_IDS.indexOf('theCityOfArchives'), [])
  settleEngine(state)
  return state
}

test('真实引擎：天机之城开局把调查员卡替换成伊斯人身体（卡号/名字/职业/生命理智/技能）', () => {
  const state = engineAtCityOfArchives()
  const inv = state.investigators[0]
  assert.equal(inv.code, BODY_CODE, '调查员卡号换成 04244')
  assert.equal(inv.name, '伊斯人身体', '卡名换成身体卡')
  assert.equal(inv.nameEn, 'Body of a Yithian')
  assert.equal(inv.klass, 'neutral', '职业换成中立')
  assert.deepEqual([inv.willpower, inv.intellect, inv.combat, inv.agility], [2, 2, 2, 2])
  assert.equal(inv.maxHealth, 7)
  assert.equal(inv.maxSanity, 7)
  assert.equal(inv.health, 7)
  assert.equal(inv.sanity, 7)
  assert.equal(hasInvestigatorForm(inv), true)
  // 原身份留了快照，供关末/下一关还原。
  assert.equal(inv.formOriginal.code, '06004')
  assert.equal(inv.formOriginal.name, '卢克·罗宾逊')
  assert.equal(inv.formOriginal.klass, 'mystic')
  // 设置阶段「检查牌库和游戏区域」：独特[[道具]]支援（卢克的门之匣 06013）放到一边，
  // 位于场外——不是移出游戏，也不动战役牌组记录（下一关按记录重建牌组时回收）。
  assert.equal((inv.assets || []).some(asset => asset.code === '06013'), false, '场上的独特道具支援不再留在场上')
  assert.equal([...(inv.deck || []), ...(inv.hand || [])].includes('06013'), false, '牌库/手牌里的门之匣也放到一边')
  assert.ok(state.setAside.some(card => card.code === '06013'), '门之匣进入「放到一边」区')
  assert.ok(state.campaign.investigators[0].deck.includes('06013'), '战役牌组记录保留门之匣（旧实现会永久删除）')
  assert.ok(state.campaign.investigators[0].deck.includes('06014'), '弱点不设置阶段被拿走')
  assert.ok(state.log.some(entry => {
    const text = typeof entry === 'string' ? entry : JSON.stringify(entry)
    return text.includes('门之匣') && text.includes('放在一边')
  }), '设置阶段要有「放到一边」的日志')
  // 观察投影：牌桌读到的就是身体卡身份（头像/名字/生命值都来自这里）。
  const view = viewState(state, 0)
  const viewInv = view.investigators[0]
  assert.equal(viewInv.code, BODY_CODE)
  assert.equal(viewInv.name, '伊斯人身体')
  assert.equal(viewInv.klass, 'neutral')
  assert.equal(viewInv.maxHealth, 7)
  assert.equal(viewInv.maxSanity, 7)
  // 「放到一边」面板要能看到这些玩家卡（否则玩家会以为卡被吞了）。
  assert.ok((view.setAsideCards || []).some(card => card.code === '06013'), '放到一边面板显示门之匣')
  // 原调查员卡文本不可用：04244 没有调查员条目，原调查员的旧印/能力读点全部落空。
  assert.equal(state.investigators[0].yithianBody, true)
})

test('真实引擎：「合作/反抗」在布置之前决定，1 号会谈间与观测者按选择入场', () => {
  // 回归（2026-11-11）：换身/放到一边改成「起始手牌前」之后，preScenarioSetup 曾被推迟到
  // setupLocations 之后，导致会谈间卡面与观测者按「没有记录」的反抗分支布置。
  const state = createGameState({
    campaignId: 'theForgottenAge', playerInvestigator: '06004', seed: 'tcoa-fresh-choice',
    campaignHub: false, seatInvestigators: ['06004', '04002'],
  }, [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }])
  settleEngine(state)
  assert.ok(!state.campaign.records.theInvestigatorsCooperatedWithTheYithians)
  startCityOfArchivesInTransaction(state)
  assert.equal(state.campaign.records.theInvestigatorsCooperatedWithTheYithians, true, '选择被记录')
  const room1 = state.locations.find(location => location.id === 'interviewRoom1')
  assert.equal(room1.originalCode, ROOM_CODES.arrival, '合作的 1 号会谈间是抵达室')
  assert.ok(state.enemies.some(enemy => enemy.code === '01177'), '合作的观测者已生成在会谈间')
  assert.equal(state.investigators[0].code, BODY_CODE, '换身仍按起始手牌之后的顺序完成')
})

test('真实引擎：换身发生在起始手牌之后（塞菲娜的 13 张起始手牌照常抽满）', () => {
  // 04237 的换身对应规则书 Setup 的第 10 步（起始手牌之后）。若先换身再抽手牌，
  // 04244 没有调查员条目，塞菲娜的 openingHandSize=13 会退回默认 5 张。
  const state = engineAtCityOfArchives('tcoa-selina-timing', '03003')
  const inv = state.investigators[0]
  assert.equal(inv.code, BODY_CODE, '仍然换成伊斯人身体')
  assert.equal(inv.hand.length, 13, '13 张起始手牌在换身之前抽完')
})

test('真实引擎：下一关把调查员卡还原成原调查员；战役记录的持续换身会重新套用', () => {
  const state = engineAtCityOfArchives('tcoa-form-restore')
  const nextIndex = TFA_SCENARIO_IDS.indexOf('theCityOfArchives') + 1
  // 没有战役换身记录：进入下一关时还原成卢克本人。
  startScenario(state, nextIndex, [])
  settleEngine(state)
  const human = state.investigators[0]
  assert.equal(human.code, '06004', '下一关卡号还原')
  assert.equal(human.name, '卢克·罗宾逊')
  assert.equal(human.klass, 'mystic')
  assert.deepEqual([human.willpower, human.intellect, human.combat, human.agility], [4, 3, 2, 3])
  assert.equal(human.maxHealth, 5)
  assert.equal(human.maxSanity, 9)
  assert.equal(hasInvestigatorForm(human), false)
  assert.equal(human.formOriginal, undefined)
  // 「放在一边，位于场外」只在本关生效：下一关按战役牌组记录重建牌组，门之匣回到场上
  // （06004「你以门之匣在场上开始游戏」）。旧实现把 06013 从记录里删掉，这里会永久缺卡。
  assert.ok(human.assets.some(asset => asset.code === '06013'), '下一关门之匣重新入场')
  assert.ok(state.campaign.investigators[0].deck.includes('06013'), '战役牌组记录始终保留门之匣')

  // 幕间四：困在伊斯人身体里的调查员在余下战役继续使用 04244。
  state.campaign.ruleFlags ||= {}
  state.campaign.ruleFlags.investigatorForms = { 0: { code: BODY_CODE, form: 'yithian' } }
  startScenario(state, nextIndex, [])
  settleEngine(state)
  const again = state.investigators[0]
  assert.equal(again.code, BODY_CODE)
  assert.equal(again.name, '伊斯人身体')
  assert.equal(again.maxHealth, 7)
  assert.equal(hasInvestigatorForm(again), true)
  assert.equal(again.formOriginal.code, '06004')
})

test('旧存档修复：只改了数值没换卡面的天机之城存档，读档时补上换身并移出场上的独特道具', () => {
  const state = engineAtCityOfArchives('tcoa-form-repair')
  const inv = state.investigators[0]
  // 模拟更新前的存档：卡号/名字/职业还是原调查员，只有属性被覆盖成身体卡数值，且没有换身快照。
  restoreInvestigatorForm(inv)
  Object.assign(inv, {
    willpower: 2, intellect: 2, combat: 2, agility: 2,
    maxHealth: 7, baseHealth: 7, maxSanity: 7, baseSanity: 7,
    yithianBody: true,
  })
  inv.assets.push({ id: 'legacy-gate-box', code: '06013', exhausted: false })
  state.scenarioFlags.yithianBody = true
  assert.equal(behavior.needsSaveRepair(state), true, '旧存档需要修复')
  behavior.repairSavedState(state, {})
  assert.equal(inv.code, BODY_CODE)
  assert.equal(inv.name, '伊斯人身体')
  assert.equal(inv.klass, 'neutral')
  assert.equal(inv.formOriginal.code, '06004')
  assert.equal(inv.assets.some(asset => asset.code === '06013'), false, '补做设置阶段的移出游戏')
  assert.equal(behavior.needsSaveRepair(state), false, '修复后不再重复修复')
})

test('旧存档读档迁移：migrateState 触发剧本书写修复，把换身装回去且重复迁移无变更', () => {
  const state = engineAtCityOfArchives('tcoa-form-migrate')
  const inv = state.investigators[0]
  // 构造更新前版本的存档状态：调查员卡没换，只有身体卡数值与场景标记。
  restoreInvestigatorForm(inv)
  Object.assign(inv, {
    willpower: 2, intellect: 2, combat: 2, agility: 2,
    maxHealth: 7, baseHealth: 7, maxSanity: 7, baseSanity: 7,
    yithianBody: true,
  })
  state.scenarioFlags.yithianBody = true
  const saved = JSON.parse(JSON.stringify(state))
  const { state: repaired, changes } = migrateState(saved)
  assert.equal(repaired.investigators[0].code, BODY_CODE, '迁移后调查员卡换成 04244')
  assert.equal(repaired.investigators[0].name, '伊斯人身体')
  assert.equal(hasInvestigatorForm(repaired.investigators[0]), true)
  assert.ok(changes.some(line => line.includes('伊斯人身体')), `迁移变更说明应指出换身修复：${changes.join(' / ')}`)
  // 已经修复的存档再迁移一次不应再产生变更（幂等，不会重复套用）。
  const again = migrateState(JSON.parse(JSON.stringify(repaired)))
  assert.deepEqual(again.changes, [])
})

test('旧存档修复：旧实现从战役牌组误删的独特道具/亚历山卓补回牌组，并投影到「放到一边」', () => {
  // 实战复现（2026-11-11）：卢克在天机之城开局后再也拿不到门之匣——旧实现把
  // 「独特的道具支援」从当前牌库/场上拿走后，连 campaign.investigators[].deck 也一起过滤了。
  // 修复后的存档不能再被改记录；已经被改坏的旧存档按场景标记 + 牌组快照找回持有者补回。
  const state = engineAtCityOfArchives('tcoa-aside-repair')
  const flags = state.scenarioFlags
  const codes = [...new Set([...(flags.removedCards || []), ...(flags.setAsideCards || [])])]
  assert.ok(codes.length > 0, '设置阶段应记录了放到一边的卡')
  // 模拟旧存档：上一关的牌组快照 + 记录里被永久删掉这些卡 + 本关放到一边区为空。
  state.campaign.scenarioResults = [{
    scenarioId: 'heartOfTheEldersPart2',
    investigators: Object.values(state.campaign.investigators)
      .map(record => ({ seat: record.seat, deck: [...record.deck] })),
  }]
  for (const record of Object.values(state.campaign.investigators)) {
    record.deck = record.deck.filter(code => !codes.includes(code))
  }
  state.setAside = []
  assert.equal(behavior.needsSaveRepair(state), true, '旧存档需要修复')
  const { state: repaired, changes } = migrateState(JSON.parse(JSON.stringify(state)))
  assert.ok(changes.some(line => line.includes('放到一边') || line.includes('战役牌组')), changes.join(' / '))
  const lukeRecord = repaired.campaign.investigators[0]
  assert.ok(lukeRecord.deck.includes('06013'), '门之匣回到卢克的战役牌组')
  assert.ok(lukeRecord.deck.length > state.campaign.investigators[0].deck.length, '补回的卡确实变多了')
  assert.ok((repaired.setAside || []).some(card => card.code === '06013'), '门之匣投影到放到一边')
  assert.ok((viewState(repaired, 0).setAsideCards || []).some(card => card.code === '06013'),
    '放到一边面板显示补回的门之匣')
  // 幂等：再次迁移不应再产生修复。
  const again = migrateState(JSON.parse(JSON.stringify(repaired)))
  assert.deepEqual(again.changes, [])
})

test('梦境之门：换身后按座位认主，其他伊斯人不能进入（行动与效果移动同一读点）', () => {
  // 06015a/b：「敌人和除卢克·罗宾逊以外的调查员不能进入梦境之门」。
  // 天机之城换身后全队卡号都是 04244：只比卡号会让其他伊斯人也能进门，因此门记所有者座位。
  // 行动移动走 moves.js 的 dreamGateEntryError；脚本/卡牌效果的移动走 movement.js →
  // investigatorEntryError，两处都要拦住（后者此前没有读点）。
  const state = engineAtCityOfArchives('tcoa-gate-entry')
  const luke = state.investigators[0]
  const other = state.investigators[1]
  assert.equal(luke.code, other.code, '前提：换身后两张调查员卡同号')
  placeDreamGate(state, '06015a', { connectToRevealed: true, ownerCode: luke.code, ownerSeat: luke.seat })
  const gate = state.locations.find(location => location.dreamGate)
  assert.ok(gate)
  assert.equal(investigatorEntryError(state, gate.id, luke.seat), null, '卢克可以进入自己的梦境之门')
  assert.match(investigatorEntryError(state, gate.id, other.seat), /梦境之门/, '同号的其他伊斯人不能进入')
  const before = other.location
  relocateInvestigator(state, other.seat, gate.id, [])
  assert.equal(other.location, before, '脚本/卡牌效果的移动同样被拦住')
})

test('真实引擎：换身状态下门之匣放置的梦境之门按座位认主', () => {
  // 06013 在条目里把 ownerSeat 传给引擎；否则换身后门只记卡号 04244，全队都能进。
  const state = engineAtCityOfArchives('tcoa-gate-owner')
  state.investigators[0].assets.push({ id: 'gate-box', code: '06013', uses: 3, usesType: 'charges', exhausted: false })
  state.pendingChoice = null
  state.investigators[0].location = 'interviewRoom1'
  const lukeSeat = state.investigators[0].seat
  const otherSeat = state.investigators[1].seat
  const ability = legalMoves(state, lukeSeat)
    .find(move => move.action === 'ability' && move.assetId === 'gate-box')
  assert.ok(ability, '门之匣的快速能力可用')
  applyMove(state, lukeSeat, { action: 'ability', assetId: 'gate-box', abilityIndex: ability.abilityIndex })
  settleEngine(state)
  // applyMove 走规则事务，状态对象被整体替换：断言要重新取当前实例。
  const luke = state.investigators[lukeSeat]
  const gate = state.locations.find(location => location.dreamGate)
  assert.ok(gate, '梦境之门入场')
  assert.equal(gate.dreamGateOwnerSeat, lukeSeat, '门的所有者按座位记录')
  assert.equal(luke.location, gate.id, '卢克移动到门上')
  assert.match(investigatorEntryError(state, gate.id, otherSeat), /梦境之门/, '同号的其他伊斯人仍不能进入')
})

test('真实引擎：04258 失去冷漠后，猎手移动进调查员所在地点会自动交战', () => {
  const state = engineAtCityOfArchives('tcoa-scientist-aloof')
  if (!state.locations.some(location => location.id === 'laboratory')) placeLocation(state, 'laboratory', [])
  settleEngine(state)
  const scientist = spawnEnemy(state, '04258', 'laboratory')
  settleEngine(state)
  assert.ok(scientist, '科学家应能生成')
  assert.equal(scientist.aloof, true, '任务未完成时按印刷冷漠入场')
  assert.equal(scientist.printedAloof, true)
  // 另一位调查员离开起点：猎手移动后自动交战会遇到「猎物并列选择」，本测试只验证
  // 「失去冷漠后会不会交战」，因此让目标唯一（并列选择由别的用例覆盖）。
  state.investigators[1].location = 'hallsWestern'
  state.scenarioFlags = state.scenarioFlags || {}
  state.scenarioFlags.remembered = { activatedTheDevice: true }
  behavior.checkObjectives(state, { info() {} })
  assert.equal(scientist.aloof, false, '达成「启动了设备」后失去冷漠')
  assert.equal(scientist.hunter, true, '并获得猎手')

  // 引擎在敌人每次移动后都会重算 aloof（turn-flow#processPlayerEnemyEntry）。
  // 修复前这一步会把 aloof 复位成 true，敌人移动进调查员所在地点也不会交战。
  const inv = state.investigators[0]
  for (const step of ['hallsNorthern', 'hallsEastern', inv.location]) {
    relocateEnemy(state, scientist, step, [], { cause: 'hunter', routeSelected: true })
  }
  assert.equal(scientist.location, inv.location)
  assert.equal(scientist.aloof, false, '移动后不会重新获得冷漠')
  assert.equal(scientist.engagedSeat, inv.seat, '移动进调查员所在地点后自动交战')
  assert.ok(inv.engaged.includes(scientist.id), '调查员的交战列表里有科学家')
})

// 模拟 finishScenario 写下的本关结算记录（visitId 口径与引擎一致）。
function markScenarioSettled(state) {
  const flow = state.campaign.flow
  const flowNodeId = flow?.nodeId || state.scenario.id
  const visit = flow?.visits?.[flowNodeId] || 1
  state.campaign.scenarioResults ||= []
  state.campaign.scenarioResults.push({
    scenarioId: state.scenario.id, visitId: `${flowNodeId}:${visit}`, resolution: 'r1', investigators: [],
  })
}

test('旧存档修复：天机之城已结算的幕间/出发准备存档不会被重新换身', () => {
  // 2026-11-11 实战复现：幽嘶深渊的出发准备页显示两名调查员都变成了「伊斯人身体」。
  // finishScenario 已经先还原身体、再写本关结算记录，但关末/幕间窗口里 state.scenario 仍是
  // 天机之城、scenarioFlags.yithianBody 也还没被下一关开局清空。旧修复只看这个标记，读档时
  // 把「已经回到自己身体」的调查员重新换成 04244。
  const state = engineAtCityOfArchives('tcoa-settled-repair')
  for (const inv of state.investigators) restoreInvestigatorForm(inv)
  markScenarioSettled(state)
  assert.equal(state.scenarioFlags.yithianBody, true, '前提：关末仍残留换身标记')
  assert.equal(behavior.needsSaveRepair(state), true, '残留标记需要清理')
  const { state: repaired, changes } = migrateState(JSON.parse(JSON.stringify(state)))
  assert.equal(repaired.investigators[0].code, '06004', '不能重新换成身体卡')
  assert.equal(repaired.investigators[1].code, '04002')
  assert.equal(hasInvestigatorForm(repaired.investigators[0]), false)
  assert.equal(repaired.investigators[0].name, '卢克·罗宾逊')
  assert.equal(repaired.scenarioFlags.yithianBody, undefined, '关末残留标记被清掉')
  assert.ok(changes.some(line => line.includes('已结算')), `迁移说明应指出已结算：${changes.join(' / ')}`)
  // 幂等：清理后再迁移无变更。
  const again = migrateState(JSON.parse(JSON.stringify(repaired)))
  assert.deepEqual(again.changes, [])
})

test('旧存档修复：被误换成伊斯人身体的关末存档，读档时还原成原调查员', () => {
  // 已被旧修复写坏的关末存档：本关已结算，但调查员还带着 form/04244（出发准备页显示身体卡）。
  const state = engineAtCityOfArchives('tcoa-settled-corrupt')
  assert.equal(hasInvestigatorForm(state.investigators[0]), true, '前提：进行中的身体形态')
  // 实测存档里旧实现先把 inv.yithianBody 置真再拍快照，还原时这个旧标记会被快照带回身上。
  state.investigators[0].formOriginal.yithianBody = true
  // 更关键：v0.4.0 的实现先把四属性覆盖成身体卡数值（全 2）才拍快照，
  // 快照里的「原身份」四属性因此也是 2，只按快照还原会留下 2/2/2/2。
  for (const inv of state.investigators) {
    Object.assign(inv.formOriginal, { willpower: 2, intellect: 2, combat: 2, agility: 2 })
  }
  markScenarioSettled(state)
  const { state: repaired, changes } = migrateState(JSON.parse(JSON.stringify(state)))
  assert.equal(repaired.investigators[0].code, '06004', '还原成卢克本人')
  assert.equal(repaired.investigators[0].name, '卢克·罗宾逊')
  assert.equal(repaired.investigators[1].code, '04002')
  assert.equal(hasInvestigatorForm(repaired.investigators[0]), false)
  assert.equal(repaired.investigators[0].formOriginal, undefined, '原身份快照被消费掉')
  assert.equal(repaired.investigators[0].yithianBody, undefined, '旧换身标记也一并清掉')
  assert.equal(repaired.scenarioFlags.yithianBody, undefined)
  // 四属性必须按战役记录里的原调查员卡重建，而不是被污染的快照。
  assert.deepEqual([repaired.investigators[0].willpower, repaired.investigators[0].intellect,
    repaired.investigators[0].combat, repaired.investigators[0].agility], [4, 3, 2, 3], '卢克 4/3/2/3')
  assert.deepEqual([repaired.investigators[1].willpower, repaired.investigators[1].intellect,
    repaired.investigators[1].combat, repaired.investigators[1].agility], [3, 4, 1, 4], '厄休拉 3/4/1/4')
  assert.ok(changes.some(line => line.includes('已结算')), changes.join(' / '))
  const again = migrateState(JSON.parse(JSON.stringify(repaired)))
  assert.deepEqual(again.changes, [])
})

test('关卡进行中（未结算）的坏存档仍按原逻辑补装换身', () => {
  // 回归保护：上面的「已结算还原」不能拦住在关卡中途读档的旧存档补装换身。
  const state = engineAtCityOfArchives('tcoa-mid-repair')
  const inv = state.investigators[0]
  restoreInvestigatorForm(inv)
  inv.yithianBody = true
  state.scenarioFlags.yithianBody = true
  assert.equal(behavior.needsSaveRepair(state), true, '未结算：仍要补装换身')
  const { state: repaired } = migrateState(JSON.parse(JSON.stringify(state)))
  assert.equal(repaired.investigators[0].code, BODY_CODE, '关卡中读档仍补成身体卡')
  assert.equal(hasInvestigatorForm(repaired.investigators[0]), true)
})

test('真实引擎：天机之城结局结算还原身体并清掉换身场景标记', () => {
  const state = engineAtCityOfArchives('tcoa-finish-clear')
  assert.equal(hasInvestigatorForm(state.investigators[0]), true)
  assert.equal(state.scenarioFlags.yithianBody, true)
  let ended = null
  try { finishScenario(state, 'r1', []) } catch (error) { ended = error }
  assert.equal(ended?.constructor?.name, 'ScenarioEnded', `结算应正常结束本关：${ended?.message}`)
  assert.equal(state.investigators[0].code, '06004', '结算时身体被还原')
  assert.equal(hasInvestigatorForm(state.investigators[0]), false)
  assert.equal(state.scenarioFlags.yithianBody, undefined, '关末清掉换身标记')
  assert.equal(behavior.needsSaveRepair(state), false, '正常的关末状态不需要修复')
})

