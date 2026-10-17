import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, legalMoves, decisionSeat, describeState } from '../src/engine/engine.js'
import { viewState, viewEvents } from '../src/integration/observation.js'
import { requestChoice, resolveTransaction } from '../src/engine/resolution.js'

const restore = state => JSON.parse(JSON.stringify(state))
const players = count => Array.from({ length: count }, (_, seat) => ({ seat, name: `P${seat}` }))
const create = (code = '01001', count = 1, seed = 'n3-invariants') => createGameState({ playerInvestigator: code, seed }, players(count))

test('待生成敌人的空编号在保存与连续选择恢复时保持一致', () => {
  const execute = draft => {
    draft.target = requestChoice(draft, { kind:'prey', source:{type:'enemy',id:undefined,code:'theMaskedHunter'},
      seat:0,prompt:'选择猎物',options:[{id:'0'},{id:'1'}] })
    draft.confirm = requestChoice(draft, {kind:'confirm',source:'next',seat:0,prompt:'后续选择',options:[{id:'done'}]})
  }
  const state={revision:0,currentSeat:0}
  resolveTransaction(state,0,{action:'spawn'},execute)
  assert.deepEqual(state.pendingChoice.source,{type:'enemy',code:'theMaskedHunter'})
  for(const optionId of ['0','1']) {
    let branch=restore(state)
    resolveTransaction(branch,0,{optionId},execute)
    assert.equal(branch.target,optionId)
    branch=restore(branch)
    resolveTransaction(branch,0,{optionId:'done'},execute)
    assert.equal(branch.target,optionId)
    assert.equal(branch.pendingChoice,null)
  }
  const forged=restore(state)
  forged.pendingChoice.source.code='another-enemy'
  const before=JSON.stringify(forged)
  assert.throws(()=>resolveTransaction(forged,0,{optionId:'0'},execute),/恢复凭据/)
  assert.equal(JSON.stringify(forged),before,'仍拒绝真正不匹配的选择，且不改变状态')
})

function assertRejected(state, seat, move) {
  const before = JSON.stringify(state)
  assert.ok(validateMove(state, seat, move), JSON.stringify(move))
  assert.equal(JSON.stringify(state), before, '校验必须只读')
  assert.throws(() => applyMove(state, seat, move))
  assert.equal(JSON.stringify(state), before, '非法执行不得改变日志、牌序、随机状态或费用')
}

test('N3 五名调查员与1–4人开局的全部生成动作均通过校验', () => {
  for (const code of ['01001', '01002', '01003', '01004', '01005']) {
    for (const count of [1, 2, 3, 4]) {
      const state = create(code, count)
      const before = JSON.stringify(state)
      const seat = decisionSeat(state)
      const moves = legalMoves(state)
      assert.ok(moves.length, `${code}/${count}`)
      assert.ok(state.pendingChoice, '开局换牌不能自动略过')
      assert.equal(state.pendingChoice.seat, seat)
      assert.ok(state.pendingChoice.id && state.pendingChoice.source && state.pendingChoice.prompt)
      assert.ok(Array.isArray(state.pendingChoice.options))
      for (const move of moves) assert.equal(validateMove(state, seat, move), null, JSON.stringify(move))
      assert.equal(JSON.stringify(state), before)
      assert.ok(before.length < 500000, `开局状态超出500KB预算：${before.length}`)
      assert.deepEqual(restore(state), restore(create(code, count)))
    }
  }
})

test('N3 非法命令、错误回答者、过期版本和伪造选择原子拒绝', () => {
  const state = create('01001', 2)
  const seat = decisionSeat(state)
  for (const move of [null, [], {}, { action: 'not-an-action' }, { action: 'resource' },
    { action: 'choose', choiceId: 'missing', optionId: 'missing' },
    { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'missing' }]) {
    assertRejected(state, seat, move)
  }
  const move = legalMoves(state)[0]
  for (const wrongSeat of [-1, 99, 0.5, String(seat), (seat + 1) % 2]) assertRejected(state, wrongSeat, move)
  assertRejected(state, seat, { ...move, revision: state.revision + 1 })
  assertRejected(state, seat, { ...move, revision: -1 })
  assertRejected(state, seat, { ...move, revision: '0' })
  const revision = state.revision
  applyMove(state, seat, { ...move, revision })
  assert.equal(state.revision, revision + 1)
  assertRejected(state, decisionSeat(state), { ...move, revision })
})

test('N3 不兼容状态schema或资源版本明确拒绝，不能在新规则下静默续算', () => {
  for (const patch of [{ schemaVersion: 'unsupported-schema' }, { resourceVersion: 'unsupported-resources' }]) {
    const state = create()
    const seat = decisionSeat(state)
    const move = legalMoves(state)[0]
    Object.assign(state, patch)
    assertRejected(state, seat, move)
  }
})

