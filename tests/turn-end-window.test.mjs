// 回合收尾（2026-11-13 行为调整）：
//   · 行动点用尽后不再自动开「收尾玩家窗口」、也不再自动推进回合；手牌/通道里的 0 行动快速卡与
//     [free] 能力改为 legalMoves 的直接行动（玩家主动点牌/按钮），必须点「结束回合」才真正结束。
//   · 剧本 behavior.fastActions 的 [fast] 剧本行动在空档期同样进入合法行动（gap-actions.js）。
//   · 「将要被击败」的救命卡窗口不受影响：致命伤害发生在快速卡/反应内部时不能被吞掉。
//
// 回归的两个真实症状（旧实现的问题，保留在这个文件里）：
//   1. 用完最后一个行动 → 旧实现 applyMoveUnchecked 立刻 advanceInvestigator，
//      手牌里的快速卡永远没有打出的时机；
//   2. 致命伤害发生在快速卡结算内部时，reactionWindow 的嵌套保护直接返回，
//      调查员被直接判定击败并结束回合，来不及打出「死里逃生」这类救命卡。
//
// 2026-10-27 追加：乔·戴蒙德（05002）的直觉牌库揭示牌「如同你的手牌」——快速事件
// （01022 证据！等）同样必须出现在反应窗口/收尾窗口里，并按 -2 费用结算。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, answer, move, legalMoves, validateMove, settle } from './core-fixture.mjs'
import { checkDefeated, playerWindow, reactionWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { gapFastActionMoves, sameScenarioAction, inGapPeriod } from '../src/engine/gap-actions.js'

const me = state => state.investigators[0]

test('行动点用尽后：快速卡直接打出、打完仍停在本回合，点「结束回合」后才推进', () => {
  const state = fixture('01001')
  me(state).actionsLeft = 1
  me(state).hand = ['01036']
  me(state).resources = 5
  move(state, { action: 'draw' })
  assert.equal(state.pendingChoice, null)
  assert.equal(state.currentSeat, 0, '行动点用尽不等于回合结束')
  assert.ok(legalMoves(state).some(move => move.action === 'play' && move.cardId === '01036'),
    '快速卡是直接合法行动（不再靠收尾窗口询问）')
  assert.ok(legalMoves(state).some(move => move.action === 'endTurn'), '结束回合必须由玩家主动提交')
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '01036' }), null)
  move(state, { action: 'play', cardId: '01036' })
  assert.ok(!me(state).hand.includes('01036'))
  assert.ok(me(state).discard.includes('01036'), '快速事件打出后正常进弃牌堆')
  assert.equal(me(state).actionsLeft, 0, '快速事件不消耗行动点')
  assert.equal(state.pendingChoice, null)
  assert.equal(state.round, 1, '打完快速卡仍停在本回合，等待玩家结束回合')
  assert.equal(state.currentSeat, 0)
  move(state, { action: 'endTurn' })
  assert.equal(state.round, 2, '点结束回合后才真正推进回合')
})

test('0 行动空档期：一张快速卡打完后其余快速卡仍在合法行动里', () => {
  const state = fixture('01001')
  me(state).actionsLeft = 1
  me(state).hand = ['01036', '02017']
  me(state).resources = 5
  move(state, { action: 'draw' })
  assert.equal(state.pendingChoice, null)
  move(state, { action: 'play', cardId: '01036' })
  assert.ok(legalMoves(state).some(move => move.action === 'play' && move.cardId === '02017'),
    '其余快速卡仍是直接合法行动')
  move(state, { action: 'play', cardId: '02017' })
  assert.deepEqual([...me(state).discard].sort(), ['01036', '02017'])
  assert.equal(state.round, 1)
})

test('0 行动空档期：普通牌与付不起的快速卡都不是合法行动', () => {
  const ordinary = fixture('01001')
  me(ordinary).actionsLeft = 1
  me(ordinary).hand = ['01088'] // 「获得 3 资源」是普通事件：要花 1 行动
  me(ordinary).resources = 5
  move(ordinary, { action: 'draw' })
  assert.ok(!legalMoves(ordinary).some(move => move.action === 'play' && move.cardId === '01088'))
  assert.match(validateMove(ordinary, 0, { action: 'play', cardId: '01088' }), /行动点/)
  assert.ok(me(ordinary).hand.includes('01088'))

  const poor = fixture('01001')
  me(poor).actionsLeft = 1
  me(poor).hand = ['01036']
  me(poor).resources = 0
  move(poor, { action: 'draw' })
  assert.ok(!legalMoves(poor).some(move => move.action === 'play' && move.cardId === '01036'))
  assert.match(validateMove(poor, 0, { action: 'play', cardId: '01036' }), /资源不足/)
})

