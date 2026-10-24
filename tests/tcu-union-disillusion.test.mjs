// 05238《聚合幻灭》章节测试（钩子级，不依赖引擎注册表）。
//
// 覆盖：manifest/身份、阵营记录→幕版本、随机未访之岛与火盆初始化、鬼灵迷雾入口、
// 阵法多技能检定（P2.5）+ 火盆 locationFlag（P2.11）、幕/议程背面、命运剧情卡、
// 幽灵看守人、混乱标记、诡计、结局记录、存档往返（JSON.stringify + deepEqual）。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as uad from '../content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/index.js'
import {
  scenario as definition, FATE_LIST, ISLE_CODES, UNVISITED_ISLES,
  ACT_DECKS, FORBIDDING_SHORE, GEIST_TRAP, MISKATONIC_RIVER, TREACHERY_CODES,
} from '../content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/definition.js'

const clone = value => JSON.parse(JSON.stringify(value))

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

function stateFor(count = 2, records = {}) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    currentSeat: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: MISKATONIC_RIVER,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    locationVariants: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    chaosBag: [],
    skillTest: null,
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Object.fromEntries(Array.from({ length: count }, (_, seat) => [seat, {
        id: `inv${seat}`, name: `调查员${seat + 1}`, deck: [], purchases: [], status: 'active',
        removedCards: [], trauma: { physical: 0, mental: 0 },
      }])),
      chaosBag: [],
    },
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function placeAll(state, ids) {
  for (const id of ids) {
    if (state.locations.some(location => location.id === id)) continue
    const base = state.scenario.locations[id]
    const variant = clone(state.locationVariants?.[id] || {})
    const merged = { ...clone(base), ...variant, id }
    state.locations.push({
      ...merged, revealed: false, doom: 0,
      clues: 0, maxClues: (merged.cluesPerInvestigator || 0) * state.numInvestigators,
    })
  }
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

function placedState(count = 2, records = {}, extraIds = []) {
  const state = stateFor(count, records)
  const placed = uad.behavior.setupLocations(state, [], setupApi())
  placeAll(state, [...placed, ...extraIds])
  return state
}

function apiFor(state, overrides = {}) {
  const calls = []
  let counter = 0
  const api = {
    calls,
    info: text => calls.push(['info', text]),
    random: overrides.random || (() => 0.25),
    shuffle: overrides.shuffle || (list => [...list]),
    choose: request => {
      calls.push(['choose', request])
      if (overrides.choose) return overrides.choose(request)
      return request.options?.[0]?.id
    },
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null, options = {}) => {
      calls.push(['test', { seat, skill, difficulty, source, options }])
      const result = overrides.testResult || {
        success: true, value: difficulty, difficulty, drawn: [], cancelledTokens: [],
      }
      resolve(result)
      return result
    },
    spawn: (code, locationId) => {
      const enemy = {
        id: `enemy${++counter}`, code, originalCode: code, name: code,
        location: locationId, doom: 0, damageTaken: 0, exhausted: false,
        engagedSeat: null, resources: 0, traits: [], health: 5, fight: 3, evade: 3,
      }
      state.enemies.push(enemy)
      uad.behavior.enemySpawned?.(state, enemy, api)
      return enemy
    },
    spawnStoryEnemy: (code, locationId, stats = {}, extra = {}) => {
      const enemy = {
        id: `storyEnemy${++counter}`, code, originalCode: code, name: stats.name || code,
        location: locationId, doom: 0, damageTaken: 0, exhausted: !!extra.exhausted,
        engagedSeat: null, resources: 0, traits: stats.traits || [], ...stats, ...extra,
      }
      state.enemies.push(enemy)
      uad.behavior.enemySpawned?.(state, enemy, api)
      return enemy
    },
    place: id => {
      placeAll(state, [id])
      return loc(state, id)
    },
    reveal: id => {
      const location = loc(state, id)
      if (location && !location.revealed) {
        location.revealed = true
        location.clues = location.maxClues || 0
        uad.behavior.locationRevealed?.(state, location, api)
      }
      return location
    },
    moveInvestigator: (seat, destination) => {
      state.investigators[seat].location = destination
      return true
    },
    setLocationFlag: (id, flag, value) => {
      const location = loc(state, id)
      if (!location) return false
      location.flags ||= {}
      location.flags[flag] = value
      calls.push(['setLocationFlag', id, flag, value])
      return true
    },
    hasLocationFlag: (id, flag) => Boolean(loc(state, id)?.flags?.[flag]),
    giveAsset: (seat, code) => {
      state.investigators[seat].assets.push({ id: `asset:${code}:${seat}`, code, originalCode: code })
    },
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    attack: (enemy, inv) => calls.push(['attack', enemy.code, inv.seat]),
    trauma: (seat, kind, n) => { state.investigators[seat].trauma = { kind, n } },
    defeat: (seat, cause) => { state.investigators[seat].defeated = true; calls.push(['defeat', seat, cause]) },
    haunted: (seat, options) => calls.push(['haunted', seat, options]),
    discardChosen: (seat, n, source) => calls.push(['discardChosen', seat, n, source]),
    addDoom: n => { state.doom = (state.doom || 0) + n },
    advanceAct: () => { calls.push(['advanceAct']); return true },
    finish: key => { calls.push(['finish', key]); return true },
    spawnEngaged: (code, locationId, seat) => {
      const enemy = api.spawn(code, locationId)
      if (enemy) enemy.engagedSeat = seat
      return enemy
    },
    ...overrides,
  }
  if (overrides.choose) {
    api.choose = request => {
      calls.push(['choose', request])
      return overrides.choose(request)
    }
  }
  return api
}

