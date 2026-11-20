// 11658 · location · obsidianCanyons
//
// 古代峡谷。[[峰顶]]；揭示后[敏捷](1)，失败找[[怪物]]敌人生成并交战（近似：未接线）；[action] 把放一边的天空遗物放进场由你控制（behavior.actions obsidianTakeSkyRelic）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11658',
  scope: 'location',
  implemented: true,
  flags: { summit: true, skyRelicAction: true },
  
  note: "古代峡谷。[[峰顶]]；揭示后[敏捷](1)，失败找[[怪物]]敌人生成并交战（近似：未接线）；[action] 把放一边的天空遗物放进场由你控制（behavior.actions obsidianTakeSkyRelic）。",
}
