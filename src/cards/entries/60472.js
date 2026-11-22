// 60472 鲜血结界（Blood Ward，Marie Lambeau，2 XP）
// 卡面：快速。在一个非[[精英]]敌人攻击你所在地点的调查员时打出。
//       取消该攻击并治疗目标调查员 2 点伤害。
//
// 引擎读点：
//   · 打出时机 = `enemyAttack` interrupt 窗口（windows.js: 'enemyAttack' 为 interrupt，
//     enemies.js#enemyAttack 在分配伤害前打开）；context 带 seat/location/enemy/attack，
//     attack 含 plannedDamage/plannedHorror。
//   · 取消攻击 = api.cancelEnemyAttack(context)（api-misc 的窗口取消入口，置 context.cancelled
//     与 context.attack.cancelled，后续伤害分配直接跳过）。
//   · 治疗目标调查员 = api.healDamage(context.seat, 2)（healDamageFrom 唯一入口）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60472',
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'enemyAttack',
    label: '取消非精英敌人的攻击，并治疗目标调查员 2 点伤害',
    criteria: [ownSeat(), ({ state, inv, context }) => {
      const enemy = context?.enemy || context?.attack?.enemy
      if (!enemy || enemy.elite) return false
      if (enemy.location !== inv.location) return false
      const target = context?.seat != null ? state.investigators[context.seat] : null
      return !target || target.location === inv.location
    }],
    resolve: ({ state, context, api }) => {
      if (!context || !api.cancelEnemyAttack(context)) return
      const targetSeat = Number.isInteger(context.seat) ? context.seat : null
      const target = targetSeat != null ? state.investigators[targetSeat] : null
      if (targetSeat != null) api.healDamage(targetSeat, 2)
      api.info(`🛡️「鲜血结界」：取消「${context.enemy?.name || '敌人'}」的攻击，并治疗 ${target?.name || '目标调查员'} 2 点伤害。`)
    },
  }],
}
