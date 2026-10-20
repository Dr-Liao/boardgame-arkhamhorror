// 对局级动作日志 + 稳定状态哈希 + 重放 + 回退（Phase 4 · 重放安全网）。
//
// 为什么要有它：迁移一批卡时"测试还绿"不等于"行为没变"。有了
//   { settings, players, moves[] } → 状态
// 这条纯函数链路，就能在迁移前后各跑一次、比较 stateHash，把"行为零变化"变成断言。
// 它同时是撤销、bug 复现、AI 决策回归的底座（撤销 = 截断 moves 后重放，见 rewindTo）。
//
// 四条约定：
//   1. 日志是**纯数据**：`{ seat, move }` 数组，可直接 JSON 存档（state.actionLog）。
//   2. 哈希是**稳定**的：键排序后序列化；排除派生资源（cards/investigatorDefs/…）与
//      瞬时字段（legalMoves/actionLog/lastActionSnapshot/_*），见 DERIVED_KEYS / TRANSIENT_KEYS。
//   3. 重放是**纯函数**：只依赖日志里的 settings/players/moves，不读外部状态、不产生副作用。
//   4. 建局参数必须**够用**：settings 覆盖 createGameState 读到的全部建局输入（含逐座位调查员），
//      否则 AI 选人、AI 剧情感知这类参数会悄悄改变重放结果（tests/replay.test.mjs 有对应用例）。
//
// golden replay（真实对局的固化基线）在 tests/fixtures/replay/golden-replays.json，
// 生成/校验见 tools/replay-fixtures.mjs，交付说明见 docs/phase4-replay.md。

import { createHash } from 'node:crypto'
import { applyMove, createGameState } from './engine.js'

// 日志格式版本：字段只增不减。旧日志缺新字段时按默认值重放（例如没有 seatInvestigators
// 就回落到按 seed + persona 推导，和 Phase 4 之前的行为一致）。
export const REPLAY_LOG_VERSION = 1

// 指纹组成的版本。1 = Phase 4 最小版（整份 state 参与哈希）；2 = 完整版（排除派生资源）。
// 改组成时必须升这个值：基线工具会用 meta.hashVersion 拒绝跨版本比较，
// 否则"指纹口径变了"会伪装成"行为变了"。
export const STATE_HASH_VERSION = 2

// 派生字段：能从当前内容与资源版本随时重建。把它们算进指纹会让"资源升级/新增卡牌"
// 看起来像"行为变了"；而 cards / investigatorDefs 占 state 体积的 90%，排除后哈希快一个数量级。
const DERIVED_KEYS = new Set([
  'cards', 'investigatorDefs', 'classNames', 'classColors', 'skillNames', 'tokenLabels', 'resourceVersion',
])

// 瞬时字段：每次 applyMove 都会重算（legalMoves），或只对本次事务有意义（actionLog 另有用途）。
const TRANSIENT_KEYS = new Set(['legalMoves', 'actionLog', 'lastActionSnapshot'])

// 只读导出：测试与文档要能解释"哪些字段不进指纹"，不要在别处复制同一份清单。
export const REPLAY_HASH_OMITTED = Object.freeze({
  derived: Object.freeze([...DERIVED_KEYS]),
  transient: Object.freeze([...TRANSIENT_KEYS]),
})

function hashable(value, depth = 0) {
  if (Array.isArray(value)) return value.map(item => hashable(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  const output = {}
  for (const key of Object.keys(value).sort()) {
    // 下划线前缀是事务内临时字段（_resolution / _reaction / _actionPaid…）：它们可能
    // 跨一次待决选择存活，但只在当前事务里有意义，不属于权威状态。
    if (TRANSIENT_KEYS.has(key) || DERIVED_KEYS.has(key) || key.startsWith('_')) continue
    output[key] = hashable(value[key], depth + 1)
  }
  return output
}

// 键排序的 JSON 序列化：同样的状态一定得到同样的字符串（与键插入顺序无关）。
export function stableStringify(value) {
  return JSON.stringify(hashable(value))
}

// 状态指纹：用于"重放前后是否一致"的断言，也是迁移批次的"行为零变化"证据。
export function stateHash(state) {
  return createHash('sha256').update(stableStringify(state)).digest('hex')
}

// 单个动作的规范化：`revision` 是"这是第几个动作"的位置信息，重放时由位置决定；
// 保留它会让检查点分支（revision 被拨快一步）无法重放。
function sanitizeMove(move) {
  if (!move || typeof move !== 'object') return move
  const { revision, ...rest } = move
  return rest
}

function sanitizeEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || !entry.move) throw new Error(`重放日志第 ${index} 步缺少动作`)
  return { seat: entry.seat, move: sanitizeMove(entry.move) }
}