test('N3 同种子命令流与逐步JSON恢复结果一致，多局交错不污染实例序列', () => {
  for (const count of [1, 4]) {
    const state = create('01001', count)
    let recovered = restore(state)
    let commands = 0
    for (let step = 0; step < 100 && state.status === 'playing'; step++) {
      const seat = decisionSeat(state)
      const before = JSON.stringify(state)
      const moves = legalMoves(state)
      assert.ok(moves.length, `第${step}步没有合法回答`)
      for (const move of moves) {
        assert.equal(validateMove(state, seat, move), null, JSON.stringify(move))
        if (step % 5 === 0) {
          const branch = restore(state)
          assert.doesNotThrow(() => applyMove(branch, seat, move), JSON.stringify(move))
          assert.equal(branch.revision, state.revision + 1)
        }
      }
      assert.equal(JSON.stringify(state), before)
      const move = moves[(step * 7 + 3) % moves.length]
      assert.equal(validateMove(recovered, seat, move), null)
      const revision = state.revision
      applyMove(state, seat, { ...move, revision })
      if (step % 10 === 0) create('01005', 2, `other-game-${step}`)
      applyMove(recovered, seat, { ...move, revision })
      assert.deepEqual(restore(state), restore(recovered), `第${step}步：${JSON.stringify(move)}`)
      assert.equal(state.revision, revision + 1)
      assert.equal(state.clues, state.investigators.reduce((sum, inv) => sum + inv.clues, 0), '公共线索计数必须由个人线索汇总')
      for (const inv of state.investigators) {
        assert.ok(Number.isInteger(inv.clues) && inv.clues >= 0)
        assert.ok(inv.resources >= 0 && inv.actionsLeft >= 0)
      }
      const ids = [...state.enemies, ...state.investigators.flatMap(inv => [...inv.assets, ...inv.threat])].map(instance => instance.id)
      assert.equal(new Set(ids).size, ids.length, '同一对局的运行时实例ID不能重复')
      recovered = restore(recovered)
      commands++
    }
    assert.ok(commands >= count, '至少完成开局合法回答')
  }
})

test('N3 每个开局合法回答可从同一快照独立执行且只消费一次版本', () => {
  const state = create('01005', 2)
  const seat = decisionSeat(state)
  for (const move of legalMoves(state)) {
    const branch = restore(state)
    applyMove(branch, seat, move)
    assert.equal(branch.revision, state.revision + 1)
    assertRejected(branch, decisionSeat(branch), { ...move, revision: state.revision })
  }
})

test('N3 开局和连续合法动作不依赖系统时钟或全局随机函数', () => {
  const random = Math.random
  const now = Date.now
  try {
    Math.random = () => { throw new Error('规则不得调用全局随机函数') }
    Date.now = () => { throw new Error('规则不得依赖系统时钟') }
    const state = create('01003', 2)
    for (let i = 0; i < 40 && state.status === 'playing'; i++) {
      const moves = legalMoves(state)
      assert.ok(moves.length)
      applyMove(state, decisionSeat(state), moves[i % moves.length])
    }
  } finally {
    Math.random = random
    Date.now = now
  }
})

test('N3 对局种子实际控制开局牌序，而不只是记录元数据', () => {
  const a = create('01001', 1, 'seed-a')
  const b = create('01001', 1, 'seed-b')
  assert.notDeepEqual([...a.investigators[0].hand, ...a.investigators[0].deck], [...b.investigators[0].hand, ...b.investigators[0].deck])
})

test('新建游戏默认使用独立种子，局外准备和直接开局均不复用默认牌序', () => {
  for (const campaignHub of [false, true]) {
    const settings = { playerInvestigator: '01001', campaignHub }
    const a = createGameState(settings, players(1))
    const b = createGameState(settings, players(1))
    assert.notEqual(a.seed, b.seed)
    assert.equal(settings.seed, undefined, '不修改设置，避免下次开局继承生成的种子')
    if (!campaignHub) {
      assert.notDeepEqual([...a.investigators[0].hand, ...a.investigators[0].deck], [...b.investigators[0].hand, ...b.investigators[0].deck])
    }
    assert.deepEqual(restore(a), restore(createGameState({ ...settings, seed: a.seed }, players(1))), '保存的种子仍可重现开局')
  }
})

test('自动生成种子的存档恢复后牌序和后续随机结算保持一致', () => {
  const live = createGameState({ playerInvestigator: '01001' }, players(1))
  const resumed = restore(live)
  assert.deepEqual(resumed.investigators[0].deck, live.investigators[0].deck)
  assert.equal(resumed.rngState, live.rngState)
  for (let i = 0; i < 40 && live.status === 'playing'; i++) {
    const moves = legalMoves(live)
    assert.ok(moves.length)
    const move = moves[i % moves.length], seat = decisionSeat(live)
    assert.deepEqual(applyMove(resumed, seat, move), applyMove(live, seat, move))
    assert.deepEqual(restore(resumed), restore(live))
  }
})

