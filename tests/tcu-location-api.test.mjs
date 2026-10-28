// 05125 地点原语验收：swapLocationInPlay / removeLocationFromGame
// （实现：src/engine/location-swap.js；内容层入口：scenario-runtime 与 api-misc）。
//
// 证据口径（P2-6 批次）：
//   · 换地点：新地点入场（日志/连线由 placeLocation 统一处理）、保留旧地点 revealed、线索/毁灭/
//     地点附属/玩家地点附属随地点卡迁移、旧地点敌人/调查员/剧情资产搬到新地点、新地点卡号从
//     「放一边」取走、旧地点静默离场（不写「被移出游戏」日志）；
//   · 移出游戏：地点离场时其上的敌人进遭遇弃牌堆（不留在 state.enemies）、日志与 api.remove 一致、
//     玩家地点附属默认保留现状（显式选项才随地点离场弃置）；
//   · 非法入参返回 null；状态可 JSON 存档往返；两个内容层 API 面都暴露这些方法。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './core-fixture.mjs'
import {
  placeLocation, removeLocation, relocateInvestigator, relocateEnemy,
} from '../src/engine/engine.js'
import { removeLocationFromGame, swapLocationInPlay } from '../src/engine/location-swap.js'
import { createScenarioRuntime } from '../src/engine/scenario-runtime.js'
import { createMiscApi } from '../src/engine/api-misc.js'

const SWAP_DEPS = { placeLocation, removeLocation, relocateInvestigator, relocateEnemy }

// engine.js 的 discardEnemyCard 是内部函数（未导出）；按它的实现复刻：解除交战 → 移出 state.enemies
// → 进遭遇弃牌堆（弱点是持有者弃牌堆）。本测试只验证 location-swap 的调用约定与结果形状。
function discardEnemyCardForTest(state, enemy) {
  if (!state.enemies.includes(enemy)) return
  if (enemy.engagedSeat != null) {
    const owner = state.investigators[enemy.engagedSeat]
    owner.engaged = (owner.engaged || []).filter(id => id !== enemy.id)
    enemy.engagedSeat = null
  }
  state.enemies = state.enemies.filter(candidate => candidate !== enemy)
  state.encounterDiscard.push(String(enemy.code))
}

function locationDefinition(state, id, code, extra = {}) {
  return {
    id, code, originalCode: code, name: extra.name || `地点${code}`,
    shroud: 2, cluesPerInvestigator: 0, ...extra,
  }
}

function swapFixture(options = {}) {
  const state = fixture('01001', 2)
  state.locations = []
  state.enemies = []
  state.storyAssets = []
  state.scenarioZones = { setAside: [String(options.setAsideCode || '05133'), '05150'] }
  state.scenario = {
    ...state.scenario,
    locations: {
      ...(state.scenario?.locations || {}),
      walterGilmansRoom: locationDefinition(state, 'walterGilmansRoom', '05132', {
        name: '沃尔特·吉尔曼的房间', symbols: { front: { symbol: 'square', links: [] } }, connections: [],
      }),
      keziahsRoom: locationDefinition(state, 'keziahsRoom', '05133', {
        name: '凯夏的房间', spectral: true, haunted: [{ text: '闹鬼：弃到巫术卡并抽取。' }],
        symbols: { front: { symbol: 'square', links: [] } }, connections: [],
      }),
    },
  }
  state.locations.push({
    id: 'otherRoom', code: '05141', originalCode: '05141', name: '其他地点',
    revealed: true, clues: 0, doom: 0, maxClues: 0, connections: [],
  })
  const oldLocation = {
    id: 'walterGilmansRoom', code: '05132', originalCode: '05132', name: '沃尔特·吉尔曼的房间',
    revealed: options.oldRevealed !== false, clues: 2, doom: 1, maxClues: 2,
    attachments: ['05093'], beneath: ['05142'],
    symbols: { front: { symbol: 'square', links: [] } }, connections: ['otherRoom'],
  }
  state.locations.push(oldLocation)
  for (const inv of state.investigators) inv.location = 'walterGilmansRoom'
  const enemy = {
    id: 'e1', code: '05090', originalCode: '05090', name: '女巫集会学徒',
    location: 'walterGilmansRoom', engagedSeat: null,
  }
  state.enemies.push(enemy)
  state.playerLocationAttachments = [{ location: 'walterGilmansRoom', code: '05146', ownerSeat: 0 }]
  const events = []
  const next = swapLocationInPlay(state, events, 'walterGilmansRoom', 'keziahsRoom', options.swapOptions || {}, SWAP_DEPS)
  return { state, events, next, enemy, oldLocation }
}

