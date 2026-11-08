// 08609 拘束型古老者（Constricting Elder Thing）· enemy
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   猎手。
//   X等于你所在地点的高度(至少为1)。
//   拘束型古老者与你交战时，你不能移动到你所在地点上方的地点。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08609",
  scope: "enemy",
  implemented: true,
  enemyRule: {
    hunter: true,
    levelStats: "level",
    blocksAscendWhileEngaged: true
  }
}
