// P0 自动跳过：浏览器/房主共用的纯判定（reactionSkipPlan）与 Mod 侧 autoPassChoice 钩子。
//
// 大厅会把这条 move 当普通 choose/skip 提交（validateMove/applyMove/actionLog），
// 所以这里只守两件事：判定口径与前端一致、返回形状能被合法校验接受。

import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, allCardDefs, applyMove } from '../src/engine/engine.js'
import { reactionSkipPlan, reactionDisabledCodes, setReactionEnabled } from '../web/reaction-preferences.js'
import arkham from '../index.js'

// 与 reaction-preferences.test.mjs 同一套「拾荒」窗口：01073 在场上、卡面自带 scavenging 反应。
function reactionState() {
  const defs = allCardDefs({ runtimeOnly: true })
  const st = createGameState({ seed: 'auto-pass', playerInvestigator: '01001' },
    [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }])
  st.cards['01073'] = { ...defs['01073'], code: '01073' }
  st.investigators[0].assets = [{ id: 'scav', code: '01073' }]
  st.pendingChoice = {
    id: 'scav', kind: 'reaction', seat: 0, canSkip: true, source: 'scavenging',
    options: [{ id: 'skip', label: '跳过反应' }, { id: 'trigger', label: '触发反应' }],
  }
  st.legalMoves = st.pendingChoice.options.map(option => ({ action: 'choose', choiceId: 'scav', optionId: option.id }))
  return st
}

const codesOf = state => reactionSkipPlan(state, () => true)?.items.map(item => item.code)

test('reactionSkipPlan：全部选项映射到已关闭卡号时才自动过，其余情况一律 fail-closed', () => {
  const st = reactionState()
  assert.deepEqual(codesOf(st), ['01073'])

  const only = code => code === '01073'
  const plan = reactionSkipPlan(st, only)
  assert.equal(plan?.choice.id, 'scav')
  assert.deepEqual(plan?.skip, { action: 'choose', choiceId: 'scav', optionId: 'skip' })

  // 还有开启的卡 → 不代答。
  assert.equal(reactionSkipPlan(st, () => false), null)
  // 偏好里的卡号与窗口对不上（映射不出/不是这张卡）→ 不代答。
  assert.equal(reactionSkipPlan(st, code => code === '01023'), null)

  // 窗口里有第二个选项但映射不出卡号（fail-closed，不能让未映射的选项被一起跳过）。
  const unmapped = structuredClone(st)
  unmapped.pendingChoice = { ...unmapped.pendingChoice, source: { type: 'window' } }
  unmapped.pendingChoice.options.push({ id: 'trigger2', label: '另一张卡', cardCode: undefined })
  unmapped.legalMoves.push({ action: 'choose', choiceId: 'scav', optionId: 'trigger2' })
  assert.equal(reactionSkipPlan(unmapped, only), null)

  // 混合窗口：只有部分选项关闭 → 不代答（窗口仍会显示给玩家，只隐藏已关闭项）。
  const mixed = structuredClone(st)
  mixed.investigators[0].hand = ['01023']
  mixed.pendingChoice.options.push({ id: '0', label: '手牌反应' })
  mixed.legalMoves.push({ action: 'choose', choiceId: 'scav', optionId: '0' })
  assert.equal(reactionSkipPlan(mixed, only), null)

  // canSkip=false（强制选择）永远不代答。
  const forced = structuredClone(st)
  forced.pendingChoice.canSkip = false
  assert.equal(reactionSkipPlan(forced, only), null)

  // 没有 skip 合法动作（例如多应答座位窗口）→ 不代答。
  const noSkip = structuredClone(st)
  noSkip.legalMoves = noSkip.legalMoves.filter(move => move.optionId !== 'skip')
  assert.equal(reactionSkipPlan(noSkip, only), null)
})

test('Mod autoPassChoice：只对本人座位的全关闭窗口返回普通 choose/skip', () => {
  const st = reactionState()
  const skip = { action: 'choose', choiceId: 'scav', optionId: 'skip' }
  assert.deepEqual(arkham.autoPassChoice({ state: st, seat: 0, disabledCodes: ['01073'] }), skip)

  // 座位不符 / 没有偏好 / 偏好对不上 / 没有待决窗口时都不接管。
  assert.equal(arkham.autoPassChoice({ state: st, seat: 1, disabledCodes: ['01073'] }), null)
  assert.equal(arkham.autoPassChoice({ state: st, seat: 0, disabledCodes: [] }), null)
  assert.equal(arkham.autoPassChoice({ state: st, seat: 0, disabledCodes: ['01023'] }), null)
  assert.equal(arkham.autoPassChoice({ state: { ...st, pendingChoice: null }, seat: 0, disabledCodes: ['01073'] }), null)
  assert.equal(arkham.autoPassChoice({ state: st, seat: 0 }), null)

  // 返回的 move 是普通动作，必须能过大厅的 validateMove（随后由 commitMove 走 applyMove/actionLog）。
  assert.equal(arkham.validateMove(structuredClone(st), 0, skip), null)
})

