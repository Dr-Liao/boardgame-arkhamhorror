// P8 TSK 定制升级卡（Customizable）：构筑期初始勾选 + 关间升级的真大厅引擎路径。
//
// 覆盖 docs/campaign/theScarletKeys/README.md §5 与 interactions.md 的定制勾选契约：
//   ① 真实 createGameState({ campaignId: 'theScarletKeys', campaignHub: true }) 驱动到首章前
//      scenarioSetup：观察投影 `state.mechanics.tsk.customizationHub` 存在、勾选全空、可升级为 false、
//      房主合法动作里**没有** hubCustomize（初始 0 XP，不伪造经验）；
//   ② 首章 → 真实关末结算 → hubContinue → interlude：XP 不足时无候选；真实调试通道给经验后
//      房主合法动作逐选项出现 hubCustomize（cost=1 / availableXp=当前未花费 XP / label 含「第 N 格 / 1 XP」）；
//   ③ 提交一格 → `campaign.tsk.customizations.bySeat[0][code]` 增长、record.xp 减 1、spentXp 加 1、
//      等级 = ceil(勾选数/2)、投影同步；JSON 存档往返后继续成功；
//   ④ 非房主（座位 1）没有 hubCustomize 候选、伪造提交被拒；
//   ⑤ 至少 3 张定制卡（09021 猎人护甲 / 09041 实证假设 / 09042 鸦翎羽毛笔，含多选项卡）真走一次勾选；
//   ⑥ 选项容量边界：4 格选项勾满后不再为该选项生成候选，继续提交被拒。
//
// 近似/夹具口径（逐条披露）：
//   · approximation: 定制卡进入牌组走**真实自动构筑**（hubAutoDeck）——16 张定制卡是 0 级卡，
//     自动构筑器的评分只有部分调查员会选中它们（如 02002/04002/07003 必选 09042；09001 在部分种子下
//     选中 09021；06002 多数种子选中 09041）。本用例因此按调查员 + 种子选取「自动牌组含定制卡」的
//     真实组合，不向 `campaign.investigators[seat].deck` 注入卡号，也不改构筑器。
//     手工保存牌组（hubSetDeck）在《绯红密钥》目前会因 `basicWeaknessPool` 收进该循环 5 张
//     catalog-only 基础弱点（09124–09128）而被 `signatureAndWeaknesses` 判非法（跨循环引擎读点，
//     不在本 worker 写权限）；浏览器验收因此同样只走自动构筑路径，并在报告 remaining 里记录。
//   · approximation: 首章用真实调试指令 `debug.endScenario`（与大厅「结束这关」同一 finishScenario
//     路径，含真实 XP/记录/结局结算）推进到关间；XP 通过真实 host-only 调试指令 `debug.xp`
//     （引擎 `awardExperience`）发放，JSON 只经 `JSON.parse(JSON.stringify())` 往返，不写字段。
//   · approximation: 初始构筑期「有初始经验才给候选」的分支在本循环不会触发（战役初始 0 XP），
//     因此只断言「面板可见 + 0 勾选 + 无候选」；初始候选的落库路径与关间共用同一条
//     `upgradeCustomization` 原语（见 tsk-primitives-customizable.test.mjs）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { actingSeats, applyMove, createGameState, legalMoves } from '../src/engine/engine.js'
import { customizationLevel, customizationOptions, customizationsOfSeat } from '../src/engine/tsk-customizable.js'
import { mechanicView } from '../src/integration/mechanic-view.js'

const CAMPAIGN_ID = 'theScarletKeys'
const HUB = 'customizationHub'
const SAFE_CHOICES = ['done', 'skip', 'no', 'tell', 'continue', 'decline', 'cancel', 'ticket']

// 真实自动构筑会选中定制卡的「调查员 + 开局种子」组合（见文件头 approximation 1）。
const CASES = Object.freeze({
  hunterArmor: { investigator: '09001', seed: 3, code: '09021' },
  empirical: { investigator: '06002', seed: 1, code: '09041' },
  quill: { investigator: '09015', seed: 1, code: '09042' },
})

