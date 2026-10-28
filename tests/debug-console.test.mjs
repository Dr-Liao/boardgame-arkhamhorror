// 诡镇奇谈 Mod · 调试控制台服务端解析层回归（契约：artifacts/debug-console/CONTRACT.md §4/§5/§10）。
//
// 覆盖：
//   §5 基础 7 条指令（跳到 / 生成 / 消灭 / 发卡 / 经验 / 资源 / 线索）+ 帮助 + 中英文别名 +
//     名称匹配歧义/未知目标报错 + targetSeat 缺省与非法 + pendingChoice 拒绝 + 解析只读；
//   §10 v1.1 新指令（抽牌 / 行动点 / 传送到 / 治疗 / 受到伤害恐惧 / 揭示 / 毁灭 / 状态 / 重开本关 /
//     发卡到牌库顶·底·弃牌堆）+ 帮助文本覆盖 + 数量/地点参数校验。
// 每个用例都走真实建局（createGameState + settle），先 buildDebugCommand 解析，再 applyMove
// 提交，断言权威状态与 message；不依赖大厅 HTTP。
//
// 卡号/名称字面量只出现在测试文件里（architecture-guard 允许）。

import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove } from '../src/engine/engine.js'
import { settle } from './core-fixture.mjs'
import { buildDebugCommand } from '../src/integration/debug-console.js'
import mod from '../index.js'

const SETTINGS = Object.freeze({
  campaignId: 'nightOfTheZealot',
  playerInvestigator: '01001',
  seed: 'debug-console-test',
  legacyAutoStart: true,
  seatInvestigators: ['01001', '01002'],
})
const PLAYERS = [{ seat: 0, role: 'human' }, { seat: 1 }]

function newGame() {
  const state = createGameState({ ...SETTINGS }, PLAYERS)
  settle(state)
  assert.equal(state.status, 'playing')
  assert.equal(state.pendingChoice, null)
  return state
}

function parse(state, text, targetSeat) {
  return buildDebugCommand({ state }, 0, targetSeat === undefined ? { text } : { text, targetSeat })
}

// 解析 → applyMove → 结算衍生窗口（例如「敌人被击败后」反应）。
function run(state, text, targetSeat) {
  const plan = parse(state, text, targetSeat)
  assert.ok(plan.move, `指令「${text}」应产生 move`)
  const events = applyMove(state, 0, plan.move)
  settle(state)
  return { ...plan, events }
}

// 第二关（午夜假面）在开局就放置了 9 个地点（含未揭示地点），供地点相关指令使用。
function gameAtMidnightMasks() {
  const state = newGame()
  run(state, '跳到 2')
  assert.equal(state.scenario.id, 'theMidnightMasks')
  return state
}

const hasDebugInfo = events => events.some(event => event?.type === 'info' && String(event.text || '').includes('调试'))

// —— 帮助 ——

test('帮助：返回中文多行帮助（move 为 null），中英文别名都可用且不改状态', () => {
  const state = newGame()
  const snapshot = JSON.stringify(state)
  const { move, message } = parse(state, '帮助')
  assert.equal(move, null)
  for (const word of ['跳到', '生成', '消灭', '发', '经验', '资源', '线索', '帮助']) {
    assert.ok(message.includes(word), `帮助文本缺少「${word}」`)
  }
  assert.ok(message.split('\n').length >= 8, '帮助文本应为多行')
  for (const alias of ['help', 'HELP', '?', '？', '指令', '帮助？']) {
    assert.equal(parse(state, alias).move, null, `别名 ${alias} 应返回帮助`)
  }
  assert.equal(JSON.stringify(state), snapshot, '帮助不得修改状态')
})

// —— 1. 跳到 ——

test('跳到：按 1 起始序号跳关，写回场景与 campaign 流程并记入 actionLog', () => {
  const state = newGame()
  const { move, message } = run(state, '跳到 2')
  assert.deepEqual(move, { action: 'debug', kind: 'scenario', scenarioId: 'theMidnightMasks' })
  assert.match(message, /第 2 关/)
  assert.match(message, /午夜假面/)
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.equal(state.campaign.scenarioIndex, 1)
  assert.equal(state.campaign.flow.nodeId, 'masks')
  assert.equal(state.actionLog.at(-1).move.kind, 'scenario')
})

