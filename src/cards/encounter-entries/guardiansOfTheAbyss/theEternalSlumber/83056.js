// 83056 古老圣甲虫护符（Ancient Ankh）
// 归属：关卡专用 · guardiansOfTheAbyss/theEternalSlumber（永恒沉睡）· 遭遇组 abyssal_tribute
// 卡面：使用(4 充能)。
//       [reaction] 你所在地点的一位调查员将要以低于难度超过 1 点失败时，花费 1 充能：
//       改为该调查员以低于难度 1 点失败（即使其自动失败）。
//
// 读点：windows.js 的 failedTestMargin 反应窗口 + api.adjustFailedTestMargin（60508 同一引擎读点）；
//   充能由 uses/usesType + cost.uses 走能力费用入口（assetEntry 的 uses 读点）。
export default {
  code: '83056',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'failedTestMargin',
      label: '花 1 充能：同地点调查员的失败差值改为 1（即使自动失败）',
      cost: { uses: 1 },
      criteria: ({ inv, context }) => Boolean(context && context.location === inv.location
        && Number(context.failedBy) > 1),
      resolve: ({ api, context }) => {
        const failedBy = Number(context?.failedBy) || 2
        api.adjustFailedTestMargin(context, -(failedBy - 1))
        api.info(`古老圣甲虫护符：失败差值由 ${failedBy} 改为 1。`)
      },
    },
  ],
  modifiers: [],
}
