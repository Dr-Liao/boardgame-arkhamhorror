// 08639 埋没通路（Submerged Passageway）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]：将本地点上的1个线索移动到本行或本列的一个未揭示的地点。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08639",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "moveClueToHidden",
        label: "将本地点 1 个线索移到本行/本列一个未揭示地点"
      }
    ]
  }
}
