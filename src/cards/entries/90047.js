// 90047 皮特的吉他（Pete's Guitar <:> Still Holdin' Up）· 中立支援 · 道具/乐器 · 费用 2。
// 卡面（cards-data 90047）：
//   “灰堆”皮特牌库专用。替换。
//   [fast] 横置皮特的吉他：选择你所在地点或一个连接地点的一个非[[精英]]敌人，将其按你选择的方向移动一次。
//     然后，如果你所在地点没有敌人，治愈 1 点恐惧或获得 1 资源。
//
// 引擎读点：
//   · [fast] 横置使用 = free 描述子 + cost.exhaust（playerWindow 枚举；不花行动）。
//   · 「你所在地点或连接地点」= 只读 state.locations 的连接图 + state.enemies。
//   · 「按你选择的方向移动一次」= 选该敌人所在地点的连接地点后 api.moveEnemy（movement.js 的统一位移入口，
//     会结算入场/交战/移动窗口）。
//   · 「若你所在地点没有敌人：治疗 1 恐惧或获得 1 资源」= api.healHorror / api.gainResources，二选一用 api.choice。
const code = '90047'

function chooseOne(api, inv, prompt, options) {
  return api.choice({ kind: 'effect', source: code, seat: inv.seat, prompt, options })
}

function moveTargets(state, inv) {
  const here = state.locations.find(location => location.id === inv.location)
  const zone = new Set([inv.location, ...(here?.connections || [])])
  return (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.removedFromGame
    && enemy.elite !== true && zone.has(enemy.location))
}

export default {
  code,
  abilities: [{
    kind: 'free',
    cost: { exhaust: true },
    label: '横置：移动一个非精英敌人一次；若你所在地点无敌人，治疗 1 恐惧或获得 1 资源',
    criteria: [({ state, inv }) => moveTargets(state, inv).length > 0 || (state.enemies || []).every(enemy => enemy.location !== inv.location)],
    resolve: ({ state, inv, api }) => {
      const enemies = moveTargets(state, inv)
      if (enemies.length) {
        const chosen = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'enemy', source: code, seat: inv.seat,
          prompt: '皮特的吉他：选择要移动的非[[精英]]敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.locName(enemy.location)}）` })),
        })
        const enemy = enemies.find(item => item.id === chosen)
        if (enemy) {
          const origin = state.locations.find(location => location.id === enemy.location)
          const destinations = (origin?.connections || []).filter(id => state.locations.some(location => location.id === id))
          if (destinations.length) {
            const destination = destinations.length === 1 ? destinations[0] : api.choice({
              kind: 'location', source: code, seat: inv.seat,
              prompt: `皮特的吉他：选择「${enemy.name}」移动的方向。`,
              options: destinations.map(id => ({ id, label: api.locName(id) })),
            })
            if (destinations.includes(destination)) {
              api.moveEnemy(enemy, destination)
              api.info(`🎸 皮特的吉他：「${enemy.name}」移动到「${api.locName(destination)}」。`)
            }
          }
        }
      }
      const stillHere = (state.enemies || []).some(enemy => !enemy.defeated && !enemy.removedFromGame
        && enemy.location === inv.location)
      if (stillHere) return
      const reward = chooseOne(api, inv, '皮特的吉他：你所在地点没有敌人。选择一项奖励。', [
        { id: 'horror', label: '治愈 1 点恐惧' },
        { id: 'resource', label: '获得 1 资源' },
      ])
      if (reward === 'resource') api.gainResources(inv.seat, 1)
      else api.healHorror(inv.seat, 1)
      api.info(`🎸 皮特的吉他：${reward === 'resource' ? '获得 1 资源' : '治愈 1 点恐惧'}。`)
    },
  }],
  modifiers: [],
}
