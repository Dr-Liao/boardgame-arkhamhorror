// P8《铁杉谷盛宴》发布验收：真实引擎上的 Node 战役端到端（campaignHub 生产组合根）。
//
// 覆盖（逐条对应 P8 必测项）：
//   a) 完整合法战役 · 两条不同勘察顺序路线：
//        A：第 1 日《岩间密语》→ 夜 1《扭曲空洞》→ 第 2 日《汉洛克庄园》→ 夜 2 夜探（寂静荒野）→
//           第 3 日《消失的姐妹》→ 最终夜 → 《山谷的命运》（resolution3 → theValeWasSaved）。
//        B：第 1 日《汉洛克庄园》→ 夜 1 夜探（岩间密语）→ 第 2 日《深沼之物》→ 夜 2《最长一夜》→
//           第 3 日《寂静荒野》→ 最终夜 → 《山谷的命运》（resolution1 → 马奎兹博士献身）。
//        两条路线合起来走遍 manifest 的 12 个 ScenarioStep（勘察/夜探互斥，单局只能走 10 个）。
//        逐节点断言流程图 history、场景顺序、三天三夜日期记录、已勘察区域、未花费经验、结局。
//   b) 居民关系 / 笔记 / 记录持久：路线 B 的夜 1/夜 2 法典写入河流·霍桑 +1、莉亚·阿特伍德 +1 与
//        「共舞」笔记、岩间密语结局 1 让西米恩 +2；跨章后从战役记录重新读出仍一致。
//   c) 失败 / 撤退路线：最终夜《The Final Evening》resolution3 → 选择「输掉战役」→ 尾声写 defeat，
//        战役在 campaignResult 正常收尾（回归：修复前引擎状态被写成 'lost'，结算页没有任何合法动作）。
//        该路线同时走「跳过本次勘察」的调度重抽（3 个勘察槽全部跳过）。
//   d) 四档难度：easy/standard/hard/expert 各开局到第一章、推进 2 个回合，断言混乱袋与难度同源、
//        四档互不相同、序曲结局 1 的 [autoFail] 迁移入袋，且全程无异常。
//   e) 存档恢复：勘察选择前 / 居民关系写入后 / 升级窗前 / 最终夜前四处 `JSON.parse(JSON.stringify(state))`
//        往返，再从副本继续，断言后续节点、记录、场景顺序与不存档路线完全一致。
//   f) replay 确定性：同 seed、同一系列动作的第二局由 `captureReplayLog → replayLog` 重建，逐步
//        状态指纹与引擎实际状态完全一致，终态 `stateDiff` 为空。
//
// 披露（P8 近似/夹具口径，逐条）：
//   · approximation：测试用 `createGameState({ campaignId: 'theFeastOfHemlockVale', campaignHub: true,
//     playerInvestigator: '10001', seed })` 与真实大厅同一条生产组合根（content/registered.js）；
//     章内结束走调试指令 `debug.endScenario`（与大厅「结束本章」同一个 `finishScenario` 路径），
//     不伪造章节数据、不直接改 `campaign.records`。
//   · approximation：场景布置期的剧情/地点/整备选择（`story` / `location` / `mulligan` / `mechanic`
//     / `playerWindow`）由夹具按「安全选项」回答；这些选择只影响章内演出，不改变战役推进口径。
//   · approximation：「跳过本次勘察」是 P7 内容层新增的调度重抽（参考实现没有该选项）；失败路线用它
//     把时钟推到最终夜，顺带覆盖该路径。
//   · 已修复缺陷（P8，最小范围）：
//       1. 最终夜 resolution3「输掉战役」把 `state.status` 写成 `'lost'`，引擎只认 `'playing'`，
//          结算页无合法动作、战役无法进入尾声（content/.../preludeTheFinalEvening/behavior.js）。
//       2. 四档混乱袋用 `'elderSign'`，引擎按小写 `'eldersign'` 结算旧印；旧印此前被当未知标记
//          （content/.../shared.js）。`chaosBagTransitions` 的 `autoFail` 同样改为引擎标记名。
//       3. `manifest.chaosBagTransitions` 没有任何引擎读点（序曲结局 1 的 [autoFail] 从未进袋）；
//          现由 `src/engine/campaign-flow.js#finishScenario` 读 `when/adds` 永久入袋。
//       4. `progressCampaign` 的 `!campaign.surveyPreparation` 让四个序曲整备升级窗（内容声明
//          `upgrades: true`，本循环唯一购牌窗）全部关闭；现按节点声明开窗（src/engine/campaign-flow.js）。
//       5. 「跳过本次勘察」不消费勘察整备包裹，后续自带 `mechanics.survey` 的序曲结算会抛
//          「已有待使用的勘察整备」（content/.../interludes.js#runReschedule 丢弃过期包裹）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { actingSeats, applyMove, createGameState, decisionSeat, legalMoves, validateMove } from '../src/engine/engine.js'
import { captureReplayLog, replayLog, stateDiff, stateHash } from '../src/engine/replay.js'
import { manifest as fhvManifest } from '../content/campaigns/theFeastOfHemlockVale/manifest.js'
import {
  FHV_FLOW, FHV_CHAOS_BAG_TRANSITIONS, PREP_STEPS, SURVEY_ROUTER_ID,
} from '../content/campaigns/theFeastOfHemlockVale/flow.js'
import {
  FHV_EVENING_STEPS, FHV_SCENARIO_IDS, FHV_SURVEY_SCENARIO_IDS,
} from '../content/campaigns/theFeastOfHemlockVale/parts.js'
import { CHAOS_BAGS } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import {
  FHV_RESIDENTS, residentLevel, residentNotes, surveyedAreas,
} from '../content/campaigns/theFeastOfHemlockVale/records.js'
import {
  FHV_OUTCOMES, fhvEpilogueBranch,
} from '../content/campaigns/theFeastOfHemlockVale/epilogue.js'

const CAMPAIGN_ID = 'theFeastOfHemlockVale'
const PRELUDE_1 = 'welcomeToHemlockVale'
const ENDGAME = 'fateOfTheVale'
const ALL_MAINLINE = [...FHV_SCENARIO_IDS]

// 引擎的混乱标记名（src/engine/tests.js 逐 token 比较）：数字标记 + 小写符号。
const NUMERIC_TOKEN = /^[+-]?\d+$/
const SYMBOL_TOKENS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign', 'bless', 'curse', 'frost']

