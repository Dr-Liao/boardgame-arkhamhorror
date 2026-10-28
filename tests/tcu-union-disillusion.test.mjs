// 05238《聚合幻灭》章节测试（钩子级，不依赖引擎注册表）。
//
// 覆盖：manifest/身份、阵营记录→幕版本、随机未访之岛与火盆初始化、鬼灵迷雾入口、
// 阵法多技能检定（P2.5）+ 火盆 locationFlag（P2.11）、幕/议程背面、命运剧情卡、
// 幽灵看守人、混乱标记、诡计、结局记录、存档往返（JSON.stringify + deepEqual）。
import test from 'node:test'
import assert from 'node:assert/strict'
// 引擎装配点注册全部单卡条目（本章诡计 05268–05272 的规则已回条目）。
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
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
    // 05239/05241/05242：引擎通用资源标记 API（写到 target.markers，与 scenario-runtime.js 同形状）。
    addMarker: (target, label = 'resource') => {
      if (!target) return null
      target.markers ||= []
      target.markers.push(label)
      calls.push(['addMarker', target, label])
      return target.markers.length
    },
    removeMarker: (target, label = 'resource') => {
      if (!target?.markers) return 0
      const index = target.markers.indexOf(label)
      if (index >= 0) target.markers.splice(index, 1)
      calls.push(['removeMarker', target, label])
      return target.markers.length
    },
    markers: target => (target?.markers ? [...target.markers] : []),
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
    // 05267 幽灵乌鸦：+2 攻/躲持续到某轮。
    boostEnemyUntil: (enemy, key, round) => {
      if (!enemy || !key) return false
      enemy[key] = round
      calls.push(['boostEnemyUntil', enemy.code, key, round])
      return true
    },
    // 05272 看守人的注视：判断两个地点是否有闹鬼能力。
    hauntedAt: locationId => {
      const location = state.locations.find(item => item.id === locationId)
      const data = state.scenario?.locations?.[locationId]?.haunted || location?.haunted
      return Array.isArray(data) ? data : []
    },
    // 05269/05270：放入任意调查员的威胁区。
    threat: (seat, code) => {
      const owner = state.investigators[seat]
      owner.threat ||= []
      owner.threat.push({ id: `threat:${code}:${seat}`, code, originalCode: code, name: code })
      calls.push(['threat', seat, code])
      return owner.threat.at(-1)
    },
    // 05268/05271 的声明式检定失败分支。
    applyPenalty: (seat, fail) => {
      if (fail.kind === 'takeHorror') state.investigators[seat].horror += fail.amount
      if (fail.kind === 'takeDamage') state.investigators[seat].damage += fail.amount
      calls.push(['applyPenalty', seat, fail])
    },
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

test('诚实登记：gaps 与 approximations 都存在且覆盖命运卡/共享规则', () => {
  assert.deepEqual(uad.behavior.scenarioGaps, [], 'playable 要求卡面子句无未实现 gap')
  assert.ok(uad.behavior.scenarioApproximations.length >= 5)
  const text = uad.behavior.scenarioApproximations.join(' ')
  for (const keyword of ['fateCards', 'spawnStoryEnemy', '失踪人口']) assert.ok(text.includes(keyword), keyword)
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
  assert.deepEqual(loc(coven, 'forbiddingShore').markers, ['brazier'], '火盆用真实资源标记承载')
  assert.ok(loc(coven, placed[2]).markers.includes('brazier'), '点亮的未访之岛带火盆资源标记')
  assert.equal(uad.behavior.litIsles(coven).length, 2)
  assert.equal(uad.behavior.brazierLit(coven, MISKATONIC_RIVER), false)

  const lodge = stateFor(2, RECORD_LODGE)
  const lodgePlaced = uad.behavior.setupLocations(lodge, [], setupApi())
  placeAll(lodge, lodgePlaced)
  assert.equal(uad.behavior.brazierLit(lodge, 'forbiddingShore'), false)
  assert.deepEqual(loc(lodge, 'forbiddingShore').markers || [], [], '秘社阵营没有火盆标记')
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
  uad.behavior.setBrazier(state, apiFor(state), 'forbiddingShore', false)
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
  assert.equal(loc(state, isle.id).markers.includes('brazier'), false, '熄灭 = 移除火盆资源标记')
  assert.ok(api.calls.some(call => call[0] === 'removeMarker' && call[1] === isle && call[2] === 'brazier'),
    '通过引擎资源标记 API 移除火盆标记')
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
  assert.equal(watcher.markers.filter(label => label === 'stolenSoul').length, 2,
    '05239：被偷走的灵魂 = 看守人身上的 2 个资源标记')
  assert.equal(watcher.health, 5 + 2 * 2, '灵魂让生命 +1×人数/个')
  assert.ok(loc(state, 'geistTrap'), '灵怪陷阱入场')
  assert.equal(state.scenarioFlags.geistTrapPlaced, true)
  assert.equal(uad.behavior.brazierLit(state, 'geistTrap'), true, '女巫集会：灵怪陷阱火盆点燃')
  assert.deepEqual(loc(state, 'geistTrap').markers, ['brazier'], '05242：点燃的火盆 = 地点上的资源标记')
})

