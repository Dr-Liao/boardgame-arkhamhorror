// 08647 附身（Possessed）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   显现 - 将附身放置入场，放到你的威胁区域。
//   附身可被治愈，如同是你身上的1点恐惧(如果它被治愈，将其弃掉)。
//   强制 - 你在技能检定期间揭示[frost]混乱标记时：你必须受到1点恐惧或本次检定自动失败。(每次检定仅限一次。)
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08647",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    threatArea: true,
    resolveKind: "possessed"
  },
  flags: {
    frostWeakness: true,
    threatHorrorSink: true,
    redirectHeal: {
      optional: true
    }
  }
}
