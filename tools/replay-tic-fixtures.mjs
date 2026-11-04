// TIC（《印斯茅斯暗潮》）P8 独立 replay 基线工具。
//
// 为什么不是 tools/replay-fixtures.mjs 的第 14..26 条：golden-replays.json 的 13 局
// 被 TDE/TCU 冻结账本逐条锁死（见 tools/replay-tic-recipes.mjs 文件头），因此 TIC 用
// 独立 recipe 清单（tools/replay-tic-recipes.mjs#TIC_REPLAY_RECIPES）与独立基线
// （tests/fixtures/replay/tic-p8-baseline.json）。payload 格式与 replay-fixtures.mjs
// 完全一致，`node tools/replay-fixtures.mjs --compare tests/fixtures/replay/tic-p8-baseline.json`
// 可直接校验。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/replay-tic-fixtures.mjs --write              采集并写入 tic-p8-baseline.json
//   node tools/replay-tic-fixtures.mjs --check              校验已提交基线：同一批动作重放出相同指纹
//   node tools/replay-tic-fixtures.mjs --verify             再用驱动器实时跑一遍，和基线逐条比较
//   node tools/replay-tic-fixtures.mjs --baseline <文件>    采集到任意文件（发布前快照 / 对照）
//   node tools/replay-tic-fixtures.mjs --summary            只打印 per-fixture 的 scenario/uiState/步数表
//
// 退出码：--check/--verify 有任一不符即 1；TIC 章节覆盖（8 章每章一条 recipe）不符也为 1。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { replayHashes, STATE_HASH_VERSION, stateHash } from '../src/engine/replay.js'
import { playRecipe } from './replay-games.mjs'
import { TIC_CHAPTER_IDS, TIC_CHAPTER_RECIPE_IDS, TIC_REPLAY_RECIPES } from './replay-tic-recipes.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXTURE_FILE = path.join(ROOT, 'tests', 'fixtures', 'replay', 'tic-p8-baseline.json')
const FIXTURE_VERSION = 1

const usage = () => {
  console.error('用法：node tools/replay-tic-fixtures.mjs --write | --check | --verify | --baseline <文件> | --summary')
  process.exit(2)
}

const shortHash = hash => String(hash ?? '').slice(0, 12)
const describeMove = move => move ? `${move.action}${move.cardId ? `(${move.cardId})` : ''}${move.choiceId ? ` ${move.optionId}` : ''}` : '(无动作)'

// 与 replay-fixtures.mjs#compactMoves 相同：展示字段（label/explanation）不进基线，
// 否则改一句卡面文案就会变成一次全量基线重采。
function compactMoves(moves) {
  return moves.map(({ seat, move }) => {
    const { label, explanation, ...rest } = move || {}
    return { seat, move: rest }
  })
}

function buildFixture(recipe) {
  const game = playRecipe(recipe)
  const log = game.log
  if (game.hashes.length !== log.moves.length + 1) {
    throw new Error(`${recipe.id} 的逐步指纹数量与动作数不一致（${game.hashes.length} vs ${log.moves.length + 1}）`)
  }
  return {
    id: recipe.id,
    note: recipe.note,
    recipe,
    log: {
      version: log.version,
      meta: log.meta,
      settings: log.settings,
      players: log.players,
      moves: compactMoves(log.moves),
    },
    hashes: game.hashes,
    final: {
      hash: stateHash(game.state),
      revision: game.state.revision,
      uiState: game.state.uiState,
      status: game.state.status,
      scenario: game.state.scenario?.id ?? null,
      outcome: game.state.outcome ?? null,
      pendingChoice: game.state.pendingChoice ? game.state.pendingChoice.kind : null,
    },
  }
}

function payloadFor(fixtures) {
  return {
    version: FIXTURE_VERSION,
    generator: 'node tools/replay-tic-fixtures.mjs --write',
    rulesVersion: RULES_VERSION,
    schemaVersion: STATE_SCHEMA_VERSION,
    hashVersion: STATE_HASH_VERSION,
    fixtures,
  }
}

function writePayload(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8')
}

