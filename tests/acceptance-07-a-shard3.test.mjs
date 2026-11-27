// 验收 07-a 分片 3（itd《深陷其中》07108–07151）逐卡证据补充。
//
// 覆盖既有证据不足/标题缺卡号的 7 张：07117、07118、07119、07126、07141、07148、07123
// （07123 是 scenario 参考卡，原有用例 `tic-scenario-reference-final.test.mjs` 只按文件级引用；
//  其余 37 张复用既有 TIC 用例并已在本次重跑中通过）。
//
// 断言口径：真实条目 + 真实章节夹具（chapterFixture('inTooDeep')）+ 真实引擎入口
// （legalMoves → move → resolveTransaction，或真实 turnEnded / performTest 窗口）。
// 主进程合并时需登记进 tests/suites.mjs 与 tests/node-suite.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'

import { chapterFixture } from './tic-chapter-fixture.mjs'
import { asset, enemy, move, settle, legalMoves } from './core-fixture.mjs'
import { actionKind, moveCost, performTest, revealLocation, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { effectiveFloodLevel } from '../src/engine/flood.js'
import { gridPosition, gridLocations } from '../src/cards/encounter-entries/_shared.js'
import pulledBack07148 from '../src/cards/encounter-entries/theInnsmouthConspiracy/inTooDeep/07148.js'

const itd = (count = 1) => chapterFixture('inTooDeep', count)

// 让下一次混乱标记揭示命中指定符号（与既有 TIC 用例同一确定性手法：搜索 rngState 种子）。
import { randomValue } from '../src/engine/rules-state.js'
function forceFirstToken(state, face) {
  const index = state.chaosBag.indexOf(face)
  assert.ok(index >= 0, `混乱袋里应有 ${face}`)
  for (let seed = 0; seed < 10000; seed++) {
    if (Math.floor(randomValue({ rngState: seed }) * state.chaosBag.length) === index) {
      state.rngState = seed
      return
    }
  }
  throw new Error('找不到可命中该标记的种子')
}

// ---------------------------------------------------------------- 07117 / 07118 / 07119
// 三张“诅咒法术”共用 `playerTools.testWithTokenBenefits` 原语：花 1 充能、按意志结算、
// 检定中揭示 curse 时二选一（补 1 充能 / 额外效果）。逐卡断言各自印刷差异。

function spellFixture(code) {
  const state = itd(1)
  const inv = state.investigators[0]
  inv.willpower = 4
  inv.combat = 1
  inv.intellect = 1
  inv.agility = 1
  const location = state.locations.find(item => item.id === inv.location)
  location.revealed = true
  location.clues = 3
  const card = asset(state, code)
  return { state, inv, location, card }
}

test('07117 哈米吉多顿：花 1 充能用意志攻击并造成 +1 伤害；揭示诅咒可补 1 充能', () => {
  const { state, inv, card } = spellFixture('07117')
  const target = enemy(state, { code: '07146', originalCode: '07146', name: '测试深潜者', fight: 1, health: 8, damageTaken: 0 })
  state.chaosBag = ['0']
  const command = legalMoves(state).find(item => item.action === 'ability' && item.assetId === card.id)
  assert.ok(command, '07117 的 [action] 攻击应出现在 legalMoves')
  move(state, command)
  settle(state)
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(after.damageTaken, 2, '基础 1 + 卡面 +1 = 2')
  assert.equal(state.investigators[0].assets.find(item => item.id === card.id).uses, 2, '花费 1 充能（3→2）')
  assert.equal(state.investigators[0].damage, 0)

  // 揭示 curse：可选「补 1 充能」，充能回到 3。
  const curse = spellFixture('07117')
  const curseTarget = enemy(curse.state, { code: '07146', originalCode: '07146', name: '测试深潜者', fight: 1, health: 8, damageTaken: 0 })
  curse.state.chaosBag = ['curse', '0']
  forceFirstToken(curse.state, 'curse')
  const cursed = legalMoves(curse.state).find(item => item.action === 'ability' && item.assetId === curse.card.id)
  move(curse.state, cursed)
  settle(curse.state, choice => choice.kind === 'effect' && String(choice.prompt || '').includes('诅咒')
    ? choice.options.find(option => option.id === 'charge')?.id : null)
  assert.equal(curse.state.investigators[0].assets.find(item => item.id === curse.card.id).uses, 3, '揭示诅咒后补 1 充能回到 3')
  assert.equal(curse.state.enemies.find(item => item.id === curseTarget.id).damageTaken, 2)
})

test('07118 混乱之眼：花 1 充能用意志调查并额外发现 1 线索', () => {
  const { state, inv, location, card } = spellFixture('07118')
  state.chaosBag = ['0']
  const command = legalMoves(state).find(item => item.action === 'ability' && item.assetId === card.id)
  assert.ok(command, '07118 的 [action] 调查应出现在 legalMoves')
  move(state, command)
  settle(state)
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.lastTestResult.value, inv.willpower, '本次调查使用意志值而非智力')
  assert.equal(state.investigators[0].clues, 2, '成功发现 1 + 卡面额外 1')
  assert.equal(state.investigators[0].assets.find(item => item.id === card.id).uses, 2)
  assert.ok(location.clues <= 3)
})