test('P2-6 swapLocation：保留 revealed/线索/毁灭/附属，搬占位者，消耗放一边，旧地点静默离场', () => {
  const { state, events, next, enemy, oldLocation } = swapFixture({
    swapOptions: { reveal: 'revealed' },
  })
  assert.ok(next, '换地点应成功')
  assert.equal(next.id, 'keziahsRoom')
  assert.equal(next.revealed, true)
  assert.equal(next.clues, 2)
  assert.equal(next.maxClues, 2)
  assert.equal(next.doom, 1)
  assert.deepEqual(next.attachments, ['05093'])
  assert.deepEqual(next.beneath, ['05142'])
  assert.equal(next.spectral, true, '新地点保留定义里的 spectral')
  assert.ok(Array.isArray(next.haunted) && next.haunted.length) // 定义里的闹鬼数据跟着入场
  // 旧地点上的卡牌/压牌是「移动」不是复制：旧实例离场时不能把同一张卡再弃一次。
  assert.deepEqual(oldLocation.attachments, [])
  assert.deepEqual(oldLocation.beneath, [])
  // 玩家卡的地点附属改挂到新地点。
  assert.equal(state.playerLocationAttachments[0].location, 'keziahsRoom')
  // 敌人 / 调查员随地点迁移。
  assert.equal(enemy.location, 'keziahsRoom')
  assert.deepEqual(state.investigators.map(inv => inv.location), ['keziahsRoom', 'keziahsRoom'])
  // 新地点卡号从「放一边」取走一张；其他放一边卡不动。
  assert.deepEqual(state.scenarioZones.setAside, ['05150'])
  // 旧地点不再在场；「进入游戏」日志保留，但没有「被移出游戏」日志（静默离场）。
  assert.equal(state.locations.some(location => location.id === 'walterGilmansRoom'), false)
  assert.equal(state.locations.some(location => location.id === 'keziahsRoom'), true)
  assert.ok(state.log.some(line => line.includes('凯夏的房间') && line.includes('进入游戏')))
  assert.equal(state.log.some(line => line.includes('被移出游戏')), false)
  // events 也拿到了日志（内容层返回值形状不变）。
  assert.ok(Array.isArray(events))
  // 存档往返：地点数组形状是纯 JSON。
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.locations.map(location => location.id), state.locations.map(location => location.id))
  assert.equal(restored.locations.find(location => location.id === 'keziahsRoom').attachments[0], '05093')
})

