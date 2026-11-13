// 09088 诅咒连连（String of Curses）· 秘术师事件 · 0 经验。
// 卡面：谈判。选择你所在地点的一个非[[精英]]敌人并（选择一项）：
//       - 自动躲避该敌人并在上面放置 1 个毁灭标记。该敌人不能受到伤害，直到本轮结束。
//         发现你所在地点的 1 个线索。
//       - 如果该敌人有毁灭标记，将其击败。该敌人每有一个毁灭标记，获得 1 资源。
//
// 读点：api.autoEvadeEnemy / api.placeDoomOnCard / api.discoverClue / api.defeatEnemy /
//       api.gainResources；谈判写在 played.countsAs='parley'。
//
// approximation（已写 primitive-request/09088.json）：敌方「本轮不能受到伤害」没有
// 持续实体规则读点（state.effects 只挂玩家修正），本实现只记录到日志，不伪造状态字段。
export default {
  code: '09088',
  simplified: true,
  note: 'approximation: 见 primitive-request/09088.json（敌方「本轮不能受到伤害」缺少持续实体规则读点，未实现）',
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      label: '谈判：自动躲避并放毁灭且发现线索，或按毁灭标记击败敌人并获得资源',
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
        if (!candidates.length) {
          api.info('「诅咒连连」：你所在地点没有非精英敌人。')
          return
        }
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '09088', seat: inv.seat, prompt: '选择要诅咒的非精英敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
        })
        const enemy = candidates.find(item => item.id === chosenId) || candidates[0]
        const mode = api.choice({
          kind: 'effect', source: '09088', seat: inv.seat,
          prompt: '选择结算方式。',
          options: [
            { id: 'evade', label: '自动躲避、放置 1 个毁灭，并发现 1 个线索' },
            { id: 'defeat', label: '若该敌人有毁灭标记，击败它并按毁灭数获得资源' },
          ],
        })
        if (mode === 'defeat') {
          const doom = Number(enemy.doom || 0)
          if (doom <= 0) {
            api.info('「诅咒连连」：该敌人没有毁灭标记，无法击败。')
            return
          }
          api.defeatEnemy(enemy, inv.seat)
          api.gainResources(inv.seat, doom)
          api.info(`💀 「诅咒连连」：击败「${enemy.name || enemy.code}」，获得 ${doom} 资源。`)
          return
        }
        api.autoEvadeEnemy(enemy)
        api.placeDoomOnCard(enemy, 1)
        api.discoverClue(inv.seat, 1)
        api.info(`🌀 「诅咒连连」：自动躲避「${enemy.name || enemy.code}」、放置 1 个毁灭并发现 1 个线索。`)
      },
    },
  ],
  modifiers: [],
}
