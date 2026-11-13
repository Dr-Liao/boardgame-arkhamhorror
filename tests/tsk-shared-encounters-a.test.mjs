// 八循环《绯红密钥》P7 共享遭遇组 A（worker A）· 行为测试。
//
// 覆盖 4 个跨章共享组共 35 张卡：
//   red_coterie (10) / globetrotting (12) / crimson_conspiracy (4) / beyond_the_beyond (9)
//
// 证据分两层：
//   1. 条目层：每张行为卡至少一条可执行断言（触发条件 true/false、resolve 的真实写入、
//      关键词/生成规则的数据读点、近似披露与 unknown trigger 登记）；
//   2. 原语层：本循环 P2 的 TSK 容器（同志会池/密钥/空洞/世界地图/状况报告/密档）与
//      JSON 往返（validateTskState），覆盖 setup / 遇牌库 / 结局记录相关读点。
//
// 说明：本文件不 import src/engine/engine.js 组合根：条目行为通过 TSK 原语 + 记录型 ctx.api 执行，
// 能力注册期校验用 ability.js#registerCardAbilities（kind/scope/cost/trigger 的非法形状照常失败），
// 跨条目查询用 _lookup.js（显式 registerNonPlayerEntries）。这样即使并行分片正在重写索引也不受影响。
import test from 'node:test'
import assert from 'node:assert/strict'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry, registerCardAbilities, unknownTriggerWarnings } from '../src/engine/ability.js'
import { registerNonPlayerEntries } from '../src/cards/encounter-entries/_lookup.js'
import {
  bindKey, initializeScarletKeys, keyFace, keyShiftedThisRound, keysHeldBy, scarletKey, scarletKeys, shiftKey,
  stealKey, validateTskKeys,
} from '../src/engine/tsk-scarlet-keys.js'
import {
  eraseFromExistence, erasedFromExistence, hollowCard, hollowCards, hollowCount, isHollowed, recallHollow,
  validateTskErased, validateTskHollows,
} from '../src/engine/tsk-hollow.js'
import {
  concealedAt, concealedMiniCards, distributeConcealed, exposeMiniCard, placeMiniCard, reshuffleConcealed, validateTskConcealed,
} from '../src/engine/tsk-concealed.js'
import {
  dossiers, embarkOptions, forcedDestination, initializeStatusReports, initializeWorldMap, mapTime, queueStatusReports,
  readDossier, resolveStatusReport, statusReportState, travelTo, unlockDossier, unlockMapNode, useExpeditedTicket,
  validateTskDossiers, validateTskMap, validateTskStatusReports, worldMapState,
} from '../src/engine/tsk-map.js'
import {
  coterieSnapshot, defeatedCoterie, initializeCoterie, injectCoterieEnemy, injectedCoterie, moveCoterieMember,
  validateTskCoterie,
} from '../src/engine/tsk-coterie.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { createScenarioDeckApi, scenarioDeckTop, scenarioDeckReturnTop, scenarioDeckTotal } from '../src/engine/scenario-decks.js'

import c09716a from '../src/cards/encounter-entries/theScarletKeys/_shared/crimson_conspiracy/09716a.js'
import c09716b from '../src/cards/encounter-entries/theScarletKeys/_shared/crimson_conspiracy/09716b.js'
import c09716c from '../src/cards/encounter-entries/theScarletKeys/_shared/crimson_conspiracy/09716c.js'
import c09717 from '../src/cards/encounter-entries/theScarletKeys/_shared/crimson_conspiracy/09717.js'
import g09762 from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09762.js'
import g09763 from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09763.js'
import g09764 from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09764.js'
import g09765 from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09765.js'
import g09766 from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09766.js'
import g09767 from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09767.js'
import g09768a from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09768a.js'
import g09768b from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09768b.js'
import g09769a from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09769a.js'
import g09769b from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09769b.js'
import g09770a from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09770a.js'
import g09770b from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09770b.js'
import b09747a from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09747a.js'
import b09747b from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09747b.js'
import b09747c from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09747c.js'
import b09748a from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09748a.js'
import b09748b from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09748b.js'
import b09749a from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09749a.js'
import b09749b from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09749b.js'
import b09750 from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09750.js'
import b09751 from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09751.js'
import r09752 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09752.js'
import r09753 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09753.js'
import r09754 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09754.js'
import r09755 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09755.js'
import r09756 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09756.js'
import r09757 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09757.js'
import r09758 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09758.js'
import r09759 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09759.js'
import r09760 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09760.js'
import r09761 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09761.js'

const ENTRIES = [
  r09752, r09753, r09754, r09755, r09756, r09757, r09758, r09759, r09760, r09761,
  g09762, g09763, g09764, g09765, g09766, g09767,
  g09768a, g09768b, g09769a, g09769b, g09770a, g09770b,
  c09716a, c09716b, c09716c, c09717,
  b09747a, b09747b, b09747c, b09748a, b09748b, b09749a, b09749b, b09750, b09751,
]
const GROUPS = {
  red_coterie: ['09752', '09753', '09754', '09755', '09756', '09757', '09758', '09759', '09760', '09761'],
  globetrotting: ['09762', '09763', '09764', '09765', '09766', '09767', '09768a', '09768b', '09769a', '09769b', '09770a', '09770b'],
  crimson_conspiracy: ['09716a', '09716b', '09716c', '09717'],
  beyond_the_beyond: ['09747a', '09747b', '09747c', '09748a', '09748b', '09749a', '09749b', '09750', '09751'],
}
const ENTRY_BY_CODE = Object.fromEntries(ENTRIES.map(entry => [entry.code, entry]))

registerCardAbilities(ENTRIES)
registerNonPlayerEntries(ENTRIES)

// ---------------------------------------------------------------------------
// 测试夹具：状态 + 记录型 ctx.api（TSK 部分直接落 P2 原语）
// ---------------------------------------------------------------------------
const LOCS = [
  { id: 'locA', name: '甲地', connections: ['locB'], clues: 1, shroud: 2, traits: [], revealed: true },
  { id: 'locB', name: '乙地', connections: ['locA', 'locC'], clues: 1, shroud: 2, traits: [], revealed: true },
  { id: 'locC', name: '丙地', connections: ['locB'], clues: 1, shroud: 2, traits: [], revealed: true },
]

function makeState({ seats = 2, locations = LOCS, enemies = [], grid = null } = {}) {
  const state = {
    round: 2, phase: 'investigation', currentSeat: 0, turnSerial: 1, status: 'playing',
    numInvestigators: seats,
    investigators: Array.from({ length: seats }, (_, seat) => ({
      seat, code: '01001', name: '调查员' + (seat + 1), location: locations[0].id,
      damage: 0, horror: 0, resources: 5, clues: 0, actionsLeft: 3,
      hand: [], deck: [], discard: [], assets: [], threat: [], engaged: [],
    })),
    locations: locations.map(location => ({ ...location, connections: [...(location.connections || [])] })),
    enemies: enemies.map(enemy => ({ ...enemy })),
    scenarioFlags: {}, campaign: { records: {} },
    encounterDeck: [], encounterDiscard: [], victoryDisplay: [], setAside: [], removedFromGame: [],
    scenario: {}, gridPositions: grid || {},
  }
  return state
}

const bfsPaths = (locations, from, to) => {
  if (from === to) return [[from]]
  const byId = new Map(locations.map(location => [location.id, location]))
  const queue = [[from]]
  const seen = new Set([from])
  const paths = []
  while (queue.length) {
    const path = queue.shift()
    const current = path[path.length - 1]
    for (const next of byId.get(current)?.connections || []) {
      if (seen.has(next)) continue
      const extended = [...path, next]
      if (next === to) { paths.push(extended); continue }
      seen.add(next)
      queue.push(extended)
    }
  }
  return paths.sort((left, right) => left.length - right.length)
}

