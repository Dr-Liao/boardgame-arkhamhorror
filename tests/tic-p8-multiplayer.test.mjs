// TIC P8 节点验收（二）：多人 / AI / 隐私 / 权限边界 / 断线恢复。
//
// 口径：生产组合根上的真实大厅流程（与 tic-p8-campaign.test.mjs 同一夹具），多人场景全部用
// 真实引擎动作驱动：hubSetup（各席位选人/自动牌组/确认）、applyMove、autoHubMove（AI 队友
// 与真实大厅相同的准备路径）、viewState 观察投影（逐席位隐私）、migrateState + JSON 存档
// （断线重连/恢复）。
//
// 运行：node --test tests/tic-p8-multiplayer.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadTicWorld, createHubGame, hubSetup, beginChapter, finishScenario, openChapter,
  playMove, legalFor, decisionSeat, actingSeats, settleChoices, saveAndRestore,
  hashState, mechanicsOf, codeOf, codesOf, viewFor,
} from './tic-p8-fixture.mjs'

const world = await loadTicWorld()
const TWO = ['07001', '07002']
const THREE = ['07001', '07002', '07003']
const FOUR = ['07001', '07002', '07003', '07004']
const plain = move => Object.fromEntries(Object.entries(move).filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))
const currentMoves = state => legalFor(world, state, decisionSeat(world, state))
const actionOf = (state, action) => currentMoves(state).find(move => move.action === action)
const actor = state => decisionSeat(world, state)

// ---------------------------------------------------------------------------
// 1. 四真人开局
// ---------------------------------------------------------------------------
test('TIC P8 多人：四真人席位各自选人/自动牌组/确认，开局到第一章且牌组互不相同', () => {
  const state = hubSetup(world, createHubGame(world, { seats: 4, seed: 'tic-p8-mp-four', investigatorCodes: FOUR }),
    { investigatorCodes: FOUR })
  assert.deepEqual(state.humanSeats, [0, 1, 2, 3])
  assert.equal(state.numInvestigators, 4)
  assert.deepEqual(state.investigators.map(investigator => investigator.code), FOUR)
  assert.equal(new Set(state.investigators.map(investigator => investigator.code)).size, 4, '四人调查员不得重复')
  for (const seat of [0, 1, 2, 3]) {
    const record = state.campaign.investigators[seat]
    assert.equal(record.status, 'active')
    assert.equal(record.startingDeckReady, true, `座位 ${seat} 牌组应已就绪`)
    assert.ok(record.deck.length >= 30, `座位 ${seat} 自动牌组张数 ${record.deck.length}`)
    assert.equal(state.hubSeatSelected[seat], true)
  }
  assert.equal(state.campaign.leadSeat, 0)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'thePitOfDespair')
  assert.ok(state.investigators.every(investigator => investigator.location === state.scenario.startLocation))
})

// ---------------------------------------------------------------------------
// 2. AI 席位自动准备（真实 autoHubMove 路径）
// ---------------------------------------------------------------------------
test('TIC P8 多人：1 真人 + 3 AI，AI 队友走真实 autoHubMove 完成选人/牌组/确认', () => {
  const state = hubSetup(world, createHubGame(world, {
    seats: 4, humans: [0], seed: 'tic-p8-mp-ai-prep', investigatorCodes: ['07001'],
  }), { investigatorCodes: ['07001'] })
  assert.deepEqual(state.humanSeats, [0])
  assert.equal(state.investigators[0].code, '07001')
  const codes = state.investigators.map(investigator => investigator.code)
  assert.equal(new Set(codes).size, 4, 'AI 队友不应重复选择人类已用调查员')
  for (const seat of [1, 2, 3]) {
    const record = state.campaign.investigators[seat]
    assert.equal(record.startingDeckReady, true, `AI 座位 ${seat} 应完成自动牌组`)
    assert.ok(record.deck.length >= 30)
    assert.equal(state.investigators[seat].autoBuilt, true, 'AI 座位应走自动构筑')
  }
  assert.equal(state.hubReady, true)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.hubSeatDone[1], true)
})

