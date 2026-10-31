// 06114 跟踪
// 卡面：调查。选择你所在地点的一名敌人。所选敌人上每有1点伤害，你本次调查得到+1[intellect](最多+5[intellect])。
//       如果你检定成功，发现本地点的额外1个线索。本行动不会触发所选敌人的趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：调查走 api.investigate（opts.bonus 加技能值、opts.clueBonus 加成功线索数）；
// 目标敌人由描述子 target.kind='enemy' 枚举（ctx.target.entity 是敌人实例，damageTaken 为其上伤害）。
// 「本行动不会触发所选敌人的趁乱攻击」：引擎里调查行动本身不引发借机攻击（打出事件也不引发），
// 因此实际结算与卡面一致，不需要额外读点。

export default {
  code: '06114',
  playCondition: [{
    when: ({ state, inv }) => (state.enemies || []).some(enemy => !enemy.defeated && enemy.location === inv.location),
    message: '你所在地点没有敌人，不能打出「跟踪」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '跟踪：调查（敌人每有 1 点伤害 +1 智识，最多 +5；成功额外发现 1 个线索）',
      // 事件卡的目标不参与 legalMoves 枚举（B1 的目标枚举只覆盖能力），因此 resolve 里自行选择。
      resolve: ({ state, inv, api }) => {
        const candidates = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv.location)
        if (!candidates.length) { api.info('没有可选的敌人。'); return }
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '06114', seat: inv.seat,
          prompt: '选择你所在地点的一名敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const chosen = candidates.find(enemy => enemy.id === chosenId) || candidates[0]
        const damage = Math.max(0, Number(chosen.damageTaken) || 0)
        const bonus = Math.min(5, damage)
        api.info(`🎯 所选敌人「${chosen.name || chosen.code}」上有 ${damage} 点伤害：本次调查 +${bonus} 智识。`)
        api.investigate(inv.seat, { bonus, clueBonus: 1 })
      },
    },
  ],
  modifiers: [],
}
