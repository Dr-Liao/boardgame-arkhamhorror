// 08575 狩猎失败之记忆：被击败时，翻开并结算记忆剧情。
export default {
  code: '08575', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08589' },
  abilities: [{
    kind: 'reaction', trigger: 'evadeSuccess', label: '成功躲避超过难度至少 3：对它造成 3 伤害',
    criteria: ({ context, inv, source }) => context.seat === inv.seat && context.enemy === source && context.successBy >= 3,
    resolve: ({ inv, source, api }) => api.damageEnemy(source, 3, inv.seat),
  }],
}