// ---------------------------------------------------------------------------
// 3. AI 队友在当前回合推进关卡（真实合法动作循环）
// ---------------------------------------------------------------------------
test('TIC P8 多人：AI 席位接手回合执行真实合法动作推进关卡（不结束整轮）', () => {
  const state = hubSetup(world, createHubGame(world, {
    seats: 4, humans: [0], seed: 'tic-p8-mp-ai-loop', investigatorCodes: ['07001'],
  }), { investigatorCodes: ['07001'] })
  const actedSeats = new Set()
  const step = () => {
    settleChoices(world, state)
    const seat = actor(state)
    const moves = currentMoves(state)
    const action = moves.find(move => move.action === 'resource')
      || moves.find(move => move.action === 'investigate')
      || moves.find(move => move.action !== 'endTurn')
    assert.ok(action, `座位 ${seat} 没有可选真实动作：${moves.map(move => move.action).slice(0, 8).join(',')}`)
    playMove(world, state, action, seat)
    settleChoices(world, state)
    actedSeats.add(seat)
  }
  const endTurn = () => {
    settleChoices(world, state)
    playMove(world, state, actionOf(state, 'endTurn'), actor(state))
    settleChoices(world, state)
  }
  // 人类先行动并交棒；1/2 号 AI 各行动后交棒；3 号 AI 行动但不结束整轮（避免进入神话阶段）。
  step()
  endTurn()
  step()
  endTurn()
  step()
  endTurn()
  step()
  assert.ok(actedSeats.has(0) && actedSeats.has(1) && actedSeats.has(2) && actedSeats.has(3),
    `四个座位都应真实行动过，实际 ${[...actedSeats].join(',')}`)
  assert.equal(state.currentSeat, 3)
  assert.equal(state.round, 1, '仍在第 1 轮（没有进入神话阶段）')
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.status, 'playing')
})

// ---------------------------------------------------------------------------
// 4. 逐席位观察隐私（手牌/牌组/私有卡）
// ---------------------------------------------------------------------------
test('TIC P8 多人隐私：逐席位 viewState 只暴露本人手牌，别人的牌组/私有卡/剧本内部状态不外泄', () => {
  const state = hubSetup(world, createHubGame(world, { seats: 3, seed: 'tic-p8-mp-privacy', investigatorCodes: THREE }),
    { investigatorCodes: THREE })
  const sentinel = ['01020', '01021', '01022']
  for (const seat of [0, 1, 2]) state.investigators[seat].hand = [sentinel[seat]]
  for (const seat of [0, 1, 2]) {
    const view = viewFor(world, state, seat)
    assert.deepEqual(view.investigators[seat].hand, [sentinel[seat]], `座位 ${seat} 自己的手牌可见`)
    for (const other of [0, 1, 2].filter(item => item !== seat)) {
      assert.deepEqual(view.investigators[other].hand, [], `座位 ${seat} 不能看到座位 ${other} 的手牌`)
      assert.ok(view.investigators[other].deckSize > 0, '牌组张数是公开信息')
      assert.equal(view.campaign.investigators[other].deck, undefined, '别人的牌组清单不能下发')
      assert.equal(view.campaign.investigators[other].purchases, undefined)
      const serialized = JSON.stringify(view)
      assert.ok(!serialized.includes(sentinel[other]), `座位 ${seat} 的视图不能泄露座位 ${other} 的手牌卡号`)
    }
    assert.equal(view.scenarioFlags, undefined, '剧本内部标记（含隐藏答案）不得下发')
    assert.equal(view.scenarioDecks, undefined, '剧本私有牌堆不得下发')
  }
  // 事件投影同样过滤别人的私有事件，并遮蔽演出快照里的手牌。
  const events = world.observation.viewEvents([
    { seq: 0, type: 'info', text: '公开事件' },
    { seq: 1, type: 'info', text: '私密事件', privateSeat: 1 },
    { seq: 2, type: 'presentation', kind: 'checkpoint', tableState: {
      investigators: [{ seat: 0, hand: ['01020'] }, { seat: 1, hand: ['01021'] }] } },
  ], 0)
  assert.equal(events.some(event => event.privateSeat === 1), false)
  assert.deepEqual(events.find(event => event.tableState)?.tableState.investigators[1].hand, [])
  assert.deepEqual(events.find(event => event.tableState)?.tableState.investigators[0].hand, ['01020'])
})

