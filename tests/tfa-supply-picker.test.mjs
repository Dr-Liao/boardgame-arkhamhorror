import test from 'node:test'
import assert from 'node:assert/strict'
import { supplyPickerModel, renderSupplyPicker } from '../web/supply-picker.js'

// 失落的时代补给品选购界面：补给是卡牌式选项，完成按钮必须独立在网格之外。
// 这里只读观察投影与 legalMoves，和浏览器端用的是同一份模型。
const campaign = () => ({
  supplyLabels: { provisions: '配给', medicine: '药品', rope: '绳索' },
  supplyCosts: { provisions: 1, medicine: 2, rope: 3 },
  supplyHints: { provisions: '一人份的干粮和水。', medicine: '治病解毒。', rope: '攀爬少不了它。' },
  supplyLists: { prologue: ['provisions', 'medicine', 'rope'] },
  supplies: { 0: ['provisions'] },
  supplyPoints: { 0: 2 },
  investigators: { 0: { code: '04001' } },
})

const view = (overrides = {}) => ({
  state: {
    pendingChoice: {
      id: 'q-supply', kind: 'pickSupplies', seat: 0,
      prompt: '里奥·安德森：选择补给品(剩余2点补给品点数)',
      source: { context: 'prologue' },
      options: [
        { id: 'done', label: '完成购买（剩余点数不退还）' },
        { id: 'provisions', label: '配给（1 点）' },
        { id: 'medicine', label: '药品（2 点）' },
      ],
    },
    legalMoves: [
      { action: 'choose', choiceId: 'q-supply', optionId: 'done', label: '完成购买（剩余点数不退还）' },
      { action: 'choose', choiceId: 'q-supply', optionId: 'provisions', label: '配给（1 点）' },
      { action: 'choose', choiceId: 'q-supply', optionId: 'medicine', label: '药品（2 点）' },
    ],
    campaign: campaign(),
    investigators: [{ seat: 0, name: '里奥·安德森' }],
    ...overrides,
  },
})

test('补给选购：卡面来自完整清单，买不起的补给也显示但不可购买', () => {
  const model = supplyPickerModel(view())
  assert.equal(model.context, 'prologue')
  assert.equal(model.remaining, 2)
  assert.equal(model.investigator.name, '里奥·安德森')
  assert.deepEqual(model.items.map(item => item.name), ['provisions', 'medicine', 'rope'])
  const [provisions, medicine, rope] = model.items
  assert.equal(provisions.label, '配给')
  assert.equal(provisions.cost, 1)
  assert.equal(provisions.hint, '一人份的干粮和水。')
  assert.equal(provisions.owned, 1)
  assert.equal(provisions.purchasable, true)
  assert.equal(medicine.purchasable, true)
  // 绳索 3 点 > 剩余 2 点：服务端本来就不会给这个选项，界面仍把它画成一张灰卡。
  assert.equal(rope.label, '绳索')
  assert.equal(rope.cost, 3)
  assert.equal(rope.affordable, false)
  assert.equal(rope.purchasable, false)
  assert.equal(rope.move, null)
})

test('完成购买不属于补给卡：单独给出 done 动作', () => {
  const model = supplyPickerModel(view())
  assert.equal(model.items.some(item => item.name === 'done'), false)
  assert.equal(model.done.optionId, 'done')
  // legalMoves 只给可购买项；没有合法动作时不能下单，但完成仍然可用。
  const withoutMedicine = view()
  withoutMedicine.state.legalMoves = withoutMedicine.state.legalMoves.filter(move => move.optionId !== 'medicine')
  const strict = supplyPickerModel(withoutMedicine)
  assert.equal(strict.items.find(item => item.name === 'medicine').purchasable, false)
  assert.equal(strict.done.optionId, 'done')
})

test('旧存档缺少单价与清单投影时退回可购买选项，并从标签里读出点数', () => {
  const legacy = view({
    campaign: {
      supplyLabels: { provisions: '配给', medicine: '药品' },
      supplies: {}, supplyPoints: {},
    },
  })
  const model = supplyPickerModel(legacy)
  assert.equal(model.remaining, null)
  assert.deepEqual(model.items.map(item => item.name), ['provisions', 'medicine'])
  assert.deepEqual(model.items.map(item => item.cost), [1, 2])
  assert.equal(model.items.every(item => item.purchasable), true)
})

