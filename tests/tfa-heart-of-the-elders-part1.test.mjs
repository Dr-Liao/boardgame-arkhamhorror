import test from 'node:test'
import assert from 'node:assert/strict'
// 引擎是唯一装配点：import 它之前不会注册能力条目、注入修正读点
// （setModifierRegistry / setModifierHooks），下面的 entityModifierTotal / entityRuleActive 会恒为 0/false。
import '../src/engine/engine.js'
import * as chapter from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/index.js'
import {
  scenario as definition, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES, RUINS_CANDIDATES,
} from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/definition.js'
// Phase 3（D1）：04209b 的「不能被击败 / 不借机攻击」与地点修正已迁到能力层。
import { entityModifierTotal, entityRuleActive } from '../src/engine/modifiers.js'

const clone = value => structuredClone(value)
const behavior = chapter.behavior
const MOUTH = 'mouthOfKnyan'

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

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: MOUTH,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    explorationDeck: [],
    explorationDiscard: [],
    removedFromGame: [],
    campaign: {
      leadSeat: 0,
      records: {},
      investigators: Array.from({ length: count }, (_, seat) => ({
        id: `inv${seat}`, code: '01001', deck: [], purchases: [], trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
      supplies: {},
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
    doom: 0,
  }
}

// 手搭的 scenarioRuntime：只实现行为钩子真正用到的部分。
function makeApi(state, options = {}) {
  const log = []
  let value = (options.seed ?? 777) >>> 0
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  const api = {
    log,
    random,
    info: text => log.push(text),
    choose: request => (options.choose ? options.choose(request) : request.options[0].id),
    test: (seat, skill, difficulty, resolve) => (options.test
      ? options.test({ seat, skill, difficulty, resolve })
      : resolve({ success: true, value: difficulty + 1, difficulty, skill, drawn: [] })),
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    directDamage: (seat, n) => { state.investigators[seat].damage += n },
    directHorror: (seat, n) => { state.investigators[seat].horror += n },
    loseActions: (seat, n) => {
      const inv = state.investigators[seat]
      inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - n)
    },
    endTurn: seat => { state.investigators[seat].turnEnded = true },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    place: id => {
      if (state.locations.some(entry => entry.id === id)) return
      state.locations.push({ ...clone(state.scenario.locations[id]), id, revealed: true, clues: 0 })
    },
    remove: id => { state.locations = state.locations.filter(entry => entry.id !== id) },
    reveal: () => {},
    resign: seat => { state.investigators[seat].resigned = true },
    spawn: (code, location) => {
      const parent = definition.enemies[code] || {}
      const enemy = {
        id: `enemy${state.enemies.length + 1}`, code, originalCode: code,
        name: parent.name || code, location, engagedSeat: null, exhausted: false,
        damageTaken: 0, horrorTaken: 0, fight: parent.fight, evade: parent.evade,
        health: parent.health, damage: parent.damage, horror: parent.horror, doom: 0,
      }
      state.enemies.push(enemy)
      behavior.enemySpawned?.(state, enemy, api)
      return enemy
    },
    discardEnemy: enemy => { state.enemies = state.enemies.filter(entry => entry !== enemy) },
    advanceAct: () => {
      const act = state.acts[state.actIndex]
      if (!act) return
      behavior.actReveal?.(state, act, api)
      if (state.status !== 'playing') return
      state.actIndex += 1
    },
    advanceAgenda: () => {
      const agenda = state.agendas[state.agendaIndex]
      if (!agenda) return
      behavior.agendaReveal?.(state, agenda, api)
      if (state.status !== 'playing') return
      state.agendaIndex += 1
    },
    finish: key => { state.finished = key; state.status = 'resolution' },
    addDoom: n => { state.doom = (state.doom || 0) + n },
    payClues: (n, location) => {
      let remaining = n
      for (const inv of state.investigators.filter(entry => !entry.defeated && !entry.resigned
        && (!location || entry.location === location))) {
        const pay = Math.min(remaining, inv.clues)
        inv.clues -= pay
        remaining -= pay
      }
      if (remaining > 0) throw new Error('线索不足')
    },
    spendClues: (seat, n) => { state.investigators[seat].clues -= n },
    threat: (seat, code, extra = {}) => {
      const inv = state.investigators[seat]
      inv.threat.push({ id: `${code}-${inv.threat.length}`, code, originalCode: code, ...extra })
    },
    poison: seat => {
      const inv = state.investigators[seat]
      if ((inv.threat || []).some(card => card.code === '04102')) return false
      inv.threat.push({ id: `poison-${seat}`, code: '04102', originalCode: '04102', permanent: true })
      return true
    },
    healDamage: (seat, n) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - n) },
    healHorror: (seat, n) => { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - n) },
    checkSupplies: (seat, name) => {
      const inv = state.investigators[seat]
      const owners = state.investigators.filter(entry => !entry.defeated && !entry.resigned
        && entry.location === inv.location)
      return owners.some(entry => ((state.campaign.supplies || {})[entry.seat] || []).includes(name))
    },
    discardRandom: (seat, n) => {
      const inv = state.investigators[seat]
      for (let index = 0; index < n && inv.hand.length; index++) {
        inv.discard.push(inv.hand.splice(Math.floor(random() * inv.hand.length), 1)[0])
      }
    },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      inv.assets = inv.assets.filter(asset => asset.id !== assetId)
    },
    discardUntilEnemy: seat => {
      while (state.encounterDeck.length) {
        const code = state.encounterDeck.pop()
        if (definition.enemies[code]) return code
        state.encounterDiscard.push(code)
      }
      return null
    },
    shuffleDiscard: () => {
      state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]
      state.encounterDiscard = []
    },
    shuffleEncounterDeck: () => {},
    revealToken: () => options.revealToken ?? '0',
    drawEncounter: () => {},
    addYigsFury: n => { state.campaign.records.yigsFury = Number(state.campaign.records.yigsFury || 0) + n },
    addTrauma: (target, seat, kind, amount) => {
      const record = target.campaign.investigators[seat]
      record.trauma[kind] += amount
    },
    campaignCardChange: (campaign, seat, code) => {
      campaign.investigators[seat].deck.push(code)
    },
  }
  return api
}