test('幕 2 背面：看守人的攫噬×2 与注视从放在一边洗入遭遇牌库，弃牌堆洗回', () => {
  const state = placedState(2, RECORD_COVEN)
  state.encounterDeck = ['05266']
  state.encounterDiscard = ['05268']
  uad.behavior.actReveal(state, state.acts[1], apiFor(state))
  assert.equal(state.encounterDiscard.length, 0)
  assert.ok(state.encounterDeck.length >= 2)
  assert.equal(state.scenarioZones.setAside.includes('05272'), false)
  // 卡面原文：放在一边的每张看守人的攫噬（05087×2）也要一起洗入（旧实现只搬了注视）。
  assert.equal(state.scenarioZones.setAside.includes('05087'), false)
  assert.equal(state.encounterDeck.filter(code => code === '05087').length, 2)
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
  // 卡面：把放在一边的银暮秘社组「剩余」卡牌全部洗入——生成过的新信徒不能再留在 setAside。
  const lodgeLeft = state.scenarioZones.setAside.filter(code =>
    ['05095', '05096', '05097'].includes(code))
  assert.deepEqual(lodgeLeft, [], '银暮秘社组剩余卡牌全部洗入，无残留')
})

function api1(state) {
  const stub = apiFor(state)
  return stub
}

function idOfIsle(state, key) {
  return key
}

test('幕 3（版本一）背面：法术成功 → 安妮特，否则生成学徒；每张剩余的女巫敌人与弃牌堆洗入', () => {
  const cast = placedState(2, { ...RECORD_LODGE, theWitchesSpellWasCast: true })
  uad.behavior.actReveal(cast, ACT_DECKS.v1[2], apiFor(cast))
  assert.ok(cast.enemies.some(entry => entry.code === '05057'), '法术成功 → 生成安妮特')
  // 参考 setup：3×05090 学徒 + 1×05091 女祭司 + 安妮特都在 setAside；成功分支生成安妮特后，
  // 剩下的每张女巫敌人（3 学徒 + 女祭司）都要与遭遇弃牌堆一起洗入遭遇牌库。
  assert.deepEqual(cast.scenarioZones.setAside.filter(code => ['05057', '05090', '05091'].includes(code)), [],
    '法术成功分支：剩余女巫敌人全部洗入')
  assert.equal(cast.encounterDeck.filter(code => code === '05090').length >= 3, true, '3 张学徒洗入牌库')
  assert.equal(cast.encounterDeck.includes('05091'), true, '女祭司洗入牌库')

  const broken = placedState(2, RECORD_LODGE)
  uad.behavior.actReveal(broken, ACT_DECKS.v1[2], apiFor(broken))
  assert.ok(broken.enemies.some(entry => entry.code === '05090'), '法术被破坏 → 生成女巫集会学徒')
  assert.equal(broken.enemies.some(entry => entry.code === '05057'), false)
  // 2 人局生成 1 张学徒：剩余 2 学徒 + 女祭司 + 安妮特（未被生成，仍是「剩余放在一边的女巫敌人」）全部洗入。
  assert.deepEqual(broken.scenarioZones.setAside.filter(code => ['05057', '05090', '05091'].includes(code)), [],
    '破坏分支：剩余女巫敌人（含安妮特）全部洗入')
  assert.equal(broken.encounterDeck.filter(code => code === '05090').length, 2, '剩余 2 张学徒洗入')
  assert.equal(broken.encounterDeck.includes('05057'), true, '安妮特作为剩余女巫敌人被洗入')
})

