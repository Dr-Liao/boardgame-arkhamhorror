// 09019「邦妮·沃尔什」（Bonnie Walsh）· 支援 · 查理专属签名
// 卡面：查理·凯恩牌库专用。
//   [reaction] 在你横置邦妮·沃尔什后：重整你控制的另一个 [[盟友]] 支援。（每轮一次）
//
// 读点（卡面 → 引擎读点）：
//   · `assetExhausted` 窗口在 windows.js 注册（'支援被横置后'）。当前引擎只有一条派发点：
//     ability-exec.js:138（旧 DSL 支援能力的 cost.exhaust 支付后）。邦妮自身没有可支付横置费用的
//     能力，她通常被 09018 的 [fast] 等 `api.exhaust(target)` 横置，而 api.exhaust
//     （src/engine/api-misc.js:528）只写实例 exhausted、不派发窗口；描述子的 cost.exhaust
//     （ability-rules.js:113）同样不派发。因此本反应目前不可达——需要主进程在
//     api.exhaust 与 payAbilityCost 的 cost.exhaust 分支补 `assetExhausted` 派发
//     （上下文需带 assetId/assetCode/seat/location），已列在汇报中。
//   · 反应 target/触发判定只读窗口上下文：assetCode 必须是 09019，且（引擎给出 assetId/seat 时）
//     该实例属于本调查员、动作者是本调查员；不写任何状态。
//   · 重整「另一个你控制的盟友」：api.ready（只枚举本人支援、排除邦妮自己）。
//   · 每轮一次：limit 'oncePerRound'（limits.js）。
export default {
  code: '09019',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetExhausted',
      limit: 'oncePerRound',
      label: '横置邦妮后：重整另一个你控制的盟友支援（每轮一次）',
      criteria: [({ inv, context }) => {
        if (context?.assetCode !== '09019') return false
        // 引擎目前不保证上下文带座位；带了就校验「横置的是本人控制的邦妮」。
        if (context?.seat != null && context.seat !== inv.seat) return false
        if (context?.assetId != null) return (inv.assets || []).some(asset => asset.id === context.assetId)
        return true
      }],
      resolve: ({ inv, api }) => {
        const allies = (inv.assets || []).filter(asset => asset.code !== '09019' && asset.exhausted
          && (api.cardTraits(asset.code) || []).some(trait => String(trait).toLowerCase() === 'ally'))
        if (!allies.length) return
        const target = allies.length === 1 ? allies[0] : allies[Number(api.choice({
          kind: 'target', source: '09019', seat: inv.seat, prompt: '选择要重整的盟友支援。',
          options: allies.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (target) api.ready(target)
      },
    },
  ],
  modifiers: [],
}