const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

/** 应答待决选择（与 tsk-p8-campaign 同口径：优先不推进坏分支的安全选项）。 */
function settle(state, max = 400) {
  for (let guard = 0; state.pendingChoice && guard < max; guard += 1) {
    const choice = state.pendingChoice
    const safe = SAFE_CHOICES
      .map(id => choice.options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)
    const option = safe || choice.options.find(item => /^resolution\d/.test(String(item.id))) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  assert.ok(!state.pendingChoice, '待决选择未收敛')
  return state
}

function act(state, seat, move) {
  assert.ok(move, `缺少合法动作（座位 ${seat}）：${legalMoves(state, seat).map(item => item.action).join(',')}`)
  const events = applyMove(state, seat, plainMove(move))
  settle(state)
  return events
}

const findMove = (state, seat, action, predicate = () => true) =>
  legalMoves(state, seat).find(move => move.action === action && predicate(move))
const customizeMoves = (state, seat = 0) => legalMoves(state, seat).filter(move => move.action === 'hubCustomize')
const hubPanel = (state, seat = 0) => mechanicView(state, seat)?.tsk?.[HUB] || null
const entryOf = (state, code, seat = 0) => hubPanel(state, seat)?.entries.find(entry => entry.code === code) || null

/** 真实大厅流程推进到首章前的 scenarioSetup（选人 + 自动构筑），返回状态。 */
function scenarioSetup({ seed, investigator, seats = 1 }) {
  const players = Array.from({ length: seats }, (_, seat) => ({ seat, role: 'human' }))
  const state = createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed, difficulty: 'standard' }, players)
  assert.equal(state.uiState, 'campaignHub')
  for (let guard = 0; guard < 12; guard += 1) {
    settle(state)
    if (state.uiState !== 'campaignHub') break
    if (!state.campaign.leadConfirmed) { act(state, 0, findMove(state, 0, 'hubSetLeader')); continue }
    act(state, 0, findMove(state, 0, 'hubGoSetup') || findMove(state, 0, 'hubSelectScenario'))
  }
  assert.equal(state.uiState, 'scenarioSetup')
  const candidate = findMove(state, 0, 'hubSelectInvestigator', move => move.code === investigator)
  assert.ok(candidate, `调查员 ${investigator} 不在真实可选列表（当前主路径：${legalMoves(state, 0)
    .filter(move => move.action === 'hubSelectInvestigator').length} 个候选）`)
  act(state, 0, candidate)
  act(state, 0, findMove(state, 0, 'hubAutoDeck'))
  return state
}

/** 首章前准备确认 → 真实开始首章 → 真实关末结算 → hubContinue → 幕间。 */
function driveToInterlude(state) {
  assert.equal(state.uiState, 'scenarioSetup')
  if (!state.hubReady) {
    const seat = actingSeats(state)[0]
    const done = findMove(state, seat, 'hubDoneSeat')
    assert.ok(done, `准备阶段应可确认准备（座位 ${seat}）：${legalMoves(state, seat).map(move => move.action).join(',')}`)
    act(state, seat, done)
  }
  assert.equal(state.hubReady, true, '确认准备后全桌应已准备')
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  assert.equal(state.uiState, 'inScenario')
  const keys = Object.keys(state.scenario.resolutions || {})
  const resolutionKey = keys.find(key => /^resolution\d/.test(key)) || keys[0]
  assert.ok(resolutionKey, '首章必须有可结算结局')
  act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
  assert.equal(state.uiState, 'scenarioResult')
  act(state, 0, findMove(state, 0, 'hubContinue'))
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.upgradesAllowed, true, '幕间必须开放升级窗')
  settle(state)
  return state
}

/** 真实 host-only 调试通道发放经验（引擎 awardExperience）。 */
function awardXp(state, amount) {
  act(state, 0, { action: 'debug', kind: 'xp', targetSeat: 0, amount })
  assert.equal(state.campaign.investigators[0].xp, amount, `调试经验应写入战役记录（${amount}）`)
}