const enemy = (state, code, location = MISKATONIC_RIVER, extra = {}) => {
  const entry = {
    id: `manual${state.enemies.length + 1}`, code, originalCode: code, name: code, location,
    doom: 0, damageTaken: 0, exhausted: false, engagedSeat: null, resources: 0, traits: [],
    health: 5, fight: 3, evade: 3, ...extra,
  }
  state.enemies.push(entry)
  return entry
}

const RECORD_COVEN = { theInvestigatorsSidedWithTheCoven: true }
const RECORD_LODGE = { theInvestigatorsSidedWithTheLodge: true }

test('聚合幻灭：章节已是 playable，地点/幕/议程/结局/身份齐全', () => {
  assert.equal(uad.manifest.status, 'playable')
  assert.equal(uad.manifest.campaignId, 'theCircleUndone')
  assert.equal(uad.scenario.originalCode, '05238')
  assert.equal(uad.behavior.id, 'unionAndDisillusion')
  assert.equal(uad.manifest.locations.length, 9)
  assert.equal(uad.manifest.acts.length, 4)
  assert.equal(uad.manifest.agendas.length, 2)
  assert.deepEqual(uad.manifest.resolutions, undefined)
  assert.equal(uad.manifest.resolutionIds.length, 11)
  assert.deepEqual(uad.manifest.requiredEncounterGroupIds, [
    'unionAndDisillusion', 'anettesCoven', 'inexorableFate', 'realmOfDeath',
    'silverTwilightLodge', 'spectralPredators', 'theWatcher',
  ])
  assert.equal(uad.manifest.zones.encounterDeck.length > 0, true)
  for (const identity of Object.values(uad.identities.locations)) {
    assert.equal(identity.identityStatus, 'mapped')
  }
})

test('诚实登记：gaps 与 approximations 都存在且覆盖命运卡/火盆/看守人', () => {
  assert.deepEqual(uad.behavior.scenarioGaps, [], 'playable 要求卡面子句无未实现 gap')
  assert.ok(uad.behavior.scenarioApproximations.length >= 5)
  const text = uad.behavior.scenarioApproximations.join(' ')
  for (const keyword of ['fateCards', '火盆', '看守人']) assert.ok(text.includes(keyword), keyword)
})

test('幕 3/4 版本按战役记录选择：v1 秘社、v2/v3/v4 女巫集会', () => {
  assert.equal(uad.behavior.actVersionFor(RECORD_LODGE), 'v1')
  assert.equal(uad.behavior.actVersionFor({
    ...RECORD_COVEN, theInvestigatorsAreDeceivingTheLodge: true,
    theInvestigatorsWereInductedIntoTheInnerCircle: true,
  }), 'v2')
  assert.equal(uad.behavior.actVersionFor({
    ...RECORD_COVEN, theInvestigatorsAreDeceivingTheLodge: true,
    theInvestigatorsHidTheirKnowledgeOfTheCoven: true,
  }), 'v3')
  assert.equal(uad.behavior.actVersionFor(RECORD_COVEN), 'v4')
  const state = stateFor(2, RECORD_LODGE)
  uad.behavior.preScenarioSetup(state, [], apiFor(state))
  assert.equal(state.acts[2].originalCode, '05243')
  assert.equal(state.acts[3].originalCode, '05247')
  const v2 = stateFor(2, {
    ...RECORD_COVEN, theInvestigatorsAreDeceivingTheLodge: true,
    theInvestigatorsWereInductedIntoTheInnerCircle: true,
  })
  uad.behavior.preScenarioSetup(v2, [], apiFor(v2))
  assert.equal(v2.acts[2].originalCode, '05244')
  assert.equal(v2.acts[3].originalCode, '05248')
  assert.deepEqual(ACT_DECKS.v1.map(act => act.originalCode), ['05241', '05242', '05243', '05247'])
})