function readPayload(file) {
  if (!fs.existsSync(file)) throw new Error(`找不到基线文件：${file}`)
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (payload.version !== FIXTURE_VERSION) throw new Error(`未知的基线版本：${payload.version}`)
  if (payload.hashVersion != null && payload.hashVersion !== STATE_HASH_VERSION) {
    throw new Error(`基线指纹版本是 ${payload.hashVersion}，当前为 ${STATE_HASH_VERSION}；请用当前代码重新采集基线`)
  }
  return payload
}

// 逐条比较两组逐步指纹：返回第一个不同的下标（-1 表示完全一致）。
function firstHashMismatch(expected, actual) {
  const length = Math.max(expected.length, actual.length)
  for (let index = 0; index < length; index++) {
    if (expected[index] !== actual[index]) return index
  }
  return -1
}

function checkFixture(fixture, { verifyLive = false } = {}) {
  const moves = fixture.log?.moves ?? []
  if (fixture.hashes.length !== moves.length + 1) {
    return { ok: false, kind: 'baseline', step: -1, detail: `指纹数 ${fixture.hashes.length} 与步数 ${moves.length} 不匹配` }
  }
  if (fixture.final?.hash && fixture.final.hash !== fixture.hashes[fixture.hashes.length - 1]) {
    return { ok: false, kind: 'baseline', step: moves.length, detail: 'final.hash 与逐步指纹的最后一项不一致' }
  }
  const replayed = replayHashes(fixture.log)
  const replayMismatch = firstHashMismatch(fixture.hashes, replayed)
  if (replayMismatch >= 0) {
    return {
      ok: false, kind: 'replay', step: replayMismatch,
      detail: `基线 ${shortHash(fixture.hashes[replayMismatch])} / 重放 ${shortHash(replayed[replayMismatch])}`,
      move: moves[replayMismatch - 1],
    }
  }
  if (verifyLive) {
    const live = buildFixture(fixture.recipe)
    const liveMismatch = firstHashMismatch(fixture.hashes, live.hashes)
    if (liveMismatch >= 0) {
      return {
        ok: false, kind: 'live', step: liveMismatch,
        detail: `基线 ${shortHash(fixture.hashes[liveMismatch])} / 实时 ${shortHash(live.hashes[liveMismatch])}`,
        move: live.log.moves[liveMismatch - 1] ?? moves[liveMismatch - 1],
      }
    }
  }
  return { ok: true, kind: 'ok', step: moves.length }
}

function report(name, fixture, result) {
  const scenario = fixture.final?.scenario ?? '-'
  if (result.ok) {
    console.log(`  ✔ ${name.padEnd(46)} ${String(fixture.log.moves.length).padStart(4)} 步  ${String(scenario).padEnd(28)} ${String(fixture.final?.uiState ?? '-').padEnd(14)} ${shortHash(fixture.final?.hash)}`)
    return
  }
  const where = result.step >= 0 ? `第 ${result.step} 步` : '基线文件'
  const source = { replay: '重放', live: '实时执行', baseline: '基线' }[result.kind] || result.kind
  console.error(`  ✖ ${name.padEnd(46)} ${where}${source}不一致：${result.detail}`)
  if (result.move) console.error(`      该步动作：座位 ${result.move.seat} ${describeMove(result.move.move)}`)
}

// recipe 清单一致性：ids 逐一相同，且 8 章每章都有 recipe（覆盖声明）。
function checkRecipeManifest(fixtures) {
  const recipeIds = TIC_REPLAY_RECIPES.map(recipe => recipe.id)
  const fixtureIds = fixtures.map(fixture => fixture.id)
  const missing = recipeIds.filter(id => !fixtureIds.includes(id))
  const stale = fixtureIds.filter(id => !recipeIds.includes(id))
  let failures = 0
  if (missing.length) { failures++; console.error(`  ✖ 基线缺少 recipe：${missing.join('、')}（运行 node tools/replay-tic-fixtures.mjs --write）`) }
  if (stale.length) { failures++; console.error(`  ✖ 基线与 recipe 清单不一致：${stale.join('、')}（运行 node tools/replay-tic-fixtures.mjs --write）`) }
  for (const scenarioId of TIC_CHAPTER_IDS) {
    const recipeId = TIC_CHAPTER_RECIPE_IDS[scenarioId]
    const fixture = fixtures.find(item => item.id === recipeId)
    if (!fixture) { failures++; continue }
    if (fixture.final?.scenario !== scenarioId) {
      failures++
      console.error(`  ✖ 章节覆盖不符：${recipeId} 的终局关卡是 ${fixture.final?.scenario ?? '-'}，应为 ${scenarioId}`)
    }
  }
  return failures
}

