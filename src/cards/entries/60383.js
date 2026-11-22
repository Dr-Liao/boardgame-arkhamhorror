// 60383 以防万一（Contingency，André Patel，3 XP）· 技能
// 卡面：[以防万一]投入到以敌人为对象的技能检定时，揭示混乱标记后，你可以花费 3 资源以取消一个已揭示的标记，
//       将其放回混乱袋，并揭示一个新标记。（你可以执行任意次。）
//
// 读点（批次 3 原语）：
//   · 投入档案 onChaosTokenRevealed({ state, inv, source, test, token, api })：引擎在每次揭示混乱标记后
//     对每张已投入卡调用（tests.js#performTest 标记揭示段）；
//   · 支付 3 资源 = api.spendResources(seat, 3)（resource-bank 唯一扣费点）；
//   · 「取消该标记并揭示一个新标记」= api.playerTools.allowTokenRedraws(1)：引擎在钩子之后消费该额度，
//     归还当前标记并补揭示一个新标记（与引擎既有「取消并重抽」同一条管线）。
// 限制：只在「以敌人为对象的技能检定」有效 —— commitCondition 在投入窗口先挡一次，
// 钩子里再判一次 test.source.enemyId，避免非敌人检定被误询问。
const CODE = '60383'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '投入敌人检定后：可花 3 资源取消已揭示标记并重抽（任意次）',
      skill: {
        commitCondition: ({ test }) => Boolean(test?.source && test.source.enemyId != null),
        onChaosTokenRevealed: ({ inv, token, api }) => {
          if (!token || token === 'autofail') return
          if ((inv.resources || 0) < 3) return
          const pay = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '以防万一：是否花费 3 资源取消该标记并重抽？',
            options: [{ id: 'skip', label: '不支付' }, { id: 'pay', label: '支付 3 资源' }],
          })
          if (pay !== 'pay') return
          api.spendResources(inv.seat, 3)
          api.playerTools.allowTokenRedraws(1)
        },
      },
    },
  ],
  modifiers: [],
}
