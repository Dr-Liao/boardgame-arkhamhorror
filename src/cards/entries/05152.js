// 05152 妥善养护
// 卡面：快速。只能在你回合期间打出。
// 卡面：附属到你控制的一张[[道具]]支援。每个支援仅限1张。
// 卡面：[reaction]所附属支援被弃掉后：将该支援返回其所有者手牌，
// 附属到该支援的其他所有[[升级]]附属也返回各自所有者的手牌。
//
// 反应读点：引擎 assets.js 的 assetLeavesPlay 窗口 + api.returnAssetAndAttachmentsToHand
// （标记 returnedToHand，引擎各弃牌守卫已尊重该标记，不会重复进弃牌堆）。

export default {
  code: '05152',
  fast: true,
  attachTo: { kind: 'asset', trait: 'item', maxPerTarget: 1 },
  playCondition: [{ when: ({ state, inv }) => state.currentSeat === inv.seat, message: '只能在你自己的回合打出' }],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetLeavesPlay',
      label: '宿主被弃/放回后：把该支援与其[[升级]]附属返回手牌',
      criteria: ctx => {
        const context = ctx.context || {}
        // 只在宿主属于本卡控制者时触发，且宿主身上确实挂着这张「妥善养护」。
        if (context.seat !== ctx.inv?.seat) return false
        const upgrades = context.asset?.attachments || []
        return upgrades.some(entry => entry.code === '05152')
      },
      resolve: ({ context, inv, api }) => {
        api.returnAssetAndAttachmentsToHand(inv.seat, context.asset)
      },
    },
  ],
  modifiers: [],
}
