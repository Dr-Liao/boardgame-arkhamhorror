// 02245 冷泉幽谷
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：冷泉幽谷的每个敌人得到-1躲避。
// 卡面：[reaction] 在冷泉幽谷被选为随机地点后：一位冷泉幽谷的调查员检定[agility](3)。如果检定成功，选择另一个随机地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02245', scope: 'location',
  locationRule: { enemyEvadeModifier: -1 },
}
