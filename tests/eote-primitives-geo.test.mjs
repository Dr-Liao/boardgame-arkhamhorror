// 《地球边缘》P2-D 原语验收：地点庇护值 / 营地 / 古代设施与迷雾高塔 / 数值钥匙。
//
// 覆盖 P1 原语目录的 5 个 id：
//   · `location.shelter`（new）：印刷庇护值读数、上限、缺省 0、营地聚合；
//   · `scenario.camp`（new）：本关营地点、检查点已揭示地点继承（事务式）；
//   · `scenario.facility`（new）：设施激活/摧毁状态机；
//   · `scenario.sealTowers`（new）：高塔可攻击/伤害夹取/坍塌幂等/不透明封印放置；
//   · `scenario.keys`（extend）：数值钥匙 identity 与原子花费（与 TIC 彩色钥匙分离）。
//
// 只用轻量纯 JSON 状态（locations/investigators/scenarioFlags），不启动整局；
// 另做 structuredClone JSON 往返 + 各模块 validateEoteXxx 的存档校验断言。
import test from 'node:test'
import assert from 'node:assert/strict'
import { eoteScenarioState, validateEoteContainers } from '../src/engine/eote-state.js'
import { mechanicState, validateMechanicState } from '../src/engine/mechanic-state.js'
import {
  SHELTER_MAX, campShelter, locationShelter, readShelter, validateEoteShelter,
} from '../src/engine/eote-shelter.js'
import {
  campLocationId, campState, inheritRevealedLocations, recordRevealedLocation, revealedLocations,
  setCampLocation, validateEoteCamp,
} from '../src/engine/eote-camp.js'
import {
  activateFacility, collapsedTowers, damageTower, destroyFacility, facilityState, initializeFacilities,
  placeTowerSeal, removeTowerSeal, towerHealth, towerSeals, towerState, validateEoteFacilities,
} from '../src/engine/eote-facilities.js'
import {
  VALUE_KEY_FACES, VALUE_KEY_VALUE_LIMIT, initializeKeys, initializeValueKeys, keysAt, keysHeldByGroup,
  placeRandomUnrevealedKey, spendValueKeys, transferKey, validateEoteValueKeys, valueKeyIds, valueKeysAt,
} from '../src/engine/scenario-keys.js'

const copy = value => structuredClone(value)

// 最小可玩状态：地点（含印刷庇护值/线索值）、调查员、空的剧本扩展。
function plainState() {
  return {
    round: 1,
    locations: [
      { id: 'campSite', name: '营地', shelter: 4 },
      { id: 'shore', name: '冰岸', shelter: 2 },
      { id: 'cavern', name: '冰穴', shelter: 8 },
      { id: 'plain', name: '无庇护地' },
      { id: 'facility1', name: '设施一', maxClues: 3 },
      { id: 'facility2', name: '设施二', maxClues: 1 },
      { id: 'pylonEast', name: '东塔', maxClues: 2 },
      { id: 'pylonWest', name: '西塔', maxClues: 4, clues: 1 },
    ],
    investigators: [
      { seat: 0, location: 'campSite' },
      { seat: 1, location: 'shore' },
    ],
    enemies: [],
    scenarioFlags: {},
  }
}

// 内容层传入的设施数据：15 座/5 座只是数量，这里用最小集合验证状态机。
function facilitiesSpec() {
  return {
    facilities: [
      { id: 'facility1', kind: 'ancientFacility' },
      { id: 'facility2', kind: 'ancientFacility' },
    ],
    towers: [
      { id: 'pylonEast', towerIndex: 0, mistPylon: true },
      { id: 'pylonWest', towerIndex: 1, mistPylon: true },
    ],
  }
}

function keysSpec() {
  return [
    { id: 'key-skull-1', value: 'skull', holder: 'investigator:0' },
    { id: 'key-skull-2', value: 'skull', holder: 'investigator:0' },
    { id: 'key-tablet-1', value: 'tablet', holder: 'investigator:0' },
    { id: 'key-zero-1', value: 0, holder: 'setAside' },
    { id: 'key-minus2-1', value: -2, holder: 'investigator:1' },
    { id: 'key-elder-1', value: 'elderthing', holder: 'location:shore' },
  ]
}

