// 01163 腐烂的尸体
// 归属：跨战役通用
// 遭遇组：striking_fear
// 卡面：显现 - 检定[willpower](3)。你检定失败且每低于难度1点，受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 2026-10-28 P1：显现检定改为声明式（treacheryRule.test），读点 src/engine/treachery-tokens.js。

export default {
  code: '01163', scope: 'treachery', implemented: true,
  treacheryRule: {
    test: { skill: 'willpower', difficulty: 3, fail: { kind: 'horrorByAmount' } },
  },
}
