// P1.4 Arkham：精简视图（includeStatic=false）+ 会话公共静态表 hydrate 后，必须与全量视图
// 逐字节一致；自愈补出的卡面按「公共 cardsPatch / 本人 privateCards」拆分，公共表不含私有信息。
//
// 覆盖：hub 开局（cards ≈833KB）与 inScenario 两种状态、多席位、多 revision；
// 以及「删除本人手牌卡面」与「删除公共区资产卡面」两种自愈路径。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, decisionSeat, legalMoves } from '../src/engine/engine.js'
import { viewState, staticTables } from '../src/integration/observation.js'

const SEATS = 4

function players(count = SEATS) {
  return Array.from({ length: count }, (_, seat) => ({ seat, role: 'human', name: 'P' + seat }))
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

// 推进一个正常动作（优先结束回合），返回新状态。
function stepTurn(state) {
  const seat = decisionSeat(state)
  const moves = legalMoves(state, seat)
  const move = moves.find(item => item.action === 'endTurn') || moves[0]
  assert.ok(move, '普通回合必须有合法动作')
  return advance(state, seat, move)
}

function slimView(state, seat, statics) {
  return viewState(structuredClone(state), seat, {
    includeStatic: false,
    publicCardCodes: new Set(Object.keys(statics.cards)),
    publicCards: statics.cards,
  })
}

function hydrate(slim, statics) {
  const cards = { ...statics.cards, ...(slim.cardsPatch || {}), ...(slim.privateCards || {}) }
  const view = { ...slim, cards, investigatorDefs: statics.investigatorDefs }
  delete view.cardsPatch
  delete view.privateCards
  return view
}

function assertHydratesToFull(state, statics, label) {
  for (let seat = 0; seat < state.investigators.length; seat++) {
    const full = viewState(structuredClone(state), seat)
    const slim = slimView(state, seat, statics)
    assert.equal(slim.cards, undefined, `${label}/seat${seat} 精简视图不得带 cards`)
    assert.equal(slim.investigatorDefs, undefined, `${label}/seat${seat} 精简视图不得带 investigatorDefs`)
    assert.deepEqual(hydrate(slim, statics), full, `${label}/seat${seat} hydrate 后必须与全量视图逐字节一致`)
  }
}

test('hub 开局与 inScenario 的 4 席位多 revision：hydrate 后与全量视图逐字节一致，字节下降 >50%', () => {
  for (const campaignHub of [true, false]) {
    let state = createGameState({ seed: 'view-static', campaignHub }, players())
    if (!campaignHub) state = settle(state)
    let revisions = 0
    for (let i = 0; i < 8; i++) {
      const statics = staticTables(state)
      assertHydratesToFull(state, statics, `${campaignHub ? 'hub' : 'scenario'} r${state.revision}`)
      if (i === 0) {
        const fullBytes = Buffer.byteLength(JSON.stringify(viewState(structuredClone(state), 0)))
        const slimBytes = Buffer.byteLength(JSON.stringify(slimView(state, 0, statics)))
        assert.ok(slimBytes * 2 < fullBytes, `${campaignHub ? 'hub' : 'scenario'} 精简视图应小于全量一半（${slimBytes} vs ${fullBytes}）`)
      }
      if (campaignHub && state.uiState !== 'campaignHub') break
      if (!campaignHub && state.uiState !== 'inScenario') break
      state = settle(stepTurn(state))
      revisions++
    }
    assert.ok(revisions >= 3, '需要覆盖多个 revision')
  }
})

test('本人手牌自愈卡面只进 privateCards；公共静态表与其他席位视图都不含它', () => {
  let state = settle(createGameState({ seed: 'view-static-heal', campaignHub: false }, players(2)))
  state.pendingChoice = null
  const observer = 0
  const code = state.investigators[observer].hand[0]
  assert.ok(code, '调查员起手应有手牌')
  delete state.cards[code]
  const statics = staticTables(state)
  assert.equal(statics.cards[code], undefined, '自愈前的公共表没有这张手牌的卡面')
  const slim = slimView(state, observer, statics)
  assert.ok(slim.privateCards?.[code], '本人手牌卡面必须走 privateCards')
  assert.equal(slim.cardsPatch?.[code], undefined, '私有卡面不得进公共 cardsPatch')
  // 全量视图的自愈行为保持原样（自己看得到），其他席位看不到。
  assert.ok(viewState(structuredClone(state), observer).cards[code])
  assert.equal(viewState(structuredClone(state), 1).cards[code], undefined, '别人的视图不能补出这张卡面')
  const otherSlim = slimView(state, 1, statics)
  assert.equal(otherSlim.privateCards?.[code], undefined)
  assert.equal(otherSlim.cardsPatch?.[code], undefined)
  // hydrate 一致性。
  const full = viewState(structuredClone(state), observer)
  assert.deepEqual(hydrate(slim, statics), full)
})

test('公共区自愈卡面走 cardsPatch（所有席位一致）；合并进公共表后 hydrate 仍与全量一致', () => {
  let state = settle(createGameState({ seed: 'view-static-public', campaignHub: false }, players(2)))
  state.pendingChoice = null
  const code = '01164'
  state.investigators[0].assets.push({ id: 'c-public-heal', code, exhausted: false })
  delete state.cards[code]
  const statics = staticTables(state)
  for (const seat of [0, 1]) {
    const slim = slimView(state, seat, statics)
    assert.ok(slim.cardsPatch?.[code], `seat${seat} 也应在公共补丁里看到这张公共卡面`)
    assert.equal(slim.privateCards?.[code], undefined, '公共卡面不得进 privateCards')
    const mergedStatics = { ...statics, cards: { ...statics.cards, ...slim.cardsPatch } }
    assert.deepEqual(hydrate(slim, mergedStatics), viewState(structuredClone(state), seat),
      `seat${seat} 合并公共补丁后 hydrate 必须与全量视图一致`)
  }
  // 公共补丁只来自公共可见区：把它从资产区拿掉后不应再产生补丁。
  state.investigators[0].assets.shift()
  const clean = slimView(state, 0, statics)
  assert.equal(clean.cardsPatch?.[code], undefined)
})