function placed(state) {
  state.locations = [MOUTH, ...EXPLORATION_LOCATIONS, ...RUINS_CANDIDATES]
    .map(id => ({ ...clone(state.scenario.locations[id]), id, revealed: true, clues: 0 }))
  return state
}

function grant(state, seat, name) {
  state.campaign.supplies ||= {}
  state.campaign.supplies[seat] ||= []
  state.campaign.supplies[seat].push(name)
}

// ---------------------------------------------------------------------------
// 章节身份与数据
// ---------------------------------------------------------------------------
test('久远腹地（上）：章节已从占位升级为 playable，并保留原卡身份', () => {
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.catalogReferenceOnly, undefined)
  assert.equal(chapter.manifest.referenceCode, undefined)
  assert.equal(chapter.scenario.originalCode, '04205')
  assert.equal(chapter.scenario.startLocation, MOUTH)
  assert.equal(chapter.manifest.locations.length, 10)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'r1', 'r2'])
  assert.equal(definition.acts[0].objective.perInvestigator, 2)
  assert.equal(definition.agendas.every(agenda => agenda.doomThreshold === 5), true)
  assert.equal(chapter.manifest.locations.find(location => location.id === MOUTH).backCode, '04206b')
})

test('印刷遭遇牌分區：04102 与 04209b 不进遭遇牌库', () => {
  // 实际开局用的遭遇牌库（定义里的 encounterDeck），不是审计用的 manifest zones 汇总。
  const codes = definition.encounterDeck
  assert.equal(codes.includes('04102'), false)
  assert.equal(codes.includes('04209b'), false)
  // 04215/04221/04081/04082 各被探索牌库借走 1 张（每张印刷 3/3/3/2 份）。
  assert.equal(codes.length, 27)
  assert.equal(codes.filter(code => code === '04215').length, 2)
  assert.equal(codes.filter(code => code === '04221').length, 2)
  assert.equal(codes.filter(code => code === '04081').length, 2)
  assert.equal(codes.filter(code => code === '04082').length, 1)
  assert.equal(codes.filter(code => code === '04216').length, 3)
  const aside = chapter.manifest.zones.setAside
  assert.equal(aside.find(entry => entry.cardCode === '04102').count, 4)
  assert.equal(aside.find(entry => entry.cardCode === '04209b').count, 1)
})

test('印刷卡面校正：蛇怪复仇 2、绝命噬藤无复仇、羽翼蛇族不可击败', () => {
  assert.equal(definition.enemies['04220'].vengeance, 2)
  assert.equal(definition.enemies['04219'].vengeance, 0)
  assert.equal(definition.enemies['04219'].victory, 1)
  assert.equal(definition.enemies['04219'].alert, true)
  assert.equal(definition.enemies['04219'].retaliate, true)
  assert.equal(definition.enemies['04220'].hunter, true)
  assert.equal(definition.enemies['04220'].prey, "Nearest to the Mouth of K'n-yan")
  assert.equal(definition.enemies['04209b'].cannotBeDefeated, true)
  assert.equal(definition.enemies['04209b'].health, null, '没有生命值，不要兜底成 1')
  assert.equal(definition.enemies['04209b'].hunter, true)
  assert.equal(definition.enemies['04209b'].alert, true)
  assert.equal(definition.enemies['04209b'].massive, true)
  assert.equal(definition.treacheries['04215'].peril, true)
  assert.equal(definition.treacheries['04216'].peril, false)
})

test('实现清单只包含本章真正用于遭遇的卡号', () => {
  const known = new Set([...Object.keys(definition.enemies), ...Object.keys(definition.treacheries)])
  assert.ok(behavior.implementedEncounterCodes.includes('04215'))
  assert.ok(behavior.implementedEncounterCodes.includes('04216'))
  for (const code of behavior.implementedEncounterCodes) {
    assert.ok(known.has(code), `实现清单里的 ${code} 不在本章遭遇牌中`)
  }
})