test('07119 暗影遁形：花 1 充能用意志躲避；成功后可移动非精英敌人', () => {
  const { state, card } = spellFixture('07119')
  const inv = state.investigators[0]
  const target = enemy(state, { code: '07146', originalCode: '07146', name: '测试深潜者', evade: 1, elite: false, exhausted: false })
  state.chaosBag = ['0']
  const command = legalMoves(state).find(item => item.action === 'ability' && item.assetId === card.id)
  assert.ok(command, '07119 的 [action] 躲避应出现在 legalMoves')
  move(state, command)
  settle(state)
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.lastTestResult.value, inv.willpower, '本次躲避使用意志值而非敏捷')
  assert.equal(after.exhausted, true, '躲避成功横置敌人')
  assert.equal(state.investigators[0].assets.find(item => item.id === card.id).uses, 2, '花费 1 充能')
})

// ---------------------------------------------------------------- 07126
// 议程 07126《水漫街道》：回合结束时若位于完全淹没地点，受到 1 伤 1 恐并随机弃 1 张手牌。
// 走真实 endTurn → turnEnded 强制窗口，而不是直接调用描述子。

test('07126 水漫街道：完全淹没地点回合结束受到 1 伤 1 恐并随机弃 1 张手牌', () => {
  const state = itd(1)
  const inv = state.investigators[0]
  state.agendaIndex = state.agendas.findIndex(agenda => (agenda.originalCode || agenda.code) === '07126')
  assert.ok(state.agendaIndex >= 0, '本章应有议程 07126')
  const mech = createMechanicsApi(state)
  mech.water.set(inv.location, 2)
  inv.hand = ['01032', '01033', '01034', '01035']
  for (const each of state.investigators) each.actionsLeft = 0
  const damage = inv.damage; const horror = inv.horror; const hand = inv.hand.length
  move(state, legalMoves(state).find(command => command.action === 'endTurn'))
  settle(state)
  const after = state.investigators[0]
  assert.equal(effectiveFloodLevel(state, after.seat), 2)
  assert.equal(after.damage - damage, 1, '完全淹没：1 点伤害')
  assert.equal(after.horror - horror, 1, '完全淹没：1 点恐惧')
  // 维持阶段会补抽 1 张，所以净变化 = 抽牌 - 随机弃牌。
  assert.equal(hand + 1 - after.hand.length, 1, '随机弃 1 张手牌')
})

// ---------------------------------------------------------------- 07129–07138 / 07140 / 07141

