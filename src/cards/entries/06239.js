// 06239 快手
// 卡面：每位调查员仅限 1 张。
//       [reaction] 你连续执行同一种行动两次后，横置快手：再执行一次该种行动
//       （行动种类包括激活、交战、躲避、攻击、调查、移动、打出、资源和抽取）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 连续行动由 trackActionHistory 记录；consecutiveActions 窗口提供共同类型，
// beginImmediateAction 只展示该类型的行动，并在执行后恢复通常行动池。

export default {
  code: '06239',
  limitPerInvestigator: true,
  trackActionHistory: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'consecutiveActions',
      label: '连续执行两次同种行动后横置：立即再执行一次该种行动',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => context?.seat === inv.seat && context.actionKinds?.length > 0],
      resolve: ({ inv, context, api }) => {
        api.beginImmediateAction(inv.seat, { source: '06239', actionKinds: context.actionKinds })
      },
    },
  ],
  modifiers: [],
}
