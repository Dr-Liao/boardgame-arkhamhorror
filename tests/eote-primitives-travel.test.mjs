// 七循环《地球边缘》P2 原语组 E 的 Node 验收：
//   location.vertical（Level 高度层）/ scenario.climb（攀登）/
//   location.grid + scenario.cityVote（城市格网）/ scenario.tekeliDeck（忒咳哩-哩牌库）。
// 覆盖：正常路径、负面路径、JSON 存档往返、隐藏信息、注入洗牌的可重放确定性、边界（跨级/非法传送/牌库不足）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  levelNeighbors, levelsOrdered, locationLevel, setLocationLevel, validateEoteLevels, verticalIndexOf,
} from '../src/engine/vertical-chain.js'
import {
  ascend, climbDestinationError, climbState, cluesLostOnMove, descend, dropExpeditionAssets, fallDamage,
  validateEoteClimb,
} from '../src/engine/eote-climb.js'
import {
  cityscapeConfig, cityscapeOf, configureCityscapes, configureGrid, connectGrid, connectGridPair, expandGridFrom,
  gridLocations, gridPosition, lookColumn, lookRow, moveAcrossGrid, placeGridLocation, revealedGrid, teleportGrid,
  validateEoteCityscape,
} from '../src/engine/grid-map.js'
import {
  cityscapes, initializeCity, keyOnLocation, moveKey, placeKey, swapKeys, takeKey, validateEoteCity,
  visibleOnColumn, visibleOnRow,
} from '../src/engine/eote-city.js'
import {
  createScenarioDeckApi, drawFromScenarioDeck, returnToScenarioDeckBottom, scenarioDeckSize,
  shuffleTopIntoInvestigatorDeck, validateEoteDecks,
} from '../src/engine/scenario-decks.js'
import {
  initializeTekeliDeck, tekeliDeckSize, tekeliDraw, tekeliReturn, tekeliShuffleIn, TEKELI_CARD_COUNT,
  TEKELI_DECK_ID, TEKELI_PRINT_COPIES, validateEoteTekeli,
} from '../src/engine/eote-tekeli.js'

const roundTrip = value => JSON.parse(JSON.stringify(value))
const identityShuffle = cards => [...cards]
const reverseShuffle = cards => [...cards].reverse()

// ---------------------------------------------------------------------------
// 高度层 fixture：0 → 1 → 2 的斜线，peak-0 额外连到 peak-2（用于「跨两层」非法跳跃）。
// ---------------------------------------------------------------------------
function peaksState() {
  return {
    rngState: 12345,
    scenarioFlags: {},
    numInvestigators: 2,
    investigators: [
      {
        seat: 0, name: 'A', location: 'peak-0', clues: 3, deck: ['c1', 'c2'], discard: [],
        assets: [{ id: 'asset-1', code: '08035' }, { id: 'asset-2', code: '08036' }],
      },
      { seat: 1, name: 'B', location: 'peak-1', clues: 0, deck: [], discard: [], assets: [] },
    ],
    locations: [
      { id: 'peak-0', code: '08600', name: 'Level 0', level: 0, revealed: true, connections: ['peak-1', 'peak-2'] },
      { id: 'peak-1', code: '08601', name: 'Level 1', level: 1, revealed: true, connections: ['peak-0', 'peak-2', 'peak-1b'] },
      { id: 'peak-2', code: '08602', name: 'Level 2', level: 2, revealed: false, connections: ['peak-1'] },
      { id: 'peak-1b', code: '08603', name: 'Level 1b', level: 1, revealed: false, connections: ['peak-1'] },
      { id: 'summit', code: '08607', name: 'Summit', level: 5, revealed: false, connections: [] },
      { id: 'plateau', code: '08606', name: 'Plateau', revealed: false, connections: [] },
    ],
  }
}

test('locationLevel：接受地点对象或 (状态, 地点 id)，0 是合法 Level，未声明返回 null', () => {
  const state = peaksState()
  assert.equal(locationLevel(state.locations[0]), 0)
  assert.equal(locationLevel(state, 'peak-2'), 2)
  assert.equal(locationLevel(state, 'plateau'), null)
  assert.equal(locationLevel(state, 'missing'), null)
  assert.equal(locationLevel(null), null)
  assert.equal(locationLevel({ id: 'x' }), null)
  // 只读：不补写字段
  assert.equal('level' in state.locations[5], false)
})

test('setLocationLevel：写入非负整数，非法参数抛错且不写', () => {
  const location = { id: 'x' }
  assert.equal(setLocationLevel(location, 0), 0)
  assert.equal(location.level, 0)
  assert.equal(setLocationLevel(location, 4), 4)
  assert.throws(() => setLocationLevel(location, -1), /非负整数/)
  assert.throws(() => setLocationLevel(location, 1.5), /非负整数/)
  assert.throws(() => setLocationLevel(null, 1), /地点必须是对象/)
  assert.equal(location.level, 4)
})

test('levelsOrdered：按 Level 升序，未声明 Level 的排最后且保持输入顺序；接受数组或状态', () => {
  const state = peaksState()
  assert.deepEqual(levelsOrdered(state).map(loc => loc.id), ['peak-0', 'peak-1', 'peak-1b', 'peak-2', 'summit', 'plateau'])
  assert.deepEqual(levelsOrdered(null), [])
  assert.deepEqual(levelsOrdered([{ id: 'x' }, { id: 'a', level: 1 }, { id: 'b', level: 0 }]).map(loc => loc.id), ['b', 'a', 'x'])
})

test('levelNeighbors：按既有 connections 分 above/below/sameLevel；未知/无 Level 返回空分组', () => {
  const state = peaksState()
  assert.deepEqual(levelNeighbors(state, 'peak-1'), { above: ['peak-2'], below: ['peak-0'], sameLevel: ['peak-1b'] })
  assert.deepEqual(levelNeighbors(state, 'plateau'), { above: [], below: [], sameLevel: [] })
  assert.deepEqual(levelNeighbors(state, 'missing'), { above: [], below: [], sameLevel: [] })
})