function makeApi(state, { choose = null, testResults = [], log = [] } = {}) {
  const pendingTests = [...testResults]
  const invOf = seat => state.investigators[seat]
  const findCard = spec => {
    if (spec.id) {
      for (const inv of state.investigators) {
        const found = [...inv.assets, ...inv.threat].find(card => card.id === spec.id)
        if (found) return { zone: 'play', inv, card: found }
      }
      return null
    }
    for (const inv of state.investigators) {
      const where = spec.from && spec.from !== 'auto' ? spec.from : 'hand'
      if ((where === 'hand' || where === 'auto') && inv.hand.includes(spec.code)) return { zone: 'hand', inv }
      if ((where === 'deck' || where === 'auto') && inv.deck.includes(spec.code)) return { zone: 'deck', inv }
      if ((where === 'discard' || where === 'auto') && inv.discard.includes(spec.code)) return { zone: 'discard', inv }
    }
    return null
  }
  const api = {
    info: text => { log.push(String(text)) },
    cardName: code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
    choice: spec => {
      if (choose) {
        const answer = choose(spec)
        if (answer != null) return answer
      }
      return spec.options?.[0]?.id
    },
    damage: (seat, amount) => { invOf(seat).damage += amount },
    directDamage: (seat, amount) => { invOf(seat).damage += amount },
    horror: (seat, amount) => { invOf(seat).horror += amount },
    directHorror: (seat, amount) => { invOf(seat).horror += amount },
    loseResources: (seat, amount) => { const inv = invOf(seat); inv.resources = Math.max(0, inv.resources - amount) },
    gainResources: (seat, amount) => { invOf(seat).resources += amount },
    spendResources: (seat, amount) => {
      const inv = invOf(seat)
      if (inv.resources < amount) return false
      inv.resources -= amount
      return true
    },
    loseActions: (seat, amount) => { const inv = invOf(seat); inv.actionsLeft = Math.max(0, inv.actionsLeft - amount) },
    drawCards: (seat, count) => {
      const inv = invOf(seat)
      const drawn = inv.deck.splice(Math.max(0, inv.deck.length - count))
      inv.hand.push(...drawn)
      return drawn
    },
    discardFromHand: (seat, code) => {
      const inv = invOf(seat)
      const index = inv.hand.indexOf(code)
      if (index < 0) return false
      inv.hand.splice(index, 1)
      inv.discard.push(code)
      return true
    },
    putInHand: (seat, code) => { invOf(seat).hand.push(code) },
    shuffleDeck: seat => { state.shuffledSeats = [...(state.shuffledSeats || []), seat] },
    moveCard: spec => {
      const found = findCard(spec)
      if (!found) return null
      if (found.zone === 'hand') found.inv.hand.splice(found.inv.hand.indexOf(found.card?.code || spec.code), 1)
      if (found.zone === 'deck') found.inv.deck.splice(found.inv.deck.lastIndexOf(spec.code), 1)
      if (found.zone === 'discard') found.inv.discard.splice(found.inv.discard.lastIndexOf(spec.code), 1)
      if (found.zone === 'play') {
        const index = found.inv.assets.indexOf(found.card)
        if (index >= 0) found.inv.assets.splice(index, 1)
      }
      const owner = invOf(spec.ownerSeat ?? found.inv.seat)
      if (spec.to === 'setAside') state.setAside.push(spec.code || found.card?.code)
      else if (spec.to === 'removedFromGame') state.removedFromGame.push(spec.code || found.card?.code)
      else if (spec.to === 'deckTop') owner.deck.push(spec.code || found.card?.code)
      else if (spec.to === 'hand') owner.hand.push(spec.code || found.card?.code)
      else if (spec.to === 'discard') owner.discard.push(spec.code || found.card?.code)
      return { to: spec.to }
    },
    addUses: (card, amount) => { card.uses = (card.uses || 0) + amount; return card.uses },
    takeDeckCard: (seat, code) => {
      const inv = invOf(seat)
      const index = inv.deck.lastIndexOf(code)
      if (index < 0) return null
      return inv.deck.splice(index, 1)[0]
    },
    discardAsset: (seat, card) => {
      const inv = invOf(seat)
      const index = inv.assets.indexOf(card)
      if (index < 0) return false
      inv.assets.splice(index, 1)
      inv.discard.push(card.code)
      return true
    },
    damageEnemy: (enemy, amount) => {
      const target = typeof enemy === 'string' ? state.enemies.find(item => item.id === enemy) : enemy
      if (!target) return
      target.damageTaken = (target.damageTaken || 0) + amount
    },
    autoEvadeEnemy: enemy => { if (enemy) enemy.exhausted = true },
    enemyAttackByCard: (enemy, label, seat) => { log.push('attack:' + (enemy?.id || '?') + ':' + label + ':' + seat) },
    discardEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
    },
    moveEnemy: (enemy, locationId) => { if (enemy) enemy.location = locationId },
    placeDoomOnCard: (card, amount) => { if (card) card.doom = (card.doom || 0) + amount },
    buryEnemyInVictory: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      state.victoryDisplay.push(enemy.code)
    },
    spawn: (code, locationId) => {
      const spawned = { id: 'spawn-' + (state.enemies.length + 1), code, name: api.cardName(code), location: locationId, damageTaken: 0 }
      state.enemies.push(spawned)
      return spawned
    },
    engageAtInvestigator: (enemy, seat) => { if (enemy) enemy.engagedSeat = seat },
    shuffleEncounterDeck: () => { state.encounterDeck = [...state.encounterDeck].reverse() },
    takeEncounterCard: (code, options = {}) => {
      const list = options.pile === 'encounterDiscard' ? state.encounterDiscard : state.encounterDeck
      const index = list.indexOf(code)
      if (index < 0) return false
      list.splice(index, 1)
      return code
    },
    setScenarioFlag: (key, value) => { state.scenarioFlags[key] = value },
    scenarioFlag: key => state.scenarioFlags[key],
    test: (seat, skill, difficulty, options = {}) => {
      const result = pendingTests.length
        ? pendingTests.shift()
        : { success: false, value: 0, difficulty, skill, seat }
      options.resolve?.(result)
      return result
    },
    map: { position: id => state.gridPositions[id] || null },
    mechanics: { map: { paths: (from, to) => bfsPaths(state.locations, from, to) } },
  }
  api.tsk = {
    keys: {
      all: () => scarletKeys(state),
      get: id => scarletKeys(state).find(key => key.id === id) || null,
      heldBy: bearer => keysHeldBy(state, bearer),
      shift: (id, options) => shiftKey(state, id, options ?? {}),
      shiftedThisRound: (id, round) => keyShiftedThisRound(state, id, round ?? state.round),
      bind: (id, bearer) => bindKey(state, id, bearer),
      steal: (id, bearer) => stealKey(state, id, bearer),
    },
    hollow: {
      cards: () => hollowCards(state),
      hollow: spec => hollowCard(state, spec),
      isHollowed: code => isHollowed(state, code),
      recall: (code, options) => recallHollow(state, code, options),
      count: options => hollowCount(state, options),
      erase: codes => eraseFromExistence(state, codes),
    },
    concealed: {
      reshuffle: options => reshuffleConcealed(state, options),
      all: () => concealedMiniCards(state),
    },
    map: {
      state: () => worldMapState(state),
      travel: spec => travelTo(state, spec),
      expedite: spec => useExpeditedTicket(state, spec),
    },
  }
  return { api, log }
}

function context(entry, index, extra = {}) {
  const descriptor = entry.abilities[index]
  assert.ok(descriptor, `${entry.code} 缺少 #${index} 能力`)
  const { api, log } = makeApi(extra.state, extra)
  const inv = extra.state.investigators[extra.seat ?? 0]
  const ctx = {
    state: extra.state,
    inv,
    source: extra.source ?? { id: 'probe:' + entry.code, code: entry.code },
    descriptor,
    context: extra.context || {},
    events: [],
    api,
  }
  return { ctx, api, log }
}

