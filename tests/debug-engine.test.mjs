// 引擎侧调试 move 回归（契约：artifacts/debug-console/CONTRACT.md §3，v1.1 追加批次见 §10）。
//
// 覆盖范围：
//   · 7 种 kind（scenario / spawn / defeat / card / xp / resources / clues）的状态变化与 info 日志；
//   · v1.1 新增 7 种 kind（draw / actions / moveTo / heal / harm / reveal / doom）与 card 的
//     hand / deckTop / deckBottom / discard 区域；
//   · debug move 可在任意时机提交（绕过 actingSeats），不进 legalMoves，仍写 actionLog 并可重放；
//   · pendingChoice / 对局结束 / 缺战役信息 / 未知 kind / 非法 amount / 非法 targetSeat / 空场敌人
//     等拒绝路径；致命 harm 打开普通待决窗口后仍能继续；
//   · 卡牌从牌库/弃牌堆取出、线索总账收敛。
//
// 建局、卡号与关卡 id 可以写字面量：只有 src/engine/** 受硬编码守卫约束，测试文件不受限。

import test from 'node:test'
import assert from 'node:assert/strict'

import { applyMove, createGameState, moveToText, placeLocation, validateMove } from '../src/engine/engine.js'
import { verifyReplay } from '../src/engine/replay.js'
import { settle } from './core-fixture.mjs'

const PLAYERS = [{ seat: 0, role: 'human' }, { seat: 1 }]
const DEBUG_LOG = '🛠️ 调试：'
const GHOUL_MINION = 'ghoulMinion'
// 候选玩家卡（资产 / 事件 / 技能、非永久），测试里动态挑一张不在手牌中的。
const CARD_CANDIDATES = ['01020', '01030', '01031', '01022', '01025', '01040', '01021']

function newGame(seed) {
  const state = createGameState({
    campaignId: 'nightOfTheZealot',
    playerInvestigator: '01001',
    seatInvestigators: ['01001', '01002'],
    legacyAutoStart: true,
    seed,
  }, PLAYERS.map(player => ({ ...player })))
  settle(state)
  return state
}

// 提交一条调试指令；断言校验通过、revision 前进、动作日志记录 debug move。
function runDebug(state, seat, move) {
  assert.equal(validateMove(state, seat, move), null, `调试指令应通过校验：${JSON.stringify(move)}`)
  const actionLogLength = state.actionLog.length
  const revision = state.revision
  const events = applyMove(state, seat, move)
  settle(state)
  assert.ok(state.revision > revision, '调试指令应推进 revision')
  const recorded = state.actionLog.slice(actionLogLength)
  assert.ok(recorded.some(entry => entry.seat === seat && entry.move?.action === 'debug'
    && entry.move.kind === move.kind), 'actionLog 应记录 { action: "debug" }')
  return events
}

function textLog(state, since = 0) {
  return state.log.slice(since).join('\n')
}

function spareCard(state, seat = 0) {
  const hand = state.investigators[seat].hand
  const code = CARD_CANDIDATES.find(candidate => !hand.includes(candidate))
  assert.ok(code, '测试需要一张不在起始手牌里的玩家卡')
  return code
}

// 同一张牌在手牌 + 牌库 + 弃牌堆里的总份数（调试发卡不得让牌凭空多一份）。
function cardCopies(state, code, seat = 0) {
  const inv = state.investigators[seat]
  return ['hand', 'deck', 'discard']
    .reduce((count, zone) => count + (inv[zone] || []).filter(item => item === code).length, 0)
}

