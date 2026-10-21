// 03312 远古印记封印
// 卡面：本次检定不要从混乱袋中揭示混乱标记。本次检定揭示的混乱标记视为[elder_sign]。
// 卡面：在本次检定结束时，将远古印记封印从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03312',
  abilities: [
    {
      kind: 'commit',
      label: '远古印记封印',
      skill: { elderSignInsteadOfChaos: true, exileAfterTest: true },
    },
  ],
  modifiers: [

  ],
}
