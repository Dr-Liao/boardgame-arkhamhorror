// TIC P8 节点验收（一）：生产注册 / 真实大厅八章全流程 / 失败与撤退路线 / 关键分支 /
// 记忆闪回 / 四难度混乱袋 / 存档恢复 / 回放确定性。
//
// 口径：全部用例都在**生产组合根**上跑真实引擎（content/registered.js → createGameState
// campaignHub → legalMoves/applyMove → startScenario → debug endScenario → hubContinue →
// 幕间/升级窗口 → epilogue/end）。开章推进用引擎调试指令结束关卡（CONTRACT §3 合法动作，
// 走与普通行动同一事务与 ScenarioEnded 边界），但每章都断言真实内容状态（关卡 id、幕/议程、
// 地点、区域守恒、战役记录、混乱袋、经验/升级、流程图历史），不做 no-op 断言。
//
// 运行：node --test tests/tic-p8-campaign.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadTicWorld, CAMPAIGN_ID, SCENARIO_IDS, CHAPTER_REFERENCE_CODES, INTERLUDE_NODES,
  createHubGame, hubSetup, beginChapter, finishScenario, continueFromResult, openChapter,
  walkCampaign, playMove, legalFor, decisionSeat, settleChoices, transact, saveAndRestore,
  hashState, mechanicsOf, codeOf, codesOf, sortedBag, expectedStartingBag,
  assertZoneConservation, assertStageStructure, declaredZoneCount,
} from './tic-p8-fixture.mjs'

const world = await loadTicWorld()
const TWO_HUMANS = ['07001', '07002']

// 便捷：当前关卡的某种合法动作 / 一次性真实行动（用于让引擎在收尾处跑 checkAct）。
const findMove = (state, action, seat = null) => legalFor(world, state, seat).find(move => move.action === action)
const holdBagCount = (state, token) => (state.chaosBag || []).filter(item => item === token).length
const campaignBagCount = (state, token) => (state.campaign.chaosBag || []).filter(item => item === token).length
const records = state => state.campaign.records

function performRealAction(state) {
  const seat = decisionSeat(world, state)
  const action = legalFor(world, state, seat).find(move => move.action === 'resource')
    || legalFor(world, state, seat).find(move => move.action === 'investigate')
    || legalFor(world, state, seat).find(move => move.action !== 'endTurn')
  assert.ok(action, '没有可用于推进 checkAct 的真实行动')
  playMove(world, state, action, seat)
  settleChoices(world, state)
  return action
}

/** 把 intoTheMaelstrom 推进到幕 2（07316）：四色钥匙交给调查员 + 全员门扉 + 真实行动，
 *  让引擎自己的 checkAct 完成 07315 并执行 07316 背面布置（而非直接改 actIndex）。 */
function advanceMaelstromToAct2(state) {
  const gateway = state.locations.find(location => codeOf(location) === '07320')
  assert.ok(gateway, '漩涡深处开局应有门扉 07320')
  transact(world, state, draft => {
    const api = mechanicsOf(world, draft)
    for (const [index, color] of ['blue', 'red', 'yellow', 'green'].entries()) {
      const key = draft.scenarioFlags.mechanics.keys[color]
      assert.equal(api.keys.transfer(color, key.holder, `investigator:${index % 2}`, { reveal: true }), true, `转移 ${color} 钥匙`)
    }
  })
  for (const investigator of state.investigators) {
    if (investigator.location === gateway.id) continue
    playMove(world, state, { action: 'debug', kind: 'moveTo', targetSeat: investigator.seat, locationId: gateway.id })
    settleChoices(world, state)
  }
  assert.equal(world.registeredEntry('07315').actRule.objective(state, state.acts[state.actIndex]), true,
    '四色钥匙 + 全员门扉后 07315 目标应成立')
  performRealAction(state)
  assert.equal(state.actIndex, 1, '真实行动应让引擎推进到幕 2')
  assert.equal(codeOf(state.acts[state.actIndex]), '07316')
  assert.ok(state.locations.length > 9, '07316 背面应布置幕 2 地图')
  assert.ok(state.enemies.some(enemy => ['07330a', '07330b'].includes(codeOf(enemy))), '达贡应入场')
  assert.ok(state.enemies.some(enemy => ['07331a', '07331b'].includes(codeOf(enemy))), '海德拉应入场')
}