test('幕 3（版本二）背面：cultist 标记从混乱袋、封印区与战役袋中移除（直到剧本结束）', () => {
  const state = placedState(2, RECORD_LODGE)
  state.chaosBag = ['cultist', 'cultist', 'skull', 'tablet']
  state.chaos = { revealed: [], sealed: [{ token: 'cultist', source: '05125' }, { token: 'tablet', source: 'x' }], removed: [], frames: [] }
  state.sealedTokens = ['cultist', 'tablet']
  state.campaign.chaosBag = ['cultist', 'cultist', 'skull']
  uad.behavior.actReveal(state, ACT_DECKS.v2[2], apiFor(state))
  assert.deepEqual(state.chaosBag, ['skull', 'tablet'], '混乱袋里的 cultist 全部移除')
  assert.deepEqual(state.chaos.sealed.map(item => item.token), ['tablet'], '封印的 cultist 也被移除')
  assert.deepEqual(state.sealedTokens, ['tablet'], '封印读数同步')
  assert.deepEqual(state.campaign.chaosBag, ['skull'], '战役袋持久移除（下一关不会回来）')
})

test('幕 3 目标：场上每个未访之岛都已翻开且火盆状态一致才推进', () => {
  const state = placedState(2, RECORD_COVEN)
  state.actIndex = 2
  const api = apiFor(state)
  for (const location of state.locations.filter(entry => ISLE_CODES.includes(entry.originalCode))) {
    location.revealed = true
    uad.behavior.setBrazier(state, api, location.id, false)
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
    uad.behavior.setBrazier(v1, v1api, location.id, true)
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
  uad.behavior.setBrazier(state, apiFor(state), 'geistTrap', true)
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
  uad.behavior.setBrazier(state, apiFor(state), 'geistTrap', false)
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

test('夜鹰：所在地点调查员全部技能 -1、多张叠加；幽灵乌鸦交战二选一', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  enemy(state, '05266', inv.location)
  assert.equal(uad.behavior.statModifier(state, inv, 'willpower'), -1)
  assert.equal(uad.behavior.statModifier(state, inv, 'intellect'), -1)
  // 卡面：每张夜鹰各自 -1，多张叠加（旧实现用 some 只算 -1）。
  enemy(state, '05266', inv.location)
  assert.equal(uad.behavior.statModifier(state, inv, 'willpower'), -2, '两张夜鹰叠加 -2')
  const raven = enemy(state, '05267', inv.location)
  const api = apiFor(state, { choose: () => 'modify' })
  uad.behavior.enemyEngaged(state, raven, inv, api)
  assert.equal(raven.ravenBoostUntilRound, state.round)
  assert.equal(uad.behavior.enemyStatModifier(state, raven, 'fight'), 2)
  // 敌人阶段交战 → 加成延续到下一轮调查阶段结束。
  state.phase = 'enemy'
  const ravenNight = enemy(state, '05267', inv.location)
  uad.behavior.enemyEngaged(state, ravenNight, inv, apiFor(state, { choose: () => 'modify' }))
  assert.equal(ravenNight.ravenBoostUntilRound, state.round + 1)
  state.phase = 'investigation'
  state.round += 1
  assert.equal(uad.behavior.enemyStatModifier(state, ravenNight, 'fight'), 2, '下一轮调查阶段仍生效')
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
  // 引擎 applyHarm 的威胁区拦截读点（02221 同款）：条目只声明数据。
  assert.deepEqual(registeredEntry('05269').harmInterceptor, { trigger: 'damage', extra: 2, discard: true })
  assert.deepEqual(registeredEntry('05270').harmInterceptor, { trigger: 'horror', extra: 2, discard: true })
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

// ---------------------------------------------------------------------------
// task-42 回归：05086 幽灵看守人被击败（preventReady + 解除交战清理）
// ---------------------------------------------------------------------------
test('幽灵看守人被击败：本轮补给阶段不重整（preventReady）并清理交战数组', () => {
  const state = stateFor(2)
  const holder = state.investigators[0]
  const watcher = {
    id: 'watcher-regression', code: '05086', originalCode: '05086', name: '幽灵看守人',
    location: holder.location, damageTaken: 3, horror: 2, exhausted: false, engagedSeat: 0,
  }
  state.enemies.push(watcher)
  holder.engaged = [watcher.id]
  assert.equal(uad.behavior.enemyDefeated(state, watcher, { info: () => {} }), true)
  assert.deepEqual(watcher.preventReady, { from: state.round, rounds: 1 }, '本轮补给阶段不重整')
  assert.equal(watcher.engagedSeat, null, '与所有调查员解除交战')
  assert.deepEqual(holder.engaged, [], '交战调查员的 engaged 数组已清理')
  assert.equal(watcher.damageTaken, 0, '治愈所有伤害')
  assert.equal(watcher.horror, 2, '恐惧不在卡面治愈范围内')
})

// ---------------------------------------------------------------------------
// Wave 1 修复回归：05238 / 05241 / 05246 / 05248 / 05253
// ---------------------------------------------------------------------------
test('05238 [elder_thing]：真实流程里 state.skillTest 已关闭，从 result.source 识别阵法行动', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  assert.equal(state.skillTest, null)
  const circleApi = apiFor(state)
  uad.behavior.afterTest(state, inv, {
    success: false, value: 1, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [],
    source: { label: '阵法', code: 'miskatonicRiver', actionKind: 'circle' },
  }, circleApi)
  assert.ok(circleApi.calls.some(call => call[0] === 'haunted'), '阵法失败 + 古神标记 → 结算闹鬼')
  const plainApi = apiFor(state)
  uad.behavior.afterTest(state, inv, {
    success: false, value: 1, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [],
    source: { label: '调查', code: 'miskatonicRiver' },
  }, plainApi)
  assert.equal(plainApi.calls.some(call => call[0] === 'haunted'), false, '非阵法检定不结算')
  // 成功时也不结算（卡面条件含「失败」）。
  const successApi = apiFor(state)
  uad.behavior.afterTest(state, inv, {
    success: true, value: 5, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [],
    source: { label: '阵法', code: 'miskatonicRiver', actionKind: 'circle' },
  }, successApi)
  assert.equal(successApi.calls.some(call => call[0] === 'haunted'), false)
})

test('05241 命运卡：按玩家顺序分组结算（不是按发牌顺序）', () => {
  const state = placedState(2, RECORD_COVEN)
  // 4 张命运卡：按 0,1,2,3 顺序发放 → 座位 0 拿 [A,C]、座位 1 拿 [B,D]；
  // 结算顺序必须是 座位 0 的 A、C 再座位 1 的 B、D（旧实现按 A,B,C,D 洗牌顺序结算）。
  state.scenarioFlags.fateCards = ['A', 'B', 'C', 'D'].map(name => ({
    code: `fate${name}`, ally: `ally${name}`, enemy: `enemy${name}`, person: name,
    trail: `trail${name}`, alive: `${name}Alive`, dead: `${name}Dead`, name, resolved: false, seat: null,
  }))
  const api = apiFor(state, { shuffle: list => [...list] })
  uad.behavior.actReveal(state, state.acts[0], api)
  const resolvedNames = api.calls
    .filter(call => call[0] === 'info' && /“([A-D])”的命运/.test(call[1]))
    .map(call => call[1].match(/“([A-D])”/)[1])
  assert.deepEqual(resolvedNames, ['A', 'C', 'B', 'D'], '座位 0 的两张先结算，再座位 1')
})

test('05246 谈判：只有未被封锁且与约瑟夫同地点时才列出，performAction 再校验一次', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  const josef = enemy(state, '05085', inv.location)
  const api = apiFor(state)
  assert.ok(uad.behavior.actions(state, inv).some(move => move.rule === 'parleyJosef'),
    '未封锁时列出谈判行动')
  state.scenarioFlags.noParleyJosef = true
  assert.equal(uad.behavior.actions(state, inv).some(move => move.rule === 'parleyJosef'), false,
    '封锁后不再列出（本局剩余时间不能谈判）')
  const blockedApi = apiFor(state)
  uad.behavior.performAction(state, inv, { rule: 'parleyJosef' }, blockedApi)
  assert.ok(blockedApi.calls.some(call => call[0] === 'info' && call[1].includes('不能与约瑟夫')))
  // 未封锁时：检定成功 → 翻面结算 05085b 并记录。
  state.scenarioFlags.noParleyJosef = false
  const okApi = apiFor(state)
  uad.behavior.performAction(state, inv, { rule: 'parleyJosef' }, okApi)
  assert.equal(state.scenarioFlags.josefPlanResolved, true)
  assert.equal(josef.doom, 0)
})

test('05253 最近的夜鹰：按地点连接距离取最近，而不是第一个/同地点', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  const origin = state.scenarioFlags.placedIsles.length
    ? Object.keys(UNVISITED_ISLES).find(key => UNVISITED_ISLES[key] === state.scenarioFlags.placedIsles[0])
    : 'miskatonicRiver'
  // origin -- near -- far 三点一线；两只夜鹰分别在 near（1 步）与 far（2 步）。
  placeAll(state, [origin])
  const originLoc = loc(state, origin)
  const nearId = 'forbiddingShore'
  const farId = 'miskatonicRiver'
  originLoc.connections = [nearId]
  loc(state, nearId).connections = [origin, farId]
  loc(state, farId).connections = [nearId]
  const farRaven = enemy(state, '05266', farId, { name: '远夜鹰' })
  const nearRaven = enemy(state, '05266', nearId, { name: '近夜鹰' })
  const attacked = []
  const api = apiFor(state, { attack: target => attacked.push(target.id) })
  uad.behavior.hauntedScript(state, { scriptId: 'forsakenWoods', locationId: origin, seat: inv.seat }, api)
  assert.deepEqual(attacked, [nearRaven.id], '最近的夜鹰（1 步）攻击，而不是更远的或第一个')
  assert.equal(attacked.includes(farRaven.id), false)
})

test('05248 目标：火盆状态以看守人被击败瞬间为准，之后变化不影响判定', () => {
  // 版本四（05248 仪式遭毁）：目标要求「被击败时火盆未点燃」。
  const broken = placedState(2, RECORD_COVEN)
  broken.acts = ACT_DECKS.v4
  broken.actIndex = 3
  placeAll(broken, ['geistTrap'])
  loc(broken, 'geistTrap').revealed = true
  uad.behavior.setBrazier(broken, apiFor(broken), 'geistTrap', false)
  const brokenWatcher = enemy(broken, '05086', 'geistTrap')
  const brokenApi = apiFor(broken)
  uad.behavior.enemyDefeated(broken, brokenWatcher, brokenApi)
  assert.equal(broken.scenarioFlags.watcherDefeatedBrazierLit, false)
  assert.ok(brokenApi.calls.some(call => call[0] === 'advanceAct'), '未点燃时击败 → 推进')
  // 典型旧漏洞：在火盆点燃时击败（条件不满足），之后熄灭也不应该补推进。
  const stale = placedState(2, RECORD_COVEN)
  stale.acts = ACT_DECKS.v4
  stale.actIndex = 3
  placeAll(stale, ['geistTrap'])
  loc(stale, 'geistTrap').revealed = true
  uad.behavior.setBrazier(stale, apiFor(stale), 'geistTrap', true)
  const staleWatcher = enemy(stale, '05086', 'geistTrap')
  const staleApi = apiFor(stale)
  uad.behavior.enemyDefeated(stale, staleWatcher, staleApi)
  assert.equal(staleApi.calls.some(call => call[0] === 'advanceAct'), false, '点燃时击败不满足版本四')
  uad.behavior.setBrazier(stale, apiFor(stale), 'geistTrap', false)
  const laterApi = apiFor(stale)
  uad.behavior.checkObjectives(stale, laterApi)
  assert.equal(laterApi.calls.some(call => call[0] === 'advanceAct'), false, '之后熄灭也不能补推进')
})

test('05254 苔藓阶梯：只有移动行动加价，效果位移不扣行动', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  uad.behavior.hauntedScript(state, { scriptId: 'mossSteps', locationId: 'mossCoveredSteps', seat: 0 }, apiFor(state))
  inv.actionsLeft = 3
  uad.behavior.beforeMove(state, inv, 'forbiddingShore', apiFor(state), { reason: 'effect' })
  assert.equal(inv.actionsLeft, 3, '效果位移不加价')
  assert.equal(state.scenarioFlags.mossStepsPaid?.[0], undefined, '加价仍留给下一次移动行动')
  uad.behavior.beforeMove(state, inv, 'forbiddingShore', apiFor(state), { reason: 'move' })
  assert.equal(inv.actionsLeft, 2, '移动行动扣 1 行动')
  uad.behavior.beforeMove(state, inv, 'forbiddingShore', apiFor(state), { reason: 'move' })
  assert.equal(inv.actionsLeft, 2, '同一轮只额外扣一次')
})

