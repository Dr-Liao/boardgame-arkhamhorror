// 11646 · act · obsidianCanyons
//
// 西征幕 2。目标：每位存活调查员位于漂浮尖塔。背面 behavior.deadlySkiesBack：移除中央尖塔、重排 4×5 天际线（漂浮尖塔为锚点）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11646',
  scope: 'act',
  implemented: true,
  flags: { actBack: 'deadlySkies', objective: { kind: 'allAt', location: 'floatingSpire' } },
  
  note: "西征幕 2。目标：每位存活调查员位于漂浮尖塔。背面 behavior.deadlySkiesBack：移除中央尖塔、重排 4×5 天际线（漂浮尖塔为锚点）。",
}