test('P2-D 地点庇护值：印刷数据 0..SHELTER_MAX、缺省 0、非法值立即失败', () => {
  assert.equal(SHELTER_MAX, 9)
  assert.equal(readShelter({}), 0, '未印刷 Shelter 的地点按 0')
  assert.equal(readShelter({ shelter: 4 }), 4)
  assert.equal(readShelter({ meta: { shelter: 2 } }), 2, '兼容参考实现的 meta.shelter')
  assert.equal(readShelter({ shelter: 4, meta: { shelter: 2 } }), 4, '实例字段优先于 meta')
  assert.throws(() => readShelter(null), /来源必须为对象/)
  assert.throws(() => readShelter({ shelter: 1.5 }), /必须为整数/)
  assert.throws(() => readShelter({ shelter: -1 }), /0\.\.9/, '印刷值下限')
  assert.throws(() => readShelter({ shelter: 10 }), /0\.\.9/, '上限防脏数据')
  assert.throws(() => readShelter({ meta: 'shelter' }), /meta 必须为对象/)
  assert.throws(() => readShelter({ meta: { shelter: 10 } }), /0\.\.9/)

  const state = plainState()
  assert.equal(locationShelter(state, 'campSite'), 4)
  assert.equal(locationShelter(state, 'plain'), 0)
  assert.throws(() => locationShelter(state, 'nowhere'), /无效地点 nowhere/)
  assert.equal(eoteScenarioState(state), null, '读点不初始化 eote 容器')
})

test('P2-D 营地：本关唯一营地、同值幂等、未知地点/换营地失败不产生写入', () => {
  const state = plainState()
  assert.equal(campLocationId(state), null)
  assert.deepEqual(campState(state), { camp: null, revealed: [] })
  assert.equal(campShelter(state), null, '没有营地时庇护值按 Maybe 语义返回 null')
  assert.equal(eoteScenarioState(state), null, '读点不初始化容器')

  assert.equal(setCampLocation(state, 'campSite'), true)
  assert.equal(campLocationId(state), 'campSite')
  assert.equal(campShelter(state), 4, '当前庇护值 = 营地地点的印刷值')
  assert.deepEqual(eoteScenarioState(state), { version: 1, shelter: { camp: 'campSite' } })
  assert.equal(setCampLocation(state, 'campSite'), true, '同值重复设置幂等')

  const before = copy(state)
  assert.equal(setCampLocation(state, 'shore'), false, '单关内营地不移动')
  assert.throws(() => setCampLocation(state, 'nowhere'), /无效地点 nowhere/)
  assert.throws(() => setCampLocation(state, 3), /非空地点 id/)
  assert.deepEqual(state, before, '失败路径不产生部分写入')
  assert.doesNotThrow(() => validateEoteCamp(state))
  assert.doesNotThrow(() => validateEoteShelter(state))
})

test('P2-D 检查点继承：已揭示地点记录幂等、数组先整体校验再写入', () => {
  const state = plainState()
  setCampLocation(state, 'campSite')
  assert.deepEqual(revealedLocations(state), [])

  assert.equal(recordRevealedLocation(state, 'shore'), true)
  assert.equal(recordRevealedLocation(state, 'shore'), false, '重复记录幂等')
  assert.throws(() => recordRevealedLocation(state, 'nowhere'), /无效地点 nowhere/)
  assert.deepEqual(revealedLocations(state), ['shore'])

  assert.equal(inheritRevealedLocations(state, ['shore', 'cavern']), 1, '已有记录不重复继承')
  assert.equal(inheritRevealedLocations(state, ['shore', 'cavern']), 0, '再次继承幂等')
  assert.deepEqual(revealedLocations(state), ['shore', 'cavern'])

  const before = copy(state)
  assert.throws(() => inheritRevealedLocations(state, ['plain', 'nowhere']), /无效地点 nowhere/)
  assert.throws(() => inheritRevealedLocations(state, ['plain', 'plain']), /重复/)
  assert.throws(() => inheritRevealedLocations(state, 'plain'), /必须为数组/)
  assert.throws(() => recordRevealedLocation(state, ''), /非空地点 id/)
  assert.deepEqual(state, before, '继承失败不产生部分写入')
  assert.deepEqual(campState(state), { camp: 'campSite', revealed: ['shore', 'cavern'] })
})