test('validateEoteLevels：合法通过；非法 Level 抛错；未声明不算错误；TDE verticalIndex API 不受影响', () => {
  const state = peaksState()
  assert.equal(validateEoteLevels(state), true)
  assert.equal(validateEoteLevels(state, []), true)
  state.locations[0].level = -1
  assert.throws(() => validateEoteLevels(state), /Level 无效/)
  // 既有 TDE API 仍按原语义工作
  assert.equal(verticalIndexOf({ verticalIndex: 2 }), 2)
  assert.equal(verticalIndexOf({}), null)
})

test('climbDestinationError：连接 + Level 差恰为 ±1 才合法；跨级/不连接/同层/缺 Level 各有错误', () => {
  const state = peaksState()
  assert.equal(climbDestinationError(state, 'peak-0', 'peak-1'), null)
  assert.equal(climbDestinationError(state, 'peak-1', 'peak-0'), null)
  assert.match(climbDestinationError(state, 'peak-0', 'peak-2'), /只能攀爬相邻高度/)
  assert.match(climbDestinationError(state, 'peak-0', 'summit'), /不直接相连/)
  assert.match(climbDestinationError(state, 'peak-0', 'peak-0'), /原地/)
  assert.match(climbDestinationError(state, 'missing', 'peak-1'), /起点地点不存在/)
  assert.match(climbDestinationError(state, 'peak-1', 'missing'), /目标地点不存在/)
  assert.match(climbDestinationError(state, 'peak-1', 'plateau'), /没有声明 Level/)
  assert.match(climbDestinationError(state, 'peak-1', 'peak-1b'), /同层移动/)
  assert.throws(() => climbDestinationError(state, 1, 'peak-1'), /起点/)
  assert.throws(() => climbDestinationError(state, 'peak-1', null), /目标/)
})

test('ascend：返回 enterFromBelow 的 transition 并记录瞬时标记；不做实际位移', () => {
  const state = peaksState()
  const result = ascend(state, state.investigators[0], 'peak-1')
  assert.deepEqual(result, {
    seat: 0, from: 'peak-0', to: 'peak-1', fromLevel: 0, toLevel: 1, direction: 'up', enterFromBelow: true,
  })
  assert.equal(state.investigators[0].location, 'peak-0', '位移仍由权威移动管线执行')
  assert.deepEqual(climbState(state), {
    version: 1,
    seats: { 0: { from: 'peak-0', to: 'peak-1', fromLevel: 0, toLevel: 1, direction: 'up', enterFromBelow: true } },
  })
  assert.equal(validateEoteClimb(state), true)
})

test('ascend/descend：非法游戏状态返回 false 且不写标记（无部分写入）', () => {
  const state = peaksState()
  assert.equal(ascend(state, state.investigators[0], 'peak-2'), false, '跨两层')
  assert.equal(ascend(state, state.investigators[0], 'peak-0'), false, '原地')
  assert.equal(ascend(state, state.investigators[1], 'peak-0'), false, '向上要求 Level +1')
  assert.equal(descend(state, state.investigators[1], 'peak-2'), false, '向下要求 Level −1')
  assert.equal(climbState(state), null, '失败不初始化也不写状态')
  assert.equal(state.scenarioFlags.mechanics, undefined)
})

test('descend：下行 transition direction=down、enterFromBelow=false；JSON 往返后校验与读点保持', () => {
  const state = peaksState()
  const result = descend(state, state.investigators[1], 'peak-0')
  assert.deepEqual(result, {
    seat: 1, from: 'peak-1', to: 'peak-0', fromLevel: 1, toLevel: 0, direction: 'down', enterFromBelow: false,
  })
  const restored = roundTrip(state)
  assert.equal(validateEoteClimb(restored), true)
  assert.equal(climbState(restored).seats['1'].direction, 'down')
  assert.equal(climbState(restored).seats['1'].enterFromBelow, false)
})

test('climbState：从未使用返回 null 且不创建容器/字段', () => {
  const state = { locations: [] }
  assert.equal(climbState(state), null)
  assert.equal(state.scenarioFlags, undefined)
  assert.equal(JSON.stringify(state), '{"locations":[]}')
})

test('fallDamage：向下按层差换算、向上/同层为 0；非法 Level 抛错', () => {
  const state = peaksState()
  assert.equal(fallDamage(state, 3, 1), 2)
  assert.equal(fallDamage(state, 1, 4), 0)
  assert.equal(fallDamage(state, 2, 2), 0)
  assert.throws(() => fallDamage(state, -1, 1), /非负整数/)
  assert.throws(() => fallDamage(state, 1.5, 1), /非负整数/)
})

test('cluesLostOnMove：默认归还全部线索，clueCount 可限制上限；不改写 inv.clues', () => {
  const state = peaksState()
  assert.equal(cluesLostOnMove(state, state.investigators[0]), 3)
  assert.equal(cluesLostOnMove(state, state.investigators[0], { clueCount: 2 }), 2)
  assert.equal(cluesLostOnMove(state, state.investigators[0], { clueCount: 9 }), 3)
  assert.equal(cluesLostOnMove(state, state.investigators[1]), 0)
  assert.equal(state.investigators[0].clues, 3, '只读换算，归还走权威线索入口')
  assert.throws(() => cluesLostOnMove(state, state.investigators[0], { clueCount: -1 }), /非负整数/)
  assert.throws(() => cluesLostOnMove(state, { seat: 9 }, {}), /无效调查员座位/)
})