// ---------------------------------------------------------------------------
// 5. 隐藏答案 + 待决选择隐私（哈珀指控）
// ---------------------------------------------------------------------------
test('TIC P8 多人隐私：哈珀隐藏答案只在引擎内，指控待决选项只发给应答座位，错座位提交被拒且状态不变', () => {
  const state = openChapter(world, 1, { seats: 3, seed: 'tic-p8-mp-hidden', investigatorCodes: THREE })
  assert.equal(state.scenario.id, 'theVanishingOfElinaHarper')
  const hiddenAnswer = mechanicsOf(world, state).scenarioDecks.cards('harperAnswers')
  assert.equal(hiddenAnswer.length, 2, '引擎内存在两张隐藏答案（真嫌犯/真窝点）')
  // 用真实内容入口发起指控，并停在第一个待决选择上。
  world.resolution.resolveTransaction(state, 0, { action: 'p8-multiplayer-open-accusation' },
    draft => world.scenarioRuntime(draft, []).resolveScenarioEvent('ticHarperAccusation'))
  assert.ok(state.pendingChoice, '指控流程应产生待决选择')
  assert.equal(state.pendingChoice.seat, 0, '领队（座位 0）回答指控')
  // resolveTransaction 直接调用（非 applyMove）不会重算派生缓存；生产路径每次行动收尾都会重算。
  state.legalMoves = world.engine.legalMoves(state)
  const responder = viewFor(world, state, 0)
  assert.ok(responder.pendingChoice?.options.length > 0, '应答座位能看到候选')
  assert.equal(responder.pendingChoice.seat, 0)
  for (const seat of [0, 1, 2]) {
    const observer = viewFor(world, state, seat)
    if (seat === state.pendingChoice.seat) {
      assert.ok(observer.pendingChoice.options.length > 0, '应答座位能看到候选')
    } else {
      assert.deepEqual(observer.pendingChoice?.options || [], [], `座位 ${seat} 不得拿到选项`)
    }
    const chooseMoves = (observer.legalMoves || []).filter(move => move.action === 'choose').length
    if (seat === state.pendingChoice.seat) assert.ok(chooseMoves > 0, '应答座位应拿到 choose 合法动作')
    else assert.equal(chooseMoves, 0, `座位 ${seat} 不应拿到 choose 合法动作`)
    // 公开投影只允许「隐藏答案牌堆有 2 张」这一计数，不得下发牌堆内容/卡号/顺序。
    const publicDeck = observer.mechanics?.scenarioDecks?.harperAnswers
    assert.deepEqual(publicDeck, { count: 2 }, `座位 ${seat} 只能看到隐藏答案张数`)
    assert.equal(publicDeck.codes, undefined)
    assert.equal(publicDeck.deck, undefined)
    assert.equal(publicDeck.cards, undefined)
  }
  // 错座位回答：拒绝且不改变状态。
  const before = JSON.stringify(state)
  const option = state.pendingChoice.options[0]
  assert.throws(() => world.engine.applyMove(state, 1,
    { action: 'choose', choiceId: state.pendingChoice.id, optionId: option.id }),
  /时机|不是当前|回答座位/)
  assert.equal(JSON.stringify(state), before, '被拒绝的回答不能改动状态')
  // 应答座位逐条回答后流程继续（继续走真实内容选择链路；事务入口与发起时一致）。
  const execute = draft => world.scenarioRuntime(draft, []).resolveScenarioEvent('ticHarperAccusation')
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 20, '指控选择未收敛')
    const choice = state.pendingChoice
    assert.equal(choice.seat, 0, '指控选择只由领队回答')
    const optionId = choice.kind === 'card' ? choice.options[0].cardCode : choice.options[0].id
    world.resolution.resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
  assert.equal(state.pendingChoice, null)
  assert.ok(codesOf(state.acts).includes('07061'), '指控完成后应把营救幕 07061 装进幕牌库')
})

