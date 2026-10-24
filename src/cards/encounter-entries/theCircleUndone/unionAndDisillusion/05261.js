// 05261 瓦伦蒂诺·里瓦斯（《聚合幻灭》剧情支援）
// 卡面：你得到 +1[agility]。
// [fast] 在你进行的一次技能检定期间，花费 2 资源并横置瓦伦蒂诺·里瓦斯：本次检定难度 -1。
//
// 受控剧情支援与玩家卡同通道：+1 技能走 modifiers，[fast] 走 abilities。
// 引擎的「检定期间自由能力」通道用 testBegins 反应窗口 + api.reduceTestDifficulty
//（与序章 05048 / 玩家卡 05159 同一写法）；难度降低写在引擎的 difficultyReduction 账本上。

export default {
  code: '05261',
  scope: 'storyAsset',
  implemented: true,
  modifiers: [{ target: 'skill:agility', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'testBegins',
    label: '[fast] 花费 2 资源并横置：本次检定难度 -1',
    cost: { resources: 2, exhaust: true },
    criteria: [({ inv, context }) => context?.seat === inv.seat && Number.isFinite(context?.difficulty)],
    resolve: ({ inv, api }) => {
      api.reduceTestDifficulty(1)
      api.info(`${inv.name} 花费 2 资源（瓦伦蒂诺），本次检定难度 -1。`)
    },
  }],
}