test('序章未记录阵营时询问并写记录（默认女巫集会）', () => {
  const state = stateFor(2)
  const api = apiFor(state, { choose: () => 'lodge' })
  uad.behavior.preScenarioSetup(state, [], api)
  assert.equal(state.campaign.records.theInvestigatorsSidedWithTheLodge, true)
  assert.ok(api.calls.some(call => call[0] === 'choose' && call[1].kind === 'story'))
})

test('布置：危险河岸 + 随机 2 张未访之岛，其余 4 张放在一边', () => {
  const state = stateFor(2, RECORD_COVEN)
  const placed = uad.behavior.setupLocations(state, [], setupApi())
  assert.equal(placed[0], 'miskatonicRiver')
  assert.equal(placed[1], 'forbiddingShore')
  assert.equal(placed.length, 4)
  const isles = placed.slice(2)
  assert.equal(isles.length, 2)
  assert.ok(isles.every(id => ISLE_CODES.includes(state.scenario.locations[id].originalCode)))
  assert.equal(state.scenarioFlags.asideIsles.length, 4)
  assert.equal(state.scenarioZones.setAside.filter(code => ISLE_CODES.includes(code)).length, 4)
  assert.equal(uad.behavior.factionOf(state), 'coven')
})

test('布置：女巫集会阵营点燃危险河岸与 2 张未访之岛的火盆，秘社阵营不点', () => {
  const coven = stateFor(2, RECORD_COVEN)
  const placed = uad.behavior.setupLocations(coven, [], setupApi())
  placeAll(coven, placed)
  assert.equal(uad.behavior.brazierLit(coven, 'forbiddingShore'), true)
  assert.equal(uad.behavior.brazierLit(coven, placed[2]), true)
  assert.equal(uad.behavior.litIsles(coven).length, 2)
  assert.equal(uad.behavior.brazierLit(coven, MISKATONIC_RIVER), false)

  const lodge = stateFor(2, RECORD_LODGE)
  const lodgePlaced = uad.behavior.setupLocations(lodge, [], setupApi())
  placeAll(lodge, lodgePlaced)
  assert.equal(uad.behavior.brazierLit(lodge, 'forbiddingShore'), false)
  assert.equal(uad.behavior.litIsles(lodge).length, 0)
})

test('命运剧情卡按「失踪人口」记录加入放在一边的列表', () => {
  const record = { missingPersons: [FATE_LIST[0].person, FATE_LIST[1].person] }
  const state = stateFor(2, { ...RECORD_COVEN, ...record })
  uad.behavior.setupLocations(state, [], setupApi())
  const cards = state.scenarioFlags.fateCards
  assert.equal(cards.length, 2)
  assert.deepEqual(cards.map(card => card.code).sort(), [FATE_LIST[0].story, FATE_LIST[1].story].sort())
  assert.ok(state.scenarioZones.setAside.includes(FATE_LIST[0].ally))
  assert.equal(state.scenarioZones.setAside.includes(FATE_LIST[2].ally), false)
})

test('鬼灵迷雾：未揭示的未访之岛按阵营火盆状态挡路，灵怪陷阱永远先挡路', () => {
  const state = placedState(2, RECORD_COVEN)
  const isle = uad.behavior.litIsles(state)[0] || loc(state, 'standingStones')
  assert.equal(uad.behavior.brazierLit(state, 'forbiddingShore'), true)
  const blockedByLit = uad.behavior.investigatorEntryError(state, isle)
  assert.ok(blockedByLit && blockedByLit.includes('鬼灵迷雾'), '女巫集会 + 危险河岸火盆点燃 → 不能进入')
  loc(state, 'forbiddingShore').flags = { brazier: false }
  assert.equal(uad.behavior.investigatorEntryError(state, isle), null, '熄灭危险河岸后才能进入')
  isle.revealed = true
  assert.equal(uad.behavior.investigatorEntryError(state, isle), null, '已揭示的岛可以进入')
  const trap = placeAll(stateFor(2, RECORD_COVEN), ['geistTrap'])
  assert.match(uad.behavior.investigatorEntryError(trap, loc(trap, 'geistTrap')), /灵怪陷阱|迷雾/)
})

