// 七循环《地球边缘》P4 交互事务 Node 验收。
//
// 口径（docs/edgeOfTheEarth/README.md §3 P4 与 P1 catalog 的 5 个 interaction 机制）：
//   · 所有玩家决策走 selectMechanic 的 pending choice（opaque pick:N / confirm / cancel）；
//   · 空强制候选 = 直接返回 false/null，且不留下 pending choice（无软锁）；
//   · 取消发生在任何写入之前（半写状态 = 0）；
//   · 伪造 / 过期 option id 与错误座位回答被 resolution 的恢复凭据校验拒绝；
//   · 隐藏信息（牌库顶、队友手牌、忒咳哩-哩牌序）不进入选择标签或观察投影。
//
// 这里用最小本地状态（不引入重对局 fixture）：只需要 investigators / locations / chaos / campaign /
// scenarioFlags；事务由 resolution.js#resolveTransaction 驱动，选择凭据与真实引擎同一条路径。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createEoteInteractions } from '../src/engine/eote-interactions.js'
import { MECHANIC_OPERATIONS } from '../src/engine/mechanic-choices.js'
import { choiceError, choiceMoves, resolveTransaction } from '../src/engine/resolution.js'
import { initializeSeals, placeDormantSeal, sealState } from '../src/campaign/eote-seals.js'
import { initializeTekeliDeck, tekeliDeckSize } from '../src/engine/eote-tekeli.js'
import { initializeDisciplines, disciplineFace } from '../src/engine/eote-disciplines.js'
import { initializeSupplies, recoveredSupplies, supplyCarrier } from '../src/campaign/eote-supplies.js'
import { keyOnLocation } from '../src/engine/eote-city.js'
import { mechanicView, maskMechanicSnapshot, mechanicSnapshot } from '../src/integration/mechanic-view.js'

const json = value => JSON.parse(JSON.stringify(value))
const TEKELI_FACES = ['08723', '08724', '08725', '08726', '08727', '08728', '08729']

function makeState ({ seats = 2 } = {}) {
  const investigators = Array.from({ length: seats }, (_, seat) => ({
    seat, name: `调查员 ${seat + 1}`, location: 'loc1',
    defeated: false, resigned: false,
    hand: [], deck: [], discard: [], assets: [], threat: [], engaged: [],
  }))
  return {
    revision: 0,
    rngState: 7,
    round: 1,
    investigators,
    locations: [
      { id: 'loc1', name: '地点一', revealed: true, connections: ['loc2'] },
      { id: 'loc2', name: '地点二', revealed: true, connections: ['loc1'] },
    ],
    chaosBag: [],
    chaos: { sealed: [], revealed: [], frames: [] },
    campaign: {},
    scenarioFlags: {},
  }
}

// 事务驱动：execute 在每次重放时用同一 action 从 draft 重建交互层（与引擎 ctx.api 的接线口径一致）。
function drive (state, seat, action, answers = []) {
  let result
  const execute = draft => { result = action(draft); return result }
  resolveTransaction(state, seat, { action: 'eoteInteraction' }, execute)
  const run = { seat, execute, get result () { return result }, get choice () { return state.pendingChoice } }
  run.answer = optionId => {
    assert.ok(state.pendingChoice, `没有待决选择可以回答 ${optionId}`)
    resolveTransaction(state, seat, { action: 'choose', choiceId: state.pendingChoice.id, optionId }, execute)
    return run
  }
  for (const optionId of answers) run.answer(optionId)
  return run
}
const chooseFirst = run => { run.answer('pick:0'); run.answer('confirm') }
const chooseAll = (run, indexes, confirm = true) => { for (const index of indexes) run.answer(`pick:${index}`); if (confirm) run.answer('confirm') }

