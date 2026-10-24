// 05323 诱敌深入
// 卡面：附属到你所在地点或一个连接地点。
// 卡面：敌军阶段期间，所有要移动的敌人不照常移动，而是改为沿着最短路径，朝附属地点移动。
// 卡面：强制 - 附属在地点时，当一轮结束时：弃掉诱敌深入。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05323 诱敌深入：打出时在「所在地点 / 连接地点」里选一个，走 api.setLocationLure 写地点诱饵标记；
// 猎手移动读点见 src/engine/turn.js 的 hunterStep（朝诱饵最短路径移动），
// 回合结束弃置由 turn.js 的 runLocationRoundEnd 统一处理。

export default {
  code: '05323',
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
        if (!api.setLocationLure(locationId, inv.seat, '05323')) return
        api.info(`「诱敌深入」附属到「${api.locationName(locationId)}」：本轮敌人向这里移动。`)
      },
    },
  ],
  modifiers: [

  ],
}
