// 验收 05-a 分片 8：Before the Black Throne（pack = 'bbt'，34 张）逐卡验收证据。
//
// 范围：05313–05324（玩家卡）+ 05325–05346（战役卡：参考卡/幕/议程/地点/敌人/诡计）。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维；每个卡号至少一条标题含卡号的真实断言测试。
// 说明：本文件不替代行为实现，只做验收证据；缺证据的场景卡在这里补真实引擎/行为断言。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, move, settle, asset, enemy } from './core-fixture.mjs'
import {
  applyHarm, applyMove, createGameState, enemyEvadeValue, enemyFightValue, enemyHealth, getHandSize,
  legalMoves, performTest, returnAssetToHand, startScenario,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'
import { zoneApi } from './tcu-zone-api.mjs'
import * as bbt from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/index.js'
import {
  AZATHOTH, BLACK_THRONE, COSMIC_GATE, COSMIC_INGRESS, COSMOS_DECK_IDS, COSMOS_LAYOUTS, COURT,
  DAEMONIC_PIPING, DANCERS_MIST, FLIGHT, HIDEOUS_PALACE, INFINITY, PATHWAY,
} from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/definition.js'
import { azathothDoomOf, bbtChaosToken, skullX } from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/chaos.js'
import {
  cellAt, gridOf, positionOf, refreshConnections, setEmptySpace, setLocationPosition,
} from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/cosmos.js'
import {
  drawScenarioLocationDeck, scenarioLocationDeckInfo, shuffleScenarioLocationIntoDeck,
} from '../src/engine/alt-decks.js'
import { actRuleFor, agendaRuleFor, locationRuleFor } from '../src/cards/card-rules.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BBT_CODES = Object.freeze([
  '05313', '05314', '05315', '05316', '05317', '05318', '05319', '05320', '05321', '05322', '05323', '05324',
  '05325', '05326', '05327', '05328', '05329', '05330', '05331', '05332', '05333', '05334', '05335', '05336',
  '05337', '05338', '05339', '05340', '05341', '05342', '05343', '05344', '05345', '05346',
])
const me = state => state.investigators[0]
const nameOf = code => ALL_CARDS[code].nameZh || ALL_CARDS[code].name
const clone = value => structuredClone(value)
const loc = (state, id) => state.locations.find(location => location.id === id)