test('scenario：跳到指定关卡，对齐战役流程并清掉待推进节点', () => {
  const state = newGame('debug-scenario')
  assert.equal(state.scenario.id, 'theGathering')
  assert.equal(state.campaign.scenarioIndex, 0)
  assert.equal(state.campaign.flow.nodeId, 'gathering')

  // 座位 1 不是当前行动者：调试指令仍必须能提交（绕过 actingSeats）。
  assert.equal(state.currentSeat, 0)
  assert.ok(!state.legalMoves.some(move => move.action === 'debug'), '调试 move 不进 legalMoves')

  const logStart = state.log.length
  runDebug(state, 1, { action: 'debug', kind: 'scenario', scenarioId: 'theDevourerBelow' })

  assert.equal(state.scenario.id, 'theDevourerBelow')
  assert.equal(state.campaign.scenarioIndex, 2)
  assert.equal(state.campaign.flow.nodeId, 'devourer')
  assert.equal(state.campaign.flowStage, 'scenario')
  assert.equal(state.campaign.pendingNode, undefined)
  assert.equal(state.campaign.pendingNextIndex, undefined)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.phase, 'investigation')
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}跳到第 3 关「`))

  // 未知关卡 / 过期 revision 拒绝。
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'scenario', scenarioId: 'notAScenario' }))
  assert.equal(validateMove(state, 0, {
    action: 'debug', kind: 'scenario', scenarioId: 'theGathering', revision: state.revision + 5,
  }), '对局版本已过期')

  // 已完成关卡也可以跳：结算记录不构成拦截；重复跳同一关按新到访计数（重打时 visitId 不撞车）。
  state.campaign.scenarioResults.push({ scenarioId: 'theGathering', visitId: 'gathering:1', resolution: 'r1' })
  assert.equal(validateMove(state, 1, { action: 'debug', kind: 'scenario', scenarioId: 'theGathering' }), null)
  assert.equal(state.campaign.flow.visits.devourer, 1)
  runDebug(state, 1, { action: 'debug', kind: 'scenario', scenarioId: 'theDevourerBelow' })
  assert.equal(state.campaign.flow.visits.devourer, 2)
  assert.equal(state.scenario.id, 'theDevourerBelow')
})

test('spawn：在目标调查员所在地点生成敌人，非法目标/未知敌人拒绝', () => {
  const state = newGame('debug-spawn')
  const before = state.enemies.length
  const logStart = state.log.length

  runDebug(state, 1, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: 0 })

  assert.equal(state.enemies.length, before + 1)
  const enemy = state.enemies.find(item => item.code === GHOUL_MINION)
  assert.ok(enemy, '应生成指定的敌人')
  assert.equal(enemy.location, state.investigators[0].location)
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}在「书房」生成「`))

  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'spawn', code: 'notAnEnemy', targetSeat: 0 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: 9 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: '0' }))

  state.investigators[1].defeated = true
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: 1 }))
  state.investigators[1].defeated = false

  state.investigators[1].location = null
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: 1 }))
  state.investigators[1].location = state.investigators[0].location
})

test('defeat：按 id 消灭、all 清场；空场与未知敌人拒绝', () => {
  const state = newGame('debug-defeat')
  assert.equal(state.enemies.length, 0)
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'defeat', all: true }), '空场不能消灭全部')
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'defeat', enemyIds: ['missing-enemy'] }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'defeat' }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'defeat', enemyIds: [] }))

  runDebug(state, 0, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: 0 })
  const first = state.enemies.find(item => item.code === GHOUL_MINION)
  const logStart = state.log.length
  runDebug(state, 1, { action: 'debug', kind: 'defeat', enemyIds: [first.id] })
  assert.equal(state.enemies.some(item => item.id === first.id), false, '指定敌人应离开场上')
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}消灭「`))

  runDebug(state, 0, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: 0 })
  runDebug(state, 0, { action: 'debug', kind: 'spawn', code: 'swarmOfRats', targetSeat: 1 })
  assert.ok(state.enemies.length >= 2)
  runDebug(state, 0, { action: 'debug', kind: 'defeat', all: true })
  assert.equal(state.enemies.length, 0, 'all 应清空场上敌人')
})

test('card：发牌进手牌；从牌库/弃牌堆取走一张，重复与非法卡拒绝', () => {
  const state = newGame('debug-card')
  // 注意：applyMove 的事务会重建调查员对象，跨动作持有的引用会失效，断言前重新取。
  const invAt = seat => state.investigators[seat]

  // 牌库路径：先把这张牌从其它区域清干净，再放进牌库。
  const deckCode = spareCard(state, 0)
  const inv = invAt(0)
  inv.deck = inv.deck.filter(code => code !== deckCode)
  inv.discard = inv.discard.filter(code => code !== deckCode)
  inv.deck.push(deckCode)
  const deckBefore = inv.deck.length
  const logStart = state.log.length
  runDebug(state, 0, { action: 'debug', kind: 'card', code: deckCode, targetSeat: 0 })
  assert.equal(invAt(0).hand.filter(code => code === deckCode).length, 1, '手牌中应恰好有一张')
  assert.equal(invAt(0).deck.length, deckBefore - 1, '牌库中应被取走一张')
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}将「.+」放入 罗兰·班克斯 的手牌`))
  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'card', code: deckCode, targetSeat: 0 }),
    '目标手牌中已有这张牌')

  // 弃牌堆路径。
  const discardCode = spareCard(state, 0)
  invAt(0).discard.push(discardCode)
  runDebug(state, 0, { action: 'debug', kind: 'card', code: discardCode, targetSeat: 0 })
  assert.equal(invAt(0).discard.includes(discardCode), false, '弃牌堆中的牌应被取走')
  assert.equal(invAt(0).hand.filter(code => code === discardCode).length, 1)

  // 非法卡：未知 / 非玩家卡 / 永久卡 / 非法目标。
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'card', code: '99999', targetSeat: 0 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'card', code: GHOUL_MINION, targetSeat: 0 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'card', code: '10005', targetSeat: 0 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'card', code: spareCard(state, 0), targetSeat: 9 }))

  state.investigators[1].defeated = true
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'card', code: spareCard(state, 0), targetSeat: 1 }))
  state.investigators[1].defeated = false
})

