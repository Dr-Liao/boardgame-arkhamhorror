// 08644 真相开端（Dawning of the Truth）· treachery
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   显现 - 检定[willpower](2)。本次检定难度值增加你所在地点和你控制的钥匙数之和。如果你检定失败，受到2点恐惧(如果你检定失败且低于难度至少3点，改为3点恐惧)。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08644",
  scope: "treachery",
  implemented: true,
  treacheryRule: {
    resolveKind: "dawningOfTheTruth"
  }
}
