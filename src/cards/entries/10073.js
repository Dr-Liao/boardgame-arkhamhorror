// 10073 把水搅浑（Stir the Pot）· 潜袭者（Rogue）事件 · 3 费 · [[诡计]]/[[策略]]。
// 卡面：谈判。选择你所在地点的一个敌人并检定[智力](X)，其中 X 为所选敌人的伤害值与恐惧值之和。
//       如果你检定成功，对你所在地点的每个敌人造成 2 点伤害。如果你检定成功且超过难度至少 2 点，
//       本效果结算后，你可以与每个敌人解除交战并移动到一个连接地点。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「谈判。」→ countsAs:'parley'，不引发借机攻击。
//   · X = enemy.damage + enemy.horror（印刷值，实体读点）。
//   · 「对每个敌人造成 2 点伤害」→ 逐个 api.damageEnemy（可被击败、开敌人受伤害窗口）。
//   · 「解除交战并移动」→ api.disengageEnemy + api.moveInvestigator（移动的唯一入口）。

// 「该敌人不能被谈判」的窄判据：条目声明的禁止标记（完整读点见 engine/parley.js#parleyForbidden；
// 卡文件不 import 引擎，P7 若需要统一改由共享原语暴露）。
const parleyForbidden = (state, inv, entity) => Boolean(entity?.cannotParley || entity?.parleyForbidden)


const CODE = '10073'

const parleyEnemies = (state, inv) => (state.enemies || []).filter(enemy =>
  enemy.location === inv.location && !parleyForbidden(state, inv, enemy))

const connectionsOf = (state, locationId) => {
  const here = (state.locations || []).find(location => location.id === locationId)
  return (here?.connections || [])
    .map(id => (state.locations || []).find(location => location.id === id))
    .filter(Boolean)
}

export default {
  code: CODE,
  playCondition: [{
    when: ({ state, inv }) => parleyEnemies(state, inv).length > 0,
    message: '所在地点没有可谈判的敌人',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      noOpportunityAttack: true,
      label: '谈判：检定[智力](X=所选敌人伤害+恐惧)；成功对同地点每个敌人造成 2 伤害，超过 2 点可解除交战并移动',
      resolve: ({ state, inv, api }) => {
        const enemies = parleyEnemies(state, inv)
        if (!enemies.length) {
          api.info('「把水搅浑」：你所在地点没有可谈判的敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「把水搅浑」：选择要谈判的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        const difficulty = Math.max(0, (Number(enemy.damage) || 0) + (Number(enemy.horror) || 0))
        api.info(`🍲 「把水搅浑」：与「${enemy.name}」谈判，检定[智力](${difficulty})。`)
        api.test(inv.seat, 'intellect', difficulty, {
          source: { code: CODE, label: '谈判', actionKind: 'parley', enemyId: enemy.id, name: enemy.name },
          resolve: result => {
            if (!result.success) return
            const here = (api.enemiesAt(inv.location) || []).slice()
            for (const target of here) {
              if (!state.enemies.includes(target)) continue
              api.damageEnemy(target, 2, inv.seat, CODE)
            }
            api.info('🍲 「把水搅浑」：对你所在地点的每个敌人造成 2 点伤害。')
            const successBy = Math.max(0, Number(result.summary?.successBy
              ?? (Number(result.value) || 0) - (Number(result.difficulty) || 0)) || 0)
            if (successBy < 2) return
            const destinations = connectionsOf(state, inv.location)
            if (!destinations.length) return
            const answer = api.choice({
              kind: 'effect', source: CODE, seat: inv.seat,
              prompt: '「把水搅浑」：你可以与每个敌人解除交战并移动到一个连接地点。',
              options: [
                { id: 'move', label: '与每个敌人解除交战，然后移动' },
                { id: 'stay', label: '留在原地' },
              ],
            })
            if (answer !== 'move') return
            for (const target of (state.enemies || []).slice()) {
              if (target.engagedSeat === inv.seat) api.disengageEnemy(target)
            }
            const destinationId = destinations.length === 1 ? destinations[0].id : api.choice({
              kind: 'location', source: CODE, seat: inv.seat,
              prompt: '「把水搅浑」：选择要移动到的连接地点。',
              options: destinations.map(location => ({ id: location.id, label: api.locationName(location.id) })),
            })
            if (!state.locations.some(location => location.id === destinationId)) return
            api.moveInvestigator(inv.seat, destinationId)
            api.info(`🍲 「把水搅浑」：${inv.name} 与所有敌人解除交战并移动到「${api.locationName(destinationId)}」。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
