// Phase 4 · golden replay 用例：把真实对局固化成"动作日志 + 逐步指纹"后，逐条重放。
//
// 基线在 tests/fixtures/replay/golden-replays.json，由 tools/replay-fixtures.mjs --write 生成；
// recipe 清单与驱动器在 tools/replay-games.mjs。改动规则/内容后如果这里失败：
//   - 行为确实变了 → 补/改对应用例，再用 `npm run replay:fixtures:write` 重新采集；
//   - 只是文案或展示字段变了 → 不应该失败（指纹只覆盖权威状态），先检查是不是真的动到了规则。
//
// 覆盖范围（生成时的实测）：4 个战役、5 个关卡、3 种 uiState、局外准备/幕间升级/关卡结算/
// 待决选择，以及严格规则模式 + 3 席位随机走子。

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { replayLog, STATE_HASH_VERSION, stateHash, verifyReplay } from '../src/engine/replay.js'
import { REPLAY_RECIPES } from '../tools/replay-games.mjs'

const FIXTURES = JSON.parse(fs.readFileSync(new URL('./fixtures/replay/golden-replays.json', import.meta.url), 'utf8'))
const totalSteps = FIXTURES.fixtures.reduce((sum, fixture) => sum + fixture.log.moves.length, 0)

// 一次重放拿到全部中间指纹与最终状态：比"逐步重复重放"快一个数量级（O(n) 而不是 O(n²)）。
function replayTrail(log) {
  const hashes = []
  const state = replayLog(log, { observe: snapshot => hashes.push(stateHash(snapshot)) })
  return { hashes, state }
}

test('基线文件与当前指纹口径、规则版本、recipe 清单一致', () => {
  assert.equal(FIXTURES.version, 1)
  assert.equal(FIXTURES.hashVersion, STATE_HASH_VERSION, '指纹组成变了：必须用当前代码重新采集基线')
  assert.equal(FIXTURES.rulesVersion, RULES_VERSION, '规则版本变了：需要重新采集基线')
  assert.equal(FIXTURES.schemaVersion, STATE_SCHEMA_VERSION)
  assert.deepEqual(FIXTURES.fixtures.map(fixture => fixture.id), REPLAY_RECIPES.map(recipe => recipe.id),
    '基线必须与 recipe 清单逐一对应：新增/删除对局后运行 npm run replay:fixtures:write')
  assert.ok(FIXTURES.fixtures.length >= 8, `基线对局数不应缩水（当前 ${FIXTURES.fixtures.length}）`)
  assert.ok(totalSteps >= 400, `基线总步数不应缩水（当前 ${totalSteps}）`)
})

test('每一局都重放出完全相同的逐步指纹与最终状态', () => {
  for (const fixture of FIXTURES.fixtures) {
    const { log, hashes, final } = fixture
    assert.equal(log.meta.hashVersion, STATE_HASH_VERSION, `${fixture.id}：基线的指纹版本`)
    assert.equal(hashes.length, log.moves.length + 1, `${fixture.id}：逐步指纹数量`)
    const trail = replayTrail(log)
    assert.deepEqual(trail.hashes, hashes, `${fixture.id}：重放的逐步指纹必须与基线一致`)
    assert.equal(stateHash(trail.state), hashes[hashes.length - 1], `${fixture.id}：最终指纹`)
    assert.equal(trail.state.uiState, final.uiState, `${fixture.id}：uiState`)
    assert.equal(trail.state.status, final.status, `${fixture.id}：status`)
    assert.equal(trail.state.scenario?.id ?? null, final.scenario, `${fixture.id}：关卡`)
    assert.equal(trail.state.revision, final.revision, `${fixture.id}：版本号`)
    assert.equal(trail.state.pendingChoice ? trail.state.pendingChoice.kind : null, final.pendingChoice, `${fixture.id}：待决选择`)
  }
})

// 抽样做"存读档 / 差分"的等价检查：全量重复重放会把 fast tier 拖成几十秒，
// 而这两条链路（JSON 往返、until 前缀）已经被上一条用例的逐步指纹覆盖到同一次重放里。
const sampled = FIXTURES.fixtures.filter((fixture, index) => index % 3 === 0)

test('JSON 往返与 `until` 前缀都不改变指纹（存读档、撤销、差分共用同一条链路）', () => {
  for (const fixture of sampled) {
    const last = fixture.log.moves.length
    const restored = JSON.parse(JSON.stringify(fixture.log))
    assert.deepEqual(replayTrail(restored).hashes, fixture.hashes, `${fixture.id}：日志 JSON 往返`)
    assert.equal(stateHash(replayLog(restored, { until: 0 })), fixture.hashes[0], `${fixture.id}：until=0`)
    assert.equal(stateHash(replayLog(restored, { until: last })), fixture.hashes[last], `${fixture.id}：until=末步`)
  }
})

test('至少一局停在待决选择上，且自检（verifyReplay）通过', () => {
  const paused = FIXTURES.fixtures.find(fixture => fixture.final.pendingChoice)
  assert.ok(paused, '基线里必须有一局停在待决选择上（存档续玩的形态）')
  const state = replayLog(paused.log)
  assert.ok(state.pendingChoice && state.continuation, '待决选择必须带恢复凭据')
  const report = verifyReplay(state)
  assert.deepEqual({ ok: report.ok, moves: report.moves, differences: report.differences },
    { ok: true, moves: paused.log.moves.length, differences: [] })
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
  assert.deepEqual([...uiStates].sort(), ['campaignResult', 'inScenario', 'scenarioResult'])
})
