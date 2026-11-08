// P2-B 战役级原语验收：campaign.partner / campaign.seals / campaign.memorials / campaign.supplies。
//
// 覆盖口径（与 TIC/TDE 原语测试一致）：
//   · 正常路径：初始化、状态机、控制/携带/掉落/回收、批量领取；
//   · 负面路径：非法初始化声明、非法状态转移/放置/领取（抛错或返回 false 且不留部分写入）、
//     未知卡号/座位/地点抛错；
//   · 存档：container 只由 initialize 创建，读点不创建；structuredClone + JSON 往返后
//     校验器仍接受且行为保持；validateEoteContainers 接受整容器；
//   · 随机：检查点 I 的失踪抽选必须由注入的 random 确定。
//
// 状态全部是轻量纯对象（不依赖 core-fixture / 引擎建局），与 TDE 原语测试同一风格。
import test from 'node:test'
import assert from 'node:assert/strict'

import { eoteCampaignState, validateEoteContainers } from '../src/engine/eote-state.js'
import {
  PARTNER_STATUSES, PARTNER_ALIVE_STATUSES, adjustPartnerHarm, chooseMissingPartners, initializePartners,
  isPartnerAlive, partnerState, partnersWithStatus, remainingPartners, resoluteFormOf, setPartnerStatus,
  validateEotePartners,
} from '../src/campaign/eote-partners.js'
import {
  SEAL_KINDS, activateSeal, activatedSeals, deactivateSeal, heldSeals, initializeSeals, placeDormantSeal,
  placeSeal, placedSeals, recoverSeal, sealState, sealsAt, sealsOf, unplaceSeal, validateEoteSeals,
} from '../src/campaign/eote-seals.js'
import {
  claimAllAtInterlude, claimMemorial, claimedMemorials, crossedOutMemorials, initializeMemorials,
  memorialFor, validateEoteMemorials,
} from '../src/campaign/eote-memorials.js'
import {
  SUPPLIES_RECOVERED_KEY, assignSupply, carriedSupplies, dropSupplyAt, droppedSupplies, initializeSupplies,
  missingSupplies, recoverSupply, recoveredSupplies, releaseSupply, supplyCarrier, supplyItems, validateEoteSupplies,
} from '../src/campaign/eote-supplies.js'
import { recordSetValues } from '../src/campaign/record-sets.js'

const copy = value => structuredClone(value)

// 轻量战役状态：座位 0–2、三个可放置封印/掉落物资的地点、空战役记录。
function gameState() {
  return {
    campaign: { records: {}, investigators: { 0: { seat: 0 }, 1: { seat: 1 }, 2: { seat: 2 } } },
    investigators: [0, 1, 2].map(seat => ({ seat })),
    locations: [{ id: 'gate' }, { id: 'grotto' }, { id: 'pylon1' }],
  }
}

const PARTNER_SPEC = {
  partners: [
    { code: 'p-a', damage: 0, horror: 1 },
    { code: 'p-b', damage: 1, horror: 0 },
    { code: 'p-c', damage: 0, horror: 0 },
  ],
  resoluteForms: { 'p-b': 'p-b-resolute' },
}

const MEMORIAL_SPEC = {
  entries: [
    { partnerCode: 'p-a', relicCode: 'relic-a' },
    { partnerCode: 'p-b', relicCode: 'relic-b' },
    { partnerCode: 'p-c', relicCode: 'relic-c' },
  ],
}

const SUPPLY_SPEC = {
  items: [
    { code: 'supply-1', label: '绿色皂石' },
    { code: 'supply-2', label: '木雪橇' },
    { code: 'supply-3', label: '炸药' },
    { code: 'supply-4', label: '瘴气水晶' },
    { code: 'supply-5', label: '矿物标本' },
    { code: 'supply-6', label: '小声无线电台' },
    { code: 'supply-7', label: '备用零件' },
  ],
  recoveredKey: SUPPLIES_RECOVERED_KEY,
}

// 固定 [0,1) 序列的随机源：用于检查点 I 的确定性断言。
function sequenceRandom(values) {
  let index = 0
  return () => values[index++ % values.length]
}

// ---------------------------------------------------------------------------
// campaign.partner
// ---------------------------------------------------------------------------

