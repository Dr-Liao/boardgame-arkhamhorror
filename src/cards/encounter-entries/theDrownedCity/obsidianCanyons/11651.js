// 11651 · location · obsidianCanyons
//
// 西墙。不能移动/离场（locationRule 声明，引擎读点）；揭示后抽取放一边的剥蚀壁画（behavior.locationRevealed → drawErodedFrieze → api.attachEncounterToLocation 真实附属实例）；[action] 撤退（behavior.performAction obsidianResign → api.resign）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11651',
  scope: 'location',
  implemented: true,
  locationRule: { cannotLeavePlay: true, cannotBeMoved: true },
  flags: { central: true, immovable: true, resign: true, revealErodedFrieze: true },

  note: "西墙。不能移动/离场（locationRule 声明，引擎读点）；揭示后抽取放一边的剥蚀壁画（behavior.locationRevealed → drawErodedFrieze，附属到本地点）；[action] 撤退。",
}
