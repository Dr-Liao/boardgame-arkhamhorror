// 地点交换 / 移出游戏原语（2026-10-28 P2-6 · 05125 探访巫宅）。
//
// 05125 的背面流程原先在卡条目里直接改 `state.locations` / `location.*` /
// `state.playerLocationAttachments`，这里收口成两个语义原语（唯一实现；卡只经 ctx.api 调用）：
//
//   · swapLocationInPlay：用一张关卡地点替换场上地点。参考实现 `swapLocation`
//     （Helpers/Location.hs → `ReplaceLocation … Swap`）保留**同一个 location id**，因此
//     revealed / tokens / 卡牌 / 连接天然跟着走；本引擎的地点 id 是语义 id
//     （walterGilmansRoom → keziahsRoom），换成新 id 后必须显式搬 occupants 才能等价。
//     搬运顺序与 05125 迁移前逐项一致：旧地点上的敌人先搬（会先解除旧交战，抵达新地点后
//     由 autoEngageAt 重新交战），再搬调查员。
//
//   · removeLocationFromGame：「将场上的地点移出游戏」。地点离场时直接位于其上的敌人按
//     离场规则弃到遭遇弃牌堆（参考实现 Enemy.Runner 的 `RemovedLocation` 分支），不会留在
//     state.enemies 里；其余清理（地点附属/屏障/计数器/特性连线）复用引擎 removeLocation，
//     日志也沿用它的「被移出游戏」文案。
//
// 本模块不 import engine（避免循环依赖）：调用方（scenario-runtime）把
// placeLocation / removeLocation / relocateInvestigator / relocateEnemy / discardEnemyCard
// 作为 deps 传进来。入参不合法时返回 null（不抛错），条目在异常态下不会中断剧本。

/**
 * 用一张关卡地点替换场上地点，并搬走旧地点上的 token / 卡牌 / 占位者。
 *
 * @param {object} state 权威状态
 * @param {array} events 本次结算的事件列表（日志写入目标，不做持久化假设）
 * @param {string} fromId 场上旧地点的实例 id
 * @param {string} toId 关卡定义里的地点 id（state.scenario.locations[toId]）
 * @param {object} [options]
 *   · reveal: 'keep'（默认，保留旧地点 revealed；参考 swapLocation）| 'revealed' | 'unrevealed'
 *   · copyTokens: 默认 true，搬线索/毁灭并把 maxClues 抬到不低于线索数
 *   · copyAttachments: 默认 true，搬 location.attachments / location.beneath 并改写
 *     state.playerLocationAttachments 的 location
 *   · moveOccupants: 默认 true，搬旧地点上的敌人 / 剧情资产 / 调查员
 *   · takeFromSetAside: 默认 true，若新地点卡号在 state.scenarioZones.setAside 里则取走一张
 * @param {object} deps { placeLocation, removeLocation, relocateInvestigator, relocateEnemy }
 * @returns {object|null} 新地点实例；旧地点不在场 / 新地点已入场 / 定义缺失时返回 null
 */