test('阵法行动：未访之岛用 2 个技能求和检定 + actionKind=circle，成功点燃火盆', () => {
  const state = placedState(2, RECORD_COVEN)
  const isle = uad.behavior.litIsles(state)[0]
  isle.revealed = true
  state.investigators[0].location = isle.id
  const api = apiFor(state, { choose: () => 'unlight' })
  const moves = uad.behavior.actions(state, state.investigators[0])
  assert.deepEqual(moves.map(move => move.rule), ['circle'])
  uad.behavior.performAction(state, state.investigators[0], moves[0], api)
  const testCall = api.calls.find(call => call[0] === 'test')
  assert.ok(Array.isArray(testCall[1].skill))
  assert.equal(testCall[1].skill.length, 2, '2–4 个技能求和')
  assert.equal(testCall[1].options.actionKind, 'circle')
  assert.equal(uad.behavior.brazierLit(state, isle.id), false, '成功后可选择熄灭火盆')
  assert.ok(api.calls.some(call => call[0] === 'setLocationFlag' && call[1] === isle.id && call[2] === 'brazier'))
})

test('阵法行动：危险河岸先选择技能，只有 1 个技能；灵怪陷阱四技能难度 20', () => {
  assert.deepEqual(uad.behavior.CIRCLE_ACTIONS[FORBIDDING_SHORE].skills, ['willpower', 'intellect'])
  assert.equal(uad.behavior.CIRCLE_ACTIONS[FORBIDDING_SHORE].chooseSkill, true)
  assert.equal(uad.behavior.CIRCLE_ACTIONS[GEIST_TRAP].skills.length, 4)
  assert.equal(uad.behavior.CIRCLE_ACTIONS[GEIST_TRAP].difficulty, 20)

  const state = placedState(2, RECORD_COVEN)
  loc(state, 'forbiddingShore').revealed = true
  state.investigators[0].location = 'forbiddingShore'
  const api = apiFor(state, { choose: () => 'intellect' })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  const testCall = api.calls.find(call => call[0] === 'test')
  assert.equal(testCall[1].skill, 'intellect')
  assert.equal(testCall[1].difficulty, 3)
  assert.equal(testCall[1].options.actionKind, 'circle')
})

test('阵法失败：火盆不变；阵法的技能检定受立石闹鬼 +2 难度', () => {
  const state = placedState(2, RECORD_COVEN)
  const isle = uad.behavior.litIsles(state)[0]
  state.investigators[0].location = isle.id
  const api = apiFor(state, {
    testResult: { success: false, value: 1, difficulty: 10, drawn: [], cancelledTokens: [] },
  })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.equal(uad.behavior.brazierLit(state, isle.id), true, '失败时保持原样')
  uad.behavior.hauntedScript(state, { scriptId: 'standingStones', locationId: isle.id, seat: 0 }, api)
  assert.equal(uad.behavior.testDifficultyModifier(state, state.investigators[0], 'willpower', 10,
    { label: '阵法' }), 2)
  state.round = 2
  assert.equal(uad.behavior.testDifficultyModifier(state, state.investigators[0], 'willpower', 10,
    { label: '阵法' }), 0, '只持续到本轮结束')
})

test('苔藓阶梯闹鬼：下一次移动额外消耗 1 行动', () => {
  const state = placedState(2, RECORD_COVEN)
  state.investigators[0].actionsLeft = 3
  uad.behavior.hauntedScript(state, { scriptId: 'mossSteps', locationId: 'mossCoveredSteps', seat: 0 }, apiFor(state))
  uad.behavior.beforeMove(state, state.investigators[0], 'forbiddingShore', apiFor(state))
  assert.equal(state.investigators[0].actionsLeft, 2)
  uad.behavior.beforeMove(state, state.investigators[0], 'forbiddingShore', apiFor(state))
  assert.equal(state.investigators[0].actionsLeft, 2, '同一轮只额外扣一次')
})