function run(state, fn, choose) {
  const execute = current => fn(current)
  resolveTransaction(state, 0, { action: 'acceptance-05-a-8' }, execute)
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'normal', 'no'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    if (optionId == null) break
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

// ---------------------------------------------------------------------------
// 合成场景状态（战役卡测试用；与 tests/tcu-black-throne.test.mjs 同口径）
// ---------------------------------------------------------------------------

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
    scenario: clone(bbt.scenario),
    acts: clone(bbt.scenario.acts),
    agendas: clone(bbt.scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: COSMIC_INGRESS,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: Array.from({ length: 12 }, (_, index) => `deck${seat}-${index}`),
      discard: [], actionsLeft: 3,
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
    doom: 0,
    skillTest: null,
    campaign: {
      leadSeat: 0,
      records: { mementosDiscovered: [], ...records },
      investigators: Array.from({ length: count }, (_, seat) => ({
        id: `inv${seat}`, deck: [], purchases: [], status: 'active',
        trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function placeInState(state, id, { revealed = null } = {}) {
  if (loc(state, id)) return loc(state, id)
  const base = state.scenario.locations[id]
  assert.ok(base, `缺少地点定义 ${id}`)
  const variant = state.locationVariants?.[id] || null
  const merged = { ...clone(base), ...(variant ? clone(variant) : {}) }
  const autoRevealed = revealed == null ? state.investigators.some(inv => inv.location === id) : revealed
  const totalClues = merged.cluesFixed ?? (merged.cluesPerInvestigator || 0) * state.numInvestigators
  const location = {
    ...merged, id, revealed: autoRevealed,
    clues: autoRevealed ? totalClues : 0, maxClues: totalClues, doom: 0,
    connections: [...(merged.connections || [])],
  }
  state.locations.push(location)
  return location
}

function setup(state, { seed = 11, place = true } = {}) {
  const rng = setupApi(seed)
  const placed = bbt.behavior.setupLocations(state, [], rng)
  if (place) for (const id of placed) placeInState(state, id)
  if (place) bbt.behavior.afterChaosBagSetup(state)
  return { rng, placed }
}

function apiFor(state, options = {}) {
  const choices = [...(options.choices || [])]
  const log = []
  const rng = options.rng || setupApi(23)
  const testResult = options.testResult || { success: true, value: 4, difficulty: 4 }
  const remove = id => {
    const index = state.locations.findIndex(location => location.id === id)
    if (index >= 0) state.locations.splice(index, 1)
    for (const location of state.locations) location.connections = (location.connections || []).filter(c => c !== id)
  }
  const api = {
    log,
    info: text => log.push(String(text)),
    random: rng.randomValue,
    shuffle: list => rng.shuffle([...list]),
    choose: request => (choices.length ? choices.shift() : (request?.options?.[0]?.id ?? 'skip')),
    test: (seat, skill, difficulty, resolve) => {
      const result = { ...testResult, difficulty, skill }
      if (result.value == null) result.value = difficulty
      resolve(result)
      return result
    },
    cosmos: (options2 = {}) => {
      const id = options2.id || 'cosmos'
      if (options2.draw) return drawScenarioLocationDeck(state, id, options2.draw)
      if (options2.shuffle) return shuffleScenarioLocationIntoDeck(state, id, options2.shuffle)
      return scenarioLocationDeckInfo(state, id)
    },
    place: id => placeInState(state, id),
    reveal: id => {
      const location = loc(state, id)
      if (!location) return
      location.revealed = true
      if (location.unrevealedActualName) {
        location.name = location.unrevealedActualName
        delete location.unrevealedActualName
      }
      location.clues = location.maxClues ?? 0
    },
    remove,
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    moveEnemy: (enemy2, destination) => { enemy2.location = destination },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    driveInsane: seat => {
      const inv = state.investigators[seat]
      inv.drivenInsane = true
      inv.defeated = true
      state.campaign.investigators[seat].status = 'insane'
    },
    trauma: (seat, kind, amount) => {
      const record = state.campaign.investigators?.[seat]
      if (record) record.trauma[kind] += amount
    },
    defeat: (inv, cause) => { inv.defeated = true; log.push(`defeat ${inv.seat} ${cause || ''}`.trim()) },
    discardEnemy: enemy2 => {
      const index = state.enemies.indexOf(enemy2)
      if (index >= 0) state.enemies.splice(index, 1)
      state.encounterDiscard.push(enemy2.originalCode || enemy2.code)
    },
    advanceAct: () => { state.scenarioFlags.advanced = true },
    finish: key => { state.scenarioFlags.finishedKey = key },
    drawEncounter: seat => {
      const code = state.encounterDeck.pop()
      if (code) state.encounterDiscard.push(code)
      return code
    },
    spawn: (code, locationId) => {
      const spawned = { id: `enemy-${state.enemies.length}`, code, originalCode: code, location: locationId, doom: 0 }
      state.enemies.push(spawned)
      return spawned
    },
    shuffleEncounterDeck: () => {},
  }
  return { ...zoneApi(state), ...api }
}

const gridPos = (state, id) => positionOf(state, id)
const cellOf = (state, x, y) => cellAt(state, x, y)
const locationAt = (state, x, y) => {
  const cell = cellOf(state, x, y)
  return cell?.kind === 'location' ? loc(state, cell.id) : null
}

function addCultist(state, { doom = 2 } = {}) {
  const cultist = {
    id: `cultist-${state.enemies.length}`, code: '11723', originalCode: '11723', name: '朝圣侍僧',
    location: COSMIC_INGRESS, doom, damage: 0, horror: 0, health: 4,
  }
  state.enemies.push(cultist)
  return cultist
}

// ---------------------------------------------------------------------------
// 范围 / 接线 / 交互（单元）
// ---------------------------------------------------------------------------

test('05-a-8 范围与接线：pack=bbt 恰好 34 张，每张都有实现文件并可注册', () => {
  const codes = Object.keys(ALL_CARDS).filter(code => ALL_CARDS[code].pack === 'bbt').sort()
  assert.deepEqual(codes, [...BBT_CODES].sort(), 'pack=bbt 卡号集合必须等于 05313–05346')
  assert.equal(codes.length, 34)
  for (const code of BBT_CODES) {
    const card = ALL_CARDS[code]
    if (card.type === 'scenario') {
      assert.equal(bbt.scenario.originalCode, code, '参考卡由关卡定义实现（05325 = 本关参考卡）')
      continue
    }
    const player = ['asset', 'event', 'skill'].includes(card.type)
    const file = player
      ? path.join(ROOT, 'src/cards/entries', `${code}.js`)
      : path.join(ROOT, 'src/cards/encounter-entries/theCircleUndone/beforeTheBlackThrone', `${code}.js`)
    assert.equal(existsSync(file), true, `${code} 缺少实现文件 ${file}`)
    if (!player) assert.ok(registeredEntry(code), `${code} 必须在非玩家条目注册表里`)
  }
})

test('05-a-8 场景接线：Before the Black Throne 已注册、playable、指南存在、怪物/地点/结局卡入清单', () => {
  assert.equal(bbt.manifest.status, 'playable')
  assert.equal(bbt.manifest.campaignId, 'theCircleUndone')
  assert.equal(bbt.scenario.originalCode, '05325')
  assert.ok(chapters.some(chapter => chapter.id === 'beforeTheBlackThrone'))
  assert.equal(existsSync(path.join(ROOT, 'web/scenario-guides/beforeTheBlackThrone.json')), true, '冒险指南已生成')
  assert.equal(bbt.manifest.locations.length, 16)
  assert.deepEqual(bbt.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6'])
  assert.equal(bbt.manifest.zones.encounterDeck.some(entry => entry.cardCode === AZATHOTH), false,
    '阿撒托斯不进遭遇牌库')
  assert.deepEqual(bbt.manifest.zones.inPlay, [{ cardCode: AZATHOTH, count: 1 }])
  assert.deepEqual(bbt.manifest.requiredMechanicIds, ['tcuCosmos', 'tcuChaos', 'tcuHaunted'])
})

test('05-a-8 合规：条目合规账本不含任何 bbt 卡号（R1/R2/R3 基线外 0 条）', () => {
  const report = JSON.parse(readFileSync(path.join(ROOT, 'audit/card-entry-compliance.json'), 'utf8'))
  assert.equal(report.counts.reprintDuplicate, 0, 'R2 重印双实现必须为 0')
  assert.equal(report.counts.playConditionGap, 0, 'R3 回合限制缺失必须为 0')
  for (const rule of ['directStateWrite', 'reprintDuplicate', 'playConditionGap']) {
    const overlap = (report.baseline?.[rule] || []).filter(code => BBT_CODES.includes(code))
    assert.deepEqual(overlap, [], `bbt 卡号不得出现在 ${rule} 阻断项基线`)
  }
})

// ---------------------------------------------------------------------------
// 05313–05324 玩家卡：真实引擎逐卡行为
// ---------------------------------------------------------------------------

test(`TCU 05313 ${nameOf('05313')} 入场检索 3 张舒缓旋律（1 入手/2 洗回牌库），离场全部收回场外集合`, () => {
  const state = fixture('01001')
  me(state).hand = ['05313']
  me(state).deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05313' })
  settle(state)
  assert.equal(me(state).hand.filter(code => code === '05314').length, 1, '1 张加入手牌')
  assert.equal(me(state).deck.filter(code => code === '05314').length, 2, '其余 2 张洗回牌库')
  const mirror = me(state).assets.find(item => item.code === '05313')
  run(state, current => returnAssetToHand(current, 0, { assetId: mirror.id }, []))
  assert.equal(state.bondedSets['05313'].cards.filter(code => code === '05314').length, 3, '离场把 3 张全部收回')
  assert.equal(me(state).hand.filter(code => code === '05314').length, 0)
})

test(`TCU 05314 ${nameOf('05314')} 两点治疗可分配给伤害、恐惧或盟友支援并抽 1 张`, () => {
  const state = fixture('01001')
  me(state).hand = ['05314']
  me(state).damage = 2
  me(state).deck = ['01088', '01088', '01088']
  move(state, { action: 'play', cardId: '05314' })
  settle(state, pending => {
    if (pending.kind !== 'heal') return null
    const option = pending.options.find(item => String(item.id).startsWith('dmg:'))
    return option?.id ?? 'done'
  })
  assert.equal(me(state).damage, 0, '2 点治疗都用于治愈伤害')
  assert.ok(me(state).hand.includes('01088'), '结算后抽 1 张')
})

test(`TCU 05315 ${nameOf('05315')} 取消最多 2 点伤害并换成同等资源`, () => {
  const state = fixture('01001')
  me(state).hand = ['05315']
  me(state).resources = 5
  me(state).damage = 2
  run(state, current => applyHarm(current, current.investigators[0], 2, 0, [], false), pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05315')
      if (option) return option.id
    }
    if (pending.kind === 'harm') return '2:0'
    return null
  })
  assert.equal(me(state).damage, 2, '2 点伤害被取消，只剩原有 2 点')
  assert.equal(me(state).resources, 7, '取消 2 点获得 2 资源')
  assert.ok(me(state).discard.includes('05315'), '快速事件结算后进弃牌堆')
})

test(`TCU 05316 ${nameOf('05316')} 入场检索 3 张鲜血仪式（1 入手/2 洗回牌库）`, () => {
  const state = fixture('01001')
  me(state).hand = ['05316']
  me(state).deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05316' })
  settle(state)
  assert.equal(me(state).hand.filter(code => code === '05317').length, 1)
  assert.equal(state.bondedSets['05316'].cards.filter(code => code === '05317').length, 0)
  assert.equal(me(state).deck.filter(code => code === '05317').length, 2)
})

test(`TCU 05317 ${nameOf('05317')} 抽 2 张、弃 1 张换资源且不引发借机攻击`, () => {
  const state = fixture('01001')
  me(state).hand = ['05317', '01088', '01089']
  me(state).deck = Array(20).fill('01088')
  me(state).resources = 30
  move(state, { action: 'play', cardId: '05317' })
  let asked = 0
  settle(state, pending => {
    if (pending.kind === 'discard') { asked++; return asked === 1 ? '0' : 'done' }
    if (pending.kind === 'effect') return 'resource'
    return null
  })
  assert.equal(me(state).resources, 31, '弃 1 张换 1 资源')
  assert.ok(me(state).discard.includes('01088'))
  assert.equal(registeredEntry('05317').abilities[0].noOpportunityAttack, true,
    '卡面「不会引发借机攻击」落在 played 描述子上')
})

test(`TCU 05318 ${nameOf('05318')} 非弱点手牌洗回牌库、补抽到手牌上限并移出游戏`, () => {
  const state = fixture('01001')
  me(state).hand = ['05318', '01088', '01089']
  me(state).deck = Array(10).fill('01090')
  move(state, { action: 'play', cardId: '05318' })
  let asked = 0
  settle(state, pending => {
    if (pending.kind === 'card') { asked++; return asked === 1 ? (pending.options[1]?.id ?? 'done') : 'done' }
    return null
  })
  assert.ok((state.exiled || []).includes('05318'), '自身从游戏中移除')
  assert.equal(me(state).hand.length, getHandSize(state, me(state)), '补抽到手牌上限')
})

test(`TCU 05319 ${nameOf('05319')} 打出另一位调查员手牌并双方各抽 1`, () => {
  const state = fixture('01001', 2)
  me(state).hand = ['05319']
  me(state).deck = Array(10).fill('01090')
  state.investigators[1].hand = ['01088']
  state.investigators[1].deck = Array(10).fill('01089')
  move(state, { action: 'play', cardId: '05319' })
  settle(state, pending => {
    if (pending.kind === 'card') return pending.options.find(option => option.cardCode === '01088')?.id ?? 'done'
    return null
  })
  assert.ok(!state.investigators[1].hand.includes('01088'), '对方手牌被拿走')
  assert.equal(me(state).resources, 33, '打出了对方的「应急物品」，获得 3 资源（由打出者支付/结算）')
  assert.equal(me(state).hand.length, 1, '打出者抽 1')
  assert.equal(state.investigators[1].hand.length, 1, '对方抽 1')
  assert.ok(!state.log.some(line => String(line).includes('打出了') && String(line).includes('01088')),
    '公开日志不泄露对方手牌卡号（走 privateInfo）')
})

test(`TCU 05320 ${nameOf('05320')} 打出一张事件后横置自身再次打出该事件`, () => {
  const state = fixture('01001')
  const double = asset(state, '05320')
  me(state).hand = ['01088']
  me(state).resources = 30
  move(state, { action: 'play', cardId: '01088' })
  settle(state, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05320')?.id ?? 'skip'
  })
  const current = me(state).assets.find(item => item.id === double.id)
  assert.equal(current.exhausted, true, '超级加倍被横置')
  assert.equal(me(state).resources, 36, '应急物品结算两次：+6 资源')
  assert.equal(me(state).discard.filter(code => code === '01088').length, 1, '重放后事件仍正常进弃牌堆')
  assert.equal(ALL_CARDS['05320'].exceptional, true, '卓越（Exceptional）落在卡面数据')
})

test(`TCU 05321 ${nameOf('05321')} 用意志代替战斗攻击，符号后敌人本回合 -1 攻/-1 血/-1 躲`, () => {
  const state = fixture('01001')
  const wither = asset(state, '05321')
  me(state).willpower = 8
  state.chaosBag = ['skull']
  const target = enemy(state, { id: 'wither-symbol', fight: 2, evade: 2, health: 4, damageTaken: 0 })
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state)
  assert.equal(state.lastTestResult.skill, 'willpower', '本次攻击使用意志')
  const after = state.enemies.find(item => item.id === 'wither-symbol')
  assert.ok(after, '4 点生命的敌人仍存活（符号 -1 血后吃 1 点伤害）')
  assert.equal(enemyFightValue(state, after, me(state)), 1, '攻击值 -1')
  assert.equal(enemyEvadeValue(state, after, me(state)), 1, '躲避值 -1')
  assert.equal(enemyHealth(state, after), 3, '生命值 -1')
})

test(`TCU 05322 ${nameOf('05322')} 符号后同时在 2 次连接内的已揭示地点调查（可选新隐藏值）`, () => {
  const state = fixture('01001')
  const here = state.locations.find(location => location.id === me(state).location)
  here.shroud = 2
  here.clues = 2
  here.connections = ['hall', 'cellar']
  state.locations.push(
    { ...structuredClone(here), id: 'hall', name: '走廊', connections: [here.id, 'attic'], revealed: true, clues: 3, shroud: 4 },
    { ...structuredClone(here), id: 'attic', name: '阁楼', connections: ['hall', 'roof'], revealed: true, clues: 3, shroud: 5 },
    { ...structuredClone(here), id: 'roof', name: '屋顶', connections: ['attic'], revealed: true, clues: 3, shroud: 7 },
    { ...structuredClone(here), id: 'cellar', name: '地下室', connections: [here.id], revealed: false, clues: 3, shroud: 6 },
  )
  const sixth = asset(state, '05322')
  me(state).willpower = 8
  state.chaosBag = ['skull']
  move(state, { action: 'ability', assetId: sixth.id, abilityIndex: 0 })
  let locationOptions = []
  settle(state, pending => {
    if (pending.kind === 'reaction') return pending.options.find(option => option.cardCode === '05322')?.id ?? 'skip'
    if (pending.kind === 'location') { locationOptions = pending.options.map(option => option.id); return 'attic' }
    if (pending.kind === 'effect') return 'new'
    return null
  })
  assert.deepEqual(locationOptions.slice().sort(), ['attic', 'hall'],
    '只能选 2 次连接内的已揭示地点（走廊/阁楼）；未揭示地下室与 3 连的屋顶不可选')
  assert.equal(state.lastTestResult.difficulty, 5, '使用所选「阁楼」的隐藏值 5')
  assert.equal(state.locations.find(location => location.id === 'study').clues, 1, '原调查地点发现 1 条线索')
  assert.equal(state.locations.find(location => location.id === 'attic').clues, 2, '所选地点也发现 1 条线索')
  assert.equal(state.locations.find(location => location.id === 'hall').clues, 3, '范围内其他地点不受影响')
})

test(`TCU 05323 ${nameOf('05323')} 附属到地点：敌人阶段朝附属地点移动、轮末恰好弃 1 张`, () => {
  const state = fixture('01001')
  state.locations.push(
    { id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true, shroud: 2 },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true, shroud: 2 },
  )
  state.locations[0].connections = ['hallway']
  enemy(state, { id: 'lure-hunter', location: 'attic', engagedSeat: null, hunter: true, fight: 1, evade: 1, health: 4 })
  me(state).hand = ['05323']
  move(state, { action: 'play', cardId: '05323' })
  settle(state, pending => pending.kind === 'target' ? 'hallway' : null)
  const attached = (state.playerLocationAttachments || []).find(item => item.code === '05323')
  assert.ok(attached, '走真实地点附属（playerLocationAttachments）')
  assert.equal(attached.location, 'hallway')
  assert.ok(!me(state).discard.includes('05323'), '打出后不立即进弃牌堆（keepOnPlay）')
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === 'lure-hunter').location, 'hallway', '猎手朝诱饵最短路径移动')
  assert.ok(!(state.playerLocationAttachments || []).some(item => item.code === '05323'), '轮末移除真实附属')
  assert.equal(me(state).discard.filter(code => code === '05323').length, 1, '轮末恰好弃 1 张')
})

