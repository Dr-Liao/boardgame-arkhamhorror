// 并行幕（Parallel Acts）—— 印斯茅斯阴谋 P7《暗潮之下》第八章「深海之城」v.I/II/III。
//
// 印刷规则（07316/07317/07318 背面同文）：
//   "Add this card to the victory display.
//    - If there is another act card in play, you may choose to either continue playing in order
//      to accomplish the objective on that act card, or proceed immediately to (→R1) without
//      fulfilling that objective.
//    - If there are no other act cards in play, proceed to (→R1). Victory 2."
//
// 模型：
//   · state.acts / state.actIndex 保持「线性单幕」语义不变（07315 → 07316 仍走 advanceAct）；
//   · 额外的活动幕放在顶层惰性数组 `state.parallelActs`，只在 addParallelAct 第一次调用时创建；
//   · 统一读法 `actsInPlay(state)` = [当前线性幕, ...parallelActs]。
//   · 旧存档 / 其它战役没有 `parallelActs` 字段 → 所有读点退化为 [当前幕]，行为与字节完全不变。
//
// 读点（都写成「数组为空则与单元素完全一致」的形态；见 w6 设计文档 §2.2 全表）：
//   · ability-rules.js#nonPlayerAbilitySources —— 窗口里的 forced/reaction 来源；
//   · window-listeners.js#hasWindowListener —— 窗口监听者探测；
//   · parley.js#activeStageEntities —— 幕卡上的 [action]/[free] 能力（legalMoves / 执行）；
//   · modifiers.js#entityModifierRows —— 幕行修正；
//   · act-agenda.js#checkAct —— 每次行动后检查并行幕目标（objective → onComplete）。
//
// 完成判定：
//   · 内容层 behavior 若声明 `checkParallelActs(state, api)`，由它统一分派（w6 设计口径）；
//   · 否则引擎在这里按条目 `actRule.objective/onComplete` 通用分派；
//   · 两条入口语义一致：每次行动后纯读；只有 objective === true 才写（不改 moveCount/日志）。
//
// 存档：parallelActs 是权威状态，自然随存档往返；旧档缺字段即空，不做迁移。
// 清理：实例带 scenarioId；startScenario 尚未 delete 时，跨关残留由 parallelActs() 的过滤兜底。

export function parallelActs(state) {
  const list = state?.parallelActs
  if (!Array.isArray(list) || list.length === 0) return []
  const scenarioId = state.scenario?.id
  if (!scenarioId) return list.filter(act => Boolean(act))
  return list.filter(act => act && (act.scenarioId == null || act.scenarioId === scenarioId))
}

export function actsInPlay(state) {
  const out = []
  if (!state) return out
  const current = state.acts?.[state.actIndex]
  if (current) out.push(current)
  for (const act of parallelActs(state)) out.push(act)
  return out
}

// 按实例 id 或印刷卡号找一张活动中的并行幕。
export function findParallelAct(state, idOrCode) {
  if (idOrCode == null) return null
  const target = String(idOrCode)
  return parallelActs(state).find(act => String(act.id) === target
    || String(act.originalCode || act.code) === target) || null
}

// 把一张幕作为「额外的活动幕」加入；同一卡号已经活动时返回 false（幂等）。
// 跨关残留（scenarioId 与当前剧本不同）会被清掉，避免上一关的幕混进本关。
export function appendParallelAct(state, act) {
  if (!state || !act) return false
  if (findParallelAct(state, act.originalCode || act.code)) return false
  const scenarioId = state.scenario?.id
  if (Array.isArray(state.parallelActs) && scenarioId != null) {
    state.parallelActs = state.parallelActs.filter(item =>
      item && (item.scenarioId == null || item.scenarioId === scenarioId))
  }
  if (!Array.isArray(state.parallelActs)) state.parallelActs = []
  state.parallelActs.push(act)
  return true
}

