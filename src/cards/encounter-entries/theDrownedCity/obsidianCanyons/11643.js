// 11643 · act · obsidianCanyons
//
// 东征幕 1。共有行动「花 X 线索：从峰顶牌库底揭示 X 张，可放 1 张地点进相邻开阔天空并移动」在 behavior.actions/performAction（obsidianSearchSpires）。目标：每位存活调查员位于中央尖塔（behavior.checkObjectives）。背面 behavior.searchingAct1Back：生成穷途异魔，重排 3×5 天际线。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11643',
  scope: 'act',
  implemented: true,
  flags: { actBack: 'searchingTheSpires', objective: { kind: 'allAt', location: 'centralSpire' } },
  
  note: "东征幕 1。共有行动「花 X 线索：从峰顶牌库底揭示 X 张，可放 1 张地点进相邻开阔天空并移动」在 behavior.actions/performAction（obsidianSearchSpires）。目标：每位存活调查员位于中央尖塔（behavior.checkObjectives）。背面 behavior.searchingAct1Back：生成穷途异魔，重排 3×5 天际线。",
}
