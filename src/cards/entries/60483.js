// 60483 曲血术（Bend Blood，Marie Lambeau，5 XP）· 事件（2 费，法术/诅咒）
// 卡面：攻击（[willpower]）。本次攻击你得到 +3[willpower] 并且造成伤害 +1。
//       如果你检定成功，对你所在地点的每个其他敌人造成 1 点伤害。
//       每个受到[曲血术]伤害的敌人本轮剩余时间内不能攻击你。
//
// 读点（批次 3 原语）：
//   · 攻击 = api.fight({ skill:'willpower', combatBonus:3, damageBonus:1, noSpend:true })；
//     成功后对同地点其他敌人各 1 伤害（api.damageEnemy）；
//   · 「每个受到曲血术伤害的敌人本轮不能攻击你」= api.protectFromEnemyAttack(enemy, seat)
//     （api-enemy.js 批次 3 原语：写 enemy.attackProtection[seat] = state.round；
//     enemies.js#enemyAttack 与敌人阶段统一读该字段，跨轮自动失效，不需要清理）。
//   · 攻击目标本身在这次攻击里受到伤害（damageBonus +1），也属于「受到曲血术伤害的敌人」，同样保护。
import { attackableEnemies } from './_shared.js'

const CODE = '60483'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      label: '攻击（意志 +3，伤害 +1）；成功后对同地点其他敌人各 1 伤害；受伤敌人本轮不能攻击你',
      resolve: ({ state, inv, api }) => {
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('没有可攻击的敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择攻击目标。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.fight(inv.seat, enemy.id, {
          skill: 'willpower', combatBonus: 3, damageBonus: 1, noSpend: true, sourceCode: CODE,
          onSuccess: () => {
            const damaged = []
            if (state.enemies.includes(enemy)) damaged.push(enemy)
            for (const other of state.enemies.filter(item => item.id !== enemy.id
              && item.location === inv.location)) {
              api.damageEnemy(other, 1, inv.seat, CODE)
              if (state.enemies.includes(other)) damaged.push(other)
            }
            for (const item of damaged) api.protectFromEnemyAttack(item, inv.seat)
            if (damaged.length) api.info(`曲血术：${damaged.length} 个受到伤害的敌人本轮剩余时间内不能攻击你。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