test(`TCU 05324 ${nameOf('05324')} 负修正标记将要令技能值降到 0 时取消并改为旧印`, () => {
  const state = fixture('01001')
  me(state).hand = ['05324']
  me(state).resources = 10
  state.chaosBag = ['-4']
  let result = null
  run(state, current => {
    performTest(current, 0, 'willpower', 3, { resolve: value => { result = value } })
  }, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05324')?.id ?? null
  })
  assert.ok(result?.cancelledTokens?.includes('-4'), '取消了原来的 -4 标记')
  assert.ok(result?.drawn?.includes('eldersign'), '替换为旧印并结算')
  assert.equal(result?.success, true, '结算旧印后检定成功')
  assert.equal(me(state).resources, 8, '打出费用 2')
  assert.ok(me(state).discard.includes('05324'))
})

// ---------------------------------------------------------------------------
// 05325 参考卡
// ---------------------------------------------------------------------------

function driveHub(state, guardMax = 200) {
  const apply = (current, seat, command) => {
    try { applyMove(current, seat, command); return true } catch { return false }
  }
  const lead = () => state.campaign?.leadSeat ?? 0
  const seatFor = action => ['hubBeginScenario', 'hubContinue', 'hubSetLeader', 'hubSelectScenario', 'hubSetDifficulty', 'hubGoSetup'].includes(action)
    ? lead() : (state.currentSeat ?? 0)
  const priority = ['hubBeginScenario', 'hubContinue', 'hubDoneSeat', 'hubConfirmDeck', 'hubAutoDeck', 'hubConfirmUpgrades',
    'hubAutoUpgrade', 'hubGoSetup', 'hubSelectInvestigator', 'hubSelectScenario', 'hubSetDifficulty', 'hubSetLeader']
  for (let guard = 0; guard < guardMax; guard++) {
    if (state.uiState === 'inScenario' && state.scenario?.id) return true
    if (state.status !== 'playing') return false
    settle(state)
    const moves = legalMoves(state).map(entry => entry.move ?? entry)
    if (!moves.length) return false
    let applied = false
    for (const action of priority) {
      const candidate = moves.find(entry => entry.action === action)
      if (!candidate) continue
      for (const seat of [...new Set([seatFor(action), 0, state.currentSeat ?? 0])]) {
        if (apply(state, seat, candidate)) { applied = true; break }
      }
      if (applied) break
    }
    if (!applied) return false
  }
  return false
}