test('N3 AI观察描述不公开其他座位手牌和牌库顺序', () => {
  const state = create('01001', 2)
  state.investigators[1].hand = ['private-hand-sentinel']
  state.investigators[1].deck = ['private-deck-sentinel']
  const observation = describeState(state, 0)
  assert.equal(observation.includes('private-hand-sentinel'), false)
  assert.equal(observation.includes('private-deck-sentinel'), false)
  assert.ok(observation.includes(state.investigators[1].name))
})

test('N3 浏览器观察投影只公开自己的选择及手牌，不下发恢复快照或牌库顺序', () => {
  const state = create('01001', 2)
  state.internalContinuation = { private: 'continuation-secret' }
  state.investigators[1].hand = ['private-hand-sentinel']
  state.investigators[0].deck = ['own-deck-sentinel']
  state.encounterDeck = ['encounter-deck-sentinel']
  const before = JSON.stringify(state)
  const view = viewState(state, 0)
  const text = JSON.stringify(view)
  for (const secret of ['continuation-secret', 'private-hand-sentinel', 'own-deck-sentinel', 'encounter-deck-sentinel']) {
    assert.equal(text.includes(secret), false, secret)
  }
  assert.deepEqual(view.investigators[0].hand, state.investigators[0].hand)
  assert.equal(view.investigators[1].handSize, 1)
  assert.equal(view.investigators[0].deckSize, 1)
  assert.equal(view.encounterDeckSize, 1)
  assert.deepEqual(viewState(state, 1).pendingChoice.options, [])
  assert.deepEqual(viewState(state, 1).legalMoves, [])
  assert.deepEqual(viewState(state, null).investigators[0].hand, [])
  view.investigators[0].hand.push('mutation')
  view.locations[0].name = 'mutation'
  assert.equal(JSON.stringify(state), before)
})

test('N3 私有选择事件对其他观察者隐去选项，不修改原事件', () => {
  const events = [{ type: 'move', seat: 1, move: { action: 'choose', choiceId: 'q1', optionId: 'private-option' }, label: 'private-label' }]
  const before = JSON.stringify(events)
  const viewed = viewEvents(events, 0)
  assert.deepEqual(viewed[0].move, { action: 'choose' })
  assert.equal(JSON.stringify(viewed).includes('private'), false)
  assert.equal(viewEvents(events, 1)[0].move.optionId, 'private-option')
  assert.equal(JSON.stringify(events), before)
})

test('N3 对象型选择来源在JSON恢复和键顺序变化后仍能继续', () => {
  const state = { revision: 0, currentSeat: 0, total: 0 }
  const run = draft => {
    for (let i = 0; i < 2; i++) {
      requestChoice(draft, { kind: 'effect', source: { type: 'card', code: '01016', detail: { step: i } }, seat: 0,
        prompt: '确认效果', options: [{ id: 'confirm', label: '确认' }] })
      draft.total++
    }
  }
  resolveTransaction(state, 0, { action: 'test' }, run)
  const restored = restore(state)
  resolveTransaction(restored, 0, { optionId: 'confirm' }, run)
  assert.equal(restored.total, 1)
  const serialized = restore(restored)
  const source = serialized.continuation.answers[0].source
  serialized.continuation.answers[0].source = { detail: source.detail, code: source.code, type: source.type }
  resolveTransaction(serialized, 0, { optionId: 'confirm' }, run)
  assert.equal(serialized.total, 2)
  assert.equal(serialized.pendingChoice, null)
  assert.equal(serialized.continuation, null)
  assert.equal(serialized.revision, 3)
})

test('N3 来源结构改变时拒绝恢复且不改变已暂停状态', () => {
  const state = { revision: 0, currentSeat: 0 }
  let code = '01016'
  const run = draft => requestChoice(draft, { kind: 'effect', source: { type: 'card', code }, seat: 0,
    prompt: '确认效果', options: [{ id: 'confirm', label: '确认' }] })
  resolveTransaction(state, 0, { action: 'test' }, run)
  const before = JSON.stringify(state)
  code = '01020'
  assert.throws(() => resolveTransaction(state, 0, { optionId: 'confirm' }, run), /恢复凭据/)
  assert.equal(JSON.stringify(state), before)
})

test('N3 事务失败时静态字段的嵌套写入也完全隔离', () => {
  const fields = ['cards', 'investigatorDefs', 'classNames', 'classColors', 'skillNames', 'tokenLabels']
  for (const field of fields) {
    const external = { nested: { value: 0 }, list: ['original'] }
    const state = { revision: 0, currentSeat: 0, [field]: external }
    const before = JSON.stringify(state)
    assert.throws(() => resolveTransaction(state, 0, { action: 'test' }, draft => {
      draft[field].nested.value = 9
      draft[field].list.push('mutation')
      throw new Error('模拟晚期执行失败')
    }), /晚期执行失败/)
    assert.equal(JSON.stringify(state), before, field)
    assert.deepEqual(external, { nested: { value: 0 }, list: ['original'] }, field)
  }
})
