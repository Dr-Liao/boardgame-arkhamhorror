// 08074 应急装备（Jury-Rig）· 幸存者事件 · 升级 · 0 经验。
//
// 卡面：使用(3 耐久)。附属到你所在地点的一位调查员控制的 [[道具]] 支援上。
//       [free] 被附属支援的技能检定期间，花费 1 耐久：你本次检定得到 +2 技能值。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点（真实打出管线）：
//   · 附属用条目级声明式 `attachTo: { kind:'asset', trait:'item', controllerScope:'location' }`：
//     src/engine/actions.js:299-352 的 attachTo 通道会按条目 uses/usesType 初始化附属实例
//     （:336-341），不再需要 played resolve 里手写 moveCard（真实打出时事件已离手，
//     moveCard from:'hand' 必然失败 → 附属永不发生）。
//   · 第二能力：挂在宿主支援 attachments 上的 free 描述子，ability-rules#descriptorSources
//     为附属来源写入 hostAssetId（:267-278）；「被附属支援的技能检定期间」用引擎同一读点
//     api.playerTools.testAssetSource()（state.skillTest.assetSourceId ?? state._resolvingAssetId，
//     宿主能力发起检定期间它就是宿主 id）与宿主比对。
//   · 费用 uses:1 由统一费用管线支付；耐久耗尽后在 resolve 里用 api.moveCard(from:'attached')
//     把这张附属卡移入弃牌堆（附属卡不在 inv.assets，通用 discardWhenEmpty 读点只覆盖场上支援）。
export default {
  code: '08074',
  uses: 3,
  usesType: 'durability',
  attachTo: { kind: 'asset', trait: 'item', controllerScope: 'location' },
  abilities: [
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      cost: { uses: 1 },
      label: '被附属支援的技能检定期间：花 1 耐久，本次检定 +2 技能值',
      criteria: [({ state, source }) => {
        const hostId = source?.hostAssetId
        if (!hostId || !state.skillTest) return false
        return state.skillTest.source?.assetId === hostId || state._resolvingAssetId === hostId
      }],
      resolve: ({ inv, source, api }) => {
        // 公开读点：宿主技能检定来源（与 criteria 同源，便于日志/诊断；实际加值走 pending bonus）。
        const assetSource = api.playerTools.testAssetSource()
        if (assetSource != null && assetSource !== source?.hostAssetId) return
        api.addPendingTestBonus(2)
        api.info(`🧰 「应急装备」：${inv.name} 本次技能检定 +2 技能值。`)
        // 用尽 3 耐久后弃置自身（引擎 moveCard 支持从宿主附属区移入弃牌堆；附属卡不在 inv.assets，
        // 通用的 discardWhenEmpty 读点只覆盖场上支援，因此这一句在条目里结算）。
        if ((source?.uses || 0) <= 0) {
          api.moveCard({ code: '08074', from: 'attached', to: 'discard', ownerSeat: inv.seat })
          api.info('「应急装备」耐久耗尽，被弃掉。')
        }
      },
    },
  ],
  modifiers: [],
}
