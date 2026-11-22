// 83057 深渊弯刀（Khopesh of the Abyss）
// 归属：关卡专用 · guardiansOfTheAbyss/theNightsUsurper（夜之篡位者）· 遭遇组 abyssal_gifts
// 卡面：[action]：攻击。你本次攻击得到 +3[combat]，并造成伤害 +1。
//       [reaction] 你使用深渊弯刀击败敌人后，横置它：选择另一已揭示地点的一个敌人。
//       与所有和你交战的其它敌人解除交战，移动到所选敌人所在地点，然后与其交战。
//
// 读点：action 描述子 + target:{kind:'enemy'}（与 08589 同一目标枚举）→ api.fight（combatBonus/damageBonus）；
//   反应窗口 enemyDefeated + api.disengageEnemy / api.moveInvestigator / api.engage。
// 近似：反应条件按「本人击败敌人」判定，未区分是否确实用本武器击败（引擎窗口未携带武器来源）；
//   见 status.json risks。
export default {
  code: '83057',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  abilities: [
    {
      kind: 'action',
      actionKind: 'fight',
      label: '攻击：本次攻击 +3[combat] 且伤害 +1',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, api, target }) => {
        if (!target?.id) { api.info('没有可攻击的敌人。'); return }
        api.fight(inv.seat, target.id, { combatBonus: 3, damageBonus: 1, sourceCode: '83057' })
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemyDefeated',
      label: '击败敌人后横置：与其它敌人解除交战，移动到另一地点敌人处并交战',
      cost: { exhaust: true },
      criteria: ({ inv, context }) => Boolean(context && (context.seat === inv.seat || context.bySeat === inv.seat
        || context.killerSeat === inv.seat || context.investigatorSeat === inv.seat)),
      resolve: ({ state, inv, api }) => {
        const candidates = (state.locations || []).filter(location => location.revealed !== false
          && location.id !== inv.location)
        const targets = (state.enemies || []).filter(enemy => !enemy.defeated
          && candidates.some(location => location.id === enemy.location))
        if (!targets.length) { api.info('另一已揭示地点没有敌人。'); return }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '83057', seat: inv.seat, prompt: '选择另一已揭示地点的一个敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        if (!enemy) return
        for (const other of state.enemies.filter(item => item.engagedSeat === inv.seat)) api.disengageEnemy(other)
        api.moveInvestigator(inv.seat, enemy.location)
        api.engage(enemy, inv.seat)
        api.info(`${inv.name} 借助深渊弯刀移动到「${enemy.name}」处并与其交战。`)
      },
    },
  ],
  modifiers: [],
}
