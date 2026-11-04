import { registeredEntry } from './ability.js'
import { actsInPlay } from './parallel-acts.js'

// 窗口监听者的统一探测（只读）。
//
// 为什么需要它：`openAbilityWindow` 在没有监听者时也要走一遍来源枚举，本身不改状态；
// 但**开窗这件事本身**会在真有监听者时写 `state.abilityLimits`（窗口实例去重键）。
// 因此凡是为「新事件类型」新增调用点的位置，都先问这里：没有监听者就完全不开窗，
// 既有重放的状态指纹逐字不变（与神话阶段结束 mythosEnd 的开窗口径一致）。
//
// 覆盖的实体：敌人（含窗口上下文里的离场敌人）、已揭示地点、地点附属、幕、议程、
// 剧情资产，以及调查员自己的卡（调查员卡 / 手牌 / 支援 / 威胁区 / 附属）。
// 卡号优先用 originalCode：别名生成的敌人只登记印刷条目的能力。
export function hasWindowListener(state, windowId) {
  if (!state || !windowId) return false
  const listeners = source => (registeredEntry(source?.originalCode || source?.code)?.abilities || [])
    .some(descriptor => descriptor.trigger?.includes(windowId))
  const sources = [
    ...(state.enemies || []),
    ...(state.locations || []).filter(location => location.revealed),
    ...(state.playerLocationAttachments || []),
    // P7 并行幕：全部活动幕都算窗口监听来源（无 parallelActs 时等于旧的「当前幕」单点）。
    ...actsInPlay(state),
    state.agendas?.[state.agendaIndex],
    ...(state.storyAssets || []),
    ...(state.investigators || []).flatMap(inv => [inv, { code: inv?.code, originalCode: inv?.originalCode },
      ...(inv?.hand || []).map(code => ({ code })), ...(inv?.assets || []), ...(inv?.threat || []),
      ...(inv?.attachments || [])]),
  ]
  return sources.some(listeners)
}
