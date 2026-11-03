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
//   · 充能归零由 onUsesEmptied 统一复位，挂坠放到一边并把 3 张一瓣缟玛瑙洗回牌库。

function choicesAt(state, inv, location, rules) {
  const move = rules.canMoveTo(inv.seat, location.id)
  const clue = rules.canDiscoverClueAt(inv.seat, location.id)
  const enemies = (state.enemies || []).filter(enemy => enemy.location === location.id
    && rules.canAutoEvade(enemy, inv.seat))
  return { move, clue, enemies, available: move || clue || enemies.length > 0 }
}

export default {
  code: '06022',
  uses: 3,
  usesType: 'charges',
  onUsesEmptied: ({ state, inv, source, api }) => {
    api.moveCard({ id: source.id, from: 'play', to: 'setAside', ownerSeat: inv.seat })
    const available = (state.setAside || []).filter(card =>
      (typeof card === 'string' ? card : card?.code) === '06021'
      && (typeof card === 'string' || card.ownerSeat == null || card.ownerSeat === inv.seat)).length
    let returned = 0
    for (let index = 0; index < Math.min(3, available); index++) {
      if (api.moveCard({ code: '06021', from: 'setAside', to: 'deckTop', ownerSeat: inv.seat })) returned += 1
    }
    if (returned > 0) api.shuffleDeck(inv.seat)
    api.info(`「皇后的挂坠」充能耗尽：放到一边，${returned} 张一瓣缟玛瑙洗回牌库。`)
  },
  abilities: [
    {
      kind: 'free',
      label: '横置并花费 1 充能：移动到 / 发现线索于 / 自动躲避 一个已揭示地点',
      cost: { action: false, exhaust: true, uses: 1 },
      criteria: [({ state, inv, helpers }) => (state.locations || []).some(location =>
        location.revealed && choicesAt(state, inv, location, helpers).available)],
      resolve: ({ state, inv, api }) => {
        const revealed = (state.locations || []).filter(location => location.revealed
          && choicesAt(state, inv, location, api).available)
        if (!revealed.length) {
          api.info('「皇后的挂坠」：没有可结算选项的已揭示地点。')
          return
        }
        const locationId = revealed.length === 1 ? revealed[0].id : api.choice({
          kind: 'location', source: '06022', seat: inv.seat,
          prompt: '选择一个已揭示的地点。',
          options: revealed.map(location => ({ id: location.id, label: api.locationName(location.id) })),
        })
        const location = (state.locations || []).find(entry => entry.id === locationId)
        if (!location) return
        const legal = choicesAt(state, inv, location, api)
        const enemiesHere = legal.enemies
        const options = []
        if (legal.move) options.push({ id: 'move', label: '移动到该地点' })
        if (legal.clue) options.push({ id: 'clue', label: '发现该地点的 1 个线索' })
        if (enemiesHere.length) options.push({ id: 'evade', label: '自动躲避该地点的一个敌人' })
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
          else if (action === 'evade') {
            const enemyId = enemiesHere.length === 1 ? enemiesHere[0].id : api.choice({
              kind: 'enemy', source: '06022', seat: inv.seat,
              prompt: '选择要自动躲避的敌人。',
              options: enemiesHere.map(enemy => ({ id: enemy.id, label: enemy.name })),
            })
            const target = enemiesHere.find(enemy => enemy.id === enemyId)
            if (target) api.autoEvade(target)
          }
        }
      },
    },
  ],
  modifiers: [],
}
