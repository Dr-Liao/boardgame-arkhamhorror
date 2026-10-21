// 03271 新晋术士
// 卡面：强制 - 在新晋术士入场后：在上面放置1个毁灭标记或2点恐惧。
// 卡面：[free]横置新晋术士：查找你牌库顶3张卡牌，找出一张[[法术]]卡牌并将其抽取。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03271 奥术学徒（卡可萨）：入场时选择放 1 毁灭或受 2 恐惧；横置检索法术。

export default {
  code: '03271',
  abilities: [
    {
      kind: 'reaction', trigger: 'assetEnteredPlay', label: '入场：放 1 毁灭或受 2 恐惧',
      criteria: [ctx => ctx.context?.assetCode === '03271'],
      resolve: ({ inv, context, api }) => {
        const entered = inv.assets.find(item => item.id === context?.assetId)
          || inv.assets.find(item => item.code === '03271')
        if (!entered) return
        const answer = api.choice({ kind: 'effect', source: '03271', seat: inv.seat,
          prompt: '选择放置1毁灭或2恐惧。',
          options: [{ id: 'doom', label: '放置1毁灭' }, { id: 'horror', label: '放置2恐惧' }] })
        if (answer === 'doom') api.placeDoomOnCard(entered, 1)
        else api.addAssetHorror(entered, 2)
      },
    },
    {
      kind: 'free', label: '搜索法术牌', cost: { action: false, exhaust: true },
      resolve: ({ inv, api }) => api.searchTop(inv.seat, { amount: 3, trait: 'Spell', choose: 1 }),
    },
  ],
  modifiers: [

  ],
}