const triggersOf = descriptor => (Array.isArray(descriptor.trigger) ? descriptor.trigger : [descriptor.trigger]).filter(Boolean)

const allows = (descriptor, ctx) => {
  const criteria = descriptor.criteria
  if (!criteria) return true
  try {
    return Array.isArray(criteria) ? criteria.every(item => item(ctx)) : Boolean(criteria(ctx))
  } catch {
    return false
  }
}

const run = (entry, index, extra = {}) => {
  const { ctx, api, log } = context(entry, index, extra)
  const allowed = allows(ctx.descriptor, ctx)
  if (!allowed) return { allowed, result: undefined, api, log, ctx }
  return { allowed, result: ctx.descriptor.resolve(ctx), api, log, ctx }
}

const seedKeys = specs => {
  const state = makeState()
  initializeScarletKeys(state, specs)
  return state
}

// ---------------------------------------------------------------------------
// 0. 组结构 / 注册期校验 / 近似披露
// ---------------------------------------------------------------------------
test('P7 共享组 A：35 张卡一卡一文件，code = 文件名，scope 合法且可在注册表读到', () => {
  assert.equal(ENTRIES.length, 35)
  assert.equal(Object.keys(GROUPS).length, 4)
  const all = Object.values(GROUPS).flat()
  assert.equal(all.length, 35)
  assert.equal(new Set(all).size, 35, '四个组的卡号不能重复')
  for (const entry of ENTRIES) {
    assert.match(entry.code, /^097\d{2}[abc]?$/, entry.code)
    assert.ok(['enemy', 'location', 'treachery', 'storyAsset', 'card'].includes(entry.scope), entry.code + ' scope')
    assert.ok(registeredEntry(entry.code), entry.code + ' 未进入注册表')
    assert.equal(registeredEntry(entry.code).scope, entry.scope)
  }
  // 每组都有行为卡（不是空壳）：abilities / encounterResolve / 规则数据至少一项
  for (const [group, codes] of Object.entries(GROUPS)) {
    for (const code of codes) {
      const entry = ENTRY_BY_CODE[code]
      const behavioral = (entry.abilities || []).length > 0 || typeof entry.encounterResolve === 'function'
        || Boolean(entry.locationRule) || Boolean(entry.assetRule) || Boolean(entry.enemyStatRule)
        || Boolean(entry.enemyWeakness) || Boolean(entry.enemySpawnRule) || Boolean(entry.weaknessStaysInHand)
      assert.ok(behavioral, `${group}/${code} 是空壳`)
    }
  }
})

test('P7 共享组 A：近似条目逐条 note 披露，未登记窗口只有 tskKeyShifted', () => {
  const noted = ENTRIES.filter(entry => typeof entry.note === 'string' && entry.note.startsWith('approximation:'))
  assert.ok(noted.length >= 30, '近似披露数量不足：' + noted.length)
  assert.ok(noted.every(entry => entry.note.length > 20))
  // P7 收口：tskKeyShifted / tskExposed 均已在 windows.js 注册。
  assert.deepEqual(unknownTriggerWarnings(), [], '触发时机全部已注册')
})

// ---------------------------------------------------------------------------
// 1. red_coterie
// ---------------------------------------------------------------------------
test('09752 戴红手套的男子：反击关键词 + 钥匙翻至稳定面后攻击并变换附属钥匙', () => {
  assert.deepEqual(r09752.enemyWeakness, { retaliate: true })
  const state = seedKeys([
    { id: 'k1', stableFace: '09768a', unstableFace: '09768b' },
    { id: 'k2', stableFace: '09769a', unstableFace: '09769b' },
  ])
  const target = { id: 'coterie1', code: '09752', name: '戴红手套的男子', location: 'locA', damageTaken: 0 }
  state.enemies.push(target)
  stealKey(state, 'k1', { type: 'enemy', enemyId: 'coterie1' })
  bindKey(state, 'k2', { type: 'enemy', enemyId: 'coterie1' }) // 稳定面：强制变换会翻到动荡面
  const descriptor = r09752.abilities[0]
  assert.deepEqual(triggersOf(descriptor), ['tskKeyShifted'])
  const { ctx } = context(r09752, 0, { state, source: target, context: { keyStable: true, seat: 0 } })
  assert.equal(allows(descriptor, ctx), true)
  const negative = context(r09752, 0, { state, source: target, context: { keyStable: false, seat: 0 } }).ctx
  assert.equal(allows(descriptor, negative), false, '非稳定面翻面不应触发')
  const { result, log } = run(r09752, 0, { state, source: target, context: { keyStable: true, seat: 0 } })
  assert.equal(result, undefined)
  assert.ok(log.some(line => line.startsWith('attack:coterie1')), '必须让戴红手套的男子攻击')
  assert.equal(scarletKey(state, 'k2').stable, false, '稳定面钥匙被变换到动荡面')
  assert.equal(scarletKey(state, 'k1').stable, false, '敌人持有的动荡面钥匙保持动荡面')
})

test('09753 红衣女郎：敌军阶段结束收资源、击败后分配；冷漠 + 最远生成', () => {
  assert.deepEqual(r09753.enemyWeakness, { aloof: true })
  assert.equal(r09753.spawnFarthestFromAll, true)
  const state = makeState()
  const girl = { id: 'chica', code: '09753', name: '红衣女郎', location: 'locB', damageTaken: 0 }
  state.enemies.push(girl)
  const before = state.investigators.map(inv => inv.resources)
  run(r09753, 0, { state, source: girl })
  assert.deepEqual(state.investigators.map(inv => inv.resources), before.map(value => value - 1))
  assert.equal(state.scenarioFlags.chicaRojaResources, 2)
  // 交战状态不触发
  girl.engagedSeat = 0
  run(r09753, 0, { state, source: girl })
  assert.equal(state.scenarioFlags.chicaRojaResources, 2)
  girl.engagedSeat = null
  // 被击败后平均分配（2 点 → 每人 1）
  const beforeGain = state.investigators.map(inv => inv.resources)
  run(r09753, 1, { state, source: girl, context: { enemy: girl } })
  assert.deepEqual(state.investigators.map(inv => inv.resources), beforeGain.map(value => value + 1))
  assert.equal(state.scenarioFlags.chicaRojaResources, 0)
})

test('09754 血色监视者：猎手；被击败时变换附属钥匙两次', () => {
  assert.deepEqual(r09754.enemyWeakness, { hunter: true })
  const state = seedKeys([{ id: 'k1', stableFace: '09768a', unstableFace: '09768b' }])
  const watcher = { id: 'watcher', code: '09754', location: 'locA' }
  state.enemies.push(watcher)
  stealKey(state, 'k1', { type: 'enemy', enemyId: 'watcher' })
  run(r09754, 0, { state, source: watcher, context: { enemy: watcher } })
  // 动荡面 09768b：每位调查员 1 点直接伤害，两次 = 2 点
  assert.deepEqual(state.investigators.map(inv => inv.damage), [2, 2])
  assert.equal(scarletKey(state, 'k1').stable, false)
})

