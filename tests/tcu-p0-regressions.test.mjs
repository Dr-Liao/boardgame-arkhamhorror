// 四循环《万象无终》P0 修复回归：全部走真实引擎路径（createGameState → 真实 hub / startScenario → legalMoves/applyMove）。
//
// 覆盖 full-scan.md 的 4 个 P0：
//   1. 《隐秘之名》05130「乔的房间」：牌组含同名卡两张时不再因重复选项 id 崩溃；
//   2. 《恶罪报应》幽灵面翻面保留地点线索（backFace 不再把未印刷的背面线索写成 0）；
//   3. 《恶罪报应》双面地点翻面后仍能按分组识别（LOCATION_VARIANTS 正/背面归一化）；
//   4. 《崇高利益》05201「渗透秘社」1a 正面反应从开局起即生效（infiltrationReactionActive）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createGameState, applyMove, legalMoves, startScenario,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'
import { locationGroupOf } from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/behavior.js'

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
    { campaignId: 'theCircleUndone', campaignHub: true, seed: 'tcu-p0-regression' },
    [{ seat: 0, role: 'human' }],
  )
  assert.equal(driveHub(state), true, '真实大厅流程应能进入序章')
  // 进入剧本后可能还有开局选择（故事调查员/塔罗等），必须先收敛，避免把旧事务带进下一次 resolveTransaction。
  assert.equal(settle(state), null, '开局待决选择应收敛')
  return state
}

function startScenarioAt (state, scenarioId) {
  const index = chapters.findIndex(chapter => chapter.id === scenarioId)
  assert.ok(index >= 0, `未知章节 ${scenarioId}`)
  state.campaign.scenarioIndex = index
  state.campaign.flow.nodeId = scenarioId
  state.campaign.flow.visits = { ...(state.campaign.flow.visits || {}), [scenarioId]: 1 }
  assert.equal(settle(state), null, '开局前不应残留待决选择')
  state.continuation = null
  resolveTransaction(state, 0, { action: 'tcuP0TestStart' }, current => startScenario(current, index, []))
  settle(state)
  assert.equal(state.scenario?.id, scenarioId)
  return state
}

test('P0-1 05130 乔的房间：牌组含同名卡两张时场景行动不崩溃且正确检索', () => {
  const state = startScenarioAt(baseState(), 'theSecretName')
  const inv = state.investigators[0]
  const room = state.locations.find(location => String(location.originalCode || location.code) === '05130')
  assert.ok(room, '乔的房间应在场（本章 setup 会放 7 个地点）')
  inv.location = room.id
  state.currentSeat = inv.seat
  state.phase = 'investigation'
  // 构造「牌组里有两张同名祝福/道具支援」的常见情形（真实牌组通常带 2 张同名卡）。
  const itemCode = Object.keys(ALL_CARDS).find(code => {
    const card = ALL_CARDS[code]
    return card?.type === 'asset' && (card.traits || []).some(trait => ['Blessed', 'Item'].includes(trait))
  })
  assert.ok(itemCode, '应存在祝福/道具支援')
  inv.deck.push(itemCode, itemCode)
  settle(state)
  const deckBefore = [...state.investigators[inv.seat].deck]
  const action = legalMoves(state, inv.seat).find(move => move.action === 'scenarioAction' && move.rule === 'joeSearchBlessed')
  assert.ok(action, '乔的房间场景行动应出现在 legalMoves')
  const result = apply(state, inv.seat, action)
  assert.equal(result.ok, true, result.ok ? '' : `执行场景行动不应抛错：${result.error?.message}`)
  settle(state)
  const current = state.investigators[inv.seat]
  assert.equal(state.scenarioFlags?.joeSearchUsed, true, '团队每场一次应被消耗')
  assert.equal(current.deck.length, deckBefore.length - 1, '检索应把选中的卡从牌组移到手牌')
  assert.ok(current.hand.length >= 1, '检索到的支援应进入手牌')
  assert.ok(current.hand.some(code => deckBefore.includes(code)), '进入手牌的应是牌组里的祝福/道具支援')
})

