// P8 修复回归（主进程）：
//   ① `applyResolutionEffects` 给内容层结局的 api.addTrauma 必须是 `(seat, kind, amount)` 口径
//      （真实 hub 结局分支：deadHeat resolution5 / congress resolution1 等）；
//   ② 章节结局的时间奖励（campaign.records.time）必须并入世界地图时间轴（tsk-map#mergeMapTime），
//      否则回到 worldMap 时被 map.time 覆盖，35 时间强制终局口径失真；
//   ③ 双面卡基础号（09519）在存档迁移中必须可解析；
//   ④ TSK 基础弱点 09124–09128 必须获许可，手动构筑 hubSetDeck 才能保存。
import test from 'node:test'
import assert from 'node:assert/strict'

import { actingSeats, applyMove, createGameState, legalMoves, unknownCardCodes } from '../src/engine/engine.js'
import { cardDef } from '../src/engine/card-lookup.js'
import { getAvailability } from '../src/deck/availability.js'
import { signatureAndWeaknesses } from '../src/deck/deckbuilding.js'
import { contentRegistry } from '../content/registered.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { mergeMapTime, worldMapState } from '../src/engine/tsk-map.js'
import { campaignFlowExtras } from '../content/campaigns/theScarletKeys/flow.js'

const CAMPAIGN_ID = 'theScarletKeys'
const MAP_NODE = 'worldMap'
const SAFE_CHOICES = ['done', 'skip', 'no', 'tell', 'continue', 'decline', 'cancel', 'ticket']
const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))
const findMove = (state, seat, action) => legalMoves(state, seat).find(move => move.action === action)

function settle (state, guardMax = 400) {
  for (let guard = 0; state.pendingChoice && guard < guardMax; guard += 1) {
    const choice = state.pendingChoice
    const safe = SAFE_CHOICES.map(id => choice.options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)
    const option = safe || choice.options.find(item => /^resolution\d/.test(String(item.id))) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  assert.ok(!state.pendingChoice, '待决选择未收敛')
  return state
}
function act (state, seat, move) {
  assert.ok(move, `缺少合法动作（座位 ${seat}）：${legalMoves(state, seat).map(item => item.action).join(',')}`)
  applyMove(state, seat, plainMove(move))
  return settle(state)
}
const atMap = state => state.uiState === 'interlude' && state.campaign.flowStage === 'map'
  && state.campaign.flow?.nodeId === MAP_NODE
function driveToMap (state, { maxSteps = 400 } = {}) {
  for (let step = 0; step < maxSteps; step += 1) {
    settle(state)
    if (atMap(state)) return state
    assert.equal(state.status, 'playing', `对局提前结束（${state.outcome}）`)
    if (state.uiState === 'campaignHub') {
      if (!state.campaign.leadConfirmed) { act(state, 0, findMove(state, 0, 'hubSetLeader')); continue }
      act(state, 0, findMove(state, 0, 'hubGoSetup') || findMove(state, 0, 'hubSelectScenario'))
      continue
    }
    if (state.uiState === 'scenarioResult') { act(state, 0, findMove(state, 0, 'hubContinue')); continue }
    if (state.uiState === 'scenarioSetup' && state.hubReady) {
      if (!state.campaign.leadConfirmed) { act(state, 0, findMove(state, 0, 'hubSetLeader')); continue }
      act(state, 0, findMove(state, 0, 'hubBeginScenario'))
      continue
    }
    if (state.uiState === 'scenarioSetup' || state.uiState === 'interlude') {
      const seat = actingSeats(state)[0]
      const moves = legalMoves(state, seat)
      act(state, seat, moves.find(item => item.action === 'hubAutoDeck')
        || moves.find(item => item.action === 'hubDoneSeat')
        || moves.find(item => item.action === 'hubSelectInvestigator')
        || moves.find(item => item.action === 'hubSetDeck'))
      continue
    }
    if (state.uiState === 'inScenario') {
      const keys = Object.keys(state.scenario.resolutions || {})
      const resolutionKey = keys.find(key => /^resolution\d/.test(key)) || keys[0]
      act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
      continue
    }
    settle(state)
  }
  assert.fail('未在预期步数内到达世界地图')
}
const travelNodeOf = destination => campaignFlowExtras.travelNodes?.[destination] || null
function startChapterFromMap (state, chapterId) {
  const embark = legalMoves(state, 0).find(move => move.action === 'hubEmbark' && travelNodeOf(move.destination) === chapterId)
  assert.ok(embark, `worldMap 相位缺少前往 ${chapterId} 的 hubEmbark 候选`)
  act(state, 0, embark)
  for (let guard = 0; guard < 80; guard += 1) {
    settle(state)
    if (state.uiState === 'inScenario' && state.scenario?.id === chapterId) return state
    assert.equal(state.status, 'playing', `进入 ${chapterId} 前对局结束（${state.outcome}）`)
    if (state.uiState === 'campaignHub') {
      if (!state.campaign.leadConfirmed) { act(state, 0, findMove(state, 0, 'hubSetLeader')); continue }
      act(state, 0, findMove(state, 0, 'hubGoSetup') || findMove(state, 0, 'hubSelectScenario'))
      continue
    }
    if (state.uiState === 'scenarioResult') { act(state, 0, findMove(state, 0, 'hubContinue')); continue }
    if (state.uiState === 'scenarioSetup' || state.uiState === 'interlude') {
      if (state.hubReady) {
        if (!state.campaign.leadConfirmed) { act(state, 0, findMove(state, 0, 'hubSetLeader')); continue }
        act(state, 0, findMove(state, 0, 'hubBeginScenario'))
        continue
      }
      const seat = actingSeats(state)[0]
      const moves = legalMoves(state, seat)
      act(state, seat, moves.find(item => item.action === 'hubAutoDeck')
        || moves.find(item => item.action === 'hubDoneSeat')
        || moves.find(item => item.action === 'hubSelectInvestigator')
        || moves.find(item => item.action === 'hubSetDeck'))
      continue
    }
  }
  assert.fail(`未能从世界地图进入章节 ${chapterId}`)
}

test('P8 TSK 修复：结局 api.addTrauma 使用 (seat, kind, amount) 口径，deadHeat 结局在真实 hub 不崩溃', () => {
  const state = createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed: 'p8-fix-trauma' },
    [{ seat: 0, role: 'human' }])
  driveToMap(state)
  startChapterFromMap(state, 'deadHeat')
  // deadHeat resolution5 的后果奖励会走 api.addTrauma(seat, 'mental', n)。
  applyMove(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'resolution5' })
  settle(state)
  assert.equal(state.status, 'playing', '真实 hub 结局结算不应崩溃')
  assert.ok(state.campaign.scenarioResults.some(result => result.scenarioId === 'deadHeat'))
  // 结局后能回到世界地图（真实 hubContinue/幕间/地图循环）。
  driveToMap(state)
  assert.ok(atMap(state))
})