test('09755 深红斗篷的恶兽：猎手/最远生成；在它所在地点检定失败且它重整时变换钥匙', () => {
  assert.deepEqual(r09755.enemyWeakness, { hunter: true })
  assert.equal(r09755.spawnFarthestFromAll, true)
  const state = seedKeys([{ id: 'k1', stableFace: '09769a', unstableFace: '09769b' }])
  const beast = { id: 'beast', code: '09755', location: 'locA', exhausted: false }
  state.enemies.push(beast)
  bindKey(state, 'k1', { type: 'enemy', enemyId: 'beast' })
  state.skillTest = { seat: 0, skill: 'willpower' }
  const descriptor = r09755.abilities[0]
  assert.equal(allows(descriptor, context(r09755, 0, { state, source: beast }).ctx), true)
  beast.exhausted = true
  assert.equal(allows(descriptor, context(r09755, 0, { state, source: beast }).ctx), false, '它横置时不触发')
  beast.exhausted = false
  state.investigators[1].location = 'locC'
  state.skillTest = { seat: 1, skill: 'willpower' } // 另一地点失败
  assert.equal(allows(descriptor, context(r09755, 0, { state, source: beast }).ctx), false)
  state.skillTest = { seat: 0, skill: 'willpower' }
  run(r09755, 0, { state, source: beast })
  assert.equal(scarletKey(state, 'k1').stable, false, '稳定面钥匙翻到动荡面')
})

test('09756 暗红骑士：结社光环数据 + 同伴离场时变换钥匙（自身排除）', () => {
  assert.equal(r09756.spawnFarthestFromAll, true)
  assert.deepEqual(r09756.enemyStatRule, { aura: { stat: 'fight', trait: 'Coterie', amount: 2 } })
  const state = seedKeys([{ id: 'k1', stableFace: '09770a', unstableFace: '09770b' }])
  const knight = { id: 'knight', code: '09756', name: '暗红骑士', location: 'locA', traits: ['Humanoid', 'Coterie'] }
  const other = { id: 'other', code: '09759', name: '苋', location: 'locA', traits: ['Humanoid', 'Coterie'] }
  state.enemies.push(knight, other)
  bindKey(state, 'k1', { type: 'enemy', enemyId: 'knight' })
  const descriptor = r09756.abilities[0]
  assert.equal(allows(descriptor, context(r09756, 0, { state, source: knight, context: { enemy: other } }).ctx), true)
  assert.equal(allows(descriptor, context(r09756, 0, { state, source: knight, context: { enemy: knight } }).ctx), false, '其他敌人不含自己')
  run(r09756, 0, { state, source: knight, context: { enemy: other } })
  assert.equal(scarletKey(state, 'k1').stable, false)
})

test('09757 索恩：入场变换钥匙；[fast] 移除身上的钥匙交给索恩并进胜利区', () => {
  assert.deepEqual(r09757.enemyWeakness, { hunter: true })
  const state = seedKeys([{ id: 'k1', stableFace: '09768a', unstableFace: '09768b' }])
  const thorne = { id: 'thorne', code: '09757', name: '索恩', location: 'locA' }
  state.enemies.push(thorne)
  bindKey(state, 'k1', { type: 'enemy', enemyId: 'thorne' })
  run(r09757, 0, { state, source: thorne, context: { enemy: thorne } })
  assert.equal(scarletKey(state, 'k1').stable, false)
  // 玩家行动分支
  const state2 = seedKeys([{ id: 'k2', stableFace: '09769a', unstableFace: '09769b' }])
  const thorne2 = { id: 'thorne2', code: '09757', name: '索恩', location: 'locA' }
  state2.enemies.push(thorne2)
  bindKey(state2, 'k2', { type: 'investigator', seat: 0 })
  const freeAbility = r09757.abilities[1]
  assert.equal(freeAbility.kind, 'free')
  const { result } = run(r09757, 1, { state: state2, source: thorne2 })
  assert.equal(result, true)
  assert.deepEqual(keysHeldBy(state2, { type: 'enemy', enemyId: 'thorne2' }), ['k2'])
  assert.deepEqual(state2.victoryDisplay, ['09757'])
  assert.equal(state2.scenarioFlags['removedKey:k2'], true)
})

test('09758 德西德柔：巡逻向「有其他结社敌人的最近地点」移动 1 格', () => {
  const state = makeState()
  const him = { id: 'desi', code: '09758', name: '德西德柔', location: 'locA', traits: ['Coterie'], exhausted: false }
  const mate = { id: 'mate', code: '09759', name: '苋', location: 'locC', traits: ['Coterie'] }
  state.enemies.push(him, mate)
  const descriptor = r09758.abilities[0]
  assert.deepEqual(triggersOf(descriptor), ['enemyPhaseBegins'])
  assert.equal(allows(descriptor, context(r09758, 0, { state, source: him }).ctx), true)
  run(r09758, 0, { state, source: him })
  assert.equal(him.location, 'locB', '沿最短路径移动一格')
  // 没有其他结社敌人时不触发
  mate.location = him.location
  assert.equal(allows(descriptor, context(r09758, 0, { state, source: him }).ctx), false)
})

test('09759 苋：攻击后变换钥匙；攻击伤害分到支援时击败该支援', () => {
  assert.deepEqual(r09759.enemyWeakness, { hunter: true })
  const state = seedKeys([{ id: 'k1', stableFace: '09770a', unstableFace: '09770b' }])
  const amaranth = { id: 'amaranth', code: '09759', name: '苋', location: 'locA' }
  state.enemies.push(amaranth)
  bindKey(state, 'k1', { type: 'enemy', enemyId: 'amaranth' })
  run(r09759, 0, { state, source: amaranth, context: { enemy: amaranth } })
  assert.equal(scarletKey(state, 'k1').stable, false)
  // 攻击伤害分配到支援
  const asset = { id: 'asset1', code: '01020', exhausted: false }
  state.investigators[0].assets.push(asset)
  state._enemyAttackResolving = { enemy: amaranth, inv: state.investigators[0], kind: 'attack' }
  run(r09759, 1, { state, source: amaranth, context: { damagedAssetIds: ['asset1'] } })
  assert.equal(state.investigators[0].assets.length, 0, '被攻击伤害分配到的支援被击败')
  state._enemyAttackResolving = null
})

test('09760 朱三娘：猎手/反击；攻击或躲避成功且超过难度 2 点以上才变换钥匙', () => {
  assert.deepEqual(r09760.enemyWeakness, { hunter: true, retaliate: true })
  const state = seedKeys([{ id: 'k1', stableFace: '09768a', unstableFace: '09768b' }])
  const tzu = { id: 'tzu', code: '09760', location: 'locA' }
  state.enemies.push(tzu)
  bindKey(state, 'k1', { type: 'enemy', enemyId: 'tzu' })
  state.skillTest = { seat: 0, skill: 'combat', source: { enemyId: 'tzu' } }
  const descriptor = r09760.abilities[0]
  assert.equal(allows(descriptor, context(r09760, 0, { state, source: tzu, context: { skill: 'combat', successBy: 2 } }).ctx), true)
  assert.equal(allows(descriptor, context(r09760, 0, { state, source: tzu, context: { skill: 'combat', successBy: 1 } }).ctx), false)
  assert.equal(allows(descriptor, context(r09760, 0, { state, source: tzu, context: { skill: 'willpower', successBy: 3 } }).ctx), false)
  state.skillTest = { seat: 0, skill: 'agility', source: { enemyId: 'other' } }
  assert.equal(allows(descriptor, context(r09760, 0, { state, source: tzu, context: { skill: 'agility', successBy: 3 } }).ctx), false)
  state.skillTest = { seat: 0, skill: 'agility', source: { enemyId: 'tzu' } }
  run(r09760, 0, { state, source: tzu, context: { skill: 'agility', successBy: 3 } })
  assert.equal(scarletKey(state, 'k1').stable, false)
})

