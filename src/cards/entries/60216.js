// 60216 广泛研究
// 卡面：你手牌中每有1张其它卡牌，广泛研究的打出费用减少1点。
// 卡面：发现你所在地点的2个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60216',
  playCostModifier: ({ inv }) => -Math.max(0, inv.hand.length - Number(inv.hand.includes('60216'))),
  abilities: [{
    kind: 'played', label: '所在地点发现 2 个线索',
    effect: { type: 'discoverClue', amount: 2 },
  }],
}