test('0 行动空档期：免费触发能力与快速卡并列在合法行动里', () => {
  const state = fixture('01001')
  asset(state, '01518') // 巡警：带 [free] 能力的支援
  // P2-4：巡警的免费能力带必需目标（同地点 1 个敌人）；可行性检查与 legalMoves 同源。
  enemy(state, { fight: 1, evade: 1, health: 3, engagedSeat: null })
  me(state).actionsLeft = 1
  me(state).hand = ['01036']
  me(state).resources = 5
  move(state, { action: 'draw' })
  assert.equal(state.pendingChoice, null)
  const legal = legalMoves(state)
  const labels = legal.map(move => move.label).join('|')
  assert.ok(legal.some(move => move.action === 'ability'), '装备上的免费能力是直接合法行动')
  assert.ok(legal.some(move => move.action === 'play' && move.cardId === '01036'), '快速卡与免费能力并列')
  assert.match(labels, /心胜于物/)
})

test('主动点「结束回合」直接结束本回合（不再弹快速卡询问）', () => {
  const state = fixture('01001')
  me(state).hand = ['01036']
  me(state).resources = 5
  me(state).actionsLeft = 3
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice, null, '结束回合不再打开快速卡窗口')
  assert.ok(me(state).hand.includes('01036'), '手牌原样保留（玩家没选择打出）')
  assert.equal(state.round, 2)
})

test('0 行动空档期：触发式快速事件仍只能在对应反应窗口打出', () => {
  // 01022 证据！/ 01080 运气好！/ 01065 守护结界 都是「有触发时机」的快速事件：只能在
  // 击败敌人 / 检定失败 / 抽到诡计等反应窗口打出，不能作为空档期的普通行动。
  const state = fixture('01001')
  me(state).actionsLeft = 1
  me(state).hand = ['01022', '01080', '01065']
  me(state).resources = 10
  move(state, { action: 'draw' })
  for (const code of ['01022', '01080', '01065']) {
    assert.ok(!legalMoves(state).some(move => move.action === 'play' && move.cardId === code), code)
    assert.match(validateMove(state, 0, { action: 'play', cardId: code }), /反应窗口/, code)
  }
})

test('0 行动空档期：behavior.fastActions 的 [fast] 剧本行动进入合法行动（gap-actions）', () => {
  const inv = { seat: 0, actionsLeft: 0 }
  const state = { phase: 'investigation', currentSeat: 0, pendingChoice: null }
  const behavior = {
    fastActions: (s, i, timing) => {
      assert.equal(timing, 'investigation.afterAction')
      return [
        { action: 'scenarioAction', rule: 'peek', actions: 0, fast: true, label: '快速看一眼' },
        { action: 'scenarioAction', rule: 'slow', actions: 1, fast: false },
        { action: 'scenarioAction', rule: 'blocked', actions: 0, fast: true, reason: '本回合已用' },
      ]
    },
  }
  assert.equal(inGapPeriod(state, inv), true)
  assert.deepEqual(gapFastActionMoves(state, inv, behavior).map(move => move.rule), ['peek'])
  // 有行动点时不由空档期补（仍由行动结算后的玩家窗口提供）。
  assert.deepEqual(gapFastActionMoves(state, { ...inv, actionsLeft: 1 }, behavior), [])
  // 有待决选择 / 不是本回合时不补。
  assert.deepEqual(gapFastActionMoves({ ...state, pendingChoice: { seat: 0 } }, inv, behavior), [])
  assert.deepEqual(gapFastActionMoves({ ...state, currentSeat: 1 }, inv, behavior), [])
  // 剧本钩子异常不阻断基础合法性。
  assert.deepEqual(gapFastActionMoves(state, inv, { fastActions: () => { throw new Error('boom') } }), [])
  // 去重口径：规则名 + 可选目标。
  assert.equal(sameScenarioAction({ rule: 'parley', enemyId: 'e1' }, { rule: 'parley', enemyId: 'e1' }), true)
  assert.equal(sameScenarioAction({ rule: 'parley', enemyId: 'e1' }, { rule: 'parley', enemyId: 'e2' }), false)
  assert.equal(sameScenarioAction({ rule: 'peek' }, { rule: 'peek' }), true)
})

// ---------------------------------------------------------------------------
// 致命伤害 / 救命卡的窗口不受收尾调整影响
// ---------------------------------------------------------------------------

