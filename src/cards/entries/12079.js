// 12079 “滚开！”（"Shove off!"）
// 卡面：躲避([agility])。如果你检定成功，对躲避的敌人造成 1 点伤害。
//       如果你检定失败，当你的回合结束时，将“滚开！”返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「躲避。」= played 描述子的 countsAs:'evade'（借机攻击判定）；
//   · 躲避主流程 = api.evade（doEvade：与躲避行动同一套检定/警戒/结果结算）；成功后的 1 点伤害
//     用 opts.damageOnSuccess（combat.js 既有读点，与 05016 同源）；
//   · 失败时「回合结束返回手牌」= api.returnPlayedEventAtEndOfTurn(context)（actions.js 的
//     eventPlayed 收尾读点，60323/10102 同一入口）；
//   · 可选目标 = 与「交战或庞大同地点」的敌人（与 04312 同一候选口径）。

const CODE = '12079'

function evadeTargets(state, inv) {
  return (state.enemies || []).filter(enemy => enemy.engagedSeat === inv.seat
    || (enemy.massive && enemy.location === inv.location))
}

export default {
  code: CODE,
  playCondition: [{
    when: ({ state, inv }) => evadeTargets(state, inv).length > 0,
    message: '没有可躲避的交战敌人',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'evade',
      label: '躲避；成功对躲避的敌人造成 1 点伤害，失败则回合结束返回手牌',
      resolve: ({ state, inv, api, context }) => {
        const targets = evadeTargets(state, inv)
        if (!targets.length) {
          api.info('「滚开！」：没有可躲避的交战敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要躲避的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const result = api.evade(inv.seat, { enemyId: enemy.id, damageOnSuccess: 1 })
        if (result && result.success === false) {
          api.returnPlayedEventAtEndOfTurn(context)
          api.info('「滚开！」：躲避失败，本回合结束时返回手牌。')
        }
      },
    },
  ],
  modifiers: [],
}
