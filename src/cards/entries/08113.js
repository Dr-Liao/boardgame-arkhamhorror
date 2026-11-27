// 08113 大肆借贷（Unscrupulous Loan）
// 卡面：每位调查员仅限 1 张。不能离场。
//        [reaction] 在你打出大肆借贷后：获得 10 资源。
//        强制 - 在游戏结束或你退场时，如果你资源池中的资源数量小于 10：放逐大肆借贷。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 打出后开放资源反应，结束游戏或退场时按资源池记录战役放逐。
const code = '08113'

export default {
  code,
  cannotLeavePlay: true,
  limitPerInvestigator: true,
  assetRule: { exiledOnExitBelowResources: 10 },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetPlayed',
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '打出后：获得 10 资源',
      criteria: [({ inv, source, context, helpers }) => context?.seat === inv.seat
        && context.cardCode === code && context.assetId === source?.id && helpers.canGainResources()],
      resolve: ({ inv, api }) => {
        api.gainResources(inv.seat, 10)
        api.info(`💰 「大肆借贷」：${inv.name} 获得 10 资源。`)
      },
    },
  ],
  modifiers: [],
}
