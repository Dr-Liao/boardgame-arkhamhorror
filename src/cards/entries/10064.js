// 10064 敲诈文件（Blackmail File）· 潜袭者资产 · 2 资源 · 道具/书籍/违法
// 卡面：
//   [action] 选择你所在地点的一个非[[精英]]敌人：谈判。检定[意志](X)，其中 X 等于该敌人的
//   印刷生命值。如果你检定成功，该敌人与每位调查员解除交战，且获得冷漠，直到本轮结束。
//
// 读点（卡面 → 引擎）：
//   · 「[action] 选择非精英敌人：谈判」= kind 'action' + actionKind 'parley' +
//     target { kind:'enemy', query: 非精英 }：legalMoves 为每个候选展开一条带 targetId 的行动。
//   · 印刷生命值 = cards-data 的 health（与 10019 御守同一读法；场景敌人不在玩家卡表时回落到
//     实例 health，再退化为 1）。
//   · 检定[意志](X) = api.test(seat, 'willpower', X, { actionKind:'parley', resolve })。
//   · 「与每位调查员解除交战」= api.disengageEnemy（enemies.js#disengageEnemy 的唯一写点）。
//   · 「获得冷漠，直到本轮结束」= api.scenario.setEnemyKeywords(enemy, ['aloof'],
//     { enabled: true, throughRound: state.round })（enemy-keyword-movement.js；override 在
//     throughRound >= 当前轮有效，轮次推进后自动失效；enemy-aloof.js 是读取点）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10064'

const printedHealthOf = enemy => {
  const def = ALL_CARDS[enemy?.originalCode || enemy?.code]
  const printed = Number(def?.health)
  if (Number.isFinite(printed) && printed > 0) return printed
  const own = Number(enemy?.health)
  return Number.isFinite(own) && own > 0 ? own : 1
}

export default {
  code: CODE,
  name: 'Blackmail File',
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      countsAs: 'parley',
      cost: { action: true },
      target: { kind: 'enemy', query: ({ entity }) => !entity?.elite },
      label: '谈判：检定[意志](敌人印刷生命值)；成功则解除交战并使其获得冷漠直到本轮结束',
      resolve: ({ state, inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const difficulty = printedHealthOf(enemy)
        api.info(`📁 ${inv.name} 用敲诈文件要挟「${api.cardName(enemy.code)}」：检定[意志](${difficulty})。`)
        api.test(inv.seat, 'willpower', difficulty, {
          actionKind: 'parley',
          source: { code: CODE, label: '谈判', name: api.cardName(CODE) },
          resolve: result => {
            if (!result.success) {
              api.info(`📁 敲诈文件：「${api.cardName(enemy.code)}」不吃这一套。`)
              return
            }
            api.disengageEnemy(enemy)
            api.scenario.setEnemyKeywords(enemy, ['aloof'], { enabled: true, throughRound: state.round })
            api.info(`📁 敲诈文件：「${api.cardName(enemy.code)}」与调查员解除交战，并获得冷漠直到本轮结束。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
