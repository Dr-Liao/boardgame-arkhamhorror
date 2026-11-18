// 10548 小西尔维 / Little Sylvie · 剧情资产（story asset）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；Day 1 白天放在最底层的卧室。
// 卡面：[reaction] 本卡从手牌或牌堆被弃掉时：打出它（支付费用）。[reaction] 剧本卡效果要弃掉你
// 手牌或牌堆的卡时：横置本卡；把那张卡放到你的牌堆顶。
// 读点：behavior.placeResidents / resolution（Resolution 2「找到小西尔维」的奖励）。

export default {
  "code": "10548",
  "scope": "storyAsset",
  "implemented": true,
  "flags": {
    "littleSylvie": true,
    "controlledBy": "investigator",
    "playWhenDiscarded": true,
    "exhaustToSaveDiscard": true,
    "foundByRecord": "foundLittleSylvie"
  },
  "note": "approximation: P7 数据型条目——两张 [reaction] 的逐次交互（弃牌时打出、横置救回弃牌）由引擎弃牌窗口/能力层覆盖，本关 behavior 只负责放置与「找到小西尔维」的奖励记录。"
}