test('致命伤害先开「将受到伤害」窗口，取消牌可以救命', () => {
  const state = fixture('01001')
  me(state).damage = me(state).maxHealth - 1
  me(state).hand = ['04111']
  me(state).resources = 10
  enemy(state, { damage: 2, horror: 0, fight: 99 })
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice?.kind, 'reaction')
  const save = state.pendingChoice.options.find(option => option.label.includes('坚韧不拔'))
  assert.ok(save, '致命伤害前必须给出取消伤害的快速卡')
  answer(state, save.id)
  assert.equal(state.pendingChoice?.kind, 'harm')
  answer(state, '2:0')
  assert.equal(me(state).defeated, false)
  assert.equal(me(state).damage, me(state).maxHealth - 1)
})

test('致命伤害的「将要被击败」窗口可以跳过，跳过后才判定击败', () => {
  const state = fixture('01001')
  me(state).damage = me(state).maxHealth - 1
  me(state).hand = ['03310']
  me(state).resources = 10
  enemy(state, { damage: 2, horror: 0, fight: 99 })
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice?.kind, 'reaction')
  assert.ok(state.pendingChoice.options.some(option => option.label.includes('死里逃生')))
  answer(state, 'skip')
  assert.equal(me(state).defeated, true)
})

test('回合结束时的强制恐惧同样能在击败前打出救命卡', () => {
  const state = fixture('01001')
  me(state).horror = me(state).maxSanity - 1
  me(state).hand = ['01013', '03310'] // 黑暗回忆：回合结束时揭示并受到 2 点恐惧
  me(state).resources = 10
  me(state).actionsLeft = 1
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice?.kind, 'reaction')
  const save = state.pendingChoice.options.find(option => option.label.includes('死里逃生'))
  assert.ok(save, '回合结束的强制恐惧也不能跳过救命窗口')
  answer(state, save.id)
  assert.equal(me(state).defeated, false)
})

test('致命伤害发生在反应结算内部时仍会开「将要被击败」窗口', () => {
  const state = fixture('01001')
  me(state).hand = ['03310']
  me(state).resources = 10
  me(state).damage = me(state).maxHealth
  // playReactionCard 在结算快速卡期间会写 state._reaction；这里构造同一状态，
  // 验证「已经处在一个窗口里」不会吞掉被击败前的救命窗口。
  state._reaction = { when: 'customReaction', seat: 0, context: {} }
  const execute = (draft, seat, command, events) => { checkDefeated(draft, seat, events) }
  resolveTransaction(state, 0, { action: 'draw' }, execute)
  assert.equal(state.pendingChoice?.kind, 'reaction')
  const option = state.pendingChoice.options.find(item => item.label?.includes('死里逃生'))
  assert.ok(option, '嵌套结算里也必须给出救命卡')
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: option.id }, execute)
  assert.equal(me(state).defeated, false)
  assert.equal(me(state).damage, me(state).maxHealth - 2)
  assert.equal(state._reaction?.when, 'customReaction', '嵌套窗口结束后必须恢复外层反应上下文')
})

// ---------------------------------------------------------------------------
// 直觉牌库（乔·戴蒙德 05002）：「如同手牌」的快速事件
// ---------------------------------------------------------------------------

// 05002 走真实开局（含直觉牌库设置），再把手牌/资源摆成测试需要的形状。
function joeState(revealed, { resources = 0 } = {}) {
  const state = fixture('05002')
  const inv = me(state)
  inv.hunchDeck = []
  inv.hunchRevealed = revealed
  inv.hand = []
  inv.resources = resources
  inv.discard = []
  const loc = state.locations.find(location => location.id === inv.location)
  loc.clues = Math.max(1, loc.clues || 0)
  return state
}

// 与 tcu-investigators 同一套事务循环：直接调窗口函数时，待决选择要靠同一份 execute 续算。
function runTransaction(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'hunchFastTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('直觉牌库揭示的快速反应事件（01022 证据！）能在「击败敌人后」窗口按 -2 费打出', () => {
  const state = joeState('01022')
  const before = me(state).clues
  state.chaosBag = ['0']
  const target = enemy(state, { id: 'hunch-target', fight: 0, evade: 1, health: 1, damageTaken: 0, engagedSeat: 0 })
  move(state, { action: 'fight', enemyId: target.id })
  let offered = null
  settle(state, pending => {
    if (pending.kind !== 'reaction') return null
    const option = pending.options.find(option => option.id === 'hunch' && option.cardCode === '01022')
    if (option) { offered = option; return option.id }
    return null
  })
  assert.ok(offered, '击败敌人后的反应窗口必须列出直觉牌库揭示的「证据！」')
  assert.match(offered.label, /直觉牌库/)
  const inv = me(state)
  assert.equal(inv.hunchRevealed ?? null, null, '打出后清掉揭示标记，阶段结束不再洗回')
  assert.equal(inv.resources, 0, '印刷费用 1 - 2 = 0')
  assert.ok(inv.discard.includes('01022'), '打出的快速事件正常进弃牌堆')
  assert.equal(inv.clues, before + 1, '「证据！」结算发现 1 个线索')
})

