// 关间替补：流程图里两关直接相邻（中间没有幕间节点）时，上一关阵亡/疯狂的席位
// 必须在下一关的准备窗口里重新挑选调查员，否则会带着非现役战役记录开局并在
// prepareInvestigator 抛「调查员战役身份不可进入剧本」（用户回归：AI 队友阵亡后无法重选角色）。
//
// 用《印斯茅斯暗潮》第 3、4 章（深陷危局 → 魔鬼礁，流程图里直接相邻）验证真实 hub 流程：
// campaignHub → 选关/准备 → 真实开局 → 调试指令结束本章 → hubContinue → 下一章准备窗口。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove, legalMoves, actingSeats, autoHubMove } from '../src/engine/engine.js'

const CAMPAIGN_ID = 'theInnsmouthConspiracy'
const FIRST_SCENARIO = 'inTooDeep'
const SECOND_SCENARIO = 'devilReef'
const SAFE_IDS = ['done', 'skip', 'no', 'avoid', 'decline', 'cancel', 'none', 'leave', 'safe', 'continue']

const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

function settle (state, guardMax = 400) {
  for (let guard = 0; state.pendingChoice && guard < guardMax; guard++) {
    const choice = state.pendingChoice
    const safe = SAFE_IDS.map(id => choice.options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: (safe || choice.options.at(-1)).id })
  }
  assert.ok(!state.pendingChoice, '待决选择未收敛')
  return state
}

function act (state, seat, move) {
  assert.ok(move, `缺少合法动作（座位 ${seat}）`)
  applyMove(state, seat, plainMove(move))
  return settle(state)
}

const findMove = (state, seat, action) => legalMoves(state, seat).find(move => move.action === action)

function newGame (players, seed = 'hub-replacement') {
  return createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed }, players)
}

/** 准备窗口里推进一个座位：先牌组、再确认，未选人则先选人（与真实界面顺序一致）。 */
function prepareSeat (state, seat) {
  const moves = legalMoves(state, seat)
  const move = moves.find(item => item.action === 'hubAutoDeck')
    ?? moves.find(item => item.action === 'hubDoneSeat')
    ?? moves.find(item => item.action === 'hubSelectInvestigator')
  assert.ok(move, `准备窗口卡住：座位 ${seat} 可用 ${moves.map(item => item.action).join(',')}`)
  return act(state, seat, move)
}

/**
 * 沿真实 hub 流程推进，直到 predicate 成立；在关卡内用调试指令结束本章。
 * 「结束本章的结局键」优先取非 noResolution 的键（与 cu-chapters-smoke 同口径）。
 */