function barrierParleyBoard(code) {
  const state = itd(2)
  const inv = state.investigators[0]
  const location = state.locations.find(item => (item.originalCode || item.code) === code)
  const api = createMechanicsApi(state)
  const neighbor = location.connections.find(id => api.barriers.canPlace(location.id, id))
  assert.ok(neighbor, `${code} 有可放屏障的连接地点`)
  for (const { a, b } of api.barriers.edges(location.id)) api.barriers.set(a, b, 0)
  inv.location = location.id
  inv.hand = ['01088']
  location.revealed = true
  location.clues = 0
  asset(state, '01020')
  const parley = () => legalMoves(state).find(command => command.action === 'entityAbility'
    && command.entityId === location.id && actionKind(state, state.investigators[0], command) === 'parley'
    && /移除1个屏障/.test(command.label))
  return { state, api, location, neighbor, parley }
}

for (const [code, actions, hasTest] of [
  ['07129', 2, true], ['07130', 1, true], ['07131', 0, false], ['07132', 0, false],
  ['07133', 1, false], ['07134', 1, false], ['07135', 2, false], ['07136', 1, false],
  ['07137', 1, true], ['07138', 2, false], ['07140', 1, true], ['07141', 1, false],
]) {
  test(`${code} 屏障谈判在真实地点的合法菜单上显示正确行动费用`, () => {
    const { state, api, location, neighbor, parley } = barrierParleyBoard(code)
    assert.equal(Boolean(parley()), hasTest, '检定仍可尝试，无检定的能力要求已有屏障')
    api.barriers.set(location.id, neighbor, 2)
    const command = parley()
    assert.ok(command, '有屏障后可选择谈判')
    assert.equal(moveCost(state, 0, command), actions)
  })
}

test('07140 以战力或敏捷谈判：成功只移除所选通道的一个屏障，失败保持原数', () => {
  for (const [skill, success] of [['combat', true], ['agility', false]]) {
    const { state, api, location, neighbor, parley } = barrierParleyBoard('07140')
    const second = location.connections.find(id => id !== neighbor && api.barriers.canPlace(location.id, id))
    assert.ok(second)
    api.barriers.set(location.id, neighbor, 2)
    api.barriers.set(location.id, second, 2)
    state.chaosBag = [success ? '0' : 'autofail']
    state.investigators[0][skill] = 5
    const before = state.investigators[0].actionsLeft
    move(state, parley())
    settle(state, pending => pending.kind === 'skill' && pending.source === '07140' ? skill
      : pending.source === location.id && pending.prompt.includes('清除路障') ? '1' : null)
    assert.equal(state.lastTestResult.skill, skill)
    assert.equal(state.lastTestResult.difficulty, 2)
    assert.equal(state.lastTestResult.success, success)
    assert.equal(state.investigators[0].actionsLeft, before - 1)
    assert.equal(api.barriers.count(location.id, neighbor), 2)
    assert.equal(api.barriers.count(location.id, second), success ? 1 : 2)
  }
})

test('07129/07131/07132/07134/07140 公开揭示地点各移动一把未揭示钥匙，重复揭示不再移动', () => {
  const state = itd()
  const api = createMechanicsApi(state)
  const codes = ['07129', '07131', '07132', '07134', '07140']
  const locations = codes.map(code => state.locations.find(item => (item.originalCode || item.code) === code))
  const before = api.keys.at('setAside').length
  for (const location of locations) {
    assert.equal(location.revealed, false)
    revealLocation(state, location.id, [], 0)
    revealLocation(state, location.id, [], 0)
    assert.deepEqual(api.keys.at(`location:${location.id}`), ['unrevealed'])
  }
  assert.equal(api.keys.at('setAside').length, before - codes.length)
})

// ---------------------------------------------------------------- 07141
// 地点 07141《马什精炼厂》：控制钥匙时可自由移动到连接地点；弃 1 张受控支援：谈判，移除 1 个屏障。
// 走真实 legalMoves（地点实体能力）→ move。

