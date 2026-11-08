// 08645 崩塌废墟（Crumbling Ruins）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   显现 - 检定[agility](3)。本次检定期间，如果你揭示了一个与你所在地点上的钥匙或者你所在地点一位调查员控制的钥匙一致的混乱标记，你自动失败。你检定失败且每低于难度1点，受到1点伤害。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08645",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    resolveKind: "crumblingRuins"
  }
}
