// 08607 山顶（The Summit）· location
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   山顶的线索只能通过调查发现。
//   强制 - 在山顶被揭示时：在混乱袋里加入1个[frost]标记。
//   [action]：撤退。将所有你控制的[[探险]]支援加入胜利区。将你所有的线索放回供应堆。
// 背面：你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08607",
  scope: "location",
  implemented: true,
  locationRule: {
    // 「山顶的线索只能通过调查发现」：引擎读点 src/engine/locations.js:379
    // （locationRule.cluesOnlyByInvestigation，顶层字段；旧实现误嵌在 flags 下 → 无读点）。
    cluesOnlyByInvestigation: true,
    flags: {
      summitResign: true
    },
    onReveal: "addFrostToken",
    blocksUntilBelowClear: true
  }
}
