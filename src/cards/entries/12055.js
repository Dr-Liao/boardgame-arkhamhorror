// 12055 致胜一击（Decisive Strike）
// 卡面：攻击([combat])。你本次攻击得到+2[combat]并且造成伤害+1。如果本次攻击击败了敌人，获得5资源。
//
// 读点：
//   · 事件「攻击」→ countsAs:'fight'（actionKind 读点：不引发借机攻击）；
//   · 攻击 → api.fight（combat.js#doFight 同一份结算；事件已付打出费用，故 noSpend:true）；
//   · 「击败敌人后获得 5 资源」→ doFight 同步返回后读 state.enemies 是否仍包含目标（05114/10117 同口径），
//     再走 api.gainResources。
import { attackableEnemies } from './_shared.js'

const CODE = '12055'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      label: '攻击：战斗+2、伤害+1；若本次攻击击败敌人，获得 5 资源',
      resolve: ({ state, inv, api }) => {
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('这里没有可攻击的敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择攻击目标。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        if (!enemy) return
        api.fight(inv.seat, enemy.id, { combatBonus: 2, damageBonus: 1, noSpend: true })
        if (!state.enemies.includes(enemy)) {
          api.gainResources(inv.seat, 5)
          api.info(`🎯「致胜一击」击败了「${enemy.name}」：获得 5 资源。`)
        }
      },
    },
  ],
}
