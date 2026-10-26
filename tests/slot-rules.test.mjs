// 槽位规则回归。两类「效果没生效」的同类问题都收在这里：
//   1. 05009「侦探的柯尔特1911式手枪」的「你控制的最多 2 张[[工具]]支援不占用手部槽位」
//      必须把「正在打出的那张[[工具]]」一起算进豁免；
//   2. 02147「子弹袋」的「额外 1 个手部槽位，只可以用来携带[[武器]]」必须允许已在场的武器
//      占用武器专用槽，从而把普通手槽让给非武器支援。
// 两者的共同根因：槽位判定只统计「已控制」的支援，没有把候选卡 / 槽位类型可挪动性算进去。
// 2026-10-26 原语层收敛后：受限额外槽只剩一个原语 restrictedSlots（容量 + 占用统一读
// src/engine/assets.js 的 restrictedSlotInfo），占用豁免只剩 slotExemptions（slotExemptionRelief）；
// 本文件末尾另有一份覆盖全部可玩槽位卡的边界矩阵与「原语唯一口径」守卫，防止同类回归。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { slotUsage, canEquip, assetReplacementPlans, legalMoves } from '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'

const me = state => state.investigators[0]

const COLT = '05009' // 侦探的柯尔特1911式手枪：Hand x2，slotExemptions 工具手槽豁免 2
const MAGNIFYING_GLASS = '01030' // 放大镜：Hand，[[工具]]
const FLASHLIGHT = '01087' // 手电筒：Hand，[[工具]]
const MACHETE = '01020' // 大砍刀：Hand，非[[工具]]（武器）

// 把核心对局的调查员换成乔·戴蒙德（05002），与 tcu-investigators 的 investigatorFixture 同口径。
function joeFixture() {
  const state = fixture('01001')
  const inv = me(state)
  const card = ALL_CARDS['05002']
  Object.assign(inv, {
    code: '05002', name: card.nameZh, nameEn: card.name,
    willpower: card.willpower, intellect: card.intellect, combat: card.combat, agility: card.agility,
    baseHealth: card.health, baseSanity: card.sanity, health: card.health, sanity: card.sanity,
    maxHealth: card.health, maxSanity: card.sanity,
    beneath: [], assets: [], threat: [], damage: 0, horror: 0,
  })
  return state
}

function joeWithColt() {
  const state = joeFixture()
  const inv = me(state)
  inv.assets = [{ id: 'colt', code: COLT, exhausted: false, uses: 4, usesType: 'ammo' }]
  inv.discard = []
  inv.resources = 10
  inv.actionsLeft = 5
  return { state, inv }
}

test('05009 柯尔特：在场时打出第一张[[工具]]（放大镜）不需要弃置资产腾槽', () => {
  const { state, inv } = joeWithColt()
  inv.hand = [MAGNIFYING_GLASS]
  assert.equal(slotUsage(inv).hand, 2, '柯尔特双手占满手槽')
  assert.equal(canEquip(inv, ALL_CARDS[MAGNIFYING_GLASS]), true, '放大镜是[[工具]]，应被柯尔特豁免手槽')
  assert.deepEqual(assetReplacementPlans(inv, ALL_CARDS[MAGNIFYING_GLASS]), [[]], '不需要弃置任何资产')
  assert.ok(legalMoves(state).some(moveOption => moveOption.action === 'play' && moveOption.cardId === MAGNIFYING_GLASS),
    '放大镜应在合法行动列表里')
  move(state, { action: 'play', cardId: MAGNIFYING_GLASS })
  settle(state)
  const after = me(state)
  assert.ok(after.assets.some(asset => asset.code === COLT), '柯尔特仍在场')
  assert.ok(after.assets.some(asset => asset.code === MAGNIFYING_GLASS), '放大镜进入场上')
  assert.deepEqual(after.discard, [], '不为放大镜弃置资产')
  assert.equal(slotUsage(after).hand, 2, '柯尔特 2 手槽 + 放大镜被豁免')
})