test('05262-05265：翻回敌人面的命运敌人与「结算这张卡的调查员」交战；person 记录键正确', () => {
  // 失踪人口记录键：05048 = 瓦伦蒂诺、05049 = 佩妮（旧实现把两张对调）。
  assert.equal(FATE_LIST.find(fate => fate.name === '佩妮').person, '05049')
  assert.equal(FATE_LIST.find(fate => fate.name === '瓦伦蒂诺').person, '05048')
  const state = placedState(2, { ...RECORD_COVEN, missingPersons: FATE_LIST.map(fate => fate.person) })
  state.campaign.records.wasClaimedBySpecters = FATE_LIST.map(fate => fate.person)
  const engaged = []
  const api = apiFor(state, {
    engage: (target, seat) => { target.engagedSeat = seat; engaged.push(seat) },
  })
  uad.behavior.actReveal(state, state.acts[0], api)
  for (const fate of state.scenarioFlags.fateCards) {
    assert.equal(fate.resolved, true)
    const spawned = state.enemies.find(entry => entry.code === fate.enemy)
    assert.ok(spawned, `${fate.name}的敌人面应生成`)
    assert.equal(spawned.engagedSeat, fate.seat, `${fate.name}应与结算其命运卡的调查员交战`)
  }
  assert.equal(engaged.length, FATE_LIST.length, '每张命运敌人都显式交战一次')
})