// ---------------------------------------------------------------------------
// 地图
// ---------------------------------------------------------------------------
test('符号地图按印刷符号连线（昆扬之口为等号）', () => {
  const locations = Object.fromEntries(chapter.manifest.locations.map(location => [location.id, location]))
  assert.deepEqual([...locations[MOUTH].connections].sort(),
    ['overgrownRuins', 'stoneAltar', 'templeOfTheFang'])
  assert.ok(locations.timeWrackedWoods.connections.includes('pathOfThorns'))
  assert.ok(locations.timeWrackedWoods.connections.includes('ropeBridge'))
  assert.ok(locations.stoneAltar.connections.includes('serpentsHaven'))
  assert.ok(locations.serpentsHaven.connections.includes('templeOfTheFang'))
  assert.equal(locations.pathOfThorns.connections.includes('overgrownRuins'), false,
    '荆棘之路与杂草丛生的遗迹没有共同符号，不能相连')
})

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
test('布置是确定性的，并按原卡组成探索牌库', () => {
  const build = seed => {
    const state = stateFor()
    behavior.setupLocations(state, [], setupApi(seed))
    return state
  }
  const first = build(17)
  const second = build(17)
  assert.deepEqual(first.explorationDeck, second.explorationDeck)
  assert.notDeepEqual(build(18).explorationDeck, first.explorationDeck)
  assert.equal(first.explorationDeck.length, 11)
  const locations = first.explorationDeck.filter(code => Object.hasOwn(definition.locations, code))
  assert.equal(locations.length, 7)
  assert.equal(locations.filter(code => RUINS_CANDIDATES.includes(code)).length, 1)
  for (const code of EXPLORATION_TREACHERIES) assert.ok(first.explorationDeck.includes(code))
  // 三处遗迹中随机一处进探索牌库，其余两张移出游戏。
  const ruins = first.scenarioZones.ruinsLocation
  assert.ok(RUINS_CANDIDATES.includes(ruins))
  assert.deepEqual([...first.scenarioZones.removed].sort(),
    RUINS_CANDIDATES.filter(code => code !== ruins).sort())
  // 中毒弱点放在一边（牌组里没有 04102 时为 4 张）。
  assert.equal(first.scenarioZones.setAside.filter(code => code === '04102').length, 4)
})

test('毒牙神庙 / 石柱标记：布置按 pathsAreKnownToYou 放置石柱标记', () => {
  const state = stateFor()
  state.campaign.records.pathsAreKnownToYou = 3
  behavior.setupLocations(state, [], setupApi(5))
  assert.equal(state.scenarioFlags.pillars, 3)
  assert.equal(state.scenarioFlags.autoResolveR1, false)
  const closed = stateFor()
  closed.campaign.records.pathsAreKnownToYou = 6
  behavior.setupLocations(closed, [], setupApi(5))
  assert.equal(closed.scenarioFlags.autoResolveR1, true)
  const api = makeApi(closed)
  behavior.checkObjectives(closed, api)
  assert.equal(closed.finished, 'r1')
})

test('摸清前进的道路：遗迹地点直接入场，不洗进探索牌库', () => {
  const state = stateFor()
  state.campaign.records.theInvestigatorsMappedOutTheWayForward = true
  const ids = behavior.setupLocations(state, [], setupApi(11))
  assert.equal(ids.length, 2)
  assert.equal(ids[0], MOUTH)
  assert.ok(RUINS_CANDIDATES.includes(ids[1]))
  assert.equal(state.explorationDeck.length, 10)
  assert.equal(state.explorationDeck.some(code => RUINS_CANDIDATES.includes(code)), false)
})

// ---------------------------------------------------------------------------
// 探索与地点
// ---------------------------------------------------------------------------
test('探索到地点后同步符号连线；探索失败按卡面在荆棘之路受伤', () => {
  const state = placed(stateFor())
  behavior.setupLocations(state, [], setupApi(7))
  const api = makeApi(state)
  const inv = state.investigators[0]
  inv.location = 'pathOfThorns'
  state.locations.find(entry => entry.id === 'timeWrackedWoods').connections = []
  inv.tfaExploredThisTurn = false
  behavior.afterExplore(state, inv, { code: 'timeWrackedWoods', kind: 'location', runtime: api })
  const woods = state.locations.find(entry => entry.id === 'timeWrackedWoods')
  assert.ok(woods.connections.includes('pathOfThorns'), '符号连线补上相邻地点')
  assert.ok(state.locations.find(entry => entry.id === 'pathOfThorns').connections.includes('timeWrackedWoods'))
  assert.equal(inv.tfaExploredThisTurn, true)
  behavior.afterExplore(state, inv, { kind: 'encounter', runtime: api })
  assert.equal(inv.damage, 1, '荆棘之路探索失败受到 1 点伤害')
  inv.threat.push({ id: 'poison', code: '04102', permanent: true })
  inv.location = 'serpentsHaven'
  behavior.afterExplore(state, inv, { kind: 'encounter', runtime: api })
  assert.equal(inv.damage, 2, '万蛇据点中毒加成')
})

test('索桥：探索前检定敏捷(2)，失败则取消探索并回到河流峡谷', () => {
  const build = () => {
    const state = placed(stateFor(1))
    behavior.setupLocations(state, [], setupApi(13))
    // 河流峡谷还不在场上：索桥失败时要先从探索牌库把它找出来。
    state.locations = state.locations.filter(entry => entry.id !== 'riverCanyon')
    const inv = state.investigators[0]
    inv.location = 'ropeBridge'
    state.explorationDeck = ['riverCanyon']
    const api = makeApi(state, {
      test: ({ resolve, difficulty, skill }) => resolve({
        success: false, value: 0, difficulty, skill, drawn: [],
      }),
    })
    const allowed = behavior.beforeExplore(state, inv, api)
    return { state, inv, allowed }
  }
  const first = build()
  assert.equal(first.allowed, false)
  assert.equal(first.inv.damage, 2)
  assert.equal(first.inv.turnEnded, true)
  assert.equal(first.inv.location, 'riverCanyon')
  assert.deepEqual(first.state.explorationDeck, [])
  assert.equal(JSON.stringify(first.state), JSON.stringify(build().state), '同一路线结果一致')
})

