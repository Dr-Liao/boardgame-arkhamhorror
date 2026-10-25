// 05323 诱敌深入
// 卡面：附属到你所在地点或一个连接地点。
// 卡面：敌军阶段期间，所有要移动的敌人不照常移动，而是改为沿着最短路径，朝附属地点移动。
// 卡面：强制 - 附属在地点时，当一轮结束时：弃掉诱敌深入。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 第七轮：改走真实地点附属（state.playerLocationAttachments）——
//   api.attachToLocation(locationId, { code:'05323', ownerSeat, extra:{ round } })；
//   条目字段 locationLure / discardAtRoundEnd 由引擎读点消费：
//   · turn.js hunterStep：对声明 locationLure 的真实地点附属按最短路径拉近（多诱饵取最近）；
//   · turn.js runLocationRoundEnd：声明 discardAtRoundEnd 的附属轮末把 code 推入 ownerSeat 弃牌堆并移除（恰好 1 次）。
//   keepOnPlay 防止事件结算时默认进弃牌堆，与轮末弃置配合只产生 1 张物理卡。
//
// 残余近似（如实登记）：「敌军阶段期间所有要移动的敌人」目前引擎只有 hunterStep 读诱饵；
// 剧本/效果发起的敌人移动（非猎手步）不读诱饵，仍按原目的地移动。

export default {
  code: '05323',
  keepOnPlay: true,
  locationLure: true,
  discardAtRoundEnd: true,
  abilities: [
    {
      kind: 'played',
      label: '附属到地点：敌人朝这里移动',
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const connected = (here?.connections || [])
          .map(id => state.locations.find(location => location.id === id))
          .filter(Boolean)
        const options = [{ id: inv.location, label: `${api.locationName(inv.location)}（你所在地点）` },
          ...connected.map(location => ({ id: location.id, label: api.locationName(location.id) }))]
        const locationId = options.length === 1 ? inv.location : api.choice({ kind: 'target', source: '05323', seat: inv.seat,
          prompt: '选择「诱敌深入」附属的地点（所在地点或连接地点）。', options })
        const attached = api.attachToLocation(locationId, {
          code: '05323', ownerSeat: inv.seat, extra: { round: state.round },
        })
        if (!attached) return
        api.info(`「诱敌深入」附属到「${api.locationName(locationId)}」：本轮敌人向这里移动。`)
      },
    },
  ],
  modifiers: [

  ],
}
