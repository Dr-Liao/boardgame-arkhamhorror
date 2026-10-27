// 「往事回声」隐藏的图书馆 / [[通道]] 规则端到端回归。
//
// 用户报告（2026-10-27）：
//   1. 隐藏的图书馆一开始就连接了；
//   2. 皮博迪先生改不了其他地点的通道属性；
//   3. 通道也没有关键字。
//
// 本文件用真实引擎状态验证整条链路：
//   布置 → 幕 2 背面（放置隐藏的图书馆 + 皮博迪）→ 幕 3（通道特性地点互相连接）
//   → 皮博迪行动（-1 帷幕 + 通道特性 + 双向连接 + UI 投影）→ 轮末清理
//   → 敌人阶段临时授予（猎手能进入隐藏的图书馆）→ 还原。
//
// 幕 3 规则现在由 03126 条目的 actRule.locationTraitLinks 声明，特性授予/撤销与自动连接
// 全部走引擎原语（src/engine/location-traits.js）；本文件验证的就是这条真实链路。
//
// 注意：引擎的 applyMove 会克隆并替换 state 里的嵌套对象，跨 applyMove 保留的实例引用会
// 变成过期副本，所以每次动作后都必须从 state 重新取地点/支援。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createGameState, startScenario, applyMove, legalMoves, decisionSeat, advanceAct, hunterStep,
  activeLocationTraitLinks, grantedLocationTraits, addLocationTrait, removeLocationTrait,
  setLocationShroudMod,
} from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { behavior as echoes } from '../content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/behavior.js'
import { settle } from './core-fixture.mjs'

const PASSAGEWAY = 'Passageway'
const original = card => card?.originalCode || card?.code
const locationById = (state, id) => state.locations.find(location => location.id === id)
const liveConnectionIds = (state, location) => (location?.connections || [])
  .filter(id => state.locations.some(other => other.id === id))
const hasPassageway = location => (location?.traits || [])
  .some(trait => String(trait).toLowerCase() === PASSAGEWAY.toLowerCase())
let state

function startEchoes() {
  const game = createGameState({
    campaignId: 'thePathToCarcosa',
    playerInvestigator: '03006',
    seed: 'echoes-passageways-e2e',
    seatInvestigators: ['03006'],
  }, [{ seat: 0, role: 'human' }])
  settle(game)
  startScenario(game, 2, [])
  settle(game)
  return game
}

function advanceOnce(game) {
  for (const inv of game.investigators) inv.clues = 20
  advanceAct(game, [])
  settle(game)
}

// 直接调用章节 behavior 钩子时的 api 桩：特性/帷幕原语转发到引擎导出，
// 与 scenario-runtime 给章节的 api 同源（避免测试自己复制一份规则）。
function stubApi(game = state) {
  return {
    info() {},
    choose() { throw new Error('unexpected choice') },
    place() {},
    giveAsset() {},
    addLocationTrait: (location, trait, options = {}) => addLocationTrait(game, location, trait, options),
    removeLocationTrait: (location, trait, options = {}) => removeLocationTrait(game, location, trait, options),
    grantedLocationTraits: location => grantedLocationTraits(location),
    setShroudMod: (location, amount) => setLocationShroudMod(location, amount),
  }
}

// 皮博迪先生行动：找到合法行动 → 应用到目标地点 → 结算选择窗口。
// `ready` 模拟重整阶段把他重置（真实规则里第二次使用必须先重整，也就意味着上一次效果结束）。
function usePeabody(game, targetId, { ready = false } = {}) {
  const inv = game.investigators[0]
  if (ready) {
    const asset = inv.assets.find(item => original(item) === '03141')
    asset.exhausted = false
  }
  inv.actionsLeft = 3
  game.phase = 'investigation'
  game.currentSeat = 0
  game.pendingChoice = null
  const move = legalMoves(game).find(candidate => candidate.rule === 'peabodyPassage')
  assert.ok(move, '皮博迪先生的行动出现在合法列表里')
  applyMove(game, 0, move)
  const choice = game.pendingChoice
  assert.ok(choice, '皮博迪先生行动需要选择目标地点')
  const option = choice.options.find(candidate => candidate.id === targetId)
  assert.ok(option, `「${targetId}」是皮博迪先生的合法目标`)
  applyMove(game, decisionSeat(game), { action: 'choose', choiceId: choice.id, optionId: targetId })
  settle(game)
}

test('布置阶段：隐藏的图书馆放在一边，不在场、未连接', () => {
  state = startEchoes()
  assert.equal(state.scenario.id, 'echoesOfThePast')
  assert.equal(state.scenarioZones.setAside.includes('03139'), true)
  assert.equal(state.locations.some(location => location.id === 'hiddenLibrary'), false)
  for (const location of state.locations) {
    assert.equal((location.connections || []).includes('hiddenLibrary'), false,
      `${location.id} 在布置阶段不能连接隐藏的图书馆`)
  }
})