test('P2-B campaign.partner：初始化名册、持久伤害/恐惧与存活读点', () => {
  const state = gameState()
  assert.equal(initializePartners(state, PARTNER_SPEC), 3)
  assert.equal(validateEoteContainers(state), undefined)
  assert.equal(eoteCampaignState(state).version, 1)

  const partner = partnerState(state, 'p-a')
  assert.deepEqual(partner, { code: 'p-a', damage: 0, horror: 1, status: 'safe' })
  assert.equal(isPartnerAlive(state, 'p-a'), true)
  assert.equal(isPartnerAlive(state, 'missing'), false)
  // 未知名册卡号：读取返回 null，写入抛错。
  assert.equal(partnerState(state, 'p-unknown'), null)
  assert.deepEqual(remainingPartners(state).map(entry => entry.code), ['p-a', 'p-b', 'p-c'])
  assert.equal(resoluteFormOf(state, 'p-b'), 'p-b-resolute')
  assert.equal(resoluteFormOf(state, 'p-a'), null)

  // 跨关持久伤害/恐惧：可为负（治疗），下限 0。
  assert.deepEqual(adjustPartnerHarm(state, 'p-a', { damage: 2, horror: -9 }), {
    code: 'p-a', damage: 2, horror: 0, status: 'safe',
  })
  assert.deepEqual(adjustPartnerHarm(state, 'p-b', { damage: -5 }), {
    code: 'p-b', damage: 0, horror: 0, status: 'safe', resolute: 'p-b-resolute',
  })
  assert.throws(() => adjustPartnerHarm(state, 'p-unknown', { damage: 1 }), RangeError)
  assert.throws(() => adjustPartnerHarm(state, 'p-a', { damage: 0.5 }), TypeError)
  assert.equal(PARTNER_STATUSES.length, 4)
  assert.deepEqual([...PARTNER_ALIVE_STATUSES], ['safe', 'resolute'])
})

test('P2-B campaign.partner：非法初始化抛错且不创建容器/不留部分写入', () => {
  const cases = [
    [{ partners: [{ code: 'x', damage: 0, horror: 0 }, { code: 'x', damage: 0, horror: 0 }] }, /重复的伙伴卡号/],
    [{ partners: [{ code: 'x', damage: -1, horror: 0 }] }, /非负整数/],
    [{ partners: [{ code: 'x', damage: 0, horror: 0, extra: 1 }] }, /未知字段/],
    [{ partners: [] }, /partners 数组/],
    [{ partners: 'x' }, /partners 数组/],
    [{ partners: [{ code: 'x', damage: 0, horror: 0 }], resoluteForms: { 'unknown-base': 'r' } }, /不在名册中/],
    [{ partners: [{ code: 'x', damage: 0, horror: 0 }], resoluteForms: { x: 'x' } }, /不能与名册/],
  ]
  for (const [spec, message] of cases) {
    const state = gameState()
    const before = copy(state)
    assert.throws(() => initializePartners(state, spec), message)
    assert.deepEqual(state, before, '非法初始化不得创建 EotE 容器或写入任何记录')
  }
  // 重复初始化：第二次必须抛错且保留第一次的名册。
  const state = gameState()
  initializePartners(state, PARTNER_SPEC)
  const before = copy(state)
  assert.throws(() => initializePartners(state, PARTNER_SPEC), /已初始化/)
  assert.deepEqual(state, before)
})

test('P2-B campaign.partner：状态机只允许合法转移，非法转移无部分写入', () => {
  const state = gameState()
  initializePartners(state, PARTNER_SPEC)
  assert.equal(setPartnerStatus(state, 'p-a', 'mia'), true)
  assert.equal(partnerState(state, 'p-a').status, 'mia')
  assert.equal(setPartnerStatus(state, 'p-a', 'mia'), false, '同态重复返回 false')
  assert.equal(setPartnerStatus(state, 'p-a', 'safe'), true, '救回：mia → safe')
  assert.equal(setPartnerStatus(state, 'p-a', 'resolute'), true, '坚毅：safe → resolute')
  assert.equal(setPartnerStatus(state, 'p-a', 'eliminated'), true, '划去：resolute → eliminated')
  // eliminated 是终态：任何转移都返回 false 且不写。
  const before = copy(state)
  for (const status of PARTNER_STATUSES) assert.equal(setPartnerStatus(state, 'p-a', status), false)
  assert.deepEqual(state, before)
  assert.throws(() => setPartnerStatus(state, 'p-a', 'doomed'), RangeError)
  assert.throws(() => setPartnerStatus(state, 'p-unknown', 'eliminated'), RangeError)
  // 非法转移（safe → safe 已覆盖；mia → resolute）返回 false。
  setPartnerStatus(state, 'p-b', 'mia')
  assert.equal(setPartnerStatus(state, 'p-b', 'resolute'), false)
  assert.equal(partnerState(state, 'p-b').status, 'mia')
  assert.deepEqual(partnersWithStatus(state, ['mia']).map(entry => entry.code), ['p-b'])
  assert.equal(partnersWithStatus(state, ['resolute']).length, 0)
  assert.throws(() => partnersWithStatus(state, 'doomed'), RangeError)
})

