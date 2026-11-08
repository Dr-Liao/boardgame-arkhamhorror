// 08601 白色断崖（White Bluff）· location
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   强制 - 你从下方的地点移动到白色断崖后：检定[agility](X)。X为本地点的高度加1。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在白色断崖。
// 背面：你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08601",
  scope: "location",
  implemented: true,
  locationRule: {
    enterFromBelow: {
      effect: "agilityTestLevelPlus1OnFailDropExpedition"
    },
    blocksUntilBelowClear: true
  }
}
