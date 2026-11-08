// 08610 降雪（Snowfall）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   显现 - 在你所在地点放置2个线索(从供应堆拿取)。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08610",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    resolveKind: "snowfall"
  }
}