test('xp：按座位发放经验（awardExperience），非法数量/座位拒绝', () => {
  const state = newGame('debug-xp')
  const before = { xp: state.campaign.investigators[0].xp, earnedXp: state.campaign.investigators[0].earnedXp }
  const logStart = state.log.length

  runDebug(state, 1, { action: 'debug', kind: 'xp', amount: 7, targetSeat: 0 })

  const record = state.campaign.investigators[0]
  assert.equal(record.xp, before.xp + 7)
  assert.equal(record.earnedXp, before.earnedXp + 7)
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}罗兰·班克斯 获得 7 经验（当前 \\d+）`))

  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'xp', amount: 999, targetSeat: 0 }), null)
  for (const amount of [0, -1, 1.5, 1000, '3']) {
    assert.ok(validateMove(state, 0, { action: 'debug', kind: 'xp', amount, targetSeat: 0 }),
      `非法经验数量应被拒绝：${amount}`)
  }
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'xp', amount: 1, targetSeat: 9 }))

  // 没有战役记录的座位（例如尚未登记）也要拒绝。
  const removed = state.campaign.investigators[0]
  delete state.campaign.investigators[0]
  try {
    assert.ok(validateMove(state, 0, { action: 'debug', kind: 'xp', amount: 1, targetSeat: 0 }))
  } finally {
    state.campaign.investigators[0] = removed
  }
})

test('resources / clues：按座位加资源与线索，公共线索由收尾收敛', () => {
  const state = newGame('debug-resources')
  const resources0 = state.investigators[0].resources
  const resources1 = state.investigators[1].resources
  const clues0 = state.investigators[0].clues
  const clues1 = state.investigators[1].clues
  const logStart = state.log.length

  runDebug(state, 0, { action: 'debug', kind: 'resources', amount: 3, targetSeat: 0 })
  runDebug(state, 1, { action: 'debug', kind: 'resources', amount: 2, targetSeat: 1 })
  // applyMove 事务重建了调查员对象：断言用最新引用。
  assert.equal(state.investigators[0].resources, resources0 + 3)
  assert.equal(state.investigators[1].resources, resources1 + 2)

  runDebug(state, 1, { action: 'debug', kind: 'clues', amount: 2, targetSeat: 1 })
  runDebug(state, 0, { action: 'debug', kind: 'clues', amount: 1, targetSeat: 0 })
  assert.equal(state.investigators[0].clues, clues0 + 1)
  assert.equal(state.investigators[1].clues, clues1 + 2)
  // 公共线索 = 各调查员线索之和（applyMove 收尾的 syncClues 收敛）。
  assert.equal(state.clues, state.investigators.reduce((sum, inv) => sum + inv.clues, 0))

  const logText = textLog(state, logStart)
  assert.match(logText, new RegExp(`${DEBUG_LOG}罗兰·班克斯 获得 3 资源（当前 \\d+）`))
  assert.match(logText, new RegExp(`${DEBUG_LOG}黛西·沃克 获得 2 线索（当前 \\d+）`))

  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'resources', amount: 0, targetSeat: 0 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'clues', amount: 1.5, targetSeat: 0 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'resources', amount: 1, targetSeat: 9 }))
  state.investigators[1].defeated = true
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'clues', amount: 1, targetSeat: 1 }))
  state.investigators[1].defeated = false
})

test('debug move 绕过行动者与行动点，并随 actionLog 重放', () => {
  const state = newGame('debug-replay')
  assert.equal(state.currentSeat, 0)
  const actionsLeft = state.investigators[1].actionsLeft

  runDebug(state, 1, { action: 'debug', kind: 'resources', amount: 2, targetSeat: 1 })
  runDebug(state, 0, { action: 'debug', kind: 'xp', amount: 3, targetSeat: 0 })
  runDebug(state, 0, { action: 'debug', kind: 'spawn', code: GHOUL_MINION, targetSeat: 0 })
  const enemy = state.enemies.at(-1)
  runDebug(state, 1, { action: 'debug', kind: 'defeat', enemyIds: [enemy.id] })
  runDebug(state, 0, { action: 'debug', kind: 'scenario', scenarioId: 'theMidnightMasks' })
  runDebug(state, 0, { action: 'debug', kind: 'clues', amount: 1, targetSeat: 1 })

  // 绕过行动点：提交调试指令的座位没有被扣行动点，也没有被推进回合。
  assert.equal(state.investigators[1].actionsLeft, actionsLeft)
  assert.equal(state.currentSeat, 0)

  // 调试动作是纯 JSON、可随对局重放：按自己的 actionLog 重建状态，指纹一致。
  const replay = verifyReplay(state)
  assert.equal(replay.ok, true, `调试对局重放应一致：${JSON.stringify(replay.differences)}`)
  assert.ok(replay.moves >= 6)

  // 描述层兜底文案（调试 move 不进 legalMoves，只用于日志/AI 上下文）。
  assert.equal(moveToText({ action: 'debug', kind: 'resources' }), '调试：resources')
})

test('拒绝路径：pendingChoice / 对局结束 / 缺战役信息 / 未知 kind', () => {
  const state = newGame('debug-reject')
  const probe = { id: 'debug-probe', kind: 'reaction', seat: 0, prompt: '测试待决选择', options: [{ id: 'skip', label: '跳过' }], canSkip: true }

  state.pendingChoice = probe
  try {
    assert.equal(validateMove(state, 0, { action: 'debug', kind: 'resources', amount: 1, targetSeat: 0 }),
      '请先处理当前待决选择，再使用调试控制台')
  } finally {
    state.pendingChoice = null
  }

  state.status = 'finished'
  try {
    assert.equal(validateMove(state, 0, { action: 'debug', kind: 'resources', amount: 1, targetSeat: 0 }), '对局已结束')
  } finally {
    state.status = 'playing'
  }

  const campaignId = state.campaign.id
  delete state.campaign.id
  try {
    assert.equal(validateMove(state, 0, { action: 'debug', kind: 'resources', amount: 1, targetSeat: 0 }),
      '当前对局没有战役信息')
  } finally {
    state.campaign.id = campaignId
  }

  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'unknown' }), '未知调试指令')
  assert.equal(validateMove(state, 0, { action: 'debug' }), '未知调试指令')
  // 非法 action 形状仍走原有校验。
  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'resources', amount: 1, targetSeat: 0 }), null)
})

// ---------------------------------------------------------------------------
// v1.1 追加批次（契约 §10）：draw / actions / moveTo / heal / harm / reveal / doom 与 card 区域。
// ---------------------------------------------------------------------------

test('draw / actions：抽牌与加行动点（缺省 1），非法参数拒绝', () => {
  const state = newGame('debug-draw-actions')
  const invAt = seat => state.investigators[seat]
  // 固定牌库顶，避免随机弱点把「抽到的牌留在手牌」这条断言弄成偶然。
  invAt(0).deck = ['01025', '01026', '01027']
  invAt(0).hand = []
  const logStart = state.log.length

  runDebug(state, 1, { action: 'debug', kind: 'draw', amount: 2, targetSeat: 0 })
  assert.equal(invAt(0).hand.length, 2, '抽 2 张进手牌')
  assert.equal(invAt(0).deck.length, 1)
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}罗兰·班克斯 抽了 2 张牌（当前手牌 2 张）`))

  // amount 缺省为 1。
  runDebug(state, 0, { action: 'debug', kind: 'draw', targetSeat: 0 })
  assert.equal(invAt(0).hand.length, 3)
  assert.equal(invAt(0).deck.length, 0)

  const actionsBefore = invAt(0).actionsLeft
  runDebug(state, 1, { action: 'debug', kind: 'actions', amount: 2, targetSeat: 0 })
  assert.equal(invAt(0).actionsLeft, actionsBefore + 2)
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}罗兰·班克斯 行动点 \\+2（当前 ${actionsBefore + 2}）`))
  runDebug(state, 0, { action: 'debug', kind: 'actions', targetSeat: 1 })
  assert.equal(invAt(1).actionsLeft, 4, 'amount 缺省 1（黛西初始 3 点）')

  for (const amount of [0, -1, 1.5, 1000, '2']) {
    assert.ok(validateMove(state, 0, { action: 'debug', kind: 'draw', amount, targetSeat: 0 }),
      `draw 非法数量应被拒绝：${amount}`)
    assert.ok(validateMove(state, 0, { action: 'debug', kind: 'actions', amount, targetSeat: 0 }),
      `actions 非法数量应被拒绝：${amount}`)
  }
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'draw', amount: 1, targetSeat: 9 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'actions', amount: 1, targetSeat: 9 }))
  invAt(1).defeated = true
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'draw', amount: 1, targetSeat: 1 }))
})

test('moveTo / reveal：传送到地点、被门禁阻止保留引擎日志，揭示单个/全部', () => {
  const state = newGame('debug-locations')
  placeLocation(state, 'hallway', [])
  placeLocation(state, 'attic', [])
  placeLocation(state, 'parlor', [])
  const invAt = seat => state.investigators[seat]
  const loc = id => state.locations.find(location => location.id === id)

  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'moveTo', locationId: 'notALocation', targetSeat: 0 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'moveTo', locationId: 'hallway', targetSeat: 9 }))

  // 成功传送：进入未揭示地点时 relocateInvestigator 会照常揭示。
  const logStart = state.log.length
  runDebug(state, 1, { action: 'debug', kind: 'moveTo', locationId: 'hallway', targetSeat: 0 })
  assert.equal(invAt(0).location, 'hallway')
  assert.equal(loc('hallway').revealed, true)
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}罗兰·班克斯 传送到「走廊」`))

  // 被地点门禁阻止（集结第三幕前不能进客厅）：保留引擎日志、不叠加传送成功、位置不变。
  const blockedStart = state.log.length
  runDebug(state, 0, { action: 'debug', kind: 'moveTo', locationId: 'parlor', targetSeat: 0 })
  assert.equal(invAt(0).location, 'hallway', '被阻止时不应移动')
  const blockedText = textLog(state, blockedStart)
  assert.ok(blockedText.includes('不能进入客厅'), `应保留引擎门禁日志：${blockedText}`)
  assert.ok(!blockedText.includes(`${DEBUG_LOG}罗兰·班克斯 传送到「客厅」`))

  // 揭示单个地点：attic 未揭示 → 成功；重复揭示拒绝。
  assert.equal(loc('attic').revealed, false)
  runDebug(state, 0, { action: 'debug', kind: 'reveal', locationId: 'attic' })
  assert.equal(loc('attic').revealed, true)
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}揭示「阁楼」`))
  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'reveal', locationId: 'attic' }), '该地点已经揭示')
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'reveal', locationId: 'notALocation' }))

  // 揭示全部：只剩客厅未揭示。
  assert.equal(loc('parlor').revealed, false)
  runDebug(state, 1, { action: 'debug', kind: 'reveal', all: true })
  assert.ok(state.locations.every(location => location.revealed), '全部地点应已揭示')
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}揭示全部地点（1 张）`))
  // 没有未揭示地点时是空操作而不是报错。
  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'reveal', all: true }), null)
  runDebug(state, 0, { action: 'debug', kind: 'reveal', all: true })
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}揭示全部地点（0 张）`))
})

test('heal / harm：治疗钳制到 0 且不开窗口，直接受伤；非法参数拒绝', () => {
  const state = newGame('debug-heal-harm')
  const invAt = seat => state.investigators[seat]
  invAt(0).damage = 3
  invAt(0).horror = 2

  runDebug(state, 0, { action: 'debug', kind: 'heal', damage: 2, horror: 5, targetSeat: 0 })
  assert.equal(invAt(0).damage, 1)
  assert.equal(invAt(0).horror, 0, '恐惧治疗不能低于 0')
  assert.equal(state.pendingChoice, null, 'heal 不触发窗口')
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}罗兰·班克斯 治疗后：伤害 1，恐惧 0`))

  runDebug(state, 0, { action: 'debug', kind: 'harm', damage: 2, horror: 1, targetSeat: 0 })
  assert.equal(invAt(0).damage, 3)
  assert.equal(invAt(0).horror, 1)
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}罗兰·班克斯 当前伤害 3、恐惧 1`))

  // 缺省/0 视为不结算该项，全部缺失则拒绝。
  runDebug(state, 0, { action: 'debug', kind: 'heal', damage: 0, horror: 1, targetSeat: 0 })
  assert.equal(invAt(0).horror, 0)

  for (const extra of [{}, { damage: 0, horror: 0 }, { damage: -1 }, { damage: 1.5 }, { horror: 1000 }, { damage: '2' }]) {
    assert.ok(validateMove(state, 0, { action: 'debug', kind: 'heal', targetSeat: 0, ...extra }),
      `heal 应拒绝：${JSON.stringify(extra)}`)
    assert.ok(validateMove(state, 0, { action: 'debug', kind: 'harm', targetSeat: 0, ...extra }),
      `harm 应拒绝：${JSON.stringify(extra)}`)
  }
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'heal', damage: 1, targetSeat: 9 }))
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'harm', damage: 1, targetSeat: 9 }))
  invAt(1).defeated = true
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'harm', damage: 1, targetSeat: 1 }))
})

test('doom：直接调整毁灭并钳制到 0，不自动结算密谋', () => {
  const state = newGame('debug-doom')
  const agendaIndex = state.agendaIndex
  const logStart = state.log.length

  runDebug(state, 0, { action: 'debug', kind: 'doom', amount: 2 })
  assert.equal(state.doom, 2)
  assert.equal(state.agendaIndex, agendaIndex, '不自动推进密谋')
  assert.equal(state.status, 'playing')
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}毁灭 \\+2（当前 2；手动调整，未自动结算密谋）`))

  runDebug(state, 1, { action: 'debug', kind: 'doom', amount: -5 })
  assert.equal(state.doom, 0, '毁灭不能低于 0')
  runDebug(state, 0, { action: 'debug', kind: 'doom', amount: 999 })
  assert.equal(state.doom, 999)
  assert.equal(state.agendaIndex, agendaIndex)

  for (const amount of [0, 1.5, 1000, -1000, '2', undefined]) {
    assert.ok(validateMove(state, 0, { action: 'debug', kind: 'doom', amount }), `非法毁灭数量应被拒绝：${amount}`)
  }
})