// ---------------------------------------------------------------------------
// 路线表：勘察/夜探选择（按 pendingChoice.source）+ 每章结局键
// ---------------------------------------------------------------------------
const ROUTES = Object.freeze({
  // 路线 A：岩间密语 → 夜 1《扭曲空洞》→ 夜 2 夜探（寂静荒野）
  a: Object.freeze({
    choices: Object.freeze({
      surveyChoiceDay1: 'writtenInRock',
      firstEveningCodex: 'theta',
      firstEveningMeal: 'dontEatAnymore',
      firstEveningChoice: 'searchForBertie',
      surveyChoiceDay2: 'hemlockHouse',
      secondEveningCodex: 'skipCodex',
      secondEveningChoice: 'gatherMoreInformation',
      surveyChoiceNight2: 'theSilentHeath',
      surveyChoiceDay3: 'theLostSister',
    }),
    resolutions: Object.freeze({
      welcomeToHemlockVale: 'resolution1',
      writtenInRock: 'resolution1',
      theTwistedHollow: 'resolution1',
      dawnOfTheSecondDay: 'resolution2',
      hemlockHouse: 'resolution1',
      theSilentHeath: 'resolution1',
      dawnOfTheFinalDay: 'resolution2',
      theLostSister: 'resolution1',
      preludeTheFinalEvening: 'resolution4',
      fateOfTheVale: 'resolution3',
    }),
    // 序曲整备窗：唯一购牌窗，买一次证明窗是真的（XP 会减少、牌组调整落账）。
    buyAt: 'dawn2Prep',
  }),
  // 路线 B：汉洛克庄园 → 夜 1 夜探（岩间密语）→ 夜 2《最长一夜》
  b: Object.freeze({
    choices: Object.freeze({
      surveyChoiceDay1: 'hemlockHouse',
      firstEveningCodex: 'delta',
      firstEveningMeal: 'keepEating',
      firstEveningChoice: 'gatherMoreInformation',
      surveyChoiceNight1: 'writtenInRock',
      surveyChoiceDay2: 'theThingInTheDepths',
      secondEveningCodex: 'leah',
      secondEveningChoice: 'followDrMarquez',
      surveyChoiceDay3: 'theSilentHeath',
    }),
    resolutions: Object.freeze({
      welcomeToHemlockVale: 'resolution1',
      hemlockHouse: 'resolution1',
      writtenInRock: 'resolution1',
      dawnOfTheSecondDay: 'resolution2',
      theThingInTheDepths: 'resolution1',
      theLongestNight: 'resolution1',
      dawnOfTheFinalDay: 'resolution2',
      theSilentHeath: 'resolution1',
      preludeTheFinalEvening: 'resolution4',
      fateOfTheVale: 'resolution1',
    }),
  }),
  // 失败路线：三个勘察槽全部「跳过本次勘察」，只打四段序曲 + 两个夜章 → 最终夜 resolution3。
  lost: Object.freeze({
    choices: Object.freeze({
      surveyChoiceDay1: 'reschedule',
      firstEveningCodex: 'skipCodex',
      firstEveningMeal: 'dontEatAnymore',
      firstEveningChoice: 'searchForBertie',
      surveyChoiceDay2: 'reschedule',
      secondEveningCodex: 'skipCodex',
      secondEveningChoice: 'followDrMarquez',
      surveyChoiceDay3: 'reschedule',
    }),
    resolutions: Object.freeze({
      welcomeToHemlockVale: 'resolution1',
      theTwistedHollow: 'resolution1',
      dawnOfTheSecondDay: 'resolution2',
      theLongestNight: 'resolution1',
      dawnOfTheFinalDay: 'resolution2',
      preludeTheFinalEvening: 'resolution3',
    }),
    loseCampaign: true,
  }),
})

const SEED_A = 'p8-fhv-route-a'
const SEED_B = 'p8-fhv-route-b'
const SEED_LOST = 'p8-fhv-route-lost'

// ---------------------------------------------------------------------------
// 夹具：真实引擎驱动（hub → 章节 → 结算 → 幕间整备 → 下一章）
// ---------------------------------------------------------------------------
const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

/** 校验并提交一个合法动作（`validateMove` 与真实大厅同一判据）。 */
function submit (state, seat, move, onAction) {
  const legal = legalMoves(state, seat)
  assert.ok(move, `缺少合法动作（座位 ${seat}，ui=${state.uiState}，节点=${state.campaign?.flow?.nodeId}）：`
    + `${legal.map(item => item.action).join(',')}`)
  const error = validateMove(state, seat, plainMove(move))
  assert.equal(error, null, `非法动作 ${move.action}：${error}`)
  applyMove(state, seat, plainMove(move))
  onAction?.(state)
}

function findMove (state, seat, ...actions) {
  const legal = legalMoves(state, seat)
  for (const action of actions) {
    const hit = legal.find(move => move.action === action && !move.disabled)
    if (hit) return hit
  }
  return null
}

const legalActions = (state, seat = decisionSeat(state)) =>
  [...new Set(legalMoves(state, seat).map(move => move.action))]

/**
 * 待决选择的答案：按 `pendingChoice.source` 取路线表；其余用安全选项。
 * `mechanic` 是引擎的选择事务（先 `pick:<n>` 后 `confirm`），`resolution` 只在失败路线选输掉战役。
 */
function chooseOptionId (choice, route) {
  const ids = choice.options.map(option => option.id)
  const wanted = route.choices?.[choice.source]
  if (wanted && ids.includes(wanted)) return wanted
  if (route.loseCampaign && choice.kind === 'resolution' && ids.includes('loseTheCampaign')) return 'loseTheCampaign'
  if (choice.kind === 'mechanic') {
    if (ids.includes('confirm')) return 'confirm'
    return ids.find(id => id.startsWith('pick:')) || ids[0]
  }
  for (const safe of ['done', 'skip', 'cancel']) if (ids.includes(safe)) return safe
  return ids[0]
}

class StopPlay extends Error {}

