// 08642 和蔼的古老者：生成在无人地点，入场带 1 毁灭。
export default {
  code: '08642',
  scope: 'enemy',
  implemented: true,
  enemyRule: { spawnAnyEmpty: true },
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '击败和蔼的古老者时，在当前密谋放置 1 个毁灭',
    criteria: ({ context, source }) => context.enemy?.id === source.id,
    resolve: ({ api }) => api.addDoom(1),
  }, {
    kind: 'action', actionKind: 'parley',
    label: '谈判 意志（3）：成功后将和蔼的古老者移出游戏',
    cost: { action: 1 },
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', 3, {
        actionKind: 'parley',
        testTarget: { kind: 'enemy', id: source.id },
        source: { type: 'enemy', code: '08642', ability: true },
        resolve: result => { if (result.success) api.scenario.removeEnemyFromGame(source) },
      })
    },
  }],
}
