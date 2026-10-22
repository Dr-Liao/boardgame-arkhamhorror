// 03222 潜行的拜亚基
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：猎手。
// 卡面：潜行的拜亚基处于横置状态时，其得到-3攻击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 潜行的拜亚基（03222）：横置时战斗 -3。

export default {
  code: '03222', implemented: true,
  name: '潜行的拜亚基',
  scope: 'enemy',
  text: '它横置时战斗 -3。',
  modifiers: [{
    target: 'enemyFight', amount: -3,
    condition: { when: ({ entity }) => entity.exhausted === true },
  }],
}
