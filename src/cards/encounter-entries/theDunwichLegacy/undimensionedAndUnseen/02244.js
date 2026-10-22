// 02244 冷泉幽谷
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：冷泉幽谷的每个敌人得到-1躲避。
// 卡面：[free]：你将怪物引入浓密的树丛，将它缠住。冷泉幽谷的调查员可以共同将最多2个他们的线索放在冷泉幽谷的一个[[异形]]敌人上。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02244', scope: 'location',
  locationRule: { enemyEvadeModifier: -1 },
}
