// 06279 智慧古书
// 卡面：使用(2秘密)。
//       [action] 横置智慧古书：选择你所在地点的一位调查员。该调查员查找其牌库顶3张卡牌，找出一张将其抽取，
//       并将剩余卡牌混洗入自己牌库。然后，你可以花费1秘密，使该调查员立即打出该卡牌，其费用-2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06279 智慧古书：[[书籍]]支援，使用(2 秘密)。
//   · [action] 横置自身 → cost:{ action:true, exhaust:true }；
//   · 选同地点一位调查员 → target:{ kind:'investigator' }（legalMoves 逐目标展开，执行时 ctx.target 就位）；
//   · 查找牌库顶 3 张、选 1 张抽取、其余洗回 → api.lookAt（choose:1 + returnStrategy:'shuffle'，
//     返回被取走的卡号；「查找牌库前」的额外张数窗口也由同一原语接入）；
//   · 可花费 1 秘密让其立即打出、费用 -2 → api.moveCard 进入手牌后 api.playCard(..., { discount:2 })
//     （discount 写的是引擎的打出折扣读点 campaignState.playDiscount，付费时按 -2 结算）。

export default {
  code: '06279',
  uses: 2,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '横置：一位调查员查找牌库顶 3 张，抽 1 张并洗回；可花 1 秘密让其费用 -2 立即打出',
      cost: { action: true, exhaust: true },
      target: { kind: 'investigator', label: '你所在地点的一位调查员' },
      resolve: ({ inv, api, target }) => {
        const targetSeat = Number.isInteger(target?.entity?.seat) ? target.entity.seat : inv.seat
        const taken = api.lookAt(targetSeat, {
          zone: 'deck',
          count: 3,
          choose: 1,
          returnStrategy: 'shuffle',
          source: '06279',
          prompt: '从牌库顶 3 张中选择 1 张抽取。',
        })
        const code = Array.isArray(taken) ? taken[0] : null
        if (!code) { api.info('没有找到可以抽取的卡牌。'); return }
        api.info(`📖 ${api.cardName('06279')}：${inv.name} 让一位调查员抽走了「${api.cardName(code)}」。`)
        if ((inv.assets || []).every(item => item.code !== '06279')) return
        const book = (inv.assets || []).find(item => item.code === '06279')
        if (!book || (book.uses || 0) < 1) return
        const answer = api.choice({
          kind: 'effect', source: '06279', seat: inv.seat,
          prompt: `是否花费 1 秘密，让该调查员立即打出「${api.cardName(code)}」（费用 -2）？`,
          options: [{ id: 'pay', label: '花费 1 秘密并打出' }, { id: 'skip', label: '不打出' }],
        })
        if (answer !== 'pay') return
        api.addUses(book, -1)
        api.playCard(targetSeat, code, { discount: 2 })
      },
    },
  ],
  modifiers: [],
}