test('幕 1 背面：每位调查员随机获得一张放在一边的未访之岛并移入；命运卡逐张结算', () => {
  const state = placedState(2, { ...RECORD_COVEN, missingPersons: FATE_LIST.map(fate => fate.person) })
  state.scenarioFlags.fateCards = uad.behavior.fateCards(state).map(card => ({
    ...card, trail: 'theInvestigatorsAreOnGavriellasTrail',
  }))
  state.campaign.records.disappearedIntoTheMist = [FATE_LIST[0].person]
  state.campaign.records.wasClaimedBySpecters = [FATE_LIST[1].person]
  state.campaign.records.theInvestigatorsAreOnGavriellasTrail = true
  const api = apiFor(state)
  uad.behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.scenarioFlags.asideIsles.length, 2, '2 张岛入场、2 张留在一边')
  assert.ok(state.locations.filter(entry => ISLE_CODES.includes(entry.originalCode)).length === 4)
  const placedIsleIds = state.scenarioFlags.placedIsles.map(code => Object.keys(UNVISITED_ISLES).find(key => UNVISITED_ISLES[key] === code))
  assert.ok(state.investigators.every(inv => placedIsleIds.includes(inv.location)), '调查员被移动到面前地点')
  const fateGav = state.scenarioFlags.fateCards.find(card => card.code === FATE_LIST[0].story)
  assert.equal(fateGav.resolved, true)
  assert.equal(state.campaign.records[FATE_LIST[0].alive], true, '消失于迷雾 + 追查 → 记录还活着')
  assert.ok(state.investigators.some(inv => inv.assets.some(asset => asset.code === FATE_LIST[0].ally)))
  const fateJerome = state.scenarioFlags.fateCards.find(card => card.code === FATE_LIST[1].story)
  assert.equal(fateJerome.resolved, true)
  assert.ok(state.enemies.some(entry => entry.code === FATE_LIST[1].enemy), '被幽灵夺走 → 翻回敌人面')
})

test('幕 2 背面：幽灵看守人生成在米斯卡塔尼克河、被偷走的灵魂折算生命、灵怪陷阱入场', () => {
  const state = placedState(2, { ...RECORD_COVEN, wasTakenByTheWatcher: ['05046', '05047'] })
  state.scenarioFlags.watcherSouls = 2
  const api = apiFor(state)
  uad.behavior.actReveal(state, state.acts[1], api)
  const watcher = state.enemies.find(entry => entry.code === '05086')
  assert.ok(watcher)
  assert.equal(watcher.location, 'miskatonicRiver')
  assert.equal(watcher.lostSouls, 2)
  assert.equal(watcher.health, 5 + 2 * 2, '灵魂让生命 +1×人数/个')
  assert.ok(loc(state, 'geistTrap'), '灵怪陷阱入场')
  assert.equal(state.scenarioFlags.geistTrapPlaced, true)
  assert.equal(uad.behavior.brazierLit(state, 'geistTrap'), true, '女巫集会：灵怪陷阱火盆点燃')
})

test('幕 2 背面：看守人的注视从放在一边洗入遭遇牌库，弃牌堆洗回', () => {
  const state = placedState(2, RECORD_COVEN)
  state.encounterDeck = ['05266']
  state.encounterDiscard = ['05268']
  uad.behavior.actReveal(state, state.acts[1], apiFor(state))
  assert.equal(state.encounterDiscard.length, 0)
  assert.ok(state.encounterDeck.length >= 2)
  assert.equal(state.scenarioZones.setAside.includes('05272'), false)
})

test('幕 3（版本四）背面：揭示灵怪陷阱、把岛上的调查员拉进去、生成秘社新信徒/约瑟夫并洗牌', () => {
  const state = placedState(2, { ...RECORD_COVEN, josefIsAliveAndWell: true })
  const placedIsleIds = state.scenarioFlags.placedIsles.map(code => Object.keys(UNVISITED_ISLES).find(key => UNVISITED_ISLES[key] === code))
  state.investigators[0].location = placedIsleIds[0]
  const api = apiFor(state)
  const v4 = ACT_DECKS.v4[2]
  assert.equal(v4.originalCode, '05246')
  uad.behavior.actReveal(state, v4, api)
  assert.equal(loc(state, 'geistTrap').revealed, true)
  assert.equal(state.investigators[0].location, 'geistTrap', '岛上的调查员被拉进灵怪陷阱')
  assert.ok(state.enemies.some(entry => entry.code === '05095'))
  assert.ok(state.enemies.some(entry => entry.code === '05085'), '约瑟夫健在 → 生成约瑟夫')
  assert.equal(state.scenarioFlags.noParleyJosef, true)
  assert.ok(state.scenarioZones.setAside.filter(code => code === '05097').length < 2, '银暮秘社卡洗入牌库')
})