function settle (state, route, { onCheckpoint, onAction } = {}) {
  for (let guard = 0; state.pendingChoice && guard < 240; guard += 1) {
    const choice = state.pendingChoice
    onCheckpoint?.(state, 'choice')
    submit(state, choice.seat, {
      action: 'choose', choiceId: choice.id, optionId: chooseOptionId(choice, route),
    }, onAction)
  }
  assert.ok(!state.pendingChoice, `待决选择未收敛（${state.pendingChoice?.kind}/${state.pendingChoice?.source}）`)
}

/**
 * 沿真实 hub 推进整场战役，直到 `onCheckpoint` 抛 StopPlay 或对局结束。
 * `onScenarioStart` 记录每章入场时的日期；`onInterlude` 记录整备窗（升级窗判据）。
 */
function driveCampaign (state, {
  route, onCheckpoint, onScenarioStart, onInterlude, onAction, maxSteps = 800,
} = {}) {
  let current = null
  let boughtAtWindow = false
  const step = (seat, move) => submit(state, seat, move, onAction)
  try {
    for (let index = 0; index < maxSteps; index += 1) {
      onCheckpoint?.(state, 'step')
      settle(state, route, { onCheckpoint, onAction })
      onCheckpoint?.(state, 'after-settle')
      if (state.status !== 'playing') return state
      if (state.uiState === 'campaignHub') {
        if (!state.campaign.leadConfirmed) { step(0, findMove(state, 0, 'hubSetLeader')); continue }
        step(0, findMove(state, 0, 'hubGoSetup', 'hubSelectScenario'))
        continue
      }
      if (state.uiState === 'scenarioSetup') {
        if (state.hubReady) { step(0, findMove(state, 0, 'hubBeginScenario')); continue }
        const seat = actingSeats(state)[0]
        step(seat, findMove(state, seat, 'hubAutoDeck', 'hubConfirmDeck', 'hubDoneSeat', 'hubSelectInvestigator', 'hubSetDeck'))
        continue
      }
      if (state.uiState === 'inScenario') {
        if (state.scenario.id !== current) {
          current = state.scenario.id
          onScenarioStart?.(state, current)
        }
        const key = route.resolutions[current] || Object.keys(state.scenario.resolutions || {})[0]
        step(state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey: key })
        continue
      }
      if (state.uiState === 'scenarioResult') {
        step(0, findMove(state, 0, 'hubContinue'))
        continue
      }
      if (state.uiState === 'interlude') {
        onInterlude?.(state)
        if (route.buyAt && state.campaign.flow?.nodeId === route.buyAt && !boughtAtWindow
          && findMove(state, 0, 'hubAutoUpgrade')) {
          // 只买一次：hubAutoUpgrade 是内容层「自动选择一次合法升级」，与大厅按钮同一条购买原语。
          boughtAtWindow = true
          step(0, findMove(state, 0, 'hubAutoUpgrade'))
          continue
        }
        const seat = actingSeats(state)[0]
        step(seat, findMove(state, seat, 'hubDoneSeat'))
        continue
      }
      assert.fail(`未预期的 uiState：${state.uiState}`)
    }
  } catch (error) {
    if (error instanceof StopPlay) return state
    throw error
  }
  assert.fail('战役未在预期步数内结束')
}

function createCampaign ({ seed, difficulty = 'standard', players = null, seatInvestigators = null } = {}) {
  const seated = players || [{ seat: 0, role: 'human' }]
  return createGameState({
    campaignId: CAMPAIGN_ID,
    campaignHub: true,
    playerInvestigator: seatInvestigators?.[0] || '10001',
    ...(seatInvestigators ? { seatInvestigators } : {}),
    difficulty,
    seed,
  }, seated)
}

/** 检查点投影：只取纯数据（存档往返与 replay 断言共用）。 */
function projectionOf (state) {
  return JSON.parse(JSON.stringify({
    status: state.status,
    outcome: state.outcome,
    uiState: state.uiState,
    nodeId: state.campaign?.flow?.nodeId ?? null,
    records: state.campaign.records,
    scenarioResults: state.campaign.scenarioResults.map(result => ({
      scenarioId: result.scenarioId, resolution: result.resolution, visitId: result.visitId,
    })),
    history: (state.campaign.flow?.history || []).map(visit => ({
      nodeId: visit.nodeId, choice: visit.choice ?? null,
    })),
    chaosBag: state.chaosBag,
    campaignBag: state.campaign.chaosBag,
    investigators: Object.fromEntries(Object.entries(state.campaign.investigators || {}).map(([seat, record]) => [seat, {
      status: record.status, xp: record.xp, purchases: record.purchases?.length || 0,
      removed: record.removedCards?.length || 0, deck: record.deck?.length || 0,
    }])),
  }))
}

function scenarioTrace (state) {
  return state.campaign.scenarioResults.map(result => `${result.scenarioId}:${result.resolution}`)
}

// ---------------------------------------------------------------------------
// 参考路线 A（只跑一次：完整路线断言、升级窗断言、存档快照、replay 基线共用）
// ---------------------------------------------------------------------------
const SNAPSHOT_ORDER = ['surveyChoice', 'resident', 'upgrade', 'finalNight']

function snapshotIdOf (state) {
  const nodeId = state.campaign?.flow?.nodeId
  if (state.pendingChoice?.source === 'surveyChoiceDay1') return 'surveyChoice'
  if (state.pendingChoice?.source === 'firstEveningMeal'
    && (state.campaign?.records?.codexRead || []).includes('theta')) return 'resident'
  if (state.uiState === 'interlude' && nodeId === 'dawn2Prep' && !state.hubReady) return 'upgrade'
  if (state.uiState === 'scenarioSetup' && nodeId === 'preludeTheFinalEvening') return 'finalNight'
  return null
}

let referenceRun = null
function reference () {
  if (referenceRun) return referenceRun
  const state = createCampaign({ seed: SEED_A })
  const scenarios = []
  const interludes = []
  const snapshots = {}
  const stepHashes = [stateHash(state)]
  driveCampaign(state, {
    route: ROUTES.a,
    onScenarioStart: (live, scenarioId) => scenarios.push({ scenarioId, date: live.campaign.records.hemlockDate }),
    onInterlude: live => {
      const nodeId = live.campaign.flow.nodeId
      if (interludes.some(row => row.nodeId === nodeId)) return
      interludes.push({
        nodeId,
        upgradesAllowed: live.campaign.upgradesAllowed,
        actions: legalActions(live, 0),
        xp: live.campaign.investigators[0]?.xp ?? 0,
        unspentXp: live.campaign.records.unspentXp,
        xpSum: Object.values(live.campaign.investigators).reduce((sum, record) => sum + (Number(record.xp) || 0), 0),
      })
    },
    onCheckpoint: live => {
      const id = snapshotIdOf(live)
      if (id && !snapshots[id]) {
        snapshots[id] = { json: JSON.stringify(live), projection: projectionOf(live) }
      }
    },
    onAction: live => stepHashes.push(stateHash(live)),
  })
  referenceRun = { state, scenarios, interludes, snapshots, stepHashes }
  return referenceRun
}

