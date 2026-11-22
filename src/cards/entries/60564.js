// 60564 游击策略 · 事件（1 费，攻击/躲避）
// 卡面：攻击([combat])或躲避([agility])。你本次检定得到技能值 +1。
//       你可以将连接地点的一个敌人作为对象，如同你与该敌人交战。
// 近似：引擎攻击/躲避允许直接指定敌人 id（含连接地点的敌人），可完整表达目标；
//       「视为交战」的交战状态未改变（引擎没有可跨地点的临时交战状态）。
const CODE = '60564'

function targetable(state, inv) {
  const here = state.locations.find(location => location.id === inv.location)
  const connected = new Set(here?.connections || [])
  return state.enemies.filter(enemy => enemy.location === inv.location || connected.has(enemy.location))
}

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    label: '攻击或躲避一个敌人（含连接地点），技能值 +1',
    resolve: ({ state, inv, api }) => {
      const enemies = targetable(state, inv)
      if (!enemies.length) {
        api.info('游击策略：没有可攻击/躲避的敌人。')
        return
      }
      const action = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '游击策略：选择攻击或躲避。',
        options: [{ id: 'fight', label: '攻击（战斗 +1）' }, { id: 'evade', label: '躲避（敏捷 +1）' }],
      })
      const options = enemies.map(enemy => ({ id: enemy.id, label: api.cardName(enemy.code) }))
      const enemyId = options.length === 1 ? options[0].id : api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '游击策略：选择目标敌人（可在连接地点）。', options,
      })
      if (!enemyId) return
      if (action === 'evade') api.evade(inv.seat, { enemyId, addSkill: 'agility' })
      else api.fight(inv.seat, enemyId, { combatBonus: 1 })
    },
  }],
  modifiers: [],
  note: '近似：「如同与该敌人交战」不改变实际交战状态（无跨地点临时交战原语）。',
}