function jsonRoundtrip(state) {
  return JSON.parse(JSON.stringify(state))
}

const deckOf = (state, seat = 0) => state.campaign.investigators[seat]?.deck || []

// ---------------------------------------------------------------------------
// 1. 首章前 scenarioSetup：投影存在、全 0 勾选、无候选（0 XP）
// ---------------------------------------------------------------------------
test('P8 TSK 定制卡：首章前构筑期投影显示 0 勾选，0 XP 不产生 hubCustomize 候选', () => {
  const state = scenarioSetup(CASES.quill)
  assert.equal(state.uiState, 'scenarioSetup')
  assert.ok(deckOf(state).includes(CASES.quill.code), '真实自动构筑的牌组必须含定制卡 09042')

  const panel = hubPanel(state)
  assert.ok(panel, 'scenarioSetup 必须投影 tsk.customizationHub')
  assert.equal(panel.availableXp, 0)
  assert.equal(panel.entries.length, 1)
  const entry = entryOf(state, CASES.quill.code)
  assert.equal(entry.code, '09042')
  assert.equal(entry.name, ALL_CARDS['09042'].nameZh)
  assert.deepEqual(entry.checked, [])
  assert.equal(entry.level, 0)
  assert.equal(entry.xpPerCheck, 1)
  assert.equal(entry.canUpgrade, false)
  assert.equal(entry.options.length, customizationOptions('09042').length)
  assert.deepEqual(entry.options.map(option => option.checkedCount), entry.options.map(() => 0))
  assert.equal(state.campaign.tsk?.customizations, undefined, '未勾选不应创建定制容器')

  assert.deepEqual(customizeMoves(state), [], '初始 0 XP 不得生成 hubCustomize 候选')
  // 投影只给 observer 本人：别的座位没有牌组 ⇒ 没有面板。
  assert.equal(mechanicView(state, 1)?.tsk?.[HUB] ?? null, null)
  // 初始构筑期仍然可确认准备/开始关卡（面板不挡主路径）。
  assert.ok(legalMoves(state, 0).some(move => move.action === 'hubDoneSeat'))
})

