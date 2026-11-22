// 50044 耶利米·皮尔斯（Jeremiah Pierce）· 敌人 · return_cult
// 卡面：生成 - 你的房子；否则河岸城。[action]：谈判。将耶利米·皮尔斯加入胜利区。
//   然后，检定[willpower](4)。你检定失败且每低于难度 1 点，在当前密谋上放置 1 个毁灭标记
//   （本效果可以导致当前密谋推进）。
// 读点：engine/parley.js#parleyMovesFor → 实体 abilities 的 actionKind:'parley' 描述子。
export default {
  code: '50044',
  scope: 'enemy',
  implemented: true,
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：将耶利米·皮尔斯加入胜利区，然后意志(4)，失败每点放 1 毁灭',
    cost: { action: 1 },
    resolve: ({ inv, source, api }) => {
      api.scenario.addEnemyToVictory(source)
      api.info(`🤝 ${inv.name} 与耶利米·皮尔斯谈判，将他加入胜利区。`)
      const difficulty = 4
      api.test(inv.seat, 'willpower', difficulty, result => {
        if (result?.success) return
        const amount = Math.max(0, difficulty - Number(result?.value ?? 0))
        if (amount > 0) api.scenario.addDoom(amount)
        api.info(`耶利米·皮尔斯：意志检定失败 ${amount} 点，在当前密谋上放置 ${amount} 个毁灭标记。`)
      })
    },
  }],
}