test('P2-B campaign.partner：检查点 I 按庇护值随机抽选失踪，注入 random 后确定', () => {
  const spec = {
    partners: ['p-1', 'p-2', 'p-3', 'p-4', 'p-5'].map(code => ({ code, damage: 0, horror: 0 })),
  }
  // 固定 0.5 的洗混序列（Fisher-Yates）→ 顺序 [p-1, p-4, p-2, p-5, p-3]；
  // 庇护值 2 时 p-1/p-4 安全，其余三人失踪。
  const first = gameState()
  initializePartners(first, spec)
  const missing = chooseMissingPartners(first, 2, sequenceRandom([0.5]))
  assert.deepEqual(missing.map(entry => entry.code), ['p-2', 'p-5', 'p-3'])
  for (const entry of missing) assert.equal(entry.status, 'mia')
  assert.deepEqual(remainingPartners(first).map(entry => entry.code), ['p-1', 'p-4'])
  assert.equal(setPartnerStatus(first, 'p-2', 'safe'), true, '被救回的失踪伙伴可以恢复 safe')

  // 同一状态 + 同一 random 序列 → 完全相同的结果（回放确定性）。
  const seedValues = [0.11, 0.73, 0.42, 0.95, 0.28, 0.6]
  const second = gameState()
  initializePartners(second, spec)
  const secondMissing = chooseMissingPartners(second, 2, sequenceRandom(seedValues))
  const third = gameState()
  initializePartners(third, spec)
  assert.deepEqual(chooseMissingPartners(third, 2, sequenceRandom(seedValues)).map(entry => entry.code),
    secondMissing.map(entry => entry.code))

  // 庇护值 ≥ 存活人数：无人失踪；庇护值 0：全部失踪。
  const allSafe = gameState()
  initializePartners(allSafe, spec)
  assert.deepEqual(chooseMissingPartners(allSafe, 9, sequenceRandom([0.5])), [])
  assert.deepEqual(remainingPartners(allSafe).map(entry => entry.code), ['p-1', 'p-2', 'p-3', 'p-4', 'p-5'])
  const noneSafe = gameState()
  initializePartners(noneSafe, spec)
  assert.equal(chooseMissingPartners(noneSafe, 0, sequenceRandom([0.5])).length, 5)
  assert.deepEqual(remainingPartners(noneSafe), [])

  // 缺省随机源走引擎 randomValue(state)：同一 rngState 的两份状态结果一致。
  const defaultRandom = [gameState(), gameState()]
  for (const state of defaultRandom) {
    initializePartners(state, spec)
    state.rngState = 20261107
  }
  assert.deepEqual(chooseMissingPartners(defaultRandom[0], 2).map(entry => entry.code),
    chooseMissingPartners(defaultRandom[1], 2).map(entry => entry.code))

  // 参数/随机源非法：抛错且不写状态。
  const guarded = gameState()
  initializePartners(guarded, spec)
  const before = copy(guarded)
  assert.throws(() => chooseMissingPartners(guarded, 2, sequenceRandom([1.5])), RangeError)
  assert.throws(() => chooseMissingPartners(guarded, -1, sequenceRandom([0.5])), RangeError)
  assert.throws(() => chooseMissingPartners(guarded, 1.5, sequenceRandom([0.5])), RangeError)
  assert.deepEqual(guarded, before)
})

test('P2-B campaign.partner：存档校验与 structuredClone/JSON 往返', () => {
  const state = gameState()
  initializePartners(state, PARTNER_SPEC)
  setPartnerStatus(state, 'p-a', 'mia')
  adjustPartnerHarm(state, 'p-b', { damage: 3, horror: 2 })
  validateEotePartners(state, state.campaign.eote.partners)

  for (const clone of [copy(state), JSON.parse(JSON.stringify(state))]) {
    validateEoteContainers(clone)
    validateEotePartners(clone, clone.campaign.eote.partners)
    assert.equal(partnerState(clone, 'p-a').status, 'mia')
    assert.deepEqual(partnerState(clone, 'p-b'), { code: 'p-b', damage: 4, horror: 2, status: 'safe', resolute: 'p-b-resolute' })
    assert.equal(resoluteFormOf(clone, 'p-b'), 'p-b-resolute')
    assert.equal(setPartnerStatus(clone, 'p-a', 'eliminated'), true, '往返后状态机仍可写')
  }

  const invalid = [
    { roster: [] },
    { roster: [{ code: 'p-a', damage: 0, horror: 0, status: 'safe' }, { code: 'p-a', damage: 0, horror: 0, status: 'safe' }] },
    { roster: [{ code: 'p-a', damage: -1, horror: 0, status: 'safe' }] },
    { roster: [{ code: 'p-a', damage: 0, horror: 0, status: 'doomed' }] },
    { roster: [{ code: 'p-a', damage: 0, horror: 0, status: 'safe', extra: true }] },
    { roster: [{ code: 'p-a', damage: 0, horror: 0, status: 'safe', resolute: 'p-a' }] },
    { roster: [{ code: 'p-a', damage: 0, horror: 0, status: 'safe' }], other: [] },
  ]
  for (const value of invalid) assert.throws(() => validateEotePartners(gameState(), value))
  assert.equal(validateEotePartners(gameState(), undefined), undefined, '旧存档缺记录时不校验、不抛错')
})

