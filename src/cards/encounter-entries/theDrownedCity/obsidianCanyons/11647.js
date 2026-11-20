// 11647 · act · obsidianCanyons
//
// 西征幕 3。目标：每位存活调查员均已撤退（幕共有行动 X 由 api.choose 选择）；背面（behavior.actReveal 11647）→ 结局 1（返回海岸线 → 沉睡者墓穴）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11647',
  scope: 'act',
  implemented: true,
  flags: { actBack: 'returnToTheShoreline', resolution: 'resolution1', objective: { kind: 'allResigned' } },
  
  note: "西征幕 3。目标：每位存活调查员均已撤退；背面（behavior.actReveal 11647）→ 结局 1（返回海岸线 → 沉睡者墓穴）。",
}
