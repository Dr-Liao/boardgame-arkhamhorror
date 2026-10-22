// 逐字节视图基线：对固定夹具、每个席位记录 sha256(JSON.stringify(viewState(clone, seat)))。
//
//   node tools/capture-view-hashes.mjs            # 与基线比对（不一致退出码 1）
//   node tools/capture-view-hashes.mjs --write    # 重新生成基线（仅在有意改变视图时使用）
//
// 用途：阶段 A（viewState 公私拆分）只能改「值的来源」，不能改输出。
// JSON.stringify 对键顺序敏感，所以哈希一致 = 视图逐字节一致。
// 夹具由固定种子 + 确定性走子生成，同一份代码重复运行必须得到同一份基线。

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mod from '../index.js'

const BASELINE = fileURLToPath(new URL('../tests/fixtures/view-hashes.json', import.meta.url))
const WRITE = process.argv.includes('--write')
const SEED = 'view-hash-baseline'
const MAX_MOVES = Number(process.argv.find(value => value.startsWith('--moves='))?.split('=')[1]) || 120

const hashView = view => {
  const json = JSON.stringify(view)
  return { sha256: createHash('sha256').update(json).digest('hex'), bytes: Buffer.byteLength(json) }
}

const players = count => Array.from({ length: count }, (_, seat) => ({ seat, role: 'human', name: 'P' + seat }))
const settingsFor = (count, extra = {}) => ({
  ...mod.defaults, playerCount: count, campaignId: 'nightOfTheZealot', seed: SEED, ...extra,
})

function seatNumbers(state) {
  return (state.investigators || []).map(inv => inv.seat).sort((a, b) => a - b)
}

function capture(name, state, fixtures) {
  const seats = {}
  for (const seat of seatNumbers(state)) seats[seat] = hashView(mod.viewState(structuredClone(state), seat))
  fixtures[name] = { revision: state.revision, uiState: state.uiState, seats }
}

// 确定性走子：优先回答待决选择，其次按固定顺序挑一个合法行动。
function chooseMove(state, seat) {
  const moves = mod.legalMoves(state, seat)
  if (!moves.length) return null
  if (state.pendingChoice) {
    const preferred = ['done', 'skip', 'self', 'keep'].map(id => moves.find(move => move.optionId === id)).find(Boolean)
    return preferred || moves[0]
  }
  const order = ['investigate', 'draw', 'resource', 'endTurn', 'move', 'play', 'fight', 'evade']
  for (const action of order) {
    const found = moves.find(move => move.action === action)
    if (found) return found
  }
  return moves[0]
}

function advance(state) {
  const seat = mod.decisionSeat(state)
  const choice = chooseMove(state, seat)
  if (!choice) return null
  const command = structuredClone(choice)
  delete command.label
  const next = structuredClone(state)
  if (mod.validateMove(structuredClone(next), seat, structuredClone(command))) return null
  mod.applyMove(next, seat, command)
  next.revision = state.revision + 1
  return next
}

function buildFixtures() {
  const fixtures = {}

  // 1) 战役 hub（未进关卡）：座位数 4，每个席位都要能选调查员。
  const hub = mod.createState(settingsFor(4), players(4))
  capture('hub-open', hub, fixtures)

  // 2) 关卡开场：legacyAutoStart 直接进入剧本。
  let state = mod.createState(settingsFor(4, { legacyAutoStart: true }), players(4))
  capture('scenario-open', state, fixtures)

  // 3) 中局 + 首次出现的每种待决选择 + 首次私人技能检定。
  const choiceKinds = new Set()
  let privateTest = false
  for (let move = 0; move < MAX_MOVES && state.status === 'playing'; move++) {
    const next = advance(state)
    if (!next) break
    state = next
    if (state.pendingChoice && !choiceKinds.has(state.pendingChoice.kind)) {
      choiceKinds.add(state.pendingChoice.kind)
      capture('choice-' + state.pendingChoice.kind, state, fixtures)
    }
    if (!privateTest && state.skillTest && !state.skillTest.helpRequested) {
      privateTest = true
      capture('private-test', state, fixtures)
    }
    if (move === 39) capture('midgame-40', state, fixtures)
    if (move === 79) capture('midgame-80', state, fixtures)
  }
  capture('midgame-final', state, fixtures)

  // 4) 单席位与双席位：手牌/牌组遮蔽的分支不同。
  for (const count of [1, 2]) {
    let solo = mod.createState(settingsFor(count, { legacyAutoStart: true }), players(count))
    for (let move = 0; move < 40 && solo.status === 'playing'; move++) {
      const next = advance(solo)
      if (!next) break
      solo = next
    }
    capture('seats-' + count, solo, fixtures)
  }

  return { seed: SEED, note: '逐字节视图基线（阶段 A 门禁）；重跑 node tools/capture-view-hashes.mjs 校验', fixtures }
}

const baseline = buildFixtures()
const serialized = JSON.stringify(baseline, null, 2) + '\n'

if (WRITE) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
  fs.writeFileSync(BASELINE, serialized, 'utf8')
  const count = Object.keys(baseline.fixtures).length
  console.log(`已写入 ${BASELINE}：${count} 个夹具`)
  for (const [name, entry] of Object.entries(baseline.fixtures)) {
    const seats = Object.keys(entry.seats).map(seat => `${seat}:${entry.seats[seat].bytes}B`).join(' ')
    console.log(`  ${name.padEnd(28)} rev=${String(entry.revision).padStart(4)} ${seats}`)
  }
} else {
  if (!fs.existsSync(BASELINE)) {
    console.error('缺少基线：先运行 node tools/capture-view-hashes.mjs --write')
    process.exit(1)
  }
  const expected = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  const problems = []
  for (const [name, entry] of Object.entries(expected.fixtures)) {
    const actual = baseline.fixtures[name]
    if (!actual) { problems.push(`${name}: 夹具已消失`); continue }
    if (actual.revision !== entry.revision) problems.push(`${name}: revision ${entry.revision} -> ${actual.revision}`)
    for (const seat of Object.keys(entry.seats)) {
      const want = entry.seats[seat], got = actual.seats[seat]
      if (!got) { problems.push(`${name} 席位 ${seat}: 视图缺失`); continue }
      if (want.sha256 !== got.sha256) problems.push(`${name} 席位 ${seat}: 视图变了（${want.bytes}B -> ${got.bytes}B）`)
    }
  }
  for (const name of Object.keys(baseline.fixtures)) if (!expected.fixtures[name]) problems.push(`${name}: 新增夹具，基线里没有`)
  if (problems.length) {
    console.error('视图基线不一致：')
    for (const problem of problems) console.error('  ✘ ' + problem)
    process.exit(1)
  }
  console.log(`视图基线一致：${Object.keys(expected.fixtures).length} 个夹具 / `
    + Object.values(expected.fixtures).reduce((sum, entry) => sum + Object.keys(entry.seats).length, 0) + ' 份席位视图')
}
