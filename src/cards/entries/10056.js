// 10056 棱相眼镜（Prismatic Spectacles）· 探求者支援 · 2 经验 · 费用 2 · 饰品槽 · 道具/遗物/诅咒。
//
// 卡面：[action] 在混乱袋中加入 1 个[curse]标记：调查。你本次调查得到技能值 +2。
//       如果本次调查期间揭示了[curse]标记，你可以横置棱相眼镜以发现你所在地点的额外 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「在混乱袋中加入 1 个[curse]标记」是费用（冒号前）→ 描述子 `additionalTokenCost`
//     （token-cost.js 的唯一校验/支付读点，ability-rules.js 的 canAffordAbility / payAbilityCost
//     共用；袋满时这条行动不出现）。
//   · 「调查。」= `countsAs: 'investigate'`（借机攻击/行动种类读点）。
//   · 「得到技能值 +2」→ api.investigate 的 `bonus`（actions.js#doInvestigate 的固定技能加值）；
//     返回值是 performTest 的标准结果（含 drawn 列表）。
//   · 「揭示了[curse]标记」→ result.drawn（本次调查揭示的全部标记，含诅咒额外揭示的那一个）。
//   · 「横置棱相眼镜以发现额外 1 个线索」→ api.exhaust（横置；同时派发 assetExhausted 窗口）+
//     api.discoverClue（locations.js#discoverClueAt 的唯一发现入口）。
const CODE = '10056'
const CURSE = 'curse'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      label: '加入 1 个[curse]标记：调查 +2；若本次调查揭示了[curse]，横置本卡额外发现 1 个线索',
      cost: { action: true },
      additionalTokenCost: { token: CURSE, operation: 'add', count: 1 },
      resolve: ({ state, inv, source, api }) => {
        const result = api.investigate(inv.seat, { assetId: source?.id, sourceCode: CODE, bonus: 2 })
        const drawn = result?.drawn || []
        if (!drawn.includes(CURSE)) return
        if (!source || source.exhausted) return
        const here = state.locations.find(location => location.id === inv.location)
        if (!here || (here.clues || 0) <= 0) return
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '本次调查揭示了[curse]标记：横置棱相眼镜，发现你所在地点的额外 1 个线索？',
          options: [
            { id: 'trigger', label: '横置棱相眼镜并额外发现 1 个线索' },
            { id: 'skip', label: '不横置' },
          ],
        })
        if (answer !== 'trigger') return
        api.exhaust(source)
        const got = api.discoverClue(inv.seat, 1)
        api.info(`👓 「棱相眼镜」：横置自身，额外发现 ${got} 个线索。`)
      },
    },
  ],
  modifiers: [],
}
