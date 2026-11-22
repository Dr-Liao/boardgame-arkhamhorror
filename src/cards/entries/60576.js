// 60576 游击策略（升级版）· 事件（1 费，2 经验，战术）
// 卡面：攻击([combat])或躲避([agility])。你本次检定得到技能值 +2。
//       你可以将连接地点的一个敌人作为对象，如同你与该敌人交战。
//       如果你检定成功，对该敌人造成额外 1 点伤害。
const CODE = '60576'

function targetable(state, inv) {
  const here = state.locations.find(location => location.id === inv.location)
  const connected = new Set(here?.connections || [])
  return state.enemies.filter(enemy => enemy.location === inv.location || connected.has(enemy.location))
}

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    label: '攻击或躲避一个敌人（含连接地点），技能值 +2；成功时额外 1 伤害',
    resolve: ({ state, inv, api }) => {
      const enemies = targetable(state, inv)
      if (!enemies.length) return
      const action = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '游击策略：选择攻击或躲避。',
        options: [{ id: 'fight', label: '攻击（战斗 +2）' }, { id: 'evade', label: '躲避（敏捷 +2）' }],
      })
      const options = enemies.map(enemy => ({ id: enemy.id, label: api.cardName(enemy.code) }))
      const enemyId = options.length === 1 ? options[0].id : api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '游击策略：选择目标敌人（可在连接地点）。', options,
      })
      if (!enemyId) return
      if (action === 'evade') api.evade(inv.seat, { enemyId, addSkill: 'agility', evasionBonus: 2 })
      else api.fight(inv.seat, enemyId, { combatBonus: 2, damageBonus: 1 })
    },
  }],
  modifiers: [],
  note: '近似：「如同与该敌人交战」不改变实际交战状态；成功额外伤害并入攻击 damageBonus。',
}
