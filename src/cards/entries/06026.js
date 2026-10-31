// 06026 冤大头
// 卡面：多重。
//       获得2资源并抽取1张卡牌。
//       [reaction]你打出冤大头后：免费从你手牌中打出另一张冤大头。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06026 冤大头：
//   · 主效果在 played 描述子里（获得 2 资源 + 抽 1 张）。
//   · 「打出后免费再打一张」是该牌自己的 [reaction]，但事件牌结算后已经离开手牌/不在能力源枚举里，
//     引擎的 reaction 描述子（以及 eventPlayed 窗口）枚举不到它；因此按同一张牌的一次性逻辑，
//     在 played resolve 末尾用 api.choice + api.playCardFromHandFree 续打。第二张打出的牌会走
//     完整 doPlay（重新结算打出效果与反应窗口），逐张连锁的可见结果与卡面一致。

export default {
  code: '06026',
  abilities: [
    {
      kind: 'played',
      label: '获得 2 资源并抽 1 张牌；可免费打出另一张冤大头',
      resolve: ({ inv, api }) => {
        api.gainResources(inv.seat, 2)
        api.drawCards(inv.seat, 1)
        if (!(inv.hand || []).includes('06026')) return
        const answer = api.choice({
          kind: 'effect', source: '06026', seat: inv.seat, canSkip: true,
          prompt: '是否免费从手牌中打出另一张「冤大头」？',
          options: [{ id: 'skip', label: '不打出' }, { id: 'play', label: '免费打出另一张' }],
        })
        if (answer !== 'play') return
        if (api.playCardFromHandFree(inv.seat, '06026')) {
          api.info(`${inv.name} 用「冤大头」免费打出了另一张「冤大头」。`)
        }
      },
    },
  ],
  modifiers: [],
}
