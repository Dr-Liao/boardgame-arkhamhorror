// Phase 4 · golden replay 用例：把真实对局固化成"动作日志 + 逐步指纹"后，逐条重放。
//
// 本文件只保留「基线文件一致性 / 覆盖率 / 待决选择自检」三道门禁（只读 JSON，不重放整局）；
// 13 局基线的逐步重放按重放成本拆进 replay-golden-notz-gathering / -notz-long / -campaigns 三个文件并行，
// 共用 tests/replay-golden-fixtures.mjs。基线在 tests/fixtures/replay/golden-replays.json，
// 由 tools/replay-fixtures.mjs --write 生成；recipe 清单与驱动器在 tools/replay-games.mjs。
// 改动规则/内容后如果这里失败：
//   - 行为确实变了 → 补/改对应用例，再用 `npm run replay:fixtures:write` 重新采集；
//   - 只是文案或展示字段变了 → 不应该失败（指纹只覆盖权威状态），先检查是不是真的动到了规则。
//
// 覆盖范围（生成时的实测）：4 个战役、5 个关卡、3 种 uiState、局外准备/幕间升级/关卡结算/
// 待决选择，以及严格规则模式 + 3 席位随机走子。
import test from 'node:test'
import assert from 'node:assert/strict'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { replayLog, STATE_HASH_VERSION, stateHash, verifyReplay } from '../src/engine/replay.js'
import { REPLAY_RECIPES } from '../tools/replay-games.mjs'
import { FIXTURES, TOTAL_STEPS } from './replay-golden-fixtures.mjs'

test('基线文件与当前指纹口径、规则版本、recipe 清单一致', () => {
  assert.equal(FIXTURES.version, 1)
  assert.equal(FIXTURES.hashVersion, STATE_HASH_VERSION, '指纹组成变了：必须用当前代码重新采集基线')
  assert.equal(FIXTURES.rulesVersion, RULES_VERSION, '规则版本变了：需要重新采集基线')
  assert.equal(FIXTURES.schemaVersion, STATE_SCHEMA_VERSION)
  assert.deepEqual(FIXTURES.fixtures.map(fixture => fixture.id), REPLAY_RECIPES.map(recipe => recipe.id),
    '基线必须与 recipe 清单逐一对应：新增/删除对局后运行 npm run replay:fixtures:write')
  assert.ok(FIXTURES.fixtures.length >= 8, `基线对局数不应缩水（当前 ${FIXTURES.fixtures.length}）`)
  assert.ok(TOTAL_STEPS >= 400, `基线总步数不应缩水（当前 ${TOTAL_STEPS}）`)
})

test('至少一局停在待决选择上，且自检（verifyReplay）通过', () => {
  const paused = FIXTURES.fixtures.find(fixture => fixture.final.pendingChoice)
  assert.ok(paused, '基线里必须有一局停在待决选择上（存档续玩的形态）')
  const state = replayLog(paused.log)
  assert.ok(state.pendingChoice && state.continuation, '待决选择必须带恢复凭据')
  const report = verifyReplay(state)
  assert.deepEqual({ ok: report.ok, moves: report.moves, differences: report.differences },
    { ok: true, moves: paused.log.moves.length, differences: [] })
  // 停在待决选择的那局也要能被日志 JSON 往返后重放出同一状态。
  const restored = JSON.parse(JSON.stringify(paused.log))
  assert.equal(stateHash(replayLog(restored)), stateHash(state), `${paused.id}：日志 JSON 往返`)
})

test('基线的动作与关卡覆盖不能退化', () => {
  const actions = new Set()
  for (const fixture of FIXTURES.fixtures) {
    for (const entry of fixture.log.moves) actions.add(entry.move.action)
  }
  for (const required of [
    'hubGoSetup', 'hubBeginScenario', 'hubSelectInvestigator', 'hubDoneSeat', 'hubSelectScenario',
    'choose', 'play', 'investigate', 'move', 'fight', 'endTurn', 'advanceAct',
  ]) {
    assert.ok(actions.has(required), `基线里缺少动作类型 ${required}：覆盖范围退化，检查 recipe 是否还能走通`)
  }
  const scenarios = new Set(FIXTURES.fixtures.map(fixture => fixture.final.scenario))
  for (const required of ['theGathering', 'theMidnightMasks', 'curtainCall', 'extracurricularActivity', 'theUntamedWilds']) {
    assert.ok(scenarios.has(required), `基线里缺少关卡 ${required}`)
  }
  const uiStates = new Set(FIXTURES.fixtures.map(fixture => fixture.final.uiState))
  // 敦威治关卡现在能真正推进到幕间（interlude），覆盖范围只增不减。
  assert.deepEqual([...uiStates].sort(), ['campaignResult', 'inScenario', 'interlude', 'scenarioResult'])
})
