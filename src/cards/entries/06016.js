// 06016 派翠丝的小提琴
// 卡面：派翠丝·海瑟薇牌组专用。
//       [fast] 选择并弃掉你 1 张手牌，横置派翠丝的小提琴：选择你所在地点的一位调查员，
//       该调查员获得 1 资源或抽取 1 张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 费用 `discardHand` 由引擎统一询问「弃哪一张」（ability-exec.js 的 discardChosenCards），
// 因此这里不重复实现弃牌；目标与收益在 resolve 里用 api.choice 询问。

export default {
  code: '06016',
  abilities: [
    {
      kind: 'free',
      label: '弃 1 张手牌并横置：同地点一位调查员获得 1 资源或抽 1 张牌',
      cost: { action: false, exhaust: true, discardHand: 1 },
      resolve: ({ inv, api }) => {
        const targets = api.investigatorsAt(inv.location)
        if (!targets.length) return
        const seatId = targets.length === 1 ? String(targets[0].seat)
          : api.choice({
            kind: 'investigator', source: '06016', seat: inv.seat,
            prompt: '选择你所在地点的一位调查员。',
            options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })),
          })
        const target = targets.find(owner => String(owner.seat) === String(seatId)) || targets[0]
        const reward = api.choice({
          kind: 'effect', source: '06016', seat: inv.seat,
          prompt: `「${api.cardName('06016')}」：${target.name} 获得 1 资源，还是抽取 1 张卡牌？`,
          options: [{ id: 'resource', label: '获得 1 资源' }, { id: 'draw', label: '抽取 1 张卡牌' }],
        })
        if (reward === 'draw') api.drawCards(target.seat, 1)
        else api.gainResources(target.seat, 1)
      },
    },
  ],
  modifiers: [],
}
