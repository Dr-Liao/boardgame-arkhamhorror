// 08602 陡峭斜坡（Steep Incline）· location
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   强制 - 你从下方的地点移动到陡峭斜坡后：受到1点伤害。
// 背面：你不能进入本地点，除非下方紧挨着的地点的所有线索都已被发现。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08602",
  scope: "location",
  implemented: true,
  locationRule: {
    enterFromBelow: {
      effect: "damage1"
    },
    blocksUntilBelowClear: true
  }
}
