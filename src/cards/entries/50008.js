export default {
  code: '50008',
  playCondition: [{
    when: ({ state, inv }) => state.enemies.some(enemy => !enemy.elite && enemy.location === inv.location),
    message: '此地没有非精英敌人',
  }],
  abilities: [{
    kind: 'played', fast: true, trigger: 'phaseBegins',
    label: '限制同地点非精英敌人直到阶段结束：印刷文本失效，伤害和恐惧各 -1',
    effect: { type: 'blankEnemy', source: '50008', damagePenalty: 1, horrorPenalty: 1 },
  }],
}