test('07141 马什精炼厂：控制钥匙时可自由移动到连接地点；弃支援谈判移除 1 个屏障', () => {
  const state = itd(1)
  const inv = state.investigators[0]
  const refinery = state.locations.find(location => (location.originalCode || location.code) === '07141')
  assert.ok(refinery, '本章应有马什精炼厂 07141')
  inv.location = refinery.id
  refinery.revealed = true
  const neighbor = refinery.connections.find(id => {
    const other = state.locations.find(location => location.id === id)
    return other && (other.originalCode || other.code) !== '07143'
  }) || refinery.connections[0]
  const mech = createMechanicsApi(state)
  mech.keys.transfer('red', 'setAside', `investigator:${inv.seat}`, { reveal: true })
  mech.barriers.set(refinery.id, neighbor, 1)

  // 先做谈判（必须在本地点）：弃掉 1 张受控支援并移除屏障。
  const controlled = asset(state, '01020')
  const barriersBefore = mech.barriers.edges(refinery.id).reduce((sum, edge) => sum + edge.count, 0)
  const parley = legalMoves(state).find(command => command.action === 'entityAbility'
    && command.entityId === refinery.id && command.abilityIndex === 1)
  assert.ok(parley, '弃支援谈判能力应出现在 legalMoves')
  const assetsBefore = state.investigators[0].assets.length
  move(state, parley)
  settle(state)
  const barriersAfter = createMechanicsApi(state).barriers.edges(refinery.id).reduce((sum, edge) => sum + edge.count, 0)
  assert.equal(barriersAfter, barriersBefore - 1, '谈判成功移除 1 个屏障')
  assert.equal(state.investigators[0].assets.length, assetsBefore - 1, '支付「弃置 1 张你控制的支援」')
  assert.equal(controlled.code, '01020')
  assert.equal(mech.keys.at(`investigator:${inv.seat}`).includes('red'), true, '钥匙仍在调查员处')

  // 再做自由移动（控制钥匙 → 移动到连接地点），不花行动。先清掉目标边上的屏障（夹具），
  // 让「移动到一个连接地点」在无障碍边上有合法目标（屏障阻挡由引擎移动校验负责）。
  mech.barriers.set(refinery.id, neighbor, 0)
  const walk = legalMoves(state).find(command => command.action === 'entityAbility'
    && command.entityId === refinery.id && command.abilityIndex === 0)
  assert.ok(walk, '控制钥匙时的自由移动能力应出现在 legalMoves')
  const actionsBefore = state.investigators[0].actionsLeft
  move(state, walk)
  settle(state)
  assert.notEqual(state.investigators[0].location, refinery.id, '真实移动到连接地点')
  assert.equal(state.investigators[0].actionsLeft, actionsBefore, '自由移动不消耗行动')
})

// ---------------------------------------------------------------- 07148
// 诡计 07148《拽回原处》：显现意志(3)检定；失败后移动到东面的连接地点（忽略屏障），
// 然后将你控制的每个钥匙放在你所在地点。走真实 encounterResolve + 真实失败检定。

test('07148 拽回原处：意志(3)失败后向东移动（忽略屏障），然后把控制的钥匙放到所在地点', () => {
  const state = itd(1)
  const inv = state.investigators[0]
  // 找一对真实网格上东西相邻、且在连接表里的地点（本章开局网格：07131 → 东面 07143）。
  const west = state.locations.find(location => {
    const origin = gridPosition(state, location.id)
    if (!origin || origin.isolated) return false
    return state.locations.some(other => {
      const position = gridPosition(state, other.id)
      return position && !position.isolated && position.y === origin.y && position.x === origin.x + 1
        && (location.connections || []).includes(other.id)
    })
  })
  assert.ok(west, '本章网格应存在东面连接地点')
  const origin = gridPosition(state, west.id)
  const east = state.locations.find(other => {
    const position = gridPosition(state, other.id)
    return position && !position.isolated && position.y === origin.y && position.x === origin.x + 1
      && (west.connections || []).includes(other.id)
  })
  inv.location = west.id
  const mech = createMechanicsApi(state)
  mech.keys.transfer('red', 'setAside', `investigator:${inv.seat}`, { reveal: true })
  mech.keys.transfer('blue', 'setAside', `investigator:${inv.seat}`, { reveal: true })
  mech.barriers.set(west.id, east.id, 1)
  state.chaosBag = ['autofail']
  const execute = draft => pulledBack07148.encounterResolve(draft, draft.investigators[0],
    { code: '07148', originalCode: '07148' }, scenarioRuntime(draft, []))
  resolveTransaction(state, 0, { action: 'test07148' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 100, JSON.stringify(state.pendingChoice))
    const choice = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id)) ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
  assert.equal(state.investigators[0].location, east.id, '失败后移动到东面连接地点（忽略屏障）')
  const held = Object.entries(state.scenarioFlags.mechanics.keys)
    .filter(([, key]) => key.holder === `location:${east.id}`).map(([color]) => color).sort()
  assert.deepEqual(held, ['blue', 'red'], '然后每把受控钥匙放到（移动后的）所在地点')
})

