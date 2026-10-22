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

test('剧情前：写入合作记录，并清掉独特道具与亚历山卓·维拉', () => {
  const state = stateFor(2)
  state.investigators[0].deck = ['01041', '01020', '04051', '01001']
  state.investigators[0].hand = ['01041']
  state.campaign.investigators[0].deck = ['01041', '04051', '01020']
  const api = makeApi(state, { choose: () => 'cooperate' })
  behavior.preScenarioSetup(state, [], api)
  assert.equal(state.campaign.records.theInvestigatorsCooperatedWithTheYithians, true)
  assert.deepEqual(state.investigators[0].deck, ['01020', '01001'])
  assert.deepEqual(state.investigators[0].hand, [])
  assert.deepEqual(state.campaign.investigators[0].deck, ['01020'])
  assert.ok(state.scenarioFlags.removedCards.includes('01041'))
  assert.ok(state.scenarioFlags.setAsideCards.includes('04051'))
  assert.equal(state.investigators[1].yithianBody, true)

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
  state.enemies.push({ id: 'e1', code: '01177', originalCode: '01177', location: 'hallsEastern', aloof: true })
  const api = makeApi(state, { seed: 21 })
  behavior.actReveal(state, state.acts[0], api)
  for (const id of SET_ASIDE_LOCATIONS) assert.ok(state.locations.some(location => location.id === id), id)
  assert.deepEqual(state.storyAssets.map(asset => asset.code), [CARD_CODES.custodian])
  assert.ok(SET_ASIDE_LOCATIONS.includes(state.storyAssets[0].location))
  assert.equal(state.enemies[0].aloof, false)
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
  human.investigators[0].yithianBody = false
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
  const keeper = { id: 'k', code: '04257', originalCode: '04257', name: '监守人', location: 'greatLibrary', aloof: true, hunter: false }
  const scientist = { id: 's', code: '04258', originalCode: '04258', name: '科学家', location: 'laboratory', aloof: true, hunter: false }
  state.enemies.push(keeper, scientist)
  behavior.enemySpawned(state, keeper, api)
  assert.equal(keeper.hunter, false, '记录未达成时仍是冷漠') 
  state.scenarioFlags.remembered = { foundTheProcess: true, dissectedAnOrgan: true }
  behavior.checkObjectives(state, api)
  assert.equal(keeper.aloof, false)
  assert.equal(keeper.hunter, true)
  assert.equal(scientist.aloof, false)
  assert.equal(scientist.hunter, true)
})

test('04244 图标翻倍只作用于持有者自己执行的检定', () => {
  const state = stateFor(2)
  const inv = state.investigators[0]
  inv.yithianBody = true
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