test('09761 艾里奇：敌军阶段结束空洞化牌库顶；出现同名空洞时变换钥匙', () => {
  assert.deepEqual(r09761.enemyWeakness, { aloof: true })
  const state = seedKeys([{ id: 'k1', stableFace: '09769a', unstableFace: '09769b' }])
  const aliki = { id: 'aliki', code: '09761', location: 'locA' }
  state.enemies.push(aliki)
  bindKey(state, 'k1', { type: 'enemy', enemyId: 'aliki' })
  state.investigators[0].deck = ['01020', '01021']
  state.investigators[1].deck = ['01022']
  run(r09761, 0, { state, source: aliki })
  assert.equal(hollowCount(state, { scope: 'team' }), 2)
  assert.equal(isHollowed(state, '01021'), true)
  assert.equal(state.investigators[0].deck.length, 1, '牌库顶离开牌库')
  assert.equal(state.investigators[1].deck.length, 0)
  assert.equal(state.setAside.length, 0, '牌库顶空洞不写 setAside 副本（takeDeckCard）')
  // 再造一张同名空洞卡：此时应触发变换
  const state2 = seedKeys([{ id: 'k2', stableFace: '09769a', unstableFace: '09769b' }])
  const aliki2 = { id: 'aliki2', code: '09761', location: 'locA' }
  state2.enemies.push(aliki2)
  bindKey(state2, 'k2', { type: 'enemy', enemyId: 'aliki2' })
  state2.investigators[0].deck = ['01030']
  run(r09761, 0, { state: state2, source: aliki2 })
  state2.investigators[0].deck.push('01030')
  run(r09761, 0, { state: state2, source: aliki2 })
  assert.equal(scarletKey(state2, 'k2').stable, false, '同名空洞出现后变换钥匙')
})

// ---------------------------------------------------------------------------
// 2. globetrotting
// ---------------------------------------------------------------------------
test('09762 福林探员：只在揭露诱饵时触发，横置并抽 1 张', () => {
  const state = makeState()
  state.investigators[0].deck = ['01020']
  const descriptor = g09762.abilities[0]
  assert.equal(allows(descriptor, context(g09762, 0, { state, context: { decoy: true, seat: 0 } }).ctx), true)
  assert.equal(allows(descriptor, context(g09762, 0, { state, context: { decoy: false, seat: 0 } }).ctx), false)
  assert.equal(allows(descriptor, context(g09762, 0, { state, context: { decoy: true, seat: 1 } }).ctx), false)
  run(g09762, 0, { state, context: { decoy: true, seat: 0 } })
  assert.deepEqual(state.investigators[0].hand, ['01020'])
})

test('09763 阿丽·奎因特工：所在地点有隐匿迷你卡时 +1 三项技能；揭露后抽 1 张', () => {
  const state = makeState()
  placeMiniCard(state, { kind: 'coterieAgent', decoy: true, locationId: 'locA' })
  const modifiers = g09763.modifiers
  assert.equal(modifiers.length, 3)
  for (const modifier of modifiers) {
    const when = modifier.condition.when
    assert.equal(when({ state, inv: state.investigators[0] }), true)
    assert.equal(when({ state, inv: { seat: 1, location: 'locC' } }), false)
  }
  state.investigators[0].deck = ['01020']
  run(g09763, 0, { state, context: { seat: 0, decoy: false, kind: '09716a' } })
  assert.deepEqual(state.investigators[0].hand, ['01020'])
})

test('09764 戴维·伊拉万博士：+1 意志；回收同名空洞洗回牌库并按张获得资源', () => {
  const state = makeState()
  hollowCard(state, { code: '01020', scope: 'investigator', seat: 0, source: 'hand' })
  state.investigators[0].hand = ['01020', '01021']
  assert.deepEqual(g09764.modifiers, [{ target: 'skill:willpower', amount: 1 }])
  const { result } = run(g09764, 0, {
    state,
    choose: spec => (spec.prompt.includes('方式') ? 'byHand' : spec.options[0].id),
  })
  assert.equal(result, true)
  assert.equal(isHollowed(state, '01020'), false, '空洞被回收')
  assert.ok(state.investigators[0].deck.includes('01020'), '洗回所有者牌库')
  assert.deepEqual(state.shuffledSeats, [0])
  assert.equal(state.investigators[0].resources, 6, '每张洗回的空洞获得 1 资源')
})

test('09765 快捷旅票：永久；放逐并记录 1 时间的使用', () => {
  assert.equal(g09765.flags.permanent, true)
  assert.deepEqual(g09765.assetRule.expeditedTicket, { time: 1, anywhere: true })
  const state = makeState()
  const ticket = { id: 'ticket', code: '09765' }
  state.investigators[0].assets.push(ticket)
  const { result } = run(g09765, 0, { state, source: ticket })
  assert.equal(result, true)
  assert.equal(state.scenarioFlags.tskExpeditedTicketUsed, true)
  assert.equal(state.scenarioFlags.tskExpeditedTicketSeat, 0)
  assert.deepEqual(state.removedFromGame, ['09765'], '放逐到移出游戏区')
  assert.equal(run(g09765, 0, { state, source: ticket }).result, false, '只能使用一次')
})

test('09766 基金会情报：抽到留手 + 抽牌日志提示（弱点生命周期读点）', () => {
  // 卡面「不能离开你手中」= 只有留手与日志提示两个引擎读点；
  // blocksCommitWhileInHand 是塔罗「高塔·XVI」的「手牌里时不能投入任何卡」，语义不同，不得复用。
  assert.equal(g09766.weaknessStaysInHand, true)
  assert.equal(g09766.weaknessHandNote, '「基金会情报」不能离开你手中。')
  assert.equal(g09766.blocksCommitWhileInHand, undefined)
  const entry = registeredEntry('09766')
  assert.equal(entry.weaknessStaysInHand, true)
  assert.equal(entry.weaknessHandNote, '「基金会情报」不能离开你手中。')
  // 注册期把该布尔字段归一成 false（而不是省略键）——断言它没有被声明为 true。
  assert.equal(entry.blocksCommitWhileInHand, false)
})

test('09767 超维认识：弱点描述子——变换一个动荡钥匙，或把所有稳定钥匙翻至动荡面', () => {
  const state = seedKeys([
    { id: 'k1', stableFace: '09768a', unstableFace: '09768b' },
    { id: 'k2', stableFace: '09769a', unstableFace: '09769b' },
  ])
  bindKey(state, 'k1', { type: 'investigator', seat: 0 })
  bindKey(state, 'k2', { type: 'investigator', seat: 0 })
  const descriptor = g09767.abilities[0]
  assert.equal(descriptor.kind, 'weakness')
  // 第一项：立即变换一个动荡钥匙（把 k1 变到动荡面）
  run(g09767, 0, { state, choose: () => 'shift' })
  assert.equal(scarletKey(state, 'k1').stable, false)
  // 第二项：把剩余稳定钥匙（k2）翻至动荡面
  run(g09767, 0, { state, choose: () => 'flip' })
  assert.equal(scarletKey(state, 'k2').stable, false)
})

test('09768a/09768b 镜刃：稳定面对敌人造成伤害后翻面；动荡面全员 1 点直接伤害', () => {
  // 稳定面：两个敌人时可选「每敌 1 点」
  const state = seedKeys([{ id: 'k1', stableFace: '09768a', unstableFace: '09768b' }])
  bindKey(state, 'k1', { type: 'investigator', seat: 0 })
  const first = { id: 'e1', code: '01160', name: '敌人甲', location: 'locA', damageTaken: 0 }
  const second = { id: 'e2', code: '01160', name: '敌人乙', location: 'locA', damageTaken: 0 }
  state.enemies.push(first, second)
  assert.equal(run(g09768a, 0, { state, choose: () => 'all' }).result, true)
  assert.deepEqual([first.damageTaken, second.damageTaken], [1, 1])
  assert.equal(scarletKey(state, 'k1').stable, false)
  // 动荡面：每位调查员 1 点直接伤害，然后翻回稳定面
  state.round = 3
  assert.equal(run(g09768b, 0, { state }).result, true)
  assert.deepEqual(state.investigators.map(inv => inv.damage), [1, 1])
  assert.equal(scarletKey(state, 'k1').stable, true)
  // 敌人强制变换用 assetRule.keyShift：只结算当前面，不翻面
  const enemyHeld = seedKeys([{ id: 'k2', stableFace: '09768a', unstableFace: '09768b' }])
  enemyHeld.enemies.push({ id: 'someone', code: '09759', location: 'locB' })
  stealKey(enemyHeld, 'k2', { type: 'enemy', enemyId: 'someone' })
  const applied = g09768b.assetRule.keyShift.resolve({ state: enemyHeld, api: makeApi(enemyHeld).api })
  assert.equal(applied.damaged, 2)
  assert.equal(scarletKey(enemyHeld, 'k2').stable, false)
})

