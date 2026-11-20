// 11652 · location · obsidianCanyons
//
// 古代圆顶（西征移除）。揭示后抽取剥蚀壁画（真实遭遇附属实例）；不能移动/离场由 locationRule 声明（引擎 swapLocation/removeLocationFromGame 读点）；[action] 撤退（behavior.performAction obsidianResign → api.resign）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11652',
  scope: 'location',
  implemented: true,
  locationRule: { cannotLeavePlay: true, cannotBeMoved: true },
  flags: { central: true, immovable: true, resign: true, revealErodedFrieze: true },
  
  note: "古代圆顶（西征移除）。揭示后抽取剥蚀壁画；不能移动/离场由 locationRule 声明（引擎 swapLocation/removeLocationFromGame 读点）；[action] 撤退未接。",
}
