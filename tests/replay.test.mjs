// 对局级动作日志 + 稳定哈希 + 重放 + 回退（Phase 4 · 重放安全网）。
//
// 这里守的是"迁移安全网"的契约：
//   1. 同一 seed + 同一动作序列 → 同一状态指纹（迁移前后各跑一次就能证明"行为零变化"）；
//   2. 日志是纯 JSON，存读档后仍能重放；
//   3. `until` 能取中间态，撤销 = 截断 moves 后重放；
//   4. 建局参数完整（AI 选人、剧情感知、自定义卡组、规则模式都不能在重放时丢失）；
//   5. 指纹只覆盖权威状态（派生资源与瞬时字段不参与），并能定位到具体路径。
//
// 完整 100 局随机对局与 5,000 步随机走子器在 tests/replay-fuzz.test.mjs（slow tier），
// golden 基线在 tests/replay-golden.test.mjs（fast tier）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMove, createGameState, decisionSeat, legalMoves, validateMove } from '../src/engine/engine.js'
import {
  captureReplayLog, replayHash, replayHashes, replayLog, REPLAY_HASH_OMITTED, REPLAY_LOG_VERSION,
  rewindTo, STATE_HASH_VERSION, stateDiff, stateHash, stableStringify, undoDepth, undoMoves, verifyReplay,
} from '../src/engine/replay.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { createRandomPolicy, nextMove, playGame } from '../tools/replay-games.mjs'

const settings = { playerInvestigator: '01001', seed: 'replay-fixture' }
const players = [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }]
const clone = value => JSON.parse(JSON.stringify(value))

// 走一步确定性的动作：先答完所有待决选择，再按优先级挑一个合法动作。
function step(state) {
  const seat = decisionSeat(state) ?? 0
  const moves = legalMoves(state)
  const move = state.pendingChoice
    ? { action: 'choose', choiceId: state.pendingChoice.id, optionId: state.pendingChoice.options[0].id }
    : moves.find(candidate => ['draw', 'resource', 'move', 'investigate', 'endTurn'].includes(candidate.action))
      ?? moves[0]
  assert.ok(move, '没有可用动作')
  assert.equal(validateMove(state, seat, move), null, JSON.stringify(move))
  applyMove(state, seat, move)
  return move
}

function playGameLegacy(steps) {
  const state = createGameState(settings, players.map(player => ({ ...player })))
  const hashes = [stateHash(state)]
  for (let index = 0; index < steps; index++) {
    step(state)
    hashes.push(stateHash(state))
  }
  return { state, hashes }
}

// 随机走一局（合法动作 + 确定性策略），返回逐步指纹与动作日志。
function playRandom(seed, steps = 10, options = {}) {
  return playGame({
    settings: { playerInvestigator: '01001', seed, ...options.settings },
    players: options.players ?? [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }],
    policy: createRandomPolicy(seed),
    steps,
  })
}

test('同一 seed 与动作序列重放出相同的状态指纹', () => {
  const { state, hashes } = playGameLegacy(24)
  const log = captureReplayLog(state)
  assert.equal(log.version, REPLAY_LOG_VERSION)
  assert.equal(log.meta.hashVersion, STATE_HASH_VERSION)
  assert.equal(log.settings.seed, 'replay-fixture')
  assert.equal(log.settings.playerInvestigator, '01001')
  assert.equal(log.moves.length, 24)

  const replayed = replayLog(log)
  assert.equal(stateHash(replayed), hashes[hashes.length - 1])
  assert.equal(replayed.revision, state.revision)
  assert.equal(replayed.moveCount, state.moveCount)
  assert.deepEqual(replayed.investigators.map(inv => inv.code), state.investigators.map(inv => inv.code))
})

test('until 取中间态，与实时记录的逐步指纹一致', () => {
  const { state, hashes } = playGameLegacy(12)
  const log = captureReplayLog(state)
  for (const until of [0, 3, 7, 12]) {
    assert.equal(stateHash(replayLog(log, { until })), hashes[until], `until=${until} 的指纹不一致`)
  }
  assert.deepEqual(replayHashes(log), hashes, '一次重放就能给出全部中间指纹')
})