function checkFixtures({ verifyLive = false } = {}) {
  const payload = readPayload(FIXTURE_FILE)
  let failures = checkRecipeManifest(payload.fixtures)
  console.log(`TIC replay 基线：${payload.fixtures.length} 局（规则 ${payload.rulesVersion}，指纹 v${payload.hashVersion ?? '?'}）`)
  for (const fixture of payload.fixtures) {
    let result
    try {
      result = checkFixture(fixture, { verifyLive })
    } catch (error) {
      result = { ok: false, kind: 'replay', step: -1, detail: error?.message || String(error) }
    }
    report(fixture.id, fixture, result)
    if (!result.ok) failures++
  }
  return failures
}

function captureFixtures() {
  return TIC_REPLAY_RECIPES.map(recipe => {
    const started = Date.now()
    const fixture = buildFixture(recipe)
    console.log(`  ✔ ${recipe.id.padEnd(46)} ${String(fixture.log.moves.length).padStart(4)} 步  ${String(fixture.final.uiState).padEnd(14)} ${String(fixture.final.scenario ?? '-').padEnd(28)} ${shortHash(fixture.final.hash)}  ${Date.now() - started}ms`)
    return fixture
  })
}

function summarizePayload(payload) {
  const steps = payload.fixtures.reduce((sum, fixture) => sum + fixture.log.moves.length, 0)
  console.log(`fixtures ${payload.fixtures.length} / steps ${steps} / hashes ${payload.fixtures.reduce((sum, fixture) => sum + fixture.hashes.length, 0)}`)
  for (const fixture of payload.fixtures) {
    console.log(`  ${fixture.id.padEnd(46)} ${String(fixture.log.moves.length).padStart(4)} 步  scenario=${String(fixture.final?.scenario ?? '-').padEnd(28)} uiState=${String(fixture.final?.uiState ?? '-').padEnd(14)} status=${fixture.final?.status ?? '-'}`)
  }
}

const [mode, argument] = process.argv.slice(2)
if (!mode || mode === '--help' || mode === '-h') usage()

if (mode === '--write') {
  console.log('采集 TIC P8 replay 基线（真实大厅准备 + 章节阶梯，纯合法/调试原语动作）：')
  const payload = payloadFor(captureFixtures())
  writePayload(FIXTURE_FILE, payload)
  const steps = payload.fixtures.reduce((sum, fixture) => sum + fixture.log.moves.length, 0)
  console.log(`写入 ${path.relative(ROOT, FIXTURE_FILE)}：${payload.fixtures.length} 局 / ${steps} 步`)
  process.exit(0)
}
if (mode === '--check' || mode === '--verify') {
  const failures = checkFixtures({ verifyLive: mode === '--verify' })
  console.log(failures ? `✖ ${failures} 处不一致` : '✔ 全部基线重放出相同指纹，8 章覆盖齐全')
  process.exit(failures ? 1 : 0)
}
if (mode === '--baseline') {
  if (!argument) usage()
  const file = path.resolve(argument)
  console.log('采集 TIC replay 临时基线：')
  const payload = payloadFor(captureFixtures())
  writePayload(file, payload)
  const steps = payload.fixtures.reduce((sum, fixture) => sum + fixture.log.moves.length, 0)
  console.log(`写入 ${file}：${payload.fixtures.length} 局 / ${steps} 步`)
  process.exit(0)
}
if (mode === '--summary') {
  summarizePayload(readPayload(FIXTURE_FILE))
  process.exit(0)
}
usage()