test('幕 2 背面：隐藏的图书馆入场但没有特性/连接；幕 3 通道特性地点互相连接', () => {
  advanceOnce(state) // 幕 1 → 幕 2
  assert.equal(state.actIndex, 1)
  assert.equal(state.locations.some(location => location.id === 'hiddenLibrary'), false)

  const beforeAdvance = new Map(state.locations.map(location => [location.id, [...(location.connections || [])]]))
  advanceOnce(state) // 幕 2 背面 → 幕 3
  assert.equal(state.actIndex, 2)
  assert.equal(original(state.acts[state.actIndex]), '03126')

  // 幕 3 规则由 03126 条目的 actRule.locationTraitLinks 声明，引擎在幕 3 成为当前幕时自动安装。
  const linkState = activeLocationTraitLinks(state)
  assert.ok(linkState, '幕 3 声明的地点特性连接规则已生效')
  assert.deepEqual(linkState.rules, [{ id: 'act:03126:Passageway', trait: PASSAGEWAY }])

  const hidden = locationById(state, 'hiddenLibrary')
  assert.ok(hidden, '隐藏的图书馆已放入场')
  assert.equal(hidden.revealed, false)
  assert.deepEqual(hidden.connections, [], '隐藏的图书馆默认没有任何连接')
  assert.equal(hasPassageway(hidden), false, '隐藏的图书馆默认没有[[通道]]特性')
  for (const location of state.locations) {
    assert.equal((location.connections || []).includes('hiddenLibrary'), false,
      `${location.id} 不能自动连到隐藏的图书馆`)
  }

  // 皮博迪先生交给调查员。
  assert.equal(state.investigators[0].assets.some(asset => original(asset) === '03141'), true)

  // 幕 3 规则：场上所有带[[通道]]特性的地点互相连接（双向）。
  const passageways = state.locations.filter(hasPassageway)
  assert.ok(passageways.length >= 1, '至少一个印刷[[通道]]地点在场')
  for (const location of passageways) {
    const connections = liveConnectionIds(state, location)
    for (const other of passageways) {
      if (other.id === location.id) continue
      assert.equal(connections.includes(other.id), true, `${location.id} → ${other.id} 应连接`)
      assert.equal(liveConnectionIds(state, other).includes(location.id), true, `${other.id} → ${location.id} 应连接`)
    }
  }
  // 引擎只记录并自动添加「两个都是[[通道]]地点」的方向。
  assert.ok(linkState.added.length >= 1, '幕 3 规则有自动加边记录')
  for (const [from, to] of linkState.added) {
    assert.equal(hasPassageway(locationById(state, from)), true, `自动连接起点 ${from} 应为[[通道]]地点`)
    assert.equal(hasPassageway(locationById(state, to)), true, `自动连接终点 ${to} 应为[[通道]]地点`)
    assert.notEqual(from, 'hiddenLibrary')
    assert.notEqual(to, 'hiddenLibrary')
  }
  // 非[[通道]]地点（含隐藏的图书馆）的连接保持入场时的印刷值。
  for (const location of state.locations.filter(candidate => !hasPassageway(candidate))) {
    assert.deepEqual(location.connections, beforeAdvance.get(location.id) || [],
      `${location.id} 的印刷连接不应被规则改写`)
  }
})

test('皮博迪先生：隐藏的图书馆获得[[通道]]特性 + 隐藏值 -1 + 双向连接；UI 投影带「通道」关键字', () => {
  usePeabody(state, 'hiddenLibrary')

  const hidden = locationById(state, 'hiddenLibrary')
  assert.equal(hasPassageway(hidden), true, '隐藏的图书馆获得[[通道]]特性')
  assert.equal(hidden.shroudMod, -1, '隐藏的图书馆隐藏值 -1')
  assert.deepEqual(grantedLocationTraits(hidden), [PASSAGEWAY], '授予的特性按来源记在地点实例上')
  const peabody = state.investigators[0].assets.find(asset => original(asset) === '03141')
  assert.equal(peabody.exhausted, true)
  assert.deepEqual(state.scenarioFlags.peabodyPassage, { locationId: 'hiddenLibrary' })

  // 双向连接：所有印刷[[通道]]地点都能进出隐藏的图书馆。
  const passageways = state.locations.filter(location => location.id !== 'hiddenLibrary' && hasPassageway(location))
  assert.ok(passageways.length >= 1)
  for (const location of passageways) {
    assert.equal(liveConnectionIds(state, hidden).includes(location.id), true, `隐藏的图书馆 → ${location.id}`)
    assert.equal(liveConnectionIds(state, state.locations.find(item => item.id === location.id))
      .includes('hiddenLibrary'), true, `${location.id} → 隐藏的图书馆`)
  }

  // 观察投影：界面能拿到中文关键字、授予特性与 -1 帷幕后的有效隐藏值。
  const view = viewState(state)
  const viewHidden = view.locations.find(location => location.id === 'hiddenLibrary')
  assert.ok(viewHidden, '投影包含隐藏的图书馆')
  const index = (viewHidden.traits || []).findIndex(trait => String(trait).toLowerCase() === 'passageway')
  assert.equal(index >= 0, true, '投影地点特性含 Passageway')
  assert.equal(viewHidden.traitsZh?.[index], '通道', '投影带中文特性名「通道」')
  assert.deepEqual(viewHidden.grantedTraits, [PASSAGEWAY])
  assert.equal(viewHidden.shroud, 3, '印刷隐藏值 4 - 皮博迪 1 = 3')

  // 调查员真的能走进去（过去被错误连接掩盖的入口，现在只能靠皮博迪打开）。
  state.investigators[0].location = passageways[0].id
  state.investigators[0].actionsLeft = 3
  state.pendingChoice = null
  const into = legalMoves(state).find(candidate => candidate.action === 'move' && candidate.locationId === 'hiddenLibrary')
  assert.ok(into, `${passageways[0].id} 的调查员可以移动到隐藏的图书馆`)
  applyMove(state, 0, into)
  settle(state)
  assert.equal(state.investigators[0].location, 'hiddenLibrary')
  assert.equal(locationById(state, 'hiddenLibrary').revealed, true, '进入后揭示隐藏的图书馆')
})

