// 12002 丹妮拉的扳手（Daniela's Wrench）· 守卫者 · 道具/工具/武器/近战 · 手部槽 · 2 资源。
//
// 卡面：丹妮拉·雷耶丝牌库专用。
//   [fast] 横置丹妮拉的扳手：选择你所在地点的一个敌人。该敌人与你交战并立即进行一次攻击。
//   [action]：攻击 ([combat])。你本次攻击得到 +2 [combat]。如果该敌人本轮攻击了你，
//     本次攻击造成伤害 +1。
//
// 引擎读点：
//   · [fast] 是资产上的 free 描述子（cost.action: false + exhaust），target 走 B1 的
//     「同地点敌人」枚举（ctx.target 是枚举候选，实体在 ctx.target.entity）；「与你交战并立即
//     攻击」= api.engage（主动交战）+ api.enemyAttackByCard（卡牌造成的立即攻击，走统一攻击流程，
//     含 enemyAttacked / 伤害分配窗口）。
//   · [action] 走 api.fight 的 combatBonus / damageBonus；「该敌人本轮攻击过你」读
//     12001 声明 tracksAttacks 后引擎写入的 inv.attackedSinceTurnEnd（只读，不写状态）。

const code = '12002'

export default {
  code,
  abilities: [
    {
      kind: 'free',
      label: '横置：选择你所在地点一个敌人；该敌人与你交战并立即进行一次攻击',
      cost: { action: false, exhaust: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity || target
        if (!enemy) return
        api.engage(enemy, inv.seat)
        api.enemyAttackByCard(enemy, `「${api.cardName(code)}」`, inv.seat)
      },
    },
    {
      kind: 'action',
      label: '攻击：+2 [combat]；若该敌本轮攻击过你，本次攻击伤害 +1',
      countsAs: 'fight',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, source, target, state, api }) => {
        const enemyId = target?.id
        if (!enemyId) return
        const attackedThisRound = (inv.attackedSinceTurnEnd || [])
          .some(entry => entry && entry.enemyId === enemyId && entry.round === state.round)
        api.fight(inv.seat, enemyId, {
          assetId: source?.id,
          sourceCode: code,
          combatBonus: 2,
          damageBonus: attackedThisRound ? 1 : 0,
        })
      },
    },
  ],
  modifiers: [],
}