// ---------------------------------------------------------------------------
// 6. 权限边界：局外/回合/选人/结算动作的座位约束
// ---------------------------------------------------------------------------
test('TIC P8 多人权限：非房主/非当前回合/重复选人/非应答座位的动作全部被引擎拒绝且不改状态', () => {
  // (a) campaignHub 只有房主（座位 0）能操作选关/进入准备。
  const lobby = createHubGame(world, { seed: 'tic-p8-mp-permission', investigatorCodes: THREE })
  const lobbyBefore = JSON.stringify(lobby)
  assert.throws(() => playMove(world, lobby, { action: 'hubGoSetup' }, 1), /时机|不是/)
  assert.equal(JSON.stringify(lobby), lobbyBefore, '被拒绝的局外操作不得改动状态')
  // (b) 队友已选的调查员不能再被别的座位选走。
  playMove(world, lobby, { action: 'hubGoSetup' }, 0)
  settleChoices(world, lobby)
  playMove(world, lobby, legalFor(world, lobby, 0).find(move => move.action === 'hubSelectInvestigator' && move.code === '07001'), 0)
  settleChoices(world, lobby)
  const optionsForSeat1 = legalFor(world, lobby, 1).filter(move => move.action === 'hubSelectInvestigator')
  assert.equal(optionsForSeat1.some(move => move.code === '07001'), false, '队友已占用的调查员不出现在候选')
  assert.throws(() => playMove(world, lobby, { action: 'hubSelectInvestigator', code: '07001' }, 1), /不可执行|不可/)
  // (c) 关卡内非当前回合座位不能提交普通行动。
  for (const seat of [0, 1, 2]) {
    const pick = legalFor(world, lobby, seat).find(move => move.action === 'hubSelectInvestigator')
    if (pick && !lobby.hubSeatSelected?.[seat]) {
      playMove(world, lobby, pick, seat)
      settleChoices(world, lobby)
    }
    const deck = legalFor(world, lobby, seat).find(move => move.action === 'hubAutoDeck')
    if (deck) {
      playMove(world, lobby, deck, seat)
      settleChoices(world, lobby)
    }
    const done = legalFor(world, lobby, seat).find(move => move.action === 'hubDoneSeat')
    if (done) {
      playMove(world, lobby, done, seat)
      settleChoices(world, lobby)
    }
  }
  if (!lobby.campaign.leadConfirmed) {
    playMove(world, lobby, legalFor(world, lobby, 0).find(move => move.action === 'hubSetLeader'), 0)
    settleChoices(world, lobby)
  }
  playMove(world, lobby, legalFor(world, lobby, 0).find(move => move.action === 'hubBeginScenario'), 0)
  settleChoices(world, lobby)
  assert.equal(lobby.uiState, 'inScenario')
  const current = lobby.currentSeat
  const otherSeat = [0, 1, 2].find(seat => seat !== current)
  assert.throws(() => world.engine.applyMove(lobby, otherSeat, { action: 'resource' }), /时机|不是你的回合/)
  // (d) 结算界面只有座位 0 能点继续。
  finishScenario(world, lobby, 'resolution1')
  assert.equal(lobby.uiState, 'scenarioResult')
  assert.deepEqual(legalFor(world, lobby, 1), [], '非房主在结算界面没有合法动作')
  const resultBefore = JSON.stringify(lobby)
  assert.throws(() => world.engine.applyMove(lobby, 1, plain({ action: 'hubContinue' })), /时机|不是/)
  assert.equal(JSON.stringify(lobby), resultBefore)
})

// ---------------------------------------------------------------------------
// 7. 回合交棒与逐席位合法行动投影
// ---------------------------------------------------------------------------
test('TIC P8 多人：回合交棒 currentSeat 0→1→2，观察投影只为行动座位下发合法动作', () => {
  const state = hubSetup(world, createHubGame(world, { seats: 3, seed: 'tic-p8-mp-handoff', investigatorCodes: THREE }),
    { investigatorCodes: THREE })
  assert.equal(state.currentSeat, 0)
  assert.deepEqual(actingSeats(world, state), [0])
  assert.ok(viewFor(world, state, 0).legalMoves.length > 0, '行动座位能看到合法动作')
  assert.deepEqual(viewFor(world, state, 1).legalMoves, [], '非行动座位没有合法动作')
  for (const next of [1, 2]) {
    playMove(world, state, actionOf(state, 'endTurn'), actor(state))
    settleChoices(world, state)
    assert.equal(state.currentSeat, next, `交棒到座位 ${next}`)
    assert.deepEqual(actingSeats(world, state), [next])
    assert.ok(viewFor(world, state, next).legalMoves.length > 0)
    for (const other of [0, 1, 2].filter(seat => seat !== next)) {
      assert.deepEqual(viewFor(world, state, other).legalMoves, [], `座位 ${other} 在别人回合没有合法动作`)
    }
  }
  assert.equal(state.round, 1)
})

