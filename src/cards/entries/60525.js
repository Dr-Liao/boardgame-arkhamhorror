export default {
  code: '60525',
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'evadeFail',
    requiresEncounterDeck: true,
    label: '躲避非精英敌人失败至多 3 点后：将该敌人放回遭遇牌库底',
    criteria: ({ inv, context }) => context.seat === inv.seat && context.failedBy <= 3
      && Boolean(context.enemy) && !context.enemy.elite,
    resolve: ({ api, inv, context }) => api.moveEnemyToEncounterBottom(context.enemy, { seat: inv.seat }),
  }],
}