// 路线 B：另一条勘察顺序 + 夜 1 夜探 + 夜 2 固定夜章；同时记录勘察过滤与居民记录。
let routeBRun = null
function routeB () {
  if (routeBRun) return routeBRun
  const state = createCampaign({ seed: SEED_B })
  const surveyOptions = {}
  const scenarios = []
  const residentsAfterCodex = {}
  driveCampaign(state, {
    route: ROUTES.b,
    onScenarioStart: (live, scenarioId) => scenarios.push({ scenarioId, date: live.campaign.records.hemlockDate }),
    onCheckpoint: live => {
      const choice = live.pendingChoice
      if (!choice) return
      if (String(choice.source).startsWith('surveyChoice')) {
        surveyOptions[choice.source] = choice.options.map(option => option.id)
      }
      if (choice.source === 'secondEveningChoice') {
        // 夜 2 法典 leah 已写入（关系 +1 / 笔记），这里快照一份用于「跨章后仍一致」的断言。
        residentsAfterCodex.leah = {
          level: residentLevel(live.campaign.records, 'leahAtwood'),
          notes: residentNotes(live.campaign.records, 'leahAtwood'),
          river: residentLevel(live.campaign.records, 'riverHawthorne'),
        }
      }
    },
  })
  routeBRun = { state, surveyOptions, scenarios, residentsAfterCodex }
  return routeBRun
}

// ---------------------------------------------------------------------------
// ① 混乱袋 / 流程数据契约（引擎标记名、迁移声明、12 步清单）
// ---------------------------------------------------------------------------
test('P8 FHV 数据契约：四档混乱袋用引擎标记名，序曲 R1 的 [autoFail] 迁移可被引擎读取，12 步清单齐全', () => {
  assert.equal(fhvManifest.status, 'playable')
  assert.deepEqual([...fhvManifest.scenarioIds], [...FHV_SCENARIO_IDS])
  assert.equal(FHV_SCENARIO_IDS.length, 12)
  assert.deepEqual([...fhvManifest.surveyScenarios], [...FHV_SURVEY_SCENARIO_IDS])
  assert.equal(fhvManifest.endgameScenarioId, ENDGAME)
  assert.deepEqual([...FHV_EVENING_STEPS], ['preludeTheFirstEvening', 'preludeTheSecondEvening'])

  // 四档袋：只含引擎认识的标记名；旧印是小写 `eldersign`（写成 `elderSign` 时引擎按未知标记结算）。
  const sizes = {}
  for (const [difficulty, bag] of Object.entries(CHAOS_BAGS)) {
    sizes[difficulty] = bag.length
    for (const token of bag) {
      assert.ok(NUMERIC_TOKEN.test(token) || SYMBOL_TOKENS.includes(token),
        `${difficulty} 混乱袋含未知标记 ${token}（引擎只认小写符号名）`)
    }
    assert.equal(bag.filter(token => token === 'eldersign').length, 1, `${difficulty} 缺 [elder_sign]`)
    assert.ok(!bag.includes('elderSign'), `${difficulty} 仍用 old spelling elderSign`)
    // 序曲结局 1 之前战役袋没有 [autoFail]：它由 chaosBagTransitions 在结算后加入。
    assert.ok(!bag.includes('autofail'), `${difficulty} 基础袋不应预置 [auto_fail]`)
    assert.equal(bag.filter(token => token === 'skull').length, 2)
  }
  assert.deepEqual(sizes, { easy: 14, standard: 14, hard: 15, expert: 16 })
  assert.deepEqual(fhvManifest.chaosBags, CHAOS_BAGS)

  // 迁移声明与引擎读点同形（`<scenarioId>/<resolutionKey>` → `adds`）。
  assert.equal(FHV_CHAOS_BAG_TRANSITIONS.length, 7)
  const welcome = FHV_CHAOS_BAG_TRANSITIONS.find(row => row.id === 'welcomeResolution')
  assert.equal(welcome.when, `${PRELUDE_1}/resolution1`)
  assert.deepEqual([...welcome.adds], ['autofail'])
  for (const row of FHV_CHAOS_BAG_TRANSITIONS) {
    for (const token of row.adds || []) assert.ok(SYMBOL_TOKENS.includes(token), `迁移声明里的标记名非引擎口径：${token}`)
  }
  // 勘察选择节点与时间路由仍在（欢迎序曲五区全开 + 「跳过本次勘察」）。
  assert.ok(FHV_FLOW.nodes.surveyChoiceDay1.options.some(option => option.id === 'reschedule'))
  assert.equal(FHV_FLOW.nodes[SURVEY_ROUTER_ID].rules.length, 6)
  // 四个序曲整备节点是唯一购牌窗（内容声明 upgrades:true）。
  assert.equal(PREP_STEPS.length, 4)
  for (const spec of PREP_STEPS) assert.equal(FHV_FLOW.nodes[spec.nodeId].upgrades, true, spec.nodeId)
  for (const scenarioId of [...FHV_SURVEY_SCENARIO_IDS, 'theTwistedHollow', 'theLongestNight', ENDGAME]) {
    assert.equal(FHV_FLOW.nodes[scenarioId].noUpgrade, true, `${scenarioId} 应标 noUpgrade`)
  }
})

