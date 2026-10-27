// 04312 临时路障
// 卡面：你可以从你的弃牌堆中打出临时路障。如果你这么做，结算效果后将其洗入你的牌库。
// 卡面：躲避。所选敌人本次躲避尝试得到-1躲避值。(如果你从弃牌堆中打出了临时路障，你可以躲避同地点的额外一个躲避值不超过X的敌人。X为你检定成功且超过难度的点数。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04312 临时屏障：躲避交战敌人（-1）；从弃牌堆打出时可额外躲避第二个敌人。
// 注意：卡面没有「快速」，不要加 fast（打出需 1 个行动点，且不能在任意窗口打出）。
//
// 2026-10-27 修复（白吞卡）：「躲避。」事件必须有可躲避的敌人才能结算。旧实现无目标时只写
// 一行日志就弃牌，费用/行动照付。补 playCondition，并与 resolve 共用同一份候选。

function evadeTargets(state, inv) {
  return state.enemies.filter(enemy => enemy.engagedSeat === inv.seat
    || (enemy.massive && enemy.location === inv.location))
}

export default {
  code: '04312',
  playableFromDiscard: true,
  shuffleBackAfterPlay: true,
  playCondition: [{
    when: ({ state, inv }) => evadeTargets(state, inv).length > 0,
    message: '没有可躲避的交战敌人',
  }],
  abilities: [
    {
      kind: 'played', id: 'impromptuBarrier', label: '躲避一名交战敌人（-1）',
      // 卡面「躲避。」= Evade 行动：打出按躲避结算，不引发借机攻击。
      countsAs: 'evade',
      resolve: ({ state, inv, api }) => {
        const fromDiscard = api.fromDiscardCode() === '04312'
        const targets = evadeTargets(state, inv)
        if (!targets.length) { api.info('没有可躲避的交战敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '04312',
          seat: inv.seat, prompt: '选择要躲避的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.evade(inv.seat, { enemyId: enemy.id, evadeModifier: -1,
          evadeSecondUpTo: fromDiscard ? Number.MAX_SAFE_INTEGER : 0 })
      },
    },
  ],
  modifiers: [

  ],
}