test('09769a/09769b 灾祸引擎：稳定面加 1 使用次数；动荡面全员失去 3 资源', () => {
  const state = seedKeys([{ id: 'k1', stableFace: '09769a', unstableFace: '09769b' }])
  bindKey(state, 'k1', { type: 'investigator', seat: 0 })
  const ammo = { id: 'a1', code: '01020', uses: 2, usesType: 'ammo' }
  state.investigators[0].assets.push(ammo)
  assert.equal(run(g09769a, 0, { state }).result, true)
  assert.equal(ammo.uses, 3)
  assert.equal(scarletKey(state, 'k1').stable, false)
  state.round = 3
  assert.equal(run(g09769b, 0, { state }).result, true)
  assert.deepEqual(state.investigators.map(inv => inv.resources), [2, 2])
  assert.equal(scarletKey(state, 'k1').stable, true)
})

test('09770a/09770b 灾毁之钟：稳定面自动躲避本地所有敌人；动荡面全员 1 点直接恐惧', () => {
  const state = seedKeys([{ id: 'k1', stableFace: '09770a', unstableFace: '09770b' }])
  bindKey(state, 'k1', { type: 'investigator', seat: 0 })
  const here = { id: 'e1', code: '01160', location: 'locA', exhausted: false }
  const away = { id: 'e2', code: '01160', location: 'locC', exhausted: false }
  state.enemies.push(here, away)
  assert.equal(run(g09770a, 0, { state }).result, true)
  assert.equal(here.exhausted, true)
  assert.equal(away.exhausted, false)
  assert.equal(scarletKey(state, 'k1').stable, false)
  state.round = 3
  assert.equal(run(g09770b, 0, { state }).result, true)
  assert.deepEqual(state.investigators.map(inv => inv.horror), [1, 1])
  assert.equal(scarletKey(state, 'k1').stable, true)
})

// ---------------------------------------------------------------------------
// 3. crimson_conspiracy
// ---------------------------------------------------------------------------
for (const [letter, entry] of [['A', c09716a], ['B', c09716b], ['C', c09716c]]) {
  test('09716' + letter.toLowerCase() + ' 结社特工（' + letter + '）：隐匿 2、入场 1 毁灭、揭露即弃掉', () => {
    assert.deepEqual(entry.flags.concealed, 2)
    assert.deepEqual(entry.enemySpawnRule, { doomOnSpawn: 1 })
    const state = makeState()
    const agent = { id: 'agent' + letter, code: entry.code, location: 'locA', doom: 0 }
    state.enemies.push(agent)
    const descriptor = entry.abilities[0]
    assert.deepEqual(triggersOf(descriptor), ['tskExposed'])
    assert.equal(allows(descriptor, context(entry, 0, { state, source: agent, context: { kind: entry.code, decoy: false } }).ctx), true)
    assert.equal(allows(descriptor, context(entry, 0, { state, source: agent, context: { kind: entry.code, decoy: true } }).ctx), false, '诱饵不触发')
    run(entry, 0, { state, source: agent, context: { kind: entry.code, decoy: false } })
    assert.equal(state.enemies.includes(agent), false, '揭露后弃掉')
  })
}

test('09717 红色阴谋：阴影有敌人时放 1 毁灭；否则检索带隐匿敌人并抽取', () => {
  // 阴影里的敌人（location = null）
  const state = makeState()
  const shadow = { id: 'shadow', code: '09716a', location: null, doom: 0 }
  state.enemies.push(shadow)
  assert.deepEqual(c09717.encounterResolve(state, state.investigators[0], { code: '09717' }, makeApi(state).api), { placed: true, enemyId: 'shadow' })
  assert.equal(shadow.doom, 1)
  // 阴影无敌人：从遭遇弃牌堆检索
  const state2 = makeState()
  state2.encounterDeck = ['01020', '09716a']
  state2.encounterDiscard = ['09716b']
  const result = c09717.encounterResolve(state2, state2.investigators[0], { code: '09717' }, makeApi(state2, { choose: spec => spec.options[0].id }).api)
  assert.ok(result.spawned, '必须生成一个带隐匿的敌人')
  assert.equal(state2.enemies.length, 1)
  assert.ok(['09716a', '09716b'].includes(state2.enemies[0].code))
  assert.equal(state2.enemies[0].engagedSeat, 0)
})

// ---------------------------------------------------------------------------
// 4. beyond_the_beyond
// ---------------------------------------------------------------------------
const exposedContext = (entry, state, position, decoy = false) => ({
  state,
  source: state.locations.find(location => location.code === entry.code) || { id: entry.code, code: entry.code },
  context: { kind: entry.code, decoy, seat: 0, position },
})

test('09747a 凌乱道路（残骸之城 A）：左边 1 伤害、右边 1 恐惧；正面数据与查看行动', () => {
  // 正面「攻击/躲避本地点隐匿迷你卡难度 +2」= 与 09577 同键名的 locationRule 数据声明
  // （引擎还缺「攻击/躲避隐匿迷你卡」动作与 per-location 难度读点，见卡条目 note）。
  assert.equal(b09747a.locationRule.concealedFightEvadeBonus, 2)
  assert.deepEqual(b09747a.flags.concealed, 1)
  const state = makeState()
  placeMiniCard(state, { kind: 'coterieAgent', decoy: false, locationId: 'locB' })
  state.investigators[0].resources = 5
  const source = { id: 'locA', code: '09747a' }
  run(b09747a, 1, { state, source, context: { kind: '09747a', decoy: false, seat: 0, position: 'left' } })
  assert.equal(state.investigators[0].damage, 1)
  run(b09747a, 1, { state, source, context: { kind: '09747a', decoy: false, seat: 0, position: 'right' } })
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(allows(b09747a.abilities[1], context(b09747a, 1, { state, source, context: { kind: '09747a', decoy: true, seat: 0, position: 'left' } }).ctx), false,
    '诱饵揭露不触发地点背面')
  // 正面 [action]：花费连接数资源查看一张迷你卡
  const { result } = run(b09747a, 0, { state })
  assert.equal(result, true)
  assert.equal(state.investigators[0].resources, 4)
  assert.equal(state.scenarioFlags.ramblingRouteLookUsed, true)
  assert.equal(run(b09747a, 0, { state }).result, false, '团队每场游戏一次')
})

test('09747b 凌乱道路（残骸之城 B）：左边失去 2 资源、中间失去 1 行动', () => {
  const state = makeState()
  // 正面难度 +2 与 09747a 同一条印刷规则、同一个 locationRule 键名。
  assert.equal(b09747b.locationRule.concealedFightEvadeBonus, 2)
  run(b09747b, 1, { state, ...exposedContext(b09747b, state, 'left') })
  assert.equal(state.investigators[0].resources, 3)
  run(b09747b, 1, { state, ...exposedContext(b09747b, state, 'middle') })
  assert.equal(state.investigators[0].actionsLeft, 2)
  assert.equal(allows(b09747b.abilities[1], context(b09747b, 1, exposedContext(b09747b, state, 'right')).ctx), true)
})

