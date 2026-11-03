export default {
  code: '07089', scope: 'enemy',
  abilities: [{ kind: 'forced', trigger: 'enemyEngaged', label: '潜伏的深潜者：受到1点伤害',
    criteria: ({ source, context }) => source.id === context.enemy?.id,
    resolve: ({ context, api }) => api.damage(context.seat, 1) }],
}