test('直觉牌库揭示的快速事件按 -2 费用通过资源校验（01037 印刷 2 费、0 资源仍可打出）', () => {
  const state = joeState('01037')
  const before = me(state).clues
  const play = legalMoves(state).find(move => move.action === 'play'
    && move.fromHunch === true && move.cardId === '01037')
  assert.ok(play, '折扣后费用 0：fromHunch 候选必须通过 validateMove（旧实现按印刷费用误判资源不足）')
  assert.match(play.label, /0 资源/)
  move(state, play)
  settle(state)
  const inv = me(state)
  assert.equal(inv.hunchRevealed ?? null, null, '打出后清掉揭示标记')
  assert.equal(inv.resources, 0, '2 - 2 = 0：不多扣也不过扣')
  assert.ok(inv.discard.includes('01037'), '打出的快速事件正常进弃牌堆')
  assert.equal(inv.clues, before + 1, '「专业的直觉」结算发现 1 个线索')
})

test('0 行动空档期可打出直觉牌库揭示的快速卡（-2 费、清标记、正常弃置、回合不自动结束）', () => {
  const state = joeState('01037')
  const before = me(state).clues
  me(state).actionsLeft = 1
  // 用完最后一个行动（hunchFastTest 是测试里直接调用的，这里用真实 move 走一次抽牌）。
  move(state, { action: 'draw' })
  assert.equal(me(state).actionsLeft, 0)
  assert.equal(state.pendingChoice, null, '不再弹收尾窗口')
  const play = legalMoves(state).find(move => move.action === 'play'
    && move.fromHunch === true && move.cardId === '01037')
  assert.ok(play, '空档期直接合法行动里必须列出直觉牌库揭示的快速卡')
  assert.match(play.label, /0 资源/)
  move(state, play)
  const inv = me(state)
  assert.equal(inv.hunchRevealed ?? null, null, '打出后清掉揭示标记')
  assert.equal(inv.resources, 0, '2 - 2 = 0')
  assert.ok(inv.discard.includes('01037'), '打出的快速事件正常进弃牌堆')
  assert.equal(inv.clues, before + 1, '「专业的直觉」结算发现 1 个线索')
  assert.equal(state.round, 1, '快速卡结算完仍在本回合（由玩家点结束回合）')
  move(state, { action: 'endTurn' })
})

test('能力层写法（fromHand 反应描述子）的直觉牌库快速事件同样能打出（05025 串联线索）', () => {
  // 01022 是 played+fast 写法，05025 是能力层 fromHand 反应写法；两条实现通道的「如同手牌」
  // 必须一致（01522 是同一张「证据！」的替印，默认卡池仅 catalog-only，不能作为运行时用例）。
  const state = joeState('05025', { resources: 2 })
  const here = state.locations.find(location => location.id === me(state).location)
  state.locations.push({
    id: 'probe-low-shroud', name: '低帷幕地点', shroud: Math.max(0, (here.shroud || 0) - 1),
    clues: 2, connections: [here.id], revealed: true,
  })
  const before = me(state).clues
  let offered = null
  runTransaction(state, current => {
    reactionWindow(current, 'clueDiscovered', {
      when: 'clueDiscovered', seat: 0, location: current.investigators[0].location,
      lastClue: true, prompt: '发现了本地点最后一个线索',
    }, [])
  }, pending => {
    const option = pending.options.find(item => item.cardCode === '05025' && /直觉牌库/.test(item.label || ''))
    if (option) { offered = option; return option.id }
    return null
  })
  assert.ok(offered, '能力层 fromHand 快速事件也必须作为直觉牌库候选列出')
  const inv = me(state)
  assert.equal(inv.hunchRevealed ?? null, null, '打出后清掉揭示标记')
  assert.equal(inv.resources, 0, '印刷费用 4 - 2 = 2')
  assert.ok(inv.discard.includes('05025'), '打出的快速事件正常进弃牌堆')
  const low = state.locations.find(location => location.id === 'probe-low-shroud')
  assert.equal(low.clues, 0, '「串联线索」发现低帷幕地点的 2 个线索')
  assert.equal(inv.clues, before + 2)
})