test('dropExpeditionAssets：返回掉落记录（含地点），不改动 assets；非法状态返回 false', () => {
  const state = peaksState()
  const records = dropExpeditionAssets(state, state.investigators[0], { assetIds: ['asset-1'] })
  assert.deepEqual(records, [{ assetId: 'asset-1', code: '08035', location: 'peak-0', seat: 0 }])
  assert.equal(state.investigators[0].assets.length, 2, '支援不在这里被搬动')
  assert.deepEqual(dropExpeditionAssets(state, state.investigators[0]), [])
  assert.deepEqual(dropExpeditionAssets(state, state.investigators[0], { assetIds: [] }), [])
  assert.equal(dropExpeditionAssets(state, state.investigators[0], { assetIds: ['missing'] }), false)
  assert.deepEqual(
    dropExpeditionAssets(state, state.investigators[0], { assetIds: ['asset-1', 'asset-2'] }).map(item => item.assetId),
    ['asset-1', 'asset-2'],
  )
  assert.throws(() => dropExpeditionAssets(state, state.investigators[0], { assetIds: ['asset-1', 'asset-1'] }), /重复/)
  assert.throws(() => dropExpeditionAssets(state, state.investigators[0], { assetIds: [1] }), /assetIds/)
})

test('validateEoteClimb：坏版本/未知字段/方向或 Level 不自洽抛错；空值合法', () => {
  const state = peaksState()
  assert.equal(validateEoteClimb(state, null), true)
  ascend(state, state.investigators[0], 'peak-1')
  const valid = roundTrip(state)
  assert.equal(validateEoteClimb(valid), true)
  assert.throws(() => validateEoteClimb(state, { version: 2, seats: {} }), /版本/)
  assert.throws(() => validateEoteClimb(state, { version: 1, seats: {}, extra: true }), /未知字段/)
  assert.throws(() => validateEoteClimb(state, { version: 1, seats: { 0: { ...climbState(state).seats['0'], direction: 'sideways' } } }), /方向/)
  assert.throws(() => validateEoteClimb(state, { version: 1, seats: { 0: { ...climbState(state).seats['0'], toLevel: 4 } } }), /Level 与地点不一致/)
})

// ---------------------------------------------------------------------------
// 城市格网 fixture：2×2 城市景观，两个已揭示两个隐藏身份。
// ---------------------------------------------------------------------------
function gridState() {
  const state = {
    rngState: 777,
    scenarioFlags: {},
    numInvestigators: 2,
    investigators: [
      { seat: 0, name: 'A', location: 'land-a', deck: ['x'], discard: [], clues: 0, assets: [] },
      { seat: 1, name: 'B', location: 'land-b', deck: [], discard: [], clues: 0, assets: [] },
    ],
    locations: [
      { id: 'land-a', code: '08631', name: 'Ancient Planetarium', revealed: true, connections: [] },
      { id: 'land-b', code: '08632', name: 'Stone Bridge', hiddenIdentity: true, unrevealedActualName: 'Stone Bridge', originalCode: '08632', revealed: false, connections: [] },
      { id: 'land-c', code: '08633', name: 'Cylindrical Tower', hiddenIdentity: true, unrevealedActualName: 'Cylindrical Tower', originalCode: '08633', revealed: false, connections: [] },
      { id: 'land-d', code: '08635', name: 'Map Room', revealed: true, connections: [] },
    ],
  }
  const positions = [['land-a', 0, 0], ['land-b', 1, 0], ['land-c', 0, 1], ['land-d', 1, 1]]
  for (const [id, column, row] of positions) placeGridLocation(state, id, column, row, {})
  configureCityscapes(state, { rows: 2, columns: 2 })
  return state
}

test('既有网格 API 保持兼容：gridPosition/gridLocations/connectGrid 行为不变（新导出只叠加）', () => {
  const state = gridState()
  assert.deepEqual(gridPosition(state, 'land-b'), { x: 1, y: 0, isolated: false })
  assert.equal(gridPosition(state, 'missing'), null)
  assert.deepEqual(gridLocations(state, { row: 0 }).map(loc => loc.id), ['land-a', 'land-b'])
  assert.deepEqual(gridLocations(state, { column: 1 }).map(loc => loc.id), ['land-b', 'land-d'])
  // 正交邻接：land-a(x0,y0) 连接 land-b(x1,y0) 与 land-c(x0,y1)
  const a = state.locations.find(loc => loc.id === 'land-a')
  assert.deepEqual([...a.connections].sort(), ['land-b', 'land-c'])
  for (const name of ['configureGrid', 'connectGrid', 'connectGridPair', 'expandGridFrom', 'placeGridLocation', 'gridLocations', 'gridPosition']) {
    assert.equal(typeof { configureGrid, connectGrid, connectGridPair, expandGridFrom, placeGridLocation, gridLocations, gridPosition }[name], 'function')
  }
})

test('configureCityscapes：返回归一布局，重复同布局幂等，不同布局抛错，非法参数抛错', () => {
  const state = gridState()
  const config = cityscapeConfig(state)
  assert.deepEqual(config, {
    version: 1,
    rows: 2,
    columns: 2,
    plots: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1, column: 1 }],
  })
  assert.deepEqual(configureCityscapes(state, { rows: 2, columns: 2 }), config, '同布局幂等')
  assert.throws(() => configureCityscapes(state, { rows: 3, columns: 3 }), /不能改成不同布局/)
  assert.throws(() => configureCityscapes({}, { rows: 0, columns: 2 }), /合法整数/)
  assert.throws(() => configureCityscapes({}, { rows: 2, columns: 2, layout: [{ row: 3, column: 0 }] }), /越界/)
  assert.throws(() => configureCityscapes({}, { rows: 2, columns: 2, layout: [{ row: 0, column: 0 }, { row: 0, column: 0 }] }), /重复/)
  assert.equal(cityscapeConfig({ scenarioFlags: {} }), null)
  assert.deepEqual(roundTrip(cityscapeConfig(state)), config, '布局随 JSON 存档往返')
  assert.equal(validateEoteCityscape(state), true)
  assert.equal(validateEoteCityscape(state, null), true)
  assert.throws(() => validateEoteCityscape(state, { ...config, plots: [{ row: 9, column: 0 }] }), /越界/)
})

