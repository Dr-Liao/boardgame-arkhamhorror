// 08110 虚影易位（Ethereal Slip）
// 卡面：选择位于任意一个已揭示地点的非[[精英]]敌人。与该敌人交换位置。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 调查员位移走 api.moveInvestigator（权威效果位移入口，自动揭示/交战）；
//   · 敌人位移走 api.moveEnemy（relocateEnemy 统一处理交战解除/入场与自动交战）；
//   · 先移动调查员、再移动敌人：若先移敌人，敌人会先与我交战，随后调查员移动时会把交战敌人一起带走。
const code = '08110'

export default {
  code,
  // 「选择位于任意一个已揭示地点的非精英敌人」：没有合法目标时事件不能打出。
  playCondition: [{
    when: ({ state }) => (state.enemies || []).some(enemy => !enemy.defeated && !enemy.elite
      && state.locations.some(location => location.id === enemy.location && location.revealed)),
    message: '已揭示地点没有非精英敌人，不能打出「虚影易位」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '与任意已揭示地点的非精英敌人交换位置',
      resolve: ({ state, inv, api }) => {
        const revealed = new Set(state.locations.filter(location => location.revealed).map(location => location.id))
        const candidates = state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && revealed.has(enemy.location))
        if (!candidates.length) {
          api.info('「虚影易位」：已揭示地点没有非精英敌人。')
          return
        }
        const label = enemy => `${enemy.name}（${api.locationName(enemy.location)}）`
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '选择任意已揭示地点的非精英敌人，与它交换位置。',
          options: candidates.map(enemy => ({ id: enemy.id, label: label(enemy) })),
        })
        const enemy = candidates.find(item => item.id === chosenId)
        if (!enemy) return
        const origin = inv.location
        const destination = enemy.location
        if (!destination) return
        if (destination === origin) {
          api.info(`「虚影易位」：「${enemy.name}」与 ${inv.name} 已经在同一地点，没有交换。`)
          return
        }
        api.moveInvestigator(inv.seat, destination)
        api.moveEnemy(enemy, origin)
        api.info(`🌀 「虚影易位」：${inv.name} 与「${enemy.name}」交换了位置。`)
      },
    },
  ],
  modifiers: [],
}
