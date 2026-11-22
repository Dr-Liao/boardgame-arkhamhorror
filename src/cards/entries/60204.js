// 60204 过分痴迷
// 卡面：显现 - 将过分痴迷放置入你的威胁区域。
// 卡面：强制 - 你的回合开始时：随机弃掉手牌中的一张非弱点卡牌。
// 卡面：[action][action]：弃掉过分痴迷。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60204',
  abilities: [{
    kind: 'weakness',
    label: '显现：放入威胁区，可花费 2 行动弃置',
    weakness: { type: 'threat', discardCost: { action: 2 } },
  }, {
    kind: 'forced',
    trigger: 'turnBegins',
    label: '回合开始：随机弃掉 1 张非弱点手牌',
    limit: { scope: 'perTurn', owner: 'instance' },
    criteria: ({ inv, context }) => inv.seat === context.seat,
    resolve: ({ inv, api }) => api.discardRandomFromHand(inv.seat, 1, { nonWeakness: true }),
  }],
}