// 从权威状态里还原重放所需的创建参数 + 动作序列。
// settings 必须覆盖 createGameState 读取的全部建局输入；players 只需座位与真人/AI 身份
// （persona 不会进入 state，所以用 seatInvestigators 直接锁定选人结果）。
export function captureReplayLog(state) {
  const setup = state.setup || {}
  const investigators = state.investigators || []
  const humans = state.humanSeats || []
  // 建局时的选人快照优先：关卡间换人（hubSelectInvestigator）已经记在动作日志里，
  // 用"当前调查员"当建局参数会让重放的开局日志、AI 选人顺序和原局不一致。
  const openingCodes = Array.isArray(setup.seatInvestigators) && setup.seatInvestigators.length === investigators.length
    ? [...setup.seatInvestigators]
    : investigators.map(inv => inv.code)
  const moves = (state.actionLog || []).map((entry, index) => sanitizeEntry(entry, index))
  return {
    version: REPLAY_LOG_VERSION,
    meta: {
      hashVersion: STATE_HASH_VERSION,
      schemaVersion: state.schemaVersion ?? null,
      rulesVersion: state.rulesVersion ?? null,
      moveCount: moves.length,
    },
    settings: {
      campaignId: state.campaign?.id ?? null,
      difficulty: state.difficulty ?? 'standard',
      rulesMode: setup.rulesMode ?? state.rulesMode ?? 'simplified',
      seed: state.seed ?? null,
      campaignHub: Boolean(state.hubFlow),
      aiStoryAwareness: state.aiStoryAwareness === true,
      playerInvestigator: openingCodes[0] ?? 'auto',
      // AI 席位的调查员可能由 persona 决定（engine 的 pickAiInvestigator），
      // state 里不保存 persona，所以把"建局时选到谁"记下来，重放才不受选人策略变化影响。
      seatInvestigators: openingCodes,
      ...(Array.isArray(setup.playerDeck) ? { playerDeck: [...setup.playerDeck] } : {}),
    },
    players: investigators.map(inv => ({
      seat: inv.seat,
      role: humans.includes(inv.seat) ? 'human' : 'ai',
    })),
    moves,
  }
}

function normalizePlayers(players) {
  if (!Array.isArray(players) || !players.length) throw new Error('重放日志缺少 players')
  return players.map((player, index) => {
    if (!player || player.seat !== index) throw new Error('重放日志的 players 必须按座位顺序排列（seat 必须等于下标）')
    return { seat: player.seat, role: player.role === 'human' ? 'human' : 'ai' }
  })
}

function normalizeSettings(log) {
  const settings = { ...(log.settings || {}) }
  if (!settings.seed) throw new Error('重放日志缺少 seed，无法重建随机流')
  if (settings.campaignId == null) delete settings.campaignId
  settings.aiStoryAwareness = settings.aiStoryAwareness === true || settings.aiStoryAwareness === 'on'
  return settings
}

// 重放：从头建局，再按日志逐条提交。`until` 取中间态（撤销、差分、逐步对比都靠它）。
// `observe(state, index)` 是诊断钩子：对建局状态各调一次（index=0），之后每提交一步再调一次，
// 让 golden replay 能用一次重放比较全部中间指纹，而不是 O(n²) 地反复重建。
export function replayLog(log, { until = null, observe = null } = {}) {
  if (!log || typeof log !== 'object') throw new Error('重放日志必须是对象')
  if (log.version !== REPLAY_LOG_VERSION) throw new Error(`未知的重放日志版本：${log.version}`)
  const hashVersion = log.meta?.hashVersion
  if (hashVersion != null && hashVersion !== STATE_HASH_VERSION) {
    throw new Error(`重放基线的指纹版本是 ${hashVersion}，当前为 ${STATE_HASH_VERSION}，请用当前代码重新采集基线`)
  }
  const settings = normalizeSettings(log)
  const players = normalizePlayers(log.players)
  const moves = Array.isArray(log.moves) ? log.moves : []
  // 完整性：meta.moveCount 是采集时写下的动作数，和 moves 对不上说明基线被截断/手工改过。
  if (log.meta?.moveCount != null && log.meta.moveCount !== moves.length) {
    throw new Error(`重放日志完整性校验失败：meta.moveCount=${log.meta.moveCount}，实际 moves=${moves.length}`)
  }
  const count = until == null ? moves.length : Math.max(0, Math.min(moves.length, Math.floor(Number(until) || 0)))
  const state = createGameState(settings, players)
  // 建局状态本身没有动作日志；补一个空数组，让 `until: 0` 的结果形状和真实对局一致。
  if (!Array.isArray(state.actionLog)) state.actionLog = []
  if (observe) observe(state, 0)
  for (let index = 0; index < count; index++) {
    const entry = sanitizeEntry(moves[index], index)
    try {
      applyMove(state, entry.seat, { ...entry.move })
    } catch (error) {
      throw new Error(`重放第 ${index + 1} 步失败（${entry.move?.action}，座位 ${entry.seat}）：${error?.message || error}`)
    }
    if (observe) observe(state, index + 1)
  }
  return state
}