// ---------------------------------------------------------------- 07123
// scenario 参考卡 07123《深陷危局》：混乱标记数值与失败后果由 `scenarioRule.resolveChaosToken/
// applyTokenEffect` 提供（读点 content entry-rules → 真实 performTest）。

test('07123 深陷危局：skull 按东面地点数减值；tablet 失败在无屏障连接边放 1 个屏障', () => {
  const state = itd(1)
  const inv = state.investigators[0]
  // 选一个有东面邻格的真实地点（本章开局网格：location07131 东面是 location07143）。
  const start = state.locations.find(location => {
    const origin = gridPosition(state, location.id)
    return origin && !origin.isolated
      && state.locations.some(other => {
        const position = gridPosition(state, other.id)
        return position && !position.isolated && position.y === origin.y && position.x > origin.x
      })
      && !state.locations.some(other => {
        const position = gridPosition(state, other.id)
        return position && !position.isolated && position.y === origin.y && position.x === origin.x + 1
          && !(location.connections || []).includes(other.id)
      })
  }) || state.locations.find(location => (location.originalCode || location.code) === '07131')
  inv.location = start.id
  const tx = (run, select = () => null) => {
    const execute = draft => run(draft)
    resolveTransaction(state, 0, { action: 'test07123' }, execute)
    for (let guard = 0; state.pendingChoice; guard++) {
      assert.ok(guard < 100, JSON.stringify(state.pendingChoice))
      const choice = state.pendingChoice
      const optionId = select(choice, state) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id)) ?? choice.options[0].id
      resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
    }
  }
  const origin = gridPosition(state, inv.location)
  const eastCount = state.locations.filter(location => {
    const position = gridPosition(state, location.id)
    return position && !position.isolated && origin && !origin.isolated
      && position.y === origin.y && position.x > origin.x
  }).length
  assert.ok(eastCount > 0, '所选地点应有东面地点')
  state.chaosBag = ['skull']
  tx(draft => performTest(draft, 0, 'willpower', 0, {}))
  assert.equal(state.lastTestResult.value, state.lastTestResult.baseValue - eastCount, 'skull = 东面每地点 -1（简单/普通）')

  // tablet 失败：在「与本地点之间没有屏障」的连接边放 1 个屏障。
  const barrierApi = createMechanicsApi(state)
  const here = state.locations.find(location => location.id === inv.location)
  const candidate = (here.connections || []).find(id => barrierApi.barriers.count(here.id, id) === 0
    && barrierApi.barriers.canPlace(here.id, id))
  assert.ok(candidate, '本地点应存在无屏障且可放置的连接边')
  state.chaosBag = ['tablet']
  tx(draft => performTest(draft, 0, 'willpower', 100, {}))
  assert.equal(state.lastTestResult.success, false)
  assert.equal(createMechanicsApi(state).barriers.count(here.id, candidate) >= 1, true,
    'tablet 失败后在无屏障连接边放 1 个屏障')
})
