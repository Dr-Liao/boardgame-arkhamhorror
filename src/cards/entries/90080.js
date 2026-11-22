// 90080 雷克斯的诅咒（Rex's Curse）· 中立 · 诡计/弱点 · 进阶（雷克斯·墨菲）。
// 卡面（cards-data 90080）：
//   进阶。
//   显现 - 将雷克斯的诅咒放置入场，放到你的威胁区域。
//   强制 - 在你技能检定将要成功时：额外揭示 1 个混乱标记。如果本效果导致你失败，将雷克斯的诅咒混洗入你的牌库。
//     （每次检定仅限一次。）
//
// 引擎读点：与 02009 原版共用同一条读点 `rerollRevealedTokenOnSuccess`（条目级标记，
//   tests.js 在「检定将要成功」段读取：放回已揭示标记并再揭示 1 枚；若因此失败则按
//   weaknessProfile(rexCurse) 把该弱点洗回牌库）。弱点进威胁区 = weakness threat 档案。
// 近似：原版是「放回再揭示（reroll）」，进阶版是「额外揭示 1 枚（additional token）」；
//   引擎目前只有 reroll 原语，行为等价于「把可能导致失败的额外标记纳入结算」但不完全等同
//   （额外标记的数值与重抽不同）→ primitive-requests/core-cards-a-90080-rex-curse-additional-token.json。
export default {
  code: '90080',
  abilities: [
    {
      kind: 'weakness',
      label: '雷克斯的诅咒（进阶）：进入威胁区；将成功时额外揭示 1 枚标记，失败则洗回牌库',
      weakness: { type: 'threat', rexCurse: true },
    },
  ],
  rerollRevealedTokenOnSuccess: true,
  modifiers: [],
  note: '近似：进阶的「额外揭示 1 个标记」暂用原版 reroll 读点（rerollRevealedTokenOnSuccess）结算；精确语义需 additional-token 原语 → primitive-requests/core-cards-a-90080-rex-curse-additional-token.json。',
}