test('cityscapeOf：返回格坐标；未上网格/非城市景观/未知返回 null', () => {
  const state = gridState()
  assert.deepEqual(cityscapeOf(state, 'land-d'), { row: 1, column: 1 })
  assert.equal(cityscapeOf(state, 'missing'), null)
  assert.equal(cityscapeOf({ scenarioFlags: {} }, 'land-a'), null)
  assert.throws(() => cityscapeOf(state, 3), /地点 id/)
})

test('revealedGrid/lookRow/lookColumn：公开投影只含已揭示地点，不泄露隐藏身份', () => {
  const state = gridState()
  const revealed = revealedGrid(state)
  assert.deepEqual(revealed.map(item => item.locationId), ['land-a', 'land-d'])
  assert.deepEqual(revealed[0], { locationId: 'land-a', row: 0, column: 0, code: '08631', name: 'Ancient Planetarium' })
  const row = lookRow(state, 0)
  assert.deepEqual(row.map(item => item.locationId), ['land-a'], '未揭示的 land-b 整个省略')
  assert.equal(JSON.stringify(row).includes('Stone Bridge'), false)
  assert.equal(JSON.stringify(row).includes('08632'), false)
  assert.deepEqual(lookColumn(state, 1).map(item => item.locationId), ['land-d'])
  assert.deepEqual(lookRow(state, 5), [])
  assert.throws(() => lookRow(state, -1), /合法整数/)
})

test('teleportGrid：目标必须已入场且在网格上；from/mode 关系校验；非法参数抛错', () => {
  const state = gridState()
  assert.deepEqual(teleportGrid(state, 'land-d'), { from: null, to: 'land-d', mode: 'any', row: 1, column: 1 })
  assert.deepEqual(teleportGrid(state, 'land-b', { fromId: 'land-a', mode: 'row' }), {
    from: 'land-a', to: 'land-b', mode: 'row', row: 0, column: 1,
  })
  assert.equal(teleportGrid(state, 'land-d', { fromId: 'land-a', mode: 'row' }), false)
  assert.equal(teleportGrid(state, 'missing'), false)
  assert.equal(teleportGrid(state, 'land-a', { fromId: 'missing', mode: 'any' }), false)
  assert.throws(() => teleportGrid(state, ''), /传送目标/)
  assert.throws(() => teleportGrid(state, 'land-a', { mode: 'diagonal' }), /传送规则/)
})

test('moveAcrossGrid：默认只允许同行/同列，requireRevealed 收紧目标；非法游戏状态返回 false', () => {
  const state = gridState()
  assert.deepEqual(moveAcrossGrid(state, 'land-a', 'land-b'), {
    from: 'land-a', to: 'land-b', mode: 'rowOrColumn', row: 0, column: 1, sameRow: true, sameColumn: false,
  })
  assert.equal(moveAcrossGrid(state, 'land-a', 'land-b', { requireRevealed: true }), false, 'land-b 未揭示')
  assert.equal(moveAcrossGrid(state, 'land-a', 'land-d'), false, '对角不允许')
  assert.equal(moveAcrossGrid(state, 'land-a', 'land-a'), false)
  assert.equal(moveAcrossGrid(state, 'land-a', 'missing'), false)
  assert.deepEqual(moveAcrossGrid(state, 'land-a', 'land-d', { mode: 'any' }).to, 'land-d')
  assert.throws(() => moveAcrossGrid(state, 'land-a', 'land-b', { mode: 'diagonal' }), /行列移动规则/)
})

// ---------------------------------------------------------------------------
// 古城初始化 fixture：16 张城市景观的缩影（4 张），分配由注入洗牌决定。
// ---------------------------------------------------------------------------
function cityInitState() {
  const locations = ['land-a', 'land-b', 'land-c', 'land-d'].map(id => ({
    id, code: `code-${id}`, name: `公开背面 ${id}`, hiddenIdentity: true,
    unrevealedActualName: `揭示面 ${id}`, originalCode: `real-${id}`, revealed: false, connections: [],
  }))
  return {
    rngState: 999,
    scenarioFlags: {},
    numInvestigators: 2,
    investigators: [
      { seat: 0, name: 'A', location: 'land-a', deck: ['d1'], discard: [], clues: 0, assets: [] },
      { seat: 1, name: 'B', location: 'land-b', deck: [], discard: [], clues: 0, assets: [] },
    ],
    locations,
  }
}

const citySpec = () => {
  const pool = ['land-a', 'land-b', 'land-c', 'land-d']
  return {
    cityscapes: [
      { row: 0, column: 0, locationIds: pool },
      { row: 0, column: 1, locationIds: pool },
      { row: 1, column: 0, locationIds: pool },
      { row: 1, column: 1, locationIds: pool },
    ],
    keys: ['key-0', 'key-1', 'key-2', 'key-3'],
  }
}

test('initializeCity：注入洗牌后随机分配 4 个城市景观并放上网格；返回受信任读点', () => {
  const state = cityInitState()
  const result = initializeCity(state, citySpec(), { shuffle: identityShuffle })
  assert.equal(result.placed, 4)
  assert.deepEqual(result.cityscapes.map(item => item.locationId), ['land-a', 'land-b', 'land-c', 'land-d'])
  assert.deepEqual(cityscapes(state).map(item => item.locationId), ['land-a', 'land-b', 'land-c', 'land-d'])
  assert.deepEqual(cityscapeOf(state, 'land-c'), { row: 1, column: 0 })
  assert.equal(gridPosition(state, 'land-d').y, 1)
  assert.deepEqual(result.keys, { 'land-a': 'key-0', 'land-b': 'key-1', 'land-c': 'key-2', 'land-d': 'key-3' })
  // 城市景观按正交邻接互连（与既有 connectGrid 语义一致）
  const a = state.locations.find(loc => loc.id === 'land-a')
  assert.deepEqual([...a.connections].sort(), ['land-b', 'land-c'])
  assert.equal(validateEoteCity(state), true)
  assert.equal(validateEoteCityscape(state), true)
})

