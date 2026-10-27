// 04027 窃听
// 卡面：选择你所在地点的一个未处于交战状态的敌人。检定[intellect](X)，其中X为所选敌人的躲避值。如果你检定成功，发现你所在地点的2个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04027 窃听：对抗一名未交战敌人的躲避值；成功发现 2 个线索。
//
// 2026-10-27 修复（白吞卡）：这张事件必须选择一名未交战的敌人才能结算。旧实现无目标时只写
// 一行日志就弃牌，费用/行动照付。补 playCondition，并与 resolve 共用同一份候选。

function eavesdropTargets(state, inv) {
  return state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat == null)
}

export default {
  code: '04027',
  playCondition: [{
    when: ({ state, inv }) => eavesdropTargets(state, inv).length > 0,
    message: '所在地点没有未交战的敌人',
  }],
  abilities: [
    {
      kind: 'played', label: '窃听',
      resolve: ({ state, inv, api }) => {
        const targets = eavesdropTargets(state, inv)
        if (!targets.length) { api.info('这里没有未交战的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04027', seat: inv.seat, prompt: '选择要窃听的敌人。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.test(inv.seat, 'intellect', api.enemyEvade(enemy), {
          source: { label: '窃听', enemyId: enemy.id, name: enemy.name, code: '04027' },
          resolve: result => { if (result.success) api.discoverClue(inv.seat, 2) },
        })
      },
    },
  ],
  modifiers: [

  ],
}
