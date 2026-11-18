// 10008 失败的实验（Failed Experiment）· 诡计 · 凯特·温斯罗普专属弱点 · [[失误]]
// 卡面：
//   显现 - 检定[willpower](3)。你每控制一个带有线索的支援，本次检定难度 +1。
//   你检定失败且每低于难度 1 点，你必须受到 1 点恐惧，或将你的 1 个线索放到你所在地点。
//
// 读点（卡面 → 引擎读点）：
//   · 显现结算：weakness.js#resolveWeaknessBody 优先执行 kind:'weakness' 描述子的 resolve()
//     （docs/card-model.md §3；09017/09020 同一形状），弱点头 `{ type: 'discardAfterResolve' }`
//     让结算结束后按普通弱点进入弃牌堆，而不是被误送进威胁区/地点附属。
//   · 「检定[意志](3)，每有 1 个带线索的支援难度 +1」：难度在发起 api.test 前按
//     `inv.assets` 上 clues > 0 的张数计算（与卡面同时点口径一致）。
//   · 「每失败 1 点二选一」：逐点 api.choice（没有线索时只能选恐惧；受到致命恐惧后停止）；
//     恐惧走 api.harm，线索走 api.loseClues + api.addCluesToLocation（只经 ctx.api 改状态，
//     不直写 inv.clues / location.clues）。
export default {
  code: '10008',
  name: '失败的实验',
  note: '恐惧按普通分配规则由 api.harm 结算（可分配给有理智容量的支援）；线索走 api.loseClues + api.addCluesToLocation。',
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'discardAfterResolve' },
      label: '显现：检定[意志](3，每个带线索的受控支援 +1)；每失败 1 点选择 1 点恐惧或放 1 个线索到地点',
      resolve: ({ inv, api }) => {
        const clueAssets = (inv.assets || []).filter(asset => (Number(asset.clues) || 0) > 0).length
        const difficulty = 3 + clueAssets
        api.test(inv.seat, 'willpower', difficulty, {
          source: { label: '失败的实验', code: '10008' },
          resolve: result => {
            if (!result || result.success) return
            const failedBy = Math.max(0, Number(result.summary?.failedBy
              ?? (difficulty - (Number(result.value) || 0))))
            for (let point = 0; point < failedBy; point++) {
              if (inv.defeated) break
              const canPlaceClue = (Number(inv.clues) || 0) > 0
              const answer = canPlaceClue ? api.choice({
                kind: 'effect', source: '10008', seat: inv.seat,
                prompt: `「失败的实验」：第 ${point + 1}/${failedBy} 点失败——受到 1 点恐惧，还是把 1 个线索放到你所在地点？`,
                options: [
                  { id: 'horror', label: '受到 1 点恐惧' },
                  { id: 'clue', label: '把 1 个线索放到你所在地点' },
                ],
              }) : 'horror'
              if (answer === 'clue') {
                const lost = api.loseClues(inv.seat, 1)
                if (lost) {
                  api.addCluesToLocation(inv.location, 1)
                  api.info(`🧪 「失败的实验」：${inv.name} 把 1 个线索放到「${api.locationName(inv.location)}」。`)
                } else {
                  api.harm(inv.seat, { horror: 1 })
                  api.info(`🧪 「失败的实验」：${inv.name} 受到 1 点恐惧。`)
                }
              } else {
                api.harm(inv.seat, { horror: 1 })
                api.info(`🧪 「失败的实验」：${inv.name} 受到 1 点恐惧。`)
              }
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