function api1(state) {
  const stub = apiFor(state)
  return stub
}

function idOfIsle(state, key) {
  return key
}

test('幕 3（版本一）背面：女巫的法术成功 → 安妮特·梅森，否则生成女巫集会学徒', () => {
  const cast = placedState(2, { ...RECORD_LODGE, theWitchesSpellWasCast: true })
  uad.behavior.actReveal(cast, ACT_DECKS.v1[2], apiFor(cast))
  assert.ok(cast.enemies.some(entry => entry.code === '05057'))
  const broken = placedState(2, RECORD_LODGE)
  uad.behavior.actReveal(broken, ACT_DECKS.v1[2], apiFor(broken))
  assert.ok(broken.enemies.some(entry => entry.code === '05090'))
  assert.equal(broken.enemies.some(entry => entry.code === '05057'), false)
})

test('幕 3 目标：场上每个未访之岛都已翻开且火盆状态一致才推进', () => {
  const state = placedState(2, RECORD_COVEN)
  state.actIndex = 2
  const api = apiFor(state)
  for (const location of state.locations.filter(entry => ISLE_CODES.includes(entry.originalCode))) {
    location.revealed = true
    location.flags = { brazier: false }
  }
  uad.behavior.checkObjectives(state, api)
  assert.ok(api.calls.some(call => call[0] === 'advanceAct'), '版本四要求火盆全灭')
  // 版本一要求全亮
  const v1 = placedState(2, RECORD_LODGE)
  v1.acts = ACT_DECKS.v1
  v1.actIndex = 2
  const v1api = apiFor(v1)
  for (const location of v1.locations.filter(entry => ISLE_CODES.includes(entry.originalCode))) {
    location.revealed = false
    location.flags = { brazier: true }
  }
  uad.behavior.checkObjectives(v1, v1api)
  assert.equal(v1api.calls.some(call => call[0] === 'advanceAct'), false, '未全部翻开不推进')
  for (const location of v1.locations.filter(entry => ISLE_CODES.includes(entry.originalCode))) location.revealed = true
  uad.behavior.checkObjectives(v1, v1api)
  assert.ok(v1api.calls.some(call => call[0] === 'advanceAct'))
})

test('幽灵看守人被击败：不弃掉、治愈伤害并横置，在灵怪陷阱且火盆匹配时推进幕 4', () => {
  const state = placedState(2, RECORD_LODGE)
  state.acts = ACT_DECKS.v1
  state.actIndex = 3
  placeAll(state, ['geistTrap'])
  loc(state, 'geistTrap').revealed = true
  loc(state, 'geistTrap').flags = { brazier: true }
  const watcher = enemy(state, '05086', 'geistTrap', { damageTaken: 3, fight: 3 })
  const api = apiFor(state)
  const replaced = uad.behavior.enemyDefeated(state, watcher, api)
  assert.equal(replaced, true, '返回 true 阻止进胜利区')
  assert.ok(state.enemies.includes(watcher), '不弃掉')
  assert.equal(watcher.damageTaken, 0, '治愈所有伤害')
  assert.equal(watcher.exhausted, true, '横置')
  assert.equal(state.scenarioFlags.watcherDefeatedAt, 'geistTrap')
  assert.ok(api.calls.some(call => call[0] === 'advanceAct'))
})

test('结局 8 判定：看守人不在灵怪陷阱或火盆不匹配时幕 4 不推进', () => {
  const state = placedState(2, RECORD_LODGE)
  state.acts = ACT_DECKS.v1
  state.actIndex = 3
  placeAll(state, ['geistTrap'])
  loc(state, 'geistTrap').revealed = true
  loc(state, 'geistTrap').flags = { brazier: false }
  const watcher = enemy(state, '05086', 'geistTrap')
  const api = apiFor(state)
  uad.behavior.enemyDefeated(state, watcher, api)
  assert.equal(api.calls.some(call => call[0] === 'advanceAct'), false)
  assert.equal(state.scenarioFlags.watcherDefeatedAt, 'geistTrap')
  assert.equal(state.scenarioFlags.watcherDefeatedAt != null, true)
})

