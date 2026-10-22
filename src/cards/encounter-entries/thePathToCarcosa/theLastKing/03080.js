// 03080 阿什莉·克拉克
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[action][action]：谈判。你倾听阿什莉的演唱。控制阿什莉·克拉克上的1个线索。
// 卡面：强制 - 在移除阿什莉·克拉克上最后一个线索时：将本卡牌翻面并结算其文本。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03080', scope: 'storyAsset',
  assetRule: { parley: { label: '聆听阿什莉演唱，取得1个线索', actions: 2, autoSuccess: true } },
}
