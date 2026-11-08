// 08632 石桥（Stone Bridge）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]：检定[combat](4)或[agility](4)。如果你检定成功，发现石桥的1个线索。
//   [action]：移动到另一个石桥地点。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08632",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "bridgeDiscover",
        label: "检定 [combat](4) 或 [agility](4)：成功发现石桥 1 线索"
      },
      {
        rule: "bridgeTravel",
        label: "移动到另一个石桥地点"
      }
    ]
  }
}
