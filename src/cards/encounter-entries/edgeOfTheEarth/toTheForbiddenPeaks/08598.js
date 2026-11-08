// 08598 恐怖降临（Terror Descends）· agenda
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   强制 - 在你移动到一个地点后：将你所有线索放回供应堆。
// 背面：如果有调查员已经撤退，进入(→结局1)。 / 否则，进入(→结局2)。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08598",
  scope: "agenda",
  implemented: true,
  agendaRule: {
    onMove: "returnClues",
    onReveal: "finalResolution"
  }
}
