// 地点上的毁灭（P3 批次 3 原语 `location.doom`）。
//
// 规则口径（官方卡面；P4 复核（关键词手册 §2.4））：
//   · B4《编织宇宙》的「大网」地点会累积毁灭标记（进入/结束时放置、作为调查额外费用、
//     织网者每轮结束放置、无尽编织放置……06341–06354）；
//   · 地点上的毁灭**是毁灭**：它计入议程阈值，也被剧本参考卡的骷髅符号读取
//     （06333：X 为场上单个地点上的最高毁灭数）；
//   · 石板符号可以把地点上的 1 个毁灭移除。本循环没有任何「毁灭达到阈值就把地点移出游戏」
//     的规则。
//
// P4 更正：P3 曾按「地点毁灭（达到阈值移除地点）」实现 `shouldDestroyLocation` /
// `destroyLocation` / `locationDoomThreshold`，但 06 段 388 张卡没有一张写「毁灭地点」，
// 参考实现也只有 `LocationDoom` 标记；已改为只记账「地点上的毁灭」，
// 见关键词手册 §4。
//
// 状态形状：只写 `location.doomOnLocation`；未使用该原语的地点不产生字段。

/** 地点当前的毁灭标记数（未记录 = 0）。 */
export function locationDoomOf(location) {
  const value = location?.doomOnLocation
  return Number.isInteger(value) && value > 0 ? value : 0
}

/** 加/减地点毁灭（0 下限；返回新值）。 */
export function addLocationDoom(location, delta = 1) {
  if (!location || typeof location !== 'object') throw new Error('addLocationDoom 需要地点对象')
  const next = Math.max(0, locationDoomOf(location) + (Number(delta) || 0))
  location.doomOnLocation = next
  return next
}

/** 移除地点上的毁灭（0 下限）；与 `addLocationDoom(location, -n)` 同义，给卡面「移除毁灭」用。 */
export function removeLocationDoom(location, amount = 1) {
  return addLocationDoom(location, -Math.abs(Number(amount) || 0))
}

/** 全桌地点上的毁灭总数（投影与统计用）。 */
export function totalLocationDoom(state) {
  return (state?.locations || []).reduce((sum, location) => sum + locationDoomOf(location), 0)
}

/** 单个地点上的最高毁灭数（B4 骷髅符号 `-X. X 为单地点最高毁灭`）。 */
export function highestLocationDoom(state) {
  return (state?.locations || []).reduce((max, location) => Math.max(max, locationDoomOf(location)), 0)
}

/** 注册期校验：地点毁灭必须是非负整数（返回问题列表，不修改数据）。 */
export function normalizeLocationDoom(locations) {
  const problems = []
  for (const location of locations || []) {
    const value = location?.doomOnLocation
    if (value == null) continue
    if (!Number.isInteger(value) || value < 0) problems.push(`${location.code || location.id}：地点毁灭必须是非负整数（收到 ${value}）`)
  }
  return { ok: problems.length === 0, problems }
}