// ---------------------------------------------------------------------------
// 2. 幕间：XP 不足无候选 → 发经验 → 提交一格 → 记录/投影/日志/JSON 往返
// ---------------------------------------------------------------------------
test('P8 TSK 定制卡：幕间提交一格写入 bySeat、扣 1 XP、等级与投影更新，JSON 往返后继续', () => {
  const state = driveToInterlude(scenarioSetup(CASES.hunterArmor))
  assert.equal(state.campaign.flow.nodeId, 'interlude1')
  assert.deepEqual(customizeMoves(state), [], '0 XP 的幕间不得生成定制候选')
  const before = hubPanel(state)
  assert.equal(before.availableXp, 0)
  assert.equal(before.entries[0].canUpgrade, false)

  awardXp(state, 3)
  const moves = customizeMoves(state)
  assert.ok(moves.length >= 7, `XP 足够时应逐选项给出候选（实际 ${moves.length}）`)
  for (const move of moves) {
    assert.equal(move.cost, 1)
    assert.equal(move.availableXp, 3)
    assert.match(move.label, /^定制：/)
    assert.match(move.label, /（第 1 格 \/ 1 XP）$/)
  }
  const optionIndex = 1 // Protective Runes（2 格）
  const move = moves.find(item => item.code === '09021' && item.optionIndex === optionIndex)
  assert.ok(move, '应有 09021 选项 1（Protective Runes）的候选')
  const events = act(state, 0, move)

  assert.deepEqual(state.campaign.tsk.customizations.bySeat[0]['09021'], [optionIndex])
  assert.equal(state.campaign.investigators[0].xp, 2, 'record.xp 应扣 1')
  assert.equal(state.campaign.investigators[0].spentXp, 1)
  assert.equal(state.campaign.xp, 2, '战役经验合计同步')
  assert.equal(customizationLevel([optionIndex]), 1)
  assert.deepEqual(customizationsOfSeat(state, 0), { '09021': [optionIndex] })
  const text = events.filter(event => event.type === 'info').map(event => event.text).join('\n')
  assert.match(text, /定制升级：猎人护甲 · Protective Runes 第 1 格（-1 XP）/)

  const entry = entryOf(state, '09021')
  assert.deepEqual(entry.checked, [optionIndex])
  assert.equal(entry.level, 1)
  assert.equal(entry.canUpgrade, true)
  assert.equal(entry.options[optionIndex].checkedCount, 1)
  assert.equal(hubPanel(state).availableXp, 2)
  // 选项还有 1 格空位 ⇒ 候选仍包含该选项（第 2 格）。
  const remaining = customizeMoves(state).find(item => item.code === '09021' && item.optionIndex === optionIndex)
  assert.ok(remaining)
  assert.match(remaining.label, /（第 2 格 \/ 1 XP）$/)
  // JSON 存档往返（只做结构化克隆，不补字段）后继续升级。
  const restored = jsonRoundtrip(state)
  assert.deepEqual(restored.campaign.tsk.customizations.bySeat[0]['09021'], [optionIndex])
  assert.deepEqual(entryOf(restored, '09021').checked, [optionIndex])
  const second = customizeMoves(restored).find(item => item.code === '09021' && item.optionIndex === optionIndex)
  act(restored, 0, second)
  assert.deepEqual(restored.campaign.tsk.customizations.bySeat[0]['09021'], [optionIndex, optionIndex])
  assert.equal(restored.campaign.investigators[0].xp, 1)
  assert.equal(entryOf(restored, '09021').level, 1, '2 格 = ceil(2/2) = 1 级')
  assert.equal(entryOf(restored, '09021').options[optionIndex].checkedCount, 2)

  // 该选项已满：不再为该选项生成候选，但仍可勾别的选项。
  const afterFull = customizeMoves(restored)
  assert.ok(afterFull.length > 0, '其它选项仍有空位')
  assert.ok(!afterFull.some(item => item.optionIndex === optionIndex),
    '满格选项不得再生成候选')
  assert.throws(() => applyMove(restored, 0, plainMove(second)),
    /当前不可执行该局外操作|已经勾满/)
})

// ---------------------------------------------------------------------------
// 3. 三张定制卡各走一次真实勾选（含多选项卡）＋容量边界
// ---------------------------------------------------------------------------
test('P8 TSK 定制卡：至少 3 张定制卡真实勾选，4 格选项勾满后不再给候选', () => {
  const covered = []
  // 09021（猎人护甲）：一次勾选。
  {
    const state = driveToInterlude(scenarioSetup(CASES.hunterArmor))
    awardXp(state, 2)
    const move = customizeMoves(state).find(item => item.code === '09021' && item.optionIndex === 5)
    act(state, 0, move)
    assert.deepEqual(state.campaign.tsk.customizations.bySeat[0]['09021'], [5])
    covered.push({ code: '09021', checked: [5] })
  }
  // 09041（实证假设）：一次勾选（另一张卡）。
  {
    const state = driveToInterlude(scenarioSetup(CASES.empirical))
    assert.ok(deckOf(state).includes('09041'), '真实自动构筑的牌组必须含 09041')
    awardXp(state, 2)
    const move = customizeMoves(state).find(item => item.code === '09041' && item.optionIndex === 0)
    act(state, 0, move)
    assert.deepEqual(state.campaign.tsk.customizations.bySeat[0]['09041'], [0])
    covered.push({ code: '09041', checked: [0] })
  }
  // 09042（鸦翎羽毛笔）：4 格选项勾满 → 容量边界。
  {
    const state = driveToInterlude(scenarioSetup(CASES.quill))
    const options = customizationOptions('09042')
    const capacityIndex = options.findIndex(option => option.checks === 4)
    assert.ok(capacityIndex >= 0, '09042 必须有 4 格选项（Supernatural Record）')
    assert.equal(options[capacityIndex].checks, 4)
    awardXp(state, 6)
    const submitted = []
    for (let step = 0; step < 4; step += 1) {
      const move = customizeMoves(state)
        .find(item => item.code === '09042' && item.optionIndex === capacityIndex)
      assert.ok(move, `第 ${step + 1} 格应仍有候选`)
      act(state, 0, move)
      submitted.push(capacityIndex)
    }
    assert.deepEqual(state.campaign.tsk.customizations.bySeat[0]['09042'], submitted)
    assert.equal(state.campaign.investigators[0].xp, 2, '6 XP 勾 4 格后剩 2')
    const entry = entryOf(state, '09042')
    assert.equal(entry.options[capacityIndex].checkedCount, 4)
    assert.equal(entry.checked.length, 4)
    assert.equal(entry.level, 2)
    assert.ok(!customizeMoves(state).some(item => item.code === '09042' && item.optionIndex === capacityIndex),
      '勾满的选项不得再生成候选')
    assert.ok(customizeMoves(state).some(item => item.code === '09042' && item.optionIndex !== capacityIndex))
    assert.throws(() => applyMove(state, 0, { action: 'hubCustomize', code: '09042', optionIndex: capacityIndex, cost: 1, availableXp: 2 }),
      /当前不可执行该局外操作|已经勾满/)
    covered.push({ code: '09042', checked: submitted })
  }
  assert.deepEqual(covered.map(item => item.code).sort(), ['09021', '09041', '09042'])
})

