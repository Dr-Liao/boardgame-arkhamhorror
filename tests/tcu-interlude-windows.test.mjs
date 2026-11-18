// 万象无终（TCU）关间升级窗回归（2026-11-17 用户实测）。
//
// 用户报告：第 2 关《巫异时刻》结束后直接跳到下一关准备页，没有升级（经验花不出去），
// 调查纪事的默认条目也停在序章的私密故事上。
//
// 规则口径（参考实现 Campaigns/TheCircleUndone.hs 的 nextStep）：
//   · DisappearanceAtTheTwilightEstate -> ChooseDecksStep <$> continueNoUpgrade TheWitchingHour
//     ——序章不给经验，所以《巫异时刻》之前没有升级步骤；
//   · TheWitchingHour -> continue AtDeathsDoorstep、AtDeathsDoorstep -> continue TheSecretName
//     ——每场冒险结算后、下一场冒险开始前都有一次关间升级（canUpgradeDecks = true）；
//   · 叙事幕间（二/三/四）只是阅读停顿，升级窗在其正文/选择之后、下一场冒险之前。
// 本用例用真实大厅 hub 流程（真实结算 → hubContinue → 关间确认 → 下一关准备）验证这条链路，
// 并锁定「结算页默认展开本关结算」「关间页默认展开下一关导入」的故事引导。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove, legalMoves, actingSeats } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'

const SAFE_IDS = ['done', 'skip', 'no', 'avoid', 'decline', 'cancel', 'none', 'leave', 'safe', 'continue']

const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

function settle (state, guardMax = 800) {
  for (let guard = 0; state.pendingChoice && guard < guardMax; guard++) {
    const pending = state.pendingChoice
    if (!pending.options?.length) break
    const preferred = SAFE_IDS.map(id => pending.options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)
    const optionId = (preferred || pending.options[0]).id
    try {
      applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
    } catch {
      try {
        resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, current => current)
      } catch { break }
    }
  }
  assert.ok(!state.pendingChoice, '待决选择未收敛')
  return state
}

function act (state, seat, move) {
  assert.ok(move, `缺少合法动作（座位 ${seat}）：${legalMoves(state, seat).map(item => item.action).join(',')}`)
  applyMove(state, seat, plainMove(move))
  return settle(state)
}

const findMove = (state, seat, action) => legalMoves(state, seat).find(move => move.action === action)
const hasAction = (state, action) => legalMoves(state).some(move => move.action === action)

/** 准备/关间窗口里推进一个座位：先选人/组牌，再确认（与真实界面顺序一致）。 */
function prepareSeat (state, seat) {
  const moves = legalMoves(state, seat)
  const move = moves.find(item => item.action === 'hubAutoDeck')
    ?? moves.find(item => item.action === 'hubDoneSeat')
    ?? moves.find(item => item.action === 'hubSelectInvestigator')
  return act(state, seat, move)
}

/** 沿真实 hub 流程推进，直到 predicate 成立；关卡内用调试指令结束本章。 */
function driveUntil (state, predicate, { maxSteps = 800 } = {}) {
  for (let guard = 0; guard < maxSteps; guard++) {
    settle(state)
    if (predicate(state)) return state
    assert.equal(state.status, 'playing', '对局提前结束')
    if (state.uiState === 'campaignHub') {
      if (!state.campaign.leadConfirmed) act(state, 0, findMove(state, 0, 'hubSetLeader'))
      act(state, 0, findMove(state, 0, 'hubGoSetup') || findMove(state, 0, 'hubSelectScenario'))
      continue
    }
    if (state.uiState === 'scenarioResult') { act(state, 0, findMove(state, 0, 'hubContinue')); continue }
    if (state.uiState === 'scenarioSetup' && state.hubReady) {
      act(state, 0, findMove(state, 0, 'hubBeginScenario'))
      continue
    }
    if (state.uiState === 'scenarioSetup' || state.uiState === 'interlude') {
      const seat = actingSeats(state)[0]
      assert.equal(Number.isInteger(seat), true, '准备窗口没有可行动的座位')
      prepareSeat(state, seat)
      continue
    }
    assert.equal(state.uiState, 'inScenario', `未预期的 uiState：${state.uiState}`)
    const keys = Object.keys(state.scenario.resolutions || {})
    const resolutionKey = keys.find(key => key !== 'noResolution') || keys[0]
    act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
  }
  assert.fail('未在预期步数内到达目标状态')
}

function newGame (seed = 'tcu-interlude-windows') {
  return createGameState(
    { campaignId: 'theCircleUndone', campaignHub: true, seed },
    [{ seat: 0, role: 'human' }],
  )
}

