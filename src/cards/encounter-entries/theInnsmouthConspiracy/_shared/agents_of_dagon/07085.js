export default {
  code: '07085', scope: 'enemy',
  enemyRule: { spawnAnyEmpty: true },
  modifiers: ['enemyFight', 'enemyEvade'].map(target => ({ target,
    amount: ({ entity }) => (entity.doom || 0) === 0 ? 2 : 0 })),
  abilities: [{ kind: 'forced', trigger: 'roundEnds', label: '达贡入教者：累积毁灭',
    criteria: ({ source }) => !source.exhausted && !(source.doom > 0),
    resolve: ({ source, api }) => api.placeDoomOnCard(source, 1) }],
}