function startScenarioAt(state, scenarioId) {
  const index = chapters.findIndex(chapter => chapter.id === scenarioId)
  assert.ok(index >= 0, `未知章节 ${scenarioId}`)
  state.campaign.scenarioIndex = index
  state.campaign.flow.nodeId = scenarioId
  state.campaign.flow.visits = { ...(state.campaign.flow.visits || {}), [scenarioId]: 1 }
  settle(state)
  state.continuation = null
  resolveTransaction(state, 0, { action: 'acceptance-05-a-8-start' }, current => startScenario(current, index, []))
  settle(state)
  assert.equal(state.scenario?.id, scenarioId)
  return state
}

test(`TCU 05325 ${nameOf('05325')} 参考卡：混乱标记表、阿撒托斯毁灭/参考资源进入真实 viewState`, () => {
  // 混乱标记表（chaos.js 纯函数；读点 behavior.resolveChaosToken / afterTest）
  const calm = { scenarioFlags: { azathothDoom: 5 }, difficulty: 'standard' }
  assert.equal(skullX(calm), 3, '普通：skull X = ceil(5/2) = 3')
  assert.equal(bbtChaosToken(calm, me(stateFor(1)), 'skull').delta, -3)
  assert.equal(bbtChaosToken(calm, me(stateFor(1)), 'tablet').delta, -2)
  assert.equal(bbtChaosToken(calm, me(stateFor(1)), 'elderthing').delta, -4)
  const cultist = bbtChaosToken(calm, me(stateFor(1)), 'cultist')
  assert.equal(cultist.drawAnother, true, 'cultist：再揭示 1 个标记')
  assert.equal(calm.scenarioFlags.azathothDoom, 5, '纯函数不改状态')
  const hard = { scenarioFlags: { azathothDoom: 5 }, difficulty: 'hard' }
  assert.equal(skullX(hard), 5, '困难：skull X = max(2, 毁灭)')
  assert.equal(bbtChaosToken(hard, me(stateFor(1)), 'tablet').delta, -3)

  // 真实引擎：进入黑色王座后 viewState 可观察计时器与参考资源（05325 的公开信息）。
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: true, seed: 'acceptance-05-a-8' },
    [{ seat: 0, role: 'human' }],
  )
  assert.equal(driveHub(state), true, '真实大厅流程可进入战役首关')
  startScenarioAt(state, 'beforeTheBlackThrone')
  state.scenarioFlags.azathothDoom = 7
  state.scenarioFlags.referenceResources = 3
  const view = viewState(state, 0)
  assert.deepEqual(view.beforeTheBlackThrone, { azathothDoom: 7, referenceResources: 3, devoured: false },
    '阿撒托斯毁灭/冒险参考卡资源进入公开投影')
})

// ---------------------------------------------------------------------------
// 05326–05328 议程
// ---------------------------------------------------------------------------

test(`TCU 05326 ${nameOf('05326')} 命运之轮·X：推进时弃异教徒移毁灭、抽魔鬼的笛声、保留敌人毁灭`, () => {
  const state = stateFor(2)
  setup(state)
  addCultist(state, { doom: 2 })
  state.encounterDeck = [DAEMONIC_PIPING]
  const api = apiFor(state)
  bbt.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.enemies.filter(item => item.traits?.includes('Cultist')).length, 0, '弃掉全部异教徒敌人')
  assert.ok(state.scenarioFlags.azathothDoom >= 2, '异教徒身上的毁灭移到阿撒托斯')
  assert.ok(state.encounterDiscard.includes(DAEMONIC_PIPING) || state.encounterDeck.includes(DAEMONIC_PIPING),
    '抽取（或查找）魔鬼的笛声')
  assert.equal(registeredEntry('05326').doomKeptOnAgendaAdvance, 'enemies', '推进时不移除敌人毁灭的引擎读点声明')
  assert.equal(actRuleFor('05326'), null)
  assert.equal(agendaRuleFor('05326').advance.moveLeft, true)
})