test('跳到：支持别名 / 关卡 ID / 中英文名称与「第 N 关」写法', () => {
  const state = newGame()
  assert.equal(parse(state, '跳关 1').move.scenarioId, 'theGathering')
  assert.equal(parse(state, 'jump 3').move.scenarioId, 'theDevourerBelow')
  assert.equal(parse(state, 'goto theMidnightMasks').move.scenarioId, 'theMidnightMasks')
  assert.equal(parse(state, 'scenario theGathering').move.scenarioId, 'theGathering')
  assert.equal(parse(state, '跳到 午夜假面').move.scenarioId, 'theMidnightMasks')
  assert.equal(parse(state, '跳到第二关').move.scenarioId, 'theMidnightMasks')
  assert.equal(parse(state, '跳到 midnight masks').move.scenarioId, 'theMidnightMasks')
  assert.equal(state.scenario.id, 'theGathering', '只解析不提交时不得改状态')
})

test('跳到：未知关卡编号 / 名称歧义时报错并列出候选', () => {
  const state = newGame()
  assert.throws(() => parse(state, '跳到 9'), /共 3 关|没有第 9 关/)
  assert.throws(() => parse(state, '跳到 不存在的关卡'), /没有找到关卡/)
  assert.throws(() => parse(state, '跳到 夜之狂热'), error => {
    for (const id of ['theGathering', 'theMidnightMasks', 'theDevourerBelow']) {
      assert.ok(error.message.includes(id), `歧义候选应包含 ${id}`)
    }
    return true
  })
})

// —— 2. 生成 ——

test('生成：按中文名在目标地点生成敌人并交战，事件写对局日志', () => {
  const state = newGame()
  const { move, message, events } = run(state, '生成 食尸鬼爪牙')
  assert.equal(move.kind, 'spawn')
  assert.equal(move.targetSeat, 0)
  assert.equal(state.enemies.length, 1)
  const enemy = state.enemies[0]
  assert.equal(enemy.name, '食尸鬼爪牙')
  assert.equal(enemy.engagedSeat, 0)
  assert.equal(enemy.location, 'study')
  assert.match(message, /食尸鬼爪牙/)
  assert.match(message, /书房/)
  assert.ok(hasDebugInfo(events), '生成应写「🛠️ 调试：」info 事件')
})

test('生成：支持卡号 / 英文名 / 目标座位，targetSeat 缺省为调用者', () => {
  const state = newGame()
  const byCode = parse(state, '生成 01159')
  assert.equal(byCode.move.kind, 'spawn')
  assert.equal(byCode.move.targetSeat, 0)
  const toSeat1 = run(state, 'addEnemy Ghoul Minion', 1)
  assert.equal(toSeat1.move.targetSeat, 1)
  const enemy = state.enemies.find(item => item.name === '食尸鬼爪牙')
  assert.ok(enemy)
  assert.equal(enemy.engagedSeat, 1)
  assert.equal(enemy.location, state.investigators[1].location)
})

test('生成：同名多候选敌人报错并列出带 code 的候选', () => {
  const state = newGame()
  assert.throws(() => parse(state, '生成 食尸鬼'), error => {
    assert.match(error.message, /不唯一/)
    assert.ok(error.message.includes('ghoulPriest'), '候选应含规则别名/卡号')
    assert.ok(error.message.includes('ghoulMinion'))
    return true
  })
})

test('生成：未知敌人 / 非法目标座位 / 已败退目标都拒绝', () => {
  const state = newGame()
  assert.throws(() => parse(state, '生成 不存在的敌人xyz'), /没有找到敌人/)
  assert.throws(() => parse(state, '生成 鼠群', 9), /目标座位无效/)
  assert.throws(() => parse(state, '生成 鼠群', 'abc'), /目标座位无效/)
  state.investigators[1].defeated = true
  assert.throws(() => parse(state, '生成 鼠群', 1), /无效的目标调查员/)
})

// —— 3. 消灭 ——