test('P4 机制操作表：保留既有 10 个操作并追加 9 个 eote 事务且保持冻结', () => {
  assert.ok(Object.isFrozen(MECHANIC_OPERATIONS))
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(0, 10)],
    ['seal', 'release', 'claimKey', 'giveKeys', 'spendKey', 'enterVehicle', 'leaveVehicle', 'driveVehicle', 'commitOrigin', 'returnCommitment'])
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(10)],
    ['eoteFrost', 'eotePartner', 'eoteSeal', 'eoteKey', 'eoteTekeli', 'eoteDeckTop', 'eoteCrossSeat', 'eoteDiscipline', 'eoteSupply'])
  assert.equal(new Set(MECHANIC_OPERATIONS).size, MECHANIC_OPERATIONS.length)
})

test('P4 寒霜：有限池加入、封印优先支付、取消零写入、空候选不暂停', () => {
  const s = makeState()
  s.chaosBag = ['frost', '0']
  const api = createEoteInteractions(s)
  assert.equal(api.frost.add(0, 1), true)
  assert.equal(s.chaosBag.filter(token => token === 'frost').length, 2)
  s.chaosBag = Array(8).fill('frost')
  assert.equal(api.frost.add(0, 1), false)
  assert.equal(s.chaosBag.length, 8)

  const p = makeState()
  p.chaos.sealed = [{ token: 'frost', source: 'a' }, { token: 'frost', source: 'b' }]
  p.chaosBag = ['0']
  const sealedBefore = json(p.chaos.sealed), bagBefore = json(p.chaosBag)
  const paid = drive(p, 0, draft => createEoteInteractions(draft).frost.pay(0, 2))
  assert.equal(paid.choice.source.operation, 'eoteFrost')
  assert.equal(paid.choice.options.some(option => option.id === 'cancel'), false)
  paid.answer('pick:0')
  assert.equal(p.chaos.sealed.length, 2)
  paid.answer('pick:1'); paid.answer('confirm')
  assert.equal(paid.result, true)
  assert.equal(p.chaos.sealed.length, 0)
  assert.deepEqual(p.chaosBag, bagBefore)
  assert.notDeepEqual(json(p.chaos.sealed), sealedBefore)

  const cancel = makeState()
  cancel.chaos.sealed = [{ token: 'frost', source: 'a' }]
  const cancelled = drive(cancel, 0, draft => createEoteInteractions(draft).frost.pay(0, 1, { optional: true }), ['cancel'])
  assert.equal(cancelled.result, false)
  assert.equal(cancel.chaos.sealed.length, 1)
  const empty = makeState()
  assert.equal(createEoteInteractions(empty).frost.pay(0, 1), false)
  assert.equal(empty.pendingChoice, undefined)
})

test('P4 伙伴选派：选择结果不写战役状态；取消返回 null；名册校验；选项 id 不可伪造', () => {
  const roster = [{ code: '08714', label: '威廉·戴尔' }, { code: '08715' }, { code: '08716', label: '伊利亚' }]
  const s = makeState()
  const chosen = drive(s, 0, draft => createEoteInteractions(draft).partners.setup(0, { roster, count: 2 }))
  assert.equal(chosen.choice.source.operation, 'eotePartner')
  chosen.answer('pick:0'); chosen.answer('pick:2'); chosen.answer('confirm')
  assert.deepEqual(chosen.result, ['08714', '08716'])
  assert.equal(s.campaign.eote, undefined) // P7 调用方负责写入伙伴状态。

  const cancel = drive(makeState(), 0, draft => createEoteInteractions(draft).partners.setup(0, { roster, optional: true }), ['cancel'])
  assert.equal(cancel.result, null)
  assert.throws(() => createEoteInteractions(makeState()).partners.setup(0, { roster: [] }), /伙伴名册/)

  const forged = drive(makeState(), 0, draft => createEoteInteractions(draft).partners.setup(0, { roster }))
  assert.throws(() => forged.answer('pick:900'), /选择恢复凭据与规则不一致/)
})