test('05009 柯尔特：在场时第二张[[工具]]同样豁免手槽', () => {
  const { state, inv } = joeWithColt()
  inv.assets.push({ id: 'tool1', code: MAGNIFYING_GLASS, exhausted: false })
  inv.hand = [FLASHLIGHT]
  assert.equal(slotUsage(inv).hand, 2, '第一张工具被豁免后仍只剩柯尔特双手')
  assert.equal(canEquip(inv, ALL_CARDS[FLASHLIGHT]), true, '第二张[[工具]]也应被豁免手槽')
  move(state, { action: 'play', cardId: FLASHLIGHT })
  settle(state)
  const after = me(state)
  assert.deepEqual(after.assets.map(asset => asset.code).sort(), [COLT, MAGNIFYING_GLASS, FLASHLIGHT].sort())
  assert.deepEqual(after.discard, [], '不为第二张工具弃置资产')
  assert.equal(slotUsage(after).hand, 2, '两张工具都不占手槽')
})

test('05009 柯尔特：豁免只作用于[[工具]]；非工具与第三张工具仍受手槽限制', () => {
  const { state, inv } = joeWithColt()
  assert.equal(canEquip(inv, ALL_CARDS[MACHETE]), false, '非[[工具]]手部支援不能吃豁免（双手已被柯尔特占满）')

  inv.assets.push(
    { id: 'tool1', code: MAGNIFYING_GLASS, exhausted: false },
    { id: 'tool2', code: FLASHLIGHT, exhausted: false },
  )
  assert.equal(slotUsage(inv).hand, 2, '两张[[工具]]都被豁免')
  assert.equal(canEquip(inv, ALL_CARDS['01040']), false, '第 3 张[[工具]]没有豁免名额，手槽已满')
  assert.ok(assetReplacementPlans(inv, ALL_CARDS['01040']).length > 0,
    '第 3 张工具只能通过弃置资产（先失掉一张被豁免的工具）腾出位置')
})

// ---------------------------------------------------------------------------
// 02147 子弹袋：「你拥有额外1个手部槽位，只可以用来携带[[武器]]支援。」
// 已控制的武器可以占用武器专用槽，把普通手槽让给非武器支援；判断「非武器候选」时
// 必须把这份可挪动性折抵掉，否则「子弹袋 + 武器 + 非武器」会误判普通手槽已满。
// 2026-10-26 起由受限额外槽原语 restrictedSlots 统一表达（不再走 extraSlots.handWeapon）。
// ---------------------------------------------------------------------------
const BANDOLIER = '02147' // 子弹袋：Body，restrictedSlots [{slot:'hand', traitsAny:['Weapon'], count:1}]
const PISTOL = '01016' // .45自动手枪：Hand，[[武器]]
const MACHETE_HAND = '01020' // 大砍刀：Hand，[[武器]]
const KNIFE = '01086' // 刀子：Hand，[[武器]]

function fixtureWith(assets) {
  const state = joeFixture()
  const inv = me(state)
  inv.assets = assets.map((code, index) => ({ id: `s${index}`, code, exhausted: false }))
  inv.discard = []
  inv.resources = 10
  inv.actionsLeft = 5
  return { state, inv }
}

test('fix 02147 子弹袋：武器可占武器专用手槽，非武器候选不应被误判满槽', () => {
  // 子弹袋 + 1 武器 + 1 非武器：普通槽应还有 1 个空位（武器可移入专用槽）。
  const a = fixtureWith([BANDOLIER, PISTOL, MAGNIFYING_GLASS])
  assert.equal(canEquip(a.inv, ALL_CARDS[FLASHLIGHT]), true, '普通手槽仍有 1 个空位')
  // 子弹袋 + 2 武器：普通槽 2 个都可以给非武器（两把武器最多占 1 个专用槽 + 1 个普通槽）。
  const b = fixtureWith([BANDOLIER, PISTOL, MACHETE_HAND])
  assert.equal(canEquip(b.inv, ALL_CARDS[MAGNIFYING_GLASS]), true, '武器可占专用槽，普通槽应有余量')
  // 子弹袋 + 1 武器 + 2 非武器：非武器已占满普通槽，不能再打非武器。
  const c = fixtureWith([BANDOLIER, PISTOL, MAGNIFYING_GLASS, FLASHLIGHT])
  assert.equal(canEquip(c.inv, ALL_CARDS['01040']), false, '3 件非武器超出 2 个普通手槽')
  // 子弹袋 + 2 非武器：非武器占满普通槽，但武器专用槽还空着。
  const d = fixtureWith([BANDOLIER, MAGNIFYING_GLASS, FLASHLIGHT])
  assert.equal(canEquip(d.inv, ALL_CARDS[PISTOL]), true, '武器仍可进专用槽')
  assert.equal(canEquip(d.inv, ALL_CARDS['01040']), false, '再打非武器仍然超槽')
  // 子弹袋 + 3 武器：专用槽只有 1 个，第 4 把武器仍然超出总手槽。
  const e = fixtureWith([BANDOLIER, PISTOL, MACHETE_HAND, KNIFE])
  assert.equal(canEquip(e.inv, ALL_CARDS['01044']), false, '第 4 把武器超出手槽')
})

