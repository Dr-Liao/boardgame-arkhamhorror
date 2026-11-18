// 10083 把水搅浑（Stir the Pot）· 潜袭（Rogue）事件 · 3 资源 · 5 经验 · [[技巧]]/[[谋略]]
//
// 卡面：谈判。选择你所在地点的一个敌人并检定 [intellect](X)，X 为该敌人的伤害值与恐惧值之和。
//   如果你检定成功，对你所在地点的每个敌人造成 X 点伤害。本效果结算后，你可以与每个敌人
//   解除交战状态并移动到一个连接地点。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 「谈判。」：played 描述子 `countsAs: 'parley'`（不引发借机攻击）。
//   · 「X = 所选敌人的伤害值与恐惧值之和」：敌人实例的印刷数值 `enemy.damage` / `enemy.horror`
//     （与 04105「精神打击」等「按敌人伤害/恐惧算难度」的卡同一读法）。
//   · 检定：api.test(seat, 'intellect', X)（performTest 唯一入口），结果读 result.summary.success。
//   · 「对同地点每个敌人造成 X 点伤害」：对每个敌人调用 api.damageEnemy(enemy, X, seat, CODE)
//     （伤害唯一写点：canDamageEnemy 判定、击败结算、胜利区都在同一条管线）。
//   · 「结算后，你可以与每个敌人解除交战并移动到一个连接地点」：api.disengageAll(seat)
//     （disengageAll 唯一写点）+ api.moveInvestigator(seat, destination)（movement.js#relocateInvestigator）。
//     是否移动由玩家选择（可跳过）。
const CODE = '10083'

export default {
  code: CODE,
  name: 'Stir the Pot',
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      label: '谈判：检定[智力](X)，成功对同地点每个敌人造成 X 伤害，然后可解除交战并移动',
      resolve: ({ state, inv, api }) => {
        const enemiesHere = api.enemiesAt(inv.location).filter(enemy => !enemy.defeated && !enemy.removedFromGame)
        if (!enemiesHere.length) {
          api.info('「把水搅浑」：你所在地点没有敌人。')
          return
        }
        const enemyId = enemiesHere.length === 1 ? enemiesHere[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「把水搅浑」：选择要谈判的敌人。',
          options: enemiesHere.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const chosen = enemiesHere.find(enemy => enemy.id === enemyId) || enemiesHere[0]
        const x = Math.max(0, (Number(chosen.damage) || 0) + (Number(chosen.horror) || 0))
        const result = api.test(inv.seat, 'intellect', x, {
          source: { type: 'effect', label: '把水搅浑' },
        })
        if (!result?.summary?.success) {
          api.info(`「把水搅浑」：智力检定失败（难度 ${x}），没有造成伤害。`)
          return
        }
        api.info(`🔥 「把水搅浑」：智力检定成功，对所在地点的每个敌人造成 ${x} 点伤害。`)
        for (const enemy of api.enemiesAt(inv.location).slice()) {
          if (enemy.defeated || enemy.removedFromGame) continue
          api.damageEnemy(enemy, x, inv.seat, CODE)
        }
        const here = (state.locations || []).find(location => location.id === inv.location)
        const destinations = [...new Set(here?.connections || [])]
          .filter(id => (state.locations || []).some(location => location.id === id))
        if (!destinations.length) {
          api.info('「把水搅浑」：所在地点没有连接地点，无法移动。')
          return
        }
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '「把水搅浑」：是否与每个敌人解除交战并移动到一个连接地点？',
          options: [{ id: 'stay', label: '留在原地' }, { id: 'move', label: '解除交战并移动' }],
        })
        if (answer !== 'move') return
        const destination = destinations.length === 1 ? destinations[0] : api.choice({
          kind: 'location', source: CODE, seat: inv.seat,
          prompt: '「把水搅浑」：选择要移动到的连接地点。',
          options: destinations.map(id => ({ id, label: api.scenario.locationName(id) })),
        })
        const to = destinations.includes(destination) ? destination : destinations[0]
        api.disengageAll(inv.seat)
        api.moveInvestigator(inv.seat, to)
        api.info(`🚶 「把水搅浑」：与每个敌人解除交战，移动到「${api.scenario.locationName(to)}」。`)
      },
    },
  ],
  modifiers: [],
}
