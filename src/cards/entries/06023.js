// 06023 骇人真相
// 卡面：多重。不能打出骇人真相。
//       [reaction]在你查找你的牌库时，若查找过的卡牌中有骇人真相，将其弃掉：
//       获得2资源，或在你控制的一个支援上放置1秘密。(每次查找最多使用1次[[研究]]能力。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06023 骇人真相（显式简化）：
//   · 「查找牌库时被发现 → 弃掉」走 P6 原语 searchedCardRule（读点 deck-ops.js），mode reaction = 先询问。
//   · 「不能打出」用 playCondition 恒假表示。
//   · 显式简化：searchedCardRule 只有固定数据字段，无法表达「获得 2 资源 / 在支援上放 1 秘密」
//     的二选一奖励（需要 rule.resolve 回调，见 primitive-requests/w-m2-1-06023-*）。

export default {
  code: '06023',
  simplified: true,
  note: '未实现：被查找到时的二选一奖励（获得 2 资源／在支援上放 1 秘密）——searchedCardRule 无 resolve 通道；'
    + '已实现「查找中被发现 → 弃掉」与「不能打出」。',
  playCondition: [
    { when: () => false, message: '「骇人真相」不能打出' },
  ],
  searchedCardRule: {
    mode: 'reaction',
    label: '骇人真相：弃掉它（奖励未实现）',
    prompt: '查找的牌中有「骇人真相」：弃掉它？（奖励效果未实现）',
    discard: true,
  },
  modifiers: [],
}
