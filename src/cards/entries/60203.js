// 60203 三重诅咒的好奇心
// 卡面：显现 - 你手牌中每有3张卡牌：受到1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60203',
  abilities: [{
    kind: 'weakness',
    label: '显现：每 3 张手牌受到 1 点伤害',
    weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      const damage = Math.floor(inv.hand.length / 3)
      if (damage > 0) api.harm(inv.seat, { damage })
    },
  }],
}
