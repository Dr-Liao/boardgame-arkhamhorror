// Phase 4 · 重放安全网的"对局驱动器"：用纯合法动作把真实战役走成可重放的动作序列。
//
// 两个用途：
//   1. tools/replay-fixtures.mjs 用它采集 golden 基线（真实对局的 settings/players/moves/hashes）；
//   2. tests/replay-fuzz.test.mjs 用它做"100 局随机对局 replay 与实时执行一致"的门禁。
//
// 三条约定：
//   - **只用合法动作**：每一步都过 validateMove，任何非法动作都当成驱动器的 bug 抛错，
//     不静默兜底（否则基线会掩盖规则缺口）。
//   - **随机只来自 seed**：驱动器有自己的确定性随机流（与引擎的 rngState 无关），
//     所以同一 recipe 在任何机器、任何进程都走同一条路径。
//   - **不读私有信息**：驱动器只看合法动作列表与公开状态，和 AI/大厅的视角一致。
//
// p6 策略复用 tools/p6-playthrough.mjs 的 policy——它就是 tests/p6-content.test.mjs
// 里"纯合法动作从局外完成集结"的同一颗棋子，因此 golden 基线确实覆盖既有测试局。

import { actingSeats, applyMove, createGameState, legalMoves, validateMove } from '../src/engine/engine.js'
import { captureReplayLog, stateHash } from '../src/engine/replay.js'
import { policy as notzPolicy } from './p6-playthrough.mjs'