test('initializeCity：重复初始化抛错；候选不足/钥匙过多/坏洗牌回调返回 false 且不写状态', () => {
  const state = cityInitState()
  initializeCity(state, citySpec(), { shuffle: identityShuffle })
  assert.throws(() => initializeCity(state, citySpec(), { shuffle: identityShuffle }), /已经初始化/)

  const pool = ['only-one']
  const insufficient = cityInitState()
  insufficient.locations.push({ id: 'only-one', code: 'x', name: 'x', revealed: false, connections: [] })
  const before = JSON.stringify(insufficient)
  assert.equal(initializeCity(insufficient, {
    cityscapes: [
      { row: 0, column: 0, locationIds: pool },
      { row: 0, column: 1, locationIds: pool },
    ],
  }, { shuffle: identityShuffle }), false)
  assert.equal(JSON.stringify(insufficient), before, '失败不写状态（无部分写入）')

  const tooManyKeys = cityInitState()
  const spec = citySpec()
  spec.keys = ['k0', 'k1', 'k2', 'k3', 'k4']
  assert.equal(initializeCity(tooManyKeys, spec, { shuffle: identityShuffle }), false)
  assert.equal(tooManyKeys.scenarioFlags.mechanics, undefined)

  const badShuffle = cityInitState()
  assert.throws(() => initializeCity(badShuffle, citySpec(), { shuffle: () => ['land-a'] }), /洗牌回调/)
  assert.equal(badShuffle.scenarioFlags.mechanics, undefined)

  assert.throws(() => initializeCity(cityInitState(), { cityscapes: [{ row: 0, column: 0, locationIds: ['x', 'x'] }] }), /不能重复/)
})

test('initializeCity 可重放：相同注入洗牌得到相同分配；逆序洗牌得到相反分配', () => {
  const first = cityInitState()
  const second = cityInitState()
  initializeCity(first, citySpec(), { shuffle: identityShuffle })
  initializeCity(second, citySpec(), { shuffle: identityShuffle })
  assert.deepEqual(cityscapes(first), cityscapes(second))
  const reversed = cityInitState()
  initializeCity(reversed, citySpec(), { shuffle: reverseShuffle })
  assert.deepEqual(cityscapes(reversed).map(item => item.locationId), ['land-d', 'land-c', 'land-b', 'land-a'])
})

test('visibleOnRow/Column：公开模式只给已揭示；传 seat 才是私密窥视（含揭示面身份）', () => {
  const state = cityInitState()
  initializeCity(state, citySpec(), { shuffle: identityShuffle })
  state.locations.find(loc => loc.id === 'land-a').revealed = true
  const publicRow = visibleOnRow(state, 0)
  assert.deepEqual(publicRow.map(item => item.locationId), ['land-a'])
  assert.equal(JSON.stringify(publicRow).includes('land-b'), false, '公开投影不得暴露隐藏分配')
  assert.equal(JSON.stringify(publicRow).includes('揭示面 land-b'), false)
  const peekRow = visibleOnRow(state, 0, { seat: 0 })
  assert.deepEqual(peekRow.map(item => item.locationId), ['land-a', 'land-b'])
  const peeking = peekRow.find(item => item.locationId === 'land-b')
  assert.equal(peeking.revealed, false)
  assert.equal(peeking.hidden, true)
  assert.equal(peeking.peek, true)
  assert.equal(peeking.name, '揭示面 land-b', '私密读点返回揭示面身份')
  assert.equal(peeking.code, 'real-land-b')
  assert.deepEqual(visibleOnColumn(state, 0).map(item => item.locationId), ['land-a'])
  assert.deepEqual(visibleOnColumn(state, 0, { seat: 1 }).map(item => item.locationId), ['land-a', 'land-c'])
  assert.deepEqual(visibleOnRow({ scenarioFlags: {} }, 0), [])
  assert.throws(() => visibleOnRow(state, 0, { seat: 9 }), /无效调查员座位/)
})

test('JSON 往返：城市分配/钥匙/布局读点与校验保持；重复读不补写字段', () => {
  const state = cityInitState()
  initializeCity(state, citySpec(), { shuffle: identityShuffle })
  const restored = roundTrip(state)
  assert.equal(validateEoteCity(restored), true)
  assert.equal(validateEoteCityscape(restored), true)
  assert.deepEqual(cityscapes(restored), cityscapes(state))
  assert.deepEqual(cityscapeConfig(restored), cityscapeConfig(state))
  assert.equal(keyOnLocation(restored, 'land-b'), 'key-1')
  assert.equal(visibleOnRow(restored, 0, { seat: 0 }).length, 2)
  assert.equal(cityscapes({ scenarioFlags: {} }), null)
  assert.equal(keyOnLocation({ scenarioFlags: {} }, 'land-a'), null)
  assert.equal(cityscapeConfig({ scenarioFlags: {} }), null)
})