// ---------------------------------------------------------------------------
// 1. 生产注册与启动面
// ---------------------------------------------------------------------------
test('TIC P8 生产注册：战役与八章 playable，参考卡/流程图/四难度混乱袋齐全', () => {
  assert.equal(world.campaign.id, CAMPAIGN_ID)
  assert.ok(['playable', 'verified'].includes(world.campaign.status), `战役状态 ${world.campaign.status} 不可启动`)
  assert.deepEqual(world.campaign.scenarioIds, SCENARIO_IDS, '八章顺序必须与战役流程图一致')
  for (const [index, scenarioId] of SCENARIO_IDS.entries()) {
    const manifest = world.contentRegistry.getScenario(scenarioId)
    assert.equal(manifest.status, 'playable', `${scenarioId} 状态`)
    assert.equal(manifest.campaignId, CAMPAIGN_ID)
    assert.equal(manifest.referenceCode, CHAPTER_REFERENCE_CODES[index], `${scenarioId} 参考卡`)
    assert.ok(manifest.acts.length > 0 && manifest.agendas.length > 0, `${scenarioId} 幕/议程`)
    assert.ok(manifest.zones.encounterDeck.length > 0, `${scenarioId} 遭遇牌库声明`)
    assert.ok(manifest.locations.length > 0, `${scenarioId} 地点声明`)
    assert.ok(manifest.layout?.locations && Object.keys(manifest.layout.locations).length > 0, `${scenarioId} 布局`)
  }
  assert.deepEqual(Object.keys(world.chaosBags), ['easy', 'standard', 'hard', 'expert'])
  const lobby = world.campaignListForUi(world.contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
  assert.ok(lobby, '大厅战役列表应包含 TIC')
  assert.equal(lobby.earlyAccess, false)
  assert.equal(lobby.scenarios.length, 8)
  const state = createHubGame(world, { seed: 'tic-p8-launcher' })
  const moves = legalFor(world, state, 0)
  const difficulties = moves.filter(move => move.action === 'hubSetDifficulty').map(move => move.difficulty)
  assert.deepEqual([...new Set(difficulties)].sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.ok(moves.some(move => move.action === 'hubGoSetup'))
  assert.ok(moves.some(move => move.action === 'hubSetLeader'))
  assert.deepEqual(
    world.campaignListForUi(world.contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID).flow.nodes.prologue.next,
    'thePitOfDespair')
})

// ---------------------------------------------------------------------------
// 2. 大厅开局驾驶到第一章 + 标准难度混乱袋
// ---------------------------------------------------------------------------
test('TIC P8 两真人真实大厅顺序开局：选人/自动牌组/确认/队长/开始第一章', async () => {
  const state = createHubGame(world, { seed: 'tic-p8-setup-two', investigatorCodes: TWO_HUMANS })
  assert.equal(state.uiState, 'campaignHub')
  // 选关 → 准备 → 两名真人各自选人/自动牌组/确认 → 队长 → 开始关卡
  const first = legalFor(world, state, 0).find(move => move.action === 'hubSetLeader')
  playMove(world, state, first, 0)
  settleChoices(world, state)
  playMove(world, state, { action: 'hubGoSetup' }, 0)
  settleChoices(world, state)
  assert.equal(state.uiState, 'scenarioSetup')
  for (const seat of [0, 1]) {
    const pick = legalFor(world, state, seat).find(move => move.action === 'hubSelectInvestigator' && move.code === TWO_HUMANS[seat])
    assert.ok(pick, `座位 ${seat} 应能选择 ${TWO_HUMANS[seat]}`)
    playMove(world, state, pick, seat)
    settleChoices(world, state)
    playMove(world, state, findMove(state, 'hubAutoDeck', seat), seat)
    settleChoices(world, state)
    assert.equal(state.campaign.investigators[seat].startingDeckReady, true)
    assert.ok(state.campaign.investigators[seat].deck.length >= 30, '自动牌组应有合法张数')
    playMove(world, state, findMove(state, 'hubDoneSeat', seat), seat)
    settleChoices(world, state)
    assert.equal(state.hubSeatDone[seat], true)
  }
  assert.equal(state.hubReady, true)
  playMove(world, state, findMove(state, 'hubBeginScenario', 0), 0)
  settleChoices(world, state)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'thePitOfDespair')
  assert.equal(state.campaign.flow.nodeId, 'thePitOfDespair')
  assert.deepEqual(state.campaign.flow.history.map(entry => entry.nodeId), ['prologue', 'thePitOfDespair'])
  assert.deepEqual(state.investigators.map(investigator => investigator.code), TWO_HUMANS)
  assert.equal(state.investigators[0].location, state.scenario.startLocation)
  assert.equal(state.campaign.leadSeat, 0)
  assertStageStructure(world, state)
  assertZoneConservation(world, state)
  // 标准难度混乱袋 = CHAOS_BAGS.standard + 07001 的开局祝福标记；战役袋只含基础袋。
  assert.deepEqual(sortedBag(state.chaosBag), expectedStartingBag(world, 'standard', TWO_HUMANS))
  assert.deepEqual(sortedBag(state.campaign.chaosBag), sortedBag(world.chaosBags.standard))
  assert.equal(holdBagCount(state, 'skull'), 2)
  assert.equal(holdBagCount(state, 'cultist'), 2)
  assert.equal(holdBagCount(state, 'tablet'), 2)
  assert.equal(holdBagCount(state, 'elderthing'), 2)
  assert.equal(holdBagCount(state, 'autofail'), 1)
  assert.equal(holdBagCount(state, 'eldersign'), 1)
  assert.equal(holdBagCount(state, 'bless'), 2, '07001 开局带 2 个 bless')
})

// ---------------------------------------------------------------------------
// 3. 四种难度混乱袋
// ---------------------------------------------------------------------------
test('TIC P8 四难度混乱袋按 shared.js CHAOS_BAGS 组成（skull/符号/数值张数逐一核对）', () => {
  for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
    const state = hubSetup(world, createHubGame(world, {
      seed: `tic-p8-difficulty-${difficulty}`, difficulty, investigatorCodes: TWO_HUMANS,
    }), { investigatorCodes: TWO_HUMANS })
    assert.equal(state.difficulty, difficulty)
    assert.equal(state.uiState, 'inScenario')
    assert.deepEqual(sortedBag(state.chaosBag), expectedStartingBag(world, difficulty, TWO_HUMANS),
      `${difficulty} 混乱袋组成`)
    assert.deepEqual(sortedBag(state.campaign.chaosBag), sortedBag(world.chaosBags[difficulty]),
      `${difficulty} 战役袋基础袋`)
    assert.equal(holdBagCount(state, 'skull'), 2, `${difficulty} skull 张数`)
    assert.equal(holdBagCount(state, 'cultist'), 2)
    assert.equal(holdBagCount(state, 'tablet'), 2)
    assert.equal(holdBagCount(state, 'elderthing'), 2)
    assert.equal(world.chaosBags[difficulty].filter(token => !/^[+-]?\d+$/.test(token)).length, 10,
      `${difficulty} 符号标记 10 张`)
  }
  // 大厅里切换难度：hubSetDifficulty 真实动作写入 state.difficulty，并决定开局袋。
  const switched = createHubGame(world, { seed: 'tic-p8-difficulty-switch', difficulty: 'easy' })
  playMove(world, switched, { action: 'hubSetDifficulty', difficulty: 'expert' }, 0)
  assert.equal(switched.difficulty, 'expert')
  hubSetup(world, switched, { investigatorCodes: TWO_HUMANS })
  assert.deepEqual(sortedBag(switched.chaosBag), expectedStartingBag(world, 'expert', TWO_HUMANS))
})

