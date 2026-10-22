// 02204 火灾废墟
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：每个在火灾废墟的敌人得到+1躲避值。
// 卡面：[free]如果此处没有线索：抽取火灾废墟底下的遭遇卡牌。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02204', scope: 'location',
  locationRule: { enemyEvadeModifier: 1 },
}
