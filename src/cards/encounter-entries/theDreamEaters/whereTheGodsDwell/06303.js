// 06303 被遗忘的高塔 · 永恒的烈火（Forsaken Tower · Of Eternal Flame）
// 卡面：你不能使用本地点的 [action] 能力，除非另一张卡牌明确允许你这么做。
//       [action]：攻击。选择并揭示你手中的一张奈亚拉托提普，对其进行攻击，如同其位于你所在地点。
//       如果你检定成功，将该奈亚拉托提普加入胜利区。
//       如果你检定失败，奈亚拉托提普攻击你，并将其混洗入遭遇牌库。
//
// 本条目只声明检定差异（流程在章节 behavior 统一实现）：
//   testKind: fight、skill: combat（默认攻击技能）、difficultyKind: fight。
export default {
  code: '06303',
  scope: 'location',
  implemented: true,
  locationRule: {
    towerAction: { rule: 'forsakenTower', testKind: 'fight', skill: 'combat', difficultyKind: 'fight' },
  },
}
