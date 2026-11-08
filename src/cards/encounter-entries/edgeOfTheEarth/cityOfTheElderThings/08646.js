// 08646 冻伤（Frostbitten）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   显现 - 将冻伤放置入场，放到你的威胁区域。
//   冻伤可被治愈，如同是你身上的1点伤害(如果它被治愈，将其弃掉)。
//   强制 - 你在技能检定期间揭示[frost]混乱标记时：你必须受到1点伤害或本次检定自动失败。(每次检定仅限一次。)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08646",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    threatArea: true,
    resolveKind: "frostbitten"
  },
  flags: {
    frostWeakness: true,
    healAsOneDamageApproximation: true
  }
}