test('09747c 凌乱道路（残骸之城 C）：中间空洞一张手牌、右边空洞一个支援', () => {
  const state = makeState()
  assert.equal(b09747c.locationRule.concealedFightEvadeBonus, 2)
  state.investigators[0].hand = ['01020']
  run(b09747c, 1, { state, ...exposedContext(b09747c, state, 'middle') })
  assert.equal(isHollowed(state, '01020'), true)
  assert.deepEqual(state.setAside, ['01020'])
  const asset = { id: 'asset1', code: '01030' }
  state.investigators[0].assets.push(asset)
  run(b09747c, 1, { state, ...exposedContext(b09747c, state, 'right') })
  assert.equal(isHollowed(state, '01030'), true)
  assert.equal(state.investigators[0].assets.length, 0)
})

test('09748a 异星边境（残骸之城 A）：左右移动失败受 2 伤害；左边揭露 1 伤害', () => {
  assert.deepEqual(b09748a.flags.alienFrontier, 'horizontal')
  const state = makeState({ grid: { locA: { x: 0, y: 0 }, locB: { x: 1, y: 0 }, locC: { x: 0, y: 1 } } })
  state.investigators[0].location = 'locB'
  const move = b09748a.abilities[0]
  const ctx = { context: { seat: 0, from: 'locA', location: 'locB' }, source: { id: 'locA', code: '09748a' } }
  assert.equal(allows(move, context(b09748a, 0, { state, ...ctx }).ctx), true)
  const vertical = context(b09748a, 0, { state, source: ctx.source, context: { seat: 0, from: 'locA', location: 'locC' } }).ctx
  assert.equal(allows(move, vertical), true)
  // 左右移动（同一行）失败 → 2 伤害
  run(b09748a, 0, { state, source: ctx.source, context: ctx.context, testResults: [{ success: false, difficulty: 5 }] })
  assert.equal(state.investigators[0].damage, 2)
  // 上下移动（不同行）不结算
  run(b09748a, 0, { state, source: ctx.source, context: { seat: 0, from: 'locA', location: 'locC' } })
  assert.equal(state.investigators[0].damage, 2, '上下移动不触发左右规则')
  run(b09748a, 2, { state, ...exposedContext(b09748a, state, 'left') })
  assert.equal(state.investigators[0].damage, 3)
})

test('09748b 异星边境（残骸之城 B）：上下移动失败受 2 伤害；左边失去 2 资源', () => {
  assert.deepEqual(b09748b.flags.alienFrontier, 'vertical')
  const state = makeState({ grid: { locA: { x: 0, y: 0 }, locB: { x: 1, y: 0 }, locC: { x: 0, y: 1 } } })
  state.investigators[0].location = 'locC'
  run(b09748b, 0, { state, source: { id: 'locA', code: '09748b' }, context: { seat: 0, from: 'locA', location: 'locC' }, testResults: [{ success: false, difficulty: 5 }] })
  assert.equal(state.investigators[0].damage, 2)
  run(b09748b, 0, { state, source: { id: 'locA', code: '09748b' }, context: { seat: 0, from: 'locA', location: 'locB' }, testResults: [{ success: false, difficulty: 5 }] })
  assert.equal(state.investigators[0].damage, 2, '左右移动不触发上下规则')
  run(b09748b, 2, { state, ...exposedContext(b09748b, state, 'left') })
  assert.equal(state.investigators[0].resources, 3)
})

test('09749a 拟像旷野：揭示后牌库顶非弱点卡成为空洞；[fast] 无线索时可重排', () => {
  const state = makeState()
  state.locations[0] = { ...state.locations[0], code: '09749a', clues: 0 }
  state.investigators[0].deck = ['01020']
  run(b09749a, 0, { state, context: { location: 'locA', seat: 0 }, source: { id: 'locA', code: '09749a' } })
  assert.equal(isHollowed(state, '01020'), true)
  assert.equal(state.investigators[0].deck.length, 0, '牌库顶被 takeDeckCard 取出')
  placeMiniCard(state, { kind: 'coterieAgent', decoy: true, locationId: 'locA' })
  placeMiniCard(state, { kind: 'coterieAgent', decoy: true, locationId: 'locB' })
  const { result } = run(b09749a, 1, { state, source: { id: 'locA', code: '09749a' } })
  assert.equal(result, true)
  assert.equal(state.scenarioFlags.wealdSwapUsed, true)
  assert.equal(concealedMiniCards(state).length, 2, '重排不增删迷你卡')
})

test('09749b 拟像旷野（变体）：中间空洞手牌、右边空洞支援', () => {
  const state = makeState()
  state.locations[0] = { ...state.locations[0], code: '09749b' }
  state.investigators[0].deck = ['01021']
  run(b09749b, 0, { state, context: { location: 'locA', seat: 0 }, source: { id: 'locA', code: '09749b' } })
  assert.equal(isHollowed(state, '01021'), true)
  state.investigators[0].hand = ['01022']
  run(b09749b, 2, { state, ...exposedContext(b09749b, state, 'middle') })
  assert.equal(isHollowed(state, '01022'), true)
  const asset = { id: 'asset2', code: '01030' }
  state.investigators[0].assets.push(asset)
  run(b09749b, 2, { state, ...exposedContext(b09749b, state, 'right') })
  assert.equal(isHollowed(state, '01030'), true)
})

test('09750 疯狂峭壁：揭示后重排隐匿迷你卡；左侧揭露 1 伤害、右侧 1 恐惧', () => {
  const state = makeState()
  state.locations[0] = { ...state.locations[0], code: '09750' }
  placeMiniCard(state, { kind: 'coterieAgent', decoy: true, locationId: 'locA' })
  placeMiniCard(state, { kind: 'coterieAgent', decoy: false, locationId: 'locB' })
  run(b09750, 0, { state, context: { location: 'locA' }, source: { id: 'locA', code: '09750' } })
  assert.equal(concealedMiniCards(state).length, 2)
  run(b09750, 1, { state, ...exposedContext(b09750, state, 'left') })
  assert.equal(state.investigators[0].damage, 1)
  run(b09750, 1, { state, ...exposedContext(b09750, state, 'right') })
  assert.equal(state.investigators[0].horror, 1)
})

test('09751 超维恐怖：显现二选一——重排隐匿迷你卡，或全员 1 伤害 1 恐惧', () => {
  const state = makeState()
  placeMiniCard(state, { kind: 'coterieAgent', decoy: true, locationId: 'locA' })
  placeMiniCard(state, { kind: 'conspiracyInRed', decoy: true, locationId: 'locB' })
  const decoyResult = b09751.encounterResolve(state, state.investigators[0], { code: '09751' }, makeApi(state, { choose: () => 'decoys' }).api)
  assert.deepEqual(decoyResult, { choice: 'decoys', cards: 2 })
  const harmState = makeState()
  const harmResult = b09751.encounterResolve(harmState, harmState.investigators[0], { code: '09751' }, makeApi(harmState, { choose: () => 'harm' }).api)
  assert.deepEqual(harmResult, { choice: 'harm', investigators: 2 })
  assert.deepEqual(harmState.investigators.map(inv => [inv.damage, inv.horror]), [[1, 1], [1, 1]])
})

