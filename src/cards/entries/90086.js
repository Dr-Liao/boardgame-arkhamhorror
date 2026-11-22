// 90086 寻找伊莎贝拉（Searching for Izzie）· 中立 · 诡计/弱点 · 进阶（珍妮·巴恩斯）。
// 卡面（cards-data 90086）：
//   进阶。
//   显现 - 将寻找伊莎贝拉附属到离你最远的地点。所附属的地点得到 +2 隐匿值。
//   [action][action]：调查。如果检定成功，不发现线索，改为弃掉寻找伊莎贝拉。
//   强制 - 在游戏结束时，如果寻找伊莎贝拉在场上：你承受 1 点精神创伤。
//
// 引擎读点（与 02011 原版同一套原语）：
//   · 显现附属到最远地点 = weakness attachedLocation 的自定义 resolve：
//     api.farthestLocations + api.markSearchingForIzzie（location.searchingForIzzieSeat 标记）；
//   · 引擎按该标记提供 [action][action] 调查行动与结局 1 点精神创伤
//     （moves.js#discard/actions-extra.js#doSearchIzzie；campaign-flow.js#searchingForIzzieSeat）。
// 缺原语：「所附属的地点 +2 隐匿值」没有「地点隐匿值直到弱点离场」的读点（markSearchingForIzzie 只存
//   座位；location.shroudMod 的写入口未暴露给卡条目）→
//   primitive-requests/core-cards-a-90086-izzie-advanced-shroud.json；当前近似不加隐匿值。
const code = '90086'

export default {
  code,
  storyRole: 'searchingForIzzie',
  abilities: [
    {
      kind: 'weakness',
      label: '寻找伊莎贝拉（进阶）：附属到离你最远的地点',
      weakness: { type: 'attachedLocation' },
      resolve: ({ inv, api }) => {
        const farthest = api.farthestLocations(inv.seat)
        if (!farthest.length) { api.putIntoDiscard(inv.seat, code); return }
        const locationId = farthest.length === 1 ? farthest[0] : api.choice({
          kind: 'location', source: code, seat: inv.seat,
          prompt: '选择距离你最远的地点，放置「寻找伊莎贝拉」。',
          options: farthest.map(id => ({ id, label: api.locName(id) })),
        })
        if (!locationId) return
        const location = api.locationById(locationId)
        if (!location) return
        api.markSearchingForIzzie(location, inv.seat)
        api.info(`🔎 「寻找伊莎贝拉」附着于「${location.name}」（+2 隐匿值待原语）。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：「[action][action] 调查成功后弃掉」与结局 1 点精神创伤由引擎 searchingForIzzieSeat 标记读点提供（与 02011 相同）；「所附属地点 +2 隐匿值」缺地点侧持续修正写入口 → primitive-requests/core-cards-a-90086-izzie-advanced-shroud.json。',
}
