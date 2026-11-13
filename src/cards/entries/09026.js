// 09026 强势破门（Breach the Door）· 守卫者事件 · 0 经验。
// 卡面：检定[combat](1)。如果你检定成功，将强势破门附属到你的地点。你检定成功且每超过难度 1 点，
//       在强势破门上放置 1 资源，作为迹象。
//       强势破门上每有 1 迹象，所附属地点的隐藏值降低 1 点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 检定走 api.startTest（combat 1）；成功后 api.attachToLocation 以 scope:'player' 落
//     state.playerLocationAttachments（与隐藏处/陷阱同一存储），迹象数写在附属的 extra 里；
//   · 隐藏值降低走原语 api.setShroudMod(location, -leads)（location.shroudMod 是唯一读点，
//     locationShroud 会把它叠进当前隐藏值）。
export default {
  code: '09026',
  abilities: [
    {
      kind: 'played',
      label: '检定[combat](1)；成功则附属到所在地点，超难度每 1 点放 1 迹象，隐藏值 -1/迹象',
      resolve: ({ state, inv, api }) => {
        api.startTest({
          seat: inv.seat, skill: 'combat', difficulty: 1,
          source: { label: '强势破门', code: '09026' },
          resolve: result => {
            if (!result?.success) {
              api.info('强势破门：检定失败，不附属。')
              return
            }
            const location = state.locations.find(item => item.id === inv.location)
            if (!location) return
            const leads = Math.max(0, (result.value - result.difficulty) || 0)
            api.attachToLocation(location.id, { code: '09026', ownerSeat: inv.seat, extra: { leads } })
            if (leads > 0) api.setShroudMod(location, -leads)
            api.info(`强势破门：附属到「${api.locName(location.id)}」，放置 ${leads} 个迹象（隐藏值 -${leads}）。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
