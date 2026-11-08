// 08612 悬于边缘（Hanging on the Edge）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   显现 - 检定[agility](3)。如果你检定失败，受到2点伤害，失去你控制的所有[[探险]]支援的控制权(放到你所在地点)，并移动到你下方紧挨着的地点。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08612",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    resolveKind: "hangingOnTheEdge"
  }
}