test('曲折小道：没有指南针必须支付 3 资源，否则不能探索', () => {
  const run = resources => {
    const state = placed(stateFor(1))
    behavior.setupLocations(state, [], setupApi(19))
    const inv = state.investigators[0]
    inv.location = 'circuitousTrail'
    inv.resources = resources
    const api = makeApi(state)
    return { allowed: behavior.beforeExplore(state, inv, api), inv, state }
  }
  const rich = run(3)
  assert.equal(rich.allowed, true)
  assert.equal(rich.inv.resources, 0)
  assert.equal(rich.state.scenarioFlags.exploreDrawPending, true)
  const poor = run(2)
  assert.equal(poor.allowed, false)
})

test('石柱祭坛：进入后揭示混乱标记，符号则失去 1 行动，无法失去改为 1 点恐惧', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  const altar = state.locations.find(entry => entry.id === 'stoneAltar')
  behavior.locationEntered(state, inv, altar, makeApi(state, { revealToken: 'skull' }))
  assert.equal(inv.actionsLeft, 2)
  inv.actionsLeft = 0
  behavior.locationEntered(state, inv, altar, makeApi(state, { revealToken: 'autofail' }))
  assert.equal(inv.horror, 1)
  inv.actionsLeft = 3
  behavior.locationEntered(state, inv, altar, makeApi(state, { revealToken: '-2' }))
  assert.equal(inv.actionsLeft, 3, '非符号标记没有惩罚')
})

test('地点与敌人修正：毒牙神庙帷幕 + 复仇，万蛇据点蛇族 +1 攻击', () => {
  const state = placed(stateFor(1))
  state.victoryDisplay = [{ id: 'v1', code: '04220', originalCode: '04220', vengeance: 2 }]
  assert.equal(entityModifierTotal(state, state.locations.find(l => l.id === 'templeOfTheFang'), 'locationShroud'), 2)
  const snake = { code: '04220', originalCode: '04220', location: 'serpentsHaven', traits: ['Serpent'] }
  assert.equal(entityModifierTotal(state, snake, 'enemyFight'), 1)
  assert.equal(entityModifierTotal(state, snake, 'enemyEvade'), 0)
  const viper = { code: '04078', originalCode: '04078', location: 'serpentsHaven', traits: ['Serpent'] }
  assert.equal(entityModifierTotal(state, viper, 'enemyFight'), 1)
})

test('杂草丛生的遗迹：中毒者进入后失去所有行动并结束回合', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  const ruins = state.locations.find(entry => entry.id === 'overgrownRuins')
  inv.threat.push({ id: 'p', code: '04102', permanent: true })
  behavior.locationEntered(state, inv, ruins, makeApi(state))
  assert.equal(inv.actionsLeft, 0)
  assert.equal(inv.turnEnded, true)
})

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
test('场景 1 推进：把羽翼蛇族生成在昆扬之口，且它不能被击败、不能借机攻击', () => {
  const state = placed(stateFor(1))
  const api = makeApi(state)
  behavior.actReveal(state, state.acts[0], api)
  const serpent = state.enemies.find(enemy => enemy.code === '04209b')
  assert.ok(serpent)
  assert.equal(serpent.location, MOUTH)
  assert.equal(entityRuleActive(state, serpent, 'cannot:beDefeated'), true)
  assert.equal(entityRuleActive(state, serpent, 'cannot:opportunityAttack'), true)
  behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.enemies.filter(enemy => enemy.code === '04209b').length, 1, '不会重复生成')
})

test('场景 2：在昆扬之口共同支付 1×人数线索放置石柱标记，第 6 个标记推进到结局 1', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(23))
  state.actIndex = 1
  const inv = state.investigators[0]
  inv.clues = 2
  let moves = behavior.actions(state, inv)
  const solve = moves.find(move => move.rule === 'solvePillar')
  assert.ok(solve, '线索足够时提供解石柱谜题行动')
  const api = makeApi(state)
  state.scenarioFlags.pillars = 5
  behavior.performAction(state, inv, solve, api)
  assert.equal(state.scenarioFlags.pillars, 6)
  assert.equal(inv.clues, 0)
  behavior.checkObjectives(state, api)
  assert.equal(state.finished, 'r1')
  state.actIndex = 1
  state.status = 'playing'
  const poor = stateFor(1)
  placed(poor)
  poor.actIndex = 1
  moves = behavior.actions(poor, poor.investigators[0])
  // 线索不足：条目仍列出但带 reason，因此不进可执行列表。
  const blockedPillar = moves.find(move => move.rule === 'solvePillar')
  assert.equal(blockedPillar?.reason, '需要共同花费 1 个线索（当前 0）', '线索不足时给出缺口')
  assert.equal(moves.filter(move => !move.reason && move.rule === 'solvePillar').length, 0, '线索不足时不提供行动')
})

