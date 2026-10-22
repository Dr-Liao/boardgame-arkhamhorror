// 02205 火灾废墟
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：强制 - 在你调查火灾废墟时技能检定失败后：将火灾废墟的1个线索标记翻至毁灭标记面。
// 卡面：[free]如果此处没有线索：抽取火灾废墟底下的遭遇卡牌。(团队每场游戏仅限一次)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02205', scope: 'location',
  locationRule: {
    onInvestigateFail(state, inv, loc) {
      if ((loc.clues || 0) <= 0) return
      loc.clues--
      loc.doom = (loc.doom || 0) + 1
    },
  },
}