test('P4 封印：取回 → 激活 → 放置 → 取下；空候选直接 false 且无 pending choice', () => {
  const s = makeState()
  initializeSeals(s)
  placeDormantSeal(s, 'B', 'loc1')
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).seals.recover(0)))
  assert.equal(sealState(s, 'B').placedBySeat, 0)
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).seals.activate(0)))
  assert.equal(sealState(s, 'B').active, true)
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).seals.place(0, { locationId: 'loc2' })))
  assert.equal(sealState(s, 'B').locationId, 'loc2')
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).seals.unplace(0)))
  const entry = sealState(s, 'B')
  assert.deepEqual([entry.locationId, entry.placedBySeat, entry.active], [null, null, false])

  const empty = makeState()
  initializeSeals(empty)
  const api = createEoteInteractions(empty)
  assert.equal(api.seals.recover(0), false)
  assert.equal(api.seals.activate(0), false)
  assert.equal(empty.pendingChoice, undefined)
})

test('P4 城市钥匙：取得 / 放置 / 移动 / 交换；无城市容器时全部安全返回 false', () => {
  const s = makeState()
  s.scenarioFlags.mechanics = { version: 1, eote: { version: 1, city: {
    version: 1,
    cityscapes: [{ row: 0, column: 0, locationId: 'loc1' }, { row: 0, column: 1, locationId: 'loc2' }],
    keys: {},
  } } }
  s.scenarioFlags.mechanics.eote.city.keys.loc1 = 'keyA'
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).keys.take(0, { locationId: 'loc1' })))
  assert.equal(keyOnLocation(s, 'loc1'), null)
  assert.equal(createEoteInteractions(s).keys.place(0, { keyId: 'keyA', locationId: 'loc2' }), true)
  assert.equal(keyOnLocation(s, 'loc2'), 'keyA')
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).keys.move(0, { keyId: 'keyA' })))
  assert.equal(keyOnLocation(s, 'loc1'), 'keyA')
  s.scenarioFlags.mechanics.eote.city.keys.loc2 = 'keyB'
  assert.equal(createEoteInteractions(s).keys.swap(0, { keyIdA: 'keyA', keyIdB: 'keyB' }), true)
  assert.equal(keyOnLocation(s, 'loc2'), 'keyA')
  assert.equal(keyOnLocation(s, 'loc1'), 'keyB')

  const bare = makeState()
  assert.equal(createEoteInteractions(bare).keys.take(0, { locationId: 'loc1' }), false)
  assert.equal(createEoteInteractions(bare).keys.swap(0, { keyIdA: 'a', keyIdB: 'b' }), false)
})

test('P4 忒咳哩-哩：不看内容洗入（去向选择）、受信任抽取、结算去向；不对观察者暴露牌序', () => {
  const s = makeState()
  initializeTekeliDeck(s, { cards: TEKELI_FACES })
  assert.equal(tekeliDeckSize(s), 16)
  const shuffled = drive(s, 0, draft => createEoteInteractions(draft).tekeli.shuffle(0, { count: 1, destination: null }))
  assert.equal(shuffled.choice.source.operation, 'eoteTekeli')
  assert.equal(shuffled.choice.source.stage, 'destination')
  const choiceJson = JSON.stringify(shuffled.choice)
  for (const code of TEKELI_FACES) assert.equal(choiceJson.includes(code), false)
  chooseFirst(shuffled)
  assert.equal(shuffled.result, true)
  assert.equal(tekeliDeckSize(s), 15)
  assert.equal(s.investigators[0].deck.length, 1)
  assert.equal(typeof shuffled.result, 'boolean') // 洗入不向调用方返回卡号。

  const view = mechanicView(s, 1) || {}
  assert.equal(JSON.stringify(view).includes(s.investigators[0].deck[0]), false)
  if (view.scenarioDecks?.tekeli) assert.equal('deck' in view.scenarioDecks.tekeli, false)
  const masked = maskMechanicSnapshot(mechanicSnapshot(s), 1) || {}
  assert.equal(JSON.stringify(masked).includes(s.investigators[0].deck[0]), false)

  const trusted = createEoteInteractions(s, { revealCode: true })
  const drawn = trusted.tekeli.draw(0)
  assert.equal(typeof drawn, 'string')
  assert.ok(TEKELI_FACES.includes(drawn))
  assert.equal(createEoteInteractions(s).tekeli.draw(0), true)
  assert.equal(trusted.tekeli.returnTo(0, drawn, { destination: 'discard' }), true)
  assert.ok(s.investigators[0].discard.includes(drawn))

  const small = makeState()
  initializeTekeliDeck(small, { cards: TEKELI_FACES })
  assert.equal(createEoteInteractions(small).tekeli.shuffle(0, { count: 17, destination: 'bottom' }), false)
  assert.equal(small.pendingChoice, undefined)
})