// ---------------------------------------------------------------------------
// 8. 幕间共享决策：逐座位确认，最后一人确认后推进
// ---------------------------------------------------------------------------
test('TIC P8 多人：幕间窗口是共享顺序确认，逐座位 hubDoneSeat 后才进入下一章准备', () => {
  const state = hubSetup(world, createHubGame(world, { seats: 2, seed: 'tic-p8-mp-interlude', investigatorCodes: TWO }),
    { investigatorCodes: TWO })
  finishScenario(world, state, 'resolution1')
  playMove(world, state, { action: 'hubContinue' }, 0)
  settleChoices(world, state)
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow.nodeId, 'interlude1')
  assert.deepEqual(actingSeats(world, state), [0, 1], '两名真人都要确认')
  playMove(world, state, legalFor(world, state, 0).find(move => move.action === 'hubDoneSeat'), 0)
  settleChoices(world, state)
  assert.equal(state.uiState, 'interlude', '只确认一人时仍在幕间窗口')
  assert.equal(state.hubSeatDone[0], true)
  assert.deepEqual(actingSeats(world, state), [1], '剩下一名未确认的座位行动')
  playMove(world, state, legalFor(world, state, 1).find(move => move.action === 'hubDoneSeat'), 1)
  settleChoices(world, state)
  // interlude1（不开放升级）确认完直接进入 harperPreparation 升级窗口；再确认两人进入下一章准备。
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow.nodeId, 'harperPreparation')
  assert.equal(state.hubSeatDone[0], undefined, '新幕间窗口的确认状态重置')
  for (let guard = 0; guard < 20 && state.uiState === 'interlude'; guard++) {
    settleChoices(world, state)
    const seat = actor(state)
    const done = legalFor(world, state, seat).find(move => move.action === 'hubDoneSeat')
    assert.ok(done, `幕间窗口座位 ${seat} 应有确认动作`)
    playMove(world, state, done, seat)
  }
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.hubSelectedScenarioId, 'theVanishingOfElinaHarper')
  beginChapter(world, state)
  assert.equal(state.scenario.id, 'theVanishingOfElinaHarper')
})

// ---------------------------------------------------------------------------
// 9. 断线恢复：JSON 存档 + 迁移后逐席位视图/合法动作一致，继续行动结果逐字节相同
// ---------------------------------------------------------------------------
test('TIC P8 多人断线恢复：四席位存档重连后视图与合法动作一致，恢复分支继续行动结果相同', () => {
  const state = hubSetup(world, createHubGame(world, { seats: 4, seed: 'tic-p8-mp-reconnect', investigatorCodes: FOUR }),
    { investigatorCodes: FOUR })
  for (const seat of [0, 1, 2, 3]) state.investigators[seat].hand = [`0102${seat}`]
  // 手牌是测试直接注入的，生产路径会在每次 applyMove 收尾重算派生缓存；这里同步一次，
  // 让「重连前视图」与迁移后（会重算合法行动）的投影可比。
  state.legalMoves = world.engine.legalMoves(state)
  const viewsBefore = [0, 1, 2, 3].map(seat => viewFor(world, state, seat))
  const saved = saveAndRestore(world, state)
  const restored = saved.state
  assert.equal(restored.revision, state.revision)
  assert.equal(restored.pendingChoice, null)
  assert.deepEqual(restored.campaign, state.campaign)
  assert.deepEqual(restored.scenario, state.scenario)
  assert.deepEqual(world.engine.legalMoves(restored), world.engine.legalMoves(state), '重连后的合法动作必须一致')
  for (const seat of [0, 1, 2, 3]) {
    const after = viewFor(world, restored, seat)
    assert.deepEqual(after.investigators[seat].hand, viewsBefore[seat].investigators[seat].hand, `座位 ${seat} 重连后仍能看到自己的手牌`)
    for (const other of [0, 1, 2, 3].filter(item => item !== seat)) {
      assert.deepEqual(after.investigators[other].hand, [], `重连后仍不能看到座位 ${other} 的手牌`)
    }
    assert.deepEqual(after.legalMoves, viewsBefore[seat].legalMoves)
  }
  // 两个独立恢复分支执行同一动作，结果逐字节一致（断线重放/重连后继续都安全）。
  const left = saveAndRestore(world, state).state
  const right = saveAndRestore(world, state).state
  for (const branch of [left, right]) {
    const seat = actor(branch)
    playMove(world, branch, legalFor(world, branch, seat).find(move => move.action === 'resource') || legalFor(world, branch, seat)[0], seat)
    settleChoices(world, branch)
    playMove(world, branch, actionOf(branch, 'endTurn'), actor(branch))
    settleChoices(world, branch)
  }
  assert.equal(hashState(left), hashState(right))
  assert.equal(left.revision, right.revision)
  assert.equal(left.currentSeat, right.currentSeat)
})