// ---------------------------------------------------------------------------
// ② 完整合法战役 · 路线 A（真实 hub 全 10 章 → 最终夜 → 终章 → 尾声）
// ---------------------------------------------------------------------------
test('P8 FHV 路线 A：岩间密语→扭曲空洞→汉洛克庄园→夜 2 夜探→消失的姐妹→终章，节点/日期/区域/经验/结局', () => {
  const run = reference()
  const state = run.state

  // 场景顺序（单局 10 章：勘察/夜探互斥，12 步里的另两章由路线 B 覆盖）。
  assert.deepEqual(scenarioTrace(state), [
    'welcomeToHemlockVale:resolution1',
    'writtenInRock:resolution1',
    'theTwistedHollow:resolution1',
    'dawnOfTheSecondDay:resolution2',
    'hemlockHouse:resolution1',
    'theSilentHeath:resolution1',
    'dawnOfTheFinalDay:resolution2',
    'theLostSister:resolution1',
    'preludeTheFinalEvening:resolution4',
    'fateOfTheVale:resolution3',
  ])

  // 流程图逐节点（含勘察选择、时间路由、两段纯叙事夜、最终夜失败/正常分支节点）。
  assert.deepEqual(state.campaign.flow.history.map(visit => visit.choice
    ? `${visit.nodeId}(${visit.choice})` : visit.nodeId), [
    'prologue', 'prologueRules', 'welcomeToHemlockVale', 'welcomePrep', 'surveyChoiceDay1(writtenInRock)',
    'writtenInRock', 'surveyRouter(day1)', 'preludeTheFirstEvening', 'firstEveningCodex(theta)',
    'firstEveningMeal(dontEatAnymore)', 'firstEveningChoice(searchForBertie)', 'theTwistedHollow',
    'dawnOfTheSecondDay', 'dawn2Prep', 'surveyChoiceDay2(hemlockHouse)', 'hemlockHouse',
    'surveyRouter(day2)', 'preludeTheSecondEvening', 'secondEveningCodex(skipCodex)',
    'secondEveningChoice(gatherMoreInformation)', 'surveyChoiceNight2(theSilentHeath)', 'theSilentHeath',
    'surveyRouter(night2)', 'dawnOfTheFinalDay', 'dawnFinalPrep', 'surveyChoiceDay3(theLostSister)',
    'theLostSister', 'surveyRouter(day3)', 'preludeTheFinalEvening', 'finalEveningOutcome',
    'finalEveningPrep', 'fateOfTheVale', 'epilogue', 'end',
  ])
  assert.ok(!state.campaign.flow.history.some(visit => visit.nodeId === 'firstEveningChoice'
    && visit.choice === 'gatherMoreInformation'), '路线 A 的夜 1 走固定夜章')

  // 三天三夜：每章入场时的日期记录（`hemlockDate` = `day:period`，与 scenario-calendar 同形）。
  assert.deepEqual(run.scenarios, [
    { scenarioId: 'welcomeToHemlockVale', date: '1:day' },
    { scenarioId: 'writtenInRock', date: '1:day' },
    { scenarioId: 'theTwistedHollow', date: '1:night' },
    { scenarioId: 'dawnOfTheSecondDay', date: '2:day' },
    { scenarioId: 'hemlockHouse', date: '2:day' },
    { scenarioId: 'theSilentHeath', date: '2:night' },
    { scenarioId: 'dawnOfTheFinalDay', date: '3:day' },
    { scenarioId: 'theLostSister', date: '3:day' },
    { scenarioId: 'preludeTheFinalEvening', date: '3:night' },
    { scenarioId: 'fateOfTheVale', date: '3:night' },
  ])
  const records = state.campaign.records
  assert.equal(records.hemlockDate, '3:night')
  assert.equal(records.day, 3)
  assert.equal(records.time, 'night')
  assert.deepEqual(records.surveyChoices, [
    'day1:writtenInRock', 'day2:hemlockHouse', 'night2:theSilentHeath', 'day3:theLostSister',
  ])
  assert.deepEqual(records.nightBranches, ['night1:searchForBertie:theTwistedHollow', 'night2:gatherMoreInformation'])

  // 已勘察区域：四场勘察章节 + 夜 1 的固定夜探区域（westernWoods）都记进战役记录。
  assert.deepEqual(surveyedAreas(records),
    ['northPointMine', 'hemlockHarbor', 'pearlRidge', 'akwanShoreline', 'westernWoods'])
  // 《失落的姐妹》结局 1 在印刷链上接结局 3：R3 的记录与 R4 的勘察勾选必须一并落账。
  assert.equal(records.elizabethPetersWasSaved, true)
  assert.equal(records.akwanShorelineSurveyed, true)
  assert.equal(records.lostSisterResolutionFinal, 'resolution4')

  // 未花费经验：整备窗同步快照（`runPrepare` 的 `syncUnspentXp`）与各席位 `xp` 之和一致；
  // 章末再奖励的经验会让终局快照落后于权威值（记录本身是快照，权威仍是 record.xp）。
  for (const row of run.interludes) {
    assert.equal(row.unspentXp, row.xpSum, `${row.nodeId} 整备窗未花费经验快照应同步`)
  }
  const xpSum = Object.values(state.campaign.investigators).reduce((sum, record) => sum + record.xp, 0)
  assert.ok(xpSum > 0, `未花费经验应大于 0（实际 ${xpSum}）`)
  assert.ok(records.unspentXp >= 0)
  const buyer = state.campaign.investigators[0]
  assert.equal(buyer.purchases.length, 1, '序曲整备窗应能完成一次购牌')
  assert.match(String(buyer.purchases[0].added), /^\d{5}$/, '购牌记录应带卡号')
  assert.ok(Number.isInteger(buyer.xp) && buyer.xp >= 0, `未花费经验应是非负整数（实际 ${buyer.xp}）`)

  // 升级窗：四个整备 interlude 都开窗，且整备窗确实给出购牌候选。
  assert.deepEqual(run.interludes.map(row => row.nodeId),
    PREP_STEPS.map(spec => spec.nodeId))
  for (const row of run.interludes) {
    assert.equal(row.upgradesAllowed, true, `${row.nodeId} 应开升级窗`)
    assert.ok(row.actions.includes('hubDoneSeat'), `${row.nodeId} 应能确认整备`)
  }
  const withXp = run.interludes.filter(row => row.xp > 0)
  assert.ok(withXp.length >= 2)
  for (const row of withXp) {
    assert.ok(row.actions.includes('hubPurchase'), `${row.nodeId} 有经验时应给出购牌候选`)
    assert.ok(row.actions.includes('hubAutoUpgrade'), `${row.nodeId} 有经验时应给出自动升级候选`)
  }

  // 结局：尾声按记录分支写 victory（山谷得救），战役在 campaignResult 收尾。
  assert.equal(state.status, 'over')
  assert.equal(state.outcome, 'victory')
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.campaign.result, 'victory')
  assert.equal(state.campaign.flowOutcome, 'campaignComplete')
  assert.equal(records.campaignOutcome, 'victory')
  assert.equal(records.fhvResolution, 'victory')
  assert.equal(records.valeFate, FHV_OUTCOMES.valeSaved)
  const branch = fhvEpilogueBranch(records)
  assert.equal(branch.id, 'valeSaved')
  assert.equal(branch.outcome, records.campaignOutcome)
  assert.equal(records.campaignOutcomeBranch, branch.id)
  assert.ok(Array.isArray(records.epilogueCodex))
  for (const id of records.epilogueCodex) {
    assert.ok(['atwoods', 'hemlocks', 'judith', 'theo'].includes(id), `尾声法典条目非法：${id}`)
  }
  for (const resident of records.survivingResidents) {
    assert.ok(FHV_RESIDENTS.some(row => row.id === resident), `尾声居民清单含未知居民 ${resident}`)
  }
})