test('补给点清单与序幕清单分开：汽油与工具只在补给点出售', async () => {
  const { SUPPLY_COSTS, SUPPLY_HINTS, SUPPLY_LABELS, SUPPLY_LISTS } = await import('../content/campaigns/theForgottenAge/supplies.js')
  assert.equal(SUPPLY_LISTS.prologue.includes('gasoline'), false)
  assert.equal(SUPPLY_LISTS.resupplyPoint.includes('gasoline'), true)
  assert.equal(SUPPLY_LISTS.resupplyPoint.includes('pickaxe'), true)
  // 可购买的每种补给都必须有中文名、点数与卡面说明，卡牌不会出现空名或空价。
  for (const name of new Set([...SUPPLY_LISTS.prologue, ...SUPPLY_LISTS.resupplyPoint])) {
    assert.ok(SUPPLY_LABELS[name], name)
    assert.ok(Number.isFinite(SUPPLY_COSTS[name]), name)
    assert.ok(SUPPLY_HINTS[name], name)
  }
  const resupply = view()
  resupply.state.pendingChoice = { ...resupply.state.pendingChoice, source: { context: 'resupplyPoint' } }
  resupply.state.campaign = {
    ...campaign(), supplyLabels: SUPPLY_LABELS, supplyCosts: SUPPLY_COSTS,
    supplyHints: SUPPLY_HINTS, supplyLists: SUPPLY_LISTS,
  }
  const model = supplyPickerModel(resupply)
  assert.equal(model.context, 'resupplyPoint')
  assert.equal(model.items.some(item => item.name === 'gasoline'), true)
  assert.equal(model.items.some(item => item.name === 'pickaxe'), true)
  assert.equal(model.items.some(item => item.name === 'rope'), false)
  assert.equal(model.items.some(item => item.name === 'torches'), false)
})

test('没有 legalMoves（等待队友或提交中）时卡片不可购买', () => {
  const waiting = view({ legalMoves: [] })
  const model = supplyPickerModel(waiting)
  assert.equal(model.items.every(item => item.purchasable === false), true)
  assert.equal(model.done, null)
})

// 引擎 → 观察投影 → 选购模型：界面需要的单价、说明、清单与上下文都由服务端下发。
test('真实引擎的序幕待决选择带上单价、说明、清单与上下文', async () => {
  const { createGameState, applyMove } = await import('../src/engine/engine.js')
  const { viewState } = await import('../src/integration/observation.js')
  const { manifest } = await import('../content/campaigns/theForgottenAge/manifest.js')
  const state = createGameState({ campaignId: manifest.id, campaignHub: true, seed: 'supply-picker' },
    [{ seat: 0, role: 'human' }])
  const move = action => applyMove(state, 0, action)
  move({ action: 'hubGoSetup' })
  move({ action: 'hubSelectInvestigator', code: '04001' })
  move({ action: 'hubAutoDeck' })
  move({ action: 'hubDoneSeat' })
  move({ action: 'hubBeginScenario' })
  // 序幕先问领队，领队选完后才逐位购买补给。
  for (let guard = 0; state.pendingChoice && state.pendingChoice.kind !== 'pickSupplies' && guard < 20; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  assert.equal(state.pendingChoice.kind, 'pickSupplies')
  const model = supplyPickerModel({ state: viewState(state, 0) })
  assert.equal(model.context, 'prologue')
  assert.equal(model.remaining, 10)
  // 序幕清单 11 种（汽油、折叠小刀、鹤嘴锄只在补给点出现）。
  assert.equal(model.items.length, 11)
  assert.equal(model.items.some(item => item.name === 'gasoline'), false)
  const rope = model.items.find(item => item.name === 'rope')
  assert.equal(rope.cost, 3)
  assert.equal(rope.label, '绳索')
  assert.ok(rope.hint.includes('绳索'))
  assert.ok(model.items.find(item => item.name === 'provisions').hint.includes('干粮'))
  assert.equal(model.done.optionId, 'done')
})

// 只测结构：完成按钮在独立的完成栏，补给卡在网格里，两者不在同一个节点内。
test('面板把完成按钮放在独立完成栏，补给卡在网格里', () => {
  const createElementNS = () => ({ setAttribute() {}, append() {} })
  globalThis.document = { createElementNS }
  try {
    const h = (tag, props = {}, ...children) => ({
      tag, props: props || {}, children: children.flat(Infinity).filter(child => child != null),
    })
    const model = supplyPickerModel(view())
    const panel = renderSupplyPicker(h, model, {})
    const body = panel.children.find(child => child.props?.className === 'ah-supply-market-body')
    const grid = body.children.find(child => child.props?.className === 'ah-supply-market-grid')
    const summary = body.children.find(child => child.props?.className === 'ah-supply-market-summary')
    assert.ok(grid && summary)
    const cards = grid.children.flatMap(item => item.children)
    assert.equal(cards.length, 3)
    assert.equal(cards.some(card => card.props['data-option-id'] === 'done'), false)
    const done = summary.children.find(child => child.props?.['data-supply-done'] === 'true')
    assert.equal(done.tag, 'button')
    assert.equal(done.children.join(''), '完成购买')
  } finally {
    delete globalThis.document
  }
})
