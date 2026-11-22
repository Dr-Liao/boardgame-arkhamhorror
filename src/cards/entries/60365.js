// 60365 有账必付（Pay Your Dues，André Patel）
// 卡面：谈判。选择你所在地点的一个剩余生命值为 X 的非[[精英]]敌人（X 为打出本卡的费用）。
//       该敌人与每位调查员解除交战并获得冷漠，直到本轮结束。发现你所在地点的 1 个线索。
//
// 引擎读点：
//   · 谈判 = played + countsAs:'parley'（规则上谈判不引发借机攻击）；
//   · 解除交战 = api.disengageEnemy（敌人交战的唯一解除入口）；
//   · 「获得冷漠直到本轮结束」= api.grantEnemyAloofUntilRoundEnd（写 enemy.aloofUntilRound，
//     turn-flow 的冷漠重算读同一字段）；
//   · 发现线索 = api.discoverClue。
//
// 注意：可变费用「X = 所选敌人剩余生命」仍无事件费用原语，已在
// artifacts/migration/starter-batch-3/primitive-requests/w5-60365-variable-event-cost-by-target.json
// 排队（本条目只结算效果，费用按印刷费用字段由引擎收取）。
import { attackableEnemies } from './_shared.js'
import { ALL_CARDS } from '../cards-data.js'

const nonEliteHere = (state, inv) => state.enemies.filter(enemy =>
  enemy.location === inv.location && !enemy.elite)

export default {
  code: '60365',
  // 可变费用：打出时选择 X 并按 X 支付资源；随后选择剩余生命 ≤ X 的非精英敌人。
  chooseResourceCostOnPlay: true,
  variableCostPaidAs: 'paidX',
  playCondition: [{
    when: ({ state, inv }) => nonEliteHere(state, inv).length > 0,
    message: '你所在地点没有可谈判的非精英敌人',
  }],
  abilities: [{
    kind: 'played',
    actionKind: 'parley',
    countsAs: 'parley',
    label: '谈判：非精英敌人解除交战并获得冷漠（本轮）；发现 1 个线索',
    resolve: ({ state, inv, api, context }) => {
      const budget = Math.max(0, Number(context?.variableX) || 0)
      const enemies = attackableEnemies(state, inv).filter(enemy => !enemy.elite
        && enemy.location === inv.location
        && (Number(enemy.health ?? ALL_CARDS[enemy.code]?.health) - (enemy.damageTaken || 0)) <= budget)
      if (enemies.length) {
        const chosen = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: '60365', seat: inv.seat,
          prompt: '选择要谈判的非精英敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === chosen) || enemies[0]
        if (enemy) {
          if (enemy.engagedSeat != null) api.disengageEnemy(enemy)
          api.grantEnemyAloofUntilRoundEnd(enemy)
          api.info(`「${enemy.name}」与调查员们解除交战并获得冷漠（直到本轮结束）。`)
        }
      }
      api.discoverClue(inv.seat, 1)
    },
  }],
}