test('密室 1 推进：没有双筒望远镜的瞭望员弃牌直到敌人并生成', () => {
  const state = placed(stateFor(2))
  state.encounterDeck = ['04221', '04219']
  state.encounterDiscard = ['04215']
  const base = makeApi(state, { choose: request => request.options[1].id })
  let shuffled = 0
  const api = { ...base, shuffleDiscard: () => { shuffled += 1; base.shuffleDiscard() } }
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(shuffled, 1, '遭遇弃牌堆洗回遭遇牌库')
  const spawned = state.enemies.find(enemy => enemy.code === '04219')
  assert.ok(spawned, '弃到敌人后生成它')
  assert.equal(spawned.location, state.investigators[1].location)
  assert.deepEqual(state.encounterDeck, ['04221'], '弃牌过程中被弃掉的诡计进入弃牌堆')
  assert.deepEqual(state.encounterDiscard, ['04215'])
})

test('密室 1 推进：瞭望员带双筒望远镜时不受影响', () => {
  const state = placed(stateFor(1))
  state.encounterDeck = ['04219']
  grant(state, 0, 'binoculars')
  behavior.agendaReveal(state, state.agendas[0], makeApi(state))
  assert.equal(state.enemies.length, 0)
  assert.equal(state.encounterDeck.length, 1)
})

test('密室 2 推进：每位幸存调查员立即撤退，进入无结局', () => {
  const state = placed(stateFor(2))
  behavior.agendaReveal(state, state.agendas[1], makeApi(state))
  assert.deepEqual(state.investigators.map(inv => inv.resigned), [true, true])
})

// ---------------------------------------------------------------------------
// 本章遭遇牌（04215 / 04216 / 04221 由本地 resolveEncounter 实现）
// ---------------------------------------------------------------------------
test('落入陷阱：可从遭遇牌库洗回探索牌库，检定失败每差 1 点受 1 点伤害', () => {
  const state = placed(stateFor(1))
  state.scenarioFlags = { exploreDrawPending: false }
  const shuffleApi = makeApi(state, { choose: () => 'shuffle' })
  const pitfall = definition.treacheries['04215']
  const handled = behavior.resolveEncounter(state, state.investigators[0], pitfall, shuffleApi)
  assert.deepEqual(handled, { placed: true })
  assert.ok(state.explorationDeck.includes('04215'))

  const failState = placed(stateFor(1))
  const api = makeApi(failState, {
    choose: () => 'test',
    test: ({ resolve, difficulty, skill }) => resolve({ success: false, value: 1, difficulty, skill, drawn: [] }),
  })
  behavior.resolveEncounter(failState, failState.investigators[0], pitfall, api)
  assert.equal(failState.investigators[0].damage, 2, '低于难度 2 点，受到 2 点伤害')
})

test('落入陷阱：从探索牌库抽出时不能选择洗回牌库，必须检定', () => {
  const state = placed(stateFor(1))
  state.scenarioFlags = { exploreDrawPending: true }
  let asked = false
  const api = makeApi(state, {
    choose: request => { asked = true; return request.options[0].id },
    test: ({ resolve, difficulty, skill }) => resolve({ success: true, value: 4, difficulty, skill, drawn: [] }),
  })
  behavior.resolveEncounter(state, state.investigators[0], definition.treacheries['04215'], api)
  assert.equal(asked, false, '不提供选择')
  assert.equal(state.investigators[0].damage, 0)
})

test('有毒孢子：附属到地点，轮末让中毒者受 2 点恐惧、未中毒者中毒并弃掉本卡', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(29))
  const [poisoned, healthy] = state.investigators
  poisoned.threat.push({ id: 'p', code: '04102', permanent: true })
  const api = makeApi(state)
  const handled = behavior.resolveEncounter(state, healthy, definition.treacheries['04216'], api)
  assert.equal(handled, true)
  const location = state.locations.find(entry => entry.id === healthy.location)
  assert.equal(location.attachments.length, 1)
  behavior.roundEnded(state, api)
  assert.equal(poisoned.horror, 2)
  assert.equal(healthy.threat.some(card => card.code === '04102'), true, '未中毒者改为中毒')
  assert.equal(state.scenarioZones.setAside.filter(code => code === '04102').length, 3)
  assert.equal(location.attachments.length, 0)
})

test('蚁群缠身：敏捷(4)失败每差 1 点弃一张手牌或游戏区域的卡牌', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  inv.hand = ['01020', '01021']
  const api = makeApi(state, {
    choose: () => 'hand',
    test: ({ resolve, difficulty, skill }) => resolve({ success: false, value: 2, difficulty, skill, drawn: [] }),
  })
  behavior.resolveEncounter(state, inv, definition.treacheries['04221'], api)
  assert.equal(inv.hand.length + inv.discard.length, 2)
  assert.equal(inv.discard.length, 2, '失败 2 点，弃 2 张手牌')
})