test('05246/05248 [fast]：任一调查员可在阵法检定期花自己的线索降难度（逐人询问）', () => {
  const state = placedState(2, RECORD_COVEN)
  state.acts[0].originalCode = '05246' // 本回合的幕是带 [fast] 的版本
  const tester = state.investigators[0]
  const other = state.investigators[1]
  other.clues = 2
  state.skillTest = { actionKind: 'circle', difficulty: 4, difficultyReduction: 0 }
  const spent = []
  const reductions = []
  const api = apiFor(state, {
    choose: request => {
      assert.equal(request.kind, 'effect', '以「效果」面板询问该调查员本人')
      assert.equal(request.seat, other.seat)
      return 'spend'
    },
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount; spent.push(seat) },
    reduceTestDifficulty: amount => { reductions.push(amount) },
  })
  uad.behavior.testOtherInvestigatorTrigger(state, other, tester, {
    actionKind: 'circle', difficulty: 4, source: { label: '阵法' },
  }, api)
  assert.deepEqual(spent, [other.seat], '由非检定者自己付费')
  assert.deepEqual(reductions, [2], '通过引擎 api 降低本次难度 2')
  assert.equal(other.clues, 1)
  assert.equal(state.skillTest.difficultyReduction, 0, '走 api 分支时不再直接改 skillTest')
  // 同一检定同一人只触发一次（circleFastUsed 标记挡掉第二次）。
  uad.behavior.testOtherInvestigatorTrigger(state, other, tester, {
    actionKind: 'circle', difficulty: 4, source: { label: '阵法' },
  }, apiFor(state, { choose: () => 'spend' }))
  assert.equal(other.clues, 1, '同一检定已触发过，不再扣线索')
  // 非阵法检定不询问；不是 [fast] 幕不询问；没有线索不询问。
  const skipApi = apiFor(state, { choose: () => 'spend' })
  uad.behavior.testOtherInvestigatorTrigger(state, other, tester, { actionKind: null, difficulty: 4 }, skipApi)
  assert.equal(other.clues, 1)
  state.acts[0].originalCode = '05239' // 不带 [fast] 的幕
  uad.behavior.testOtherInvestigatorTrigger(state, other, tester, { actionKind: 'circle' }, apiFor(state, { choose: () => 'spend' }))
  assert.equal(other.clues, 1, '非 [fast] 幕不触发')
  other.clues = 0
  uad.behavior.testOtherInvestigatorTrigger(state, other, tester, { actionKind: 'circle' }, apiFor(state, { choose: () => 'spend' }))
  assert.equal(other.clues, 0, '没有线索不触发')
})

