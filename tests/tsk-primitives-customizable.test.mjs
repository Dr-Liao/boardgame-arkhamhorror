// TSK P2 原语验收 E：定制升级卡（customizable）。
//
// 覆盖 new.customizableCard / customizationUpgrade、extend.costDiscount（modifiers.js 的外部修正源读点）。
// 口径：勾选格数 = 经验、等级 = ceil(格数/2)、升级只能增加勾选；注册表全局清理避免跨用例污染。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  customizationChecked, customizationCheckedCount, customizationCheckboxCount, customizationLevel,
  customizationOptions, customizationPlayCostDelta, customizationRegistrySize, customizationXpCost,
  customizationsOfSeat, registerCustomizationEffects, registerCustomizationOptions, upgradeCustomization,
  validateTskCustomizations,
} from '../src/engine/tsk-customizable.js'
import { clearModifierProviders, playCostDelta, registerModifierProvider } from '../src/engine/modifiers.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'

const plain = () => ({
  round: 1,
  investigators: [{ seat: 0, name: '甲', location: 'locA', assets: [], threat: [] }],
  locations: [{ id: 'locA', name: '甲地', connections: [] }],
  enemies: [],
  campaign: { records: {} },
  scenarioFlags: {},
})
const roundTrip = value => JSON.parse(JSON.stringify(value))

// 注册测试用的定制卡（不写真实卡号语义；引擎不认卡号）。
registerCustomizationOptions({
  tskTestCustom: [
    { name: '一档', checks: 2, text: '勾选 1 次：+1 技能；勾选 2 次：+2 技能' },
    { name: '二档', checks: 3, text: '勾选 3 次获得额外效果' },
  ],
})
registerCustomizationEffects({
  tskTestCustom: { playCost: checkedCounts => -checkedCounts.length },
})

test('定制选项注册与格数：重复注册拒绝、未知卡拒绝、勾选格上限', () => {
  assert.deepEqual(customizationOptions('tskTestCustom').map(option => option.checks), [2, 3])
  assert.equal(customizationCheckboxCount('tskTestCustom'), 5)
  assert.throws(() => registerCustomizationOptions({ tskTestCustom: [{ name: 'x', checks: 1 }] }), /已注册/)
  assert.throws(() => registerCustomizationOptions({ tskBad: [{ name: '', checks: 1 }] }), /选项名/)
  assert.throws(() => registerCustomizationOptions({ tskBad2: [{ name: 'a', checks: 0 }] }), /正整数/)
  assert.throws(() => registerCustomizationEffects({ tskTestCustom: { unknown: () => 1 } }), /未知定制效果/)
  assert.equal(customizationOptions('missing'), null)
  assert.equal(customizationCheckboxCount('missing'), 0)
})

test('等级与经验：ceil(格数/2)；每格 1 经验；exceptional 双倍', () => {
  assert.equal(customizationCheckedCount([0, 0, 1]), 3)
  assert.equal(customizationLevel([]), 0)
  assert.equal(customizationLevel([0]), 1)
  assert.equal(customizationLevel([0, 0]), 1)
  assert.equal(customizationLevel([0, 0, 1]), 2)
  assert.equal(customizationLevel([0, 0, 1, 1]), 2)
  assert.equal(customizationLevel([0, 0, 1, 1, 1]), 3)
  assert.equal(customizationXpCost([0, 0, 1]), 3)
  assert.equal(customizationXpCost([0, 0, 1], { costPerCheck: 2 }), 6)
  assert.throws(() => customizationXpCost([0], { costPerCheck: 0 }), /正整数/)
})