test('动作日志是纯 JSON：存读档往返后仍可重放', () => {
  const { state, hashes } = playGameLegacy(10)
  const log = captureReplayLog(state)
  const restored = JSON.parse(JSON.stringify(log))
  assert.deepEqual(restored, log)
  assert.equal(stateHash(replayLog(restored)), hashes[hashes.length - 1])
})

test('哈希与键顺序无关，但能识别真实的动作差异', () => {
  const a = { b: 1, a: { d: 2, c: [3, 4] } }
  const b = { a: { c: [3, 4], d: 2 }, b: 1 }
  assert.equal(stableStringify(a), stableStringify(b))
  assert.equal(stateHash(a), stateHash(b), '键顺序不同但内容相同的状态指纹必须一致')
  assert.notEqual(stateHash(a), stateHash({ ...a, b: 2 }), '内容不同的状态指纹必须不同')

  const { state } = playGameLegacy(6)
  const log = captureReplayLog(state)
  const truncated = { ...log, moves: log.moves.slice(0, -1), meta: { ...log.meta, moveCount: log.moves.length - 1 } }
  assert.notEqual(stateHash(replayLog(truncated)), stateHash(state), '少一步动作后指纹必须变化')
  assert.notEqual(stateHash(replayLog(log, { until: log.moves.length - 1 })), stateHash(state))
  // 截断 moves 却不改 meta.moveCount：完整性校验必须拒绝，而不是悄悄重放一个残缺的对局。
  assert.throws(() => replayLog({ ...log, moves: log.moves.slice(0, -1) }), /完整性校验失败/)
})

test('未成功的动作不进日志', () => {
  const state = createGameState(settings, players.map(player => ({ ...player })))
  const before = (state.actionLog || []).length
  const seat = decisionSeat(state) ?? 0
  // 没有待决选择时提交一个必然非法的动作。
  if (!state.pendingChoice) {
    assert.throws(() => applyMove(state, seat, { action: 'draw' }), /./)
    assert.equal((state.actionLog || []).length, before)
  }
})

test('指纹只覆盖权威状态：派生资源与瞬时字段不参与比较', () => {
  const state = createGameState(settings, players.map(player => ({ ...player })))
  step(state)
  const base = stateHash(state)
  for (const key of REPLAY_HASH_OMITTED.derived) {
    assert.equal(stateHash({ ...state, [key]: '被改过的派生数据' }), base, `${key} 是派生字段，不应进指纹`)
  }
  for (const key of REPLAY_HASH_OMITTED.transient) {
    assert.equal(stateHash({ ...state, [key]: ['被改过'] }), base, `${key} 是瞬时字段，不应进指纹`)
  }
  assert.equal(stateHash({ ...state, _resolution: { fake: true } }), base, '下划线前缀的事务临时字段不进指纹')
  assert.notEqual(stateHash({ ...state, clues: state.clues + 1 }), base, '真实状态变化必须被发现')
  assert.notEqual(stateHash({ ...state, seed: 'another-seed' }), base)
})