test(`TCU 05327 ${nameOf('05327')} 它在等待：意志(4) 失败受到 1 伤害与 1 恐惧，破旧十字架可跳过`, () => {
  const state = stateFor(2)
  setup(state)
  addCultist(state, { doom: 1 })
  state.encounterDeck = [DAEMONIC_PIPING]
  const api = apiFor(state, { testResult: { success: false, value: 1, difficulty: 4 } })
  bbt.behavior.agendaReveal(state, state.agendas[1], api)
  for (const inv of state.investigators) {
    assert.equal(inv.damage, 1, '失败受到 1 伤害')
    assert.equal(inv.horror, 1, '失败受到 1 恐惧')
  }
  assert.equal(registeredEntry('05327').doomKeptOnAgendaAdvance, 'enemies')
  // 有破旧十字架则跳过推进效果（只保留 ritualSuicide + daemonicPiping）。
  const skipped = stateFor(2, { mementosDiscovered: ['wornCrucifix'] })
  setup(skipped)
  addCultist(skipped, { doom: 1 })
  skipped.encounterDeck = [DAEMONIC_PIPING]
  bbt.behavior.agendaReveal(skipped, skipped.agendas[1], apiFor(skipped, { testResult: { success: false, value: 1, difficulty: 4 } }))
  assert.equal(skipped.investigators[0].damage, 0, '有破旧十字架：跳过检定伤害')
})

test(`TCU 05328 ${nameOf('05328')} 最后的倒计时：玉米壳娃娃移除 1 毁灭，推进后毁灭直落阿撒托斯`, () => {
  const state = stateFor(2, { mementosDiscovered: ['cornHuskDoll'] })
  setup(state)
  state.scenarioFlags.azathothDoom = 3
  bbt.behavior.agendaReveal(state, state.agendas[2], apiFor(state))
  assert.equal(state.scenarioFlags.azathothDoom, 2, '玉米壳娃娃从阿撒托斯移除 1 点毁灭')
  assert.equal(state.scenarioFlags.azathothAbsorbsAllDoom, true, '最后议程推进后毁灭直落阿撒托斯')
  assert.equal(registeredEntry('05328').doomKeptOnAgendaAdvance, 'enemies')
  // 没有议程时，神话阶段的毁灭直接落到阿撒托斯上。
  const noAgenda = stateFor(2)
  setup(noAgenda)
  noAgenda.agendaIndex = noAgenda.agendas.length
  noAgenda.doom = 1
  bbt.behavior.doomPlaced(noAgenda, { target: null, amount: 1, agenda: true }, apiFor(noAgenda))
  assert.equal(noAgenda.doom, 0)
  assert.equal(noAgenda.scenarioFlags.azathothDoom, 1)
})

// ---------------------------------------------------------------------------
// 05329–05331 幕
// ---------------------------------------------------------------------------

test(`TCU 05329 ${nameOf('05329')} 宇宙的呼唤：花线索抽宇宙行动 + 背面重建场景 2（皇廷枢纽）`, () => {
  const state = stateFor(2)
  setup(state)
  const inv = me(state)
  inv.clues = 2
  const actions = bbt.behavior.actions(state, inv)
  assert.ok(actions.some(action => action.rule === 'actCosmosTake'), '幕 1 印着的「花费 X 线索抽宇宙」行动可达')
  assert.equal(actRuleFor('05329').advance.rebuild.scene, 'scene2')
  // 背面重建：宇宙入口移出游戏、皇廷成为新枢纽。
  const api = apiFor(state)
  api.reveal(HIDEOUS_PALACE)
  state.investigators.forEach(target => { target.location = HIDEOUS_PALACE })
  bbt.behavior.actReveal(state, state.acts[0], api)
  assert.equal(loc(state, COSMIC_INGRESS), undefined, '宇宙入口移出游戏')
  assert.equal(bbt.behavior.currentHubId(state), COURT)
  assert.deepEqual(gridPos(state, HIDEOUS_PALACE), { x: 0, y: 0 }, '保留的枢纽移到 (0,0)')
  const placed = COSMOS_LAYOUTS.scene2.shuffledPositions.map(position => locationAt(state, position.x, position.y)).filter(Boolean)
  assert.equal(placed.length, 3, '场景 2 隐藏摆放 3 张')
  assert.equal(placed.filter(location => String(location.originalCode || location.code) === '05334').length, 1,
    '其中一张是皇廷（05334）')
})

test(`TCU 05330 ${nameOf('05330')} 阿撒托斯的领域：背面重建场景 3（黑色王座枢纽）`, () => {
  const state = stateFor(2)
  const { rng } = setup(state)
  const api = apiFor(state, { rng })
  assert.equal(actRuleFor('05330').advance.rebuild.scene, 'scene3')
  // 先结算幕 1 背面进入场景 2，再找到皇廷并揭示。
  api.reveal(HIDEOUS_PALACE)
  state.investigators.forEach(target => { target.location = HIDEOUS_PALACE })
  bbt.behavior.actReveal(state, state.acts[0], api)
  const court = state.locations.find(location => String(location.originalCode || location.code) === '05334')
  assert.ok(court, '场景 2 中有皇廷（05334）')
  api.reveal(court.id)
  state.investigators.forEach(target => { target.location = court.id })
  state.actIndex = 1
  bbt.behavior.actReveal(state, state.acts[1], api)
  assert.equal(loc(state, HIDEOUS_PALACE), undefined, '憎恶宫殿移出游戏')
  assert.equal(bbt.behavior.currentHubId(state), BLACK_THRONE)
  assert.deepEqual(gridPos(state, COURT), { x: 0, y: 0 }, '保留的皇廷移到 (0,0)')
  const placed = COSMOS_LAYOUTS.scene3.shuffledPositions.map(position => locationAt(state, position.x, position.y)).filter(Boolean)
  assert.equal(placed.length, 4, '场景 3 隐藏摆放 4 张')
  assert.equal(placed.filter(location => String(location.originalCode || location.code) === '05335').length, 1,
    '其中一张是黑色王座（05335）')
  const inv = me(state)
  inv.clues = 1
  assert.ok(bbt.behavior.actions(state, inv).some(action => action.rule === 'actCosmosTake'),
    '幕背面重建后，新幕的花线索抽宇宙行动仍可达')
})

test(`TCU 05331 ${nameOf('05331')} 必竟之事：队长在黑色王座且无线索时推进；背面给 R2/R3/R4 选择`, () => {
  const state = stateFor(2)
  setup(state)
  state.actIndex = 2
  placeInState(state, BLACK_THRONE, { revealed: true })
  const inv = me(state)
  inv.location = BLACK_THRONE
  loc(state, BLACK_THRONE).clues = 0
  const api = apiFor(state)
  bbt.behavior.checkObjectives(state, api)
  assert.equal(state.scenarioFlags.advanced, true, '目标满足时推进幕（队长在黑色王座且该地点无线索）')
  assert.equal(actRuleFor('05331').advance.resolutionChoice, true)
  const accepted = stateFor(2, { youHaveAcceptedYourFate: true, mementosDiscovered: ['mesmerizingFlute'] })
  setup(accepted)
  bbt.behavior.actReveal(accepted, accepted.acts[2], apiFor(accepted, { choices: ['r2'] }))
  assert.equal(accepted.scenarioFlags.finishedKey, 'r2', '满足接受命运条件可选 R2')
  const neither = stateFor(2)
  setup(neither)
  bbt.behavior.actReveal(neither, neither.acts[2], apiFor(neither, { choices: ['r4'] }))
  assert.equal(neither.scenarioFlags.finishedKey, 'r4', '两组条件都不满足时给 R4')
})

