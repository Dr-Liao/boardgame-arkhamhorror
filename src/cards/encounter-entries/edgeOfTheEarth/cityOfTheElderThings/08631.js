// 08631 古代天文馆（Ancient Planetarium）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个“0”钥匙：直到剧本结束，在混乱袋里加入花费的其中一个“0”钥匙(作为一个混乱标记)。在剧本日志中记录队伍拍摄了天文图的照片。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08631",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "planetariumStudy",
        values: [
          "0",
          "0"
        ],
        remember: "theTeamStudiedTheHistoryOfTheElderThings",
        label: "花费 2 个「0」钥匙：拍摄天文图照片（记录）"
      }
    ]
  }
}