test('绝命噬藤：借机攻击后没有折叠小刀就失去所有行动并结束回合', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  const weed = { id: 'weed', code: '04219', originalCode: '04219', location: inv.location }
  const api = makeApi(state)
  // P2：引擎把攻击类型作为第 5 个参数传给 enemyAttackResolved。
  behavior.enemyAttackResolved(state, weed, inv, api, { kind: 'opportunity', damage: 1, horror: 1 })
  assert.equal(inv.actionsLeft, 0)
  assert.equal(inv.turnEnded, true)
  const state2 = placed(stateFor(1))
  grant(state2, 0, 'pocketknife')
  const inv2 = state2.investigators[0]
  behavior.enemyAttackResolved(state2, { id: 'w', code: '04219', originalCode: '04219' }, inv2, makeApi(state2),
    { kind: 'opportunity', damage: 1, horror: 1 })
  assert.equal(inv2.actionsLeft, 3, '有折叠小刀则不受影响')
  const state3 = placed(stateFor(1))
  behavior.enemyAttackResolved(state3, { id: 'w', code: '04219', originalCode: '04219' },
    state3.investigators[0], makeApi(state3), { kind: 'enemy', damage: 1, horror: 1 })
  assert.equal(state3.investigators[0].actionsLeft, 3, '非借机攻击时不触发')
  // 卡牌效果造成的攻击同样不是借机攻击。
  const state4 = placed(stateFor(1))
  behavior.enemyAttackResolved(state4, { id: 'w', code: '04219', originalCode: '04219' },
    state4.investigators[0], makeApi(state4), { kind: 'effect', damage: 1, horror: 1 })
  assert.equal(state4.investigators[0].actionsLeft, 3, '效果攻击不触发')
})

// ---------------------------------------------------------------------------
// 石柱标记的强制效果
// ---------------------------------------------------------------------------
test('放置石柱标记：横置羽翼蛇族，并把一张蛇怪洗回遭遇牌库（每轮一次）', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(31))
  state.actIndex = 1
  const api = makeApi(state)
  behavior.actReveal(state, state.acts[0], api)
  state.enemies.push({ id: 'basilisk', code: '04220', originalCode: '04220', location: MOUTH })
  state.encounterDiscard.push('04220')
  state.scenarioFlags.pillars = 5
  const inv = state.investigators[0]
  inv.clues = 2
  behavior.performAction(state, inv, behavior.actions(state, inv).find(move => move.rule === 'solvePillar'), api)
  const serpent = state.enemies.find(enemy => enemy.code === '04209b')
  assert.equal(serpent.exhausted, true)
  assert.deepEqual(serpent.preventReady, { from: 1, rounds: 1 })
  assert.equal(state.encounterDeck.includes('04220'), true)
  assert.equal(state.encounterDiscard.includes('04220'), false)
  assert.equal(state.scenarioFlags.basiliskRound, 1)
  // 同一轮再放一个标记不会再次洗入。
  state.scenarioFlags.pillars = 5
  inv.clues = 2
  behavior.performAction(state, inv, behavior.actions(state, inv).find(move => move.rule === 'solvePillar'), api)
  assert.equal(state.encounterDeck.filter(code => code === '04220').length, 1)

  // 两张蛇怪都在场上、牌盒里没有副本时，不会再凭空出现第 3 张。
  state.enemies.push({ id: 'basilisk2', code: '04220', originalCode: '04220', location: MOUTH })
  state.scenarioFlags.pillars = 5
  state.scenarioFlags.basiliskRound = 0
  inv.clues = 2
  const copiesBefore = state.encounterDeck.filter(code => code === '04220').length
  behavior.performAction(state, inv, behavior.actions(state, inv).find(move => move.rule === 'solvePillar'), api)
  assert.equal(state.encounterDeck.filter(code => code === '04220').length, copiesBefore,
    '没有可洗回的副本时不增加蛇怪')
})

test('蛇怪的猎物是距离昆扬之口最近的调查员', () => {
  const state = placed(stateFor(2))
  state.investigators[0].location = 'serpentsHaven'
  state.investigators[1].location = 'timeWrackedWoods'
  const api = makeApi(state)
  const basilisk = api.spawn('04220', 'pathOfThorns')
  assert.equal(basilisk.preySeat, 0)
})

// ---------------------------------------------------------------------------
// 混沌标记表
// ---------------------------------------------------------------------------
test('混乱标记表沿用 04205 印刷值（含洞穴加成与中毒自动失败）', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  inv.location = MOUTH
  state.locations.find(entry => entry.id === MOUTH).traits = ['Cave']
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -3, '洞穴内 -1 改为 -3')
  state.locations.find(entry => entry.id === MOUTH).traits = []
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -1)
  assert.equal(behavior.resolveChaosToken(state, inv, 'cultist', {}).delta, -2)
  assert.deepEqual(behavior.resolveChaosToken(state, inv, 'cultist', {}).doomOnFail, 'location')
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing', {}).delta, -3)
  inv.threat.push({ id: 'p', code: '04102', permanent: true })
  assert.equal(behavior.resolveChaosToken(state, inv, 'tablet', {}).autoFail, true)
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -2)
  state.locations.find(entry => entry.id === MOUTH).traits = ['Cave']
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -4)
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing', {}).delta, -4)
})

test('困难/专家：平板标记失败且未中毒时，把放在一边的中毒弱点放进威胁区域', () => {
  const state = placed(stateFor(1))
  behavior.setupLocations(state, [], setupApi(37))
  const inv = state.investigators[0]
  state.difficulty = 'hard'
  behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 3, skill: 'willpower', drawn: ['tablet'], source: { label: '调查' },
  }, makeApi(state))
  assert.equal(inv.threat.some(card => card.code === '04102'), true)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '04102').length, 3)
})

