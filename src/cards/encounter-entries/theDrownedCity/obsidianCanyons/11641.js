// 11641 · agenda · obsidianCanyons
//
// 东征（v.II）议程 1。正面：非弱点敌人可如地点般进出开阔天空；每处地点与相邻地点/开阔天空相连；调查员所在地点将离场时移到任意[[中央]]地点并受 2 直接伤害。背面（behavior.agendaReveal）：风暴强度 ≥6 → 每位存活调查员被击败并受 1 肉体创伤；否则 +1 强度并翻回正面。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11641',
  scope: 'agenda',
  implemented: true,
  flags: { agenda: 'otherworldlyStorms', stormThreshold: 6, backEffect: 'none' },
  
  note: "东征（v.II）议程 1。正面：非弱点敌人可如地点般进出开阔天空；每处地点与相邻地点/开阔天空相连；调查员所在地点将离场时移到任意[[中央]]地点并受 2 直接伤害。背面（behavior.agendaReveal）：风暴强度 ≥6 → 每位存活调查员被击败并受 1 肉体创伤；否则 +1 强度并翻回正面。",
}
