// 08635 地图资料室（Map Room）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个“-3”钥匙：选择并揭示3个隐秘隧道以外的地点。(FAQ，v2.1)在这些地点中每个地点各发现1个线索。在剧本日志中记录队伍查看了地图。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08635",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "mapRoomStudy",
        values: [
          "-3",
          "-3"
        ],
        remember: "theTeamStudiedTheHistoryOfTheElderThings",
        label: "花费 2 个「-3」钥匙：揭示 3 个地点并各发现 1 线索（记录）"
      }
    ]
  }
}
