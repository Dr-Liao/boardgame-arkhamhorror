// 11642 · agenda · obsidianCanyons
//
// 西征（v.I）议程 1。正面同 11641。背面（behavior.agendaReveal）：风暴强度 ≥6 → 每位存活调查员被击败并受 1 肉体创伤；否则 +1 强度、从遭遇牌库顶弃到敌人并生成在队长地点（强度≤3 时横置未交战），再翻回正面。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11642',
  scope: 'agenda',
  implemented: true,
  flags: { agenda: 'encroachingStorms', backEffect: 'discardUntilEnemy' },
  
  note: "（「非弱点敌人可进出开阔天空」由 entries/xsky.js 的 locationRule.weaknessEnemiesCannotEnter 声明，读点 enemy-entry.js#enemyCanEnterLocation）西征（v.I）议程 1。正面同 11641。背面（behavior.agendaReveal）：风暴强度 ≥6 → 每位存活调查员被击败并受 1 肉体创伤；否则 +1 强度、从遭遇牌库顶弃到敌人并生成在队长地点（强度≤3 时横置未交战），再翻回正面。",
}
