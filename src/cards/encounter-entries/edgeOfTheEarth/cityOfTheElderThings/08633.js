// 08633 圆柱塔（Cylindrical Tower）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]花费2个“-2”钥匙：抽取2张卡牌，获得2资源，并从混乱袋里移除2个[frost]标记。在剧本日志中记录队伍研究了壁画雕刻。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08633",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "towerStudy",
        values: [
          "-2",
          "-2"
        ],
        remember: "theTeamStudiedTheHistoryOfTheElderThings",
        label: "花费 2 个「-2」钥匙：抽 2 张牌、获得 2 资源、移除 2 个 [frost]（记录）"
      }
    ]
  }
}