// ---------------------------------------------------------------------------
// 地点行动与结局
// ---------------------------------------------------------------------------
test('昆扬之口：提供撤退与指南针查看行动，指南针把 1 张放到探索牌库底部', () => {
  const state = placed(stateFor(1))
  state.explorationDeck = ['a', 'b', 'c', 'd']
  const inv = state.investigators[0]
  inv.location = MOUTH
  const moves = behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule).sort(), ['mouthCompass', 'resignMouth'])
  grant(state, 0, 'compass')
  const api = makeApi(state, { choose: () => '1' })
  behavior.performAction(state, inv, moves.find(move => move.rule === 'mouthCompass'), api)
  assert.equal(state.explorationDeck.length, 4)
  // 牌库的数组末尾是顶：顶 3 张为 d/c/b，第一个选择把 c 放到牌库底，
  // 第二个选择（同为 index 1）把 b 放到牌库顶、d 紧随其下。
  assert.equal(state.explorationDeck.at(-1), 'b', '其余 2 张按选择排序后回到顶部')
  assert.equal(state.explorationDeck[0], 'c', '选中的那张放到牌库底')
  assert.deepEqual(state.explorationDeck.slice(1), ['a', 'd', 'b'])
  const resigned = []
  behavior.performAction(state, inv, moves.find(move => move.rule === 'resignMouth'),
    { resign: seat => resigned.push(seat) })
  assert.deepEqual(resigned, [0])

  // 其余 2 张也可以换顺序：第二个选择把另一张放到牌库顶。
  const reordered = placed(stateFor(1))
  reordered.explorationDeck = ['a', 'b', 'c', 'd']
  const second = reordered.investigators[0]
  second.location = MOUTH
  grant(reordered, 0, 'compass')
  const answers = ['1', '1']
  behavior.performAction(reordered, second,
    behavior.actions(reordered, second).find(move => move.rule === 'mouthCompass'),
    makeApi(reordered, { choose: () => answers.shift() }))
  assert.equal(reordered.explorationDeck.at(-1), 'b', '选中另一张作为牌库顶')
  assert.equal(reordered.explorationDeck.at(-2), 'd')
})

test('错时林地：花 2 个行动把带复仇的卡牌放进遭遇弃牌堆，每场游戏仅一次', () => {
  const state = placed(stateFor(1))
  state.victoryDisplay = [
    { id: 'v1', code: '04220', originalCode: '04220', vengeance: 2 },
    { id: 'v2', code: '04219', originalCode: '04219', vengeance: 0, victory: 1 },
  ]
  const inv = state.investigators[0]
  inv.location = 'timeWrackedWoods'
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'expelVengeance')
  assert.equal(move.actions, 2)
  behavior.performAction(state, inv, move, makeApi(state))
  assert.equal(state.victoryDisplay.length, 1)
  assert.deepEqual(state.encounterDiscard, ['04220'])
  assert.equal(behavior.actions(state, inv).some(entry => entry.rule === 'expelVengeance'), false)
})

test('结局写入战役记录并保留存档一致性', () => {
  const state = placed(stateFor(2))
  behavior.setupLocations(state, [], setupApi(41))
  state.victoryDisplay = [{ id: 'v1', code: '04220', originalCode: '04220', vengeance: 2 }]
  const result = behavior.resolution(state, 'r1', [], makeApi(state))
  assert.deepEqual(result, { award: true, bonus: 0 })
  assert.deepEqual(state.campaign.records.theJungleWatches, ['04220'])
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.records, state.campaign.records)
  assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  // 无结局：记录已经解开的通路数，不给经验。
  state.scenarioFlags.pillars = 4
  assert.deepEqual(behavior.resolution(state, 'noResolution', [], makeApi(state)), { award: false, bonus: 0 })
  assert.equal(state.campaign.records.pathsAreKnownToYou, 4)
  // 结局 2：补齐石柱、记录伊格之怒、中毒者精神创伤。
  state.scenarioFlags.pillars = 2
  state.investigators[0].threat.push({ id: 'p', code: '04102', permanent: true })
  behavior.resolution(state, 'r2', [], makeApi(state))
  assert.equal(state.scenarioFlags.pillars, 6)
  assert.equal(state.campaign.records.yigsFury, 8)
  assert.equal(state.campaign.investigators[0].trauma.mental, 1)
  assert.equal(state.campaign.investigators[1].deck.includes('04102'), true)
  assert.throws(() => behavior.resolution(state, 'r9', [], makeApi(state)))
})

test('同样种子下两次布置与整局推进的存档结果一致（JSON 往返）', () => {
  const run = () => {
    const state = placed(stateFor(2))
    behavior.setupLocations(state, [], setupApi(43))
    const api = makeApi(state, { choose: request => request.options[0].id })
    behavior.actReveal(state, state.acts[0], api)
    behavior.actReveal(state, state.acts[0], api)
    state.actIndex = 1
    behavior.roundEnded(state, api)
    return JSON.parse(JSON.stringify(state))
  }
  assert.deepEqual(run(), run())
})