export function swapLocationInPlay(state, events, fromId, toId, options = {}, deps = {}) {
  const { placeLocation, removeLocation, relocateInvestigator, relocateEnemy } = deps
  if (!state || typeof placeLocation !== 'function' || typeof removeLocation !== 'function') return null
  const locations = state.locations || []
  const from = locations.find(location => location.id === fromId)
  const definition = state.scenario?.locations?.[toId]
  if (!from || !definition || fromId === toId) return null
  if (locations.some(location => location.id === toId)) return null
  // 入场：复用引擎 placeLocation（「进入游戏」日志 / lastLocationEntered / 符号连线 /
  // 未揭示时的线索归零都由它统一处理）。
  placeLocation(state, toId, events)
  const next = (state.locations || []).find(location => location.id === toId)
  if (!next) return null

  // 1) 揭示状态：默认保留旧地点（参考实现：「swapLocation … Will keep revealed status」）。
  next.revealed = options.reveal === 'revealed' ? true
    : options.reveal === 'unrevealed' ? false
      : from.revealed === true

  // 2) 标记（线索 / 毁灭）随地点卡带走；maxClues 只抬高下界，不缩小印刷值。
  if (options.copyTokens !== false) {
    next.clues = Number(from.clues) || 0
    next.doom = Number(from.doom) || 0
    next.maxClues = Math.max(Number(next.maxClues) || 0, next.clues)
  }

  // 3) 地点附属 / 压牌：移动而不是复制——旧地点随后静默离场时会按离场规则清理附件，
  //    复制会把同一张卡再弃一次。
  if (options.copyAttachments !== false) {
    if (Array.isArray(from.attachments) && from.attachments.length) {
      next.attachments = [...(next.attachments || []), ...from.attachments]
      from.attachments = []
    }
    if (Array.isArray(from.beneath) && from.beneath.length) {
      next.beneath = [...(next.beneath || []), ...from.beneath]
      from.beneath = []
    }
    for (const attachment of state.playerLocationAttachments || []) {
      if (attachment.location === fromId) attachment.location = toId
    }
  }

  // 4) 「放到一边」的地点卡随入场取走一张（参考实现 getSetAsideCard 的语义）。
  if (options.takeFromSetAside !== false) {
    const code = String(next.originalCode || next.code || '')
    const setAside = state.scenarioZones?.setAside
    if (code && Array.isArray(setAside)) {
      const index = setAside.indexOf(code)
      if (index >= 0) setAside.splice(index, 1)
    }
  }

  // 5) 占位者：先敌人后调查员（与 05125 迁移前的调用顺序一致）。剧情资产跟着地点走。
  if (options.moveOccupants !== false) {
    for (const enemy of (state.enemies || []).filter(item => item.location === fromId)) {
      if (typeof relocateEnemy === 'function') relocateEnemy(state, enemy, toId, events)
      else enemy.location = toId
    }
    for (const asset of state.storyAssets || []) {
      if (asset.location === fromId) asset.location = toId
    }
    for (const inv of (state.investigators || []).filter(item => item.location === fromId)) {
      if (typeof relocateInvestigator === 'function') relocateInvestigator(state, inv.seat, toId, events)
      else inv.location = toId
    }
  }

  // 6) 旧地点静默离场：附件清理 / 屏障 / 地点计数器 / 特性连线与 removeLocation 相同，
  //    但不新增「被移出游戏」日志（迁移前 05125 对沃尔特房间也是手写 splice，无日志）。
  removeLocation(state, fromId, events, { silent: true })
  return next
}

/**
 * 把地点从游戏中移除（05125「将场上的其他所有地点从游戏中移除」）。
 *
 * @param {object} state 权威状态
 * @param {array} events 本次结算的事件列表
 * @param {string} id 地点实例 id
 * @param {object} [options]
 *   · discardEnemies: 默认 true，直接位于该地点的敌人进遭遇弃牌堆（参考实现离场规则）
 *   · discardPlayerAttachments: 默认 false，保持现状（玩家卡地点附属悬空是既有缺口，
 *     本批不改变行为）；传 true 时随地点离场进控制者弃牌堆
 * @param {object} deps { removeLocation, discardEnemyCard }
 * @returns {object|null} 被移除的地点实例；地点不在场时返回 null
 */
export function removeLocationFromGame(state, events, id, options = {}, deps = {}) {
  const { removeLocation, discardEnemyCard } = deps
  if (!state || typeof removeLocation !== 'function') return null
  const location = (state.locations || []).find(item => item.id === id)
  if (!location) return null
  if (options.discardEnemies !== false && typeof discardEnemyCard === 'function') {
    for (const enemy of (state.enemies || []).filter(item => item.location === id)) {
      discardEnemyCard(state, enemy)
    }
  }
  if (options.discardPlayerAttachments === true) {
    for (const attachment of (state.playerLocationAttachments || []).filter(item => item.location === id)) {
      const index = state.playerLocationAttachments.indexOf(attachment)
      if (index >= 0) state.playerLocationAttachments.splice(index, 1)
      const owner = state.investigators?.[attachment.ownerSeat]
      if (owner) owner.discard.push(attachment.code)
    }
  }
  removeLocation(state, id, events)
  return location
}