test('消灭：按名称/别名消灭场上敌人', () => {
  const state = newGame()
  run(state, '生成 食尸鬼爪牙')
  assert.equal(state.enemies.length, 1)
  const { move, message, events } = run(state, '消灭 食尸鬼爪牙')
  assert.equal(move.kind, 'defeat')
  assert.equal(move.enemyIds.length, 1)
  assert.equal(state.enemies.length, 0)
  assert.match(message, /食尸鬼爪牙/)
  // 击败会先开「敌人被击败后」反应窗口，调试 info 在窗口结算后写入；这里断言已产生击败日志。
  assert.ok(events.some(event => event?.type === 'info' && String(event.text || '').includes('被击败')))
  // 后续 settle 会追加 choose 动作，所以调试动作要整段 actionLog 里找，而不是只看最后一条。
  assert.ok(state.actionLog.some(entry => entry.move?.action === 'debug' && entry.move.kind === 'defeat'))
})

test('消灭：支持英文/规则名与「消灭全部」清场', () => {
  const state = newGame()
  run(state, '生成 食尸鬼爪牙')
  run(state, '生成 鼠群')
  assert.equal(state.enemies.length, 2)
  const all = run(state, 'kill all')
  assert.deepEqual(all.move, { action: 'debug', kind: 'defeat', all: true })
  assert.equal(state.enemies.length, 0)
  assert.match(all.message, /2 个敌人/)

  // 再次生成后按英文名击杀；击杀反应窗口在 run 里已结算。
  run(state, '生成 Ghoul Minion')
  const kill = run(state, '击杀 Ghoul Minion')
  assert.equal(kill.move.kind, 'defeat')
  assert.equal(state.enemies.length, 0)
})

test('消灭：空场 / 同名多类型歧义 / 未知目标报错', () => {
  const state = newGame()
  assert.throws(() => parse(state, '消灭 食尸鬼爪牙'), /场上没有找到敌人/)
  assert.throws(() => parse(state, '消灭全部'), /场上没有敌人/)
  // 02090 与 05266 都叫「夜鹰」：同名不同卡时列出候选（带 code）。
  run(state, '生成 02090')
  run(state, '生成 05266')
  assert.throws(() => parse(state, '消灭 夜鹰'), error => {
    assert.match(error.message, /不唯一/)
    assert.ok(error.message.includes('02090'))
    assert.ok(error.message.includes('05266'))
    return true
  })
})

// —— 4. 发卡 ——

test('发卡：按名称把卡牌发到默认手牌（同名重印优先当前战役卡包）', () => {
  const state = newGame()
  const { move, message } = run(state, '发 手电筒 到手上')
  assert.equal(move.kind, 'card')
  assert.equal(move.code, '01087', '手电筒应解析到当前战役卡包（core）的 01087')
  assert.equal(move.targetSeat, 0)
  assert.ok(state.investigators[0].hand.includes('01087'))
  assert.match(message, /手电筒/)
})

test('发卡：支持卡号 / 英文名 / 目标座位，牌库副本会先移走一张', () => {
  const state = newGame()
  const byCode = run(state, '发卡 01025')
  assert.equal(byCode.move.code, '01025')
  assert.ok(state.investigators[0].hand.includes('01025'))
  const toSeat1 = run(state, 'give Flashlight', 1)
  assert.equal(toSeat1.move.targetSeat, 1)
  assert.ok(state.investigators[1].hand.includes('01087'))
  // 01016 起始在牌库里（不在手上）：发到手牌后同一张牌在手上+牌库里的总数保持为牌组里的份数。
  run(state, '发 01016 到手上')
  const held = state.investigators[0].hand.filter(code => code === '01016').length
  const decked = state.investigators[0].deck.filter(code => code === '01016').length
  assert.equal(held, 1)
  assert.equal(held + decked, 2, '同一张卡在手上+牌库里的总数保持为牌组里的份数')
})

test('发卡：同名多张 / 未知卡 / 非玩家卡 / 手牌已有都报错', () => {
  const state = newGame()
  assert.throws(() => parse(state, '发 放大镜 到手上'), error => {
    assert.ok(error.message.includes('01030'))
    assert.ok(error.message.includes('01040'))
    return true
  })
  assert.throws(() => parse(state, '发 不存在的卡牌xyz 到手上'), /没有找到卡牌/)
  assert.throws(() => parse(state, '发 01001 到手上'), /不是可加入手牌的卡牌/)
  run(state, '发 01025 到手上')
  assert.throws(() => parse(state, '发 01025 到手上'), /目标手牌中已有这张牌/)
})

// —— 5. 经验 ——

