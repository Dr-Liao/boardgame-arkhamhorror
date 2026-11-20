// 11642 · agenda · obsidianCanyons
//
// 西征（v.I）议程 1。正面同 11641。背面（behavior.agendaReveal）：风暴强度 ≥6 → 每位存活调查员被击败并受 1 肉体创伤；否则 +1 强度、从遭遇牌库顶弃到敌人并生成在队长地点（强度≤3 时横置未交战），再翻回正面。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11642',
  scope: 'agenda',
  implemented: true,
  flags: { agenda: 'encroachingStorms', stormThreshold: 6, backEffect: 'discardUntilEnemy' },
  
  note: "西征（v.I）议程 1。正面同 11641。背面（behavior.agendaReveal）：风暴强度 ≥6 → 每位存活调查员被击败并受 1 肉体创伤；否则 +1 强度、从遭遇牌库顶弃到敌人并生成在队长地点（强度≤3 时横置未交战），再翻回正面。",
}
