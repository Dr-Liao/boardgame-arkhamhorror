// 08006 预示者（The Harbinger）· 诺曼专属弱点（诡计型弱点）。
//
// 卡面：
//   显现 - 将本卡牌置于你牌库顶。
//   你的牌库顶揭示了预示者时，除下方能力外，你牌库里的卡牌不能被查找、抽取，或以任何方式操纵。
//   [action][action]：弃掉预示者。预示者在你牌库顶时可以激活本能力，如同其在你的威胁区。
//
// 引擎读点（eote-investigator-support.js + 共享接线）：
//   · flags.weaknessStaysOnDeckTop：弱点揭示结算后放回牌库顶、不进入弃牌堆（deck-ops 弱点分支）；
//   · flags.locksDeckWhileRevealed：牌库顶揭示该卡期间封锁抽牌/查找/洗牌（blockedByDeckTopLock）；
//   · flags.activatableWhileOnDeckTop：moves.js 在牌库顶揭示该卡时枚举
//     `deckTopWeaknessDiscard`（2 行动），dispatch 调 discardRevealedDeckTopWeakness 执行。
//   因此本条目只声明弱点形态与三个 flag；[action][action] 弃牌由引擎的牌库顶动作通道提供，
//   不再写第二份描述子（避免同一句规则两处实现）。
export default {
  code: '08006',
  flags: {
    weaknessStaysOnDeckTop: true,
    locksDeckWhileRevealed: true,
    activatableWhileOnDeckTop: true,
  },
  abilities: [
    {
      kind: 'weakness',
      label: '显现：置于牌库顶（牌库顶揭示期间封锁牌库操纵）',
      weakness: { type: 'threat' },
      resolve: () => {
        // 去向由引擎按 flags.weaknessStaysOnDeckTop 统一处理；弱点结算时卡不在任何区域，
        // 内容层不能可靠地自行 moveCard。
      },
    },
  ],
}
