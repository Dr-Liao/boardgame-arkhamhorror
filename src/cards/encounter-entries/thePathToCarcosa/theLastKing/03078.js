// 03078 石丸春子
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[action]如果你有至少6张手牌：谈判。检定[willpower](2)以询问春子有关戏剧的事情。如果你检定成功，控制石丸春子上的1个线索。
// 卡面：强制 - 在移除石丸春子上最后一个线索时：将本卡牌翻面并结算其文本。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03078', scope: 'storyAsset',
  assetRule: {
    parley: {
      skill: 'willpower', difficulty: 2, label: '与春子谈判（需6张手牌，意志2）',
      shortfall(state, inv) { return inv.hand.length < 6 ? `需要 6 张手牌（当前 ${inv.hand.length}）` : null },
    },
  },
}