test('P2-D 设施建局：数据驱动、重复 id/编号、未知地点、坏字段一律拒绝', () => {
  const state = plainState()
  assert.equal(facilityState(state, 'facility1'), null, '未初始化读点返回 null')
  assert.deepEqual(initializeFacilities(state, facilitiesSpec()), { facilities: 2, towers: 2 })
  assert.throws(() => initializeFacilities(state, facilitiesSpec()), /设施已初始化/)
  assert.deepEqual(facilityState(state, 'facility1'), {
    id: 'facility1', kind: 'ancientFacility', activated: false, activatedBy: null, destroyed: false,
  })
  assert.equal(towerState(state, 'pylonEast').health, 2, '高塔生命 = 地点线索值（maxClues）')
  assert.equal(towerHealth(state, 'pylonWest'), 4, '印刷线索值优先于当前 clues（1）')

  // 内容层可用显式 health 覆盖线索值（规则口径仍是「生命 = 线索值」，只是数据由内容给）。
  const overridden = plainState()
  initializeFacilities(overridden, { facilities: [], towers: [{ id: 'pylonEast', towerIndex: 0, mistPylon: true, health: 5 }] })
  assert.equal(towerHealth(overridden, 'pylonEast'), 5)
  assert.equal(damageTower(overridden, { towerId: 'pylonEast', amount: 9 }).damage, 5, '伤害夹取到显式生命')

  for (const [label, spec] of [
    ['设施 id 重复', { facilities: [{ id: 'facility1', kind: 'a' }, { id: 'facility1', kind: 'b' }], towers: [] }],
    ['设施与高塔 id 重复', { facilities: [{ id: 'facility1', kind: 'a' }], towers: [{ id: 'facility1', towerIndex: 0, mistPylon: true }] }],
    ['高塔编号重复', { facilities: [], towers: [{ id: 'pylonEast', towerIndex: 0, mistPylon: true }, { id: 'pylonWest', towerIndex: 0, mistPylon: true }] }],
    ['高塔编号为负', { facilities: [], towers: [{ id: 'pylonEast', towerIndex: -1, mistPylon: true }] }],
    ['未知地点', { facilities: [{ id: 'ghost', kind: 'a' }], towers: [] }],
    ['未知字段', { facilities: [{ id: 'facility1', kind: 'a', color: 'red' }], towers: [] }],
    ['缺 mistPylon', { facilities: [], towers: [{ id: 'pylonEast', towerIndex: 0 }] }],
    ['life 非法', { facilities: [], towers: [{ id: 'pylonEast', towerIndex: 0, mistPylon: true, health: 0 }] }],
    ['声明不是对象', []],
  ]) {
    const fresh = plainState()
    assert.throws(() => initializeFacilities(fresh, spec), undefined, label)
    assert.equal(eoteScenarioState(fresh), null, `${label}：失败不初始化容器`)
  }
})

test('P2-D 设施激活/摧毁状态机：激活者、重复操作与已摧毁设施被拒绝', () => {
  const state = plainState()
  initializeFacilities(state, facilitiesSpec())
  assert.equal(activateFacility(state, 'facility1', { by: 1 }), true)
  assert.deepEqual(facilityState(state, 'facility1'), {
    id: 'facility1', kind: 'ancientFacility', activated: true, activatedBy: 1, destroyed: false,
  })
  assert.equal(activateFacility(state, 'facility1'), false, '已激活不能再次激活')
  assert.throws(() => activateFacility(state, 'facility1', { by: 9 }), /无效调查员座位/)
  assert.throws(() => activateFacility(state, 'facility1', { extra: true }), /未知/)
  assert.throws(() => activateFacility(state, 'unknownFacility'), /无效设施/)

  assert.equal(destroyFacility(state, 'facility2'), true)
  assert.equal(destroyFacility(state, 'facility2'), false, '摧毁幂等')
  assert.equal(activateFacility(state, 'facility2', { by: 0 }), false, '已摧毁设施不能激活')
  assert.throws(() => destroyFacility(state, 'unknownFacility'), /无效设施/)
  assert.equal(facilityState(state, 'facility2').destroyed, true)

  // 未初始化时是非法游戏状态：返回 false 而不是抛错。
  assert.equal(activateFacility(plainState(), 'facility1'), false)
  assert.equal(destroyFacility(plainState(), 'facility1'), false)
})

