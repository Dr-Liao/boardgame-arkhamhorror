// 60320 酒胆
// 卡面：使用(4补给)。
// 卡面：[action]花费1补给：选择你所在地点的一位调查员，治愈1点恐惧。然后，该调查员进行一次[willpower](2)检定。如果检定成功，该调查员抽取1张卡牌。如果检定失败，该调查员额外治愈1点恐惧，并随机弃掉其手牌中的一张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60320',
  uses: 4,
  usesType: 'supplies',
  abilities: [{
    kind: 'action', cost: { action: true, uses: 1 },
    label: '花费 1 补给：同地点调查员治愈 1 恐惧并检定意志 (2)',
    target: { kind: 'investigator' },
    resolve: ({ api, target }) => {
      const seat = target?.entity?.seat
      if (seat == null) return
      api.healHorror(seat, 1)
      api.test(seat, 'willpower', 2, {
        source: { code: '60320', label: '液体勇气' },
        resolve: result => {
          if (result.success) api.drawCards(seat, 1)
          else {
            api.healHorror(seat, 1)
            api.discardRandomFromHand(seat, 1)
          }
        },
      })
    },
  }],
}
