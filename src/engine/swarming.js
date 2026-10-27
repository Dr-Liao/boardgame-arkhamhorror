// Swarming X 的 X 值解析（批次 2 原语 `enemy.swarmingValue`）。
//
// 本循环的 11 个蜂拥敌人有四种 X 口径（P2 机制扫描）：
//   1. 固定值：`Swarming 2` / `Swarming 1`；
//   2. 按人数：`Swarming 1 [per_investigator]`；
//   3. 警报等级：`Swarming X. X is your alarm level…`（06228）；
//   4. 剧本参考卡伤害数：`Swarming X. X is the amount of damage on the scenario reference card`（06273）。
//
// 本模块只做「解析 + 求值」，不持有实体；蜂拥卡的放置见 `swarm.js`。
// 纯函数：不读全局状态以外的任何东西；`counter.investigator` 与 `scenarioFlags` 由调用方注入或读取。

export const SWARMING_KINDS = Object.freeze(['fixed', 'perInvestigator', 'alarmLevel', 'scenarioDamage', 'unknown'])

/**
 * 从卡面文本解析 Swarming 规格。
 * 返回 `{ kind, value, perInvestigator, raw }`；没有 Swarming 返回 null。
 */
export function swarmingSpec(text) {
  const source = String(text || '')
  const match = source.match(/Swarming\s+(X|\d+)(?:\s*(\[per_investigator\]))?/i)
  if (!match) return null
  const token = match[1]
  const perInvestigator = Boolean(match[2])
  const raw = match[0]
  if (token !== 'X') {
    return { kind: perInvestigator ? 'perInvestigator' : 'fixed', value: Number(token), perInvestigator, raw }
  }
  // X 的语义由卡文后半句决定；识别不了就标 unknown，调用方必须显式给出 x。
  const tail = source.slice(match.index + match[0].length)
  if (/alarm level/i.test(tail)) return { kind: 'alarmLevel', value: null, perInvestigator, raw }
  if (/damage on (the )?scenario reference card|scenario reference card/i.test(tail)) {
    return { kind: 'scenarioDamage', value: null, perInvestigator, raw }
  }
  return { kind: 'unknown', value: null, perInvestigator, raw }
}

/** 按人数口径计算（`per_investigator`）。 */
export function perInvestigatorCount(value, numInvestigators) {
  const people = Math.max(1, Number(numInvestigators) || 1)
  return Math.max(0, Number(value) || 0) * people
}

/**
 * 求值：调用方按 spec.kind 提供上下文。
 *   fixed / perInvestigator：用 spec.value 与 numInvestigators；
 *   alarmLevel / scenarioDamage / unknown：必须提供 `x`（非负整数），否则抛错（不静默按 0）。
 */
export function swarmingCount(spec, { numInvestigators = 1, x = null } = {}) {
  if (!spec) throw new Error('swarmingCount 需要 swarmingSpec 的结果')
  if (spec.kind === 'fixed') return Math.max(0, spec.value)
  if (spec.kind === 'perInvestigator') return perInvestigatorCount(spec.value, numInvestigators)
  if (spec.kind === 'alarmLevel' || spec.kind === 'scenarioDamage' || spec.kind === 'unknown') {
    if (!Number.isInteger(x) || x < 0) throw new Error(`${spec.kind} 的 X 需要调用方给出非负整数（收到 ${String(x)}）`)
    return x
  }
  throw new Error(`未知 Swarming 类型：${String(spec.kind)}`)
}

/**
 * 从状态取 X 的两种剧本口径：
 *   · 警报等级：`counter.investigator` 的 alarmLevel，取该座位或全桌最高；
 *   · 剧本参考卡伤害数：`state.scenarioFlags.referenceDamage`（P8 由章节脚本写）。
 */
export function swarmingXFromState(state, kind, seat = null) {
  if (kind === 'alarmLevel') {
    const table = state?.investigatorCounters?.alarmLevel?.seats || []
    if (seat != null && Number.isInteger(Number(seat))) return Math.max(0, table[Number(seat)] ?? 0)
    return table.reduce((max, value) => Math.max(max, value ?? 0), 0)
  }
  if (kind === 'scenarioDamage') {
    return Math.max(0, Number(state?.scenarioFlags?.referenceDamage) || 0)
  }
  return null
}

/**
 * 一次算完：解析卡文 + 求值（X 从状态读）。
 * 返回 `{ spec, count }`；卡面不是蜂拥敌人时返回 null。
 */
export function swarmingCountForText(state, text, { seat = null, numInvestigators } = {}) {
  const spec = swarmingSpec(text)
  if (!spec) return null
  const x = spec.kind === 'alarmLevel' || spec.kind === 'scenarioDamage'
    ? swarmingXFromState(state, spec.kind, seat)
    : null
  const people = numInvestigators ?? state?.numInvestigators ?? 1
  return { spec, count: swarmingCount(spec, { numInvestigators: people, x }) }
}
