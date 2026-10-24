// 04195 暴露弱点
// 卡面：快速。在任意[free]玩家时间段期间打出。
// 卡面：选择你所在地点的一个敌人。检定[intellect](X)，其中X等于该敌人的攻击值。如果你检定成功，本阶段下次对该敌人执行的攻击中，将该敌人的攻击值视为0。抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04195',
  abilities: [
    {
      kind: 'played',
      label: '暴露弱点',
      fast: true,
      resolve: ({ state, inv, api }) => {
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!enemies.length) { api.info('本地点没有可选择弱点的敌人。'); return }
        const enemy = enemies.length === 1 ? enemies[0] : enemies.find(item => item.id === api.choice({
          kind: 'target', source: '04195', seat: inv.seat, prompt: '选择要暴露弱点的敌人。',
          options: enemies.map(item => ({ id: item.id, label: item.name })),
        }))
        if (!enemy) return
        const difficulty = api.enemyFight(enemy, inv.seat)
        api.test(inv.seat, 'intellect', difficulty, {
          source: { label: '揭露弱点', name: enemy.name, code: '04195' },
          resolve: result => {
            if (result.success) {
              // 引擎已有 exposeWeakness 读点：本阶段下一次对该敌人的攻击攻击值视为 0。
              enemy.exposeWeakness = { round: state.round, phase: state.phase }
              api.info(`「${enemy.name}」本阶段下一次被攻击时攻击值视为 0。`)
            }
            // 卡面「抽取 1 张卡牌」在「如果你检定成功」之外：成功或失败都无条件结算。
            api.drawCards(inv.seat, 1)
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