// 驱动器自用的确定性随机流（FNV-1a + mulberry32）。与引擎随机流刻意分开：
// 它只决定"策略选哪条合法动作"，不影响对局内的抽牌/混乱标记。
export function seededRandom(seed) {
  let value = 2166136261 >>> 0
  for (const char of String(seed ?? '')) {
    value ^= char.codePointAt(0) ?? 0
    value = Math.imul(value, 16777619) >>> 0
  }
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (items, random) => items[Math.floor(random() * items.length) % items.length]

// 待决选择：优先选能推进的选项（advance/done/skip/self），否则按 seed 随机。
// 多座位共同决定时按座位顺序逐个尝试，返回该座位自己的回答。
function choosePending(state, seat, random) {
  const moves = legalMoves(state, seat).filter(move => move.action === 'choose')
  if (!moves.length) return null
  for (const id of ['advance', 'done', 'skip', 'self', 'r1', 'r2']) {
    const move = moves.find(candidate => candidate.optionId === id)
    if (move) return move
  }
  const numeric = moves.filter(move => /^\d+$/.test(move.optionId))
  return numeric.length ? pick(numeric, random) : pick(moves, random)
}

// 局外（大厅）阶段：按"先推进流程、再准备席位"的顺序挑一条合法动作，
// 保证任何战役都能走完准备流程（不做战役专属判断）。
function hubMove(state, seat) {
  const moves = legalMoves(state, seat)
  const by = action => moves.find(move => move.action === action)
  const record = state.campaign?.investigators?.[seat]
  if (!state.campaign?.leadConfirmed && by('hubSetLeader')) return by('hubSetLeader')
  if (by('hubGoSetup')) return by('hubGoSetup')
  if (by('hubContinue')) return by('hubContinue')
  // 席位准备：选人 → 自动构筑 → 完成。record.deck 为空说明这一席位还没准备好。
  if (!record?.deck?.length) {
    if (by('hubAutoDeck')) return by('hubAutoDeck')
    if (by('hubSelectInvestigator')) return by('hubSelectInvestigator')
  }
  if (by('hubAutoUpgrade') && !state.hubUpgradedSeats?.[seat]) return by('hubAutoUpgrade')
  if (by('hubConfirmUpgrades')) return by('hubConfirmUpgrades')
  if (by('hubDoneSeat')) return by('hubDoneSeat')
  if (by('hubBeginScenario')) return by('hubBeginScenario')
  if (by('hubSelectScenario')) return by('hubSelectScenario')
  return moves[0] ?? null
}

// 场景内：按"能推进 > 保命 > 增益 > 资源"的优先级挑一条合法动作，同级按 seed 随机。
function scenarioMove(state, seat, random) {
  const moves = legalMoves(state, seat)
  if (!moves.length) return null
  const by = action => moves.find(move => move.action === action)
  const inv = state.investigators[seat]
  if (!inv) return moves[0]

  // 1. 推进剧情 / 剧本赋予的主动作（「撤退」不在此列：它会过早结束关卡）。
  if (by('advanceAct')) return by('advanceAct')
  for (const action of ['interruptRitual', 'drawCultist', 'parleyCultist', 'parley', 'parleyLita', 'explore']) {
    const move = by(action)
    if (move) return move
  }

  // 2. 交战中：先打/躲，再看有没有武器能力。
  const engaged = state.enemies.filter(enemy => !enemy.defeated
    && enemy.location === inv.location && (enemy.engagedSeat === seat || enemy.massive))
  if (engaged.length) {
    const fight = moves.filter(move => move.action === 'fight' && engaged.some(enemy => enemy.id === move.enemyId))
    if (fight.length) return pick(fight, random)
    const evade = moves.filter(move => move.action === 'evade' && engaged.some(enemy => enemy.id === move.enemyId))
    if (evade.length) return pick(evade, random)
  }

  // 3. 事件/装备：能打就打（资产铺垫与事件结算都覆盖到）。
  const plays = moves.filter(move => move.action === 'play')
  if (plays.length && random() < 0.65) return pick(plays, random)

  // 4. 地点/剧本行动（探索、帷幕、补给、遭遇相关）。
  const scripted = moves.filter(move => ['locationAbility', 'scenarioAction', 'freeAction', 'hiddenAction'].includes(move.action))
  if (scripted.length && random() < 0.7) return pick(scripted, random)

  // 5. 没有线索缺口时优先调查；否则去还有线索/未揭示的地点。
  if (by('investigate')) return by('investigate')
  if (by('ability') && random() < 0.5) return pick(moves.filter(move => move.action === 'ability'), random)
  if (by('draw') && random() < 0.35) return by('draw')
  if (by('resource') && random() < 0.2) return by('resource')

  const movements = moves.filter(move => move.action === 'move')
  if (movements.length) {
    const targets = movements.filter(move => {
      const location = state.locations.find(item => item.id === move.locationId)
      return location && (location.clues > 0 || !location.revealed)
    })
    if (targets.length) return pick(targets, random)
    if (random() < 0.25) return pick(movements, random)
  }
  return by('endTurn') ?? moves[0]
}

// 通用策略：任何战役、任何玩家数都能推进；只在"合法动作"里选择。
export function createGenericPolicy(seed) {
  const random = seededRandom(`generic:${seed}`)
  return (state, seat) => {
    if (state.pendingChoice) return choosePending(state, seat, random)
    if (state.hubFlow && state.uiState !== 'inScenario') return hubMove(state, seat)
    return scenarioMove(state, seat, random)
  }
}

// 纯随机走子器：场景内每条合法动作等概率；待决选择也随机回答。
// 局外阶段不随机——准备阶段的"换人/难度"动作永远合法，随机走会把对局永久留在准备界面，
// 反而测不到规则结算；这里固定走"能推进"的那条，把随机性留给真正会改状态的场景阶段。
export function createRandomPolicy(seed) {
  const random = seededRandom(`random:${seed}`)
  return (state, seat) => {
    if (state.pendingChoice) {
      const moves = legalMoves(state, seat).filter(move => move.action === 'choose')
      return moves.length ? pick(moves, random) : null
    }
    if (state.hubFlow && state.uiState !== 'inScenario') return hubMove(state, seat)
    const moves = legalMoves(state, seat)
    if (!moves.length) return null
    return pick(moves, random)
  }
}

// 单个动作的"谁在答、答什么"：尽量让策略为座位自己作答；策略失效时退回第一条合法动作
// （把驱动器与策略解耦，但非法动作仍会抛错，不会被静默吞掉）。
export function nextMove(state, policy) {
  const seats = actingSeats(state)
  if (!seats.length) return null
  for (const seat of seats) {
    const move = policy(state, seat)
    if (move && validateMove(state, seat, move) === null) return { seat, move }
  }
  for (const seat of seats) {
    const moves = legalMoves(state, seat)
    const valid = moves.find(move => validateMove(state, seat, move) === null)
    if (valid) return { seat, move: valid }
  }
  return null
}

// 走一局：返回逐步指纹、动作日志与最终状态。
// `hashes[i]` 是第 i 步之后的状态指纹（`hashes[0]` 是建局状态），长度 = 实际步数 + 1。
// `onStep(state, index)` 给随机走子器的不变量断言留钩子；`pauseAfter` 用来固化"停在待决选择"的存档形态
// （`pauseAfter` 之前的待决选择不算暂停，达到步数后才停）。
export function playGame({ settings, players, policy, steps = 60, onStep = null, pauseAfter = null }) {
  const state = createGameState(settings, players.map(player => ({ ...player })))
  const hashes = [stateHash(state)]
  const turns = []
  if (onStep) onStep(state, 0)
  for (let index = 0; index < steps; index++) {
    if (state.status !== 'playing') break
    const selection = nextMove(state, policy)
    if (!selection) break
    const { seat, move } = selection
    const before = state.revision
    applyMove(state, seat, move)
    if (state.revision !== before + 1) throw new Error(`动作没有推进版本号：${JSON.stringify(move)}`)
    turns.push({ seat, move })
    hashes.push(stateHash(state))
    if (onStep) onStep(state, index + 1)
    if (pauseAfter != null && index + 1 >= pauseAfter && state.pendingChoice) break
  }
  return { state, hashes, turns, log: captureReplayLog(state) }
}

// p6 策略驱动的整局：《夜之狂热》的局外准备 + 逐关合法动作，同 tests/p6-content.test.mjs。
function playP6(recipe) {
  const settings = { campaignHub: true, playerInvestigator: recipe.investigator ?? '01001', difficulty: recipe.difficulty ?? 'easy' }
  const players = [{ seat: 0, role: 'human' }]
  const state = createGameState({ ...settings, seed: recipe.seed }, players)
  const hashes = [stateHash(state)]
  const policy = s => notzPolicy(s, recipe.branch ?? 'r1', recipe.mode ?? 'victory')
  const limit = recipe.limit ?? 1400
  for (let index = 0; index < limit; index++) {
    if (state.status !== 'playing') break
    if (recipe.stopAfterFirst && state.uiState === 'scenarioResult') break
    const selection = nextMove(state, policy)
    if (!selection) break
    const { seat, move } = selection
    const before = state.revision
    applyMove(state, seat, move)
    if (state.revision !== before + 1) throw new Error(`动作没有推进版本号：${JSON.stringify(move)}`)
    hashes.push(stateHash(state))
    if (recipe.pauseAfter != null && index + 1 >= recipe.pauseAfter && state.pendingChoice) break
  }
  return { state, hashes, log: captureReplayLog(state) }
}

// 驱动器注册表：recipe.driver 选一个。`generic` 是默认，p6 只用于《夜之狂热》。
const DRIVERS = {
  p6: playP6,
  generic(recipe) {
    const seats = recipe.players ?? 1
    const players = Array.from({ length: seats }, (_, seat) => ({ seat, role: seat === 0 ? 'human' : 'ai' }))
    return playGame({
      settings: { campaignHub: true, difficulty: 'standard', ...recipe.settings, seed: recipe.seed },
      players,
      policy: createGenericPolicy(recipe.seed),
      steps: recipe.steps ?? 60,
    })
  },
  random(recipe) {
    const seats = recipe.players ?? 1
    const players = Array.from({ length: seats }, (_, seat) => ({ seat, role: seat === 0 ? 'human' : 'ai' }))
    return playGame({
      settings: { campaignHub: true, difficulty: 'standard', ...recipe.settings, seed: recipe.seed },
      players,
      policy: createRandomPolicy(recipe.seed),
      steps: recipe.steps ?? 60,
    })
  },
}

export function playRecipe(recipe) {
  const driver = DRIVERS[recipe.driver ?? 'generic']
  if (!driver) throw new Error(`未知的对局驱动器：${recipe.driver}`)
  return driver(recipe)
}

// golden 基线覆盖的"现有测试局"清单。新增战役/机制时加一条，再跑
// `npm run replay:fixtures:write` 重新生成 tests/fixtures/replay/golden-replays.json。
// 只放生产内容：不注册测试专用战役，因此基线与真实大厅路径一致。
export const REPLAY_RECIPES = Object.freeze([
  {
    id: 'notz-gathering-hub-victory-r1',
    note: '《夜之狂热》第一关：局外准备 → 集结 → 分支 r1 胜利结算；p6 策略，同 tests/p6-content.test.mjs',
    driver: 'p6', seed: 'p6-5', branch: 'r1', stopAfterFirst: true,
  },
  {
    id: 'notz-gathering-hub-victory-r2',
    note: '《夜之狂热》第一关：分支 r2（烧屋）结算与战役记录',
    driver: 'p6', seed: 'p6-5', branch: 'r2', stopAfterFirst: true,
  },
  {
    id: 'notz-gathering-defeat',
    note: '《夜之狂热》第一关：自然失败路线（调查员被击败 → 关卡结算）',
    driver: 'p6', seed: 'p6-0', mode: 'failure', stopAfterFirst: true,
  },
  {
    id: 'notz-gathering-resign',
    note: '《夜之狂热》第一关：主动撤退路线（resign → 关卡结算）',
    driver: 'p6', seed: 'p6-0', mode: 'resign', stopAfterFirst: true,
  },
  {
    id: 'notz-midnight-masks',
    note: '《夜之狂热》第二关：从局外继续推进到午夜假面（包含关间升级、多轮遭遇与异教徒牌堆）',
    driver: 'p6', seed: 'p6-0', limit: 220, difficulty: 'easy',
  },
  {
    id: 'notz-gathering-pending-choice',
    note: '《夜之狂热》第一关：停在一个真实待决选择上（存档续玩的形态：pendingChoice + continuation 都要重放出来）',
    driver: 'p6', seed: 'p6-3', difficulty: 'easy', pauseAfter: 12, limit: 40,
  },
  {
    id: 'carcosa-curtain-call-hub',
    note: '《卡尔克萨之路》开幕：2 人局外准备 → 帷幕落下，覆盖 D1 敌人/地点与剧本钩子',
    driver: 'generic', seed: 'golden-carcosa', steps: 70, players: 2,
    settings: { campaignId: 'thePathToCarcosa', playerInvestigator: '03001' },
  },
  {
    id: 'dunwich-extracurricular-hub',
    note: '《敦威治遗产》第一章：2 人局外准备 → 课外活动，覆盖敦威治专属钩子',
    driver: 'generic', seed: 'golden-dunwich', steps: 70, players: 2,
    settings: { campaignId: 'theDunwichLegacy', playerInvestigator: '02001' },
  },
  {
    id: 'tfa-untamed-wilds-hub',
    note: '《失落的时代》第一章：3 人局外准备 → 荒莽密林，覆盖探索牌库与中毒/补给',
    driver: 'generic', seed: 'golden-tfa', steps: 70, players: 3,
    settings: { campaignId: 'theForgottenAge', playerInvestigator: '04001' },
  },
  {
    id: 'notz-strict-random-3p',
    note: '严格规则模式 + 3 席位的随机走子：覆盖可选反应自动跳过、多人共同决定与玩家窗口',
    driver: 'random', seed: 'golden-strict', steps: 80, players: 3,
    settings: { campaignId: 'nightOfTheZealot', rulesMode: 'strict', aiStoryAwareness: 'on' },
  },
])
