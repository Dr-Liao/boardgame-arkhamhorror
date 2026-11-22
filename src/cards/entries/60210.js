// 60210 禁忌之书
// 卡面：使用(5秘密)。
// 卡面：[action]横置禁忌之书并花费1秘密：抽取1张卡牌。然后，如果你有至少10张手牌，且禁忌之书上没有秘密，你可以弃掉它，并在冒险日志记录"你翻译了这本书。"
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60210',
  uses: 5,
  usesType: 'secrets',
  abilities: [{
    kind: 'action', cost: { action: true, exhaust: true, uses: 1 },
    label: '抽 1 张牌；手牌至少 10 张且没有秘密时，可以弃掉本牌记录翻译完成',
    resolve: ({ inv, source, api }) => {
      api.drawCards(inv.seat, 1)
      if (inv.hand.length < 10 || source.uses > 0 || !inv.assets.includes(source)) return
      const answer = api.choice({
        kind: 'reaction', source: '60210', seat: inv.seat, canSkip: true,
        prompt: '是否弃掉禁忌典籍并记录已完成翻译？',
        options: [{ id: 'research', label: '弃掉并记录' }, { id: 'skip', label: '保留' }],
      })
      if (answer === 'research' && api.discardAsset(inv.seat, source)) api.recordResearch('translatedForbiddenTome')
    },
  }],
}