test('命运敌人：杰罗姆交战弃 2 张手牌、瓦伦蒂诺失去 2 资源、佩妮被躲避受 1 伤害', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  const api = apiFor(state)
  uad.behavior.enemyEngaged(state, enemy(state, '05263b'), inv, api)
  assert.ok(api.calls.some(call => call[0] === 'discardChosen' && call[1] === inv.seat && call[2] === 2))
  inv.resources = 5
  uad.behavior.enemyEngaged(state, enemy(state, '05265b'), inv, api)
  assert.equal(inv.resources, 3)
  uad.behavior.afterEvade(state, inv, enemy(state, '05264b'), { success: true }, api)
  assert.equal(inv.damage, 1)
})

test('加弗瑞拉：成功攻击时若她仍重整则受到 1 点恐惧', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  const gavriella = enemy(state, '05262b')
  const api = apiFor(state)
  uad.behavior.enemyAttackedSuccessfully(state, inv, gavriella, api)
  assert.equal(inv.horror, 1)
  gavriella.exhausted = true
  uad.behavior.enemyAttackedSuccessfully(state, inv, gavriella, api)
  assert.equal(inv.horror, 1, '她已横置时不触发')
})

test('夜鹰：所在地点调查员全部技能 -1；幽灵乌鸦交战二选一', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  enemy(state, '05266', inv.location)
  assert.equal(uad.behavior.statModifier(state, inv, 'willpower'), -1)
  assert.equal(uad.behavior.statModifier(state, inv, 'intellect'), -1)
  const raven = enemy(state, '05267', inv.location)
  const api = apiFor(state, { choose: () => 'modify' })
  uad.behavior.enemyEngaged(state, raven, inv, api)
  assert.equal(raven.ravenBoostRound, state.round)
  assert.equal(uad.behavior.enemyStatModifier(state, raven, 'fight'), 2)
  const hauntApi = apiFor(state, { choose: () => 'haunted' })
  uad.behavior.enemyEngaged(state, enemy(state, '05267', inv.location), inv, hauntApi)
  assert.ok(hauntApi.calls.some(call => call[0] === 'haunted'))
})

test('混乱标记：skull -2、阵法时再抽一个；困难 -3；cultist 揭示缺伤害/恐惧各受 1；tablet 失败时幽灵敌人攻击', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  state.difficulty = 'standard'
  assert.deepEqual(uad.behavior.resolveChaosToken(state, inv, 'skull', {}), { delta: -2 })
  state.skillTest = { actionKind: 'circle' }
  assert.deepEqual(uad.behavior.resolveChaosToken(state, inv, 'skull', {}), { delta: -2, drawAnother: true })
  state.difficulty = 'hard'
  assert.equal(uad.behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -3)
  state.difficulty = 'standard'
  const cultist = uad.behavior.resolveChaosToken(state, inv, 'cultist', apiFor(state))
  assert.equal(cultist.delta, -3)
  assert.equal(inv.damage, 1, '无伤害标记 → 受 1 伤害')
  assert.equal(inv.horror, 1, '无恐惧标记 → 受 1 恐惧')
  enemy(state, '05267', inv.location, { traits: ['Creature', 'Spectral'] })
  const api = apiFor(state)
  state.skillTest = { actionKind: 'circle' }
  uad.behavior.afterTest(state, inv, { success: false, value: 1, difficulty: 3, drawn: ['tablet'], cancelledTokens: [] }, api)
  assert.ok(api.calls.some(call => call[0] === 'attack'))
  const hauntApi = apiFor(state)
  uad.behavior.afterTest(state, inv, { success: false, value: 1, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [] }, hauntApi)
  assert.ok(hauntApi.calls.some(call => call[0] === 'haunted'))
})

test('诡计：渴望死亡难度随伤害提高、死亡记号随恐惧提高、灵魂之歌/死期临近进入威胁区并追加伤害', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  inv.damage = 2
  const api = apiFor(state)
  uad.behavior.resolveEncounter(state, inv, { code: '05268', originalCode: '05268' }, api)
  const eager = api.calls.find(call => call[0] === 'test')
  assert.equal(eager[1].difficulty, 4)
  inv.horror = 1
  const api2 = apiFor(state)
  uad.behavior.resolveEncounter(state, inv, { code: '05271', originalCode: '05271' }, api2)
  assert.equal(api2.calls.find(call => call[0] === 'test')[1].difficulty, 3)

  const api3 = apiFor(state)
  uad.behavior.resolveEncounter(state, inv, { code: '05269', originalCode: '05269' }, api3)
  uad.behavior.resolveEncounter(state, inv, { code: '05270', originalCode: '05270' }, api3)
  assert.equal(inv.threat.length, 2)
  const adjusted = uad.behavior.beforeHarm(state, inv, { damage: 1, horror: 1 }, apiFor(state))
  assert.equal(adjusted.damage, 3, '灵魂之歌 +2 伤害')
  assert.equal(adjusted.horror, 3, '死期临近 +2 恐惧')
  assert.equal(inv.threat.length, 0, '两张威胁卡都已弃掉')
})

