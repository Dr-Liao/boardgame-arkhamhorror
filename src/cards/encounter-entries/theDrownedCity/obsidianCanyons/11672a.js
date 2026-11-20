// 11672a · storyAsset · obsidianCanyons
//
// 黑曜石之爪（速度面，放一边）。[fast] 横置并选至多 2 连接外一处地点移动过去；[fast] 翻面（每轮一次）。behavior.takeObsidianClaw 以（速度）面放进场；翻面/移动链路未接线（近似）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11672a',
  scope: 'storyAsset',
  implemented: true,
  flags: { obsidianClaw: true, face: 'speed', cannotLeavePlay: true, moveThroughSkyline: true },
  
  note: "黑曜石之爪（速度面，放一边）。[fast] 横置并选至多 2 连接外一处地点移动过去；[fast] 翻面（每轮一次）。behavior.takeObsidianClaw 以（速度）面放进场；翻面/移动链路未接线（近似）。",
}