// ---------------------------------------------------------------------------
// 4. 前七章逐章走查（真实流程 + 区域守恒 + 幕间/升级 + 记录/混乱袋跨章）
// ---------------------------------------------------------------------------
test('TIC P8 前七章真实大厅走查：区域守恒、幕间窗口、升级、记录与混乱袋跨章携带', () => {
  const seen = { memories: 0, upgrades: 0 }
  const { state, chapters } = walkCampaign(world, {
    seed: 'tic-p8-walk-7', investigatorCodes: TWO_HUMANS, maxChapters: 7, maxUpgrades: 1,
    onChapter: (currentWorld, chapterState, index) => {
      const manifest = assertStageStructure(currentWorld, chapterState)
      assertZoneConservation(currentWorld, chapterState)
      assert.equal(chapterState.campaign.flow.nodeId, SCENARIO_IDS[index])
      assert.equal(chapterState.campaign.phase, 'scenario')
      // 每个开局遭遇牌库张数不超过 manifest 声明；地点数与声明一致或更少（部分地点旁置）。
      assert.ok(chapterState.encounterDeck.length <= declaredZoneCount(manifest, 'encounterDeck'),
        `${SCENARIO_IDS[index]} 遭遇牌库 ${chapterState.encounterDeck.length} 超过声明`)
      if (index === 0) {
        // 真实闪回 I–IV：记忆进入战役记录，符号标记永久移出混乱袋（两张袋同步）。
        const before = { cultist: holdBagCount(chapterState, 'cultist'), tablet: holdBagCount(chapterState, 'tablet'), elderthing: holdBagCount(chapterState, 'elderthing') }
        transact(currentWorld, chapterState, draft => {
          const runtime = currentWorld.scenarioRuntime(draft, [])
          for (const id of ['flashback1', 'flashback2', 'flashback3', 'flashback4']) {
            assert.equal(runtime.resolveFlashback(0, id), true, `应能结算 ${id}`)
          }
        })
        assert.equal(chapterState.campaign.records.memoriesRecovered.length, 4)
        seen.memories = 4
        assert.deepEqual(chapterState.scenarioFlags.resolvedFlashbacks, ['flashback1', 'flashback2', 'flashback3', 'flashback4'])
        for (const [token, count] of Object.entries(before)) {
          assert.equal(holdBagCount(chapterState, token), count - 1, `闪回应永久移除 1 个 ${token}`)
          assert.equal(campaignBagCount(chapterState, token), count - 1, `战役袋同样移除 ${token}`)
        }
        // 给两人经验，验证真实升级窗口确实能买东西（自动构筑合法升级）。
        for (const seat of [0, 1]) {
          playMove(currentWorld, chapterState, { action: 'debug', kind: 'xp', targetSeat: seat, amount: 6 })
          settleChoices(currentWorld, chapterState)
        }
      }
      if (index === 3) {
        // 第一章恢复过「与恐怖恶魔的战斗」，魔鬼礁按真实内容选择 07164（whenTrue）当首个议程。
        assert.deepEqual(codesOf(chapterState.agendas), ['07164', '07166'], '中段章节按侦察记录动态换议程')
        // 魔鬼礁：三把钥匙（紫/白/黑）被调查员持有 → 结局记录恢复到 flowPayload → 幕间 III 奖励。
        transact(currentWorld, chapterState, draft => {
          const api = mechanicsOf(currentWorld, draft)
          for (const [position, color] of ['purple', 'white', 'black'].entries()) {
            const key = draft.scenarioFlags.mechanics.keys[color]
            assert.equal(api.keys.transfer(color, key.holder, `investigator:${position % 2}`, { reveal: true }), true)
          }
        })
      }
      if (index === 5) {
        // 雾中之光：把黑/红钥匙放到当前幕上（resolutions.js 的 actKeys 读点）。
        transact(currentWorld, chapterState, draft => {
          const api = mechanicsOf(currentWorld, draft)
          const actId = draft.acts[draft.actIndex].id
          for (const color of ['black', 'red']) {
            const key = draft.scenarioFlags.mechanics.keys[color]
            if (key) api.keys.transfer(color, key.holder, `act:${actId}`, { reveal: true })
          }
        })
      }
      return 'resolution1'
    },
  })
  assert.equal(chapters.length, 7)
  assert.deepEqual(chapters.map(chapter => chapter.scenarioId), SCENARIO_IDS.slice(0, 7))
  // 幕间节点顺序与真实 flow.js 一致（inTooDeep→devilReef、aLightInTheFog→theLairOfDagon 无幕间）。
  assert.deepEqual(chapters.map(chapter => chapter.interludeNodes), [
    ['interlude1', 'harperPreparation'], ['interlude2'], [], ['interlude3'], ['beforeFog'], [], ['interlude4'],
  ])
  // interlude1 的 upgrades:false；harperPreparation 起升级窗口开放。
  assert.deepEqual(chapters[0].upgrades.allowed, [false, true])
  assert.equal(chapters[0].upgrades.purchased, true, '有经验时 harperPreparation 窗口应能完成一次真实升级')
  assert.ok(chapters[0].upgrades.purchases > 0)
  seen.upgrades = chapters.reduce((sum, chapter) => sum + (chapter.upgrades?.purchases || 0), 0)
  assert.ok(seen.upgrades > 0, '跨章升级应真实写入战役记录')
  // 升级真实扣经验：第一章后每人 6（调试）+4（4 段记忆）=10，购买后仍应 < 10。
  const spentSeat = Object.values(state.campaign.investigators).find(record => (record.purchases || []).length)
  assert.ok(spentSeat, '应有座位完成过购买')
  assert.ok(spentSeat.xp < 10, `购买后未花费经验应减少，实际 ${spentSeat.xp}`)
  // 记录跨章携带：暗杀失败 / 魔鬼礁恐怖仍活着 / 全速恐惧在日出前到达 / 三件遗物。
  assert.equal(records(state).TheMissionFailed, true)
  assert.equal(records(state).TheTerrorOfDevilReefIsStillAlive, true)
  assert.equal(records(state).TheInvestigatorsReachedFalconPointBeforeSunrise, true)
  for (const key of ['TheIdolWasBroughtToTheLighthouse', 'TheMantleWasBroughtToTheLighthouse', 'TheHeaddressWasBroughtToTheLighthouse']) {
    assert.equal(records(state)[key], true, `${key} 应在幕间 III 结算`)
  }
  assert.equal(records(state).TheInvestigatorsPossessAMapOfYhaNthlei, true)
  assert.equal(records(state).TheInvestigatorsPossessTheKeyToYhaNthlei, true)
  // 幕间 III 的 3 个永久符号标记同时写入当前袋与战役袋（各 +1）。
  for (const token of ['cultist', 'tablet', 'elderthing']) {
    assert.ok(campaignBagCount(state, token) >= 2, `战役袋应有幕间 III 奖励的 ${token}`)
  }
  // 已经停在第 8 章准备界面；流程图历史包含全部幕间节点。
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.hubSelectedScenarioId, 'intoTheMaelstrom')
  const history = state.campaign.flow.history.map(entry => entry.nodeId)
  for (const node of ['prologue', ...INTERLUDE_NODES, ...SCENARIO_IDS.slice(0, 7)]) assert.ok(history.includes(node), `流程图历史缺少 ${node}`)
  assert.equal(state.campaign.scenarioResults.length, 7)
})

