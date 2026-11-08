// 08113 大肆借贷（Unscrupulous Loan）
// 卡面：每位调查员仅限 1 张。不能离场。
//        [reaction] 在你打出大肆借贷后：获得 10 资源。
//        强制 - 在游戏结束或你退场时，如果你资源池中的资源数量小于 10：放逐大肆借贷。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：入场窗口 assetEnteredPlay、不能离场 cannotLeavePlay、赚资源 api.gainResources、
//       移出游戏 api.playerTools.removeAssetFromGame（流放近似：进入 removedFromGame 而非战役 exiled）。
// approximation: 引擎没有「游戏结束/退场时」的通用条目强制窗口。这里近似为每轮结束时检查
//   「资源池 < 10 → 移出游戏」，其余主行为（不能离场、打出获得 10 资源）完整实现。
const code = '08113'

export default {
  code,
  cannotLeavePlay: true,
  note: 'approximation: 印刷触发为「游戏结束或你退场时」；引擎无该窗口，近似为每轮结束时检查资源 < 10 → 流放自身。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetEnteredPlay',
      label: '打出后：获得 10 资源',
      criteria: [({ source, context }) => context?.assetCode === code && context?.assetId === source?.id
        && !context?.unscrupulousLoanGained],
      resolve: ({ inv, context, api }) => {
        if (context) context.unscrupulousLoanGained = true
        api.gainResources(inv.seat, 10)
        api.info(`💰 「大肆借贷」：${inv.name} 获得 10 资源。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'roundEnds',
      label: '近似-轮末：资源池 < 10 时流放自身',
      criteria: [({ inv }) => (inv?.resources || 0) < 10],
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const removed = api.playerTools.removeAssetFromGame(inv.seat, source.id)
        api.info(removed
          ? `🪦 「大肆借贷」：${inv.name} 的资源少于 10，该卡被流放。`
          : '🪦 「大肆借贷」：资源不足，但该卡无法离场。')
      },
    },
  ],
  modifiers: [],
}
