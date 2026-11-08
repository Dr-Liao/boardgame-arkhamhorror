// 08613 低温症（Hypothermia）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   显现 - 检定[willpower](3)。如果你所在地点的高度为4或5，本次技能检定额外揭示1个混乱标记。如果你检定失败，在混乱袋里加入1个[frost]标记，或每低于难度1点就受到1点恐惧。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08613",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    resolveKind: "hypothermia"
  }
}
