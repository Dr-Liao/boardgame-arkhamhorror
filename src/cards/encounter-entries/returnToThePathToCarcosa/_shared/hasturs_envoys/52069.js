// 52069 猎食的拜亚基（重返真相幻影 / 重返卡城幽影共用）
// 归属：战役共用 · returnToThePathToCarcosa（重返卡尔克萨之路）
// 遭遇组：hasturs_envoys
// 卡面：猎物 - 仅限剩余神智最低。猎手。
//       与剩余神智 4 或以下的调查员交战时，交换攻击值与躲避值。
//
// 行为读点：enemyRule.lowSanitySwap（战役层 campaign-rules.lowSanitySwapModifier，
// 由 returnToAPhantomOfTruth / returnToDimCarcosa 的 behavior.enemyStatModifier 调用）。
export default {
  code: '52069',
  name: '猎食的拜亚基',
  scope: 'enemy',
  enemyRule: { prey: 'lowestRemainingSanity', lowSanitySwap: { threshold: 4 } },
}
