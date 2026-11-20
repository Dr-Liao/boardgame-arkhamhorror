// 11645 · act · obsidianCanyons
//
// 西征幕 1。目标：每位存活调查员位于中央尖塔。背面 behavior.scouringAct1Back：移除拉莱耶街道、重排 3×5 天际线。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11645',
  scope: 'act',
  implemented: true,
  flags: { actBack: 'scouringTheSpires', objective: { kind: 'allAt', location: 'centralSpire' } },
  
  note: "西征幕 1。目标：每位存活调查员位于中央尖塔。背面 behavior.scouringAct1Back：移除拉莱耶街道、重排 3×5 天际线。",
}
