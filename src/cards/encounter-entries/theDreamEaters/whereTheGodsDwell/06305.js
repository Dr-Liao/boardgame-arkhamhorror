// 06305 被遗忘的高塔 · 原始之光（Forsaken Tower · Of Primeval Light）
// 卡面：你不能使用本地点的 [action] 能力，除非另一张卡牌明确允许你这么做。
//       [action]：选择并揭示你手中的一张奈亚拉托提普，检定[willpower](X)，其中 X 为奈亚拉托提普的印刷生命值。
//       如果你检定成功，将该奈亚拉托提普加入胜利区。
//       如果你检定失败，奈亚拉托提普攻击你，并将其混洗入遭遇牌库。
//
// 本条目只声明检定差异（流程在章节 behavior 统一实现）：
//   testKind: willpower（纯技能检定）、skill: willpower、difficultyKind: health。
export default {
  code: '06305',
  scope: 'location',
  implemented: true,
  locationRule: {
    towerAction: { rule: 'forsakenTower', testKind: 'willpower', skill: 'willpower', difficultyKind: 'health' },
  },
}