// ---------------------------------------------------------------------------
// campaign.seals
// ---------------------------------------------------------------------------

test('P2-B campaign.seals：五枚封印的休眠/取回/激活/放置/取下生命周期', () => {
  const state = gameState()
  assert.equal(initializeSeals(state), 5)
  assert.deepEqual(SEAL_KINDS, ['A', 'B', 'C', 'D', 'E'])
  assert.deepEqual(sealsOf(state).map(entry => entry.kind), ['A', 'B', 'C', 'D', 'E'])
  assert.deepEqual(sealState(state, 'A'), { kind: 'A', active: false, placedBySeat: null, locationId: null })
  assert.throws(() => sealState(state, 'F'), RangeError, '未知封印种类必须抛错')

  // 剧本强制放入地点 → 调查员取回控制 → 激活 → 放到伊夸之门。
  assert.equal(placeDormantSeal(state, 'A', 'grotto'), true)
  assert.deepEqual(placedSeals(state).map(entry => entry.kind), ['A'])
  assert.deepEqual(sealsAt(state, 'grotto').map(entry => entry.kind), ['A'])
  assert.equal(placeDormantSeal(state, 'A', 'gate'), false, '已放置不能重复放置')
  assert.equal(recoverSeal(state, 'A', { seat: 2 }), true)
  assert.deepEqual(heldSeals(state, 2).map(entry => entry.kind), ['A'])
  assert.equal(recoverSeal(state, 'A', { seat: 0 }), false, '未放置时不能再次取回')
  assert.equal(activateSeal(state, 'A'), true)
  assert.equal(activateSeal(state, 'A'), false, '只能激活一次（已激活再调用返回 false）')
  assert.equal(placeSeal(state, 'A', { seat: 0, locationId: 'gate' }), false, '只能由控制者放置')
  assert.equal(placeSeal(state, 'A', { seat: 2, locationId: 'gate' }), true)
  assert.equal(sealState(state, 'A').locationId, 'gate')
  assert.equal(deactivateSeal(state, 'A'), false, '已放置的激活封印不能休眠')
  validateEoteSeals(state, state.campaign.eote.seals)

  // 取下回到休眠无控制者；再走一遍激活流程（剧本重置读点）。
  assert.equal(unplaceSeal(state, 'A'), true)
  assert.deepEqual(sealState(state, 'A'), { kind: 'A', active: false, placedBySeat: null, locationId: null })
  assert.equal(unplaceSeal(state, 'A'), false)
  assert.equal(placeDormantSeal(state, 'B', 'pylon1'), true)
  assert.equal(recoverSeal(state, 'B', { seat: 0 }), true)
  assert.equal(activateSeal(state, 'B'), true)
  assert.equal(deactivateSeal(state, 'B'), true, '受控未放置的激活封印可被剧本效果休眠')
  assert.equal(sealState(state, 'B').active, false)
  assert.equal(activateSeal(state, 'B'), true, '休眠后可再次激活（用于剧本重置）')
  assert.equal(activatedSeals(state).length, 1)
})

test('P2-B campaign.seals：非法初始化/放置/取回抛错或返回 false 且无部分写入', () => {
  const state = gameState()
  assert.throws(() => initializeSeals(state, { kinds: ['A', 'A'] }), /重复的封印种类/)
  assert.throws(() => initializeSeals(state, { kinds: ['A', 'F'] }), RangeError)
  assert.equal('eote' in state.campaign, false, '非法初始化不得创建容器')
  initializeSeals(state, { kinds: ['A', 'C'] })
  assert.equal(sealsOf(state).length, 2)
  assert.throws(() => initializeSeals(state, { kinds: ['A'] }), /已初始化/)
  assert.equal(sealState(state, 'B'), null, '本战役未启用的封印读取返回 null')

  assert.equal(placeSeal(state, 'A', { seat: 0, locationId: 'gate' }), false, '未激活不能放置')
  assert.throws(() => placeDormantSeal(state, 'A', 'no-such-location'), RangeError)
  assert.throws(() => placeDormantSeal(state, 'B', 'gate'), RangeError, '本战役未启用的封印不存在')
  assert.throws(() => recoverSeal(state, 'A', { seat: 9 }), RangeError)
  assert.throws(() => placeDormantSeal(state, 'A', 42), TypeError)

  // 失败放置必须保持整份封印记录不变。
  assert.equal(placeDormantSeal(state, 'A', 'grotto'), true)
  assert.deepEqual(sealsAt(state, 'grotto').map(entry => entry.kind), ['A'])
  const snapshot = copy(state)
  assert.throws(() => placeSeal(state, 'A', { seat: 0, locationId: 'no-such-location' }), RangeError)
  assert.deepEqual(state, snapshot, '失败的放置不得改动封印记录')
})

