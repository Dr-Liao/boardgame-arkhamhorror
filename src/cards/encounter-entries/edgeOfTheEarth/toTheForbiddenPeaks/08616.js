// 08616 炸药（Dynamite）· storyAsset
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   使用(2补给)。
//   [action]花费1补给并横置炸药：选择你所在地点或一个连接地点。对所选地点的每个敌人和每位调查员各造成3点伤害。
//
// 读点：action 描述子 → legalMoves/doAbility；目标地点用 api.choice 现选（此地/连接地点），
// 伤害只走 api.damageEnemy / api.harm 权威入口。
export default {
  code: '08616',
  scope: 'storyAsset',
  implemented: true,
  uses: 2,
  usesType: 'supplies',
  flags: { expedition: true },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '花费 1 补给并横置：对所在地点或一个连接地点的每个敌人与调查员各造成 3 点伤害',
    cost: { action: true, exhaust: true, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const here = state.locations.find(location => location.id === inv.location)
      if (!here) return
      const targets = [here.id, ...(here.connections || [])
        .filter(id => state.locations.some(location => location.id === id))]
      const chosen = targets.length === 1 ? targets[0] : api.choice({
        kind: 'location', source: '08616', seat: inv.seat,
        prompt: '炸药：选择地点（你所在地点或一个连接地点）。',
        options: targets.map(id => ({ id, label: state.locations.find(location => location.id === id)?.name || id })),
      })
      const locationId = targets.includes(chosen) ? chosen : targets[0]
      for (const enemy of state.enemies || []) {
        if (enemy.defeated || enemy.location !== locationId) continue
        api.damageEnemy(enemy, 3, inv.seat)
      }
      for (const other of state.investigators || []) {
        if (other.defeated || other.resigned || other.location !== locationId) continue
        api.harm(other.seat, { damage: 3 })
      }
      api.info(`🧨 炸药在「${state.locations.find(location => location.id === locationId)?.name || locationId}」爆炸：每个敌人与调查员各受到 3 点伤害。`)
    },
  }],
}