test('经验：按数量给目标座位加经验并写入战役记录', () => {
  const state = newGame()
  const { move, message, events } = run(state, '给 3 经验')
  assert.deepEqual(move, { action: 'debug', kind: 'xp', amount: 3, targetSeat: 0 })
  assert.equal(state.campaign.investigators[0].xp, 3)
  assert.equal(state.campaign.xp, 3)
  assert.match(message, /3/)
  assert.ok(hasDebugInfo(events), '经验应写「🛠️ 调试：」info 事件')
  run(state, 'xp 2', 1)
  assert.equal(state.campaign.investigators[1].xp, 2)
})

test('经验：数量非法 / 缺少战役记录 / 非法座位报错', () => {
  const state = newGame()
  assert.throws(() => parse(state, '给 0 经验'), /1 到 999/)
  assert.throws(() => parse(state, '给 1000 经验'), /1 到 999/)
  assert.throws(() => parse(state, '给 经验'), /数量/)
  delete state.campaign.investigators[1]
  assert.throws(() => parse(state, 'xp 2', 1), /战役记录/)
  assert.throws(() => parse(state, 'xp 2', 9), /目标座位无效/)
})

// —— 6. 资源 ——

test('资源：按数量加到目标座位（缺省调用者）', () => {
  const state = newGame()
  const before0 = state.investigators[0].resources
  const { move } = run(state, '获得 3 资源')
  assert.deepEqual(move, { action: 'debug', kind: 'resources', amount: 3, targetSeat: 0 })
  assert.equal(state.investigators[0].resources, before0 + 3)
  const before1 = state.investigators[1].resources
  run(state, 'resources 2', 1)
  assert.equal(state.investigators[1].resources, before1 + 2)
  assert.equal(state.investigators[0].resources, before0 + 3, '其他座位不受影响')
})

// —— 7. 线索 ——

test('线索：按数量加到目标座位，公共线索由 applyMove 收敛', () => {
  const state = newGame()
  const { move } = run(state, '获得 2 线索')
  assert.deepEqual(move, { action: 'debug', kind: 'clues', amount: 2, targetSeat: 0 })
  assert.equal(state.investigators[0].clues, 2)
  assert.equal(state.clues, 2)
  run(state, 'clues 1', 1)
  assert.equal(state.investigators[1].clues, 1)
  assert.equal(state.clues, 3)
})

// —— 输入 / 座位 / 指令解析 ——

test('输入清理：成对引号、全角数字与多余空白', () => {
  const state = newGame()
  assert.equal(parse(state, '「跳到 2」').move.scenarioId, 'theMidnightMasks')
  assert.equal(parse(state, '“给 2 经验”').move.amount, 2)
  assert.equal(parse(state, '  获得  １ 资源  ').move.amount, 1)
  assert.equal(parse(state, '发 手电筒 ').move.code, '01087')
})

test('targetSeat：缺省为调用者，数字字符串可用，非法座位被拒绝', () => {
  const state = newGame()
  assert.equal(parse(state, '获得 1 资源').move.targetSeat, 0)
  assert.equal(parse(state, '获得 1 资源', 1).move.targetSeat, 1)
  assert.equal(parse(state, '获得 1 资源', '1').move.targetSeat, 1)
  assert.equal(parse(state, '获得 1 资源', null).move.targetSeat, 0, 'null 视同缺省调用者')
  for (const seat of [9, -1, 1.5, 'abc']) {
    assert.throws(() => parse(state, '获得 1 资源', seat), /目标座位无效/, `座位 ${JSON.stringify(seat)} 应被拒绝`)
  }
})

test('待决选择存在时拒绝调试指令', () => {
  // 不 settle：建局后还有换牌（mulligan）待决窗口。
  const state = createGameState({ ...SETTINGS }, PLAYERS)
  assert.ok(state.pendingChoice, '夹具应存在待决选择')
  assert.throws(() => parse(state, '获得 2 资源'), /待决选择|请先处理/)
})

test('未知指令 / 空指令 / 非法入参给出中文报错', () => {
  const state = newGame()
  assert.throws(() => parse(state, '跳舞'), /未知调试指令/)
  assert.throws(() => parse(state, '跳舞'), /帮助/)
  assert.throws(() => parse(state, '   '), /请输入调试指令/)
  assert.throws(() => buildDebugCommand({}, 0, { text: '帮助' }), /对局状态/)
  assert.throws(() => buildDebugCommand({ state }, 0, null), /格式无效/)
  assert.throws(() => buildDebugCommand({ state }, 'x', { text: '帮助' }), /座位无效/)
})