// ---------------------------------------------------------------------------
// ③ 完整合法战役 · 路线 B（不同勘察顺序 + 夜 1 夜探 + 夜 2《最长一夜》）
// ---------------------------------------------------------------------------
test('P8 FHV 路线 B：汉洛克庄园→夜 1 夜探→深沼之物→最长一夜→寂静荒野→终章，勘察过滤与居民记录跨章持久', () => {
  const { state, surveyOptions, scenarios, residentsAfterCodex } = routeB()

  assert.deepEqual(scenarioTrace(state), [
    'welcomeToHemlockVale:resolution1',
    'hemlockHouse:resolution1',
    'writtenInRock:resolution1',
    'dawnOfTheSecondDay:resolution2',
    'theThingInTheDepths:resolution1',
    'theLongestNight:resolution1',
    'dawnOfTheFinalDay:resolution2',
    'theSilentHeath:resolution1',
    'preludeTheFinalEvening:resolution4',
    'fateOfTheVale:resolution1',
  ])
  // 夜 2《最长一夜》之后先过疲劳节点，再到最终日黎明（参考 nextStep）。
  const nodes = state.campaign.flow.history.map(visit => visit.nodeId)
  assert.ok(nodes.includes('theLongestNight'))
  assert.ok(nodes.indexOf('fatigue') > nodes.indexOf('theLongestNight'))
  assert.ok(nodes.indexOf('fatigue') < nodes.indexOf('dawnOfTheFinalDay'))
  assert.equal(state.campaign.records.fatiguePending, 0, '疲劳在最终日黎明被章节结算')

  // 勘察选择按「未勘察区域」过滤：day1 五区全开，night1 过滤掉已勘察的汉洛克港，
  // day2 再过滤岩间密语，day3 只剩寂静荒野/消失的姐妹。
  assert.deepEqual(surveyOptions.surveyChoiceDay1,
    [...FHV_SURVEY_SCENARIO_IDS, 'reschedule'])
  assert.ok(!surveyOptions.surveyChoiceNight1.includes('hemlockHouse'))
  assert.deepEqual(surveyOptions.surveyChoiceNight1,
    FHV_SURVEY_SCENARIO_IDS.filter(id => id !== 'hemlockHouse').concat('reschedule'))
  assert.deepEqual(surveyOptions.surveyChoiceDay2,
    ['theSilentHeath', 'theLostSister', 'theThingInTheDepths', 'reschedule'])
  assert.deepEqual(surveyOptions.surveyChoiceDay3, ['theSilentHeath', 'theLostSister', 'reschedule'])
  assert.deepEqual(state.campaign.records.surveyChoices, [
    'day1:hemlockHouse', 'night1:writtenInRock', 'day2:theThingInTheDepths', 'day3:theSilentHeath',
  ])
  assert.deepEqual(state.campaign.records.nightBranches,
    ['night1:gatherMoreInformation', 'night2:followDrMarquez:theLongestNight'])

  // 已勘察区域：两次夜探（东威克沼、南田野）与三场白日勘察都进记录。
  assert.deepEqual(surveyedAreas(state.campaign.records),
    ['northPointMine', 'hemlockHarbor', 'pearlRidge', 'eastwickBog', 'southernFields'])
  assert.deepEqual(scenarios.map(row => row.date),
    ['1:day', '1:day', '1:night', '2:day', '2:day', '2:night', '3:day', '3:day', '3:night', '3:night'])

  // 居民关系 / 笔记：夜 1 法典（delta → 河流 +1）、夜 2 法典（leah → 莉亚 +1 + 共舞笔记）、
  // 岩间密语结局 1（西米恩 +2、记录 survived）。跨章后从战役记录重新读出仍一致。
  const records = state.campaign.records
  assert.equal(residentLevel(records, 'riverHawthorne'), 1)
  assert.equal(residentLevel(records, 'leahAtwood'), 1)
  assert.ok(residentNotes(records, 'leahAtwood').includes('leahSharedADance'))
  assert.equal(records.leahSharedADance, true)
  assert.equal(residentLevel(records, 'simeonAtwood'), 2)
  assert.equal(records.simeonSurvived, true)
  assert.ok(residentNotes(records, 'simeonAtwood').includes('simeonSurvived'))
  assert.deepEqual(residentsAfterCodex.leah, {
    level: 1, notes: ['leahSharedADance'], river: 1,
  })
  // 记录双写：关系等级同时写 `<id>RelationshipLevel` 与 `relationships` 映射（章节行为同一口径）。
  assert.equal(records.riverHawthorneRelationshipLevel, 1)
  assert.equal(records.relationships.riverHawthorne, 1)
  assert.deepEqual(records.codexRead, ['delta', 'leah'])
  const xpSum = Object.values(state.campaign.investigators).reduce((sum, record) => sum + record.xp, 0)
  assert.ok(xpSum > 0)
  assert.ok(records.unspentXp >= 0, '未花费经验快照应是数值（权威值在 record.xp）')

  // 结局：终章 resolution1（马奎兹博士献身）→ 尾声 victory。
  assert.equal(state.status, 'over')
  assert.equal(state.outcome, 'victory')
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(records.campaignOutcome, 'victory')
  assert.equal(records.campaignOutcomeBranch, 'marquezSacrificed')
  assert.equal(records[FHV_OUTCOMES.marquezSacrificed], true)
  assert.equal(fhvEpilogueBranch(records).outcome, 'victory')
})