test('05262b 加弗瑞拉：成功攻击后只有「未被击败且重整」才受 1 点恐惧', () => {
  const state = placedState(2, RECORD_COVEN)
  const inv = state.investigators[0]
  const gavriella = enemy(state, '05262b', inv.location, { name: '加弗瑞拉' })
  const readyApi = apiFor(state)
  uad.behavior.enemyAttackedSuccessfully(state, inv, gavriella, readyApi, { defeated: false, enemyId: gavriella.id })
  assert.equal(inv.horror, 1, '重整状态 → 受到 1 点恐惧')
  // 本次攻击直接击败她（引擎在判定击败之后、移除之前调用钩子）→ 不再是重整状态，不触发。
  const defeatedApi = apiFor(state)
  uad.behavior.enemyAttackedSuccessfully(state, inv, gavriella, defeatedApi, { defeated: true, enemyId: gavriella.id })
  assert.equal(inv.horror, 1, '被击败时不额外加恐惧')
  // 已横置（如被躲避）→ 不是重整状态，不触发。
  const exhausted = enemy(state, '05262b', inv.location, { name: '加弗瑞拉', exhausted: true })
  uad.behavior.enemyAttackedSuccessfully(state, inv, exhausted, apiFor(state), { defeated: false, enemyId: exhausted.id })
  assert.equal(inv.horror, 1, '横置时不触发')
})

