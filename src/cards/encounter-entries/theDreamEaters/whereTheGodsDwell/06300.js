// 06300 被遗忘的高塔 · 神话与幻象（Forsaken Tower · Of Illusion and Myth）
// 卡面：你不能使用本地点的 [action] 能力，除非另一张卡牌明确允许你这么做。
//       [action]：调查。选择并揭示你手中的一张奈亚拉托提普。本次调查中，本地点的隐藏值等于
//       奈亚拉托提普的印刷生命值。如果你检定成功，将该奈亚拉托提普加入胜利区。
//       如果你检定失败，奈亚拉托提普攻击你，并将其混洗入遭遇牌库。
//
// 6 座塔的 [action] 是同一套流程（章节 behavior 统一实现一次），本条目只声明本塔的检定差异：
//   testKind: investigate / fight / evade / willpower（检定类别）
//   skill:    实际使用的技能
//   difficultyKind: health / fight / evade（难度取所选复制品的印刷值）
// 塔的罗盘方向由 act 3 背面摆位时写入 scenarioFlags.towerCompass，与「混沌低语」的
// flags.whisperingChaos 匹配后才能使用本能力。
export default {
  code: '06300',
  scope: 'location',
  implemented: true,
  locationRule: {
    towerAction: { rule: 'forsakenTower', testKind: 'investigate', skill: 'intellect', difficultyKind: 'health' },
  },
}