test('钥匙簿记：keyOnLocation/placeKey/takeKey/moveKey/swapKeys 独立于其它模块', () => {
  const state = cityInitState()
  initializeCity(state, citySpec(), { shuffle: identityShuffle })
  assert.equal(keyOnLocation(state, 'land-a'), 'key-0')
  assert.equal(keyOnLocation(state, 'unknown'), null)
  assert.equal(takeKey(state, 'land-a'), 'key-0')
  assert.equal(keyOnLocation(state, 'land-a'), null)
  assert.equal(takeKey(state, 'land-a'), null)
  assert.equal(placeKey(state, 'land-a', 'key-0'), 'key-0')
  assert.equal(placeKey(state, 'land-a', 'key-9'), false, '已占用')
  assert.equal(placeKey(state, 'unknown', 'key-9'), false)
  assert.equal(placeKey(state, 'land-a', 'key-1'), false, '钥匙 id 必须唯一')
  assert.equal(takeKey(state, 'land-c'), 'key-2')
  assert.deepEqual(moveKey(state, 'land-b', 'land-c'), { keyId: 'key-1', from: 'land-b', to: 'land-c' })
  assert.equal(keyOnLocation(state, 'land-b'), null)
  assert.equal(keyOnLocation(state, 'land-c'), 'key-1')
  assert.equal(moveKey(state, 'land-b', 'land-c'), false)
  assert.equal(moveKey(state, 'land-a', 'land-c'), false, '目标已有钥匙')
  const swapped = swapKeys(state, 'land-a', 'land-c')
  assert.equal(keyOnLocation(state, 'land-a'), 'key-1')
  assert.equal(keyOnLocation(state, 'land-c'), 'key-0')
  assert.deepEqual(swapped, { 'land-a': 'key-1', 'land-c': 'key-0' })
  assert.equal(validateEoteCity(state), true)
})

test('validateEoteCity：坏版本/未知字段/重复坐标/钥匙挂错地点/存储缺失抛错', () => {
  const state = cityInitState()
  initializeCity(state, citySpec(), { shuffle: identityShuffle })
  assert.equal(validateEoteCity(state, null), true)
  assert.throws(() => validateEoteCity(state, { version: 9, cityscapes: [] }), /版本/)
  assert.throws(() => validateEoteCity(state, { version: 1, cityscapes: [], extra: 1 }), /未知字段/)
  const duplicated = roundTrip(state)
  duplicated.scenarioFlags.mechanics.eote.city.cityscapes[1].locationId = duplicated.scenarioFlags.mechanics.eote.city.cityscapes[0].locationId
  assert.throws(() => validateEoteCity(duplicated), /地点重复/)
  const misplacedKey = roundTrip(state)
  misplacedKey.scenarioFlags.mechanics.eote.city.keys['land-x'] = 'key-0'
  assert.throws(() => validateEoteCity(misplacedKey), /非城市景观/)
  const noDeck = { scenarioFlags: {}, locations: [] }
  assert.throws(() => validateEoteCity(noDeck, { version: 1, cityscapes: [{ row: 0, column: 0, locationId: 'gone' }] }), /不在场/)
})

// ---------------------------------------------------------------------------
// 剧本牌库隐藏洗牌原语 fixture。
// ---------------------------------------------------------------------------
function deckState() {
  return {
    rngState: 4242,
    scenarioFlags: {},
    locations: [{ id: 'l1', code: 'x', name: 'L1', revealed: true, connections: [] }],
    investigators: [
      { seat: 0, name: 'A', location: 'l1', deck: ['a1', 'a2'], discard: [], clues: 0, assets: [] },
      { seat: 1, name: 'B', location: 'l1', deck: [], discard: [], clues: 0, assets: [] },
    ],
  }
}

// deck 数组约定：尾部 = 牌库顶。底→顶：t1,t2,t3,t4。
function withDeck(cards = ['t1', 't2', 't3', 't4']) {
  const state = deckState()
  createScenarioDeckApi(state).initialize('testDeck', cards, { shuffle: false })
  return { state, api: createScenarioDeckApi(state) }
}

test('scenarioDeckSize：张数只读；未初始化抛 RangeError；与既有 createScenarioDeckApi 兼容', () => {
  const { state, api } = withDeck()
  assert.equal(scenarioDeckSize(state, 'testDeck'), 4)
  assert.equal(api.size('testDeck'), 4)
  assert.deepEqual(api.cards('testDeck'), ['t1', 't2', 't3', 't4'])
  assert.throws(() => scenarioDeckSize(state, 'unknownDeck'), /not initialized/)
  assert.throws(() => scenarioDeckSize(state, '../bad'), /Invalid scenario deck id/)
})

test('drawFromScenarioDeck：从顶抽出且不写日志；张数不足返回 false 不抽', () => {
  const { state } = withDeck()
  assert.deepEqual(drawFromScenarioDeck(state, 'testDeck', 2), ['t4', 't3'])
  assert.equal(scenarioDeckSize(state, 'testDeck'), 2)
  const before = JSON.stringify(state)
  assert.equal(drawFromScenarioDeck(state, 'testDeck', 3), false)
  assert.equal(JSON.stringify(state), before, '不足时整段不结算')
  assert.throws(() => drawFromScenarioDeck(state, 'testDeck', 0), /合法整数/)
})

test('shuffleTopIntoInvestigatorDeck：不看内容洗入、返回受信任 code、注入洗牌可重放', () => {
  const { state } = withDeck()
  const moved = shuffleTopIntoInvestigatorDeck(state, { deckId: 'testDeck', seat: 0, count: 2, shuffle: identityShuffle })
  assert.deepEqual(moved, ['t4', 't3'])
  assert.deepEqual(state.investigators[0].deck, ['a1', 'a2', 't4', 't3'])
  assert.equal(scenarioDeckSize(state, 'testDeck'), 2)
  // 逆序注入：整副调查员牌库被反转，但保留同一组牌
  const second = withDeck()
  shuffleTopIntoInvestigatorDeck(second.state, { deckId: 'testDeck', seat: 0, count: 1, shuffle: reverseShuffle })
  assert.deepEqual(second.state.investigators[0].deck, ['t4', 'a2', 'a1'])
  // 隐藏信息：不新增 cardsSeen / 日志等公开字段
  assert.equal(JSON.stringify(state).includes('cardsSeen'), false)
})