// ---------------------------------------------------------------------------
// 5. 第八章真实胜利：幕 2 完成 → 结局 1 → epilogue/end → campaignResult 胜利
// ---------------------------------------------------------------------------
test('TIC P8 第八章真实行动完成幕 2：epilogue/end 收束为战役胜利并保留终局记录', () => {
  const { state } = walkCampaign(world, {
    seed: 'tic-p8-victory', investigatorCodes: TWO_HUMANS, maxChapters: 7,
  })
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.hubSelectedScenarioId, 'intoTheMaelstrom')
  beginChapter(world, state)
  assert.equal(state.scenario.id, 'intoTheMaelstrom')
  advanceMaelstromToAct2(state)
  // 抽干所有地点后由真实行动触发 checkAct：07316 目标达成 → 本卡进胜利区 → 结局 1 链。
  transact(world, state, draft => {
    const api = mechanicsOf(world, draft)
    for (const location of [...draft.locations]) api.water.set(location.id, 0)
  })
  performRealAction(state)
  assert.equal(state.uiState, 'scenarioResult', '最终章结算后应进入剧情结算（epilogue 还未走到）')
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result.resolution, 'resolution1')
  assert.equal(result.story.sections.map(section => section.title).join(','), 'resolution1,resolution2')
  assert.equal(records(state).TheInvestigatorsEscapedYhanthlei, true)
  assert.equal(records(state).ThePlotOfTheDeepOnesWasThwarted, true)
  assert.equal(records(state).TheDeepOnesHaveFloodedTheEarth, false)
  assert.notEqual(state.campaign.failed, true)
  for (const trauma of Object.values(state.campaign.trauma)) assert.equal(trauma.physical, 2, '结局 1 全员 2 点肉体创伤')
  assert.ok(state.victoryDisplay.some(card => codeOf(card) === '07316'), '完成的幕 2 应在胜利区')
  // 继续：epilogue 剧情 → end 节点 → campaignResult。
  continueFromResult(world, state, { upgrades: false })
  assert.equal(state.status, 'over')
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.outcome, 'victory')
  assert.equal(state.campaign.result, 'victory')
  assert.equal(state.campaign.finished, true)
  assert.equal(state.campaign.phase, 'finished')
  const history = state.campaign.flow.history.map(entry => entry.nodeId)
  assert.ok(history.includes('epilogue'), '流程图历史应包含 epilogue')
  assert.equal(state.campaign.flow.nodeId, 'end')
  assert.equal(state.campaign.scenarioResults.length, 8)
})