// ---------------------------------------------------------------------------
// 5. 原语层：setup / 遇牌库 / 结局记录 / JSON 往返
// ---------------------------------------------------------------------------
test('红色同志会：三池初始化、遭遇注入、池间转移与已击败记录', () => {
  const state = makeState()
  initializeCoterie(state, { members: { unresolved: ['09752', '09753', '09754'], ally: ['09757'], defeated: [] } })
  assert.deepEqual(coterieSnapshot(state).unresolved, ['09752', '09753', '09754'])
  const injected = injectCoterieEnemy(state, { random: () => 0 })
  assert.equal(injected.code, '09752')
  assert.deepEqual(injectedCoterie(state), ['09752'])
  moveCoterieMember(state, { code: '09753', from: 'unresolved', to: 'defeated' })
  assert.deepEqual(defeatedCoterie(state), ['09753'])
  assert.throws(() => moveCoterieMember(state, { code: '09753', from: 'unresolved', to: 'ally' }), /不在/)
  validateTskCoterie(state)
  const restored = JSON.parse(JSON.stringify(state))
  validateTskState(restored)
  assert.deepEqual(coterieSnapshot(restored).ally, ['09757'])
})

test('世界地图：初始化、启程耗时、时间阈值强制目的地、快捷旅票（记 1 时间）', () => {
  const state = makeState()
  const graph = { nodes: [
    { id: 'london', connections: ['marrakesh', 'bermuda'], type: 'standard' },
    { id: 'marrakesh', connections: ['london', 'tunguska'], type: 'standard' },
    { id: 'bermuda', connections: ['london'], type: 'side' },
    { id: 'tunguska', connections: ['marrakesh'], type: 'standard' },
  ] }
  initializeWorldMap(state, { graph, start: 'london', unlocked: ['marrakesh', 'tunguska'], forcedNode: 'tunguska' })
  assert.equal(mapTime(state), 0)
  const options = embarkOptions(state, { graph })
  assert.equal(options.from, 'london')
  assert.ok(options.options.some(option => option.destination === 'bermuda' && option.sideStory))
  const travelled = travelTo(state, { graph, destination: 'marrakesh' })
  assert.equal(travelled.cost, 1)
  assert.equal(mapTime(state), 1)
  assert.throws(() => travelTo(state, { graph, destination: 'bermuda' }), /尚未解锁/)
  unlockMapNode(state, 'bermuda', { graph })
  const expedited = useExpeditedTicket(state, { graph, destination: 'tunguska' })
  assert.equal(expedited.cost, 1)
  assert.equal(mapTime(state), 2)
  // 时间到 35 强制去通古斯卡
  state.campaign.tsk.map.time = 35
  assert.equal(forcedDestination(state), 'tunguska')
  assert.throws(() => travelTo(state, { graph, destination: 'marrakesh' }), /只能前往强制目的地/)
  validateTskMap(state)
  const restored = JSON.parse(JSON.stringify(state))
  validateTskState(restored)
  assert.equal(mapTime(restored), 35)
})

test('状况报告与密档：阈值排队/结算、密档解锁与已读、JSON 往返', () => {
  const state = makeState()
  initializeWorldMap(state, { graph: { nodes: [{ id: 'london', connections: [] }] }, start: 'london' })
  initializeStatusReports(state, { thresholds: [{ report: 'alpha', threshold: 7 }, { report: 'epsilon', threshold: 10 }] })
  state.campaign.tsk.map.time = 10
  const queued = queueStatusReports(state)
  assert.deepEqual(queued, ['alpha', 'epsilon'])
  assert.deepEqual(statusReportState(state).pending, ['alpha', 'epsilon'])
  resolveStatusReport(state, 'alpha', { time: 1 })
  assert.deepEqual(statusReportState(state).triggered, ['alpha'])
  assert.throws(() => resolveStatusReport(state, 'alpha'), /不在待处理队列/)
  unlockDossier(state, 'map:14-C')
  assert.throws(() => readDossier(state, 'map:20-E'), /尚未解锁/)
  readDossier(state, 'map:14-C')
  assert.deepEqual(dossiers(state), { unlocked: ['map:14-C'], read: ['map:14-C'] })
  validateTskStatusReports(state)
  validateTskDossiers(state)
  const restored = JSON.parse(JSON.stringify(state))
  validateTskState(restored)
  assert.deepEqual(dossiers(restored).read, ['map:14-C'])
})

test('密钥/空洞：绑定、夺取、变换、空洞回收、存在抹除与完整 JSON 往返', () => {
  const state = makeState()
  initializeScarletKeys(state, [
    { id: '09768', stableFace: '09768a', unstableFace: '09768b' },
    { id: '09769', stableFace: '09769a', unstableFace: '09769b' },
  ])
  bindKey(state, '09768', { type: 'investigator', seat: 0 })
  assert.equal(keyFace(state, '09768'), '09768a')
  shiftKey(state, '09768')
  assert.equal(keyFace(state, '09768'), '09768b')
  assert.equal(keyShiftedThisRound(state, '09768'), true)
  assert.throws(() => shiftKey(state, '09768'), /本轮已经变换过/)
  state.enemies.push({ id: 'enemy1', code: '09759', location: 'locA' })
  const stolen = stealKey(state, '09769', { type: 'enemy', enemyId: 'enemy1' })
  assert.equal(stolen.stable, false, '敌人夺取 → 动荡面')
  hollowCard(state, { code: '01020', scope: 'investigator', seat: 0, source: 'hand' })
  hollowCard(state, { code: '01021', scope: 'team', source: 'deck' })
  assert.equal(hollowCount(state, { scope: 'team' }), 2)
  assert.deepEqual(recallHollow(state, '01021', { to: 'deck' }), { code: '01021', source: 'deck', scope: 'team', seat: null, to: 'deck' })
  eraseFromExistence(state, ['01020'])
  assert.deepEqual(erasedFromExistence(state), ['01020'])
  validateTskKeys(state)
  validateTskHollows(state)
  validateTskErased(state)
  const restored = JSON.parse(JSON.stringify(state))
  validateTskState(restored)
  assert.equal(scarletKeys(restored).length, 2)
  assert.deepEqual(erasedFromExistence(restored), ['01020'])
  assert.deepEqual(hollowCards(restored).map(card => card.code), [])
})

test('隐匿迷你卡：分发/揭露/轮末重排保持卡数守恒，JSON 往返通过读档校验', () => {
  const state = makeState()
  const created = distributeConcealed(state, {
    cards: [{ kind: 'coterieAgent' }, { kind: 'decoy', decoy: true }, { kind: 'decoy', decoy: true }],
    placements: [{ locationId: 'locA', count: 2 }, { locationId: 'locB', count: 1 }],
  })
  assert.equal(created.length, 3)
  assert.equal(concealedAt(state, 'locA').length, 2)
  assert.equal(concealedMiniCards(state).length, 3)
  const exposed = exposeMiniCard(state, created[0].id)
  assert.ok(exposed.kind)
  assert.equal(concealedMiniCards(state).length, 2, '揭露后取出')
  reshuffleConcealed(state)
  assert.equal(concealedMiniCards(state).length, 2, '重排不增删')
  validateTskConcealed(state)
  validateTskState(JSON.parse(JSON.stringify(state)))
})

test('异界牌库（Otherworld deck）：初始化/顶牌查看/放回顶部/总张数（09748a 的查看读点）', () => {
  const state = makeState()
  const decks = createScenarioDeckApi(state, { choice: () => '0', cardName: code => code })
  assert.equal(decks.initialize('otherworld', ['09747a', '09750'], { shuffle: false }), 2)
  assert.equal(decks.size('otherworld'), 2)
  assert.deepEqual(scenarioDeckTop(state, 'otherworld', 1), ['09750'])
  assert.equal(scenarioDeckTop(state, 'otherworld', 3), false, '张数不足时失败关闭')
  assert.deepEqual(decks.take('otherworld', 1), ['09750'])
  assert.equal(scenarioDeckReturnTop(state, 'otherworld', ['09750']), 1)
  assert.deepEqual(scenarioDeckTop(state, 'otherworld', 1), ['09750'])
  assert.equal(scenarioDeckTotal(state, 'otherworld'), 2)
  assert.throws(() => scenarioDeckTop(state, 'missing'), /not initialized|不正确/)
})
