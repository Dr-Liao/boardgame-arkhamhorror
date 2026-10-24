// 05155 亨利·万
// 卡面：[action]横置亨利·万：依次从混乱袋随机揭示任意个混乱标记，直到你自己选择停下，
// 或直到你揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号。
// - 如果你选择停下，你通过本效果每揭示一个标记，你可以抽取1张卡牌或获得1资源。
// - 如果你揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，无事发生。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：逐枚揭示走 api.revealChaosTokens(1)（02013 同一原语），停下/继续与每枚标记的
// 「抽牌或获得资源」都在 resolve 里询问；随机只走引擎的 chaosBag。

const BAD_SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail']

export default {
  code: '05155',
  abilities: [
    {
      kind: 'action', label: '横置：逐枚揭示混乱标记，停下则每枚抽 1 或获得 1 资源',
      cost: { action: true, exhaust: true },
      resolve: ({ inv, api }) => {
        const revealed = []
        for (let guard = 0; guard < 100; guard++) {
          const token = api.revealChaosTokens(1)[0]
          if (token == null) { api.info('混乱袋里没有标记。'); break }
          revealed.push(token)
          if (BAD_SYMBOLS.includes(token)) {
            api.info(`亨利·万揭示了 ${api.tokenLabel(token)}：无事发生。`)
            return
          }
          const answer = api.choice({ kind: 'effect', source: '05155', seat: inv.seat,
            prompt: `亨利·万：当前已揭示 ${revealed.length} 枚（${revealed.map(face => api.tokenLabel(face)).join('、')}）。继续揭示，还是停下？`,
            options: [{ id: 'stop', label: '停下' }, { id: 'continue', label: '继续揭示' }] })
          if (answer !== 'continue') {
            for (const face of revealed) {
              const reward = api.choice({ kind: 'effect', source: '05155', seat: inv.seat,
                prompt: `亨利·万：${api.tokenLabel(face)} → 抽 1 张牌或获得 1 资源。`,
                options: [{ id: 'draw', label: '抽 1 张牌' }, { id: 'resources', label: '获得 1 资源' }] })
              if (reward === 'resources') api.gainResources(inv.seat, 1)
              else api.drawCards(inv.seat, 1)
            }
            api.info(`亨利·万停了：结算 ${revealed.length} 枚揭示的标记。`)
            return
          }
        }
      },
    },
  ],
  modifiers: [],
}