test('P2-B campaign.seals：存档校验与 structuredClone/JSON 往返', () => {
  const state = gameState()
  initializeSeals(state)
  placeDormantSeal(state, 'A', 'grotto')
  recoverSeal(state, 'A', { seat: 1 })
  activateSeal(state, 'A')
  placeSeal(state, 'A', { seat: 1, locationId: 'gate' })
  placeDormantSeal(state, 'B', 'pylon1')

  for (const clone of [copy(state), JSON.parse(JSON.stringify(state))]) {
    validateEoteContainers(clone)
    validateEoteSeals(clone, clone.campaign.eote.seals)
    assert.deepEqual(sealsAt(clone, 'gate').map(entry => entry.kind), ['A'])
    assert.deepEqual(sealsAt(clone, 'pylon1').map(entry => entry.kind), ['B'])
    assert.equal(sealState(clone, 'A').active, true)
    // 往返后仍可继续操作：取下 A 再放回。
    assert.equal(unplaceSeal(clone, 'A'), true)
    assert.equal(placeDormantSeal(clone, 'A', 'gate'), true)
  }

  const invalid = [
    { entries: [] },
    { entries: [{ kind: 'F', active: false, placedBySeat: null, locationId: null }] },
    { entries: [{ kind: 'A', active: 'yes', placedBySeat: null, locationId: null }] },
    { entries: [{ kind: 'A', active: false, placedBySeat: -1, locationId: null }] },
    { entries: [{ kind: 'A', active: false, placedBySeat: 9, locationId: null }] },
    { entries: [{ kind: 'A', active: false, placedBySeat: null, locationId: 'no-such-location' }] },
    { entries: [{ kind: 'A', active: false, placedBySeat: null, locationId: null }, { kind: 'A', active: false, placedBySeat: null, locationId: null }] },
    { entries: [{ kind: 'A', active: true, placedBySeat: null, locationId: 'gate' }] },
  ]
  for (const value of invalid) assert.throws(() => validateEoteSeals(gameState(), value))
  assert.equal(validateEoteSeals(gameState(), undefined), undefined)
})

// ---------------------------------------------------------------------------
// campaign.memorials
// ---------------------------------------------------------------------------

test('P2-B campaign.memorials：划去伙伴后按映射领取纪念遗物一次', () => {
  const state = gameState()
  initializePartners(state, PARTNER_SPEC)
  assert.equal(initializeMemorials(state, MEMORIAL_SPEC), 3)
  assert.equal(memorialFor(state, 'p-a'), 'relic-a')
  assert.throws(() => memorialFor(state, 'p-unknown'), RangeError)

  // 未划去的伙伴不可领取；未知伙伴卡号抛错。
  assert.equal(claimMemorial(state, 'p-a'), null)
  assert.throws(() => claimMemorial(state, 'p-unknown'), RangeError)
  assert.deepEqual(crossedOutMemorials(state), [])
  assert.deepEqual(claimAllAtInterlude(state), [])

  // 阵亡（划去）→ 可领取一次；第二次返回 null 且不重复记录。
  setPartnerStatus(state, 'p-a', 'eliminated')
  setPartnerStatus(state, 'p-b', 'mia')
  assert.deepEqual(crossedOutMemorials(state), [
    { partnerCode: 'p-a', relicCode: 'relic-a', claimed: false },
    { partnerCode: 'p-b', relicCode: 'relic-b', claimed: false },
  ])
  assert.equal(claimMemorial(state, 'p-a'), 'relic-a')
  assert.equal(claimMemorial(state, 'p-a'), null, '已领取返回 null')
  assert.deepEqual(crossedOutMemorials(state).map(entry => entry.claimed), [true, false])
  assert.deepEqual(claimAllAtInterlude(state), [{ partnerCode: 'p-b', relicCode: 'relic-b' }])
  assert.deepEqual(claimAllAtInterlude(state), [], '批量领取幂等')
  assert.deepEqual(claimedMemorials(state).map(entry => entry.partnerCode), ['p-a', 'p-b'])
})

