// P3.2 A1′（共享 state clone）Arkham 侧门禁：viewState 必须「只读入参」，并支持 stateIsolated
// 浅拷贝模式——大厅每 revision 只 structuredClone 一次权威 state，四席位共用同一份隔离副本。
//
// 覆盖：
//   1. 权威 state 不被 viewState 修改：全量 / 精简（含 cards 自愈路径）都不写回，JSON 哈希稳定；
//      用 deepFreeze 再跑一遍，任何写入都会在严格模式下抛错。
//   2. stateIsolated=true 时视图字段浅拷贝，输出与普通深拷贝视图逐字节一致（多席位、多 revision、
//      hub / inScenario / 待决选择、全量与精简两种模式）。
//   3. 共享副本在生成 4 席位视图后哈希不变：Mod 不得修改大厅传入的隔离副本（含嵌套对象）。
//   4. index.js 声明 viewStateSharesState 能力（只增可选字段）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createGameState, applyMove, validateMove, decisionSeat, legalMoves } from '../src/engine/engine.js'
import { viewState, staticTables } from '../src/integration/observation.js'
import mod from '../index.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const SEATS = 4

function players(count = SEATS) {
  return Array.from({ length: count }, (_, seat) => ({ seat, role: 'human', name: 'P' + seat }))
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  for (const key of Object.keys(value)) deepFreeze(value[key], seen)
  return Object.freeze(value)
}

function advance(state, seat, move) {
  const next = structuredClone(state)
  assert.equal(validateMove(structuredClone(next), seat, structuredClone(move)), null, JSON.stringify(move))
  applyMove(next, seat, move)
  next.revision = state.revision + 1
  return next
}

// 把状态推进到没有待决选择（inScenario 的普通回合）。
function settle(state) {
  let current = state
  for (let i = 0; i < 400 && current.pendingChoice; i++) {
    const seat = decisionSeat(current)
    const moves = legalMoves(current, seat)
    const move = ['done', 'skip', 'self', 'keep'].map(id => moves.find(item => item.optionId === id)).find(Boolean) || moves[0]
    assert.ok(move, '待决选择必须有可用选项')
    current = advance(current, seat, move)
  }
  return current
}

function stepTurn(state) {
  const seat = decisionSeat(state)
  const moves = legalMoves(state, seat)
  const move = moves.find(item => item.action === 'endTurn') || moves[0]
  assert.ok(move, '普通回合必须有合法动作')
  return advance(state, seat, move)
}

function withChoice(seats = 2) {
  let state = createGameState({ seed: 'shared-state-choice', campaignHub: false }, players(seats))
  for (let i = 0; i < 200; i++) {
    if (state.pendingChoice) return state
    state = advance(state, decisionSeat(state), legalMoves(state, decisionSeat(state))[0])
  }
  return null
}

function slimOptions(statics) {
  return {
    includeStatic: false,
    publicCardCodes: new Set(Object.keys(statics.cards)),
    publicCards: statics.cards,
  }
}

function hydrate(slim, statics) {
  const cards = { ...statics.cards, ...(slim.cardsPatch || {}), ...(slim.privateCards || {}) }
  const view = { ...slim, cards, investigatorDefs: statics.investigatorDefs }
  delete view.cardsPatch
  delete view.privateCards
  return view
}

// 覆盖 hub（含 833KB cards）、inScenario、待决选择三种状态；cards 自愈用「删掉本人手牌/公共资产卡面」触发。
function fixtureStates() {
  const hub = createGameState({ seed: 'view-shared', campaignHub: true }, players())
  let scenario = settle(createGameState({ seed: 'view-shared', campaignHub: false }, players()))
  for (let i = 0; i < 4; i++) scenario = settle(stepTurn(scenario))
  const choice = withChoice(2)
  assert.ok(choice?.pendingChoice, '夹具应推进出一个待决选择')

  // cards 自愈：两张卡面缺失，一张只在本人手牌（privateCards），一张在公共资产区（cardsPatch）。
  const heal = settle(createGameState({ seed: 'view-shared-heal', campaignHub: false }, players(2)))
  heal.pendingChoice = null
  const privateCode = heal.investigators[0].hand[0]
  assert.ok(privateCode, '调查员起手应有手牌')
  delete heal.cards[privateCode]
  heal.investigators[0].assets.push({ id: 'c-heal-public', code: '01164', exhausted: false })
  delete heal.cards['01164']
  return { hub, scenario, choice, heal }
}

test('index.js 声明并发导出 viewStateSharesState 能力', () => {
  assert.equal(mod.viewStateSharesState, true)
  assert.equal(typeof mod.viewState, 'function')
})

test('viewState 不修改入参权威 state：全量 / 精简 / cards 自愈，JSON 哈希保持不变', () => {
  for (const [name, state] of Object.entries(fixtureStates())) {
    const statics = staticTables(state)
    for (const seat of [0, 1, state.investigators.length - 1]) {
      for (const options of [undefined, slimOptions(statics)]) {
        const before = hash(state)
        viewState(state, seat, options) // 故意传权威 state 本体：实现若写回会直接改到它。
        assert.equal(hash(state), before, `${name}/seat${seat} 视图生成期间权威 state 的 JSON 哈希必须不变`)
      }
    }
  }
})