test('解析器只读：解析全部指令不会修改 session.state', () => {
  const state = newGame()
  const snapshot = JSON.stringify(state)
  for (const text of [
    '帮助', '跳到 2', '生成 食尸鬼爪牙', '消灭全部', '发 01025 到手上', '给 3 经验', '获得 2 资源', '获得 2 线索',
    '抽 2', '行动点 +1', '传送到 书房', '治疗 1', '受到 1 伤害', '揭示 书房', '加毁灭 1', '重开本关',
    '发 01025 到牌库顶', '状态',
  ]) {
    try { parse(state, text) } catch { /* 部分指令在空场/待决条件下会失败，这里只关心不写状态 */ }
  }
  assert.equal(JSON.stringify(state), snapshot)
})

test('英文别名表：spawn/addEnemy/give/xp/resources/clues 都可解析', () => {
  const state = newGame()
  assert.equal(parse(state, 'spawn 鼠群').move.kind, 'spawn')
  assert.equal(parse(state, 'addEnemy 鼠群').move.kind, 'spawn')
  assert.equal(parse(state, 'give 01025').move.kind, 'card')
  assert.equal(parse(state, '经验 1').move.kind, 'xp')
  assert.equal(parse(state, 'resources 1').move.kind, 'resources')
  assert.equal(parse(state, 'clue 1').move.kind, 'clues')
})

// —— Mod 钩子接线 ——

test('index.js：isDebugMove 标记调试动作，debugCommand 转交解析器', () => {
  assert.equal(mod.isDebugMove({ action: 'debug', kind: 'xp' }), true)
  assert.equal(mod.isDebugMove({ action: 'play', cardId: '01025' }), false)
  assert.equal(mod.isDebugMove(null), false)
  const state = newGame()
  const help = mod.debugCommand({ state }, 0, { text: '帮助' })
  assert.equal(help.move, null)
  assert.ok(help.message.includes('跳到'))
  const plan = mod.debugCommand({ state }, 0, { text: '获得 1 资源' })
  assert.deepEqual(plan.move, { action: 'debug', kind: 'resources', amount: 1, targetSeat: 0 })
})

// ===========================================================================
// v1.1 追加批次（CONTRACT §10）：help 可发现性 + 更多调试指令
// ===========================================================================

// —— 帮助文本 ——

test('帮助 v1.1：分组文本覆盖全部新指令与别名', () => {
  const state = newGame()
  const { move, message } = parse(state, '帮助')
  assert.equal(move, null)
  for (const word of [
    '跳到', '重开本关', '生成', '消灭', '发', '抽', '行动点', '传送到',
    '治疗', '受到', '揭示', '毁灭', '状态', '牌库顶', '牌库底', '弃牌堆',
    '经验', '资源', '线索', '帮助',
  ]) {
    assert.ok(message.includes(word), `帮助文本缺少「${word}」`)
  }
  for (const group of ['【关卡】', '【敌人】', '【卡牌 / 手牌】', '【资源 / 经验 / 线索】', '【治疗 / 伤害 / 位置】', '【场景 / 全局】']) {
    assert.ok(message.includes(group), `帮助文本缺少分组 ${group}`)
  }
  assert.ok(message.split('\n').length >= 20, '帮助文本应为分组多行')
})

// —— 抽牌 ——

test('抽牌：默认 1 张、可指定 N 张，牌从牌库进入手牌', () => {
  const state = newGame()
  const before0 = { hand: state.investigators[0].hand.length, deck: state.investigators[0].deck.length }
  const one = run(state, '抽')
  assert.deepEqual(one.move, { action: 'debug', kind: 'draw', amount: 1, targetSeat: 0 })
  assert.equal(state.investigators[0].hand.length, before0.hand + 1)
  assert.equal(state.investigators[0].deck.length, before0.deck - 1)
  assert.match(one.message, /1 张/)
  assert.ok(hasDebugInfo(one.events))
  const before1 = { hand: state.investigators[1].hand.length, deck: state.investigators[1].deck.length }
  const two = run(state, 'draw 2', 1)
  assert.deepEqual(two.move, { action: 'debug', kind: 'draw', amount: 2, targetSeat: 1 })
  assert.equal(state.investigators[1].hand.length, before1.hand + 2)
  assert.equal(state.investigators[1].deck.length, before1.deck - 2)
  assert.ok(state.actionLog.some(entry => entry.move?.action === 'debug' && entry.move.kind === 'draw'))
})