test('P2-D 高塔伤害：夹取到线索值生命、坍塌幂等、超额伤害不溢出', () => {
  const state = plainState()
  initializeFacilities(state, facilitiesSpec())
  assert.equal(damageTower(plainState(), { towerId: 'pylonEast', amount: 1 }), false, '未初始化不写状态')

  assert.deepEqual(damageTower(state, { towerId: 'pylonEast', amount: 1 }), {
    towerId: 'pylonEast', damage: 1, remaining: 1, collapsed: false, source: null,
  })
  const before = copy(state)
  assert.throws(() => damageTower(state, { towerId: 'pylonEast', amount: 0 }), /需要合法整数/)
  assert.throws(() => damageTower(state, { towerId: 'pylonEast', amount: 1.5 }), /需要合法整数/)
  assert.throws(() => damageTower(state, { towerId: 'pylonEast', amount: 1, source: 42 }), /来源必须为非空字符串/)
  assert.throws(() => damageTower(state, { towerId: 'pylonEast', amount: 1, fake: true }), /未知/)
  assert.throws(() => damageTower(state, { towerId: 'unknownTower', amount: 1 }), /无效高塔/)
  assert.deepEqual(state, before, '非法参数不产生写入')

  assert.equal(damageTower(state, { towerId: 'pylonEast', amount: 99 }).collapsed, true, '超额伤害夹取到生命')
  assert.deepEqual(towerState(state, 'pylonEast'), {
    id: 'pylonEast', towerIndex: 0, mistPylon: true, health: 2, damage: 2, remaining: 0, collapsed: true, sealId: null,
  })
  assert.equal(damageTower(state, { towerId: 'pylonEast', amount: 1 }), false, '已坍塌不再结算伤害')
  assert.deepEqual(collapsedTowers(state), ['pylonEast'])
  assert.equal(damageTower(state, { towerId: 'pylonWest', amount: 99 }).collapsed, true)
  assert.deepEqual(collapsedTowers(state), ['pylonEast', 'pylonWest'], '按 towerIndex 排序')
})

test('P2-D 高塔封印：封印 id 不透明、单塔单封印、跨塔唯一、可回收', () => {
  const state = plainState()
  initializeFacilities(state, facilitiesSpec())
  assert.deepEqual(towerSeals(state), [])
  assert.equal('towerSeals' in eoteScenarioState(state), false, '未放置时不创建空容器')

  assert.equal(placeTowerSeal(state, { towerId: 'pylonEast', sealId: 'seal_a' }), true)
  assert.deepEqual(towerSeals(state), [{ towerId: 'pylonEast', sealId: 'seal_a', towerIndex: 0 }])
  assert.equal(towerState(state, 'pylonEast').sealId, 'seal_a')
  assert.equal(placeTowerSeal(state, { towerId: 'pylonEast', sealId: 'seal_b' }), false, '单塔只能有一枚封印')
  assert.equal(placeTowerSeal(state, { towerId: 'pylonWest', sealId: 'seal_a' }), false, '同一枚封印不能放两座塔')
  assert.equal(placeTowerSeal(state, { towerId: 'pylonWest', sealId: 'seal_b' }), true)
  assert.throws(() => placeTowerSeal(state, { towerId: 'unknownTower', sealId: 'seal_x' }), /无效高塔/)
  assert.throws(() => placeTowerSeal(state, { towerId: 'pylonWest', sealId: '' }), /非空字符串/)
  assert.throws(() => placeTowerSeal(state, { towerId: 'pylonWest', sealId: 'seal_x', fake: 1 }), /未知/)

  assert.equal(removeTowerSeal(state, { towerId: 'pylonEast', sealId: 'seal_b' }), false, '封印对不上不回收')
  assert.equal(removeTowerSeal(state, { towerId: 'pylonEast' }), true)
  assert.deepEqual(towerSeals(state), [{ towerId: 'pylonWest', sealId: 'seal_b', towerIndex: 1 }])
  assert.equal(removeTowerSeal(state, { towerId: 'pylonEast' }), false, '重复回收幂等')
  assert.throws(() => removeTowerSeal(state, { towerId: 'unknownTower' }), /无效高塔/)

  // 坍塌的高塔仍在场上：允许把已激活封印放上去（封印模块负责激活/控制权）。
  damageTower(state, { towerId: 'pylonEast', amount: 99 })
  assert.equal(placeTowerSeal(state, { towerId: 'pylonEast', sealId: 'seal_c' }), true)

  assert.equal(removeTowerSeal(state, { towerId: 'pylonWest' }), true)
  assert.equal(removeTowerSeal(state, { towerId: 'pylonEast' }), true)
  assert.equal('towerSeals' in eoteScenarioState(state), false, '最后一枚回收后删掉空容器')
})