test('P2-B campaign.memorials：存档校验、往返与非法初始化', () => {
  const state = gameState()
  initializePartners(state, PARTNER_SPEC)
  initializeMemorials(state, MEMORIAL_SPEC)
  setPartnerStatus(state, 'p-a', 'eliminated')
  claimMemorial(state, 'p-a')

  for (const clone of [copy(state), JSON.parse(JSON.stringify(state))]) {
    validateEoteContainers(clone)
    validateEoteMemorials(clone, clone.campaign.eote.memorials)
    assert.equal(memorialFor(clone, 'p-c'), 'relic-c')
    assert.deepEqual(crossedOutMemorials(clone), [{ partnerCode: 'p-a', relicCode: 'relic-a', claimed: true }])
    // 往返后仍可继续领取另一位划去伙伴。
    setPartnerStatus(clone, 'p-c', 'eliminated')
    assert.equal(claimMemorial(clone, 'p-c'), 'relic-c')
  }

  const duplicate = { entries: [...MEMORIAL_SPEC.entries, { partnerCode: 'p-a', relicCode: 'relic-x' }] }
  assert.throws(() => initializeMemorials(gameState(), duplicate), /重复的纪念伙伴卡号/)
  assert.throws(() => initializeMemorials(gameState(), { entries: [{ partnerCode: 'p-a', relicCode: 'relic-a', extra: 1 }] }), /未知字段/)
  assert.throws(() => initializeMemorials(gameState(), { entries: [{ partnerCode: 'p-a', relicCode: 'relic-a' }, { partnerCode: 'p-b', relicCode: 'relic-a' }] }), /重复的纪念遗物卡号/)
  assert.throws(() => initializeMemorials(gameState(), { entries: [] }), /entries 数组/)

  const invalid = [
    { entries: [] },
    { entries: [{ partnerCode: 'p-a', relicCode: 'relic-a' }, { partnerCode: 'p-a', relicCode: 'relic-b' }] },
    { entries: [{ partnerCode: 'p-a', relicCode: 'relic-a', extra: true }] },
    { entries: [{ partnerCode: 'p-a', relicCode: 'relic-a' }], claimed: ['p-unknown'] },
    { entries: [{ partnerCode: 'p-a', relicCode: 'relic-a' }], claimed: ['p-a', 'p-a'] },
    { entries: [{ partnerCode: 'p-a', relicCode: 'relic-a' }], claimed: 'p-a' },
  ]
  for (const value of invalid) assert.throws(() => validateEoteMemorials(gameState(), value))
  assert.equal(validateEoteMemorials(gameState(), undefined), undefined)
})

// ---------------------------------------------------------------------------
// campaign.supplies
// ---------------------------------------------------------------------------

test('P2-B campaign.supplies：控制/携带/掉落/回收记录与 SuppliesRecovered', () => {
  const state = gameState()
  assert.equal(initializeSupplies(state, SUPPLY_SPEC), 7)
  assert.deepEqual(supplyItems(state).map(item => item.code), SUPPLY_SPEC.items.map(item => item.code))
  assert.equal(supplyCarrier(state, 'supply-1'), null)
  assert.equal(missingSupplies(state).length, 7, '初始 7 项都未回收')
  assert.deepEqual(recoveredSupplies(state), [])
  assert.deepEqual(droppedSupplies(state), [])

  // 控制权转移：座位 0 → 座位 2；同座位重复指派返回 false。
  assert.equal(assignSupply(state, 'supply-1', 0), true)
  assert.equal(supplyCarrier(state, 'supply-1'), 0)
  assert.deepEqual(carriedSupplies(state, 0).map(item => item.code), ['supply-1'])
  assert.equal(assignSupply(state, 'supply-1', 0), false)
  assert.equal(assignSupply(state, 'supply-1', 2), true)
  assert.equal(supplyCarrier(state, 'supply-1'), 2)
  assert.deepEqual(carriedSupplies(state, 0), [])

  // 掉落在地点 → 可被再次拿走 → 再掉落后回收。
  assert.equal(dropSupplyAt(state, 'supply-1', 'pylon1'), true)
  assert.equal(supplyCarrier(state, 'supply-1'), null)
  assert.deepEqual(droppedSupplies(state), [{ code: 'supply-1', label: '绿色皂石', locationId: 'pylon1' }])
  assert.equal(assignSupply(state, 'supply-1', 1), true, '可以从掉落地点捡回')
  assert.deepEqual(droppedSupplies(state), [])
  assert.equal(dropSupplyAt(state, 'supply-1', 'grotto'), true)

  assert.equal(assignSupply(state, 'supply-2', 0), true)
  assert.equal(dropSupplyAt(state, 'supply-2', 'gate'), true)
  assert.equal(recoverSupply(state, 'supply-2'), true)
  assert.deepEqual(recordSetValues(state.campaign, SUPPLIES_RECOVERED_KEY), ['supply-2'])
  assert.deepEqual(recoveredSupplies(state).map(item => item.code), ['supply-2'])
  assert.equal(missingSupplies(state).length, 6)
  assert.deepEqual(droppedSupplies(state).map(item => item.code), ['supply-1'])
  assert.equal(recoverSupply(state, 'supply-2'), false, '重复回收返回 false')
  assert.deepEqual(recordSetValues(state.campaign, SUPPLIES_RECOVERED_KEY), ['supply-2'])

  // 释放控制：移除控制者但不改回收记录。
  assert.equal(releaseSupply(state, 'supply-1'), false, '掉落中的物资不在控制者手里')
  assert.equal(assignSupply(state, 'supply-3', 2), true)
  assert.equal(releaseSupply(state, 'supply-3'), true)
  assert.equal(supplyCarrier(state, 'supply-3'), null)
  assert.equal(releaseSupply(state, 'supply-3'), false)
  assert.equal(recoverSupply(state, 'supply-4'), true, '未归属物资也可直接记入回收')
  assert.equal(missingSupplies(state).length, 5)
})

