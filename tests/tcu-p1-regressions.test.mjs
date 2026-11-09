// 四循环《万象无终》P1 修复回归（真实引擎路径子集）。
// 覆盖：05043/05050 混乱标记含义接线、05095 入场毁灭绕过 05085b、05311 breachOnEnter 声明位置。
// 其余 P1 条目（05190/05191 criteria、05024、05002/05009、05152、05156、05072、05246 V4 等）
// 在各自章节/玩家卡测试文件里补了断言。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove, legalMoves, startScenario, performTest } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'

const SAFE_IDS = ['done', 'skip', 'no', 'avoid', 'decline', 'cancel', 'none', 'leave', 'safe', 'continue']

function settle (state, guardMax = 800) {
  let guard = 0
  while (state.pendingChoice && guard++ < guardMax) {
    const pending = state.pendingChoice
    const options = pending.options || []
    if (!options.length) break
    const optionId = SAFE_IDS.map(id => options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)?.id
      ?? options[0].id
    const move = { action: 'choose', choiceId: pending.id, optionId }
    try { applyMove(state, pending.seat, move) } catch {
      try { resolveTransaction(state, pending.seat, move, current => current) } catch { break }
    }
  }
  return state.pendingChoice || null
}

function apply (state, seat, move) {
  try { return { ok: true, events: applyMove(state, seat, move) } } catch (error) { return { ok: false, error } }
}

function driveHub (state, guardMax = 200) {
  const lead = () => state.campaign?.leadSeat ?? 0
  const seatFor = action => ['hubBeginScenario', 'hubContinue', 'hubSetLeader', 'hubSelectScenario', 'hubSetDifficulty', 'hubGoSetup'].includes(action)
    ? lead() : (state.currentSeat ?? 0)
  for (let guard = 0; guard < guardMax; guard++) {
    if (state.uiState === 'inScenario' && state.scenario?.id) return true
    if (state.status !== 'playing') return false
    settle(state)
    const moves = legalMoves(state)
    if (!moves.length) return false
    const priority = ['hubBeginScenario', 'hubContinue', 'hubDoneSeat', 'hubAutoDeck', 'hubConfirmUpgrades',
      'hubAutoUpgrade', 'hubGoSetup', 'hubSelectInvestigator', 'hubSelectScenario', 'hubSetDifficulty', 'hubSetLeader']
    const candidates = priority.map(action => moves.find(move => move.action === action)).filter(Boolean)
    let applied = false
    for (const candidate of candidates) {
      for (const seat of [...new Set([seatFor(candidate.action), 0, state.currentSeat ?? 0])]) {
        if (apply(state, seat, candidate).ok) { applied = true; break }
      }
      if (applied) break
    }
    if (!applied) return false
  }
  return false
}

function baseState () {
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: true, seed: 'tcu-p1-regression' },
    [{ seat: 0, role: 'human' }],
  )
  assert.equal(driveHub(state), true, '真实大厅流程应能进入序章')
  settle(state)
  return state
}

function startScenarioAt (state, scenarioId) {
  const index = chapters.findIndex(chapter => chapter.id === scenarioId)
  assert.ok(index >= 0, `未知章节 ${scenarioId}`)
  state.campaign.scenarioIndex = index
  state.campaign.flow.nodeId = scenarioId
  state.campaign.flow.visits = { ...(state.campaign.flow.visits || {}), [scenarioId]: 1 }
  settle(state)
  state.continuation = null
  resolveTransaction(state, 0, { action: 'tcuP1TestStart' }, current => startScenario(current, index, []))
  settle(state)
  assert.equal(state.scenario?.id, scenarioId)
  return state
}

test('P1 05043 序章：混乱标记含义进入 state.scenario.tokenMeanings（AI/符号结算可读）', () => {
  const state = startScenarioAt(baseState(), 'disappearanceAtTheTwilightEstate')
  const meanings = state.scenario.tokenMeanings?.standard
  assert.ok(meanings?.skull, '序章 05043 的 skull 含义应已接进 state.scenario')
  assert.equal(meanings.skull.delta, -3, '简单/普通 skull -3')
  assert.match(meanings.skull.text, /闹鬼/, '包含失败后的闹鬼后果文本')
})

test('P1 05050 巫异时刻：behavior.tokenMeanings 并进 state.scenario（不再是死声明）', () => {
  const state = startScenarioAt(baseState(), 'theWitchingHour')
  const meanings = state.scenario.tokenMeanings?.standard
  assert.ok(meanings?.skull && meanings?.tablet && meanings?.elderthing, '05050 三个自定义符号含义已接线')
  assert.equal(meanings.skull.delta, -1)
  assert.equal(meanings.elderthing.delta, -3)
})

test('P1 05095 入场毁灭不能绕过 05085b 的「毁灭不能放在银暮秘社敌人上」', () => {
  const state = startScenarioAt(baseState(), 'atDeathsDoorstep')
  state.scenarioFlags.josefPlanResolved = true
  state.doom = 0
  const inv = state.investigators[0]
  inv.location = state.locations[0].id
  state.currentSeat = inv.seat
  state.phase = 'investigation'
  settle(state)
  const move = { action: 'debug', kind: 'spawn', code: '05095', targetSeat: inv.seat }
  assert.equal(apply(state, inv.seat, move).ok, true, '调试生成 05095 不应失败')
  const spawned = state.enemies.find(enemy => String(enemy.code) === '05095')
  assert.ok(spawned, '05095 已生成')
  assert.equal(spawned.doom || 0, 0, '05085b 生效后入场毁灭被拒绝（不再无条件补写）')
})

