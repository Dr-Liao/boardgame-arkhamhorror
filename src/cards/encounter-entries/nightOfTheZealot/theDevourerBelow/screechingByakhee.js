// screechingByakhee 尖叫的拜亚基
// 归属：关卡专用 · theDevourerBelow（夜之狂热 · 第三幕：地底噬魔）
// 遭遇组：无（story）
// 卡面：与你交战时，若你的剩余神智不超过 4，它的战斗与躲避 +1。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 尖叫的拜亚基：与你交战时，若你剩余神智 ≤ 4，它的战斗/躲避 +1。
// 迁移自 engine.js 的 `enemy.code === 'screechingByakhee'` 分支（Phase 3 D1）。

export default {
  code: 'screechingByakhee',
  name: '尖叫的拜亚基',
  scope: 'enemy',
  text: '与你交战时，若你的剩余神智不超过 4，它的战斗与躲避 +1。',
  modifiers: [
    {
      target: 'enemyFight', amount: 1,
      condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
        && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
    },
    {
      target: 'enemyEvade', amount: 1,
      condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
        && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
    },
  ],
}