test('序盘导入（P2）：按战役卡/记录决定伊塔卡、亚历山卓、探险日志是否随队', async () => {
  const { introduction } = await import('../src/campaign/story.js')
  const read = state => introduction({ id: 'heartOfTheEldersPart1' }, {}, state).paragraphs.join('\n')

  const none = stateFor(1)
  chapter.behavior.preScenarioSetup(none, [], { info() {} })
  assert.equal(none.scenarioFlags.ichtacaPresent, false)
  assert.equal(none.scenarioFlags.alejandroPresent, false)
  assert.equal(none.scenarioFlags.journalPresent, false)
  const bare = read(none)
  assert.ok(bare.includes('Intro 1:'))
  assert.equal(bare.includes('Intro 2:'), false)
  assert.equal(bare.includes('Intro 3:'), false)
  assert.equal(bare.includes('Intro 4:'), false)

  const withAll = stateFor(1)
  withAll.campaign.investigators[0].deck.push('04147', '04051', '04148')
  chapter.behavior.preScenarioSetup(withAll, [], { info() {} })
  assert.equal(withAll.scenarioFlags.ichtacaPresent, true)
  assert.equal(withAll.scenarioFlags.alejandroPresent, true)
  assert.equal(withAll.scenarioFlags.journalPresent, true)
  const full = read(withAll)
  for (const key of ['Intro 2:', 'Intro 3:', 'Intro 4:']) assert.ok(full.includes(key), key)

  const byRecord = stateFor(1)
  byRecord.campaign.records.ichtacasFaithIsRestored = true
  chapter.behavior.preScenarioSetup(byRecord, [], { info() {} })
  assert.equal(byRecord.scenarioFlags.ichtacaPresent, true, '记录也能让伊塔卡随行')
})

test('04070 河流峡谷：治愈 1 点（有水壶 +2），每场游戏一次', () => {
  const withCanteen = placed(stateFor(1))
  withCanteen.locations.push({ ...clone(withCanteen.scenario.locations.riverCanyon), id: 'riverCanyon', revealed: true, clues: 1 })
  withCanteen.campaign.supplies = { 0: ['canteen'] }
  const inv = withCanteen.investigators[0]
  inv.location = 'riverCanyon'
  inv.damage = 3
  const api = makeApi(withCanteen)
  const move = chapter.behavior.actions(withCanteen, inv).find(entry => entry.rule === 'healRiverCanyon')
  assert.ok(move, '河流峡谷应提供治愈行动')
  chapter.behavior.performAction(withCanteen, inv, move, api)
  assert.equal(inv.damage, 0, '有水壶治愈 3 点')
  assert.equal(chapter.behavior.actions(withCanteen, inv).some(entry => entry.rule === 'healRiverCanyon'), false,
    '每场游戏一次')

  const without = placed(stateFor(1))
  without.locations.push({ ...clone(without.scenario.locations.riverCanyon), id: 'riverCanyon', revealed: true, clues: 1 })
  without.campaign.supplies = {}
  const thirsty = without.investigators[0]
  thirsty.location = 'riverCanyon'
  thirsty.damage = 3
  chapter.behavior.performAction(without, thirsty,
    chapter.behavior.actions(without, thirsty).find(entry => entry.rule === 'healRiverCanyon'), makeApi(without))
  assert.equal(thirsty.damage, 2, '没有水壶只治愈 1 点')
})

test('04218 石板祭坛：日志用中文标记名，不暴露内部 id', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  const location = { ...clone(state.scenario.locations.stoneAltar), id: 'stoneAltar', revealed: true, clues: 1 }
  state.locations.push(location)
  const logs = []
  const api = { info: text => logs.push(text), revealToken: () => 'autofail', loseActions: () => {}, horror: () => {} }
  behavior.locationEntered(state, inv, location, api)
  assert.ok(logs.some(text => text.includes('自动失败')))
  assert.equal(logs.some(text => text.includes('autofail')), false)
})

test('探索牌库借走的 4 张诡计从遭遇牌库扣除', () => {
  const expected = { '04215': 2, '04221': 2, '04081': 2, '04082': 1 }
  for (const [code, count] of Object.entries(expected)) {
    assert.equal(definition.encounterDeck.filter(entry => entry === code).length, count,
      `${code} 比印刷份数少 1 张`)
  }
  assert.equal(definition.encounterDeck.length, 27)
})

test('六根石柱通路已知时直接进入结局 1', () => {
  const state = placed(stateFor(1))
  state.campaign.records.pathsAreKnownToYou = 6
  behavior.setupLocations(state, [], setupApi(5))
  assert.equal(state.scenarioFlags.autoResolveR1, true)
  const finished = []
  behavior.checkObjectives(state, { info: () => {}, finish: key => finished.push(key) })
  assert.deepEqual(finished, ['r1'])
  assert.equal(state.scenarioFlags.autoResolveR1, false)
})

test('04073 曲折小道：调查也要检查指南针并收 3 资源', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  inv.resources = 5
  const api = { checkSupplies: () => false, info: () => {} }
  assert.equal(behavior.beforeInvestigate(state, inv, { originalCode: '04073', code: '04073' }, api), true)
  assert.equal(inv.resources, 2)
  inv.resources = 2
  assert.equal(behavior.beforeInvestigate(state, inv, { originalCode: '04073', code: '04073' }, api), false)
  assert.equal(inv.resources, 2, '付不起就不扣资源')
  assert.equal(behavior.beforeInvestigate(state, inv, { originalCode: '04069', code: '04069' }, api), true)
})