test('deepFreeze 后的权威 state 能生成视图：实现没有写回任何嵌套对象', () => {
  for (const [name, state] of Object.entries(fixtureStates())) {
    const statics = staticTables(state)
    const frozen = deepFreeze(structuredClone(state))
    for (const seat of [0, 1, state.investigators.length - 1]) {
      assert.doesNotThrow(() => viewState(frozen, seat), `${name}/seat${seat} 全量视图不得写入入参`)
      assert.doesNotThrow(() => viewState(frozen, seat, slimOptions(statics)), `${name}/seat${seat} 精简视图不得写入入参`)
    }
  }
})

test('stateIsolated=true 与深拷贝路径视图逐字节一致（多席位 / 多 revision / 全量与精简）', () => {
  for (const campaignHub of [true, false]) {
    let state = createGameState({ seed: 'view-shared-isolated', campaignHub }, players())
    if (!campaignHub) state = settle(state)
    for (let round = 0; round < 5; round++) {
      const statics = staticTables(state)
      // 模拟大厅：本 revision 只 clone 一次，四席位共用；视图生成后副本必须原样。
      const shared = structuredClone(state)
      const sharedBefore = hash(shared)
      for (const seat of state.investigators.map(inv => inv.seat)) {
        const full = viewState(structuredClone(state), seat)
        const slim = viewState(structuredClone(state), seat, slimOptions(statics))
        assert.deepEqual(viewState(shared, seat, { stateIsolated: true }), full,
          `${campaignHub ? 'hub' : 'scenario'} r${state.revision}/seat${seat} 全量：浅拷模式输出必须一致`)
        const sharedSlim = viewState(shared, seat, { ...slimOptions(statics), stateIsolated: true })
        assert.deepEqual(sharedSlim, slim, `${campaignHub ? 'hub' : 'scenario'} r${state.revision}/seat${seat} 精简：浅拷模式输出必须一致`)
        assert.equal(sharedSlim.cards, undefined)
        assert.deepEqual(hydrate(sharedSlim, statics), full,
          `${campaignHub ? 'hub' : 'scenario'} r${state.revision}/seat${seat} 共享副本 hydrate 后必须与全量视图一致`)
      }
      assert.equal(hash(shared), sharedBefore, `${campaignHub ? 'hub' : 'scenario'} r${state.revision}：四席位视图生成后共享副本不得被修改`)
      if (campaignHub && state.uiState !== 'campaignHub') break
      if (!campaignHub && state.uiState !== 'inScenario') break
      state = settle(stepTurn(state))
    }
  }
})

test('cards 自愈在 stateIsolated 模式下只进视图（copy-on-write）：权威与共享副本都不被回写', () => {
  const { heal } = fixtureStates()
  const statics = staticTables(heal)
  const privateCode = heal.investigators[0].hand[0]
  const authorityBefore = hash(heal)

  // 全量：自愈卡面必须出现在本视图，但入参 state.cards 不被补写。
  const full = viewState(heal, 0)
  assert.ok(full.cards[privateCode], '本人手牌卡面必须在视图内自愈')
  assert.ok(full.cards['01164'], '公共资产卡面必须在视图内自愈')
  assert.equal(heal.cards[privateCode], undefined, '全量视图不得把自愈卡面写回权威 state.cards')
  assert.equal(heal.cards['01164'], undefined)
  assert.equal(hash(heal), authorityBefore, '全量视图自愈期间权威 state 哈希必须不变')

  // 精简 + 共享副本：私有卡面进 privateCards，公共卡面进 cardsPatch，副本不被写回。
  const shared = structuredClone(heal)
  const sharedBefore = hash(shared)
  const slim = viewState(shared, 0, { ...slimOptions(statics), stateIsolated: true })
  assert.ok(slim.privateCards?.[privateCode], '本人手牌的卡面必须走 privateCards')
  assert.equal(slim.cardsPatch?.[privateCode], undefined, '私有卡面不得进公共 cardsPatch')
  assert.ok(slim.cardsPatch?.['01164'], '公共资产卡面必须走 cardsPatch')
  assert.equal(shared.cards[privateCode], undefined)
  assert.equal(shared.cards['01164'], undefined)
  assert.equal(hash(shared), sharedBefore, '共享副本不得被视图生成修改')
  // 合并公共补丁后 hydrate 与全量视图一致。
  const merged = { ...statics, cards: { ...statics.cards, ...slim.cardsPatch } }
  assert.deepEqual(hydrate(slim, merged), full)
})

test('同一份隔离副本跨 4 席位、重复生成视图的哈希稳定（含全量与精简混合）', () => {
  const state = settle(createGameState({ seed: 'view-shared-reuse', campaignHub: false }, players()))
  const statics = staticTables(state)
  const shared = structuredClone(state)
  const before = hash(shared)
  const seats = state.investigators.map(inv => inv.seat)
  for (let pass = 0; pass < 2; pass++) {
    for (const seat of seats) viewState(shared, seat, { stateIsolated: true })
    for (const seat of seats) viewState(shared, seat, { ...slimOptions(statics), stateIsolated: true })
  }
  assert.equal(hash(shared), before)
})