// 从活动幕槽移除（不写胜利区）；最后一张移除时删除字段，恢复「没有并行幕」的状态形状。
export function removeParallelAct(state, idOrCode) {
  const act = findParallelAct(state, idOrCode)
  if (!act) return null
  state.parallelActs.splice(state.parallelActs.indexOf(act), 1)
  if (!state.parallelActs.length) delete state.parallelActs
  return act
}

// 把一张幕加入胜利展示区（Victory X）；按印刷卡号去重（事务重放幂等）。
export function addActToVictory(state, act, victory = 0) {
  if (!state || !act) return false
  const code = String(act.originalCode || act.code || '')
  if (!code) return false
  state.victoryDisplay ||= []
  if (state.victoryDisplay.some(card => String(card?.originalCode || card?.code || card) === code)) return false
  state.victoryDisplay.push({
    id: act.id ?? `act${code}`, code, originalCode: code, name: act.name ?? null,
    victory: Number(victory) || 0,
  })
  return true
}

// 完成一张并行幕：从活动槽移除 + 加入胜利区。返回被移除的幕实例（调用方记账/日志用）。
export function completeParallelAct(state, idOrCode) {
  const act = removeParallelAct(state, idOrCode)
  if (!act) return null
  addActToVictory(state, act, act.victory)
  return act
}

// 并行幕目标检查：纯读；objective === true 时才调用 onComplete（写入的唯一入口在卡/内容层）。
// entryOf 是 registeredEntry 的注入（本模块不 import 注册表，保持叶子模块）。
export function checkParallelActObjectives(state, api, entryOf) {
  if (!state || state.status !== 'playing' || typeof entryOf !== 'function') return false
  let acted = false
  for (const act of parallelActs(state)) {
    // onComplete 可能在前一张幕里移除/重排活动幕；逐张重新确认仍是活动幕。
    if (!findParallelAct(state, act.id)) continue
    const rule = entryOf(act.originalCode || act.code)?.actRule
    if (!rule || typeof rule.objective !== 'function') continue
    if (rule.objective(state, act, api) !== true) continue
    if (typeof rule.onComplete !== 'function') continue
    rule.onComplete(state, act, api)
    acted = true
    if (state.status !== 'playing') return acted
  }
  return acted
}

// 活动幕完成后的统一结算（三张「深海之城」背面同文，只写一次）：
//   · 场上没有其他场景卡 → 立即进入结局（默认 R1）；
//   · 还有另一张场景卡（另一张并行幕，或当前线性幕）→ 队长选择「继续游戏 / 立即进入结局」。
// 调用方传入当前剧本的结局键（暗潮之下 = resolution1）；选择/结束通过注入的 api 回调执行。
export function resolveActCompletion(state, {
  act = null, resolution = 'resolution1', choose, decideSeat, finish,
} = {}) {
  if (!state || state.status !== 'playing') return null
  const completedId = act?.id ?? null
  const completedCode = act ? String(act.originalCode || act.code) : null
  const remaining = actsInPlay(state).some(other => other
    && (completedId == null || other.id !== completedId)
    && (completedCode == null || String(other.originalCode || other.code) !== completedCode))
  if (!remaining) {
    if (typeof finish === 'function') finish(resolution)
    return 'r1'
  }
  const seat = typeof decideSeat === 'function' ? decideSeat() : (state.campaign?.leadSeat ?? 0)
  const answer = typeof choose === 'function'
    ? choose({
      kind: 'effect', seat, source: act ? String(act.originalCode || act.code) : 'parallelActs',
      prompt: '场上还有其他场景卡：继续游戏以完成它的目标，还是立即进入结局1（→R1）？',
      options: [{ id: 'continue', label: '继续游戏' }, { id: 'r1', label: '立即进入结局1' }],
    })
    : 'continue'
  if (answer === 'r1') {
    if (typeof finish === 'function') finish(resolution)
    return 'r1'
  }
  return 'continue'
}
