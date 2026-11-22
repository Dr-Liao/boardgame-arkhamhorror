// 60207 伊察姆纳圆盘
// 卡面：[reaction]一名非[[精英]]敌人在你所在地点生成时，弃掉伊察姆纳圆盘：自动躲避该敌人，或对其造成2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60207',
  abilities: [{
    kind: 'reaction', trigger: 'enemySpawn',
    cost: { discardSelf: true },
    label: '同地点非精英敌人生成：弃掉本牌，自动躲避或造成 2 伤害',
    criteria: ({ inv, source, context, helpers }) => inv.assets.includes(source)
      && context.enemy?.location === inv.location && !context.enemy.elite
      && (helpers.canAutoEvade(context.enemy, inv.seat) || helpers.canDamageEnemy(context.enemy, inv.seat, '60207')),
    resolve: ({ inv, context, api }) => {
      const enemy = context.enemy
      const options = []
      if (api.canAutoEvade(enemy, inv.seat)) options.push({ id: 'evade', label: '自动躲避该敌人' })
      if (api.canDamageEnemy(enemy, inv.seat, '60207')) options.push({ id: 'damage', label: '对该敌人造成 2 伤害' })
      const answer = options.length < 2 ? options[0]?.id : api.choice({
        kind: 'effect', source: '60207', seat: inv.seat, prompt: '选择如何应对生成的敌人。', options,
      })
      if (answer === 'evade') api.autoEvade(enemy)
      if (answer === 'damage') api.damageEnemy(enemy, 2, inv.seat, '60207')
    },
  }],
}
