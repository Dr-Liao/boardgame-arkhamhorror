export default {
  code: '51006',
  abilities: [{
    kind: 'played', fast: true, trigger: ['enemySpawn', 'enemyEnteredLocation'],
    label: '敌人进入此地时，立即移动到一个相邻地点',
    criteria: ({ inv, context }) => context.location === inv.location,
    effect: { type: 'moveTo', source: '51006', keepEngaged: true },
  }],
}
