// 10033 清理工具套装（Cleaning Kit）· 守护者支援 · 3 经验 · 3 资源 · 饰品 · 道具/工具
// 卡面：使用（4 补给）。
//       清理工具套装上的补给可以花费，如同是你控制的支援上的补给或子弹。
//       [reaction]在花费清理工具套装的补给时，将其横置：执行检定的调查员本次检定得到技能值 +2。
//
// 读点（卡面 → 引擎）：
//   · 「使用（4 补给）」= 条目级 uses/usesType（newPlayerAssetInstance 初始化实例 uses）。
//   · 「如同支援上的补给或子弹」= assetRule.shareSuppliesAs: ['supply','ammo']：
//     读点 src/engine/use-transfer.js#useCostSources —— 目标是补给/弹药支援时，把本支援算作代付来源；
//     payUseCost 真的从本支援扣次数后回调 afterSuppliesSubstituted。
//   · 「花费清理工具套装的补给时」= reaction + trigger sharedSuppliesSpent（uses.js 的唯一派发点，
//     context = { asset: 代付来源实例, target, amount, location }）。
//   · 「本次检定 +2」= 检定已经开始时 api.addTestPendingBonus(2)（写 state.skillTest.pendingBonus，
//     ST.3 并入；04156/07158 同口径）；由于费用在能力结算前支付，正常路径上窗口打开时还没有
//     state.skillTest，此时用 api.playerTools.addNextTestBonus(seat, 2)（写 inv.testBonus，
//     tests.js#performTest 在检定开始时读取并清零，08053/08058 同读点）——对紧接着的那次检定生效。
//     费用横置走描述子 cost.exhaust（与支援能力同一套付费/窗口）。
const CODE = '10033'

export default {
  code: CODE,
  name: 'Cleaning Kit',
  uses: 4,
  usesType: 'supplies',
  assetRule: { shareSuppliesAs: ['ammo', 'supply'] },
  simplified: true,
  note: 'approximation: 补给在费用阶段被花掉时检定尚未开始（窗口里没有 state.skillTest），此时 +2 写 inv.testBonus（下一次检定），而不是 state.skillTest.pendingBonus。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'sharedSuppliesSpent',
      label: '花费清理工具套装的补给时，横置：本次检定 +2 技能值',
      cost: { exhaust: true },
      criteria: [({ source, context }) => Boolean(source)
        && Boolean(context?.asset?.id)
        && context.asset.id === source.id],
      resolve: ({ state, inv, api }) => {
        if (state.skillTest) api.addTestPendingBonus(2)
        else api.playerTools.addNextTestBonus(inv.seat, 2)
        api.info(`🧰 清理工具套装：${inv.name} 本次检定 +2 技能值。`)
      },
    },
  ],
  modifiers: [],
}
