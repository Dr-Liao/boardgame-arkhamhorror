// 06022 皇后的挂坠
// 卡面：绑定(一瓣缟玛瑙)。使用(3充能)。
//       如果本卡牌没有充能，将其放在一边，位于场外，将放在一边的3张一瓣缟玛瑙混洗入你的牌库。
//       [free]横置皇后的挂坠并花费1充能：选择一个已揭示的地点，并选择以下一项：
//       移动到该地点，发现该地点的1个线索，或自动躲避该地点的一个敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06022 皇后的挂坠：
//   · 使用(3 充能) → 条目 uses/usesType；free 能力消耗 1 充能并横置。
//   · 充能耗尽复位：在「花费最后 1 充能」的路径上结算（把挂坠放到一边 + 3 张一瓣缟玛瑙从
//     setAside 洗回牌库）。显式简化：引擎没有 uses 归零钩子，其他把充能清零的路径不会触发复位。

export default {
  code: '06022',
  uses: 3,
  usesType: 'charges',
  simplified: true,
  note: '未实现：充能归零的自动复位只在「花费最后 1 充能」这条路径上结算（引擎没有 uses 归零钩子）；'
    + '挂坠被其他效果清空充能时不会自动放在一边。',
  abilities: [
    {
      kind: 'free',
      label: '横置并花费 1 充能：移动到 / 发现线索于 / 自动躲避 一个已揭示地点',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ state, inv, source, api }) => {
        const revealed = (state.locations || []).filter(location => location.revealed)
        if (!revealed.length) {
          api.info('「皇后的挂坠」：没有已揭示的地点。')
          return
        }
        const locationId = revealed.length === 1 ? revealed[0].id : api.choice({
          kind: 'location', source: '06022', seat: inv.seat,
          prompt: '选择一个已揭示的地点。',
          options: revealed.map(location => ({ id: location.id, label: api.locationName(location.id) })),
        })
        const location = (state.locations || []).find(entry => entry.id === locationId)
        if (!location) return
        const enemyHere = (state.enemies || []).find(enemy => enemy.location === locationId && !enemy.defeated)
        const options = []
        if (locationId !== inv.location) options.push({ id: 'move', label: '移动到该地点' })
        if ((location.clues || 0) > 0) options.push({ id: 'clue', label: '发现该地点的 1 个线索' })
        if (enemyHere) options.push({ id: 'evade', label: '自动躲避该地点的一个敌人' })
        if (!options.length) {
          api.info('「皇后的挂坠」：该地点没有可结算的选项。')
        } else {
          const action = options.length === 1 ? options[0].id : api.choice({
            kind: 'effect', source: '06022', seat: inv.seat,
            prompt: `「皇后的挂坠」：选择在「${api.locationName(locationId)}」结算的选项。`,
            options,
          })
          if (action === 'move') api.moveInvestigator(inv.seat, locationId)
          else if (action === 'clue') api.discoverClue(inv.seat, 1, locationId)
          else if (action === 'evade') api.autoEvade(enemyHere)
        }
        // 使用(3 充能)：花费最后 1 充能后复位。
        if (source && (source.uses || 0) <= 0) {
          api.moveCard({ id: source.id, from: 'play', to: 'setAside' })
          for (let index = 0; index < 3; index++) {
            api.moveCard({ code: '06021', from: 'setAside', to: 'deckTop' })
          }
          api.shuffleDeck(inv.seat)
          api.info('「皇后的挂坠」充能耗尽：放到一边，3 张一瓣缟玛瑙洗回牌库。')
        }
      },
    },
  ],
  modifiers: [],
}