// ---------------------------------------------------------------------------
// 05332–05340 地点
// ---------------------------------------------------------------------------

function voidLocationActionsFor(state, code, hubId) {
  const voidLocation = placeInState(state, DANCERS_MIST[0])
  bbt.behavior.placeCosmosLocation(state, apiFor(state), DANCERS_MIST[0], { position: { x: 0, y: 1 } })
  placeInState(state, hubId, { revealed: true })
  me(state).location = voidLocation.id
  const actions = bbt.behavior.actions(state, me(state))
  assert.ok(actions.some(action => action.rule === `voidTo:${hubId}`),
    `${code} 所在虚空地点获得「洗回宇宙并搬到枢纽」的行动`)
}

test(`TCU 05332 ${nameOf('05332')} 宇宙入口：回合末补线索到 3，虚空地点获得洗回宇宙行动`, () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, COSMIC_INGRESS, { revealed: true })
  loc(state, COSMIC_INGRESS).clues = 0
  bbt.behavior.roundEnded(state, apiFor(state))
  assert.equal(loc(state, COSMIC_INGRESS).clues, 3, '回合末补线索到 3')
  voidLocationActionsFor(state, '05332', COSMIC_INGRESS)
})

test(`TCU 05333 ${nameOf('05333')} 憎恶宫殿：回合末补线索到 4，虚空地点获得洗回宇宙行动`, () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, HIDEOUS_PALACE, { revealed: true })
  loc(state, HIDEOUS_PALACE).clues = 0
  bbt.behavior.roundEnded(state, apiFor(state))
  assert.equal(loc(state, HIDEOUS_PALACE).clues, 4, '回合末补线索到 4')
  voidLocationActionsFor(state, '05333', HIDEOUS_PALACE)
})

test(`TCU 05334 ${nameOf('05334')} 旧日支配者皇廷：回合末补线索到 6，虚空地点获得洗回宇宙行动`, () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, COURT, { revealed: true })
  loc(state, COURT).clues = 0
  bbt.behavior.roundEnded(state, apiFor(state))
  assert.equal(loc(state, COURT).clues, 6, '回合末补线索到 6')
  voidLocationActionsFor(state, '05334', COURT)
})

test(`TCU 05335 ${nameOf('05335')} 黑色王座：隐藏值 +ceil(毁灭/2)，闹鬼可选放毁灭或被攻击`, () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, BLACK_THRONE, { revealed: true })
  state.scenarioFlags.azathothDoom = 5
  assert.equal(bbt.behavior.locationShroudModifier(state, loc(state, BLACK_THRONE)), 3, '隐藏值加成 ceil(5/2)=3')
  bbt.behavior.hauntedScript(state, { scriptId: 'blackThroneHaunt', seat: 0, investigator: state.investigators[0] },
    apiFor(state, { choices: ['attack'] }))
  assert.equal(state.investigators[0].damage, 3, '选择被攻击：3 伤害')
  assert.equal(state.investigators[0].horror, 3, '选择被攻击：3 恐惧')
  bbt.behavior.hauntedScript(state, { scriptId: 'blackThroneHaunt', seat: 1, investigator: state.investigators[1] },
    apiFor(state, { choices: ['doom'] }))
  assert.equal(state.scenarioFlags.azathothDoom, 6, '选择放毁灭：阿撒托斯 +1')
})

test(`TCU 05336 ${nameOf('05336')} 舞者之雾：宇宙-右方连接/花 2 资源改向；进入时可花参考资源再移动`, () => {
  const state = stateFor(2)
  setup(state)
  const definition = bbt.scenario.locations[DANCERS_MIST[0]]
  assert.deepEqual(definition.cosmos, { direction: 'right', mode: 'self', cost: { resources: 2 } },
    '宇宙-：必须向右连接，或失去 2 资源改向')
  placeInState(state, DANCERS_MIST[0], { revealed: true })
  bbt.behavior.placeCosmosLocation(state, apiFor(state), DANCERS_MIST[0], { position: { x: 0, y: 1 } })
  const inv = me(state)
  inv.location = DANCERS_MIST[0]
  inv.resources = 5
  state.scenarioFlags.referenceResources = 1
  const rule = locationRuleFor('05336')
  assert.ok(rule?.onEnter?.effect, '进入效果落在条目 locationRule.onEnter（引擎直读）')
  const here = loc(state, DANCERS_MIST[0])
  const neighbours = (here.connections || []).filter(id => loc(state, id))
  assert.ok(neighbours.length > 0, '舞者之雾与相邻地点连接')
  rule.onEnter.effect(state, here, apiFor(state, { choices: [neighbours[0]] }), inv)
  assert.equal(state.scenarioFlags.referenceResources, 0, '移除冒险参考卡 1 资源')
  assert.equal(inv.location, neighbours[0], '移动到所选的连接地点')
  // 资源不足时不能触发移动。
  const second = state.investigators[1]
  second.location = DANCERS_MIST[0]
  state.scenarioFlags.referenceResources = 0
  rule.onEnter.effect(state, here, apiFor(state), second)
  assert.equal(second.location, DANCERS_MIST[0], '参考卡资源不足时不移动')
})

test(`TCU 05337 ${nameOf('05337')} 飞入湮灭：宇宙-上方连接/吃 2 恐惧改向；[action] 上移一格（每场一次）`, () => {
  const state = stateFor(2)
  setup(state)
  assert.deepEqual(bbt.scenario.locations[FLIGHT[0]].cosmos, { direction: 'up', mode: 'self', cost: { horror: 2 } })
  placeInState(state, FLIGHT[0], { revealed: true })
  bbt.behavior.placeCosmosLocation(state, apiFor(state), FLIGHT[0], { position: { x: 1, y: 0 } })
  const inv = me(state)
  inv.location = FLIGHT[0]
  state.scenarioFlags.referenceResources = 1
  const actions = bbt.behavior.actions(state, inv)
  const action = actions.find(item => item.rule === 'moveLocationUp')
  assert.ok(action, '飞入湮灭获得「上移一格」行动')
  bbt.behavior.performAction(state, inv, action, apiFor(state))
  assert.equal(state.scenarioFlags.referenceResources, 0, '消耗 1 点参考资源')
  assert.deepEqual(gridPos(state, FLIGHT[0]), { x: 1, y: 1 }, '地点向上移动一格')
  assert.equal(state.scenarioFlags.teamUsed[`up:${FLIGHT[0]}`], true, '团队每场一次已记账')
  assert.equal(bbt.behavior.actions(state, inv).some(item => item.rule === 'moveLocationUp'), false, '用过后不再出现')
})