test('P2-D 数值钥匙：identity 白名单、id 唯一、与彩色钥匙互不串门', () => {
  assert.deepEqual([...VALUE_KEY_FACES], ['skull', 'cultist', 'tablet', 'elderthing'])
  assert.equal(VALUE_KEY_VALUE_LIMIT, 9)
  const state = plainState()
  assert.deepEqual(valueKeyIds(state), [])
  assert.deepEqual(valueKeysAt(state, 'setAside'), [])
  assert.equal(eoteScenarioState(state), null)
  assert.equal(mechanicState(state), null, '读点不初始化 mechanics 容器')

  assert.equal(initializeValueKeys(state, keysSpec()), 6)
  assert.deepEqual(valueKeyIds(state), [
    'key-elder-1', 'key-minus2-1', 'key-skull-1', 'key-skull-2', 'key-tablet-1', 'key-zero-1',
  ])
  assert.deepEqual(valueKeysAt(state, 'investigator:0'), [
    { id: 'key-skull-1', value: 'skull' },
    { id: 'key-skull-2', value: 'skull' },
    { id: 'key-tablet-1', value: 'tablet' },
  ])
  assert.deepEqual(valueKeysAt(state, 'spent'), [])

  // 彩色钥匙读点完全看不到数值钥匙（两套 identity 分槽）。
  assert.deepEqual(keysAt(state, 'investigator:0'), [])
  assert.deepEqual(keysHeldByGroup(state), [])
  assert.equal(transferKey(state, 'key-skull-1', 'investigator:0', 'reference'), false)
  assert.equal(placeRandomUnrevealedKey(state, 'investigator:1'), false)

  // 一个关卡只能初始化一套 identity。
  const colored = plainState()
  initializeKeys(colored, [{ color: 'red', revealed: true, holder: 'investigator:0' }])
  assert.deepEqual(keysAt(colored, 'investigator:0'), ['red'])
  assert.throws(() => initializeValueKeys(colored, keysSpec()), /钥匙已初始化/)
})

test('P2-D 数值钥匙建局：重复 id、与彩色同名、坏 identity/持有者/字段立即失败', () => {
  for (const [label, specs, pattern] of [
    ['重复 id', [keysSpec()[0], keysSpec()[0]], /id 重复/],
    ['与彩色钥匙同名', [{ id: 'red', value: 0 }], /不能与彩色钥匙同名/],
    ['identity 越界', [{ id: 'key-x', value: 10 }], /-9\.\.9/],
    ['identity 非整数', [{ id: 'key-x', value: 1.5 }], /必须为整数或合法标记面/],
    ['identity 非法标记面', [{ id: 'key-x', value: 'bless' }], /必须为整数或合法标记面/],
    ['持有者非法', [{ id: 'key-x', value: 0, holder: 'nowhere:1' }], /无效钥匙目标/],
    ['未知字段', [{ id: 'key-x', value: 0, fake: true }], /未知字段/],
    ['空声明', [], /非空数组/],
  ]) {
    const fresh = plainState()
    assert.throws(() => initializeValueKeys(fresh, specs), pattern, label)
    assert.equal(mechanicState(fresh), null, `${label}：失败不初始化容器`)
  }
})

