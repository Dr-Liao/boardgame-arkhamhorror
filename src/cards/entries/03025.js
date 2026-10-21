// 03025 古代雕文
// 卡面：[action]弃掉你手牌中一张含有至少1个[intellect]技能图标的卡牌：从供应堆拿取1资源放到古代雕文上，作为秘密。
// 卡面：强制 - 第三个秘密放到古代雕文上后：弃掉古代雕文并获得5资源。在你的剧本日志上记录下“你翻译出了雕文”。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03025 古代雕文：弃 1 张智识图标手牌，在卡上放 1 个秘密；满 3 个时移出游戏，
// 获得 5 资源并记下「翻译雕文」这项研究（战役账本）。

export default {
  code: '03025',
  abilities: [
    {
      kind: 'action', label: '翻译古代雕文',
      cost: { action: true, discardHand: 1, discardHandIcon: 'intellect' },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        api.addUses(source, 1)
        api.setUsesType(source, 'secrets')
        if ((source.uses || 0) >= 3) {
          api.discardAsset(inv.seat, source)
          api.gainResources(inv.seat, 5)
          api.recordResearch('translatedGlyphs')
        }
      },
    },
  ],
  modifiers: [

  ],
}