test(`TCU 05338 ${nameOf('05338')} 无尽黑暗：宇宙-下方连接/吃 2 伤害改向；[action] 下移一格（每场一次）`, () => {
  const state = stateFor(2)
  setup(state)
  assert.deepEqual(bbt.scenario.locations[INFINITY[0]].cosmos, { direction: 'down', mode: 'self', cost: { damage: 2 } })
  placeInState(state, INFINITY[0], { revealed: true })
  bbt.behavior.placeCosmosLocation(state, apiFor(state), INFINITY[0], { position: { x: 1, y: 0 } })
  const inv = me(state)
  inv.location = INFINITY[0]
  state.scenarioFlags.referenceResources = 1
  const action = bbt.behavior.actions(state, inv).find(item => item.rule === 'moveLocationDown')
  assert.ok(action, '无尽黑暗获得「下移一格」行动')
  bbt.behavior.performAction(state, inv, action, apiFor(state))
  assert.equal(state.scenarioFlags.referenceResources, 0)
  assert.deepEqual(gridPos(state, INFINITY[0]), { x: 1, y: -1 }, '地点向下移动一格')
})

test(`TCU 05339 ${nameOf('05339')} 宇宙门扉：进入时花 1 线索或受 1 恐惧；行动可转移任意调查员到虚空地点`, () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, COSMIC_GATE, { revealed: true })
  const inv = me(state)
  inv.location = COSMIC_GATE
  inv.clues = 1
  const rule = locationRuleFor('05339')
  assert.ok(rule?.onEnter?.effect, '进入效果落在 locationRule.onEnter')
  rule.onEnter.effect(state, loc(state, COSMIC_GATE), apiFor(state, { choices: ['clue'] }), inv)
  assert.equal(inv.clues, 0, '选择花 1 线索')
  const second = state.investigators[1]
  second.location = COSMIC_GATE
  rule.onEnter.effect(state, loc(state, COSMIC_GATE), apiFor(state, { choices: ['horror'] }), second)
  assert.equal(second.horror, 1, '选择受 1 恐惧')
  // [action]：花参考资源把宇宙门扉处的调查员移到其他虚空地点。
  placeInState(state, DANCERS_MIST[0], { revealed: true })
  bbt.behavior.placeCosmosLocation(state, apiFor(state), DANCERS_MIST[0], { position: { x: 0, y: 1 } })
  state.scenarioFlags.referenceResources = 1
  inv.location = COSMIC_GATE
  const action = bbt.behavior.actions(state, inv).find(item => item.rule === 'gateMove')
  assert.ok(action, '宇宙门扉获得「移动任意数量调查员」行动')
  bbt.behavior.performAction(state, inv, action, apiFor(state, { choices: ['0', DANCERS_MIST[0], 'done'] }))
  assert.equal(inv.location, DANCERS_MIST[0], '调查员被移到所选虚空地点')
  assert.equal(state.scenarioFlags.referenceResources, 0, '消耗 1 点参考资源')
})

test(`TCU 05340 ${nameOf('05340')} 虚空之路：进入时弃 1 手牌或受 1 伤害；[action] 移到相邻位置（每轮一次）`, () => {
  const state = stateFor(2)
  setup(state)
  placeInState(state, PATHWAY[0], { revealed: true })
  bbt.behavior.placeCosmosLocation(state, apiFor(state), PATHWAY[0], { position: { x: 2, y: 0 } })
  const inv = me(state)
  inv.location = PATHWAY[0]
  inv.hand = ['01088']
  const rule = locationRuleFor('05340')
  assert.ok(rule?.onEnter?.effect, '进入效果落在 locationRule.onEnter')
  rule.onEnter.effect(state, loc(state, PATHWAY[0]), apiFor(state, { choices: ['damage'] }), inv)
  assert.equal(inv.damage, 1, '选择受 1 伤害')
  state.scenarioFlags.referenceResources = 1
  const action = bbt.behavior.actions(state, inv).find(item => item.rule === 'moveLocationAdjacent')
  assert.ok(action, '虚空之路获得「移动到相邻位置」行动')
  bbt.behavior.performAction(state, inv, action, apiFor(state, { choices: ['left'] }))
  assert.equal(state.scenarioFlags.referenceResources, 0)
  assert.deepEqual(gridPos(state, PATHWAY[0]), { x: 1, y: 0 }, '地点移向任意相邻位置')
  assert.equal(state.scenarioFlags.roundAdjacentUsed[PATHWAY[0]], state.round, '每轮一次已记账')
  assert.equal(bbt.behavior.actions(state, inv).some(item => item.rule === 'moveLocationAdjacent'), false,
    '本轮用过后不再出现')
})

// ---------------------------------------------------------------------------
// 05341–05346 敌人 / 诡计
// ---------------------------------------------------------------------------

test(`TCU 05341 ${nameOf('05341')} 盲目舞者：生成在最远虚空格、穿越虚空格再次猎手（每轮一次）`, () => {
  const state = stateFor(2)
  setup(state)
  const dancer = {
    id: 'dancer-1', code: '05341', originalCode: '05341', name: '盲目舞者',
    location: COSMIC_INGRESS, hunter: true, exhausted: false, damage: 0, horror: 0, health: 5,
  }
  state.enemies.push(dancer)
  bbt.behavior.enemySpawned(state, dancer, apiFor(state))
  assert.ok(dancer.cosmosCell && Number.isFinite(dancer.cosmosCell.x), '生成时记录「最远虚空格」位置')
  assert.match(String(dancer.location), /^cosmosVoid:/, '舞者用虚空格位置承载「进入虚空格」')
  assert.equal(bbt.behavior.canFightEnemy(state, me(state), dancer), false, '虚空格中的舞者不能被攻击')
  assert.equal(bbt.behavior.canEvadeEnemy(state, me(state), dancer), false, '虚空格中的舞者不能被躲避')
  assert.equal(bbt.behavior.enemyCannotBeAttacked(state, dancer), true, '虚空格中的舞者不可被攻击')
  const moved = bbt.behavior.hunterMove(state, dancer, apiFor(state))
  assert.equal(moved, true, '虚空格中的猎手移动由本章行为接管')
  assert.equal(registeredEntry('05341').movesThroughVoid, true, '「可以进入虚空格」声明')
})

