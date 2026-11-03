// 06115 势不可挡
// 卡面：如果本次技能检定成功，你在本阶段执行的下一次技能检定难度降低X，
//       其中X为本次技能检定超过难度的点数(最多为3)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：1 个万能图标由卡面数据通道生效（commitIcons 读 cards-data 的 icons）。
// 成功后按超出点数（至多 3）为投入者登记本阶段下一次检定的难度减免。

export default {
  code: '06115',
  abilities: [
    {
      kind: 'commit',
      label: '势不可挡',
      skill: {
        afterTest: ({ inv, result, api }) => {
          if (!result?.success) return
          const reduction = Math.min(3, Math.max(0, result.value - result.difficulty))
          if (reduction) api.reduceNextTestDifficulty(inv.seat, reduction)
        },
      },
    },
  ],
  modifiers: [],
}
