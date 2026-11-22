// 12001 丹妮拉·雷耶丝（Daniela Reyes）· 守卫者 · 机修工（2026 核心盒）。
//
// 卡面：
//   [reaction] 敌人攻击你所在地点的调查员后：攻击该敌人（使用一次基础攻击行动或卡牌上的一个攻击能力）。
//     （每轮仅限一次）
//   [elder_sign] 效果：+1。对你所在地点的一个敌人造成 1 点伤害。
//
// 引擎读点：
//   · `enemyAttacked` 窗口（enemies.js 在攻击结算后开窗，含被取消的攻击）：context 带
//     `{ seat, location, enemy, attack }`；「你所在地点的调查员」= context.location === inv.location。
//   · 反击走 `api.fight(..., { noSpend: true, ignoreDistance: true, ignoreAloof: true })`：
//     noSpend 表示不额外消耗行动点（这是反应，不是行动）；ignoreDistance/ignoreAloof 对应参考实现
//     「即便该敌人已经离开/具有冷漠也要攻击它」。
//   · `investigator.tracksAttacks` 让引擎在攻击结算时把 `{ enemyId, round, kind }` 记进
//     `inv.attackedSinceTurnEnd`（eote-investigator-support.js）；签名卡「丹妮拉的扳手」读这份记录。
//   · 旧印走 `elderSign` 描述子 + 独立 `elderSign` 能力；伤害走 api.damageEnemy。

const code = '12001'

export default {
  code,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 }, tracksAttacks: true },
  elderSign: {
    id: '12001-eldersign',
    label: '旧印：+1。对你所在地点的一个敌人造成 1 点伤害',
    resolve: ({ inv, state, api }) => {
      const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location
        && api.canDamageEnemy(enemy, inv.seat))
      if (enemies.length) {
        const id = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: '12001-eldersign', seat: inv.seat,
          prompt: '旧印：选择要造成 1 点伤害的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === id)
        if (enemy) api.damageEnemy(enemy, 1, inv.seat)
      }
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'enemyAttacked',
    label: '敌人攻击你所在地点的调查员后：攻击该敌人',
    limit: 'oncePerRound',
    criteria: [({ inv, context, state, helpers }) => context?.location === inv.location
      && Boolean(context?.enemy) && state.enemies.includes(context.enemy)
      && !helpers?.capabilityBlocked?.('fight')],
    resolve: ({ inv, context, api }) => {
      const enemy = context?.enemy
      if (!enemy) return
      if (typeof api.isEnemyInPlay === 'function' && !api.isEnemyInPlay(enemy)) return
      api.fight(inv.seat, enemy.id, {
        sourceCode: code, noSpend: true, ignoreDistance: true, ignoreAloof: true,
      })
    },
  }],
}