test('P8 TSK 修复：mergeMapTime 把战役记录时间并入权威地图时间轴（章节奖励不被覆盖）', () => {
  const state = createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed: 'p8-fix-time' },
    [{ seat: 0, role: 'human' }])
  driveToMap(state)
  const before = worldMapState(state).time
  // 模拟章节结局奖励：records.time 增加后，mergeMapTime 取较大值并写回权威地图存储。
  state.campaign.records.time = before + 3
  const merged = mergeMapTime(state, state.campaign.records.time)
  assert.equal(merged, before + 3)
  assert.equal(worldMapState(state).time, before + 3, 'worldMapState 必须读到合并后的时间')
  // 后续旅行在合并后的时间上继续累计（真实 hubEmbark 路径）。
  state.campaign.records.time = merged
  startChapterFromMap(state, 'deadHeat')
  const map = worldMapState(state)
  assert.ok(map, '世界地图状态应存在')
  assert.ok(map.time >= before + 3, `旅行后时间不应回退：${map.time}`)
})

test('P8 TSK 修复：双面密钥基础号 09519 可解析，章节结算后存档迁移不再判未知卡', () => {
  // cards-data 只登记 09519a/b 面；cardDef 基础号必须回退到正面，否则 keysHeld 里的 09519 会被
  // unknownCardCodes 判成「存档引用的卡牌已不存在」而挡住冷启动续玩。
  const base = cardDef('09519')
  assert.ok(base, 'cardDef(09519) 必须解析双面卡基础号')
  assert.equal(base.code, '09519')
  assert.equal(base.linkedCardCode, '09519a')
  assert.ok(cardDef('09519a') && cardDef('09519b'))

  const state = createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed: 'p8-fix-09519' },
    [{ seat: 0, role: 'human' }])
  // 推进：首章 → 结算（此时 keysHeld 记录基础号 09519，旧实现 unknownCardCodes 会报未知卡）。
  for (let step = 0; step < 200; step += 1) {
    settle(state)
    if (state.uiState === 'campaignHub') {
      if (!state.campaign.leadConfirmed) { act(state, 0, findMove(state, 0, 'hubSetLeader')); continue }
      act(state, 0, findMove(state, 0, 'hubGoSetup') || findMove(state, 0, 'hubSelectScenario'))
      continue
    }
    if (state.uiState === 'scenarioSetup' && state.hubReady) { act(state, 0, findMove(state, 0, 'hubBeginScenario')); continue }
    if (state.uiState === 'scenarioSetup' || state.uiState === 'interlude') {
      const seat = actingSeats(state)[0]
      const moves = legalMoves(state, seat)
      act(state, seat, moves.find(item => item.action === 'hubAutoDeck') || moves.find(item => item.action === 'hubDoneSeat')
        || moves.find(item => item.action === 'hubSelectInvestigator') || moves.find(item => item.action === 'hubSetDeck'))
      continue
    }
    if (state.uiState === 'inScenario') {
      const keys = Object.keys(state.scenario.resolutions || {})
      act(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: keys.find(key => /^resolution\d/.test(key)) || keys[0] })
      continue
    }
    if (state.uiState === 'scenarioResult') break
  }
  assert.equal(state.uiState, 'scenarioResult')
  assert.ok(state.campaign.records.keysHeld.some(entry => String(entry).startsWith('09519')))
  assert.deepEqual(unknownCardCodes(state), [], '章节结算后的存档不得有未知卡号')
})

