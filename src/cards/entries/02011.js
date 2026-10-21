// 02011 寻找伊莎贝拉
// 卡面：显现 - 将寻找伊莎贝拉附属到离你最远的地点。
// 卡面：[action][action]：调查。如果你检定成功，不发现线索，改为弃掉寻找伊莎贝拉。
// 卡面：强制 - 在游戏结束时，如果寻找伊莎贝拉在场上：珍妮·巴恩斯承受1点精神创伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02011',
  abilities: [
    {
      kind: 'weakness', label: '寻找伊莎贝拉', weakness: { type: 'attachedLocation' },
      // Phase 5（5a-15）：附着到离你最远的地点。
      resolve: ({ inv, api }) => {
        const farthest = api.farthestLocations(inv.seat)
        if (!farthest.length) return
        const locationId = farthest.length === 1 ? farthest[0] : api.choice({ kind: 'location', source: '02011', seat: inv.seat,
          prompt: '选择距离你最远的地点，放置「寻找伊兹」。',
          options: farthest.map(id => ({ id, label: api.locName(id) })) })
        if (!locationId) return
        const location = api.locationById(locationId)
        if (!location) return
        api.markSearchingForIzzie(location, inv.seat)
        api.info('「寻找伊兹」附着于 ' + location.name + '。')
      },
    },
  ],
  modifiers: [

  ],
}