test('升级：只能增加勾选、经验不足拒绝、非法勾选不写入；JSON 往返', () => {
  const state = plain()
  assert.deepEqual(customizationChecked(state, 0, 'tskTestCustom'), [])
  const first = upgradeCustomization(state, { seat: 0, code: 'tskTestCustom', checked: [0], availableXp: 5 })
  assert.deepEqual(first, { code: 'tskTestCustom', checked: [0], level: 1, xpCost: 1, availableXp: 4 })
  assert.deepEqual(customizationChecked(state, 0, 'tskTestCustom'), [0])
  const second = upgradeCustomization(state, { seat: 0, code: 'tskTestCustom', checked: [0, 0, 1], availableXp: 4 })
  assert.equal(second.level, 2)
  assert.equal(second.xpCost, 2, '只对新增格数收费')
  assert.deepEqual(customizationChecked(state, 0, 'tskTestCustom'), [0, 0, 1])
  // 撤销勾选拒绝。
  assert.throws(() => upgradeCustomization(state, { seat: 0, code: 'tskTestCustom', checked: [0], availableXp: 9 }), /不能撤销/)
  // 超过单项格上限拒绝。
  assert.throws(() => upgradeCustomization(state, { seat: 0, code: 'tskTestCustom', checked: [0, 0, 0], availableXp: 9 }), /最多勾选 2 格/)
  // 经验不足拒绝且不写入（新增 1 格，但可用 0 点）。
  assert.throws(() => upgradeCustomization(state, { seat: 0, code: 'tskTestCustom', checked: [0, 0, 1, 1], availableXp: 0 }), /经验不足/)
  assert.deepEqual(customizationChecked(state, 0, 'tskTestCustom'), [0, 0, 1])
  // 注册表内卡走严格校验；未注册卡只校验形状（P7 通过注册表补齐）。
  assert.deepEqual(customizationsOfSeat(state, 0), { tskTestCustom: [0, 0, 1] })
  validateTskCustomizations(state)
  validateTskState(state)
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.deepEqual(customizationChecked(restored, 0, 'tskTestCustom'), [0, 0, 1])
})

test('extend.costDiscount 读点：modifiers 外部修正源进入 playCostDelta', () => {
  const state = plain()
  state.campaign.tsk ||= { version: 1, customizations: { version: 1, bySeat: { 0: { tskTestCustom: [0, 0, 1] } } } }
  clearModifierProviders('playCost')
  assert.equal(playCostDelta(state, state.investigators[0], 'tskTestCustom'), 0, '未注册 provider 时为 0')
  // 内容层注册 provider：定制卡勾选越多费用越低（-1/格）。
  registerModifierProvider('playCost', ({ state: live, inv, code }) => {
    if (code !== 'tskTestCustom') return 0
    const checked = customizationChecked(live, inv.seat, code)
    return customizationPlayCostDelta(inv.seat, code, checked)
  })
  assert.equal(playCostDelta(state, state.investigators[0], 'tskTestCustom'), -3)
  assert.equal(playCostDelta(state, state.investigators[0], 'otherCard'), 0)
  // 负路径：未知 provider 种类/非法函数拒绝。
  assert.throws(() => registerModifierProvider('nope', () => 0), /未知外部修正种类/)
  assert.throws(() => registerModifierProvider('playCost', null), /必须是函数/)
  clearModifierProviders()
  assert.equal(playCostDelta(state, state.investigators[0], 'tskTestCustom'), 0)
})

test('读档校验：非法座位/未知卡勾选形状被拒绝', () => {
  const state = plain()
  state.campaign.tsk = { version: 1, customizations: { version: 1, bySeat: { 0: { tskTestCustom: [0] } } } }
  validateTskCustomizations(state)
  const badSeat = roundTrip(state)
  badSeat.campaign.tsk.customizations.bySeat['9'] = {}
  assert.throws(() => validateTskState(badSeat), /定制卡座位无效/)
  const badIndex = roundTrip(state)
  badIndex.campaign.tsk.customizations.bySeat[0].tskTestCustom = [9]
  assert.throws(() => validateTskState(badIndex), /越界/)
  assert.equal(customizationRegistrySize().options >= 1, true)
})