test('P2-D 数值钥匙花费：多重集原子配对、不足/部分不产生写入', () => {
  const state = plainState()
  initializeValueKeys(state, keysSpec())
  const before = copy(state)
  assert.equal(spendValueKeys(state, 'investigator:0', { values: ['skull', 'skull', 'skull'] }), false)
  assert.deepEqual(state, before, '不足时不产生部分花费')
  assert.equal(spendValueKeys(state, 'investigator:0', { values: ['tablet', 'tablet'] }), false)
  assert.deepEqual(state, before, '部分匹配（只有 1 枚 tablet）时也不产生部分花费')

  assert.equal(spendValueKeys(state, 'investigator:0', { values: ['skull', 'skull'] }), true)
  assert.deepEqual(valueKeysAt(state, 'investigator:0'), [{ id: 'key-tablet-1', value: 'tablet' }])
  assert.deepEqual(valueKeysAt(state, 'spent'), [
    { id: 'key-skull-1', value: 'skull' },
    { id: 'key-skull-2', value: 'skull' },
  ])
  assert.equal(spendValueKeys(state, 'investigator:0', { values: ['tablet'], destination: 'removed' }), true)
  assert.deepEqual(valueKeysAt(state, 'removed'), [{ id: 'key-tablet-1', value: 'tablet' }])

  // 数值 identity 与标记面 identity 都按物理钥匙逐枚配对；setAside 也能被花掉。
  assert.equal(spendValueKeys(state, 'investigator:1', { values: [-2] }), true)
  assert.equal(spendValueKeys(state, 'setAside', { values: [0], destination: 'reference' }), true)
  assert.deepEqual(valueKeysAt(state, 'reference'), [{ id: 'key-zero-1', value: 0 }])

  for (const [label, target, spec, pattern] of [
    ['未知目标', 'nowhere:1', { values: ['skull'] }, /无效钥匙目标/],
    ['未知字段', 'investigator:1', { values: [1], fake: 1 }, /未知字段/],
    ['空身份数组', 'investigator:1', { values: [] }, /非空/],
    ['坏 identity', 'investigator:1', { values: ['bless'] }, /必须为整数或合法标记面/],
    ['坏去向', 'investigator:1', { values: [1], destination: 'nowhere:2' }, /无效钥匙目标/],
    ['声明非对象', 'investigator:1', 'skull', /必须为对象/],
  ]) {
    const fresh = plainState()
    initializeValueKeys(fresh, keysSpec())
    const snapshot = copy(fresh)
    assert.throws(() => spendValueKeys(fresh, target, spec), pattern, label)
    assert.deepEqual(fresh, snapshot, `${label}：失败不产生写入`)
  }
})

test('P2-D 懒初始化：所有读点都不创建 eote/mechanics 容器', () => {
  const state = plainState()
  const before = copy(state)
  assert.equal(eoteScenarioState(state), null)
  assert.equal(mechanicState(state), null)
  assert.equal(campLocationId(state), null)
  assert.deepEqual(campState(state), { camp: null, revealed: [] })
  assert.deepEqual(revealedLocations(state), [])
  assert.equal(campShelter(state), null)
  assert.equal(locationShelter(state, 'cavern'), 8)
  assert.equal(facilityState(state, 'facility1'), null)
  assert.equal(towerState(state, 'pylonEast'), null)
  assert.equal(towerHealth(state, 'pylonEast'), null)
  assert.deepEqual(collapsedTowers(state), [])
  assert.deepEqual(towerSeals(state), [])
  assert.deepEqual(valueKeyIds(state), [])
  assert.deepEqual(valueKeysAt(state, 'setAside'), [])
  assert.doesNotThrow(() => validateEoteCamp(state))
  assert.doesNotThrow(() => validateEoteShelter(state))
  assert.doesNotThrow(() => validateEoteFacilities(state))
  assert.doesNotThrow(() => validateEoteValueKeys(state))
  assert.equal(eoteScenarioState(state), null)
  assert.equal(mechanicState(state), null)
  assert.deepEqual(state, before, '全部读点零写入')
})

