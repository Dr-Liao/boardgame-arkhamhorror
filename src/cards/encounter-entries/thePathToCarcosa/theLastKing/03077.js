// 03077 乔丹·佩里
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[action]如果你拥有10点或更多资源：谈判。检定[intellect](2)以与乔丹·佩里深入交流。如果你检定成功，控制乔丹·佩里上的1个线索。
// 卡面：强制 - 在移除乔丹·佩里上最后一个线索时：将本卡牌翻面并结算其文本。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03077', scope: 'storyAsset',
  assetRule: {
    parley: {
      skill: 'intellect', difficulty: 2, label: '与乔丹谈判（需10资源，智识2）',
      shortfall(state, inv) { return inv.resources < 10 ? `需要 10 个资源（当前 ${inv.resources}）` : null },
    },
  },
}
