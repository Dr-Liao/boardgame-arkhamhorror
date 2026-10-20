// 诡镇奇谈：卡牌版 · 技能检定的阶段与结果契约（缺口 B3，Phase 2）
//
// 此前的症状：
//   · `api.test()` 只接受一个回调，没有返回值——内容层拿不到"这次检定成功了没有、差几点"，
//     只能把后续逻辑塞进回调闭包（不可枚举，也无法在 AI 上下文里解释）；
//   · 窗口上下文各自塞值（`context.value` / `successBy` / `failedBy`），没有一份标准形状；
//   · 没有 `retryTest`（"失败后重试"），没有强制投入（不询问就投入），也没有投入上限。
//
// 本模块定义**一份**结果形状与阶段词表，引擎在结算时构造它，三处共用：
//   1. `ctx.result`（检定期间打开的窗口）；
//   2. `state.lastTestResult`（结算后仍可读，随存档往返）；
//   3. `api.test()` 的返回值（同步结算时）。
//
// 阶段（与引擎的 ST.x 对应）：
//   beforeCommit  ST.1–ST.2  检定开始、尚未投入
//   afterCommit   ST.3       投入结束、尚未揭示标记
//   tokens        ST.4–ST.7  揭示与修正
//   results       ST.8       结算完成
//
// 结果形状（全部纯数据，可 JSON 往返）：
//   { seat, skill, difficulty, baseValue, value, success, autoFail, successBy, failedBy,
//     drawn: [...], cancelled: [...], source, stage }

export const TEST_STAGES = Object.freeze(['beforeCommit', 'afterCommit', 'tokens', 'results'])

// 引擎内部的 ST.x 阶段 → 对外词表（引擎是唯一知道 ST 细节的地方，映射放这里统一）。
const STAGE_MAP = Object.freeze({
  'ST.1': 'beforeCommit',
  'ST.2': 'beforeCommit',
  'ST.3': 'afterCommit',
  'ST.4': 'tokens',
  'ST.5': 'tokens',
  'ST.6': 'tokens',
  'ST.7': 'tokens',
  'ST.8': 'results',
})

export function testStage(stage) {
  return STAGE_MAP[stage] || (TEST_STAGES.includes(stage) ? stage : null)
}

/**
 * 把引擎内部的检定状态（state.skillTest）与结算结果规范化成对外形状。
 * @param {object} skillTest state.skillTest（进程内）
 * @param {object} raw 引擎算出的结果 { value, difficulty, success, autoFail, drawn, cancelled }
 */
export function summarizeTestResult(skillTest, raw = {}) {
  const difficulty = Number(raw.difficulty ?? skillTest?.difficulty ?? 0)
  const value = Number(raw.value ?? skillTest?.value ?? 0)
  const success = raw.success === true
  const autoFail = raw.autoFail === true
  return Object.freeze({
    seat: Number.isInteger(raw.seat) ? raw.seat : (Number.isInteger(skillTest?.seat) ? skillTest.seat : null),
    skill: raw.skill || skillTest?.skill || null,
    difficulty,
    baseValue: Number(raw.baseValue ?? skillTest?.baseValue ?? 0),
    value,
    success,
    autoFail,
    // 成功/失败差额统一成非负数：窗口条件（failedByAtMost / successByAtLeast）读同一份。
    successBy: success ? Math.max(0, value - difficulty) : 0,
    failedBy: success ? 0 : Math.max(0, difficulty - value),
    drawn: Object.freeze([...(raw.drawn || [])]),
    cancelled: Object.freeze([...(raw.cancelled || skillTest?.cancelledCommitments?.map(item => item.code) || [])]),
    source: raw.source || skillTest?.source || null,
    stage: 'results',
  })
}

// 检定进行中的"半成品结果"：窗口只需要知道当前值/难度，不需要完整结果。
export function pendingTestResult(skillTest) {
  if (!skillTest) return null
  const value = Number(skillTest.value ?? 0)
  const difficulty = Number(skillTest.difficulty ?? 0)
  return Object.freeze({
    seat: skillTest.seat ?? null,
    skill: skillTest.skill || null,
    difficulty,
    baseValue: Number(skillTest.baseValue ?? 0),
    value,
    success: value >= difficulty,
    autoFail: false,
    successBy: Math.max(0, value - difficulty),
    failedBy: Math.max(0, difficulty - value),
    drawn: Object.freeze([...(skillTest.drawn || [])]),
    cancelled: Object.freeze([]),
    source: skillTest.source || null,
    stage: testStage(skillTest.stage) || 'beforeCommit',
  })
}

export function describeTestResult(result) {
  if (!result) return '（无检定结果）'
  const skill = result.skill || '技能'
  const verdict = result.autoFail ? '自动失败' : result.success ? '成功' : '失败'
  const delta = result.success ? `超过 ${result.successBy}` : `差 ${result.failedBy}`
  return `${skill}检定 ${result.value} vs ${result.difficulty}：${verdict}（${delta}）`
}
