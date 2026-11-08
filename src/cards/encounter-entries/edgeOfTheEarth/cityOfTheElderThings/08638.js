// 08638 巨大尖顶（Cyclopean Spires）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   [action]：将本行另一个地点的1个钥匙移动到巨大尖顶。(团队每场游戏仅限一次)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08638",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "moveKeyToSpires",
        label: "将本行另一地点的 1 个钥匙移到巨大尖顶（团队每场一次）",
        teamOnce: true
      }
    ]
  }
}
