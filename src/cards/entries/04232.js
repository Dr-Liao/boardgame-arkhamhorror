// 04232 悄然遁去
// 卡面：躲避。本次躲避尝试将你的[intellect]加入你的技能值。如果你检定成功且超过难度至少2点，且被躲避的敌人非[[精英]]，其在下一个补给阶段期间不重整。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04232 悄然遁去：躲避时加入智识；成功超过 2 点且非精英时下个补给阶段不重整。

export default {
  code: '04232',
  abilities: [
    {
      kind: 'played', label: '悄然遁去',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat)
        if (!targets.length) { api.info('没有可躲避的交战敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04232', seat: inv.seat,
            prompt: '选择要躲避的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.evade(inv.seat, { enemyId: chosen, addSkill: 'intellect', skipReadyRounds: 1,
          skipReadyRoundsIfSuccessBy: 2, skipReadyRoundsNonElite: true })
      },
    },
  ],
  modifiers: [

  ],
}
