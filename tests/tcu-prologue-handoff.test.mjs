// 万象无终（TCU）序章 →《巫异时刻》交接回归（2026-11-17 用户实测）。
//
// 用户报告：第 1 关《暮色庄园失踪事件》（序章）结束后，关间准备窗口里调查员的角色
// 「没有变回来」（仍显示 4 位无牌组故事调查员中的一位），并且不能升级。
//
// 规则口径（参考实现 Campaigns/TheCircleUndone.hs）：
//   · `DisappearanceAtTheTwilightEstate -> ChooseDecksStep <$> continueNoUpgrade TheWitchingHour`
//     —— 序章后先换回玩家自己的调查员/牌组（ChooseDecksStep），且序章不给经验、没有升级步骤
//     （continueNoUpgrade），所以「不能升级」本身是正常的；
//   · 但换回必须发生在《巫异时刻》开始之前的准备窗口，旧实现拖到 `startScenario` 才换，
//     准备页仍显示故事调查员（关间准备 bug）。
//
// 同时锁定：故事调查员在序章被击败只写章节的「失踪人口/命运」记录，不得把失败折算成
// 真实调查员的创伤（旧实现会直接给真实调查员 +1 创伤，本用例用 99 点伤害复现）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove, legalMoves } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'

const SAFE_IDS = ['done', 'skip', 'no', 'avoid', 'decline', 'cancel', 'none', 'leave', 'safe', 'continue']

function settle (state, guardMax = 800) {
  for (let guard = 0; guard < guardMax && state.pendingChoice; guard++) {
    const pending = state.pendingChoice
    const options = pending.options || []
    if (!options.length) break
    const optionId = SAFE_IDS.map(id => options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)?.id
      ?? options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

/** 真实大厅流程推进到序章牌桌（与 tcu-chapters-smoke 同一口径）。 */
function driveToPrologue (state, guardMax = 200) {
  const lead = () => state.campaign?.leadSeat ?? 0
  const seatFor = action => ['hubBeginScenario', 'hubContinue', 'hubSetLeader', 'hubSelectScenario',
    'hubSetDifficulty', 'hubGoSetup'].includes(action) ? lead() : (state.currentSeat ?? 0)
  for (let guard = 0; guard < guardMax; guard++) {
    if (state.uiState === 'inScenario' && state.scenario?.id) return true
    if (state.status !== 'playing') return false
    settle(state)
    const moves = legalMoves(state)
    if (!moves.length) return false
    const priority = ['hubBeginScenario', 'hubContinue', 'hubDoneSeat', 'hubConfirmDeck', 'hubAutoDeck', 'hubConfirmUpgrades',
      'hubAutoUpgrade', 'hubGoSetup', 'hubSelectInvestigator', 'hubSelectScenario', 'hubSetDifficulty', 'hubSetLeader']
    const candidates = priority.map(action => moves.find(move => move.action === action)).filter(Boolean)
    let applied = false
    for (const candidate of candidates) {
      for (const seat of [...new Set([seatFor(candidate.action), 0, state.currentSeat ?? 0])]) {
        try { applyMove(state, seat, candidate); applied = true; break } catch { /* 换一个座位再试 */ }
      }
      if (applied) break
    }
    if (!applied) return false
  }
  return false
}

function newPrologueGame (seed = 'tcu-prologue-handoff') {
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: true, seed },
    [{ seat: 0, role: 'human' }],
  )
  assert.equal(driveToPrologue(state), true, '真实大厅流程应能进入序章')
  settle(state)
  assert.equal(state.scenario?.id, 'disappearanceAtTheTwilightEstate')
  assert.ok(!state.pendingChoice, '故事调查员选择应收敛')
  const chosen = state.storyInvestigators?.chosen?.[0]
  assert.ok(chosen, '序章应已选定故事调查员')
  const record = state.campaign.investigators[0]
  assert.notEqual(chosen.code, record.code, '故事调查员与真实调查员是不同卡号')
  return { state, chosen, record }
}

test('序章被击败：故事调查员的失败不折算成真实调查员的创伤', () => {
  const { state, record } = newPrologueGame('tcu-prologue-trauma')
  // 用调试伤害击败故事调查员；单人局全员被击败 → 序章以 noResolution 正常结算。
  applyMove(state, 0, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state)
  assert.equal(state.uiState, 'scenarioResult', '序章应结算到 scenarioResult')
  assert.equal(state.investigators[0].defeated, true, '故事调查员应已被击败')
  assert.deepEqual(state.campaign.trauma[0], { physical: 0, mental: 0 },
    '序章的失败属于故事调查员，不应给真实调查员记创伤')
  assert.deepEqual(record.trauma, { physical: 0, mental: 0 })
  assert.equal(record.status, 'active')
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result.scenarioId, 'disappearanceAtTheTwilightEstate')
  assert.deepEqual(result.investigators[0].traumaAfter, { physical: 0, mental: 0 },
    '结算快照里的创伤也应是 0（旧实现会写成 1）')
  assert.equal(result.investigators[0].xpAwarded ?? 0, 0, '序章不获得经验值')
})

test('序章结束后的关间准备换回真实调查员，《巫异时刻》按真实牌组开局', () => {
  const { state, chosen, record } = newPrologueGame('tcu-prologue-handoff')
  applyMove(state, 0, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state)
  assert.equal(state.uiState, 'scenarioResult')

  const cont = legalMoves(state).find(move => move.action === 'hubContinue')
  assert.ok(cont, '结算页应有「进入关间准备」')
  applyMove(state, 0, cont)
  settle(state)

  // 关间准备窗口（下一关《巫异时刻》的 scenarioSetup）。
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow?.nodeId, 'theWitchingHour')
  // 换回真实调查员：状态、观察投影、战役记录三者一致。
  assert.equal(state.storyInvestigators, undefined, '关间准备窗口不应再带着故事调查员状态')
  const inv = state.investigators[0]
  assert.equal(inv.code, record.code, '准备窗口里的调查员应换回玩家自己的调查员')
  assert.equal(inv.storyInvestigator, false)
  assert.equal(inv.noDeck, undefined, '换回后不应残留无牌组标记')
  assert.equal(viewState(state, 0).investigators?.[0]?.code, record.code,
    '界面观察投影也必须显示真实调查员（旧实现显示故事调查员）')
  assert.deepEqual(state.campaign.trauma[0], { physical: 0, mental: 0 })
  // 序章不给经验：此时 XP 为 0，所以「不能升级」本身是规则内的（参考实现 continueNoUpgrade）。
  assert.equal(record.xp, 0)
  assert.ok(state.hubReady, '全员已确认时可直接开始下一关')

  const begin = legalMoves(state).find(move => move.action === 'hubBeginScenario')
  assert.ok(begin, '准备窗口应能开始《巫异时刻》')
  applyMove(state, 0, begin)
  settle(state)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'theWitchingHour')
  const started = state.investigators[0]
  assert.equal(started.code, record.code, '《巫异时刻》应以真实调查员开局')
  assert.equal(started.storyInvestigator, false)
  assert.ok((started.deck || []).length > 0, '真实调查员应带自己的牌组开局')
  assert.equal(started.damage, 0, '不应带着序章的创伤开局')
  assert.equal(started.horror, 0)
  assert.notEqual(started.code, chosen.code)
})