test(`TCU 05342 ${nameOf('05342')} 究极混沌：意志(4) 失败附属计时，3 张时放毁灭或按玩家顺序攻击；不能取消`, () => {
  const state = stateFor(2)
  setup(state)
  const inv = me(state)
  bbt.behavior.resolveEncounter(state, inv, { code: '05342', originalCode: '05342' },
    apiFor(state, { testResult: { success: false, value: 1, difficulty: 4 } }))
  assert.equal(state.scenarioFlags.ultimateChaos, 1, '失败附属 1 张（计时 1/3）')
  assert.equal(inv.damage, 1, '失败差值 ≥3：受到 1 伤害')
  assert.equal(inv.horror, 1, '失败差值 ≥3：受到 1 恐惧')
  state.scenarioFlags.ultimateChaos = 2
  bbt.behavior.resolveEncounter(state, inv, { code: '05342', originalCode: '05342' },
    apiFor(state, { testResult: { success: false, value: 1, difficulty: 4 }, choices: ['attack'] }))
  assert.equal(state.scenarioFlags.ultimateChaos, 0, '3 张后清空计时')
  assert.equal(state.investigators[0].damage, 5, '第二张失败再吃 1 伤害 + 阿撒托斯按玩家顺序攻击 3 伤害')
  assert.equal(state.investigators[1].damage, 3, '第二位调查员也被攻击（玩家顺序）')
  // 「不能被取消」通过剧本定义里的 cannotBeCanceledRevelation 接线（引擎 encounter.js 读点）。
  assert.equal(bbt.scenario.treacheries?.['05342']?.cannotBeCanceledRevelation, true,
    '05342 的「不能被取消」在关卡定义中声明（引擎读点 state.scenario.treacheries）')
  // 引擎读点存在：取消窗口会读取同一份声明。
  const encounterSource = readFileSync(path.join(ROOT, 'src/engine/encounter.js'), 'utf8')
  assert.match(encounterSource, /state\.scenario\?\.treacheries\?\.\[code\]\?\.cannotBeCanceledRevelation/,
    'encounter.js 读取 state.scenario.treacheries[code].cannotBeCanceledRevelation')
})

test(`TCU 05343 ${nameOf('05343')} 耳语契约：显现时在阿撒托斯放 1 毁灭或阿撒托斯攻击你`, () => {
  const state = stateFor(2)
  setup(state)
  const inv = me(state)
  bbt.behavior.resolveEncounter(state, inv, { code: '05343', originalCode: '05343' },
    apiFor(state, { choices: ['doom'] }))
  assert.equal(state.scenarioFlags.azathothDoom, 1, '选择放在阿撒托斯上 1 毁灭')
  bbt.behavior.resolveEncounter(state, inv, { code: '05343', originalCode: '05343' },
    apiFor(state, { choices: ['attack'] }))
  assert.equal(inv.damage, 3, '选择被攻击：3 伤害')
  assert.equal(inv.horror, 3, '选择被攻击：3 恐惧')
  assert.equal(ALL_CARDS['05343'].text.includes('Peril'), true, '险境（Peril）为印刷关键字')
})

test(`TCU 05344 ${nameOf('05344')} 终结将至：难度 1+议程编号，失败把异教徒毁灭移到阿撒托斯`, () => {
  const state = stateFor(2)
  setup(state)
  state.agendaIndex = 1
  bbt.behavior.resolveEncounter(state, me(state), { code: '05344', originalCode: '05344' },
    apiFor(state, { testResult: { success: false, value: 1, difficulty: 2 } }))
  assert.equal(state.scenarioFlags.azathothDoom, 1, '没有异教徒时失败改为在阿撒托斯上放 1 毁灭')
  const cultist = addCultist(state, { doom: 2 })
  state.agendaIndex = 2
  bbt.behavior.resolveEncounter(state, me(state), { code: '05344', originalCode: '05344' },
    apiFor(state, { testResult: { success: false, value: 1, difficulty: 3 } }))
  assert.equal(cultist.doom, 0, '失败把异教徒敌人身上的毁灭移走')
  assert.equal(state.scenarioFlags.azathothDoom, 3, '2 点毁灭移到阿撒托斯')
  // 检定难度 = 1 + 当前议程编号（章节无议程时为 4）：用测试桩记录 difficulty。
  const seen = []
  const probe = apiFor(state)
  const baseTest = probe.test
  probe.test = (seat, skill, difficulty, resolve, ...rest) => { seen.push(difficulty); return baseTest(seat, skill, difficulty, resolve, ...rest) }
  state.agendaIndex = 2
  bbt.behavior.resolveEncounter(state, me(state), { code: '05344', originalCode: '05344' }, probe)
  assert.deepEqual(seen, [4], '议程索引 2（第 3 张议程）时难度 = 1 + (索引 + 1) = 4')
})

test(`TCU 05345 ${nameOf('05345')} 黑暗世界：无毁灭时获得涌动，否则按毁灭逐项选择四种代价`, () => {
  const state = stateFor(2)
  setup(state)
  const inv = me(state)
  bbt.behavior.resolveEncounter(state, inv, { code: '05345', originalCode: '05345' }, apiFor(state))
  assert.equal(state.scenarioFlags.pendingSurge, true, '阿撒托斯无毁灭时获得涌动')
  state.scenarioFlags.pendingSurge = false
  state.scenarioFlags.azathothDoom = 2
  inv.hand = ['01088', '01089']
  inv.resources = 5
  bbt.behavior.resolveEncounter(state, inv, { code: '05345', originalCode: '05345' },
    apiFor(state, { choices: ['resource', 'horror'] }))
  assert.equal(inv.resources, 4, '第 1 点毁灭：失去 1 资源')
  assert.equal(inv.horror, 1, '第 2 点毁灭：受到 1 恐惧')
  assert.equal(bbt.behavior.encounterGainsSurge(state), false, '有毁灭时不再涌动')
})

test(`TCU 05346 ${nameOf('05346')} 阿撒托斯：不生成实体/不可击败、攻击 3/3、≥10 毁灭触发结局 1`, () => {
  const state = stateFor(2)
  setup(state)
  assert.equal(bbt.behavior.spawnLocation(state, AZATHOTH, COSMIC_INGRESS), null, '任何生成路径直接判失败（不建实体）')
  const ghost = { id: 'azathoth-guard', code: AZATHOTH, originalCode: AZATHOTH, location: COSMIC_INGRESS }
  assert.equal(bbt.behavior.enemyCanBeDefeated(state, ghost), false, '不能被击败')
  assert.equal(bbt.behavior.enemyCannotBeAttacked(state, ghost), true, '免疫玩家卡效果/行动（防御性钩子）')
  assert.equal(bbt.behavior.enemyDamageAllowed(state, ghost), false)
  bbt.behavior.azathothAttack(state, apiFor(state), 0)
  assert.equal(state.investigators[0].damage, 3, '阿撒托斯攻击 = 3 伤害')
  assert.equal(state.investigators[0].horror, 3, '阿撒托斯攻击 = 3 恐惧')
  bbt.behavior.addAzathothDoom(state, apiFor(state), 10)
  assert.equal(state.scenarioFlags.finishedKey, 'r1', '≥10 毁灭触发吞食宇宙（→R1）')
  // 05328 背面后「场上所有毁灭视作在阿撒托斯上」。
  const absorb = stateFor(2)
  setup(absorb)
  absorb.scenarioFlags.azathothAbsorbsAllDoom = true
  absorb.scenarioFlags.azathothDoom = 4
  absorb.enemies.push({ id: 'doomed', code: '05341', originalCode: '05341', location: HIDEOUS_PALACE, doom: 3 })
  assert.equal(azathothDoomOf(absorb), 7, '吸收后阿撒托斯毁灭 = 计数 + 场上毁灭')
})