test('P0-2 《恶罪报应》幽灵面翻面保留地点线索', () => {
  const state = startScenarioAt(baseState(), 'theWagesOfSin')
  // 真实顺序：先推进幕（05164 背面给地点加线索），再推进议程（幕 2 时「将每个地点翻到其幽灵面」）。
  const actAdvanced = apply(state, 0, { action: 'debug', kind: 'advanceAct' })
  assert.equal(actAdvanced.ok, true, actAdvanced.ok ? '' : `推进幕不应失败：${actAdvanced.error?.message}`)
  settle(state)
  const before = new Map(state.locations.map(location => [location.id, {
    clues: location.clues,
    maxClues: location.maxClues,
    code: String(location.originalCode || location.code),
  }]))
  assert.ok([...before.values()].some(row => row.clues > 0), '翻面前应至少有一处地点有线索')
  const agendaAdvanced = apply(state, 0, { action: 'debug', kind: 'advanceAgenda' })
  assert.equal(agendaAdvanced.ok, true, agendaAdvanced.ok ? '' : `推进议程不应失败：${agendaAdvanced.error?.message}`)
  settle(state)
  const flipped = state.locations.filter(location => String(location.originalCode || location.code).endsWith('b'))
  assert.ok(flipped.length > 0, '应有地点翻到幽灵面')
  for (const location of flipped) {
    const previous = before.get(location.id)
    if (!previous) continue
    assert.equal(location.clues, previous.clues,
      `地点「${location.name || location.id}」翻面后线索应保留（${previous.clues} → ${location.clues}）`)
    assert.ok((location.maxClues || 0) >= (previous.maxClues || 0), '翻面不应缩小 maxClues')
  }
})

test('P0-3 《恶罪报应》双面地点翻面后仍按分组识别（正/背面卡号归一化）', () => {
  const state = startScenarioAt(baseState(), 'theWagesOfSin')
  const actAdvanced = apply(state, 0, { action: 'debug', kind: 'advanceAct' })
  assert.equal(actAdvanced.ok, true, actAdvanced.ok ? '' : `推进幕不应失败：${actAdvanced.error?.message}`)
  settle(state)
  const agendaAdvanced = apply(state, 0, { action: 'debug', kind: 'advanceAgenda' })
  assert.equal(agendaAdvanced.ok, true, agendaAdvanced.ok ? '' : `推进议程不应失败：${agendaAdvanced.error?.message}`)
  settle(state)
  const placed = state.locations.filter(location => String(location.originalCode || location.code).endsWith('b'))
  assert.ok(placed.length > 0, '应有地点翻到幽灵面')
  const gallows = placed.find(location => /^05169b$|^05170b$/.test(String(location.originalCode || location.code)))
  if (gallows) assert.equal(locationGroupOf(state, gallows.id), 'theGallows', '翻面后的绞刑架应仍归入 theGallows 组')
  const attic = placed.find(location => String(location.originalCode || location.code) === '05175b')
    || placed.find(location => String(location.originalCode || location.code) === '05176b')
  if (attic) assert.equal(locationGroupOf(state, attic.id), 'chapelAttic', '翻面后的教堂阁楼应仍归入 chapelAttic 组')
  // 至少应命中一组（11 对地点每组各放 1 张，绞刑架/阁楼必有其一）。
  assert.ok(gallows || attic, '绞刑架或教堂阁楼应至少有一处入场')
})

test('P0-4 05201《渗透秘社》1a 正面反应从开局起生效', () => {
  const state = startScenarioAt(baseState(), 'forTheGreaterGood')
  assert.equal(String(state.acts?.[0]?.originalCode || state.acts?.[0]?.code), '05201',
    '本测试假设默认（非成员）路线，幕 1a 为渗透秘社')
  assert.equal(state.scenarioFlags?.infiltrationReactionActive, true,
    '幕 1a 正面印刷的转化反应应在开局即生效（不能等幕背面揭示才置真）')
})
