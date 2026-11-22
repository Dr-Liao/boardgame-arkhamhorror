// 60558 旧指南针 · 支援（手槽，2 费，智识图标）
// 卡面：[action]：调查([intellect])。本次调查你所在地点得到隐藏值 -1。
//       如果你检定失败，你可以横置旧指南针以再次尝试该技能检定。
const CODE = '60558'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      actionKind: 'investigate',
      label: '调查（智识）：本次调查隐藏值 -1',
      cost: { action: true },
      resolve: ({ inv, api }) => api.investigate(inv.seat, { shroudMod: -1 }),
    },
    {
      kind: 'reaction',
      trigger: 'investigateFail',
      label: '横置旧指南针：再次尝试该调查检定',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => !context?.seat || context.seat === inv.seat],
      resolve: ({ inv, api }) => {
        api.retryTest(inv.seat)
        api.info(`旧指南针：${inv.name} 再次尝试该调查检定。`)
      },
    },
  ],
  modifiers: [],
}
