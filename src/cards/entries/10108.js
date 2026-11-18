// 10108 火柴盒（Matchbox）· 幸存者支援 · 1 资源 · 无槽位 · [[道具]]/[[工具]]
// 卡面：
//   使用（3 补给）。如果火柴盒没有补给，将其弃掉。
//   [fast] 在任意调查员的回合期间，横置火柴盒并花费 1 补给：你所在地点的隐蔽值 -1，直到本回合结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「使用（3 补给）」= 条目级 uses / usesType（stats.js#assetEffect 的元数据读点，实例初始化同源）。
//   · 「没有补给就弃掉」= 条目级 discardWhenEmpty（executeDescriptor 用完即弃的唯一读点）。
//   · 「[fast]」= kind:'free'（descriptorCost 把行动费压成 0），费用「横置 + 花费 1 补给」=
//     cost { exhaust:true, uses:1 }（ability-rules.js#payAbilityCost）。
//   · 「在任意调查员的回合期间」：free 能力会被每个玩家窗口向所有调查员询问（encounter.js#playerWindow），
//     因此**不写** ownTurn() 限制就是「任意调查员的回合」（02108/08098 的注释记录着同一读点的两面）。
//   · 「你所在地点隐蔽值 -1 直到本回合结束」= api.tempShroudMod(location, -1)
//     （actions.js#runInvestigate 的临时帷幕读点，按 round + 当前回合座位过期；04306/03266 同款）。
export default {
  code: '10108',
  name: '火柴盒',
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'free',
      label: '快速：横置火柴盒并花费 1 补给；你所在地点本回合隐蔽值 -1',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const here = (state.locations || []).find(location => location.id === inv.location)
        if (!here) return
        api.tempShroudMod(here, -1)
        api.info(`🔥 「火柴盒」：你所在地点的隐蔽值 -1，直到本回合结束。`)
      },
    },
  ],
  modifiers: [],
}