// ---------------------------------------------------------------------------
// 4. XP 不足与非房主越权
// ---------------------------------------------------------------------------
test('P8 TSK 定制卡：非房主没有候选且伪造提交被拒；XP 不足时无候选', () => {
  const state = scenarioSetup({ seed: 1, investigator: '02002', seats: 2 })
  assert.equal(state.investigators.length, 2)
  // 座位 1（AI）由真实 autoHubMove 路径准备：Node 里按同一组 hub 动作手工推进到全桌就绪。
  let guard = 0
  while (!state.hubReady && guard < 12) {
    guard += 1
    const seat = actingSeats(state)[0]
    const moves = legalMoves(state, seat)
    const move = moves.find(item => item.action === 'hubDoneSeat')
      || moves.find(item => item.action === 'hubAutoDeck')
      || moves.find(item => item.action === 'hubSelectInvestigator')
    assert.ok(move, `座位 ${seat} 准备阶段缺少动作：${moves.map(item => item.action).join(',')}`)
    act(state, seat, move)
  }
  assert.equal(state.hubReady, true, '两名调查员都必须准备完成')
  driveToInterlude(state)
  assert.equal(state.uiState, 'interlude')

  // 座位 1 没有定制候选（定制升级由房主执行）。
  assert.deepEqual(customizeMoves(state, 1), [])
  assert.throws(() => applyMove(state, 1, { action: 'hubCustomize', code: '09042', optionIndex: 0, cost: 1, availableXp: 3 }),
    /现在不是你的应答时机|当前不可执行该局外操作|只有房主/)

  // 0 XP：房主也没有候选。
  assert.deepEqual(customizeMoves(state, 0), [])
  awardXp(state, 1)
  assert.ok(customizeMoves(state, 0).length > 0, '房主有 XP 时应有候选')
  const move = customizeMoves(state, 0)[0]
  act(state, 0, move)
  assert.equal(state.campaign.investigators[0].xp, 0)
  assert.deepEqual(customizeMoves(state, 0), [], 'XP 用完即没有候选')
  // 过期候选（availableXp 已变化）被拒绝，且不重复扣经验。
  assert.throws(() => applyMove(state, 0, plainMove(move)), /当前不可执行该局外操作/)
  assert.equal(state.campaign.investigators[0].xp, 0)
  assert.equal(state.campaign.investigators[0].spentXp, 1)
})