test('结局：noResolution 按结局 5 分流；桑福德/安妮特记录链最终走结局 8', () => {
  const build = records => placedState(2, { ...RECORD_COVEN, ...records })
  const first = build({ theWitchesSpellWasCast: true, josefDisappearedIntoTheMist: true, hereticsWereUnleashedUntoArkham: true })
  const result = uad.behavior.resolution(first, 'noResolution', [], apiFor(first))
  assert.equal(first.campaign.records.anetteMasonIsPossessedByEvil, true, '三项皆差 → 第二组更多 → 结局 7')
  assert.equal(result.award, true)

  const better = build({})
  uad.behavior.resolution(better, 'noResolution', [], apiFor(better))
  assert.equal(better.campaign.records.carlSanfordPossessesTheSecretsOfTheUniverse, true, '结局 6')

  const direct = build({})
  uad.behavior.resolution(direct, 'r3', [], apiFor(direct))
  assert.equal(direct.campaign.records.carlSanfordPossessesTheSecretsOfTheUniverse, true)
  assert.throws(() => uad.behavior.resolution(direct, 'r99', [], {}), /未知聚合幻灭结局/)
})

test('结局 1：满足条件且选择忠于秘社 → 结局 2；否则结局 3', () => {
  const state = placedState(2, {
    ...RECORD_COVEN, theInvestigatorsWereInductedIntoTheInnerCircle: true,
  })
  uad.behavior.resolution(state, 'r1', [], apiFor(state, { choose: () => 'yes' }))
  assert.equal(state.campaign.records.theTrueWorkOfTheSilverTwilightLodgeHasBegun, true)

  const refuse = placedState(2, { ...RECORD_COVEN, theInvestigatorsWereInductedIntoTheInnerCircle: true })
  uad.behavior.resolution(refuse, 'r1', [], apiFor(refuse, { choose: () => 'no' }))
  assert.equal(refuse.campaign.records.carlSanfordPossessesTheSecretsOfTheUniverse, true)

  const deceiving = placedState(2, {
    ...RECORD_COVEN, theInvestigatorsWereInductedIntoTheInnerCircle: true,
    theInvestigatorsAreDeceivingTheLodge: true,
  })
  const api = apiFor(deceiving, { choose: () => 'yes' })
  uad.behavior.resolution(deceiving, 'r1', [], api)
  assert.equal(api.calls.some(call => call[0] === 'choose'), false, '欺骗秘社时不能选择“是”')
  assert.equal(deceiving.campaign.records.carlSanfordPossessesTheSecretsOfTheUniverse, true)
})

test('结局 8：移除机关盒、按「还活着」记录把剧情支援加入牌库并记录死亡', () => {
  const state = placedState(2, RECORD_COVEN)
  state.campaign.investigators[0].deck.push('05228')
  state.campaign.records[FATE_LIST[0].alive] = true
  const api = apiFor(state, { choose: () => '0' })
  uad.behavior.resolution(state, 'r8', [], api)
  assert.equal(state.campaign.investigators[0].deck.includes('05228'), false, '移除机关盒')
  assert.ok(state.campaign.investigators[0].deck.includes(FATE_LIST[0].ally), '剧情支援加入牌库')
  assert.equal(state.campaign.records[FATE_LIST[1].dead], true, '没有 alive 记录 → 记录死亡')
  assert.deepEqual(uad.behavior.scenarioGaps, [])
})

test('同一路线在 JSON 往返后完全一致（存档/读档）', () => {
  const build = () => {
    const state = placedState(2, { ...RECORD_COVEN, missingPersons: [FATE_LIST[0].person] })
    const api = apiFor(state)
    uad.behavior.actReveal(state, state.acts[1], api)
    const isle = state.locations.find(entry => ISLE_CODES.includes(entry.originalCode))
    if (isle) isle.revealed = true
    state.skillTest = { actionKind: 'circle' }
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同路线确定性')
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.scenarioFlags.fateCards, first.scenarioFlags.fateCards)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.locationVariants, first.locationVariants)
  assert.deepEqual(restored.locations.map(entry => entry.flags || null), first.locations.map(entry => entry.flags || null))
  assert.deepEqual(restored.enemies, first.enemies)
})
