// 60324 悄然遁去
// 卡面：躲避。本次躲避尝试中，将你的[intellect]加到你的技能值上。如果你成功超过难度至少1点，且被躲避的敌人不是[[精英]]，该敌人在下一个补给阶段不重整。如果你成功超过难度至少3点，你的回合结束时将悄然遁去返回手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60324',
  playCondition: [{ when: ({ state, inv }) => state.enemies.some(enemy => enemy.engagedSeat === inv.seat), message: '没有交战的敌人' }],
  abilities: [{
    kind: 'played', countsAs: 'evade',
    label: '躲避时加上智识；超过 1 点非精英下一个补给阶段不重整，超过 3 点回合结束收回',
    resolve: ({ inv, api, context }) => {
      const enemy = api.chooseEnemy(inv.seat, { type: 'evade' })
      if (!enemy) return
      api.evade(inv.seat, {
        enemyId: enemy.id, addSkill: 'intellect', skipReadyRounds: 1,
        skipReadyRoundsIfSuccessBy: 1, skipReadyRoundsNonElite: true,
        onSuccess: ({ result }) => {
          if (result.value - result.difficulty >= 3) api.returnPlayedEventAtEndOfTurn(context)
        },
      })
    },
  }],
}