test('重放覆盖全部建局参数：AI 选人、剧情感知、自定义卡组与规则模式都还原', () => {
  const deck = buildDeck(INVESTIGATORS['01001'], { seat: 0, seed: 1 }).playerCards
  const cases = [
    {
      name: 'AI 人设决定选人 + 剧情感知 + hard + strict',
      settings: { playerInvestigator: '01001', seed: 'fidelity-persona', aiStoryAwareness: 'on', difficulty: 'hard', rulesMode: 'strict' },
      players: [{ seat: 0, role: 'human', persona: '' }, { seat: 1, role: 'ai', persona: '你是守卫，擅长战斗与枪' }],
    },
    {
      name: '3 席位局外流程 + 战役 hub',
      settings: { campaignHub: true, campaignId: 'thePathToCarcosa', seed: 'fidelity-hub', difficulty: 'easy' },
      players: [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai', persona: '你是秘术，法术与意志' }, { seat: 2, role: 'ai' }],
    },
    {
      name: '自定义卡组 + 自动调查员',
      settings: { playerInvestigator: 'auto', seed: 'fidelity-deck', playerDeck: deck, aiStoryAwareness: 'on' },
      players: [{ seat: 0, role: 'human' }],
    },
    {
      name: '旧版自动开局（非 hub）',
      settings: { playerInvestigator: '01004', seed: 'fidelity-legacy', rulesMode: 'strict' },
      players: [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }],
    },
  ]
  for (const item of cases) {
    const state = createGameState(item.settings, item.players.map(player => ({ ...player })))
    for (let index = 0; index < 8; index++) {
      const selection = nextMove(state, createRandomPolicy(`${item.name}:${index}`))
      if (!selection) break
      applyMove(state, selection.seat, selection.move)
    }
    const log = captureReplayLog(state)
    assert.deepEqual(log.players.map(player => player.role), item.players.map(player => player.role === 'human' ? 'human' : 'ai'), item.name)
    assert.equal(log.settings.aiStoryAwareness, item.settings.aiStoryAwareness === 'on', `${item.name}：剧情感知`)
    assert.equal(replayHash(log), stateHash(state), `${item.name}：重放指纹必须一致\n${JSON.stringify(stateDiff(state, replayLog(log)))}`)
  }
})

test('撤销 = 截断动作日志后重放，回退后的引用与版本号都正确', () => {
  const game = playRandom('undo-game', 14)
  const target = game.hashes.length - 4
  const state = clone(game.state)
  const expected = replayLog(game.log, { until: target })

  rewindTo(state, target)
  assert.equal(stateHash(state), game.hashes[target])
  assert.equal(state.revision, target, '回退后的版本号必须等于已提交的动作数')
  assert.equal(undoDepth(state), target)
  assert.deepEqual(state.actionLog.map(entry => entry.seat), expected.actionLog.map(entry => entry.seat))
  assert.equal(state.legalMoves.length, expected.legalMoves.length, '回退后要重算合法动作')

  undoMoves(state)
  assert.equal(stateHash(state), game.hashes[target - 1])
  assert.equal(state.revision, target - 1)
  assert.throws(() => undoMoves(state, 999), /只能撤销已记录的/)
  assert.throws(() => undoMoves(state, 0), /正整数/)
  assert.throws(() => undoMoves(state, 1.5), /正整数/)

  // 回退到 0 步：等于刚建局的状态，可以重新走另一条分支。
  rewindTo(state, 0)
  assert.equal(stateHash(state), game.hashes[0])
  assert.equal(state.actionLog.length, 0)
  const branch = nextMove(state, createRandomPolicy('undo-branch'))
  assert.ok(branch, '回退后应当还有合法动作')
  applyMove(state, branch.seat, branch.move)
  assert.equal(state.revision, 1)
  assert.ok(state.actionLog.length === 1)
})

test('回退保留检查点分支的版本偏移（revision 比日志多一步也能撤销）', () => {
  const game = playRandom('fork-offset', 8)
  const target = game.log.moves.length - 2
  const expected = replayLog(game.log, { until: target })
  expected.revision += 1 // 模拟 /api/session/fork-checkpoint：新分支版本号 +1，但没有新动作
  const state = clone(game.state)
  state.revision += 1
  undoMoves(state, 2)
  assert.equal(state.revision, target + 1, '偏移量必须保留')
  assert.equal(stateHash(state), stateHash(expected))
})

test('没有完整动作日志的旧存档拒绝回退，而不是悄悄回到建局状态', () => {
  const game = playRandom('legacy-save', 6)
  const legacy = clone(game.state)
  delete legacy.actionLog // Phase 4 之前的存档没有动作日志
  assert.equal(undoDepth(legacy), 0)
  assert.throws(() => rewindTo(legacy, 0), /没有完整动作日志/)
  assert.throws(() => undoMoves(legacy), /只能撤销已记录的 0 步/)
  assert.equal(legacy.revision, game.state.revision, '拒绝时不能改动状态')
})