test('真实窗口：autoPassChoice 返回的 skip 能直接被引擎提交（不是合成状态的假窗口）', () => {
  // 与 reaction-preferences.test.mjs 的「米兰调查奖励不询问」同一套推进：真实打出拾荒窗口。
  const st = createGameState({ playerInvestigator: '01001', seed: 'auto-pass-real' },
    [{ seat: 0, role: 'human' }])
  const answer = (s, id) => applyMove(s, s.pendingChoice.seat,
    { action: 'choose', choiceId: s.pendingChoice.id, optionId: id })
  for (let i = 0; st.pendingChoice; i++) {
    assert.ok(i < 40)
    answer(st, ['done', 'skip', 'self'].find(id => st.pendingChoice.options.some(o => o.id === id))
      || st.pendingChoice.options[0].id)
  }
  const inv = st.investigators[0]
  inv.hand = []
  inv.assets = [{ id: 'milan', code: '01033' }, { id: 'scavenge', code: '01073' }]
  // 直接塞进 assets 不会经过「打出」流程；补上会话卡表，窗口才能把 source:scavenging 映射回卡号。
  st.cards['01073'] = { ...allCardDefs({ runtimeOnly: true })['01073'], code: '01073' }
  inv.discard = ['01087']
  inv.actionsLeft = 3
  st.chaosBag = ['0']
  const loc = st.locations.find(l => l.id === inv.location)
  loc.shroud = 0
  loc.clues = 5
  applyMove(st, 0, { action: 'investigate' })
  for (let i = 0; st.pendingChoice?.source !== 'scavenging'; i++) {
    assert.ok(i < 20)
    assert.ok(st.pendingChoice)
    answer(st, ['done', 'skip'].find(id => st.pendingChoice.options.some(o => o.id === id)))
  }

  const move = arkham.autoPassChoice({ state: st, seat: 0, disabledCodes: ['01073'] })
  assert.deepEqual(move, { action: 'choose', choiceId: st.pendingChoice.id, optionId: 'skip' })
  assert.equal(arkham.validateMove(st, 0, move), null)
  applyMove(st, 0, move)
  assert.equal(st.pendingChoice, null, 'skip 已在真实窗口上结算完')
})

test('无目标纯收益反应默认 auto：罗兰、米兰、幸运兔脚；有成本/目标仍 ask', () => {
  const defs = allCardDefs({ runtimeOnly: false })
  assert.equal(defs['01001'].hasAutoReaction, true)
  assert.equal(defs['01001'].autoByDefault, true, '罗兰无目标、无费用，默认 auto')
  assert.equal(defs['01033'].hasAutoReaction, true)
  assert.equal(defs['01033'].autoByDefault, true)
  assert.equal(defs['01075'].hasAutoReaction, true)
  assert.equal(defs['01075'].autoByDefault, true, '幸运兔脚只横置，允许默认 auto')
  assert.equal(defs['01073'].autoByDefault, false, '拾荒要选弃牌，默认 ask')
  assert.equal(defs['01004'].autoByDefault, false, '艾格尼丝要选敌人，默认 ask')
  assert.equal(defs['01533'].autoByDefault, false, '新式 resolve 不自动判断')
  const choice = (over = {}) => ({ id: 'reaction', kind: 'reaction', seat: 0, canSkip: true,
    source: 'rolandClue', cardCode: '01001', autoTriggerOptionId: 'trigger',
    options: [{ id: 'skip', label: '跳过' }, { id: 'trigger', label: '触发' }], ...over })
  const state = over => ({ pendingChoice: choice(over), cards: defs,
    investigators: [{ seat: 0, code: '01001', hand: [], assets: [], threat: [] }],
    legalMoves: [{ action: 'choose', choiceId: 'reaction', optionId: 'skip' },
      { action: 'choose', choiceId: 'reaction', optionId: 'trigger' }] })
  // 罗兰：默认 auto；改 ask 才保留窗口；skip 补 skip。
  assert.deepEqual(arkham.autoChoice({ state: state(), seat: 0, states: {} }),
    { action: 'choose', choiceId: 'reaction', optionId: 'trigger', auto: true })
  assert.equal(arkham.autoChoice({ state: state(), seat: 0, states: { '01001': 'ask' } }), null)
  assert.deepEqual(arkham.autoChoice({ state: state(), seat: 0, states: { '01001': 'auto' } }),
    { action: 'choose', choiceId: 'reaction', optionId: 'trigger', auto: true })
  assert.deepEqual(arkham.autoChoice({ state: state(), seat: 0, states: { '01001': 'skip' } }),
    { action: 'choose', choiceId: 'reaction', optionId: 'skip', auto: true })
  // 米兰：默认 auto（原来的纯收益自动奖励）。
  const milan = state({ source: 'milan', cardCode: '01033', autoOptionId: 'trigger' })
  assert.deepEqual(arkham.autoChoice({ state: milan, seat: 0, states: {} }),
    { action: 'choose', choiceId: 'reaction', optionId: 'trigger', auto: true })
  assert.equal(arkham.autoChoice({ state: milan, seat: 0, states: { '01033': 'ask' } }), null)
})

