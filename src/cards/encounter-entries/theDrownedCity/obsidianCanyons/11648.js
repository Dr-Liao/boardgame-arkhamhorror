// 11648 · location · obsidianCanyons
//
// 起始地点（拉莱耶街道）。不能移动或离场（locationRule: { cannotLeavePlay:true, cannotBeMoved:true }，引擎 swapLocation/removeLocationFromGame 读点）；[action] 花费 1-3 资源在任意已揭示地点放等量线索（每轮限一次）。behavior.actions 的 obsidianPlaceClues：资源数（1-3）与目标已揭示地点均由 api.choose 选择，轮限记在 location.cluesPlacedThisRound。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11648',
  scope: 'location',
  implemented: true,
  locationRule: { cannotLeavePlay: true, cannotBeMoved: true },
  flags: { start: true, central: true, immovable: true, cluesByResources: true },
  
  note: "起始地点（拉莱耶街道）。不能移动或离场（locationRule: { cannotLeavePlay:true, cannotBeMoved:true }，引擎 swapLocation/removeLocationFromGame 读点）；[action] 花费 1-3 资源在任意已揭示地点放等量线索（每轮限一次）。behavior.actions 的 obsidianPlaceClues 由玩家选择 1-3 个资源，轮限记在 location.cluesPlacedThisRound。",
}
