// 06313 无面欺诈者（Liar with No Face）
// 卡面：猎物 - 手牌最多。猎手。
//       强制 - 在无面欺诈者攻击你时，如果混沌低语在你手牌中：将其揭示。无面欺诈者本次攻击造成 +2 伤害。
//
// 读点分工（声明即接线）：
//   · `flags.whisperBonusDamage: 2` → 章节 behavior.enemyAttackModifier 在攻击者手牌里有
//     「混沌低语」（flags.whisperingChaos 的四张之一）时返回 { damage: +2 }；
//   · 揭示那张「混沌低语」→ 章节 behavior.enemyAttackStarted（带 api）调用 api.cardReveal。
// 猎物/猎手由卡文解析进 definition。
export default {
  code: '06313',
  scope: 'enemy',
  implemented: true,
  flags: { whisperBonusDamage: 2 },
}
