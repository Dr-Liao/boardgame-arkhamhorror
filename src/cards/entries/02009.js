// 02009 雷克斯的诅咒
// 卡面：显现 - 将雷克斯的诅咒放置入场，放到你的威胁区域。
// 卡面：强制 - 在你技能检定将要成功时：将揭示的混乱标记放回混乱袋，并揭示一个新的混乱标记。如果本效果导致你该检定失败，将雷克斯的诅咒混洗入你的牌库。(每次检定仅限一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02009',
  abilities: [
    {
      kind: 'weakness',
      label: '雷克斯的诅咒',
      weakness: { type: 'threat', rexCurse: true },
    },
  ],
  rerollRevealedTokenOnSuccess: true,
  modifiers: [

  ],
}