// ---------------------------------------------------------------------------
// 6. 雾中之光：多结局矩阵 + 钥匙/遗物记录
// ---------------------------------------------------------------------------
test('TIC P8 雾中之光多结局：R1/R2/R4 进剧情结算，R3 全军覆没立即以战役失败收尾；noResolution 重定向', () => {
  const base = openChapter(world, 5, { seed: 'tic-p8-alight-matrix', investigatorCodes: TWO_HUMANS })
  assert.equal(base.scenario.id, 'aLightInTheFog')
  assert.deepEqual(Object.keys(base.scenario.resolutions).sort(),
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  for (const branch of ['resolution1', 'resolution2', 'resolution4']) {
    const state = JSON.parse(JSON.stringify(base))
    finishScenario(world, state, branch)
    assert.equal(state.uiState, 'scenarioResult', `${branch} 应进入剧情结算`)
    assert.equal(state.campaign.scenarioResults.at(-1).resolution, branch)
    assert.equal(state.status, 'playing')
    assert.notEqual(state.campaign.failed, true, `${branch} 不应把战役判负`)
    assert.equal(state.campaign.pendingNode, 'theLairOfDagon')
    assert.ok(Object.values(state.campaign.investigators).every(record => record.status === 'active'))
  }
  const doomed = JSON.parse(JSON.stringify(base))
  finishScenario(world, doomed, 'resolution3')
  assert.equal(doomed.uiState, 'campaignResult', 'R3 应直接结束战役')
  assert.equal(doomed.status, 'over')
  assert.equal(doomed.outcome, 'defeat')
  assert.equal(doomed.campaign.result, 'defeat')
  assert.equal(doomed.campaign.failed, true)
  assert.ok(Object.values(doomed.campaign.investigators).every(record => record.status === 'killed'),
    'R3 所有人死亡（award:false）')
  const redirected = JSON.parse(JSON.stringify(base))
  finishScenario(world, redirected, 'noResolution')
  assert.equal(redirected.uiState, 'scenarioResult')
  const noResolution = redirected.campaign.scenarioResults.at(-1)
  assert.equal(noResolution.resolution, 'noResolution')
  assert.equal(noResolution.story.sections.map(section => section.title).join(','), 'noResolution,resolution4')
})

test('TIC P8 雾中之光分支记录：黑/红钥匙在当前幕上 → 地图/钥匙记录；手牌遗物 → 剧情卡入牌组', () => {
  const state = openChapter(world, 5, { seed: 'tic-p8-alight-records', investigatorCodes: TWO_HUMANS })
  transact(world, state, draft => {
    const api = mechanicsOf(world, draft)
    const actId = draft.acts[draft.actIndex].id
    for (const color of ['black', 'red']) {
      const key = draft.scenarioFlags.mechanics.keys[color]
      if (key) api.keys.transfer(color, key.holder, `act:${actId}`, { reveal: true })
    }
    draft.scenarioFlags.relicsAddedToHand = ['07179', '07180', '07181']
  })
  finishScenario(world, state, 'resolution1', choice => (choice.kind === 'storyCard' ? '0' : null))
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(records(state).TheInvestigatorsPossessAMapOfYhaNthlei, true, '黑钥匙在当前幕 → 地图记录')
  assert.equal(records(state).TheInvestigatorsPossessTheKeyToYhaNthlei, true, '红钥匙在当前幕 → 钥匙记录')
  // 三件遗物通过真实剧情卡选择加入调查员 0 的牌组（不计张数）。
  for (const code of ['07179', '07180', '07181']) {
    assert.ok(state.campaign.investigators[0].deck.includes(code), `${code} 应加入牌组`)
  }
})

// ---------------------------------------------------------------------------
// 7. 达贡巢穴：奥西罗斯三选一 + 守门人记录
// ---------------------------------------------------------------------------
test('TIC P8 达贡巢穴奥西罗斯分支：三种回答各加 1 个不同永久标记且剧情链正确', () => {
  const base = openChapter(world, 6, { seed: 'tic-p8-lair-oceiros', investigatorCodes: TWO_HUMANS })
  assert.equal(base.scenario.id, 'theLairOfDagon')
  const tokenOf = { resolution2: 'elderthing', resolution3: 'tablet', resolution4: 'cultist' }
  for (const branch of ['resolution2', 'resolution3', 'resolution4']) {
    const state = JSON.parse(JSON.stringify(base))
    const token = tokenOf[branch]
    const beforeState = holdBagCount(state, token)
    const beforeCampaign = campaignBagCount(state, token)
    finishScenario(world, state, 'resolution1', choice => (choice.source === 'oceiros' ? branch : null))
    assert.equal(state.uiState, 'scenarioResult')
    const result = state.campaign.scenarioResults.at(-1)
    assert.equal(result.resolution, 'resolution1')
    assert.equal(result.story.sections.map(section => section.title).join(','), `resolution1,${branch}`)
    assert.equal(holdBagCount(state, token), beforeState + 1, `${branch} 应永久加入 1 个 ${token}`)
    assert.equal(campaignBagCount(state, token), beforeCampaign + 1, `${branch} 战役袋同样 +1 ${token}`)
    assert.equal(records(state).TheGatekeeperHasBeenDefeated, false, '未击败看门人时不写该记录')
  }
  const withGatekeeper = JSON.parse(JSON.stringify(base))
  playMove(world, withGatekeeper, { action: 'debug', kind: 'spawn', code: '07079', targetSeat: 0 })
  settleChoices(world, withGatekeeper)
  const suspect = withGatekeeper.enemies.find(enemy => codeOf(enemy) === '07079')
  assert.ok(suspect, '应能生成一个嫌犯敌人')
  playMove(world, withGatekeeper, { action: 'debug', kind: 'defeat', enemyIds: [suspect.id] })
  settleChoices(world, withGatekeeper)
  assert.ok(withGatekeeper.victoryDisplay.some(card => codeOf(card) === '07079'))
  finishScenario(world, withGatekeeper, 'resolution1', choice => (choice.source === 'oceiros' ? 'resolution2' : null))
  assert.equal(records(withGatekeeper).TheGatekeeperHasBeenDefeated, true, '嫌犯在胜利区 → 守门人记录')
})

// ---------------------------------------------------------------------------
// 8. 漩涡深处：记忆闪回 XIV + 并行幕 07317/07318 + 结局矩阵（R2/R5）
// ---------------------------------------------------------------------------
test('TIC P8 漩涡深处并行幕：闪回 XIV 帮助/违抗分支入场 07317/07318，完成 07318 走 R2+R5 结局', () => {
  const state = openChapter(world, 7, { seed: 'tic-p8-maelstrom-branch', investigatorCodes: TWO_HUMANS })
  advanceMaelstromToAct2(state)
  // 违抗哈珀：记忆 + 移除所有 07083 实体卡 + 并行幕 07318。
  transact(world, state, draft => {
    const runtime = world.scenarioRuntime(draft, [])
    assert.equal(runtime.resolveFlashback(0, 'flashback14'), true)
  }, choice => (choice.options.some(option => option.id === 'defyHarper') ? 'defyHarper' : null))
  assert.ok(state.campaign.records.memoriesRecovered.includes('AStingingBetrayal'))
  assert.deepEqual(codesOf(state.parallelActs || []), ['07318'])
  let repeated = null
  transact(world, state, draft => { repeated = world.scenarioRuntime(draft, []).resolveFlashback(0, 'flashback14') })
  assert.equal(repeated, false, '重复结算闪回被内容层拒绝（返回 false）')
  assert.deepEqual(codesOf(state.parallelActs || []), ['07318'], '重复闪回不得重复加入并行幕')
  // 完成 07318：两古神各 4×人数伤害，然后真实行动触发并行幕完成判定。
  transact(world, state, draft => {
    for (const enemy of draft.enemies) {
      if (['07330a', '07330b', '07331a', '07331b'].includes(codeOf(enemy))) enemy.damageTaken = 4 * draft.numInvestigators
    }
  })
  performRealAction(state)
  settleChoices(world, state, choice => (choice.options.some(option => option.id === 'continue') ? 'continue' : null))
  assert.ok(state.victoryDisplay.some(card => codeOf(card) === '07318'), '完成的并行幕应进胜利区')
  assert.deepEqual(codesOf(state.parallelActs || []), [], '完成后并行幕离场')
  // 抽干全部地点后完成 07316（此时另一张场景卡已结算），走「继续」→ R2 + R5。
  transact(world, state, draft => {
    const api = mechanicsOf(world, draft)
    for (const location of [...draft.locations]) api.water.set(location.id, 0)
  })
  performRealAction(state)
  assert.equal(state.uiState, 'scenarioResult')
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result.resolution, 'resolution1')
  assert.equal(result.story.sections.map(section => section.title).join(','), 'resolution1,resolution2,resolution5')
  assert.equal(records(state).ThePlotOfTheDeepOnesWasThwarted, true)
  assert.equal(records(state).TheRichesOfTheDeepAreLostForever, true)
  assert.ok(state.victoryDisplay.some(card => codeOf(card) === '07316'))
  // R1 的「停止阴谋 + 违抗哈珀」奖励：3 点额外经验（4 胜利点 + 3 奖励 = 每人 7）。
  for (const record of Object.values(state.campaign.investigators)) assert.equal(record.xp, 7, '每人应得 7 XP')
  for (const trauma of Object.values(state.campaign.trauma)) assert.equal(trauma.physical, 2)
  continueFromResult(world, state, { upgrades: false })
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.outcome, 'victory')
  assert.equal(state.campaign.result, 'victory')
  assert.equal(state.campaign.ending, 'plotThwartedRichesLost', '终局记录应映射到「阴谋被挫败，深海财富永失」')
  assert.match(state.campaign.endingLabel, /深海财富永失/)
  assert.equal(state.campaign.scenarioResults.length, 8)
})