test('fix 02147 子弹袋：非武器候选的合法出牌不再触发腾槽弃置', () => {
  const { state, inv } = fixtureWith([BANDOLIER, PISTOL, MAGNIFYING_GLASS])
  inv.hand = [FLASHLIGHT]
  assert.deepEqual(assetReplacementPlans(inv, ALL_CARDS[FLASHLIGHT]), [[]], '不需要弃置任何资产')
  move(state, { action: 'play', cardId: FLASHLIGHT })
  settle(state)
  const after = state.investigators[0]
  assert.ok(after.assets.some(asset => asset.code === FLASHLIGHT), '手电筒进入场上')
  assert.deepEqual(after.discard, [], '没有弃置资产')
})

// ---------------------------------------------------------------------------
// 全部可玩「额外/受限槽位」卡的边界矩阵：确保同类问题（候选卡或槽位类型可挪动性
// 没被计入）不再出现。新增槽位机制时应在这里补用例。
// ---------------------------------------------------------------------------
test('槽位卡矩阵：额外槽与受限槽的合法/非法边界', () => {
  const CASES = [
    ['手提包+2书：第3本书（候选书）可装备', ['01008', '01009', '01031'], '01042', true],
    ['手提包+2书+1非书：普通槽还有 1 个，可再打非书', ['01008', '01009', '01031', '01044'], '01086', true],
    ['手提包+2书+2非书：普通槽满，不可再打非书', ['01008', '01009', '01031', '01044', '01086'], '01047', false],
    ['手提包+4书：书位满，不可打第5书', ['01008', '01009', '01031', '01035', '01042'], '03011', false],
    ['子弹袋+2武器：可打第3武器（专用槽）', ['02147', '01006', '01020'], '01016', true],
    ['子弹袋+3武器：不可打第4武器', ['02147', '01006', '01020', '01016'], '01044', false],
    ['魔法手势+2法术：可打第3法术（受限槽）', ['05112', '01060', '01061'], '02028', true],
    ['魔法手势+3法术：不可打第4法术', ['05112', '01060', '01061', '02028'], '02154', false],
    ['米奇+1非独特：可打第2非独特（受限盟友槽）', ['04006', '01018'], '01021', true],
    ['米奇+2非独特：不可打第3非独特', ['04006', '01018', '01021'], '01032', false],
    ['米奇在场：不可再打独特盟友', ['04006'], '01033', false],
    ['米奇+2非独特：不可再打独特盟友', ['04006', '01018', '01021'], '01033', false],
    ['米奇+魅力超凡：可打第2独特盟友（不受限盟友槽共2）', ['04006', '02158'], '01033', true],
    ['米奇+魅力超凡+1独特：不可打第2独特', ['04006', '02158', '01033'], '01048', false],
    ['米奇+魅力超凡+2非独特：可打第2独特（非独特进受限槽）', ['04006', '02158', '01018', '01021'], '01033', true],
    ['米奇+魅力超凡+2非独特：可打第3非独特（共4盟友，非独特占满受限槽）', ['04006', '02158', '01018', '01021'], '01032', true],
    ['米奇+魅力超凡+3非独特：不可打第4非独特（共5盟友）', ['04006', '02158', '01018', '01021', '01032'], '01055', false],
    ['魅力超凡+1盟友：可打第2盟友', ['02158', '01018'], '01021', true],
    ['宝物猎人+1饰品：可打第2饰品', ['02157', '01012'], '01014', true],
    ['影之书+2法术：可打第3法术', ['01070', '01060', '01061'], '02028', true],
    ['影之书+3法术：不可打第4法术', ['01070', '01060', '01061', '02028'], '02154', false],
    ['安娜+2塔罗：可打第3塔罗', ['05283', '05023', '05027'], '05031', true],
    ['安娜+3塔罗：不可打第4塔罗', ['05283', '05023', '05027', '05031'], '05035', false],
    ['无安娜：不可打第2塔罗', ['05023'], '05027', false],
  ]
  for (const [label, assets, candidate, expected] of CASES) {
    const { inv } = fixtureWith(assets)
    assert.equal(canEquip(inv, ALL_CARDS[candidate]), expected, label)
  }
})

