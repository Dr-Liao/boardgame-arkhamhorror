// 08604 岩架（Rocky Ledge）· location
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   强制 - 你从下方的地点移动到岩架后：将忒咳哩-哩牌库顶的一张卡牌混洗入你的牌库，不要查看内容。
// 背面：你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08604",
  scope: "location",
  implemented: true,
  locationRule: {
    enterFromBelow: {
      effect: "tekeliShuffleIntoDeck"
    },
    blocksUntilBelowClear: true
  }
}