test('card：目标区域 deckTop / deckBottom / discard / hand，同卡不会凭空多一份', () => {
  const state = newGame('debug-card-zones')
  const invAt = seat => state.investigators[seat]
  const CODE = '01025' // 致命打击（技能卡，非永久）
  const strip = () => {
    const inv = invAt(0)
    inv.hand = inv.hand.filter(code => code !== CODE)
    inv.deck = inv.deck.filter(code => code !== CODE)
    inv.discard = inv.discard.filter(code => code !== CODE)
  }
  strip()

  runDebug(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0, zone: 'deckTop' })
  assert.equal(invAt(0).deck.at(-1), CODE, 'deckTop 应放数组末尾（下一次抽牌抽到）')
  assert.equal(cardCopies(state, CODE), 1)

  runDebug(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0, zone: 'deckBottom' })
  assert.equal(invAt(0).deck[0], CODE, 'deckBottom 应放数组开头')
  assert.notEqual(invAt(0).deck.at(-1), CODE)
  assert.equal(cardCopies(state, CODE), 1)

  runDebug(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0, zone: 'discard' })
  assert.equal(invAt(0).discard.includes(CODE), true)
  assert.equal(invAt(0).deck.includes(CODE), false)
  assert.equal(cardCopies(state, CODE), 1)

  runDebug(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0 })
  assert.equal(invAt(0).hand.includes(CODE), true)
  assert.equal(cardCopies(state, CODE), 1)
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}将「致命打击」放入 罗兰·班克斯 的手牌`))

  // 缺省 hand 仍拒绝「手牌已有」；显式其它区域则允许把这张牌从手牌挪走。
  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0 }),
    '目标手牌中已有这张牌')
  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0, zone: 'discard' }), null)
  runDebug(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0, zone: 'discard' })
  assert.equal(invAt(0).hand.includes(CODE), false)
  assert.equal(invAt(0).discard.includes(CODE), true)
  assert.equal(cardCopies(state, CODE), 1)
  assert.match(state.log.join('\n'), new RegExp(`${DEBUG_LOG}将「致命打击」放入 罗兰·班克斯 的弃牌堆`))

  // 未知区域拒绝。
  assert.ok(validateMove(state, 0, { action: 'debug', kind: 'card', code: CODE, targetSeat: 0, zone: 'limbo' }))
})

test('harm 致命伤害产生普通待决窗口，settle 后仍能继续调试与结算', () => {
  const state = newGame('debug-harm-lethal')
  // 03310「死里逃生」是对 wouldDefeat 的快速事件：放进手牌即可稳定构造普通待决窗口。
  state.investigators[0].hand.push('03310')
  const actionLogLength = state.actionLog.length
  const logStart = state.log.length

  assert.equal(validateMove(state, 0, { action: 'debug', kind: 'harm', damage: 99, targetSeat: 0 }), null)
  applyMove(state, 0, { action: 'debug', kind: 'harm', damage: 99, targetSeat: 0 })
  assert.ok(state.pendingChoice, '致命伤害应打开普通待决窗口')
  assert.equal(state.pendingChoice.seat, 0)
  settle(state)

  assert.equal(state.investigators[0].defeated, true)
  assert.equal(state.status, 'playing', '还有存活调查员，对局继续')
  assert.ok(state.actionLog.slice(actionLogLength).some(entry => entry.move.action === 'debug'
    && entry.move.kind === 'harm'), 'actionLog 应记录 debug harm')
  assert.match(textLog(state, logStart), new RegExp(`${DEBUG_LOG}罗兰·班克斯 当前伤害 99、恐惧 0`))

  // 待决窗口结算后仍可继续调试（另一个座位）。
  const revision = state.revision
  runDebug(state, 1, { action: 'debug', kind: 'resources', amount: 1, targetSeat: 1 })
  assert.ok(state.revision > revision)
})

test('v1.1 指令随 actionLog 重放（verifyReplay）', () => {
  const state = newGame('debug-v11-replay')
  runDebug(state, 1, { action: 'debug', kind: 'draw', amount: 2, targetSeat: 1 })
  runDebug(state, 0, { action: 'debug', kind: 'actions', amount: 1, targetSeat: 0 })
  runDebug(state, 0, { action: 'debug', kind: 'heal', damage: 2, targetSeat: 0 })
  runDebug(state, 0, { action: 'debug', kind: 'harm', horror: 1, targetSeat: 1 })
  runDebug(state, 0, { action: 'debug', kind: 'doom', amount: 2 })
  runDebug(state, 0, { action: 'debug', kind: 'reveal', all: true })
  runDebug(state, 0, { action: 'debug', kind: 'card', code: '01025', targetSeat: 1, zone: 'deckTop' })

  const replay = verifyReplay(state)
  assert.equal(replay.ok, true, `v1.1 调试动作重放应一致：${JSON.stringify(replay.differences)}`)
  assert.ok(replay.moves >= 7)
})
