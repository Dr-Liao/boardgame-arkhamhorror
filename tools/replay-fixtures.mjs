// Phase 4 · golden replay 基线工具：把真实对局固化成"动作日志 + 逐步指纹"。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/replay-fixtures.mjs --write                 重新采集并写入 tests/fixtures/replay/golden-replays.json
//   node tools/replay-fixtures.mjs --check                校验已提交基线：同一批动作重放出相同指纹
//   node tools/replay-fixtures.mjs --verify               再用驱动器实时跑一遍对局，和基线逐条比较（实时执行 == 重放）
//   node tools/replay-fixtures.mjs --baseline <文件>       采集一份临时基线（迁移前）
//   node tools/replay-fixtures.mjs --compare <文件>        用当前代码重放该基线（迁移后），逐条比较
//
// 迁移批次的用法见 docs/phase4-replay.md §4：先 `--baseline`，改代码，再 `--compare`；
// 指纹不变才算"行为零变化"，有差异时会打印第一个不同的步数与那一步的动作。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { replayHashes, STATE_HASH_VERSION, stateHash } from '../src/engine/replay.js'
import { playRecipe, REPLAY_RECIPES } from './replay-games.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXTURE_FILE = path.join(ROOT, 'tests', 'fixtures', 'replay', 'golden-replays.json')
const FIXTURE_VERSION = 1

const usage = () => {
  console.error('用法：node tools/replay-fixtures.mjs --write | --check | --verify | --baseline <文件> | --compare <文件>')
  process.exit(2)
}

const shortHash = hash => String(hash ?? '').slice(0, 12)
const describeMove = move => move ? `${move.action}${move.cardId ? `(${move.cardId})` : ''}${move.choiceId ? ` ${move.optionId}` : ''}` : '(无动作)'

// 动作日志里的展示字段（label/explanation）不进基线：
// 它们不影响状态，却会让"改一句卡面文案"变成一次全量基线重采。
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
    generator: 'node tools/replay-fixtures.mjs --write',
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
  // 基线自身的一致性：指纹数 = 步数 + 1，且与 final.hash 对得上。
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
  if (result.ok) {
    console.log(`  ✔ ${name.padEnd(34)} ${String(fixture.log.moves.length).padStart(4)} 步  ${shortHash(fixture.final?.hash)}`)
    return
  }
  const where = result.step >= 0 ? `第 ${result.step} 步` : '基线文件'
  const source = { replay: '重放', live: '实时执行', baseline: '基线' }[result.kind] || result.kind
  console.error(`  ✖ ${name.padEnd(34)} ${where}${source}不一致：${result.detail}`)
  if (result.move) console.error(`      该步动作：座位 ${result.move.seat} ${describeMove(result.move.move)}`)
}

function checkFixtures({ verifyLive = false } = {}) {
  const payload = readPayload(FIXTURE_FILE)
  const recipeIds = REPLAY_RECIPES.map(recipe => recipe.id)
  const fixtureIds = payload.fixtures.map(fixture => fixture.id)
  const missing = recipeIds.filter(id => !fixtureIds.includes(id))
  const stale = fixtureIds.filter(id => !recipeIds.includes(id))
  let failures = 0
  console.log(`golden replay 基线：${payload.fixtures.length} 局（规则 ${payload.rulesVersion}，指纹 v${payload.hashVersion ?? '?'}）`)
  if (missing.length) {
    failures++
    console.error(`  ✖ 基线缺少 recipe：${missing.join('、')}（运行 npm run replay:fixtures:write）`)
  }
  if (stale.length) {
    failures++
    console.error(`  ✖ 基线与 recipe 清单不一致：${stale.join('、')}（运行 npm run replay:fixtures:write）`)
  }
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
  return REPLAY_RECIPES.map(recipe => {
    const fixture = buildFixture(recipe)
    console.log(`  ✔ ${recipe.id.padEnd(34)} ${String(fixture.log.moves.length).padStart(4)} 步  ${fixture.final.uiState.padEnd(14)} ${shortHash(fixture.final.hash)}`)
    return fixture
  })
}

function compareWithBaseline(file) {
  const payload = readPayload(file)
  console.log(`对比基线：${path.relative(ROOT, file)}（规则 ${payload.rulesVersion}，${payload.fixtures.length} 局）`)
  let failures = 0
  for (const fixture of payload.fixtures) {
    let result
    try {
      result = checkFixture(fixture)
    } catch (error) {
      result = { ok: false, kind: 'replay', step: -1, detail: error?.message || String(error) }
    }
    report(fixture.id, fixture, result)
    if (!result.ok) failures++
  }
  return failures
}

const [mode, argument] = process.argv.slice(2)
if (!mode || mode === '--help' || mode === '-h') usage()

if (mode === '--write') {
  console.log('采集 golden replay 基线（生产内容、纯合法动作）：')
  const payload = payloadFor(captureFixtures())
  writePayload(FIXTURE_FILE, payload)
  const steps = payload.fixtures.reduce((sum, fixture) => sum + fixture.log.moves.length, 0)
  console.log(`写入 ${path.relative(ROOT, FIXTURE_FILE)}：${payload.fixtures.length} 局 / ${steps} 步`)
  process.exit(0)
}
if (mode === '--check' || mode === '--verify') {
  const failures = checkFixtures({ verifyLive: mode === '--verify' })
  console.log(failures ? `✖ ${failures} 局不一致` : '✔ 全部基线重放出相同指纹')
  process.exit(failures ? 1 : 0)
}
if (mode === '--baseline') {
  if (!argument) usage()
  const file = path.resolve(argument)
  console.log('采集临时基线（迁移前）：')
  const payload = payloadFor(captureFixtures())
  writePayload(file, payload)
  const steps = payload.fixtures.reduce((sum, fixture) => sum + fixture.log.moves.length, 0)
  console.log(`写入 ${file}：${payload.fixtures.length} 局 / ${steps} 步`)
  process.exit(0)
}
if (mode === '--compare') {
  if (!argument) usage()
  const failures = compareWithBaseline(path.resolve(argument))
  console.log(failures ? `✖ ${failures} 局与基线不一致：行为变化，或需要重新采集基线` : '✔ 与基线逐条一致（行为零变化）')
  process.exit(failures ? 1 : 0)
}
usage()