test('巫异时刻结算后打开关间升级窗，死亡门前的叙事幕间读完才升级', () => {
  const state = newGame()
  driveUntil(state, current => current.uiState === 'inScenario'
    && current.scenario?.id === 'disappearanceAtTheTwilightEstate')

  // 序章不给经验、不产生升级：结束后直接《巫异时刻》准备（参考实现 continueNoUpgrade）。
  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'noResolution' })
  assert.equal(state.uiState, 'scenarioResult')
  act(state, 0, findMove(state, 0, 'hubContinue'))
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow.nodeId, 'theWitchingHour')
  assert.notEqual(state.campaign.upgradesAllowed, true, '序章后不应开升级窗')
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))

  // 《巫异时刻》以真实结算结束（结局 2 给 1 点奖励经验）。
  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'resolution2' })
  assert.equal(state.uiState, 'scenarioResult')
  assert.ok(state.campaign.investigators[0].xp >= 1, '巫异时刻结算后应有未花费经验')
  // 故事引导：结算页默认展开刚结束的《巫异时刻》结算，而不是序章私密故事。
  const resultJournal = viewState(state, 0).campaignStory
  assert.equal(resultJournal.entries.at(-1)?.id, 'theWitchingHour:1:result')
  assert.equal(resultJournal.currentId, 'theWitchingHour:1:result')

  act(state, 0, findMove(state, 0, 'hubContinue'))
  // 巫异时刻 → 死亡门前：必须先落在关间升级窗（旧实现直接跳到 scenarioSetup）。
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow.nodeId, 'restAfterWitchingHour')
  assert.equal(state.campaign.upgradesAllowed, true, '巫异时刻后必须开放关间升级')
  assert.equal(state.hubReady, false, '关间窗口需要重新确认席位')
  assert.equal(hasAction(state, 'hubDoneSeat'), true)
  assert.ok(hasAction(state, 'hubPurchase') || hasAction(state, 'hubAutoUpgrade'),
    '关间窗口应给出可购买的升级候选')
  // 故事引导：关间页默认展开下一关《死亡门前》的导入。
  const interludeJournal = viewState(state, 0).campaignStory
  assert.equal(interludeJournal.currentId, 'current:atDeathsDoorstep')

  // 确认席位后进入《死亡门前》准备，且可以直接开局（升级窗不会把队伍卡在关间）。
  prepareSeat(state, 0)
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow.nodeId, 'atDeathsDoorstep')
  assert.equal(state.hubReady, true)
  assert.ok(findMove(state, 0, 'hubBeginScenario'), '关间结束后应能开始下一关')
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'atDeathsDoorstep')

  // 死亡门前「逃出」结局 → 幕间二只是阅读停顿（不在这里开升级窗）。
  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'r1' })
  act(state, 0, findMove(state, 0, 'hubContinue'))
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow.nodeId, 'interludeTwo')
  assert.equal(state.campaign.upgradesAllowed, false, '叙事幕间不开放升级')
  assert.equal(state.campaign.flowStage, 'interlude')

  // 读完幕间二并回答三选一后，才在《隐秘之名》之前打开升级窗。
  // 命运分支决定是否还有三选一：约瑟夫「消失」时直接进入升级窗，其余分支停在三选一。
  prepareSeat(state, 0)
  if (state.pendingChoice) settle(state)
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow.nodeId, 'restBeforeTheSecretName')
  assert.equal(state.campaign.upgradesAllowed, true, '幕间二之后必须开放关间升级')
  const nextJournal = viewState(state, 0).campaignStory
  assert.equal(nextJournal.currentId, 'current:theSecretName')

  // 确认后进入《隐秘之名》准备。
  prepareSeat(state, 0)
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow.nodeId, 'theSecretName')
  assert.equal(state.hubReady, true)
  assert.ok(findMove(state, 0, 'hubBeginScenario'))
})

test('死亡门前未逃出：跳过叙事幕间也保留《隐秘之名》前的升级窗', () => {
  const state = newGame('tcu-interlude-windows-skip')
  driveUntil(state, current => current.uiState === 'inScenario'
    && current.scenario?.id === 'disappearanceAtTheTwilightEstate')
  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'noResolution' })
  act(state, 0, findMove(state, 0, 'hubContinue'))
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'resolution2' })
  act(state, 0, findMove(state, 0, 'hubContinue'))
  prepareSeat(state, 0)
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  assert.equal(state.scenario.id, 'atDeathsDoorstep')

  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'r2' })
  act(state, 0, findMove(state, 0, 'hubContinue'))
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow.nodeId, 'restBeforeTheSecretName')
  assert.equal(state.campaign.upgradesAllowed, true, '未逃出时同样要在下一关前升级')
  assert.notEqual(state.campaign.flowStage, 'scenario')

  prepareSeat(state, 0)
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow.nodeId, 'theSecretName')
  assert.equal(state.hubReady, true)
})

test('旧存档停在巫异时刻结算页：读档继续时补进新插入的关间升级窗', () => {
  const state = newGame('tcu-interlude-windows-legacy')
  driveUntil(state, current => current.uiState === 'inScenario'
    && current.scenario?.id === 'disappearanceAtTheTwilightEstate')
  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'noResolution' })
  act(state, 0, findMove(state, 0, 'hubContinue'))
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'resolution2' })
  assert.equal(state.uiState, 'scenarioResult')
  // 修复前的存档在结算时把 pendingNode 直接指向下一关《死亡门前》（跳过关间升级窗）。
  state.campaign.pendingNode = 'atDeathsDoorstep'
  act(state, 0, findMove(state, 0, 'hubContinue'))
  assert.equal(state.uiState, 'interlude', '旧存档续玩也应补进升级窗')
  assert.equal(state.campaign.flow.nodeId, 'restAfterWitchingHour')
  assert.equal(state.campaign.upgradesAllowed, true)
  assert.ok(state.campaign.investigators[0].xp >= 1, '巫异时刻经验应保留到升级窗')
  prepareSeat(state, 0)
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow.nodeId, 'atDeathsDoorstep')
  assert.equal(state.hubReady, true)
})