test('TIC P8 漩涡深处记忆闪回 XIV 帮助分支：并行幕 07317 入场且仅一次', () => {
  const state = openChapter(world, 7, { seed: 'tic-p8-maelstrom-help', investigatorCodes: TWO_HUMANS })
  advanceMaelstromToAct2(state)
  transact(world, state, draft => world.scenarioRuntime(draft, []).resolveFlashback(0, 'flashback14'),
    choice => (choice.options.some(option => option.id === 'helpHarper') ? 'helpHarper' : null))
  assert.deepEqual(codesOf(state.parallelActs || []), ['07317'])
  assert.deepEqual(codesOf(state.acts), ['07315', '07316'], '帮助哈珀不改变线性幕组')
  assert.equal(records(state).TheHorribleTruth, false)
})

// ---------------------------------------------------------------------------
// 9. 失败路线：章节内全灭（可恢复）/ 战役判负结局
// ---------------------------------------------------------------------------
test('TIC P8 章节全灭失败路线：noResolution 结算后经幕间恢复，下一章正常开局', () => {
  const state = hubSetup(world, createHubGame(world, { seed: 'tic-p8-defeat-chapter', investigatorCodes: TWO_HUMANS }),
    { investigatorCodes: TWO_HUMANS })
  for (const seat of [0, 1]) {
    playMove(world, state, { action: 'debug', kind: 'harm', targetSeat: seat, damage: 99, horror: 99 })
    settleChoices(world, state, choice => choice.options[0].id)
  }
  assert.equal(state.uiState, 'scenarioResult', '全员被击败应结束本章')
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result.resolution, 'noResolution')
  assert.ok(state.investigators.every(investigator => investigator.defeated))
  assert.notEqual(state.campaign.failed, true, '大厅流程里章节全灭只结束本关')
  assert.equal(state.campaign.pendingNode, 'interlude1')
  assert.ok(Object.values(state.campaign.investigators).every(record => record.status === 'active'),
    '被击败不等于永久死亡（战役记录仍 active）')
  continueFromResult(world, state, { upgrades: false })
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.hubSelectedScenarioId, 'theVanishingOfElinaHarper')
  beginChapter(world, state)
  assert.equal(state.scenario.id, 'theVanishingOfElinaHarper')
  assert.ok(state.investigators.every(investigator => investigator.defeated === false && investigator.resigned === false),
    '新关卡开局应重置本关出局标记')
})

test('TIC P8 战役判负路线：雾中之光 R3 与漩涡深处 R8 都直接以 campaignResult 失败收尾', () => {
  const alight = openChapter(world, 5, { seed: 'tic-p8-defeat-alight', investigatorCodes: TWO_HUMANS })
  finishScenario(world, alight, 'resolution3')
  assert.equal(alight.uiState, 'campaignResult')
  assert.equal(alight.outcome, 'defeat')
  assert.equal(alight.campaign.result, 'defeat')
  assert.ok(Object.values(alight.campaign.investigators).every(record => record.status === 'killed'))
  assert.equal(alight.campaign.scenarioResults.at(-1).resolution, 'resolution3')

  const maelstrom = openChapter(world, 7, { seed: 'tic-p8-defeat-maelstrom', investigatorCodes: TWO_HUMANS })
  finishScenario(world, maelstrom, 'resolution8')
  assert.equal(maelstrom.uiState, 'campaignResult')
  assert.equal(maelstrom.status, 'over')
  assert.equal(maelstrom.outcome, 'defeat')
  assert.equal(maelstrom.campaign.result, 'defeat')
  assert.equal(records(maelstrom).TheDeepOnesHaveFloodedTheEarth, true)
  assert.ok(Object.values(maelstrom.campaign.investigators).every(record => record.status === 'killed'))
  assert.equal(maelstrom.campaign.scenarioResults.at(-1).resolution, 'resolution8')
})

// ---------------------------------------------------------------------------
// 10. 撤退路线：雾中之光真实撤退动作全员撤退
// ---------------------------------------------------------------------------
test('TIC P8 撤退路线：雾中之光真实撤退动作全员撤退 → noResolution，经幕间进入达贡巢穴', () => {
  const state = openChapter(world, 5, { seed: 'tic-p8-resign', investigatorCodes: TWO_HUMANS })
  assert.equal(state.scenario.id, 'aLightInTheFog')
  for (let guard = 0; guard < 4 && state.uiState === 'inScenario'; guard++) {
    const seat = decisionSeat(world, state)
    const resign = legalFor(world, state, seat).find(move => move.action === 'entityAbility' && /resign/i.test(String(move.actionKind || '')))
    assert.ok(resign, `座位 ${seat} 应有真实撤退动作：${legalFor(world, state, seat).map(move => `${move.action}/${move.actionKind || ''}`).slice(0, 12).join(',')}`)
    playMove(world, state, resign, seat)
    settleChoices(world, state)
    assert.equal(state.investigators[seat].resigned, true, '撤退后本关离场')
  }
  assert.equal(state.uiState, 'scenarioResult')
  assert.ok(state.investigators.every(investigator => investigator.resigned))
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'noResolution')
  assert.notEqual(state.campaign.failed, true, '章节撤退不应把整个战役判负')
  continueFromResult(world, state, { upgrades: false })
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.hubSelectedScenarioId, 'theLairOfDagon')
  beginChapter(world, state)
  assert.equal(state.scenario.id, 'theLairOfDagon')
  assert.ok(state.investigators.every(investigator => investigator.resigned === false))
})