test('P2-6 swapLocation：默认保留旧地点的未揭示状态；非法入参返回 null', () => {
  // 不搬占位者时才能观察到「保留 revealed」本身；搬调查员进入未揭示地点会按引擎的入场规则
  // 自动揭示新地点（relocateInvestigator → revealLocation），这与 05125 迁移前的行为一致。
  const hidden = swapFixture({ oldRevealed: false, swapOptions: { moveOccupants: false } })
  assert.equal(hidden.next.revealed, false, '默认 keep：旧地点未揭示，新地点也未揭示')
  const moved = swapFixture({ oldRevealed: false })
  assert.equal(moved.next.revealed, true, '调查员搬入未揭示地点后按入场规则揭示')

  const state = fixture('01001', 1)
  state.locations = []
  state.scenarioZones = { setAside: [] }
  state.scenario = {
    ...state.scenario,
    locations: { ...(state.scenario?.locations || {}), keziahsRoom: locationDefinition(state, 'keziahsRoom', '05133') },
  }
  assert.equal(swapLocationInPlay(state, [], 'nope', 'keziahsRoom', {}, SWAP_DEPS), null)
  assert.equal(swapLocationInPlay(state, [], 'walterGilmansRoom', 'nope', {}, SWAP_DEPS), null)
  assert.equal(swapLocationInPlay(state, [], 'keziahsRoom', 'keziahsRoom', {}, SWAP_DEPS), null)
  // 新地点已经在场：不重复入场。
  state.locations.push({ id: 'keziahsRoom', code: '05133', originalCode: '05133', name: '凯夏的房间' })
  assert.equal(swapLocationInPlay(state, [], 'keziahsRoom', 'keziahsRoom', {}, SWAP_DEPS), null)
})

function removalFixture() {
  const state = fixture('01001', 2)
  state.locations = [
    { id: 'roomA', code: '05141', originalCode: '05141', name: '献祭场所', revealed: true, clues: 0, doom: 0, maxClues: 0, connections: [] },
    { id: 'roomB', code: '05132', originalCode: '05132', name: '保留的房间', revealed: true, clues: 0, doom: 0, maxClues: 0, connections: [] },
  ]
  state.enemies = [
    { id: 'e1', code: '05090', originalCode: '05090', name: '敌人A', location: 'roomA', engagedSeat: null },
    { id: 'e2', code: '05090', originalCode: '05090', name: '敌人B', location: 'roomB', engagedSeat: null },
  ]
  state.playerLocationAttachments = [{ location: 'roomA', code: '05146', ownerSeat: 0 }]
  return state
}

const REMOVE_DEPS = { removeLocation, discardEnemyCard: discardEnemyCardForTest }

test('P2-6 removeLocationFromGame：敌人进遭遇弃牌堆、日志与 api.remove 一致、可无目标', () => {
  const state = removalFixture()
  assert.equal(removeLocationFromGame(state, [], 'nope', {}, REMOVE_DEPS), null)
  const removed = removeLocationFromGame(state, [], 'roomA', {}, REMOVE_DEPS)
  assert.equal(removed.id, 'roomA')
  assert.equal(state.locations.some(location => location.id === 'roomA'), false)
  assert.deepEqual(state.locations.map(location => location.id), ['roomB'])
  assert.equal(state.enemies.map(enemy => enemy.location).join(','), 'roomB', '只弃掉被移除地点上的敌人')
  assert.deepEqual(state.encounterDiscard, ['05090'])
  assert.ok(state.log.some(line => line.includes('献祭场所') && line.includes('被移出游戏')))
  // 默认保持现状：玩家卡地点附属不随地点离场处理。
  assert.equal(state.playerLocationAttachments[0].location, 'roomA')

  // 显式选项：玩家卡地点附属随地点离场进控制者弃牌堆。
  const discardState = removalFixture()
  removeLocationFromGame(discardState, [], 'roomA', { discardPlayerAttachments: true }, REMOVE_DEPS)
  assert.equal(discardState.playerLocationAttachments.length, 0)
  assert.ok(discardState.investigators[0].discard.includes('05146'))
})

test('P2-6 内容层接口：scenarioRuntime / 能力 API 都暴露地点原语', () => {
  const proxy = new Proxy({}, { get: () => () => undefined })
  const runtime = createScenarioRuntime(proxy)({}, [], null)
  for (const key of ['swapLocation', 'removeLocationFromGame', 'takeFromSetAside', 'shuffleIntoEncounterDeck']) {
    assert.equal(typeof runtime[key], 'function', `scenarioRuntime.${key}`)
  }
  const misc = createMiscApi(proxy, proxy, proxy)
  for (const key of ['swapLocation', 'removeLocationFromGame']) {
    assert.equal(typeof misc[key], 'function', `api-misc.${key}`)
  }
})
