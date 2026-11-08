// 08611 雪崩（Avalanche）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   显现 - 如果你所在地点的高度为1-4，移动到你下方紧挨着的地点。然后，检定[willpower](X)。X等于你所在地点的高度。如果你检定失败，重复本过程。如果你没有因为本效果移动，雪崩获得涌动。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08611",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    resolveKind: "avalanche"
  }
}