test('P1 05104 投入卡牌的额外费用只在真正投入后结算（投入 0 张/放弃不结算）', () => {
  const base = startScenarioAt(baseState(), 'inTheClutchesOfChaos')
  {
    const inv = base.investigators[0]
    const here = base.locations.find(location => location.id === inv.location)
    // 模拟 05104 已结算：本次检定期间闹鬼地点的投入额外费用生效。
    here.haunted = [{ text: '闹鬼 - 受到 1 点伤害。', effect: [{ kind: 'damage', amount: 1 }] }]
    base.hauntedCommitCost = { locationId: here.id, paidSeats: [] }
    base.chaosBag = ['0']
    inv.hand = ['01088', '01089', '01090', '01091', '01092', '01093']
    // 只保留干净的「游戏态」：清掉开局结算可能残留的事务凭据，避免下一次新命令被当成续跑。
    base.pendingChoice = null
    base.continuation = null
    delete base._resolution
  }
  const testOnce = commitOneCard => {
    // 每次在干净的存档副本上跑一次真实技能检定（避免上一次事务的待决选择残留）。
    const state = JSON.parse(JSON.stringify(base))
    const inv = state.investigators[0]
    const damageBefore = inv.damage
    const execute = current => performTest(current, inv.seat, 'willpower', 1, { resolve: () => {} })
    resolveTransaction(state, inv.seat, { action: 'p1-05104' }, execute)
    let guard = 0
    while (state.pendingChoice && guard++ < 40) {
      const pending = state.pendingChoice
      let optionId = ['done', 'skip'].find(id => pending.options.some(option => String(option.id) === id))
      const isCommit = pending.kind === 'commit'
      if (commitOneCard && isCommit) {
        optionId = pending.options.find(option => String(option.id) !== 'done' && String(option.id) !== 'help')?.id
      }
      if (optionId == null) optionId = pending.options[0]?.id
      // 复用同一 execute：resolveTransaction 会从 continuation 重放事务并消费已保存的选择答案。
      resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
      if (commitOneCard && isCommit) break // 只投入一张即可（额外费用在投入后立即结算）
    }
    return { damageDelta: state.investigators[0].damage - damageBefore, paidSeats: [...(state.hauntedCommitCost.paidSeats || [])] }
  }
  const noCommit = testOnce(false)
  assert.equal(noCommit.damageDelta, 0, '不投入卡牌：不结算闹鬼额外费用')
  assert.deepEqual(noCommit.paidSeats, [], '不投入卡牌：不记为已支付')
  const committed = testOnce(true)
  assert.equal(committed.damageDelta, 1, '真正投入 1 张牌后才结算闹鬼（受到 1 点伤害）')
  assert.deepEqual(committed.paidSeats, [0], '该调查员本场检定记为已支付一次')
})

test('P1 05311 breachOnEnter：进入地点后真实放置 1 裂口', () => {
  const state = startScenarioAt(baseState(), 'inTheClutchesOfChaos')
  const inv = state.investigators[0]
  inv.location = state.locations[0].id
  state.currentSeat = inv.seat
  state.phase = 'investigation'
  settle(state)
  const location = state.locations.find(item => item.id === inv.location)
  const before = location.breaches || 0
  const move = { action: 'debug', kind: 'spawn', code: '05311', targetSeat: inv.seat }
  assert.equal(apply(state, inv.seat, move).ok, true, '调试生成 05311 不应失败')
  const spawned = state.enemies.find(enemy => String(enemy.code) === '05311')
  assert.ok(spawned, '05311 已生成')
  const after = state.locations.find(item => item.id === spawned.location)
  assert.equal((after.breaches || 0) - before, 1, 'flags.breachOnEnter 被章节读到并放置 1 裂口')
})

test('P1 05325《黑色王座》计时器/参考资源：真实 viewState 可观察', () => {
  const state = startScenarioAt(baseState(), 'beforeTheBlackThrone')
  state.scenarioFlags.azathothDoom = 7
  state.scenarioFlags.referenceResources = 3
  const view = viewState(state, 0)
  assert.deepEqual(view.beforeTheBlackThrone, { azathothDoom: 7, referenceResources: 3, devoured: false },
    '阿撒托斯毁灭/冒险参考卡资源进入公开投影')
})

test('P1 05284 幕上裂口 / 05203 四把钥匙 / 密谋牌库旁：真实 viewState 可观察', () => {
  // 幕上裂口：当前幕容器 state.acts[i].breaches 投影为 actBreaches（不泄露其他隐藏字段）。
  const icc = startScenarioAt(baseState(), 'inTheClutchesOfChaos')
  icc.acts[icc.actIndex || 0].breaches = 2
  const iccView = viewState(icc, 0)
  assert.equal(iccView.actBreaches, 2, '幕上裂口进入公开投影')
  // 密谋牌库旁（05089/05102/05107 写入 scenarioZones.agendaAside）与授予的闹鬼。
  icc.scenarioZones = { ...(icc.scenarioZones || {}), agendaAside: ['05102'] }
  icc.hauntedGrants = [{ id: 'g1', locationId: icc.locations[0].id, ability: { text: '闹鬼 - 将怨灵生成在本地点。' } }]
  const asideView = viewState(icc, 0)
  assert.deepEqual(asideView.agendaAside, ['05102'], '密谋牌库旁的卡进入公开投影')
  assert.equal(asideView.hauntedGrants.length, 1, '额外授予的闹鬼进入公开投影')
  // 四把钥匙（05203）：归属是桌面公开信息。
  const fgg = startScenarioAt(baseState(), 'forTheGreaterGood')
  fgg.scenarioKeys = [{ id: 'key1', label: '钥匙一', holder: 0, location: null, enemyId: null, assetId: null }]
  const fggView = viewState(fgg, 0)
  assert.equal(fggView.fourKeys.length, 1, '四把钥匙进入公开投影')
  assert.equal(fggView.fourKeys[0].holder, 0)
})
