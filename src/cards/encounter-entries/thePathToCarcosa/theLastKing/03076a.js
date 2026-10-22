// 03076a 康斯坦丝·杜梅因
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[action]：谈判。检定[intellect](3)以询问康斯坦丝有关戏剧的事情。如果你检定成功，控制康斯坦丝·杜梅因上的1个线索。
// 卡面：强制 - 在移除康斯坦丝·杜梅因上最后一个线索时：将本卡牌翻面并结算其文本。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 85 轮：最后之王的五名贵宾（storyAsset）。

export default {
  code: '03076a', scope: 'storyAsset',
  assetRule: { parley: { skill: 'intellect', difficulty: 3, label: '与康斯坦丝谈判（智识3）' } },
}