test('shuffleTopIntoInvestigatorDeck：非法座位/坏洗牌回调抛错；张数不足返回 false 且不写', () => {
  const { state } = withDeck()
  const before = JSON.stringify(state)
  assert.equal(shuffleTopIntoInvestigatorDeck(state, { deckId: 'testDeck', seat: 0, count: 9 }), false)
  assert.equal(JSON.stringify(state), before)
  assert.throws(() => shuffleTopIntoInvestigatorDeck(state, { deckId: 'testDeck', seat: 9, count: 1 }), /无效调查员座位/)
  assert.throws(() => shuffleTopIntoInvestigatorDeck(state, { deckId: 'testDeck', seat: 0, count: 1, shuffle: () => [] }), /shuffle 回调/)
  assert.equal(scenarioDeckSize(state, 'testDeck'), 4)
  assert.deepEqual(state.investigators[0].deck, ['a1', 'a2'])
})

test('shuffleTopIntoInvestigatorDeck：坏洗牌回调增删卡牌被拒绝且不写状态', () => {
  const { state } = withDeck()
  const before = JSON.stringify(state)
  assert.throws(
    () => shuffleTopIntoInvestigatorDeck(state, { deckId: 'testDeck', seat: 0, count: 1, shuffle: cards => [...cards, 'ghost'] }),
    /同一数量/,
  )
  assert.throws(
    () => shuffleTopIntoInvestigatorDeck(state, { deckId: 'testDeck', seat: 0, count: 1, shuffle: cards => cards.slice(1) }),
    /同一数量/,
  )
  assert.equal(JSON.stringify(state), before)
})

test('returnToScenarioDeckBottom：放回底部（codes[0] 为最底）；非法 code 抛错', () => {
  const { state } = withDeck()
  assert.equal(returnToScenarioDeckBottom(state, 'testDeck', ['t9']), 1)
  assert.equal(scenarioDeckSize(state, 'testDeck'), 5)
  assert.equal(state.scenarioFlags.mechanics.scenarioDecks.testDeck.deck[0], 't9')
  assert.equal(returnToScenarioDeckBottom(state, 'testDeck', []), 0)
  assert.throws(() => returnToScenarioDeckBottom(state, 'testDeck', ['']), /code/)
  assert.throws(() => returnToScenarioDeckBottom(state, 'unknownDeck', ['x']), /not initialized/)
})

test('validateEoteDecks：形状校验通过；坏记录抛错；JSON 往返保持', () => {
  const { state } = withDeck()
  assert.equal(validateEoteDecks(state), true)
  assert.equal(validateEoteDecks(state, null), true)
  const restored = roundTrip(state)
  assert.equal(validateEoteDecks(restored), true)
  assert.deepEqual(drawFromScenarioDeck(restored, 'testDeck', 1), ['t4'])
  assert.throws(() => validateEoteDecks(state, { bad: { deck: 'x' } }), /牌库/)
  assert.throws(() => validateEoteDecks(state, { Constructor: { deck: [], discard: [], removed: [] } }), /名称/)
})

// ---------------------------------------------------------------------------
// 忒咳哩-哩牌库 fixture：7 卡面 × 参考印刷份数 = 16 张。
// ---------------------------------------------------------------------------
const TEKELI_FACES = ['tee-1', 'tee-2', 'tee-3', 'tee-4', 'tee-5', 'tee-6', 'tee-7']

function tekeliState() {
  return {
    rngState: 2026,
    scenarioFlags: {},
    locations: [{ id: 'l1', code: 'x', name: 'L1', revealed: true, connections: [] }],
    investigators: [
      { seat: 0, name: 'A', location: 'l1', deck: ['p1'], discard: [], clues: 0, assets: [] },
      { seat: 1, name: 'B', location: 'l1', deck: [], discard: [], clues: 0, assets: [] },
    ],
  }
}

test('initializeTekeliDeck：7 卡面 × 印刷份数 3+3+2+2+2+2+2 = 16 张，元数据与牌堆一致', () => {
  const state = tekeliState()
  assert.equal(initializeTekeliDeck(state, { cards: TEKELI_FACES }), TEKELI_CARD_COUNT)
  assert.equal(TEKELI_CARD_COUNT, 16)
  assert.deepEqual([...TEKELI_PRINT_COPIES], [3, 3, 2, 2, 2, 2, 2])
  assert.equal(tekeliDeckSize(state), 16)
  const deck = state.scenarioFlags.mechanics.scenarioDecks[TEKELI_DECK_ID].deck
  assert.equal(deck.length, 16)
  for (const [index, code] of TEKELI_FACES.entries()) {
    assert.equal(deck.filter(item => item === code).length, TEKELI_PRINT_COPIES[index])
  }
  assert.equal(validateEoteTekeli(state), true)
  assert.throws(() => initializeTekeliDeck(state, { cards: TEKELI_FACES }), /已经初始化/)
})

test('initializeTekeliDeck：无条件洗牌走 randomValue；同一 rngState 可重放，负路径抛错不写状态', () => {
  const first = tekeliState()
  const second = tekeliState()
  initializeTekeliDeck(first, { cards: TEKELI_FACES })
  initializeTekeliDeck(second, { cards: TEKELI_FACES })
  assert.deepEqual(
    first.scenarioFlags.mechanics.scenarioDecks[TEKELI_DECK_ID].deck,
    second.scenarioFlags.mechanics.scenarioDecks[TEKELI_DECK_ID].deck,
    '同一随机种子的牌序一致',
  )
  const bad = tekeliState()
  assert.throws(() => initializeTekeliDeck(bad, { cards: TEKELI_FACES.slice(0, 6) }), /恰好 7 个卡面/)
  assert.throws(() => initializeTekeliDeck(bad, { cards: ['x', 'x'] }), /不能重复/)
  assert.throws(() => initializeTekeliDeck(bad, { cards: TEKELI_FACES, copies: [1] }), /一一对应/)
  assert.throws(() => initializeTekeliDeck(bad, { cards: TEKELI_FACES, copies: [0, 0, 0, 0, 0, 0, 0] }), /合法整数/)
  assert.equal(bad.scenarioFlags.mechanics, undefined)
})