// —— 行动点 ——

test('行动点：行动点 +N / 给 N 行动点 / actions 都增加行动点', () => {
  const state = newGame()
  const before0 = state.investigators[0].actionsLeft
  const plus = run(state, '行动点 +2')
  assert.deepEqual(plus.move, { action: 'debug', kind: 'actions', amount: 2, targetSeat: 0 })
  assert.equal(state.investigators[0].actionsLeft, before0 + 2)
  assert.match(plus.message, /行动点/)
  const before1 = state.investigators[1].actionsLeft
  const viaGive = run(state, '给 3 行动点', 1)
  assert.deepEqual(viaGive.move, { action: 'debug', kind: 'actions', amount: 3, targetSeat: 1 })
  assert.equal(state.investigators[1].actionsLeft, before1 + 3)
  assert.equal(parse(state, 'actions 1').move.kind, 'actions')
  assert.equal(parse(state, '行动 +1').move.kind, 'actions')
})

// —— 传送到 ——

test('传送到：按地点名/ID 移动目标调查员（含别名）', () => {
  const state = gameAtMidnightMasks()
  const rivertown = state.locations.find(location => location.id === 'rivertown')
  assert.ok(rivertown, '第二关应放置河岸城')
  const { move, message, events } = run(state, `传送到 ${rivertown.name}`)
  assert.deepEqual(move, { action: 'debug', kind: 'moveTo', locationId: 'rivertown', targetSeat: 0 })
  assert.equal(state.investigators[0].location, 'rivertown')
  assert.ok(message.includes(rivertown.name))
  assert.ok(hasDebugInfo(events))
  // 英文别名 / 地点 ID / 目标座位
  const viaTravel = run(state, `travel ${rivertown.id}`, 1)
  assert.deepEqual(viaTravel.move, { action: 'debug', kind: 'moveTo', locationId: 'rivertown', targetSeat: 1 })
  assert.equal(state.investigators[1].location, 'rivertown')
  for (const text of [`移动到 ${rivertown.name}`, `去 ${rivertown.id}`, `teleport ${rivertown.id}`]) {
    assert.equal(parse(state, text).move.kind, 'moveTo', `${text} 应解析为 moveTo`)
  }
})

test('地点匹配：未知地点 / 歧义地点报错并列出候选', () => {
  const state = gameAtMidnightMasks()
  assert.throws(() => parse(state, '传送到 不存在的城市'), /没有找到地点/)
  assert.throws(() => parse(state, '揭示 不存在的城市'), /没有找到地点/)
  assert.throws(() => parse(state, '传送到 区'), error => {
    assert.match(error.message, /不唯一/)
    assert.ok(/南区|商业区|东城区/.test(error.message), '歧义候选应列出地点名与 id')
    return true
  })
})

// —— 治疗 ——

test('治疗：同时治疗伤害与恐惧，也支持只治单项与别名', () => {
  const state = newGame()
  state.investigators[0].damage = 3
  state.investigators[0].horror = 2
  const both = run(state, '治疗 2')
  assert.deepEqual(both.move, { action: 'debug', kind: 'heal', targetSeat: 0, damage: 2, horror: 2 })
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 0)
  state.investigators[0].damage = 3
  state.investigators[0].horror = 3
  const damageOnly = run(state, '治疗伤害 2')
  assert.deepEqual(damageOnly.move, { action: 'debug', kind: 'heal', targetSeat: 0, damage: 2 })
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 3)
  const horrorOnly = run(state, 'healhorror 2')
  assert.deepEqual(horrorOnly.move, { action: 'debug', kind: 'heal', targetSeat: 0, horror: 2 })
  assert.equal(state.investigators[0].horror, 1)
  // 不会把伤害/恐惧治成负数
  run(state, '回复 10')
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].horror, 0)
  assert.equal(parse(state, '回复生命 1').move.damage, 1)
  assert.equal(parse(state, '回复理智 1').move.horror, 1)
  assert.equal(parse(state, 'heal 1').move.damage, 1)
})

// —— 受到伤害 / 恐惧 ——