// ---------------------------------------------------------------------------
// 11. 哈珀指控 0 / 1 / 2 正确
// ---------------------------------------------------------------------------
test('TIC P8 哈珀指控 0/1/2 正确：营救布置、暴民与全员撤退各自命中真实内容分支', () => {
  const base = openChapter(world, 1, { seed: 'tic-p8-accusation', investigatorCodes: TWO_HUMANS })
  assert.equal(base.scenario.id, 'theVanishingOfElinaHarper')
  const answers = mechanicsOf(world, base).scenarioDecks.cards('harperAnswers').map(codeOf)
  assert.equal(answers.length, 2, '隐藏答案牌堆应有两张（真嫌犯 / 真窝点）')
  const [trueSuspect, trueHideout] = answers
  const runAccusation = (correctSuspect, correctHideout) => {
    const state = JSON.parse(JSON.stringify(base))
    transact(world, state, draft => world.scenarioRuntime(draft, []).resolveScenarioEvent('ticHarperAccusation'), choice => {
      if (choice.source !== '07060') return null
      const candidateCodes = choice.options.map(option => option.cardCode).filter(Boolean)
      const want = choice.prompt.includes('绑架犯')
        ? (correctSuspect ? trueSuspect : candidateCodes.find(code => code !== trueSuspect))
        : (correctHideout ? trueHideout : candidateCodes.find(code => code !== trueHideout))
      return candidateCodes.includes(want) ? want : candidateCodes[0]
    })
    return state
  }
  // 2 正确：营救准备（07061 入幕牌库、07059 追击议程、藏身处 + 艾莲娜 + 绑架犯入场）。
  const both = runAccusation(true, true)
  assert.equal(records(both).TheMissionFailed, false)
  assert.equal(records(both).harperSuspect, world.roles.suspectRole(trueSuspect))
  assert.equal(records(both).harperHideout, world.roles.hideoutRole(trueHideout))
  assert.deepEqual(codesOf(both.acts), ['07060', '07061'], '应把 07061 营救装进下一格幕')
  assert.deepEqual(codesOf(both.agendas), ['07057', '07059'], '应把 07059 追击装进下一格议程')
  assert.equal(both.agendaIndex, 1)
  assert.ok(both.locations.some(location => (location.beneath || []).includes('07083')), '艾莲娜·哈珀应压在藏身处下方')
  assert.ok(both.enemies.some(enemy => codeOf(enemy) === trueSuspect), '绑架犯应入场')
  assert.ok(both.investigators.every(investigator => !investigator.resigned))
  // 1 正确：额外生成愤怒暴民 07062b 到印斯茅斯广场 07065。
  const one = runAccusation(true, false)
  const mob = one.enemies.find(enemy => codeOf(enemy) === '07062b')
  assert.ok(mob, '1 正确应生成愤怒暴民')
  const plaza = one.locations.find(location => codeOf(location) === '07065')
  assert.equal(mob.location, plaza?.id)
  // 0 正确：全员撤退 → noResolution，记录任务失败，流程图停在 interlude2。
  const none = runAccusation(false, false)
  assert.equal(records(none).TheMissionFailed, true)
  assert.ok(none.investigators.every(investigator => investigator.resigned), '0 正确应全员撤退')
  assert.equal(none.campaign.scenarioResults.at(-1).resolution, 'noResolution')
  assert.equal(none.campaign.pendingNode, 'interlude2')
})

// ---------------------------------------------------------------------------
// 12. 条件记忆 / 闪回（互斥、只奖励一次、错误章节不可结算）
// ---------------------------------------------------------------------------
test('TIC P8 条件记忆闪回：按章节门槛结算、重复结算不再发奖、幕间 I 按记忆数发经验一次', () => {
  const state = hubSetup(world, createHubGame(world, { seed: 'tic-p8-memories', investigatorCodes: TWO_HUMANS }),
    { investigatorCodes: TWO_HUMANS })
  // 不在对应章节时闪回不可结算（内容层按 scenario.id 收窄）。
  assert.throws(() => transact(world, state, draft => world.scenarioRuntime(draft, []).resolveFlashback(0, 'flashback14')),
    /Unknown flashback/)
  transact(world, state, draft => {
    const runtime = world.scenarioRuntime(draft, [])
    for (const id of ['flashback1', 'flashback2', 'flashback3', 'flashback4']) assert.equal(runtime.resolveFlashback(0, id), true)
  })
  assert.equal(records(state).memoriesRecovered.length, 4)
  // 重复结算同一闪回：不重复记录、不重复移除标记。
  const bagBefore = {
    cultist: holdBagCount(state, 'cultist'), tablet: holdBagCount(state, 'tablet'), elderthing: holdBagCount(state, 'elderthing'),
  }
  transact(world, state, draft => {
    assert.equal(world.scenarioRuntime(draft, []).resolveFlashback(0, 'flashback1'), false)
    assert.equal(world.scenarioRuntime(draft, []).resolveFlashback(0, 'flashback2'), false)
  })
  assert.equal(records(state).memoriesRecovered.length, 4)
  for (const [token, count] of Object.entries(bagBefore)) assert.equal(holdBagCount(state, token), count)
  // 结算第一章后，幕间 I 按 4 段记忆给每人 +4 XP（升级关闭以便精确断言），保存往返后仍只有一次。
  finishScenario(world, state, 'resolution1')
  const interludeInfo = continueFromResult(world, state, { upgrades: false })
  assert.deepEqual(interludeInfo.nodes, ['interlude1', 'harperPreparation'])
  assert.deepEqual(interludeInfo.upgradesAllowed, [false, true])
  for (const record of Object.values(state.campaign.investigators)) assert.equal(record.xp, 4, '每段记忆 1 XP，共 4')
  const restored = saveAndRestore(world, state)
  assert.equal(restored.state.campaign.records.memoriesRecovered.length, 4)
  for (const record of Object.values(restored.state.campaign.investigators)) assert.equal(record.xp, 4, '存档往返不得重复发放')
})

// ---------------------------------------------------------------------------
// 13. 存档恢复：章节中 / 待决选择 / 幕间升级窗口
// ---------------------------------------------------------------------------
test('TIC P8 存档恢复：章节中 JSON 往返后 legalMoves/状态一致，双方继续推进结果逐字节相同', () => {
  const state = hubSetup(world, createHubGame(world, { seed: 'tic-p8-save-mid', investigatorCodes: TWO_HUMANS }),
    { investigatorCodes: TWO_HUMANS })
  const saved = saveAndRestore(world, state)
  assert.deepEqual(saved.changes, ['刷新内嵌卡牌定义'], '首个迁移只应刷新派生卡表')
  assert.deepEqual(saved.secondChanges, [], '第二次迁移必须完全幂等')
  assert.equal(saved.state.revision, state.revision)
  assert.equal(saved.state.pendingChoice, null)
  assert.deepEqual(world.engine.legalMoves(saved.state), world.engine.legalMoves(state))
  assert.deepEqual(saved.state.campaign, state.campaign)
  assert.deepEqual(saved.state.scenario, state.scenario)
  // 用同一段脚本继续：结束第一章 → 幕间 → 下一章开局；两个独立恢复分支必须逐字节一致。
  const left = JSON.parse(JSON.stringify(saved.state))
  const right = JSON.parse(JSON.stringify(saved.state))
  assert.notEqual(hashState(left), hashState(JSON.parse(JSON.stringify(state))), '迁移会刷新派生卡表，指纹不同于原状态')
  finishScenario(world, left, 'resolution1')
  finishScenario(world, right, 'resolution1')
  assert.equal(hashState(left), hashState(right))
  continueFromResult(world, left, { upgrades: false })
  continueFromResult(world, right, { upgrades: false })
  assert.equal(hashState(left), hashState(right))
  assert.equal(left.uiState, 'scenarioSetup')
  beginChapter(world, left)
  beginChapter(world, right)
  assert.equal(left.scenario.id, 'theVanishingOfElinaHarper')
  assert.equal(hashState(left), hashState(right))
})