test('P2-B campaign.supplies：非法操作抛错或返回 false 且无部分写入', () => {
  const state = gameState()
  initializeSupplies(state, SUPPLY_SPEC)
  assert.throws(() => assignSupply(state, 'supply-unknown', 0), RangeError)
  assert.throws(() => supplyCarrier(state, 'supply-unknown'), RangeError)
  assert.throws(() => assignSupply(state, 'supply-1', 9), RangeError)
  assert.equal(assignSupply(state, 'supply-1', 0), true)
  const before = copy(state)
  assert.throws(() => dropSupplyAt(state, 'supply-1', 'no-such-location'), RangeError)
  assert.throws(() => assignSupply(state, 'supply-1', 1.5), RangeError)
  assert.deepEqual(state, before, '非法座位/地点不得改动控制记录')
  assert.equal(dropSupplyAt(state, 'supply-2', 'gate'), false, '未被携带的物资不会掉落')

  // 校验器：重复定义、未知控制者物资、携带与掉落互斥、回收记录引用未知物资。
  const invalid = [
    { items: [], recoveredKey: SUPPLIES_RECOVERED_KEY },
    { items: [{ code: 's', label: '名' }, { code: 's', label: '名' }], recoveredKey: SUPPLIES_RECOVERED_KEY },
    { items: [{ code: 's', label: '名' }], recoveredKey: 'not a key' },
    { items: [{ code: 's', label: '名' }], recoveredKey: SUPPLIES_RECOVERED_KEY, carriers: { 9: ['s'] } },
    { items: [{ code: 's', label: '名' }], recoveredKey: SUPPLIES_RECOVERED_KEY, carriers: { 0: ['unknown'] } },
    { items: [{ code: 's', label: '名' }], recoveredKey: SUPPLIES_RECOVERED_KEY, carriers: { 0: ['s'], 1: ['s'] } },
    { items: [{ code: 's', label: '名' }], recoveredKey: SUPPLIES_RECOVERED_KEY, dropped: { s: 'no-such-location' } },
    { items: [{ code: 's', label: '名' }], recoveredKey: SUPPLIES_RECOVERED_KEY, carriers: { 0: ['s'] }, dropped: { s: 'gate' } },
  ]
  for (const value of invalid) assert.throws(() => validateEoteSupplies(gameState(), value))
  // 回收记录与容器不一致：已回收但仍被携带。
  const inconsistent = gameState()
  initializeSupplies(inconsistent, SUPPLY_SPEC)
  assignSupply(inconsistent, 'supply-1', 0)
  inconsistent.campaign.records[SUPPLIES_RECOVERED_KEY] = ['supply-1']
  assert.throws(() => validateEoteSupplies(inconsistent, inconsistent.campaign.eote.supplies), /已回收但仍被携带/)
  assert.equal(validateEoteSupplies(gameState(), undefined), undefined)
})