test('受到伤害/恐惧：直接加值并支持中英文写法', () => {
  const state = newGame()
  const before0 = { damage: state.investigators[0].damage, horror: state.investigators[0].horror }
  const before1 = { horror: state.investigators[1].horror }
  const damage = run(state, '受到 2 伤害')
  assert.deepEqual(damage.move, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 2 })
  assert.equal(state.investigators[0].damage, before0.damage + 2)
  assert.equal(state.investigators[0].horror, before0.horror, '这条指令不应同时增加恐惧')
  const horror = run(state, '受惊 1', 1)
  assert.deepEqual(horror.move, { action: 'debug', kind: 'harm', targetSeat: 1, horror: 1 })
  assert.equal(state.investigators[1].horror, before1.horror + 1)
  assert.equal(parse(state, '受伤 3').move.damage, 3)
  assert.equal(parse(state, '受到 2 恐惧').move.horror, 2)
  assert.equal(parse(state, 'take 2 damage').move.damage, 2)
  assert.equal(parse(state, 'take 2 horror').move.horror, 2)
  assert.throws(() => parse(state, '受到 2'), /伤害还是恐惧/)
})

// —— 揭示 ——

test('揭示：揭示指定未揭示地点或揭示全部（reveal all）', () => {
  const state = gameAtMidnightMasks()
  const hidden = state.locations.find(location => !location.revealed)
  assert.ok(hidden, '第二关开局应有未揭示地点')
  const { move, message, events } = run(state, `揭示 ${hidden.name}`)
  assert.deepEqual(move, { action: 'debug', kind: 'reveal', locationId: hidden.id })
  assert.equal(state.locations.find(location => location.id === hidden.id).revealed, true)
  assert.ok(message.includes(hidden.name))
  assert.ok(hasDebugInfo(events))
  const all = run(state, 'reveal all')
  assert.deepEqual(all.move, { action: 'debug', kind: 'reveal', all: true })
  assert.ok(state.locations.every(location => location.revealed), '揭示全部后不应还有未揭示地点')
  // 已经揭示过的地点再单独揭示：引擎拒绝
  assert.throws(() => parse(state, `揭示 ${hidden.name}`), /已经揭示/)
  // 「揭示全部」本身也是完整别名
  assert.deepEqual(parse(state, '揭示全部').move, { action: 'debug', kind: 'reveal', all: true })
})

// —— 毁灭 ——

test('毁灭：加/减/doom 有符号调整，且不会自动推进密谋', () => {
  const state = newGame()
  assert.equal(state.doom, 0)
  const add = run(state, '加毁灭 2')
  assert.deepEqual(add.move, { action: 'debug', kind: 'doom', amount: 2 })
  assert.equal(state.doom, 2)
  assert.ok(hasDebugInfo(add.events))
  const sub = run(state, '减毁灭 3')
  assert.deepEqual(sub.move, { action: 'debug', kind: 'doom', amount: -3 })
  assert.equal(state.doom, 0)
  run(state, 'doom +2')
  assert.equal(state.doom, 2)
  run(state, 'doom -1')
  assert.equal(state.doom, 1)
  const agendaIndex = state.agendaIndex
  run(state, '加毁灭 4') // 毁灭 5 已超过议程阈值 3，但调试指令不自动结算密谋
  assert.equal(state.doom, 5)
  assert.equal(state.agendaIndex, agendaIndex)
})

// —— 状态 ——

test('状态：多行摘要（场景/轮次/幕/密谋/调查员/敌人/线索/毁灭）且只读', () => {
  const state = newGame()
  run(state, '生成 食尸鬼爪牙')
  const snapshot = JSON.stringify(state)
  const { move, message } = parse(state, '状态')
  assert.equal(move, null)
  for (const word of ['场景', '轮次', '阶段', '幕', '密谋', '调查员', '敌人', '线索', '毁灭', '罗兰·班克斯', '食尸鬼爪牙']) {
    assert.ok(message.includes(word), `状态摘要缺少「${word}」`)
  }
  assert.ok(message.split('\n').length >= 8, '状态摘要应为多行')
  assert.equal(JSON.stringify(state), snapshot, '状态摘要不得修改对局状态')
  assert.equal(parse(state, 'info').move, null)
  assert.equal(parse(state, 'status').move, null)
})

// —— 重开本关 ——