test('05246/05248 [fast]：任意玩家窗口出现（behavior.fastActions），使用后同一检定每人一次', () => {
  const state = placedState(2, RECORD_COVEN)
  state.acts[0].originalCode = '05246' // 本回合的幕是带 [fast] 的版本
  const tester = state.investigators[0]
  const other = state.investigators[1]
  tester.clues = 2
  other.clues = 1
  // 没有进行中的检定 → 任何窗口都不提供。
  assert.deepEqual(uad.behavior.fastActions(state, tester, 'test.beforeCommit'), [])
  state.skillTest = { actionKind: 'circle', difficulty: 5, difficultyReduction: 0, seat: tester.seat }
  const moves = uad.behavior.fastActions(state, tester, 'test.beforeCommit')
  assert.equal(moves.length, 1, '检定者本人在 test 窗口可选')
  assert.equal(moves[0].rule, 'circleFast')
  assert.equal(moves[0].actions, 0)
  assert.equal(moves[0].fast, true)
  assert.equal(uad.behavior.fastActions(state, other, 'test.afterCommit').length, 1, '其他玩家窗口也可选')
  const spent = []
  const reductions = []
  const api = apiFor(state, {
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount; spent.push(seat) },
    reduceTestDifficulty: amount => { reductions.push(amount) },
  })
  uad.behavior.performAction(state, tester, moves[0], api)
  assert.deepEqual(spent, [tester.seat], '由触发者自己付费')
  assert.deepEqual(reductions, [2], '本次检定难度 -2')
  assert.equal(tester.clues, 1)
  assert.deepEqual(uad.behavior.fastActions(state, tester, 'test.afterCommit'), [], '同一检定同一人只一次')
  // 非阵法检定不提供；非 [fast] 幕不提供。
  state.skillTest = { actionKind: 'willpower' }
  assert.deepEqual(uad.behavior.fastActions(state, other, 'test.afterCommit'), [])
  state.skillTest = { actionKind: 'circle', seat: tester.seat }
  state.acts[0].originalCode = '05239'
  assert.deepEqual(uad.behavior.fastActions(state, other, 'test.afterCommit'), [])
})

test('05239 被偷走的灵魂：看守人不在场先记账，入场时补成真实资源标记并折算攻击/生命', () => {
  const state = placedState(2, { ...RECORD_COVEN, wasTakenByTheWatcher: ['05046', '05047'] })
  state.scenarioFlags.watcherSouls = 2
  const api = apiFor(state)
  // 看守人此时尚未在场：没有可写标记的实例，先记 watcherSouls。
  assert.equal(state.enemies.some(entry => entry.code === '05086'), false)
  const watcher = api.spawn('05086', 'miskatonicRiver')
  assert.equal(watcher.markers.filter(label => label === 'stolenSoul').length, 2,
    '入场时按记账补 2 个 stolenSoul 资源标记（不论之前是否在场）')
  assert.equal(watcher.lostSouls, 2)
  assert.equal(watcher.health, 5 + 2 * 2, '每人 +1 生命折算自灵魂数')
  assert.equal(uad.behavior.enemyStatModifier(state, watcher, 'fight'), 2, '每个灵魂 +1 攻击值')
  assert.equal(uad.behavior.enemyStatModifier(state, watcher, 'evade'), 0, '躲避不加')
  // 之后重新同步（如恋人背面再次记录）时标记数跟随数值、不重复叠加。
  uad.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(watcher.markers.filter(label => label === 'stolenSoul').length, 2, '重复同步不叠加')
})