test('轮末：皮博迪先生重整后撤销特性/隐藏值/连接，印刷[[通道]]特性不会被误删', () => {
  // 把一个印刷[[通道]]地点也点成「临时通道」，验证清理不会剥掉印刷特性，也不会误删印刷邻接。
  const printed = state.locations.find(location => location.id !== 'hiddenLibrary' && hasPassageway(location))
  const printedId = printed.id
  // 印刷邻接来自关卡定义，与幕 3 动态连接区分。
  const printedBefore = [...(state.scenario.locations[printedId]?.connections || [])]
  usePeabody(state, printedId, { ready: true })

  const printedNow = locationById(state, printedId)
  assert.equal(hasPassageway(printedNow), true)
  assert.deepEqual(grantedLocationTraits(printedNow), [PASSAGEWAY])
  assert.equal(printedNow.shroudMod, -1)

  echoes.roundEnded(state, stubApi())

  const hidden = locationById(state, 'hiddenLibrary')
  assert.equal(hasPassageway(hidden), false, '隐藏的图书馆失去[[通道]]特性')
  assert.equal(hidden.shroudMod, 0, '隐藏值修正已撤销')
  assert.deepEqual(hidden.connections, [], '隐藏的图书馆连接清空')
  const printedAfter = locationById(state, printedId)
  assert.equal(hasPassageway(printedAfter), true, '印刷[[通道]]特性保留')
  assert.equal(printedAfter.shroudMod, 0)
  assert.deepEqual(grantedLocationTraits(printedAfter), [])
  assert.equal(state.scenarioFlags.peabodyPassage, undefined)
  // 清理只撤销自动连接；印刷邻接保持原样。
  for (const id of printedBefore) {
    assert.equal((printedAfter.connections || []).includes(id), true, `印刷邻接 ${printedId} → ${id} 应保留`)
  }
  // 幕 3 规则仍然生效：印刷[[通道]]地点之间仍互相连接。
  const passageways = state.locations.filter(hasPassageway)
  for (const location of passageways) for (const other of passageways) {
    if (location.id === other.id) continue
    assert.equal(liveConnectionIds(state, location).includes(other.id), true)
  }
})

test('敌人阶段：敌人移动时隐藏的图书馆临时获得[[通道]]，猎手可以追进来；移动结束后还原', () => {
  const hidden = locationById(state, 'hiddenLibrary')
  const passageway = state.locations.find(location => location.id !== 'hiddenLibrary' && hasPassageway(location))
  assert.ok(passageway)
  state.investigators[0].location = 'hiddenLibrary'
  state.enemies = [{
    id: 'hunter-e1', code: '03144', originalCode: '03144', name: '猎手（测试）',
    location: passageway.id, hunter: true, fight: 1, evade: 1, health: 2,
    damage: 0, horror: 0, damageTaken: 0, engagedSeat: null, exhausted: false,
  }]
  state.phase = 'enemy'
  state.pendingChoice = null

  echoes.enemyPhaseStart(state, stubApi())
  assert.equal(hasPassageway(hidden), true, '敌人移动窗口内隐藏的图书馆获得[[通道]]特性')
  assert.deepEqual(grantedLocationTraits(hidden), [PASSAGEWAY], '临时授予按来源记账（03139）')
  assert.equal(liveConnectionIds(state, hidden).includes(passageway.id), true)
  assert.equal(hunterStep(state, state.enemies[0]), 'hiddenLibrary', '猎手朝隐藏的图书馆移动一步')
  echoes.enemyPhaseAfterHunters(state, stubApi())

  assert.equal(hasPassageway(hidden), false, '移动窗口结束后撤掉临时[[通道]]特性')
  assert.deepEqual(grantedLocationTraits(hidden), [])
  assert.equal(liveConnectionIds(state, hidden).includes(passageway.id), false, '临时连接被移除')
})
