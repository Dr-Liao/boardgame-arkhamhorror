// P7《铁杉谷盛宴》战役层 × 真实引擎的回归：末段路线（最终日黎明 → 最终夜 → 终章）不能递归爆栈。
//
// 背景（P7 浏览器验收实测缺陷）：`preludeTheFinalEvening` 的 `resolution` 钩子会在引擎结算过程中
// 再次调用 `api.finish`（印刷「改为结算结局 N」），而引擎 `finishScenario` 已经在外层结算本关。
// 修复前 `structuredClone` 在无限递归里爆栈，真实大厅里 `结束这关` 直接 500，终章不可达。
// 本测试用真实引擎（createGameState → hub 准备 → hubBeginScenario → debug endScenario）走完
// 「欢迎 → 岩间密语 → 扭曲空洞 → 第二日黎明 → 最终日黎明 → 最终夜 → 终章」，断言：
//   · 最终夜可结算且不递归（scenarioResults 记录本关、状态推进而不是异常）；
//   · 真实进入 `fateOfTheVale`（终章）后续可再结算到战役尾声。
import test from 'node:test'
import assert from 'node:assert/strict'

import { applyMove, createGameState, decisionSeat, legalMoves, validateMove } from '../src/engine/engine.js'
import { migrateState } from '../src/engine/save-migration.js'
import { contentRegistry } from '../content/registered.js'

const RESOLUTION_KEY = scenarioId => {
  const data = contentRegistry.getScenarioData(scenarioId)
  const keys = Object.keys(data?.resolutions || {})
  return keys.find(key => key !== 'noResolution') || keys[0]
}

// 序曲/勘察选择的路线答案（与浏览器 spec 的 LATE_GAME_ROUTE 一致）：
// 第 1 日选《岩间密语》→ 首夜寻找伯蒂 → 两次「跳过本次勘察」把时钟推到最终夜。
const ANSWERS = ['岩间密语', '跳过', '不要再吃', '寻找伯蒂', '跳过本次勘察', '跳过', '在夜间收集',
  '跳过本次勘察', '跳过本次勘察', '跳过本次勘察']

const move = (state, action, extra = {}) => {
  const seat = decisionSeat(state)
  const payload = { action, ...extra }
  const error = validateMove(state, seat, payload)
  assert.equal(error, null, `非法 move ${action}: ${error}`)
  return applyMove(state, seat, payload)
}

function labelOf(choice) {
  return (choice.options || []).map(option => ({
    id: option.id,
    text: String(option.label ?? option.text ?? option.name ?? option.id),
  }))
}

test('P7 终章可达 + P8 传家宝跨章：最终夜结算不递归，Worry Rock/Pearl Diary 登记入战役牌组', () => {
  const state = createGameState({
    campaignId: 'theFeastOfHemlockVale',
    campaignHub: true,
    playerInvestigator: '10001',
    seed: 'fhv-final-evening-engine',
  }, [{ seat: 0, role: 'human' }])
  // P8：第二夜 Resolution 2 的珀尔日记只在「失落的姐妹里找回日记」后发放；测试直接把前置记录摆上，
  // 验证第二夜入场按印刷效果把 The Pearl Diary（10715）加入牌组并写 heirloomsAwarded。
  state.campaign.records.madamePearlsDiaryWasRecovered = true
  const entered = []
  let answerIndex = 0
  let previous = null
  let pickedHeirloomCodex = false
  let checkedDay2Save = false
  for (let guard = 0; guard < 300; guard++) {
    const scenario = state.scenario?.id
    if (scenario && scenario !== previous) { entered.push(scenario); previous = scenario }
    if (state.pendingChoice) {
      const choice = state.pendingChoice
      const options = labelOf(choice)
      let optionId = options[0]?.id
      // 第一夜法典六选一里主动选 Π（友善的陌生人）→ Worry Rock 10713。
      const pi = options.find(option => option.id === 'pi')
      if (pi && !pickedHeirloomCodex) {
        optionId = pi.id
        pickedHeirloomCodex = true
      } else if (choice.kind !== 'mechanic') {
        for (let probe = answerIndex; probe < ANSWERS.length; probe++) {
          const match = options.find(option => option.text.includes(ANSWERS[probe]))
          if (match) { optionId = match.id; answerIndex = probe + 1; break }
        }
      }
      move(state, 'choose', { choiceId: choice.id, optionId })
      continue
    }
    if (state.uiState === 'inScenario') {
      // P8 存档恢复：第二日黎明这类「带序曲 StepCode（10677a 等）」的战役进行中存档必须可读。
      // 修复前 unknownCardCodes 会把 StepCode 误当未知玩家卡 → 存档管理「读取此存档」禁用。
      if (scenario === 'dawnOfTheSecondDay' && !checkedDay2Save) {
        const restored = migrateState(JSON.parse(JSON.stringify(state))).state
        assert.equal(restored.campaign.id, 'theFeastOfHemlockVale')
        assert.equal(restored.scenario.id, 'dawnOfTheSecondDay')
        checkedDay2Save = true
      }
      if (scenario === 'fateOfTheVale') break
      // 真实 debug 结算原语（与浏览器验收同一个 `/api/debug` 通道的底层 move）。
      move(state, 'debug', { kind: 'endScenario', resolutionKey: RESOLUTION_KEY(scenario) })
      continue
    }
    const legal = legalMoves(state)
    const order = ['hubBeginScenario', 'hubContinue', 'hubDoneSeat', 'hubConfirmDeck', 'hubAutoDeck',
      'hubSelectInvestigator', 'hubGoSetup', 'hubSelectScenario']
    const next = order
      .map(action => legal.find(candidate => candidate.action === action))
      .find(Boolean)
      || legal[0]
    assert.ok(next, `局外页没有可推进动作（ui=${state.uiState}，node=${state.campaign?.flow?.nodeId}）`)
    move(state, next.action, next)
  }
  assert.deepEqual(entered, [
    'welcomeToHemlockVale', 'writtenInRock', 'theTwistedHollow', 'dawnOfTheSecondDay',
    'dawnOfTheFinalDay', 'preludeTheFinalEvening', 'fateOfTheVale',
  ], '末段真实路线')
  assert.equal(state.scenario.id, 'fateOfTheVale', '终章已上桌')
  assert.ok(state.campaign.scenarioResults.some(result => result.scenarioId === 'preludeTheFinalEvening'),
    '最终夜的结算结果已记录（未递归丢失）')
  // P8 传家宝：第一夜法典 Π 发放 Worry Rock（10713）；第二夜封面记录触发 Pearl Diary（10715）。
  const awarded = state.campaign.records.heirloomsAwarded || []
  assert.ok(awarded.includes('10713'), `Worry Rock 应登记 heirloomsAwarded（实际 ${awarded.join(',')}）`)
  assert.ok(awarded.includes('10715'), `Pearl Diary 应登记 heirloomsAwarded（实际 ${awarded.join(',')}）`)
  const campaignDeck = Object.values(state.campaign.investigators || {})
    .flatMap(record => record.deck || [])
  assert.ok(campaignDeck.includes('10713'), 'Worry Rock 应加入战役牌组')
  assert.ok(campaignDeck.includes('10715'), 'Pearl Diary 应加入战役牌组')
  // 终章再结算一次：必须正常进入尾声而不是异常/无限递归。
  move(state, 'debug', { kind: 'endScenario', resolutionKey: RESOLUTION_KEY('fateOfTheVale') })
  assert.notEqual(state.uiState, 'inScenario', '终章结算后离开牌桌')
})
