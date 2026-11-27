// 09045 研究笔记（Research Notes）· 探求者资产 · 手槽 · 费用 1。
// 卡面：[reaction] 在一个玩家卡牌能力将你的线索放到你所在地点后：将相等数量的资源放在研究笔记上，
//       作为证据。
//       [action]：检定[intellect](0)。你检定成功且每超过难度 1 点，你可以花费 1 证据来发现你所在地点
//       的 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 证据 = 卡实例具名计数器 evidence（api.addCardCounter / card.markers.evidence）；
//   · [action]：api.startTest(intellect 0)，成功值 = value - difficulty，逐点询问是否花 1 证据
//     发现 1 个线索（api.discoverClue）；
export default {
  code: '09045',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'cluesPlaced',
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '玩家卡能力将你的线索放到你所在地点后：放置等量证据',
      criteria: [({ inv, context }) => context.seat === inv.seat && context.location === inv.location
        && context.amount > 0 && context.source?.kind === 'playerCard'],
      resolve: ({ source, context, api }) => api.addCardCounter(source, 'evidence', context.amount),
    },
    {
      kind: 'action',
      label: '检定[智力](0)：成功每超过 1 点，可花 1 证据发现 1 个线索',
      cost: { action: true },
      criteria: [({ state, inv }) => (state.locations.find(item => item.id === inv.location)?.clues || 0) > 0],
      resolve: ({ inv, source, api }) => {
        api.startTest({
          seat: inv.seat, skill: 'intellect', difficulty: 0,
          source: { label: '研究笔记', code: '09045' },
          resolve: result => {
            if (!result?.success) return
            const margin = Math.max(0, (result.value - result.difficulty) || 0)
            for (let index = 0; index < margin; index++) {
              if (api.cardCounterOf(source, 'evidence') < 1 || !api.canDiscoverClueAt(inv.seat, inv.location)) break
              const answer = api.choice({
                kind: 'effect', source: '09045', seat: inv.seat,
                prompt: `研究笔记：是否花费 1 证据发现 1 个线索？（剩余机会 ${margin - index}）`,
                options: [{ id: 'spend', label: '花 1 证据发现 1 个线索' }, { id: 'stop', label: '停止' }],
              })
              if (answer !== 'spend') break
              api.addCardCounter(source, 'evidence', -1)
              api.discoverClue(inv.seat, 1)
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
