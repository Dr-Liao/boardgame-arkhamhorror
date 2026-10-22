// 03182a 丹尼尔·契斯特菲尔德
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[free]横置丹尼尔·契斯特菲尔德：将他的控制权给予你所在地的另一位调查员。
// 卡面：强制 - 在你受到恐惧时，如果这些恐惧中至少有1点没有分配给丹尼尔·契斯特菲尔德：受到1点伤害。
// 卡面：强制 - 如果丹尼尔·契斯特菲尔德离场：将他从游戏中移除。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 89 轮：邪秽誓约的丹尼尔（先生）与附身形态。

export default {
  code: '03182a', scope: 'storyAsset',
  assetRule: { daniel: true },
  // 卡面两条强制：恐惧未全部分配给他 → 受到 1 点伤害；离场 → 从游戏中移除。
  horrorOverflowDamage: 1,
  removeFromGameOnLeave: true,
}