test('P8 TSK 修复：手动构筑 hubSetDeck 可保存（TSK 基础弱点 09124–09128 已获许可）', () => {
  const state = createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed: 'p8-fix-manual-deck' },
    [{ seat: 0, role: 'human' }])
  let saved = false
  for (let step = 0; step < 200 && !saved; step += 1) {
    settle(state)
    if (state.uiState === 'campaignHub') {
      if (!state.campaign.leadConfirmed) { act(state, 0, findMove(state, 0, 'hubSetLeader')); continue }
      act(state, 0, findMove(state, 0, 'hubGoSetup') || findMove(state, 0, 'hubSelectScenario'))
      continue
    }
    if (state.uiState !== 'scenarioSetup') break
    const seat = actingSeats(state)[0]
    const moves = legalMoves(state, seat)
    const record = state.campaign.investigators[seat]
    if (moves.some(move => move.action === 'hubAutoDeck') && !record?.startingDeckReady) {
      act(state, seat, moves.find(move => move.action === 'hubAutoDeck'))
      continue
    }
    if (record?.startingDeckReady && moves.some(move => move.action === 'hubSetDeck')) {
      // 用自动构筑产出的玩家卡重存一次：真实手动构筑入口（含基础弱点依赖校验）。
      const codes = record.deck.filter(code => getAvailability(code).deckbuilding === true)
      act(state, seat, { action: 'hubSetDeck', codes })
      const rebuilt = state.campaign.investigators[seat]
      assert.ok(rebuilt.startingDeckReady)
      assert.equal(rebuilt.deck.length, codes.length + 3, '30 张玩家卡 + 签名卡 + 基础弱点')
      // 自动构筑的基础弱点来自 core 池；手动保存必须保留一张合法基础弱点（依赖校验通过）。
      assert.ok(rebuilt.deck.some(code => cardDef(code)?.subtype === 'basicweakness'))
      // 战役清单的 5 张 TSK 基础弱点必须被构筑规则接受（真实 basicWeaknessPool 来源）。
      const tskPack = contentRegistry.getPack('tskPlayer')
      assert.deepEqual(tskPack.basicWeaknessCodes, ['09124', '09125', '09126', '09127', '09128'])
      for (const weakness of tskPack.basicWeaknessCodes) {
        assert.equal(cardDef(weakness)?.subtype, 'basicweakness')
        assert.equal(getAvailability(weakness).availability, 'strict')
      }
      const pool = signatureAndWeaknesses(INVESTIGATORS['09001'], () => 0, { basicWeaknessPool: tskPack.basicWeaknessCodes })
      assert.ok(tskPack.basicWeaknessCodes.includes(pool.basicWeaknesses[0]))
      saved = true
      continue
    }
    act(state, seat, moves.find(item => item.action === 'hubSelectInvestigator')
      || moves.find(item => item.action === 'hubDoneSeat'))
  }
  assert.ok(saved, '未能通过真实 hubSetDeck 保存手动牌组')
})