test('P4 牌库顶：揭示 / 读数 / 折扣打出；隐藏卡号不进入观察投影', () => {
  const s = makeState()
  s.investigators[0].deck = ['08001', '08019']
  const api = createEoteInteractions(s)
  assert.equal(api.deckTop.reveal(0), true)
  assert.equal(api.deckTop.card(0).code, '08019')
  assert.equal(api.deckTop.play(0, { discount: 1, cost: 2 }), true)
  const other = mechanicView(s, 1) || {}
  assert.equal(JSON.stringify(other).includes('08019'), false)
  const masked = maskMechanicSnapshot(mechanicSnapshot(s), 1) || {}
  assert.equal(JSON.stringify(masked).includes('08019'), false)
})

test('P4 跨座位代打：授权校验真实手牌、选择不泄露标签、取消零写入、清除授权后无候选', () => {
  const s = makeState()
  s.investigators[1].hand = ['08019', '08020']
  const api = createEoteInteractions(s)
  assert.equal(api.crossSeat.grant(0, { fromSeat: 1, codes: ['08019'] }), true)
  assert.throws(() => api.crossSeat.grant(0, { fromSeat: 1, codes: ['08021'] }), /来源座位手中没有卡牌/)
  const chosen = drive(s, 0, draft => createEoteInteractions(draft).crossSeat.choose(0))
  assert.equal(chosen.choice.source.operation, 'eoteCrossSeat')
  const option = chosen.choice.options.find(item => item.id === 'pick:0')
  assert.equal(option.cardCode, '08019')
  assert.equal(option.label.includes('08019'), false)
  chooseFirst(chosen)
  assert.deepEqual(chosen.result, { code: '08019', ownerSeat: 1, costSplit: null })
  assert.ok(s.investigators[1].hand.includes('08019')) // 代打选择本身不移动卡牌。

  assert.equal(api.crossSeat.clear(0), true)
  assert.equal(createEoteInteractions(s).crossSeat.choose(0), null)
  const bad = makeState()
  assert.throws(() => createEoteInteractions(bad).crossSeat.grant(0, { fromSeat: 1, codes: [] }), /非空数组/)
})

test('P4 演武：确定性随机选择、缺少 random 报错、翻面读点', () => {
  const s = makeState()
  initializeDisciplines(s, { sets: [
    { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
    { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
  ] })
  const api = createEoteInteractions(s)
  const picked = api.discipline.select(0, { sets: ['08011a', '08012a'], count: 1, random: () => 0.5 })
  assert.equal(picked.length, 1)
  assert.deepEqual(s.campaign.eote.disciplines.selected, picked)
  assert.throws(() => api.discipline.select(0, { sets: ['08011a'], count: 1 }), /random/)
  assert.equal(api.discipline.flip(0, { code: '08011a' }).to, 'broken')
  assert.equal(disciplineFace(s, '08011a'), 'broken')
})

test('P4 探险物资：交给队友 / 掉落 / 回收（两阶段选择）', () => {
  const s = makeState()
  initializeSupplies(s, { items: [{ code: '08614', label: '绿皂石' }, { code: '08615', label: '木雪橇' }], recoveredKey: 'SuppliesRecovered' })
  s.campaign.eote.supplies.carriers = { 0: ['08614'] }
  const assigned = drive(s, 0, draft => createEoteInteractions(draft).supply.assign(0, { code: '08614' }))
  assert.equal(assigned.choice.source.operation, 'eoteSupply')
  assert.equal(assigned.choice.source.stage, 'items')
  assigned.answer('pick:0'); assigned.answer('confirm')
  assert.equal(assigned.choice.source.stage, 'recipient')
  assigned.answer('pick:0'); assigned.answer('confirm')
  assert.equal(assigned.result, true)
  assert.equal(supplyCarrier(s, '08614'), 1)

  s.campaign.eote.supplies.carriers = { 1: ['08614'] }
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).supply.drop(1, { code: '08614', locationId: 'loc1' })))
  assert.equal(s.campaign.eote.supplies.dropped['08614'], 'loc1')
  chooseFirst(drive(s, 0, draft => createEoteInteractions(draft).supply.recover(0, { code: '08614' })))
  assert.ok(recoveredSupplies(s).some(item => item.code === '08614'))
})