test('verifyReplay 自检与 stateDiff 的路径级定位', () => {
  const game = playRandom('verify-game', 10)
  assert.deepEqual(verifyReplay(game.state), {
    ok: true, hash: stateHash(game.state), replayHash: stateHash(game.state),
    moves: game.log.moves.length, differences: [],
  })
  const tampered = clone(game.state)
  tampered.clues += 2
  tampered.investigators[0].resources += 1
  const result = verifyReplay(tampered)
  assert.equal(result.ok, false)
  assert.equal(result.moves, game.log.moves.length)
  const paths = result.differences.map(item => item.path)
  assert.ok(paths.includes('clues'), JSON.stringify(result.differences))
  assert.ok(paths.includes('investigators[0].resources'), JSON.stringify(result.differences))
  assert.equal(result.differences.find(item => item.path === 'clues').left, String(tampered.clues))
  assert.ok(result.differences.length <= 24, '差异报告必须有上限，避免刷屏')

  const diff = stateDiff({ a: { b: 1, c: [1, 2] }, d: 'x' }, { a: { b: 2, c: [1, 3] }, d: 'x' })
  assert.deepEqual(diff.map(item => item.path), ['a.b', 'a.c[1]'])
  assert.equal(stateDiff({ a: 1 }, { a: 2 }, { limit: 1 }).length, 1)
})

test('展示字段不进事务凭据：改写日志里的 label 不影响指纹', () => {
  // 走一局到"停在待决选择"的形态（存档续玩时 continuation.move 也在状态里）。
  let game = null
  for (let steps = 4; steps <= 20 && !game?.state.pendingChoice; steps++) {
    game = playRandom('label-game', steps)
  }
  assert.ok(game.state.pendingChoice, '随机走子应当至少遇到一次待决选择')
  const log = captureReplayLog(game.state)
  const relabeled = {
    ...log,
    moves: log.moves.map(({ seat, move }) => ({ seat, move: { ...move, label: '改写过的展示文案', explanation: '也是展示字段' } })),
  }
  assert.equal(replayHash(relabeled), replayHash(log), 'label/explanation 不应影响规则状态')
  const withRevision = {
    ...log,
    moves: log.moves.map(({ seat, move }) => ({ seat, move: { ...move, revision: 999 } })),
  }
  assert.equal(replayHash(withRevision), replayHash(log), 'revision 是位置信息，不参与重放语义')
})

test('非法或版本不符的重放日志被明确拒绝', () => {
  const log = captureReplayLog(createGameState(settings, players.map(player => ({ ...player }))))
  assert.throws(() => replayLog({ ...log, version: 99 }), /未知的重放日志版本/)
  assert.throws(() => replayLog({ ...log, meta: { hashVersion: STATE_HASH_VERSION + 1 } }), /指纹版本/)
  assert.throws(() => replayLog({ ...log, settings: { ...log.settings, seed: null } }), /缺少 seed/)
  assert.throws(() => replayLog({ ...log, players: [{ seat: 1, role: 'ai' }] }), /按座位顺序/)
  const broken = { ...log, moves: [{ seat: 0, move: { action: 'not-a-real-action' } }], meta: { ...log.meta, moveCount: 1 } }
  assert.throws(() => replayLog(broken), /第 1 步.*not-a-real-action/)
})

test('随机走子的每一步都能由日志重放（快速版；完整 100 局在 slow tier）', () => {
  const campaigns = ['nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa', 'theForgottenAge']
  for (const [index, campaignId] of campaigns.entries()) {
    const game = playRandom(`fast-fuzz-${index}`, 8, {
      settings: { campaignHub: true, campaignId, rulesMode: index % 2 ? 'strict' : 'simplified' },
      players: [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }],
    })
    assert.ok(game.hashes.length > 1, `${campaignId} 应该至少走了一步`)
    assert.deepEqual(replayHashes(game.log), game.hashes, `${campaignId} 的逐步指纹不一致`)
    assert.deepEqual(replayHashes(JSON.parse(JSON.stringify(game.log))), game.hashes, `${campaignId} 的日志 JSON 往返后不一致`)
  }
})
