// 08108 虚影易位
// 卡面：选择一个位于已揭示地点的非[[精英]]敌人，且其所在地点与你的连接次数不超过2。与该敌人交换位置。
//
// 读点：连接次数用 state.locations[].connections 只读 BFS（<=2 跳）；交换位置走
// api.moveInvestigator（你到敌人地点）与 api.moveEnemy（敌人到你原地点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

const distance = (state, from, to, max = 2) => {
  if (!from || !to) return Infinity
  const queue = [[from, 0]]
  const seen = new Set([from])
  while (queue.length) {
    const [current, steps] = queue.shift()
    if (current === to) return steps
    if (steps >= max) continue
    for (const next of state.locations.find(item => item.id === current)?.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Infinity
}

export default {
  code: '08108',
  abilities: [
    { kind: 'played', label: '选择 2 连接内已揭示地点的非精英敌人，与其交换位置',
      resolve: ({ inv, state, api }) => {
        const origin = inv.location
        const candidates = state.enemies.filter(enemy => !enemy.defeated && !enemy.elite
          && state.locations.find(location => location.id === enemy.location)?.revealed
          && distance(state, origin, enemy.location) <= 2)
        if (!candidates.length) { api.info('2 个连接内没有可交换位置的非精英敌人。'); return }
        const enemyId = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'target', source: '08108', seat: inv.seat,
          prompt: '选择要交换位置的敌人。', options: candidates.map(enemy => ({
            id: enemy.id, label: `${enemy.name}（${api.locName(enemy.location)}）`,
          })) })
        const enemy = candidates.find(item => item.id === enemyId) || candidates[0]
        const destination = enemy.location
        // 先移动调查员到敌人地点，再把敌人移回原地点：relocateEnemy 会解除交战并带走敌人，
        // 避免「先移敌人后移调查员」时被交战敌人跟随。
        api.moveInvestigator(inv.seat, destination)
        api.moveEnemy(enemy, origin)
      } },
  ],
  modifiers: [],
}
