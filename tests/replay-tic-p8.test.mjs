// TIC（《印斯茅斯暗潮》）P8 独立 replay 基线用例。
//
// 基线：tests/fixtures/replay/tic-p8-baseline.json（由 tools/replay-tic-fixtures.mjs --write 采集，
// payload 格式与 tests/fixtures/replay/golden-replays.json 一致）。
// 为什么独立：golden-replays.json 的 13 局被 TDE/TCU 冻结账本逐条锁死，TIC 不能加进去
// （见 tools/replay-tic-recipes.mjs 文件头）。本用例守住三件事：
//   1. 基线 ids 与 tools/replay-tic-recipes.mjs#TIC_REPLAY_RECIPES 逐一对应；
//   2. 8 章每章一条 recipe，且每条的 fixture 终局关卡（final.scenario）就是该章——
//      这是 P8「TIC 8/8 章行为级 replay 覆盖」的机器可核对口径；
//   3. 逐局重放动作日志得到完全相同的逐步指纹（行为零漂移），并覆盖 4 难度 + 失败路线。
//
// 改规则/内容后这里失败时：行为确实变了 → 重新采集基线
// `node tools/replay-tic-fixtures.mjs --write`；只是文案/展示字段变了 → 不应失败（指纹只覆盖权威状态）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { replayHashes, STATE_HASH_VERSION } from '../src/engine/replay.js'
import {
  TIC_CAMPAIGN_ID, TIC_CHAPTER_IDS, TIC_CHAPTER_RECIPE_IDS, TIC_DIFFICULTIES, TIC_REPLAY_RECIPES,
} from '../tools/replay-tic-recipes.mjs'

const BASELINE = JSON.parse(fs.readFileSync(new URL('./fixtures/replay/tic-p8-baseline.json', import.meta.url), 'utf8'))
const fixtureOf = id => BASELINE.fixtures.find(fixture => fixture.id === id)

test('TIC P8 replay 基线：版本 / 指纹口径 / recipe 清单一致', () => {
  assert.equal(BASELINE.version, 1)
  assert.equal(BASELINE.hashVersion, STATE_HASH_VERSION, '指纹组成变了：必须用当前代码重新采集 TIC 基线')
  assert.equal(BASELINE.rulesVersion, RULES_VERSION, '规则版本变了：需要重新采集 TIC 基线')
  assert.equal(BASELINE.schemaVersion, STATE_SCHEMA_VERSION)
  assert.deepEqual(BASELINE.fixtures.map(fixture => fixture.id), TIC_REPLAY_RECIPES.map(recipe => recipe.id),
    'TIC 基线必须与 TIC_REPLAY_RECIPES 逐一对应：新增/删除 recipe 后运行 node tools/replay-tic-fixtures.mjs --write')
  assert.ok(BASELINE.fixtures.length >= 13, `TIC 覆盖不应缩水（当前 ${BASELINE.fixtures.length} 局）`)
})

test('TIC P8 replay 基线：8 章各一条 recipe，终局关卡 = 目标章（8/8 覆盖）', () => {
  assert.equal(TIC_CHAPTER_IDS.length, 8, 'TIC 章节数应为 8')
  const covered = new Set()
  for (const chapterId of TIC_CHAPTER_IDS) {
    const recipeId = TIC_CHAPTER_RECIPE_IDS[chapterId]
    const recipe = TIC_REPLAY_RECIPES.find(item => item.id === recipeId)
    assert.ok(recipe, `缺少章节 recipe：${chapterId}`)
    assert.equal(recipe.target, chapterId, `${recipeId} 的 target 必须是 ${chapterId}`)
    assert.equal(recipe.settings?.campaignId, TIC_CAMPAIGN_ID)
    const fixture = fixtureOf(recipeId)
    assert.ok(fixture, `基线缺少章节 fixture：${recipeId}`)
    assert.equal(fixture.final.scenario, chapterId,
      `${recipeId} 的终局关卡是 ${fixture.final.scenario}，不是目标章 ${chapterId}`)
    // 阶梯证据：第 N 章（N≥2）的 fixture 里应有 N-1 次调试结算，把前面的章推进过去。
    const debugEnds = fixture.log.moves.filter(entry => entry.move.action === 'debug' && entry.move.kind === 'endScenario').length
    const ladderIndex = TIC_CHAPTER_IDS.indexOf(chapterId)
    assert.equal(debugEnds, ladderIndex, `${recipeId} 的调试结算次数应等于前面的章数 ${ladderIndex}`)
    covered.add(chapterId)
  }
  assert.deepEqual([...covered].sort(), [...TIC_CHAPTER_IDS].sort(), 'TIC 8 章必须全部被 recipe 覆盖')
})

test('TIC P8 replay 基线：4 难度与失败路线覆盖', () => {
  const difficulties = BASELINE.fixtures
    .filter(fixture => fixture.id.startsWith('tic-difficulty-'))
    .map(fixture => fixture.recipe?.settings?.difficulty)
  assert.deepEqual([...new Set(difficulties)].sort(), [...TIC_DIFFICULTIES].sort(), 'TIC 应覆盖 easy/standard/hard/expert 四种混乱袋')
  const failure = BASELINE.fixtures.find(fixture => fixture.recipe?.failureResolution)
  assert.ok(failure, '基线缺少失败路线 fixture')
  assert.equal(failure.final.uiState, 'scenarioResult', '失败路线应停在关卡结算形态')
  const resolutions = failure.log.moves
    .filter(entry => entry.move.action === 'debug' && entry.move.kind === 'endScenario')
    .map(entry => entry.move.resolutionKey)
  assert.ok(resolutions.includes(failure.recipe.failureResolution),
    `失败路线必须真的用 ${failure.recipe.failureResolution} 结算（实际：${resolutions.join('、')}）`)
})

test('TIC P8 replay 基线：逐局重放出相同逐步指纹', () => {
  for (const fixture of BASELINE.fixtures) {
    const moves = fixture.log.moves.length
    assert.equal(fixture.hashes.length, moves + 1, `${fixture.id}：指纹数 ${fixture.hashes.length} 与步数 ${moves} 不匹配`)
    assert.equal(fixture.final.hash, fixture.hashes.at(-1), `${fixture.id}：final.hash 与最后一项指纹不一致`)
  }
  for (const fixture of BASELINE.fixtures) {
    const replayed = replayHashes(fixture.log)
    assert.equal(replayed.length, fixture.hashes.length, `${fixture.id}：重放步数不一致`)
    const mismatch = fixture.hashes.findIndex((hash, index) => hash !== replayed[index])
    assert.equal(mismatch, -1, `${fixture.id}：第 ${mismatch} 步指纹不一致——行为漂移，需重新采集基线`)
  }
})