test('升级版米兰这类新式非手牌反应也能 auto；快速事件仍不行', () => {
  const defs = allCardDefs({ runtimeOnly: false })
  assert.equal(defs['01533'].hasReactionPrompt, true)
  assert.equal(defs['01533'].hasAutoReaction, true)
  assert.equal(defs['01533'].autoByDefault, false)
  assert.equal(defs['01522'].hasAutoReaction, false, '快速事件不从手牌自动打出')
  const choice = { id: 'new', kind: 'reaction', seat: 0, canSkip: true,
    source: { type: 'window', when: 'investigateSuccess' },
    options: [{ id: 'skip', label: '不触发' }, { id: 'desc:milan', label: '米兰：获得 1 资源', cardCode: '01533' }] }
  const base = { pendingChoice: choice, cards: defs,
    investigators: [{ seat: 0, code: '01001', hand: [], assets: [], threat: [] }],
    legalMoves: [{ action: 'choose', choiceId: 'new', optionId: 'skip' },
      { action: 'choose', choiceId: 'new', optionId: 'desc:milan' }] }
  assert.equal(arkham.autoChoice({ state: base, seat: 0, states: {} }), null)
  assert.equal(arkham.autoChoice({ state: base, seat: 0, states: { '01533': 'ask' } }), null)
  assert.deepEqual(arkham.autoChoice({ state: base, seat: 0, states: { '01533': 'auto' } }),
    { action: 'choose', choiceId: 'new', optionId: 'desc:milan', auto: true })
  assert.deepEqual(arkham.autoChoice({ state: base, seat: 0, states: { '01533': 'skip' } }),
    { action: 'choose', choiceId: 'new', optionId: 'skip', auto: true })
  // 同一张卡出现两个候选时，不替玩家排序，保持询问。
  const two = { ...base,
    pendingChoice: { ...choice, options: [...choice.options, { id: 'desc:milan-2', label: '第二个候选', cardCode: '01533' }] },
    legalMoves: [...base.legalMoves, { action: 'choose', choiceId: 'new', optionId: 'desc:milan-2' }] }
  assert.equal(arkham.autoChoice({ state: two, seat: 0, states: { '01533': 'auto' } }), null)
  // 快速事件没有自动资格；即使有 auto 覆盖也不代答。
  const fast = { ...base,
    pendingChoice: { ...choice, options: [{ id: 'skip', label: '不触发' },
      { id: 'desc:evidence', label: '证据！', cardCode: '01522' }] },
    legalMoves: [{ action: 'choose', choiceId: 'new', optionId: 'skip' },
      { action: 'choose', choiceId: 'new', optionId: 'desc:evidence' }] }
  assert.equal(arkham.autoChoice({ state: fast, seat: 0, states: { '01522': 'auto' } }), null)
})

test('auto 只代答反应触发，不会替玩家选目标', () => {
  const state = { pendingChoice: {
    id: 'target', kind: 'target', seat: 0, canSkip: true,
    options: [{ id: 'enemy-a', label: '敌人 A' }, { id: 'enemy-b', label: '敌人 B' }],
  }, cards: {}, investigators: [{ seat: 0, code: '01001', hand: [], assets: [], threat: [] }],
  legalMoves: [{ action: 'choose', choiceId: 'target', optionId: 'enemy-a' },
    { action: 'choose', choiceId: 'target', optionId: 'enemy-b' }] }
  assert.equal(arkham.autoChoice({ state, seat: 0, states: {} }), null)
  assert.equal(arkham.autoChoice({ state, seat: 0, states: { '01001': 'auto' } }), null)
})

test('reactionDisabledCodes：随 move 上行的就是本机「反应关」集合（按本局/座位，最多 256 条）', t => {
  const previous = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
  }
  t.after(() => {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  })

  setReactionEnabled('auto-pass-client', 0, ['01073', '01017'], false)
  assert.deepEqual(reactionDisabledCodes({ sessionId: 'auto-pass-client' }, 0).sort(), ['01017', '01073'])
  // 按本局 + 座位隔离：别的座位/别的对局不受影响。
  assert.deepEqual(reactionDisabledCodes({ sessionId: 'auto-pass-client' }, 1), [])
  assert.deepEqual(reactionDisabledCodes({ sessionId: 'another-game' }, 0), [])

  setReactionEnabled('auto-pass-client', 0, ['01073'], true)
  assert.deepEqual(reactionDisabledCodes({ sessionId: 'auto-pass-client' }, 0), ['01017'])
  assert.deepEqual(reactionDisabledCodes(null, 0), [], '没有 sessionId 时不发偏好')

  // 上限与大厅 autoPassCodesOf 的截断口径一致（256 条）。
  const many = Array.from({ length: 300 }, (_, index) => 'code-' + index)
  setReactionEnabled('auto-pass-many', 0, many, false)
  assert.equal(reactionDisabledCodes({ sessionId: 'auto-pass-many' }, 0).length, 256)
})