// ---------------------------------------------------------------------------
// 10. 断线恢复（带待决选择）：多人局在创伤选择窗口保存/恢复
// ---------------------------------------------------------------------------
test('TIC P8 多人断线恢复：待决选择窗口存档后恢复，两个恢复分支答案一致', () => {
  const state = hubSetup(world, createHubGame(world, { seats: 3, seed: 'tic-p8-mp-reconnect-choice', investigatorCodes: THREE }),
    { investigatorCodes: THREE })
  playMove(world, state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99, horror: 99 })
  playMove(world, state, { action: 'debug', kind: 'endScenario', resolutionKey: 'resolution1' })
  assert.ok(state.pendingChoice, '剧末创伤选择应挂起')
  assert.equal(state.pendingChoice.seat, 0)
  const saved = saveAndRestore(world, state)
  assert.deepEqual(saved.state.pendingChoice, state.pendingChoice)
  assert.deepEqual(world.engine.legalMoves(saved.state), world.engine.legalMoves(state))
  const left = saveAndRestore(world, state).state
  const right = saveAndRestore(world, state).state
  for (const branch of [left, right]) {
    const choice = branch.pendingChoice
    assert.equal(choice.kind, 'trauma')
    world.engine.applyMove(branch, choice.seat, { action: 'choose', choiceId: choice.id, optionId: choice.options[0].id })
  }
  assert.equal(hashState(left), hashState(right))
  assert.equal(left.pendingChoice, null)
  assert.equal(left.uiState, 'scenarioResult')
})

// ---------------------------------------------------------------------------
// 11. 三真人回合内动作序列（真实动作 + 交棒）
// ---------------------------------------------------------------------------
test('TIC P8 多人：三真人依次执行真实动作并交棒，轮次/座位/记录保持一致', () => {
  const state = hubSetup(world, createHubGame(world, { seats: 3, seed: 'tic-p8-mp-turns', investigatorCodes: THREE }),
    { investigatorCodes: THREE })
  const performed = []
  for (let seat = 0; seat < 3; seat++) {
    assert.equal(state.currentSeat, seat)
    const action = actionOf(state, 'resource') || actionOf(state, 'investigate')
    assert.ok(action, `座位 ${seat} 应有真实行动可选`)
    playMove(world, state, action, seat)
    settleChoices(world, state)
    performed.push(seat)
    if (seat < 2) {
      playMove(world, state, actionOf(state, 'endTurn'), seat)
      settleChoices(world, state)
    }
  }
  assert.deepEqual(performed, [0, 1, 2])
  assert.equal(state.humanSeats.length, 3)
  assert.equal(state.round, 1)
  assert.equal(state.status, 'playing')
  assert.equal(state.campaign.investigators[0].status, 'active')
  assert.equal(state.campaign.leadSeat, 0)
})
