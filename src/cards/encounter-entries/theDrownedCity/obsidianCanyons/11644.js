// 11644 · act · obsidianCanyons
//
// 东征幕 2。目标：每位存活调查员均已撤退（幕共有行动「花 X 线索」的 X 由 api.choose 选择）；背面（behavior.actReveal 11644）→ 结局 2（前往古代圆顶 → 古代法庭）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11644',
  scope: 'act',
  implemented: true,
  flags: { actBack: 'toTheAncientDome', resolution: 'resolution2', objective: { kind: 'allResigned' } },
  
  note: "东征幕 2。目标：每位存活调查员均已撤退；背面（behavior.actReveal 11644）→ 结局 2（前往古代圆顶 → 古代法庭）。",
}