test('P2-B campaign.supplies：存档校验与 structuredClone/JSON 往返', () => {
  const state = gameState()
  initializeSupplies(state, SUPPLY_SPEC)
  assignSupply(state, 'supply-1', 0)
  assignSupply(state, 'supply-2', 1)
  assignSupply(state, 'supply-3', 2)
  dropSupplyAt(state, 'supply-3', 'pylon1')
  recoverSupply(state, 'supply-4')

  for (const clone of [copy(state), JSON.parse(JSON.stringify(state))]) {
    validateEoteContainers(clone)
    validateEoteSupplies(clone, clone.campaign.eote.supplies)
    assert.equal(supplyCarrier(clone, 'supply-1'), 0)
    assert.deepEqual(droppedSupplies(clone).map(item => item.code), ['supply-3'])
    assert.deepEqual(recoveredSupplies(clone).map(item => item.code), ['supply-4'])
    assert.equal(missingSupplies(clone).length, 6)
    assert.equal(assignSupply(clone, 'supply-5', 2), true, '往返后仍可继续操作')
  }

  assert.throws(() => initializeSupplies(state, SUPPLY_SPEC), /已初始化/)
  const fresh = gameState()
  assert.throws(() => initializeSupplies(fresh, { items: [] }), /items 数组/)
  assert.throws(() => initializeSupplies(fresh, { items: [{ code: 's', label: '' }] }), /显示名/)
  assert.equal('eote' in fresh.campaign, false)
})

// ---------------------------------------------------------------------------
// 容器与读点边界
// ---------------------------------------------------------------------------

test('P2-B 战役级容器：读点不创建，initialize 才建 eote，四模块共存可校验', () => {
  const state = gameState()
  const before = copy(state)
  assert.equal(eoteCampaignState(state), null)
  assert.equal(partnerState(state, 'p-a'), null)
  assert.deepEqual(remainingPartners(state), [])
  assert.deepEqual(sealsOf(state), [])
  assert.equal(sealState(state, 'A'), null)
  assert.equal(memorialFor(state, 'p-a'), null)
  assert.deepEqual(crossedOutMemorials(state), [])
  assert.deepEqual(supplyItems(state), [])
  assert.deepEqual(recoveredSupplies(state), [])
  assert.deepEqual(missingSupplies(state), [])
  assert.deepEqual(claimAllAtInterlude(state), [], '未初始化时批量领取返回空数组（只读，不建容器）')
  for (const attempt of [
    () => adjustPartnerHarm(state, 'p-a', { damage: 1 }),
    () => activateSeal(state, 'A'),
    () => recoverSupply(state, 'supply-1'),
  ]) assert.throws(attempt)
  assert.deepEqual(state, before, '所有读点与失败写入都不得创建 EotE 容器')
  assert.equal('eote' in state.campaign, false)

  // 四个模块依次初始化后共享同一 campaign.eote 容器（version 1）。
  initializePartners(state, PARTNER_SPEC)
  initializeSeals(state)
  initializeMemorials(state, MEMORIAL_SPEC)
  initializeSupplies(state, SUPPLY_SPEC)
  assert.deepEqual(Object.keys(state.campaign.eote).sort(), ['memorials', 'partners', 'seals', 'supplies', 'version'])
  validateEoteContainers(state)
  validateEotePartners(state, state.campaign.eote.partners)
  validateEoteSeals(state, state.campaign.eote.seals)
  validateEoteMemorials(state, state.campaign.eote.memorials)
  validateEoteSupplies(state, state.campaign.eote.supplies)

  // 整容器 structuredClone / JSON 往返后四个校验器与读点全部保持。
  for (const clone of [copy(state), JSON.parse(JSON.stringify(state))]) {
    validateEoteContainers(clone)
    validateEotePartners(clone, clone.campaign.eote.partners)
    validateEoteSeals(clone, clone.campaign.eote.seals)
    validateEoteMemorials(clone, clone.campaign.eote.memorials)
    validateEoteSupplies(clone, clone.campaign.eote.supplies)
    assert.equal(clone.campaign.eote.version, 1)
    assert.equal(partnerState(clone, 'p-b').damage, 1)
    assert.equal(sealsOf(clone).length, 5)
    assert.equal(memorialFor(clone, 'p-c'), 'relic-c')
    assert.equal(supplyItems(clone).length, 7)
  }

  // 容器级形状仍由 eote-state.js 校验：多出未知字段必须被拒。
  const tampered = copy(state)
  tampered.campaign.eote.unknown = true
  assert.throws(() => validateEoteContainers(tampered), /未知字段/)
  // 旧存档（没有任何 EotE 容器）读点不注入字段。
  const legacy = { campaign: { records: { someRecord: ['x'] } }, investigators: [], locations: [] }
  assert.deepEqual(remainingPartners(legacy), [])
  assert.deepEqual(recoveredSupplies(legacy), [])
  assert.equal('eote' in legacy.campaign, false)
})