test('重开本关：等价跳到当前关卡并写 actionLog', () => {
  const state = newGame()
  const scenarioId = state.scenario.id
  const { move, message } = run(state, '重开本关')
  assert.deepEqual(move, { action: 'debug', kind: 'scenario', scenarioId })
  assert.equal(state.scenario.id, scenarioId)
  assert.match(message, /重开本关/)
  assert.ok(state.actionLog.some(entry =>
    entry.move?.action === 'debug' && entry.move.kind === 'scenario' && entry.move.scenarioId === scenarioId))
  assert.equal(parse(state, 'restart').move.scenarioId, scenarioId)
  assert.equal(parse(state, '重新开始本关').move.scenarioId, scenarioId)
})

// —— 发卡到牌库顶 / 底 / 弃牌堆 ——

test('发卡：可指定牌库顶 / 牌库底 / 弃牌堆，且不会凭空多出一份', () => {
  {
    const state = newGame()
    const { move, message } = run(state, '发 01025 到牌库顶')
    assert.deepEqual(move, { action: 'debug', kind: 'card', code: '01025', targetSeat: 0, zone: 'deckTop' })
    assert.equal(state.investigators[0].deck.at(-1), '01025', '牌库数组末尾 = 牌库顶')
    assert.ok(!state.investigators[0].hand.includes('01025'))
    assert.match(message, /牌库顶/)
    // 同一张再放到牌库顶：先从原区移走，不会变成两张
    run(state, '发 01025 到牌库顶')
    assert.equal(state.investigators[0].deck.filter(code => code === '01025').length, 1)
  }
  {
    const state = newGame()
    const { move } = run(state, '发卡 01025 到牌库底')
    assert.equal(move.zone, 'deckBottom')
    assert.equal(state.investigators[0].deck[0], '01025', '牌库数组开头 = 牌库底')
  }
  {
    const state = newGame()
    const { move } = run(state, 'give 01025 到弃牌堆')
    assert.equal(move.zone, 'discard')
    assert.ok(state.investigators[0].discard.includes('01025'))
  }
  // 缺省仍是手牌，move 不带 zone（§3.1 语义不变）
  assert.equal(parse(newGame(), '发 01025 到手上').move.zone, undefined)
})

// —— v1.1 别名 / 参数校验 ——

test('v1.1 别名：抽牌/摸牌/draw、actions、去/travel/reveal/healhorror/take 等', () => {
  const state = gameAtMidnightMasks()
  const home = state.locations[0]
  assert.deepEqual(parse(state, '抽牌 2').move, { action: 'debug', kind: 'draw', amount: 2, targetSeat: 0 })
  assert.deepEqual(parse(state, '摸牌').move, { action: 'debug', kind: 'draw', amount: 1, targetSeat: 0 })
  assert.equal(parse(state, 'draw 3').move.amount, 3)
  assert.equal(parse(state, 'actions 1').move.kind, 'actions')
  assert.equal(parse(state, `去 ${home.name}`).move.locationId, home.id)
  assert.equal(parse(state, `travel ${home.id}`).move.locationId, home.id)
  assert.equal(parse(state, 'reveal all').move.all, true)
  assert.equal(parse(state, 'healhorror 1').move.horror, 1)
  assert.equal(parse(state, '回复理智 2').move.horror, 2)
  assert.equal(parse(state, 'take 1 damage').move.damage, 1)
  assert.equal(parse(state, 'doom -2').move.amount, -2)
})

test('v1.1 参数校验：非法数量 / 缺少类型 / 未知卡牌与地点', () => {
  const state = newGame()
  assert.throws(() => parse(state, '抽 0'), /1 到 999/)
  assert.throws(() => parse(state, '抽 1000'), /1 到 999/)
  assert.throws(() => parse(state, '行动点'), /数量/)
  assert.throws(() => parse(state, '治疗 0'), /1 到 999/)
  assert.throws(() => parse(state, '加毁灭 0'), /1 到 999/)
  assert.throws(() => parse(state, '减毁灭 1000'), /1 到 999/)
  assert.throws(() => parse(state, '受到 2'), /伤害还是恐惧/)
  assert.throws(() => parse(state, '揭示'), /揭示全部/)
  assert.throws(() => parse(state, '发 01025 到火星'), /没有找到卡牌/)
  const noScenario = newGame()
  noScenario.scenario = undefined
  assert.throws(() => parse(noScenario, '重开本关'), /没有进行中的关卡/)
})