test('P8 FHV 两条路线合起来覆盖 manifest 的 12 个 ScenarioStep（勘察/夜探互斥，单局 10 章）', () => {
  const a = reference().state.campaign.scenarioResults.map(result => result.scenarioId)
  const b = routeB().state.campaign.scenarioResults.map(result => result.scenarioId)
  assert.equal(new Set(a).size, 10)
  assert.equal(new Set(b).size, 10)
  assert.deepEqual([...new Set([...a, ...b])].sort(), [...ALL_MAINLINE].sort())
  // 互斥选择：路线 A 走固定夜 1 + 夜探夜 2；路线 B 走夜探夜 1 + 固定夜 2。
  assert.ok(a.includes('theTwistedHollow') && !b.includes('theTwistedHollow'))
  assert.ok(b.includes('theLongestNight') && !a.includes('theLongestNight'))
  assert.ok(!a.includes('theThingInTheDepths') && b.includes('theThingInTheDepths'))
  assert.ok(a.includes('theLostSister') && !b.includes('theLostSister'))
})

// ---------------------------------------------------------------------------
// ④ 失败 / 撤退路线（最终夜 resolution3 → 输掉战役；含「跳过本次勘察」调度重抽）
// ---------------------------------------------------------------------------
test('P8 FHV 失败路线：最终夜选择输掉战役 → 尾声 defeat / campaignResult，结算页不再软锁', () => {
  const state = createCampaign({ seed: SEED_LOST })
  let afterFinalNight = null
  let finalTitle = null
  driveCampaign(state, {
    route: ROUTES.lost,
    onScenarioStart: (live, scenarioId) => {
      if (scenarioId === 'preludeTheFinalEvening') finalTitle = live.scenario.name
    },
    onCheckpoint: (live, phase) => {
      // 最终夜结算后：引擎必须仍是 playing，且结算页给出 hubContinue（修复前 status='lost' 无动作）。
      if (live.uiState === 'scenarioResult' && !afterFinalNight
        && live.campaign.scenarioResults.at(-1)?.scenarioId === 'preludeTheFinalEvening') {
        afterFinalNight = { status: live.status, actions: legalActions(live, 0), phase }
        throw new StopPlay()
      }
    },
  })

  assert.ok(afterFinalNight, '没有观察到最终夜结算页')
  assert.equal(afterFinalNight.status, 'playing', '最终夜结算后引擎应保持 playing（不再写 lost）')
  assert.ok(afterFinalNight.actions.includes('hubContinue'), '结算页必须有 hubContinue')
  assert.ok(['step', 'after-settle'].includes(afterFinalNight.phase))
  assert.ok(finalTitle)

  const records = state.campaign.records
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution3')
  assert.equal(records.preludeTheFinalEveningNextStep, 'lost')
  assert.equal(records.preludeTheFinalEveningLost, true)
  assert.equal(state.investigators.filter(inv => inv.killed).length, state.investigators.length)
  assert.deepEqual(records.rescheduledSurveys, ['day1->night1', 'day2->night2', 'day3->night3'])
  assert.deepEqual(records.surveyChoices, [], '失败路线跳过全部勘察，没有勘察选择')
  // 跳过的槽位不再开局：流程直接走四段序曲 + 两个夜章。
  assert.deepEqual(state.campaign.scenarioResults.map(result => result.scenarioId), [
    'welcomeToHemlockVale', 'theTwistedHollow', 'dawnOfTheSecondDay', 'theLongestNight',
    'dawnOfTheFinalDay', 'preludeTheFinalEvening',
  ])

  // 继续从结算页进入尾声：流程走 finalEveningOutcome → epilogue → end，战役按 defeat 收尾。
  driveCampaign(state, { route: ROUTES.lost })
  assert.equal(state.status, 'over')
  assert.equal(state.outcome, 'defeat')
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.campaign.result, 'defeat')
  // applyMove 的事务会用快照重建 state，跨动作缓存的 records 引用会失效：收尾后重新取。
  const finalRecords = state.campaign.records
  assert.equal(finalRecords.campaignOutcome, 'defeat')
  assert.equal(finalRecords.fhvResolution, 'defeat')
  assert.equal(finalRecords.campaignOutcomeBranch, 'otherwise')
  assert.equal(fhvEpilogueBranch(finalRecords).outcome, 'defeat')
  const nodes = state.campaign.flow.history.map(visit => visit.nodeId)
  assert.ok(nodes.includes('finalEveningOutcome'))
  assert.ok(nodes.includes('epilogue'))
  assert.equal(nodes.at(-1), 'end')
  assert.ok(!nodes.includes('fateOfTheVale'), '输掉战役时不再进终章')
})

// ---------------------------------------------------------------------------
// ⑤ 四档难度
// ---------------------------------------------------------------------------
function advanceTurns (state, route, count) {
  settle(state, route)
  for (let turn = 0; turn < count; turn += 1) {
    const seat = actingSeats(state)[0]
    submit(state, seat, findMove(state, seat, 'endTurn'))
    settle(state, route)
  }
}