// 重放到第 `until` 步之后的状态指纹：迁移批次的"前后各跑一次、比较指纹"。
export function replayHash(log, { until = null } = {}) {
  return stateHash(replayLog(log, { until }))
}

// 逐步指纹（长度 = 重放步数 + 1，`[0]` 是建局状态）：golden 基线与随机对局的整体断言。
export function replayHashes(log, { until = null } = {}) {
  const hashes = []
  replayLog(log, { until, observe: state => hashes.push(stateHash(state)) })
  return hashes
}

// 值预览：把差异报告压到一行，方便失败信息直接贴进 issue。
function preview(value) {
  if (typeof value === 'string') return value.length > 80 ? value.slice(0, 80) + '…' : value
  const text = JSON.stringify(value)
  if (text == null) return String(value)
  return text.length > 120 ? text.slice(0, 120) + '…' : text
}

// 状态差异：只在指纹不一致时使用，给出"哪条路径、前后值"而不是两个哈希。
// 只比较参与指纹的字段（stateHash 的同一份投影），派生资源与瞬时字段不会制造噪音。
export function stateDiff(left, right, { limit = 24 } = {}) {
  const differences = []
  const walk = (a, b, path) => {
    if (differences.length >= limit) return
    if (Object.is(a, b)) return
    const arrayA = Array.isArray(a), arrayB = Array.isArray(b)
    if (arrayA || arrayB) {
      if (!arrayA || !arrayB) { differences.push({ path, left: preview(a), right: preview(b) }); return }
      const length = Math.max(a.length, b.length)
      for (let index = 0; index < length && differences.length < limit; index++) {
        walk(a[index], b[index], `${path}[${index}]`)
      }
      return
    }
    const objectA = a && typeof a === 'object', objectB = b && typeof b === 'object'
    if (objectA || objectB) {
      if (!objectA || !objectB) { differences.push({ path, left: preview(a), right: preview(b) }); return }
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
      for (const key of keys) {
        if (differences.length >= limit) return
        walk(a[key], b[key], path ? `${path}.${key}` : key)
      }
      return
    }
    differences.push({ path, left: preview(a), right: preview(b) })
  }
  walk(hashable(left), hashable(right), '')
  return differences
}

// 自检：把当前状态按它自己的动作日志重放一遍，比较指纹。
// 迁移/调试/存档体检都用它：`{ ok, hash, replayHash, moves, differences }`。
export function verifyReplay(state) {
  const log = captureReplayLog(state)
  const replayed = replayLog(log)
  const hash = stateHash(state)
  const replayHashValue = stateHash(replayed)
  return {
    ok: hash === replayHashValue,
    hash,
    replayHash: replayHashValue,
    moves: log.moves.length,
    differences: hash === replayHashValue ? [] : stateDiff(state, replayed),
  }
}

// 可回退的动作数：日志里记了多少个已提交动作。
export function undoDepth(state) {
  return (state.actionLog || []).length
}

// 回退到"已提交前 until 个动作"的状态：纯重放 + 原地替换，调用方持有的 state 引用保持有效。
// 检查点分支会把 revision 拨快一步却不多记动作，因此版本号按偏移量还原而不是直接等于 until。
export function rewindTo(state, until) {
  const log = captureReplayLog(state)
  const length = log.moves.length
  const target = Math.max(0, Math.min(length, Math.floor(Number(until))))
  if (!Number.isFinite(target)) throw new Error('回退步数无效')
  const offset = state.revision - length
  // 检查点分支会让 revision 比日志多 1（合法的 +1 偏移）；再多就说明这份状态没有完整日志
  // （Phase 4 之前的存档就是这种），此时重放只能回到建局状态，会把进度整个丢掉。
  if (offset > 1) {
    throw new Error(`动作日志与版本号不一致（revision ${state.revision}，日志 ${length} 步）：该对局没有完整动作日志，不能回退`)
  }
  const restored = replayLog(log, { until: target })
  restored.revision = target + offset
  if (!Number.isSafeInteger(restored.revision) || restored.revision < 0) throw new Error('回退后的版本号无效')
  for (const key of Object.keys(state)) delete state[key]
  Object.assign(state, restored)
  return state
}

// 撤销最近 count 步动作。
export function undoMoves(state, count = 1) {
  if (!Number.isInteger(count) || count < 1) throw new Error('撤销步数必须是正整数')
  const depth = undoDepth(state)
  if (count > depth) throw new Error(`只能撤销已记录的 ${depth} 步动作`)
  return rewindTo(state, depth - count)
}
