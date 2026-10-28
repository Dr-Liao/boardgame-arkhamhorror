// 01162 攫噬之手
// 归属：跨战役通用
// 遭遇组：ghouls
// 卡面：显现 - 检定[agility](3)。你检定失败且每低于难度1点，受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 2026-10-28 P1：显现检定改为声明式（treacheryRule.test），读点 src/engine/treachery-tokens.js。

export default {
  code: '01162', scope: 'treachery', implemented: true,
  name: '攫噬之手',
  text: '显现 - 检定[agility](3)。你检定失败且每低于难度 1 点，受到 1 点伤害。',
  treacheryRule: {
    test: { skill: 'agility', difficulty: 3, fail: { kind: 'damageByAmount' } },
  },
}