test('P8 FHV 四档难度：easy/standard/hard/expert 开局到第一章并推进两回合，袋/迁移/结算无异常', () => {
  const sizes = []
  const signatures = []
  for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
    const state = createCampaign({ seed: `p8-fhv-difficulty-${difficulty}`, difficulty })
    assert.equal(state.difficulty, difficulty)
    // 开局到第一章（真实 hub：选第一关 → 配置 → 确认 → 开始）。
    driveCampaign(state, {
      route: ROUTES.a,
      onCheckpoint: live => {
        if (live.uiState === 'inScenario' && live.scenario?.id === PRELUDE_1) throw new StopPlay()
      },
    })
    assert.equal(state.uiState, 'inScenario')
    assert.equal(state.scenario.id, PRELUDE_1)
    // 混乱袋与难度同源：首章开局袋 = CHAOS_BAGS[difficulty]（四档 14/14/15/16）。
    assert.deepEqual([...state.chaosBag], [...CHAOS_BAGS[difficulty]], `${difficulty} 开局混乱袋不一致`)
    assert.deepEqual([...state.campaign.chaosBag], [...CHAOS_BAGS[difficulty]])
    sizes.push(state.chaosBag.length)
    signatures.push([...state.chaosBag].sort().join(','))
    assert.equal(state.campaign.records.hemlockDate, '1:day')
    assert.equal(state.campaign.records.day, 1)

    // 推进两个真实回合（回合流程 + 神话/维护窗口都经待决选择收敛）。
    const startedRound = state.round
    advanceTurns(state, ROUTES.a, 2)
    assert.equal(state.status, 'playing')
    assert.equal(state.uiState, 'inScenario')
    assert.ok(state.round >= startedRound + 2, `${difficulty} 回合没有推进（${startedRound} → ${state.round}）`)
    assert.equal(state.chaosBag.length, CHAOS_BAGS[difficulty].length, '回合内不应丢袋')

    // 结算第一章：混乱袋迁移把序曲结局 1 的 [autoFail] 永久加进战役袋，随后进入整备窗。
    driveCampaign(state, {
      route: ROUTES.a,
      onCheckpoint: live => {
        if (live.uiState === 'interlude' && live.campaign.flow?.nodeId === 'welcomePrep') throw new StopPlay()
      },
    })
    assert.equal(state.uiState, 'interlude')
    assert.equal(state.campaign.flow.nodeId, 'welcomePrep')
    assert.equal(state.campaign.scenarioResults.length, 1)
    assert.equal(state.campaign.scenarioResults[0].scenarioId, PRELUDE_1)
    assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution1')
    assert.equal(state.campaign.chaosBag.length, CHAOS_BAGS[difficulty].length + 1,
      `${difficulty} 序曲结局 1 应永久加入 1 枚 [auto_fail]`)
    assert.equal(state.campaign.chaosBag.filter(token => token === 'autofail').length, 1)
    assert.equal(state.campaign.upgradesAllowed, true, `${difficulty} 整备窗应允许升级`)
  }
  assert.deepEqual(sizes, [14, 14, 15, 16])
  assert.equal(new Set(signatures).size, 4, '四档混乱袋应互不相同')
})

// ---------------------------------------------------------------------------
// ⑥ 存档恢复（四个关键点 JSON 往返后继续）
// ---------------------------------------------------------------------------
test('P8 FHV 存档恢复：勘察选择前/居民关系写入后/升级窗前/最终夜前 JSON 往返后推进与参考路线一致', () => {
  const run = reference()
  for (const id of SNAPSHOT_ORDER) {
    assert.ok(run.snapshots[id], `参考路线没有捕获检查点 ${id}`)
    const snapshot = run.snapshots[id]
    const resumed = JSON.parse(snapshot.json)
    // 往返后的纯数据投影必须与原件一致（存档不丢记录/流程/袋）。
    assert.deepEqual(projectionOf(resumed), snapshot.projection, `${id} 检查点存档往返后状态不一致`)
    if (id === 'surveyChoice') {
      assert.ok(resumed.pendingChoice, '勘察选择前应保留待决选择')
      assert.equal(resumed.pendingChoice.source, 'surveyChoiceDay1')
      assert.ok(resumed.continuation, '待决选择需要 continuation 才能恢复')
    }
    if (id === 'upgrade') {
      assert.equal(resumed.campaign.upgradesAllowed, true)
      assert.equal(resumed.hubReady, false)
    }
    if (id === 'finalNight') {
      assert.equal(resumed.campaign.flow.nodeId, 'preludeTheFinalEvening')
      assert.equal(resumed.uiState, 'scenarioSetup')
      // 最终夜的时钟在关卡进场时拨到 3:night；出发准备窗口仍是当日白天。
      assert.equal(resumed.campaign.records.hemlockDate, '3:day')
    }
    if (id === 'resident') {
      assert.equal(residentLevel(resumed.campaign.records, 'motherRachel'), 1)
      assert.ok(resumed.campaign.records.codexRead.includes('theta'))
    }
  }

  // 从每个副本继续到下一个检查点（最后一站推进到战役结束），与参考路线完全一致。
  for (let index = 0; index < SNAPSHOT_ORDER.length; index += 1) {
    const id = SNAPSHOT_ORDER[index]
    const nextId = SNAPSHOT_ORDER[index + 1] || null
    const resumed = JSON.parse(run.snapshots[id].json)
    const result = driveCampaign(resumed, {
      route: ROUTES.a,
      onCheckpoint: live => {
        if (nextId) {
          if (snapshotIdOf(live) === nextId) throw new StopPlay()
        } else if (live.status !== 'playing') {
          throw new StopPlay()
        }
      },
    })
    if (nextId) {
      assert.deepEqual(projectionOf(result), run.snapshots[nextId].projection,
        `${id} → ${nextId} 存档继续后状态与参考路线不一致`)
    } else {
      assert.deepEqual(projectionOf(result), projectionOf(run.state),
        '最终夜前存档继续到尾声后与参考路线不一致')
    }
  }
})

// ---------------------------------------------------------------------------
// ⑦ replay 确定性
// ---------------------------------------------------------------------------
test('P8 FHV replay 确定性：同 seed 第二局逐步指纹与引擎逐步哈希一致，终态无差异', () => {
  const run = reference()
  const log = captureReplayLog(run.state)
  assert.ok(log.moves.length > 50, `动作日志过短（${log.moves.length}）`)
  assert.equal(log.meta.moveCount, log.moves.length)
  assert.equal(log.settings.campaignId, CAMPAIGN_ID)
  assert.equal(log.settings.campaignHub, true)
  assert.equal(log.settings.seed, SEED_A)

  const replayedHashes = []
  const replayed = replayLog(log, { observe: state => replayedHashes.push(stateHash(state)) })
  assert.equal(replayedHashes.length, run.stepHashes.length,
    '逐步指纹数量应与引擎实际动作数一致（建局 + 每步）')
  assert.deepEqual(replayedHashes, run.stepHashes, '逐步状态指纹不一致（重放与真实对局分叉）')
  assert.equal(stateHash(replayed), stateHash(run.state))
  assert.deepEqual(stateDiff(run.state, replayed), [])
  assert.equal(replayed.status, 'over')
  assert.equal(replayed.outcome, 'victory')
  assert.deepEqual(scenarioTrace(replayed), scenarioTrace(run.state))
  assert.deepEqual(replayed.campaign.flow.history.map(visit => visit.nodeId),
    run.state.campaign.flow.history.map(visit => visit.nodeId))
})