test('P2-D 存档校验：structuredClone 往返后各模块 validateEoteXxx 认可，坏数据立即失败', () => {
  const state = plainState()
  setCampLocation(state, 'campSite')
  recordRevealedLocation(state, 'shore')
  inheritRevealedLocations(state, ['shore', 'cavern'])
  initializeFacilities(state, facilitiesSpec())
  activateFacility(state, 'facility1', { by: 1 })
  destroyFacility(state, 'facility2')
  damageTower(state, { towerId: 'pylonEast', amount: 1, source: 'attack' })
  placeTowerSeal(state, { towerId: 'pylonWest', sealId: 'seal_b' })

  const clone = copy(state)
  assert.deepEqual(clone, state, 'JSON 往返保持结构')
  assert.doesNotThrow(() => validateEoteContainers(clone))
  assert.doesNotThrow(() => validateEoteCamp(clone))
  assert.doesNotThrow(() => validateEoteShelter(clone))
  assert.doesNotThrow(() => validateEoteFacilities(clone))
  assert.doesNotThrow(() => validateEoteValueKeys(clone))

  const pristine = copy(state)
  const corruptions = [
    ['eote 未知字段', draft => { draft.scenarioFlags.mechanics.eote.extra = true }, validateEoteContainers, /未知字段/],
    ['营地地点悬空', draft => { draft.scenarioFlags.mechanics.eote.shelter.camp = 'ghost' }, validateEoteCamp, /不在场/],
    ['已揭示地点重复', draft => { draft.scenarioFlags.mechanics.eote.shelter.revealed.push('shore') }, validateEoteCamp, /重复/],
    ['地点印刷庇护值越界', draft => { draft.locations.find(loc => loc.id === 'shore').shelter = 12 }, validateEoteShelter, /0\.\.9/],
    ['设施未知字段', draft => { draft.scenarioFlags.mechanics.eote.facilities.facilities.facility1.color = 'red' }, validateEoteFacilities, /未知/],
    ['高塔伤害为负', draft => { draft.scenarioFlags.mechanics.eote.facilities.towers.pylonEast.damage = -1 }, validateEoteFacilities, /伤害无效/],
    ['高塔坍塌标记不一致', draft => {
      draft.scenarioFlags.mechanics.eote.facilities.towers.pylonWest.health = 4
      draft.scenarioFlags.mechanics.eote.facilities.towers.pylonWest.damage = 4
      draft.scenarioFlags.mechanics.eote.facilities.towers.pylonWest.collapsed = false
    }, validateEoteFacilities, /坍塌标记/],
    ['高塔封印指向未登记高塔', draft => { draft.scenarioFlags.mechanics.eote.towerSeals.ghostTower = 'seal_x' }, validateEoteFacilities, /未登记高塔/],
    ['高塔封印重复', draft => { draft.scenarioFlags.mechanics.eote.towerSeals.pylonEast = 'seal_b' }, validateEoteFacilities, /重复/],
  ]
  for (const [label, corrupt, validator, pattern] of corruptions) {
    const draft = copy(state)
    corrupt(draft)
    assert.throws(() => validator(draft), pattern, label)
  }
  // 校验函数只读，不改写入参状态。
  assert.deepEqual(state, pristine)
})

test('P2-D 数值钥匙存档校验：JSON 往返后通过，坏 identity/字段/持有者/彩色条目混淆立即失败', () => {
  const state = plainState()
  initializeValueKeys(state, keysSpec())
  const clone = copy(state)
  assert.deepEqual(clone, state)
  assert.doesNotThrow(() => validateEoteValueKeys(clone))
  assert.doesNotThrow(() => validateMechanicState(clone), '既有 mechanic-state 校验也接受数值钥匙条目')

  const corruptions = [
    ['identity 越界', draft => { draft.scenarioFlags.mechanics.keys['key-zero-1'].value = 10 }, /-9\.\.9/],
    ['未知字段', draft => { draft.scenarioFlags.mechanics.keys['key-zero-1'].extra = true }, /未知字段/],
    ['非正面朝上', draft => { draft.scenarioFlags.mechanics.keys['key-zero-1'].revealed = false }, /正面朝上/],
    ['坏持有者', draft => { draft.scenarioFlags.mechanics.keys['key-zero-1'].holder = 'bogus:1' }, /无效数值钥匙目标/],
    ['未知身份', draft => { draft.scenarioFlags.mechanics.keys['key-zero-1'].kind = 'color' }, /身份未知/],
    ['id 与彩色钥匙同名', draft => {
      draft.scenarioFlags.mechanics.keys.red = { ...draft.scenarioFlags.mechanics.keys['key-zero-1'] }
    }, /不能与彩色钥匙同名/],
    ['容器不是对象', draft => { draft.scenarioFlags.mechanics.keys = [] }, /必须为对象/],
  ]
  for (const [label, corrupt, pattern] of corruptions) {
    const draft = copy(state)
    corrupt(draft)
    assert.throws(() => validateEoteValueKeys(draft), pattern, label)
  }

  // 彩色钥匙存档不归本校验管（既有 mechanic-state 负责），不会被误判。
  const colored = plainState()
  initializeKeys(colored, [{ color: 'red', revealed: true, holder: 'investigator:0' }])
  assert.doesNotThrow(() => validateEoteValueKeys(colored))
  assert.doesNotThrow(() => validateMechanicState(colored))
})
