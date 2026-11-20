// 11660 · location · obsidianCanyons
//
// 空中瀑布。[[峰顶]]；[fast] 花 1 线索移动到任意已揭示[[峰顶]]地点（behavior.aerialWaterfallFast）；[action] 团队花 1[per_investigator] 线索，把放一边的黑曜石之爪以（速度）面朝上放进场（behavior.takeObsidianClaw）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11660',
  scope: 'location',
  implemented: true,
  flags: { summit: true, fastMoveToSummit: true, obsidianClawAction: true },
  
  note: "空中瀑布。[[峰顶]]；[fast] 花 1 线索移动到任意已揭示[[峰顶]]地点（behavior.aerialWaterfallFast）；[action] 团队花 1[per_investigator] 线索，把放一边的黑曜石之爪以（速度）面朝上放进场（behavior.takeObsidianClaw）。",
}
