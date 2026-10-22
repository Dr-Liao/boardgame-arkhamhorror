// 02249 憎恶荒野
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：强制 - 当你的回合结束时，如果你在憎恶荒野：受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02249', scope: 'location',
  locationRule: { turnEndDamage: 1 },
}