// ---------------------------------------------------------------------------
// 原语层守卫：槽位效果只有三个声明口径——
//   受限额外槽 restrictedSlots；占用豁免 slotExemptions；通用额外槽 add:slot 修正。
// 不许再长出「某张卡专用的槽位字段」或「只能在候选是某类型时才加容量」的旁路实现；
// 旧字段（extraSlots.handWeapon / tomeHandSlotsPerCopy / handSlotsBonus /
// allySlotsForNonUnique / toolHandSlotsExempt）已迁移删除，出现任何一处都说明有回退。
// ---------------------------------------------------------------------------
test('槽位原语：受限槽 / 占用豁免 / 通用额外槽各只有一个声明口径', () => {
  // 受限额外槽：restrictedSlots（traitsAny 或 unique 谓词 + count）
  const restrictedOf = code => (registeredEntry(code)?.restrictedSlots || [])
    .map(spec => [spec.slot, spec.traitsAny ?? null, spec.unique ?? null, spec.count])
  assert.deepEqual(restrictedOf('01008'), [['hand', ['Tome'], null, 2]], '01008 书位')
  assert.deepEqual(restrictedOf('02147'), [['hand', ['Weapon'], null, 1]], '02147 武器位')
  assert.deepEqual(restrictedOf('05112'), [['arcane', ['Spell', 'Ritual'], null, 1]], '05112 法术位')
  assert.deepEqual(restrictedOf('04006'), [['ally', null, false, 2]], '04006 非独特盟友受限槽')

  // 占用豁免：slotExemptions（05009 工具手槽）
  assert.deepEqual(registeredEntry('05009')?.slotExemptions,
    [{ slot: 'hand', traitsAny: ['Tool'], count: 2 }], '05009 工具手槽豁免')

  // 通用额外槽：add:slot 修正（01070 影之书 / 02157 宝物猎人 / 02158 魅力超凡）
  for (const [code, slot] of [['01070', 'arcane'], ['02157', 'accessory'], ['02158', 'ally']]) {
    const modifiers = registeredEntry(code).modifiers.filter(modifier => modifier.target === 'add:slot')
    assert.deepEqual(modifiers, [{ target: 'add:slot', value: slot, amount: 1 }], `${code} 通用额外槽`)
    assert.equal(registeredEntry(code).passive?.extraSlots, undefined, `${code} 不再使用 passive.extraSlots`)
  }

  // 旧旁路字段不得复活
  for (const code of ['01008', '02147', '05112', '04006', '05009', '01070', '02157', '02158']) {
    const entry = registeredEntry(code)
    assert.equal(entry.tomeHandSlotsPerCopy, undefined, `${code} 不再使用 tomeHandSlotsPerCopy`)
    assert.equal(entry.toolHandSlotsExempt, undefined, `${code} 不再使用 toolHandSlotsExempt`)
    assert.equal(entry.passive?.handSlotsBonus, undefined, `${code} 不再使用 passive.handSlotsBonus`)
    assert.equal(entry.passive?.allySlotsForNonUnique, undefined, `${code} 不再使用 passive.allySlotsForNonUnique`)
  }
})
