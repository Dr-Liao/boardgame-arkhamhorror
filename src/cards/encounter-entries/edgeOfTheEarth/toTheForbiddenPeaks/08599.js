// 08599 登上高峰（Ascend the Mountain）· act
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   [action]：控制你所在地点的一个[[探险]]支援。
//   目标 - 到达山顶。如果所有未被击败的调查员都撤退了，推进场景。
// 背面：(→结局1)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08599",
  scope: "act",
  implemented: true,
  actRule: {
    objective: {
      type: "allResigned"
    },
    chapterFlow: "ascendTheMountain",
    onReveal: "resolution1"
  }
}