test('P4 选择凭据：错误座位 / 伪造 optionId / 过期 choiceId 被拒绝；JSON 往返结果一致', () => {
  const s = makeState()
  s.chaos.sealed = [{ token: 'frost', source: 'a' }, { token: 'frost', source: 'b' }]
  const execute = draft => createEoteInteractions(draft).frost.pay(0, 2, { optional: true })
  resolveTransaction(s, 0, { action: 'eoteInteraction' }, execute)
  const choice = s.pendingChoice
  const move = { action: 'choose', choiceId: choice.id, optionId: 'pick:0' }
  // 与引擎 applyMove 同一校验入口：错误座位 / 过期 choiceId / 不存在的 optionId 都被拒绝。
  assert.match(choiceError(s, 1, move), /不是当前选择的回答座位/)
  assert.deepEqual(choiceMoves(s, 1), [])
  assert.match(choiceError(s, 0, { ...move, choiceId: 'q999-0' }), /必须回答当前待决选择/)
  assert.match(choiceError(s, 0, { ...move, optionId: 'pick:900' }), /无效选择选项/)
  resolveTransaction(s, 0, { action: 'choose', choiceId: choice.id, optionId: 'pick:0' }, execute)
  assert.ok(s.pendingChoice) // 多选未满时不会自动确认。
  // 重放时伪造「当前不存在的 confirm」：resolution 的恢复凭据校验必须失败。
  assert.throws(() => resolveTransaction(s, 0, { action: 'choose', choiceId: s.pendingChoice.id, optionId: 'confirm' }, execute),
    /选择恢复凭据与规则不一致/)
  const saved = json(s)
  const finish = state => {
    resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'pick:1' }, execute)
    resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'confirm' }, execute)
    return [state.chaos.sealed.length, JSON.stringify(state.chaosBag)]
  }
  assert.deepEqual(finish(saved), finish(s))
  assert.equal(s.chaos.sealed.length, 0)
})

test('P4 参数校验：坏座位抛错、坏数量抛错、取消不产生任何写入', () => {
  const s = makeState()
  const api = createEoteInteractions(s)
  assert.throws(() => api.frost.add(9, 1), /无效调查员座位/)
  assert.throws(() => api.frost.add(0, 0), /寒霜数量/)
  assert.throws(() => api.partners.setup(0, { roster: [{ code: '08714' }], count: 0 }), /伙伴数量/)
  // 空候选：直接 false，不创建 pending choice。
  const empty = drive(s, 0, draft => createEoteInteractions(draft).seals.recover(0))
  assert.equal(empty.result, false)
  assert.equal(s.pendingChoice ?? null, null)
  // 取消发生在写入之前：伙伴选派取消后 campaign / scenarioFlags 原样。
  const cancelled = makeState()
  const snapshot = () => JSON.stringify({
    campaign: cancelled.campaign, scenarioFlags: cancelled.scenarioFlags,
    chaos: cancelled.chaos, chaosBag: cancelled.chaosBag,
  })
  const before = snapshot()
  const run = drive(cancelled, 0, draft => createEoteInteractions(draft).partners.setup(0, { roster: [{ code: '08714' }], optional: true }), ['cancel'])
  assert.equal(run.result, null)
  assert.equal(snapshot(), before)
})