test('tekeliShuffleIn：不看内容洗入、返回受信任 code；张数不足 false；未初始化 false', () => {
  const state = tekeliState()
  assert.equal(tekeliShuffleIn(state, 0, 1), false, '未初始化')
  initializeTekeliDeck(state, { cards: TEKELI_FACES })
  const top = state.scenarioFlags.mechanics.scenarioDecks[TEKELI_DECK_ID].deck.slice(-2).reverse()
  const moved = tekeliShuffleIn(state, 0, 2, { shuffle: identityShuffle })
  assert.deepEqual(moved, top)
  assert.equal(tekeliDeckSize(state), 14)
  assert.equal(state.investigators[0].deck.length, 3)
  assert.equal(state.investigators[0].deck.includes(moved[0]), true)
  assert.equal(JSON.stringify(state).includes('seen'), false, '洗入不产生查看记录')
  assert.equal(tekeliShuffleIn(state, 0, 99), false)
  assert.throws(() => tekeliShuffleIn(state, 5, 1), /无效调查员座位/)
})

test('tekeliDraw：从顶抽 1 张交给调用方；空牌库返回 false', () => {
  const state = tekeliState()
  initializeTekeliDeck(state, { cards: TEKELI_FACES })
  const top = state.scenarioFlags.mechanics.scenarioDecks[TEKELI_DECK_ID].deck.at(-1)
  assert.equal(tekeliDraw(state), top)
  assert.equal(tekeliDeckSize(state), 15)
  for (let index = 0; index < 15; index += 1) assert.notEqual(tekeliDraw(state), false)
  assert.equal(tekeliDeckSize(state), 0)
  assert.equal(tekeliDraw(state), false)
})

test("tekeliReturn：默认回牌库底；deck/anyDeck/discard 按座位去；非法去向/缺座位抛错", () => {
  const state = tekeliState()
  initializeTekeliDeck(state, { cards: TEKELI_FACES })
  assert.deepEqual(tekeliReturn(state, 'tee-1'), { code: 'tee-1', destination: 'bottom', seat: null })
  assert.equal(tekeliDeckSize(state), 17)
  assert.equal(state.scenarioFlags.mechanics.scenarioDecks[TEKELI_DECK_ID].deck[0], 'tee-1')
  assert.deepEqual(tekeliReturn(state, 'tee-2', { destination: 'deck', seat: 0 }), { code: 'tee-2', destination: 'deck', seat: 0 })
  assert.equal(state.investigators[0].deck[0], 'tee-2')
  assert.deepEqual(
    tekeliReturn(state, 'tee-3', { destination: 'anyDeck', seat: 1, shuffle: identityShuffle }),
    { code: 'tee-3', destination: 'anyDeck', seat: 1 },
  )
  assert.equal(state.investigators[1].deck.at(-1), 'tee-3')
  assert.deepEqual(tekeliReturn(state, 'tee-4', { destination: 'discard', seat: 0 }), { code: 'tee-4', destination: 'discard', seat: 0 })
  assert.equal(state.investigators[0].discard.includes('tee-4'), true)
  assert.throws(() => tekeliReturn(state, 'tee-5', { destination: 'void' }), /未知的忒咳哩-哩去向/)
  assert.throws(() => tekeliReturn(state, 'tee-5', { destination: 'deck' }), /座位/)
  assert.throws(() => tekeliReturn(state, ''), /code/)
  assert.throws(() => tekeliReturn(state, 'tee-5', { destination: 'anyDeck', seat: 0, shuffle: () => ['x'] }), /shuffle 回调/)
})

test('validateEoteTekeli：坏版本/份数不一致/牌堆缺失/未知卡面抛错；JSON 往返保持', () => {
  const state = tekeliState()
  initializeTekeliDeck(state, { cards: TEKELI_FACES })
  assert.equal(validateEoteTekeli(state, null), true)
  const restored = roundTrip(state)
  assert.equal(validateEoteTekeli(restored), true)
  assert.equal(tekeliDeckSize(restored), 16)
  assert.throws(() => validateEoteTekeli(state, { version: 9 }), /版本/)
  assert.throws(() => validateEoteTekeli(state, { ...roundTrip(state).scenarioFlags.mechanics.eote.tekeli, total: 15 }), /总张数/)
  const badCopies = roundTrip(state).scenarioFlags.mechanics.eote.tekeli
  badCopies.copies = [3, 3, 2]
  assert.throws(() => validateEoteTekeli(state, badCopies), /印刷份数/)
  const missingStorage = roundTrip(state)
  delete missingStorage.scenarioFlags.mechanics.scenarioDecks[TEKELI_DECK_ID]
  assert.throws(() => validateEoteTekeli(missingStorage), /存储缺失/)
  const foreign = tekeliState()
  initializeTekeliDeck(foreign, { cards: TEKELI_FACES })
  const decks = foreign.scenarioFlags.mechanics.scenarioDecks
  decks[TEKELI_DECK_ID].deck.push('not-a-tekeli-face')
  assert.throws(() => validateEoteTekeli(foreign), /未知卡面/)
})

test('JSON 往返 + 重复读：爬升/城市/牌库读点不因读档改变，未使用模块不新增字段', () => {
  const state = peaksState()
  ascend(state, state.investigators[0], 'peak-1')
  const restored = roundTrip(state)
  assert.deepEqual(climbState(restored), climbState(state))
  assert.equal(validateEoteClimb(restored), true)
  assert.equal(validateEoteLevels(restored), true)
  const plain = { locations: [{ id: 'a', level: 1 }], investigators: [] }
  assert.equal(validateEoteClimb(plain), true)
  assert.equal(validateEoteCity(plain), true)
  assert.equal(validateEoteTekeli(plain), true)
  assert.equal(validateEoteDecks(plain), true)
  assert.equal(validateEoteCityscape(plain), true)
  assert.equal(plain.scenarioFlags, undefined, '校验器只读，不初始化可选容器')
})