function driveUntil (state, predicate, { maxSteps = 800 } = {}) {
  for (let guard = 0; guard < maxSteps; guard++) {
    settle(state)
    if (predicate(state)) return state
    assert.equal(state.status, 'playing', '对局提前结束')
    if (state.uiState === 'campaignHub') {
      if (!state.campaign.leadConfirmed) act(state, 0, findMove(state, 0, 'hubSetLeader'))
      const go = findMove(state, 0, 'hubGoSetup')
      act(state, 0, go || findMove(state, 0, 'hubSelectScenario'))
      continue
    }
    if (state.uiState === 'scenarioResult') {
      act(state, 0, findMove(state, 0, 'hubContinue'))
      continue
    }
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

/** 推进到深陷危局的开局（此时两关相邻的下一章是魔鬼礁）。 */
function startFirstScenario (state) {
  driveUntil(state, current => current.uiState === 'inScenario' && current.scenario?.id === FIRST_SCENARIO)
  assert.equal(state.storyInvestigators, undefined, '两章之间不应有故事调查员干扰')
  for (const inv of state.investigators) {
    assert.equal(state.campaign.investigators[inv.seat]?.code, inv.code, `座位 ${inv.seat} 身份应与战役记录一致`)
  }
  return state
}

/** 结束深陷危局，并把 AI 队友记为永久疯狂（与真实结局结算写进战役记录的状态一致）。 */
function endScenarioWithInsaneAi (state) {
  const oldCode = state.campaign.investigators[1].code
  state.campaign.investigators[1].status = 'insane'
  state.investigators[1].defeated = true
  const keys = Object.keys(state.scenario.resolutions || {})
  const resolutionKey = keys.find(key => key !== 'noResolution') || keys[0]
  act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
  assert.equal(state.uiState, 'scenarioResult', '本关结算后应停在 scenarioResult')
  return oldCode
}

/** 完成准备窗口：真人座位按合法列表推进，AI 座位走大厅兜底 autoHubMove（与真实 AI 回合同源）。 */
function completePreparation (state) {
  for (let guard = 0; guard < 100 && !state.hubReady; guard++) {
    settle(state)
    const seat = actingSeats(state)[0]
    assert.equal(Number.isInteger(seat), true, '准备窗口没有可行动的座位')
    if ((state.humanSeats || [0]).includes(seat)) {
      prepareSeat(state, seat)
    } else {
      const move = autoHubMove(state, seat, true)
      assert.ok(move, `AI 席位 ${seat} 没有兜底动作：${legalMoves(state, seat).map(item => item.action).join(',')}`)
      act(state, seat, move)
    }
  }
  assert.equal(state.hubReady, true, '全部席位确认后 hubReady 应为 true')
  return state
}

test('两关直接相邻时 AI 队友阵亡：下一关准备窗口重新开放换人，替补后能正常开局', () => {
  const state = startFirstScenario(newGame([{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }]))
  const oldCode = endScenarioWithInsaneAi(state)
  act(state, 0, findMove(state, 0, 'hubContinue'))
  // 修复前：hubReady 沿用上一轮的 true，界面显示「全队已就绪」，点开始关卡抛
  // 「调查员战役身份不可进入剧本」，且没有任何入口可以换人。
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow?.nodeId, SECOND_SCENARIO)
  assert.equal(state.hubReady, false, '存在阵亡席位时不应显示全队已就绪')
  assert.deepEqual(state.hubSeatDone, { 0: true }, '现役席位视为已确认，不必重复确认')
  assert.deepEqual(actingSeats(state), [1], '只有阵亡席位需要重新准备')
  assert.ok(legalMoves(state, 1).some(move => move.action === 'hubSelectInvestigator'),
    '阵亡席位必须能重新挑选调查员')
  assert.equal(state.hubSeatSelected?.[1], undefined, '阵亡席位重新进入「选择调查员」步骤')

  // AI 队友走大厅兜底动作换人；自动构筑后仍能像幕间一样调整 0 XP 起始牌组。
  act(state, 1, autoHubMove(state, 1, true))
  act(state, 1, autoHubMove(state, 1, true))
  assert.equal(state.hubSeatSelected?.[1], true)
  assert.ok(legalMoves(state, 1).some(move => move.action === 'hubSetDeck'),
    '自动构筑后仍可调整替补调查员的起始牌组')
  const replacement = state.campaign.investigators[1].code
  assert.notEqual(replacement, oldCode, '应换上新的调查员')
  assert.equal(state.campaign.investigators[1].status, 'active')
  assert.equal(state.campaign.investigators[1].xp, 0, '替补以 0 XP 起始牌组加入')
  act(state, 1, autoHubMove(state, 1, true))
  assert.equal(state.hubReady, true)
  assert.ok(state.campaign.retired.some(record => record.code === oldCode && record.status === 'insane'),
    '旧调查员应退回战役替补名单')
  assert.equal(state.investigators[1].code, replacement, '准备窗口里已切换到新调查员')

  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, SECOND_SCENARIO)
  assert.equal(state.investigators[1].code, replacement)
  assert.equal(state.campaign.investigators[1].code, replacement)
})

test('旧存档兜底：已停在「全队已就绪」的下一关准备里，开始关卡会先打开换人窗口而不是抛错', () => {
  const state = startFirstScenario(newGame([{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }], 'hub-replacement-legacy'))
  endScenarioWithInsaneAi(state)
  act(state, 0, findMove(state, 0, 'hubContinue'))
  // 还原修复前的坏状态：上一轮的确认标记仍在，hubReady 仍为 true，房主座位是决策座位。
  state.hubReady = true
  state.hubSeatDone = { 0: true, 1: true }
  state.hubSeatSelected = { 0: true, 1: true }
  state.currentSeat = 0
  const begin = findMove(state, 0, 'hubBeginScenario')
  assert.ok(begin, '坏存档里「开始当前关卡」应仍是可点的合法动作')

  act(state, 0, begin)
  assert.equal(state.uiState, 'scenarioSetup', '不应带着阵亡身份进入关卡')
  assert.equal(state.hubReady, false)
  assert.deepEqual(state.hubSeatDone, { 0: true })
  assert.deepEqual(actingSeats(state), [1])
  assert.ok(legalMoves(state, 1).some(move => move.action === 'hubSelectInvestigator'))

  completePreparation(state)
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  assert.equal(state.scenario.id, SECOND_SCENARIO)
})

test('两关直接相邻且无人阵亡时保持无缝推进：不强制重复确认准备', () => {
  const state = startFirstScenario(newGame([{ seat: 0, role: 'human' }], 'hub-replacement-clean'))
  const keys = Object.keys(state.scenario.resolutions || {})
  const resolutionKey = keys.find(key => key !== 'noResolution') || keys[0]
  act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
  act(state, 0, findMove(state, 0, 'hubContinue'))
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.hubReady, true, '无人阵亡时沿用原来的「已就绪」表现')
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  assert.equal(state.scenario.id, SECOND_SCENARIO)
})