test('TIC P8 待决选择存档恢复：pendingChoice 身份/合法动作一致，恢复后仍能回答问题并结算', () => {
  const state = hubSetup(world, createHubGame(world, { seed: 'tic-p8-save-choice', investigatorCodes: TWO_HUMANS }),
    { investigatorCodes: TWO_HUMANS })
  playMove(world, state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99, horror: 99 })
  playMove(world, state, { action: 'debug', kind: 'endScenario', resolutionKey: 'resolution1' })
  assert.ok(state.pendingChoice, '剧末创伤选择应挂起')
  assert.equal(state.pendingChoice.kind, 'trauma')
  assert.equal(state.pendingChoice.seat, 0)
  const saved = saveAndRestore(world, state)
  assert.deepEqual(saved.state.pendingChoice, state.pendingChoice, '待决选择必须原样恢复（含 seat/options/source）')
  assert.deepEqual(world.engine.legalMoves(saved.state), world.engine.legalMoves(state), '恢复后的合法动作（choose）必须一致')
  // 两个独立恢复分支回答同一个选择，结果必须逐字节一致；随后继续到章节结算。
  const left = saveAndRestore(world, state).state
  const right = saveAndRestore(world, state).state
  const optionId = state.pendingChoice.options[0].id
  for (const branch of [left, right]) {
    world.engine.applyMove(branch, branch.pendingChoice.seat,
      { action: 'choose', choiceId: branch.pendingChoice.id, optionId })
  }
  assert.equal(hashState(left), hashState(right))
  assert.equal(left.pendingChoice, null)
  assert.equal(left.uiState, 'scenarioResult', '回答创伤选择后应继续完成本章结算')
  assert.equal(left.campaign.scenarioResults.at(-1).resolution, 'resolution1')
  assert.deepEqual(left.campaign.trauma[0], { physical: 1, mental: 0 }, '选择肉体创伤后写入战役创伤')
})


test('TIC P8 幕间升级窗口存档恢复：购买候选一致，恢复后完成升级与确认并进入下一章', () => {
  const state = hubSetup(world, createHubGame(world, { seed: 'tic-p8-save-interlude', investigatorCodes: TWO_HUMANS }),
    { investigatorCodes: TWO_HUMANS })
  for (const seat of [0, 1]) {
    playMove(world, state, { action: 'debug', kind: 'xp', targetSeat: seat, amount: 6 })
    settleChoices(world, state)
  }
  finishScenario(world, state, 'resolution1')
  // 进入 interlude1 窗口并清空其确认，再进入 harperPreparation（第一个真正开放升级的窗口）。
  playMove(world, state, { action: 'hubContinue' }, 0)
  settleChoices(world, state)
  assert.equal(state.uiState, 'interlude')
  for (let guard = 0; guard < 4 && state.campaign.flow.nodeId !== 'harperPreparation'; guard++) {
    const seat = decisionSeat(world, state)
    const done = legalFor(world, state, seat).find(move => move.action === 'hubDoneSeat')
    assert.ok(done)
    playMove(world, state, done, seat)
    settleChoices(world, state)
  }
  assert.equal(state.campaign.flow.nodeId, 'harperPreparation')
  assert.equal(state.campaign.upgradesAllowed, true)
  const purchaseMoves = legalFor(world, state, decisionSeat(world, state)).filter(move => move.action === 'hubPurchase')
  assert.ok(purchaseMoves.length > 0, '有经验时应出现真实购买候选')
  const saved = saveAndRestore(world, state)
  assert.deepEqual(world.engine.legalMoves(saved.state), world.engine.legalMoves(state), '恢复后购买候选一致')
  const left = JSON.parse(JSON.stringify(saved.state))
  const right = JSON.parse(JSON.stringify(saved.state))
  for (const branch of [left, right]) {
    let guard = 0
    while (branch.uiState === 'interlude' && guard++ < 40) {
      settleChoices(world, branch)
      const seat = decisionSeat(world, branch)
      const auto = legalFor(world, branch, seat).find(move => move.action === 'hubAutoUpgrade')
      if (auto) {
        playMove(world, branch, auto, seat)
        settleChoices(world, branch)
      }
      const done = legalFor(world, branch, decisionSeat(world, branch)).find(move => move.action === 'hubDoneSeat')
      if (!done) break
      playMove(world, branch, done, decisionSeat(world, branch))
    }
  }
  assert.equal(hashState(left), hashState(right), '恢复后继续完成幕间/升级的结果应一致')
  assert.equal(left.uiState, 'scenarioSetup')
  assert.ok(Object.values(left.campaign.investigators).some(record => (record.purchases || []).length > 0), '应完成过真实升级')
})

// ---------------------------------------------------------------------------
// 14. 回放确定性：同种子逐检查点哈希一致
// ---------------------------------------------------------------------------
test('TIC P8 回放确定性：同种子同一脚本八章走查的 16+ 检查点哈希完全一致', () => {
  const first = walkCampaign(world, { seed: 'tic-p8-replay-determinism', investigatorCodes: TWO_HUMANS, upgrade: false })
  const second = walkCampaign(world, { seed: 'tic-p8-replay-determinism', investigatorCodes: TWO_HUMANS, upgrade: false })
  assert.ok(first.hashes.length >= 16, `检查点数 ${first.hashes.length}`)
  assert.deepEqual(first.hashes, second.hashes, '同种子两次走查的每个检查点哈希必须一致')
  assert.equal(hashState(first.state), hashState(second.state))
  const other = walkCampaign(world, { seed: 'tic-p8-replay-other-seed', investigatorCodes: TWO_HUMANS, upgrade: false })
  assert.notEqual(first.hashes[0], other.hashes[0], '不同种子的开局指纹应不同')
})
