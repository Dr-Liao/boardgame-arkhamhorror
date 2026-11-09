// 四循环《万象无终》九章真实引擎冒烟（P1-12）。
//
// 目的：每个章节都用真实引擎路径建立对局——createGameState → 真实大厅 hub → 逐章真实推进
// （前章用调试结算推进，保留真实战役记录/幕间转场）→ 断言 setup 关键不变量、能连续执行若干
// 真实合法动作且无异常。不再用「合成 state + api stub」的钩子级测试充当章节可玩证据；
// 逐卡/章节规则仍由各章专项测试覆盖。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove, legalMoves } from '../src/engine/engine.js'
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
    try { applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }) } catch {
      try { resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, current => current) } catch { break }
    }
  }
  return state.pendingChoice || null
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
        try { applyMove(state, seat, candidate); applied = true; break } catch { /* try next seat */ }
      }
      if (applied) break
    }
    if (!applied) return false
  }
  return false
}

function endCurrentChapter (state) {
  settle(state)
  const keys = Object.keys(state.scenario?.resolutions || {})
  const resolutionKey = keys.find(key => key !== 'noResolution') || keys[0]
  try {
    applyMove(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
  } catch (error) {
    if (!/剧本结算完成/.test(String(error?.message))) throw error
  }
  settle(state)
  return driveHub(state)
}

// 一次真实流程走完 9 章，逐章留下现场快照（每个测试用独立 JSON 副本，互不污染）。
function buildChapterSnapshots () {
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: true, seed: 'tcu-chapter-smoke' },
    [{ seat: 0, role: 'human' }],
  )
  assert.equal(driveHub(state), true, '真实大厅流程应能进入序章')
  settle(state)
  const snapshots = []
  for (let index = 0; index < chapters.length; index++) {
    if (index > 0) assert.equal(endCurrentChapter(state), true, `应能进入第 ${index + 1} 章（${chapters[index].id}）`)
    assert.equal(state.scenario?.id, chapters[index].id, `第 ${index + 1} 章应为 ${chapters[index].id}`)
    settle(state)
    snapshots.push(JSON.parse(JSON.stringify(state)))
  }
  return snapshots
}

const snapshots = buildChapterSnapshots()

function stepSomeMoves (state, maxSteps = 12) {
  let steps = 0
  for (let guard = 0; guard < 120 && steps < maxSteps; guard++) {
    if (state.status !== 'playing' || state.uiState !== 'inScenario') break
    settle(state)
    const moves = legalMoves(state).filter(move => move.action !== 'debug')
    if (!moves.length) break
    const move = moves.find(item => item.action === 'investigate') || moves[0]
    try {
      applyMove(state, move.seat ?? state.currentSeat ?? 0, move)
      steps++
    } catch (error) {
      // 剧本自然结算会以 ScenarioEnded 抛「剧本结算完成」：冒烟遇到即停止，不算异常。
      if (/剧本结算完成/.test(String(error?.message))) break
      throw new Error(`第 ${steps + 1} 步执行 ${move.action} 抛异常：${error.message}`)
    }
    settle(state)
  }
  return steps
}

for (const [index, chapter] of chapters.entries()) {
  test(`P1-12 真实引擎冒烟：${chapter.id}（${chapter.name}）`, () => {
    const state = snapshots[index]
    // setup 关键不变量（与 full-scan §7 的逐章 setup 校验同口径）。
    assert.ok((state.locations || []).length >= 1, '至少 1 个地点入场')
    assert.ok((state.acts || []).length >= 1, '幕牌库非空')
    assert.ok((state.agendas || []).length >= 1, '议程牌库非空')
    assert.ok((state.encounterDeck || []).length >= 1, '遭遇牌库非空')
    assert.ok((state.chaosBag || []).length >= 1, '混乱袋非空')
    for (const location of state.locations) {
      assert.ok(location.id && location.name, `地点 ${location.id} 有 id/name`)
      assert.ok(Number.isFinite(location.shroud), `地点 ${location.id} 有数字隐藏值`)
      assert.ok(Array.isArray(location.connections), `地点 ${location.id} 有邻接表`)
    }
    for (const act of state.acts) assert.ok(act.name, '幕有名字')
    for (const agenda of state.agendas) assert.ok(agenda.name, '议程有名字')
    // 真实动作：连续执行若干合法动作，不允许出现引擎异常。
    const steps = stepSomeMoves(JSON.parse(JSON.stringify(state)), 12)
    assert.ok(steps >= 1, `章节 ${chapter.id} 至少能执行 1 个真实动作`)
  })
}
