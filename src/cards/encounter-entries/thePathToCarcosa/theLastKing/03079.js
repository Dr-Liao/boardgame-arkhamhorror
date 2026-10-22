// 03079 塞巴斯蒂安·莫罗
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[action]：谈判。检定[willpower](3)以询问塞巴斯蒂安有关戏剧的编排情况。如果你检定成功，控制塞巴斯蒂安·莫罗上的1个线索。
// 卡面：强制 - 在移除塞巴斯蒂安·莫罗上最后一个线索时：将本卡牌翻面并结算其文本。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03079', scope: 'storyAsset',
  assetRule: { parley: { skill: 'willpower', difficulty: 3, label: '与塞巴斯蒂安谈判（意志3）' } },
}
