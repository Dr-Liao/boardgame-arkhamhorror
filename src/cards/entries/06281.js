// 06281 黛利拉·欧鲁尔克
// 卡面：你得到+1[combat]和+1[agility]。
//       [free]横置黛利拉·欧鲁尔克并花费X资源：选择你所在地点的一个敌人。
//       对所选敌人造成1点伤害(如果该敌人已被横置，改为造成2点伤害)。X为所选敌人的躲避值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06281 黛利拉·欧鲁尔克：+1 战斗 / +1 敏捷（modifiers）。
//   · [free] 横置 + 花费 X 资源（X = 所选敌人躲避值）：引擎的 cost 求值拿不到已选目标，
//     因此把「资源 ≥ X」写进 target.query（买不起的敌人不会成为合法目标 = 预览即可用性），
//     结算时用 api.spendResources 真实扣 X；伤害按目标是否已横置取 1/2。

import { skillModifier } from './_shared.js'

function evadeValueOf(enemy) {
  return Math.max(0, Number(enemy?.evade) || 0)
}

export default {
  code: '06281',
  abilities: [
    {
      kind: 'action',
      label: '[free] 横置并花费 X 资源：对同地点敌人造成 1 伤害（已横置则 2）',
      cost: { action: false, exhaust: true },
      target: {
        kind: 'enemy',
        label: '你所在地点、且资源足够支付其躲避值的敌人',
        // 费用 X = 所选敌人的躲避值：cost 表达式读不到目标，因此把可支付性放进目标筛选
        // （legalMoves / validateMove 用同一份枚举，买不起就不出现在合法行动里）。
        query: ({ state, inv, candidate }) => {
          const enemy = candidate?.entity
          if (!enemy) return false
          const seat = Number.isInteger(inv?.seat) ? inv.seat : state?.currentSeat
          const owner = state?.investigators?.[seat]
          return (owner?.resources || 0) >= evadeValueOf(enemy)
        },
      },
      resolve: ({ inv, api, target }) => {
        const enemy = target?.entity
        if (!enemy) return
        const x = evadeValueOf(enemy)
        if ((inv.resources || 0) < x) { api.info('资源不足，无法支付黛利拉的能力费用。'); return }
        if (x > 0) api.spendResources(inv.seat, x)
        const damage = enemy.exhausted ? 2 : 1
        api.damageEnemy(enemy, damage, inv.seat, '06281')
        api.info(`🗡️ 黛利拉对「${enemy.name}」造成 ${damage} 点伤害。`)
      },
    },
  ],
  modifiers: [
    skillModifier('combat', 1),
    skillModifier('agility', 1),
  ],
}
